/**
 * PROVIDER-MODEL — čista logika kataloga ponudnikov (faza 4a iz #35).
 * ============================================================================
 * Izvorna resnica: docs/research/balkan-platform-no-ai.md §6a/§6c (raziskava
 * #35, osvežena 14. 10. 2026) — podatkovni model Provider z obveznimi polji
 * issue-a #35 (država, regija, kraj, koordinate, kategorija, jeziki,
 * fotografije + licenčni vir, kontakt, sezonskost, ceno/valuto, način
 * rezervacije, status preverjanja, potek preverjanja, izvor podatka).
 *
 * KANONI (skladno s projektom):
 *  · ČISTA LOGIKA — 0 db, 0 process.env, 0 stranskih učinkov; obnašanje je
 *    testno zaklenjeno v tests/provider-model.test.ts.
 *  · ISKRENOST PREVERJANJA — "verified" NIKOLI ne pripada iz zraka: OSM/odprti
 *    podatki so VEČNO "unverified", dokler ponudnik ne potrdi (§6c); 12-mesečni
 *    potek (§6c točka 6): svežina dokaza je del resnice — stale "verified"
 *    PADA na "claimed", nikoli nazaj na "unverified" (potrditveni seznam ni
 *    izgubljen, samo star).
 *  · DEDUP (§6c točka 5) — normalizirano ime + geohash celica; celica
 *    preciznosti 7 je ~153 m × ~153 m (dokumentirano odstopanje od "±50 m"
 *    v raziskavi: celica je ŽARIŠČE, ne radij — dve točki 50 m ob robu celice
 *    lahko padata v sosednji celici; kljub temu 7 zadostuje kot prvi filter
 *    preddragim primerjavam po imenu — to je izrecno zapisano, ne skrito).
 */

import { COUNTRIES } from "./countries-data";
import type { CountryCode } from "./slovenia-data";

// ── Kanonski nabori (#35 §6a) ──────────────────────────────────────────────

export const PROVIDER_CATEGORIES = [
  "accommodation", // namestitev (hotel, apartma, soba, kamp, glamping, koča)
  "food", // restavracija, konoba, kavarna, vinska klet, kmetija
  "guide", // lokalni vodniki, ture, kulturni ogledi
  "activity", // rafting, kajak, kolesarjenje, pohodništvo, plovila
  "transport", // najem vozil, transferji, taksiji, kolesa, trajekti
  "attraction", // muzeji, gradovi, parki, jame, naravne znamenitosti, kopališča
  "event", // dogodki, festivali, tržnice, prireditve
  "wellness", // wellness, družinske aktivnosti, druge turistične storitve
] as const;

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const PROVIDER_BOOKING_MODES = [
  "none", // brez rezervacije (samo profil)
  "request", // povpraševanje (klic/e-pošta/obrazec)
  "redirect", // označena preusmeritev na uradno stran ponudnika
  "partner", // partnerski API — ŠELE po pisni odobritvi (pogl. 7)
] as const;

export type ProviderBookingMode = (typeof PROVIDER_BOOKING_MODES)[number];

export const PROVIDER_VERIFICATIONS = ["unverified", "claimed", "verified"] as const;

export type ProviderVerification = (typeof PROVIDER_VERIFICATIONS)[number];

export const PROVIDER_REPORT_REASONS = [
  "napaka", // napačen podatek (naslov, uradni čas, kontakt …)
  "zaprt", // zaprto/trajno ukinjeno
  "dupliciran", // podvojen vnos
  "drugo", // kaj drugega (opis obvezen)
] as const;

export type ProviderReportReason = (typeof PROVIDER_REPORT_REASONS)[number];

export const PROVIDER_STATUSES = ["draft", "published", "suspended"] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

// ── Normalizacija imena (dedup kanon #35 §6c.5) ────────────────────────────

/** Ekplicitna preslikava znakov, ki jih NFD NE razstavi (balkansko-pomembni:
 *  đ/Đ). đ → "dj" (NE "d"): dedup mora združiti "Đakovica" z običajno
 *  ASCII prepisavo "Djakovica" (isti kanon prepisave kot NLU igle —
 *  Đerdap/Djerdap). ß in ostali latinski posebni znaki so dopolnilo. */
const FOLD_MAP: Readonly<Record<string, string>> = Object.freeze({
  đ: "dj",
  Đ: "dj",
  ß: "ss",
  ø: "o",
  æ: "ae",
  œ: "oe",
  ł: "l",
});

/** Pravni/organizacijski priponki, ki ne bi smeli vplivati na dedup
 *  ("Motel Drina d.o.o." in "Motel Drina" sta isti ponudnik). */
const LEGAL_SUFFIXES = [
  "j.d.o.o.",
  "d.o.o.",
  "d.d.",
  "s.p.",
  "d.o.o",
  "srl",
  "s.r.l.",
  "llc",
  "ltd",
  "gmbh",
  "ooo",
  "shpk",
  "d.o.o.e.p.",
] as const;

/** Normalizirano ime za dedup: mala črka, razločevalni znaki pregibani
 *  (č→c, š→s, ž→z, ć→c, đ→d …), pravne priponke odstranjene, ločila →
 *  presledek, presledki stisnjeni. Zaključni presledek odstranjen. */
