"use client";

import { ArrowRight, Compass, MapPin, ShieldCheck, Store } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { EXPERIENCE_TYPES } from "@/lib/content-data";
import { getDestination } from "@/lib/slovenia-data";

/**
 * /dozivetja — 6 tipov doživetij 1:1 iz produkcije (mirror /dozivetja)
 * + povezave na kanonske destinacije posameznega tipa. Tržnica ponudi
 * žive izkušnje lokalnih ponudnikov (faza 45-c) — iskreno označeno.
 */
export function ExperiencesView() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Doživetja", en: "Experiences" },
    title: { sl: "Doživetja v Sloveniji", en: "Experiences in Slovenia" },
    lead: {
      sl: "Pohodništvo, vodne avanture, kultura in kulinarika — raziščite in rezervirajte doživetja neposredno pri preverjenih lokalnih ponudnikih.",
      en: "Hiking, water adventures, culture and gastronomy — explore and book experiences directly with verified local providers.",
    },
    metaNote: {
      sl: "Preverjeni lokalni ponudniki · Rezervacija brez posrednika",
      en: "Verified local providers · Booking without a middleman",
    },
    typesTitle: {
      sl: "Neskončne možnosti doživetij",
      en: "Endless possibilities of experiences",
    },
    typesLead: {
      sl: "Slovenija ponuja vse od alpskih vrhov do jadranske obale — na površini manjši od Walesa.",
      en: "Slovenia offers everything from alpine peaks to the Adriatic coast — on an area smaller than Wales.",
    },
    destsTitle: { sl: "Kje ga doživeti", en: "Where to experience it" },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓" },
    marketTitle: { sl: "Tržnica Slovenije", en: "Slovenian Marketplace" },
    marketLead: {
      sl: "Lokalni izdelki in izkušnje — direktno od kmetov, vinogradnikov in vodnikov",
      en: "Local products and experiences — directly from farmers, winemakers and guides",
    },
    marketBody: {
      sl: "Žive ponudbe izkušenj tržnice (rezervacije pri lokalnih ponudnikih) se povezujejo v fazi rekonstrukcije tržnice — do takrat raziščite destinacije in dogodke.",
      en: "Live marketplace experience offers (bookings with local providers) connect in the marketplace reconstruction phase — until then, explore destinations and events.",
    },
    marketCta: { sl: "Odpri tržnico", en: "Open the marketplace" },
    enNote: {
      sl: "",
      en: "Content note: experience descriptions are canonically Slovenian (production source); an English content overlay is not yet available.",
    },
  } as const;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)}>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metaNote)}
          </span>
        </p>
      </PageHeader>

      {l === "en" && pick(l, L.enNote) && (
        <p className="mt-6 rounded-md border border-dashed border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground">
          {pick(l, L.enNote)}
        </p>
      )}

      <section aria-labelledby="exp-types" className="mt-10">
        <h2 id="exp-types" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.typesTitle)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {pick(l, L.typesLead)}
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EXPERIENCE_TYPES.map((type) => {
            const dests = type.destSlugs
              .map((slug) => getDestination(slug))
              .filter((d): d is NonNullable<typeof d> => Boolean(d));
            return (
              <li key={type.id}>
                <Card className="group h-full gap-0 overflow-hidden py-0 transition-all hover:border-primary/40 hover:shadow-lg">
                  {/* Mozaik slik povezanih destinacij (prve 3) */}
                  <div className="grid h-28 grid-cols-3 gap-0.5 bg-muted">
                    {dests.slice(0, 3).map((d, i) => (
                      <div key={d.slug} className="relative overflow-hidden">
                        <Image
                          src={d.image}
                          alt=""
                          fill
                          loading="lazy"
                          sizes="120px"
                          aria-hidden={i > 0}
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                    <h3 className="flex items-center gap-2 text-base font-bold leading-snug">
                      <Compass className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {pick(l, type.title)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {type.description}
                    </p>
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {pick(l, L.destsTitle)}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {dests.map((d) => (
                          <li key={d.slug}>
                            <Badge variant="secondary" asChild>
                              <Link
                                href={`/destinacija/${d.slug}`}
                                className="hover:bg-primary/10 focus-green"
                              >
                                <MapPin className="size-3" aria-hidden="true" />
                                {d.name}
                              </Link>
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-auto pt-1">
                      <AddToTripButton
                        refId={`dozivetje/${type.id}`}
                        name={pick(l, type.title)}
                        kind="experience"
                        source="dozivetja"
                        labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
                        variant="ghost"
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Tržnica — preusmeritev (produkcija: Nalagam izkušnje … iz tržnice) */}
      <section
        aria-labelledby="exp-market"
        className="mt-14 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 sm:p-10"
      >
        <h2 id="exp-market" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Store className="size-5 text-primary" aria-hidden="true" />
          {pick(l, L.marketTitle)}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {pick(l, L.marketLead)}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {pick(l, L.marketBody)}
        </p>
        <div className="mt-6">
          <Link
            href="/trznica"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-green"
          >
            {pick(l, L.marketCta)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
