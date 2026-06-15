import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderInvoiceDto } from './dto/create-order-invoice.dto';
import { OrderLineDto } from './dto/order-line.dto';
import {
  EDITABLE_ORDER_STATUSES,
  OrderStatus,
} from './enums/order-status.enum';
import {
  computeDocument,
  roundDownCent,
} from '../quotations/utils/quotation-calculator';
import { OrderEventBus } from './events/order-event-bus';
import { OrderEntity } from './entities/order.entity';
import { OrderCreatedEvent } from './events/order-created.event';
import { OrderUpdatedEvent } from './events/order-updated.event';
import { OrderConfirmedEvent } from './events/order-confirmed.event';
import { OrderInvoiceCreatedEvent } from './events/order-invoice-created.event';
import { InvoicesService } from '../invoices/invoices.service';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../settings/enums/numbering-document-type.enum';

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

const CANCELLED_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.cancelled,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderEventBus: OrderEventBus,
    private readonly invoicesService: InvoicesService,
    private readonly numberingService: DocumentNumberingService,
  ) {}

  private readonly orderInclude = {
    client: true,
    quotation: { select: { id: true, number: true, status: true } },
    lines: {
      orderBy: { position: 'asc' as const },
      include: { item: true, taxRate: true },
    },
    invoices: {
      select: {
        id: true,
        number: true,
        status: true,
        invoiceType: true,
        issueDate: true,
        totalTtc: true,
        amountPaid: true,
        amountDue: true,
      },
      orderBy: { createdAt: 'desc' as const },
    },
  };

  async create(
    dto: CreateOrderDto,
    tenantId: string,
    createdBy: string,
  ) {
    await this.assertClient(tenantId, dto.clientId);
    await this.assertQuotationLink(tenantId, dto.clientId, dto.quotationId);

    const { lines: resolvedLines, totals } = await this.computeDocumentLines(
      tenantId,
      dto.lines,
      dto.discountPct ?? 0,
      dto.discountAmount ?? 0,
    );
    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.ORDER_DRAFT,
    );

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        number,
        clientId: dto.clientId,
        quotationId: dto.quotationId,
        status: OrderStatus.DRAFT,
        issueDate: new Date(dto.issueDate),
        currency: dto.currency ?? 'EUR',
        subtotalHt: totals.subtotalHt,
        discountPct: totals.discountPct,
        discountAmount: totals.discountAmount,
        baseHt: totals.baseHt,
        totalTax: totals.totalTax,
        totalTtc: totals.totalTtc,
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
      include: this.orderInclude,
    });

    this.orderEventBus.publish(
      new OrderCreatedEvent(OrderEntity.fromPrisma(order)),
    );

    return this.withBillingSummary(order);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: OrderStatus,
    clientId?: string,
    q?: string,
  ) {
    const where: Prisma.OrderWhereInput = { tenantId };

    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { client: { companyName: { contains: q, mode: 'insensitive' } } },
        { quotation: { number: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => this.withBillingSummary(order)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: this.orderInclude,
    });

    if (!order) throw new NotFoundException('Order not found');

    return this.withBillingSummary(order);
  }

  async update(id: string, tenantId: string, dto: UpdateOrderDto) {
    const existing = await this.findOne(id, tenantId);

    if (!EDITABLE_ORDER_STATUSES.includes(existing.status as OrderStatus)) {
      throw new BadRequestException(
        'Only draft orders can be modified',
      );
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
        await tx.orderLine.deleteMany({ where: { orderId: id } });
      }

      return tx.order.update({
        where: { id },
        data: {
          issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
          currency: dto.currency,
          subtotalHt: totals.subtotalHt,
          discountPct: totals.discountPct,
          discountAmount: totals.discountAmount,
          baseHt: totals.baseHt,
          totalTax: totals.totalTax,
          totalTtc: totals.totalTtc,
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
        include: this.orderInclude,
      });
    });

    this.orderEventBus.publish(
      new OrderUpdatedEvent(OrderEntity.fromPrisma(updated)),
    );

    return this.withBillingSummary(updated);
  }

  async confirm(id: string, tenantId: string) {
    const order = await this.findOne(id, tenantId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be confirmed');
    }

    const finalNumber = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.ORDER_ISSUED,
    );

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CONFIRMED,
        number: finalNumber,
      },
      include: this.orderInclude,
    });

    this.orderEventBus.publish(
      new OrderConfirmedEvent(
        OrderEntity.fromPrisma(updated),
        finalNumber,
      ),
    );

    return this.withBillingSummary(updated);
  }

  async cancel(id: string, tenantId: string) {
    const order = await this.findOne(id, tenantId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    const activeInvoices = order.invoices.filter(
      (inv) => !CANCELLED_INVOICE_STATUSES.includes(inv.status),
    );

    if (activeInvoices.length > 0) {
      throw new BadRequestException(
        'Cannot cancel an order with invoices (UC-04)',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
      include: this.orderInclude,
    });

    return this.withBillingSummary(updated);
  }

  async remove(id: string, tenantId: string) {
    const order = await this.findOne(id, tenantId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be deleted');
    }

    if (order.invoices.length > 0) {
      throw new BadRequestException('Cannot delete an order with invoices');
    }

    await this.prisma.orderLine.deleteMany({ where: { orderId: id } });
    await this.prisma.order.delete({ where: { id } });

    return { message: 'Order deleted successfully', orderId: id };
  }

  async createInvoice(
    id: string,
    tenantId: string,
    dto: CreateOrderInvoiceDto,
    createdBy: string,
  ) {
    const order = await this.findOne(id, tenantId);

    if (
      order.status === OrderStatus.DRAFT ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Order must be confirmed before invoicing',
      );
    }

    const summary = this.computeBillingSummary(order);
    if (summary.remainingToInvoice <= 0) {
      throw new BadRequestException('Order is already fully billed');
    }

    let amountTtc = dto.amountTtc ?? summary.remainingToInvoice;
    if (dto.billingPct) {
      amountTtc = roundDownCent(
        summary.remainingToInvoice * (dto.billingPct / 100),
      );
    }

    if (amountTtc > summary.remainingToInvoice + 0.01) {
      throw new BadRequestException(
        `Amount exceeds remaining to invoice (${summary.remainingToInvoice})`,
      );
    }

    if (amountTtc <= 0) {
      throw new BadRequestException('Invoice amount must be greater than 0');
    }

    const invoice = await this.invoicesService.createFromOrder(
      order,
      tenantId,
      {
        amountTtc: dto.amountTtc,
        billingPct: dto.billingPct,
        invoiceType: dto.invoiceType,
        dueDate: dto.dueDate,
      },
      createdBy,
    );

    const refreshed = await this.findOne(id, tenantId);

    this.orderEventBus.publish(
      new OrderInvoiceCreatedEvent(
        OrderEntity.fromPrisma(refreshed),
        invoice.id,
        invoice.totalTtc,
      ),
    );

    return {
      invoice,
      order: refreshed,
    };
  }

  /** Utilisé par la conversion devis → BC (quotations). */
  async createFromQuotation(
    quotation: {
      id: string;
      clientId: string;
      issueDate: Date;
      currency: string;
      subtotalHt: number;
      discountPct: number;
      discountAmount: number;
      baseHt: number;
      totalTax: number;
      totalTtc: number;
      lines: Array<{
        itemId: string | null;
        description: string;
        quantity: number;
        unitPriceHt: number;
        discountPct: number;
        discountAmount: number;
        lineTotalHt: number;
        taxRateId: string;
        taxAmount: number;
        lineTotalTtc: number;
      }>;
    },
    tenantId: string,
    createdBy: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.ORDER_DRAFT,
    );

    return db.order.create({
      data: {
        tenantId,
        number,
        clientId: quotation.clientId,
        quotationId: quotation.id,
        status: OrderStatus.DRAFT,
        issueDate: quotation.issueDate,
        currency: quotation.currency,
        subtotalHt: quotation.subtotalHt,
        discountPct: quotation.discountPct,
        discountAmount: quotation.discountAmount,
        baseHt: quotation.baseHt,
        totalTax: quotation.totalTax,
        totalTtc: quotation.totalTtc,
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
      include: this.orderInclude,
    });
  }

  private withBillingSummary(order: any) {
    const billing = this.computeBillingSummary(order);
    return { ...order, billing };
  }

  private computeBillingSummary(order: {
    totalTtc: number;
    invoices: Array<{ status: InvoiceStatus; totalTtc: number }>;
  }) {
    const invoicedTtc = roundDownCent(
      order.invoices
        .filter((inv) => !CANCELLED_INVOICE_STATUSES.includes(inv.status))
        .reduce((sum, inv) => sum + inv.totalTtc, 0),
    );

    const remainingToInvoice = roundDownCent(
      Math.max(0, order.totalTtc - invoicedTtc),
    );

    const billingProgressPct =
      order.totalTtc > 0
        ? roundDownCent((invoicedTtc / order.totalTtc) * 100)
        : 0;

    return {
      totalTtc: order.totalTtc,
      invoicedTtc,
      remainingToInvoice,
      billingProgressPct,
      isFullyBilled: remainingToInvoice <= 0.01,
    };
  }

  private async syncBillingStatusInTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    tenantId: string,
  ) {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        invoices: {
          select: { status: true, totalTtc: true },
        },
      },
    });

    if (!order || order.status === OrderStatus.CANCELLED) return;

    const summary = this.computeBillingSummary(order);
    let status: OrderStatus = OrderStatus.CONFIRMED;

    if (summary.isFullyBilled) {
      status = OrderStatus.FULLY_BILLED;
    } else if (summary.invoicedTtc > 0) {
      status = OrderStatus.IN_PROGRESS;
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  private async computeDocumentLines(
    tenantId: string,
    lines: OrderLineDto[],
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
            `Tax rate not found: ${line.taxRateId}`,
          );
        }

        if (line.itemId) {
          const item = await this.prisma.catalogItem.findFirst({
            where: { id: line.itemId, tenantId, isArchived: false },
          });
          if (!item) {
            throw new BadRequestException(`Catalog item not found: ${line.itemId}`);
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
      taxRateId: string | null;
    }>,
    globalDiscountPct = 0,
    globalDiscountAmount = 0,
  ) {
    const dtoLines: OrderLineDto[] = lines.map((line) => ({
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

  private async assertClient(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
    if (!client) {
      throw new BadRequestException('Client not found for this tenant');
    }
    if (client.blockedForNewOrders) {
      throw new BadRequestException(
        'Client blocked for new orders due to overdue invoices (mise en demeure)',
      );
    }
  }

  private async assertQuotationLink(
    tenantId: string,
    clientId: string,
    quotationId?: string,
  ) {
    if (!quotationId) return;

    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, tenantId },
    });

    if (!quotation) {
      throw new BadRequestException('Quotation not found');
    }

    if (quotation.clientId !== clientId) {
      throw new BadRequestException(
        'Quotation does not belong to the selected client (RM-BC03)',
      );
    }
  }

}
