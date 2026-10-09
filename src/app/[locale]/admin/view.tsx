"use client";

import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  ClipboardList,
  Eye,
  Inbox,
  Loader2,
  MessageSquareText,
  Phone,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldAlert,
  Store,
  Undo2,
  UserCheck,
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { pick } from "@/lib/i18n-pick";
import { LISTING_STATUS_LABELS } from "@/lib/listing-moderation";

/**
 * /admin — skrbniški portal (P0-H, issue #1 §22/§20).
 *
 * Trije razdelki: prijave partnerjev (Lead approve → User.role "partner"),
 * moderacija vnosov (pending → published/rejected — partner NIKOLI ne objavi
 * sam) in konzultacije (ročni dopolnitve odgovorov, iskreno razkrite).
 *
 * Vrata so strežniška (isAdminSession — DSA_ADMIN_EMAILS, fail-closed):
 * brez skrbniške seje API vrne 403 in stran to ISKRENO pokaže.
 */

interface LeadRow {
  id: string;
  email: string;
  note: string | null;
  status: string;
  createdAt: string;
  account: { exists: boolean; role: string | null };
}

interface AdminListing {
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
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  owner: { email: string | null; name: string | null } | null;
  createdAt: string;
}

interface ConsultationRow {
  id: string;
  email: string;
  question: string;
  destinationName: string | null;
  travelDates: string | null;
  partyDescription: string | null;
  budget: string | null;
  interests: string[];
  answer: string | null;
  answerSource: string;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
}

const LEAD_BADGE: Record<string, string> = {
  new: "border-amber-600/50 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  contacted: "border-primary/40 bg-primary/10 text-primary",
  approved: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "border-muted-foreground/30 bg-muted text-muted-foreground",
  pending: "border-amber-600/50 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  published: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
};

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

function fmtDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(locale === "sl" ? "sl-SI" : "en-GB", {
    dateStyle: "medium",
  });
}

