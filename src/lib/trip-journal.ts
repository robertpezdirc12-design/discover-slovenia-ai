/**
 * TRIP JOURNAL — skupnostni potni dnevnik (F12 iz izvirnika 1.163.4,
 * rekonstrukcija glej docs/recovery/schema-1.163.4.prisma:329-350
 * `TripDiaryEntry` + docs/RECOVERY-MODEL-MATRIX.md: "kandidat za prihodnjo
 * fazo"). IZVIRNIKOV KANON (Stippl "travel reel/photobook"):
 *
 *   - TEXTOVNI spomini BREZ slik — "naš pošteni tekstovni pristop BREZ
 *     slik: zasebnost + ni stroškov shrambe";
 *   - natisnjena stran = "photobook" (vnosi so namenoma PRINTLJIVI);
 *   - polja izvirnika: dayIndex (1-based dan, null = splošno), placeName
 *     (kraj spomina, 1–80), rating (1–5 zvezdic, null = brez ocene),
 *     text (2–2000 znakov — spomin sam);
 *   - "edini lahko ureja izbriše" = avtor (mostovno: avtor ALI lastnik
 *     poti — isti vzorec kot ankete).
 *
 * MOSTOVNA prirejena 48-a (isti most kot klepet): avtorstvo je vezano na
 * PRIJAVLJEN račun (authorId + authorName posnetek) namesto anonimnega
 * authorClientId iz izvirnika; vlogo potrjuje strežnik.
 *
 * Čista logika (0 mreže, 0 db) — enotsko testirana v
 * tests/trip-journal.test.ts. API ruta: src/app/api/trips/[shareId]/journal.
 */

import { sanitizeUntrustedText } from "@/lib/system-data-guard";

/** Meje izvirnika 1.163.4 (F12) — niso naše izmišljije. */
export const JOURNAL_TEXT_MIN = 2;
export const JOURNAL_TEXT_MAX = 2000;
export const JOURNAL_PLACE_MAX = 80;
export const JOURNAL_RATING_MIN = 1;
export const JOURNAL_RATING_MAX = 5;
/** Zgodovina dnevnika — isti gorovni limit kot klepet (zadnjih 200). */
export const JOURNAL_HISTORY_LIMIT = 200;

/** Normaliziran vnos dnevnika (po validaciji — vse ostalo je napaka). */
export interface JournalInput {
  /** Spomin sam (2–2000 znakov, večvrstičen). */
  text: string;
  /** 1-based dan načrta; null = splošen vnos (izvirnik: dayIndex Int?). */
  dayIndex: number | null;
  /** Kraj spomina (1–80 znakov); null = ni podan (izvirnik: placeName?). */
  placeName: string | null;
  /** Ocena 1–5 zvezdic; null = brez ocene (izvirnik: rating Int?). */
  rating: number | null;
}

export type JournalParseResult =
  | { ok: true; value: JournalInput }
  | { ok: false; error: string };

/** Stroga celoštevilska preverba (niz "3" NI dan — klient pošilja JSON). */
function isStrictInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

/** Ali je vnos "na voljo" v delnem (PATCH) vnosu — prisoten IN ne-null?
 * null pomeni IZRECNO brisanje opcijskega polja (npr. "odstrani oceno"). */
function hasField(raw: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

/** Oceni in očisti TEXT spomina (P0-I §23: uporabniški vnos — nadzorni/
 * zero-width/bidi znaki se odstranijo; večvrstična struktura ostane;
 * meja velja PO čiščenju). */
export function sanitizeJournalText(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeUntrustedText(input.trim(), {
    maxLen: null,
    collapseWhitespace: false,
    fallback: "",
  });
}

/** Očisti KRAJ spomina (eno-vrstični prost tekst). NAMERNO BREZ obreževanja
 * (maxLen: null) — meja 1–80 se v parse* javi kot NAPAKA, da avtor lahko
 * popravi (utišano odrezovanje bi presenetilo pisca: "Ljubljan" …). */
export function sanitizeJournalPlace(input: unknown): string {
  if (typeof input !== "string") return "";
  return sanitizeUntrustedText(input.trim(), {
    maxLen: null,
    collapseWhitespace: true,
    fallback: "",
  });
}

/** Validacija CELOTEGA vnosa (POST). Napaka = slovensko sporočilo (kanon
 * API napak). Polja so obvezna natanko takrat, ko so v izvirniku:
 * text vedno; dayIndex/placeName/rating so opcijska (null dovoljen). */
export function parseJournalInput(raw: unknown): JournalParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Neveljaven zahtevek (pričakovan predmet)." };
  }
  const body = raw as Record<string, unknown>;

  const text = sanitizeJournalText(body.text);
  if (text.length < JOURNAL_TEXT_MIN || text.length > JOURNAL_TEXT_MAX) {
    return {
      ok: false,
      error: `Spomin mora imeti med ${JOURNAL_TEXT_MIN} in ${JOURNAL_TEXT_MAX} znakov.`,
    };
  }

  let dayIndex: number | null = null;
  if (body.dayIndex !== null && body.dayIndex !== undefined && body.dayIndex !== "") {
    if (!isStrictInt(body.dayIndex) || body.dayIndex < 1) {
      return { ok: false, error: "Dan mora biti celo število ≥ 1 (ali manjka za splošen vnos)." };
    }
    dayIndex = body.dayIndex;
  }

  let placeName: string | null = null;
  const place = sanitizeJournalPlace(body.placeName);
  if (place.length > 0) {
    if (place.length > JOURNAL_PLACE_MAX) {
      return {
        ok: false,
        error: `Kraj spomina ima največ ${JOURNAL_PLACE_MAX} znakov (trenutno ${place.length}).`,
      };
    }
    placeName = place;
  }

  let rating: number | null = null;
  if (body.rating !== null && body.rating !== undefined && body.rating !== "") {
    if (!isStrictInt(body.rating) || body.rating < JOURNAL_RATING_MIN || body.rating > JOURNAL_RATING_MAX) {
      return {
        ok: false,
        error: `Ocena mora biti med ${JOURNAL_RATING_MIN} in ${JOURNAL_RATING_MAX} (ali manjka).`,
      };
    }
    rating = body.rating;
  }

  return { ok: true, value: { text, dayIndex, placeName, rating } };
}

