/**
 * FSQ LOADER — strežniško branje lokalne množice (P0-C).
 *
 * Bere *.jsonl iz data/fsq-places/ (privzeto; preglasi z FSQ_PLACES_DIR
 * v strežniškem sloju — lib NE bere process.env, kanon activation-check).
 * Brez omrežja: množica je lokalna (Apache-2.0, z atribucijo).
 *
 * Iskrena stanja:
 *  · „missing" — mapa ne obstaja (množica še ni nameščena — P0-C čaka vir);
 *  · „empty"   — mapa obstaja, a ni veljavnih POI;
 *  · „ok"      — množica naložena, validirana, deduplicirana + statistika.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  emptyFsqStats,
  summarizeFsqPlaces,
  validateFsqLine,
  type FsqManifest,
  type FsqPlace,
} from "./dataset";

export type FsqLoadResult =
  | {
      status: "ok";
      places: FsqPlace[];
      manifest: FsqManifest | null;
      stats: ReturnType<typeof summarizeFsqPlaces>;
    }
  | { status: "missing" }
  | { status: "empty"; stats: ReturnType<typeof emptyFsqStats> };

/** Naloži in validiraj celotno lokalno množico (deterministično). */
export async function loadFsqDataset(
  dir: string = "data/fsq-places"
): Promise<FsqLoadResult> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return { status: "missing" };
  }

  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl")).sort();
  if (jsonlFiles.length === 0) {
    return { status: "empty", stats: emptyFsqStats() };
  }

  const seen = new Set<string>();
  const places: FsqPlace[] = [];
  let invalidLines = 0;
  let duplicateIds = 0;

  for (const file of jsonlFiles) {
    let raw: string;
    try {
      raw = await readFile(join(dir, file), "utf8");
    } catch {
      invalidLines += 1; // nepreberljiva datoteka — iskren števec
      continue;
    }
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        invalidLines += 1;
        continue;
      }
      const v = validateFsqLine(parsed);
      if (!v.ok) {
        invalidLines += 1;
        continue;
      }
      if (seen.has(v.place.fsq_id)) {
        duplicateIds += 1;
        continue;
      }
      seen.add(v.place.fsq_id);
      places.push(v.place);
    }
  }

  // Manifest (provenance) — neobvezen, a izpisan kadar obstaja.
  let manifest: FsqManifest | null = null;
  try {
    const rawManifest = await readFile(join(dir, "manifest.json"), "utf8");
    const m = JSON.parse(rawManifest) as FsqManifest;
    if (typeof m.snapshotDate === "string" && typeof m.total === "number") {
      manifest = m;
    }
  } catch {
    // Brez manifesta — množica še vedno veljavna, provenance neznan (iskreno).
  }

  if (places.length === 0) {
    return { status: "empty", stats: summarizeFsqPlaces([], invalidLines, duplicateIds) };
  }

  return {
    status: "ok",
    places,
    manifest,
    stats: summarizeFsqPlaces(places, invalidLines, duplicateIds),
  };
}
