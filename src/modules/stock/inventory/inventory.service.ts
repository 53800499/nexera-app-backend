import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventorySessionStatus,
  InventorySessionType,
  Prisma,
  StockAlertLevel,
  StockMovementStatus,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentNumberingService } from '../../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../../settings/enums/numbering-document-type.enum';
import { CrmMessages } from '../../../shared/constants/crm-messages';
import { StockIntegrationService } from '../stock-integration.service';
import { toIntegrationAlertLevel } from '../events/stock.events';
import {
  CreateInventorySessionDto,
  InventoryTypeDto,
  SubmitInventoryCountsDto,
} from './dto/create-inventory-session.dto';
import { STOCK_INVENTORY_CLOSED } from './events/inventory.events';

const ACTIVE_STATUSES: InventorySessionStatus[] = [
  InventorySessionStatus.draft,
  InventorySessionStatus.counting,
  InventorySessionStatus.recount,
  InventorySessionStatus.analyzing,
];

const sessionInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  lines: {
    include: {
      stockItem: {
        include: {
          commercialItem: {
            select: {
              id: true,
              reference: true,
              name: true,
              unit: true,
              categoryId: true,
            },
          },
        },
      },
      lot: { select: { id: true, lotNumber: true } },
      location: { select: { id: true, code: true } },
    },
    orderBy: { stockItem: { commercialItem: { reference: 'asc' as const } } },
  },
} satisfies Prisma.InventorySessionInclude;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: DocumentNumberingService,
    private readonly stockIntegration: StockIntegrationService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.inventorySession.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const session = await this.prisma.inventorySession.findFirst({
      where: { id, tenantId },
      include: sessionInclude,
    });
    if (!session) {
      throw new NotFoundException(CrmMessages.stock.INVENTORY_NOT_FOUND);
    }
    return session;
  }

  /** Feuille de comptage — stock théorique masqué (RM-INV02). */
  async getCountSheet(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);
    return {
      ...session,
      lines: session.lines.map(({ qtyTheoretical: _hidden, ...rest }) => rest),
    };
  }

  async create(dto: CreateInventorySessionDto, tenantId: string, userId: string) {
    if (dto.type === InventoryTypeDto.partial && !dto.categoryId) {
      throw new BadRequestException(
        CrmMessages.stock.INVENTORY_CATEGORY_REQUIRED,
      );
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId, isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(CrmMessages.stock.WAREHOUSE_NOT_FOUND);
    }

    const existingOpen = await this.prisma.inventorySession.findFirst({
      where: {
        tenantId,
        warehouseId: dto.warehouseId,
        status: { in: ACTIVE_STATUSES },
      },
    });
    if (existingOpen) {
      throw new BadRequestException(
        `Un inventaire est déjà ouvert sur cet entrepôt (${existingOpen.number}).`,
      );
    }

    const levels = await this.prisma.stockLevel.findMany({
      where: {
        tenantId,
        warehouseId: dto.warehouseId,
        ...(dto.categoryId
          ? {
              stockItem: {
                commercialItem: { categoryId: dto.categoryId },
              },
            }
          : {}),
      },
      include: {
        stockItem: true,
        lot: true,
      },
    });

    if (levels.length === 0) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_NO_LINES);
    }

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.STOCK_INVENTORY,
    );

    return this.prisma.inventorySession.create({
      data: {
        tenantId,
        number,
        type: dto.type as InventorySessionType,
        status: InventorySessionStatus.draft,
        warehouseId: dto.warehouseId,
        categoryId: dto.categoryId,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        freezeMovements: dto.freezeMovements ?? true,
        varianceThresholdQty: dto.varianceThresholdQty ?? 0,
        significantVarianceValue: dto.significantVarianceValue ?? 0,
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: levels.map((level) => ({
            tenantId,
            stockItemId: level.stockItemId,
            lotId: level.lotId,
            locationId: level.locationId,
            qtyTheoretical: level.qtyOnHand,
            unitCost: level.unitValue || level.stockItem.currentCmup,
          })),
        },
      },
      include: sessionInclude,
    });
  }

  async start(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);
    if (session.status !== InventorySessionStatus.draft) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_INVALID_STATUS);
    }
    return this.prisma.inventorySession.update({
      where: { id },
      data: {
        status: InventorySessionStatus.counting,
        startedAt: new Date(),
      },
      include: sessionInclude,
    });
  }

  /** Saisie 1er ou 2e comptage selon le statut. */
  async submitCounts(
    id: string,
    dto: SubmitInventoryCountsDto,
    tenantId: string,
    userId: string,
  ) {
    const session = await this.findOne(id, tenantId);
    const isFirst = session.status === InventorySessionStatus.counting;
    const isSecond = session.status === InventorySessionStatus.recount;
    if (!isFirst && !isSecond) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_INVALID_STATUS);
    }

    const lineMap = new Map(session.lines.map((l) => [l.id, l]));

    await this.prisma.$transaction(async (tx) => {
      for (const input of dto.lines) {
        const line = lineMap.get(input.lineId);
        if (!line) {
          throw new BadRequestException(`Ligne introuvable: ${input.lineId}`);
        }
        if (isFirst) {
          await tx.inventoryCountLine.update({
            where: { id: line.id },
            data: {
              qtyCounted1: input.qtyCounted,
              countedBy1: userId,
              notes: input.notes ?? line.notes,
            },
          });
        } else {
          if (!line.requiresRecount) continue;
          await tx.inventoryCountLine.update({
            where: { id: line.id },
            data: {
              qtyCounted2: input.qtyCounted,
              countedBy2: userId,
              notes: input.notes ?? line.notes,
            },
          });
        }
      }
    });

    return this.findOne(id, tenantId);
  }

  /** Clôture du 1er comptage → recount ou analyzing (RM-INV03). */
  async completeFirstCount(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);
    if (session.status !== InventorySessionStatus.counting) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_INVALID_STATUS);
    }

    const incomplete = session.lines.some((l) => l.qtyCounted1 == null);
    if (incomplete) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_COUNT_INCOMPLETE);
    }

    let needsRecount = false;
    await this.prisma.$transaction(async (tx) => {
      for (const line of session.lines) {
        const counted = line.qtyCounted1 ?? 0;
        const variance = counted - line.qtyTheoretical;
        const absVar = Math.abs(variance);
        const requires =
          absVar > session.varianceThresholdQty;
        if (requires) needsRecount = true;
        await tx.inventoryCountLine.update({
          where: { id: line.id },
          data: {
            requiresRecount: requires,
            qtyFinal: requires ? null : counted,
            varianceQty: requires ? null : variance,
            varianceValue: requires
              ? null
              : variance * line.unitCost,
          },
        });
      }
      await tx.inventorySession.update({
        where: { id },
        data: {
          status: needsRecount
            ? InventorySessionStatus.recount
            : InventorySessionStatus.analyzing,
        },
      });
    });

    return this.findOne(id, tenantId);
  }

  async completeRecount(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);
    if (session.status !== InventorySessionStatus.recount) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_INVALID_STATUS);
    }

    const incomplete = session.lines.some(
      (l) => l.requiresRecount && l.qtyCounted2 == null,
    );
    if (incomplete) {
      throw new BadRequestException(
        CrmMessages.stock.INVENTORY_RECOUNT_INCOMPLETE,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of session.lines) {
        const finalQty = line.requiresRecount
          ? (line.qtyCounted2 ?? 0)
          : (line.qtyCounted1 ?? 0);
        const variance = finalQty - line.qtyTheoretical;
        await tx.inventoryCountLine.update({
          where: { id: line.id },
          data: {
            qtyFinal: finalQty,
            varianceQty: variance,
            varianceValue: variance * line.unitCost,
          },
        });
      }
      await tx.inventorySession.update({
        where: { id },
        data: { status: InventorySessionStatus.analyzing },
      });
    });

    return this.findOne(id, tenantId);
  }

  /** Écarts (avec stock théorique) — filtrage seuil optionnel. */
  async getVariances(
    id: string,
    tenantId: string,
    significantOnly = false,
  ) {
    const session = await this.findOne(id, tenantId);
    let lines = session.lines.filter((l) => l.qtyFinal != null);
    if (significantOnly) {
      lines = lines.filter(
        (l) =>
          Math.abs(l.varianceValue ?? 0) >=
            session.significantVarianceValue ||
          Math.abs(l.varianceQty ?? 0) > session.varianceThresholdQty,
      );
    }
    return {
      session: {
        id: session.id,
        number: session.number,
        status: session.status,
        significantVarianceValue: session.significantVarianceValue,
      },
      lines: lines.map((l) => ({
        id: l.id,
        reference: l.stockItem.commercialItem.reference,
        name: l.stockItem.commercialItem.name,
        lotNumber: l.lot?.lotNumber ?? null,
        locationCode: l.location?.code ?? null,
        qtyTheoretical: l.qtyTheoretical,
        qtyCounted1: l.qtyCounted1,
        qtyCounted2: l.qtyCounted2,
        qtyFinal: l.qtyFinal,
        unitCost: l.unitCost,
        varianceQty: l.varianceQty,
        varianceValue: l.varianceValue,
        requiresRecount: l.requiresRecount,
      })),
    };
  }

  /**
   * Validation responsable : génère IN_ADJUSTMENT / OUT_ADJUSTMENT
   * tagués INVENTORY_ADJUSTMENT (RM-INV04).
   */
  async validate(id: string, tenantId: string, userId: string) {
    const session = await this.findOne(id, tenantId);
    if (session.status !== InventorySessionStatus.analyzing) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_INVALID_STATUS);
    }

    const incomplete = session.lines.some((l) => l.qtyFinal == null);
    if (incomplete) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_COUNT_INCOMPLETE);
    }

    const levelUpdates: Array<{
      itemId: string;
      warehouseId: string;
      newQtyAvailable: number;
      alertLevel: ReturnType<typeof toIntegrationAlertLevel>;
      reference: string;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const line of session.lines) {
        const variance = line.varianceQty ?? 0;
        if (variance === 0) continue;

        const isIn = variance > 0;
        const qty = Math.abs(variance);
        const movementType = isIn
          ? StockMovementType.IN_ADJUSTMENT
          : StockMovementType.OUT_ADJUSTMENT;

        const number = await this.numberingService.generateNext(
          tenantId,
          isIn
            ? NumberingDocumentType.STOCK_RECEIPT
            : NumberingDocumentType.STOCK_ISSUE,
          tx,
        );

        await tx.stockMovement.create({
          data: {
            tenantId,
            number,
            movementType,
            status: StockMovementStatus.validated,
            warehouseId: session.warehouseId,
            movementDate: new Date(),
            inventorySessionId: session.id,
            reference: session.number,
            reason: 'INVENTORY_ADJUSTMENT',
            notes: `Ajustement inventaire ${session.number}`,
            approvedBy: userId,
            approvedAt: new Date(),
            createdBy: userId,
            lines: {
              create: {
                tenantId,
                stockItemId: line.stockItemId,
                lotId: line.lotId,
                locationId: line.locationId,
                qtyPlanned: qty,
                qtyActual: qty,
                unitCost: line.unitCost,
                totalCost: qty * line.unitCost,
              },
            },
          },
        });

        const stockItem = await tx.stockItem.findFirstOrThrow({
          where: { id: line.stockItemId, tenantId },
          include: { commercialItem: true },
        });

        if (line.lotId) {
          await tx.stockItemLot.update({
            where: { id: line.lotId },
            data: {
              remainingQty: isIn
                ? { increment: qty }
                : { decrement: qty },
            },
          });
        }

        const level = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            stockItemId: line.stockItemId,
            warehouseId: session.warehouseId,
            locationId: line.locationId ?? null,
            lotId: line.lotId ?? null,
          },
        });

        if (level) {
          const newQty = level.qtyOnHand + variance;
          await tx.stockLevel.update({
            where: { id: level.id },
            data: {
              qtyOnHand: newQty,
              qtyAvailable: newQty - level.qtyReserved,
              unitValue: line.unitCost,
              totalValue: Math.max(newQty, 0) * line.unitCost,
              alertLevel: this.computeAlertLevel(
                Math.max(newQty - level.qtyReserved, 0),
                stockItem.minStockQty,
                stockItem.safetyStockQty,
              ),
            },
          });
        } else if (isIn) {
          await tx.stockLevel.create({
            data: {
              tenantId,
              stockItemId: line.stockItemId,
              warehouseId: session.warehouseId,
              locationId: line.locationId,
              lotId: line.lotId,
              qtyOnHand: qty,
              qtyReserved: 0,
              qtyAvailable: qty,
              unitValue: line.unitCost,
              totalValue: qty * line.unitCost,
              alertLevel: StockAlertLevel.ok,
            },
          });
        }

        const whAgg = await tx.stockLevel.aggregate({
          where: {
            tenantId,
            stockItemId: stockItem.id,
            warehouseId: session.warehouseId,
          },
          _sum: { qtyAvailable: true },
        });
        const newQtyAvailable = whAgg._sum.qtyAvailable ?? 0;
        levelUpdates.push({
          itemId: stockItem.commercialItemId,
          warehouseId: session.warehouseId,
          newQtyAvailable,
          alertLevel: toIntegrationAlertLevel(
            this.computeAlertLevel(
              newQtyAvailable,
              stockItem.minStockQty,
              stockItem.safetyStockQty,
            ),
          ),
          reference: stockItem.commercialItem.reference,
        });
      }

      await tx.inventorySession.update({
        where: { id },
        data: {
          status: InventorySessionStatus.validated,
          validatedAt: new Date(),
          validatedBy: userId,
        },
      });
    });

    for (const update of levelUpdates) {
      await this.stockIntegration.publishLevelUpdated(tenantId, update);
    }

    return this.findOne(id, tenantId);
  }

  async close(id: string, tenantId: string, userId: string) {
    const session = await this.findOne(id, tenantId);
    if (session.status !== InventorySessionStatus.validated) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_INVALID_STATUS);
    }

    const closed = await this.prisma.inventorySession.update({
      where: { id },
      data: {
        status: InventorySessionStatus.closed,
        closedAt: new Date(),
        closedBy: userId,
      },
      include: sessionInclude,
    });

    const adjustedLines = closed.lines.filter(
      (l) => (l.varianceQty ?? 0) !== 0,
    );
    const totalAdjustmentsValue = adjustedLines.reduce(
      (s, l) => s + Math.abs(l.varianceValue ?? 0),
      0,
    );

    await this.stockIntegration.publishInventoryClosed(tenantId, {
      sessionId: closed.id,
      date: (closed.closedAt ?? new Date()).toISOString(),
      totalAdjustmentsValue,
      itemsAdjusted: adjustedLines.length,
      number: closed.number,
      warehouseId: closed.warehouseId,
      type: closed.type,
      closedAt: closed.closedAt!.toISOString(),
    });

    return closed;
  }

  async cancel(id: string, tenantId: string) {
    const session = await this.findOne(id, tenantId);
    if (
      session.status !== InventorySessionStatus.draft &&
      session.status !== InventorySessionStatus.counting
    ) {
      throw new BadRequestException(CrmMessages.stock.INVENTORY_INVALID_STATUS);
    }
    return this.prisma.inventorySession.update({
      where: { id },
      data: { status: InventorySessionStatus.cancelled },
      include: sessionInclude,
    });
  }

  private computeAlertLevel(
    qtyAvailable: number,
    minStockQty: number | null,
    safetyStockQty: number | null,
  ): StockAlertLevel {
    if (minStockQty != null && qtyAvailable <= minStockQty) {
      return StockAlertLevel.critical;
    }
    if (safetyStockQty != null && qtyAvailable <= safetyStockQty) {
      return StockAlertLevel.warning;
    }
    return StockAlertLevel.ok;
  }
}
