/*
  Warnings:

  - Made the column `promotionId` on table `Company` required. This step will fail if there are existing NULL values in that column.
  - Made the column `promotionId` on table `Customer` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_promotionId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_promotionId_fkey";

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "promotionId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "promotionId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;
