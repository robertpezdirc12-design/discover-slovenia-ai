import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { seedMarketplaceProductsIfEmpty } from "@/lib/marketplace-seed";

export const dynamic = "force-dynamic";

/**
 * /api/products — JAVNI seznam izdelkov lastne tržnice.
 *
 * Od P0-H (§22 moderacija): javno so VIDNI SAMO objavljeni izdelki
 * (status "published" AND active) — partnerjevi osnutki, predaje in
 * zavrnjeni vnosi javnosti niso vidni.
 *
 * Ob PRVEM klicu (prazna tabela) sproži idempotenten seed: izdelki
 * izpeljani IZKLJUČNO iz realnih polj kanonskega nabora (ime
 * aktivnosti + costPerPerson destinacije — nič izmišljenih cen).
 * Seed se ne ponavlja ob vsakem zagonu (count > 0 → preskoči).
 *
 * Odgovor: { products: [{ slug, name, description, priceCents, kind,
 * stock, saleCount }] }
 */
export async function GET() {
  try {
    await seedMarketplaceProductsIfEmpty();
  } catch (err) {
    // Seed ni uspel (npr. tek z drugo transakcijo) — seznam vseeno
    // poskusimo vrniti; če je baza zares nedosegljiva, pade spodaj.
    console.error("[api/products] seed tržnice ni uspel:", err);
  }

  try {
    const products = await db.product.findMany({
      where: { active: true, status: "published" },
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        name: true,
        description: true,
        priceCents: true,
        kind: true,
        stock: true,
        saleCount: true,
      },
    });
    return NextResponse.json({ products });
  } catch (err) {
    console.error("[api/products] branje izdelkov ni uspelo:", err);
    return NextResponse.json(
      { error: "Tržnica trenutno ni dosegljiva." },
      { status: 500 }
    );
  }
}
