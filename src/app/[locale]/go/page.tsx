"use client";

/**
 * /go — osrednja postaja partnerjev (GO hub, rekonstrukcija).
 *
 * 10 partnerskih kategorij (po /go povezavah iz mirror index.html:
 * hotels, flights, cars, transfers, transport, activities, viator,
 * tickets, insurance, esim) z ISKRENIMI statusi iz registra ponudnikov
 * (PROVIDER_REGISTRY). Zunanje partnerske povezave v peskovniku niso
 * konfigurirane → kartice vodijo na lastne podstrani /go/[partner],
 * kjer je vsebina (kjer je bila zajeta) + pošten namestnik povezave.
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
    kicker: { sl: "Pojdi", en: "Go" },
    title: { sl: "Pojdi — partnerji", en: "Go — partners" },
    lead: {
      sl: "Vse kar potrebuješ na poti: nastanitve, leti, avti, transferji, transport, izkušnje, vstopnice, zavarovanje in eSIM — prek preverjenih partnerjev.",
      en: "Everything you need on the road: stays, flights, cars, transfers, transport, experiences, tickets, insurance and eSIM — via verified partners.",
    },
    disclosure: {
      sl: "Affiliate povezave — zaslužimo provizijo pri rezervacijah; cena zate se ne poveča. Povezave posameznih partnerjev se konfigurirajo po odobritvi programov (iskreni namestniki, brez izmišljenih URL-jev).",
      en: "Affiliate links — we earn a commission on bookings; your price stays the same. Individual partner links are configured once programmes approve us (honest placeholders, no invented URLs).",
    },
    contentReady: { sl: "Vsebina obnovljena", en: "Content recovered" },
    contentComing: { sl: "V pripravi", en: "In preparation" },
    providersWord: { sl: "Ponudnik", en: "Provider" },
    open: { sl: "Odpri podstran", en: "Open subpage" },
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
                  </div>

                  <div>
                    <h2 className="text-lg leading-tight font-bold">
                      {l === "en" ? route.title.en : route.title.sl}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {t("providersWord")}: {route.providers.map((p) => p.label).join(" · ")}
                    </p>
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {l === "en" ? route.lead.en : route.lead.sl}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {l === "en" ? route.coverage.en : route.coverage.sl}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    {route.providers.map((p) => (
                      <Badge
                        key={p.slug}
                        variant="secondary"
                        title={l === "en" ? p.accessNote.en : p.accessNote.sl}
                      >
                        {l === "en"
                          ? SUPPLY_STATUS_LABELS[p.status].en
                          : SUPPLY_STATUS_LABELS[p.status].sl}
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
