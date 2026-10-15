"use client";

/**
 * OWN-MARKETPLACE-SECTION — "Lastna tržnica" na /trznica (48-c).
 *
 * Živi izdelki iz baze (GET /api/products): kartice z imenom, ceno
 * (izključno costPerPerson destinacije), zalogo in gumbom Kupi
 * (checkout-modal). Zgornja pasica izriše povratno stanje plačila
 * SAMO ob ?placilo= v URL (payment-return-banner).
 *
 * Imena/opisi v bazi so slovenski (kanon); za EN locale prekrijemo z
 * prevodi iz own police (OWN_PRODUCTS po slugu), ostali jeziki
 * ostanejo pošteno na slovenščini (fallback kanon).
 */

import { MapPin, PackageOpen, RefreshCw, ShoppingCart } from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
import * as React from "react";

import { CheckoutModal } from "@/components/marketplace/checkout-modal";
import { PaymentReturnBanner } from "@/components/marketplace/payment-return-banner";
import {
  formatPriceCents,
  type MarketplaceProduct,
} from "@/components/marketplace/types";
import { WatchPriceButton } from "@/components/watch/watch-add-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { getDestination } from "@/lib/slovenia-data";
import { slUnit } from "@/lib/sl-utils";
import { getOwnProduct } from "@/lib/trznica-data";

/** Oznaka vrste izdelka (izkušnja/vstopnica/izdelek) po jeziku. */
const KIND_LABELS: Record<string, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
  experience: { sl: "Izkušnja", en: "Experience", it: "Esperienza", de: "Erlebnis", fr: "Expérience", es: "Experiencia" },
  ticket: { sl: "Vstopnica", en: "Ticket", it: "Biglietto", de: "Ticket", fr: "Billet", es: "Entrada" },
  product: { sl: "Izdelek", en: "Product", it: "Prodotto", de: "Produkt", fr: "Produit", es: "Producto" },
};

const L = {
  title: { sl: "Lastna tržnica", en: "Our own marketplace", it: "Il nostro mercato", de: "Unser eigener Marktplatz", fr: "Notre marché", es: "Nuestro mercado" },
  lead: {
    sl: "Izdelki in izkušnje z lastnim checkoutom: cene so izključno polje costPerPerson kanonskega nabora destinacij, zaloga je dejansko stanje. V peskovniku so omogočena demo plačila — vsako tako naročilo je izrecno označeno DEMO (brez prave bremenitve).",
    en: "Products and experiences with our own checkout: prices come exclusively from the canonical dataset's costPerPerson field, stock is the actual state. The sandbox runs demo payments — every such order is explicitly labelled DEMO (no real charge).",
    it: "Prodotti ed esperienze con il nostro checkout: i prezzi provengono esclusivamente dal campo costPerPerson del dataset canonico delle destinazioni, la giacenza è lo stato effettivo. La sandbox esegue pagamenti demo — ogni ordine di questo tipo è esplicitamente contrassegnato DEMO (nessun addebito reale).",
    de: "Produkte und Erlebnisse mit unserem eigenen Checkout: Preise stammen ausschließlich aus dem costPerPerson-Feld des kanonischen Datensatzes, der Bestand ist der tatsächliche Stand. Die Sandbox führt Demo-Zahlungen aus — jede solche Bestellung ist ausdrücklich als DEMO gekennzeichnet (keine echte Belastung).",
    fr: "Produits et expériences avec notre propre checkout : les prix proviennent exclusivement du champ costPerPerson de l'ensemble canonique de destinations, le stock est l'état réel. La sandbox exécute des paiements démo — chaque commande de ce type est explicitement marquée DEMO (aucun débit réel).",
    es: "Productos y experiencias con nuestro propio checkout: los precios provienen exclusivamente del campo costPerPerson del conjunto canónico de destinos, el stock es el estado real. El sandbox ejecuta pagos demo — cada pedido de este tipo está explícitamente marcado como DEMO (sin cargo real).",
  },
  liveBadge: { sl: "Živi checkout", en: "Live checkout", it: "Checkout live", de: "Live-Checkout", fr: "Checkout live", es: "Checkout en vivo" },
  stock: {
    sl: (n: number) =>
      `Zaloga: ${n} ${slUnit(n, "kos", "kosa", "kosi", "kosov")}`,
    en: (n: number) => (n === 1 ? "1 unit in stock" : `${n} units in stock`),
    it: (n: number) => (n === 1 ? "1 unità in magazzino" : `${n} unità in magazzino`),
    de: (n: number) => (n === 1 ? "1 Stück auf Lager" : `${n} Stück auf Lager`),
    fr: (n: number) => (n === 1 ? "1 unité en stock" : `${n} unités en stock`),
    es: (n: number) => (n === 1 ? "1 unidad en stock" : `${n} unidades en stock`),
  },
  soldOut: { sl: "Razprodano", en: "Sold out", it: "Esaurito", de: "Ausverkauft", fr: "Épuisé", es: "Agotado" },
  buy: { sl: "Kupi", en: "Buy", it: "Acquista", de: "Kaufen", fr: "Acheter", es: "Comprar" },
  sold: {
    sl: (n: number) => `${n} ${slUnit(n, "prodan", "prodana", "prodani", "prodanih")}`,
    en: (n: number) => (n === 1 ? "1 sold" : `${n} sold`),
    it: (n: number) => (n === 1 ? "1 venduto" : `${n} venduti`),
    de: (n: number) => (n === 1 ? "1 verkauft" : `${n} verkauft`),
    fr: (n: number) => (n === 1 ? "1 vendu" : `${n} vendus`),
    es: (n: number) => (n === 1 ? "1 vendido" : `${n} vendidos`),
  },
  loading: { sl: "Nalaganje tržnice …", en: "Loading the marketplace …", it: "Caricamento del mercato …", de: "Marktplatz wird geladen …", fr: "Chargement du marché …", es: "Cargando el mercado …" },
  errorTitle: { sl: "Tržnice ni bilo mogoče naložiti", en: "Could not load the marketplace", it: "Impossibile caricare il mercato", de: "Marktplatz konnte nicht geladen werden", fr: "Impossible de charger le marché", es: "No se pudo cargar el mercado" },
  errorBody: { sl: "Tržnica trenutno ni dosegljiva.", en: "The marketplace is currently unreachable.", it: "Il mercato è attualmente irraggiungibile.", de: "Der Marktplatz ist derzeit nicht erreichbar.", fr: "Le marché est actuellement inaccessible.", es: "El mercado no está disponible actualmente." },
  emptyBody: { sl: "Trenutno ni razpoložljivih izdelkov.", en: "No products are currently available.", it: "Al momento non ci sono prodotti disponibili.", de: "Derzeit sind keine Produkte verfügbar.", fr: "Aucun produit n'est actuellement disponible.", es: "Actualmente no hay productos disponibles." },
  retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
} as const;

