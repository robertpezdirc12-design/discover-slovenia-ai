"use client";

/**
 * LOKALI RAZISKOVALEC — B2B imenik lokalnih ponudnikov (rekonstrukcija /lokali).
 *
 * Struktura po produkciji (mirror + JS modul): kategorije, vremenske
 * oznake, razvrščanje izpostavljeni/prvi, iskanje in filtri, gumb
 * "Dodaj v mojo pot" ter CTA "Pridruži se". Podatki: src/lib/lokali-data.ts
 * (uredniška kuracija — iskrena opomba o obsegu je na strani obvezna).
 */

import { Check, Heart, MapPin, Search, Store, Sun, Umbrella, X } from "lucide-react";
import { useLocale } from "next-intl";
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

  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string>("all");
  const [region, setRegion] = React.useState<string>("all");
  const [sort, setSort] = React.useState<SortKey>("featured");

  const L = {
    kicker: { sl: "Tržnica", en: "Marketplace" },
    title: { sl: "Lokalni ponudniki", en: "Local providers" },
    lead: {
      sl: "Hoteli, restavracije, znamenitosti in aktivnosti preverjenih lokalnih partnerjev — rezervirajte direktno pri ponudniku, brez provizije.",
      en: "Hotels, restaurants, sights and activities of verified local partners — book directly with the provider, with no commission.",
    },
    b2b: { sl: "B2B imenik", en: "B2B directory" },
    sectionTitle: { sl: "Lokali v Sloveniji", en: "Venues in Slovenia" },
    sectionLead: {
      sl: "Hotelir, restavracije in aktivnosti — neposredno od lastnikov.",
      en: "Hotels, restaurants and activities — directly from the owners.",
    },
    searchLabel: { sl: "Išči lokal po imenu ali opisu", en: "Search venues by name or description" },
    searchPlaceholder: { sl: "Iskanje: Franko, hotel, Bled …", en: "Search: Franko, hotel, Bled …" },
    allCategories: { sl: "Vse kategorije", en: "All categories" },
    categoryFilter: { sl: "Filtriraj po kategoriji", en: "Filter by category" },
    allRegions: { sl: "Vse regije", en: "All regions" },
    regionFilter: { sl: "Filtriraj po regiji", en: "Filter by region" },
    sortFeatured: { sl: "Izpostavljeni", en: "Featured" },
    sortName: { sl: "Po imeni (A–Ž)", en: "By name (A–Z)" },
    sortLabel: { sl: "Razvrsti", en: "Sort" },
    reset: { sl: "Počisti filtre", en: "Clear filters" },
    count: {
      sl: (n: number) => `${n} od ${LOKALI.length} lokalov`,
      en: (n: number) => `${n} of ${LOKALI.length} venues`,
    },
    emptyTitle: { sl: "Ni zadetkov", en: "No matches" },
    emptyLead: {
      sl: "Za iskani niz ali kombinacijo filtrov ni lokalov. Poskusi drugačen niz ali počisti filtre.",
      en: "No venues match your search or filter combination. Try a different query or clear the filters.",
    },
    add: { sl: "Dodaj v mojo pot", en: "Add to my trip" },
    added: { sl: "V moji poti", en: "In my trip" },
    toastAdded: { sl: "Dodano v mojo pot", en: "Added to my trip" },
    destLink: { sl: "Destinacija", en: "Destination" },
    ctaTitle: { sl: "Želite biti tukaj?", en: "Want to be here?" },
    ctaLead: {
      sl: "Pridruži se in izpostavite svoj lokal.",
      en: "Join us and showcase your venue.",
    },
    ctaButton: { sl: "Pridruži se", en: "Join us" },
    honesty: { sl: "Obseg podatkov", en: "Data coverage" },
  } as const;
  const t = (k: keyof typeof L) => pick(l, L[k]);

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
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            {t("sectionLead")}
          </Badge>
          <Badge variant="outline" className="border-primary/40 text-primary">
            {t("b2b")}
          </Badge>
        </div>
      </PageHeader>

      {/* ── Nadzorna vrstica ─────────────────────────────────────────── */}
      <div className="mt-8 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
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
                {`${LOKAL_CATEGORIES[c].icon} ${l === "en" ? LOKAL_CATEGORIES[c].en : LOKAL_CATEGORIES[c].sl}`}
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
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center">
          <Store className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyLead")}</p>
        </div>
      ) : (
        <ul className="mt-6 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((x) => {
            const cat = LOKAL_CATEGORIES[x.category];
            const weather = WEATHER_FIT_LABELS[x.weather];
            const added = inTrip(x.id);
            return (
              <li key={x.id}>
                <Card
                  className={cn(
                    "flex h-full flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg",
                    x.featured && "border-primary/35"
                  )}
                >
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="gap-1.5">
                        <span aria-hidden="true">{cat.icon}</span>
                        {l === "en" ? cat.en : cat.sl}
                      </Badge>
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        title={l === "en" ? weather.en : weather.sl}
                      >
                        {x.weather === "outdoor" ? (
                          <Sun className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Umbrella className="size-3.5" aria-hidden="true" />
                        )}
                        <span className="hidden sm:inline">
                          {l === "en" ? weather.en : weather.sl}
                        </span>
                        <span className="sr-only">
                          {l === "en" ? weather.en : weather.sl}
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
                      {l === "en" ? x.description.en : x.description.sl}
                    </p>

                    <div className="mt-auto flex items-center gap-2 pt-1">
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
            {l === "en" ? LOKALI_HONESTY_NOTE.en : LOKALI_HONESTY_NOTE.sl}
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
