/**
 * SEED DEMO RAČUNA (48-a) — demo@discover-slovenia.ai / slovenija2026.
 *
 * Geslo je javno namenjeno preizkusu in je IZRECNO označeno kot demo v UI
 * na /prijava (iskrenostni kanon). Geslo se shrani izključno kot scrypt-hash.
 *
 * Zagon: bun prisma/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

const DEMO_EMAIL = "demo@discover-slovenia.ai";
const DEMO_NAME = "Demo Popotnik";
const DEMO_PASSWORD = "slovenija2026";

async function main() {
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log(`Demo račun že obstaja: ${DEMO_EMAIL} (id ${existing.id}) — nič ni spremenjeno.`);
    return;
  }
  const user = await db.user.create({
    data: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash: hashPassword(DEMO_PASSWORD),
    },
  });
  console.log(`Demo račun ustvarjen: ${DEMO_EMAIL} (id ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
