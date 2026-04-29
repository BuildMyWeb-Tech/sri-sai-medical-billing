-- AlterTable
ALTER TABLE "Category" ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "image" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_isDeleted_idx" ON "Product"("isDeleted");
