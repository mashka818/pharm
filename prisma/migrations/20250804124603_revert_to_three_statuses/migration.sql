/*
  Warnings:

  - The values [processing,failed] on the enum `ReceiptStaus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReceiptStaus_new" AS ENUM ('pending', 'success', 'rejected');
ALTER TABLE "fns_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "receipts" ALTER COLUMN "status" TYPE "ReceiptStaus_new" USING ("status"::text::"ReceiptStaus_new");
ALTER TABLE "fns_requests" ALTER COLUMN "status" TYPE "ReceiptStaus_new" USING ("status"::text::"ReceiptStaus_new");
ALTER TYPE "ReceiptStaus" RENAME TO "ReceiptStaus_old";
ALTER TYPE "ReceiptStaus_new" RENAME TO "ReceiptStaus";
DROP TYPE "ReceiptStaus_old";
ALTER TABLE "fns_requests" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;
