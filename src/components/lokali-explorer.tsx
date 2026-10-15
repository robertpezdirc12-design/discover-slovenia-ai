"use client";

/**
 * LOKALI RAZISKOVALEC — B2B imenik lokalnih ponudnikov (rekonstrukcija /lokali).
 *
 * Struktura po produkciji (mirror + JS modul): kategorije, vremenske
 * oznake, razvrščanje izpostavljeni/prvi, iskanje in filtri, gumb
 * "Dodaj v mojo pot" ter CTA "Pridruži se". Podatki: src/lib/lokali-data.ts
 * (uredniška kuracija — iskrena opomba o obsegu je na strani obvezna).
 */

import { Check, Heart, MapPin, Search, SearchX, Sun, Umbrella, X } from "lucide-react";
import { useLocale } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  LOKALI,
  LOKALI_HONESTY_NOTE,
  LOKAL_CATEGORIES,
  WEATHER_FIT_LABELS,
  activeLokalCategories,
  activeLokalRegions,
  type Lokal,
} from "@/lib/lokali-data";
import { myTrip, useMyTripList } from "@/lib/my-trip";
import { regionLabel } from "@/lib/slovenia-data";
import { cn } from "@/lib/utils";

/** Vrstni red razvrščanja (iskreno: brez ocen/časa — po imeni ali izpostavljeni). */
type SortKey = "featured" | "name";

