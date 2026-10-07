"use client";

import { CalendarDays, CloudSun, Loader2, Pencil, RotateCw } from "lucide-react";
import { useLocale } from "next-intl";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pick } from "@/lib/i18n-pick";
import {
  eachTripDay,
  formatDateShort,
  forecastAvailabilityFor,
  todayIso,
  validateTripDates,
  weekdayShort,
  type TripDates,
} from "@/lib/trip-dates";
import { fetchDailyWeather, weatherLabel, type WeatherDay } from "@/lib/weather";
import { getDestination } from "@/lib/slovenia-data";
import { type SharedPlan } from "@/lib/shared-plan";

/**
 * TRIP-DATES-PANEL — realni datumi poti + dnevno vreme (P0-E, issue #1 §10).
 *
 * Kanoni:
 *  - datumi so LOKALNI "YYYY-MM-DD" (DST-varno — trip-dates.ts), nikoli UTC;
 *  - vreme na dan poti je ČESTO z Open-Meteo dnevno napovedjo, vezano na
 *    prvi postanek dneva s koordinatami (ZASEBNOST: koordinate postanka,
 *    nikoli uporabnikova lega — isti kanon kot Go Mode vreme);
 *  - ISKRENOST horizonta: pretekli dnevi → „mimo"; prek 16 dni → „napoved
 *    še ni na voljo"; nedosegljiv vir → odkrit štor, BREZ izmišljanja.
 */

const L = {
  title: { sl: "Realni datumi poti", en: "Real trip dates" },
  lead: {
    sl: "Določi začetek in konec poti — dnevi, rezervacije in vreme se vežejo na prave datume (DST-varno).",
    en: "Set the trip start and end — days, reservations and weather bind to real dates (DST-safe).",
  },
  start: { sl: "Začetek", en: "Start" },
  end: { sl: "Konec", en: "End" },
  save: { sl: "Shrani datume", en: "Save dates" },
  clear: { sl: "Počisti", en: "Clear" },
  saved: { sl: "Datumi shranjeni ✓", en: "Dates saved ✓" },
  noneYet: {
    sl: "Datumi še niso določeni — vnesi jih, da se bodo dnevi poti in vreme vezali na prave datume.",
    en: "No dates yet — set them so trip days and weather bind to real dates.",
  },
  readOnly: {
    sl: "Datume lahko nastavijo uredniki poti.",
    en: "Dates can be set by trip editors.",
  },
  day: { sl: (n: number) => `Dan ${n}`, en: (n: number) => `Day ${n}` },
  weatherPast: { sl: "mimo", en: "past" },
  weatherTooFar: { sl: "napoved še ni na voljo", en: "forecast not yet available" },
  weatherError: { sl: "vreme trenutno ni dosegljivo", en: "weather currently unavailable" },
  weatherLoading: { sl: "vreme …", en: "weather …" },
  weatherSource: {
    sl: "Vir vremena: Open-Meteo (dnevna napoved, max 16 dni) — za prvi postanek dneva.",
    en: "Weather source: Open-Meteo (daily forecast, up to 16 days) — for the day's first stop.",
  },
  noCoords: { sl: "brez lokacije", en: "no location" },
  errGeneric: { sl: "Shranjevanje ni uspelo. Poskusi znova.", en: "Saving failed. Try again." },
} as const;

interface DayWeatherChip {
  state: "available" | "past" | "too_far" | "loading" | "error" | "no_coords";
  day?: WeatherDay;
}

