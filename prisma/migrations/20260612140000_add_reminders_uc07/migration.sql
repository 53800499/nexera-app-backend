-- AlterTable
ALTER TABLE "clients" ADD COLUMN "reminders_disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN "reminders_disabled_reason" TEXT;
ALTER TABLE "clients" ADD COLUMN "blocked_for_new_orders" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "client_id" TEXT;
ALTER TABLE "reminders" ADD COLUMN "subject" TEXT;
ALTER TABLE "reminders" ADD COLUMN "cc_emails" TEXT;
ALTER TABLE "reminders" RENAME COLUMN "bodySnapshot" TO "body_snapshot";
ALTER TABLE "reminders" RENAME COLUMN "createdBy" TO "created_by";
ALTER TABLE "reminders" RENAME COLUMN "createdAt" TO "created_at";

-- Backfill client_id from invoice
UPDATE "reminders" r
SET "client_id" = i."client_id"
FROM "invoices" i
WHERE r."invoice_id" = i."id" AND r."client_id" IS NULL;

ALTER TABLE "reminders" ALTER COLUMN "client_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "reminder_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "level1_days_after_due" INTEGER NOT NULL DEFAULT 3,
    "level2_days_after_due" INTEGER NOT NULL DEFAULT 15,
    "level3_days_after_due" INTEGER NOT NULL DEFAULT 30,
    "level2_copy_commercial" BOOLEAN NOT NULL DEFAULT true,
    "level3_alert_director" BOOLEAN NOT NULL DEFAULT true,
    "level3_block_new_orders" BOOLEAN NOT NULL DEFAULT false,
    "commercial_email" TEXT,
    "director_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reminder_settings_tenant_id_key" ON "reminder_settings"("tenant_id");

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
