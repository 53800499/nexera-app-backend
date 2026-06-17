-- À exécuter si la migration 20260615120000 a échoué partiellement.
-- Puis : npx prisma migrate resolve --rolled-back 20260615120000_add_offline_sync
-- Puis : npx prisma migrate deploy

DROP TABLE IF EXISTS "sync_mutation_logs" CASCADE;
DROP TABLE IF EXISTS "sync_devices" CASCADE;
DROP TYPE IF EXISTS "SyncMutationStatus";
