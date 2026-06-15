import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus as PrismaInvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { InvoiceLineDto } from './dto/invoice-line.dto';
import {
  EDITABLE_INVOICE_STATUSES,
  ISSUED_IMMUTABLE_STATUSES,
  InvoiceStatus,
} from './enums/invoice-status.enum';
import { InvoiceType } from './enums/invoice-type.enum';
import {
  computeDocumentFromInputs,
  computeDocumentFromLineNets,
  roundDownCent,
  roundExchangeRate,
} from '../../shared/utils/invoice-calculator';
import { InvoiceEventBus } from './events/invoice-event-bus';
import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceCreatedEvent } from './events/invoice-created.event';
import { InvoiceIssuedEvent } from './events/invoice-issued.event';
import { InvoiceCancelledEvent } from './events/invoice-cancelled.event';
import { InvoiceSentEvent } from './events/invoice-sent.event';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../settings/enums/numbering-document-type.enum';
import { SettingsService } from '../settings/settings.service';
import { EmailTemplateService } from '../settings/services/email-template.service';
import { EmailTemplateType } from '../settings/enums/email-template-type.enum';
import { computeDueDateFromPaymentTerm } from '../settings/utils/due-date.util';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { InvoiceMailService } from './services/invoice-mail.service';
import { DocumentAccessService } from '../documents/services/document-access.service';
import { EmailTrackingService } from '../documents/services/email-tracking.service';

