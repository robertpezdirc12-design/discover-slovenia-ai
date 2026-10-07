"use client";

/**
 * /go/[partner] — partnerska podstran (esim, transfers, tickets, insurance
 * z vsebino izluščeno iz production-mirror; ostali kot iskreni stub-i).
 *
 * ZUNANJA povezava partnerja v peskovniku NI konfigurirana: namesto
 * izmišljenega affiliate URL-ja izrišemo onemogočen gumb (aria-disabled)
 * z opombo "povezava se konfigurira". Dokumentacijske povezave registra
 * (docsUrl) so realne in javne.
 */

import {
  ArrowLeft,
  BedDouble,
  CarFront,
  CarTaxiFront,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileText,
  Map as MapIcon,
  Plane,
  ShieldCheck,
  Smartphone,
  Ticket,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "next-intl";
import { notFound, useParams } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  getGoRoute,
  SUPPLY_STATUS_LABELS,
  type GoRouteSlug,
} from "@/lib/go-data";
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

export default function GoPartnerPage() {
  const l = useLocale();
  const params = useParams<{ partner: string }>();
  const route = getGoRoute(params.partner);
  if (!route) notFound();

  const L = {
    kicker: { sl: "Pojdi — partnerji", en: "Go — partners" },
    back: { sl: "Nazaj na vse partnerje", en: "Back to all partners" },
    coverage: { sl: "Pokritost", en: "Coverage" },
    providers: { sl: "Ponudniki", en: "Providers" },
    access: { sl: "Stanje dostopa", en: "Access status" },
    docs: { sl: "Dokumentacija vira", en: "Source documentation" },
    linkTitle: { sl: "Zunanja povezava partnerja", en: "External partner link" },
    linkNote: {
      sl: "Partnerska povezava se konfigurira po odobritvi programa — do takrat iskren namestnik. Ne izmišljujemo affiliate URL-jev.",
      en: "The partner link is configured once the programme approves us — an honest placeholder until then. We do not invent affiliate URLs.",
    },
    contentReady: { sl: "Vsebina obnovljena iz produkcije", en: "Content recovered from production" },
    contentComing: {
      sl: "Podstran v pripravi — vsebina se rekonstruira po ogledu produkcije. Kategorija, ponudniki in stanje dostopa so opisani spodaj.",
      en: "Subpage in preparation — content will be reconstructed from the production snapshot. Category, providers and access status are described below.",
    },
    linkComing: { sl: "Povezava se konfigurira", en: "Link being configured" },
    provenance: {
      sl: "Vsebina podstrani je izluščena iz posnetka produkcije (production-mirror/go/" + route.slug + ") — brez dodanih podatkov.",
      en: "Subpage content is extracted from the production snapshot (production-mirror/go/" + route.slug + ") — with no data added.",
    },
  } as const;
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const Icon = ROUTE_ICONS[route.slug];
  const ready = route.content === "available";
  const title = l === "en" ? route.title.en : route.title.sl;
  const lead = l === "en" ? route.lead.en : route.lead.sl;
  const coverage = l === "en" ? route.coverage.en : route.coverage.sl;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/go">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>
      </Button>

      <PageHeader kicker={t("kicker")} title={title} lead={lead}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
          {route.providers.map((p) => (
            <Badge key={p.slug} variant="secondary">
              {p.label}:{" "}
              {l === "en" ? SUPPLY_STATUS_LABELS[p.status].en : SUPPLY_STATUS_LABELS[p.status].sl}
            </Badge>
          ))}
        </div>
      </PageHeader>

      {/* Pokritost */}
      <Card className="mt-8">
        <CardContent className="p-5">
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
            {t("coverage")}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{coverage}</p>
        </CardContent>
      </Card>

      {/* Statistike (samo kjer so zajete iz mirror) */}
      {route.stats && route.stats.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {route.stats.map((s) => (
            <div key={s.value + s.label.sl} className="rounded-xl border bg-card px-4 py-3 text-center">
              <dt className="text-xs text-muted-foreground">{l === "en" ? s.label.en : s.label.sl}</dt>
              <dd className="mt-0.5 text-2xl font-bold text-primary">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Sekcije vsebine (samo mirror-backed rute) */}
      {route.sections?.map((sec) => (
        <section key={sec.heading.sl} className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">
            {l === "en" ? sec.heading.en : sec.heading.sl}
          </h2>
          <ul className="mt-3 grid list-none gap-2 sm:grid-cols-2">
            {sec.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-lg border bg-card p-3.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {l === "en" ? item.en : item.sl}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Ponudniki + stanje dostopa (iskrene opombe registra) */}
      <section className="mt-8" aria-labelledby="go-providers">
        <h2 id="go-providers" className="text-lg font-bold tracking-tight">
          {t("providers")}
        </h2>
        <ul className="mt-3 list-none space-y-3">
          {route.providers.map((p) => (
            <li key={p.slug}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{p.label}</h3>
                    <Badge variant="secondary">
                      {l === "en" ? SUPPLY_STATUS_LABELS[p.status].en : SUPPLY_STATUS_LABELS[p.status].sl}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{`${t("access")}: `}</span>
                    {l === "en" ? p.accessNote.en : p.accessNote.sl}
                  </p>
                  {p.docsUrl && (
                    <a
                      href={p.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2.5 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <FileText className="size-3.5" aria-hidden="true" />
                      {t("docs")}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Zunanja povezava — iskren onemogočen namestnik (NIČ izmišljenih URL-jev) */}
      <Card className="mt-8 border-dashed">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">{t("linkTitle")}</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("linkNote")}
            </p>
          </div>
          {/* aria-disabled + href="#" = onemogočen namestnik (brez href ne bi bil fokusljiv) */}
          <a
            href="#"
            aria-disabled="true"
            onClick={(e) => e.preventDefault()}
            className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-xl border bg-muted px-5 text-sm font-semibold text-muted-foreground select-none"
          >
            {t("linkComing")}
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </CardContent>
      </Card>

      {/* Provenanca vsebine (kjer je bila zajeta) */}
      {ready && (
        <p className="mt-4 text-xs text-muted-foreground">{t("provenance")}</p>
      )}
    </div>
  );
}
