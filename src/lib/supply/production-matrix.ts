/**
 * PRODUCTION-MATRIX — strojno berljiva matrika življenjskega cikla (P0-B).
 *
 * RECOVER: naslednik src/lib/supply/production-matrix.ts izvirnika
 * (izgubljen ob varnostnem incidentu 2026-10-06). Stanja so izpeljana
 * MEHANSKO iz te matrike (glej activation-check.ts) — nikoli ročno
 * zapisana, da se ne more zgoditi, da bi dokument trdil nekaj drugega
 * kot koda.
 *
 * ŠTIRI STANJA (kanon izvirnika):
 *  · ACTIVE         — deluje zdaj
 *  · CONFIGURED     — koda živa, a namerno stopnja nižje (čaka dokaz)
 *  · NOT_CONFIGURED — aktivacija je v naših rokah (env / obnova / register)
 *  · BLOCKED        — zunanja ovira (odobritev partnerja / pogodba)
 *
 * RAZSEŽNOSTI VSKEGA VNOSA:
 *  · codeStatus — kje je koda te integracije danes (2.x resnica)
 *  · gate       — kaj odklepa aktivacijo
 *  · envKeys    — env spremenljivke (preverba SAMO Boolean prisotnosti;
 *                 vrednosti se NIKOLI ne izpišejo — kanarček v testih)
 *
 * KANON ISKRENOSTI: affiliate preusmeritev ≠ inventar. Vrstice, ki
 * čakajo na odobritev partnerja, so BLOCKED — ne morejo postati ACTIVE
 * zgolj z env nastavitvijo. CODE_READY ≠ PRODUCTION_ACTIVE.
 */

import type { SupplyProviderId } from "./registry";
import type { GoRouteSlug } from "../go-data";
import type { AffiliateProviderId } from "../affiliate-providers";

// ── Kje je koda te integracije danes ───────────────────────────────────────

export type MatrixCodeStatus =
  /** Integracija deluje v rekonstrukciji 2.x (koda na mainu). */
  | "LIVE"
  /** Vsebinska podstran /go je živa; providerska plast (povezava/API) čaka. */
  | "CONTENT_LIVE"
  /** Obnova načrtovana (P0-C/P0-D) — spec v arhivu, koda na mrtvem računu. */
  | "PENDING_RESTORE";

// ── Kaj odklepa aktivacijo ─────────────────────────────────────────────────

export type ActivationGate =
  /** Odprti podatki / brez aktivacije. */
  | "none"
  /** Samo env spremenljivke (Boolean prisotnost). */
  | "env"
  /** Odobritev partnerja (API program / affiliate program). */
  | "partner-approval"
  /** Pogodba (B4B ipd.). */
  | "contract"
  /** Dokaz v produkciji (namerno zadržana eskalacija). */
  | "production-proof"
  /** Prvo obnova sloja (P0-x), šele nato aktivacija. */
  | "restore"
  /** Koda sloja je obnovljena; čaka PODATKOVNI VIR (dataset/feed). */
  | "data";

// ── Vnos matrike ───────────────────────────────────────────────────────────

export interface ProviderMatrixEntry {
  id: SupplyProviderId;
  /** Kje je koda te integracije danes. */
  codeStatus: MatrixCodeStatus;
  /** Kaj odklepa aktivacijo. */
  gate: ActivationGate;
  /** Env ključi — izpis SAMO Boolean prisotnosti (kanarček: brez vrednosti). */
  envKeys: readonly string[];
  /** Iskren razlog trenutnega stanja (slovenščina). */
  reasonSl: string;
  /** Koraki do aktivacije (slovenščina, po vrsti). */
  stepsSl: readonly string[];
  /** Cross-ref: podstran /go (kadar partnerji pripada tej ruti). */
  goSlug?: GoRouteSlug;
  /** Cross-ref: vnos v affiliate registru 2.5.0+ (kadar je rezervacijski partner). */
  affiliateId?: AffiliateProviderId;
}

/**
 * Celotna matrika — 19 ponudnikov (16 izvirnikovih + kiwi, rentalcars,
 * osm-fuel po vzorcu MindTrip 2.5.0). Vsak vnos mora imeti ustrezen
 * vnos v registru zmožnosti (testno zaklenjeno).
 */
