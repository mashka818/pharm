-- CreateEnum
CREATE TYPE "CustomerNotificationType" AS ENUM ('receipt_scanned', 'receipt_processing', 'receipt_approved', 'receipt_rejected', 'cashback_awarded', 'cashback_cancelled', 'cashback_confirmed', 'ticket_approved', 'ticket_rejected', 'bonuses_added', 'bonuses_deducted');

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" TEXT NOT NULL,
    "type" "CustomerNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "relatedEntityId" TEXT,
    "relatedEntityType" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_notifications_customerId_idx" ON "customer_notifications"("customerId");

-- CreateIndex
CREATE INDEX "customer_notifications_isRead_idx" ON "customer_notifications"("isRead");

-- CreateIndex
CREATE INDEX "customer_notifications_createdAt_idx" ON "customer_notifications"("createdAt");

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

