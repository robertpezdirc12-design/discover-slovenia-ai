/**
 * STO VSEBINA — nalagalnik ingescirane množice + deterministično iskanje
 * (P0-C). Strežniški sloj: bere data/sto-content.json (zapisal
 * scripts/sto-ingest.ts ali /api/cron/sto-reingest).
 *
 * KANON ISKRENOSTI:
 *  · datoteka manjka / je neveljavna → status „missing"/„invalid" z
 *    razlogom — NIKDII prazni rezultati, ki bi izgledali kot „ni zadetkov";
 *  · iskanje je ČISTO in deterministično (isti vhod → isti izhod, vrstni
 *    red vezan na canonical index množice);
 *  · vsak rezultat nosi atribucijo vira (STO_ATTRIBUTION).
 */

import { readFile } from "node:fs/promises";

import {
  STO_ATTRIBUTION,
  type StoContentEntry,
} from "./llms-source";

// ── Množica (datotečna oblika) ─────────────────────────────────────────────

export const STO_CONTENT_FILE = "data/sto-content.json";

/** Metadata jezika znotraj množice. */
export interface StoLanguageMeta {
  language: string;
  title: string;
  intro: string;
  entryCount: number;
}

/** Canonical oblika data/sto-content.json. */
export interface StoDataset {
  source: string;
  fetchedAt: string;
  languages: StoLanguageMeta[];
  entries: StoContentEntry[];
}

// ── Nalagalnik (strežniški, iskren) ────────────────────────────────────────

export type StoLoadResult =
  | { status: "ok"; dataset: StoDataset }
  | { status: "missing" }
  | { status: "invalid"; reason: string };

/** Preveri obliko razrezanega JSON-a (fail-closed, z razlogom). */
function validateDataset(raw: unknown): { ok: true; dataset: StoDataset } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "koren ni objekt" };
  }
  const d = raw as Record<string, unknown>;
  if (typeof d.source !== "string" || d.source.length === 0) {
    return { ok: false, reason: "manjka source" };
  }
  if (typeof d.fetchedAt !== "string" || Number.isNaN(Date.parse(d.fetchedAt))) {
    return { ok: false, reason: "manjka/napačen fetchedAt" };
  }
  if (!Array.isArray(d.languages) || d.languages.length === 0) {
    return { ok: false, reason: "languages ni neprazno polje" };
  }
  if (!Array.isArray(d.entries)) {
    return { ok: false, reason: "entries ni polje" };
  }
  for (const e of d.entries) {
    if (
      typeof e !== "object" ||
      e === null ||
      typeof (e as StoContentEntry).language !== "string" ||
      typeof (e as StoContentEntry).section !== "string" ||
      typeof (e as StoContentEntry).title !== "string" ||
      typeof (e as StoContentEntry).url !== "string" ||
      typeof (e as StoContentEntry).description !== "string"
    ) {
      return { ok: false, reason: "vnos entries ne ustreza obliki" };
    }
  }
  return { ok: true, dataset: d as unknown as StoDataset };
}

/**
 * Naloži ingescirano STO vsebino. Iskreno: manjkajoča datoteka NI napaka —
 * plast ima svoj ingest (`bun run sto:ingest`) in matrika to pove.
 */
export async function loadStoContent(
  dataDir: string = "data"
): Promise<StoLoadResult> {
  let raw: string;
  try {
    raw = await readFile(`${dataDir}/sto-content.json`, "utf8");
  } catch {
    return { status: "missing" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      status: "invalid",
      reason: `JSON napaka: ${err instanceof Error ? err.message : "neznana"}`,
    };
  }
  const v = validateDataset(parsed);
  if (!v.ok) return { status: "invalid", reason: v.reason };
  return { status: "ok", dataset: v.dataset };
}

// ── Iskanje (čisto, deterministično) ───────────────────────────────────────

