"use client";

import { ArrowRight, CalendarDays, ExternalLink, MapPin, Sparkles, Ticket } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import * as React from "react";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  EVENT_CATEGORIES,
  EVENT_MONTHS,
  EVENT_PRICE_LABEL,
  EVENTS,
  type EventCategory,
} from "@/lib/content-data";
import { getDestination } from "@/lib/slovenia-data";

const CATEGORY_ICONS = {
  music: CalendarDays,
  trophy: Ticket,
  sparkles: Sparkles,
  utensils: Ticket,
  landmark: MapPin,
  tent: CalendarDays,
} as const;

function categoryIcon(cat: EventCategory) {
  return CATEGORY_ICONS[EVENT_CATEGORIES[cat].icon];
}

/** Množinska oblika števca dogodkov (SL: dogodek/dogodka/dogodki; EN: event(s)). */
function eventCountLabel(l: string, n: number): string {
  if (l === "en") return n === 1 ? "1 event" : `${n} events`;
  if (n === 1) return "1 dogodek";
  if (n === 2) return "2 dogodka";
  if (n >= 3 && n <= 4) return `${n} dogodki`;
  return `${n} dogodkov`;
}

/**
 * /dogodki — koledar 30 dogodkov 1:1 iz produkcije: filtri po mesecu in
 * kategoriji, mesečne skupine, kartice z datumom, lokacijo, vstopnino,
 * uradno spletno stranjo in povezavo na destinacijo.
 */
