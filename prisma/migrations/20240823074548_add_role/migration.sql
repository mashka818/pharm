/*
  Warnings:

  - Added the required column `role` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "role" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "role" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "role" TEXT NOT NULL;
