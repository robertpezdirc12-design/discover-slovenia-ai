/**
 * STO INGEST — strežniški runner (P0-C).
 *
 * Pobere vseh 7 jezikovnih različic uradnega vodnika s slovenia.info
 * (llms.txt vir, živ in javen), jih zreže z determinističnim parserjem
 * in zapiše canonical data/sto-content.json.
 *
 * UPORABLJAJO:
 *  · `bun run sto:ingest` (scripts/sto-ingest.ts — ročno/CI),
 *  · `/api/cron/sto-reingest` (tedenski cron, torek 7:30 UTC — vercel.json).
 *
 * KANON ISKRENOSTI:
 *  · napaka posameznega jezika ne zaustavi ostalih (partial) — poročilo
 *    pove natanko kateri jezik in zakaj;
 *  · VSI jeziki odpovejo → status „error", datoteka SE NE PREPIŠE
 *    (prejšnja dobra množica ostane);
 *  · datotečni sistem samo za branje (serverless) → iskren writeError
 *    v poročilu, brez lažnega uspeha;
 *  · brez skrivnosti: vir je javen, 0 poverilnic, 0 žetonov.
 */

import { mkdir, writeFile } from "node:fs/promises";

import {
  STO_LLMS_INDEX_URL,
  STO_LLMS_LANGUAGE_SOURCES,
  flattenEntries,
  parseLlmsTxt,
  type StoContentEntry,
} from "./llms-source";
import type { StoDataset } from "./content";

// ── Vrste ──────────────────────────────────────────────────────────────────

export type FetchLike = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

/** Poročilo o enem jeziku. */
export interface StoLanguageReport {
  language: string;
  url: string;
  ok: boolean;
  entries: number;
  skippedLines: number;
  /** Razlog napake (samo kadar ok = false). */
  reason?: string;
}

/** Poročilo celotnega ingesta. */
export interface StoIngestReport {
  status: "ok" | "partial" | "error";
  fetchedAt: string;
  source: string;
  languages: StoLanguageReport[];
  totalEntries: number;
  /** Pot zapisane datoteke (samo ob uspešnem zapisu). */
  wroteFile?: string;
  /** Iskrena napaka zapisa (npr. samo-za-branje FS na serverless). */
  writeError?: string;
}

// ── Runner ─────────────────────────────────────────────────────────────────

/** Pobere in zreže en jezik (vrne poročilo + vnose). */
async function ingestLanguage(
  source: { language: string; url: string },
  fetchLike: FetchLike
): Promise<{ report: StoLanguageReport; entries: StoContentEntry[]; title: string; intro: string }> {
  try {
    const res = await fetchLike(source.url, {
      headers: { "user-agent": "discover-slovenia-ai/2.x (sto-ingest)" },
    });
    if (!res.ok) {
      return {
        report: {
          language: source.language,
          url: source.url,
          ok: false,
          entries: 0,
          skippedLines: 0,
          reason: `HTTP ${res.status}`,
        },
        entries: [],
        title: "",
        intro: "",
      };
    }
    const text = await res.text();
    const parsed = parseLlmsTxt(text);
    const entries = flattenEntries(source.language, parsed);
    return {
      report: {
        language: source.language,
        url: source.url,
        ok: true,
        entries: entries.length,
        skippedLines: parsed.skippedLines,
      },
      entries,
      title: parsed.title,
      intro: parsed.intro,
    };
  } catch (err) {
    return {
      report: {
        language: source.language,
        url: source.url,
        ok: false,
        entries: 0,
        skippedLines: 0,
        reason: err instanceof Error ? err.message : "neznana napaka",
      },
      entries: [],
      title: "",
      intro: "",
    };
  }
}

/**
 * Izvedi celoten STO ingest. Deterministično zaporedje jezikov (register
 * vrstni red) → canonical vrstni red vnosov v datoteki.
 */
export async function runStoIngest(opts: {
  fetchLike?: FetchLike;
  dataDir?: string;
  now?: () => Date;
} = {}): Promise<StoIngestReport> {
  const fetchLike = opts.fetchLike ?? ((url, init) => fetch(url, init));
  const dataDir = opts.dataDir ?? "data";
  const now = opts.now ?? (() => new Date());

  const results = await Promise.all(
    STO_LLMS_LANGUAGE_SOURCES.map((s) => ingestLanguage(s, fetchLike))
  );

  const languages: StoLanguageReport[] = results.map((r) => r.report);
  const entries: StoContentEntry[] = results.flatMap((r) => r.entries);
  const okCount = languages.filter((l) => l.ok).length;

  const report: StoIngestReport = {
    status: okCount === 0 ? "error" : okCount === languages.length ? "ok" : "partial",
    fetchedAt: now().toISOString(),
    source: STO_LLMS_INDEX_URL,
    languages,
    totalEntries: entries.length,
  };

  // Vsi jeziki odpovedali → NE prepisuj prejšnje dobre množice.
  if (report.status === "error") return report;

  const dataset: StoDataset = {
    source: report.source,
    fetchedAt: report.fetchedAt,
    languages: results
      .filter((r) => r.report.ok)
      .map((r) => ({
        language: r.report.language,
        title: r.title,
        intro: r.intro,
        entryCount: r.report.entries,
      })),
    entries,
  };

  try {
    await mkdir(dataDir, { recursive: true });
    const file = `${dataDir}/sto-content.json`;
    await writeFile(file, JSON.stringify(dataset, null, 1) + "\n", "utf8");
    report.wroteFile = file;
  } catch (err) {
    // Serverless (samo-za-branje FS): iskreno zapiši razlog v poročilo.
    report.writeError =
      err instanceof Error ? err.message : "napaka zapisa datoteke";
  }

  return report;
}