interface CardProduct extends MarketplaceProduct {
  /** Prekrij s prevodom own police (samo za prikaz, SL je resnica). */
  overlayName: string;
  overlayDescription: string;
  image: string | null;
  destinationSlug: string | null;
}

export function OwnMarketplaceSection() {
  const l = useLocale();
  const t = <K extends keyof typeof L>(k: K) => pick(l, L[k]);

  const [products, setProducts] = React.useState<CardProduct[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<CardProduct | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/products");
      const body = (await res.json()) as
        | { products: MarketplaceProduct[] }
        | { error: string };
      if (!res.ok || !("products" in body)) {
        throw new Error("error" in body ? body.error : `HTTP ${res.status}`);
      }
      setProducts(
        body.products.map((p) => {
          const own = getOwnProduct(p.slug);
          return {
            ...p,
            overlayName: own ? pick(l, own.name) : p.name,
            overlayDescription:
              own ? pick(l, own.description) : p.description,
            image: own?.image ?? null,
            destinationSlug: own?.destinationSlug ?? null,
          };
        })
      );
    } catch {
      setLoadError(t("errorBody"));
    }
  }, [l]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onBuy = (p: CardProduct) => {
    if (p.stock < 1) return;
    setSelected(p);
    setModalOpen(true);
  };

  const onModalChange = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      // Po zaprtju osvežimo zalogo/števce (demo naročila takoj zmanjšajo).
      setSelected(null);
      void load();
    }
  };

  return (
    <section aria-labelledby="own-marketplace-title" className="mt-10">
      <React.Suspense fallback={null}>
        <PaymentReturnBanner />
      </React.Suspense>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="own-marketplace-title"
            className="text-xl font-bold tracking-tight"
          >
            {t("title")}
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {t("lead")}
          </p>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary">
          {t("liveBadge")}
        </Badge>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mt-6 flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5"
        >
          <p className="font-medium text-destructive">{t("errorTitle")}</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => void load()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("retry")}
          </Button>
        </div>
      )}

      {!loadError && products === null && (
        <ul
          className="mt-6 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label={t("loading")}
        >
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card>
                <Skeleton className="aspect-[3/2] w-full rounded-none" />
                <CardContent className="flex flex-col gap-2.5 p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-10 w-full" />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {products !== null && products.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center sm:p-10">
          <PackageOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
        </div>
      )}

      {products !== null && products.length > 0 && (
        <ul className="mt-6 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const dest = p.destinationSlug
              ? getDestination(p.destinationSlug)
              : null;
            const kindLabel = pick(
              l,
              KIND_LABELS[p.kind] ?? KIND_LABELS.experience
            );
            return (
              <li key={p.slug}>
                <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <div className="relative aspect-[3/2] bg-muted">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.overlayName}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <PackageOpen
                          className="size-8 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                    )}
                    <span className="absolute top-2.5 left-2.5">
                      <Badge variant="secondary" className="shadow-sm">
                        {kindLabel}
                      </Badge>
                    </span>
                    <span className="absolute right-2.5 bottom-2.5">
                      <Badge className="bg-primary text-primary-foreground shadow-sm">
                        {formatPriceCents(p.priceCents, l)}
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
                    <h3 className="text-base leading-tight font-bold">
                      {p.overlayName}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {p.overlayDescription}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("stock")(p.stock)}</span>
                      {p.saleCount > 0 && <span>{t("sold")(p.saleCount)}</span>}
                    </div>
                    <div className="mt-auto flex items-end gap-2 pt-1">
                      <Button
                        type="button"
                        className="h-11 flex-1"
                        onClick={() => onBuy(p)}
                        disabled={p.stock < 1}
                      >
                        <ShoppingCart className="size-4" aria-hidden="true" />
                        {p.stock < 1 ? t("soldOut") : t("buy")}
                      </Button>
                      {/* P1-C (issue #3 §4): spremljanje cene — opozorilo ob
                          padcu ≥ prag (obe ceni preverjeni iz tržnice). */}
                      <WatchPriceButton slug={p.slug} className="h-11 w-11" />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <CheckoutModal
        product={selected}
        open={modalOpen}
        onOpenChange={onModalChange}
      />
    </section>
  );
}
