/*
  Warnings:

  - You are about to drop the column `offerId` on the `OfferCondition` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[conditionId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "OfferCondition" DROP CONSTRAINT "OfferCondition_offerId_fkey";

-- DropIndex
DROP INDEX "OfferCondition_offerId_key";

-- AlterTable
ALTER TABLE "OfferCondition" DROP COLUMN "offerId";

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "conditionId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "offers_conditionId_key" ON "offers"("conditionId");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "OfferCondition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
