/**
 * DETERMINISTIC-ITINERARY — naravna deterministična pot načrta (P0-D).
 *
 * RECOVER + RECONCILE: naslednik lib/deterministic-itinerary.ts
 * izvirnika (1.87.0, izgubljen ob varnostnem incidentu 2026-10-06).
 *
 * Kanon izvirnika:
 *  · „isti vhod → isti načrt, 0 AI žetonov" — ta modul to izreká
 *    IZRIČNO: vsak načrt, ki gre skozenj, nosi engine="deterministic"
 *    in prstni odtis (fingerprint), ki ga testi dokazujejo kot
 *    100 % reproducibilnega.
 *  · ISTA validacijska veriga: geo-validacija (validatePlanGeo) teče
 *    nad vsakim načrtom — ni ločene „lažje" poti.
 *
 * RECONCILE z 2.x: v rekonstrukciji 2.x NE OBSTOJA AI pot (tudi klepet
 * je determinističen) — zato izvirnikovo stikalo „Z AI / Brez AI" NIMA
 * pomena in je namenoma NE obnovljeno (lažna izbira bi bila neiskrena).
 * Ta modul je ena sama, 100 % deterministična pot.
 *
 * ČISTA LOGIKA — brez process.env, brez db, brez omrežja, brez ure
 * (nobenih Date.now vodič — determinizem je totalen).
 */

import {
  buildItinerary,
  validatePlanGeo,
  type GeoValidation,
  type PlannerLang,
  type PlannerQuery,
} from "./itinerary-engine";
import type { ItineraryPlan } from "./types";

// ── Zapisnika engine identitete ────────────────────────────────────────────

/** Enota motorja — v 2.x izključno deterministični. */
export type ItineraryEngine = "deterministic";

export const DETERMINISTIC_ENGINE: ItineraryEngine = "deterministic";

// ── Prstni odtis (dokazljiv determinizem) ──────────────────────────────────

/**
 * Stabilna serializacija načrta: ključi objektov urejeni po abecedi,
 * polja po vrsti, brez identitet objektov. Izhod je vedno ista
 * niza za isti načrt — podlaga za prstni odtis.
 */
export function canonicalPlanJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalPlanJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalPlanJson(obj[k])}`)
    .join(",")}}`;
}

/** FNV-1a 32-bit — majhen, hiter, determinističen zgoščevalnik (brez crypto). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Prstni odtis načrta — isti načrt → isti odtis (testno zaklenjeno).
 * Ni varnostni zgoščevalnik: služi izključno dokazovanju reproducibilnosti.
 */
export function planFingerprint(plan: ItineraryPlan): string {
  return fnv1a(canonicalPlanJson(plan));
}

// ── Naravna pot ────────────────────────────────────────────────────────────

export interface DeterministicItineraryResult {
  /** Vedno "deterministic" — v 2.x ne obstaja druga pot. */
  engine: ItineraryEngine;
  /** Trditev arhitekture, dokazljiva iz odsotnosti AI klicev v verigi. */
  aiTokensUsed: 0;
  /** Načrt (isti zapis kot buildItinerary). */
  plan: ItineraryPlan;
  /** Geo-validacija (ista veriga — nikoli izpuščena). */
  geo: GeoValidation;
  /** Prstni odtis načrta (isti vhod → isti odtis). */
  fingerprint: string;
}

/**
 * Zgradi načrt po determinističnem jedru in ga opremi z identiteto
 * motorja, geo-validacijo in prstnim odtisom.
 */
export function buildDeterministicItinerary(
  query: PlannerQuery
): DeterministicItineraryResult {
  const plan = buildItinerary(query);
  const geo = validatePlanGeo(plan, query.locale ?? "sl");
  return {
    engine: DETERMINISTIC_ENGINE,
    aiTokensUsed: 0,
    plan,
    geo,
    fingerprint: planFingerprint(plan),
  };
}
