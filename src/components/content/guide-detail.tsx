"use client";

import { ArrowRight, ArrowLeft, CalendarDays, Route } from "lucide-react";
import { useLocale } from "next-intl";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { type Guide, GUIDES, GUIDE_GROUPS } from "@/lib/content-data";
import { getDestination } from "@/lib/slovenia-data";

/** Vodniki iz iste skupine (razdelek „Preberi tudi"). */
function guideSiblings(guide: Guide): Guide[] {
  return GUIDES.filter((g) => g.group === guide.group && g.slug !== guide.slug);
}

/**
 * PODROBNOST VODNIKA — naslov, skupina, dnevi/km, rss opis, povezane
 * destinacije, akciji (Dodaj v mojo pot, Načrtuj) + povratek na /vodici.
 * Vsebina 1:1 iz produkcije (seznam /vodici + rss.xml item).
 */
export function GuideDetail({ guide }: { guide: Guide }) {
  const l = useLocale();
  const group = GUIDE_GROUPS[guide.group];

  const L = {
    back: { sl: "Vsi vodiči", en: "All guides", it: "Tutte le guide", de: "Alle Guides", fr: "Tous les guides", es: "Todas las guías" },
    groupLabel: { sl: "Skupina", en: "Group", it: "Gruppo", de: "Gruppe", fr: "Groupe", es: "Grupo" },
    days: { sl: (n: number) => `${n} dni`, en: (n: number) => `${n} days`, it: (n: number) => `${n} giorni`, de: (n: number) => `${n} Tage`, fr: (n: number) => `${n} jours`, es: (n: number) => `${n} días` },
    km: { sl: (n: number) => `${n} km`, en: (n: number) => `${n} km`, it: (n: number) => `${n} km`, de: (n: number) => `${n} km`, fr: (n: number) => `${n} km`, es: (n: number) => `${n} km` },
    published: { sl: "Objavljeno", en: "Published", it: "Pubblicato", de: "Veröffentlicht", fr: "Publié", es: "Publicado" },
    intro: { sl: "Povzetek poti", en: "Route summary", it: "Riepilogo del percorso", de: "Routenzusammenfassung", fr: "Résumé de l’itinéraire", es: "Resumen de la ruta" },
    destsTitle: { sl: "Destinacije na tej poti", en: "Destinations on this route", it: "Destinazioni su questo percorso", de: "Destinationen auf dieser Route", fr: "Destinations sur cet itinéraire", es: "Destinos en esta ruta" },
    destsLead: {
      sl: "Povezane destinacije iz našega kanonskega nabora — odpri jih za podrobnosti, cene in »kaj početi«.",
      en: "Related destinations from our canonical dataset — open them for details, prices and things to do.",
      it: "Destinazioni correlate dal nostro dataset canonico — aprile per dettagli, prezzi e cose da fare.",
      de: "Verwandte Destinationen aus unserem kanonischen Datensatz — öffne sie für Details, Preise und Aktivitäten.",
      fr: "Destinations associées de notre ensemble de données canonique — ouvre-les pour les détails, les prix et les choses à faire.",
      es: "Destinos relacionados de nuestro conjunto de datos canónico — ábrelos para ver detalles, precios y qué hacer.",
    },
    noDests: {
      sl: "Ta vodnik je splošen priročnik (meje, cestnine, najem avta) in se ne navezuje na posamezno destinacijo iz nabora.",
      en: "This guide is a general handbook (borders, tolls, car rental) and does not tie to an individual destination in the dataset.",
      it: "Questa guida è un manuale generale (confini, pedaggi, noleggio auto) e non è legata a una singola destinazione del dataset.",
      de: "Dieser Guide ist ein allgemeines Handbuch (Grenzen, Maut, Mietwagen) und ist nicht mit einer einzelnen Destination des Datensatzes verknüpft.",
      fr: "Ce guide est un manuel général (frontières, péages, location de voiture) et n’est pas lié à une destination individuelle de l’ensemble de données.",
      es: "Esta guía es un manual general (fronteras, peajes, alquiler de coche) y no está ligada a un destino individual del conjunto de datos.",
    },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓", it: "Nel mio viaggio ✓", de: "In meiner Reise ✓", fr: "Dans mon voyage ✓", es: "En mi viaje ✓" },
    plan: { sl: "Načrtuj s temi destinacijami", en: "Plan with these destinations", it: "Pianifica con queste destinazioni", de: "Mit diesen Destinationen planen", fr: "Planifier avec ces destinations", es: "Planifica con estos destinos" },
    related: { sl: "Preberi tudi", en: "Read next", it: "Leggi anche", de: "Lies auch", fr: "À lire aussi", es: "Lee también" },
  } as const;

  const dests = guide.destSlugs
    .map((slug) => getDestination(slug))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const related = guideSiblings(guide).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/vodici"
        className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {pick(l, L.back)}
      </Link>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg" aria-label={guide.flags}>
            {guide.flags}
          </span>
          <Badge variant="secondary">{group.kicker}</Badge>
          <Badge variant="outline">{guide.rssCategory}</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {guide.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.days)(guide.days)}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
            <Route className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.km)(guide.km)}
          </span>
          <span>
            {pick(l, L.published)}: {guide.pubDate}
          </span>
        </div>
      </header>

      <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none">
        <p className="text-base leading-relaxed sm:text-lg">{guide.rssDescription}</p>
        <p className="mt-4 text-base leading-relaxed">{guide.description}</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <AddToTripButton
          refId={`vodici/${guide.slug}`}
          name={guide.title}
          kind="custom"
          source="vodici"
          labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
          size="default"
          variant="default"
        />
        {dests.length > 0 && (
          <Button asChild variant="outline" className="font-semibold">
            <Link href={`/nacrtuj?dest=${dests[0]!.slug}`}>{pick(l, L.plan)}</Link>
          </Button>
        )}
      </div>

      {/* Povezane destinacije */}
      <section aria-labelledby="guide-dests" className="mt-12">
        <h2 id="guide-dests" className="text-xl font-bold tracking-tight">
          {pick(l, L.destsTitle)}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.destsLead)}</p>
        {dests.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {pick(l, L.noDests)}
          </p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {dests.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/destinacija/${d.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md focus-green"
                >
                  <span>
                    <span className="block text-sm font-bold group-hover:text-primary">
                      {d.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {d.tagline}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Preberi tudi */}
      {related.length > 0 && (
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {pick(l, L.related)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/vodici/${g.slug}`}
                    className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
