/*
  Warnings:

  - Added the required column `promotionId` to the `offers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `promotionId` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "promotionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "promotionId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;
