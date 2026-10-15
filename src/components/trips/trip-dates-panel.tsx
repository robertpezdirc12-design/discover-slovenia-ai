"use client";

import { CalendarDays, CloudSun, Loader2, Pencil, RotateCw } from "lucide-react";
import { useLocale } from "next-intl";
import React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { asPickLocale, pick } from "@/lib/i18n-pick";
import {
  eachTripDay,
  formatDateShort,
  forecastAvailabilityFor,
  isIsoDate,
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
  title: { sl: "Realni datumi poti", en: "Real trip dates", it: "Date reali del viaggio", de: "Echte Reisedaten", fr: "Dates réelles du voyage", es: "Fechas reales del viaje" },
  lead: {
    sl: "Določi začetek in konec poti — dnevi, rezervacije in vreme se vežejo na prave datume (DST-varno).",
    en: "Set the trip start and end — days, reservations and weather bind to real dates (DST-safe).",
    it: "Imposta inizio e fine del viaggio — giorni, prenotazioni e meteo si agganciano alle date reali (al riparo dal cambio ora).",
    de: "Lege Beginn und Ende der Reise fest — Tage, Reservierungen und Wetter binden an echte Daten (DST-sicher).",
    fr: "Définis le début et la fin du voyage — jours, réservations et météo se raccrochent aux dates réelles (sans risque DST).",
    es: "Define el inicio y el fin del viaje — días, reservas y clima se vinculan a fechas reales (seguro con DST).",
  },
  start: { sl: "Začetek", en: "Start", it: "Inizio", de: "Beginn", fr: "Début", es: "Inicio" },
  end: { sl: "Konec", en: "End", it: "Fine", de: "Ende", fr: "Fin", es: "Fin" },
  save: { sl: "Shrani datume", en: "Save dates", it: "Salva le date", de: "Daten speichern", fr: "Enregistrer les dates", es: "Guardar las fechas" },
  clear: { sl: "Počisti", en: "Clear", it: "Cancella", de: "Leeren", fr: "Effacer", es: "Borrar" },
  // QA U2 (2026-10-11): tiho shranjevanje — potrditev mora povedati KATERI
  // datumi so shranjeni (lokaliziran obseg), ne samo splošni ✓.
  savedRange: {
    sl: (r: string) => `Datumi shranjeni: ${r} ✓`,
    en: (r: string) => `Dates saved: ${r} ✓`,
    it: (r: string) => `Date salvate: ${r} ✓`,
    de: (r: string) => `Daten gespeichert: ${r} ✓`,
    fr: (r: string) => `Dates enregistrées : ${r} ✓`,
    es: (r: string) => `Fechas guardadas: ${r} ✓`,
  },
  cleared: { sl: "Datumi pobrisani ✓", en: "Dates cleared ✓", it: "Date cancellate ✓", de: "Daten gelöscht ✓", fr: "Dates effacées ✓", es: "Fechas borradas ✓" },
  noneYet: {
    sl: "Datumi še niso določeni — vnesi jih, da se bodo dnevi poti in vreme vezali na prave datume.",
    en: "No dates yet — set them so trip days and weather bind to real dates.",
    it: "Ancora nessuna data — impostale, così giorni del viaggio e meteo si agganciano alle date reali.",
    de: "Noch keine Daten — lege sie fest, damit Reisetage und Wetter an echte Daten binden.",
    fr: "Pas encore de dates — définis-les pour que les jours du voyage et la météo se raccrochent aux dates réelles.",
    es: "Aún no hay fechas — defínelas para que los días del viaje y el clima se vinculen a fechas reales.",
  },
  readOnly: {
    sl: "Datume lahko nastavijo uredniki poti.",
    en: "Dates can be set by trip editors.",
    it: "Le date possono essere impostate dagli editor del viaggio.",
    de: "Daten können von Reise-Editoren festgelegt werden.",
    fr: "Les dates peuvent être définies par les éditeurs du voyage.",
    es: "Las fechas pueden definirlas los editores del viaje.",
  },
  day: {
    sl: (n: number) => `Dan ${n}`,
    en: (n: number) => `Day ${n}`,
    it: (n: number) => `Giorno ${n}`,
    de: (n: number) => `Tag ${n}`,
    fr: (n: number) => `Jour ${n}`,
    es: (n: number) => `Día ${n}`,
  },
  weatherPast: { sl: "mimo", en: "past", it: "passato", de: "vorbei", fr: "passé", es: "pasado" },
  weatherTooFar: { sl: "napoved še ni na voljo", en: "forecast not yet available", it: "previsione non ancora disponibile", de: "Vorhersage noch nicht verfügbar", fr: "prévisions pas encore disponibles", es: "pronóstico aún no disponible" },
  weatherError: { sl: "vreme trenutno ni dosegljivo", en: "weather currently unavailable", it: "meteo attualmente non disponibile", de: "Wetter derzeit nicht verfügbar", fr: "météo actuellement indisponible", es: "clima no disponible por ahora" },
  weatherLoading: { sl: "vreme …", en: "weather …", it: "meteo …", de: "Wetter …", fr: "météo …", es: "clima …" },
  weatherSource: {
    sl: "Vir vremena: Open-Meteo (dnevna napoved, max 16 dni) — za prvi postanek dneva.",
    en: "Weather source: Open-Meteo (daily forecast, up to 16 days) — for the day's first stop.",
    it: "Fonte meteo: Open-Meteo (previsione giornaliera, fino a 16 giorni) — per la prima fermata della giornata.",
    de: "Wetterquelle: Open-Meteo (Tagesvorhersage, bis zu 16 Tage) — für den ersten Stopp des Tages.",
    fr: "Source météo : Open-Meteo (prévisions quotidiennes, jusqu'à 16 jours) — pour le premier arrêt de la journée.",
    es: "Fuente del clima: Open-Meteo (pronóstico diario, hasta 16 días) — para la primera parada del día.",
  },
  noCoords: { sl: "brez lokacije", en: "no location", it: "senza località", de: "kein Standort", fr: "sans localisation", es: "sin ubicación" },
  errGeneric: { sl: "Shranjevanje ni uspelo. Poskusi znova.", en: "Saving failed. Try again.", it: "Salvataggio non riuscito. Riprova.", de: "Speichern fehlgeschlagen. Versuche es erneut.", fr: "Échec de l'enregistrement. Réessaie.", es: "Error al guardar. Inténtalo de nuevo." },
} as const;

