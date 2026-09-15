import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockAlertLevel,
  StockAlertStatus,
  StockAlertType,
  StockMovementStatus,
  StockMovementType,
  StockSerialStatus,
  StockValuationMethod,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentNumberingService } from '../../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../../settings/enums/numbering-document-type.enum';
import { CrmMessages } from '../../../shared/constants/crm-messages';
import {
  CreateStockExitDto,
  CreateStockExitLineDto,
  StockExitTypeDto,
} from './dto/create-stock-exit.dto';
import { StockIntegrationService } from '../stock-integration.service';
import { InventoryFreezeGuard } from '../inventory/inventory-freeze.guard';
import { toIntegrationAlertLevel } from '../events/stock.events';

/** Seuil valeur perte (FCFA) — au-delà, validation responsable (RM-OUT04). */
export const LOSS_VALUE_APPROVAL_THRESHOLD = 10_000;

const EXIT_TYPES = new Set<string>([
  StockMovementType.OUT_SALE,
  StockMovementType.OUT_CONSUMPTION,
  StockMovementType.OUT_LOSS,
  StockMovementType.OUT_RETURN_SUPPLIER,
  StockMovementType.OUT_ADJUSTMENT,
]);

const movementInclude = {
  warehouse: { select: { id: true, code: true, name: true } },
  lines: {
    include: {
      stockItem: {
        include: {
          commercialItem: {
            select: { id: true, reference: true, name: true, unit: true },
          },
        },
      },
      location: { select: { id: true, code: true } },
      lot: true,
    },
  },
} satisfies Prisma.StockMovementInclude;

type AllocSlice = {
  stockItemId: string;
  lotId: string | null;
  locationId: string | null;
  qty: number;
  unitCost: number;
  lotNumber: string | null;
  serialNumbers: string[];
};

@Injectable()
export class StockExitsService {
  private readonly logger = new Logger(StockExitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: DocumentNumberingService,
    private readonly stockIntegration: StockIntegrationService,
    private readonly inventoryFreeze: InventoryFreezeGuard,
  ) {}

