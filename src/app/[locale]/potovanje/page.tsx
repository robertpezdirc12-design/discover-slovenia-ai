"use client";

import {
  AlertTriangle,
  CalendarCheck,
  Check,
  CircleCheck,
  ExternalLink,
  Footprints,
  Info,
  MapPin,
  Route as RouteIcon,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { useLocale } from "next-intl";
import React, { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { DaySegmentHeader } from "@/components/day-segment-header";
import { StopKindIcon } from "@/components/plan/plan-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  buildPlanFromMyTrip,
  formatDuration,
  formatMoney,
  osmDirectionsUrl,
  roadKm,
  round5,
  travelMinutes,
  validatePlanGeo,
  type GeoValidation,
  type PlannerLang,
} from "@/lib/itinerary-engine";
import { useMyTripList } from "@/lib/my-trip";
import { loadLastPlan, type SavedPlan } from "@/lib/plan-store";
import { buildDaySegments } from "@/lib/day-segments";
import { regionLabel, typeLabel } from "@/lib/slovenia-data";
import type { ItineraryPlan, MyTripItem, TripStop } from "@/lib/types";

/**
 * /potovanje — JOURNEY PLANNER pogled (rekonstrukcija po Task 58 + mirror):
 * časovnica dnevnega načrta (dai:last-plan ali osnutek iz dai:my-trip),
 * dnevna navigacija, akcija Navigiraj (OSM directions — legal, brez ključev)
 * in sekcija ISKRENIH opozoril (geo-časovna validacija po vzorcu P0.2:
 * sosednja postanka — razdalja in ocena vožnje ~60 km/h).
 */

const L = {
  kicker: { sl: "Potovanje", en: "Journey" },
  title: { sl: "Tvoje potovanje", en: "Your journey" },
  lead: {
    sl: "Dnevna časovnica zadnjega načrta (ali osnutka iz Moje poti) z navigacijo in iskreno preverbo izvedljivosti — brez izmišljenih podatkov.",
    en: "The daily timeline of your last plan (or a draft from My trip) with navigation and an honest feasibility check — no invented data.",
  },
  dayNav: { sl: "Dnevi poti", en: "Trip days" },
  day: { sl: (n: number) => `Dan ${n}`, en: (n: number) => `Day ${n}` },
  timelineTitle: { sl: "Časovnica dneva", en: "Day timeline" },
  navigate: { sl: "Navigiraj", en: "Navigate" },
  duration: { sl: "trajanje", en: "duration" },
  cost: { sl: "cena", en: "cost" },
  free: { sl: "brezplačno", en: "free" },
  driveEstimate: { sl: "ocena vožnje", en: "drive estimate" },
  dayTotal: { sl: "Danes skupaj", en: "Day total" },
  warningsTitle: { sl: "Iskrena opozorila", en: "Honest warnings" },
  warningsLead: {
    sl: "Preverjanje izvedljivosti: prekrivanja časov, dolgi presledki in razdalje med sosednjima postankoma (ocena vožnje ~60 km/h, premočna razdalja ×1,3 — ni podatka o prometu v realnem času).",
    en: "Feasibility check: schedule overlaps, long gaps and distances between adjacent stops (drive estimate ~60 km/h, straight-line ×1.3 — no real-time traffic data).",
  },
  allClear: {
    sl: "Ni opozoril: časi in razdalje so znotraj udobnih okvirjev (po oceni).",
    en: "No warnings: times and distances are within comfortable limits (estimated).",
  },
  worstOk: { sl: "PREVERJENO · OK", en: "CHECKED · OK" },
  worstWarn: { sl: "OPOZORILO", en: "WARNING" },
  worstError: { sl: "NI IZVEDLJIVO (po urniku)", en: "NOT FEASIBLE (per schedule)" },
  metricsTitle: { sl: "Metrike po dnevih", en: "Per-day metrics" },
  km: { sl: "km vožnje", en: "km of driving" },
  driveMin: { sl: "min vožnje", en: "min driving" },
  activityMin: { sl: "min aktivnosti", en: "min of activities" },
  stopsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
  },
  sourcePlan: {
    sl: "Vir: zadnji načrt z /nacrtuj (shranjen lokalno).",
    en: "Source: the last plan from /nacrtuj (stored locally).",
  },
  sourceDraft: {
    sl: "Vir: osnutek iz zbirke „Moja pot“ (tvoj vrstni red) — časi so predlogi.",
    en: "Source: a draft from your “My trip” collection (your order) — times are proposals.",
  },
  unmatchedTitle: { sl: "Brez lokacije", en: "Without a location" },
  unmatchedBody: {
    sl: "Ti zapisi zbirke nimajo kanonske destinacije — razdalj in ur zanje ni mogoče preveriti:",
    en: "These collection entries have no canonical destination — distances and times cannot be checked for them:",
  },
  emptyTitle: { sl: "Ni še nobenega potovanja", en: "No journey yet" },
  emptyBody: {
    sl: "Sestavi deterministični načrt na /nacrtuj ali dodaj destinacije v Moja pot — potovanje se bo naredilo samo.",
    en: "Build a deterministic plan at /nacrtuj or add destinations to My trip — the journey will assemble itself.",
  },
  ctaPlan: { sl: "Načrtuj novo", en: "Plan a new one" },
  ctaGo: { sl: "Zaženi na poti", en: "Start on the road" },
  savedAt: { sl: "Shranjeno", en: "Saved" },
  totalTrip: { sl: "Celotno potovanje", en: "Whole trip" },
  perPerson: { sl: "na osebo", en: "per person" },
} as const;

