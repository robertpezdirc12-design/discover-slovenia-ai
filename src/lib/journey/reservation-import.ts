/**
 * RESERVATION-IMPORT — UVOZ REZERVACIJE: RAZČLENITEV → PREGLED → POTRDITEV
 * (P0-E, issue #1 §10 „reservation import parse → review → confirm").
 * ============================================================================
 * Kanon:
 *  - DETERMINISTIČNO (issue §29 AI PRAVILO): razčlenitev teče IZKLJUČNO z
 *    pravili in regularnimi izrazi — 0 AI žetonov, 0 omrežja, isti vhod →
 *    isti izhod (popolnoma čista funkcija, client-safe);
 *  - ISKRENOST: parser NIčesar ne izmišljuje. Polja, ki jih ni prepoznal,
 *    ostanejo null in UI odkrito pokaže „ni prepoznano — dopolni ročno";
 *  - Varnost: brez eval, brez prevzema URL-jev (confirmationUrl pustimo
 *    uporabniku); prepoznana številka rezervacije je omejena na veljavne
 *    znake [A-Z0-9-] (kontrolni znaki odpadejo že v regularnem izrazu);
 *  - Ponudnika prepoznamo SAMO iz registra AFFILIATE_PROVIDERS (enkraten
 *    vir resnice — brez trdo-kodiranih imen zunaj registra).
 *
 * Pot: uporabnik prilepi besedilo potrdila → parseReservationText() predlaga
 * polja → uporabnik jih PREGLEDA in dopolni → potrditev gre prek obstoječe
 * S1 poti POST /api/trips/[shareId]/reservations z izvorom IMPORTED
 * (status CONFIRMED z atestacijo — kanon booking.ts „import pot").
 * ============================================================================
 */

import { AFFILIATE_PROVIDERS } from "@/lib/affiliate-providers";

/** Predlog razčlenjenih polj — VSE vrednosti so predlogi za pregled. */
export interface ParsedReservation {
  /** ID ponudnika iz registra (npr. "booking") — null, če ni prepoznan. */
  providerId: string | null;
  /** Prikazno ime ponudnika (iz registra). */
  providerName: string | null;
  /** Kateri niz v besedilu je sprožil prepoznavo (dokaz za uporabnika). */
  providerMatchedFrom: string | null;
  /** Številka/koda rezervacije (veljavni znaki [A-Z0-9-], 4–24 znakov). */
  bookingRef: string | null;
  /** Cena v EUR (iz besedila; 0 < cena ≤ 1.000.000). */
  priceEur: number | null;
  /** Datum prihodka/začetka "YYYY-MM-DD" (lokalni, DST-varno). */
  dateStartIso: string | null;
  /** Datum odhodka/konca "YYYY-MM-DD" (lokalni, DST-varno). */
  dateEndIso: string | null;
  /** Število oseb (1–20). */
  guests: number | null;
  /** Predlog ima postanka/aktivnosti (niz 4–80 znakov) — SAMO predlog. */
  titleCandidate: string | null;
  /** Iskrene opombe o tem, kaj je bilo (pre)poznano (SL). */
  notes: string[];
}

// ── Ponudnik (register = enkraten vir resnice) ──────────────────────────────

/** Vzdevki za ujemanje, ki v registru niso pokriti z imenom (alias preslikava). */
const PROVIDER_ALIASES: Readonly<Record<string, readonly string[]>> = {
  booking: ["booking com"],
  getyourguide: ["get your guide"],
  kiwi: ["kiwi taxi", "kiwitaxi"],
  rentalcars: ["rental cars"],
};

/**
 * Prepoznaj ponudnika iz besedila — prvi zadetek po vrstnem redu registra
 * (determinizem). Ujemanje: ime registra (brez pika, presledki dovoljeni)
 * ali alias, neobčutljivo na velikost črk.
 */
