"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileEdit,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingCart,
  Store,
  Undo2,
} from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { LISTING_STATUS_LABELS, LISTING_KINDS } from "@/lib/listing-moderation";

/**
 * /partner — portal partnerja B2B tržnice (P0-H, issue #1 §22).
 *
 * Partner (vloga, ki jo odobri skrbnik prek /admin) tu USTVARJA osnutke,
 * jih predaja v moderacijo in spremlja lastne vnose + statistiko naročil.
 * Statusni stroj: draft → pending → published (+ rejected); partner NIKOLI
 * ne objavi sam — objava je izključno skrbniška. Sprememba vsebine
 * objavljenega/v predaji sproži PONOVNO moderacijo (iskreno razkrito).
 *
 * Vrata so odjemalna (API 401/403) — stanja so iskreno prikazana:
 *  · 401 → najprej prijava (/prijava?next=/partner);
 *  · 403 → račun še ni odobren kot partner (povezava na prijavnico).
 */

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  kind: string;
  stock: number;
  saleCount: number;
  status: string;
  lat: number | null;
  lng: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  stats: { sold: number; pendingOrders: number; cancellations: number };
}

interface ProductsResponse {
  products: ProductRow[];
  totals: { sold: number; cancellations: number; listings: number };
}

const STATUS_BADGE: Record<string, string> = {
  draft: "border-muted-foreground/30 bg-muted text-muted-foreground",
  pending: "border-amber-600/50 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  published: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
};

const KIND_LABELS: Record<string, { sl: string; en: string }> = {
  experience: { sl: "Izkušnja", en: "Experience" },
  ticket: { sl: "Vstopnica", en: "Ticket" },
  product: { sl: "Izdelek", en: "Product" },
};

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

