/**
 * STO LLM-VIR — slovenia.info llms.txt (P0-C, issue §4/§7).
 *
 * RECOVER: naslednik STO ingest plasti izvirnika (izgubljena ob
 * varnostnem incidentu 2026-10-06). Vir je ŽIV in javen — slovenska
 * turistična organizacija objavlja strukturano vsebino posebej za AI
 * asistente (llms.txt standard: H1 naslov, blockquote uvod, ## odseki,
 * `- [naslov](url): opis` vnosi).
 *
 * DEJANSKI VIRI (preverjeno živi 2026-10-07):
 *  · https://www.slovenia.info/llms.txt — indeks (805 B)
 *  · https://www.slovenia.info/sto-llms-{sl,en,de,it,fr,ru,es}.txt — vodniki
 *  · https://www.slovenia.info/sto-llms-stories-{en,de}.txt — zgodbe
 *
 * KANON ISKRENOSTI (issue §32 — README ≠ koda):
 *  · ta modul je ČISTI PARSER — 0 omrežja, 0 fs, determinističen;
 *  · vsaka neveljavna vrstica se izpusti in ŠTEJE (fail-closed, nikoli
 *    izjema, nikoli ugibanje vsebine);
 *  · URL mora biti https in na gostitelju www.slovenia.info — drugače
 *    vnos NE vstopi v množico (preprečuje morebitno zastrupitev vira);
 *  · vir je VSEBINA (opisi, povezave) — NI geo feed: STO nikoli ne
 *    nastopa kot zemljevidska plast (kanon izvirnikove matrike).
 */

// ── Viri (javni, brez poverilnic) ──────────────────────────────────────────

export const STO_LLMS_INDEX_URL = "https://www.slovenia.info/llms.txt";

/** Jezikovne različice uradnega vodnika (7 jezikov, llms.txt indeks). */
export const STO_LLMS_LANGUAGE_SOURCES: readonly {
  language: string;
  url: string;
}[] = Object.freeze([
  { language: "sl", url: "https://www.slovenia.info/sto-llms-sl.txt" },
  { language: "en", url: "https://www.slovenia.info/sto-llms-en.txt" },
  { language: "de", url: "https://www.slovenia.info/sto-llms-de.txt" },
  { language: "it", url: "https://www.slovenia.info/sto-llms-it.txt" },
  { language: "fr", url: "https://www.slovenia.info/sto-llms-fr.txt" },
  { language: "ru", url: "https://www.slovenia.info/sto-llms-ru.txt" },
  { language: "es", url: "https://www.slovenia.info/sto-llms-es.txt" },
]);

/** Dovoljeni gostitelji povezav (zaščita pred zastrupitvijo vira). */
export const STO_ALLOWED_HOSTS: readonly string[] = Object.freeze([
  "www.slovenia.info",
  "slovenia.info",
]);

/** Atribucija vira — izpisuje se ob vsaki uporabi vsebine. */
export const STO_ATTRIBUTION =
  "Vir: Slovenska turistična organizacija — slovenia.info (llms.txt, uradna vsebina)";

// ── Vrste ──────────────────────────────────────────────────────────────────

/** En vnos vsebine: `- [naslov](url): opis` znotraj odseka. */
export interface StoContentEntry {
  /** Jezik vodnika ("sl" | "en" | …). */
  language: string;
  /** Ime odseka (## glava), npr. „Aktivne počitnice". */
  section: string;
  /** Naslov vnosa (besedilo povezave). */
  title: string;
  /** https povezava na www.slovenia.info. */
  url: string;
  /** Kratek uradni opis (za dvopičjem). */
  description: string;
}

/** Rezultat parsanja ene llms.txt datoteke. */
export interface ParsedLlmsFile {
  /** Naslov iz H1 glave. */
  title: string;
  /** Uvod iz blockquote (> vrstica). */
  intro: string;
  /** Odseki z vnosi (po vrsti v datoteki). */
  sections: readonly {
    name: string;
    entries: readonly { title: string; url: string; description: string }[];
  }[];
  /** Skupno število veljavnih vnosov. */
  entryCount: number;
  /** Števec izpuščenih vrstic (neveljavne povezave / popačeni vnosi). */
  skippedLines: number;
}

// ── Parser (determinističen, fail-closed) ──────────────────────────────────

/** Vzorec vnosa: `- [naslov](url)` ali `- [naslov](url): opis`
 *  (opis je po llms.txt standardu neobvezen — tak vnos vstopi s praznim). */
const ENTRY_RE = /^-\s+\[([^\]]+)\]\(([^)]+)\)(?:\s*:\s*(.+))?$/;

/** Preveri, da je URL https in na dovoljenem gostitelju. */
export function isAllowedStoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      (STO_ALLOWED_HOSTS as readonly string[]).includes(u.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Zreži llms.txt vsebino v strukturo. Čista funkcija:
 * isti vhod → isti izhod; popačene vrstice se izpustijo in preštejejo.
 */
export function parseLlmsTxt(raw: string): ParsedLlmsFile {
  // BOM (datoteke slovenia.info se začnejo z U+FEFF) + normalizacija koncov.
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  let title = "";
  let intro = "";
  let skippedLines = 0;
  let entryCount = 0;
  const sections: {
    name: string;
    entries: { title: string; url: string; description: string }[];
  }[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "") continue;

    // H1 naslov (samo prvi).
    if (trimmed.startsWith("# ")) {
      if (!title) title = trimmed.slice(2).trim();
      continue;
    }

    // Blockquote uvod (samo prvi).
    if (trimmed.startsWith(">")) {
      if (!intro) intro = trimmed.replace(/^>\s?/, "").trim();
      continue;
    }

    // Glava odseka.
    if (trimmed.startsWith("## ")) {
      sections.push({
        name: trimmed.slice(3).trim(),
        entries: [],
      });
      continue;
    }

    // Vnos: - [naslov](url) ali - [naslov](url): opis
    const m = ENTRY_RE.exec(trimmed);
    if (m) {
      const [, entryTitle, url, description = ""] = m;
      const cleanTitle = entryTitle.trim();
      const cleanDesc = description.trim();
      if (
        sections.length > 0 &&
        cleanTitle.length > 0 &&
        isAllowedStoUrl(url)
      ) {
        sections[sections.length - 1].entries.push({
          title: cleanTitle,
          url,
          description: cleanDesc,
        });
        entryCount += 1;
      } else {
        // Vnos brez odseka / prazen / nedovoljen URL → izpust in preštej.
        skippedLines += 1;
      }
      continue;
    }

    // Vrstice, ki niso nobena od znanih oblik: samo tiste, ki IZGLEDAJO
    // kot vnosi (začetek „- "), štejejo kot izpuščene — gole povezave
    // indeksne datoteke niso napaka parserja (iskren števec).
    if (/^-\s+/.test(trimmed)) {
      skippedLines += 1;
    }
  }

  return {
    title,
    intro,
    sections: Object.freeze(sections),
    entryCount,
    skippedLines,
  };
}

/** Splošči odseke v canonical vnose za jezik (deterministično po vrsti). */
export function flattenEntries(
  language: string,
  parsed: ParsedLlmsFile
): StoContentEntry[] {
  const out: StoContentEntry[] = [];
  for (const section of parsed.sections) {
    for (const e of section.entries) {
      out.push({
        language,
        section: section.name,
        title: e.title,
        url: e.url,
        description: e.description,
      });
    }
  }
  return out;
}
