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
      className="mt-5 flex items-center gap-3 first:mt-0"
      role="heading"
      aria-level={4}
    >
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-base leading-none shadow-sm">
        {GLYPH[segment]}
      </span>
      <span className="text-sm font-bold tracking-tight text-foreground">
        {label}
      </span>
      <span className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-[11px] font-medium text-muted-foreground">
        · {count} {stopsWord}
      </span>
      <span
        className="h-px min-w-3 flex-1 bg-gradient-to-r from-border to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}