/** Normalizacija za iskanje: male črke + zloži diakritike (č→c, ž→z …). */
export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // ločila (é→e, č→c po NFD razpadu)
    .replace(/[đ]/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ocenjen zadetek (ocena deterministicna, višja = bolj relevantno). */
export interface StoSearchHit {
  entry: StoContentEntry;
  score: number;
}

export interface StoSearchOptions {
  /** Omeji na en jezik (npr. "sl"); izpuščeno = vsi jeziki. */
  language?: string;
  /** Največje število zadetkov (privzeto 12). */
  limit?: number;
}

// ── Ujemanje gesel (slovenske sklonske oblike) ─────────────────────────────

/** Min dolžina krajšega gesla pri ujemanju predpon (preprečuje smet). */
const PREFIX_MIN_LENGTH = 4;

/** Vrsta ujemanja gesla v besedilu (od najmočnejšega). */
type MatchKind = "exact-word" | "prefix-word" | "substring" | null;

/**
 * Ujemanje gesla na besedilu PO BESEDAH — pokriva slovenske sklane
 * („blede“ najde „Bled“; „poti“ najde „poteh“): natančna beseda >
 * predponska beseda (krajša stran ≥ 4 znake) > podniz.
 * Deterministično, brez omrežja.
 */
function matchToken(token: string, text: string): MatchKind {
  if (text.length === 0) return null;
  if (text === token) return "exact-word";
  const words = text.split(" ").filter(Boolean);
  if (words.includes(token)) return "exact-word";
  for (const word of words) {
    const krajsi = Math.min(word.length, token.length);
    if (krajsi < PREFIX_MIN_LENGTH) continue;
    if (word.startsWith(token) || token.startsWith(word)) {
      return "prefix-word";
    }
  }
  if (text.includes(token)) return "substring";
  return null;
}

/** Ocene po vrsti ujemanja (naslov > opis > odsek). */
const SCORES: Readonly<
  Record<Exclude<MatchKind, null>, { title: number; description: number; section: number }>
> = Object.freeze({
  "exact-word": { title: 100, description: 20, section: 10 },
  "prefix-word": { title: 70, description: 14, section: 7 },
  substring: { title: 45, description: 8, section: 4 },
});

/**
 * Deterministično iskanje po uradni vsebini. Vsa gesla poizvedbe se
 * morajo zadeti (AND); ocena se sešteva po mestu in vrsti zadetka:
 * naslov > opis > odsek, natančna beseda > predponska > podniz.
 * Istoocenjeni zadetki ostanejo v canonical vrstnem redu množice
 * (stabilna ureditev — nikoli naključno).
 */
export function searchStoContent(
  query: string,
  entries: readonly StoContentEntry[],
  opts: StoSearchOptions = {}
): StoSearchHit[] {
  const limit = opts.limit && opts.limit > 0 ? opts.limit : 12;
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) return [];

  const tokens = normalizedQuery.split(" ").filter((t) => t.length > 0);
  if (tokens.length === 0) return [];

  const hits: StoSearchHit[] = [];
  entries.forEach((entry, index) => {
    if (opts.language && entry.language !== opts.language) return;

    const title = normalizeSearchText(entry.title);
    const description = normalizeSearchText(entry.description);
    const section = normalizeSearchText(entry.section);

    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const inTitle = matchToken(token, title);
      const inDescription = matchToken(token, description);
      const inSection = matchToken(token, section);
      if (!inTitle && !inDescription && !inSection) {
        matchedAll = false;
        break;
      }
      // Seštevek po poljih (geslo lahko zadene več polj).
      if (inTitle) score += SCORES[inTitle].title;
      if (inDescription) score += SCORES[inDescription].description;
      if (inSection) score += SCORES[inSection].section;
    }
    if (matchedAll && score > 0) {
      // Stabilna ureditev: canonical index kot sekundarni ključ.
      hits.push({ entry, score: score + index / 10000 });
    }
  });

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

export { STO_ATTRIBUTION };
export type { StoContentEntry } from "./llms-source";