  async findExits(tenantId: string) {
    return this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        movementType: { in: [...EXIT_TYPES] as StockMovementType[] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          select: {
            id: true,
            qtyPlanned: true,
            qtyActual: true,
            unitCost: true,
            lotNumber: true,
            stockItem: {
              select: {
                id: true,
                commercialItem: { select: { reference: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  async listAvailableLots(
    stockItemId: string,
    warehouseId: string,
    tenantId: string,
  ) {
    const stockItem = await this.prisma.stockItem.findFirst({
      where: { id: stockItemId, tenantId },
    });
    if (!stockItem) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }

    const levels = await this.prisma.stockLevel.findMany({
      where: {
        tenantId,
        stockItemId,
        warehouseId,
        qtyAvailable: { gt: 0 },
      },
      include: {
        lot: true,
        location: { select: { id: true, code: true } },
      },
      orderBy: [{ lot: { receivedDate: 'asc' } }, { updatedAt: 'asc' }],
    });

    return {
      stockItemId,
      valuationMethod: stockItem.valuationMethod,
      trackLots: stockItem.trackLots,
      trackSerials: stockItem.trackSerials,
      levels: levels.map((l) => ({
        levelId: l.id,
        lotId: l.lotId,
        lotNumber: l.lot?.lotNumber ?? null,
        receivedDate: l.lot?.receivedDate ?? null,
        locationId: l.locationId,
        locationCode: l.location?.code ?? null,
        qtyAvailable: l.qtyAvailable,
        unitValue: l.unitValue,
      })),
    };
  }

  async listAvailableSerials(
    stockItemId: string,
    warehouseId: string,
    tenantId: string,
  ) {
    const stockItem = await this.prisma.stockItem.findFirst({
      where: { id: stockItemId, tenantId },
    });
    if (!stockItem) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }

    const serials = await this.prisma.stockItemSerial.findMany({
      where: {
        tenantId,
        stockItemId,
        status: StockSerialStatus.in_stock,
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        location: { select: { id: true, code: true } },
        lot: { select: { id: true, lotNumber: true } },
      },
      orderBy: { receivedDate: 'asc' },
    });

    return {
      stockItemId,
      serials: serials.map((s) => ({
        id: s.id,
        serialNumber: s.serialNumber,
        warehouseId: s.warehouseId,
        locationId: s.locationId,
        locationCode: s.location?.code ?? null,
        lotId: s.lotId,
        lotNumber: s.lot?.lotNumber ?? null,
        receivedDate: s.receivedDate,
      })),
    };
  }

  async createExit(dto: CreateStockExitDto, tenantId: string, userId: string) {
    this.assertExitHeader(dto);

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId, isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(CrmMessages.stock.WAREHOUSE_NOT_FOUND);
    }

    await this.inventoryFreeze.assertNotFrozen(tenantId, dto.warehouseId);

    const allocations: AllocSlice[] = [];
    let totalLossValue = 0;

    for (const line of dto.lines) {
      const slices = await this.planAllocation(
        line,
        dto.warehouseId,
        tenantId,
        dto.movementType,
      );
      allocations.push(...slices);
      for (const s of slices) {
        totalLossValue += s.qty * s.unitCost;
      }
    }

    const requiresApproval =
      (dto.movementType === StockExitTypeDto.OUT_LOSS ||
        dto.movementType === StockExitTypeDto.OUT_ADJUSTMENT) &&
      totalLossValue > LOSS_VALUE_APPROVAL_THRESHOLD;

    if (requiresApproval && dto.validate) {
      throw new BadRequestException(CrmMessages.stock.LOSS_REQUIRES_APPROVAL);
    }

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.STOCK_ISSUE,
    );

    const notesParts = [
      dto.costCenter ? `Centre de coût: ${dto.costCenter}` : null,
      requiresApproval
        ? `Validation responsable requise (valeur ${totalLossValue.toFixed(2)} > seuil ${LOSS_VALUE_APPROVAL_THRESHOLD})`
        : null,
      dto.notes?.trim() || null,
    ].filter(Boolean);

    const movement = await this.prisma.stockMovement.create({
      data: {
        tenantId,
        number,
        movementType: dto.movementType as StockMovementType,
        status: StockMovementStatus.draft,
        warehouseId: dto.warehouseId,
        movementDate: dto.movementDate
          ? new Date(dto.movementDate)
          : new Date(),
        reference: dto.reference,
        reason: dto.reason,
        notes: notesParts.length ? notesParts.join(' | ') : null,
        createdBy: userId,
        lines: {
          create: allocations.map((a) => ({
            tenantId,
            stockItemId: a.stockItemId,
            lotId: a.lotId,
            locationId: a.locationId,
            qtyPlanned: a.qty,
            qtyActual: a.qty,
            unitCost: a.unitCost,
            totalCost: a.qty * a.unitCost,
            lotNumber: a.lotNumber,
            serialNumbers: a.serialNumbers,
          })),
        },
      },
      include: movementInclude,
    });

    if (dto.validate && !requiresApproval) {
      try {
        return await this.validateExit(movement.id, tenantId, userId);
      } catch (err) {
        await this.prisma.stockMovement
          .delete({
            where: { id: movement.id },
          })
          .catch(() => null);
        throw err;
      }
    }

    return movement;
  }

  async validateExit(id: string, tenantId: string, userId: string) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, tenantId },
      include: movementInclude,
    });
    if (!movement) {
      throw new NotFoundException(CrmMessages.stock.MOVEMENT_NOT_FOUND);
    }
    if (movement.status === StockMovementStatus.validated) {
      throw new BadRequestException(CrmMessages.stock.MOVEMENT_ALREADY_VALIDATED);
    }
    if (movement.status === StockMovementStatus.cancelled) {
      throw new BadRequestException(CrmMessages.stock.MOVEMENT_CANCELLED);
    }
    if (!EXIT_TYPES.has(movement.movementType)) {
      throw new BadRequestException(CrmMessages.stock.MOVEMENT_NOT_EXIT);
    }