interface DayWeatherChip {
  state: "available" | "past" | "too_far" | "loading" | "error" | "no_coords";
  day?: WeatherDay;
}

/** Lokalna ISO oblika (za razstavitev komponent v kompaktnem zapisu obsega). */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Krajka imena mesecev za kompaktni zapis obsega (QA U2). Lokalne tabele —
 * trip-dates.ts izvozi samo formatirne funkcije (formatDateShort/Long),
 * meseške tabele pa ostajajo zasebne; vrednosti so usklajene s kanonom.
 */
const RANGE_MONTHS: Record<"sl" | "en" | "it" | "de" | "fr" | "es", readonly string[]> = {
  sl: ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  it: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};

/**
 * Kompakten zapis obsega datumov poti (QA U2, čista funkcija — testabilna):
 *  - enodnevna pota → en datum (formatDateShort);
 *  - isti mesec in leto → „12.–14. okt 2026" / „Oct 12–14, 2026" / …;
 *  - prek mesecev/let → oba kratka datuma ločena z pomišljajem;
 *  - neveljaven podatek → iskreno surov zapis (nikoli izmišljenega datuma).
 * DST-varno: dela na lokalnih komponentah YYYY-MM-DD (kanon trip-dates).
 */
export function tripDatesRangeLabel(
  start: string,
  end: string,
  lang: "sl" | "en" | "it" | "de" | "fr" | "es" = "sl"
): string {
  const a = ISO_DATE_RE.exec(start);
  const b = ISO_DATE_RE.exec(end);
  if (!a || !b || !isIsoDate(start) || !isIsoDate(end)) return `${start} – ${end}`;
  if (start === end) return formatDateShort(start, lang);
  const y1 = Number(a[1]);
  const m1 = Number(a[2]);
  const d1 = Number(a[3]);
  const y2 = Number(b[1]);
  const m2 = Number(b[2]);
  const d2 = Number(b[3]);
  if (y1 === y2 && m1 === m2) {
    const m = RANGE_MONTHS[lang][m1 - 1] ?? RANGE_MONTHS.sl[m1 - 1] ?? "";
    const yr = String(y1);
    if (lang === "en") return `${m} ${d1}–${d2}, ${yr}`;
    if (lang === "de") return `${d1}.–${d2}. ${m} ${yr}`;
    if (lang === "it" || lang === "fr" || lang === "es") return `${d1}–${d2} ${m} ${yr}`;
    return `${d1}.–${d2}. ${m} ${yr}`;
  }
  return `${formatDateShort(start, lang)} – ${formatDateShort(end, lang)}`;
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
  const lang: "sl" | "en" | "it" | "de" | "fr" | "es" = asPickLocale(l);

  const [start, setStart] = React.useState(tripDates?.start ?? "");
  const [end, setEnd] = React.useState(tripDates?.end ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** QA U2: shranjeni obseg (za potrditev) | "cleared" | null. */
  const [savedFlash, setSavedFlash] = React.useState<
    { start: string; end: string } | "cleared" | null
  >(null);

  React.useEffect(() => {
    setStart(tripDates?.start ?? "");
    setEnd(tripDates?.end ?? "");
  }, [tripDates?.start, tripDates?.end]);

  const save = async (next: TripDates | null) => {
    setBusy(true);
    setError(null);
    setSavedFlash(null);
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
      // QA U2: potrditev pove KATERI datumi so shranjeni (lokaliziran
      // obseg) — prej je bil badge splošen in 2,5 s neopazen; zdaj 4 s
      // + role=status (tudi bralniki zaslona slišijo potrditev).
      setSavedFlash(next ? { start: next.start, end: next.end } : "cleared");
      onSaved?.();
      window.setTimeout(() => setSavedFlash(null), 4000);
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
              <Badge className="self-center" variant="secondary" role="status">
                {savedFlash === "cleared"
                  ? pick(l, L.cleared)
                  : pick(l, L.savedRange)(
                      tripDatesRangeLabel(savedFlash.start, savedFlash.end, lang)
                    )}
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
          <p className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
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
  lang: "sl" | "en" | "it" | "de" | "fr" | "es";
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
