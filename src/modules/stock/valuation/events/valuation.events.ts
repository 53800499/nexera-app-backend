/** §4.3 — stock.valuation_updated (Module 3 — Comptabilité, fin de mois) */

export const STOCK_VALUATION_UPDATED = 'stock.valuation_updated' as const;
/** @deprecated alias — préférer STOCK_VALUATION_UPDATED */
export const STOCK_VALUATION_COMPUTED = STOCK_VALUATION_UPDATED;

export interface StockValuationBucket {
  qty: number;
  value: number;
  count: number;
}

export interface StockValuationUpdatedPayload {
  asOf: string;
  totalValue: number;
  lineCount: number;
  warehouseId?: string | null;
  byMethod: Record<string, StockValuationBucket>;
  byWarehouse: Record<string, StockValuationBucket & { code?: string; name?: string }>;
  byCategory: Record<string, StockValuationBucket & { name?: string }>;
}
