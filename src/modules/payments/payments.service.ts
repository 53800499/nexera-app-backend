import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  roundDownCent,
  roundExchangeRate,
} from '../../shared/utils/invoice-calculator';
import { InvoiceStatus } from '../invoices/enums/invoice-status.enum';
import { InvoiceType } from '../invoices/enums/invoice-type.enum';
import { RecordPaymentDto } from '../invoices/dto/record-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CancelPaymentDto } from './dto/cancel-payment.dto';
import { AllocationMode } from './enums/allocation-mode.enum';
import { PAYABLE_INVOICE_STATUSES } from './enums/payable-invoice-status.enum';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentEventBus } from './events/payment-event-bus';
import { PaymentRecordedEvent } from './events/payment-recorded.event';
import { PaymentCancelledEvent } from './events/payment-cancelled.event';
import {
  computeExchangeGainLoss,
  computeFifoAllocations,
  convertBetweenCurrencies,
  PaymentAllocation,
} from './utils/payment-allocation.util';
import { RemindersService } from '../reminders/reminders.service';

type OpenInvoice = {
  id: string;
  number: string;
  status: string;
  invoiceType: string;
  issueDate: Date;
  dueDate: Date | null;
  currency: string;
  exchangeRate: number;
  totalTtc: number;
  amountPaid: number;
  amountDue: number;
  clientId: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentEventBus: PaymentEventBus,
    private readonly remindersService: RemindersService,
  ) {}

  private readonly paymentInclude = {
    client: { select: { id: true, companyName: true } },
    imputations: {
      include: { invoice: { select: { id: true, number: true } } },
      orderBy: { createdAt: 'asc' as const },
    },
    advances: true,
  };

  async getClientPaymentContext(clientId: string, tenantId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const openInvoices = await this.findOpenInvoicesForClient(clientId, tenantId);
    const advances = await this.prisma.clientAdvance.findMany({
      where: {
        tenantId,
        clientId,
        remainingAmount: { gt: 0.01 },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      clientId: client.id,
      clientName: client.companyName,
      defaultCurrency: client.defaultCurrency,
      openInvoices: openInvoices.map((inv) => this.toOpenInvoiceDto(inv)),
      availableAdvances: advances.map((a) => ({
        id: a.id,
        originalAmount: a.originalAmount,
        remainingAmount: a.remainingAmount,
        currency: a.currency,
      })),
      totalOpenDue: roundDownCent(
        openInvoices.reduce((sum, inv) => sum + inv.amountDue, 0),
      ),
    };
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    clientId?: string,
    includeCancelled = false,
  ) {
    const where: Prisma.PaymentWhereInput = {
      tenantId,
      ...(clientId ? { clientId } : {}),
      ...(!includeCancelled ? { isCancelled: false } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: this.paymentInclude,
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: items.map((p) => this.toPaymentResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, tenantId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: this.paymentInclude,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toPaymentResponse(payment);
  }

  async create(dto: CreatePaymentDto, tenantId: string, createdBy: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId, deletedAt: null },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const currency = dto.currency ?? client.defaultCurrency;
    const exchangeRate = roundExchangeRate(dto.exchangeRate ?? 1);

    const openInvoices = await this.findOpenInvoicesForClient(
      dto.clientId,
      tenantId,
    );

    const allocations = this.resolveAllocations(
      dto,
      openInvoices,
      currency,
      exchangeRate,
    );

    const allocatedInPaymentCurrency = this.sumAllocationsInPaymentCurrency(
      allocations,
      openInvoices,
      currency,
      exchangeRate,
    );

    const unallocated = roundDownCent(dto.amount - allocatedInPaymentCurrency);
    const exchangeGainLoss =
      currency !== client.defaultCurrency || exchangeRate !== 1
        ? computeExchangeGainLoss(
            dto.amount,
            exchangeRate,
            allocatedInPaymentCurrency,
          )
        : null;

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          tenantId,
          clientId: dto.clientId,
          reference: dto.reference,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          currency,
          exchangeRate,
          exchangeGainLoss,
          paymentMethod: dto.paymentMethod as any,
          notes: dto.notes,
          unallocatedAmount: Math.max(0, unallocated),
          createdBy,
        },
      });

      for (const allocation of allocations) {
        await this.applyImputation(tx, tenantId, created.id, allocation, openInvoices);
      }

      if (unallocated > 0.01) {
        await tx.clientAdvance.create({
          data: {
            tenantId,
            clientId: dto.clientId,
            sourcePaymentId: created.id,
            originalAmount: unallocated,
            remainingAmount: unallocated,
            currency,
          },
        });
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: { ...this.paymentInclude, advances: true },
      });
    });

    const entity = PaymentEntity.fromPrisma(payment);
    this.paymentEventBus.publish(
      new PaymentRecordedEvent(entity, allocations, Math.max(0, unallocated)),
    );

    const response = this.toPaymentResponse(payment);
    if (payment.advances?.length) {
      const adv = payment.advances[0];
      response.advanceCreated = {
        id: adv.id,
        originalAmount: adv.originalAmount,
        remainingAmount: adv.remainingAmount,
        currency: adv.currency,
      };
    }

    await this.remindersService.syncClientBlockStatus(dto.clientId, tenantId);

    return response;
  }

  /** Compatibilité POST /invoices/:id/payments — imputation unique, sans trop-perçu */
  async recordForInvoice(
    invoiceId: string,
    tenantId: string,
    dto: RecordPaymentDto,
    createdBy: string,
  ) {
    const invoice = await this.getInvoiceOrThrow(invoiceId, tenantId);

    if (dto.amount > invoice.amountDue + 0.01) {
      throw new BadRequestException(
        `Payment exceeds amount due (${invoice.amountDue})`,
      );
    }

    return this.create(
      {
        clientId: invoice.clientId,
        amount: dto.amount,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate,
        paymentMethod: dto.paymentMethod as any,
        paymentDate: dto.paymentDate,
        reference: dto.reference,
        notes: dto.notes,
        allocationMode: AllocationMode.MANUAL,
        imputations: [{ invoiceId, amount: dto.amount }],
      },
      tenantId,
      createdBy,
    );
  }

  async cancel(id: string, tenantId: string, dto: CancelPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        imputations: { include: { invoice: true } },
        advances: { include: { applications: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.isCancelled) {
      throw new BadRequestException('Payment is already cancelled');
    }

    for (const advance of payment.advances) {
      const used = advance.originalAmount - advance.remainingAmount;
      if (used > 0.01) {
        throw new BadRequestException(
          'Cannot cancel payment: client advance has already been applied',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const imputation of payment.imputations) {
        await this.reverseImputation(tx, imputation);
      }

      if (payment.advances.length) {
        await tx.clientAdvance.deleteMany({
          where: { sourcePaymentId: payment.id },
        });
      }

      await tx.payment.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelReason: dto.reason,
          unallocatedAmount: 0,
        },
      });
    });

    const entity = PaymentEntity.fromPrisma(payment);
    this.paymentEventBus.publish(new PaymentCancelledEvent(entity, dto.reason));

    await this.remindersService.syncClientBlockStatus(payment.clientId, tenantId);

    return this.findOne(id, tenantId);
  }

  private resolveAllocations(
    dto: CreatePaymentDto,
    openInvoices: OpenInvoice[],
    paymentCurrency: string,
    paymentExchangeRate: number,
  ): PaymentAllocation[] {
    if (dto.allocationMode === AllocationMode.FIFO) {
      return computeFifoAllocations(
        dto.amount,
        openInvoices.map((inv) => ({
          id: inv.id,
          amountDue: inv.amountDue,
          currency: inv.currency,
          exchangeRate: inv.exchangeRate,
          issueDate: inv.issueDate,
        })),
        paymentCurrency,
        paymentExchangeRate,
      );
    }

    if (!dto.imputations?.length) {
      throw new BadRequestException(
        'Manual allocation requires at least one imputation',
      );
    }

    const invoiceMap = new Map(openInvoices.map((inv) => [inv.id, inv]));
    let allocatedInPaymentCurrency = 0;

    for (const imp of dto.imputations) {
      const invoice = invoiceMap.get(imp.invoiceId);
      if (!invoice) {
        throw new BadRequestException(
          `Invoice ${imp.invoiceId} is not open for this client`,
        );
      }

      if (imp.amount > invoice.amountDue + 0.01) {
        throw new BadRequestException(
          `Imputation exceeds amount due on invoice ${invoice.number}`,
        );
      }

      allocatedInPaymentCurrency = roundDownCent(
        allocatedInPaymentCurrency +
          convertBetweenCurrencies(
            imp.amount,
            invoice.currency,
            invoice.exchangeRate,
            paymentCurrency,
            paymentExchangeRate,
          ),
      );
    }

    if (allocatedInPaymentCurrency > dto.amount + 0.01) {
      throw new BadRequestException(
        'Total imputations exceed payment amount',
      );
    }

    return dto.imputations.map((imp) => ({
      invoiceId: imp.invoiceId,
      amount: roundDownCent(imp.amount),
    }));
  }

  private async findOpenInvoicesForClient(clientId: string, tenantId: string) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        clientId,
        invoiceType: { not: InvoiceType.PROFORMA },
        status: { in: PAYABLE_INVOICE_STATUSES },
        amountDue: { gt: 0.01 },
      },
      orderBy: { issueDate: 'asc' },
    }) as Promise<OpenInvoice[]>;
  }

  private async getInvoiceOrThrow(invoiceId: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.invoiceType === InvoiceType.PROFORMA) {
      throw new BadRequestException('Proforma invoices are not payable');
    }

    if (
      !PAYABLE_INVOICE_STATUSES.includes(invoice.status as InvoiceStatus)
    ) {
      throw new BadRequestException('Invoice is not open for payment');
    }

    if (invoice.amountDue <= 0.01) {
      throw new BadRequestException('Invoice has no amount due');
    }

    return invoice;
  }

  private async applyImputation(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentId: string,
    allocation: PaymentAllocation,
    openInvoices: OpenInvoice[],
  ) {
    const invoice =
      openInvoices.find((inv) => inv.id === allocation.invoiceId) ??
      (await tx.invoice.findFirstOrThrow({
        where: { id: allocation.invoiceId, tenantId },
      }));

    await tx.paymentImputation.create({
      data: {
        tenantId,
        paymentId,
        invoiceId: allocation.invoiceId,
        amount: allocation.amount,
      },
    });

    const newPaid = roundDownCent(invoice.amountPaid + allocation.amount);
    const newDue = roundDownCent(Math.max(0, invoice.totalTtc - newPaid));
    let status: InvoiceStatus = InvoiceStatus.PARTIAL;

    if (newDue <= 0.01) {
      status = InvoiceStatus.PAID;
    }

    await tx.invoice.update({
      where: { id: allocation.invoiceId },
      data: {
        amountPaid: newPaid,
        amountDue: newDue,
        status,
        paidAt: newDue <= 0.01 ? new Date() : undefined,
      },
    });
  }

  private async reverseImputation(
    tx: Prisma.TransactionClient,
    imputation: {
      id: string;
      invoiceId: string;
      amount: number;
      invoice: {
        amountPaid: number;
        totalTtc: number;
        status: string;
        dueDate: Date | null;
      };
    },
  ) {
    const invoice = imputation.invoice;
    const newPaid = roundDownCent(Math.max(0, invoice.amountPaid - imputation.amount));
    const newDue = roundDownCent(Math.max(0, invoice.totalTtc - newPaid));

    let status: InvoiceStatus = InvoiceStatus.ISSUED;
    if (newPaid > 0.01 && newDue > 0.01) {
      status = InvoiceStatus.PARTIAL;
    } else if (newDue <= 0.01) {
      status = InvoiceStatus.PAID;
    } else if (
      invoice.dueDate &&
      invoice.dueDate < new Date() &&
      newDue > 0.01
    ) {
      status = InvoiceStatus.OVERDUE;
    }

    await tx.invoice.update({
      where: { id: imputation.invoiceId },
      data: {
        amountPaid: newPaid,
        amountDue: newDue,
        status,
        paidAt: newDue <= 0.01 ? undefined : null,
      },
    });

    await tx.paymentImputation.delete({ where: { id: imputation.id } });
  }

  private sumAllocationsInPaymentCurrency(
    allocations: PaymentAllocation[],
    openInvoices: OpenInvoice[],
    paymentCurrency: string,
    paymentExchangeRate: number,
  ) {
    const invoiceMap = new Map(openInvoices.map((inv) => [inv.id, inv]));
    return roundDownCent(
      allocations.reduce((sum, allocation) => {
        const invoice = invoiceMap.get(allocation.invoiceId)!;
        return (
          sum +
          convertBetweenCurrencies(
            allocation.amount,
            invoice.currency,
            invoice.exchangeRate,
            paymentCurrency,
            paymentExchangeRate,
          )
        );
      }, 0),
    );
  }

  private toOpenInvoiceDto(invoice: OpenInvoice) {
    return {
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      totalTtc: invoice.totalTtc,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
    };
  }

  private toPaymentResponse(payment: any) {
    return {
      id: payment.id,
      clientId: payment.clientId,
      clientName: payment.client?.companyName,
      amount: payment.amount,
      currency: payment.currency,
      exchangeRate: payment.exchangeRate,
      exchangeGainLoss: payment.exchangeGainLoss,
      unallocatedAmount: payment.unallocatedAmount,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference,
      paymentDate: payment.paymentDate,
      notes: payment.notes,
      isCancelled: payment.isCancelled,
      cancelledAt: payment.cancelledAt,
      cancelReason: payment.cancelReason,
      imputations: (payment.imputations ?? []).map((imp: any) => ({
        id: imp.id,
        invoiceId: imp.invoiceId,
        invoiceNumber: imp.invoice?.number,
        amount: imp.amount,
      })),
      advanceCreated: payment.advances?.[0]
        ? {
            id: payment.advances[0].id,
            originalAmount: payment.advances[0].originalAmount,
            remainingAmount: payment.advances[0].remainingAmount,
            currency: payment.advances[0].currency,
          }
        : null,
      createdAt: payment.createdAt,
    };
  }
}
