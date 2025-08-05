-- CreateEnum
CREATE TYPE "CashbackType" AS ENUM ('percent', 'amount');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "cashbackType" "CashbackType";