export type JournalPatchResult =
  | { ok: true; patch: Partial<JournalInput> }
  | { ok: false; error: string };

/** Validacja DELNEGA vnosa (PATCH — urejanje lastnega vpisa). Prisotna
 * polja se validirajo in posodobijo; odsotna polja ostanejo nespremenjena.
 * Izrecni null na opcijskem polju ga POČISTI (npr. "odstrani oceno").
 * Text je v PATCH opcijski, a če je prisoten, veljajo iste meje. */
export function parseJournalPatch(raw: unknown): JournalPatchResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Neveljaven zahtevek (pričakovan predmet)." };
  }
  const body = raw as Record<string, unknown>;
  const patch: Partial<JournalInput> = {};

  if (hasField(body, "text")) {
    const text = sanitizeJournalText(body.text);
    if (text.length < JOURNAL_TEXT_MIN || text.length > JOURNAL_TEXT_MAX) {
      return {
        ok: false,
        error: `Spomin mora imeti med ${JOURNAL_TEXT_MIN} in ${JOURNAL_TEXT_MAX} znakov.`,
      };
    }
    patch.text = text;
  }

  if (hasField(body, "dayIndex")) {
    if (body.dayIndex === null || body.dayIndex === "") {
      patch.dayIndex = null;
    } else if (!isStrictInt(body.dayIndex) || body.dayIndex < 1) {
      return { ok: false, error: "Dan mora biti celo število ≥ 1 (ali null za splošen vnos)." };
    } else {
      patch.dayIndex = body.dayIndex;
    }
  }

  if (hasField(body, "placeName")) {
    const place = sanitizeJournalPlace(body.placeName);
    if (place.length > JOURNAL_PLACE_MAX) {
      return {
        ok: false,
        error: `Kraj spomina ima največ ${JOURNAL_PLACE_MAX} znakov (trenutno ${place.length}).`,
      };
    }
    patch.placeName = place.length > 0 ? place : null;
  }

  if (hasField(body, "rating")) {
    if (body.rating === null || body.rating === "") {
      patch.rating = null;
    } else if (
      !isStrictInt(body.rating) ||
      body.rating < JOURNAL_RATING_MIN ||
      body.rating > JOURNAL_RATING_MAX
    ) {
      return {
        ok: false,
        error: `Ocena mora biti med ${JOURNAL_RATING_MIN} in ${JOURNAL_RATING_MAX} (ali null).`,
      };
    } else {
      patch.rating = body.rating;
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Ni sprememb — podaj vsaj eno polje za urejanje." };
  }

  return { ok: true, patch };
}

/** Vrstica iz baze (najmanjši skupni imenovalec — ruta podaja Prisma
 * vnos; tu ga tipiziramo strukturno, brez Prisma odvisnosti). */
export interface JournalRow {
  id: string;
  authorId: string | null;
  authorName: string;
  dayIndex: number | null;
  placeName: string | null;
  rating: number | null;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedJournalEntry {
  id: string;
  authorId: string | null;
  authorName: string;
  /** Ali je prijavljeni gledalec avtor vpisa (edini ureja/izbriše)? */
  mine: boolean;
  dayIndex: number | null;
  placeName: string | null;
  rating: number | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

/** SerIALIZACIJA za klienta — `mine` odloča Uredi/Izbriši gumbe in je
 * STREŽNIŠKA resnica (klient je ne more ponarediti; vlogo prav tako ne). */
export function serializeJournalEntry(
  row: JournalRow,
  viewerId: string | null
): SerializedJournalEntry {
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    mine: viewerId !== null && row.authorId === viewerId,
    dayIndex: row.dayIndex,
    placeName: row.placeName,
    rating: row.rating,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Ali sme gledalec UREDITI/IZBRISATI vpis? Izvirni kanon: "ID pisca —
 * edini lahko ureja izbriše". Mostovno: avtor ALI lastnik poti (isti
 * vzorec moderacije kot ankete — lastnik je skrbnik skupnosti na poti). */
export function canModifyEntry(
  rowAuthorId: string | null,
  viewerId: string | null,
  viewerIsOwner: boolean
): boolean {
  if (viewerId === null) return false;
  return rowAuthorId === viewerId || viewerIsOwner;
}