export function normalizeProviderName(raw: string): string {
  let s = (raw ?? "").toLowerCase();

  // eksplicitni pregibi, ki jih NFD ne pokrije
  s = s.replace(/[đĐßøæœł]/g, (ch) => FOLD_MAP[ch] ?? ch);

  // NFD: razločevalne oznake (č → c + ˇ) — nato oznake odstrani
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // pravne priponke (s konca, po presledku) — najprej daljše (j.d.o.o. pred d.o.o.)
  for (const suffix of LEGAL_SUFFIXES) {
    const needle = ` ${suffix}`;
    if (s.endsWith(needle)) {
      s = s.slice(0, s.length - needle.length);
      break; // samo ena pripona (zadnja veljavnost) — break na najdaljšem
    }
  }

  // ločila in simboli → presledek; stisni presledke
  s = s.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();

  return s;
}

// ── Geohash (standard base32) ──────────────────────────────────────────────

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Standardni geohash (Nimrod Rivero prijem: izmenično lat/lng bisekcija).
 *  Preciznost 7 ≈ 153 m × 153 m celica (glej glavo za dedup kanon). */
export function geohashEncode(lat: number, lng: number, precision = 7): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new RangeError("geohashEncode: lat/lng morata biti končni številki");
  }
  if (lat < -90 || lat > 90) {
    throw new RangeError("geohashEncode: lat izven [-90, 90]");
  }
  if (lng < -180 || lng > 180) {
    throw new RangeError("geohashEncode: lng izven [-180, 180]");
  }
  if (!Number.isInteger(precision) || precision < 1 || precision > 12) {
    throw new RangeError("geohashEncode: precision mora biti celo število 1–12");
  }

  let latLo = -90;
  let latHi = 90;
  let lngLo = -180;
  let lngHi = 180;
  let hash = "";
  let bit = 0;
  let chIndex = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (lngLo + lngHi) / 2;
      if (lng >= mid) {
        chIndex = (chIndex << 1) + 1;
        lngLo = mid;
      } else {
        chIndex = chIndex << 1;
        lngHi = mid;
      }
    } else {
      const mid = (latLo + latHi) / 2;
      if (lat >= mid) {
        chIndex = (chIndex << 1) + 1;
        latLo = mid;
      } else {
        chIndex = chIndex << 1;
        latHi = mid;
      }
    }
    isLng = !isLng;

    bit += 1;
    if (bit === 5) {
      hash += GEOHASH_BASE32[chIndex];
      bit = 0;
      chIndex = 0;
    }
  }

  return hash;
}

/** Dedup ključ (#35 §6c.5): geohash-7 celica + normalizirano ime.
 *  Oblika "u2fsm4:turisticna kmetija pri jozetu" — človeku berljivo za
 *  razhroščevanje, deterministično za unique indeks v bazi. */
export function providerDedupKey(name: string, lat: number, lng: number): string {
  return `${geohashEncode(lat, lng, 7)}:${normalizeProviderName(name)}`;
}

// ── Preverjanje in njegov potek (#35 §6a/§6c.6) ────────────────────────────

export const VERIFICATION_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 12 mesecev

export interface VerificationInput {
  verification: ProviderVerification;
  verifiedAt?: Date | null;
}

export interface VerificationOutcome {
  /** Učinkovito stanje PO upoštevanju 12-mesečnega poteka. */
  effective: ProviderVerification;
  /** true, če je bil "verified" svež ob zapisu, a je zdaj zastarel →
   *  UI dolžan pokazati opozorilo + poziv k ponovnemu preverjanju. */
  stale: boolean;
}

/** Učinkovito preverjanje z 12-mesečnim potekom (čista funkcija časa):
 *  · unverified ostane unverified (nikoli samodejna napredovanja);
 *  · claimed ostane claimed;
 *  · verified: svež (verifiedAt ≤ 12 mesecev) ostane verified;
 *    verified BREZ datuma ali z datumom starejšim od 12 mesecev PADE na
 *    claimed (stale: true) — dokaz obstaja, a ni več svež. */
export function verificationState(
  input: VerificationInput,
  now: Date = new Date()
): VerificationOutcome {
  const { verification, verifiedAt } = input;

  if (verification === "verified") {
    if (verifiedAt instanceof Date && !Number.isNaN(verifiedAt.getTime())) {
      const age = now.getTime() - verifiedAt.getTime();
      if (age <= VERIFICATION_TTL_MS) {
        return { effective: "verified", stale: false };
      }
      return { effective: "claimed", stale: true };
    }
    // "verified" brez dokazljivega datuma NI verodostojen → iskren padec
    return { effective: "claimed", stale: true };
  }

  return { effective: verification, stale: false };
}

// ── Valuta po državi (iz COUNTRIES meta — enoten izvor resnice) ────────────

/** Uradna valuta države kanona (ISO 4217 iz COUNTRIES meta, F0). Neznana
 *  koda → null (nikoli ugibati — kanon iskrenosti). */
export function providerCurrency(countryCode: string): string | null {
  const meta = (COUNTRIES as Record<string, { currency: string }>)[countryCode];
  return meta ? meta.currency : null;
}

/** Ali je koda v državnem kanonu (10 držav, F0)? */
export function isCanonCountry(code: string): code is CountryCode {
  return Object.prototype.hasOwnProperty.call(COUNTRIES, code);
}
