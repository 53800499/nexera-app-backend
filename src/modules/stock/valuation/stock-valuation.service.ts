import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  StockMovementStatus,
  StockMovementType,
  StockValuationMethod,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CrmMessages } from '../../../shared/constants/crm-messages';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import { STOCK_VALUATION_UPDATED } from './events/valuation.events';
import type { StockValuationBucket } from './events/valuation.events';

const IN_TYPES = new Set<string>([
  StockMovementType.IN_SUPPLIER,
  StockMovementType.IN_RETURN,
  StockMovementType.IN_PRODUCTION,
  StockMovementType.IN_ADJUSTMENT,
  StockMovementType.IN_INITIAL,
  StockMovementType.TRANSFER_IN,
]);

const OUT_TYPES = new Set<string>([
  StockMovementType.OUT_SALE,
  StockMovementType.OUT_CONSUMPTION,
  StockMovementType.OUT_LOSS,
  StockMovementType.OUT_RETURN_SUPPLIER,
  StockMovementType.OUT_ADJUSTMENT,
  StockMovementType.TRANSFER_OUT,
]);

export type ValuationLine = {
  stockItemId: string;
  reference: string;
  name: string;
  unit: string;
  valuationMethod: StockValuationMethod;
  warehouseId: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  lotId: string | null;
  lotNumber: string | null;
  qty: number;
  unitCost: number;
  totalValue: number;
};

