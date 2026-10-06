"use client";

import {
  ArrowRight,
  Check,
  ExternalLink,
  MapPin,
  Plus,
  Star,
  Wallet,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { myTrip } from "@/lib/my-trip";
import {
  type Destination,
  type Season,
  regionLabel,
  typeLabel,
} from "@/lib/slovenia-data";

const SEASONS: Record<Season, { sl: string; en: string }> = {
  spring: { sl: "Pomlad", en: "Spring" },
  summer: { sl: "Poletje", en: "Summer" },
  autumn: { sl: "Jesen", en: "Autumn" },
  winter: { sl: "Zima", en: "Winter" },
};

/**
 * PODROBNOST DESTINACIJE — hero slika, opis, žetoni (poudarki/aktivnosti/
 * najboljše za/sezona), praktični podatki, koordinate, IZVOR zapisa
 * (iskrenostni kanon) + akciji "Dodaj v mojo pot" in "Načrtuj / Pojdi".
 */
export function DestinationDetail({ d }: { d: Destination }) {
  const l = useLocale();
  const [inTrip, setInTrip] = React.useState(false);

  React.useEffect(() => {
    setInTrip(myTrip.has(d.slug));
    // Osveži, če drug zavihek spremeni zbirko.
    const refresh = () => setInTrip(myTrip.has(d.slug));
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [d.slug]);

  const L = {
    back: { sl: "Vse destinacije", en: "All destinations" },
    metaRegion: { sl: "Regija", en: "Region" },
    metaType: { sl: "Tip", en: "Type" },
    metaRating: { sl: "Ocena", en: "Rating" },
    metaRatingAria: {
      sl: (n: number) => `Uredniška ocena ${n.toFixed(1)} od 5`,
      en: (n: number) => `Editorial rating ${n.toFixed(1)} of 5`,
    },
    ratingNote: {
      sl: "Uredniška ocena, nikoli uporabniška recenzija.",
      en: "Editorial rating, never a user review.",
    },
    metaBudget: { sl: "Proračun", en: "Budget" },
    metaDuration: { sl: "Priporočen čas", en: "Recommended time" },
    metaCost: { sl: "Strošek na osebo", en: "Cost per person" },
    metaCostV: {
      sl: (n: number) => `≈ ${n} € (ocena)`,
      en: (n: number) => `≈ €${n} (estimate)`,
    },
    coords: { sl: "Koordinate (WGS-84)", en: "Coordinates (WGS-84)" },
    highlights: { sl: "Poudarki", en: "Highlights" },
    activities: { sl: "Aktivnosti", en: "Activities" },
    bestFor: { sl: "Najboljše za", en: "Best for" },
    bestSeason: { sl: "Najboljši čas obiska", en: "Best season" },
    provenance: { sl: "Izvor zapisa", en: "Record provenance" },
    provOfficial: { sl: "Uradni vir", en: "Official source" },
    provEditorial: { sl: "Uredniška kuracija", en: "Editorial curation" },
    provVerified: {
      sl: (at: string) => `Preverjeno: ${at}`,
      en: (at: string) => `Verified: ${at}`,
    },
    provSourceLink: { sl: "Odpri vir", en: "Open source" },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓" },
    planWith: { sl: "Načrtuj s to destinacijo", en: "Plan with this destination" },
    goWith: { sl: "Pojdi — partnerji", en: "Go — partners" },
    myTrip: { sl: "Moja pot", en: "My trip" },
    enNote: {
      sl: "",
      en: "Content note: the destination dataset is canonically Slovenian; an English content overlay is not yet available.",
    },
  } as const;

  const meta = [
    { label: pick(l, L.metaRegion), value: regionLabel(d.region, l) },
    { label: pick(l, L.metaType), value: typeLabel(d.type, l) },
    { label: pick(l, L.metaDuration), value: d.duration },
    { label: pick(l, L.metaBudget), value: d.budget },
    { label: pick(l, L.metaCost), value: pick(l, L.metaCostV)(d.costPerPerson) },
  ];

  const chipGroups = [
    { heading: pick(l, L.highlights), items: d.highlights },
    { heading: pick(l, L.activities), items: d.activities },
    { heading: pick(l, L.bestFor), items: d.bestFor },
    {
      heading: pick(l, L.bestSeason),
      items: d.bestSeason.map((s) => pick(l, SEASONS[s])),
    },
  ];

  const onAdd = () => {
    const res = myTrip.add(d.slug, d.name, "destination", "destinacija");
    if (res.ok || res.already) {
      setInTrip(true);
    }
  };

  return (
    <article className="w-full">
      {/* Hero slika */}
      <div className="relative aspect-[21/9] max-h-[46vh] w-full overflow-hidden bg-muted">
        <Image
          src={d.image}
          alt={`${d.name} — ${d.tagline}`}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto w-full max-w-5xl px-4 pb-5 sm:px-6 lg:px-8">
            <Link
              href="/destinacije"
              className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white"
            >
              <ArrowRight className="size-4 rotate-180" aria-hidden="true" />
              {pick(l, L.back)}
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-4xl">
              {d.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/90 sm:text-base">
              {d.tagline}
            </p>
          </div>
        </div>
        {d.featured && (
          <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground shadow">
            {pick(l, { sl: "Izpostavljeno", en: "Featured" })}
          </Badge>
        )}
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {l === "en" && pick(l, L.enNote) && (
          <p className="mb-6 rounded-md border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground">
            {pick(l, L.enNote)}
          </p>
        )}

        {/* Akcija: Dodaj v mojo pot */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={onAdd}
            size="lg"
            variant={inTrip ? "outline" : "default"}
            className="tap-target font-semibold"
          >
            {inTrip ? (
              <>
                <Check className="size-5" aria-hidden="true" />
                {pick(l, L.added)}
              </>
            ) : (
              <>
                <Plus className="size-5" aria-hidden="true" />
                {pick(l, L.addTrip)}
              </>
            )}
          </Button>
          <Button asChild size="lg" variant="outline" className="tap-target font-semibold">
            <Link href={`/nacrtuj?dest=${d.slug}`}>{pick(l, L.planWith)}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="tap-target font-semibold">
            <Link href={`/go?dest=${d.slug}`}>{pick(l, L.goWith)}</Link>
          </Button>
        </div>

        {/* Praktični podatki */}
        <Card className="mt-8">
          <CardContent className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2.5">
              <Star className="size-5 shrink-0 fill-primary text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {pick(l, L.metaRating)}
                </p>
                <p className="text-sm font-bold">
                  {d.rating.toFixed(1)} / 5
                  <span className="sr-only">{pick(l, L.metaRatingAria)(d.rating)}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{pick(l, L.ratingNote)}</p>
              </div>
            </div>
            {meta.map((m) => (
              <div key={m.label} className="flex items-center gap-2.5">
                <Wallet className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                  <p className="text-sm font-bold">{m.value}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2.5">
              <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">{pick(l, L.coords)}</p>
                <p className="font-mono text-sm font-bold">
                  {d.coords.lat.toFixed(4)}, {d.coords.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opis */}
        <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
          <p className="text-base leading-relaxed sm:text-lg">{d.description}</p>
        </div>

        {/* Žetoni: poudarki / aktivnosti / najboljše za / sezona */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {chipGroups.map((g) => (
            <Card key={g.heading}>
              <CardHeader>
                <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.heading}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {g.items.map((item) => (
                  <Badge
                    key={item}
                    variant="secondary"
                    className="px-2.5 py-1 text-xs font-medium"
                  >
                    {item}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator className="my-8" />

        {/* Izvor zapisa (iskrenostni kanon) */}
        <Card className="border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-primary">
              {pick(l, L.provenance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p className="font-medium">
              {d.provenance.kind === "official"
                ? pick(l, L.provOfficial)
                : pick(l, L.provEditorial)}
              {" — "}
              {d.provenance.source}
            </p>
            <p className="text-muted-foreground">
              {pick(l, L.provVerified)(d.provenance.verifiedAt)}
            </p>
            {d.provenance.sourceUrl && (
              <a
                href={d.provenance.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {pick(l, L.provSourceLink)}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
