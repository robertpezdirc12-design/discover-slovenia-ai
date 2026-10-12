"use client";

/**
 * /zemljevid — interaktivni zemljevid Slovenije in zahodnega Balkana.
 *
 * Leaflet komponenta (src/components/map/travel-map.tsx) se naloži
 * IZKLJUČNO na klientu (next/dynamic ssr:false) — Leaflet potrebuje
 * window, zato bi SSR povzročil hidracijske napake. Glava strani
 * (naslov, statistika po mirror produkcije) se izriše takoj.
 */

import dynamic from "next/dynamic";
import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { pick } from "@/lib/i18n-pick";
import { DESTINATIONS } from "@/lib/slovenia-data";

/** Nalagalni ovoj — skelet s POLNO STRUKTURNO PARITETO (POLIR15-d). */
const TravelMap = dynamic(() => import("@/components/map/travel-map"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      {/* POLIR15-d (2.42.0): skelet zrcali VSE nadzorne vrstice travel-map
          v ISTEM vrstnem redu in z ISTIMI višinami/odmiki — ob prikazu
          prave komponente se ne vstavi NOBEN nov blok (CLS ≈ 0):
          namizje (lg+): iskanje h-11 (lg:mt-8) → čipi h-9 (mt-3) →
            plasti h-11 (mt-3, NAD zemljevidom po DOM) → mreža;
          mobilni (<lg, fleks kolona travel-map): iskanje (order-1) →
            čipi (order-2) → preklop (order-3, sticky kot prava vrstica) →
            mreža (order-4) → plasti (order-5, POD zemljevidom) → legenda
            (order-7). Prej: skelet je imel SAMO zemljevid + seznam —
            ob naložitvi se je nad zemljevidom vstavilo 3 vrstice
            (iskanje/čipi/plasti) + legenda pod njim = ~230 px premika. */}
      {/* 1) Iskanje + regija (travel-map: grid-cols-[1fr_auto], h-11) */}
      <div
        aria-hidden="true"
        className="mt-4 grid grid-cols-[1fr_auto] gap-3 lg:mt-8 md:grid-cols-[1fr_auto_auto]"
      >
        <Skeleton className="h-11 rounded-md" />
        <Skeleton className="h-11 w-36 rounded-md md:w-56" />
      </div>
      {/* 2) Čipi tipov (travel-map: trak h-9 + pb-1, mt-3) */}
      <div aria-hidden="true" className="mt-3 flex gap-2 overflow-hidden pb-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-9 shrink-0 rounded-full ${i % 2 === 0 ? "w-24" : "w-16"}`}
          />
        ))}
      </div>
      {/* 3) Preklop — samo <lg, STICKY pod glavo (zrcali POLIR15-a v
          travel-map: sticky top-16 z-30 bg-background pb-2) */}
      <div
        aria-hidden="true"
        className="mt-3 flex gap-2 bg-background pb-2 max-lg:sticky max-lg:top-16 max-lg:z-30 lg:hidden"
      >
        <Skeleton className="h-11 flex-1 rounded-md" />
        <Skeleton className="h-11 flex-1 rounded-md" />
      </div>
      {/* 4) Plasti — namizje NAD zemljevidom (DOM vrstni red, lg:flex) */}
      <div aria-hidden="true" className="mt-3 hidden gap-2 lg:flex">
        <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-11 w-32 shrink-0 rounded-full" />
        <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
      </div>
      {/* 5) Mreža zemljevida + seznam — višine ZRCALI MapContainer
          (POLIR12 svh pariteta, nespremenjeno). */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-[62svh] min-h-80 rounded-xl sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]" />
        <div className="hidden space-y-2 lg:block">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-13 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* 6) Plasti — mobilni POD zemljevidom (max-lg:order-5) */}
      <div aria-hidden="true" className="mt-3 flex gap-2 lg:hidden">
        <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-11 w-32 shrink-0 rounded-full" />
      </div>
      {/* 7) Legenda (travel-map: mt-4, p-4, ~2 vrstice na mobilnem) */}
      <Skeleton aria-hidden="true" className="mt-4 h-28 rounded-xl" />
    </div>
  ),
});

/** Povprečna ocena nabora (iskreno izračunana iz podatkov, ne natanko 4,5). */
const AVG_RATING =
  Math.round(
    (DESTINATIONS.reduce((sum, d) => sum + d.rating, 0) / DESTINATIONS.length) * 10
  ) / 10;

