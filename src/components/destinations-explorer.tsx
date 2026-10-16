"use client";

import { Search, SearchX, X } from "lucide-react";
import { useLocale } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { useSearchParams } from "next/navigation";

import { DestinationCard } from "@/components/destination-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pick } from "@/lib/i18n-pick";
import {
  activeCountryKeys,
  activeRegionKeys,
  filterDestinations,
  hasActiveFilters,
} from "@/lib/destinations-filter";
import { countryLabel } from "@/lib/countries-data";
import {
  DEST_TYPES,
  DESTINATIONS,
  REGIONS,
  type DestinationType,
} from "@/lib/slovenia-data";

/** Pomočnik za množino (ednina/dvojina/množina — kanon izvirnika). */
function destWord(l: string, n: number): string {
  if (l === "en") return n === 1 ? "destination" : "destinations";
  if (l === "it") return n === 1 ? "destinazione" : "destinazioni";
  if (l === "de") return n === 1 ? "Reiseziel" : "Reiseziele";
  if (l === "fr") return n === 1 ? "destination" : "destinations";
  if (l === "es") return n === 1 ? "destino" : "destinos";
  // slovenščina: ednina/dvojina/množina
  if (n === 1) return "destinacija";
  if (n === 2) return "destinaciji";
  if (n >= 3 && n <= 4) return "destinacije";
  return "destinacij";
}

type DestinationSort = "recommended" | "name-asc" | "name-desc";

/**
 * RAZISKOVALKA DESTINACIJ — polna funkcionalna stran: iskanje po imenu/
 * tagline/opisu + filtra regija/tip + mreža kartic vseh 74 destinacij.
 * Začetno stanje prevzame ?q= ?region= ?type= iz URL (domov, teme).
 */
