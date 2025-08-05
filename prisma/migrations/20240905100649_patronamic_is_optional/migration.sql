-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "patronymic" DROP NOT NULL;

-- AlterTable
ALTER TABLE "unconfirmed_customers" ALTER COLUMN "patronymic" DROP NOT NULL;
