import { Injectable } from '@nestjs/common';
import { IntegrationEventBus } from '../../shared/events/integration-event.bus';
import {
  STOCK_ENTRY_CREATED,
  STOCK_ITEM_ARCHIVED,
  STOCK_LEVEL_UPDATED,
  StockEntryCreatedPayload,
  StockItemArchivedPayload,
  StockLevelUpdatedPayload,
} from './events/stock.events';

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

  async publishEntryCreated(
    tenantId: string,
    payload: StockEntryCreatedPayload,
  ) {
    await this.integrationBus.publish({
      eventName: STOCK_ENTRY_CREATED,
      tenantId,
      occurredAt: new Date(),
      payload,
    });
  }
}
