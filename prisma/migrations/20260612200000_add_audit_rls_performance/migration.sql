-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('invoice', 'quotation', 'payment', 'order');
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'issue', 'send', 'cancel', 'record_payment', 'cancel_payment', 'convert');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_type" "AuditEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- Performance indexes (ENF listes < 1s)
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_created_at_idx" ON "invoices"("tenant_id", "createdAt");
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "quotations_tenant_id_created_at_idx" ON "quotations"("tenant_id", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_tenant_id_created_at_idx" ON "orders"("tenant_id", "createdAt");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_created_at_idx" ON "payments"("tenant_id", "createdAt");
CREATE INDEX IF NOT EXISTS "clients_tenant_id_created_at_idx" ON "clients"("tenant_id", "created_at");

-- Row-Level Security (isolation tenant — défense en profondeur)
CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS text AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '');
$$ LANGUAGE sql STABLE;

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_clients ON "clients";
CREATE POLICY tenant_isolation_clients ON "clients"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_quotations ON "quotations";
CREATE POLICY tenant_isolation_quotations ON "quotations"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_orders ON "orders";
CREATE POLICY tenant_isolation_orders ON "orders"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_invoices ON "invoices";
CREATE POLICY tenant_isolation_invoices ON "invoices"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_payments ON "payments";
CREATE POLICY tenant_isolation_payments ON "payments"
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON "audit_logs";
CREATE POLICY tenant_isolation_audit_logs ON "audit_logs"
  FOR ALL
  USING (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id())
  WITH CHECK (app_current_tenant_id() IS NULL OR "tenant_id" = app_current_tenant_id());