export function LokaliExplorer() {
  const l = useLocale();
  const { toast } = useToast();
  const tripItems = useMyTripList();
  const reduceMotion = useReducedMotion();

  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [region, setRegion] = React.useState<string>("all");
  const [sort, setSort] = React.useState<SortKey>("featured");

  const L = {
    kicker: { sl: "Tržnica", en: "Marketplace", it: "Mercato", de: "Marktplatz", fr: "Marché", es: "Mercado" },
    title: { sl: "Lokalni ponudniki", en: "Local providers", it: "Fornitori locali", de: "Lokale Anbieter", fr: "Prestataires locaux", es: "Proveedores locales" },
    lead: {
      sl: "Hoteli, restavracije, znamenitosti in aktivnosti preverjenih lokalnih partnerjev — rezervirajte direktno pri ponudniku, brez provizije.",
      en: "Hotels, restaurants, sights and activities of verified local partners — book directly with the provider, with no commission.",
      it: "Hotel, ristoranti, attrazioni e attività di partner locali verificati — prenota direttamente dal fornitore, senza commissioni.",
      de: "Hotels, Restaurants, Sehenswürdigkeiten und Aktivitäten verifizierter lokaler Partner — buche direkt beim Anbieter, ohne Provision.",
      fr: "Hôtels, restaurants, sites et activités de partenaires locaux vérifiés — réserve directement auprès du prestataire, sans commission.",
      es: "Hoteles, restaurantes, monumentos y actividades de socios locales verificados — reserva directamente con el proveedor, sin comisión.",
    },
    b2b: { sl: "B2B imenik", en: "B2B directory", it: "Elenco B2B", de: "B2B-Verzeichnis", fr: "Annuaire B2B", es: "Directorio B2B" },
    sectionTitle: { sl: "Lokali v Sloveniji", en: "Venues in Slovenia", it: "Locali in Slovenia", de: "Lokale in Slowenien", fr: "Établissements en Slovénie", es: "Lugares en Eslovenia" },
    sectionLead: {
      sl: "Hotelir, restavracije in aktivnosti — neposredno od lastnikov.",
      en: "Hotels, restaurants and activities — directly from the owners.",
      it: "Hotel, ristoranti e attività — direttamente dai proprietari.",
      de: "Hotels, Restaurants und Aktivitäten — direkt von den Inhabern.",
      fr: "Hôtels, restaurants et activités — directement des propriétaires.",
      es: "Hoteles, restaurantes y actividades — directamente de los dueños.",
    },
    searchLabel: { sl: "Išči lokal po imenu ali opisu", en: "Search venues by name or description", it: "Cerca locali per nome o descrizione", de: "Lokale nach Name oder Beschreibung suchen", fr: "Rechercher des établissements par nom ou description", es: "Buscar lugares por nombre o descripción" },
    searchPlaceholder: { sl: "Iskanje: Franko, hotel, Bled …", en: "Search: Franko, hotel, Bled …", it: "Cerca: Franko, hotel, Bled …", de: "Suche: Franko, Hotel, Bled …", fr: "Rechercher : Franko, hôtel, Bled …", es: "Buscar: Franko, hotel, Bled …" },
    allCategories: { sl: "Vse kategorije", en: "All categories", it: "Tutte le categorie", de: "Alle Kategorien", fr: "Toutes les catégories", es: "Todas las categorías" },
    categoryFilter: { sl: "Filtriraj po kategoriji", en: "Filter by category", it: "Filtra per categoria", de: "Nach Kategorie filtern", fr: "Filtrer par catégorie", es: "Filtrar por categoría" },
    allRegions: { sl: "Vse regije", en: "All regions", it: "Tutte le regioni", de: "Alle Regionen", fr: "Toutes les régions", es: "Todas las regiones" },
    regionFilter: { sl: "Filtriraj po regiji", en: "Filter by region", it: "Filtra per regione", de: "Nach Region filtern", fr: "Filtrer par région", es: "Filtrar por región" },
    sortFeatured: { sl: "Izpostavljeni", en: "Featured", it: "In evidenza", de: "Hervorgehoben", fr: "À la une", es: "Destacados" },
    sortName: { sl: "Po imeni (A–Ž)", en: "By name (A–Z)", it: "Per nome (A–Z)", de: "Nach Name (A–Z)", fr: "Par nom (A–Z)", es: "Por nombre (A–Z)" },
    sortLabel: { sl: "Razvrsti", en: "Sort", it: "Ordina", de: "Sortieren", fr: "Trier", es: "Ordenar" },
    reset: { sl: "Počisti filtre", en: "Clear filters", it: "Azzera i filtri", de: "Filter zurücksetzen", fr: "Effacer les filtres", es: "Borrar filtros" },
    count: {
      sl: (n: number) => `${n} od ${LOKALI.length} lokalov`,
      en: (n: number) => `${n} of ${LOKALI.length} venues`,
      it: (n: number) => `${n} di ${LOKALI.length} locali`,
      de: (n: number) => `${n} von ${LOKALI.length} Lokalen`,
      fr: (n: number) => `${n} sur ${LOKALI.length} établissements`,
      es: (n: number) => `${n} de ${LOKALI.length} lugares`,
    },
    emptyTitle: { sl: "Ni zadetkov", en: "No matches", it: "Nessun risultato", de: "Keine Treffer", fr: "Aucun résultat", es: "Sin resultados" },
    emptyLead: {
      sl: "Za iskani niz ali kombinacijo filtrov ni lokalov. Poskusi drugačen niz ali počisti filtre.",
      en: "No venues match your search or filter combination. Try a different query or clear the filters.",
      it: "Nessun locale corrisponde alla tua ricerca o combinazione di filtri. Prova con una ricerca diversa o azzera i filtri.",
      de: "Keine Lokale entsprechen deiner Suche oder Filterkombination. Versuche eine andere Suche oder setze die Filter zurück.",
      fr: "Aucun établissement ne correspond à ta recherche ou à ta combinaison de filtres. Essaie une autre recherche ou efface les filtres.",
      es: "Ningún lugar coincide con tu búsqueda o combinación de filtros. Prueba con otra búsqueda o borra los filtros.",
    },
    add: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V moji poti", en: "In my trip", it: "Nel mio viaggio", de: "In meiner Reise", fr: "Dans mon voyage", es: "En mi viaje" },
    toastAdded: { sl: "Dodano v mojo pot", en: "Added to my trip", it: "Aggiunto al mio viaggio", de: "Zu meiner Reise hinzugefügt", fr: "Ajouté à mon voyage", es: "Añadido a mi viaje" },
    destLink: { sl: "Destinacija", en: "Destination", it: "Destinazione", de: "Reiseziel", fr: "Destination", es: "Destino" },
    ctaTitle: { sl: "Želite biti tukaj?", en: "Want to be here?", it: "Vuoi essere qui?", de: "Willst du hier sein?", fr: "Tu veux figurer ici ?", es: "¿Quieres estar aquí?" },
    ctaLead: {
      sl: "Pridruži se in izpostavite svoj lokal.",
      en: "Join us and showcase your venue.",
      it: "Unisciti a noi e metti in mostra il tuo locale.",
      de: "Mach mit und präsentiere dein Lokal.",
      fr: "Rejoins-nous et mets ton établissement en avant.",
      es: "Únete a nosotros y da a conocer tu lugar.",
    },
    ctaButton: { sl: "Pridruži se", en: "Join us", it: "Unisciti a noi", de: "Mach mit", fr: "Rejoins-nous", es: "Únete" },
    honesty: { sl: "Obseg podatkov", en: "Data coverage", it: "Copertura dei dati", de: "Datenabdeckung", fr: "Couverture des données", es: "Cobertura de datos" },
  } as const;
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const inTrip = React.useCallback(
    (id: string) => tripItems.some((x) => x.refId === id),
    [tripItems]
  );

  const onAdd = (x: Lokal) => {
    if (inTrip(x.id)) return;
    myTrip.add(x.id, x.name, "custom", "lokali");
    toast({ title: t("toastAdded") });
  };

  const categories = React.useMemo(() => activeLokalCategories(), []);
  const regions = React.useMemo(() => activeLokalRegions(), []);

  const results = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = LOKALI.filter((x) => {
      if (category !== "all" && x.category !== category) return false;
      if (region !== "all" && x.region !== region) return false;
      if (
        needle &&
        !x.name.toLowerCase().includes(needle) &&
        !x.town.toLowerCase().includes(needle) &&
        !x.description.sl.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
    // Razvrstitev: izpostavljeni najprej (nato kanonski vrstni red), sicer po imeni.
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "sl");
      const f = Number(b.featured ?? false) - Number(a.featured ?? false);
      return f !== 0 ? f : a.name.localeCompare(b.name, "sl");
    });
  }, [q, category, region, sort]);

  const hasFilters = q.trim() !== "" || category !== "all" || region !== "all" || sort !== "featured";
  const reset = () => {
    setQ("");
    setCategory("all");
    setRegion("all");
    setSort("featured");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* POLIR7 (2.34.0): whitespace-normal — badge.tsx osnova ima whitespace-nowrap,
              a sectionLead je CELOTEN STAVEK (v ES 48 px preliva ekrana 390 px).
              Preklop deluje zanesljivo, ker Badge uporablja cn()/tailwind-merge. */}
          <Badge variant="outline" className="border-primary/40 text-left whitespace-normal text-primary">
            {t("sectionLead")}
          </Badge>
          <Badge variant="outline" className="border-primary/40 text-primary">
            {t("b2b")}
          </Badge>
        </div>
      </PageHeader>

      {/* ── Nadzorna vrstica ─────────────────────────────────────────── */}
      <div className="mt-8 grid gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="h-11 pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 md:w-48" aria-label={t("categoryFilter")}>
            <SelectValue placeholder={t("allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {`${LOKAL_CATEGORIES[c].icon} ${pick(l, LOKAL_CATEGORIES[c])}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="h-11 md:w-44" aria-label={t("regionFilter")}>
            <SelectValue placeholder={t("allRegions")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allRegions")}</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>
                {regionLabel(r, l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-11 md:w-44" aria-label={t("sortLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">{t("sortFeatured")}</SelectItem>
            <SelectItem value="name">{t("sortName")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {t("count")(results.length)}
        </p>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <X className="size-3.5" aria-hidden="true" />
            {t("reset")}
          </Button>
        )}
      </div>

      {/* ── Kartice lokalov ──────────────────────────────────────────── */}
      {results.length === 0 ? (
        /* Prijazno prazno stanje (issue #1 §4): SearchX + besedilo + gumb
           „Počisti filtre" (pariteta z raziskovalco destinacij) — subtilen
           fade (~180 ms, ugasnjen ob reduced-motion). */
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
          <p className="mt-3 text-base font-semibold">{t("emptyTitle")}</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            {t("emptyLead")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            className="mt-5 min-h-11"
          >
            <X className="size-4" aria-hidden="true" />
            {t("reset")}
          </Button>
        </motion.div>
      ) : (
        <ul className="mt-6 grid list-none gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((x) => {
            const cat = LOKAL_CATEGORIES[x.category];
            const weather = WEATHER_FIT_LABELS[x.weather];
            const added = inTrip(x.id);
            return (
              <li key={x.id}>
                <Card
                  className={cn(
                    "group flex h-full flex-col rounded-2xl border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg",
                    x.featured && "border-primary/35"
                  )}
                >
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="gap-1.5">
                        <span aria-hidden="true">{cat.icon}</span>
                        {pick(l, cat)}
                      </Badge>
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        title={pick(l, weather)}
                      >
                        {x.weather === "outdoor" ? (
                          <Sun className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Umbrella className="size-3.5" aria-hidden="true" />
                        )}
                        <span className="hidden sm:inline">
                          {pick(l, weather)}
                        </span>
                        <span className="sr-only">
                          {pick(l, weather)}
                        </span>
                      </span>
                    </div>

                    <div>
                      <h2 className="text-base leading-tight font-bold">{x.name}</h2>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" aria-hidden="true" />
                        {x.town} · {regionLabel(x.region, l)}
                      </p>
                    </div>

                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {pick(l, x.description)}
                    </p>

                    {/* POLIR7 (2.34.0): flex-wrap — ISTI vzorec kot vrstica gumbov
                        na /nacrtuj: osnova Button ima whitespace-nowrap, DE oznaka
                        „Zu meiner Reise hinzufügen" (239 px) + „Reiseziel" (87 px)
                        skupaj presežeta stolpec kartice na mobilnem (min-vsebina
                        334 px > razpoložljivih 316 px); vrstica se lomi, oznaki
                        ostaneta enovrstni. Odkrito pri živi verifikaciji 2.34.0
                        (v 2.33.0 maskirano z 25 px prelivom badge sectionLead). */}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={added ? "secondary" : "default"}
                        className="flex-1"
                        onClick={() => onAdd(x)}
                        aria-disabled={added}
                      >
                        {added ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : (
                          <Heart className="size-4" aria-hidden="true" />
                        )}
                        {added ? t("added") : t("add")}
                      </Button>
                      {x.destinationSlug && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/destinacija/${x.destinationSlug}`}>
                            {t("destLink")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Iskrena opomba o obsegu podatkov ─────────────────────────── */}
      <Card className="mt-10 border-primary/25 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-primary">{t("honesty")}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {pick(l, LOKALI_HONESTY_NOTE)}
          </p>
        </CardContent>
      </Card>

      {/* ── CTA za ponudnike (po produkciji) ─────────────────────────── */}
      <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold">{t("ctaTitle")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("ctaLead")}</p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link href="/za-ponudnike">{t("ctaButton")}</Link>
        </Button>
      </div>
    </div>
  );
}
