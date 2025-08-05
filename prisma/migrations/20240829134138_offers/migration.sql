/*
  Warnings:

  - You are about to drop the column `fixCashback` on the `brands` table. All the data in the column will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OfferConditionVariant" AS ENUM ('amount', 'price');

-- CreateEnum
CREATE TYPE "ProfitType" AS ENUM ('static', 'from');

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_brandId_fkey";

-- AlterTable
ALTER TABLE "brands" DROP COLUMN "fixCashback",
ADD COLUMN     "logo" TEXT;

-- DropTable
DROP TABLE "Product";

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "fixCashback" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandId" INTEGER NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" SERIAL NOT NULL,
    "profit" INTEGER NOT NULL,
    "profitType" "ProfitType" NOT NULL,
    "banner_image" TEXT NOT NULL,
    "banner_color" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date_form" TEXT NOT NULL,
    "date_to" TEXT NOT NULL,
    "offerConditionId" INTEGER NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_offers" (
    "productId" INTEGER NOT NULL,
    "offerId" INTEGER NOT NULL,

    CONSTRAINT "product_offers_pkey" PRIMARY KEY ("productId","offerId")
);

-- CreateTable
CREATE TABLE "OfferCondition" (
    "id" SERIAL NOT NULL,
    "variant" "OfferConditionVariant" NOT NULL,
    "from_value" INTEGER,
    "to_value" INTEGER,

    CONSTRAINT "OfferCondition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_offerConditionId_fkey" FOREIGN KEY ("offerConditionId") REFERENCES "OfferCondition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offers" ADD CONSTRAINT "product_offers_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
