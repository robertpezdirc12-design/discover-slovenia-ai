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

/**
 * RAZISKOVALKA DESTINACIJ — polna funkcionalna stran: iskanje po imenu/
 * tagline/opisu + filtra regija/tip + mreža kartic vseh 38 destinacij.
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
  } as const;

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [region, setRegion] = React.useState(searchParams.get("region") ?? "all");
  const [type, setType] = React.useState(searchParams.get("type") ?? "all");
  // #41 F0: ?country= iz URL (neznana vrednost → logika filtra vrne prazen rezultat).
  const [country, setCountry] = React.useState(searchParams.get("country") ?? "all");

  // Regije/države, ki dejansko nastopajo v naboru (kanonska vrstni red slovarja).
  // Logika filtra je izvlečena v @/lib/destinations-filter (2.47.0, #38:
  // regresijski testi filtrov destinacij) — komponenta jo samo kliče.
  const activeRegions = React.useMemo(() => activeRegionKeys(DESTINATIONS), []);
  const activeCountries = React.useMemo(() => activeCountryKeys(DESTINATIONS), []);

  const results = React.useMemo(
    () => filterDestinations(DESTINATIONS, { q, region, type, country }),
    [q, region, type, country],
  );

  const hasFilters = hasActiveFilters({ q, region, type, country });

  const reset = () => {
    setQ("");
    setRegion("all");
    setType("all");
    setCountry("all");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        kicker={pick(l, L.kicker)}
        title={pick(l, L.title)}
        lead={pick(l, L.lead)}
      />

      {/* Nadzorna vrstica: iskanje + filtri (država/regija/tip, #41 F0) */}
      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
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
            className="h-11 pl-9"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="dest-country" className="sr-only">
            {pick(l, L.countryLabel)}
          </label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger id="dest-country" className="h-11 w-full md:w-56">
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

        <div>
          <label htmlFor="dest-region" className="sr-only">
            {pick(l, L.regionLabel)}
          </label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger id="dest-region" className="h-11 w-full md:w-52">
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

        <div>
          <label htmlFor="dest-type" className="sr-only">
            {pick(l, L.typeLabel)}
          </label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="dest-type" className="h-11 w-full md:w-44">
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

      {/* Števec zadetkov (+ ponastavitev) */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm font-medium text-muted-foreground">
          {pick(l, L.count)(results.length)}
        </p>
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

      {/* Mreža kartic */}
      {results.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          className="mt-6 rounded-xl border border-dashed p-6 text-center sm:p-10"
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
