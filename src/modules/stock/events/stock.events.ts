export const STOCK_LEVEL_UPDATED = 'stock.level_updated' as const;
export const STOCK_ITEM_ARCHIVED = 'stock.item_archived' as const;

export interface StockLevelUpdatedPayload {
  itemId: string;
  reference: string;
  quantity: number;
}

export interface StockItemArchivedPayload {
  itemId: string;
  reference: string;
}
