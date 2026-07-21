import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockAlertLevel,
  StockMovementStatus,
  StockMovementType,
  StockSerialStatus,
  StockTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../settings/enums/numbering-document-type.enum';
import { CrmMessages } from '../../shared/constants/crm-messages';
import {
  CreateStockTransferDto,
  CreateStockTransferLineDto,
  ReceiveStockTransferDto,
} from './dto/create-stock-transfer.dto';
import { StockIntegrationService } from './stock-integration.service';

const transferInclude = {
  sourceWarehouse: { select: { id: true, code: true, name: true } },
  destWarehouse: { select: { id: true, code: true, name: true } },
  lines: {
    include: {
      stockItem: {
        include: {
          commercialItem: {
            select: { id: true, reference: true, name: true, unit: true },
          },
        },
      },
      lot: true,
      sourceLocation: { select: { id: true, code: true } },
      destLocation: { select: { id: true, code: true } },
    },
  },
} satisfies Prisma.StockTransferInclude;

@Injectable()
export class StockTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: DocumentNumberingService,
    private readonly stockIntegration: StockIntegrationService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.stockTransfer.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceWarehouse: { select: { id: true, code: true, name: true } },
        destWarehouse: { select: { id: true, code: true, name: true } },
        lines: {
          select: {
            id: true,
            qtyPlanned: true,
            qtyShipped: true,
            qtyReceived: true,
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
    const transfer = await this.prisma.stockTransfer.findFirst({
      where: { id, tenantId },
      include: transferInclude,
    });
    if (!transfer) {
      throw new NotFoundException(CrmMessages.stock.TRANSFER_NOT_FOUND);
    }
    return transfer;
  }

  async create(dto: CreateStockTransferDto, tenantId: string, userId: string) {
    if (dto.sourceWarehouseId === dto.destWarehouseId) {
      throw new BadRequestException(CrmMessages.stock.TRANSFER_SAME_WAREHOUSE);
    }

    const [source, dest] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: dto.sourceWarehouseId, tenantId, isActive: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.destWarehouseId, tenantId, isActive: true },
      }),
    ]);
    if (!source || !dest) {
      throw new NotFoundException(CrmMessages.stock.WAREHOUSE_NOT_FOUND);
    }

    for (const line of dto.lines) {
      await this.assertTransferLine(line, tenantId, dto.sourceWarehouseId, dto.destWarehouseId);
    }

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.STOCK_TRANSFER,
    );

    const transfer = await this.prisma.stockTransfer.create({
      data: {
        tenantId,
        number,
        status: StockTransferStatus.draft,
        sourceWarehouseId: dto.sourceWarehouseId,
        destWarehouseId: dto.destWarehouseId,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        notes: dto.notes,
        createdBy: userId,
        lines: {
          create: await Promise.all(
            dto.lines.map(async (line) => {
              const stockItem = await this.prisma.stockItem.findFirstOrThrow({
                where: { id: line.stockItemId, tenantId },
              });
              let lotNumber: string | null = null;
              if (line.lotId) {
                const lot = await this.prisma.stockItemLot.findFirst({
                  where: { id: line.lotId, tenantId, stockItemId: line.stockItemId },
                });
                lotNumber = lot?.lotNumber ?? null;
              }
              return {
                tenantId,
                stockItemId: line.stockItemId,
                lotId: line.lotId,
                lotNumber,
                serialNumbers: (line.serialNumbers ?? []).map((s) =>
                  s.trim().toUpperCase(),
                ),
                sourceLocationId: line.sourceLocationId,
                destLocationId: line.destLocationId,
                qtyPlanned: line.qty,
                qtyShipped: 0,
                unitCost: stockItem.currentCmup,
              };
            }),
          ),
        },
      },
      include: transferInclude,
    });

    return transfer;
  }

  /** Brouillon → En attente départ */
  async submit(id: string, tenantId: string) {
    const transfer = await this.findOne(id, tenantId);
    if (transfer.status !== StockTransferStatus.draft) {
      throw new BadRequestException(CrmMessages.stock.TRANSFER_INVALID_STATUS);
    }
    return this.prisma.stockTransfer.update({
      where: { id },
      data: { status: StockTransferStatus.pending },
      include: transferInclude,
    });
  }

  /**
   * Validation émetteur / expédition : stock source diminué → IN_TRANSIT.
   * Accepté depuis draft ou pending.
   */
  async ship(id: string, tenantId: string, userId: string) {
    const transfer = await this.findOne(id, tenantId);
    if (
      transfer.status !== StockTransferStatus.draft &&
      transfer.status !== StockTransferStatus.pending
    ) {
      throw new BadRequestException(CrmMessages.stock.TRANSFER_ALREADY_SHIPPED);
    }

    const levelUpdates: Array<{
      commercialItemId: string;
      reference: string;
      quantity: number;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      const outNumber = await this.numberingService.generateNext(
        tenantId,
        NumberingDocumentType.STOCK_ISSUE,
        tx,
      );

      const movementOut = await tx.stockMovement.create({
        data: {
          tenantId,
          number: outNumber,
          movementType: StockMovementType.TRANSFER_OUT,
          status: StockMovementStatus.validated,
          warehouseId: transfer.sourceWarehouseId,
          movementDate: new Date(),
          transferId: transfer.id,
          reference: transfer.number,
          approvedBy: userId,
          approvedAt: new Date(),
          notes: `Transfert ${transfer.number} — sortie source`,
          createdBy: userId,
          lines: {
            create: transfer.lines.map((line) => ({
              tenantId,
              stockItemId: line.stockItemId,
              lotId: line.lotId,
              lotNumber: line.lotNumber,
              locationId: line.sourceLocationId,
              serialNumbers: line.serialNumbers,
              qtyPlanned: line.qtyPlanned,
              qtyActual: line.qtyPlanned,
              unitCost: line.unitCost,
              totalCost: line.qtyPlanned * line.unitCost,
            })),
          },
        },
        include: { lines: true },
      });

      for (const line of transfer.lines) {
        const stockItem = await tx.stockItem.findFirst({
          where: { id: line.stockItemId, tenantId },
          include: { commercialItem: true },
        });
        if (!stockItem) {
          throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
        }

        const qtyOut = line.qtyPlanned;
        if (qtyOut <= 0) continue;

        const available = await this.getAvailableQty(
          tx,
          tenantId,
          stockItem.id,
          transfer.sourceWarehouseId,
          line.lotId,
          line.sourceLocationId,
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
          for (const sn of serials) {
            const serial = await tx.stockItemSerial.findFirst({
              where: {
                tenantId,
                stockItemId: stockItem.id,
                serialNumber: sn.trim().toUpperCase(),
                status: StockSerialStatus.in_stock,
              },
            });
            if (!serial) {
              throw new BadRequestException(
                CrmMessages.stock.SERIAL_NOT_IN_STOCK,
              );
            }
            await tx.stockItemSerial.update({
              where: { id: serial.id },
              data: { status: StockSerialStatus.transferred },
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
            warehouseId: transfer.sourceWarehouseId,
            locationId: line.sourceLocationId ?? null,
            lotId: line.lotId ?? null,
          },
        });

        const unitCost = line.unitCost || stockItem.currentCmup;

        if (level) {
          const newQty = level.qtyOnHand - qtyOut;
          await tx.stockLevel.update({
            where: { id: level.id },
            data: {
              qtyOnHand: newQty,
              qtyAvailable: newQty - level.qtyReserved,
              unitValue: unitCost,
              totalValue: Math.max(newQty, 0) * unitCost,
              alertLevel: this.computeAlertLevel(
                Math.max(newQty - level.qtyReserved, 0),
                stockItem.minStockQty,
                stockItem.safetyStockQty,
              ),
            },
          });
        } else if (!stockItem.allowNegativeStock) {
          throw new BadRequestException(CrmMessages.stock.INSUFFICIENT_STOCK);
        }

        const movLine = movementOut.lines.find(
          (l) =>
            l.stockItemId === line.stockItemId &&
            l.lotId === line.lotId &&
            l.locationId === line.sourceLocationId,
        );
        if (movLine) {
          await tx.stockMovementLine.update({
            where: { id: movLine.id },
            data: {
              serialIds,
              unitCost,
              totalCost: qtyOut * unitCost,
              cmupBefore: stockItem.currentCmup,
              cmupAfter: stockItem.currentCmup,
            },
          });
        }

        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: { qtyShipped: qtyOut, unitCost },
        });

        const totalOnHand = await tx.stockLevel.aggregate({
          where: { tenantId, stockItemId: stockItem.id },
          _sum: { qtyOnHand: true },
        });
        levelUpdates.push({
          commercialItemId: stockItem.commercialItemId,
          reference: stockItem.commercialItem.reference,
          quantity: totalOnHand._sum.qtyOnHand ?? 0,
        });
      }

      await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.in_transit,
          shippedAt: new Date(),
          shippedBy: userId,
          movementOutId: movementOut.id,
        },
      });
    });

    for (const update of levelUpdates) {
      await this.stockIntegration.publishLevelUpdated(tenantId, {
        itemId: update.commercialItemId,
        reference: update.reference,
        quantity: update.quantity,
      });
    }

    return this.findOne(id, tenantId);
  }

  /** Confirmation récepteur : stock destination ↑ → COMPLETED (écarts enregistrés). */
  async receive(
    id: string,
    dto: ReceiveStockTransferDto,
    tenantId: string,
    userId: string,
  ) {
    const transfer = await this.findOne(id, tenantId);
    if (transfer.status !== StockTransferStatus.in_transit) {
      throw new BadRequestException(CrmMessages.stock.TRANSFER_NOT_IN_TRANSIT);
    }

    const receiveMap = new Map(dto.lines.map((l) => [l.lineId, l]));
    let hasVariance = false;

    for (const line of transfer.lines) {
      const recv = receiveMap.get(line.id);
      if (!recv) {
        throw new BadRequestException(
          `Quantité reçue manquante pour la ligne ${line.id}`,
        );
      }
      if (recv.qtyReceived !== line.qtyShipped) {
        hasVariance = true;
        const reason =
          recv.varianceReason?.trim() || dto.varianceReason?.trim();
        if (!reason) {
          throw new BadRequestException(
            CrmMessages.stock.TRANSFER_VARIANCE_REASON_REQUIRED,
          );
        }
      }
    }

    const levelUpdates: Array<{
      commercialItemId: string;
      reference: string;
      quantity: number;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      const inNumber = await this.numberingService.generateNext(
        tenantId,
        NumberingDocumentType.STOCK_RECEIPT,
        tx,
      );

      const movementIn = await tx.stockMovement.create({
        data: {
          tenantId,
          number: inNumber,
          movementType: StockMovementType.TRANSFER_IN,
          status: StockMovementStatus.validated,
          warehouseId: transfer.destWarehouseId,
          movementDate: new Date(),
          transferId: transfer.id,
          reference: transfer.number,
          approvedBy: userId,
          approvedAt: new Date(),
          notes: `Transfert ${transfer.number} — entrée destination`,
          createdBy: userId,
          lines: {
            create: transfer.lines.map((line) => {
              const recv = receiveMap.get(line.id)!;
              const destLoc =
                recv.destLocationId ?? line.destLocationId ?? undefined;
              return {
                tenantId,
                stockItemId: line.stockItemId,
                lotId: line.lotId,
                lotNumber: line.lotNumber,
                locationId: destLoc,
                serialNumbers: line.serialNumbers,
                qtyPlanned: line.qtyShipped,
                qtyActual: recv.qtyReceived,
                unitCost: line.unitCost,
                totalCost: recv.qtyReceived * line.unitCost,
              };
            }),
          },
        },
        include: { lines: true },
      });

      for (const line of transfer.lines) {
        const recv = receiveMap.get(line.id)!;
        const qtyIn = recv.qtyReceived;
        const destLocationId =
          recv.destLocationId ?? line.destLocationId ?? null;

        const stockItem = await tx.stockItem.findFirst({
          where: { id: line.stockItemId, tenantId },
          include: { commercialItem: true },
        });
        if (!stockItem) {
          throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
        }

        if (stockItem.trackSerials && qtyIn > 0) {
          const serials = line.serialNumbers.slice(0, Math.round(qtyIn));
          for (const sn of serials) {
            const serial = await tx.stockItemSerial.findFirst({
              where: {
                tenantId,
                stockItemId: stockItem.id,
                serialNumber: sn.trim().toUpperCase(),
                status: StockSerialStatus.transferred,
              },
            });
            if (serial) {
              await tx.stockItemSerial.update({
                where: { id: serial.id },
                data: {
                  status: StockSerialStatus.in_stock,
                  warehouseId: transfer.destWarehouseId,
                  locationId: destLocationId,
                },
              });
            }
          }
          // Séries non reçues (écart) : restent transferred / ou scrapped
          if (qtyIn < line.qtyShipped) {
            const lost = line.serialNumbers.slice(Math.round(qtyIn));
            for (const sn of lost) {
              const serial = await tx.stockItemSerial.findFirst({
                where: {
                  tenantId,
                  stockItemId: stockItem.id,
                  serialNumber: sn.trim().toUpperCase(),
                  status: StockSerialStatus.transferred,
                },
              });
              if (serial) {
                await tx.stockItemSerial.update({
                  where: { id: serial.id },
                  data: { status: StockSerialStatus.scrapped },
                });
              }
            }
          }
        }

        if (line.lotId && qtyIn > 0) {
          await tx.stockItemLot.update({
            where: { id: line.lotId },
            data: { remainingQty: { increment: qtyIn } },
          });
        }

        if (qtyIn > 0) {
          const existingLevel = await tx.stockLevel.findFirst({
            where: {
              tenantId,
              stockItemId: stockItem.id,
              warehouseId: transfer.destWarehouseId,
              locationId: destLocationId,
              lotId: line.lotId ?? null,
            },
          });

          const unitValue = line.unitCost || stockItem.currentCmup;
          if (existingLevel) {
            const newQty = existingLevel.qtyOnHand + qtyIn;
            await tx.stockLevel.update({
              where: { id: existingLevel.id },
              data: {
                qtyOnHand: newQty,
                qtyAvailable: newQty - existingLevel.qtyReserved,
                unitValue,
                totalValue: newQty * unitValue,
                alertLevel: this.computeAlertLevel(
                  newQty - existingLevel.qtyReserved,
                  stockItem.minStockQty,
                  stockItem.safetyStockQty,
                ),
              },
            });
          } else {
            await tx.stockLevel.create({
              data: {
                tenantId,
                stockItemId: stockItem.id,
                warehouseId: transfer.destWarehouseId,
                locationId: destLocationId,
                lotId: line.lotId,
                qtyOnHand: qtyIn,
                qtyReserved: 0,
                qtyAvailable: qtyIn,
                unitValue,
                totalValue: qtyIn * unitValue,
                alertLevel: this.computeAlertLevel(
                  qtyIn,
                  stockItem.minStockQty,
                  stockItem.safetyStockQty,
                ),
              },
            });
          }
        }

        const varianceReason =
          recv.qtyReceived !== line.qtyShipped
            ? recv.varianceReason?.trim() || dto.varianceReason?.trim() || null
            : null;

        await tx.stockTransferLine.update({
          where: { id: line.id },
          data: {
            qtyReceived: qtyIn,
            destLocationId,
            varianceReason,
          },
        });

        const totalOnHand = await tx.stockLevel.aggregate({
          where: { tenantId, stockItemId: stockItem.id },
          _sum: { qtyOnHand: true },
        });
        levelUpdates.push({
          commercialItemId: stockItem.commercialItemId,
          reference: stockItem.commercialItem.reference,
          quantity: totalOnHand._sum.qtyOnHand ?? 0,
        });
      }

      await tx.stockTransfer.update({
        where: { id },
        data: {
          status: StockTransferStatus.completed,
          receivedAt: new Date(),
          receivedBy: userId,
          movementInId: movementIn.id,
          varianceReason: hasVariance
            ? dto.varianceReason?.trim() ||
              dto.lines.find((l) => l.varianceReason?.trim())?.varianceReason ||
              null
            : null,
          notes: dto.notes?.trim()
            ? [transfer.notes, dto.notes.trim()].filter(Boolean).join('\n')
            : transfer.notes,
        },
      });
    });

    for (const update of levelUpdates) {
      await this.stockIntegration.publishLevelUpdated(tenantId, {
        itemId: update.commercialItemId,
        reference: update.reference,
        quantity: update.quantity,
      });
    }

    return this.findOne(id, tenantId);
  }

  /** Annulation avant expédition uniquement. */
  async cancel(id: string, tenantId: string) {
    const transfer = await this.findOne(id, tenantId);
    if (
      transfer.status !== StockTransferStatus.draft &&
      transfer.status !== StockTransferStatus.pending
    ) {
      throw new BadRequestException(
        CrmMessages.stock.TRANSFER_CANCEL_AFTER_SHIP,
      );
    }
    return this.prisma.stockTransfer.update({
      where: { id },
      data: { status: StockTransferStatus.cancelled },
      include: transferInclude,
    });
  }

  private async assertTransferLine(
    line: CreateStockTransferLineDto,
    tenantId: string,
    sourceWarehouseId: string,
    destWarehouseId: string,
  ) {
    const stockItem = await this.prisma.stockItem.findFirst({
      where: { id: line.stockItemId, tenantId },
    });
    if (!stockItem) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }
    if (line.qty <= 0) {
      throw new BadRequestException(CrmMessages.stock.QTY_POSITIVE_REQUIRED);
    }
    if (stockItem.trackLots && !line.lotId) {
      throw new BadRequestException(CrmMessages.stock.LOT_REQUIRED_OUT);
    }
    if (stockItem.trackSerials) {
      const serials = line.serialNumbers ?? [];
      if (serials.length !== Math.round(line.qty)) {
        throw new BadRequestException(CrmMessages.stock.SERIAL_COUNT_MISMATCH);
      }
    }
    if (line.sourceLocationId) {
      const loc = await this.prisma.warehouseLocation.findFirst({
        where: {
          id: line.sourceLocationId,
          tenantId,
          warehouseId: sourceWarehouseId,
        },
      });
      if (!loc) {
        throw new BadRequestException(
          CrmMessages.stock.LOCATION_WAREHOUSE_MISMATCH,
        );
      }
    }
    if (line.destLocationId) {
      const loc = await this.prisma.warehouseLocation.findFirst({
        where: {
          id: line.destLocationId,
          tenantId,
          warehouseId: destWarehouseId,
        },
      });
      if (!loc) {
        throw new BadRequestException(
          CrmMessages.stock.LOCATION_WAREHOUSE_MISMATCH,
        );
      }
    }
  }

  private async getAvailableQty(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    stockItemId: string,
    warehouseId: string,
    lotId: string | null | undefined,
    locationId: string | null | undefined,
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
