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

/** Nalagalni ovoj — skelet STRUKTUORNO IDENTIČEN TravelMap (POLIR15-d).
 *
 * POLIR15-d (2.42.0): skelet je prej rezerviral SAMO zemljevid + seznam —
 * nadzorne vrstice (iskanje+regija, čipi, preklop, plasti) in legenda so se
 * VSTAVILI ob razrešitvi dinamičnega uvoza (vse pod njimi se premakne:
 * izmerjeno CLS ≈ 0,023 na /zemljevid). Zdaj skelet ZRCALI celotno drevo
 * TravelMap po vrstnem redu DOM in mobilnih order razredih (order-1…7):
 * iskanje → čipi → preklop (<lg) → plasti → mapa+seznam → legenda, z ISTIMI
 * odmiki (mt-4/mt-3) in ISTIMI višinami (h-11/h-9/h-13/svh) — ob naložitvi
 * Leafleta NI vstavljanja, NI premika (web.dev „Reserve space for
 * late-loading content“). Višina zemljevida je dobesedno ISTI niz razredov
 * kot MapContainer v travel-map.tsx (svh enote, POLIR12). */
const TravelMap = dynamic(() => import("@/components/map/travel-map"), {
  ssr: false,
  loading: () => (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 max-lg:flex max-lg:flex-col"
    >
      {/* order-1: iskanje + regija (+ prostor ponovitve/md+ števec). */}
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[1fr_auto_auto] lg:mt-8 max-lg:order-1">
        <Skeleton className="h-11 w-full rounded-md" />
        <Skeleton className="h-11 w-36 rounded-md md:w-56" />
        <Skeleton className="hidden h-11 w-28 rounded-md md:block" />
      </div>
      {/* order-2: čipi tipov (drsenje — višina 36 + pb-1 je neodvisna od št. čipov). */}
      <div className="relative mt-3 max-lg:order-2" aria-hidden="true">
        <div className="flex gap-2 overflow-hidden pb-1">
          <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-32 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-36 shrink-0 rounded-full" />
        </div>
      </div>
      {/* order-3: preklop „Zemljevid ⇄ Seznam“ (samo <lg, sticky vrstica). */}
      <div className="mt-3 flex gap-2 max-lg:order-3 lg:hidden" aria-hidden="true">
        <Skeleton className="h-11 flex-1 rounded-md" />
        <Skeleton className="h-11 flex-1 rounded-md" />
      </div>
      {/* order-5: plasti (Lokali/Bencinske/POI) — na mobilnem POD zemljevidom. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 max-lg:order-5" aria-hidden="true">
        <Skeleton className="h-11 w-32 shrink-0 rounded-full" />
        <Skeleton className="h-11 w-36 shrink-0 rounded-full" />
        <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
      </div>
      {/* order-4: mapa + seznam — višina mape = DOBESEDNO isti razredni niz
          kot MapContainer (travel-map.tsx) → 0 px premika ob naložitvi. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px] max-lg:order-4">
        <Skeleton className="h-[62svh] min-h-80 rounded-xl sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]" />
        <div className="hidden space-y-2 lg:block">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-13 w-full rounded-lg" />
          ))}
        </div>
      </div>
      {/* legenda (order-7) — rezervacija prostora (leži pod prelomom prvega
          zaslona na vseh velikostih, vseeno jo zrcalimo za 0 premika noge). */}
      <div className="mt-4 max-lg:order-7" aria-hidden="true">
        <Skeleton className="h-40 w-full rounded-xl sm:h-20" />
      </div>
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
