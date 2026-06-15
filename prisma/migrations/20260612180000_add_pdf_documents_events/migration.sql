-- CreateEnum
CREATE TYPE "PdfLayoutType" AS ENUM ('classic', 'modern', 'minimal');

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN "legal_name" TEXT,
ADD COLUMN "trade_name" TEXT,
ADD COLUMN "siret" TEXT,
ADD COLUMN "vat_number" TEXT,
ADD COLUMN "registration_number" TEXT,
ADD COLUMN "share_capital" TEXT,
ADD COLUMN "company_address" JSONB,
ADD COLUMN "company_phone" TEXT,
ADD COLUMN "company_email" TEXT,
ADD COLUMN "company_website" TEXT,
ADD COLUMN "accepted_payment_methods" TEXT,
ADD COLUMN "cgv_text" TEXT;

-- AlterTable
ALTER TABLE "pdf_templates" ADD COLUMN "secondary_color" TEXT NOT NULL DEFAULT '#6b7280',
ADD COLUMN "layout_type" "PdfLayoutType" NOT NULL DEFAULT 'classic',
ADD COLUMN "show_page_numbers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "terms_and_conditions" TEXT;

-- AlterTable
ALTER TABLE "catalog_items" ADD COLUMN "stock_quantity" DOUBLE PRECISION DEFAULT 0;

-- CreateTable
CREATE TABLE "document_access_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_tracking" (
    "id" TEXT NOT NULL,
    "tracking_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_access_tokens_token_key" ON "document_access_tokens"("token");

-- CreateIndex
CREATE INDEX "document_access_tokens_token_idx" ON "document_access_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "email_tracking_tracking_id_key" ON "email_tracking"("tracking_id");
