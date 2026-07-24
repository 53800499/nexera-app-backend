-- CreateEnum
CREATE TYPE "InventorySessionType" AS ENUM ('total', 'partial');

-- CreateEnum
CREATE TYPE "InventorySessionStatus" AS ENUM ('draft', 'counting', 'recount', 'analyzing', 'validated', 'closed', 'cancelled');

-- AlterEnum
ALTER TYPE "NumberingDocumentType" ADD VALUE 'stock_inventory';

-- CreateTable
CREATE TABLE "inventory_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "InventorySessionType" NOT NULL,
    "status" "InventorySessionStatus" NOT NULL DEFAULT 'draft',
    "warehouse_id" TEXT NOT NULL,
    "category_id" TEXT,
    "planned_date" DATE,
    "freeze_movements" BOOLEAN NOT NULL DEFAULT true,
    "variance_threshold_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "significant_variance_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "validated_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "validated_by" TEXT,
    "closed_by" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "location_id" TEXT,
    "qty_theoretical" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_counted_1" DOUBLE PRECISION,
    "qty_counted_2" DOUBLE PRECISION,
    "qty_final" DOUBLE PRECISION,
    "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance_qty" DOUBLE PRECISION,
    "variance_value" DOUBLE PRECISION,
    "requires_recount" BOOLEAN NOT NULL DEFAULT false,
    "counted_by_1" TEXT,
    "counted_by_2" TEXT,
    "notes" TEXT,

    CONSTRAINT "inventory_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_sessions_tenant_id_status_idx" ON "inventory_sessions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "inventory_sessions_warehouse_id_status_idx" ON "inventory_sessions"("warehouse_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_sessions_tenant_id_number_key" ON "inventory_sessions"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "inventory_count_lines_session_id_idx" ON "inventory_count_lines"("session_id");

-- CreateIndex
CREATE INDEX "inventory_count_lines_tenant_id_idx" ON "inventory_count_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_movements_inventory_session_id_idx" ON "stock_movements"("inventory_session_id");

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_item_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_session_id_fkey" FOREIGN KEY ("inventory_session_id") REFERENCES "inventory_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
