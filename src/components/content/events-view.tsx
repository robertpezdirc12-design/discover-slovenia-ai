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
import { ALL_COUNTRY_CODES, countryLabel } from "@/lib/countries-data";
import {
  EVENT_CATEGORIES,
  EVENT_MONTHS,
  EVENT_PRICE_LABEL,
  EVENTS,
  eventCountry,
  isEventPast,
  type EventCategory,
} from "@/lib/content-data";
import { type CountryCode, getDestination } from "@/lib/slovenia-data";

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

/** Množinska oblika števca dogodkov (SL: ednina/dvojina/množina; EN/IT/DE/FR/ES: ednina/množina). */
function eventCountLabel(l: string, n: number): string {
  if (l === "en") return n === 1 ? "1 event" : `${n} events`;
  if (l === "it") return n === 1 ? "1 evento" : `${n} eventi`;
  if (l === "de") return n === 1 ? "1 Veranstaltung" : `${n} Veranstaltungen`;
  if (l === "fr") return n === 1 ? "1 événement" : `${n} événements`;
  if (l === "es") return n === 1 ? "1 evento" : `${n} eventos`;
  // slovenščina: ednina/dvojina/množina
  if (n === 1) return "1 dogodek";
  if (n === 2) return "2 dogodka";
  if (n >= 3 && n <= 4) return `${n} dogodki`;
  return `${n} dogodkov`;
}

/**
 * /dogodki — koledar 31 dogodkov (30 iz produkcije + razdvojen zapis P0 2. serije): filtri po mesecu in
 * kategoriji, mesečne skupine, kartice z datumom, lokacijo, vstopnino,
 * uradno spletno stranjo in povezavo na destinacijo.
 */
