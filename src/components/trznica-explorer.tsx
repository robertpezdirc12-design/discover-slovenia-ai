"use client";

/**
 * TRŽNICA RAZISKOVALEC — tržnica lokalnih izdelkov in doživetij.
 *
 * Trije zavihki (po produkciji: Izdelki / Izkušnje + ponudniške police):
 *  - IZDELKI: iskreno prazen katalog (izdelki iz produkcije niso bili
 *    zajeti — ne izmišljujemo jih);
 *  - IZKUŠNJE: lastni produkti izpeljani iz kanonskega nabora destinacij
 *    (ime = aktivnost destinacije, ocena = costPerPerson) z gumbom
 *    "Dodaj v mojo pot"; nakup v peskovniku NI priklopljen → status
 *    "v pripravi" (iskreno);
 *  - PONUDNIKI: police po strukturi PROVIDER_REGISTRY (local/own/commercial)
 *    z iskrenimi statusi in povezavo na /go/<partner>.
 */

import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Check,
  Heart,
  MapPin,
  PackageOpen,
  ShieldQuestion,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { SUPPLY_STATUS_LABELS } from "@/lib/go-data";
import { myTrip, useMyTripList } from "@/lib/my-trip";
import {
  OWN_PRODUCTS,
  SUPPLY_SHELVES,
  type OwnProduct,
  type ShelfAvailability,
  type SupplyShelf,
} from "@/lib/trznica-data";
import { getDestination } from "@/lib/slovenia-data";
import { cn } from "@/lib/utils";

