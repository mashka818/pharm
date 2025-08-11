/*
  Warnings:

  - Added the required column `type` to the `OfferCondition` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OfferConditionType" AS ENUM ('from', 'to', 'from_to');

-- AlterTable
ALTER TABLE "OfferCondition" ADD COLUMN     "type" "OfferConditionType" NOT NULL;
