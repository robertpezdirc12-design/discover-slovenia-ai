/**
 * FSQ INGEST CLI — `bun run fsq:ingest --raw-dir <dir>` (P0-C).
 *
 * Determinističen pretvorba surovega dumpa Foursquare Open Places
 * (source.coop / fused.io izvoz, .jsonl) v canonical množico:
 *  · samo potovalno-relevantne kategorije (nastanitve, hrana, atrakcije,
 *    plaže, črpalke … — kanon izvirnikovega README);
 *  · vsaka vrstica gre skozi validateFsqLine (geo bbox države, shema);
 *  · dedupe po fsq_id, sortiran izhod (isti vhod → ista datoteka);
 *  · manifest.json s provenance (licenca, vir, snapshot, števci).
 *
 * IZHOD: data/fsq-places/places.jsonl + manifest.json
 *  · status 0 — zapisano (četudi z zavrnjenimi vrsticami — poročilo pove);
 *  · status 1 — surovi vir ni berljiv / 0 veljavnih POI (nič ne zapišemo).
 *
 * PRIMER:
 *   bun run fsq:ingest --raw-dir ./downloads/fsq-si-hr-me-al \
 *     --snapshot-date 2025-02-06
 */

import { mkdir, writeFile } from "node:fs/promises";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  FSQ_ATTRIBUTION,
  validateFsqLine,
  type FsqPlace,
} from "../src/lib/supply/providers/fsq/dataset";

// ── Preslikava surovih kategorij → kanonske (deterministično) ─────────────

/** Ključne besede kategorij FSQ Open Places → kanon 2.x (po vrsti = prioriteta). */
const CATEGORY_RULES: readonly { category: string; re: RegExp }[] = [
  { category: "hotel", re: /hotel|hostel|resort|motel|inn\b|guest house|bed & breakfast|bnb|vacation rental|apartment|camping|campground/i },
  { category: "restaurant", re: /restaurant|dining|pizza|bistro|steakhouse|seafood/i },
  { category: "cafe", re: /caf[eé]|coffee|tea room|bakery|patisserie/i },
  { category: "bar", re: /\bbar\b|pub|brewery|wine bar|cocktail/i },
  { category: "museum", re: /museum|gallery|exhibition/i },
  { category: "attraction", re: /tourist attraction|landmark|monument|castle|church|cathedral|viewpoint|observation|zoo|aquarium|theme park|amusement/i },
  { category: "sight", re: /sight|histori|memorial|synagogue|mosque|temple|ruins|fort/i },
  { category: "beach", re: /beach|lake\b|swimming/i },
  { category: "fuel", re: /gas station|fuel|petrol/i },
  { category: "park", re: /park\b|garden|playground|recreation|national park/i },
  { category: "nature", re: /nature|mountain|trail|hiking|cave|waterfall|forest|spring/i },
];

/** Združi surove kategorije FSQ zapisa v eno kanonsko (ali null). */
function mapCategories(
  rawCategories: unknown
): string | null {
  const names: string[] = [];
  if (Array.isArray(rawCategories)) {
    for (const c of rawCategories) {
      if (typeof c === "string") names.push(c);
      else if (c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string") {
        names.push((c as { name: string }).name);
      }
    }
  } else if (typeof rawCategories === "string") {
    names.push(rawCategories);
  }
  if (names.length === 0) return null;
  const joined = names.join(", ");
  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(joined)) return rule.category;
  }
  return null;
}

// ── CLI ────────────────────────────────────────────────────────────────────

function argValue(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

const rawDir = argValue("--raw-dir");
const outDir = argValue("--out-dir") ?? "data/fsq-places";
const snapshotDate = argValue("--snapshot-date") ?? new Date().toISOString().slice(0, 10);

if (!rawDir) {
  console.error("UPORABA: bun run fsq:ingest --raw-dir <dir> [--out-dir dir] [--snapshot-date YYYY-MM-DD]");
  process.exit(1);
}

// Preberi surove .jsonl datoteke (po imenu — deterministično).
let rawFiles: string[];
try {
  rawFiles = (await readdir(rawDir)).filter((f) => f.endsWith(".jsonl")).sort();
} catch (err) {
  console.error(`SUROVI VIR NI BERLJIV: ${rawDir} (${err instanceof Error ? err.message : "?"})`);
  process.exit(1);
}
if (rawFiles.length === 0) {
  console.error(`SUROVI VIR JE PRAZEN (0 .jsonl v ${rawDir}) — nič ni zapisano.`);
  process.exit(1);
}

const seen = new Set<string>();
const places: FsqPlace[] = [];
let totalLines = 0;
let invalidLines = 0;
let nonTravel = 0;
let duplicates = 0;

for (const file of rawFiles) {
  const raw = await readFile(join(rawDir, file), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    totalLines += 1;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      invalidLines += 1;
      continue;
    }

    // Preslikava kategorij (kanon) + država (FSQ uporablja country/country_code).
    const category = mapCategories(parsed.categories ?? parsed.category);
    const countryRaw = parsed.country ?? parsed.country_code;
    if (typeof countryRaw !== "string") {
      invalidLines += 1;
      continue;
    }

    if (category === null) {
      nonTravel += 1;
      continue;
    }

    const v = validateFsqLine({
      ...parsed,
      fsq_id: parsed.fsq_id ?? parsed.id,
      country: countryRaw.toUpperCase(),
      category,
    });
    if (!v.ok) {
      invalidLines += 1;
      continue;
    }
    if (seen.has(v.place.fsq_id)) {
      duplicates += 1;
      continue;
    }
    seen.add(v.place.fsq_id);
    places.push(v.place);
  }
}

console.log("FSQ INGEST — Foursquare Open Places (Apache-2.0, z atribucijo)");
console.log("=".repeat(60));
console.log(`  Surovi vir:    ${rawDir} (${rawFiles.length} datotek, ${totalLines} vrstic)`);
console.log(`  Zavrnjene:     ${invalidLines} neveljavnih + ${nonTravel} nepotovalnih + ${duplicates} duplikatov`);

const byCountry: Record<string, number> = {};
for (const p of places) byCountry[p.country] = (byCountry[p.country] ?? 0) + 1;
for (const c of Object.keys(byCountry).sort()) {
  console.log(`  ${c}: ${byCountry[c]} POI`);
}
console.log(`  SKUPAJ:        ${places.length} POI`);

if (places.length === 0) {
  console.error("  0 VELJAVNIH POI — nič ni zapisano.");
  process.exit(1);
}

// Sortiraj (deterministično) + zapiši .jsonl + manifest.
places.sort((a, b) => (a.fsq_id < b.fsq_id ? -1 : a.fsq_id > b.fsq_id ? 1 : 0));

await mkdir(outDir, { recursive: true });
const jsonl = places.map((p) => JSON.stringify(p)).join("\n") + "\n";
await writeFile(join(outDir, "places.jsonl"), jsonl, "utf8");

const manifest = {
  snapshotDate,
  source: "Foursquare Open Places (source.coop / fused.io)",
  license: "Apache-2.0 (z atribucijo)",
  attribution: FSQ_ATTRIBUTION,
  ingestedAt: new Date().toISOString(),
  counts: byCountry,
  total: places.length,
};
await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log("-".repeat(60));
console.log(`  ZAPISANO: ${outDir}/places.jsonl + manifest.json (snapshot ${snapshotDate})`);
console.log(`  Atribucija: ${FSQ_ATTRIBUTION}`);
process.exit(0);
