"use client";

import { Check, Copy, Link2, Loader2, MessageCircleHeart, Send, Sparkles } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  CONSULTATION_BUDGETS,
  CONSULTATION_BUDGET_LABELS,
  CONSULTATION_INTERESTS,
  CONSULTATION_INTEREST_LABELS,
} from "@/lib/consultation-options";

/**
 * /konzultacija — javni obrazec »VPRAŠAJ LOKALCA« (P0-H, issue #1 §20).
 *
 * Brezplačna globja konzultacija: vprašanje + kontekst → ZASEBNA povezava
 * z odgovorom. ISKRENOSTNI KANON (§29): odgovor je samodejni deterministični
 * vodnik (uradni register destinacij + vodene povezave partnerjev — brez AI,
 * brez omrežja), skrbnik ga lahko kasneje ročno dopolni. E-pošte ne pošiljamo
 * (peskovnik brez SMTP) — povezavo si shrani.
 */

const QUESTION_MIN = 20;
const QUESTION_MAX = 2000;
const INTERESTS_MAX = 5;

export default function KonzultacijaPage() {
  const l = useLocale();
  const { toast } = useToast();

  const [email, setEmail] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [destinationName, setDestinationName] = React.useState("");
  const [travelDates, setTravelDates] = React.useState("");
  const [partyDescription, setPartyDescription] = React.useState("");
  const [budget, setBudget] = React.useState<string>("");
  const [interests, setInterests] = React.useState<string[]>([]);
  const [sending, setSending] = React.useState(false);
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const L = {
    kicker: { sl: "Brezplačno · določen odgovor", en: "Free · deterministic answer" },
    title: { sl: "Vprašaj lokalca", en: "Ask a local" },
    lead: {
      sl: "Globlja potovalna konzultacija: postavi vprašanje in prejmi zasebno povezavo z osebnim vodnikom — sestavljenim iz uradnega registra destinacij in preverjenih povezav partnerjev.",
      en: "A deeper travel consultation: ask your question and receive a private link with a personal guide — built from the official destination registry and vetted partner links.",
    },
    honestTitle: { sl: "Kaj je odgovor in česa ni", en: "What the answer is and is not" },
    honestBody: {
      sl: "Odgovor je samodejni deterministični vodnik: uradni register destinacij (Bled, Ljubljana, Obala …), vodene povezave partnerjev za tvoje interese in iskrene opombe. Brez AI, brez naključnosti — isti vnosi vedno dajo isti odgovor. Skrbnik lahko odgovor kasneje ročno dopolni (to je razkrito na strani odgovora). Omejitev: 3 vprašanja na dan na e-pošto (po UTC).",
      en: "The answer is an automatic deterministic guide: the official destination registry, guided partner links for your interests and honest notes. No AI, no randomness — the same input always yields the same answer. An admin may later enrich the answer manually (disclosed on the answer page). Limit: 3 questions per day per email (UTC).",
    },
    formTitle: { sl: "Tvoje vprašanje", en: "Your question" },
    email: { sl: "E-pošta", en: "Email" },
    emailHint: {
      sl: "Za dnevno omejitev; naslov ne bo nikoli javno prikazan.",
      en: "Used for the daily limit; the address is never shown publicly.",
    },
    question: { sl: "Vprašanje", en: "Question" },
    questionHint: {
      sl: `Med ${QUESTION_MIN} in ${QUESTION_MAX} znakov — čim več konteksta, tembolj uporaben vodnik.`,
      en: `Between ${QUESTION_MIN} and ${QUESTION_MAX} characters — the more context, the more useful the guide.`,
    },
    destination: { sl: "Destinacija (neobvezno)", en: "Destination (optional)" },
    destinationPh: { sl: "npr. Bled, Ljubljana, Obala", en: "e.g. Bled, Ljubljana, the Coast" },
    dates: { sl: "Datumi (neobvezno)", en: "Dates (optional)" },
    datesPh: { sl: "npr. 24.–28. 10. 2026", en: "e.g. Oct 24–28, 2026" },
    party: { sl: "Druščina (neobvezno)", en: "Party (optional)" },
    partyPh: { sl: "npr. dva odrasla, otrok 4 leta", en: "e.g. two adults, one 4-year-old" },
    budget: { sl: "Proračun (neobvezno)", en: "Budget (optional)" },
    budgetNone: { sl: "Ne želim navesti", en: "Prefer not to say" },
    interests: { sl: "Interesi (neobvezno, do 5)", en: "Interests (optional, up to 5)" },
    interestsHint: {
      sl: "Za izbrane interese dobiš vodene povezave preverjenih partnerjev.",
      en: "For selected interests you get guided links of vetted partners.",
    },
    submit: { sl: "Pošlji vprašanje", en: "Send question" },
    sending: { sl: "Pošiljanje …", en: "Sending …" },
    doneTitle: { sl: "Vprašanje poslano!", en: "Question sent!" },
    doneBody: {
      sl: "Tvoj osebni vodnik je ŽE pripravljen — odgovor je samodejen in takoj na voljo na zasebni povezavi spodaj. Povezavo si shrani (med zaznamke): e-pošte ne pošiljamo.",
      en: "Your personal guide is ALREADY ready — the answer is automatic and immediately available at the private link below. Save the link (bookmark it): we do not send email.",
    },
    open: { sl: "Odpri svoj odgovor", en: "Open your answer" },
    copy: { sl: "Kopiraj povezavo", en: "Copy link" },
    copiedToast: { sl: "Povezava kopirana.", en: "Link copied." },
    copyFailed: { sl: "Kopiranje ni uspelo — povezavo prepiši ročno.", en: "Copy failed — write the link down manually." },
    again: { sl: "Zastavi novo vprašanje", en: "Ask a new question" },
    errValidation: { sl: "Preveri vnose — e-pošta in vprašanje so obvezna.", en: "Check your input — email and question are required." },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again." },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  function toggleInterest(value: string) {
    setInterests((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      if (prev.length >= INTERESTS_MAX) {
        toast({
          title: pick(l, { sl: `Izberi največ ${INTERESTS_MAX} interesov.`, en: `Select at most ${INTERESTS_MAX} interests.` }),
          variant: "destructive",
        });
        return prev;
      }
      return [...prev, value];
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    const payload = {
      email: email.trim(),
      question: question.trim(),
      destinationName: destinationName.trim() || undefined,
      travelDates: travelDates.trim() || undefined,
      partyDescription: partyDescription.trim() || undefined,
      budget: budget || undefined,
      interests: interests.length ? interests : undefined,
    };
    setSending(true);
    try {
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; url?: string; error?: string }
        | null;
      if (res.ok && body?.ok && typeof body.url === "string") {
        setResultUrl(body.url);
        setCopied(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast({
        title: body?.error ?? t("errValidation"),
        variant: "destructive",
      });
    } catch {
      toast({ title: t("errNetwork"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!resultUrl) return;
    try {
      const absolute = `${window.location.origin}${resultUrl}`;
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      toast({ title: t("copiedToast") });
    } catch {
      toast({ title: t("copyFailed"), variant: "destructive" });
    }
  }

  // ── Stanje po uspehu: zasebna povezava ───────────────────────────────────
  if (resultUrl) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader kicker={t("kicker")} title={t("doneTitle")} />
        <Card className="mt-8 border-primary/25 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircleHeart className="size-4 text-primary" aria-hidden="true" />
              {t("open")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{t("doneBody")}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="tap-target font-semibold">
                <Link href={resultUrl}>
                  <Link2 className="size-4" aria-hidden="true" />
                  {t("open")}
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="tap-target font-semibold"
                onClick={copyLink}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {t("copy")}
              </Button>
            </div>
            <p className="break-all rounded-lg border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
              {resultUrl}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="tap-target"
              onClick={() => {
                setResultUrl(null);
                setQuestion("");
                setInterests([]);
              }}
            >
              {t("again")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Obrazec ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={t("kicker")} title={t("title")} lead={t("lead")} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {t("honestTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("honestBody")}</p>
        </CardContent>
      </Card>

      <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("formTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="konzultacija-email">{t("email")} *</Label>
              <Input
                id="konzultacija-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ime@primer.si"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="konzultacija-question">{t("question")} *</Label>
              <Textarea
                id="konzultacija-question"
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_MAX))}
                placeholder={pick(l, {
                  sl: "Kaj te zanima? npr. Kako načrtovati tri dni na Bledu z druščino, ki ne hodi rado?",
                  en: "What would you like to know? e.g. How to plan three days at Lake Bled with a party that dislikes hiking?",
                })}
                rows={5}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("questionHint")}</span>
                <span
                  aria-hidden="true"
                  className={question.length > QUESTION_MAX ? "font-semibold text-destructive" : ""}
                >
                  {question.length}/{QUESTION_MAX}
                </span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="konzultacija-dest">{t("destination")}</Label>
                <Input
                  id="konzultacija-dest"
                  value={destinationName}
                  onChange={(e) => setDestinationName(e.target.value.slice(0, 120))}
                  placeholder={t("destinationPh")}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="konzultacija-dates">{t("dates")}</Label>
                <Input
                  id="konzultacija-dates"
                  value={travelDates}
                  onChange={(e) => setTravelDates(e.target.value.slice(0, 120))}
                  placeholder={t("datesPh")}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="konzultacija-party">{t("party")}</Label>
                <Input
                  id="konzultacija-party"
                  value={partyDescription}
                  onChange={(e) => setPartyDescription(e.target.value.slice(0, 120))}
                  placeholder={t("partyPh")}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="konzultacija-budget">{t("budget")}</Label>
                <Select value={budget || undefined} onValueChange={(v) => setBudget(v ?? "")}>
                  <SelectTrigger id="konzultacija-budget" className="w-full">
                    <SelectValue placeholder={t("budgetNone")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CONSULTATION_BUDGETS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {CONSULTATION_BUDGET_LABELS[b].sl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("interests")}</Label>
              <div className="flex flex-wrap gap-2">
                {CONSULTATION_INTERESTS.map((i) => {
                  const active = interests.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleInterest(i)}
                      className={
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors tap-target " +
                        (active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-muted")
                      }
                    >
                      {CONSULTATION_INTEREST_LABELS[i].sl}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t("interestsHint")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="submit"
                disabled={sending || !email.trim() || question.trim().length < QUESTION_MIN}
                className="tap-target font-semibold"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {sending ? t("sending") : t("submit")}
              </Button>
              <Badge variant="secondary">
                {pick(l, { sl: "Odgovor takoj", en: "Instant answer" })}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
