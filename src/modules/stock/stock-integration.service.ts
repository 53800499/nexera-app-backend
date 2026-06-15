import { Injectable } from '@nestjs/common';
import { IntegrationEventBus } from '../../shared/events/integration-event.bus';
import {
  STOCK_ITEM_ARCHIVED,
  STOCK_LEVEL_UPDATED,
  StockItemArchivedPayload,
  StockLevelUpdatedPayload,
} from './events/stock.events';

/**
 * Point d'entrée simulant le module Stock (§6.3) — publie les événements stock.*.
 */
@Injectable()
export class StockIntegrationService {
  constructor(private readonly integrationBus: IntegrationEventBus) {}

  async publishLevelUpdated(
    tenantId: string,
    payload: StockLevelUpdatedPayload,
  ) {
    await this.integrationBus.publish({
      eventName: STOCK_LEVEL_UPDATED,
      tenantId,
      occurredAt: new Date(),
      payload,
    });
  }

  async publishItemArchived(
    tenantId: string,
    payload: StockItemArchivedPayload,
  ) {
    await this.integrationBus.publish({
      eventName: STOCK_ITEM_ARCHIVED,
      tenantId,
      occurredAt: new Date(),
      payload,
    });
  }
}
