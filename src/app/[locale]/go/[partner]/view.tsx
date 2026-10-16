"use client";

/**
 * /go/[partner] — partnerska podstran (esim, transfers, tickets, insurance
 * z vsebino izluščeno iz production-mirror; ostali kot iskreni stub-i).
 *
 * P0-F (vodene povezave): ponudniki IZ REGISTRA (affiliate-providers.ts,
 * kategorija ≠ gorivo) dobijo ŽIVO vodeno povezavo prek lastne končne
 * točke /api/affiliate/go (302 + zapis klika). Ponudniki IZVEN registra
 * (kiwitaxi — partner-feed; travelpayouts — partnerski API) ostajajo
 * POŠTENI: brez izmišljenega URL-ja izrišemo onemogočen gumb
 * (aria-disabled) z opombo "povezava se konfigurira". Dokumentacijske
 * povezave registra (docsUrl) so realne in javne.
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
import { getProvider } from "@/lib/affiliate-providers";
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
    kicker: { sl: "Pojdi — partnerji", en: "Go — partners", it: "Vai — partner", de: "Los — Partner", fr: "Partir — partenaires", es: "Ir — socios" },
    back: { sl: "Nazaj na vse partnerje", en: "Back to all partners", it: "Torna a tutti i partner", de: "Zurück zu allen Partnern", fr: "Retour à tous les partenaires", es: "Volver a todos los socios" },
    coverage: { sl: "Pokritost", en: "Coverage", it: "Copertura", de: "Abdeckung", fr: "Couverture", es: "Cobertura" },
    providers: { sl: "Ponudniki", en: "Providers", it: "Fornitori", de: "Anbieter", fr: "Prestataires", es: "Proveedores" },
    access: { sl: "Stanje dostopa", en: "Access status", it: "Stato dell’accesso", de: "Zugriffsstatus", fr: "Statut d’accès", es: "Estado del acceso" },
    docs: { sl: "Dokumentacija vira", en: "Source documentation", it: "Documentazione della fonte", de: "Quellendokumentation", fr: "Documentation de la source", es: "Documentación de la fuente" },
    linkTitle: { sl: "Zunanja povezava partnerja", en: "External partner link", it: "Link esterno del partner", de: "Externer Partner-Link", fr: "Lien externe du partenaire", es: "Enlace externo del socio" },
    linkNote: {
      sl: "Partnerska povezava se konfigurira po odobritvi programa — do takrat iskren namestnik. Ne izmišljujemo affiliate URL-jev.",
      en: "The partner link is configured once the programme approves us — an honest placeholder until then. We do not invent affiliate URLs.",
      it: "Il link del partner viene configurato una volta che il programma ci approva — fino ad allora un segnaposto onesto. Non inventiamo URL di affiliazione.",
      de: "Der Partner-Link wird konfiguriert, sobald das Programm uns freigibt — bis dahin ein ehrlicher Platzhalter. Wir erfinden keine Affiliate-URLs.",
      fr: "Le lien du partenaire est configuré une fois que le programme nous approuve — d’ici là, un substitut honnête. Nous n’inventons pas d’URL d’affiliation.",
      es: "El enlace del socio se configura cuando el programa nos aprueba — hasta entonces, un marcador de posición honesto. No inventamos URL de afiliación.",
    },
    contentReady: { sl: "Vsebina obnovljena iz produkcije", en: "Content recovered from production", it: "Contenuto recuperato dalla produzione", de: "Inhalt aus der Produktion wiederhergestellt", fr: "Contenu restauré depuis la production", es: "Contenido recuperado de la producción" },
    contentComing: {
      sl: "Podstran v pripravi — vsebina se rekonstruira po ogledu produkcije. Kategorija, ponudniki in stanje dostopa so opisani spodaj.",
      en: "Subpage in preparation — content will be reconstructed from the production snapshot. Category, providers and access status are described below.",
      it: "Sottopagina in preparazione — il contenuto sarà ricostruito dallo snapshot di produzione. Categoria, fornitori e stato dell’accesso sono descritti qui sotto.",
      de: "Unterseite in Vorbereitung — der Inhalt wird aus dem Produktions-Snapshot rekonstruiert. Kategorie, Anbieter und Zugriffsstatus sind unten beschrieben.",
      fr: "Sous-page en préparation — le contenu sera reconstruit à partir de l’instantané de production. La catégorie, les prestataires et le statut d’accès sont décrits ci-dessous.",
      es: "Subpágina en preparación — el contenido se reconstruirá a partir de la instantánea de producción. La categoría, los proveedores y el estado del acceso se describen abajo.",
    },
    linkComing: { sl: "Povezava se konfigurira", en: "Link being configured", it: "Link in configurazione", de: "Link wird konfiguriert", fr: "Lien en cours de configuration", es: "Enlace en configuración" },
    openWith: {
      // Živa vodena povezava (P0-F) — samo za ponudnike IZ registra.
      sl: (name: string) => `Odpri pri ${name}`,
      en: (name: string) => `Open with ${name}`,
      it: (name: string) => `Apri con ${name}`,
      de: (name: string) => `Öffnen bei ${name}`,
      fr: (name: string) => `Ouvrir avec ${name}`,
      es: (name: string) => `Abrir con ${name}`,
    },
    guidedTitle: { sl: "Vodena povezava partnerja", en: "Guided partner link", it: "Link partner guidato", de: "Geführter Partner-Link", fr: "Lien partenaire guidé", es: "Enlace de socio guiado" },
    guidedNote: {
      sl: "Povezave teh ponudnikov vodimo prek naše lastne končne točke /api/affiliate/go: klik je štet, morebitna provizija je pogodbena (po pogojih partnerskega programa), cena zate pa ostane popolnoma enaka — to je affiliate razkritje, ne dodatek k ceni.",
      en: "Links for these providers are guided through our own /api/affiliate/go endpoint: each click is counted, any commission is contractual (per the partner programme's terms), and your price stays exactly the same — this is an affiliate disclosure, not a surcharge.",
      it: "I link di questi fornitori sono guidati attraverso il nostro endpoint /api/affiliate/go: ogni clic è conteggiato, un’eventuale commissione è contrattuale (secondo i termini del programma partner) e il tuo prezzo resta esattamente lo stesso — questa è un’informativa di affiliazione, non un sovrapprezzo.",
      de: "Links dieser Anbieter werden über unseren eigenen Endpunkt /api/affiliate/go geführt: jeder Klick wird gezählt, eine etwaige Provision ist vertraglich (gemäß den Bedingungen des Partnerprogramms) und dein Preis bleibt exakt gleich — das ist ein Affiliate-Hinweis, kein Aufpreis.",
      fr: "Les liens de ces prestataires sont guidés via notre propre point de terminaison /api/affiliate/go : chaque clic est compté, toute commission est contractuelle (selon les conditions du programme partenaires) et ton prix reste exactement le même — c’est une divulgation d’affiliation, pas un supplément.",
      es: "Los enlaces de estos proveedores se guían a través de nuestro propio endpoint /api/affiliate/go: cada clic se cuenta, cualquier comisión es contractual (según las condiciones del programa de socios) y tu precio sigue exactamente igual — esto es una divulgación de afiliación, no un recargo.",
    },
    provenance: {
      sl: "Vsebina podstrani je izluščena iz posnetka produkcije (production-mirror/go/" + route.slug + ") — brez dodanih podatkov.",
      en: "Subpage content is extracted from the production snapshot (production-mirror/go/" + route.slug + ") — with no data added.",
      it: "Il contenuto della sottopagina è estratto dallo snapshot di produzione (production-mirror/go/" + route.slug + ") — senza dati aggiunti.",
      de: "Der Inhalt der Unterseite ist aus dem Produktions-Snapshot extrahiert (production-mirror/go/" + route.slug + ") — ohne hinzugefügte Daten.",
      fr: "Le contenu de la sous-page est extrait de l’instantané de production (production-mirror/go/" + route.slug + ") — sans données ajoutées.",
      es: "El contenido de la subpágina se extrae de la instantánea de producción (production-mirror/go/" + route.slug + ") — sin datos añadidos.",
    },
  } as const;
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const Icon = ROUTE_ICONS[route.slug];
  const ready = route.content === "available";
  const title = pick(l, route.title);
  const lead = pick(l, route.lead);
  const coverage = pick(l, route.coverage);

  // P0-F: ponudniki z ŽIVO vodeno povezavo — samo registrski vnosi
  // (affiliate-providers.ts), ki niso gorivo (gorivo ni provizijsko).
  // kiwitaxi (partner-feed) in travelpayouts (API) ostajajo iskreni.
  const isLiveProvider = (slug: string) => {
    const reg = getProvider(slug);
    return reg !== null && reg.category !== "fuel";
  };
  const liveProviders = route.providers.filter((p) => isLiveProvider(p.slug));

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
              {pick(l, SUPPLY_STATUS_LABELS[p.status])}
            </Badge>
          ))}
        </div>
      </PageHeader>

      {/* Pokritost */}
      <Card className="mt-8 rounded-2xl border-border/70 shadow-sm">
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
            <div key={s.value + s.label.sl} className="rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/20 px-4 py-3 text-center shadow-sm">
              <dt className="text-xs text-muted-foreground">{pick(l, s.label)}</dt>
              <dd className="mt-0.5 text-2xl font-bold text-primary">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Sekcije vsebine (samo mirror-backed rute) */}
      {route.sections?.map((sec) => (
        <section key={sec.heading.sl} className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">
            {pick(l, sec.heading)}
          </h2>
          <ul className="mt-3 grid list-none gap-2 sm:grid-cols-2">
            {sec.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-card p-3.5 shadow-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {pick(l, item)}
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
              <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{p.label}</h3>
                    <Badge variant="secondary">
                      {pick(l, SUPPLY_STATUS_LABELS[p.status])}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{`${t("access")}: `}</span>
                    {pick(l, p.accessNote)}
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
                  {/* P0-F: ŽIVA vodena povezava — samo registrski vnosi (ne
                      gorivo). Izven registra (kiwitaxi, travelpayouts) gumba
                      NIČ — brez izmišljenega URL-ja. */}
                  {isLiveProvider(p.slug) && (
                    <div className="mt-3 flex sm:justify-end">
                      <Button
                        asChild
                        variant="outline"
                        className="min-h-11 w-full gap-1.5 sm:w-auto"
                      >
                        <a
                          href={`/api/affiliate/go?provider=${p.slug}`}
                          target="_blank"
                          rel="nofollow sponsored noopener"
                        >
                          {t("openWith")(p.label)}
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Povezava partnerja — P0-F: registrski ponudniki dobijo ŽIVO
          vodeno kartico (/api/affiliate/go, provizijsko razkrito); rute
          BREZ registrskih ponudnikov (transfers — kiwitaxi partner-feed)
          obdržijo POŠTEN onemogočen namestnik (NIČ izmišljenih URL-jev). */}
      {liveProviders.length > 0 ? (
        <Card className="mt-8 rounded-2xl border-primary/30 bg-gradient-to-br from-primary/[0.07] to-card shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="font-bold">{t("guidedTitle")}</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {t("guidedNote")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {liveProviders.map((p) => (
                <Button
                  key={p.slug}
                  asChild
                  variant="outline"
                  size="sm"
                  className="min-h-11 gap-1.5 bg-background"
                >
                  <a
                    href={`/api/affiliate/go?provider=${p.slug}`}
                    target="_blank"
                    rel="nofollow sponsored noopener"
                  >
                    {t("openWith")(p.label)}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-8 rounded-2xl border-dashed border-border/70 bg-muted/20 shadow-sm">
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
      )}

      {/* Provenanca vsebine (kjer je bila zajeta) */}
      {ready && (
        <p className="mt-4 text-xs text-muted-foreground">{t("provenance")}</p>
      )}
    </div>
  );
}
