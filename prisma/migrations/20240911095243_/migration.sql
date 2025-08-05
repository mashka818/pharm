/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `withdrawal_variants` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "withdrawal_variants_title_key" ON "withdrawal_variants"("title");
