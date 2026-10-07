/**
 * SUPPLY REGISTRY — register zmožnosti 19 ponudnikov (P0-B, issue #1).
 *
 * RECOVER + RECONCILE: naslednik registra izvirnika
 * (src/lib/supply/registry.ts, 16 ponudnikov, izgubljen ob varnostnem
 * incidentu 2026-10-06). Ta register je DEJANSTVA O ZMOŽNOSTIH — kaj
 * posamezen ponudnik ponuja, kakšna je vrsta dostopa in katera stanja
 * cen podpira. Življenjski cikel (kaj je živo danes) živi v
 * production-matrix.ts; mehanski izpeljek stanj v activation-check.ts.
 *
 * RECONCILE z 2.x resnico (16 izvirnikovih + 3 novi):
 *  · izvirnikovih 16: fsq, osm, sto, kiwitaxi, viator, getyourguide,
 *    tiqets, booking, skyscanner, airalo, travelpayouts, discovercars,
 *    omio, worldnomads, safetywing, own
 *  · novi po vzorcu MindTrip (2.5.0): kiwi (leti — naslednik SkyScanner
 *    vrzeli v booking plasti), rentalcars (najem — naslednik DiscoverCars
 *    zasnove), osm-fuel (bencinske črpalke, odprti podatki, 0 % provizije)
 *
 * KANONI:
 *  · ISKRENOST — zmožnost ≠ razpoložljivost: register opisuje, KAJ bi
 *    ponudnik lahko ponudil; ali to živi danes, odloča izključno matrika.
 *  · KANONSKA STANJA CEN — LIVE_PRICE (lastna živa cena) / FROM_PRICE
 *    (objavljena „od"-cena vira — NI živ citat) / UNKNOWN (cena se vidi
 *    šele pri partnerju) / NOT_SUPPORTED (plast cen izrecno ni podprta).
 *  · ČISTA LOGIKA — brez process.env, brez db, brez stranskih učinkov.
 */

// ── Vrsta dostopa do ponudnika ─────────────────────────────────────────────

export type SupplyAccessType =
  | "open-data" // odprti podatki (lokalna množica)
  | "open-data-live" // odprti podatki (žive poizvedbe)
  | "static-content" // statična vsebina (RAG vir)
  | "partner-feed" // partnerjev objavljeni feed (CSV)
  | "affiliate-deeplink" // affiliate globoka povezava (/go, /api/affiliate/go)
  | "api" // partnerski API (ključ/žeton)
  | "own-marketplace"; // lastna tržnica (direktni booking)

// ── Kanonska stanja cen (P0-A §B: „RECONCILE v enoten model") ─────────────

export type SupplyPriceState =
  | "LIVE_PRICE" // lastna živa cena (npr. lastna tržnica)
  | "FROM_PRICE" // objavljena „od"-cena vira — znana, NI živ citat
  | "UNKNOWN" // cena se pokaže šele pri partnerju (globoka povezava)
  | "NOT_SUPPORTED"; // plast cen izrecno ni podprta

export const SUPPLY_PRICE_STATE_LABELS: Record<SupplyPriceState, string> = {
  LIVE_PRICE: "Živa cena",
  FROM_PRICE: "Objavljena od-cena (ni živ citat)",
  UNKNOWN: "Cena šele pri partnerju",
  NOT_SUPPORTED: "Cene niso podprte",
};

// ── Kategorije ponudb ──────────────────────────────────────────────────────

export type SupplyCategory =
  | "discovery" // odkrivanje krajev/POI
  | "content" // uradna turistična vsebina
  | "transfers" // transferji (zasebni)
  | "stays" // nastanitve
  | "experiences" // izkušnje/izleti
  | "flights" // letalske karte
  | "car" // najem avtov
  | "transport" // medkrajevni transport (vlaki/avtobusi)
  | "tickets" // vstopnice
  | "esim" // eSIM podatki
  | "insurance" // popotniško zavarovanje
  | "fuel" // bencinske črpalke (odprti podatki)
  | "marketplace"; // lastna tržnica

// ── Identitete ponudnikov (kanonski id-ji) ─────────────────────────────────
//
// Id-ji so usklajeni z:
//  · /go hub registrom (src/lib/go-data.ts — GoProvider.slug izvirnika),
//  · affiliate registrom (src/lib/affiliate-providers.ts — 2.5.0+),
// kar testno zaklenejo cross-ref preverbe v tests/supply-activation.test.ts.

export type SupplyProviderId =
  // — odkritovalna in vsebinska plast (izvirnik, obnova P0-C) —
  | "fsq"
  | "osm"
  | "sto"
  | "kiwitaxi"
  // — rezervacijski partnerji (2.5.0+ affiliate register) —
  | "booking"
  | "getyourguide"
  | "kiwi"
  | "rentalcars"
  | "omio"
  // — odprta goriva plast (2.5.0, izrecno brez provizije) —
  | "osm-fuel"
  // — lastna tržnica —
  | "own"
  // — /go partnerji izvirnika (vsebina živa, providerska plast čaka) —
  | "viator"
  | "tiqets"
  | "skyscanner"
  | "airalo"
  | "travelpayouts"
  | "discovercars"
  | "worldnomads"
  | "safetywing";