export default function PartnerPage() {
  const l = useLocale();
  const { toast } = useToast();

  const [phase, setPhase] = React.useState<
    "loading" | "unauth" | "notPartner" | "error" | "ready"
  >("loading");
  const [data, setData] = React.useState<ProductsResponse | null>(null);
  const [reloading, setReloading] = React.useState(false);
  const [acting, setActing] = React.useState<string | null>(null);

  // Urejevalnik (null = zaprt; {} = nov vnos)
  const [editor, setEditor] = React.useState<{ row: ProductRow | null } | null>(null);

  const L = {
    kicker: { sl: "B2B tržnica · portal partnerja", en: "B2B marketplace · partner portal" },
    title: { sl: "Moji vnosi v tržnico", en: "My marketplace listings" },
    lead: {
      sl: "Ustvarjaj osnutke izkušenj, vstopnic in izdelkov, jih predaj v moderacijo in spremljaj prodajo ter preklice. Objava je vedno skrbniška odločitev — kakovost tržnice je skupna.",
      en: "Create drafts of experiences, tickets and products, submit them for moderation and track sales and cancellations. Publishing is always an admin decision — marketplace quality is shared.",
    },
    howTitle: { sl: "Kako deluje moderacija", en: "How moderation works" },
    howBody: {
      sl: "Osnutek predáš v pregled; skrbnik (DSA_ADMIN_EMAILS) ga objavi ali zavrne z razlogom, ki ga vidiš tukaj. Sprememba vsebine objavljenega ali predanega vnosa prestavi vnos NAZAJ v pregled — dokler ga skrbnik znova ne objavi, v tržnici ni viden. Partner nikoli ne objavi samega sebe.",
      en: "You submit a draft for review; an admin (DSA_ADMIN_EMAILS) publishes it or rejects it with a reason you see here. Editing the content of a published or pending listing moves it BACK to review — until an admin republishes it, it is not visible in the marketplace. A partner never publishes on their own.",
    },
    unauthTitle: { sl: "Najprej se prijavi", en: "Sign in first" },
    unauthBody: {
      sl: "Partnerjev portal je za registrirane račune. Prijavi se (ali ustvari račun) — vrnil se boš prav sem.",
      en: "The partner portal is for registered accounts. Sign in (or create an account) — you will return right here.",
    },
    login: { sl: "Prijava / registracija", en: "Sign in / register" },
    notPartnerTitle: { sl: "Račun še ni odobren kot partner", en: "Account not approved as partner yet" },
    notPartnerBody: {
      sl: "Ta portal je za partnerje. Pošlji prijavo na strani za ponudnike — skrbnik jo pregleda in po odobritvi dobi tvoj račun vlogo partnerja.",
      en: "This portal is for partners. Send an application on the providers page — an admin reviews it and your account receives the partner role upon approval.",
    },
    apply: { sl: "Prijavi se kot partner", en: "Apply as a partner" },
    errTitle: { sl: "Portal trenutno ni dosegljiv", en: "The portal is unavailable" },
    retry: { sl: "Poskusi znova", en: "Try again" },
    totalsListings: { sl: "Vnosi", en: "Listings" },
    totalsSold: { sl: "Prodano (plačano)", en: "Sold (paid)" },
    totalsCancel: { sl: "Zahtevki za preklic", en: "Cancellation requests" },
    newListing: { sl: "Nov vnos", en: "New listing" },
    reload: { sl: "Osveži", en: "Refresh" },
    emptyTitle: { sl: "Še ni nobenega vnosa", en: "No listings yet" },
    emptyBody: {
      sl: "Ustvari prvi osnutek — izkušnjo, vstopnico ali izdelek. Po skrbniški objavi pride v javno tržnico.",
      en: "Create your first draft — an experience, ticket or product. After an admin publishes it, it enters the public marketplace.",
    },
    submit: { sl: "Predaj v pregled", en: "Submit for review" },
    withdraw: { sl: "Umakni", en: "Withdraw" },
    withdrawShelf: { sl: "Umakni s police", en: "Take off the shelf" },
    edit: { sl: "Uredi", en: "Edit" },
    sold: { sl: "prodano", en: "sold" },
    pendingOrders: { sl: "v čakanju", en: "pending" },
    cancellations: { sl: "preklici", en: "cancellations" },
    reason: { sl: "Razlog zavrnitve", en: "Rejection reason" },
    submittedAt: { sl: "Predano", en: "Submitted" },
    reviewedAt: { sl: "Pregledano", en: "Reviewed" },
    noGeo: { sl: "Brez geo pin-a", en: "No geo pin" },
    errAction: { sl: "Dejanje ni uspelo.", en: "The action failed." },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again." },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  const load = React.useCallback(async () => {
    setReloading(true);
    try {
      const res = await fetch("/api/partner/products");
      if (res.status === 401) {
        setPhase("unauth");
        return;
      }
      if (res.status === 403) {
        setPhase("notPartner");
        return;
      }
      const body = (await res.json().catch(() => null)) as ProductsResponse | null;
      if (res.ok && body) {
        setData(body);
        setPhase("ready");
      } else {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    } finally {
      setReloading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function listingAction(row: ProductRow, action: "submit" | "withdraw") {
    if (acting) return;
    setActing(row.id);
    try {
      const res = await fetch("/api/partner/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: row.id, action }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; remoderated?: boolean }
        | null;
      if (res.ok && body?.ok) {
        toast({
          title:
            action === "submit"
              ? pick(l, {
                  sl: "Vnos je v pregledu. Skrbnik ga bo objavil ali zavrnil z razlogom.",
                  en: "The listing is under review. An admin will publish it or reject it with a reason.",
                })
              : pick(l, {
                  sl: "Vnos umaknjen — v tržnici ni več viden.",
                  en: "Listing withdrawn — no longer visible in the marketplace.",
                }),
        });
        await load();
      } else {
        toast({ title: body?.error ?? t("errAction"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("errNetwork"), variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  function fmtDate(iso: string | null): string | null {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(l === "sl" ? "sl-SI" : "en-GB", { dateStyle: "medium" });
  }

  // ── Nalaganje ────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">
          {pick(l, { sl: "Nalaganje portala …", en: "Loading the portal …" })}
        </span>
      </div>
    );
  }

  // ── Brez prijave ─────────────────────────────────────────────────────────
  if (phase === "unauth") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader kicker={t("kicker")} title={t("unauthTitle")} lead={t("unauthBody")} />
        <Button asChild className="mt-6 tap-target font-semibold">
          <Link href="/prijava?next=/partner">
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t("login")}
          </Link>
        </Button>
      </div>
    );
  }

  // ── Ni (še) partner ─────────────────────────────────────────────────────
  if (phase === "notPartner") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader kicker={t("kicker")} title={t("notPartnerTitle")} lead={t("notPartnerBody")} />
        <Button asChild className="mt-6 tap-target font-semibold">
          <Link href="/za-ponudnike">
            <Store className="size-4" aria-hidden="true" />
            {t("apply")}
          </Link>
        </Button>
      </div>
    );
  }

  // ── Napaka ──────────────────────────────────────────────────────────────
  if (phase === "error" || !data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader kicker={t("kicker")} title={t("errTitle")} />
        <Button onClick={() => void load()} variant="outline" className="mt-6 tap-target font-semibold">
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  // ── Portal ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {t("howTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("howBody")}</p>
        </CardContent>
      </Card>

      {/* Statistika */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="size-3.5" aria-hidden="true" />
              {t("totalsListings")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.totals.listings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShoppingCart className="size-3.5" aria-hidden="true" />
              {t("totalsSold")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.totals.sold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Undo2 className="size-3.5" aria-hidden="true" />
              {t("totalsCancel")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.totals.cancellations}</p>
          </CardContent>
        </Card>
      </div>

      {/* Dejanja */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => setEditor({ row: null })} className="tap-target font-semibold">
          <Plus className="size-4" aria-hidden="true" />
          {t("newListing")}
        </Button>
        <Button
          onClick={() => void load()}
          variant="outline"
          disabled={reloading}
          className="tap-target font-semibold"
        >
          <RefreshCw className={reloading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          {t("reload")}
        </Button>
      </div>

      {/* Seznam vnosov */}
      {data.products.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{t("emptyTitle")}</CardTitle>
            <CardDescription>{t("emptyBody")}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {data.products.map((row) => {
            const statusLabel =
              LISTING_STATUS_LABELS[row.status as keyof typeof LISTING_STATUS_LABELS];
            return (
              <Card key={row.id} className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-balance">{row.name}</h2>
                        <Badge variant="outline" className={`border ${STATUS_BADGE[row.status] ?? ""}`}>
                          {statusLabel ? statusLabel.sl : row.status}
                        </Badge>
                        <Badge variant="secondary">
                          {KIND_LABELS[row.kind]?.[l === "sl" ? "sl" : "en"] ?? row.kind}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {eur(row.priceCents)} ·{" "}
                        {pick(l, { sl: `zaloga ${row.stock}`, en: `stock ${row.stock}` })}
                        {row.lat !== null && row.lng !== null && (
                          <>
                            {" · "}
                            <MapPin className="inline size-3" aria-hidden="true" />
                            {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                          </>
                        )}
                        {row.lat === null && row.lng === null && (
                          <>
                            {" · "}
                            {t("noGeo")}
                          </>
                        )}
                      </p>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{eur(row.priceCents)}</p>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {row.description}
                  </p>

                  {/* Statistika vnosa */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <CheckCircle2 className="mr-1 inline size-3.5" aria-hidden="true" />
                      {row.stats.sold} {t("sold")}
                    </span>
                    <span>
                      <Clock className="mr-1 inline size-3.5" aria-hidden="true" />
                      {row.stats.pendingOrders} {t("pendingOrders")}
                    </span>
                    <span>
                      <Undo2 className="mr-1 inline size-3.5" aria-hidden="true" />
                      {row.stats.cancellations} {t("cancellations")}
                    </span>
                  </div>

                  {/* Razlog zavrnitve (iskreno) */}
                  {row.status === "rejected" && row.rejectionReason && (
                    <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        {t("reason")}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {row.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* Časovni pečat */}
                  <p className="mt-3 text-xs text-muted-foreground">
                    {row.submittedAt && (
                      <>
                        {t("submittedAt")}: {fmtDate(row.submittedAt)}
                        {" · "}
                      </>
                    )}
                    {row.reviewedAt && (
                      <>
                        {t("reviewedAt")}: {fmtDate(row.reviewedAt)}
                      </>
                    )}
                  </p>

                  {/* Dejanja */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {row.status === "draft" && (
                      <Button
                        size="sm"
                        disabled={acting === row.id}
                        onClick={() => void listingAction(row, "submit")}
                        className="tap-target font-semibold"
                      >
                        {acting === row.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Send className="size-4" aria-hidden="true" />
                        )}
                        {t("submit")}
                      </Button>
                    )}
                    {row.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting === row.id}
                        onClick={() => void listingAction(row, "withdraw")}
                        className="tap-target font-semibold"
                      >
                        {acting === row.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Undo2 className="size-4" aria-hidden="true" />
                        )}
                        {t("withdraw")}
                      </Button>
                    )}
                    {row.status === "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting === row.id}
                        onClick={() => void listingAction(row, "withdraw")}
                        className="tap-target font-semibold"
                      >
                        {acting === row.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Undo2 className="size-4" aria-hidden="true" />
                        )}
                        {t("withdrawShelf")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditor({ row })}
                      className="tap-target font-semibold"
                    >
                      <FileEdit className="size-4" aria-hidden="true" />
                      {t("edit")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Urejevalnik */}
      {editor && (
        <ListingEditorDialog
          initial={editor.row}
          onClose={() => setEditor(null)}
          onSaved={(result) => {
            setEditor(null);
            toast({ title: result });
            void load();
          }}
        />
      )}
    </div>
  );
}

// ── Urejevalnik vnosa (ustvari/uredi) ───────────────────────────────────────

function ListingEditorDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: ProductRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const l = useLocale();
  const { toast } = useToast();

  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [priceEur, setPriceEur] = React.useState(
    initial ? (initial.priceCents / 100).toFixed(2) : ""
  );
  const [stock, setStock] = React.useState(initial ? String(initial.stock) : "");
  const [kind, setKind] = React.useState<string>(initial?.kind ?? "experience");
  const [lat, setLat] = React.useState(initial?.lat !== null && initial ? String(initial.lat) : "");
  const [lng, setLng] = React.useState(initial?.lng !== null && initial ? String(initial.lng) : "");
  const [saving, setSaving] = React.useState(false);

  const isEdit = Boolean(initial);
  const wasVisible = initial?.status === "published" || initial?.status === "pending";

  const L = {
    newTitle: { sl: "Nov vnos (osnutek)", en: "New listing (draft)" },
    editTitle: { sl: "Uredi vnos", en: "Edit listing" },
    newDesc: {
      sl: "Osnutek se ustvari kot zaseben — v javni tržnici bo viden šele po skrbniški objavi.",
      en: "The draft is created private — it only becomes visible in the marketplace after an admin publishes it.",
    },
    editDesc: {
      sl: "Spremembe se shranijo; vnos ostane tvoj, naslov in identifikator se ohranita.",
      en: "Changes are saved; the listing stays yours, its title and identifier preserved.",
    },
    remoderation: {
      sl: "Pozor: ta vnos je trenutno viden (objavljen ali v pregledu). Vsaka vsebinska sprememba ga prestavi NAZAJ v skrbniški pregled — do ponovne objave v tržnici ne bo viden.",
      en: "Warning: this listing is currently visible (published or under review). Any content change moves it BACK to admin review — it will not be visible in the marketplace until republished.",
    },
    name: { sl: "Ime", en: "Name" },
    description: { sl: "Opis", en: "Description" },
    descriptionHint: { sl: "Med 20 in 2000 znakov.", en: "Between 20 and 2000 characters." },
    price: { sl: "Cena (€)", en: "Price (€)" },
    priceHint: { sl: "Med 1 € in 10.000 €.", en: "Between €1 and €10,000." },
    stock: { sl: "Zaloga", en: "Stock" },
    stockHint: { sl: "Celo število med 0 in 10.000.", en: "Whole number between 0 and 10,000." },
    kind: { sl: "Vrsta", en: "Kind" },
    geo: { sl: "Geo pin (neobvezno)", en: "Geo pin (optional)" },
    geoHint: {
      sl: "Zemljepisna širina in dolžina, npr. 46.3683, 14.0944 za Bled. Veljavno znotraj Slovenije, Hrvaške, Črne gore ali Albanije; brez pin-a je vnos enako veljaven.",
      en: "Latitude and longitude, e.g. 46.3683, 14.0944 for Bled. Valid within Slovenia, Croatia, Montenegro or Albania; a listing without a pin is equally valid.",
    },
    lat: { sl: "Zem. širina", en: "Latitude" },
    lng: { sl: "Zem. dolžina", en: "Longitude" },
    saveNew: { sl: "Ustvari osnutek", en: "Create draft" },
    saveEdit: { sl: "Shrani spremembe", en: "Save changes" },
    cancel: { sl: "Prekliči", en: "Cancel" },
    createdMsg: { sl: "Osnutek ustvarjen. Predaj ga v pregled, ko je pripravljen.", en: "Draft created. Submit it for review when it is ready." },
    savedMsg: { sl: "Spremembe shranjene.", en: "Changes saved." },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again." },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const priceCents = Math.round(parseFloat(priceEur.replace(",", ".")) * 100);
    const stockNum = parseInt(stock, 10);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      priceCents,
      stock: Number.isFinite(stockNum) ? stockNum : -1,
      kind,
      lat: lat.trim() === "" ? null : parseFloat(lat.replace(",", ".")),
      lng: lng.trim() === "" ? null : parseFloat(lng.replace(",", ".")),
    };
    if (isEdit && initial) payload.productId = initial.id;

    setSaving(true);
    try {
      const res = await fetch("/api/partner/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (res.ok && body?.ok) {
        onSaved(isEdit ? t("savedMsg") : t("createdMsg"));
        return;
      }
      toast({ title: body?.error ?? t("errNetwork"), variant: "destructive" });
    } catch {
      toast({ title: t("errNetwork"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const priceNum = parseFloat(priceEur.replace(",", "."));
  const stockNum = parseInt(stock, 10);
  const valid =
    name.trim().length >= 2 &&
    description.trim().length >= 20 &&
    Number.isFinite(priceNum) &&
    priceNum >= 1 &&
    priceNum <= 10000 &&
    Number.isInteger(stockNum) &&
    stockNum >= 0 &&
    stockNum <= 10000;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("newTitle")}</DialogTitle>
          <DialogDescription>{isEdit ? t("editDesc") : t("newDesc")}</DialogDescription>
        </DialogHeader>

        {isEdit && wasVisible && (
          <div className="rounded-lg border border-amber-600/50 bg-amber-600/10 p-3">
            <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400">
              {t("remoderation")}
            </p>
          </div>
        )}

        <form onSubmit={onSave} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="listing-name">{t("name")} *</Label>
            <Input
              id="listing-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="listing-description">{t("description")} *</Label>
            <Textarea
              id="listing-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">{t("descriptionHint")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="listing-price">{t("price")} *</Label>
              <Input
                id="listing-price"
                inputMode="decimal"
                value={priceEur}
                onChange={(e) => setPriceEur(e.target.value)}
                placeholder="25.00"
                required
              />
              <p className="text-xs text-muted-foreground">{t("priceHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="listing-stock">{t("stock")} *</Label>
              <Input
                id="listing-stock"
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="10"
                required
              />
              <p className="text-xs text-muted-foreground">{t("stockHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="listing-kind">{t("kind")} *</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="listing-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LISTING_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k]?.sl ?? k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("geo")}</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder={t("lat")}
                aria-label={t("lat")}
              />
              <Input
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder={t("lng")}
                aria-label={t("lng")}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("geoHint")}</p>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="tap-target">
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !valid} className="tap-target font-semibold">
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isEdit ? t("saveEdit") : t("saveNew")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
