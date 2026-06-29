-- Code d'invitation cabinet (opaque, rotatable) — ne pas exposer l'UUID tenant.
ALTER TABLE "tenants" ADD COLUMN "cabinet_invite_code" TEXT;

CREATE UNIQUE INDEX "tenants_cabinet_invite_code_key" ON "tenants"("cabinet_invite_code");
