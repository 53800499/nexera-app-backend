-- CreateEnum
CREATE TYPE "InvoiceNormalizationStatus" AS ENUM ('not_normalized', 'pending', 'normalized', 'failed');

-- CreateEnum
CREATE TYPE "MecefTaxGroup" AS ENUM ('A', 'B', 'C', 'D', 'E', 'F');

-- CreateEnum
CREATE TYPE "MecefAibType" AS ENUM ('NONE', 'A', 'B');

-- CreateEnum
CREATE TYPE "MecefEnvironment" AS ENUM ('sandbox', 'production');

-- AlterTable
ALTER TABLE "tax_rates" ADD COLUMN "tax_group" "MecefTaxGroup" NOT NULL DEFAULT 'B';

-- AlterTable
ALTER TABLE "invoice_lines" ADD COLUMN "tax_group" "MecefTaxGroup";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "normalization_status" "InvoiceNormalizationStatus" NOT NULL DEFAULT 'not_normalized',
ADD COLUMN "mecef_nim" TEXT,
ADD COLUMN "mecef_counters" TEXT,
ADD COLUMN "mecef_code" TEXT,
ADD COLUMN "mecef_qr_code_data" TEXT,
ADD COLUMN "mecef_tax_group_totals" JSONB,
ADD COLUMN "mecef_aib_type" "MecefAibType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "mecef_aib_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "mecef_normalized_at" TIMESTAMP(3),
ADD COLUMN "mecef_error_message" TEXT,
ADD COLUMN "original_mecef_code" TEXT;

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN "mecef_api_url" TEXT,
ADD COLUMN "mecef_api_key" TEXT,
ADD COLUMN "mecef_nim" TEXT,
ADD COLUMN "mecef_environment" "MecefEnvironment" NOT NULL DEFAULT 'sandbox',
ADD COLUMN "mecef_auto_normalize" BOOLEAN NOT NULL DEFAULT false;
