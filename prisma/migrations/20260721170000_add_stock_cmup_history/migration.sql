-- CreateTable
CREATE TABLE "stock_cmup_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "movement_id" TEXT,
    "movement_line_id" TEXT,
    "qty_before" DOUBLE PRECISION NOT NULL,
    "qty_after" DOUBLE PRECISION NOT NULL,
    "cmup_before" DOUBLE PRECISION NOT NULL,
    "cmup_after" DOUBLE PRECISION NOT NULL,
    "entry_qty" DOUBLE PRECISION NOT NULL,
    "entry_unit_cost" DOUBLE PRECISION NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_cmup_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_cmup_history_tenant_id_stock_item_id_recorded_at_idx" ON "stock_cmup_history"("tenant_id", "stock_item_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "stock_cmup_history" ADD CONSTRAINT "stock_cmup_history_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
