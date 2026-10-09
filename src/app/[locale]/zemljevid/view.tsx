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

/** Nalagalni ovoj — Skeleton v višini zemljevida (brez skoka postavitve). */
const TravelMap = dynamic(() => import("@/components/map/travel-map"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-[62vh] min-h-80 rounded-xl sm:h-[70vh] lg:h-[calc(100dvh-15rem)] lg:min-h-[540px]" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-13 w-full rounded-lg" />
          ))}
        </div>
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
    <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <PageHeader
        kicker={pick(l, L.kicker)}
        title={pick(l, L.title)}
        lead={pick(l, L.lead)}
      />

      {/* Statistika nabora (oblika po mirror produkcije) */}
      <dl className="mt-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card px-4 py-3 text-center sm:text-left"
          >
            <dt className="sr-only">{s.label}</dt>
            <dd>
              <span className="text-2xl font-bold text-primary">{s.value}</span>{" "}
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Polen Leaflet zemljevid (klientno nalaganje brez SSR) */}
      <TravelMap />
    </div>
  );
}