export function TripDatesPanel({
  shareId,
  canEdit,
  tripDates,
  plan,
  onSaved,
}: {
  shareId: string;
  canEdit: boolean;
  tripDates: TripDates | null;
  plan: SharedPlan | null;
  onSaved?: () => void;
}) {
  const l = useLocale();
  const lang: "sl" | "en" = l === "en" ? "en" : "sl";

  const [start, setStart] = React.useState(tripDates?.start ?? "");
  const [end, setEnd] = React.useState(tripDates?.end ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedFlash, setSavedFlash] = React.useState(false);

  React.useEffect(() => {
    setStart(tripDates?.start ?? "");
    setEnd(tripDates?.end ?? "");
  }, [tripDates?.start, tripDates?.end]);

  const save = async (next: TripDates | null) => {
    setBusy(true);
    setError(null);
    setSavedFlash(false);
    try {
      const r = await fetch(`/api/trips/${encodeURIComponent(shareId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tripDates: next }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? pick(l, L.errGeneric));
        return;
      }
      setSavedFlash(true);
      onSaved?.();
      window.setTimeout(() => setSavedFlash(false), 2500);
    } catch {
      setError(pick(l, L.errGeneric));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!start || !end) return;
    const v = validateTripDates({ start, end });
    if (!v.ok) {
      setError(v.error);
      return;
    }
    void save(v.dates);
  };

  // ── Dnevni čipi (dnevi poti z realnimi datumi + vreme) ──────────────────
  const days = React.useMemo(
    () => (tripDates ? eachTripDay(tripDates) : null),
    [tripDates]
  );

  const [chips, setChips] = React.useState<Record<number, DayWeatherChip>>({});
  const coordsCache = React.useRef(new Map<string, WeatherDay[] | null>());

  React.useEffect(() => {
    if (!days || !tripDates) {
      setChips({});
      return;
    }
    let cancelled = false;
    const today = todayIso();

    const next: Record<number, DayWeatherChip> = {};
    for (const d of days) {
      const availability = forecastAvailabilityFor(d.iso, today);
      next[d.dayIndex] =
        availability === "available"
          ? { state: "loading" }
          : { state: availability };
    }
    setChips(next);

    const load = async () => {
      for (const d of days) {
        if (cancelled) return;
        if (forecastAvailabilityFor(d.iso, today) !== "available") continue;
        const locations = plan?.days?.[d.dayIndex - 1]?.locations ?? [];
        const firstWithCoords = locations.find((loc) => {
          if (!loc.destSlug) return false;
          return Boolean(getDestination(loc.destSlug)?.coords);
        });
        const coords = firstWithCoords?.destSlug
          ? getDestination(firstWithCoords.destSlug)?.coords
          : undefined;
        if (!coords) {
          if (!cancelled) setChips((c) => ({ ...c, [d.dayIndex]: { state: "no_coords" } }));
          continue;
        }
        const key = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)}`;
        let daily = coordsCache.current.get(key);
        if (daily === undefined) {
          const res = await fetchDailyWeather(coords.lat, coords.lng);
          daily = res?.daily ?? null;
          coordsCache.current.set(key, daily);
        }
        if (cancelled) return;
        const match = daily?.find((w) => w.date === d.iso) ?? null;
        setChips((c) => ({
          ...c,
          [d.dayIndex]: match ? { state: "available", day: match } : { state: "error" },
        }));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [days, tripDates, plan]);

  return (
    <Card className="print:hidden">
      <CardContent className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          {pick(l, L.title)}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{pick(l, L.lead)}</p>

        {canEdit ? (
          <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="trip-date-start" className="block text-xs font-medium text-muted-foreground">
                {pick(l, L.start)}
              </label>
              <Input
                id="trip-date-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 h-11 w-40"
              />
            </div>
            <div>
              <label htmlFor="trip-date-end" className="block text-xs font-medium text-muted-foreground">
                {pick(l, L.end)}
              </label>
              <Input
                id="trip-date-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 h-11 w-40"
              />
            </div>
            <Button
              type="submit"
              disabled={busy || !start || !end || (start === tripDates?.start && end === tripDates?.end)}
              className="tap-target h-11 font-semibold"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Pencil className="size-4" aria-hidden="true" />}
              {pick(l, L.save)}
            </Button>
            {tripDates && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void save(null)}
                disabled={busy}
                className="tap-target h-11"
              >
                <RotateCw className="size-4" aria-hidden="true" />
                {pick(l, L.clear)}
              </Button>
            )}
            {savedFlash && (
              <Badge className="self-center" variant="secondary">
                {pick(l, L.saved)}
              </Badge>
            )}
          </form>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{pick(l, L.readOnly)}</p>
        )}

        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!tripDates ? (
          <p className="mt-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {pick(l, L.noneYet)}
          </p>
        ) : (
          days && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {days.map((d) => {
                  const chip = chips[d.dayIndex];
                  return (
                    <div
                      key={d.dayIndex}
                      className="flex min-w-32 flex-col gap-1 rounded-lg border bg-card px-3 py-2"
                    >
                      <span className="text-xs font-bold">
                        {pick(l, L.day)(d.dayIndex)} ·{" "}
                        <span className="font-normal text-muted-foreground">
                          {weekdayShort(d.iso, lang)}, {formatDateShort(d.iso, lang)}
                        </span>
                      </span>
                      <WeatherChipView chip={chip} lang={lang} locale={l} />
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{pick(l, L.weatherSource)}</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

function WeatherChipView({
  chip,
  lang,
  locale,
}: {
  chip: DayWeatherChip | undefined;
  lang: "sl" | "en";
  locale: string;
}) {
  const l = locale;
  if (!chip) return null;
  if (chip.state === "past") {
    return <span className="text-[11px] text-muted-foreground">{pick(l, L.weatherPast)}</span>;
  }
  if (chip.state === "too_far") {
    return <span className="text-[11px] text-muted-foreground">{pick(l, L.weatherTooFar)}</span>;
  }
  if (chip.state === "no_coords") {
    return <span className="text-[11px] text-muted-foreground">{pick(l, L.noCoords)}</span>;
  }
  if (chip.state === "loading") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> {pick(l, L.weatherLoading)}
      </span>
    );
  }
  if (chip.state === "error" || !chip.day) {
    return <span className="text-[11px] text-amber-700 dark:text-amber-400">{pick(l, L.weatherError)}</span>;
  }
  const w = chip.day;
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium">
      <CloudSun className="size-3.5 text-primary" aria-hidden="true" />
      {weatherLabel(w.code, lang)} · {Math.round(w.tMinC)}–{Math.round(w.tMaxC)} °C
      {w.precipProbPct >= 40 ? ` · 💧${w.precipProbPct}%` : ""}
    </span>
  );
}