/** Skupni vmesnik za 403 (ne-skrbnik) — iskren, brez obljub. */
function ForbiddenCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export default function AdminPage() {
  const l = useLocale();

  const L = {
    kicker: { sl: "DSA_ADMIN_EMAILS · fail-closed", en: "DSA_ADMIN_EMAILS · fail-closed", it: "DSA_ADMIN_EMAILS · fail-closed", de: "DSA_ADMIN_EMAILS · fail-closed", fr: "DSA_ADMIN_EMAILS · fail-closed", es: "DSA_ADMIN_EMAILS · fail-closed" },
    title: { sl: "Skrbniški portal", en: "Admin portal", it: "Portale amministratore", de: "Admin-Portal", fr: "Portail admin", es: "Portal de administración" },
    lead: {
      sl: "Prijave partnerjev, moderacija vnosov tržnice in konzultacije na enem mestu. Vsaka odločitev gre v revizijski dnevnik (AuditLog).",
      en: "Partner applications, marketplace listing moderation and consultations in one place. Every decision is written to the audit log.",
      it: "Domande dei partner, moderazione degli annunci del marketplace e consulenze in un unico posto. Ogni decisione viene scritta nel registro di controllo.",
      de: "Partner-Bewerbungen, Moderation der Marktplatz-Einträge und Beratungen an einem Ort. Jede Entscheidung wird ins Audit-Log geschrieben.",
      fr: "Candidatures de partenaires, modération des annonces de la marketplace et consultations au même endroit. Chaque décision est consignée dans le journal d’audit.",
      es: "Solicitudes de socios, moderación de anuncios del mercado y consultas en un solo lugar. Cada decisión se escribe en el registro de auditoría.",
    },
    tabLeads: { sl: "Prijave", en: "Applications", it: "Domande", de: "Bewerbungen", fr: "Candidatures", es: "Solicitudes" },
    tabListings: { sl: "Moderacija", en: "Moderation", it: "Moderazione", de: "Moderation", fr: "Modération", es: "Moderación" },
    tabConsultations: { sl: "Konzultacije", en: "Consultations", it: "Consulenze", de: "Beratungen", fr: "Consultations", es: "Consultas" },
    forbiddenTitle: { sl: "Dostop samo za skrbnike", en: "Admins only", it: "Solo amministratori", de: "Nur für Admins", fr: "Administrateurs uniquement", es: "Solo administradores" },
    forbiddenBody: {
      sl: "Ta stran je za skrbnike (kanon DSA_ADMIN_EMAILS). Vrata so strežniška in fail-closed — brez skrbniške seje tu ni ničesar videti.",
      en: "This page is for admins (the DSA_ADMIN_EMAILS canon). The gate is server-side and fail-closed — without an admin session there is nothing to see here.",
      it: "Questa pagina è per gli amministratori (il canone DSA_ADMIN_EMAILS). Il controllo è lato server e fail-closed — senza una sessione da amministratore qui non c’è nulla da vedere.",
      de: "Diese Seite ist für Admins (der DSA_ADMIN_EMAILS-Kanon). Das Tor ist serverseitig und fail-closed — ohne Admin-Session gibt es hier nichts zu sehen.",
      fr: "Cette page est réservée aux administrateurs (le canon DSA_ADMIN_EMAILS). La barrière est côté serveur et fail-closed — sans session admin, il n’y a rien à voir ici.",
      es: "Esta página es para administradores (el canon DSA_ADMIN_EMAILS). La puerta es del lado del servidor y fail-closed — sin sesión de administrador aquí no hay nada que ver.",
    },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />

      <Tabs defaultValue="leads" className="mt-8">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="leads" className="gap-1.5">
            <Inbox className="size-4" aria-hidden="true" />
            {t("tabLeads")}
          </TabsTrigger>
          <TabsTrigger value="listings" className="gap-1.5">
            <ClipboardList className="size-4" aria-hidden="true" />
            {t("tabListings")}
          </TabsTrigger>
          <TabsTrigger value="consultations" className="gap-1.5">
            <MessageSquareText className="size-4" aria-hidden="true" />
            {t("tabConsultations")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="leads" className="mt-6">
          <LeadsPanel />
        </TabsContent>
        <TabsContent value="listings" className="mt-6">
          <ListingsPanel />
        </TabsContent>
        <TabsContent value="consultations" className="mt-6">
          <ConsultationsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── PRIJAVE PARTNERJEV ──────────────────────────────────────────────────────

function LeadsPanel() {
  const l = useLocale();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<"loading" | "forbidden" | "error" | "ready">("loading");
  const [leads, setLeads] = React.useState<LeadRow[]>([]);
  const [acting, setActing] = React.useState<string | null>(null);

  const L = {
    empty: { sl: "Ni novih prijav partnerjev.", en: "No new partner applications.", it: "Nessuna nuova domanda di partner.", de: "Keine neuen Partner-Bewerbungen.", fr: "Aucune nouvelle candidature de partenaire.", es: "Ninguna solicitud nueva de socio." },
    approve: { sl: "Odobri", en: "Approve", it: "Approva", de: "Genehmigen", fr: "Approuver", es: "Aprobar" },
    reject: { sl: "Zavrni", en: "Reject", it: "Rifiuta", de: "Ablehnen", fr: "Rejeter", es: "Rechazar" },
    contacted: { sl: "Označi kontaktiranega", en: "Mark contacted", it: "Segna come contattato", de: "Als kontaktiert markieren", fr: "Marquer comme contacté", es: "Marcar como contactado" },
    account: { sl: "račun obstaja", en: "account exists", it: "account esistente", de: "Konto vorhanden", fr: "compte existant", es: "cuenta existente" },
    noAccount: { sl: "brez računa", en: "no account", it: "senza account", de: "ohne Konto", fr: "sans compte", es: "sin cuenta" },
    role: { sl: "vloga", en: "role", it: "ruolo", de: "Rolle", fr: "rôle", es: "rol" },
    note: { sl: "Sporočilo partnerja", en: "Partner's message", it: "Messaggio del partner", de: "Nachricht des Partners", fr: "Message du partenaire", es: "Mensaje del socio" },
    approvedMsg: { sl: "Prijava odobrena — račun ima zdaj vlogo partnerja.", en: "Application approved — the account now has the partner role.", it: "Domanda approvata — l’account ora ha il ruolo di partner.", de: "Bewerbung genehmigt — das Konto hat jetzt die Partner-Rolle.", fr: "Candidature approuvée — le compte a désormais le rôle de partenaire.", es: "Solicitud aprobada — la cuenta ya tiene el rol de socio." },
    rejectedMsg: { sl: "Prijava zavrnjena.", en: "Application rejected.", it: "Domanda rifiutata.", de: "Bewerbung abgelehnt.", fr: "Candidature rejetée.", es: "Solicitud rechazada." },
    contactedMsg: { sl: "Označeno kot kontaktirano.", en: "Marked as contacted.", it: "Segnato come contattato.", de: "Als kontaktiert markiert.", fr: "Marqué comme contacté.", es: "Marcado como contactado." },
    err: { sl: "Dejanje ni uspelo.", en: "The action failed.", it: "L’azione non è riuscita.", de: "Die Aktion ist fehlgeschlagen.", fr: "L’action a échoué.", es: "La acción falló." },
    retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  const load = React.useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/admin/leads");
      if (res.status === 403) {
        setPhase("forbidden");
        return;
      }
      const body = (await res.json().catch(() => null)) as { leads?: LeadRow[] } | null;
      if (res.ok && body?.leads) {
        setLeads(body.leads);
        setPhase("ready");
      } else {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function act(lead: LeadRow, action: "approve" | "reject" | "contacted") {
    if (acting) return;
    setActing(lead.id);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, action }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        toast({
          title:
            action === "approve"
              ? t("approvedMsg")
              : action === "reject"
                ? t("rejectedMsg")
                : t("contactedMsg"),
        });
        await load();
      } else {
        toast({ title: body?.error ?? t("err"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("err"), variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  if (phase === "loading") {
    return <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />;
  }
  if (phase === "forbidden") {
    return (
      <ForbiddenCard
        title={pick(l, { sl: "Dostop samo za skrbnike", en: "Admins only", it: "Solo amministratori", de: "Nur für Admins", fr: "Administrateurs uniquement", es: "Solo administradores" })}
        body={pick(l, {
          sl: "Seznam prijav je na voljo samo skrbnikom (DSA_ADMIN_EMAILS).",
          en: "The applications list is available to admins only (DSA_ADMIN_EMAILS).",
          it: "L’elenco delle domande è disponibile solo per gli amministratori (DSA_ADMIN_EMAILS).",
          de: "Die Liste der Bewerbungen ist nur für Admins verfügbar (DSA_ADMIN_EMAILS).",
          fr: "La liste des candidatures est réservée aux administrateurs (DSA_ADMIN_EMAILS).",
          es: "La lista de solicitudes está disponible solo para administradores (DSA_ADMIN_EMAILS).",
        })}
      />
    );
  }
  if (phase === "error") {
    return (
      <Button onClick={() => void load()} variant="outline" className="tap-target font-semibold">
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("retry")}
      </Button>
    );
  }

  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      {leads.map((lead) => (
        <Card key={lead.id}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{lead.email}</span>
                  <Badge variant="outline" className={`border ${LEAD_BADGE[lead.status] ?? ""}`}>
                    {lead.status}
                  </Badge>
                  {lead.account.exists ? (
                    <Badge variant="secondary" className="gap-1">
                      <UserCheck className="size-3" aria-hidden="true" />
                      {t("account")} · {t("role")}: {lead.account.role ?? "—"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{t("noAccount")}</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtDate(lead.createdAt, l)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={acting === lead.id || lead.status === "approved"}
                  onClick={() => void act(lead, "approve")}
                  className="tap-target font-semibold"
                >
                  {acting === lead.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <BadgeCheck className="size-4" aria-hidden="true" />
                  )}
                  {t("approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting === lead.id || lead.status === "contacted"}
                  onClick={() => void act(lead, "contacted")}
                  className="tap-target font-semibold"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  {t("contacted")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting === lead.id || lead.status === "rejected"}
                  onClick={() => void act(lead, "reject")}
                  className="tap-target font-semibold text-destructive hover:text-destructive"
                >
                  <Ban className="size-4" aria-hidden="true" />
                  {t("reject")}
                </Button>
              </div>
            </div>
            {lead.note && (
              <div className="mt-3 rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-semibold text-muted-foreground">{t("note")}</p>
                <p className="mt-1 text-sm leading-relaxed">{lead.note}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── MODERACIJA VNOSOV ───────────────────────────────────────────────────────

function ListingsPanel() {
  const l = useLocale();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<"loading" | "forbidden" | "error" | "ready">("loading");
  const [status, setStatus] = React.useState<string>("pending");
  const [listings, setListings] = React.useState<AdminListing[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [acting, setActing] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState<AdminListing | null>(null);
  const [reason, setReason] = React.useState("");

  const L = {
    empty: { sl: "V tej vrsti ni vnosov.", en: "No listings in this queue.", it: "Nessun annuncio in questa coda.", de: "Keine Einträge in dieser Warteschlange.", fr: "Aucune annonce dans cette file.", es: "Ningún anuncio en esta cola." },
    platform: { sl: "platforma (uredniški vnos)", en: "platform (editorial)", it: "piattaforma (editoriale)", de: "Plattform (redaktionell)", fr: "plateforme (éditorial)", es: "plataforma (editorial)" },
    owner: { sl: "partner", en: "partner", it: "partner", de: "Partner", fr: "partenaire", es: "socio" },
    publish: { sl: "Objavi", en: "Publish", it: "Pubblica", de: "Veröffentlichen", fr: "Publier", es: "Publicar" },
    reject: { sl: "Zavrni z razlogom", en: "Reject with reason", it: "Rifiuta con motivazione", de: "Mit Begründung ablehnen", fr: "Rejeter avec un motif", es: "Rechazar con motivo" },
    unpublish: { sl: "Umakni s police", en: "Unpublish", it: "Togli dalla vetrina", de: "Aus dem Regal nehmen", fr: "Retirer de la vitrine", es: "Quitar del escaparate" },
    rejectTitle: { sl: "Zavrnitev vnosa", en: "Reject listing", it: "Rifiuta l’annuncio", de: "Eintrag ablehnen", fr: "Rejeter l’annonce", es: "Rechazar anuncio" },
    rejectDesc: {
      sl: "Razlog je obvezen in viden partnerju na njegovem portalu — iskrena zavrnitev, brez tihe odločitve.",
      en: "The reason is required and visible to the partner on their portal — an honest rejection, never silent.",
      it: "La motivazione è obbligatoria e visibile al partner sul suo portale — un rifiuto onesto, mai silenzioso.",
      de: "Die Begründung ist Pflicht und für den Partner in seinem Portal sichtbar — eine ehrliche Ablehnung, nie still.",
      fr: "Le motif est obligatoire et visible par le partenaire sur son portail — un rejet honnête, jamais silencieux.",
      es: "El motivo es obligatorio y visible para el socio en su portal — un rechazo honesto, nunca silencioso.",
    },
    reason: { sl: "Razlog", en: "Reason", it: "Motivazione", de: "Begründung", fr: "Motif", es: "Motivo" },
    cancel: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Annuler", es: "Cancelar" },
    confirmReject: { sl: "Zavrni vnos", en: "Reject listing", it: "Rifiuta l’annuncio", de: "Eintrag ablehnen", fr: "Rejeter l’annonce", es: "Rechazar el anuncio" },
    publishedMsg: { sl: "Vnos objavljen — viden v javni tržnici.", en: "Listing published — visible in the public marketplace.", it: "Annuncio pubblicato — visibile nel marketplace pubblico.", de: "Eintrag veröffentlicht — im öffentlichen Marktplatz sichtbar.", fr: "Annonce publiée — visible dans la marketplace publique.", es: "Anuncio publicado — visible en el mercado público." },
    rejectedMsg: { sl: "Vnos zavrnjen z razlogom.", en: "Listing rejected with a reason.", it: "Annuncio rifiutato con motivazione.", de: "Eintrag mit Begründung abgelehnt.", fr: "Annonce rejetée avec un motif.", es: "Anuncio rechazado con motivo." },
    unpublishedMsg: { sl: "Vnos umaknjen s police (nazaj v osnutek).", en: "Listing taken off the shelf (back to draft).", it: "Annuncio tolto dalla vetrina (torna a bozza).", de: "Eintrag aus dem Regal genommen (zurück zum Entwurf).", fr: "Annonce retirée de la vitrine (retour au brouillon).", es: "Anuncio quitado del escaparate (de vuelta a borrador)." },
    err: { sl: "Dejanje ni uspelo.", en: "The action failed.", it: "L’azione non è riuscita.", de: "Die Aktion ist fehlgeschlagen.", fr: "L’action a échoué.", es: "La acción falló." },
    retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
    soldCount: { sl: "prodano", en: "sold", it: "venduti", de: "verkauft", fr: "vendus", es: "vendidos" },
    reviewedBy: { sl: "pregledal", en: "reviewed by", it: "revisionato da", de: "geprüft von", fr: "vérifié par", es: "revisado por" },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  const load = React.useCallback(
    async (wantStatus: string) => {
      setPhase("loading");
      try {
        const res = await fetch(`/api/admin/listings?status=${encodeURIComponent(wantStatus)}`);
        if (res.status === 403) {
          setPhase("forbidden");
          return;
        }
        const body = (await res.json().catch(() => null)) as
          | { listings?: AdminListing[]; counts?: Record<string, number> }
          | null;
        if (res.ok && body?.listings) {
          setListings(body.listings);
          if (body.counts) setCounts(body.counts);
          setPhase("ready");
        } else {
          setPhase("error");
        }
      } catch {
        setPhase("error");
      }
    },
    []
  );

  React.useEffect(() => {
    void load(status);
  }, [load, status]);

  async function act(listing: AdminListing, action: "publish" | "unpublish") {
    if (acting) return;
    setActing(listing.id);
    try {
      const res = await fetch("/api/admin/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: listing.id, action }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        toast({
          title: action === "publish" ? t("publishedMsg") : t("unpublishedMsg"),
        });
        await load(status);
      } else {
        toast({ title: body?.error ?? t("err"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("err"), variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  async function confirmReject() {
    if (!rejecting || !reason.trim()) return;
    const target = rejecting;
    setRejecting(null);
    if (acting) return;
    setActing(target.id);
    try {
      const res = await fetch("/api/admin/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: target.id,
          action: "reject",
          reason: reason.trim(),
        }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        toast({ title: t("rejectedMsg") });
        setReason("");
        await load(status);
      } else {
        toast({ title: body?.error ?? t("err"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("err"), variant: "destructive" });
    } finally {
      setActing(null);
    }
  }

  if (phase === "loading" && listings.length === 0) {
    return <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />;
  }
  if (phase === "forbidden") {
    return (
      <ForbiddenCard
        title={pick(l, { sl: "Dostop samo za skrbnike", en: "Admins only", it: "Solo amministratori", de: "Nur für Admins", fr: "Administrateurs uniquement", es: "Solo administradores" })}
        body={pick(l, {
          sl: "Moderacijska vrsta je na voljo samo skrbnikom (DSA_ADMIN_EMAILS).",
          en: "The moderation queue is available to admins only (DSA_ADMIN_EMAILS).",
          it: "La coda di moderazione è disponibile solo per gli amministratori (DSA_ADMIN_EMAILS).",
          de: "Die Moderations-Warteschlange ist nur für Admins verfügbar (DSA_ADMIN_EMAILS).",
          fr: "La file de modération est réservée aux administrateurs (DSA_ADMIN_EMAILS).",
          es: "La cola de moderación está disponible solo para administradores (DSA_ADMIN_EMAILS).",
        })}
      />
    );
  }
  if (phase === "error") {
    return (
      <Button
        onClick={() => void load(status)}
        variant="outline"
        className="tap-target font-semibold"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("retry")}
      </Button>
    );
  }

  return (
    <div>
      {/* Filtriranje po statusu */}
      <div className="flex flex-wrap gap-2">
        {(["pending", "published", "draft", "rejected"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors tap-target " +
              (status === s
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted")
            }
          >
            {LISTING_STATUS_LABELS[s].sl}
            {counts[s] !== undefined && (
              <span className="ml-1.5 tabular-nums opacity-70">{counts[s]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          listings.map((li) => (
            <Card key={li.id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-balance">{li.name}</h3>
                      <Badge variant="outline" className={`border ${STATUS_BADGE[li.status] ?? ""}`}>
                        {LISTING_STATUS_LABELS[li.status as keyof typeof LISTING_STATUS_LABELS]?.sl ??
                          li.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {eur(li.priceCents)} · {t("soldCount")}: {li.saleCount} ·{" "}
                      {li.owner?.email ? (
                        <>
                          {t("owner")}: <span className="font-medium">{li.owner.email}</span>
                        </>
                      ) : (
                        t("platform")
                      )}
                    </p>
                    {li.submittedAt && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDate(li.submittedAt, l)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {li.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={acting === li.id}
                          onClick={() => void act(li, "publish")}
                          className="tap-target font-semibold"
                        >
                          {acting === li.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                          )}
                          {t("publish")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acting === li.id}
                          onClick={() => {
                            setRejecting(li);
                            setReason("");
                          }}
                          className="tap-target font-semibold text-destructive hover:text-destructive"
                        >
                          <Ban className="size-4" aria-hidden="true" />
                          {t("reject")}
                        </Button>
                      </>
                    )}
                    {li.status === "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={acting === li.id}
                        onClick={() => void act(li, "unpublish")}
                        className="tap-target font-semibold"
                      >
                        {acting === li.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Undo2 className="size-4" aria-hidden="true" />
                        )}
                        {t("unpublish")}
                      </Button>
                    )}
                  </div>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {li.description}
                </p>

                {li.status === "rejected" && li.rejectionReason && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("reviewedBy")} {li.reviewedBy ?? "—"}: “{li.rejectionReason}”
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Zavrnitev z razlogom */}
      {rejecting && (
        <Dialog open onOpenChange={(open) => !open && setRejecting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("rejectTitle")}: {rejecting.name}</DialogTitle>
              <DialogDescription>{t("rejectDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reject-reason">{t("reason")} *</Label>
              <Textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={4}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRejecting(null)} className="tap-target">
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={!reason.trim()}
                onClick={() => void confirmReject()}
                className="tap-target font-semibold"
              >
                <Ban className="size-4" aria-hidden="true" />
                {t("confirmReject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── KONZULTACIJE ────────────────────────────────────────────────────────────

function ConsultationsPanel() {
  const l = useLocale();
  const { toast } = useToast();
  const [phase, setPhase] = React.useState<"loading" | "forbidden" | "error" | "ready">("loading");
  const [rows, setRows] = React.useState<ConsultationRow[]>([]);
  const [answering, setAnswering] = React.useState<ConsultationRow | null>(null);
  const [answer, setAnswer] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const L = {
    empty: { sl: "Še ni konzultacij.", en: "No consultations yet.", it: "Ancora nessuna consulenza.", de: "Noch keine Beratungen.", fr: "Pas encore de consultations.", es: "Aún no hay consultas." },
    answer: { sl: "Dopolni odgovor", en: "Enrich the answer", it: "Arricchisci la risposta", de: "Antwort anreichern", fr: "Enrichir la réponse", es: "Enriquecer la respuesta" },
    answerTitle: { sl: "Ročni odgovor skrbnika", en: "Admin's manual answer", it: "Risposta manuale dell’amministratore", de: "Manuelle Admin-Antwort", fr: "Réponse manuelle de l’administrateur", es: "Respuesta manual del administrador" },
    answerDesc: {
      sl: "Odgovor zamenja samodejni del na zasebni strani vpraševalca; vir se iskreno spremeni v „dopolnil skrbnik“. E-pošta vpraševalca je vidna samo tebi.",
      en: "The answer replaces the automatic part on the asker's private page; the source is honestly changed to “enriched by an admin”. The asker's email is visible only to you.",
      it: "La risposta sostituisce la parte automatica sulla pagina privata di chi ha chiesto; la fonte cambia onestamente in «arricchita da un amministratore». L’e-mail di chi ha chiesto è visibile solo a te.",
      de: "Die Antwort ersetzt den automatischen Teil auf der privaten Seite des Fragestellers; die Quelle wird ehrlich zu „von einem Admin angereichert“ geändert. Die E-Mail des Fragestellers ist nur für dich sichtbar.",
      fr: "La réponse remplace la partie automatique sur la page privée du demandeur ; la source est honnêtement changée en « enrichie par un administrateur ». L’e-mail du demandeur n’est visible que par toi.",
      es: "La respuesta sustituye la parte automática en la página privada del consultante; la fuente cambia honestamente a «enriquecida por un administrador». El correo del consultante es visible solo para ti.",
    },
    answerPh: {
      sl: "Napiši osebni vpogled lokalca (20–8000 znakov) …",
      en: "Write a local's personal insight (20–8000 characters) …",
      it: "Scrivi l’intuizione personale di un locale (20–8000 caratteri) …",
      de: "Schreibe die persönliche Einsicht eines Einheimischen (20–8000 Zeichen) …",
      fr: "Écris le regard personnel d’un local (20–8000 caractères) …",
      es: "Escribe la visión personal de un local (20–8000 caracteres) …",
    },
    cancel: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Annuler", es: "Cancelar" },
    save: { sl: "Shrani odgovor", en: "Save answer", it: "Salva la risposta", de: "Antwort speichern", fr: "Enregistrer la réponse", es: "Guardar la respuesta" },
    savedMsg: { sl: "Odgovor shranjen — vir: dopolnil skrbnik.", en: "Answer saved — source: enriched by an admin.", it: "Risposta salvata — fonte: arricchita da un amministratore.", de: "Antwort gespeichert — Quelle: von einem Admin angereichert.", fr: "Réponse enregistrée — source : enrichie par un administrateur.", es: "Respuesta guardada — fuente: enriquecida por un administrador." },
    auto: { sl: "samodejno", en: "automatic", it: "automatica", de: "automatisch", fr: "automatique", es: "automática" },
    manual: { sl: "dopolnil skrbnik", en: "enriched by admin", it: "arricchita da un amministratore", de: "von einem Admin angereichert", fr: "enrichie par un administrateur", es: "enriquecida por un administrador" },
    err: { sl: "Shranjevanje ni uspelo.", en: "Saving failed.", it: "Salvataggio non riuscito.", de: "Speichern fehlgeschlagen.", fr: "Échec de l’enregistrement.", es: "Error al guardar." },
    retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  const load = React.useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/admin/consultations");
      if (res.status === 403) {
        setPhase("forbidden");
        return;
      }
      const body = (await res.json().catch(() => null)) as
        | { consultations?: ConsultationRow[] }
        | null;
      if (res.ok && body?.consultations) {
        setRows(body.consultations);
        setPhase("ready");
      } else {
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function saveAnswer() {
    if (!answering || !answer.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId: answering.id, answer: answer.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) {
        toast({ title: t("savedMsg") });
        setAnswering(null);
        setAnswer("");
        await load();
      } else {
        toast({ title: body?.error ?? t("err"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("err"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (phase === "loading") {
    return <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />;
  }
  if (phase === "forbidden") {
    return (
      <ForbiddenCard
        title={pick(l, { sl: "Dostop samo za skrbnike", en: "Admins only", it: "Solo amministratori", de: "Nur für Admins", fr: "Administrateurs uniquement", es: "Solo administradores" })}
        body={pick(l, {
          sl: "Konzultacije so na voljo samo skrbnikom (DSA_ADMIN_EMAILS).",
          en: "Consultations are available to admins only (DSA_ADMIN_EMAILS).",
          it: "Le consulenze sono disponibili solo per gli amministratori (DSA_ADMIN_EMAILS).",
          de: "Beratungen sind nur für Admins verfügbar (DSA_ADMIN_EMAILS).",
          fr: "Les consultations sont réservées aux administrateurs (DSA_ADMIN_EMAILS).",
          es: "Las consultas están disponibles solo para administradores (DSA_ADMIN_EMAILS).",
        })}
      />
    );
  }
  if (phase === "error") {
    return (
      <Button onClick={() => void load()} variant="outline" className="tap-target font-semibold">
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("retry")}
      </Button>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{c.email}</span>
                  <Badge
                    variant="outline"
                    className={
                      c.answerSource === "manual"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : ""
                    }
                  >
                    {c.answerSource === "manual" ? (
                      <>
                        <BadgeCheck className="size-3" aria-hidden="true" />
                        {t("manual")}
                      </>
                    ) : (
                      <>
                        <SearchCheck className="size-3" aria-hidden="true" />
                        {t("auto")}
                      </>
                    )}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(c.createdAt, l)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAnswering(c);
                  setAnswer(c.answer ?? "");
                }}
                className="tap-target font-semibold"
              >
                <Eye className="size-4" aria-hidden="true" />
                {t("answer")}
              </Button>
            </div>

            <p className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
              {c.question}
            </p>
            {c.destinationName && (
              <p className="mt-2 text-xs text-muted-foreground">
                <Store className="mr-1 inline size-3" aria-hidden="true" />
                {c.destinationName}
                {c.travelDates ? ` · ${c.travelDates}` : ""}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Urejevalnik odgovora */}
      {answering && (
        <Dialog open onOpenChange={(open) => !open && setAnswering(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("answerTitle")}</DialogTitle>
              <DialogDescription>{t("answerDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <p className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
                {answering.question}
              </p>
              <Label htmlFor="consultation-answer">{t("answer")} *</Label>
              <Textarea
                id="consultation-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value.slice(0, 8000))}
                placeholder={t("answerPh")}
                rows={10}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAnswering(null)} className="tap-target">
                {t("cancel")}
              </Button>
              <Button
                disabled={sending || answer.trim().length < 20}
                onClick={() => void saveAnswer()}
                className="tap-target font-semibold"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {t("save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