export function DestinationsExplorer() {
  const l = useLocale();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const L = {
    kicker: { sl: "Odkrij", en: "Discover", it: "Scopri", de: "Entdecken", fr: "Découvrir", es: "Descubre" },
    title: { sl: "Destinacije", en: "Destinations", it: "Destinazioni", de: "Reiseziele", fr: "Destinations", es: "Destinos" },
    lead: {
      sl: `${DESTINATIONS.length} kuriranih destinacij Slovenije in celotnega Balkana — z izvorno zabeleženim virom, oceno in praktičnimi podatki.`,
      en: `${DESTINATIONS.length} curated destinations across Slovenia and the Balkans — with recorded provenance, ratings and practical details.`,
      it: `${DESTINATIONS.length} destinazioni selezionate tra Slovenia e Balcani — con fonte documentata, valutazioni e informazioni pratiche.`,
      de: `${DESTINATIONS.length} kuratierte Reiseziele in Slowenien und auf dem Balkan — mit erfasster Quelle, Bewertungen und praktischen Details.`,
      fr: `${DESTINATIONS.length} destinations sélectionnées en Slovénie et dans les Balkans — avec provenance enregistrée, notes et informations pratiques.`,
      es: `${DESTINATIONS.length} destinos seleccionados de Eslovenia y los Balcanes — con fuente registrada, valoraciones y datos prácticos.`,
    },
    searchLabel: {
      sl: "Išči po imenu, opisu ali poudarkih",
      en: "Search by name, description or highlights",
      it: "Cerca per nome, descrizione o punti di forza",
      de: "Nach Name, Beschreibung oder Highlights suchen",
      fr: "Rechercher par nom, description ou points forts",
      es: "Busca por nombre, descripción o destacados",
    },
    searchPlaceholder: {
      sl: "Iskanje: Bled, jama, obala …",
      en: "Search: Bled, cave, coast …",
      it: "Cerca: Bled, grotta, costa …",
      de: "Suche: Bled, Höhle, Küste …",
      fr: "Rechercher : Bled, grotte, côte …",
      es: "Buscar: Bled, cueva, costa …",
    },
    clearSearch: { sl: "Počisti iskanje", en: "Clear search", it: "Cancella la ricerca", de: "Suche löschen", fr: "Effacer la recherche", es: "Borrar búsqueda" },
    regionLabel: {
      sl: "Filtriraj po regiji",
      en: "Filter by region",
      it: "Filtra per regione",
      de: "Nach Region filtern",
      fr: "Filtrer par région",
      es: "Filtrar por región",
    },
    typeLabel: {
      sl: "Filtriraj po tipu",
      en: "Filter by type",
      it: "Filtra per tipo",
      de: "Nach Typ filtern",
      fr: "Filtrer par type",
      es: "Filtrar por tipo",
    },
    allRegions: { sl: "Vse regije", en: "All regions", it: "Tutte le regioni", de: "Alle Regionen", fr: "Toutes les régions", es: "Todas las regiones" },
    allTypes: { sl: "Vsi tipi", en: "All types", it: "Tutti i tipi", de: "Alle Typen", fr: "Tous les types", es: "Todos los tipos" },
    countryLabel: {
      sl: "Filtriraj po državi",
      en: "Filter by country",
      it: "Filtra per paese",
      de: "Nach Land filtern",
      fr: "Filtrer par pays",
      es: "Filtrar por país",
    },
    allCountries: { sl: "Vse države", en: "All countries", it: "Tutti i paesi", de: "Alle Länder", fr: "Tous les pays", es: "Todos los países" },
    reset: { sl: "Počisti filtre", en: "Clear filters", it: "Azzera i filtri", de: "Filter zurücksetzen", fr: "Effacer les filtres", es: "Borrar filtros" },
    count: {
      sl: (n: number) => `${n} ${destWord("sl", n)}`,
      en: (n: number) => `${n} ${destWord("en", n)}`,
      it: (n: number) => `${n} ${destWord("it", n)}`,
      de: (n: number) => `${n} ${destWord("de", n)}`,
      fr: (n: number) => `${n} ${destWord("fr", n)}`,
      es: (n: number) => `${n} ${destWord("es", n)}`,
    },
    emptyTitle: { sl: "Ni zadetkov", en: "No matches", it: "Nessun risultato", de: "Keine Treffer", fr: "Aucun résultat", es: "Sin resultados" },
    emptyLead: {
      sl: "Za iskani niz ali kombinacijo filtrov ni destinacij. Poskusi drugačen niz ali počisti filtre.",
      en: "No destinations match your search or filter combination. Try a different query or clear the filters.",
      it: "Nessuna destinazione corrisponde alla ricerca o alla combinazione di filtri. Prova un’altra ricerca o azzera i filtri.",
      de: "Keine Reiseziele entsprechen deiner Suche oder Filterkombination. Versuche eine andere Suche oder setze die Filter zurück.",
      fr: "Aucune destination ne correspond à ta recherche ou à tes filtres. Essaie une autre recherche ou efface les filtres.",
      es: "Ningún destino coincide con tu búsqueda o combinación de filtros. Prueba otra búsqueda o borra los filtros.",
    },
    resultsLabel: { sl: "Rezultati", en: "Results", it: "Risultati", de: "Ergebnisse", fr: "Résultats", es: "Resultados" },
    sortLabel: { sl: "Razvrsti destinacije", en: "Sort destinations", it: "Ordina le destinazioni", de: "Reiseziele sortieren", fr: "Trier les destinations", es: "Ordenar destinos" },
    sortRecommended: { sl: "Priporočeno", en: "Recommended", it: "Consigliate", de: "Empfohlen", fr: "Recommandées", es: "Recomendados" },
    sortNameAsc: { sl: "Ime A–Ž", en: "Name A–Z", it: "Nome A–Z", de: "Name A–Z", fr: "Nom A–Z", es: "Nombre A–Z" },
    sortNameDesc: { sl: "Ime Ž–A", en: "Name Z–A", it: "Nome Z–A", de: "Name Z–A", fr: "Nom Z–A", es: "Nombre Z–A" },
    activeFilters: { sl: "Aktivni filtri", en: "Active filters", it: "Filtri attivi", de: "Aktive Filter", fr: "Filtres actifs", es: "Filtros activos" },
    queryChip: { sl: "Iskanje", en: "Search", it: "Ricerca", de: "Suche", fr: "Recherche", es: "Búsqueda" },
    countryChip: { sl: "Država", en: "Country", it: "Paese", de: "Land", fr: "Pays", es: "País" },
    regionChip: { sl: "Regija", en: "Region", it: "Regione", de: "Region", fr: "Région", es: "Región" },
    typeChip: { sl: "Tip", en: "Type", it: "Tipo", de: "Typ", fr: "Type", es: "Tipo" },
    removeFilter: { sl: "Odstrani filter", en: "Remove filter", it: "Rimuovi filtro", de: "Filter entfernen", fr: "Supprimer le filtre", es: "Quitar filtro" },
  } as const;

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [region, setRegion] = React.useState(searchParams.get("region") ?? "all");
  const [type, setType] = React.useState(searchParams.get("type") ?? "all");
  // #41 F0: ?country= iz URL (neznana vrednost → logika filtra vrne prazen rezultat).
  const [country, setCountry] = React.useState(searchParams.get("country") ?? "all");
  const sortParam = searchParams.get("sort");
  const [sortBy, setSortBy] = React.useState<DestinationSort>(
    sortParam === "name-asc" || sortParam === "name-desc" ? sortParam : "recommended",
  );

  // Regije/države, ki dejansko nastopajo v naboru (kanonska vrstni red slovarja).
  // Logika filtra je izvlečena v @/lib/destinations-filter (2.47.0, #38:
  // regresijski testi filtrov destinacij) — komponenta jo samo kliče.
  const activeRegions = React.useMemo(() => activeRegionKeys(DESTINATIONS), []);
  const activeCountries = React.useMemo(() => activeCountryKeys(DESTINATIONS), []);

  const filteredResults = React.useMemo(
    () => filterDestinations(DESTINATIONS, { q, region, type, country }),
    [q, region, type, country],
  );

  // Privzeto ohranimo kurirani vrstni red registra; abecedni vrstni red je izrecna izbira.
  const results = React.useMemo(() => {
    const ordered = [...filteredResults];
    if (sortBy === "name-asc") {
      ordered.sort((a, b) => a.name.localeCompare(b.name, l, { sensitivity: "base", numeric: true }));
    } else if (sortBy === "name-desc") {
      ordered.sort((a, b) => b.name.localeCompare(a.name, l, { sensitivity: "base", numeric: true }));
    }
    return ordered;
  }, [filteredResults, sortBy, l]);

  const hasFilters = hasActiveFilters({ q, region, type, country });

  // URL je del stanja iskalnika: povezavo lahko deliš in jo osvežiš brez izgube filtrov.
  // replaceState posodobi trenutni vnos (brez enega vnosa zgodovine za vsak znak) in ohrani
  // nepovezane parametre ter hash. Filtriranje ostane lokalno in brez omrežnih zahtev.
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const filterParams: Record<string, string> = {
      q: q.trim(),
      country,
      region,
      type,
      sort: sortBy,
    };

    for (const [key, value] of Object.entries(filterParams)) {
      if (!value || value === "all" || (key === "sort" && value === "recommended")) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [q, country, region, type, sortBy]);

  const reset = () => {
    setQ("");
    setRegion("all");
    setType("all");
    setCountry("all");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        kicker={pick(l, L.kicker)}
        title={pick(l, L.title)}
        lead={pick(l, L.lead)}
      />

      {/* Nadzorna vrstica: iskanje + filtri (država/regija/tip, #41 F0) */}
      <div className="mt-7 grid grid-cols-2 gap-3 rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/20 p-3 shadow-[0_20px_60px_-38px_rgba(15,23,42,0.34)] ring-1 ring-foreground/[0.04] sm:mt-8 sm:p-5 lg:grid-cols-[minmax(240px,1fr)_auto_auto_auto]">
        <div className="relative col-span-2 min-w-0 lg:col-span-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="dest-search" className="sr-only">
            {pick(l, L.searchLabel)}
          </label>
          <Input
            id="dest-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={pick(l, L.searchPlaceholder)}
            className="h-12 rounded-xl border-border/70 bg-background pl-10 pr-10 shadow-sm focus-visible:ring-primary"
            autoComplete="off"
          />
          {q.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={pick(l, L.clearSearch)}
              onClick={() => setQ("")}
              className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor="dest-country" className="sr-only">
            {pick(l, L.countryLabel)}
          </label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="dest-country" className="h-12 w-full rounded-xl border-border/70 bg-background shadow-sm lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              <SelectItem value="all">{pick(l, L.allCountries)}</SelectItem>
              {activeCountries.map((c) => (
                <SelectItem key={c} value={c}>
                  {countryLabel(l, c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <label htmlFor="dest-region" className="sr-only">
            {pick(l, L.regionLabel)}
          </label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger id="dest-region" className="h-12 w-full rounded-xl border-border/70 bg-background shadow-sm lg:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-96">
              <SelectItem value="all">{pick(l, L.allRegions)}</SelectItem>
              {activeRegions.map((r) => (
                <SelectItem key={r} value={r}>
                  {pick(l, REGIONS[r])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 min-w-0 lg:col-span-1">
          <label htmlFor="dest-type" className="sr-only">
            {pick(l, L.typeLabel)}
          </label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="dest-type" className="h-12 w-full rounded-xl border-border/70 bg-background shadow-sm lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{pick(l, L.allTypes)}</SelectItem>
              {(Object.keys(DEST_TYPES) as DestinationType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {pick(l, DEST_TYPES[t])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Aktivni filtri: posamezen čip lahko odstraniš brez ponastavitve ostalih. */}
      {hasFilters && (
        <div
          role="group"
          aria-label={pick(l, L.activeFilters)}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          {q.trim() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${pick(l, L.removeFilter)}: ${pick(l, L.queryChip)}`}
              onClick={() => setQ("")}
              className="h-9 min-w-0 max-w-full justify-start gap-1.5 rounded-full px-3 text-xs"
            >
              <span className="shrink-0 text-muted-foreground">{pick(l, L.queryChip)}:</span>
              <span className="min-w-0 max-w-[min(55vw,280px)] truncate">{q.trim()}</span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          )}
          {country !== "all" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${pick(l, L.removeFilter)}: ${pick(l, L.countryChip)}`}
              onClick={() => setCountry("all")}
              className="h-9 min-w-0 max-w-full justify-start gap-1.5 rounded-full px-3 text-xs"
            >
              <span className="shrink-0 text-muted-foreground">{pick(l, L.countryChip)}:</span>
              <span className="min-w-0 max-w-[min(55vw,280px)] truncate">
                {activeCountries.includes(country as (typeof activeCountries)[number])
                  ? countryLabel(l, country as (typeof activeCountries)[number])
                  : country}
              </span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          )}
          {region !== "all" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${pick(l, L.removeFilter)}: ${pick(l, L.regionChip)}`}
              onClick={() => setRegion("all")}
              className="h-9 min-w-0 max-w-full justify-start gap-1.5 rounded-full px-3 text-xs"
            >
              <span className="shrink-0 text-muted-foreground">{pick(l, L.regionChip)}:</span>
              <span className="min-w-0 max-w-[min(55vw,280px)] truncate">
                {Object.prototype.hasOwnProperty.call(REGIONS, region) ? pick(l, REGIONS[region as keyof typeof REGIONS]) : region}
              </span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          )}
          {type !== "all" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`${pick(l, L.removeFilter)}: ${pick(l, L.typeChip)}`}
              onClick={() => setType("all")}
              className="h-9 min-w-0 max-w-full justify-start gap-1.5 rounded-full px-3 text-xs"
            >
              <span className="shrink-0 text-muted-foreground">{pick(l, L.typeChip)}:</span>
              <span className="min-w-0 max-w-[min(55vw,280px)] truncate">
                {Object.prototype.hasOwnProperty.call(DEST_TYPES, type) ? pick(l, DEST_TYPES[type as DestinationType]) : type}
              </span>
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      {/* Števec zadetkov (+ ponastavitev) */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-medium text-muted-foreground">
          {pick(l, L.count)(results.length)}
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <label htmlFor="dest-sort" className="sr-only">
            {pick(l, L.sortLabel)}
          </label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as DestinationSort)}>
            <SelectTrigger
              id="dest-sort"
              className="h-9 w-40 rounded-full border-border/70 bg-background text-xs shadow-sm sm:w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">{pick(l, L.sortRecommended)}</SelectItem>
              <SelectItem value="name-asc">{pick(l, L.sortNameAsc)}</SelectItem>
              <SelectItem value="name-desc">{pick(l, L.sortNameDesc)}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="h-9 gap-1 text-muted-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              {pick(l, L.reset)}
            </Button>
          )}
        </div>
      </div>

      {/* Mreža kartic */}
      {results.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((d, i) => (
            <DestinationCard key={d.slug} d={d} priority={i < 3} />
          ))}
        </div>
      ) : (
        /* Prijazno prazno stanje (issue #1 §4): ikona SearchX + besedilo +
           gumb „Počisti filtre" — subtilen fade vstop (~180 ms, ugasnjen
           ob reduced-motion). Iskrenost: napaka tu ni mogoča — filtriranje
           teče sinhrono nad lokalnim naborom (0 omrežja), zato retry
           stanje bi bilo izmišljeno. */
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mt-6 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center sm:p-10"
        >
          <SearchX
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-3 text-base font-semibold">{pick(l, L.emptyTitle)}</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            {pick(l, L.emptyLead)}
          </p>
          <Button onClick={reset} variant="outline" className="mt-5 min-h-11">
            <X className="size-4" aria-hidden="true" />
            {pick(l, L.reset)}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
