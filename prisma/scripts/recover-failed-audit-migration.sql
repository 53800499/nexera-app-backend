-- À exécuter une seule fois si la migration 20260612200000 a échoué en cours de route.
-- Puis : npx prisma migrate resolve --rolled-back 20260612200000_add_audit_rls_performance
-- Puis : npx prisma migrate deploy

DROP INDEX IF EXISTS "invoices_tenant_id_created_at_idx";
DROP INDEX IF EXISTS "invoices_tenant_id_status_idx";
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TYPE IF EXISTS "AuditEntityType";
DROP TYPE IF EXISTS "AuditAction";
