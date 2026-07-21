-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('draft', 'pending', 'in_transit', 'received', 'completed', 'cancelled');

-- AlterEnum
ALTER TYPE "NumberingDocumentType" ADD VALUE 'stock_transfer';

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'draft',
    "source_warehouse_id" TEXT NOT NULL,
    "dest_warehouse_id" TEXT NOT NULL,
    "planned_date" DATE,
    "shipped_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "movement_out_id" TEXT,
    "movement_in_id" TEXT,
    "shipped_by" TEXT,
    "received_by" TEXT,
    "variance_reason" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "lot_number" TEXT,
    "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_location_id" TEXT,
    "dest_location_id" TEXT,
    "qty_planned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_shipped" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_received" DOUBLE PRECISION,
    "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance_reason" TEXT,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_transfers_tenant_id_status_idx" ON "stock_transfers"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_tenant_id_number_key" ON "stock_transfers"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_transfer_id_idx" ON "stock_transfer_lines"("transfer_id");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_tenant_id_idx" ON "stock_transfer_lines"("tenant_id");

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dest_warehouse_id_fkey" FOREIGN KEY ("dest_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_item_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_dest_location_id_fkey" FOREIGN KEY ("dest_location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
