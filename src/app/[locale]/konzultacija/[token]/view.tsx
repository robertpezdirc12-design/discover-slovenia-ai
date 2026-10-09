"use client";

import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  HelpCircle,
  Link2,
  Lock,
  MapPin,
  MessageCircleQuestion,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link as I18nLink } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  CONSULTATION_BUDGET_LABELS,
  CONSULTATION_INTEREST_LABELS,
  type ConsultationBudget,
  type ConsultationInterest,
} from "@/lib/consultation-options";

/**
 * /konzultacija/[token] — ZASEBNA stran odgovora (P0-H, issue #1 §20).
 *
 * Lastnik povezave = poznalec žetona (isti kanon kot /pot/[shareId]).
 * Odgovor je samodejni deterministični vodnik (answerSource "fallback")
 * ali skrbniško dopolnjen ("manual") — razlika je ISKRENO razkrita.
 * E-pošta pošiljatelja se nikjer ne prikaže.
 */

interface ConsultationView {
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

/** Vrstica odgovora: povezave ("/api/affiliate/go?…" in "/destinacija/…") so klikljive. */
function AnswerLine({ line }: { line: string }) {
  const linkMatch = line.match(/^(.*?):\s*(\/(?:api|destinacija)\/\S+)$/);
  if (linkMatch) {
    const [, label, href] = linkMatch;
    if (href.startsWith("/api/affiliate/go")) {
      return (
        <span>
          {label}:{" "}
          <a
            href={href}
            rel="nofollow sponsored noopener"
            className="break-all font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {href}
          </a>
        </span>
      );
    }
    return (
      <span>
        {label}:{" "}
        <Link
          href={href}
          className="break-all font-medium text-primary underline underline-offset-2 hover:opacity-80"
        >
          {href}
        </Link>
      </span>
    );
  }
  if (/^\/(?:api|destinacija)\//.test(line.trim())) {
    return (
      <Link
        href={line.trim()}
        className="break-all font-medium text-primary underline underline-offset-2 hover:opacity-80"
      >
        {line.trim()}
      </Link>
    );
  }
  return <>{line}</>;
}

export default function KonzultacijaTokenPage() {
  const l = useLocale();
  const params = useParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const [state, setState] = React.useState<
    | { phase: "loading" }
    | { phase: "missing" }
    | { phase: "error" }
    | { phase: "ready"; data: ConsultationView }
  >({ phase: "loading" });

  React.useEffect(() => {
    if (!token) {
      setState({ phase: "missing" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/consultation/${encodeURIComponent(token)}`);
        if (res.status === 404) {
          if (!cancelled) setState({ phase: "missing" });
          return;
        }
        const body = (await res.json().catch(() => null)) as
          | { consultation?: ConsultationView }
          | null;
        if (res.ok && body?.consultation && !cancelled) {
          setState({ phase: "ready", data: body.consultation });
        } else if (!cancelled) {
          setState({ phase: "error" });
        }
      } catch {
        if (!cancelled) setState({ phase: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const L = {
    kicker: { sl: "Zasebna povezava", en: "Private link", it: "Link privato", de: "Privater Link", fr: "Lien privé", es: "Enlace privado" },
    title: { sl: "Tvoj osebni vodnik", en: "Your personal guide", it: "La tua guida personale", de: "Deine persönliche Anleitung", fr: "Ton guide personnel", es: "Tu guía personal" },
    lead: {
      sl: "Odgovor na tvoje vprašanje iz konzultacije »Vprašaj lokalca«. Povezavo imaš samo ti — e-pošta pošiljatelja ni javna.",
      en: "The answer to your “Ask a local” consultation. Only you hold this link — the sender's email is not public.",
      it: "La risposta alla tua consulenza «Chiedi a un locale». Solo tu possiedi questo link — l’e-mail del mittente non è pubblica.",
      de: "Die Antwort auf deine „Frag einen Einheimischen“-Beratung. Nur du besitzt diesen Link — die E-Mail des Absenders ist nicht öffentlich.",
      fr: "La réponse à ta consultation « Demande à un local ». Toi seul détiens ce lien — l’e-mail de l’expéditeur n’est pas publique.",
      es: "La respuesta a tu consulta «Pregunta a un local». Solo tú tienes este enlace — el correo del remitente no es público.",
    },
    missingTitle: { sl: "Ta povezava ne obstaja", en: "This link does not exist", it: "Questo link non esiste", de: "Dieser Link existiert nicht", fr: "Ce lien n’existe pas", es: "Este enlace no existe" },
    missingBody: {
      sl: "Povezava je neveljavna ali pa je bila umaknjena. Preveri, ali si kopiral celoten naslov — ali zastavi novo vprašanje.",
      en: "The link is invalid or has been removed. Check that you copied the whole address — or ask a new question.",
      it: "Il link non è valido oppure è stato rimosso. Controlla di aver copiato l’indirizzo completo — oppure fai una nuova domanda.",
      de: "Der Link ist ungültig oder wurde entfernt. Prüfe, ob du die ganze Adresse kopiert hast — oder stell eine neue Frage.",
      fr: "Le lien est invalide ou a été supprimé. Vérifie que tu as copié l’adresse entière — ou pose une nouvelle question.",
      es: "El enlace no es válido o fue eliminado. Comprueba que copiaste la dirección completa — o haz una nueva pregunta.",
    },
    errorTitle: { sl: "Stran trenutno ni dosegljiva", en: "The page is unavailable", it: "La pagina non è al momento disponibile", de: "Die Seite ist derzeit nicht erreichbar", fr: "La page est actuellement indisponible", es: "La página no está disponible actualmente" },
    errorBody: {
      sl: "Nekaj je šlo narobe pri nalaganju odgovora. Poskusi osvežiti stran.",
      en: "Something went wrong while loading the answer. Try refreshing the page.",
      it: "Qualcosa è andato storto nel caricare la risposta. Prova ad aggiornare la pagina.",
      de: "Beim Laden der Antwort ist etwas schiefgegangen. Versuche, die Seite neu zu laden.",
      fr: "Une erreur est survenue en chargeant la réponse. Essaie d’actualiser la page.",
      es: "Algo salió mal al cargar la respuesta. Prueba a recargar la página.",
    },
    back: { sl: "Zastavi novo vprašanje", en: "Ask a new question", it: "Fai una nuova domanda", de: "Stell eine neue Frage", fr: "Pose une nouvelle question", es: "Haz una nueva pregunta" },
    yourQuestion: { sl: "Tvoje vprašanje", en: "Your question", it: "La tua domanda", de: "Deine Frage", fr: "Ta question", es: "Tu pregunta" },
    context: { sl: "Kontekst vprašanja", en: "Question context", it: "Contesto della domanda", de: "Kontext der Frage", fr: "Contexte de la question", es: "Contexto de la pregunta" },
    answer: { sl: "Odgovor", en: "Answer", it: "Risposta", de: "Antwort", fr: "Réponse", es: "Respuesta" },
    auto: { sl: "Samodejni vodnik", en: "Automatic guide", it: "Guida automatica", de: "Automatische Anleitung", fr: "Guide automatique", es: "Guía automática" },
    manual: { sl: "Dopolnil skrbnik", en: "Enriched by an admin", it: "Arricchita da un amministratore", de: "Von einem Admin angereichert", fr: "Enrichi par un administrateur", es: "Enriquecida por un administrador" },
    autoNote: {
      sl: "Ta odgovor je samodejno sestavljen iz uradnega registra destinacij in vodenih povezav partnerjev — brez AI, deterministično (isti vnos → isti odgovor). Skrbnik ga lahko ročno dopolni; to stran lahko kasneje znova obiščeš.",
      en: "This answer was automatically assembled from the official destination registry and guided partner links — no AI, deterministic (same input → same answer). An admin may enrich it manually; feel free to revisit this page later.",
      it: "Questa risposta è stata assemblata automaticamente dal registro ufficiale delle destinazioni e da link partner guidati — niente IA, deterministica (stesso input → stessa risposta). Un amministratore può arricchirla manualmente; torna pure a visitare questa pagina più tardi.",
      de: "Diese Antwort wurde automatisch aus dem offiziellen Ziel-Register und geführten Partner-Links zusammengesetzt — keine KI, deterministisch (gleiche Eingabe → gleiche Antwort). Ein Admin kann sie manuell anreichern; besuche diese Seite gern später erneut.",
      fr: "Cette réponse a été assemblée automatiquement à partir du registre officiel des destinations et de liens partenaires guidés — pas d’IA, déterministe (même entrée → même réponse). Un administrateur peut l’enrichir manuellement ; reviens volontiers sur cette page plus tard.",
      es: "Esta respuesta se ensambló automáticamente a partir del registro oficial de destinos y enlaces de socios guiados — sin IA, determinista (misma entrada → misma respuesta). Un administrador puede enriquecerla manualmente; vuelve a visitar esta página más adelante si quieres.",
    },
    manualNote: {
      sl: "Ta odgovor je skrbnik ročno dopolnil (izhodišče je bil samodejni deterministični vodnik). Osebni vpogled lokalca je iskreno ločen od samodejnega dela.",
      en: "An admin manually enriched this answer (the starting point was the automatic deterministic guide). A local's personal insight is clearly separated from the automatic part.",
      it: "Un amministratore ha arricchito manualmente questa risposta (il punto di partenza era la guida automatica deterministica). L’intuizione personale di un locale è chiaramente separata dalla parte automatica.",
      de: "Ein Admin hat diese Antwort manuell angereichert (Ausgangspunkt war die automatische deterministische Anleitung). Das persönliche Wissen eines Einheimischen ist klar vom automatischen Teil getrennt.",
      fr: "Un administrateur a enrichi manuellement cette réponse (le point de départ était le guide automatique déterministe). Le regard personnel d’un local est clairement séparé de la partie automatique.",
      es: "Un administrador enriqueció manualmente esta respuesta (el punto de partida era la guía automática determinista). La visión personal de un local está claramente separada de la parte automática.",
    },
    noAnswerYet: {
      sl: "Odgovor še ni pripravljen — osveži stran kasneje.",
      en: "The answer is not ready yet — refresh the page later.",
      it: "La risposta non è ancora pronta — aggiorna la pagina più tardi.",
      de: "Die Antwort ist noch nicht bereit — lade die Seite später neu.",
      fr: "La réponse n’est pas encore prête — actualise la page plus tard.",
      es: "La respuesta aún no está lista — recarga la página más tarde.",
    },
    createdAt: { sl: "Zastavljeno", en: "Asked", it: "Inviata", de: "Gestellt", fr: "Posée", es: "Enviada" },
    deliveredAt: { sl: "Odgovorjeno", en: "Answered", it: "Risposto", de: "Beantwortet", fr: "Répondu", es: "Respondida" },
    privacy: {
      sl: "Zasebnost: ta stran je dostopna samo poznalcu povezave. Deli jo previdno.",
      en: "Privacy: this page is only accessible to whoever knows the link. Share it carefully.",
      it: "Privacy: questa pagina è accessibile solo a chi conosce il link. Condividila con cautela.",
      de: "Datenschutz: diese Seite ist nur für diejenigen erreichbar, die den Link kennen. Teile ihn mit Bedacht.",
      fr: "Confidentialité : cette page n’est accessible qu’à ceux qui connaissent le lien. Partage-le avec prudence.",
      es: "Privacidad: esta página solo es accesible para quien conoce el enlace. Compártelo con cuidado.",
    },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  // ── Nalaganje ────────────────────────────────────────────────────────────
  if (state.phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-10 w-2/3" />
        <Skeleton className="mt-6 h-24 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  // ── Neveljavna povezava ─────────────────────────────────────────────────
  if (state.phase === "missing" || state.phase === "error") {
    const isMissing = state.phase === "missing";
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          kicker={t("kicker")}
          title={isMissing ? t("missingTitle") : t("errorTitle")}
          lead={isMissing ? t("missingBody") : t("errorBody")}
        />
        <Button asChild variant="outline" className="mt-6 tap-target font-semibold">
          <I18nLink href="/konzultacija">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </I18nLink>
        </Button>
      </div>
    );
  }

  // ── Odgovor ─────────────────────────────────────────────────────────────
  const d = state.data;
  const created = new Date(d.createdAt).toLocaleString(l === "sl" ? "sl-SI" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const delivered = d.deliveredAt
    ? new Date(d.deliveredAt).toLocaleString(l === "sl" ? "sl-SI" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const isManual = d.answerSource === "manual";
  const answerLines = (d.answer ?? "").split("\n");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant={isManual ? "default" : "secondary"} className="gap-1.5">
          {isManual ? (
            <BadgeCheck className="size-3.5" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3.5" aria-hidden="true" />
          )}
          {isManual ? t("manual") : t("auto")}
        </Badge>
        <Badge variant="outline" className="gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {t("createdAt")}: {created}
        </Badge>
        {delivered && (
          <Badge variant="outline" className="gap-1.5">
            <MessageCircleQuestion className="size-3.5" aria-hidden="true" />
            {t("deliveredAt")}: {delivered}
          </Badge>
        )}
      </div>

      {/* Vprašanje */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="size-4 text-primary" aria-hidden="true" />
            {t("yourQuestion")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm leading-relaxed">{d.question}</p>

          {(d.destinationName || d.travelDates || d.partyDescription || d.budget || d.interests.length > 0) && (
            <>
              <Separator className="my-4" />
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t("context")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {d.destinationName && (
                  <Badge variant="secondary" className="gap-1.5">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {d.destinationName}
                  </Badge>
                )}
                {d.travelDates && (
                  <Badge variant="secondary" className="gap-1.5">
                    <CalendarDays className="size-3.5" aria-hidden="true" />
                    {d.travelDates}
                  </Badge>
                )}
                {d.partyDescription && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Users className="size-3.5" aria-hidden="true" />
                    {d.partyDescription}
                  </Badge>
                )}
                {d.budget && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Wallet className="size-3.5" aria-hidden="true" />
                    {(CONSULTATION_BUDGET_LABELS as Record<string, { sl: string; en: string }>)[
                      d.budget
                    ]?.[l === "sl" ? "sl" : "en"] ?? d.budget}
                  </Badge>
                )}
                {d.interests.map((i) => (
                  <Badge key={i} variant="secondary">
                    {(CONSULTATION_INTEREST_LABELS as Record<string, { sl: string; en: string }>)[i]?.[
                      l === "sl" ? "sl" : "en"
                    ] ?? i}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Odgovor */}
      <Card className="mt-4 border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4 text-primary" aria-hidden="true" />
            {t("answer")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {d.answer ? (
            <div className="space-y-2 text-sm leading-relaxed">
              {answerLines.map((line, idx) => {
                const key = `${idx}`;
                if (line.trim() === "") return <div key={key} className="h-2" aria-hidden="true" />;
                if (line.trim() === "— — —") {
                  return (
                    <p
                      key={key}
                      className="pt-2 text-xs leading-relaxed text-muted-foreground"
                    >
                      {pick(l, {
                        sl: "— — — spodaj je iskrenostna opomba — — —",
                        en: "— — — honesty note below — — —",
                        it: "— — — nota di onestà qui sotto — — —",
                        de: "— — — Ehrlichkeitshinweis unten — — —",
                        fr: "— — — note d’honnêteté ci-dessous — — —",
                        es: "— — — nota de honestidad abajo — — —",
                      })}
                    </p>
                  );
                }
                if (line.startsWith("- ")) {
                  return (
                    <p key={key} className="flex gap-2 pl-2">
                      <span aria-hidden="true" className="text-muted-foreground">
                        •
                      </span>
                      <span>
                        <AnswerLine line={line.slice(2)} />
                      </span>
                    </p>
                  );
                }
                if (/^[A-ZČŠŽ0-9 ,()]{6,}:( |$)|^[A-ZČŠŽ]{3,}/.test(line)) {
                  return (
                    <p key={key} className="pt-2 font-semibold tracking-wide">
                      {line}
                    </p>
                  );
                }
                return (
                  <p key={key}>
                    <AnswerLine line={line} />
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{t("noAnswerYet")}</p>
          )}

          <Separator className="my-4" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isManual ? t("manualNote") : t("autoNote")}
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" className="tap-target font-semibold">
          <I18nLink href="/konzultacija">
            <Link2 className="size-4" aria-hidden="true" />
            {t("back")}
          </I18nLink>
        </Button>
        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
      </div>
    </div>
  );
}
