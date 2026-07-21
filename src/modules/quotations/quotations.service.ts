/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CrmMessages } from '../../shared/constants/crm-messages';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { SendQuotationDto } from './dto/send-quotation.dto';
import {
  ConvertQuotationDto,
  ConvertQuotationTarget,
} from './dto/convert-quotation.dto';
import { ChangeQuotationStatusDto } from './dto/change-quotation-status.dto';
import { QuotationLineDto } from './dto/quotation-line.dto';
import {
  EDITABLE_QUOTATION_STATUSES,
  QuotationStatus,
} from './enums/quotation-status.enum';
import { computeDocument } from './utils/quotation-calculator';
import { roundExchangeRate } from '../../shared/utils/document-calculator';
import { QuotationEventBus } from './events/quotation-event-bus';
import { QuotationEntity } from './entities/quotation.entity';
import { QuotationCreatedEvent } from './events/quotation-created.event';
import { QuotationUpdatedEvent } from './events/quotation-updated.event';
import { QuotationDeletedEvent } from './events/quotation-deleted.event';
import { QuotationSentEvent } from './events/quotation-sent.event';
import { QuotationStatusChangedEvent } from './events/quotation-status-changed.event';
import { QuotationConvertedEvent } from './events/quotation-converted.event';
import { QuotationPdfService } from './services/quotation-pdf.service';
import {
  QuotationMailService,
  SendQuotationMailResult,
} from './services/quotation-mail.service';
import { OrdersService } from '../orders/orders.service';
import { DEFAULT_PAGE_SIZE } from '../../shared/utils/pagination.util';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../settings/enums/numbering-document-type.enum';
import { EmailTemplateService } from '../settings/services/email-template.service';
import { SettingsService } from '../settings/settings.service';
import { EmailTemplateType } from '../settings/enums/email-template-type.enum';
import { DocumentAccessService } from '../documents/services/document-access.service';
import { EmailTrackingService } from '../documents/services/email-tracking.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums/audit.enum';
import { buildDocumentPreviewResponse } from '../../shared/pdf/document-preview.util';

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
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotationEventBus: QuotationEventBus,
    private readonly quotationPdfService: QuotationPdfService,
    private readonly quotationMailService: QuotationMailService,
    private readonly ordersService: OrdersService,
    private readonly numberingService: DocumentNumberingService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly settingsService: SettingsService,
    private readonly documentAccessService: DocumentAccessService,
    private readonly emailTrackingService: EmailTrackingService,
    private readonly auditService: AuditService,
  ) {}

  private readonly quotationInclude = {
    client: true,
    contact: true,
    paymentTerm: true,
    lines: {
      orderBy: { position: 'asc' as const },
      include: { item: true, taxRate: true },
    },
  };

  async create(dto: CreateQuotationDto, tenantId: string, createdBy: string) {
    await this.assertClient(tenantId, dto.clientId);
    await this.assertContact(tenantId, dto.clientId, dto.contactId);
    await this.assertPaymentTerm(tenantId, dto.paymentTermId);

    const { lines: resolvedLines, totals } = await this.computeDocumentLines(
      tenantId,
      dto.lines,
      dto.discountPct ?? 0,
      dto.discountAmount ?? 0,
    );
    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.QUOTATION,
    );
    const tenantSettings = await this.settingsService.getTenantSettings(tenantId);

    const quotation = await this.prisma.quotation.create({
      data: {
        tenantId,
        number,
        clientId: dto.clientId,
        contactId: dto.contactId,
        status: QuotationStatus.DRAFT,
        issueDate: new Date(dto.issueDate),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        currency: dto.currency ?? tenantSettings.primaryCurrency,
        exchangeRate: roundExchangeRate(dto.exchangeRate ?? 1),
        paymentTermId: dto.paymentTermId,
        subtotalHt: totals.subtotalHt,
        discountPct: totals.discountPct,
        discountAmount: totals.discountAmount,
        baseHt: totals.baseHt,
        totalTax: totals.totalTax,
        totalTtc: totals.totalTtc,
        notes: dto.notes,
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
      include: this.quotationInclude,
    });

    this.quotationEventBus.publish(
      new QuotationCreatedEvent(QuotationEntity.fromPrisma(quotation)),
    );

    await this.auditService.record({
      tenantId,
      userId: createdBy,
      entityType: AuditEntityType.QUOTATION,
      entityId: quotation.id,
      action: AuditAction.CREATE,
      changes: { number: quotation.number, totalTtc: quotation.totalTtc },
    });

    return quotation;
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    status?: QuotationStatus,
    clientId?: string,
    q?: string,
  ) {
    await this.expireStaleQuotations(tenantId);

    const where: Prisma.QuotationWhereInput = { tenantId };

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { client: { companyName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        include: this.quotationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    await this.expireStaleQuotations(tenantId);
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, tenantId },
      include: this.quotationInclude,
    });

    if (!quotation) {
      throw new NotFoundException(CrmMessages.quotation.NOT_FOUND);
    }

    return quotation;
  }

  async update(id: string, tenantId: string, dto: UpdateQuotationDto) {
    const existing = await this.findOne(id, tenantId);

    if (
      !EDITABLE_QUOTATION_STATUSES.includes(existing.status as QuotationStatus)
    ) {
      throw new BadRequestException(CrmMessages.quotation.NOT_EDITABLE);
    }

    await this.assertContact(tenantId, existing.clientId, dto.contactId);
    await this.assertPaymentTerm(tenantId, dto.paymentTermId);

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

    let internalNotes = dto.internalNotes ?? existing.internalNotes;
    if (existing.status === QuotationStatus.SENT && existing.pdfUrl) {
      const archiveNote = `[archived ${new Date().toISOString()}] previous PDF: ${existing.pdfUrl}`;
      internalNotes = internalNotes
        ? `${internalNotes}\n${archiveNote}`
        : archiveNote;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.quotationLine.deleteMany({ where: { quotationId: id } });
      }

      return tx.quotation.update({
        where: { id },
        data: {
          contactId: dto.contactId,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          expiryDate:
            dto.expiryDate === undefined
              ? undefined
              : dto.expiryDate
                ? new Date(dto.expiryDate)
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
          notes: dto.notes,
          internalNotes,
          pdfUrl: existing.status === QuotationStatus.SENT ? null : undefined,
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
        include: this.quotationInclude,
      });
    });

    this.quotationEventBus.publish(
      new QuotationUpdatedEvent(QuotationEntity.fromPrisma(updated)),
    );

    await this.auditService.record({
      tenantId,
      entityType: AuditEntityType.QUOTATION,
      entityId: id,
      action: AuditAction.UPDATE,
      changes: { totalTtc: updated.totalTtc },
    });

    await this.quotationPdfService.removeCached(tenantId, id);

    return updated;
  }

  async remove(id: string, tenantId: string) {
    const quotation = await this.findOne(id, tenantId);

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException(CrmMessages.quotation.ONLY_DRAFT_DELETE);
    }

    await this.prisma.quotationLine.deleteMany({ where: { quotationId: id } });
    await this.prisma.quotation.delete({ where: { id } });

    this.quotationEventBus.publish(
      new QuotationDeletedEvent(QuotationEntity.fromPrisma(quotation)),
    );

    await this.auditService.record({
      tenantId,
      entityType: AuditEntityType.QUOTATION,
      entityId: id,
      action: AuditAction.DELETE,
    });

    return { message: 'Quotation deleted successfully', quotationId: id };
  }

  async send(id: string, tenantId: string, dto: SendQuotationDto) {
    const quotation = await this.findOne(id, tenantId);

    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException(CrmMessages.quotation.ONLY_DRAFT_SEND);
    }

    const pdfUrl = this.quotationPdfService.getPublicUrl(id);
    await this.ensurePdfGenerated(quotation);

    const recipientEmail = await this.resolveRecipientEmail(
      quotation,
      dto.recipientEmail,
    );

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.SENT,
        pdfUrl,
      },
      include: this.quotationInclude,
    });

    let downloadUrl: string | undefined;
    try {
      const access = await this.documentAccessService.createToken(
        tenantId,
        'quotation',
        id,
      );
      downloadUrl = access.downloadUrl;
    } catch (error) {
      this.logger.warn(
        `Impossible de créer le lien de téléchargement pour le devis ${id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    let mailResult: SendQuotationMailResult = {
      sent: false,
      reason: recipientEmail ? 'email_not_sent' : 'no_recipient',
    };

    if (recipientEmail && downloadUrl) {
      try {
        const buffer = await this.quotationPdfService.read(tenantId, id);
        if (buffer) {
          const mailContent = await this.emailTemplateService.render(
            tenantId,
            EmailTemplateType.QUOTATION_SEND,
            {
              documentNumber: quotation.number,
              clientName: quotation.client.companyName,
              downloadUrl,
              message: dto.message ?? '',
            },
          );

          let html: string | undefined;
          if (this.emailTrackingService.isEnabled()) {
            const tracking = await this.emailTrackingService.createTracking(
              tenantId,
              'quotation',
              id,
              recipientEmail,
            );
            html = this.emailTrackingService.buildHtmlWithPixel(
              mailContent.body.replace(/\n/g, '<br>'),
              tracking.pixelUrl,
            );
          }

          mailResult = await this.quotationMailService.send({
            to: recipientEmail,
            subject: mailContent.subject,
            text: `${mailContent.body}\n\nTéléchargement : ${downloadUrl}`,
            html,
            pdf: buffer,
            filename: `${quotation.number}.pdf`,
          });
        }
      } catch (error) {
        this.logger.warn(
          `Échec d'envoi email pour le devis ${id} (${recipientEmail})`,
          error instanceof Error ? error.stack : String(error),
        );
        mailResult = { sent: false, reason: 'email_failed' };
      }
    }

    this.quotationEventBus.publish(
      new QuotationSentEvent(
        QuotationEntity.fromPrisma(updated),
        recipientEmail,
      ),
    );

    await this.auditService.record({
      tenantId,
      entityType: AuditEntityType.QUOTATION,
      entityId: id,
      action: AuditAction.SEND,
      metadata: { recipientEmail, downloadUrl },
    });

    return {
      quotation: updated,
      message: 'Quotation marked as sent',
      recipientEmail,
      pdfUrl,
      downloadUrl,
      email: mailResult,
    };
  }

  async preview(id: string, tenantId: string) {
    const quotation = await this.findOne(id, tenantId);
    await this.ensurePdfGenerated(quotation);
    const pdfUrl =
      quotation.pdfUrl ?? this.quotationPdfService.getPublicUrl(id);

    const preview = buildDocumentPreviewResponse(
      {
        documentType: 'quotation',
        documentLabel: 'Devis',
        number: quotation.number,
        status: quotation.status,
        issueDate: quotation.issueDate,
        dueDate: quotation.expiryDate,
        currency: quotation.currency,
        totalTtc: quotation.totalTtc,
        clientName: quotation.client.companyName,
        lineCount: quotation.lines.length,
      },
      pdfUrl,
    );

    return {
      ...preview,
      quotation,
    };
  }

  async getPdf(id: string, tenantId: string) {
    const quotation = await this.findOne(id, tenantId);
    await this.ensurePdfGenerated(quotation);

    const buffer = await this.quotationPdfService.read(tenantId, id);
    if (!buffer) {
      throw new NotFoundException(CrmMessages.quotation.PDF_NOT_FOUND);
    }

    return {
      buffer,
      filename: `${quotation.number}.pdf`,
    };
  }

  async changeStatus(
    id: string,
    tenantId: string,
    dto: ChangeQuotationStatusDto,
  ) {
    const quotation = await this.findOne(id, tenantId);
    const previousStatus = quotation.status as QuotationStatus;

    this.assertStatusTransition(previousStatus, dto.status);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: dto.status },
      include: this.quotationInclude,
    });

    this.quotationEventBus.publish(
      new QuotationStatusChangedEvent(
        QuotationEntity.fromPrisma(updated),
        previousStatus,
        dto.status,
      ),
    );

    return updated;
  }

  async convert(
    id: string,
    tenantId: string,
    dto: ConvertQuotationDto,
    createdBy: string,
  ) {
    const quotation = await this.findOne(id, tenantId);

    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new BadRequestException(CrmMessages.quotation.ONLY_ACCEPTED_CONVERT);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.target === ConvertQuotationTarget.ORDER) {
        const order = await this.ordersService.createFromQuotation(
          quotation,
          tenantId,
          createdBy,
          tx,
        );

        await tx.quotation.update({
          where: { id },
          data: { status: QuotationStatus.CONVERTED },
        });

        return { target: dto.target, targetId: order.id, document: order };
      }

      const number = await this.numberingService.generateNext(
        tenantId,
        NumberingDocumentType.INVOICE_DRAFT,
        tx,
      );
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          number,
          clientId: quotation.clientId,
          contactId: quotation.contactId,
          quotationId: quotation.id,
          status: 'draft',
          issueDate: quotation.issueDate,
          dueDate: quotation.expiryDate,
          currency: quotation.currency,
          exchangeRate: quotation.exchangeRate,
          paymentTermId: quotation.paymentTermId,
          subtotalHt: quotation.subtotalHt,
          discountPct: quotation.discountPct,
          discountAmount: quotation.discountAmount,
          baseHt: quotation.baseHt,
          totalTax: quotation.totalTax,
          totalTtc: quotation.totalTtc,
          amountPaid: 0,
          amountDue: quotation.totalTtc,
          notes: quotation.notes,
          internalNotes: quotation.internalNotes,
          createdBy,
          lines: {
            create: quotation.lines.map((line, index) => ({
              tenantId,
              position: index + 1,
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
      });

      await tx.quotation.update({
        where: { id },
        data: { status: QuotationStatus.CONVERTED },
      });

      return { target: dto.target, targetId: invoice.id, document: invoice };
    });

    const refreshed = await this.findOne(id, tenantId);

    this.quotationEventBus.publish(
      new QuotationConvertedEvent(
        QuotationEntity.fromPrisma(refreshed),
        dto.target,
        result.targetId,
      ),
    );

    await this.auditService.record({
      tenantId,
      userId: createdBy,
      entityType: AuditEntityType.QUOTATION,
      entityId: id,
      action: AuditAction.CONVERT,
      metadata: { target: dto.target, targetId: result.targetId },
    });

    return result;
  }

  private async computeDocumentLines(
    tenantId: string,
    lines: QuotationLineDto[],
    globalDiscountPct = 0,
    globalDiscountAmount = 0,
  ) {
    const inputs = await Promise.all(
      lines.map(async (line) => {
        const taxRate = await this.prisma.taxRate.findFirst({
          where: { id: line.taxRateId, tenantId, isActive: true },
        });

        if (!taxRate) {
          throw new BadRequestException(
            CrmMessages.quotation.TAX_RATE_NOT_FOUND(line.taxRateId),
          );
        }

        if (line.itemId) {
          const item = await this.prisma.catalogItem.findFirst({
            where: { id: line.itemId, tenantId, isArchived: false },
          });

          if (!item) {
            throw new BadRequestException(
              CrmMessages.quotation.CATALOG_ITEM_NOT_FOUND(line.itemId),
            );
          }

          const maxDiscount = item.maxDiscountPct ?? 0;
          if (maxDiscount > 0 && (line.discountPct ?? 0) > maxDiscount) {
            throw new BadRequestException(
              CrmMessages.quotation.DISCOUNT_EXCEEDS_MAX(item.reference),
            );
          }
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

    const { lines: computed, totals } = computeDocument(
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
      taxRateId: string;
    }>,
    globalDiscountPct = 0,
    globalDiscountAmount = 0,
  ) {
    const dtoLines: QuotationLineDto[] = lines.map((line) => ({
      itemId: line.itemId ?? undefined,
      description: line.description,
      quantity: line.quantity,
      unitPriceHt: line.unitPriceHt,
      discountPct: line.discountPct,
      discountAmount: line.discountAmount,
      taxRateId: line.taxRateId,
    }));

    return this.computeDocumentLines(
      tenantId,
      dtoLines,
      globalDiscountPct,
      globalDiscountAmount,
    );
  }

  private assertStatusTransition(
    current: QuotationStatus,
    next: QuotationStatus,
  ) {
    const allowed: Partial<Record<QuotationStatus, QuotationStatus[]>> = {
      [QuotationStatus.SENT]: [
        QuotationStatus.VIEWED,
        QuotationStatus.ACCEPTED,
        QuotationStatus.DECLINED,
      ],
      [QuotationStatus.VIEWED]: [
        QuotationStatus.ACCEPTED,
        QuotationStatus.DECLINED,
      ],
    };

    const permitted = allowed[current] ?? [];
    if (!permitted.includes(next)) {
      throw new BadRequestException(
        CrmMessages.quotation.STATUS_TRANSITION(current, next),
      );
    }
  }

  private async ensurePdfGenerated(quotation: {
    id: string;
    tenantId: string;
    number: string;
    status: string;
    issueDate: Date;
    expiryDate: Date | null;
    currency: string;
    subtotalHt: number;
    discountPct: number;
    discountAmount: number;
    baseHt: number;
    totalTax: number;
    totalTtc: number;
    notes: string | null;
    client: { companyName: string; code: string };
    contact?: {
      firstName: string;
      lastName: string;
      email?: string | null;
    } | null;
    lines: Array<{
      position: number;
      description: string;
      quantity: number;
      unitPriceHt: number;
      lineTotalHt: number;
      taxAmount: number;
      lineTotalTtc: number;
      taxRate?: { name: string; rate: number };
    }>;
    pdfUrl?: string | null;
  }) {
    const existing = await this.quotationPdfService.read(
      quotation.tenantId,
      quotation.id,
    );
    if (existing) return;

    const buffer = await this.quotationPdfService.generate(quotation);
    await this.quotationPdfService.save(
      quotation.tenantId,
      quotation.id,
      buffer,
    );

    const pdfUrl = this.quotationPdfService.getPublicUrl(quotation.id);
    if (quotation.pdfUrl !== pdfUrl) {
      await this.prisma.quotation.update({
        where: { id: quotation.id },
        data: { pdfUrl },
      });
    }
  }

  private async resolveRecipientEmail(
    quotation: {
      contact?: { email?: string | null } | null;
      clientId: string;
      tenantId: string;
    },
    explicit?: string,
  ) {
    if (explicit?.trim()) return explicit.trim();

    if (quotation.contact?.email?.trim()) {
      return quotation.contact.email.trim();
    }

    const primaryContact = await this.prisma.contact.findFirst({
      where: {
        tenantId: quotation.tenantId,
        clientId: quotation.clientId,
        email: { not: null },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return primaryContact?.email?.trim();
  }

  private async assertClient(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });

    if (!client) {
      throw new BadRequestException(CrmMessages.quotation.CLIENT_NOT_FOUND);
    }
    if (client.blockedForNewOrders) {
      throw new BadRequestException(CrmMessages.quotation.CLIENT_BLOCKED);
    }
  }

  private async assertContact(
    tenantId: string,
    clientId: string,
    contactId?: string,
  ) {
    if (!contactId) return;

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId, clientId },
    });

    if (!contact) {
      throw new BadRequestException(CrmMessages.quotation.CONTACT_NOT_FOUND);
    }
  }

  private async assertPaymentTerm(tenantId: string, paymentTermId?: string) {
    if (!paymentTermId) return;

    const term = await this.prisma.paymentTerm.findFirst({
      where: { id: paymentTermId, tenantId },
    });

    if (!term) {
      throw new BadRequestException(CrmMessages.quotation.PAYMENT_TERM_NOT_FOUND);
    }
  }

  private async expireStaleQuotations(tenantId: string) {
    await this.prisma.quotation.updateMany({
      where: {
        tenantId,
        status: { in: [QuotationStatus.SENT, QuotationStatus.VIEWED] },
        expiryDate: { lt: new Date() },
      },
      data: { status: QuotationStatus.EXPIRED },
    });
  }

}
