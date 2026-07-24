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
import {
  STOCK_INVENTORY_CLOSED,
  StockInventoryClosedPayload,
} from './inventory/events/inventory.events';
import {
  STOCK_ALERT_TRIGGERED,
  StockAlertTriggeredPayload,
} from './alerts/events/alerts.events';
import {
  STOCK_VALUATION_UPDATED,
  StockValuationUpdatedPayload,
} from './valuation/events/valuation.events';

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
      payload: {
        ...payload,
        quantity: payload.newQtyAvailable,
      },
    });
  }

  async publishAlertTriggered(
    tenantId: string,
    payload: StockAlertTriggeredPayload,
  ) {
    await this.integrationBus.publish({
      eventName: STOCK_ALERT_TRIGGERED,
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

  async publishInventoryClosed(
    tenantId: string,
    payload: StockInventoryClosedPayload,
  ) {
    await this.integrationBus.publish({
      eventName: STOCK_INVENTORY_CLOSED,
      tenantId,
      occurredAt: new Date(),
      payload,
    });
  }

  async publishValuationUpdated(
    tenantId: string,
    payload: StockValuationUpdatedPayload,
  ) {
    await this.integrationBus.publish({
      eventName: STOCK_VALUATION_UPDATED,
      tenantId,
      occurredAt: new Date(),
      payload,
    });
  }
}
