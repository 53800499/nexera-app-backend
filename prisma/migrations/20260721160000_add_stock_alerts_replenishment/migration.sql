-- CreateEnum
CREATE TYPE "StockAlertType" AS ENUM ('shortage', 'safety', 'overstock', 'expiry', 'dormant');

-- CreateEnum
CREATE TYPE "StockAlertStatus" AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ReplenishmentProposalStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- AlterEnum
ALTER TYPE "NumberingDocumentType" ADD VALUE 'purchase_request';

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "alert_type" "StockAlertType" NOT NULL,
    "status" "StockAlertStatus" NOT NULL DEFAULT 'open',
    "severity" "StockAlertLevel" NOT NULL DEFAULT 'warning',
    "stock_item_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "lot_id" TEXT,
    "qty_on_hand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "threshold_qty" DOUBLE PRECISION,
    "days_metric" DOUBLE PRECISION,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,
    "suggested_qty" DOUBLE PRECISION,
    "fingerprint" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishment_proposals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "ReplenishmentProposalStatus" NOT NULL DEFAULT 'pending',
    "stock_item_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "alert_id" TEXT,
    "qty_proposed" DOUBLE PRECISION NOT NULL,
    "qty_configured" DOUBLE PRECISION,
    "qty_ai_suggested" DOUBLE PRECISION,
    "avg_daily_usage" DOUBLE PRECISION,
    "days_to_stockout" DOUBLE PRECISION,
    "reason" TEXT,
    "notes" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replenishment_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_alerts_tenant_id_fingerprint_key" ON "stock_alerts"("tenant_id", "fingerprint");

-- CreateIndex
CREATE INDEX "stock_alerts_tenant_id_status_alert_type_idx" ON "stock_alerts"("tenant_id", "status", "alert_type");

-- CreateIndex
CREATE INDEX "stock_alerts_stock_item_id_idx" ON "stock_alerts"("stock_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "replenishment_proposals_alert_id_key" ON "replenishment_proposals"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "replenishment_proposals_tenant_id_number_key" ON "replenishment_proposals"("tenant_id", "number");

-- CreateIndex
CREATE INDEX "replenishment_proposals_tenant_id_status_idx" ON "replenishment_proposals"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "stock_item_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_proposals" ADD CONSTRAINT "replenishment_proposals_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_proposals" ADD CONSTRAINT "replenishment_proposals_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_proposals" ADD CONSTRAINT "replenishment_proposals_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "stock_alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
