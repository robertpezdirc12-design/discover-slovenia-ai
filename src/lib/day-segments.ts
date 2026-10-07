/**
 * DAY-SEGMENTS — segmentacija dneva Jutro / Popoldan / Večer (P0-D).
 *
 * RECOVER: naslednik lib/day-segments.ts izvirnika (Task 93, izgubljen
 * ob varnostnem incidentu 2026-10-06). Kanon izvirnika ohranjen:
 *
 *  · SEGMENT ODLOČA ZAČETNA URA — „11:00-14:00" je JUTRO, čeprav se
 *    konča popoldan (začetek the postanka določa, kam spada).
 *  · Meje: jutro < 12 ≤ popoldan < 17 ≤ večer (ura 0 je jutro).
 *  · Postanki BREZ razumljive ure podedujejo prejšnji segment
 *    (vrstni red ostane; prvi brez ure → jutro) — nikoli se ne zvržejo.
 *
 * Uporaba: časovnica dneva na /potovanje in /nacrtuj — glava segmenta
 * (DaySegmentHeader) + poštene etape med postanki (LegRow, že obstoječe).
 *
 * ČISTA LOGIKA — brez process.env, brez db, brez omrežja; deterministično.
 */

import type { TripStop } from "./types";

// ── Segmenti in meje ───────────────────────────────────────────────────────

export type DaySegment = "morning" | "afternoon" | "evening";

export const DAY_SEGMENTS: readonly DaySegment[] = [
  "morning",
  "afternoon",
  "evening",
];

/** Ura, pri kateri segment ZAČNE (jutro se začne ob 0). */
export const SEGMENT_START_HOUR: Record<DaySegment, number> = {
  morning: 0,
  afternoon: 12,
  evening: 17,
};

export const DAY_SEGMENT_LABELS: Record<
  DaySegment,
  { sl: string; en: string }
> = {
  morning: { sl: "Jutro", en: "Morning" },
  afternoon: { sl: "Popoldan", en: "Afternoon" },
  evening: { sl: "Večer", en: "Evening" },
};

/** Vrstni red segmentov v dnevu (za sortiranje/prikaz). */
export const DAY_SEGMENT_ORDER: Record<DaySegment, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
};

// ── Preslikave ─────────────────────────────────────────────────────────────

/** Ura → segment (kanon izvirnika: < 12 jutro, < 17 popoldan, sicer večer). */
export function segmentOfHour(hour: number): DaySegment {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Začetna ura časovnega okvirja → segment; null za nerazumljiv vnos.
 * Podpira „9:00", „09:00", „9:00-11:00", „09:00–11:00" (začetek odloča).
 */
export function segmentOfSlot(slot: string | null): DaySegment | null {
  if (typeof slot !== "string") return null;
  const m = slot.match(/(\d{1,2})\s*[:.]\s*\d{2}/);
  if (!m) return null;
  const hour = Number(m[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return segmentOfHour(hour);
}

/**
 * Ali pri tej uri ZAČNE nov segment (glava segmenta v časovnici).
 * Vrne segment, ki se pri tej uri začne (0 → jutro, 12 → popoldan,
 * 17 → večer), sicer null.
 */
export function segmentBoundaryAt(hour: number): DaySegment | null {
  for (const seg of DAY_SEGMENTS) {
    if (SEGMENT_START_HOUR[seg] === hour) return seg;
  }
  return null;
}

// ── Združevanje postankov dneva v skupine ──────────────────────────────────

export interface DaySegmentGroup {
  segment: DaySegment;
  /** Postanki tega segmenta (vrstni red v dnevu ohranjen). */
  stops: TripStop[];
}

/**
 * Postanke dneva združi v skupine po segmentu, V VRSTNEM REDU dneva
 * (kronološko, ne po deklariranem redu segmentov — dan je lahko samo
 * popoldanski). Postanek brez ure podeduje prejšnjo skupino; prvi brez
 * ure pade v jutro. Praazen dan → prazen seznam.
 */
export function buildDaySegments(
  stops: readonly TripStop[]
): DaySegmentGroup[] {
  const groups: DaySegmentGroup[] = [];
  let current: DaySegment | null = null;

  for (const stop of stops) {
    // ura postanka odloča; brez ure podeduje tekoči segment (prvi → jutro)
    const seg = segmentOfSlot(stop.time ?? null) ?? current ?? "morning";
    const last = groups[groups.length - 1];
    if (!last || last.segment !== seg) {
      groups.push({ segment: seg, stops: [stop] });
    } else {
      last.stops.push(stop);
    }
    current = seg;
  }

  return groups;
}
