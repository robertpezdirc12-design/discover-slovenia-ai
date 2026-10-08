/**
 * MARKETPLACE-SEED — izdelki lastne tržnice, izpeljani IZKLJUČNO iz
 * realnih polj kanonskega nabora (iskrenostni kanon: NIČ izmišljenih cen).
 *
 * Viri (samo za branje):
 *  - src/lib/trznica-data.ts — SUPPLY_SHELVES skupina "own" (lastna tržnica)
 *    + OWN_PRODUCTS: imena izkušenj iz dejanskih aktivnosti destinacij;
 *  - src/lib/slovenia-data.ts — DESTINATIONS: costPerPerson → priceCents ×100.
 *
 * Seed je IDEMPOTENTEN (upsert po slug) in ob ponovnem zagonu NE povrne
 * zaloge/števca prodaje (sta operativni stanji, ne referenčna podatka).
 */

import { db } from "@/lib/db";
import { getDestination } from "@/lib/slovenia-data";
import { OWN_PRODUCTS } from "@/lib/trznica-data";

/** Koliko izdelkov iz own police v celoti prevzamemo v tržnico. */
const MARKETPLACE_SEED_LIMIT = 8;

/** Začasna začetna zaloga izdelka (naš operativni inventar, ne vir resnice). */
const INITIAL_STOCK = 20;

export interface SeededProduct {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  kind: string;
  stock: number;
}

/**
 * Sestavi definicije izdelkov iz own police: ime/opis iz OWN_PRODUCTS
 * (aktivnosti destinacij), cena IZKLJUČNO iz DESTINATIONS.costPerPerson.
 * Vnosi brez veljavne destinacije/cene se iskreno preskočijo.
 */
export function buildMarketplaceSeed(): SeededProduct[] {
  const defs: SeededProduct[] = [];
  for (const own of OWN_PRODUCTS) {
    if (defs.length >= MARKETPLACE_SEED_LIMIT) break;
    const dest = getDestination(own.destinationSlug);
    if (!dest) continue;
    const cost = dest.costPerPerson;
    if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) {
      continue;
    }
    defs.push({
      slug: own.id,
      name: own.name.sl,
      description: own.description.sl,
      priceCents: Math.round(cost * 100),
      kind: own.kind,
      stock: INITIAL_STOCK,
    });
  }
  return defs;
}

/**
 * Idempotenten seed tržnice (upsert po slug). Ob obstoječem zapisu se
 * osvežijo SAMO referenčni podatki (ime/opis/cena/vrsta/aktiven) —
 * zaloga in saleCount sta operativni stanji in se NE povrjeta.
 *
 * @returns število obdelanih (ustvarjenih ali osveženih) izdelkov.
 */
export async function seedMarketplaceProducts(): Promise<number> {
  const defs = buildMarketplaceSeed();
  for (const def of defs) {
    await db.product.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        description: def.description,
        priceCents: def.priceCents,
        kind: def.kind,
        stock: def.stock,
        active: true,
        // Platforminski (seed) izdelki so uredniško pregledani po definiciji —
        // partnerjevi vnosi gredo NAMENOMA skozi moderacijo (P0-H §22).
        status: "published",
      },
      update: {
        name: def.name,
        description: def.description,
        priceCents: def.priceCents,
        kind: def.kind,
        active: true,
      },
    });
  }
  return defs.length;
}

/**
 * Sej tržnico SAMO če je tabela prazna (prvi GET /api/products).
 * Nikoli se ne zažene ob vsakem zagonu strežnika.
 *
 * @returns število novo-sejanih izdelkov (0 če tabela že ima vsebino).
 */
export async function seedMarketplaceProductsIfEmpty(): Promise<number> {
  const existing = await db.product.count();
  if (existing > 0) return 0;
  return seedMarketplaceProducts();
}

/**
 * ENKRATNA SELITEV P0-H (idempotentna): obstoječi platforminski izdelki
 * (ownerId = null, še na privzetem "draft" iz pred-P0-H obdobja) prestavimo
 * na "published" — njihova vsebina je uredniška, nikoli partnerjeva.
 * Partnerjevih vnosov (ownerId != null) NIKOLI ne dotaknemo. Uporabno tudi
 * ob prihodnjem produkcijskem cutoverju (issue #2) z obstoječo bazo.
 */
export async function migratePreP0hPlatformProductsToPublished(): Promise<number> {
  const res = await db.product.updateMany({
    where: { ownerId: null, status: "draft" },
    data: { status: "published" },
  });
  return res.count;
}
