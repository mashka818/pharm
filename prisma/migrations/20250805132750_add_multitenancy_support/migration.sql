-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "appId" TEXT,
ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'default.domain',
ADD COLUMN     "inn" TEXT,
ADD COLUMN     "ogrn" TEXT;

-- AlterTable
ALTER TABLE "fns_requests" ADD COLUMN     "promotionId" TEXT NOT NULL DEFAULT 'default-promotion';

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "customerId" INTEGER,
ADD COLUMN     "promotionId" TEXT NOT NULL DEFAULT 'default-promotion';

-- CreateIndex
CREATE UNIQUE INDEX "promotions_domain_key" ON "promotions"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_promotionId_key" ON "customers"("email", "promotionId");

-- AddForeignKey
ALTER TABLE "fns_requests" ADD CONSTRAINT "fns_requests_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("promotionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update existing promotions to have unique domains
UPDATE "promotions" SET "domain" = "promotionId" || '.checkpoint.rf' WHERE "domain" = 'default.domain';

-- Update existing data to use the default promotion if it doesn't exist
INSERT INTO "promotions" ("promotionId", "name", "logo", "favicon", "color", "description", "domain", "createdAt", "updatedAt")
VALUES ('default-promotion', 'Default Network', '/logos/default.png', '/favicons/default.ico', '#007bff', 'Default promotion network', 'default.checkpoint.rf', NOW(), NOW())
ON CONFLICT ("promotionId") DO NOTHING;