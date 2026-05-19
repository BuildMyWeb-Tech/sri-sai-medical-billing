-- DropIndex
DROP INDEX "ProductVariant_barcode_key";

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "barcode" DROP NOT NULL;