    const levelUpdates: Array<{
      itemId: string;
      warehouseId: string;
      newQtyAvailable: number;
      alertLevel: ReturnType<typeof toIntegrationAlertLevel>;
      reference: string;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const line of movement.lines) {
        const stockItem = await tx.stockItem.findFirst({
          where: { id: line.stockItemId, tenantId },
          include: { commercialItem: true },
        });
        if (!stockItem) {
          throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
        }

        const qtyOut = line.qtyActual;
        if (qtyOut <= 0) continue;

        const available = await this.getAvailableQty(
          tx,
          tenantId,
          stockItem.id,
          movement.warehouseId,
          line.lotId,
          line.locationId,
        );

        if (available < qtyOut && !stockItem.allowNegativeStock) {
          throw new BadRequestException(CrmMessages.stock.INSUFFICIENT_STOCK);
        }

        const serialIds: string[] = [];
        if (stockItem.trackSerials) {
          const serials = line.serialNumbers ?? [];
          if (serials.length !== Math.round(qtyOut)) {
            throw new BadRequestException(
              CrmMessages.stock.SERIAL_COUNT_MISMATCH,
            );
          }

          const seen = new Set<string>();
          for (const raw of serials) {
            const sn = raw.trim().toUpperCase();
            if (seen.has(sn)) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_DUPLICATE_IN_INPUT(sn),
              );
            }
            seen.add(sn);
          }

