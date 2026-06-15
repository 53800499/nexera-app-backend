-- CreateEnum
CREATE TYPE "NumberingDocumentType" AS ENUM ('quotation', 'order_draft', 'order_issued', 'invoice_draft', 'invoice_issued', 'client', 'catalog_item');
CREATE TYPE "EmailTemplateType" AS ENUM ('quotation_send', 'invoice_send', 'reminder_level_1', 'reminder_level_2', 'reminder_level_3', 'recurring_invoice');
CREATE TYPE "ExchangeRateSource" AS ENUM ('manual', 'api');

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "primary_currency" TEXT NOT NULL DEFAULT 'EUR',
    "exchange_rate_source" "ExchangeRateSource" NOT NULL DEFAULT 'manual',
    "late_payment_penalty_rate" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "late_payment_penalty_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_currencies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "manual_rate" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_numbering_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_type" "NumberingDocumentType" NOT NULL,
    "prefix" TEXT NOT NULL,
    "suffix" TEXT,
    "separator" TEXT NOT NULL DEFAULT '-',
    "draft_marker" TEXT,
    "include_year" BOOLEAN NOT NULL DEFAULT true,
    "counter_length" INTEGER NOT NULL DEFAULT 6,
    "annual_reset" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_numbering_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#1a56db',
    "font_family" TEXT NOT NULL DEFAULT 'Helvetica',
    "header_text" TEXT,
    "footer_text" TEXT,
    "legal_mentions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");
CREATE UNIQUE INDEX "tenant_currencies_tenant_id_code_key" ON "tenant_currencies"("tenant_id", "code");
CREATE UNIQUE INDEX "document_numbering_rules_tenant_id_document_type_key" ON "document_numbering_rules"("tenant_id", "document_type");
CREATE UNIQUE INDEX "email_templates_tenant_id_type_key" ON "email_templates"("tenant_id", "type");
CREATE UNIQUE INDEX "pdf_templates_tenant_id_key" ON "pdf_templates"("tenant_id");
