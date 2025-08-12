/*
  Warnings:

  - A unique constraint covering the columns `[confirmationToken]` on the table `unconfirmed_customers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "unconfirmed_customers_confirmationToken_key" ON "unconfirmed_customers"("confirmationToken");
