/** §4.3 — stock.inventory_closed (Module 3 — Comptabilité) */

export const STOCK_INVENTORY_CLOSED = 'stock.inventory_closed' as const;

export interface StockInventoryClosedPayload {
  sessionId: string;
  date: string;
  totalAdjustmentsValue: number;
  itemsAdjusted: number;
  number?: string;
  warehouseId?: string;
  type?: string;
  closedAt?: string;
}
