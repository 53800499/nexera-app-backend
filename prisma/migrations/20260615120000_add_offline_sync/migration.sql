-- Offline sync tables (idempotent)
DO $$ BEGIN
  CREATE TYPE "SyncMutationStatus" AS ENUM ('applied', 'conflict', 'rejected', 'duplicate');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sync_devices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT,
    "last_pull_at" TIMESTAMP(3),
    "last_push_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sync_mutation_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "mutation_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entity_id" TEXT,
    "status" "SyncMutationStatus" NOT NULL,
    "error_code" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_mutation_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_devices_tenant_id_user_id_device_id_key" ON "sync_devices"("tenant_id", "user_id", "device_id");

CREATE UNIQUE INDEX IF NOT EXISTS "sync_mutation_logs_tenant_id_device_id_mutation_id_key" ON "sync_mutation_logs"("tenant_id", "device_id", "mutation_id");

CREATE INDEX IF NOT EXISTS "sync_mutation_logs_tenant_id_device_id_batch_id_idx" ON "sync_mutation_logs"("tenant_id", "device_id", "batch_id");
