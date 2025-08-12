/*
  Warnings:

  - You are about to drop the column `offerConditionId` on the `offers` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[conditionId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `brands` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "offers" DROP CONSTRAINT "offers_offerConditionId_fkey";

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "offers" DROP COLUMN "offerConditionId",
ADD COLUMN     "conditionId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "offers_conditionId_key" ON "offers"("conditionId");

-- AddForeignKey
ALTER TABLE "OfferCondition" ADD CONSTRAINT "OfferCondition_id_fkey" FOREIGN KEY ("id") REFERENCES "offers"("conditionId") ON DELETE RESTRICT ON UPDATE CASCADE;
