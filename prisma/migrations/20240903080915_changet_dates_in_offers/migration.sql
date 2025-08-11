/*
  Warnings:

  - Changed the type of `date_form` on the `offers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `date_to` on the `offers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "offers" DROP COLUMN "date_form",
ADD COLUMN     "date_form" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "date_to",
ADD COLUMN     "date_to" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
