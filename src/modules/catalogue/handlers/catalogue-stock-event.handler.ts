import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OrderStatus as PrismaOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import {
  STOCK_ITEM_ARCHIVED,
  STOCK_LEVEL_UPDATED,
  StockItemArchivedPayload,
  StockLevelUpdatedPayload,
} from '../../stock/events/stock.events';

@Injectable()
export class CatalogueStockEventHandler implements OnModuleInit {
  private readonly logger = new Logger(CatalogueStockEventHandler.name);

  constructor(
    private readonly integrationBus: IntegrationEventBus,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.integrationBus.subscribe<StockLevelUpdatedPayload>(
      STOCK_LEVEL_UPDATED,
      (event) => this.onStockLevelUpdated(event.tenantId, event.payload),
    );
    this.integrationBus.subscribe<StockItemArchivedPayload>(
      STOCK_ITEM_ARCHIVED,
      (event) => this.onStockItemArchived(event.tenantId, event.payload),
    );
  }

  /** §6.3 — Met à jour la disponibilité affichée sur la fiche article. */
  private async onStockLevelUpdated(
    tenantId: string,
    payload: StockLevelUpdatedPayload,
  ) {
    await this.prisma.catalogItem.updateMany({
      where: { tenantId, id: payload.itemId },
      data: { stockQuantity: payload.quantity },
    });
    this.logger.log(
      `[catalogue] stock.level_updated item=${payload.reference} qty=${payload.quantity}`,
    );
  }

  /** §6.3 — Alerte si l'article est encore utilisé dans des devis/BC ouverts. */
  private async onStockItemArchived(
    tenantId: string,
    payload: StockItemArchivedPayload,
  ) {
    const [openQuotations, openOrders] = await Promise.all([
      this.prisma.quotationLine.findMany({
        where: {
          tenantId,
          itemId: payload.itemId,
          quotation: { status: { in: ['draft', 'sent', 'accepted'] } },
        },
        select: { quotationId: true },
        take: 5,
      }),
      this.prisma.orderLine.findMany({
        where: {
          tenantId,
          itemId: payload.itemId,
          order: {
            status: {
              in: [
                PrismaOrderStatus.draft,
                PrismaOrderStatus.confirmed,
                PrismaOrderStatus.partially_paid,
              ],
            },
          },
        },
        select: { orderId: true },
        take: 5,
      }),
    ]);

    if (openQuotations.length > 0 || openOrders.length > 0) {
      this.logger.warn(
        `[catalogue] ALERTE stock.item_archived — article ${payload.reference} ` +
          `encore présent dans ${openQuotations.length} devis et ${openOrders.length} BC ouverts`,
      );
    }

    await this.prisma.catalogItem.updateMany({
      where: { tenantId, id: payload.itemId },
      data: { isArchived: true },
    });
  }
}
