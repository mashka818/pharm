-- CreateEnum
CREATE TYPE "Roles" AS ENUM ('CUSTOMER', 'COMPANY', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "promotionId" INTEGER;

ALTER TABLE "User" ADD COLUMN "role" "Roles" NOT NULL DEFAULT 'CUSTOMER';

-- CreateTable
CREATE TABLE "Promotion" (
    "id" SERIAL NOT NULL,
    "promotionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "banner" TEXT,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_promotionId_key" ON "Promotion"("promotionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