export function detectProvider(text: string): {
  providerId: string;
  providerName: string;
  matchedFrom: string;
} | null {
  // Normalizacija: male črke, pike ločene od domen („booking.com“ → „booking com“),
  // ločila kot presledki, obrobni presledki — deterministično ujemanje celih besed.
  const haystack =
    " " +
    text
      .toLowerCase()
      .replace(/\./g, " ")
      .replace(/[,;:!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() +
    " ";
  for (const provider of AFFILIATE_PROVIDERS) {
    // Gorivo (osm-fuel) ni rezervacijski ponudnik — uvoz zanj ni smiseln.
    if (provider.id === "osm-fuel") continue;
    const candidates = [
      provider.name.toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim(),
      ...(PROVIDER_ALIASES[provider.id] ?? []),
    ];
    for (const needle of candidates) {
      if (!needle || needle.length < 4) continue;
      if (haystack.includes(" " + needle + " ")) {
        return { providerId: provider.id, providerName: provider.name, matchedFrom: needle };
      }
    }
  }
  return null;
}

// ── Številka rezervacije ────────────────────────────────────────────────────

/** Oznake pred številko (SL/EN/DE) — besedni kanon potrdil. */
const REF_LABEL_RE =
  "(?:potrditvena\\s*\\(?[a-zčšž]*\\)?\\s*(?:številka|koda|št\\.?|id)|številka\\s+rezervacije|številka\\s*[:#]|koda\\s*[:#]|št\\.?\\s*rezervacije|rezervacijska\\s*(?:številka|koda)|booking\\s*(?:confirmation\\s*)?(?:number|id|reference|no\\.?)|confirmation\\s*(?:number|code|id|no\\.?)|reservation\\s*(?:number|id|no\\.?)|buchungsnummer|buchungs\\s*-?\\s*nummer|reference\\s*(?:number|code|id)?|\\bref\\b\\s*[:#]|booking\\s*-?\\s*ref(?:erence)?|potrditev\\s*\\d*\\s*:?)";

/** Vrednost: 4–24 znakov [A-Z0-9-], se začne z alfanumeričnim znakom. */
const REF_VALUE = "([A-Z0-9][A-Z0-9\\-]{3,23})";

/** Zavrnjene vrednosti, ki pogosto sledijo oznaki (nikoli niso številka). */
const REF_BLACKLIST = new Set([
  "POTRDILO",
  "POTRDITEV",
  "POTRDITVENA",
  "REZERVACIJA",
  "REZERVACIJE",
  "REZERVACIJO",
  "REZERVACIJSKA",
  "BOOKING",
  "RESERVATION",
  "CONFIRMATION",
  "ŠTEVILKA",
  "KODA",
  "BUCHUNGSNUMMER",
]);

/**
 * Prepoznaj številko rezervacije. Prednost ima eksplicitna oznaka
 * („Potrditvena številka: X"), nato Booking.com oblika (10-mestna številka
 * ob imenu ponudnika), nazadnje osamljen žeton [#ABC-1234].
 */
export function detectBookingRef(text: string, providerId: string | null): string | null {
  // 1 ── Eksplicitna oznaka + vrednost.
  const labeled = new RegExp(REF_LABEL_RE + "\\s*[:#]?\\s*" + REF_VALUE, "i");
  const m1 = labeled.exec(text);
  if (m1) {
    const ref = normalizeRef(m1[1]);
    if (ref && !REF_BLACKLIST.has(ref.toUpperCase())) return ref;
  }

  // 2 ── Booking.com kanon: 10-mestna številka (lahko zvezdično obložena).
  if (providerId === "booking") {
    const m2 = /(?:#|\bno\.?\b|\bnumber\b|\bštevilka\b|\bšt\b)[^0-9]{0,8}(\d{10})\b/i.exec(text);
    if (m2) return m2[1];
    const m2b = /\b(\d{10})\b/.exec(text);
    if (m2b) return m2b[1];
  }

  // 3 ── Osmukljični žeton brez oznake: #ABC-1234 (predlog za pregled).
  const m3 = /(?:^|[\s:(])#([A-Z0-9][A-Z0-9\-]{3,23})(?=$|[\s).,;!])/gm;
  let m3m: RegExpExecArray | null;
  while ((m3m = m3.exec(text)) !== null) {
    const ref = normalizeRef(m3m[1]);
    if (ref) return ref;
  }
  return null;
}

function normalizeRef(raw: string): string | null {
  const ref = raw.trim().toUpperCase().replace(/^-+|-+$/g, "");
  if (!/^[A-Z0-9][A-Z0-9\-]{3,23}$/.test(ref)) return null;
  if (REF_BLACKLIST.has(ref)) return null;
  return ref;
}

// ── Cena (EUR) ──────────────────────────────────────────────────────────────

/** Znesek v EUR: „49,50 €", "EUR 120", "120.00 EUR", "Skupaj: 89 €". */
export function detectPriceEur(text: string): number | null {
  const lines = text.split(/\r?\n/);
  // Dvostopenjska prednost (deterministično):
  //  1. vrstica z močno skupno oznako (skupaj/total/gesamt/znesek/amount);
  //  2. sicer vrstica z oznako cene (cena/price);
  //  3. sicer celo besedilo.
  // Znotraj izbora velja ZADNJI zadetek (skupna vsota običajno stoji za
  // posameznimi postavkami v isti vrstici).
  const strongLine = lines.find((l) =>
    /(skupaj|total|gesamt|zu zahlen|znesek|amount)/i.test(l)
  );
  const priceLine = lines.find((l) => /(cena|price)\b/i.test(l));
  const hay = strongLine ?? priceLine ?? text;

  const re =
    /(?:(?:EUR|€)\s*(\d{1,6})(?:[.,](\d{1,2}))?)|(?:(\d{1,6})(?:[.,](\d{1,2}))?\s*(?:EUR|€))/gi;
  let m: RegExpExecArray | null;
  let last: number | null = null;
  while ((m = re.exec(hay)) !== null) {
    const whole = m[1] ?? m[3];
    const frac = m[2] ?? m[4];
    if (!whole) continue;
    const value = Number(whole) + (frac ? Number(frac) / 100 : 0);
    if (Number.isFinite(value) && value > 0 && value <= 1_000_000) {
      last = value;
    }
  }
  return last === null ? null : Math.round(last * 100) / 100;
}

// ── Datumi (lokalni, DST-varno — enak kanon kot trip-dates) ────────────────

const MONTHS_SL_GEN = [
  "januarja",
  "februarja",
  "marca",
  "aprila",
  "maja",
  "junija",
  "julija",
  "avgusta",
  "septembra",
  "oktobra",
  "novembra",
  "decembra",
];
const MONTHS_EN = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoOf(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const dim = new Date(y, m, 0).getDate();
  if (d > dim) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Prepoznaj vse datume v besedilu (ISO, dd.mm.yyyy, dd. mesec yyyy (SL/EN)).
 * Vrača lokalne ISO nize — DST-varne (niz je ISTO dan kot v potrdilu).
 */
export function detectDates(text: string): string[] {
  const found: string[] = [];
  const push = (iso: string | null) => {
    if (iso && !found.includes(iso)) found.push(iso);
  };

  // ISO 2026-10-17
  for (const m of text.matchAll(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g)) {
    push(isoOf(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // dd.mm.yyyy / dd. mm. yyyy (slovenski/evropski kanon)
  for (const m of text.matchAll(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\b/g)) {
    push(isoOf(Number(m[3]), Number(m[2]), Number(m[1])));
  }
  // 17. oktobra 2026 (SL, rodilnik) + 17 October 2026 (EN)
  const monthWordRe = new RegExp(
    `\\b(\\d{1,2})\\.?\\s+(${[...MONTHS_SL_GEN, ...MONTHS_EN].join("|")})\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(monthWordRe)) {
    const monthIdx = findMonthIndex(m[2]);
    if (monthIdx >= 0) push(isoOf(Number(m[3]), monthIdx + 1, Number(m[1])));
  }
  // Mesec-prvi angleški zapis: „October 17, 2026" / „October 17 2026".
  const monthFirstRe = new RegExp(
    `\\b(${MONTHS_EN.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(monthFirstRe)) {
    const monthIdx = MONTHS_EN.indexOf(m[1].toLowerCase());
    if (monthIdx >= 0) push(isoOf(Number(m[3]), monthIdx + 1, Number(m[2])));
  }

  return found.sort(); // zgodnji datum prvi
}

function findMonthIndex(word: string): number {
  const w = word.toLowerCase();
  const iSl = MONTHS_SL_GEN.findIndex((m) => m === w);
  if (iSl >= 0) return iSl;
  return MONTHS_EN.findIndex((m) => m === w);
}

/** Datum prihodka in odhodka: prvi = start, zadnji = end (če obstajata). */
export function detectDateRange(
  dates: readonly string[]
): { start: string; end: string } | { start: string; end: null } | null {
  if (dates.length === 0) return null;
  const start = dates[0];
  const end = dates.length > 1 ? dates[dates.length - 1] : null;
  return { start, end };
}

// ── Število oseb ────────────────────────────────────────────────────────────

/** „2 osebi", "4 guests", "3 Erwachsene", "2 odrasli" — 1..20. */
export function detectGuests(text: string): number | null {
  const re =
    /\b(\d{1,2})\s*(?:odrasl\w*|oseb\w*|gost\w*|potnik\w*|guests?|adults?|people|persons?|osob\w*|erwachsene?)\b/i;
  const m = re.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return n;
}

// ── Predlog imena postanka ─────────────────────────────────────────────────

/** Besede, ki vrstico izločijo iz razmisleka o imenu. */
const TITLE_LINE_BLOCK_RE =
  /(potrdilo|confirmation|rezervacij|reservation|booking|bestell|hvala|thank|spoštovan|pozdravljen|pozdrav|zdravo|dear|gospod|gospa|hello|hi\b|dober dan|cena|price|skupaj|total|datum|date|check|©|http|@)/i;

/**
 * Predlog imena: prva vrstica, ki NI pozdrav/glava/podpis, ima 4–80 znakov,
   vsebuje vsaj eno črko in ni sama številka/ločilo. To je SAMO PREDLOG —
 * končno ime potrdi uporabnik v pregledu (iskrenost).
 */
export function detectTitleCandidate(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of lines) {
    if (line.length < 4 || line.length > 80) continue;
    if (TITLE_LINE_BLOCK_RE.test(line)) continue;
    if (!/[a-zšžćčđA-ZŠŽĆČĐ]/.test(line)) continue; // samo številke/ločila
    if (/^[\W\d]+$/u.test(line)) continue;
    return line.replace(/\s{2,}/g, " ").slice(0, 80);
  }
  return null;
}

// ── Sestavni klic ───────────────────────────────────────────────────────────

/**
 * RAZČLENI besedilo potrdila → predlog polj (deterministično, 0 omrežja).
 * Vsak klic z ISTIM besedilom vrne ENAK rezultat (čista funkcija).
 */
export function parseReservationText(text: string): ParsedReservation {
  // Sanity zgornja meja vhoda: obdrži ZADNJIH 20.000 znakov (glava z
  // pozdravi je manj pomembna od podatkov nižje v potrdilu).
  const raw = (text ?? "").slice(-20_000);
  const notes: string[] = [];

  const provider = detectProvider(raw);
  if (provider) {
    notes.push(`Ponudnik prepoznan: ${provider.providerName} (ujemanje „${provider.matchedFrom}").`);
  } else {
    notes.push("Ponudnika ni bilo mogoče prepoznati — izberi ga ročno.");
  }

  const bookingRef = detectBookingRef(raw, provider?.providerId ?? null);
  if (bookingRef) {
    notes.push(`Številka rezervacije prepoznana: ${bookingRef}.`);
  } else {
    notes.push("Številke rezervacije ni bilo mogoče prepoznati — vpiši jo iz potrdila.");
  }

  const priceEur = detectPriceEur(raw);
  if (priceEur) notes.push(`Cena prepoznana: ${priceEur} EUR.`);
  else notes.push("Cene ni bilo mogoče prepoznati — vpiši jo iz potrdila.");

  const dates = detectDates(raw);
  const range = detectDateRange(dates);
  if (range) {
    notes.push(
      range.end
        ? `Datuma prepoznana: ${range.start} → ${range.end}.`
        : `Datum prepoznan: ${range.start}.`
    );
  } else {
    notes.push("Datuma ni bilo mogoče prepoznati — vpiši ga ročno.");
  }

  const guests = detectGuests(raw);
  const titleCandidate = detectTitleCandidate(raw);

  return {
    providerId: provider?.providerId ?? null,
    providerName: provider?.providerName ?? null,
    providerMatchedFrom: provider?.matchedFrom ?? null,
    bookingRef,
    priceEur,
    dateStartIso: range?.start ?? null,
    dateEndIso: range?.end ?? null,
    guests,
    titleCandidate,
    notes,
  };
}
