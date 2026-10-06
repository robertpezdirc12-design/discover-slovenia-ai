"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  MessageCircleQuestion,
  Route,
} from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import * as React from "react";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  BLOG_ARTICLES,
  BLOG_CATEGORIES,
  type BlogCategory,
  GUIDES,
  GUIDE_GROUPS,
  type GuideGroup,
} from "@/lib/content-data";
import { getDestination } from "@/lib/slovenia-data";

/**
 * /vodici — seznam 22 road-trip vodnikov v treh skupinah produkcije
 * (❄️ Zimski · 🇸🇮 Domači krog · Cross-border) + blog „Zgodbe iz
 * Slovenije" s filtri kategorij. Vsebina 1:1 iz mirrorja /vodici.
 */
export function GuidesView() {
  const l = useLocale();
  const [blogCat, setBlogCat] = React.useState<BlogCategory>("vsi");

  const L = {
    kicker: { sl: "Vodiči", en: "Guides" },
    title: { sl: "Vodiči in nasveti za Slovenijo", en: "Guides and tips for Slovenia" },
    lead: {
      sl: "Kaj početi na Bledu, kako preživeti 3 dni po Sloveniji, najlepši izleti in kje jesti lokalno — vodiči, nasveti in odgovori lokalcev.",
      en: "What to do at Bled, how to spend 3 days in Slovenia, the finest trips and where to eat locally — guides, tips and answers from locals.",
    },
    metaNote: { sl: "Zgodbe in nasveti urednikov", en: "Editorial stories and tips" },
    read: { sl: "Preberi", en: "Read" },
    readMore: { sl: "Preberi več", en: "Read more" },
    days: { sl: (n: number) => `${n} dni`, en: (n: number) => `${n} days` },
    km: { sl: (n: number) => `${n} km`, en: (n: number) => `${n} km` },
    addTrip: { sl: "Dodaj v mojo pot", en: "Add to my trip" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓" },
    blogTitle: { sl: "Zgodbe iz Slovenije", en: "Stories from Slovenia" },
    blogLead: {
      sl: "Vodičniki, nasveti in inspiracije za tvoje naslednje potovanje",
      en: "Guides, tips and inspiration for your next trip",
    },
    all: { sl: "Vsi", en: "All" },
    askTitle: { sl: "Vprašaj lokalca", en: "Ask a local" },
    askBody: {
      sl: "Odgovori temeljijo na naši bazi realnih destinacij, lokalov in izkušenj — brez izmišljotin. Hitro vprašanje in globja osebna konzultacija sta brezplačna.",
      en: "Answers draw on our database of real destinations, venues and experiences — no make-believe. A quick question and a deeper personal consultation are free.",
    },
    askCta: { sl: "Postavi vprašanje prek kontakta", en: "Ask via the contact page" },
    enNote: {
      sl: "",
      en: "Content note: guides are canonically Slovenian (production source); an English content overlay is not yet available.",
    },
    destLabel: { sl: "Destinacije na poti", en: "Destinations on the route" },
  } as const;

  const blogTabs: { id: BlogCategory; label: string }[] = [
    { id: "vsi", label: pick(l, L.all) },
    ...Object.entries(BLOG_CATEGORIES).map(([id, c]) => ({
      id: id as BlogCategory,
      label: pick(l, c),
    })),
  ];

  const filtered =
    blogCat === "vsi" ? BLOG_ARTICLES : BLOG_ARTICLES.filter((a) => a.category === blogCat);

  const GROUP_ORDER: GuideGroup[] = ["zimski", "domaci", "jadranski"];

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

      {/* Skupine road-trip vodnikov */}
      {GROUP_ORDER.map((groupId) => {
        const group = GUIDE_GROUPS[groupId];
        const guides = GUIDES.filter((g) => g.group === groupId);
        return (
          <section key={groupId} aria-labelledby={`guides-${groupId}`} className="mt-14">
            <div className="max-w-3xl">
              <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
                {group.kicker}
              </p>
              <h2
                id={`guides-${groupId}`}
                className="mt-1.5 text-2xl font-bold tracking-tight text-balance sm:text-3xl"
              >
                {group.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {group.lead}
              </p>
            </div>
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Card className="group h-full gap-0 overflow-hidden py-0 transition-all hover:border-primary/40 hover:shadow-lg">
                    <CardContent className="flex min-h-56 flex-col p-4">
                      <p aria-label={g.flags.replace(/[^\p{L}\p{S}\s]/gu, "").trim() || undefined} className="text-lg">
                        {g.flags}
                      </p>
                      <h3 className="mt-1.5 text-sm font-bold leading-snug group-hover:text-primary sm:text-base">
                        <Link href={`/vodici/${g.slug}`} className="focus-green">
                          {g.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-4 flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {g.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
                          {pick(l, L.days)(g.days)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Route className="size-3.5 text-primary" aria-hidden="true" />
                          {pick(l, L.km)(g.km)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                          href={`/vodici/${g.slug}`}
                          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                        >
                          {pick(l, L.read)}
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                        <AddToTripButton
                          refId={`vodici/${g.slug}`}
                          name={g.title}
                          kind="custom"
                          source="vodici"
                          labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
                          variant="ghost"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* Blog & vodičniki */}
      <section aria-labelledby="blog-title" className="mt-16">
        <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">
          Blog &amp; vodičniki
        </p>
        <h2 id="blog-title" className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
          {pick(l, L.blogTitle)}
        </h2>
        <p className="mt-2.5 text-sm text-muted-foreground sm:text-base">
          {pick(l, L.blogLead)}
        </p>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={pick(l, L.blogLead)}>
          {blogTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBlogCat(tab.id)}
              aria-pressed={blogCat === tab.id}
              className={`inline-flex min-h-9 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-green ${
                blogCat === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((a) => {
            const dest = a.destSlug ? getDestination(a.destSlug) : undefined;
            return (
              <li key={a.id}>
                <Card className="group h-full gap-0 overflow-hidden py-0 transition-all hover:shadow-lg">
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    <Image
                      src={a.image}
                      alt={a.title}
                      fill
                      loading="lazy"
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <Badge className="absolute top-2 left-2">{pick(l, BLOG_CATEGORIES[a.category])}</Badge>
                  </div>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{a.dateLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3" aria-hidden="true" />
                        {a.readMinutes} min
                      </span>
                    </p>
                    <h3 className="text-sm font-bold leading-snug group-hover:text-primary">
                      {a.title}
                    </h3>
                    <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {a.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {dest ? (
                        <Link
                          href={`/destinacija/${dest.slug}`}
                          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                        >
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {dest.name}
                        </Link>
                      ) : (
                        <span className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {pick(l, L.destLabel)}
                        </span>
                      )}
                      <AddToTripButton
                        refId={`clanek/${a.id}`}
                        name={a.title}
                        kind="custom"
                        source="vodici"
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

      {/* Vprašaj lokalca */}
      <section
        aria-labelledby="ask-local"
        className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-primary/5 p-6 sm:p-10"
      >
        <h2 id="ask-local" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <MessageCircleQuestion className="size-5 text-primary" aria-hidden="true" />
          {pick(l, L.askTitle)}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {pick(l, L.askBody)}
        </p>
        <div className="mt-6">
          <Link
            href="/kontakt"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-green"
          >
            {pick(l, L.askCta)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
