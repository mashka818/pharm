/*
  Warnings:

  - Made the column `description` on table `brands` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "UnconfirmedEmail" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "description" SET NOT NULL;
