-- CreateEnum
CREATE TYPE "public"."CashbackStatus" AS ENUM ('active', 'cancelled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ReceiptStaus" ADD VALUE 'processing';
ALTER TYPE "public"."ReceiptStaus" ADD VALUE 'failed';

-- AlterTable
ALTER TABLE "public"."fns_requests" ALTER COLUMN "promotionId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."promotions" ALTER COLUMN "domain" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."receipts" ALTER COLUMN "promotionId" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."cashbacks" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "receiptId" INTEGER,
    "fnsRequestId" TEXT,
    "promotionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "public"."CashbackStatus" NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "cancelledBy" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cashback_items" (
    "id" SERIAL NOT NULL,
    "cashbackId" INTEGER NOT NULL,
    "productId" INTEGER,
    "offerId" INTEGER,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "quantity" INTEGER NOT NULL,
    "itemPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "cashbackAmount" INTEGER NOT NULL,
    "cashbackType" "public"."CashbackType" NOT NULL,
    "cashbackRate" INTEGER,

    CONSTRAINT "cashback_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."cashbacks" ADD CONSTRAINT "cashbacks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashbacks" ADD CONSTRAINT "cashbacks_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashbacks" ADD CONSTRAINT "cashbacks_fnsRequestId_fkey" FOREIGN KEY ("fnsRequestId") REFERENCES "public"."fns_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashbacks" ADD CONSTRAINT "cashbacks_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."promotions"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashbacks" ADD CONSTRAINT "cashbacks_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "public"."admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashback_items" ADD CONSTRAINT "cashback_items_cashbackId_fkey" FOREIGN KEY ("cashbackId") REFERENCES "public"."cashbacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashback_items" ADD CONSTRAINT "cashback_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cashback_items" ADD CONSTRAINT "cashback_items_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
