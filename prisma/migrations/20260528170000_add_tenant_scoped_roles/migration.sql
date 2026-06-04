-- Drop the global unique constraint on role codes
DROP INDEX IF EXISTS "roles_code_key";

-- Recreate the unique constraint per tenant
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");
