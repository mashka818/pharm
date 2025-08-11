/*
  Warnings:

  - Changed the type of `role` on the `Admin` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `role` on the `Company` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `role` on the `Customer` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('COMPANY');

-- CreateEnum
CREATE TYPE "CustomerRole" AS ENUM ('CUSTOMER');

-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "role",
ADD COLUMN     "role" "AdminRole" NOT NULL;

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "role",
ADD COLUMN     "role" "CompanyRole" NOT NULL;

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "role",
ADD COLUMN     "role" "CustomerRole" NOT NULL;
