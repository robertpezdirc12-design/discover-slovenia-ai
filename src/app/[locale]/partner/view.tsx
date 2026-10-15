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
import { intlDateLocale } from "@/lib/intl-locale";
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
  updatedAt: string;
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

const KIND_LABELS: Record<string, { sl: string; en?: string; it?: string; de?: string; fr?: string; es?: string }> = {
  experience: { sl: "Izkušnja", en: "Experience", it: "Esperienza", de: "Erlebnis", fr: "Expérience", es: "Experiencia" },
  ticket: { sl: "Vstopnica", en: "Ticket", it: "Biglietto", de: "Ticket", fr: "Billet", es: "Entrada" },
  product: { sl: "Izdelek", en: "Product", it: "Prodotto", de: "Produkt", fr: "Produit", es: "Producto" },
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
    kicker: { sl: "B2B tržnica · portal partnerja", en: "B2B marketplace · partner portal", it: "Marketplace B2B · portale partner", de: "B2B-Marktplatz · Partner-Portal", fr: "Marketplace B2B · portail partenaire", es: "Marketplace B2B · portal de socios" },
    title: { sl: "Moji vnosi v tržnico", en: "My marketplace listings", it: "I miei annunci nel marketplace", de: "Meine Marktplatz-Einträge", fr: "Mes annonces sur la marketplace", es: "Mis anuncios en el marketplace" },
    lead: {
      sl: "Ustvarjaj osnutke izkušenj, vstopnic in izdelkov, jih predaj v moderacijo in spremljaj prodajo ter preklice. Objava je vedno skrbniška odločitev — kakovost tržnice je skupna.",
      en: "Create drafts of experiences, tickets and products, submit them for moderation and track sales and cancellations. Publishing is always an admin decision — marketplace quality is shared.",
      it: "Crea bozze di esperienze, biglietti e prodotti, presentale per la moderazione e monitora vendite e annullamenti. La pubblicazione è sempre una decisione dell'amministrazione — la qualità del marketplace è condivisa.",
      de: "Erstelle Entwürfe für Erlebnisse, Tickets und Produkte, reiche sie zur Moderation ein und verfolge Verkäufe und Stornierungen. Das Veröffentlichen ist immer eine Admin-Entscheidung — die Qualität des Marktplatzes ist gemeinsame Sache.",
      fr: "Crée des brouillons d'expériences, de billets et de produits, soumets-les à la modération et suis les ventes et annulations. La publication est toujours une décision d'administration — la qualité de la marketplace est partagée.",
      es: "Crea borradores de experiencias, entradas y productos, preséntalos a moderación y sigue las ventas y cancelaciones. La publicación es siempre una decisión administrativa — la calidad del mercado es compartida.",
    },
    howTitle: { sl: "Kako deluje moderacija", en: "How moderation works", it: "Come funziona la moderazione", de: "Wie die Moderation funktioniert", fr: "Comment fonctionne la modération", es: "Cómo funciona la moderación" },
    howBody: {
      sl: "Osnutek predáš v pregled; skrbnik (DSA_ADMIN_EMAILS) ga objavi ali zavrne z razlogom, ki ga vidiš tukaj. Sprememba vsebine objavljenega ali predanega vnosa prestavi vnos NAZAJ v pregled — dokler ga skrbnik znova ne objavi, v tržnici ni viden. Partner nikoli ne objavi samega sebe.",
      en: "You submit a draft for review; an admin (DSA_ADMIN_EMAILS) publishes it or rejects it with a reason you see here. Editing the content of a published or pending listing moves it BACK to review — until an admin republishes it, it is not visible in the marketplace. A partner never publishes on their own.",
      it: "Presenti una bozza per la revisione; un amministratore (DSA_ADMIN_EMAILS) la pubblica oppure la rifiuta con una motivazione che vedi qui. La modifica dei contenuti di un annuncio pubblicato o in revisione riporta l'annuncio INDIETRO in revisione — finché un amministratore non lo ripubblica, non è visibile nel marketplace. Un partner non pubblica mai da solo.",
      de: "Du reichst einen Entwurf zur Prüfung ein; ein Admin (DSA_ADMIN_EMAILS) veröffentlicht ihn oder lehnt ihn mit einer Begründung ab, die du hier siehst. Die Bearbeitung des Inhalts eines veröffentlichten oder zur Prüfung vorliegenden Eintrags versetzt den Eintrag ZURÜCK in die Prüfung — bis ein Admin ihn erneut veröffentlicht, ist er im Marktplatz nicht sichtbar. Ein Partner veröffentlicht nie selbst.",
      fr: "Tu soumets un brouillon à la revue ; un admin (DSA_ADMIN_EMAILS) le publie ou le rejette avec un motif que tu vois ici. Modifier le contenu d'une annonce publiée ou en revue la renvoie EN ARRIÈRE en revue — tant qu'un admin ne la republie pas, elle n'est pas visible sur la marketplace. Un partenaire ne publie jamais seul.",
      es: "Presentas un borrador para revisión; un administrador (DSA_ADMIN_EMAILS) lo publica o lo rechaza con un motivo que ves aquí. Editar el contenido de un anuncio publicado o pendiente lo devuelve ATRÁS a revisión — hasta que un administrador lo republique, no es visible en el marketplace. Un socio nunca publica por su cuenta.",
    },
    unauthTitle: { sl: "Najprej se prijavi", en: "Sign in first", it: "Prima accedi", de: "Melde dich zuerst an", fr: "Connecte-toi d'abord", es: "Primero inicia sesión" },
    unauthBody: {
      sl: "Partnerjev portal je za registrirane račune. Prijavi se (ali ustvari račun) — vrnil se boš prav sem.",
      en: "The partner portal is for registered accounts. Sign in (or create an account) — you will return right here.",
      it: "Il portale partner è per account registrati. Accedi (o crea un account) — tornerai proprio qui.",
      de: "Das Partner-Portal ist für registrierte Konten. Melde dich an (oder erstelle ein Konto) — du kehrst genau hierher zurück.",
      fr: "Le portail partenaire est réservé aux comptes enregistrés. Connecte-toi (ou crée un compte) — tu reviendras juste ici.",
      es: "El portal de socios es para cuentas registradas. Inicia sesión (o crea una cuenta) — volverás justo aquí.",
    },
    login: { sl: "Prijava / registracija", en: "Sign in / register", it: "Accedi / registrati", de: "Anmelden / registrieren", fr: "Connexion / inscription", es: "Iniciar sesión / registrarse" },
    notPartnerTitle: { sl: "Račun še ni odobren kot partner", en: "Account not approved as partner yet", it: "Account non ancora approvato come partner", de: "Konto noch nicht als Partner freigegeben", fr: "Compte pas encore approuvé comme partenaire", es: "Cuenta aún no aprobada como socio" },
    notPartnerBody: {
      sl: "Ta portal je za partnerje. Pošlji prijavo na strani za ponudnike — skrbnik jo pregleda in po odobritvi dobi tvoj račun vlogo partnerja.",
      en: "This portal is for partners. Send an application on the providers page — an admin reviews it and your account receives the partner role upon approval.",
      it: "Questo portale è per i partner. Invia una candidatura nella pagina per i fornitori — un amministratore la esamina e, dopo l'approvazione, il tuo account riceve il ruolo di partner.",
      de: "Dieses Portal ist für Partner. Sende eine Bewerbung über die Anbieter-Seite — ein Admin prüft sie, und nach der Freigabe erhält dein Konto die Partnerrolle.",
      fr: "Ce portail est pour les partenaires. Envoie une candidature sur la page des prestataires — un admin l'examine et, après approbation, ton compte reçoit le rôle de partenaire.",
      es: "Este portal es para socios. Envía una solicitud en la página para proveedores — un administrador la revisa y, tras la aprobación, tu cuenta recibe el rol de socio.",
    },
    apply: { sl: "Prijavi se kot partner", en: "Apply as a partner", it: "Candidati come partner", de: "Als Partner bewerben", fr: "Postuler comme partenaire", es: "Solicita ser socio" },
    errTitle: { sl: "Portal trenutno ni dosegljiv", en: "The portal is unavailable", it: "Il portale non è al momento disponibile", de: "Das Portal ist derzeit nicht erreichbar", fr: "Le portail est momentanément indisponible", es: "El portal no está disponible en este momento" },
    retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
    totalsListings: { sl: "Vnosi", en: "Listings", it: "Annunci", de: "Einträge", fr: "Annonces", es: "Anuncios" },
    totalsSold: { sl: "Prodano (plačano)", en: "Sold (paid)", it: "Venduto (pagato)", de: "Verkauft (bezahlt)", fr: "Vendu (payé)", es: "Vendido (pagado)" },
    totalsCancel: { sl: "Zahtevki za preklic", en: "Cancellation requests", it: "Richieste di annullamento", de: "Stornierungsanfragen", fr: "Demandes d'annulation", es: "Solicitudes de cancelación" },
    newListing: { sl: "Nov vnos", en: "New listing", it: "Nuovo annuncio", de: "Neuer Eintrag", fr: "Nouvelle annonce", es: "Nuevo anuncio" },
    reload: { sl: "Osveži", en: "Refresh", it: "Aggiorna", de: "Aktualisieren", fr: "Actualiser", es: "Actualizar" },
    emptyTitle: { sl: "Še ni nobenega vnosa", en: "No listings yet", it: "Ancora nessun annuncio", de: "Noch keine Einträge", fr: "Aucune annonce pour l'instant", es: "Aún no hay anuncios" },
    emptyBody: {
      sl: "Ustvari prvi osnutek — izkušnjo, vstopnico ali izdelek. Po skrbniški objavi pride v javno tržnico.",
      en: "Create your first draft — an experience, ticket or product. After an admin publishes it, it enters the public marketplace.",
      it: "Crea la prima bozza — un'esperienza, un biglietto o un prodotto. Dopo la pubblicazione da parte di un amministratore entra nel marketplace pubblico.",
      de: "Erstelle den ersten Entwurf — ein Erlebnis, ein Ticket oder ein Produkt. Nach der Veröffentlichung durch einen Admin gelangt er in den öffentlichen Marktplatz.",
      fr: "Crée ton premier brouillon — une expérience, un billet ou un produit. Après publication par un admin, il entre dans la marketplace publique.",
      es: "Crea el primer borrador — una experiencia, una entrada o un producto. Tras la publicación por un administrador entra en el marketplace público.",
    },
    submit: { sl: "Predaj v pregled", en: "Submit for review", it: "Presenta per revisione", de: "Zur Prüfung einreichen", fr: "Soumettre à la revue", es: "Presentar para revisión" },
    withdraw: { sl: "Umakni", en: "Withdraw", it: "Ritira", de: "Zurückziehen", fr: "Retirer", es: "Retirar" },
    withdrawShelf: { sl: "Umakni s police", en: "Take off the shelf", it: "Togli dallo scaffale", de: "Aus dem Regal nehmen", fr: "Retirer de l'étagère", es: "Quitar del escaparate" },
    edit: { sl: "Uredi", en: "Edit", it: "Modifica", de: "Bearbeiten", fr: "Modifier", es: "Editar" },
    sold: { sl: "prodano", en: "sold", it: "venduto", de: "verkauft", fr: "vendu", es: "vendido" },
    pendingOrders: { sl: "v čakanju", en: "pending", it: "in attesa", de: "ausstehend", fr: "en attente", es: "pendientes" },
    cancellations: { sl: "preklici", en: "cancellations", it: "annullamenti", de: "Stornierungen", fr: "annulations", es: "cancelaciones" },
    reason: { sl: "Razlog zavrnitve", en: "Rejection reason", it: "Motivo del rifiuto", de: "Ablehnungsgrund", fr: "Motif du rejet", es: "Motivo del rechazo" },
    submittedAt: { sl: "Predano", en: "Submitted", it: "Presentato", de: "Eingereicht", fr: "Soumis", es: "Presentado" },
    reviewedAt: { sl: "Pregledano", en: "Reviewed", it: "Revisionato", de: "Geprüft", fr: "Révisé", es: "Revisado" },
    noGeo: { sl: "Brez geo pin-a", en: "No geo pin", it: "Senza geo pin", de: "Ohne Geo-Pin", fr: "Sans repère géo", es: "Sin pin de geo" },
    errAction: { sl: "Dejanje ni uspelo.", en: "The action failed.", it: "L'azione non è riuscita.", de: "Die Aktion ist fehlgeschlagen.", fr: "L'action a échoué.", es: "La acción falló." },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again.", it: "Errore di rete — riprova.", de: "Netzwerkfehler — versuche es erneut.", fr: "Erreur réseau — réessaie.", es: "Error de red — reintenta." },
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
                  it: "L'annuncio è in revisione. Un amministratore lo pubblicherà oppure lo rifiuterà con una motivazione.",
                  de: "Der Eintrag ist in Prüfung. Ein Admin wird ihn veröffentlichen oder mit einer Begründung ablehnen.",
                  fr: "L'annonce est en revue. Un admin la publiera ou la rejettera avec un motif.",
                  es: "El anuncio está en revisión. Un administrador lo publicará o lo rechazará con un motivo.",
                })
              : pick(l, {
                  sl: "Vnos umaknjen — v tržnici ni več viden.",
                  en: "Listing withdrawn — no longer visible in the marketplace.",
                  it: "Annuncio ritirato — non è più visibile nel marketplace.",
                  de: "Eintrag zurückgezogen — nicht mehr im Marktplatz sichtbar.",
                  fr: "Annonce retirée — plus visible sur la marketplace.",
                  es: "Anuncio retirado — ya no es visible en el marketplace.",
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
    return new Date(iso).toLocaleDateString(intlDateLocale(l), { dateStyle: "medium" });
  }

  /** Dni od ISO datuma (nudge prag: 7 — enako /api/cron/draft-reminders). */
  function daysSinceIso(iso: string): number {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return 0;
    const days = Math.floor((Date.now() - ms) / 86_400_000);
    return days > 0 ? days : 0;
  }

  // ── Nalaganje ────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">
          {pick(l, { sl: "Nalaganje portala …", en: "Loading the portal …", it: "Caricamento del portale …", de: "Portal wird geladen …", fr: "Chargement du portail …", es: "Cargando el portal …" })}
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

      <Card className="mt-8 rounded-2xl border-border/70 shadow-sm">
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
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Package className="size-3.5" aria-hidden="true" />
              {t("totalsListings")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.totals.listings}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardContent className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShoppingCart className="size-3.5" aria-hidden="true" />
              {t("totalsSold")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.totals.sold}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm">
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
        <Card className="mt-6 rounded-2xl border-border/70 shadow-sm">
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
              <Card key={row.id} className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-balance">{row.name}</h2>
                        <Badge variant="outline" className={`border ${STATUS_BADGE[row.status] ?? ""}`}>
                          {statusLabel ? pick(l, statusLabel) : row.status}
                        </Badge>
                        <Badge variant="secondary">
                          {KIND_LABELS[row.kind] ? pick(l, KIND_LABELS[row.kind]) : row.kind}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {eur(row.priceCents)} ·{" "}
                        {pick(l, { sl: `zaloga ${row.stock}`, en: `stock ${row.stock}`, it: `scorte ${row.stock}`, de: `Bestand ${row.stock}`, fr: `stock ${row.stock}`, es: `stock ${row.stock}` })}
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

                  {/* NUDGE za zamujen osnutek (P0-I /api/cron/draft-reminders):
                      iskrena opomba brez e-pošte — partner jo vidi TU, ko je
                      osnutek čakal ≥ 7 dni (isto pravilo kot cron job). */}
                  {row.status === "draft" &&
                    daysSinceIso(row.updatedAt) >= 7 && (
                      <p className="mt-2 flex items-start gap-2 rounded-md border border-amber-600/50 bg-amber-600/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                        <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {pick(l, {
                          sl: `Osnutek čaka ${daysSinceIso(row.updatedAt)} dni — predaj ga v pregled, ko bo pripravljen. Opomba je vidna samo tukaj (ne pošiljamo e-pošte).`,
                          en: `This draft has been waiting ${daysSinceIso(row.updatedAt)} days — submit it for review when ready. The reminder is visible only here (we send no e-mail).`,
                          it: `Questa bozza aspetta da ${daysSinceIso(row.updatedAt)} giorni — presentala per la revisione quando è pronta. Il promemoria è visibile solo qui (non inviamo e-mail).`,
                          de: `Dieser Entwurf wartet seit ${daysSinceIso(row.updatedAt)} Tagen — reiche ihn zur Prüfung ein, wenn er bereit ist. Der Hinweis ist nur hier sichtbar (wir senden keine E-Mail).`,
                          fr: `Ce brouillon attend depuis ${daysSinceIso(row.updatedAt)} jours — soumets-le à la revue quand il est prêt. Le rappel est visible uniquement ici (nous n'envoyons pas d'e-mail).`,
                          es: `Este borrador lleva ${daysSinceIso(row.updatedAt)} días en espera — preséntalo para revisión cuando esté listo. El recordatorio es visible solo aquí (no enviamos correo electrónico).`,
                        })}
                      </p>
                    )}

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
    newTitle: { sl: "Nov vnos (osnutek)", en: "New listing (draft)", it: "Nuovo annuncio (bozza)", de: "Neuer Eintrag (Entwurf)", fr: "Nouvelle annonce (brouillon)", es: "Nuevo anuncio (borrador)" },
    editTitle: { sl: "Uredi vnos", en: "Edit listing", it: "Modifica annuncio", de: "Eintrag bearbeiten", fr: "Modifier l'annonce", es: "Editar anuncio" },
    newDesc: {
      sl: "Osnutek se ustvari kot zaseben — v javni tržnici bo viden šele po skrbniški objavi.",
      en: "The draft is created private — it only becomes visible in the marketplace after an admin publishes it.",
      it: "La bozza viene creata come privata — sarà visibile nel marketplace solo dopo la pubblicazione da parte di un amministratore.",
      de: "Der Entwurf wird privat erstellt — er wird erst sichtbar, nachdem ein Admin ihn veröffentlicht hat.",
      fr: "Le brouillon est créé en privé — il ne devient visible sur la marketplace qu'après publication par un admin.",
      es: "El borrador se crea como privado — solo será visible en el marketplace después de que un administrador lo publique.",
    },
    editDesc: {
      sl: "Spremembe se shranijo; vnos ostane tvoj, naslov in identifikator se ohranita.",
      en: "Changes are saved; the listing stays yours, its title and identifier preserved.",
      it: "Le modifiche vengono salvate; l'annuncio resta tuo, titolo e identificatore si conservano.",
      de: "Änderungen werden gespeichert; der Eintrag bleibt deiner, Titel und Kennung bleiben erhalten.",
      fr: "Les modifications sont enregistrées ; l'annonce reste tienne, son titre et son identifiant sont préservés.",
      es: "Los cambios se guardan; el anuncio sigue siendo tuyo, su título e identificador se conservan.",
    },
    remoderation: {
      sl: "Pozor: ta vnos je trenutno viden (objavljen ali v pregledu). Vsaka vsebinska sprememba ga prestavi NAZAJ v skrbniški pregled — do ponovne objave v tržnici ne bo viden.",
      en: "Warning: this listing is currently visible (published or under review). Any content change moves it BACK to admin review — it will not be visible in the marketplace until republished.",
      it: "Attenzione: questo annuncio è attualmente visibile (pubblicato o in revisione). Qualsiasi modifica dei contenuti lo riporta INDIETRO in revisione amministrativa — non sarà visibile nel marketplace fino alla nuova pubblicazione.",
      de: "Achtung: Dieser Eintrag ist aktuell sichtbar (veröffentlicht oder in Prüfung). Jede inhaltliche Änderung versetzt ihn ZURÜCK in die Admin-Prüfung — bis zur erneuten Veröffentlichung ist er im Marktplatz nicht sichtbar.",
      fr: "Attention : cette annonce est actuellement visible (publiée ou en revue). Toute modification de contenu la renvoie EN ARRIÈRE en revue d'administration — elle ne sera pas visible sur la marketplace avant sa republication.",
      es: "Atención: este anuncio está actualmente visible (publicado o en revisión). Cualquier cambio de contenido lo devuelve ATRÁS a la revisión administrativa — no será visible en el marketplace hasta que se republique.",
    },
    name: { sl: "Ime", en: "Name", it: "Nome", de: "Name", fr: "Nom", es: "Nombre" },
    description: { sl: "Opis", en: "Description", it: "Descrizione", de: "Beschreibung", fr: "Description", es: "Descripción" },
    descriptionHint: { sl: "Med 20 in 2000 znakov.", en: "Between 20 and 2000 characters.", it: "Tra 20 e 2000 caratteri.", de: "Zwischen 20 und 2000 Zeichen.", fr: "Entre 20 et 2000 caractères.", es: "Entre 20 y 2000 caracteres." },
    price: { sl: "Cena (€)", en: "Price (€)", it: "Prezzo (€)", de: "Preis (€)", fr: "Prix (€)", es: "Precio (€)" },
    priceHint: { sl: "Med 1 € in 10.000 €.", en: "Between €1 and €10,000.", it: "Tra 1 € e 10.000 €.", de: "Zwischen 1 € und 10.000 €.", fr: "Entre 1 € et 10 000 €.", es: "Entre 1 € y 10.000 €." },
    stock: { sl: "Zaloga", en: "Stock", it: "Scorte", de: "Bestand", fr: "Stock", es: "Stock" },
    stockHint: { sl: "Celo število med 0 in 10.000.", en: "Whole number between 0 and 10,000.", it: "Numero intero tra 0 e 10.000.", de: "Ganze Zahl zwischen 0 und 10.000.", fr: "Nombre entier entre 0 et 10 000.", es: "Número entero entre 0 y 10.000." },
    kind: { sl: "Vrsta", en: "Kind", it: "Tipo", de: "Art", fr: "Type", es: "Tipo" },
    geo: { sl: "Geo pin (neobvezno)", en: "Geo pin (optional)", it: "Geo pin (facoltativo)", de: "Geo-Pin (optional)", fr: "Repère géo (facultatif)", es: "Pin de geo (opcional)" },
    geoHint: {
      sl: "Zemljepisna širina in dolžina, npr. 46.3683, 14.0944 za Bled. Veljavno znotraj Slovenije, Hrvaške, Črne gore ali Albanije; brez pin-a je vnos enako veljaven.",
      en: "Latitude and longitude, e.g. 46.3683, 14.0944 for Bled. Valid within Slovenia, Croatia, Montenegro or Albania; a listing without a pin is equally valid.",
      it: "Latitudine e longitudine, es. 46.3683, 14.0944 per Bled. Valido all'interno di Slovenia, Croazia, Montenegro o Albania; un annuncio senza pin è ugualmente valido.",
      de: "Breiten- und Längengrad, z. B. 46.3683, 14.0944 für Bled. Gültig innerhalb Sloweniens, Kroatiens, Montenegros oder Albaniens; ein Eintrag ohne Pin ist ebenso gültig.",
      fr: "Latitude et longitude, ex. 46.3683, 14.0944 pour Bled. Valide en Slovénie, Croatie, Monténégro ou Albanie ; une annonce sans repère est tout aussi valide.",
      es: "Latitud y longitud, p. ej. 46.3683, 14.0944 para Bled. Válido en Eslovenia, Croacia, Montenegro o Albania; un anuncio sin pin es igualmente válido.",
    },
    lat: { sl: "Zem. širina", en: "Latitude", it: "Lat.", de: "Breite", fr: "Latitude", es: "Latitud" },
    lng: { sl: "Zem. dolžina", en: "Longitude", it: "Long.", de: "Länge", fr: "Longitude", es: "Longitud" },
    saveNew: { sl: "Ustvari osnutek", en: "Create draft", it: "Crea bozza", de: "Entwurf erstellen", fr: "Créer le brouillon", es: "Crear borrador" },
    saveEdit: { sl: "Shrani spremembe", en: "Save changes", it: "Salva modifiche", de: "Änderungen speichern", fr: "Enregistrer les modifications", es: "Guardar cambios" },
    cancel: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Annuler", es: "Cancelar" },
    createdMsg: { sl: "Osnutek ustvarjen. Predaj ga v pregled, ko je pripravljen.", en: "Draft created. Submit it for review when it is ready.", it: "Bozza creata. Presentala per la revisione quando è pronta.", de: "Entwurf erstellt. Reiche ihn zur Prüfung ein, wenn er bereit ist.", fr: "Brouillon créé. Soumets-le à la revue quand il est prêt.", es: "Borrador creado. Preséntalo para revisión cuando esté listo." },
    savedMsg: { sl: "Spremembe shranjene.", en: "Changes saved.", it: "Modifiche salvate.", de: "Änderungen gespeichert.", fr: "Modifications enregistrées.", es: "Cambios guardados." },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again.", it: "Errore di rete — riprova.", de: "Netzwerkfehler — versuche es erneut.", fr: "Erreur réseau — réessaie.", es: "Error de red — reintenta." },
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
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        {/* POLIR11: dvh namesto vh (enako vh na namizju). */}
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
                      {KIND_LABELS[k] ? pick(l, KIND_LABELS[k]) : k}
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
