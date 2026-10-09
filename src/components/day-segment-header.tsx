/**
 * DAY-SEGMENT-HEADER — glava segmenta dneva (Jutro/Popoldan/Večer).
 *
 * RECOVER: naslednik komponente izvirnika (izgubljena ob incidentu
 * 2026-10-06). Prikazuje glyph, oznako v jeziku lokalnosti in število
 * postankov segmenta — brez izmišljanja ur, ki jih podatki nimajo.
 */

"use client";

import { useLocale } from "next-intl";

import { pick } from "@/lib/i18n-pick";
import {
  DAY_SEGMENT_LABELS,
  type DaySegment,
} from "@/lib/day-segments";

const GLYPH: Record<DaySegment, string> = {
  morning: "☀️",
  afternoon: "🌤️",
  evening: "🌙",
};

/** Množina števca postankov segmenta (SL: ednina/dvojina/množina; EN/IT/DE/FR/ES: ednina/množina). */
function stopsWordOf(l: string, n: number): string {
  if (l === "en") return n === 1 ? "stop" : "stops";
  if (l === "it") return n === 1 ? "tappa" : "tappe";
  if (l === "de") return n === 1 ? "Stopp" : "Stopps";
  if (l === "fr") return n === 1 ? "étape" : "étapes";
  if (l === "es") return n === 1 ? "parada" : "paradas";
  // slovenščina: ednina/dvojina/množina
  if (n === 1) return "postanek";
  if (n === 2) return "postanka";
  return "postanki";
}

export function DaySegmentHeader({
  segment,
  count,
}: {
  segment: DaySegment;
  /** Število postankov v segmentu (iskren izpis, ne okrasek). */
  count: number;
}) {
  const l = useLocale();
  const labels = DAY_SEGMENT_LABELS[segment];
  const label = pick(l, labels);
  const stopsWord = stopsWordOf(l, count);
  return (
    <div
      className="mt-4 flex items-center gap-2 first:mt-0"
      role="heading"
      aria-level={4}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {GLYPH[segment]}
      </span>
      <span className="text-sm font-semibold tracking-wide text-foreground">
        {label}
      </span>
      <span className="text-xs text-muted-foreground">
        · {count} {stopsWord}
      </span>
      <span
        className="h-px flex-1 bg-border"
        aria-hidden="true"
      />
    </div>
  );
}
