-- CreateEnum
CREATE TYPE "StockValuationMethod" AS ENUM ('cmup', 'fifo', 'lifo');

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "manager_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_locations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "zone" TEXT,
    "aisle" TEXT,
    "rack" TEXT,
    "bin" TEXT,
    "capacity" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "commercial_item_id" TEXT NOT NULL,
    "track_lots" BOOLEAN NOT NULL DEFAULT false,
    "track_serials" BOOLEAN NOT NULL DEFAULT false,
    "track_expiry" BOOLEAN NOT NULL DEFAULT false,
    "valuation_method" "StockValuationMethod" NOT NULL DEFAULT 'cmup',
    "storage_unit" TEXT NOT NULL,
    "conversion_factor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "min_stock_qty" DOUBLE PRECISION,
    "safety_stock_qty" DOUBLE PRECISION,
    "max_stock_qty" DOUBLE PRECISION,
    "reorder_qty" DOUBLE PRECISION,
    "default_warehouse_id" TEXT,
    "default_location_id" TEXT,
    "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "current_cmup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouses_tenant_id_idx" ON "warehouses"("tenant_id");
CREATE INDEX "warehouses_tenant_id_is_active_idx" ON "warehouses"("tenant_id", "is_active");
CREATE UNIQUE INDEX "warehouses_tenant_id_code_key" ON "warehouses"("tenant_id", "code");

CREATE INDEX "warehouse_locations_tenant_id_idx" ON "warehouse_locations"("tenant_id");
CREATE INDEX "warehouse_locations_warehouse_id_idx" ON "warehouse_locations"("warehouse_id");
CREATE UNIQUE INDEX "warehouse_locations_tenant_id_code_key" ON "warehouse_locations"("tenant_id", "code");

CREATE UNIQUE INDEX "stock_items_commercial_item_id_key" ON "stock_items"("commercial_item_id");
CREATE INDEX "stock_items_tenant_id_idx" ON "stock_items"("tenant_id");
CREATE INDEX "stock_items_tenant_id_valuation_method_idx" ON "stock_items"("tenant_id", "valuation_method");

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_commercial_item_id_fkey" FOREIGN KEY ("commercial_item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_default_warehouse_id_fkey" FOREIGN KEY ("default_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_default_location_id_fkey" FOREIGN KEY ("default_location_id") REFERENCES "warehouse_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RM-S04: coherence des seuils
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_thresholds_check" CHECK (
  ("safety_stock_qty" IS NULL OR "min_stock_qty" IS NULL OR "safety_stock_qty" <= "min_stock_qty")
  AND ("min_stock_qty" IS NULL OR "max_stock_qty" IS NULL OR "min_stock_qty" <= "max_stock_qty")
);

ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_conversion_factor_check" CHECK ("conversion_factor" > 0);

-- Row-Level Security
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouse_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_warehouses ON "warehouses";
CREATE POLICY tenant_isolation_warehouses ON "warehouses"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_warehouse_locations ON "warehouse_locations";
CREATE POLICY tenant_isolation_warehouse_locations ON "warehouse_locations"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_stock_items ON "stock_items";
CREATE POLICY tenant_isolation_stock_items ON "stock_items"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());
