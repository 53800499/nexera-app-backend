ALTER TABLE "cabinet_company_access"
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY['cabinet.scope.invoices.read']::TEXT[];
