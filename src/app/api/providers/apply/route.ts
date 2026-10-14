import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  PROVIDER_CATEGORIES,
  isCanonCountry,
  providerCurrency,
  providerDedupKey,
} from "@/lib/provider-model";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * /api/providers/apply — javna prijava ponudniškega profila
 * (#35 §6c.1 prijava; faza 4b — UI žica na /za-ponudnike).
 *
 * KANONI:
 *  · Prijava NIKOLI ne objavi profila: verification="claimed", status="draft" —
 *    objava je izključno skrbniška odločitev (§6c.3, admin UI faza 4b).
 *  · bookingMode je ZAKLENJEN na "none" — partner mode ŠELE po pisni
 *    odobritvi (§7 partner API-ji vse [nepotrjeno]).
 *  · Valuta NI odjemalsko polje — izpeljana iz COUNTRIES meta
 *    (providerCurrency), 10/10 držav.
 *  · Dedup kanon (§6c.5): geohash-7 + normalizirano ime → 409 pri podvajanju.
 *  · Rate limit 5/min (javno pisanje v bazo, vzorec /api/contact).
 *  · Podrobnost napake baze NE gre k odjemalcu (P0 AUDIT L1).
 *
 * ISKRENO: produkcijska Postgres tabela je materializirana ob db:pg:deploy
 * (PRODUCTION-CUTOVER varovalka) — do takrat veljaven klic vrne 500 L1
 * (potrjeno ob fazi 4a); lokalno/SQLite deluje takoj.
 */

const ApplySchema = z.object({
  name: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().toUpperCase().length(2),
  region: z.string().trim().min(2).max(80),
  place: z.string().trim().min(2).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.enum(PROVIDER_CATEGORIES),
  subcategory: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().min(10).max(1000),
  /** CSV jezikov, npr. "sl,en" — normaliziramo na strežniku. */
  languages: z.string().trim().min(2).max(60),
  officialUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^\+[0-9 ()-]{4,24}$/, "Telefon v mednarodni obliki, npr. +386 1 234 56 78.")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  priceFrom: z.number().min(0).max(100000).optional(),
});

/** Normalizacija CSV jezikov: "SL, en,,HR" → "sl,en,hr" (veljaven 2-črkovni ISO). */
function normalizeLanguages(raw: string): string | null {
  const parts = raw
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[a-z]{2}$/.test(x));
  const unique = [...new Set(parts)].slice(0, 10);
  return unique.length > 0 ? unique.join(",") : null;
}

export async function POST(request: Request) {
  if (rateLimited(request, 5)) {
    return tooManyRequests();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Neveljaven JSON v telesu zahteve." },
      { status: 400 }
    );
  }

  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Preveri polja: ime (2–120), država (2 črki), regija, kraj, koordinati, kategorija, opis (vsaj 10 znakov) in jeziki (npr. sl,en).",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const d = parsed.data;

  if (!isCanonCountry(d.countryCode)) {
    return NextResponse.json(
      { ok: false, error: "Država ni v kanonu platforme (SI/HR/ME/AL/BA/RS/MK/XK/BG/GR)." },
      { status: 400 }
    );
  }

  const languages = normalizeLanguages(d.languages);
  if (!languages) {
    return NextResponse.json(
      { ok: false, error: "Jeziki: vsaj en veljaven 2-črkovni ISO kod (npr. sl)." },
      { status: 400 }
    );
  }

  const dedupKey = providerDedupKey(d.name, d.lat, d.lng);

  try {
    const existing = await db.provider.findUnique({ where: { dedupKey }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ponudnik s tem imenom na tej lokaciji je že prijavljen (zaščita pred podvajanji). Če si lastnik profila, piši skrbniku — prijava se ne ponavlja.",
        },
        { status: 409 }
      );
    }

    const contactJson = JSON.stringify({
      phone: d.phone && d.phone.length > 0 ? d.phone : null,
      email: d.email && d.email.length > 0 ? d.email : null,
    });

    const saved = await db.provider.create({
      data: {
        countryCode: d.countryCode,
        region: d.region,
        place: d.place,
        lat: d.lat,
        lng: d.lng,
        category: d.category,
        subcategory: d.subcategory && d.subcategory.length > 0 ? d.subcategory : null,
        name: d.name,
        description: d.description,
        languages,
        contact: contactJson,
        officialUrl: d.officialUrl && d.officialUrl.length > 0 ? d.officialUrl : null,
        priceFrom: d.priceFrom ?? null,
        currency: providerCurrency(d.countryCode),
        availability: "manual",
        bookingMode: "none", // kanon: partner ŠELE po pisni odobritvi (§7)
        verification: "claimed", // prijava = zahtevek lastnika, ne resnica
        verifiedAt: null,
        status: "draft", // NIKOLI samodejna objava (§6c.3)
        sourceName: "prijava",
        sourceId: null,
        dedupKey,
      },
      select: { id: true },
    });

    return NextResponse.json(
      { ok: true, id: saved.id, status: "draft", verification: "claimed" },
      { status: 201 }
    );
  } catch {
    // P0 AUDIT L1: podrobnost napake NE gre k odjemalcu.
    return NextResponse.json(
      { ok: false, error: "Prijava trenutno ni mogoča — poskusi pozneje." },
      { status: 500 }
    );
  }
}