@Injectable()
export class StockValuationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationBus: IntegrationEventBus,
  ) {}

  /**
   * Valorisation courante (instant T = maintenant) depuis les niveaux.
   * CMUP : currentCmup ; FIFO/LIFO : coût du lot résiduel.
   */
  async getCurrentValuation(
    tenantId: string,
    opts?: { warehouseId?: string },
  ) {
    const levels = await this.prisma.stockLevel.findMany({
      where: {
        tenantId,
        qtyOnHand: { not: 0 },
        ...(opts?.warehouseId ? { warehouseId: opts.warehouseId } : {}),
      },
      include: {
        stockItem: {
          include: {
            commercialItem: {
              select: {
                reference: true,
                name: true,
                unit: true,
                categoryId: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        warehouse: { select: { id: true, code: true, name: true } },
        lot: { select: { id: true, lotNumber: true, unitCost: true } },
      },
      orderBy: [
        { stockItem: { commercialItem: { reference: 'asc' } } },
        { warehouse: { code: 'asc' } },
      ],
    });

    const lines: ValuationLine[] = levels.map((level) => {
      const method = level.stockItem.valuationMethod;
      const unitCost =
        method === StockValuationMethod.cmup
          ? level.stockItem.currentCmup || level.unitValue
          : level.lot?.unitCost || level.unitValue || level.stockItem.currentCmup;
      const qty = level.qtyOnHand;
      return {
        stockItemId: level.stockItemId,
        reference: level.stockItem.commercialItem.reference,
        name: level.stockItem.commercialItem.name,
        unit: level.stockItem.commercialItem.unit,
        valuationMethod: method,
        warehouseId: level.warehouseId,
        warehouseCode: level.warehouse.code,
        warehouseName: level.warehouse.name,
        categoryId: level.stockItem.commercialItem.categoryId ?? null,
        categoryName: level.stockItem.commercialItem.category?.name ?? null,
        lotId: level.lotId,
        lotNumber: level.lot?.lotNumber ?? null,
        qty,
        unitCost,
        totalValue: qty * unitCost,
      };
    });

    return this.buildReport(lines, new Date().toISOString().slice(0, 10), opts?.warehouseId);
  }

  /**
   * RM-VAL03 — valorisation à une date passée via reconstitution des mouvements.
   */
  async getValuationAsOf(
    tenantId: string,
    asOf: string,
    opts?: { warehouseId?: string },
  ) {
    const asOfDate = new Date(asOf);
    if (Number.isNaN(asOfDate.getTime())) {
      throw new BadRequestException('Date de valorisation invalide.');
    }
    // Fin de journée inclusive
    const end = new Date(asOfDate);
    end.setHours(23, 59, 59, 999);

    const movementLines = await this.prisma.stockMovementLine.findMany({
      where: {
        tenantId,
        movement: {
          status: StockMovementStatus.validated,
          movementDate: { lte: end },
          ...(opts?.warehouseId ? { warehouseId: opts.warehouseId } : {}),
        },
      },
      include: {
        movement: {
          select: {
            id: true,
            movementType: true,
            warehouseId: true,
            movementDate: true,
          },
        },
        stockItem: {
          include: {
            commercialItem: {
              select: {
                reference: true,
                name: true,
                unit: true,
                categoryId: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        lot: { select: { id: true, lotNumber: true, unitCost: true } },
        location: { select: { id: true, code: true } },
      },
    });

    type AccKey = string;
    const qtyMap = new Map<
      AccKey,
      {
        stockItemId: string;
        warehouseId: string;
        lotId: string | null;
        qty: number;
        stockItem: (typeof movementLines)[0]['stockItem'];
        lot: (typeof movementLines)[0]['lot'];
      }
    >();

    for (const line of movementLines) {
      const type = line.movement.movementType;
      let signed = 0;
      if (IN_TYPES.has(type)) signed = line.qtyActual;
      else if (OUT_TYPES.has(type)) signed = -line.qtyActual;
      else continue;

      const key = `${line.stockItemId}|${line.movement.warehouseId}|${line.lotId ?? ''}`;
      const prev = qtyMap.get(key);
      if (prev) {
        prev.qty += signed;
      } else {
        qtyMap.set(key, {
          stockItemId: line.stockItemId,
          warehouseId: line.movement.warehouseId,
          lotId: line.lotId,
          qty: signed,
          stockItem: line.stockItem,
          lot: line.lot,
        });
      }
    }

    const warehouseIds = [
      ...new Set([...qtyMap.values()].map((v) => v.warehouseId)),
    ];
    const warehouses = await this.prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true, code: true, name: true },
    });
    const whMap = new Map(warehouses.map((w) => [w.id, w]));

    const cmupCache = new Map<string, number>();
    const lines: ValuationLine[] = [];

    for (const row of qtyMap.values()) {
      if (Math.abs(row.qty) < 1e-9) continue;

      const method = row.stockItem.valuationMethod;
      let unitCost = 0;

      if (method === StockValuationMethod.cmup) {
        if (!cmupCache.has(row.stockItemId)) {
          const hist = await this.prisma.stockCmupHistory.findFirst({
            where: {
              tenantId,
              stockItemId: row.stockItemId,
              recordedAt: { lte: end },
            },
            orderBy: { recordedAt: 'desc' },
          });
          cmupCache.set(
            row.stockItemId,
            hist?.cmupAfter ?? row.stockItem.currentCmup,
          );
        }
        unitCost = cmupCache.get(row.stockItemId) ?? 0;
      } else {
        // FIFO / LIFO — valorisation du résiduel au coût des lots restants
        unitCost =
          row.lot?.unitCost ?? row.stockItem.currentCmup ?? 0;
      }

      const wh = whMap.get(row.warehouseId);
      lines.push({
        stockItemId: row.stockItemId,
        reference: row.stockItem.commercialItem.reference,
        name: row.stockItem.commercialItem.name,
        unit: row.stockItem.commercialItem.unit,
        valuationMethod: method,
        warehouseId: row.warehouseId,
        warehouseCode: wh?.code ?? null,
        warehouseName: wh?.name ?? null,
        categoryId: row.stockItem.commercialItem.categoryId ?? null,
        categoryName: row.stockItem.commercialItem.category?.name ?? null,
        lotId: row.lotId,
        lotNumber: row.lot?.lotNumber ?? null,
        qty: row.qty,
        unitCost,
        totalValue: row.qty * unitCost,
      });
    }

    lines.sort((a, b) =>
      `${a.reference}${a.warehouseCode}`.localeCompare(
        `${b.reference}${b.warehouseCode}`,
      ),
    );

    return this.buildReport(lines, asOf.slice(0, 10), opts?.warehouseId);
  }

  async getCmupHistory(stockItemId: string, tenantId: string) {
    const item = await this.prisma.stockItem.findFirst({
      where: { id: stockItemId, tenantId },
      include: {
        commercialItem: {
          select: { reference: true, name: true },
        },
      },
    });
    if (!item) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }

    const history = await this.prisma.stockCmupHistory.findMany({
      where: { tenantId, stockItemId },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });

    return {
      stockItemId,
      reference: item.commercialItem.reference,
      name: item.commercialItem.name,
      valuationMethod: item.valuationMethod,
      currentCmup: item.currentCmup,
      history,
    };
  }

  /** §4.3 — publie stock.valuation_updated vers Module 3 (fin de mois / à la demande). */
  async publishToAccounting(
    tenantId: string,
    asOf?: string,
    warehouseId?: string,
  ) {
    const report = asOf
      ? await this.getValuationAsOf(tenantId, asOf, { warehouseId })
      : await this.getCurrentValuation(tenantId, { warehouseId });

    await this.integrationBus.publish({
      eventName: STOCK_VALUATION_UPDATED,
      tenantId,
      occurredAt: new Date(),
      payload: {
        asOf: report.asOf,
        totalValue: report.totals.totalValue,
        lineCount: report.lines.length,
        warehouseId: warehouseId ?? null,
        byMethod: report.totals.byMethod,
        byWarehouse: report.totals.byWarehouse,
        byCategory: report.totals.byCategory,
      },
    });

    return report;
  }

  /**
   * §3.3 — Taux de rotation =
   * (Coût des marchandises vendues sur période) ÷ (Valeur moyenne du stock sur période)
   * COGS = somme totalCost des OUT_SALE validées.
   * Valeur moyenne = (valeur début + valeur fin) / 2.
   */
  async getTurnoverRate(
    tenantId: string,
    from: string,
    to: string,
    opts?: { warehouseId?: string },
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Période de rotation invalide (from / to).');
    }
    if (fromDate > toDate) {
      throw new BadRequestException(
        'La date de début doit être antérieure ou égale à la date de fin.',
      );
    }

    const periodStart = new Date(fromDate);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(toDate);
    periodEnd.setHours(23, 59, 59, 999);

    // Valeur en début de période = stock à la veille de `from`
    const dayBefore = new Date(periodStart);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const openingAsOf = dayBefore.toISOString().slice(0, 10);
    const closingAsOf = to.slice(0, 10);

    const [opening, closing, saleLines] = await Promise.all([
      this.getValuationAsOf(tenantId, openingAsOf, opts),
      this.getValuationAsOf(tenantId, closingAsOf, opts),
      this.prisma.stockMovementLine.findMany({
        where: {
          tenantId,
          movement: {
            status: StockMovementStatus.validated,
            movementType: StockMovementType.OUT_SALE,
            movementDate: { gte: periodStart, lte: periodEnd },
            ...(opts?.warehouseId ? { warehouseId: opts.warehouseId } : {}),
          },
        },
        select: { totalCost: true, qtyActual: true },
      }),
    ]);

    const cogs = saleLines.reduce((s, l) => s + (l.totalCost ?? 0), 0);
    const qtySold = saleLines.reduce((s, l) => s + l.qtyActual, 0);
    const openingValue = opening.totals.totalValue;
    const closingValue = closing.totals.totalValue;
    const averageStockValue = (openingValue + closingValue) / 2;
    const turnoverRate =
      averageStockValue > 0 ? cogs / averageStockValue : null;

    return {
      from: from.slice(0, 10),
      to: to.slice(0, 10),
      warehouseId: opts?.warehouseId ?? null,
      cogs,
      qtySold,
      openingValue,
      closingValue,
      averageStockValue,
      turnoverRate,
      formula:
        'COGS(OUT_SALE) ÷ ((valeur_début + valeur_fin) / 2)',
    };
  }

  private buildReport(
    lines: ValuationLine[],
    asOf: string,
    warehouseId?: string,
  ) {
    const emptyBucket = (): StockValuationBucket => ({
      qty: 0,
      value: 0,
      count: 0,
    });

    const byMethod: Record<string, StockValuationBucket> = {
      cmup: emptyBucket(),
      fifo: emptyBucket(),
      lifo: emptyBucket(),
    };
    const byWarehouse: Record<
      string,
      StockValuationBucket & { code?: string; name?: string }
    > = {};
    const byCategory: Record<
      string,
      StockValuationBucket & { name?: string }
    > = {};

    let totalQty = 0;
    let totalValue = 0;
    for (const line of lines) {
      totalQty += line.qty;
      totalValue += line.totalValue;
      const methodBucket = byMethod[line.valuationMethod];
      if (methodBucket) {
        methodBucket.qty += line.qty;
        methodBucket.value += line.totalValue;
        methodBucket.count += 1;
      }

      const whKey = line.warehouseId ?? 'unknown';
      if (!byWarehouse[whKey]) {
        byWarehouse[whKey] = {
          ...emptyBucket(),
          code: line.warehouseCode ?? undefined,
          name: line.warehouseName ?? undefined,
        };
      }
      byWarehouse[whKey].qty += line.qty;
      byWarehouse[whKey].value += line.totalValue;
      byWarehouse[whKey].count += 1;

      const catKey = line.categoryId ?? 'uncategorized';
      if (!byCategory[catKey]) {
        byCategory[catKey] = {
          ...emptyBucket(),
          name: line.categoryName ?? 'Sans catégorie',
        };
      }
      byCategory[catKey].qty += line.qty;
      byCategory[catKey].value += line.totalValue;
      byCategory[catKey].count += 1;
    }

    return {
      asOf,
      warehouseId: warehouseId ?? null,
      lines,
      totals: {
        totalQty,
        totalValue,
        lineCount: lines.length,
        byMethod,
        byWarehouse,
        byCategory,
      },
    };
  }
}
