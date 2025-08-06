/*
  Warnings:

  - You are about to drop the `unconfirmed_products` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "unconfirmed_products" DROP CONSTRAINT "unconfirmed_products_receiptId_fkey";

-- DropTable
DROP TABLE "unconfirmed_products";

-- CreateTable
CREATE TABLE "fns_requests" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER,
    "receiptId" INTEGER,
    "qrData" JSONB NOT NULL,
    "messageId" TEXT,
    "status" "ReceiptStaus" NOT NULL DEFAULT 'pending',
    "fnsResponse" JSONB,
    "isValid" BOOLEAN,
    "isReturn" BOOLEAN,
    "isFake" BOOLEAN,
    "cashbackAmount" INTEGER,
    "cashbackAwarded" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fns_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fns_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fns_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fns_daily_limits" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fns_daily_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fns_tokens_token_key" ON "fns_tokens"("token");

-- AddForeignKey
ALTER TABLE "fns_requests" ADD CONSTRAINT "fns_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fns_requests" ADD CONSTRAINT "fns_requests_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
