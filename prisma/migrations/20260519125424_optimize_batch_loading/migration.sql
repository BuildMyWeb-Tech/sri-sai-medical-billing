-- CreateIndex
CREATE INDEX "ProductBatch_productId_expiryDate_idx" ON "ProductBatch"("productId", "expiryDate");

-- CreateIndex
CREATE INDEX "ProductBatch_remainingQty_expiryDate_idx" ON "ProductBatch"("remainingQty", "expiryDate");

-- CreateIndex
CREATE INDEX "ProductBatch_batchNumber_idx" ON "ProductBatch"("batchNumber");