type ResolvedLine = {
  position: number;
  itemId?: string;
  description: string;
  quantity: number;
  unitPriceHt: number;
  discountPct: number;
  discountAmount: number;
  taxRateId: string;
  lineTotalHt: number;
  taxAmount: number;
  lineTotalTtc: number;
};

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceEventBus: InvoiceEventBus,
    private readonly numberingService: DocumentNumberingService,
    private readonly settingsService: SettingsService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly invoiceMailService: InvoiceMailService,
    private readonly documentAccessService: DocumentAccessService,
    private readonly emailTrackingService: EmailTrackingService,
  ) {}

  private readonly invoiceInclude = {
    client: { include: { contacts: true } },
    contact: true,
    order: { select: { id: true, number: true, status: true } },
    quotation: { select: { id: true, number: true, status: true } },
    originalInvoice: { select: { id: true, number: true, totalTtc: true } },
    creditNotes: {
      select: { id: true, number: true, totalTtc: true, status: true },
    },
    lines: {
      orderBy: { position: 'asc' as const },
      include: { item: true, taxRate: true },
    },
    payments: {
      include: { payment: true },
      orderBy: { createdAt: 'desc' as const },
    },
    recurringInvoices: true,
  };

  async create(
    dto: CreateInvoiceDto,
    tenantId: string,
    createdBy: string,
  ) {
    if (dto.invoiceType === InvoiceType.CREDIT_NOTE) {
      throw new BadRequestException(
        'Use POST /invoices/:id/credit-note for credit notes (RM-F05)',
      );
    }

    await this.assertClient(tenantId, dto.clientId);
    await this.assertLinks(tenantId, dto);

    const { lines: resolvedLines, totals: computedTotals } =
      await this.computeDocumentLines(
        tenantId,
        dto.lines,
        dto.discountPct ?? 0,
        dto.discountAmount ?? 0,
      );
    let totals = computedTotals;

    let depositAmount: number | undefined;
    if (dto.invoiceType === InvoiceType.BALANCE && dto.orderId) {
      const deduction = await this.computeDepositDeduction(tenantId, dto.orderId);
      depositAmount = deduction.totalDepositsTtc;
      totals = {
        ...totals,
        totalTtc: roundDownCent(Math.max(0, totals.totalTtc - depositAmount)),
      };
    }

    const issueDate = new Date(dto.issueDate);
    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.INVOICE_DRAFT,
    );
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : await this.resolveDueDate(tenantId, issueDate, dto.paymentTermId);
    const tenantSettings = await this.settingsService.getTenantSettings(tenantId);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        number,
        invoiceType: (dto.invoiceType ?? InvoiceType.STANDARD) as any,
        status: InvoiceStatus.DRAFT,
        clientId: dto.clientId,
        contactId: dto.contactId,
        orderId: dto.orderId,
        quotationId: dto.quotationId,
        issueDate,
        dueDate,
        currency: dto.currency ?? tenantSettings.primaryCurrency,
        exchangeRate: roundExchangeRate(dto.exchangeRate ?? 1),
        paymentTermId: dto.paymentTermId,
        subtotalHt: totals.subtotalHt,
        discountPct: totals.discountPct,
        discountAmount: totals.discountAmount,
        baseHt: totals.baseHt,
        totalTax: totals.totalTax,
        totalTtc: totals.totalTtc,
        amountPaid: 0,
        amountDue: totals.totalTtc,
        depositAmount,
        notes: await this.mergeNotesWithPenalty(tenantId, dto.notes),
        internalNotes: dto.internalNotes,
        createdBy,
        lines: {
          create: resolvedLines.map((line) => ({
            tenantId,
            position: line.position,
            itemId: line.itemId,
            description: line.description,
            quantity: line.quantity,
            unitPriceHt: line.unitPriceHt,
            discountPct: line.discountPct,
            discountAmount: line.discountAmount,
            lineTotalHt: line.lineTotalHt,
            taxRateId: line.taxRateId,
            taxAmount: line.taxAmount,
            lineTotalTtc: line.lineTotalTtc,
          })),
        },
      },
      include: this.invoiceInclude,
    });

    if (dto.orderId) {
      await this.syncOrderBilling(dto.orderId, tenantId);
    }

    this.invoiceEventBus.publish(
      new InvoiceCreatedEvent(InvoiceEntity.fromPrisma(invoice)),
    );

    return this.enrichResponse(invoice);
  }

  async createFromOrder(
    order: {
      id: string;
      clientId: string;
      quotationId: string | null;
      currency: string;
      totalTtc: number;
      lines: Array<{
        itemId: string | null;
        description: string;
        quantity: number;
        unitPriceHt: number;
        discountPct: number;
        discountAmount: number;
        lineTotalHt: number;
        taxRateId: string | null;
        taxAmount: number;
        lineTotalTtc: number;
      }>;
    },
    tenantId: string,
    options: {
      amountTtc?: number;
      billingPct?: number;
      invoiceType?: string;
      dueDate?: string;
    },
    createdBy: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const remaining = await this.getOrderRemainingToInvoice(
      order.id,
      tenantId,
      db,
    );

    if (remaining <= 0) {
      throw new BadRequestException('Order is already fully billed');
    }

    let amountTtc = options.amountTtc ?? remaining;
    if (options.billingPct) {
      amountTtc = roundDownCent(remaining * (options.billingPct / 100));
    }
    if (amountTtc > remaining + 0.01) {
      throw new BadRequestException(
        `Amount exceeds remaining to invoice (${remaining})`,
      );
    }

    const ratio = amountTtc / order.totalTtc;
    const invoiceLines = order.lines.map((line, index) => ({
      tenantId,
      position: index + 1,
      itemId: line.itemId,
      description: line.description,
      quantity: line.quantity,
      unitPriceHt: line.unitPriceHt,
      discountPct: line.discountPct,
      discountAmount: line.discountAmount,
      lineTotalHt: roundDownCent(line.lineTotalHt * ratio),
      taxRateId: line.taxRateId,
      taxAmount: roundDownCent(line.taxAmount * ratio),
      lineTotalTtc: roundDownCent(line.lineTotalTtc * ratio),
    }));

    const subtotalHt = roundDownCent(
      invoiceLines.reduce((s, l) => s + l.lineTotalHt, 0),
    );
    const totalTax = roundDownCent(
      invoiceLines.reduce((s, l) => s + l.taxAmount, 0),
    );
    const totalTtc = roundDownCent(subtotalHt + totalTax);

    const invoiceType = (options.invoiceType ?? 'standard') as InvoiceType;
    let depositAmount: number | undefined;

    if (invoiceType === InvoiceType.BALANCE) {
      const deduction = await this.computeDepositDeduction(tenantId, order.id, db);
      depositAmount = deduction.totalDepositsTtc;
    }

    const finalTtc = depositAmount
      ? roundDownCent(Math.max(0, totalTtc - depositAmount))
      : totalTtc;

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.INVOICE_DRAFT,
    );

    const run = async (client: Prisma.TransactionClient) => {
      const created = await client.invoice.create({
        data: {
          tenantId,
          number,
          invoiceType: invoiceType as any,
          status: InvoiceStatus.DRAFT,
          clientId: order.clientId,
          orderId: order.id,
          quotationId: order.quotationId,
          issueDate: new Date(),
          dueDate: options.dueDate ? new Date(options.dueDate) : null,
          currency: order.currency,
          subtotalHt,
          discountPct: 0,
          discountAmount: 0,
          baseHt: subtotalHt,
          totalTax,
          totalTtc: finalTtc,
          amountPaid: 0,
          amountDue: finalTtc,
          depositAmount,
          createdBy,
          lines: { create: invoiceLines },
        },
        include: this.invoiceInclude,
      });

      await this.syncOrderBillingInTx(client, order.id, tenantId);
      return created;
    };

    if (tx) return run(tx);
    return this.prisma.$transaction(run);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: InvoiceStatus,
    invoiceType?: InvoiceType,
    clientId?: string,
    q?: string,
  ) {
    await this.syncOverdueInvoices(tenantId);

    const where: Prisma.InvoiceWhereInput = { tenantId };
    if (status) where.status = status;
    if (invoiceType) where.invoiceType = invoiceType;
    if (clientId) where.clientId = clientId;
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { client: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: this.invoiceInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: items.map((inv) => this.enrichResponse(inv)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    await this.syncOverdueInvoices(tenantId);

    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: this.invoiceInclude,
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    return this.enrichResponse(invoice);
  }

  async update(id: string, tenantId: string, dto: UpdateInvoiceDto) {
    const existing = await this.findOne(id, tenantId);

    if (!EDITABLE_INVOICE_STATUSES.includes(existing.status as InvoiceStatus)) {
      throw new BadRequestException(
        'Only draft invoices can be modified (RM-F02)',
      );
    }

    if (existing.invoiceType === InvoiceType.PROFORMA && dto.invoiceType) {
      // allow type change in draft
    }

    const discountPct = dto.discountPct ?? existing.discountPct;
    const discountAmount = dto.discountAmount ?? existing.discountAmount;

    const { lines, totals } = dto.lines
      ? await this.computeDocumentLines(
          tenantId,
          dto.lines,
          discountPct,
          discountAmount,
        )
      : await this.computeDocumentFromExistingLines(
          tenantId,
          existing.lines,
          discountPct,
          discountAmount,
        );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          contactId: dto.contactId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          dueDate:
            dto.dueDate === undefined
              ? undefined
              : dto.dueDate
                ? new Date(dto.dueDate)
                : null,
          currency: dto.currency,
          exchangeRate:
            dto.exchangeRate !== undefined
              ? roundExchangeRate(dto.exchangeRate)
              : undefined,
          paymentTermId: dto.paymentTermId,
          subtotalHt: totals.subtotalHt,
          discountPct: totals.discountPct,
          discountAmount: totals.discountAmount,
          baseHt: totals.baseHt,
          totalTax: totals.totalTax,
          totalTtc: totals.totalTtc,
          amountDue: roundDownCent(totals.totalTtc - existing.amountPaid),
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          ...(dto.lines
            ? {
                lines: {
                  create: lines.map((line) => ({
                    tenantId,
                    position: line.position,
                    itemId: line.itemId,
                    description: line.description,
                    quantity: line.quantity,
                    unitPriceHt: line.unitPriceHt,
                    discountPct: line.discountPct,
                    discountAmount: line.discountAmount,
                    lineTotalHt: line.lineTotalHt,
                    taxRateId: line.taxRateId,
                    taxAmount: line.taxAmount,
                    lineTotalTtc: line.lineTotalTtc,
                  })),
                },
              }
            : {}),
        },
        include: this.invoiceInclude,
      });
    });

    return this.enrichResponse(updated);
  }

  async issue(id: string, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be issued');
    }

    if (invoice.invoiceType === InvoiceType.PROFORMA) {
      // proforma can be issued for document purposes
    }

    const finalNumber = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.INVOICE_ISSUED,
    );

    const issueDate = new Date();
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.ISSUED,
        number: finalNumber,
        issueDate,
      },
      include: this.invoiceInclude,
    });

    await this.invoicePdfService.ensureGenerated(tenantId, id);

    this.invoiceEventBus.publish(
      new InvoiceIssuedEvent(
        InvoiceEntity.fromPrisma(updated),
        finalNumber,
        updated.lines.map((line) => ({
          itemId: line.itemId,
          description: line.description,
          quantity: line.quantity,
          lineTotalHt: line.lineTotalHt,
          taxAmount: line.taxAmount,
          lineTotalTtc: line.lineTotalTtc,
        })),
        issueDate,
      ),
    );

    return this.enrichResponse(updated);
  }

  async send(id: string, tenantId: string, dto: SendInvoiceDto) {
    const invoice = await this.findOne(id, tenantId);

    if (
      !ISSUED_IMMUTABLE_STATUSES.includes(invoice.status as InvoiceStatus) &&
      invoice.status !== InvoiceStatus.DRAFT
    ) {
      throw new BadRequestException('Invoice must be issued before sending');
    }

    const pdfUrl = this.invoicePdfService.getPublicUrl(id);
    await this.invoicePdfService.ensureGenerated(tenantId, id);

    let data: Prisma.InvoiceUpdateInput = {
      sentAt: new Date(),
      pdfUrl,
    };

    let issuedNumber = invoice.number;
    const issueDate = new Date();

    if (invoice.status === InvoiceStatus.DRAFT) {
      const finalNumber = await this.numberingService.generateNext(
        tenantId,
        NumberingDocumentType.INVOICE_ISSUED,
      );
      issuedNumber = finalNumber;
      data = {
        ...data,
        status: InvoiceStatus.SENT,
        number: finalNumber,
        issueDate,
      };
    } else if (invoice.status === InvoiceStatus.ISSUED) {
      data.status = InvoiceStatus.SENT;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data,
      include: this.invoiceInclude,
    });

    const recipientEmail = await this.resolveRecipientEmail(
      updated,
      dto.recipientEmail,
    );

    const access = await this.documentAccessService.createToken(
      tenantId,
      'invoice',
      id,
    );

    let mailResult: { sent: boolean; reason?: string } = {
      sent: false,
      reason: 'no_recipient',
    };
    if (recipientEmail) {
      const buffer = await this.invoicePdfService.read(tenantId, id);
      if (buffer) {
        const dueDateStr = updated.dueDate
          ? updated.dueDate.toLocaleDateString('fr-FR')
          : '';
        const mailContent = await this.emailTemplateService.render(
          tenantId,
          EmailTemplateType.INVOICE_SEND,
          {
            documentNumber: issuedNumber,
            clientName: updated.client.companyName,
            amountDue: updated.amountDue.toFixed(2),
            currency: updated.currency,
            dueDate: dueDateStr,
            downloadUrl: access.downloadUrl,
            message: dto.message ?? '',
          },
        );

        let html: string | undefined;
        if (this.emailTrackingService.isEnabled()) {
          const tracking = await this.emailTrackingService.createTracking(
            tenantId,
            'invoice',
            id,
            recipientEmail,
          );
          html = this.emailTrackingService.buildHtmlWithPixel(
            mailContent.body.replace(/\n/g, '<br>'),
            tracking.pixelUrl,
          );
        }

        mailResult = await this.invoiceMailService.send({
          to: recipientEmail,
          subject: mailContent.subject,
          text: `${mailContent.body}\n\nTéléchargement : ${access.downloadUrl}`,
          html,
          pdf: buffer,
          filename: `${issuedNumber}.pdf`,
        });
      }
    }

    this.invoiceEventBus.publish(
      new InvoiceSentEvent(
        InvoiceEntity.fromPrisma(updated),
        recipientEmail,
      ),
    );

    return {
      invoice: this.enrichResponse(updated),
      recipientEmail,
      message: dto.message,
      pdfUrl,
      downloadUrl: access.downloadUrl,
      email: mailResult,
    };
  }

  async getPdf(id: string, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);
    await this.invoicePdfService.ensureGenerated(tenantId, id);
    const buffer = await this.invoicePdfService.read(tenantId, id);
    if (!buffer) {
      throw new NotFoundException('PDF not found for this invoice');
    }
    return { buffer, filename: `${invoice.number}.pdf` };
  }

  private async resolveRecipientEmail(
    invoice: { contact?: { email?: string | null } | null; client: { contacts?: Array<{ email?: string | null; isPrimary?: boolean }> } },
    explicit?: string,
  ): Promise<string | null> {
    if (explicit?.trim()) return explicit.trim();
    if (invoice.contact?.email) return invoice.contact.email;
    const primary = invoice.client.contacts?.find((c) => c.isPrimary);
    if (primary?.email) return primary.email;
    const any = invoice.client.contacts?.find((c) => c.email);
    return any?.email ?? null;
  }

  async createCreditNote(
    id: string,
    tenantId: string,
    dto: CreateCreditNoteDto,
    createdBy: string,
  ) {
    const original = await this.findOne(id, tenantId);

    if (original.invoiceType === InvoiceType.CREDIT_NOTE) {
      throw new BadRequestException('Cannot create credit note on a credit note');
    }

    if (
      ![InvoiceStatus.ISSUED, InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.PAID, InvoiceStatus.OVERDUE].includes(
        original.status as InvoiceStatus,
      )
    ) {
      throw new BadRequestException(
        'Credit note requires an issued invoice (RM-F05)',
      );
    }

    const maxAmount = original.amountDue > 0 ? original.amountDue : original.totalTtc;
    let totalTtc = dto.amountTtc ?? maxAmount;

    if (totalTtc > maxAmount + 0.01) {
      throw new BadRequestException(
        `Credit note amount cannot exceed original (${maxAmount}) — RM-F05`,
      );
    }

    let lines: ResolvedLine[] = dto.lines
      ? (await this.computeDocumentLines(tenantId, dto.lines)).lines
      : original.lines.map((line, index) => ({
          position: index + 1,
          itemId: line.itemId ?? undefined,
          description: `Avoir — ${line.description}`,
          quantity: line.quantity,
          unitPriceHt: line.unitPriceHt,
          discountPct: 0,
          discountAmount: 0,
          taxRateId: line.taxRateId!,
          lineTotalHt: line.lineTotalHt,
          taxAmount: line.taxAmount,
          lineTotalTtc: line.lineTotalTtc,
        }));

    if (dto.amountTtc && !dto.lines) {
      const ratio = totalTtc / original.totalTtc;
      for (const line of lines) {
        line.lineTotalHt = roundDownCent(line.lineTotalHt * ratio);
        line.taxAmount = roundDownCent(line.taxAmount * ratio);
        line.lineTotalTtc = roundDownCent(line.lineTotalHt + line.taxAmount);
      }
    }

    const { lines: recomputedLines, totals } =
      await this.computeTotalsFromResolvedLines(tenantId, lines);
    lines = recomputedLines;
    totalTtc = totals.totalTtc;

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.INVOICE_DRAFT,
    );

    const creditNote = await this.prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          tenantId,
          number,
          invoiceType: InvoiceType.CREDIT_NOTE as any,
          status: InvoiceStatus.DRAFT,
          clientId: original.clientId,
          contactId: original.contactId,
          orderId: original.orderId,
          quotationId: original.quotationId,
          originalInvoiceId: original.id,
          issueDate: new Date(),
          currency: original.currency,
          exchangeRate: original.exchangeRate,
          subtotalHt: totals.subtotalHt,
          baseHt: totals.baseHt,
          totalTax: totals.totalTax,
          totalTtc,
          amountPaid: 0,
          amountDue: totalTtc,
          notes: dto.notes ?? `Avoir sur facture ${original.number}`,
          createdBy,
          lines: {
            create: lines.map((line) => ({
              tenantId,
              position: line.position,
              itemId: line.itemId,
              description: line.description,
              quantity: line.quantity,
              unitPriceHt: line.unitPriceHt,
              discountPct: line.discountPct,
              discountAmount: line.discountAmount,
              lineTotalHt: line.lineTotalHt,
              taxRateId: line.taxRateId,
              taxAmount: line.taxAmount,
              lineTotalTtc: line.lineTotalTtc,
            })),
          },
        },
        include: this.invoiceInclude,
      });

      if (totalTtc >= maxAmount - 0.01) {
        await tx.invoice.update({
          where: { id: original.id },
          data: {
            status: InvoiceStatus.CANCELLED,
            cancelledAt: new Date(),
            amountDue: 0,
          },
        });
      } else {
        await tx.invoice.update({
          where: { id: original.id },
          data: {
            amountDue: roundDownCent(maxAmount - totalTtc),
            status:
              original.amountPaid > 0
                ? InvoiceStatus.PARTIAL
                : InvoiceStatus.ISSUED,
          },
        });
      }

      return created;
    });

    if (totalTtc >= maxAmount - 0.01) {
      this.invoiceEventBus.publish(
        new InvoiceCancelledEvent(
          InvoiceEntity.fromPrisma(original as any),
          creditNote.id,
          totalTtc,
        ),
      );
    }

    return this.enrichResponse(creditNote);
  }

  async remove(id: string, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be deleted');
    }

    await this.prisma.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await this.prisma.invoice.delete({ where: { id } });

    if (invoice.orderId) {
      await this.syncOrderBilling(invoice.orderId, tenantId);
    }

    return { message: 'Invoice deleted successfully', invoiceId: id };
  }

  /** RM-F08 — clone le modèle en brouillon pour une échéance récurrente */
  async cloneAsDraftFromTemplate(
    templateInvoiceId: string,
    tenantId: string,
    options: {
      issueDate: Date;
      recurringSourceId: string;
      createdBy: string;
    },
  ) {
    const template = await this.prisma.invoice.findFirst({
      where: { id: templateInvoiceId, tenantId },
      include: { lines: { orderBy: { position: 'asc' } }, paymentTerm: true },
    });

    if (!template) {
      throw new NotFoundException('Template invoice not found');
    }

    if (template.invoiceType === (InvoiceType.CREDIT_NOTE as string)) {
      throw new BadRequestException(
        'Credit notes cannot be used as recurring templates',
      );
    }

    let dueDate: Date | null = null;
    if (template.paymentTerm) {
      dueDate = computeDueDateFromPaymentTerm(
        options.issueDate,
        template.paymentTerm.days,
        template.paymentTerm.endOfMonth,
      );
    } else if (template.dueDate) {
      const offsetMs =
        template.dueDate.getTime() - template.issueDate.getTime();
      dueDate = new Date(options.issueDate.getTime() + offsetMs);
    }

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.INVOICE_DRAFT,
    );

    const draft = await this.prisma.invoice.create({
      data: {
        tenantId,
        number,
        invoiceType: template.invoiceType,
        status: InvoiceStatus.DRAFT,
        clientId: template.clientId,
        contactId: template.contactId,
        orderId: template.orderId,
        quotationId: template.quotationId,
        recurringSourceId: options.recurringSourceId,
        issueDate: options.issueDate,
        dueDate,
        currency: template.currency,
        exchangeRate: template.exchangeRate,
        paymentTermId: template.paymentTermId,
        subtotalHt: template.subtotalHt,
        discountPct: template.discountPct,
        discountAmount: template.discountAmount,
        baseHt: template.baseHt,
        totalTax: template.totalTax,
        totalTtc: template.totalTtc,
        amountPaid: 0,
        amountDue: template.totalTtc,
        depositAmount: template.depositAmount,
        notes: template.notes,
        internalNotes: `[recurring] Généré depuis ${template.number}`,
        createdBy: options.createdBy,
        lines: {
          create: template.lines.map((line) => ({
            tenantId,
            position: line.position,
            itemId: line.itemId,
            description: line.description,
            quantity: line.quantity,
            unitPriceHt: line.unitPriceHt,
            discountPct: line.discountPct,
            discountAmount: line.discountAmount,
            lineTotalHt: line.lineTotalHt,
            taxRateId: line.taxRateId,
            taxAmount: line.taxAmount,
            lineTotalTtc: line.lineTotalTtc,
          })),
        },
      },
      include: this.invoiceInclude,
    });

    this.invoiceEventBus.publish(
      new InvoiceCreatedEvent(InvoiceEntity.fromPrisma(draft)),
    );

    return draft;
  }

  private async computeDocumentLines(
    tenantId: string,
    lines: InvoiceLineDto[],
    globalDiscountPct = 0,
    globalDiscountAmount = 0,
  ) {
    const inputs = await Promise.all(
      lines.map(async (line) => {
        const taxRate = await this.prisma.taxRate.findFirst({
          where: { id: line.taxRateId, tenantId, isActive: true },
        });

        if (!taxRate) {
          throw new BadRequestException(`Tax rate not found: ${line.taxRateId}`);
        }

        return {
          meta: line,
          input: {
            quantity: line.quantity,
            unitPriceHt: line.unitPriceHt,
            discountPct: line.discountPct,
            discountAmount: line.discountAmount,
            taxRate: taxRate.rate,
          },
        };
      }),
    );

    const { lines: computed, totals } = computeDocumentFromInputs(
      inputs.map((entry) => entry.input),
      globalDiscountPct,
      globalDiscountAmount,
    );

    return {
      totals,
      lines: computed.map((line, index) => ({
        position: index + 1,
        itemId: inputs[index].meta.itemId,
        description: inputs[index].meta.description,
        quantity: inputs[index].meta.quantity,
        unitPriceHt: inputs[index].meta.unitPriceHt,
        discountPct: inputs[index].meta.discountPct ?? 0,
        discountAmount: inputs[index].meta.discountAmount ?? 0,
        taxRateId: inputs[index].meta.taxRateId,
        lineTotalHt: line.lineTotalHt,
        taxAmount: line.taxAmount,
        lineTotalTtc: line.lineTotalTtc,
      })) as ResolvedLine[],
    };
  }

  private async computeDocumentFromExistingLines(
    tenantId: string,
    lines: Array<{
      itemId: string | null;
      description: string;
      quantity: number;
      unitPriceHt: number;
      discountPct: number;
      discountAmount: number;
      taxRateId: string | null;
    }>,
    globalDiscountPct = 0,
    globalDiscountAmount = 0,
  ) {
    const dtoLines: InvoiceLineDto[] = lines.map((line) => ({
      itemId: line.itemId ?? undefined,
      description: line.description,
      quantity: line.quantity,
      unitPriceHt: line.unitPriceHt,
      discountPct: line.discountPct,
      discountAmount: line.discountAmount,
      taxRateId: line.taxRateId!,
    }));

    return this.computeDocumentLines(
      tenantId,
      dtoLines,
      globalDiscountPct,
      globalDiscountAmount,
    );
  }

  private async computeTotalsFromResolvedLines(
    tenantId: string,
    lines: ResolvedLine[],
    globalDiscountPct = 0,
    globalDiscountAmount = 0,
  ) {
    const rates = await this.loadTaxRatesForLines(tenantId, lines);
    const lineNets = lines.map((line, index) => ({
      grossHt: line.lineTotalHt,
      lineDiscount: 0,
      lineTotalHt: line.lineTotalHt,
      taxRate: rates[index],
    }));

    const { lines: computed, totals } = computeDocumentFromLineNets(
      lineNets,
      globalDiscountPct,
      globalDiscountAmount,
    );

    return {
      totals,
      lines: lines.map((line, index) => ({
        ...line,
        taxAmount: computed[index].taxAmount,
        lineTotalTtc: computed[index].lineTotalTtc,
      })),
    };
  }

  private async loadTaxRatesForLines(
    tenantId: string,
    lines: Array<{ taxRateId: string }>,
  ) {
    const ids = [...new Set(lines.map((l) => l.taxRateId))];
    const rateRows = await this.prisma.taxRate.findMany({
      where: { tenantId, id: { in: ids } },
    });
    const map = new Map(rateRows.map((r) => [r.id, r.rate]));
    return lines.map((l) => map.get(l.taxRateId) ?? 0);
  }

  private async computeDepositDeduction(
    tenantId: string,
    orderId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const deposits = await db.invoice.findMany({
      where: {
        tenantId,
        orderId,
        invoiceType: InvoiceType.DEPOSIT as any,
        status: {
          notIn: [PrismaInvoiceStatus.cancelled, PrismaInvoiceStatus.draft],
        },
      },
      select: { id: true, totalTtc: true },
    });

    const totalDepositsTtc = roundDownCent(
      deposits.reduce((s, d) => s + d.totalTtc, 0),
    );

    return {
      totalDepositsTtc,
      depositInvoiceIds: deposits.map((d) => d.id),
    };
  }

  private async getOrderRemainingToInvoice(
    orderId: string,
    tenantId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const order = await db.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const invoices = await db.invoice.findMany({
      where: {
        tenantId,
        orderId,
        status: { not: PrismaInvoiceStatus.cancelled },
        invoiceType: { not: InvoiceType.CREDIT_NOTE as any },
      },
      select: { totalTtc: true },
    });

    const invoiced = roundDownCent(
      invoices.reduce((s, i) => s + i.totalTtc, 0),
    );

    return roundDownCent(Math.max(0, order.totalTtc - invoiced));
  }

  private async syncOrderBilling(orderId: string, tenantId: string) {
    await this.syncOrderBillingInTx(this.prisma, orderId, tenantId);
  }

  private async syncOrderBillingInTx(
    tx: Prisma.TransactionClient | PrismaService,
    orderId: string,
    tenantId: string,
  ) {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        invoices: {
          where: { status: { not: PrismaInvoiceStatus.cancelled } },
          select: { totalTtc: true },
        },
      },
    });

    if (!order || order.status === 'cancelled') return;

    const invoiced = roundDownCent(
      order.invoices.reduce((s, i) => s + i.totalTtc, 0),
    );
    const remaining = roundDownCent(Math.max(0, order.totalTtc - invoiced));

    let status = 'confirmed';
    if (remaining <= 0.01) status = 'paid';
    else if (invoiced > 0) status = 'partially_paid';

    await tx.order.update({
      where: { id: orderId },
      data: { status: status as any },
    });
  }

  private async syncOverdueInvoices(tenantId: string) {
    await this.prisma.invoice.updateMany({
      where: {
        tenantId,
        status: {
          in: [
            PrismaInvoiceStatus.issued,
            PrismaInvoiceStatus.sent,
            PrismaInvoiceStatus.partial,
          ],
        },
        dueDate: { lt: new Date() },
        amountDue: { gt: 0 },
      },
      data: { status: PrismaInvoiceStatus.overdue },
    });
  }

  private enrichResponse(invoice: any) {
    return {
      ...invoice,
      legalMentions: {
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        notes: invoice.notes,
        paymentTerm: invoice.paymentTerm ?? null,
      },
      depositDeduction: invoice.depositAmount ?? null,
    };
  }

  private async assertClient(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new BadRequestException('Client not found');
  }

  private async assertLinks(tenantId: string, dto: CreateInvoiceDto) {
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, tenantId },
      });
      if (!order) throw new BadRequestException('Order not found');
      if (order.clientId !== dto.clientId) {
        throw new BadRequestException('Order client mismatch');
      }
    }
    if (dto.quotationId) {
      const q = await this.prisma.quotation.findFirst({
        where: { id: dto.quotationId, tenantId },
      });
      if (!q) throw new BadRequestException('Quotation not found');
    }
  }

  private async resolveDueDate(
    tenantId: string,
    issueDate: Date,
    paymentTermId?: string,
  ): Promise<Date | null> {
    let termId = paymentTermId;
    if (!termId) {
      const defaultTerm =
        await this.settingsService.getDefaultPaymentTerm(tenantId);
      termId = defaultTerm?.id;
    }
    if (!termId) return null;

    const term = await this.prisma.paymentTerm.findFirst({
      where: { id: termId, tenantId },
    });
    if (!term) return null;

    return computeDueDateFromPaymentTerm(
      issueDate,
      term.days,
      term.endOfMonth,
    );
  }

  private async mergeNotesWithPenalty(
    tenantId: string,
    notes?: string,
  ): Promise<string | undefined> {
    const mention = await this.settingsService.getLatePaymentMention(tenantId);
    if (!mention) return notes;

    if (notes?.includes(mention)) return notes;
    return notes ? `${notes}\n\n${mention}` : mention;
  }
}
