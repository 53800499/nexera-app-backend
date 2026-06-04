/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,code]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "clients_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenant_id_code_key" ON "clients"("tenant_id", "code");
