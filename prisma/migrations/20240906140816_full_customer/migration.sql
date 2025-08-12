-- CreateEnum
CREATE TYPE "WithdrawalType" AS ENUM ('bank', 'phone');

-- CreateEnum
CREATE TYPE "WithdrowalStaus" AS ENUM ('pending', 'success', 'rejected');

-- CreateEnum
CREATE TYPE "ReceiptStaus" AS ENUM ('pending', 'success', 'rejected');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "bonuses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mainWithdrawalVariant" INTEGER;

-- CreateTable
CREATE TABLE "withdrawal_variants" (
    "id" SERIAL NOT NULL,
    "type" "WithdrawalType" NOT NULL,
    "iconType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,

    CONSTRAINT "withdrawal_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" SERIAL NOT NULL,
    "withdrawalVariantId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "WithdrowalStaus" NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "number" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "cashback" INTEGER NOT NULL,
    "status" "ReceiptStaus" NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unconfirmed_products" (
    "id" SERIAL NOT NULL,
    "price" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sku" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,

    CONSTRAINT "unconfirmed_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_products" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "offerId" INTEGER,
    "cashback" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,

    CONSTRAINT "receipt_products_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "withdrawal_variants" ADD CONSTRAINT "withdrawal_variants_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_withdrawalVariantId_fkey" FOREIGN KEY ("withdrawalVariantId") REFERENCES "withdrawal_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unconfirmed_products" ADD CONSTRAINT "unconfirmed_products_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_products" ADD CONSTRAINT "receipt_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_products" ADD CONSTRAINT "receipt_products_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_products" ADD CONSTRAINT "receipt_products_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
