"use client";

/**
 * /go — osrednja postaja partnerjev (GO hub, rekonstrukcija).
 *
 * 10 partnerskih kategorij (po /go povezavah iz mirror index.html:
 * hotels, flights, cars, transfers, transport, activities, viator,
 * tickets, insurance, esim) z ISKRENIMI statusi iz registra ponudnikov
 * (PROVIDER_REGISTRY). P0-F: kartice registrskih partnerjev (12
 * moniziranih — glej affiliate-providers.ts) nosijo žeton "Povezava:
 * na voljo" — na podstrani so vodene povezave prek /api/affiliate/go
 * (klik štet, provizija pogodbena, cena za uporabnika nespremenjena).
 * Rute brez registrskih ponudnikov (transfers — kiwitaxi partner-feed)
 * ostajajo POŠTENI. Kartice vodijo na lastne podstrani /go/[partner].
 */

import {
  ArrowRight,
  BedDouble,
  CarFront,
  CarTaxiFront,
  Compass,
  Map as MapIcon,
  Plane,
  ShieldCheck,
  Smartphone,
  Ticket,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "next-intl";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { getProvider } from "@/lib/affiliate-providers";
import { GO_PARTNERS, SUPPLY_STATUS_LABELS } from "@/lib/go-data";
import type { GoRouteSlug } from "@/lib/go-data";
import { cn } from "@/lib/utils";

const ROUTE_ICONS: Record<GoRouteSlug, LucideIcon> = {
  hotels: BedDouble,
  flights: Plane,
  cars: CarFront,
  transfers: CarTaxiFront,
  transport: TrainFront,
  activities: Compass,
  viator: MapIcon,
  tickets: Ticket,
  insurance: ShieldCheck,
  esim: Smartphone,
};

export default function GoHubPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "Pojdi", en: "Go", it: "Vai", de: "Los", fr: "Partir", es: "Ir" },
    title: { sl: "Pojdi — partnerji", en: "Go — partners", it: "Vai — partner", de: "Los — Partner", fr: "Partir — partenaires", es: "Ir — socios" },
    lead: {
      sl: "Vse kar potrebuješ na poti: nastanitve, leti, avti, transferji, transport, izkušnje, vstopnice, zavarovanje in eSIM — prek preverjenih partnerjev.",
      en: "Everything you need on the road: stays, flights, cars, transfers, transport, experiences, tickets, insurance and eSIM — via verified partners.",
      it: "Tutto ciò che ti serve in viaggio: soggiorni, voli, auto, transfer, trasporti, esperienze, biglietti, assicurazione ed eSIM — tramite partner verificati.",
      de: "Alles, was du unterwegs brauchst: Unterkünfte, Flüge, Autos, Transfers, Transport, Erlebnisse, Tickets, Versicherung und eSIM — über geprüfte Partner.",
      fr: "Tout ce qu’il te faut en route : hébergements, vols, voitures, transferts, transport, expériences, billets, assurance et eSIM — via des partenaires vérifiés.",
      es: "Todo lo que necesitas en el viaje: alojamientos, vuelos, coches, traslados, transporte, experiencias, entradas, seguro y eSIM — a través de socios verificados.",
    },
    disclosure: {
      sl: "Affiliate razkritje — partnerji iz našega registra imajo žive vodene povezave: ob rezervaciji zaslužimo provizijo (pogodbena, po pogojih partnerskega programa), zate pa cena ostane enaka. Partnerji, ki še niso v registru (npr. transferji prek partnerskega vira), imajo iskrene namestnike — ne izmišljujemo URL-jev.",
      en: "Affiliate disclosure — register partners now have live guided links: on a booking we earn a commission (contractual, per the partner programme's terms) while your price stays the same. Partners not yet in the register (e.g. transfers via a partner feed) keep honest placeholders — we do not invent URLs.",
      it: "Informativa di affiliazione — i partner del registro ora hanno link guidati attivi: su una prenotazione guadagniamo una commissione (contrattuale, secondo i termini del programma partner) mentre il tuo prezzo resta invariato. I partner non ancora nel registro (es. transfer tramite feed partner) mantengono segnaposto onesti — non inventiamo URL.",
      de: "Affiliate-Hinweis — Register-Partner haben jetzt live geführte Links: bei einer Buchung erhalten wir eine Provision (vertraglich, gemäß den Bedingungen des Partnerprogramms), während dein Preis gleich bleibt. Partner, die noch nicht im Register sind (z. B. Transfers über einen Partner-Feed), behalten ehrliche Platzhalter — wir erfinden keine URLs.",
      fr: "Divulgation d’affiliation — les partenaires du registre ont désormais des liens guidés actifs : lors d’une réservation, nous gagnons une commission (contractuelle, selon les conditions du programme partenaires) tandis que ton prix reste identique. Les partenaires pas encore dans le registre (ex. transferts via un flux partenaire) gardent des substituts honnêtes — nous n’inventons pas d’URL.",
      es: "Divulgación de afiliación — los socios del registro ya tienen enlaces guiados activos: en una reserva ganamos una comisión (contractual, según las condiciones del programa de socios) mientras que tu precio sigue igual. Los socios que aún no están en el registro (p. ej. traslados vía feed de socio) mantienen marcadores de posición honestos — no inventamos URL.",
    },
    contentReady: { sl: "Vsebina obnovljena", en: "Content recovered", it: "Contenuto recuperato", de: "Inhalt wiederhergestellt", fr: "Contenu restauré", es: "Contenido recuperado" },
    contentComing: { sl: "V pripravi", en: "In preparation", it: "In preparazione", de: "In Vorbereitung", fr: "En préparation", es: "En preparación" },
    linkLive: { sl: "Povezava: na voljo", en: "Link: available", it: "Link: disponibile", de: "Link: verfügbar", fr: "Lien : disponible", es: "Enlace: disponible" },
    providersWord: { sl: "Ponudnik", en: "Provider", it: "Fornitore", de: "Anbieter", fr: "Prestataire", es: "Proveedor" },
    open: { sl: "Odpri podstran", en: "Open subpage", it: "Apri la sottopagina", de: "Unterseite öffnen", fr: "Ouvrir la sous-page", es: "Abrir la subpágina" },
  } as const;
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />

      <p className="mt-6 max-w-3xl rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
        {t("disclosure")}
      </p>

      <ul className="mt-8 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GO_PARTNERS.map((route) => {
          const Icon = ROUTE_ICONS[route.slug];
          const ready = route.content === "available";
          // P0-F: živi žeton — rute z vsaj enim registrskim ponudnikom
          // (kategorija ≠ gorivo) imajo na podstrani vodene povezave.
          const hasLive = route.providers.some((p) => {
            const reg = getProvider(p.slug);
            return reg !== null && reg.category !== "fuel";
          });
          return (
            <li key={route.slug}>
              <Card
                className={cn(
                  "group h-full transition-all hover:-translate-y-0.5 hover:shadow-lg",
                  ready && "border-primary/35"
                )}
              >
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          ready
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        {ready ? t("contentReady") : t("contentComing")}
                      </Badge>
                      {hasLive && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-primary"
                        >
                          {t("linkLive")}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg leading-tight font-bold">
                      {pick(l, route.title)}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {t("providersWord")}: {route.providers.map((p) => p.label).join(" · ")}
                    </p>
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {pick(l, route.lead)}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {pick(l, route.coverage)}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    {route.providers.map((p) => (
                      <Badge
                        key={p.slug}
                        variant="secondary"
                        title={pick(l, p.accessNote)}
                      >
                        {pick(l, SUPPLY_STATUS_LABELS[p.status])}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    asChild
                    variant={ready ? "default" : "outline"}
                    size="sm"
                    className="mt-1"
                  >
                    <Link href={`/go/${route.slug}`} aria-label={`${t("open")}: ${route.title.sl}`}>
                      {t("open")}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
