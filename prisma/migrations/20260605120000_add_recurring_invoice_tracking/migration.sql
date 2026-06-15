-- RM-F08 — suivi génération / notification factures récurrentes
ALTER TABLE "recurring_invoices"
ADD COLUMN IF NOT EXISTS "last_notified_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "last_generated_invoice_id" TEXT,
ADD COLUMN IF NOT EXISTS "last_generated_for_execution" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "recurring_source_id" TEXT;

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_recurring_source_id_fkey"
FOREIGN KEY ("recurring_source_id") REFERENCES "recurring_invoices"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
