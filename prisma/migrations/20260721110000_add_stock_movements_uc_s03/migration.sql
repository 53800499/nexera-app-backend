-- AlterEnum
ALTER TYPE "NumberingDocumentType" ADD VALUE IF NOT EXISTS 'stock_receipt';

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM (
  'IN_SUPPLIER', 'IN_RETURN', 'IN_PRODUCTION', 'IN_ADJUSTMENT', 'IN_INITIAL',
  'OUT_SALE', 'OUT_CONSUMPTION', 'OUT_LOSS', 'OUT_RETURN_SUPPLIER', 'OUT_ADJUSTMENT',
  'TRANSFER_OUT', 'TRANSFER_IN'
);
CREATE TYPE "StockMovementStatus" AS ENUM ('draft', 'validated', 'cancelled');
CREATE TYPE "StockQualityStatus" AS ENUM ('accepted', 'partial', 'rejected');
CREATE TYPE "StockSerialStatus" AS ENUM ('in_stock', 'sold', 'transferred', 'scrapped');
CREATE TYPE "StockAlertLevel" AS ENUM ('ok', 'warning', 'critical');

-- CreateTable
CREATE TABLE "stock_item_lots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "lot_number" TEXT NOT NULL,
    "manufacture_date" DATE,
    "expiry_date" DATE,
    "received_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_id" TEXT,
    "initial_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remaining_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_quarantine" BOOLEAN NOT NULL DEFAULT false,
    "quarantine_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_item_lots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_item_serials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "lot_id" TEXT,
    "status" "StockSerialStatus" NOT NULL DEFAULT 'in_stock',
    "warehouse_id" TEXT,
    "location_id" TEXT,
    "received_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sold_invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_item_serials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "location_id" TEXT,
    "lot_id" TEXT,
    "qty_on_hand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_available" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_incoming" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alert_level" "StockAlertLevel" NOT NULL DEFAULT 'ok',
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "status" "StockMovementStatus" NOT NULL DEFAULT 'draft',
    "warehouse_id" TEXT NOT NULL,
    "movement_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "invoice_id" TEXT,
    "transfer_id" TEXT,
    "inventory_session_id" TEXT,
    "supplier_id" TEXT,
    "quality_status" "StockQualityStatus",
    "reason" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movement_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "movement_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "lot_id" TEXT,
    "serial_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location_id" TEXT,
    "qty_planned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qty_actual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cmup_before" DOUBLE PRECISION,
    "cmup_after" DOUBLE PRECISION,
    "expiry_date" DATE,
    "lot_number" TEXT,
    "manufacture_date" DATE,
    "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "stock_movement_lines_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "stock_item_lots_stock_item_id_lot_number_key" ON "stock_item_lots"("stock_item_id", "lot_number");
CREATE INDEX "stock_item_lots_tenant_id_idx" ON "stock_item_lots"("tenant_id");
CREATE INDEX "stock_item_lots_expiry_date_idx" ON "stock_item_lots"("expiry_date");

CREATE UNIQUE INDEX "stock_item_serials_stock_item_id_serial_number_key" ON "stock_item_serials"("stock_item_id", "serial_number");
CREATE INDEX "stock_item_serials_tenant_id_idx" ON "stock_item_serials"("tenant_id");

CREATE INDEX "stock_levels_tenant_id_stock_item_id_warehouse_id_idx" ON "stock_levels"("tenant_id", "stock_item_id", "warehouse_id");
CREATE INDEX "stock_levels_tenant_id_alert_level_idx" ON "stock_levels"("tenant_id", "alert_level");
CREATE INDEX "stock_levels_stock_item_id_lot_id_idx" ON "stock_levels"("stock_item_id", "lot_id");

CREATE UNIQUE INDEX "stock_movements_tenant_id_number_key" ON "stock_movements"("tenant_id", "number");
CREATE INDEX "stock_movements_tenant_id_movement_type_movement_date_idx" ON "stock_movements"("tenant_id", "movement_type", "movement_date");
CREATE INDEX "stock_movements_invoice_id_idx" ON "stock_movements"("invoice_id");

CREATE INDEX "stock_movement_lines_movement_id_idx" ON "stock_movement_lines"("movement_id");
CREATE INDEX "stock_movement_lines_stock_item_id_lot_id_idx" ON "stock_movement_lines"("stock_item_id", "lot_id");
CREATE INDEX "stock_movement_lines_tenant_id_idx" ON "stock_movement_lines"("tenant_id");

-- FKs
ALTER TABLE "stock_item_lots" ADD CONSTRAINT "stock_item_lots_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_item_serials" ADD CONSTRAINT "stock_item_serials_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_item_serials" ADD CONSTRAINT "stock_item_serials_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_item_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_item_serials" ADD CONSTRAINT "stock_item_serials_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_item_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "stock_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_item_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_item_lots" ADD CONSTRAINT "stock_item_lots_dates_check" CHECK ("expiry_date" IS NULL OR "manufacture_date" IS NULL OR "expiry_date" >= "manufacture_date");
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_qty_check" CHECK ("qty_planned" >= 0 AND "qty_actual" >= 0 AND "unit_cost" >= 0);

-- RLS
ALTER TABLE "stock_item_lots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_item_serials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movement_lines" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_stock_item_lots ON "stock_item_lots"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_isolation_stock_item_serials ON "stock_item_serials"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_isolation_stock_levels ON "stock_levels"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_isolation_stock_movements ON "stock_movements"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());
CREATE POLICY tenant_isolation_stock_movement_lines ON "stock_movement_lines"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());
