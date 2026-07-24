/** §4.3 — événements publiés par le module Stocks */

export const STOCK_LEVEL_UPDATED = 'stock.level_updated' as const;
export const STOCK_ITEM_ARCHIVED = 'stock.item_archived' as const;
export const STOCK_ENTRY_CREATED = 'stock.entry.created' as const;

export type IntegrationAlertLevel = 'OK' | 'WARNING' | 'CRITICAL';

export function toIntegrationAlertLevel(
  level: string | null | undefined,
): IntegrationAlertLevel {
  if (level === 'critical') return 'CRITICAL';
  if (level === 'warning') return 'WARNING';
  return 'OK';
}

/** Consommé par Module 1 — Facturation */
export interface StockLevelUpdatedPayload {
  itemId: string;
  warehouseId: string;
  newQtyAvailable: number;
  alertLevel: IntegrationAlertLevel;
  /** @deprecated alias de newQtyAvailable (compat) */
  quantity?: number;
  reference?: string;
}

export interface StockItemArchivedPayload {
  itemId: string;
  reference: string;
}

export interface StockEntryCreatedPayload {
  movementId: string;
  number: string;
  movementType: string;
}
