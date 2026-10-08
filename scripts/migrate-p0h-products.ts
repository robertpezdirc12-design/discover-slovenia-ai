/**
 * SELITEV P0-H — enkratna (idempotentna) selitev obstoječih platforminskih
 * izdelkov na status "published" (uvod statusnega stroja moderacije).
 *
 * Baza pred P0-H ni poznala stolpca status; privzeta vrednost "draft" bi
 * obstoječo (uredniško pregledano) tržnico skrila. Ta skripta prestavi
 * SAMO platforminske izdelke (ownerId = null) s privzetega "draft" na
 * "published". Partnerjevih vnosov (ownerId != null) nikoli ne dotakne —
 * tisti gredo skozi moderacijo.
 *
 * Zagon: bun run migrate:p0h  (ali: bunx tsx scripts/migrate-p0h-products.ts)
 * Uporabno tudi ob prihodnjem produkcijskem cutoverju (issue #2).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.product.updateMany({
    where: { ownerId: null, status: "draft" },
    data: { status: "published" },
  });
  console.log(
    `[migrate-p0h] Na "published" prestavljenih platforminskih izdelkov: ${res.count}`
  );
  const partnerDrafts = await prisma.product.count({
    where: { ownerId: { not: null } },
  });
  console.log(
    `[migrate-p0h] Partnerjevih izdelkov (nedotaknjeno, lastnikovih): ${partnerDrafts}`
  );
}

main()
  .catch((err) => {
    console.error("[migrate-p0h] Napaka:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
