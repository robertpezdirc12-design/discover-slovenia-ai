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
    kicker: { sl: "Zasebna povezava", en: "Private link" },
    title: { sl: "Tvoj osebni vodnik", en: "Your personal guide" },
    lead: {
      sl: "Odgovor na tvoje vprašanje iz konzultacije »Vprašaj lokalca«. Povezavo imaš samo ti — e-pošta pošiljatelja ni javna.",
      en: "The answer to your “Ask a local” consultation. Only you hold this link — the sender's email is not public.",
    },
    missingTitle: { sl: "Ta povezava ne obstaja", en: "This link does not exist" },
    missingBody: {
      sl: "Povezava je neveljavna ali pa je bila umaknjena. Preveri, ali si kopiral celoten naslov — ali zastavi novo vprašanje.",
      en: "The link is invalid or has been removed. Check that you copied the whole address — or ask a new question.",
    },
    errorTitle: { sl: "Stran trenutno ni dosegljiva", en: "The page is unavailable" },
    errorBody: {
      sl: "Nekaj je šlo narobe pri nalaganju odgovora. Poskusi osvežiti stran.",
      en: "Something went wrong while loading the answer. Try refreshing the page.",
    },
    back: { sl: "Zastavi novo vprašanje", en: "Ask a new question" },
    yourQuestion: { sl: "Tvoje vprašanje", en: "Your question" },
    context: { sl: "Kontekst vprašanja", en: "Question context" },
    answer: { sl: "Odgovor", en: "Answer" },
    auto: { sl: "Samodejni vodnik", en: "Automatic guide" },
    manual: { sl: "Dopolnil skrbnik", en: "Enriched by an admin" },
    autoNote: {
      sl: "Ta odgovor je samodejno sestavljen iz uradnega registra destinacij in vodenih povezav partnerjev — brez AI, deterministično (isti vnos → isti odgovor). Skrbnik ga lahko ročno dopolni; to stran lahko kasneje znova obiščeš.",
      en: "This answer was automatically assembled from the official destination registry and guided partner links — no AI, deterministic (same input → same answer). An admin may enrich it manually; feel free to revisit this page later.",
    },
    manualNote: {
      sl: "Ta odgovor je skrbnik ročno dopolnil (izhodišče je bil samodejni deterministični vodnik). Osebni vpogled lokalca je iskreno ločen od samodejnega dela.",
      en: "An admin manually enriched this answer (the starting point was the automatic deterministic guide). A local's personal insight is clearly separated from the automatic part.",
    },
    noAnswerYet: {
      sl: "Odgovor še ni pripravljen — osveži stran kasneje.",
      en: "The answer is not ready yet — refresh the page later.",
    },
    createdAt: { sl: "Zastavljeno", en: "Asked" },
    deliveredAt: { sl: "Odgovorjeno", en: "Answered" },
    privacy: {
      sl: "Zasebnost: ta stran je dostopna samo poznalcu povezave. Deli jo previdno.",
      en: "Privacy: this page is only accessible to whoever knows the link. Share it carefully.",
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