          for (const sn of serials) {
            const trimmedSn = sn.trim().toUpperCase();
            const serial = await tx.stockItemSerial.findFirst({
              where: {
                tenantId,
                stockItemId: stockItem.id,
                serialNumber: trimmedSn,
              },
            });

            if (!serial) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_NOT_FOUND(trimmedSn),
              );
            }

            if (serial.status === StockSerialStatus.sold) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_ALREADY_SOLD(trimmedSn),
              );
            }

            if (serial.status === StockSerialStatus.scrapped) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_ALREADY_SCRAPPED(trimmedSn),
              );
            }

            if (serial.status === StockSerialStatus.transferred) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_ALREADY_TRANSFERRED(trimmedSn),
              );
            }

            if (
              serial.warehouseId &&
              serial.warehouseId !== movement.warehouseId
            ) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_WRONG_WAREHOUSE(trimmedSn),
              );
            }

            if (serial.status !== StockSerialStatus.in_stock) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_NOT_IN_STOCK,
              );
            }

            await tx.stockItemSerial.update({
              where: { id: serial.id },
              data: {
                status:
                  movement.movementType === StockMovementType.OUT_SALE
                    ? StockSerialStatus.sold
                    : StockSerialStatus.scrapped,
                soldInvoiceId: movement.invoiceId,
              },
            });
            serialIds.push(serial.id);
          }
        }

        if (line.lotId) {
          await tx.stockItemLot.update({
            where: { id: line.lotId },
            data: { remainingQty: { decrement: qtyOut } },
          });
        }

        const level = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            stockItemId: stockItem.id,
            warehouseId: movement.warehouseId,
            locationId: line.locationId ?? null,
            lotId: line.lotId ?? null,
          },
        });

        const cmupBefore = stockItem.currentCmup;
        const unitCost = line.unitCost || cmupBefore;

        const newQty = level
          ? level.qtyOnHand - qtyOut
          : stockItem.allowNegativeStock
            ? -qtyOut
            : 0;
        const qtyAvailable = level
          ? newQty - level.qtyReserved
          : newQty;
        const alertLevel = level
          ? this.computeAlertLevel(
              Math.max(qtyAvailable, 0),
              stockItem.minStockQty,
              stockItem.safetyStockQty,
            )
          : StockAlertLevel.critical;

        if (level) {
          await tx.stockLevel.update({
            where: { id: level.id },
            data: {
              qtyOnHand: newQty,
              qtyAvailable: newQty - level.qtyReserved,
              unitValue: cmupBefore,
              totalValue: Math.max(newQty, 0) * cmupBefore,
              alertLevel,
            },
          });
        } else if (stockItem.allowNegativeStock) {
          await tx.stockLevel.create({
            data: {
              tenantId,
              stockItemId: stockItem.id,
              warehouseId: movement.warehouseId,
              locationId: line.locationId,
              lotId: line.lotId,
              qtyOnHand: -qtyOut,
              qtyReserved: 0,
              qtyAvailable: -qtyOut,
              unitValue: cmupBefore,
              totalValue: 0,
              alertLevel: StockAlertLevel.critical,
            },
          });
        } else {
          throw new BadRequestException(CrmMessages.stock.INSUFFICIENT_STOCK);
        }

        await tx.stockMovementLine.update({
          where: { id: line.id },
          data: {
            serialIds,
            unitCost,
            totalCost: qtyOut * unitCost,
            cmupBefore,
            cmupAfter: cmupBefore,
          },
        });

        const whAgg = await tx.stockLevel.aggregate({
          where: {
            tenantId,
            stockItemId: stockItem.id,
            warehouseId: movement.warehouseId,
          },
          _sum: { qtyAvailable: true },
        });

        levelUpdates.push({
          itemId: stockItem.commercialItemId,
          warehouseId: movement.warehouseId,
          newQtyAvailable: whAgg._sum.qtyAvailable ?? 0,
          alertLevel: toIntegrationAlertLevel(alertLevel),
          reference: stockItem.commercialItem.reference,
        });
      }

      await tx.stockMovement.update({
        where: { id },
        data: {
          status: StockMovementStatus.validated,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });
    });

    for (const update of levelUpdates) {
      await this.stockIntegration.publishLevelUpdated(tenantId, update);
    }

    return this.prisma.stockMovement.findFirstOrThrow({
      where: { id, tenantId },
      include: movementInclude,
    });
  }

  /**
   * RM-OUT03 — sortie vente auto à l'émission facture.
   * Stock insuffisant : sort le disponible, trace l'écart, ne bloque pas la facture.
   */
  async createSaleFromInvoice(
    tenantId: string,
    payload: {
      invoiceId: string;
      number: string;
      lines: Array<{ itemId?: string | null; quantity: number; description: string }>;
      issueDate: Date | string;
    },
  ) {
    const existing = await this.prisma.stockMovement.findFirst({
      where: {
        tenantId,
        invoiceId: payload.invoiceId,
        movementType: StockMovementType.OUT_SALE,
      },
    });
    if (existing) {
      this.logger.warn(
        `OUT_SALE already exists for invoice ${payload.invoiceId}`,
      );
      return existing;
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });
    if (!warehouse) {
      this.logger.warn(
        `No default warehouse for tenant ${tenantId} — skip OUT_SALE`,
      );
      return null;
    }

    const exitLines: CreateStockExitLineDto[] = [];
    const shortages: string[] = [];

    for (const line of payload.lines) {
      if (!line.itemId || line.quantity <= 0) continue;

      const stockItem = await this.prisma.stockItem.findFirst({
        where: { commercialItemId: line.itemId, tenantId },
        include: { commercialItem: true },
      });
      if (!stockItem) continue;

      const available = await this.getAvailableQty(
        this.prisma,
        tenantId,
        stockItem.id,
        warehouse.id,
        null,
        null,
      );

      const qtyOut = Math.min(line.quantity, available);
      if (qtyOut < line.quantity) {
        shortages.push(
          `${stockItem.commercialItem.reference}: demandé ${line.quantity}, sorti ${qtyOut}`,
        );
      }
      if (qtyOut <= 0) continue;

      exitLines.push({ stockItemId: stockItem.id, qty: qtyOut });
    }

    if (exitLines.length === 0) {
      this.logger.warn(
        `invoice.issued ${payload.number}: aucune quantité sortable (écarts: ${shortages.join('; ') || 'aucun article stock'})`,
      );
      if (shortages.length > 0) {
        await this.raiseShortageAlertsFromInvoice(
          tenantId,
          warehouse.id,
          payload,
          shortages,
        );
      }
      return null;
    }

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.STOCK_ISSUE,
    );

    const allocations: AllocSlice[] = [];
    for (const line of exitLines) {
      const slices = await this.planAllocation(
        line,
        warehouse.id,
        tenantId,
        StockExitTypeDto.OUT_SALE,
        true,
      );
      allocations.push(...slices);
    }

    const movement = await this.prisma.stockMovement.create({
      data: {
        tenantId,
        number,
        movementType: StockMovementType.OUT_SALE,
        status: StockMovementStatus.draft,
        warehouseId: warehouse.id,
        movementDate: new Date(payload.issueDate),
        invoiceId: payload.invoiceId,
        reference: payload.number,
        notes: shortages.length
          ? `Écart stock (RM-OUT03): ${shortages.join('; ')}`
          : `Sortie auto facture ${payload.number}`,
        createdBy: 'system',
        lines: {
          create: allocations.map((a) => ({
            tenantId,
            stockItemId: a.stockItemId,
            lotId: a.lotId,
            locationId: a.locationId,
            qtyPlanned: a.qty,
            qtyActual: a.qty,
            unitCost: a.unitCost,
            totalCost: a.qty * a.unitCost,
            lotNumber: a.lotNumber,
            serialNumbers: a.serialNumbers,
          })),
        },
      },
    });

    if (shortages.length > 0) {
      await this.raiseShortageAlertsFromInvoice(
        tenantId,
        warehouse.id,
        payload,
        shortages,
      );
    }

    try {
      return await this.validateExit(movement.id, tenantId, 'system');
    } catch (error) {
      this.logger.error(
        `Failed to validate OUT_SALE for invoice ${payload.number}`,
        error instanceof Error ? error.stack : error,
      );
      return movement;
    }
  }

  /** §4.2 — stock insuffisant à l'émission facture : alerte + écart tracé */
  private async raiseShortageAlertsFromInvoice(
    tenantId: string,
    warehouseId: string,
    payload: {
      invoiceId: string;
      number: string;
      lines: Array<{ itemId?: string | null; quantity: number }>;
    },
    shortages: string[],
  ) {
    for (const line of payload.lines) {
      if (!line.itemId || line.quantity <= 0) continue;
      const stockItem = await this.prisma.stockItem.findFirst({
        where: { commercialItemId: line.itemId, tenantId },
        include: {
          commercialItem: { select: { reference: true } },
        },
      });
      if (!stockItem) continue;

      const available = await this.getAvailableQty(
        this.prisma,
        tenantId,
        stockItem.id,
        warehouseId,
        null,
        null,
      );
      if (available >= line.quantity) continue;

      const fingerprint = `invoice-shortage:${payload.invoiceId}:${stockItem.id}`;
      const existing = await this.prisma.stockAlert.findFirst({
        where: { tenantId, fingerprint },
      });
      if (existing) continue;

      const alert = await this.prisma.stockAlert.create({
        data: {
          tenantId,
          alertType: StockAlertType.shortage,
          status: StockAlertStatus.open,
          severity: StockAlertLevel.critical,
          stockItemId: stockItem.id,
          warehouseId,
          qtyOnHand: available,
          thresholdQty: line.quantity,
          daysMetric: null,
          title: `Écart facture — ${stockItem.commercialItem.reference}`,
          message: `Facture ${payload.number}: demandé ${line.quantity}, disponible ${available}. ${shortages.join('; ')}`,
          suggestion: 'Réapprovisionner puis régulariser l’écart.',
          suggestedQty: Math.max(line.quantity - available, 0),
          fingerprint,
        },
      });

      await this.stockIntegration.publishAlertTriggered(tenantId, {
        itemId: stockItem.commercialItemId,
        alertType: StockAlertType.shortage,
        currentQty: available,
        thresholdQty: line.quantity,
        estimatedDaysToStockout: null,
        alertId: alert.id,
        stockItemId: stockItem.id,
        reference: stockItem.commercialItem.reference,
        severity: StockAlertLevel.critical,
        warehouseId,
      });
    }
  }

  private async planAllocation(
    line: CreateStockExitLineDto,
    warehouseId: string,
    tenantId: string,
    movementType: StockExitTypeDto,
    allowPartial = false,
  ): Promise<AllocSlice[]> {
    const stockItem = await this.prisma.stockItem.findFirst({
      where: { id: line.stockItemId, tenantId },
    });
    if (!stockItem) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }

    if (line.qty <= 0) {
      throw new BadRequestException(CrmMessages.stock.QTY_POSITIVE_REQUIRED);
    }

    if (stockItem.trackSerials) {
      const serials = line.serialNumbers ?? [];
      if (serials.length !== Math.round(line.qty)) {
        throw new BadRequestException(CrmMessages.stock.SERIAL_REQUIRED_OUT);
      }
      const seen = new Set<string>();
      for (const raw of serials) {
        const sn = raw.trim().toUpperCase();
        if (seen.has(sn)) {
          throw new BadRequestException(
            CrmMessages.stock.SERIAL_DUPLICATE_IN_INPUT(sn),
          );
        }
        seen.add(sn);
      }
    }

    const useFifo =
      stockItem.trackLots &&
      stockItem.valuationMethod === StockValuationMethod.fifo &&
      !line.lotId;

    if (stockItem.trackLots && !line.lotId && !useFifo) {
      throw new BadRequestException(CrmMessages.stock.LOT_REQUIRED_OUT);
    }

    if (!useFifo) {
      const available = await this.getAvailableQty(
        this.prisma,
        tenantId,
        stockItem.id,
        warehouseId,
        line.lotId ?? null,
        line.locationId ?? null,
      );
      if (available < line.qty && !stockItem.allowNegativeStock && !allowPartial) {
        throw new BadRequestException(CrmMessages.stock.INSUFFICIENT_STOCK);
      }
      const qty = allowPartial ? Math.min(line.qty, available) : line.qty;
      if (qty <= 0) return [];

      let lotNumber: string | null = null;
      let unitCost = stockItem.currentCmup;
      if (line.lotId) {
        const lot = await this.prisma.stockItemLot.findFirst({
          where: { id: line.lotId, stockItemId: stockItem.id, tenantId },
        });
        if (!lot) {
          throw new NotFoundException(CrmMessages.stock.LOT_REQUIRED_OUT);
        }
        lotNumber = lot.lotNumber;
        unitCost = lot.unitCost || unitCost;
      }

      return [
        {
          stockItemId: stockItem.id,
          lotId: line.lotId ?? null,
          locationId: line.locationId ?? null,
          qty,
          unitCost,
          lotNumber,
          serialNumbers: (line.serialNumbers ?? []).map((s) =>
            s.trim().toUpperCase(),
          ),
        },
      ];
    }

    // RM-OUT02 — FIFO : plus ancien lot d'abord
    const levels = await this.prisma.stockLevel.findMany({
      where: {
        tenantId,
        stockItemId: stockItem.id,
        warehouseId,
        qtyAvailable: { gt: 0 },
        lotId: { not: null },
      },
      include: { lot: true },
      orderBy: [{ lot: { receivedDate: 'asc' } }, { updatedAt: 'asc' }],
    });

    let remaining = line.qty;
    const slices: AllocSlice[] = [];
    for (const level of levels) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, level.qtyAvailable);
      if (take <= 0) continue;
      slices.push({
        stockItemId: stockItem.id,
        lotId: level.lotId,
        locationId: level.locationId,
        qty: take,
        unitCost: level.lot?.unitCost || stockItem.currentCmup,
        lotNumber: level.lot?.lotNumber ?? null,
        serialNumbers: [],
      });
      remaining -= take;
    }

    if (remaining > 0 && !stockItem.allowNegativeStock && !allowPartial) {
      throw new BadRequestException(CrmMessages.stock.INSUFFICIENT_STOCK);
    }

    if (stockItem.trackSerials && slices.length > 0) {
      // Séries réparties sur le premier slice (saisie utilisateur globale)
      slices[0].serialNumbers = (line.serialNumbers ?? []).map((s) =>
        s.trim().toUpperCase(),
      );
    }

    void movementType;
    return slices;
  }

  private async getAvailableQty(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    stockItemId: string,
    warehouseId: string,
    lotId: string | null,
    locationId: string | null,
  ): Promise<number> {
    const where: Prisma.StockLevelWhereInput = {
      tenantId,
      stockItemId,
      warehouseId,
    };
    if (lotId) where.lotId = lotId;
    if (locationId) where.locationId = locationId;

    const agg = await db.stockLevel.aggregate({
      where,
      _sum: { qtyAvailable: true },
    });
    return agg._sum.qtyAvailable ?? 0;
  }

  private assertExitHeader(dto: CreateStockExitDto) {
    if (
      dto.movementType === StockExitTypeDto.OUT_CONSUMPTION &&
      !dto.costCenter?.trim()
    ) {
      throw new BadRequestException(CrmMessages.stock.COST_CENTER_REQUIRED);
    }
    if (
      (dto.movementType === StockExitTypeDto.OUT_LOSS ||
        dto.movementType === StockExitTypeDto.OUT_ADJUSTMENT) &&
      !dto.reason?.trim()
    ) {
      throw new BadRequestException(CrmMessages.stock.LOSS_REASON_REQUIRED);
    }
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
