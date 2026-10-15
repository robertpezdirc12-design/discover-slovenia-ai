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
import { OwnMarketplaceSection } from "@/components/marketplace/own-marketplace-section";
import { NextStepCard, useNextStepContext } from "@/components/next-step-card";
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

const AVAILABILITY_LABELS: Record<ShelfAvailability, { sl: string; en: string; it: string; de: string; fr: string; es: string; cls: string }> = {
  available: {
    sl: "Na voljo",
    en: "Available",
    it: "Disponibile",
    de: "Verfügbar",
    fr: "Disponible",
    es: "Disponible",
    cls: "border-primary/40 bg-primary/10 text-primary",
  },
  coming: {
    sl: "Prihaja",
    en: "Coming",
    it: "In arrivo",
    de: "Kommt",
    fr: "À venir",
    es: "Próximamente",
    cls: "border-amber-600/40 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  },
  empty: {
    sl: "Prazno — iskreno",
    en: "Empty — honestly",
    it: "Vuoto — onestamente",
    de: "Leer — ehrlich",
    fr: "Vide — honnêtement",
    es: "Vacío — honestamente",
    cls: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
};

const SHELF_GROUPS = [
  {
    id: "local",
    sl: "Lokalni viri (odprti podatki)",
    en: "Local sources (open data)",
    it: "Fonti locali (dati aperti)",
    de: "Lokale Quellen (offene Daten)",
    fr: "Sources locales (données ouvertes)",
    es: "Fuentes locales (datos abiertos)",
  },
  { id: "own", sl: "Lastna tržnica", en: "Our own marketplace", it: "Il nostro mercato", de: "Unser eigener Marktplatz", fr: "Notre marché", es: "Nuestro mercado" },
  { id: "commercial", sl: "Partnerji", en: "Partners", it: "Partner", de: "Partner", fr: "Partenaires", es: "Socios" },
] as const;

export function TrznicaExplorer({
  nextStepDismissed = false,
}: {
  /** POLIR13 (2.40.0): sejni dismiss zrcaljen v piškotek
   *  dai:next-step-dismissed — strežniški starš (page.tsx) ga prebere s
   *  cookies() in kartico izpusti ŽE v SSR (ni rezervacije prostora, ni
   *  premika vsebine po ponovnem nalaganju v isti seji). */
  nextStepDismissed?: boolean;
}) {
  const l = useLocale();
  const { toast } = useToast();
  const tripItems = useMyTripList();
  const { ctx: nextStepCtx, ready: nextStepReady } = useNextStepContext();

  const L = {
    kicker: { sl: "Tržnica", en: "Marketplace", it: "Mercato", de: "Marktplatz", fr: "Marché", es: "Mercado" },
    title: { sl: "Tržnica lokalnih izdelkov in doživetij", en: "Marketplace of local products & experiences", it: "Mercato di prodotti locali ed esperienze", de: "Marktplatz für lokale Produkte & Erlebnisse", fr: "Marché de produits locaux et d'expériences", es: "Mercado de productos locales y experiencias" },
    lead: {
      sl: "Med, vina, obrti, rafting in gastro doživetja — izdelki in doživetja neposredno od slovenskih ponudnikov, brez posrednikov.",
      en: "Honey, wines, crafts, rafting and gastro experiences — products and experiences directly from Slovenian providers, with no middlemen.",
      it: "Miele, vini, artigianato, rafting ed esperienze gastronomiche — prodotti ed esperienze direttamente dai fornitori sloveni, senza intermediari.",
      de: "Honig, Weine, Handwerk, Rafting und Genusserlebnisse — Produkte und Erlebnisse direkt von slowenischen Anbietern, ohne Zwischenhändler.",
      fr: "Miel, vins, artisanat, rafting et expériences gourmandes — produits et expériences directement de prestataires slovènes, sans intermédiaires.",
      es: "Miel, vinos, artesanía, rafting y experiencias gastronómicas — productos y experiencias directamente de proveedores eslovenos, sin intermediarios.",
    },
    badge: {
      sl: "Neposredno od slovenskih ponudnikov · Brez skritih stroškov",
      en: "Directly from Slovenian providers · No hidden costs",
      it: "Direttamente dai fornitori sloveni · Senza costi nascosti",
      de: "Direkt von slowenischen Anbietern · Keine versteckten Kosten",
      fr: "Directement de prestataires slovènes · Sans frais cachés",
      es: "Directamente de proveedores eslovenos · Sin costes ocultos",
    },
    tabProducts: { sl: "Izdelki", en: "Products", it: "Prodotti", de: "Produkte", fr: "Produits", es: "Productos" },
    tabExperiences: { sl: "Izkušnje", en: "Experiences", it: "Esperienze", de: "Erlebnisse", fr: "Expériences", es: "Experiencias" },
    tabProviders: { sl: "Ponudniki", en: "Providers", it: "Fornitori", de: "Anbieter", fr: "Prestataires", es: "Proveedores" },
    productsTitle: { sl: "Izdelki se dopolnjujejo", en: "Products are being completed", it: "I prodotti sono in fase di completamento", de: "Produkte werden vervollständigt", fr: "Les produits sont en cours de finalisation", es: "Los productos se están completando" },
    productsLead: {
      sl: "Fizični izdelki (med, vina, obrti) iz produkcije niso bili zajeti v obnovitvenem posnetku. Katalog bomo dopolnili po overjenih virih — nič izmišljenih izdelkov ali cen.",
      en: "Physical products (honey, wines, crafts) from production were not captured in the recovery snapshot. We will complete the catalogue from verified sources — no invented products or prices.",
      it: "I prodotti fisici (miele, vini, artigianato) della produzione non sono stati inclusi nello snapshot di recupero. Completeremo il catalogo con fonti verificate — nessun prodotto o prezzo inventato.",
      de: "Physische Produkte (Honig, Weine, Handwerk) aus der Produktion wurden im Wiederherstellungs-Snapshot nicht erfasst. Wir vervollständigen den Katalog aus verifizierten Quellen — keine erfundenen Produkte oder Preise.",
      fr: "Les produits physiques (miel, vins, artisanat) de la production n'ont pas été capturés dans l'instantané de récupération. Nous compléterons le catalogue à partir de sources vérifiées — aucun produit ni prix inventé.",
      es: "Los productos físicos (miel, vinos, artesanía) de la producción no fueron capturados en la instantánea de recuperación. Completaremos el catálogo con fuentes verificadas — sin productos ni precios inventados.",
    },
    experiencesTitle: { sl: "Izkušnje po destinacijah", en: "Experiences by destination", it: "Esperienze per destinazione", de: "Erlebnisse nach Reiseziel", fr: "Expériences par destination", es: "Experiencias por destino" },
    experiencesLead: {
      sl: "Izkušnje so izpeljane iz kanonskega nabora destinacij — ime je dejanska aktivnost destinacije, ocena stroška pa polje costPerPerson. Nakup z lastnim checkoutom je na voljo zgoraj (Lastna tržnica); te kartice dodajajo izkušnjo v načrt poti.",
      en: "Experiences are derived from the canonical destination dataset — the name is an actual destination activity, the cost estimate its costPerPerson field. Purchase with our own checkout is available above (Our own marketplace); these cards add the experience to your trip plan.",
      it: "Le esperienze derivano dal dataset canonico delle destinazioni — il nome è un'attività reale della destinazione, la stima del costo il suo campo costPerPerson. L'acquisto con il nostro checkout è disponibile sopra (Il nostro mercato); queste schede aggiungono l'esperienza al piano di viaggio.",
      de: "Die Erlebnisse werden aus dem kanonischen Ziel-Datensatz abgeleitet — der Name ist eine tatsächliche Aktivität des Reiseziels, die Kostenschätzung dessen Feld costPerPerson. Der Kauf über unseren eigenen Checkout ist oben verfügbar (Unser eigener Marktplatz); diese Karten fügen das Erlebnis zum Reiseplan hinzu.",
      fr: "Les expériences sont dérivées de l'ensemble canonique de destinations — le nom est une activité réelle de la destination, l'estimation du coût son champ costPerPerson. L'achat via notre propre checkout est disponible plus haut (Notre marché) ; ces cartes ajoutent l'expérience à ton plan de voyage.",
      es: "Las experiencias se derivan del conjunto canónico de destinos — el nombre es una actividad real del destino, la estimación de coste su campo costPerPerson. La compra con nuestro propio checkout está disponible arriba (Nuestro mercado); estas tarjetas añaden la experiencia a tu plan de viaje.",
    },
    estimate: { sl: (n: number) => `≈ ${n} € · ocena`, en: (n: number) => `≈ €${n} · estimate`, it: (n: number) => `≈ ${n} € · stima`, de: (n: number) => `≈ ${n} € · Schätzung`, fr: (n: number) => `≈ ${n} € · estimation`, es: (n: number) => `≈ ${n} € · estimación` },
    available: { sl: "Na voljo", en: "Available", it: "Disponibile", de: "Verfügbar", fr: "Disponible", es: "Disponible" },
    add: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V moji poti", en: "In my trip", it: "Nel mio viaggio", de: "In meiner Reise", fr: "Dans mon voyage", es: "En mi viaje" },
    toastAdded: { sl: "Dodano v mojo pot", en: "Added to my trip", it: "Aggiunto al mio viaggio", de: "Zu meiner Reise hinzugefügt", fr: "Ajouté à mon voyage", es: "Añadido a mi viaje" },
    providersTitle: { sl: "Police ponudnikov", en: "Provider shelves", it: "Scaffali dei fornitori", de: "Anbieter-Regale", fr: "Étagères des prestataires", es: "Estanterías de proveedores" },
    providersLead: {
      sl: "Struktura po registru ponudnikov (TRAVEL SUPPLY MAP): lokalni viri, lastna tržnica in partnerji — statusi so dejansko stanje, ne oblube.",
      en: "Structured after the provider registry (TRAVEL SUPPLY MAP): local sources, our own marketplace and partners — statuses are the actual state, not promises.",
      it: "Struttura secondo il registro dei fornitori (TRAVEL SUPPLY MAP): fonti locali, nostro mercato e partner — gli stati sono la situazione reale, non promesse.",
      de: "Struktur nach dem Anbieter-Register (TRAVEL SUPPLY MAP): lokale Quellen, unser eigener Marktplatz und Partner — die Status sind der tatsächliche Stand, keine Versprechen.",
      fr: "Structure selon le registre des prestataires (TRAVEL SUPPLY MAP) : sources locales, notre marché et partenaires — les statuts sont l'état réel, pas des promesses.",
      es: "Estructura según el registro de proveedores (TRAVEL SUPPLY MAP): fuentes locales, nuestro mercado y socios — los estados son la situación real, no promesas.",
    },
    openPartner: { sl: "Odpri partnerja", en: "Open partner", it: "Apri partner", de: "Partner öffnen", fr: "Ouvrir le partenaire", es: "Abrir socio" },
    forProviders: { sl: "Prodajaš izdelke ali izkušnje?", en: "Selling products or experiences?", it: "Vendi prodotti o esperienze?", de: "Verkaufst du Produkte oder Erlebnisse?", fr: "Tu vends des produits ou des expériences ?", es: "¿Vendes productos o experiencias?" },
    forProvidersCta: { sl: "Pridruži se tržnici", en: "Join the marketplace", it: "Unisciti al mercato", de: "Tritt dem Marktplatz bei", fr: "Rejoins le marché", es: "Únete al mercado" },
  } as const;
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const inTrip = React.useCallback(
    (id: string) => tripItems.some((x) => x.refId === id),
    [tripItems]
  );

  const onAdd = (p: OwnProduct) => {
    if (inTrip(p.id)) return;
    const name = pick(l, p.name);
    myTrip.add(p.id, name, "experience", "trznica");
    toast({ title: t("toastAdded") });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")}>
        <div className="mt-4">
          {/* POLIR7 (2.34.0): whitespace-normal — badge.tsx osnova ima whitespace-nowrap,
              badge pa je STAVEK (SL 24 px, DE 32 px preliva ekrana 390 px).
              Preklop deluje zanesljivo, ker Badge uporablja cn()/tailwind-merge. */}
          <Badge variant="outline" className="border-primary/40 text-left whitespace-normal text-primary">
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            {t("badge")}
          </Badge>
        </div>
      </PageHeader>

      {/* ── NEXT-STEP: naslednji smiseln korak glede na stanje (issue #1) ──
         POLIR13 (2.40.0): vrata so strežniška (piškotek
         dai:next-step-dismissed, ne več nextStepReady) + kartica se izriše
         NEVIDNA že v SSR in se razkrije ob `ready` (prop) — rezervacija
         prostora po web.dev kanonu „Reserve space for late-loading
         content“ (vstavitev po hidraciji je povzročala CLS 0,231). */}
      {!nextStepDismissed && (
        <div className="mt-8">
          <NextStepCard ctx={nextStepCtx} surface="market" ready={nextStepReady} />
        </div>
      )}

      {/* ── LASTNA TRŽNICA — živi izdelki z lastnim checkoutom (48-c) ── */}
      <OwnMarketplaceSection />

      <Tabs defaultValue="experiences" className="mt-8">
        <TabsList className="h-12 w-full max-w-lg rounded-xl border border-border/70 bg-muted/70 p-1.5 shadow-sm">
          <TabsTrigger value="products" className="h-9 flex-1 rounded-lg text-sm">
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
              const name = pick(l, p.name);
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
                          <Check className="size-3" aria-hidden="true" />
                          {t("available")}
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
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {pick(l, p.description)}
                      </p>
                      <div className="mt-auto pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={added ? "secondary" : "default"}
                          className="min-h-11 w-full"
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
                    {pick(l, g)}
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
            title={pick(locale, avail)}
          >
            <ShieldQuestion className="size-3" aria-hidden="true" />
            {pick(locale, avail)}
          </Badge>
          <Badge variant="secondary">
            {pick(locale, status)}
          </Badge>
        </div>

        <h4 className="text-base leading-tight font-bold">
          {pick(locale, shelf.label)}
        </h4>
        {/* Mobilni UX (issue #1 §4): dolgi seznami ponudnikov prelomimo z
            besedami, opis okvirimo z line-clamp za enotno višino kartice. */}
        <p className="text-xs font-medium text-muted-foreground break-words">
          {shelf.providers.join(" · ")}
        </p>
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {pick(locale, shelf.description)}
        </p>
        <p className="text-xs text-muted-foreground">
          {pick(locale, shelf.coverage)}
        </p>

        {shelf.goRoute && (
          <div className="mt-auto pt-1">
            <Button asChild size="sm" variant="outline" className="min-h-11 w-full">
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