export const PRODUCTION_MATRIX: readonly ProviderMatrixEntry[] = Object.freeze([
  // ── Odkritovalna in vsebinska plast (obnovljena v P0-C, 2.8.0) ───────
  {
    id: "fsq",
    codeStatus: "LIVE",
    gate: "data",
    envKeys: [],
    reasonSl:
      "Koda obnovljena v P0-C (loader .jsonl + stroga validacija: geo bbox države, kanonske kategorije, dedupe + ingest bun run fsq:ingest). Množica 125.446 POI (SI·HR·ME·AL, snapshot 2025-02-06) je ostala na mrtvem GitHub računu — vir najden in svež (17.10.2026): uradni HuggingFace foursquare/fsq-os-places, izdaja dt=2026-10-15 (Apache-2.0; stari javni S3 in source.coop/fused.io mrtvi). Preostali korak: brezplačen HF žeton (gated auto — lastniški). Paket: docs/research/fsq-os-places-vir.md.",
    stepsSl: [
      "Ustvari brezplačen HF račun + soglasje na foursquare/fsq-os-places + fine-grained read žeton (5–10 min, samodejna potrditev)",
      "duckdb pushdown bbox SI·HR·ME·AL → surov .jsonl → bun run fsq:ingest --raw-dir <dir>",
      "Preveri odmik od baseline (SI 18.010 · HR 88.331 · ME 10.285 · AL 8.820) — izpiše se sam",
    ],
  },
  {
    id: "osm",
    codeStatus: "LIVE",
    gate: "none",
    envKeys: [],
    reasonSl:
      "Overpass adapter ŽIV (P0-C): POI po viewportu (/api/pois, 3 zrcala, rate limit 5 s, max 0,25°², timeout), atribucija ODbL v Vsakem odzivu. Nedosegljivost vira je iskrena napaka (isti vzorec kot izvirnik na Render) — nikoli izmišljeni POI.",
    stepsSl: [],
  },
  {
    id: "sto",
    codeStatus: "LIVE",
    gate: "none",
    envKeys: [],
    reasonSl:
      "STO vsebina ŽIVA (P0-C): uradni vodnik slovenia.info (llms.txt) ingesciran iz ŽIVEGA vira — 752 vnosov v 7 jezikih (data/sto-content.json, 209 KB), deterministično iskanje prek /api/sto/search + tedenski cron /api/cron/sto-reingest. Vir je VSEBINA, ne geo feed — nikoli ne nastopa kot zemljevidska plast.",
    stepsSl: [],
  },
  {
    id: "kiwitaxi",
    codeStatus: "LIVE",
    gate: "data",
    envKeys: [],
    reasonSl:
      "Koda obnovljena v P0-C (shema FROM_PRICE + validacija relacij ISO-2 + iskanje po krajih + kanon „rute, ki se dotikajo SI“ + ingest bun run kiwitaxi:ingest --csv). Feed z objavljenimi realnimi cenami je ostal na mrtvem GitHub računu — čaka partner CSV iz affiliate programa.",
    stepsSl: [
      "Pridobi partner CSV feed (kiwitaxi.com affiliate program)",
      "bun run kiwitaxi:ingest --csv <feed.csv>",
    ],
    goSlug: "transfers",
  },

  // ── Rezervacijski partnerji — affiliate register 2.5.0+ ────────────────
  {
    id: "booking",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_BOOKING_ID", "AFFILIATE_BOOKING_TMPL"],
    reasonSl:
      "Partner kanal ŽIV (2.5.0/2.6.0): iskanje, vodena povezava /api/affiliate/go, rezervacija s statusi in provizijski dnevnik. Brez partner ID-ja povezava deluje javno — iskreno, brez provizije.",
    stepsSl: [
      "Registriraj se v programu Booking.com Partner",
      "Nastavi AFFILIATE_BOOKING_ID (+ neobvezno AFFILIATE_BOOKING_TMPL)",
    ],
    goSlug: "hotels",
    affiliateId: "booking",
  },
  {
    id: "getyourguide",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_GYG_ID", "AFFILIATE_GYG_TMPL"],
    reasonSl:
      "Partner kanal ŽIV (2.5.0/2.6.0): izkušnje v booking verigi z vodeno povezavo. Brez partner ID-ja deluje javno iskanje — iskreno, brez provizije.",
    stepsSl: [
      "Prijavi se v GetYourGuide partner program",
      "Nastavi AFFILIATE_GYG_ID (+ neobvezno AFFILIATE_GYG_TMPL)",
    ],
    goSlug: "activities",
    affiliateId: "getyourguide",
  },
  {
    id: "kiwi",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_KIWI_ID", "AFFILIATE_KIWI_TMPL"],
    reasonSl:
      "Partner kanal ŽIV (2.5.0/2.6.0): letalska iskanja z letališčem regije (LJU/TRS/GRZ). Naslednik SkyScanner vrzeli v booking plasti po vzorcu MindTrip. Brez ID-ja javno iskanje — iskreno.",
    stepsSl: [
      "Prijavi se v Kiwi.com partner program",
      "Nastavi AFFILIATE_KIWI_ID (+ neobvezno AFFILIATE_KIWI_TMPL)",
    ],
    goSlug: "flights",
    affiliateId: "kiwi",
  },
  {
    id: "rentalcars",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_RENTALCARS_ID", "AFFILIATE_RENTALCARS_TMPL"],
    reasonSl:
      "Partner kanal ŽIV (2.5.0/2.6.0): najem avtov v booking verigi. Naslednik DiscoverCars zasnove po vzorcu MindTrip. Brez ID-ja javno iskanje — iskreno.",
    stepsSl: [
      "Prijavi se v Rentalcars partner program",
      "Nastavi AFFILIATE_RENTALCARS_ID (+ neobvezno AFFILIATE_RENTALCARS_TMPL)",
    ],
    goSlug: "cars",
    affiliateId: "rentalcars",
  },
  {
    id: "omio",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_OMIO_ID", "AFFILIATE_OMIO_TMPL"],
    reasonSl:
      "Partner kanal ŽIV (2.5.0/2.6.0): vlaki in avtobusi v booking verigi. Brez ID-ja javno iskanje — iskreno, brez provizije.",
    stepsSl: [
      "Prijavi se v Omio affiliate program",
      "Nastavi AFFILIATE_OMIO_ID (+ neobvezno AFFILIATE_OMIO_TMPL)",
    ],
    goSlug: "transport",
    affiliateId: "omio",
  },

  // ── Odprta goriva plast (2.5.0) ────────────────────────────────────────
  {
    id: "osm-fuel",
    codeStatus: "LIVE",
    gate: "none",
    envKeys: [],
    reasonSl:
      "66 bencinskih črpalk na zemljevidu (ODbL) — brezplačni odprti podatki, izrecno 0 % provizije. Iskanje po viewportu in ob poti (Go Mode).",
    stepsSl: [],
    affiliateId: "osm-fuel",
  },

  // ── Lastna tržnica ─────────────────────────────────────────────────────
  {
    id: "own",
    codeStatus: "LIVE",
    gate: "production-proof",
    envKeys: [],
    reasonSl:
      "Tržnica ŽIVA: lokalni in izkušnje s koordinatami, geo pini na zemljevidu, demo checkout. Stopnja NE prečka v ACTIVE, dokler živi partnerji s pini niso dokazljivi (kanon izvirnika).",
    stepsSl: [
      "Dokaz živih partnerjev s pini v produkciji (po prevezavi deploja)",
      "Potem ročno eskaliraj v ACTIVE (ta vnos)",
    ],
  },

  // ── /go partnerji izvirnika — P0-F (2.10.0): affiliate plast ŽIVA ──────
  {
    id: "viator",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_VIATOR_ID", "AFFILIATE_VIATOR_TMPL"],
    reasonSl:
      "Affiliate globoka povezava ŽIVA (P0-F): vodeno iskanje /api/affiliate/go javno deluje, brez žetona iskreno brez provizije. Aktivacija provizije: prijava v Viator partner program (Basic Access) + TMPL vzorec iz programa. API inventar čaka odobritev (arhiv spec).",
    stepsSl: [
      "Prijavi se v Viator partner program (Basic Access)",
      "Nastavi AFFILIATE_VIATOR_TMPL (vzorec povezave iz programa) + AFFILIATE_VIATOR_ID",
      "API inventar po odobritvi + obnovi adapter (arhiv spec)",
    ],
    goSlug: "viator",
    affiliateId: "viator",
  },
  {
    id: "tiqets",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_TIQETS_ID", "AFFILIATE_TIQETS_TMPL"],
    reasonSl:
      "Affiliate globoka povezava ŽIVA (P0-F): javno iskanje vstopnic dela, brez žetona brez provizije. Aktivacija provizije: affiliate prijava (Awin) + TMPL. Distributor API (inventar) čaka odobritev.",
    stepsSl: [
      "Odobritev affiliate prijave prek Awin",
      "Nastavi AFFILIATE_TIQETS_TMPL + AFFILIATE_TIQETS_ID",
      "API inventar po odobritvi (Distributor API)",
    ],
    goSlug: "tickets",
    affiliateId: "tiqets",
  },
  {
    id: "skyscanner",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_SKYSCANNER_ID", "AFFILIATE_SKYSCANNER_TMPL"],
    reasonSl:
      "Javna primerjava letov ŽIVA (P0-F, domača stran — iskanje izhodišča je na strani partnerja). Za provizijo: povezava prek partnerskega omrežja (npr. Travelpayouts) + TMPL. Travel API inventar ostaja partner-approval.",
    stepsSl: [
      "Pridobi affiliate povezavo prek partnerskega omrežja",
      "Nastavi AFFILIATE_SKYSCANNER_TMPL + AFFILIATE_SKYSCANNER_ID",
      "Travel API inventar po odobritvi (partners.skyscanner.net)",
    ],
    goSlug: "flights",
    affiliateId: "skyscanner",
  },
  {
    id: "airalo",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_AIRALO_ID", "AFFILIATE_AIRALO_TMPL"],
    reasonSl:
      "Affiliate eSIM povezava ŽIVA (P0-F): javne strani po državah ({country}-eSIM, vzorci preverjeni za cel Balkan — 10/10 držav, R41-F4 2.58.0). Aktivacija provizije: partner program + TMPL. Partner API (OAuth2) čaka odobritev.",
    stepsSl: [
      "Prijavi se v Airalo partner program",
      "Nastavi AFFILIATE_AIRALO_TMPL + AFFILIATE_AIRALO_ID",
      "Partner API (OAuth2) po odobritvi",
    ],
    goSlug: "esim",
    affiliateId: "airalo",
  },
  {
    id: "travelpayouts",
    codeStatus: "CONTENT_LIVE",
    gate: "restore",
    envKeys: [],
    reasonSl:
      "Omemba na /go/flights je živa. Data API je self-serve (žeton po registraciji), a adapter izvirnika je izgubljen — najprej obnova sloja.",
    stepsSl: [
      "Registriraj račun Travelpayouts (self-serve žeton)",
      "Obnovi adapter Data API (arhiv spec)",
    ],
    goSlug: "flights",
  },
  {
    id: "discovercars",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_DISCOVERCARS_ID", "AFFILIATE_DISCOVERCARS_TMPL"],
    reasonSl:
      "Affiliate najem povezava ŽIVA (P0-F): javne strani po državah/krajih ({country}/{dest}, vzorci preverjeni za cel Balkan — 10/10 držav, R41-F4 2.58.0). Aktivacija provizije: affiliate program + TMPL. Search API inventar ostaja B4B pogodba.",
    stepsSl: [
      "Prijavi se v DiscoverCars affiliate program",
      "Nastavi AFFILIATE_DISCOVERCARS_TMPL + AFFILIATE_DISCOVERCARS_ID",
      "Search API inventar po B4B pogodbi (neobvezno)",
    ],
    goSlug: "cars",
    affiliateId: "discovercars",
  },
  {
    id: "worldnomads",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_WORLDNOMADS_ID", "AFFILIATE_WORLDNOMADS_TMPL"],
    reasonSl:
      "Affiliate zavarovanje ŽIVO (P0-F): javna stran ponudbe dela (affiliate-only, brez API). Aktivacija provizije: partnerski program + TMPL.",
    stepsSl: [
      "Prijavi se v World Nomads partnerski program",
      "Nastavi AFFILIATE_WORLDNOMADS_TMPL + AFFILIATE_WORLDNOMADS_ID",
    ],
    goSlug: "insurance",
    affiliateId: "worldnomads",
  },
  {
    id: "safetywing",
    codeStatus: "LIVE",
    gate: "env",
    envKeys: ["AFFILIATE_SAFETYWING_ID", "AFFILIATE_SAFETYWING_TMPL"],
    reasonSl:
      "Affiliate zavarovanje ŽIVO (P0-F): javna stran nomadskega zavarovanja dela (Ambassador program, brez javnega API-ja). Aktivacija provizije: ambassador prijava + TMPL.",
    stepsSl: [
      "Prijavi se v SafetyWing ambassador program",
      "Nastavi AFFILIATE_SAFETYWING_TMPL + AFFILIATE_SAFETYWING_ID",
    ],
    goSlug: "insurance",
    affiliateId: "safetywing",
  },
]);

/** Vnos matrike po id (undefined za neznane — nikoli izjema). */
export function getMatrixEntry(
  id: string
): ProviderMatrixEntry | undefined {
  return PRODUCTION_MATRIX.find((p) => p.id === id);
}
