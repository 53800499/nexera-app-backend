/** §4.3 — stock.alert_triggered (notifications) */

export const STOCK_ALERT_TRIGGERED = 'stock.alert_triggered' as const;
/** @deprecated alias — préférer STOCK_ALERT_TRIGGERED */
export const STOCK_ALERT_RAISED = STOCK_ALERT_TRIGGERED;

export const STOCK_REPLENISHMENT_APPROVED =
  'stock.replenishment.approved' as const;

export interface StockAlertTriggeredPayload {
  itemId: string;
  alertType: string;
  currentQty: number;
  thresholdQty: number | null;
  estimatedDaysToStockout: number | null;
  alertId?: string;
  stockItemId?: string;
  reference?: string;
  severity?: string;
  warehouseId?: string | null;
}

/** @deprecated */
export type StockAlertRaisedPayload = StockAlertTriggeredPayload;

export interface StockReplenishmentApprovedPayload {
  proposalId: string;
  number: string;
  stockItemId: string;
  qtyProposed: number;
}
