/**
 * KIWITAXI INGEST CLI — `bun run kiwitaxi:ingest --csv <file>` (P0-C).
 *
 * Pretvorba partnerjevega CSV feeda (objavljene cene) v canonical
 * data/kiwitaxi-routes.json. Fail-closed celota:
 *  · ena samec neveljavna vrstica je zabeležena in izpuščena;
 *  · 0 veljavnih rut → datoteka SE NE PREPIŠE (izhod 1);
 *  · brez CSV argumenta → iskren izpis stanja (za cron / runbook).
 *
 * CSV oblika (glava obvezna, vrstni red neobvezen):
 *   from_name,from_country,to_name,to_country,price_eur,vehicle_class,url
 */

import { writeFile, mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";

import {
  KIWITAXI_FEED_SOURCE,
  validateKiwitaxiRoute,
  type KiwitaxiRoute,
} from "../src/lib/supply/providers/kiwitaxi/routes";

function argValue(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

const csvPath = argValue("--csv");
const outDir = argValue("--out-dir") ?? "data";

if (!csvPath) {
  console.log("KIWITAXI INGEST — stanje (brez --csv: nič se ne zgodi)");
  console.log("=".repeat(60));
  console.log("  Feed še ni nameščen — partner CSV se pridobi prek");
  console.log("  affiliate programa (kiwitaxi.com partner pages).");
  console.log("  UPORABA: bun run kiwitaxi:ingest --csv <feed.csv>");
  process.exit(0);
}

let raw: string;
try {
  raw = await readFile(csvPath, "utf8");
} catch (err) {
  console.error(`CSV NI BERLJIV: ${csvPath} (${err instanceof Error ? err.message : "?"})`);
  process.exit(1);
}

const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
if (lines.length < 2) {
  console.error("CSV JE PRAZEN (samo glava) — nič ni zapisano.");
  process.exit(1);
}

// Preberi glavo (podpira tudi BOM).
const header = lines[0]
  .replace(/^\uFEFF/, "")
  .split(",")
  .map((h) => h.trim());
const REQUIRED = ["from_name", "from_country", "to_name", "to_country", "price_eur"];
for (const col of REQUIRED) {
  if (!header.includes(col)) {
    console.error(`MANJKA STOLPEC „${col}" v glavi: ${header.join(",")}`);
    process.exit(1);
  }
}
const idx = (col: string) => header.indexOf(col);

const routes: KiwitaxiRoute[] = [];
const seen = new Set<string>();
let invalid = 0;
let duplicates = 0;

for (const line of lines.slice(1)) {
  const cols = line.split(",").map((c) => c.trim());
  const candidate = {
    fromName: cols[idx("from_name")],
    fromCountry: (cols[idx("from_country")] ?? "").toUpperCase(),
    toName: cols[idx("to_name")],
    toCountry: (cols[idx("to_country")] ?? "").toUpperCase(),
    priceFromEur: Number.parseFloat(cols[idx("price_eur")] ?? ""),
    ...(idx("vehicle_class") >= 0 && cols[idx("vehicle_class")]
      ? { vehicleClass: cols[idx("vehicle_class")] }
      : {}),
    ...(idx("url") >= 0 && cols[idx("url")] ? { url: cols[idx("url")] } : {}),
  };
  const v = validateKiwitaxiRoute(candidate);
  if (!v.ok) {
    invalid += 1;
    continue;
  }
  if (seen.has(v.route.id)) {
    duplicates += 1;
    continue;
  }
  seen.add(v.route.id);
  routes.push(v.route);
}

console.log("KIWITAXI INGEST — partner CSV feed (objavljene cene)");
console.log("=".repeat(60));
console.log(`  Vhod:      ${csvPath} (${lines.length - 1} vrstic)`);
console.log(`  Zavrnjeno: ${invalid} neveljavnih + ${duplicates} duplikatov`);
console.log(`  Veljavno:  ${routes.length} rut`);

if (routes.length === 0) {
  console.error("  0 VELJAVNIH RUT — datoteka NI prepisana.");
  process.exit(1);
}

routes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const dataset = {
  source: KIWITAXI_FEED_SOURCE,
  license: "Objavljene cene partnerja (FROM_PRICE — ni živ citat)",
  ingestedAt: new Date().toISOString(),
  routes,
};

await mkdir(outDir, { recursive: true });
const outFile = `${outDir}/kiwitaxi-routes.json`;
await writeFile(outFile, JSON.stringify(dataset, null, 1) + "\n", "utf8");

const touchingSi = routes.filter(
  (r) => r.fromCountry === "SI" || r.toCountry === "SI"
).length;
console.log("-".repeat(60));
console.log(`  ZAPISANO: ${outFile} (${routes.length} rut, ${touchingSi} se dotika SI)`);
console.log("  Kanon: rute, ki se dotikajo Slovenije + regionalne iz feeda.");
process.exit(0);
