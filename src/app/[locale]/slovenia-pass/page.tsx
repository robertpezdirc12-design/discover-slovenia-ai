"use client";

import { ArrowRight, Award, MapPin, Sparkles, Ticket, Trophy } from "lucide-react";
import { useLocale } from "next-intl";

import { AddToTripButton } from "@/components/content/add-to-trip-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { REGIONS, DATA_STATS } from "@/lib/slovenia-data";

/**
 * /slovenia-pass — predstavitev pasa 1:1 po produkciji (hero „zbiraj
 * značke" + „Zbiraj svoje slovenske doživetja"). Koristi so iz besedila
 * produkcije (brezplačno, točke za vsak AI načrt); regije značk so
 * kanonskih 20 regij dataseta. Igrifikacija v pripravi — iskreno označeno.
 */
export default function SloveniaPassPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Slovenia Pass", en: "Slovenia Pass" },
    title: { sl: "Slovenia Pass — zbiraj značke", en: "Slovenia Pass — collect badges" },
    lead: {
      sl: "Obiščite slovenske regije, zbirajte značke in odklenite nagrade — potovanje skozi Slovenijo kot igra.",
      en: "Visit Slovenian regions, collect badges and unlock rewards — travelling through Slovenia as a game.",
    },
    metaFree: { sl: "Brezplačno", en: "Free" },
    metaPoints: { sl: "Točke za vsak AI načrt", en: "Points for every AI plan" },
    collectTitle: {
      sl: "Zbiraj svoje slovenske doživetja",
      en: "Collect your Slovenian experiences",
    },
    collectLead: {
      sl: "Vsak AI načrt prinese točke in značke. Koliko regij lahko obiščeš?",
      en: "Every AI plan brings points and badges. How many regions can you visit?",
    },
    howTitle: { sl: "Kako deluje", en: "How it works" },
    how: {
      sl: [
        { h: "Načrtuj", b: "Sestavi AI načrt potovanja po Sloveniji — vsak načrt prinese točke." },
        { h: "Obišči", b: "Potuj po regijah iz našega kanonskega nabora 38 destinacij in zbiraj značke po regijah." },
        { h: "Odkleni", b: "Z več regijami in točkami odklenjuješ stopnje pasa — potovanje kot igra." },
      ],
      en: [
        { h: "Plan", b: "Build an AI travel plan around Slovenia — every plan brings points." },
        { h: "Visit", b: "Travel through regions from our canonical set of 38 destinations and collect badges by region." },
        { h: "Unlock", b: "More regions and points unlock pass levels — travel as a game." },
      ],
    },
    benefitsTitle: { sl: "Koristi pasa", en: "Pass benefits" },
    benefits: {
      sl: [
        { h: "Brezplačno", b: "Pass je brezplačen — brez naročnine, brez skritih stroškov." },
        { h: "Točke za načrte", b: "Točke zbereš z vsakim AI načrtom — ne z nakupi." },
        { h: "Značke po regijah", b: "Vsaka slovenska regija ima svojo značko — zbiraš jih z obiski." },
        { h: "Nagrade", b: "Z oddaljenimi stopnjami odkleneš nagrade (v pripravi)." },
      ],
      en: [
        { h: "Free", b: "The pass is free — no subscription, no hidden costs." },
        { h: "Points for plans", b: "You earn points with every AI plan — not with purchases." },
        { h: "Badges by region", b: "Each Slovenian region has its own badge — you collect them by visiting." },
        { h: "Rewards", b: "Reaching levels unlocks rewards (in preparation)." },
      ],
    },
    regionsTitle: { sl: "Regije značk", en: "Badge regions" },
    regionsLead: {
      sl: "Značke pokrivajo vseh 20 regij nabora (Slovenija in sosednje jadranske dežele).",
      en: "Badges cover all 20 regions of the dataset (Slovenia and the neighbouring Adriatic countries).",
    },
    statusTitle: { sl: "Stanje v tej rekonstrukciji", en: "Status in this reconstruction" },
    statusBody: {
      sl: "To je zvesta rekonstrukcija predstavitvene strani pasa. Štetje točk in odklepanje značk (izvirna gamifikacija) se povezuje z načrtovalnikom v kasnejši fazi — kar danes vidiš, je resnična predstavitev, brez izmišljenih stanj.",
      en: "This is a faithful reconstruction of the pass presentation page. Point counting and badge unlocking (the original gamification) connect with the planner in a later phase — what you see today is the real presentation, without invented states.",
    },
    ctaPlan: { sl: "Sestavi načrt in zberi točke", en: "Build a plan and earn points" },
    ctaDest: { sl: "Razišči regije", en: "Explore the regions" },
    addTrip: { sl: "Dodaj pot v mojo pot", en: "Add the pass to my trip" },
    added: { sl: "V mojo pot ✓", en: "In my trip ✓" },
  } as const;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero — 1:1 produkcija */}
      <div className="text-center">
        <Badge className="mx-auto">
          <Ticket className="size-3" aria-hidden="true" />
          {pick(l, L.kicker)}
        </Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          {pick(l, L.title)}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {pick(l, L.lead)}
        </p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metaFree)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Trophy className="size-4 text-primary" aria-hidden="true" />
            {pick(l, L.metaPoints)}
          </span>
        </p>
      </div>

      {/* Zbiraj doživetja — 1:1 produkcija */}
      <section
        aria-labelledby="pass-collect"
        className="mt-14 rounded-2xl bg-gradient-to-b from-muted/40 to-background p-6 text-center sm:p-10"
      >
        <h2 id="pass-collect" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {pick(l, L.collectTitle)}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          {pick(l, L.collectLead)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="tap-target font-semibold">
            <Link href="/nacrtuj">
              {pick(l, L.ctaPlan)}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <AddToTripButton
            refId="slovenia-pass"
            name="Slovenia Pass"
            kind="custom"
            source="slovenia-pass"
            labels={{ add: pick(l, L.addTrip), added: pick(l, L.added) }}
            size="default"
            variant="outline"
          />
        </div>
      </section>

      {/* Kako deluje */}
      <section aria-labelledby="pass-how" className="mt-14">
        <h2 id="pass-how" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.howTitle)}
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {pick(l, L.how).map((step, i) => (
            <li key={step.h}>
              <Card className="h-full">
                <CardContent className="p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-bold sm:text-base">{step.h}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.b}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Koristi */}
      <section aria-labelledby="pass-benefits" className="mt-14">
        <h2 id="pass-benefits" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.benefitsTitle)}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pick(l, L.benefits).map((b) => (
            <Card key={b.h}>
              <CardContent className="flex items-start gap-3 p-5">
                <Award className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold sm:text-base">{b.h}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.b}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Regije značk */}
      <section aria-labelledby="pass-regions" className="mt-14">
        <h2 id="pass-regions" className="text-xl font-bold tracking-tight sm:text-2xl">
          {pick(l, L.regionsTitle)}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.regionsLead)}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {Object.entries(REGIONS).map(([key, r]) => (
            <li key={key}>
              <Badge variant="secondary" className="px-2.5 py-1">
                <MapPin className="size-3" aria-hidden="true" />
                {pick(l, r)}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {DATA_STATS.destinations} {pick(l, { sl: "destinacij", en: "destinations" })} ·{" "}
          {DATA_STATS.regions} {pick(l, { sl: "regij", en: "regions" })}
        </p>
      </section>

      {/* Iskreno stanje */}
      <Card className="mt-14 border-primary/25 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            {pick(l, L.statusTitle)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          {pick(l, L.statusBody)}
          <div className="mt-4">
            <Button asChild variant="outline" size="sm" className="font-semibold">
              <Link href="/destinacije">
                {pick(l, L.ctaDest)}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
