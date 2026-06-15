import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { roundDownCent } from '../../shared/utils/invoice-calculator';
import { ISSUED_IMMUTABLE_STATUSES } from '../invoices/enums/invoice-status.enum';
import { InvoiceStatus } from '../invoices/enums/invoice-status.enum';
import { InvoiceType } from '../invoices/enums/invoice-type.enum';
import { QuotationStatus } from '../quotations/enums/quotation-status.enum';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  computeAgedBalance,
  daysPastDue,
} from './utils/aged-balance.util';
import {
  DatePeriod,
  computeVariationPercent,
  defaultMonthPeriod,
  endOfDay,
  previousYearPeriod,
  startOfDay,
} from './utils/period.util';

const EMITTED_INVOICE_STATUSES = ISSUED_IMMUTABLE_STATUSES;

const SENT_QUOTATION_STATUSES: QuotationStatus[] = [
  QuotationStatus.SENT,
  QuotationStatus.VIEWED,
  QuotationStatus.ACCEPTED,
  QuotationStatus.CONVERTED,
  QuotationStatus.DECLINED,
  QuotationStatus.EXPIRED,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCommercialDashboard(tenantId: string, query: DashboardQueryDto) {
    const period = this.resolvePeriod(query);
    const previousPeriod = previousYearPeriod(period);

    const issuedInvoiceFilter = this.emittedInvoiceFilter(tenantId, period);

    const [
      periodInvoices,
      previousInvoices,
      overdueAgg,
      quotationStats,
      topClientRows,
      topArticleRows,
      unpaidForAging,
      upcomingDue,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: issuedInvoiceFilter,
        select: { baseHt: true, invoiceType: true },
      }),
      this.prisma.invoice.findMany({
        where: this.emittedInvoiceFilter(tenantId, previousPeriod),
        select: { baseHt: true, invoiceType: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          status: InvoiceStatus.OVERDUE,
          amountDue: { gt: 0.01 },
          invoiceType: { not: InvoiceType.PROFORMA },
        },
        _sum: { amountDue: true },
        _count: true,
      }),
      this.getQuotationConversionStats(tenantId, period),
      this.getTopClients(tenantId, period),
      this.getTopArticles(tenantId, period),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          amountDue: { gt: 0.01 },
          dueDate: { not: null },
          invoiceType: { not: InvoiceType.PROFORMA },
          status: {
            in: [
              InvoiceStatus.ISSUED,
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIAL,
              InvoiceStatus.OVERDUE,
            ],
          },
        },
        select: { amountDue: true, dueDate: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIAL] },
          amountDue: { gt: 0.01 },
          dueDate: {
            gte: startOfDay(new Date()),
            lte: endOfDay(this.addDays(new Date(), 7)),
          },
          invoiceType: { not: InvoiceType.PROFORMA },
        },
        include: {
          client: { select: { id: true, companyName: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 50,
      }),
    ]);

    const revenueHt = this.sumRevenueHt(periodInvoices);
    const previousRevenueHt = this.sumRevenueHt(previousInvoices);

    return {
      period: {
        from: period.from.toISOString().slice(0, 10),
        to: period.to.toISOString().slice(0, 10),
      },
      revenue: {
        revenueHt,
        variationPercent: computeVariationPercent(revenueHt, previousRevenueHt),
        previousPeriodRevenueHt: previousRevenueHt,
      },
      issuedInvoiceCount: periodInvoices.length,
      totalOverdueAmountTtc: roundDownCent(overdueAgg._sum.amountDue ?? 0),
      quotationConversionRate: quotationStats.rate,
      topClients: topClientRows,
      topArticles: topArticleRows,
      agedBalance: computeAgedBalance(unpaidForAging),
      upcomingDueInvoices: upcomingDue.map((inv) => ({
        id: inv.id,
        number: inv.number,
        clientId: inv.clientId,
        clientName: inv.client.companyName,
        dueDate: inv.dueDate!,
        amountDue: inv.amountDue,
        daysUntilDue: inv.dueDate
          ? Math.max(0, -daysPastDue(inv.dueDate, new Date()))
          : 0,
      })),
    };
  }

  private resolvePeriod(query: DashboardQueryDto): DatePeriod {
    if (!query.from && !query.to) {
      return defaultMonthPeriod();
    }

    if (!query.from || !query.to) {
      throw new BadRequestException('Both from and to are required');
    }

    const from = startOfDay(new Date(query.from));
    const to = endOfDay(new Date(query.to));

    if (from > to) {
      throw new BadRequestException('from must be before to');
    }

    return { from, to };
  }

  private emittedInvoiceFilter(
    tenantId: string,
    period: DatePeriod,
  ): Prisma.InvoiceWhereInput {
    return {
      tenantId,
      status: { in: EMITTED_INVOICE_STATUSES },
      invoiceType: { not: InvoiceType.PROFORMA },
      issueDate: { gte: period.from, lte: period.to },
    };
  }

  private sumRevenueHt(
    invoices: Array<{ baseHt: number; invoiceType: string }>,
  ): number {
    return roundDownCent(
      invoices.reduce((sum, inv) => {
        const signed =
          inv.invoiceType === InvoiceType.CREDIT_NOTE ? -inv.baseHt : inv.baseHt;
        return sum + signed;
      }, 0),
    );
  }

  private async getQuotationConversionStats(
    tenantId: string,
    period: DatePeriod,
  ) {
    const baseWhere: Prisma.QuotationWhereInput = {
      tenantId,
      issueDate: { gte: period.from, lte: period.to },
    };

    const [converted, sentTotal] = await Promise.all([
      this.prisma.quotation.count({
        where: { ...baseWhere, status: QuotationStatus.CONVERTED },
      }),
      this.prisma.quotation.count({
        where: { ...baseWhere, status: { in: SENT_QUOTATION_STATUSES } },
      }),
    ]);

    const rate =
      sentTotal > 0
        ? Math.round((converted / sentTotal) * 10000) / 100
        : null;

    return { converted, sentTotal, rate };
  }

  private async getTopClients(tenantId: string, period: DatePeriod) {
    const invoices = await this.prisma.invoice.findMany({
      where: this.emittedInvoiceFilter(tenantId, period),
      select: {
        clientId: true,
        baseHt: true,
        invoiceType: true,
        client: { select: { companyName: true } },
      },
    });

    const byClient = new Map<
      string,
      { clientName: string; revenueHt: number; invoiceCount: number }
    >();

    for (const inv of invoices) {
      const signed =
        inv.invoiceType === InvoiceType.CREDIT_NOTE ? -inv.baseHt : inv.baseHt;
      const current = byClient.get(inv.clientId) ?? {
        clientName: inv.client.companyName,
        revenueHt: 0,
        invoiceCount: 0,
      };
      current.revenueHt = roundDownCent(current.revenueHt + signed);
      current.invoiceCount += 1;
      byClient.set(inv.clientId, current);
    }

    return Array.from(byClient.entries())
      .map(([clientId, data]) => ({
        clientId,
        clientName: data.clientName,
        revenueHt: data.revenueHt,
        invoiceCount: data.invoiceCount,
      }))
      .sort((a, b) => b.revenueHt - a.revenueHt)
      .slice(0, 5);
  }

  private async getTopArticles(tenantId: string, period: DatePeriod) {
    const lines = await this.prisma.invoiceLine.findMany({
      where: {
        tenantId,
        invoice: this.emittedInvoiceFilter(tenantId, period),
      },
      select: {
        itemId: true,
        description: true,
        lineTotalHt: true,
        quantity: true,
        invoice: { select: { invoiceType: true } },
        item: { select: { name: true } },
      },
    });

    const byArticle = new Map<
      string,
      { itemId: string | null; label: string; revenueHt: number; quantity: number }
    >();

    for (const line of lines) {
      const key = line.itemId ?? line.description;
      const signed =
        line.invoice.invoiceType === InvoiceType.CREDIT_NOTE
          ? -line.lineTotalHt
          : line.lineTotalHt;
      const label = line.item?.name ?? line.description;
      const current = byArticle.get(key) ?? {
        itemId: line.itemId,
        label,
        revenueHt: 0,
        quantity: 0,
      };
      current.revenueHt = roundDownCent(current.revenueHt + signed);
      current.quantity = roundDownCent(current.quantity + line.quantity);
      byArticle.set(key, current);
    }

    return Array.from(byArticle.values())
      .sort((a, b) => b.revenueHt - a.revenueHt)
      .slice(0, 5);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