const AVAILABILITY_LABELS: Record<ShelfAvailability, { sl: string; en: string; cls: string }> = {
  available: {
    sl: "Na voljo",
    en: "Available",
    cls: "border-primary/40 bg-primary/10 text-primary",
  },
  coming: {
    sl: "Prihaja",
    en: "Coming",
    cls: "border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  },
  empty: {
    sl: "Prazno — iskreno",
    en: "Empty — honestly",
    cls: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
};

const SHELF_GROUPS = [
  {
    id: "local",
    sl: "Lokalni viri (odprti podatki)",
    en: "Local sources (open data)",
  },
  { id: "own", sl: "Lastna tržnica", en: "Our own marketplace" },
  { id: "commercial", sl: "Partnerji", en: "Partners" },
] as const;

export function TrznicaExplorer() {
  const l = useLocale();
  const { toast } = useToast();
  const tripItems = useMyTripList();

  const L = {
    kicker: { sl: "Tržnica", en: "Marketplace" },
    title: { sl: "Tržnica lokalnih izdelkov in doživetij", en: "Marketplace of local products & experiences" },
    lead: {
      sl: "Med, vina, obrti, rafting in gastro doživetja — izdelki in doživetja neposredno od slovenskih ponudnikov, brez posrednikov.",
      en: "Honey, wines, crafts, rafting and gastro experiences — products and experiences directly from Slovenian providers, with no middlemen.",
    },
    badge: {
      sl: "Neposredno od slovenskih ponudnikov · Brez skritih stroškov",
      en: "Directly from Slovenian providers · No hidden costs",
    },
    tabProducts: { sl: "Izdelki", en: "Products" },
    tabExperiences: { sl: "Izkušnje", en: "Experiences" },
    tabProviders: { sl: "Ponudniki", en: "Providers" },
    productsTitle: { sl: "Izdelki se dopolnjujejo", en: "Products are being completed" },
    productsLead: {
      sl: "Fizični izdelki (med, vina, obrti) iz produkcije niso bili zajeti v obnovitvenem posnetku. Katalog bomo dopolnili po overjenih virih — nič izmišljenih izdelkov ali cen.",
      en: "Physical products (honey, wines, crafts) from production were not captured in the recovery snapshot. We will complete the catalogue from verified sources — no invented products or prices.",
    },
    experiencesTitle: { sl: "Izkušnje po destinacijah", en: "Experiences by destination" },
    experiencesLead: {
      sl: "Izkušnje so izpeljane iz kanonskega nabora destinacij — ime je dejanska aktivnost destinacije, ocena stroška pa polje costPerPerson. Nakup (checkout) v peskovniku še ni priklopljen.",
      en: "Experiences are derived from the canonical destination dataset — the name is an actual destination activity, the cost estimate its costPerPerson field. Checkout is not yet connected in the sandbox.",
    },
    estimate: { sl: (n: number) => `≈ ${n} € · ocena`, en: (n: number) => `≈ €${n} · estimate` },
    inPrep: { sl: "V pripravi", en: "In preparation" },
    add: { sl: "Dodaj v mojo pot", en: "Add to my trip" },
    added: { sl: "V moji poti", en: "In my trip" },
    toastAdded: { sl: "Dodano v mojo pot", en: "Added to my trip" },
    providersTitle: { sl: "Police ponudnikov", en: "Provider shelves" },
    providersLead: {
      sl: "Struktura po registru ponudnikov (TRAVEL SUPPLY MAP): lokalni viri, lastna tržnica in partnerji — statusi so dejansko stanje, ne oblube.",
      en: "Structured after the provider registry (TRAVEL SUPPLY MAP): local sources, our own marketplace and partners — statuses are the actual state, not promises.",
    },
    openPartner: { sl: "Odpri partnerja", en: "Open partner" },
    forProviders: { sl: "Prodajaš izdelke ali izkušnje?", en: "Selling products or experiences?" },
    forProvidersCta: { sl: "Pridruži se tržnici", en: "Join the marketplace" },
  } as const;
  const t = (k: keyof typeof L) => pick(l, L[k]);

  const inTrip = React.useCallback(
    (id: string) => tripItems.some((x) => x.refId === id),
    [tripItems]
  );

  const onAdd = (p: OwnProduct) => {
    if (inTrip(p.id)) return;
    const name = l === "en" ? p.name.en : p.name.sl;
    myTrip.add(p.id, name, "experience", "trznica");
    toast({ title: t("toastAdded") });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")}>
        <div className="mt-4">
          <Badge variant="outline" className="border-primary/40 text-primary">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            {t("badge")}
          </Badge>
        </div>
      </PageHeader>

      <Tabs defaultValue="experiences" className="mt-8">
        <TabsList className="h-11 w-full max-w-md">
          <TabsTrigger value="products" className="h-8 flex-1 text-sm">
            {t("tabProducts")}
          </TabsTrigger>
          <TabsTrigger value="experiences" className="h-8 flex-1 text-sm">
            {t("tabExperiences")}
          </TabsTrigger>
          <TabsTrigger value="providers" className="h-8 flex-1 text-sm">
            {t("tabProviders")}
          </TabsTrigger>
        </TabsList>

        {/* ── ZAVIHEK: IZDELKI (iskreno prazen) ─────────────────────── */}
        <TabsContent value="products" className="mt-6">
          <div className="rounded-xl border border-dashed p-10 text-center">
            <PackageOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-3 font-bold">{t("productsTitle")}</h2>
            <p className="mx-auto mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("productsLead")}
            </p>
            <Button asChild className="mt-5" variant="outline">
              <Link href="/za-ponudnike">{t("forProvidersCta")}</Link>
            </Button>
          </div>
        </TabsContent>

        {/* ── ZAVIHEK: IZKUŠNJE (lastni produkti iz nabora) ──────────── */}
        <TabsContent value="experiences" className="mt-6">
          <h2 className="text-xl font-bold tracking-tight">{t("experiencesTitle")}</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("experiencesLead")}
          </p>
          <ul className="mt-5 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OWN_PRODUCTS.map((p) => {
              const dest = getDestination(p.destinationSlug);
              const added = inTrip(p.id);
              const name = l === "en" ? p.name.en : p.name.sl;
              return (
                <li key={p.id}>
                  <Card className="group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="relative aspect-[3/2] bg-muted">
                      <Image
                        src={p.image}
                        alt={name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute top-2.5 left-2.5">
                        <Badge className="gap-1 bg-background/90 text-foreground shadow-sm backdrop-blur">
                          <Clock className="size-3" aria-hidden="true" />
                          {t("inPrep")}
                        </Badge>
                      </span>
                      <span className="absolute right-2.5 bottom-2.5">
                        <Badge className="bg-primary text-primary-foreground shadow-sm">
                          {t("estimate")(p.priceEstimate)}
                        </Badge>
                      </span>
                    </div>
                    <CardContent className="flex flex-1 flex-col gap-2 p-4">
                      {dest && (
                        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <MapPin className="size-3 shrink-0" aria-hidden="true" />
                          <Link
                            href={`/destinacija/${p.destinationSlug}`}
                            className="hover:text-primary hover:underline"
                          >
                            {dest.name}
                          </Link>
                        </p>
                      )}
                      <h3 className="text-base leading-tight font-bold">{name}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {l === "en" ? p.description.en : p.description.sl}
                      </p>
                      <div className="mt-auto pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={added ? "secondary" : "default"}
                          className="w-full"
                          onClick={() => onAdd(p)}
                          aria-disabled={added}
                        >
                          {added ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : (
                            <Heart className="size-4" aria-hidden="true" />
                          )}
                          {added ? t("added") : t("add")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </TabsContent>

        {/* ── ZAVIHEK: PONUDNIKI (registarske police) ────────────────── */}
        <TabsContent value="providers" className="mt-6">
          <h2 className="text-xl font-bold tracking-tight">{t("providersTitle")}</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("providersLead")}
          </p>

          <div className="mt-6 space-y-10">
            {SHELF_GROUPS.map((g) => {
              const shelves = SUPPLY_SHELVES.filter((s) => s.group === g.id);
              if (shelves.length === 0) return null;
              return (
                <section key={g.id} aria-labelledby={`shelf-group-${g.id}`}>
                  <h3
                    id={`shelf-group-${g.id}`}
                    className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase"
                  >
                    {l === "en" ? g.en : g.sl}
                  </h3>
                  <ul className="mt-3 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {shelves.map((s) => (
                      <li key={s.slug}>
                        <ShelfCard shelf={s} locale={l} openLabel={t("openPartner")} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── CTA za ponudnike ─────────────────────────────────────────── */}
      <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold">{t("forProviders")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("productsLead")}</p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link href="/za-ponudnike">{t("forProvidersCta")}</Link>
        </Button>
      </div>
    </div>
  );
}

/** Kartica police ponudnika (statusi + pokritost + povezava na /go). */
function ShelfCard({
  shelf,
  locale,
  openLabel,
}: {
  shelf: SupplyShelf;
  locale: string;
  openLabel: string;
}) {
  const avail = AVAILABILITY_LABELS[shelf.availability];
  const status = SUPPLY_STATUS_LABELS[shelf.status];

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn("gap-1", avail.cls)}
            title={locale === "en" ? avail.en : avail.sl}
          >
            <ShieldQuestion className="size-3" aria-hidden="true" />
            {locale === "en" ? avail.en : avail.sl}
          </Badge>
          <Badge variant="secondary">
            {locale === "en" ? status.en : status.sl}
          </Badge>
        </div>

        <h4 className="text-base leading-tight font-bold">
          {locale === "en" ? shelf.label.en : shelf.label.sl}
        </h4>
        <p className="text-xs font-medium text-muted-foreground">
          {shelf.providers.join(" · ")}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {locale === "en" ? shelf.description.en : shelf.description.sl}
        </p>
        <p className="text-xs text-muted-foreground">
          {locale === "en" ? shelf.coverage.en : shelf.coverage.sl}
        </p>

        {shelf.goRoute && (
          <div className="mt-auto pt-1">
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href={`/go/${shelf.goRoute}`}>
                {openLabel}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
