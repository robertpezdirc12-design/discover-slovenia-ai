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
const KIND_LABELS: Record<string, { sl: string; en: string }> = {
  experience: { sl: "Izkušnja", en: "Experience" },
  ticket: { sl: "Vstopnica", en: "Ticket" },
  product: { sl: "Izdelek", en: "Product" },
};

const L = {
  title: { sl: "Lastna tržnica", en: "Our own marketplace" },
  lead: {
    sl: "Izdelki in izkušnje z lastnim checkoutom: cene so izključno polje costPerPerson kanonskega nabora destinacij, zaloga je dejansko stanje. V peskovniku so omogočena demo plačila — vsako tako naročilo je izrecno označeno DEMO (brez prave bremenitve).",
    en: "Products and experiences with our own checkout: prices come exclusively from the canonical dataset's costPerPerson field, stock is the actual state. The sandbox runs demo payments — every such order is explicitly labelled DEMO (no real charge).",
  },
  liveBadge: { sl: "Živi checkout", en: "Live checkout" },
  stock: {
    sl: (n: number) =>
      `Zaloga: ${n} ${slUnit(n, "kos", "kosa", "kosi", "kosov")}`,
    en: (n: number) => (n === 1 ? "1 unit in stock" : `${n} units in stock`),
  },
  soldOut: { sl: "Razprodano", en: "Sold out" },
  buy: { sl: "Kupi", en: "Buy" },
  sold: {
    sl: (n: number) => `${n} ${slUnit(n, "prodan", "prodana", "prodani", "prodanih")}`,
    en: (n: number) => (n === 1 ? "1 sold" : `${n} sold`),
  },
  loading: { sl: "Nalaganje tržnice …", en: "Loading the marketplace …" },
  errorTitle: { sl: "Tržnice ni bilo mogoče naložiti", en: "Could not load the marketplace" },
  retry: { sl: "Poskusi znova", en: "Try again" },
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
            overlayName: l === "en" && own ? own.name.en : p.name,
            overlayDescription:
              l === "en" && own ? own.description.en : p.description,
            image: own?.image ?? null,
            destinationSlug: own?.destinationSlug ?? null,
          };
        })
      );
    } catch {
      setLoadError(
        l === "en"
          ? "The marketplace is currently unreachable."
          : "Tržnica trenutno ni dosegljiva."
      );
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
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center">
          <PackageOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            {l === "en"
              ? "No products are currently available."
              : "Trenutno ni razpoložljivih izdelkov."}
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
                <Card className="group flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="relative aspect-[3/2] bg-muted">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt={p.overlayName}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
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
                    <div className="mt-auto pt-1">
                      <Button
                        type="button"
                        className="h-11 w-full"
                        onClick={() => onBuy(p)}
                        disabled={p.stock < 1}
                      >
                        <ShoppingCart className="size-4" aria-hidden="true" />
                        {p.stock < 1 ? t("soldOut") : t("buy")}
                      </Button>
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