export function EventsView() {
  const l = useLocale();
  const [month, setMonth] = React.useState<number | "all">("all");
  const [category, setCategory] = React.useState<EventCategory | "all">("all");

  const L = {
    kicker: { sl: "Dogodki", en: "Events" },
    title: { sl: "Dogodki in prireditve v Sloveniji", en: "Events in Slovenia" },
    lead: {
      sl: "Od festivalov in sejemov do športa in kulture — koledar dogodkov po vsej Sloveniji z datumi, lokacijami in kategorijami.",
      en: "From festivals and fairs to sport and culture — a calendar of events across Slovenia with dates, venues and categories.",
    },
    metaNote: { sl: "Filtri po mesecu in kategoriji · Brez prijave", en: "Filters by month and category · No sign-up needed" },
    calendarTitle: {
      sl: "Koledar dogodkov",
      en: "Event calendar",
    },
    calendarLead: {
      sl: "Festivali, prireditve in dogodki skozi vse leto",
      en: "Festivals, happenings and events throughout the year",
    },
    allMonths: { sl: "Vse leto", en: "All year" },
    allCategories: { sl: "Vse kategorije", en: "All categories" },
    filterMonth: { sl: "Filtriraj po mesecu", en: "Filter by month" },
    filterCategory: { sl: "Filtriraj po kategoriji", en: "Filter by category" },
    noEvents: {
      sl: "Za izbrano kombinacijo filtra ni dogodkov — počisti filter ali izberi drug mesec.",
      en: "No events match this filter combination — clear the filters or pick another month.",
    },
    clearFilters: { sl: "Počisti filtre", en: "Clear filters" },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓" },
    website: { sl: "Spletna stran", en: "Website" },
    exploreDest: { sl: "Razišči destinacijo", en: "Explore the destination" },
    dateTitle: { sl: "Datum dogodka", en: "Event date" },
    venueTitle: { sl: "Lokacija", en: "Location" },
    priceTitle: { sl: "Vstopnina", en: "Admission" },
    featured: { sl: "Izpostavljeno", en: "Featured" },
    enNote: {
      sl: "",
      en: "Content note: the event calendar is canonically Slovenian (production source); an English content overlay is not yet available.",
    },
  } as const;

  const filtered = EVENTS.filter(
    (e) =>
      (month === "all" || e.monthIndex === month) &&
      (category === "all" || e.category === category)
  );

  // Razvrsti po mesecih (produkcija: skupine po mesecih v vrstnem redu koledarja).
  const monthsPresent = EVENT_MONTHS.filter(
    (m) => month === "all" || m.index === month
  ).filter((m) => filtered.some((e) => e.monthIndex === m.index));

  const hasFilters = month !== "all" || category !== "all";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)}>
        <p className="mt-3 text-sm text-muted-foreground">{pick(l, L.metaNote)}</p>
      </PageHeader>

      {l === "en" && pick(l, L.enNote) && (
        <p className="mt-6 rounded-md border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground">
          {pick(l, L.enNote)}
        </p>
      )}

      <section aria-labelledby="calendar-title" className="mt-10">
        <h2 id="calendar-title" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.calendarTitle)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.calendarLead)}</p>
        <p className="mt-4 text-center text-sm text-muted-foreground" role="status">
          {eventCountLabel(l, filtered.length)}
        </p>

        {/* Filtri */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="sr-only">{pick(l, L.filterMonth)}</p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={pick(l, L.filterMonth)}
            >
              <FilterChip
                active={month === "all"}
                onClick={() => setMonth("all")}
                label={pick(l, L.allMonths)}
              />
              {EVENT_MONTHS.map((m) => (
                <FilterChip
                  key={m.index}
                  active={month === m.index}
                  onClick={() => setMonth(m.index)}
                  label={pick(l, m)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="sr-only">{pick(l, L.filterCategory)}</p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={pick(l, L.filterCategory)}
            >
              <FilterChip
                active={category === "all"}
                onClick={() => setCategory("all")}
                label={pick(l, L.allCategories)}
              />
              {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((cat) => (
                <FilterChip
                  key={cat}
                  active={category === cat}
                  onClick={() => setCategory(cat)}
                  label={pick(l, EVENT_CATEGORIES[cat])}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Seznam po mesecih */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">{pick(l, L.noEvents)}</p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setMonth("all");
                  setCategory("all");
                }}
                className="mt-4 inline-flex min-h-9 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent focus-green"
              >
                {pick(l, L.clearFilters)}
              </button>
            )}
          </div>
        ) : (
          monthsPresent.map((m) => {
            const monthEvents = filtered.filter((e) => e.monthIndex === m.index);
            return (
              <div key={m.index} className="mt-10">
                <div className="flex items-center gap-3 border-b border-border pb-3">
                  <h3 className="text-xl font-bold text-primary sm:text-2xl">{pick(l, m)}</h3>
                  <Badge variant="secondary">{eventCountLabel(l, monthEvents.length)}</Badge>
                </div>
                <ul className="mt-5 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
                  {monthEvents.map((e) => {
                    const CatIcon = categoryIcon(e.category);
                    const dest = e.destSlug ? getDestination(e.destSlug) : undefined;
                    return (
                      <li key={e.id}>
                        <Card className="group gap-0 overflow-hidden py-0 transition-all hover:shadow-lg">
                          <div className="flex flex-row">
                            <div className="relative w-28 shrink-0 overflow-hidden bg-muted sm:w-40">
                              <Image
                                src={e.image}
                                alt={`${e.title} — ${e.venue}`}
                                fill
                                loading="lazy"
                                sizes="160px"
                                className="aspect-square size-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {e.featured && <Badge>{pick(l, L.featured)}</Badge>}
                                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                                  <CatIcon className="size-3" aria-hidden="true" />
                                  {pick(l, EVENT_CATEGORIES[e.category])}
                                </span>
                              </div>
                              <h4 className="text-base leading-tight font-semibold sm:text-lg">
                                {e.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                <span
                                  className="inline-flex items-center gap-1.5"
                                  title={pick(l, L.dateTitle)}
                                >
                                  <CalendarDays
                                    className="size-4 text-primary"
                                    aria-hidden="true"
                                  />
                                  <time dateTime={e.dateStart} className="font-medium text-foreground/80">
                                    {e.dateLabel}
                                  </time>
                                </span>
                                <span
                                  className="inline-flex items-center gap-1.5"
                                  title={pick(l, L.venueTitle)}
                                >
                                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                                  {e.venue}
                                </span>
                                <span
                                  className="inline-flex items-center gap-1.5"
                                  title={pick(l, L.priceTitle)}
                                >
                                  <Ticket className="size-4 text-primary" aria-hidden="true" />
                                  <span className="font-medium text-foreground/80">
                                    {pick(l, EVENT_PRICE_LABEL[e.price])}
                                  </span>
                                </span>
                              </div>
                              <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                                {e.description}
                              </p>
                              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                                <AddToTripButton
                                  refId={`dogodek/${e.id}`}
                                  name={e.title}
                                  kind="event"
                                  source="dogodki"
                                  labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
                                />
                                {e.website && (
                                  <a
                                    href={e.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent focus-green"
                                  >
                                    {pick(l, L.website)}
                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                  </a>
                                )}
                                {dest && (
                                  <Link
                                    href={`/destinacija/${dest.slug}`}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary/10 focus-green"
                                  >
                                    {pick(l, L.exploreDest)}
                                    <ArrowRight className="size-3.5" aria-hidden="true" />
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-green ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