// ── Registrski vnos ────────────────────────────────────────────────────────

export interface ProviderCapabilities {
  id: SupplyProviderId;
  /** Javno ime ponudnika. */
  name: string;
  /** Kaj ponudnik ponuja (kategorije). */
  categories: readonly SupplyCategory[];
  /** Vrsta dostopa. */
  accessType: SupplyAccessType;
  /** Katero kanonsko stanje cen ta vir podpira. */
  priceState: SupplyPriceState;
  /** Uradna dokumentacija vira (trditve vežejo na vir). */
  docsUrl?: string;
}

/** Iskren opis zmožnosti — brez življenjskega cikla (ta živi v matriki). */
export const SUPPLY_REGISTRY: readonly ProviderCapabilities[] = Object.freeze([
  {
    id: "fsq",
    name: "Foursquare Open Places",
    categories: ["discovery"],
    accessType: "open-data",
    priceState: "NOT_SUPPORTED",
    docsUrl: "https://docs.foursquare.com/data-products/open-places",
  },
  {
    id: "osm",
    name: "OpenStreetMap (Overpass)",
    categories: ["discovery"],
    accessType: "open-data-live",
    priceState: "NOT_SUPPORTED",
    docsUrl: "https://wiki.openstreetmap.org/wiki/Overpass_API",
  },
  {
    id: "sto",
    name: "Slovenska turistična organizacija (slovenia.info)",
    categories: ["content"],
    accessType: "static-content",
    priceState: "NOT_SUPPORTED",
  },
  {
    id: "kiwitaxi",
    name: "KiwiTaxi",
    categories: ["transfers"],
    accessType: "partner-feed",
    priceState: "FROM_PRICE",
    docsUrl: "https://kiwitaxi.com/en/partner/webmaster/instructions/api",
  },
  {
    id: "booking",
    name: "Booking.com",
    categories: ["stays"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://developers.booking.com/demand/docs",
  },
  {
    id: "getyourguide",
    name: "GetYourGuide",
    categories: ["experiences"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://github.com/getyourguide/partner-api-spec",
  },
  {
    id: "kiwi",
    name: "Kiwi.com",
    categories: ["flights"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
  },
  {
    id: "rentalcars",
    name: "Rentalcars.com",
    categories: ["car"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
  },
  {
    id: "omio",
    name: "Omio",
    categories: ["transport"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://www.omio.com/affiliate",
  },
  {
    id: "osm-fuel",
    name: "Bencinske črpalke (OSM, ODbL)",
    categories: ["fuel"],
    accessType: "open-data",
    priceState: "NOT_SUPPORTED",
  },
  {
    id: "own",
    name: "Lastna tržnica",
    categories: ["marketplace", "stays", "experiences"],
    accessType: "own-marketplace",
    priceState: "LIVE_PRICE",
  },
  {
    id: "viator",
    name: "Viator (Tripadvisor)",
    categories: ["experiences"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://docs.viator.com/partner-api/technical/",
  },
  {
    id: "tiqets",
    name: "Tiqets",
    categories: ["tickets"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://developers.tiqets.dev",
  },
  {
    id: "skyscanner",
    name: "Skyscanner",
    categories: ["flights"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://developers.skyscanner.net/docs/intro",
  },
  {
    id: "airalo",
    name: "Airalo",
    categories: ["esim"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://developers.partners.airalo.com",
  },
  {
    id: "travelpayouts",
    name: "Travelpayouts",
    categories: ["flights"],
    accessType: "api",
    priceState: "UNKNOWN",
    docsUrl:
      "https://support.travelpayouts.com/hc/en-us/categories/200358578-API-and-data",
  },
  {
    id: "discovercars",
    name: "DiscoverCars",
    categories: ["car"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://www.discovercars.com/affiliate",
  },
  {
    id: "worldnomads",
    name: "World Nomads",
    categories: ["insurance"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://partner.worldnomads.com",
  },
  {
    id: "safetywing",
    name: "SafetyWing",
    categories: ["insurance"],
    accessType: "affiliate-deeplink",
    priceState: "UNKNOWN",
    docsUrl: "https://safetywing.com/ambassador",
  },
]);

/** Vsi kanonski id-ji (izpeljani iz registra — en sam vir resnice). */
export const SUPPLY_PROVIDER_IDS: readonly SupplyProviderId[] =
  Object.freeze(SUPPLY_REGISTRY.map((p) => p.id));

/** Zmožnosti ponudnika po id (undefined za neznane — nikoli izjema). */
export function getProviderCapabilities(
  id: string
): ProviderCapabilities | undefined {
  return SUPPLY_REGISTRY.find((p) => p.id === id);
}

/** Število ponudnikov po kategoriji (iskrena agregacija za izpise). */
export function countByCategory(): Record<SupplyCategory, number> {
  const out = {} as Record<SupplyCategory, number>;
  for (const p of SUPPLY_REGISTRY) {
    for (const c of p.categories) out[c] = (out[c] ?? 0) + 1;
  }
  return out;
}
