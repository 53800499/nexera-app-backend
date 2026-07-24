import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockAlertLevel,
  StockMovementStatus,
  StockMovementType,
  StockQualityStatus,
  StockSerialStatus,
  StockValuationMethod,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentNumberingService } from '../../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../../settings/enums/numbering-document-type.enum';
import { CrmMessages } from '../../../shared/constants/crm-messages';
import {
  CreateStockEntryDto,
  CreateStockEntryLineDto,
  StockEntryTypeDto,
} from './dto/create-stock-entry.dto';
import { StockIntegrationService } from '../stock-integration.service';
import { InventoryFreezeGuard } from '../inventory/inventory-freeze.guard';
import { toIntegrationAlertLevel } from '../events/stock.events';

const ENTRY_TYPES = new Set<string>([
  StockMovementType.IN_SUPPLIER,
  StockMovementType.IN_RETURN,
  StockMovementType.IN_PRODUCTION,
  StockMovementType.IN_ADJUSTMENT,
  StockMovementType.IN_INITIAL,
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

@Injectable()
export class StockMovementsService {
  private readonly logger = new Logger(StockMovementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: DocumentNumberingService,
    private readonly stockIntegration: StockIntegrationService,
    private readonly inventoryFreeze: InventoryFreezeGuard,
  ) {}

  async findEntries(tenantId: string) {
    return this.prisma.stockMovement.findMany({
      where: {
        tenantId,
        movementType: { in: [...ENTRY_TYPES] as StockMovementType[] },
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

  async findOne(id: string, tenantId: string) {
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id, tenantId },
      include: movementInclude,
    });
    if (!movement) {
      throw new NotFoundException(CrmMessages.stock.MOVEMENT_NOT_FOUND);
    }
    return movement;
  }

  async createEntry(
    dto: CreateStockEntryDto,
    tenantId: string,
    userId: string,
  ) {
    this.assertEntryHeader(dto);

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId, isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException(CrmMessages.stock.WAREHOUSE_NOT_FOUND);
    }

    await this.inventoryFreeze.assertNotFrozen(tenantId, dto.warehouseId);

    for (const line of dto.lines) {
      await this.assertEntryLine(line, tenantId, dto.movementType, dto.qualityStatus);
    }

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.STOCK_RECEIPT,
    );

    const qualityStatus =
      (dto.qualityStatus as StockQualityStatus | undefined) ??
      StockQualityStatus.accepted;

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
        supplierId: dto.supplierId,
        qualityStatus,
        reason: dto.reason,
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: dto.lines.map((line) => {
            const qtyActual = this.resolveQtyActual(line, qualityStatus);
            return {
              tenantId,
              stockItemId: line.stockItemId,
              locationId: line.locationId,
              qtyPlanned: line.qtyPlanned,
              qtyActual,
              unitCost: line.unitCost,
              totalCost: qtyActual * line.unitCost,
              lotNumber: line.lotNumber?.trim() || null,
              manufactureDate: line.manufactureDate
                ? new Date(line.manufactureDate)
                : null,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
              serialNumbers: (line.serialNumbers ?? []).map((s) =>
                s.trim().toUpperCase(),
              ),
            };
          }),
        },
      },
      include: movementInclude,
    });

    if (dto.validate) {
      return this.validateEntry(movement.id, tenantId, userId);
    }

    return movement;
  }

  async validateEntry(id: string, tenantId: string, userId: string) {
    const movement = await this.findOne(id, tenantId);

    if (movement.status === StockMovementStatus.validated) {
      throw new BadRequestException(CrmMessages.stock.MOVEMENT_ALREADY_VALIDATED);
    }
    if (movement.status === StockMovementStatus.cancelled) {
      throw new BadRequestException(CrmMessages.stock.MOVEMENT_CANCELLED);
    }
    if (!ENTRY_TYPES.has(movement.movementType)) {
      throw new BadRequestException(CrmMessages.stock.MOVEMENT_NOT_ENTRY);
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

        if (movement.movementType === StockMovementType.IN_INITIAL) {
          const prior = await tx.stockMovementLine.findFirst({
            where: {
              tenantId,
              stockItemId: line.stockItemId,
              movement: {
                movementType: StockMovementType.IN_INITIAL,
                status: StockMovementStatus.validated,
              },
            },
          });
          if (prior) {
            throw new BadRequestException(
              CrmMessages.stock.INITIAL_ENTRY_ONCE,
            );
          }
        }

        const qtyIn =
          movement.qualityStatus === StockQualityStatus.rejected
            ? 0
            : line.qtyActual;

        if (qtyIn <= 0) {
          await tx.stockMovementLine.update({
            where: { id: line.id },
            data: {
              qtyActual: 0,
              totalCost: 0,
              cmupBefore: stockItem.currentCmup,
              cmupAfter: stockItem.currentCmup,
            },
          });
          continue;
        }

        let lotId: string | null = line.lotId;
        if (stockItem.trackLots) {
          const lotNumber = (line.lotNumber ?? '').trim().toUpperCase();
          if (!lotNumber) {
            throw new BadRequestException(CrmMessages.stock.LOT_REQUIRED);
          }
          const existingLot = await tx.stockItemLot.findUnique({
            where: {
              stockItemId_lotNumber: {
                stockItemId: stockItem.id,
                lotNumber,
              },
            },
          });
          if (existingLot) {
            throw new BadRequestException(CrmMessages.stock.LOT_DUPLICATE);
          }
          const lot = await tx.stockItemLot.create({
            data: {
              tenantId,
              stockItemId: stockItem.id,
              lotNumber,
              manufactureDate: line.manufactureDate,
              expiryDate: line.expiryDate,
              supplierId: movement.supplierId,
              initialQty: qtyIn,
              remainingQty: qtyIn,
              unitCost: line.unitCost,
            },
          });
          lotId = lot.id;
        }

        const serialIds: string[] = [];
        if (stockItem.trackSerials) {
          const serials = line.serialNumbers ?? [];
          if (serials.length !== Math.round(qtyIn)) {
            throw new BadRequestException(
              CrmMessages.stock.SERIAL_COUNT_MISMATCH,
            );
          }
          for (const serialNumber of serials) {
            const created = await tx.stockItemSerial.create({
              data: {
                tenantId,
                stockItemId: stockItem.id,
                serialNumber: serialNumber.trim().toUpperCase(),
                lotId,
                status: StockSerialStatus.in_stock,
                warehouseId: movement.warehouseId,
                locationId: line.locationId,
              },
            });
            serialIds.push(created.id);
          }
        }

        const qtyBeforeAgg = await tx.stockLevel.aggregate({
          where: { tenantId, stockItemId: stockItem.id },
          _sum: { qtyOnHand: true },
        });
        const qtyBefore = qtyBeforeAgg._sum.qtyOnHand ?? 0;
        const cmupBefore = stockItem.currentCmup;
        let cmupAfter = cmupBefore;

        if (stockItem.valuationMethod === StockValuationMethod.cmup) {
          cmupAfter =
            qtyBefore + qtyIn === 0
              ? line.unitCost
              : (qtyBefore * cmupBefore + qtyIn * line.unitCost) /
                (qtyBefore + qtyIn);
        } else {
          cmupAfter = line.unitCost;
        }

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: { currentCmup: cmupAfter },
        });

        // RM-VAL02 — historique CMUP horodaté après chaque entrée
        if (stockItem.valuationMethod === StockValuationMethod.cmup) {
          await tx.stockCmupHistory.create({
            data: {
              tenantId,
              stockItemId: stockItem.id,
              movementId: movement.id,
              movementLineId: line.id,
              qtyBefore,
              qtyAfter: qtyBefore + qtyIn,
              cmupBefore,
              cmupAfter,
              entryQty: qtyIn,
              entryUnitCost: line.unitCost,
              recordedAt: movement.movementDate,
            },
          });
        }

        const alertLevel = this.computeAlertLevel(
          qtyBefore + qtyIn,
          stockItem.minStockQty,
          stockItem.safetyStockQty,
        );

        const existingLevel = await tx.stockLevel.findFirst({
          where: {
            tenantId,
            stockItemId: stockItem.id,
            warehouseId: movement.warehouseId,
            locationId: line.locationId ?? null,
            lotId: lotId ?? null,
          },
        });

        const unitValue = cmupAfter;
        if (existingLevel) {
          const newQty = existingLevel.qtyOnHand + qtyIn;
          await tx.stockLevel.update({
            where: { id: existingLevel.id },
            data: {
              qtyOnHand: newQty,
              qtyAvailable: newQty - existingLevel.qtyReserved,
              unitValue,
              totalValue: newQty * unitValue,
              alertLevel,
            },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              tenantId,
              stockItemId: stockItem.id,
              warehouseId: movement.warehouseId,
              locationId: line.locationId,
              lotId,
              qtyOnHand: qtyIn,
              qtyReserved: 0,
              qtyAvailable: qtyIn,
              qtyIncoming: 0,
              unitValue,
              totalValue: qtyIn * unitValue,
              alertLevel,
            },
          });
        }

        await tx.stockMovementLine.update({
          where: { id: line.id },
          data: {
            lotId,
            serialIds,
            qtyActual: qtyIn,
            totalCost: qtyIn * line.unitCost,
            cmupBefore,
            cmupAfter,
            expiryDate: line.expiryDate,
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
        const newQtyAvailable = whAgg._sum.qtyAvailable ?? 0;
        const whAlert = this.computeAlertLevel(
          newQtyAvailable,
          stockItem.minStockQty,
          stockItem.safetyStockQty,
        );

        levelUpdates.push({
          itemId: stockItem.commercialItemId,
          warehouseId: movement.warehouseId,
          newQtyAvailable,
          alertLevel: toIntegrationAlertLevel(whAlert),
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

    await this.stockIntegration.publishEntryCreated(tenantId, {
      movementId: id,
      number: movement.number,
      movementType: movement.movementType,
    });

    return this.findOne(id, tenantId);
  }

  /**
   * §4.2 — réintégration stock (IN_RETURN) suite à invoice.cancelled / credit_note.issued.
   * Idempotent sur creditNoteId (stocké dans invoiceId du mouvement).
   */
  async createReturnFromCreditNote(
    tenantId: string,
    payload: {
      creditNoteId: string;
      creditNoteNumber: string;
      originalInvoiceId: string;
      lines: Array<{ itemId?: string | null; quantity: number; description?: string }>;
      issueDate: Date | string;
    },
  ) {
    const existing = await this.prisma.stockMovement.findFirst({
      where: {
        tenantId,
        invoiceId: payload.creditNoteId,
        movementType: StockMovementType.IN_RETURN,
      },
    });
    if (existing) {
      this.logger.warn(
        `IN_RETURN already exists for credit note ${payload.creditNoteId}`,
      );
      return existing;
    }

    const originalExit = await this.prisma.stockMovement.findFirst({
      where: {
        tenantId,
        invoiceId: payload.originalInvoiceId,
        movementType: StockMovementType.OUT_SALE,
        status: StockMovementStatus.validated,
      },
      select: { warehouseId: true },
    });

    const warehouse =
      (originalExit
        ? await this.prisma.warehouse.findFirst({
            where: { id: originalExit.warehouseId, tenantId, isActive: true },
          })
        : null) ??
      (await this.prisma.warehouse.findFirst({
        where: { tenantId, isDefault: true, isActive: true },
      }));

    if (!warehouse) {
      this.logger.warn(
        `No warehouse for tenant ${tenantId} — skip IN_RETURN credit ${payload.creditNoteNumber}`,
      );
      return null;
    }

    const entryLines: CreateStockEntryLineDto[] = [];
    for (const line of payload.lines) {
      if (!line.itemId || line.quantity <= 0) continue;
      const stockItem = await this.prisma.stockItem.findFirst({
        where: { commercialItemId: line.itemId, tenantId },
      });
      if (!stockItem) continue;
      entryLines.push({
        stockItemId: stockItem.id,
        qtyPlanned: line.quantity,
        qtyActual: line.quantity,
        unitCost: stockItem.currentCmup || 0,
      });
    }

    if (entryLines.length === 0) {
      this.logger.warn(
        `credit_note ${payload.creditNoteNumber}: aucun article stock à réintégrer`,
      );
      return null;
    }

    const draft = await this.createEntry(
      {
        movementType: StockEntryTypeDto.IN_RETURN,
        warehouseId: warehouse.id,
        movementDate: new Date(payload.issueDate).toISOString(),
        reference: payload.creditNoteNumber,
        notes: `Réintégration auto avoir ${payload.creditNoteNumber} (facture ${payload.originalInvoiceId})`,
        validate: false,
        lines: entryLines,
      },
      tenantId,
      'system',
    );

    await this.prisma.stockMovement.update({
      where: { id: draft.id },
      data: { invoiceId: payload.creditNoteId },
    });

    return this.validateEntry(draft.id, tenantId, 'system');
  }

  private resolveQtyActual(
    line: CreateStockEntryLineDto,
    quality: StockQualityStatus,
  ): number {
    if (quality === StockQualityStatus.rejected) return 0;
    if (line.qtyActual !== undefined) {
      if (line.qtyActual > line.qtyPlanned) {
        throw new BadRequestException(CrmMessages.stock.QTY_ACTUAL_EXCEEDS);
      }
      return line.qtyActual;
    }
    return line.qtyPlanned;
  }

  private assertEntryHeader(dto: CreateStockEntryDto) {
    if (dto.movementType === StockEntryTypeDto.IN_ADJUSTMENT && !dto.reason?.trim()) {
      throw new BadRequestException(CrmMessages.stock.REASON_REQUIRED);
    }
  }

  private async assertEntryLine(
    line: CreateStockEntryLineDto,
    tenantId: string,
    movementType: StockEntryTypeDto,
    qualityStatus?: string,
  ) {
    if (line.qtyPlanned <= 0) {
      throw new BadRequestException(CrmMessages.stock.QTY_POSITIVE_REQUIRED);
    }
    if (line.unitCost < 0) {
      throw new BadRequestException(CrmMessages.stock.UNIT_COST_NEGATIVE);
    }

    const stockItem = await this.prisma.stockItem.findFirst({
      where: { id: line.stockItemId, tenantId },
    });
    if (!stockItem) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }

    if (stockItem.trackLots && !(line.lotNumber?.trim())) {
      throw new BadRequestException(CrmMessages.stock.LOT_REQUIRED);
    }
    if (stockItem.trackExpiry && stockItem.trackLots && !line.expiryDate) {
      throw new BadRequestException(CrmMessages.stock.EXPIRY_REQUIRED);
    }
    if (stockItem.trackSerials) {
      const accepted =
        qualityStatus === 'rejected'
          ? 0
          : (line.qtyActual ?? line.qtyPlanned);
      if (
        accepted > 0 &&
        (!line.serialNumbers ||
          line.serialNumbers.length !== Math.round(accepted))
      ) {
        throw new BadRequestException(CrmMessages.stock.SERIAL_COUNT_MISMATCH);
      }
    }

    if (line.locationId) {
      const location = await this.prisma.warehouseLocation.findFirst({
        where: { id: line.locationId, tenantId },
      });
      if (!location) {
        throw new NotFoundException(CrmMessages.stock.LOCATION_NOT_FOUND);
      }
    }

    void movementType;
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
