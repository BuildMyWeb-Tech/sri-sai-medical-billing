// fix-variant-ids.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.productBatch.findMany({
    select: { id: true, variantId: true },
  });

  let fixed = 0;
  for (const batch of batches) {
    if (!batch.variantId) continue;
    const clean = String(batch.variantId).split('_')[0];
    if (clean !== batch.variantId) {
      await prisma.productBatch.update({
        where: { id: batch.id },
        data: { variantId: clean },
      });
      console.log(`Fixed batch ${batch.id}: ${batch.variantId} → ${clean}`);
      fixed++;
    }
  }
  console.log(`Done. Fixed ${fixed} of ${batches.length} batches.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());