/*
  Warnings:

  - Added the required column `address` to the `unconfirmed_customers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable

ALTER TABLE "unconfirmed_customers" ADD COLUMN "address" TEXT DEFAULT 'some address' NOT NULL;