export default function MapPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Odkrij", en: "Discover", it: "Scopri", de: "Entdecken", fr: "Découvrir", es: "Descubre" },
    title: { sl: "Zemljevid", en: "Map", it: "Mappa", de: "Karte", fr: "Carte", es: "Mapa" },
    lead: {
      sl: "Interaktivni zemljevid Slovenije in zahodnega Balkana — 38 destinacij od Alp do Albanije s podrobnostmi o vsaki lokaciji, dodajanjem v mojo pot in povezavo do vodnikov.",
      en: "The interactive map of Slovenia and the Western Balkans — 38 destinations from the Alps to Albania with details for every location, adding to your trip and links to guides.",
      it: "La mappa interattiva della Slovenia e dei Balcani occidentali — 38 destinazioni dalle Alpi all'Albania con dettagli per ogni località, aggiunta al tuo viaggio e collegamenti alle guide.",
      de: "Die interaktive Karte Sloweniens und des westlichen Balkans — 38 Destinationen von den Alpen bis Albanien mit Details zu jedem Ort, Hinzufügen zu deiner Reise und Links zu Guides.",
      fr: "La carte interactive de la Slovénie et des Balkans de l'Ouest — 38 destinations des Alpes à l'Albanie avec des détails pour chaque lieu, l'ajout à ton voyage et des liens vers les guides.",
      es: "El mapa interactivo de Eslovenia y los Balcanes occidentales — 38 destinos de los Alpes a Albania con detalles de cada lugar, añadir a tu viaje y enlaces a las guías.",
    },
    statDest: { sl: "destinacij", en: "destinations", it: "destinazioni", de: "Destinationen", fr: "destinations", es: "destinos" },
    statRegions: { sl: "regij", en: "regions", it: "regioni", de: "Regionen", fr: "régions", es: "regiones" },
    statRating: { sl: "povprečna ocena", en: "average rating", it: "valutazione media", de: "Durchschnittsbewertung", fr: "note moyenne", es: "valoración media" },
  } as const;

  const stats = [
    { value: String(DESTINATIONS.length), label: pick(l, L.statDest) },
    { value: "20", label: pick(l, L.statRegions) },
    { value: AVG_RATING.toFixed(1), label: pick(l, L.statRating) },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      {/* POLIR14 (2.41.0): MOBILNA GLAVA ZEMLJEVIDA — zemljevid najprej.
          Raziskava §3.3 (izmerjeno na produkciji): glava + kontrolna plast
          sta prej zasedla ~87 % prvega zaslona @390×844 (zemljevid šele na
          y=735, seznam 472 px pod pragom). Zdaj: ožji odmik (pt-6), kicker
          skrit na mobilnem, opis 2 vrstici, 3-stolpčna statistika ≥sm —
          namizje (sm+) IDENTIČNO današnjemu. */}
      <PageHeader
        kicker={pick(l, L.kicker)}
        title={pick(l, L.title)}
        lead={pick(l, L.lead)}
        kickerClassName="hidden sm:block"
        leadClassName="line-clamp-2 sm:line-clamp-none"
      />

      {/* Statistika nabora (oblika po mirror produkcije)
          POLIR14 (2.41.0): 3-stolpčne kartice samo ≥sm — na mobilnem jih
          nadomesti kompaktna vrstica pod zemljevidom (glej pod <TravelMap/>);
          vsebina ostaja v DOM (hidden, ne pogojni izris — 0 hidracijskih
          razlik). Zaklep grid-cols-3 ostaja (test ⑬ mobile-overflow). */}
      <dl className="mt-6 hidden grid-cols-3 gap-3 sm:grid">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card px-4 py-3 text-center sm:text-left"
          >
            <dt className="sr-only">{s.label}</dt>
            <dd>
              <span className="text-2xl font-bold text-primary">{s.value}</span>{" "}
              {/* POLIR7 (2.34.0): break-words — dolge nemške sestavljenke
                  (npr. „Durchschnittsbewertung", 172 px, ena nedeljiva beseda)
                  se prelomijo namesto da raznesejo 3-stolpčno statistiko
                  (stolpec ~111 px na mobilnem). */}
              <span className="text-sm break-words text-muted-foreground">{s.label}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Polen Leaflet zemljevid (klientno nalaganje brez SSR) */}
      <TravelMap />
      {/* POLIR14 (2.41.0): kompaktna statistična vrstica POD zemljevidom —
          mobilni nadomestek 3-stolpčnih kartic (te so ≥sm): ena vrstica,
          ločilo „·“, besedila se lahko prelomijo (duh break-words). */}
      <p className="mt-6 text-center text-xs text-muted-foreground sm:hidden">
        {DESTINATIONS.length} {pick(l, L.statDest)} · 20 {pick(l, L.statRegions)} · {AVG_RATING.toFixed(1)} {pick(l, L.statRating)}
      </p>
    </div>
  );
}
