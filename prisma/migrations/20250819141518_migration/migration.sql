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
