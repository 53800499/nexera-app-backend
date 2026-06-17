-- Cabinet / tenant type (idempotent)
DO $$ BEGIN
  CREATE TYPE "TenantType" AS ENUM ('company', 'cabinet');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "type" "TenantType" NOT NULL DEFAULT 'company';

CREATE TABLE IF NOT EXISTS "cabinet_company_access" (
    "id" TEXT NOT NULL,
    "cabinet_tenant_id" TEXT NOT NULL,
    "company_tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cabinet_company_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cabinet_company_access_cabinet_tenant_id_company_tenant_id_key" ON "cabinet_company_access"("cabinet_tenant_id", "company_tenant_id");

DO $$ BEGIN
  ALTER TABLE "cabinet_company_access" ADD CONSTRAINT "cabinet_company_access_cabinet_tenant_id_fkey" FOREIGN KEY ("cabinet_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cabinet_company_access" ADD CONSTRAINT "cabinet_company_access_company_tenant_id_fkey" FOREIGN KEY ("company_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