type Source = "planner" | "my-trip";

interface JourneyData {
  plan: ItineraryPlan;
  source: Source;
  savedAt?: string;
  unmatched: MyTripItem[];
}

export default function JourneyPage() {
  const l = useLocale();
  const lang: PlannerLang = l === "en" ? "en" : "sl";
  const myItems = useMyTripList();
  const [data, setData] = useState<JourneyData | null>(null);
  const [ready, setReady] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);

  // Hidracija: localStorage se bere TEKOM mounta (SSR/klient se strinjata).
  useEffect(() => {
    const hydrate = () => {
      const saved: SavedPlan | null = loadLastPlan();
      if (saved && saved.plan.days.length > 0) {
        setData({ plan: saved.plan, source: "planner", savedAt: saved.savedAt, unmatched: [] });
      } else {
        const draft = buildPlanFromMyTrip(myItems, lang);
        if (draft.plan.days.length > 0) {
          setData({ plan: draft.plan, source: "my-trip", unmatched: draft.unmatched });
        } else {
          setData(null);
        }
      }
      setReady(true);
    };
    hydrate();
  }, []);

  // Če ni shranjenega načrta, osnutek sledi živi zbirki.
  useEffect(() => {
    if (!ready || (data?.source ?? "my-trip") !== "my-trip") return;
    const rebuildDraft = () => {
      const draft = buildPlanFromMyTrip(myItems, lang);
      setData(
        draft.plan.days.length > 0
          ? { plan: draft.plan, source: "my-trip", unmatched: draft.unmatched }
          : null
      );
      setDayIndex(0);
    };
    rebuildDraft();
  }, [myItems, ready]);

  const validation: GeoValidation | null = useMemo(
    () => (data ? validatePlanGeo(data.plan, lang) : null),
    [data, lang]
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />

      {!ready && (
        <div className="mt-8 space-y-4" aria-hidden="true">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      )}

      {ready && !data && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <RouteIcon className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-semibold">{pick(l, L.emptyTitle)}</p>
            <p className="max-w-md text-sm text-muted-foreground">{pick(l, L.emptyBody)}</p>
            <Button asChild size="lg" className="min-h-12">
              <Link href="/nacrtuj">
                <Wand2 className="size-5" aria-hidden="true" />
                {pick(l, L.ctaPlan)}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {ready && data && (
        <div className="mt-8">
          {/* Vir + povzetek */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="size-4" aria-hidden="true" />
              {data.source === "planner" ? pick(l, L.sourcePlan) : pick(l, L.sourceDraft)}
              {data.savedAt && (
                <span className="whitespace-nowrap">
                  · {pick(l, L.savedAt)}: {new Date(data.savedAt).toLocaleString(lang === "en" ? "en-GB" : "sl-SI")}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{L.stopsWord[lang](data.plan.days.flat().length)}</Badge>
              <Badge className="gap-1 bg-primary text-primary-foreground">
                {formatMoney(data.plan.totalCost, lang)}
                <span className="font-normal opacity-80">{pick(l, L.perPerson)}</span>
              </Badge>
            </div>
          </div>

          {/* Dnevna navigacija */}
          {data.plan.days.length > 1 && (
            <nav className="mt-4" aria-label={pick(l, L.dayNav)}>
              <ul className="flex flex-wrap gap-2">
                {data.plan.days.map((_, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setDayIndex(i)}
                      aria-current={i === dayIndex ? "true" : undefined}
                      className={`min-h-11 min-w-11 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                        i === dayIndex
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-foreground/80 hover:bg-accent"
                      }`}
                    >
                      <span className="sr-only">{pick(l, L.dayNav)}: </span>
                      {L.day[lang](i + 1)}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Časovnica dneva */}
          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>
                  {data.plan.dayTitles?.[dayIndex] ?? L.day[lang](dayIndex + 1)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {pick(l, L.dayTotal)}:{" "}
                  {formatMoney(
                    (data.plan.days[dayIndex] ?? []).reduce((s, x) => s + x.cost, 0),
                    lang
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DayTimeline
                stops={data.plan.days[dayIndex] ?? []}
                lang={lang}
              />
            </CardContent>
          </Card>

          {/* Neujemajoči zapisi (osnutek) */}
          {data.source === "my-trip" && data.unmatched.length > 0 && (
            <Card className="mt-4 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{pick(l, L.unmatchedTitle)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{pick(l, L.unmatchedBody)}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {data.unmatched.map((item) => (
                    <li key={item.refId}>
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {item.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ISKRENA OPOZORILA */}
          {validation && <WarningsSection validation={validation} lang={lang} />}

          {/* Akcije */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="min-h-12">
              <Link href="/na-poti?start=1">
                <Footprints className="size-5" aria-hidden="true" />
                {pick(l, L.ctaGo)}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="min-h-12">
              <Link href="/nacrtuj">
                <Wand2 className="size-5" aria-hidden="true" />
                {pick(l, L.ctaPlan)}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Postanek z akcijo Navigiraj (OSM directions — brez ključev)
// ---------------------------------------------------------------------------

/**
 * Časovnica dneva s segmenti Jutro/Popoldan/Večer (P0-D, kanon izvirnika):
 * glava segmenta + poštene etape (~km/~min) tudi preko mej segmentov.
 */
function DayTimeline({
  stops,
  lang,
}: {
  stops: TripStop[];
  lang: PlannerLang;
}) {
  const groups = buildDaySegments(stops);
  const indexOf = new Map(stops.map((s, i) => [s.id, i]));
  return (
    <div>
      {groups.map((group) => (
        <section key={group.segment + `-${group.stops[0]?.id ?? "0"}`}>
          <DaySegmentHeader segment={group.segment} count={group.stops.length} />
          <ol>
            {group.stops.map((stop) => {
              const i = indexOf.get(stop.id) ?? 0;
              return (
                <li key={stop.id}>
                  {i > 0 && <LegRow prev={stops[i - 1]} stop={stop} lang={lang} />}
                  <JourneyStopRow stop={stop} lang={lang} />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function JourneyStopRow({ stop, lang }: { stop: TripStop; lang: PlannerLang }) {
  const l = useLocale();
  const kindLabel = typeLabel(stop.kind, lang);
  const regionTxt = stop.region ? regionLabel(stop.region, lang) : "";
  return (
    <div className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-accent/50">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary">
        <StopKindIcon kind={stop.kind} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-bold tabular-nums">{stop.time ?? "—"}</span>
          <span className="font-semibold">{stop.name}</span>
          <Badge variant="outline" className="text-[11px]">
            {kindLabel}
          </Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="sr-only">{pick(l, L.duration)}: </span>
            {formatDuration(stop.durationMin, lang)}
          </span>
          <span>
            <span className="sr-only">{pick(l, L.cost)}: </span>
            {stop.cost === 0 ? pick(l, L.free) : formatMoney(stop.cost, lang)}
          </span>
          {regionTxt && <span>{regionTxt}</span>}
        </p>
        {stop.coords && (
          <a
            href={osmDirectionsUrl(stop.coords)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {pick(l, L.navigate)}
            <span className="sr-only">
              : {stop.name} ({stop.coords.lat.toFixed(4)}, {stop.coords.lng.toFixed(4)})
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

function LegRow({
  prev,
  stop,
  lang,
}: {
  prev: TripStop;
  stop: TripStop;
  lang: PlannerLang;
}) {
  const l = useLocale();
  if (!prev.coords || !stop.coords) return null;
  const km = round5(roadKm(prev.coords, stop.coords));
  const min = travelMinutes(prev.coords, stop.coords);
  const label = pick(l, L.driveEstimate);
  return (
    <div className="flex items-center gap-3 py-2 pl-4 sm:pl-6" aria-label={`${label}: ~${km} km, ~${min} min`}>
      <span className="h-6 w-px bg-border" aria-hidden="true" />
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        <RouteIcon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{label}: </span>
        ~{km} km · ~{min} min · {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sekcija iskrenih opozoril (geo-časovna validacija)
// ---------------------------------------------------------------------------

function WarningsSection({
  validation,
  lang,
}: {
  validation: GeoValidation;
  lang: PlannerLang;
}) {
  const l = useLocale();
  const worstBadge =
    validation.worst === "error"
      ? { label: pick(l, L.worstError), cls: "bg-destructive text-white" }
      : validation.worst === "warn"
        ? { label: pick(l, L.worstWarn), cls: "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" }
        : { label: pick(l, L.worstOk), cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" };

  return (
    <section className="mt-8" aria-labelledby="opozorila">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="opozorila" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          {pick(l, L.warningsTitle)}
        </h2>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${worstBadge.cls}`}>
          {worstBadge.label}
        </span>
      </div>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{pick(l, L.warningsLead)}</p>

      {validation.issues.length === 0 ? (
        <Card className="mt-4 border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-900 dark:text-emerald-200">
            <CircleCheck className="size-5 shrink-0" aria-hidden="true" />
            {pick(l, L.allClear)}
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 space-y-2">
          {validation.issues.map((issue, i) => (
            <li
              key={`${issue.day}-${issue.rule}-${i}`}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                issue.level === "error"
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-amber-400/50 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 size-4 shrink-0 ${
                  issue.level === "error" ? "text-destructive" : "text-amber-600"
                }`}
                aria-hidden="true"
              />
              <span>
                <span className="sr-only">
                  {L.day[lang](issue.day)} · {issue.level === "error" ? "ERROR" : "WARN"}:{" "}
                </span>
                <span className="font-semibold">{L.day[lang](issue.day)}: </span>
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Metrike po dnevih */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarCheck className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metricsTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {validation.days.map((m) => (
              <li key={m.day} className="text-sm">
                <p className="font-semibold">{L.day[lang](m.day)}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{L.stopsWord[lang](m.stops)}</span>
                  <span>
                    ~{m.km} {pick(l, L.km)}
                  </span>
                  <span>
                    ~{m.drivingMinutes} {pick(l, L.driveMin)}
                  </span>
                  <span>
                    {m.activityMinutes} {pick(l, L.activityMin)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-3.5 text-primary" aria-hidden="true" />
            {pick(l, L.totalTrip)}: ~{validation.tripKm} km · {pick(l, L.driveEstimate)}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
