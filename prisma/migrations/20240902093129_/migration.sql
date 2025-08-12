/*
  Warnings:

  - You are about to drop the column `conditionId` on the `offers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[offerId]` on the table `OfferCondition` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `offerId` to the `OfferCondition` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "OfferCondition" DROP CONSTRAINT "OfferCondition_id_fkey";

-- DropIndex
DROP INDEX "offers_conditionId_key";

-- AlterTable
ALTER TABLE "OfferCondition" ADD COLUMN     "offerId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "offers" DROP COLUMN "conditionId";

-- CreateIndex
CREATE UNIQUE INDEX "OfferCondition_offerId_key" ON "OfferCondition"("offerId");

-- AddForeignKey
ALTER TABLE "OfferCondition" ADD CONSTRAINT "OfferCondition_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
