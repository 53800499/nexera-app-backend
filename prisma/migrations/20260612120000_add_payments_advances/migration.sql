-- AlterTable
ALTER TABLE "payments" ADD COLUMN "exchange_rate" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "payments" ADD COLUMN "exchange_gain_loss" DOUBLE PRECISION;
ALTER TABLE "payments" ADD COLUMN "unallocated_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "client_advances" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "source_payment_id" TEXT NOT NULL,
    "original_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_applications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "advance_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_applications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_advances" ADD CONSTRAINT "client_advances_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_advances" ADD CONSTRAINT "client_advances_source_payment_id_fkey" FOREIGN KEY ("source_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_applications" ADD CONSTRAINT "advance_applications_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "client_advances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advance_applications" ADD CONSTRAINT "advance_applications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "advance_applications" ADD CONSTRAINT "advance_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
