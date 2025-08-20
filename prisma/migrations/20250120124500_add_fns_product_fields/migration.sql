-- AlterTable
ALTER TABLE "receipt_products" ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable  
ALTER TABLE "receipt_products" ADD COLUMN     "fnsProductName" TEXT,
ADD COLUMN     "fnsProductPrice" INTEGER,
ADD COLUMN     "fnsProductQuantity" DECIMAL(10,3),
ADD COLUMN     "fnsProductSum" INTEGER;
