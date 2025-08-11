-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_promotionId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_promotionId_fkey";

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "promotionId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "promotionId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("promotionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("promotionId") ON DELETE SET NULL ON UPDATE CASCADE;
