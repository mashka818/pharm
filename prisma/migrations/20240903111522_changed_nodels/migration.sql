/*
  Warnings:

  - You are about to drop the column `date_form` on the `offers` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `products` table. All the data in the column will be lost.
  - Added the required column `date_from` to the `offers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "offers" DROP COLUMN "date_form",
ADD COLUMN     "date_from" TIMESTAMP(3) NOT NULL default CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "price";