export function EventsView({ todayIso }: { todayIso?: string }) {
  const l = useLocale();
  const [month, setMonth] = React.useState<number | "all">("all");
  const [category, setCategory] = React.useState<EventCategory | "all">("all");
  // #41 F0: državni filter (aktivne = tiste z vsebino; F2 doda balkanske).
  const [country, setCountry] = React.useState<CountryCode | "all">("all");

  const L = {
    kicker: { sl: "Dogodki", en: "Events", it: "Eventi", de: "Veranstaltungen", fr: "Événements", es: "Eventos" },
    title: { sl: "Dogodki in prireditve v Sloveniji", en: "Events in Slovenia", it: "Eventi in Slovenia", de: "Veranstaltungen in Slowenien", fr: "Événements en Slovénie", es: "Eventos en Eslovenia" },
    lead: {
      sl: "Od festivalov in sejemov do športa in kulture — koledar dogodkov po vsej Sloveniji z datumi, lokacijami in kategorijami.",
      en: "From festivals and fairs to sport and culture — a calendar of events across Slovenia with dates, venues and categories.",
      it: "Dai festival e dalle fiere allo sport e alla cultura — un calendario di eventi in tutta la Slovenia con date, luoghi e categorie.",
      de: "Von Festivals und Messen bis zu Sport und Kultur — ein Veranstaltungskalender für ganz Slowenien mit Daten, Orten und Kategorien.",
      fr: "Des festivals aux foires, du sport à la culture — un calendrier d’événements dans toute la Slovénie avec dates, lieux et catégories.",
      es: "De festivales y ferias a deporte y cultura — un calendario de eventos por toda Eslovenia con fechas, lugares y categorías.",
    },
    metaNote: { sl: "Filtri po mesecu in kategoriji · Brez prijave", en: "Filters by month and category · No sign-up needed", it: "Filtri per mese e categoria · Senza registrazione", de: "Filter nach Monat und Kategorie · Keine Anmeldung nötig", fr: "Filtres par mois et catégorie · Sans inscription", es: "Filtros por mes y categoría · Sin registro" },
    calendarTitle: {
      sl: "Koledar dogodkov",
      en: "Event calendar",
      it: "Calendario degli eventi",
      de: "Veranstaltungskalender",
      fr: "Calendrier des événements",
      es: "Calendario de eventos",
    },
    calendarLead: {
      sl: "Festivali, prireditve in dogodki skozi vse leto",
      en: "Festivals, happenings and events throughout the year",
      it: "Festival, manifestazioni ed eventi durante tutto l’anno",
      de: "Festivals, Veranstaltungen und Events das ganze Jahr über",
      fr: "Festivals, manifestations et événements toute l’année",
      es: "Festivales, acontecimientos y eventos durante todo el año",
    },
    allMonths: { sl: "Vse leto", en: "All year", it: "Tutto l’anno", de: "Ganzes Jahr", fr: "Toute l’année", es: "Todo el año" },
    allCategories: { sl: "Vse kategorije", en: "All categories", it: "Tutte le categorie", de: "Alle Kategorien", fr: "Toutes les catégories", es: "Todas las categorías" },
    filterMonth: { sl: "Filtriraj po mesecu", en: "Filter by month", it: "Filtra per mese", de: "Nach Monat filtern", fr: "Filtrer par mois", es: "Filtrar por mes" },
    filterCategory: { sl: "Filtriraj po kategoriji", en: "Filter by category", it: "Filtra per categoria", de: "Nach Kategorie filtern", fr: "Filtrer par catégorie", es: "Filtrar por categoría" },
    filterCountry: { sl: "Filtriraj po državi", en: "Filter by country", it: "Filtra per paese", de: "Nach Land filtern", fr: "Filtrer par pays", es: "Filtrar por país" },
    allCountries: { sl: "Vse države", en: "All countries", it: "Tutti i paesi", de: "Alle Länder", fr: "Tous les pays", es: "Todos los países" },
    noEvents: {
      sl: "Za izbrano kombinacijo filtra ni dogodkov — počisti filter ali izberi drug mesec.",
      en: "No events match this filter combination — clear the filters or pick another month.",
      it: "Nessun evento per questa combinazione di filtri — azzera i filtri o scegli un altro mese.",
      de: "Keine Veranstaltungen passen zu dieser Filterkombination — setze die Filter zurück oder wähle einen anderen Monat.",
      fr: "Aucun événement ne correspond à cette combinaison de filtres — efface les filtres ou choisis un autre mois.",
      es: "Ningún evento coincide con esta combinación de filtros — borra los filtros o elige otro mes.",
    },
    clearFilters: { sl: "Počisti filtre", en: "Clear filters", it: "Azzera i filtri", de: "Filter zurücksetzen", fr: "Effacer les filtres", es: "Borrar filtros" },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓", it: "Nel mio viaggio ✓", de: "In meiner Reise ✓", fr: "Dans mon voyage ✓", es: "En mi viaje ✓" },
    website: { sl: "Spletna stran", en: "Website", it: "Sito web", de: "Webseite", fr: "Site web", es: "Sitio web" },
    exploreDest: { sl: "Razišči destinacijo", en: "Explore the destination", it: "Esplora la destinazione", de: "Destination entdecken", fr: "Explorer la destination", es: "Explora el destino" },
    dateTitle: { sl: "Datum dogodka", en: "Event date", it: "Data dell’evento", de: "Veranstaltungsdatum", fr: "Date de l’événement", es: "Fecha del evento" },
    // QA P0 (#34→#38): pošten prikaz za dogodke brez uradno objavljenega
    // termina — izmišljen datum nikoli ni prikazan (iskrenostni kanon).
    unconfirmedDate: {
      sl: "datum še ni potrjen",
      en: "date not yet confirmed",
      it: "data non ancora confermata",
      de: "Datum noch nicht bestätigt",
      fr: "date pas encore confirmée",
      es: "fecha aún sin confirmar",
    },
    unconfirmedNote: {
      sl: "Datum bo objavljen, ko ga potrdi organizator — pričakovano okno glej po mesecu.",
      en: "The date will be published once confirmed by the organizer — see the month for the expected window.",
      it: "La data sarà pubblicata quando confermata dall’organizzatore — consulta il mese per la finestra prevista.",
      de: "Das Datum wird veröffentlicht, sobald der Veranstalter es bestätigt — das erwartete Zeitfenster siehe Monat.",
      fr: "La date sera publiée une fois confirmée par l’organisateur — voir le mois pour la période prévue.",
      es: "La fecha se publicará cuando la confirme el organizador — consulte el mes para la ventana prevista.",
    },
    venueTitle: { sl: "Lokacija", en: "Location", it: "Luogo", de: "Ort", fr: "Lieu", es: "Lugar" },
    priceTitle: { sl: "Vstopnina", en: "Admission", it: "Ingresso", de: "Eintritt", fr: "Entrée", es: "Entrada" },
    featured: { sl: "Izpostavljeno", en: "Featured", it: "In evidenza", de: "Empfohlen", fr: "En vedette", es: "Destacado" },
    // #38 (2.48.0): „Pretekle dogodke odstrani iz privzetega seznama
    // prihodnjih dogodkov oziroma jih jasno prikaži kot pretekle“ —
    // izbrana JE oznaka (ne brisanje): sledljivost zapisa in vira ostane
    // (kanon „ne briši podatkov brez razloga“). todayIso podaja SSR prop.
    pastEvent: {
      sl: "pretekli dogodek",
      en: "past event",
      it: "evento passato",
      de: "vergangene Veranstaltung",
      fr: "événement passé",
      es: "evento pasado",
    },
    enNote: {
      sl: "",
      en: "Content note: the event calendar is canonically Slovenian (production source); an English content overlay is not yet available.",
      it: "Nota sui contenuti: il calendario eventi è canonicamente in sloveno (fonte di produzione); un overlay dei contenuti in inglese non è ancora disponibile.",
      de: "Inhaltshinweis: der Veranstaltungskalender ist kanonisch slowenisch (Produktionsquelle); ein englischer Inhalts-Overlay ist noch nicht verfügbar.",
      fr: "Note de contenu : le calendrier des événements est canoniquement en slovène (source de production) ; une surcouche de contenu en anglais n’est pas encore disponible.",
      es: "Nota de contenido: el calendario de eventos es canónicamente en esloveno (fuente de producción); una superposición de contenido en inglés aún no está disponible.",
    },
  } as const;

  const filtered = EVENTS.filter(
    (e) =>
      (month === "all" || e.monthIndex === month) &&
      (category === "all" || e.category === category) &&
      (country === "all" || eventCountry(e) === country)
  );

  // Države, ki dejansko nastopajo v registru dogodkov (kanonski vrstni
  // red ALL_COUNTRY_CODES; #41 F0: register je implicitno SI — F2 doda).
  const eventCountries = React.useMemo(() => {
    const present = new Set<CountryCode>(EVENTS.map((e) => eventCountry(e)));
    return ALL_COUNTRY_CODES.filter((c) => present.has(c));
  }, []);

  // Razvrsti po mesecih (produkcija: skupine po mesecih v vrstnem redu koledarja).
  const monthsPresent = EVENT_MONTHS.filter(
    (m) => month === "all" || m.index === month
  ).filter((m) => filtered.some((e) => e.monthIndex === m.index));

  const hasFilters = month !== "all" || category !== "all" || country !== "all";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)}>
        <p className="mt-3 text-sm text-muted-foreground">{pick(l, L.metaNote)}</p>
      </PageHeader>

      {l === "en" && pick(l, L.enNote) && (
        <p className="mt-6 rounded-xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/[0.06] to-card px-4 py-3 text-xs text-muted-foreground">
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

        {/* Filtri (#41 F0: + država) */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <div>
            <p className="sr-only">{pick(l, L.filterCountry)}</p>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={pick(l, L.filterCountry)}
            >
              <FilterChip
                active={country === "all"}
                onClick={() => setCountry("all")}
                label={pick(l, L.allCountries)}
              />
              {eventCountries.map((c) => (
                <FilterChip
                  key={c}
                  active={country === c}
                  onClick={() => setCountry(c)}
                  label={countryLabel(l, c)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Seznam po mesecih */}
        {filtered.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
            <p className="text-sm text-muted-foreground">{pick(l, L.noEvents)}</p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setMonth("all");
                  setCategory("all");
                  setCountry("all");
                }}
                className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-border/70 bg-card px-4 text-sm font-semibold shadow-sm transition-all hover:border-primary/30 hover:bg-muted/30 focus-green"
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
                        <Card className="group gap-0 overflow-hidden rounded-2xl border-border/70 py-0 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
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
                                {todayIso !== undefined && isEventPast(e, todayIso) && (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    {pick(l, L.pastEvent)}
                                  </Badge>
                                )}
                                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                                  <CatIcon className="size-3" aria-hidden="true" />
                                  {pick(l, EVENT_CATEGORIES[e.category])}
                                </span>
                              </div>
                              <h4 className="text-base leading-tight font-semibold sm:text-lg">
                                {e.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                {/* QA P0 (#34→#38): potrjen datum = <time>; nepotrjen =
                                    pošten napis brez izmišljenega datuma (ni <time dateTime>). */}
                                <span
                                  className="inline-flex items-center gap-1.5"
                                  title={pick(l, L.dateTitle)}
                                >
                                  <CalendarDays
                                    className="size-4 text-primary"
                                    aria-hidden="true"
                                  />
                                  {e.dateUnconfirmed ? (
                                    <span className="font-medium text-foreground/70 italic">
                                      {pick(l, L.unconfirmedDate)}
                                    </span>
                                  ) : (
                                    <time dateTime={e.dateStart} className="font-medium text-foreground/80">
                                      {e.dateLabel}
                                    </time>
                                  )}
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
                              {e.dateUnconfirmed && (
                                <p className="text-xs text-muted-foreground/80">
                                  {pick(l, L.unconfirmedNote)}
                                </p>
                              )}
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
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-muted/30 focus-green"
                                  >
                                    {pick(l, L.website)}
                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                  </a>
                                )}
                                {dest && (
                                  <Link
                                    href={`/destinacija/${dest.slug}`}
                                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-green"
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
