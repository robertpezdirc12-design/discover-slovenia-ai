/**
 * SEED — napolni tabelo Destination iz kanonskega dataseta (74 zapisov:
 * slovenski + balkanski register; zgodovinski komentar "38" je popravljen
 * 15. 10. 2026 — vrata berejo dejanski števec, ne komentarja).
 * Zagon: bun prisma/seed.ts (ali: bunx tsx prisma/seed.ts)
 *
 * Idempotentno: upsert po slug (ponovni zagon ne podvoji, ampak osveži).
 */

import { PrismaClient } from "@prisma/client";

import { LOKALI } from "../src/lib/lokali-data";
import { DESTINATIONS } from "../src/lib/slovenia-data";

const db = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;

  for (const d of DESTINATIONS) {
    const existing = await db.destination.findUnique({ where: { slug: d.slug } });
    const data = {
      slug: d.slug,
      name: d.name,
      tagline: d.tagline,
      region: d.region,
      type: d.type,
      country: d.country,
      lat: d.coords.lat,
      lng: d.coords.lng,
      rating: d.rating,
      description: d.description,
      image: d.image,
      featured: d.featured,
    };
    if (existing) {
      await db.destination.update({ where: { slug: d.slug }, data });
      updated++;
    } else {
      await db.destination.create({ data });
      created++;
    }
  }

  const total = await db.destination.count();
  console.log(
    `Seed DESTINATIONS: +${created} novih, ${updated} osveženih — skupaj ${total} (pričakovano ${DESTINATIONS.length}).`
  );

  // Listing (lokali) — iskreno BREZ lat/lng (koordinat v obnovljenih virih ni).
  let lCreated = 0;
  let lSkipped = 0;
  for (const x of LOKALI) {
    const existing = await db.listing.findFirst({
      where: { name: x.name, category: x.category },
    });
    if (existing) {
      await db.listing.update({
        where: { id: existing.id },
        data: {
          region: x.region,
          address: `${x.town} (natančen naslov ni del obnovljenih podatkov)`,
          lat: null,
          lng: null,
        },
      });
      lSkipped++;
    } else {
      await db.listing.create({
        data: {
          name: x.name,
          category: x.category,
          region: x.region,
          address: `${x.town} (natančen naslov ni del obnovljenih podatkov)`,
        },
      });
      lCreated++;
    }
  }
  const lTotal = await db.listing.count();
  console.log(
    `Seed LISTINGS: +${lCreated} novih, ${lSkipped} osveženih — skupaj ${lTotal} (pričakovano ${LOKALI.length}; brez koordinat — iskreno).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
