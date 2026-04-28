/*
  Warnings:

  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "mrp" SET DEFAULT 0,
ALTER COLUMN "images" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "category" SET DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "StoreSize" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreSize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreSize_storeId_idx" ON "StoreSize"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSize_storeId_label_key" ON "StoreSize"("storeId", "label");

-- AddForeignKey
ALTER TABLE "StoreSize" ADD CONSTRAINT "StoreSize_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
