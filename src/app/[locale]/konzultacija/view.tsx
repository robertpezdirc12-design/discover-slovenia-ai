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
    kicker: { sl: "Brezplačno · določen odgovor", en: "Free · deterministic answer", it: "Gratis · risposta deterministica", de: "Kostenlos · deterministische Antwort", fr: "Gratuit · réponse déterministe", es: "Gratis · respuesta determinista" },
    title: { sl: "Vprašaj lokalca", en: "Ask a local", it: "Chiedi a un locale", de: "Frag einen Einheimischen", fr: "Demande à un local", es: "Pregunta a un local" },
    lead: {
      sl: "Globlja potovalna konzultacija: postavi vprašanje in prejmi zasebno povezavo z osebnim vodnikom — sestavljenim iz uradnega registra destinacij in preverjenih povezav partnerjev.",
      en: "A deeper travel consultation: ask your question and receive a private link with a personal guide — built from the official destination registry and vetted partner links.",
      it: "Una consulenza di viaggio più approfondita: fai la tua domanda e ricevi un link privato con una guida personale — costruita dal registro ufficiale delle destinazioni e da link di partner verificati.",
      de: "Eine tiefere Reiseberatung: stell deine Frage und erhalte einen privaten Link mit einer persönlichen Anleitung — erstellt aus dem offiziellen Ziel-Register und geprüften Partner-Links.",
      fr: "Une consultation de voyage plus approfondie : pose ta question et reçois un lien privé avec un guide personnel — construit à partir du registre officiel des destinations et de liens de partenaires vérifiés.",
      es: "Una consulta de viaje más profunda: haz tu pregunta y recibe un enlace privado con una guía personal — construida a partir del registro oficial de destinos y enlaces de socios verificados.",
    },
    honestTitle: { sl: "Kaj je odgovor in česa ni", en: "What the answer is and is not", it: "Cos’è la risposta e cosa non è", de: "Was die Antwort ist und was nicht", fr: "Ce qu’est la réponse et ce qu’elle n’est pas", es: "Qué es la respuesta y qué no es" },
    honestBody: {
      sl: "Odgovor je samodejni deterministični vodnik: uradni register destinacij (Bled, Ljubljana, Obala …), vodene povezave partnerjev za tvoje interese in iskrene opombe. Brez AI, brez naključnosti — isti vnosi vedno dajo isti odgovor. Skrbnik lahko odgovor kasneje ročno dopolni (to je razkrito na strani odgovora). Omejitev: 3 vprašanja na dan na e-pošto (po UTC).",
      en: "The answer is an automatic deterministic guide: the official destination registry, guided partner links for your interests and honest notes. No AI, no randomness — the same input always yields the same answer. An admin may later enrich the answer manually (disclosed on the answer page). Limit: 3 questions per day per email (UTC).",
      it: "La risposta è una guida automatica deterministica: il registro ufficiale delle destinazioni, link partner guidati per i tuoi interessi e note oneste. Niente IA, niente casualità — lo stesso input dà sempre la stessa risposta. Un amministratore può in seguito arricchire la risposta manualmente (rivelato sulla pagina della risposta). Limite: 3 domande al giorno per e-mail (UTC).",
      de: "Die Antwort ist eine automatische deterministische Anleitung: das offizielle Ziel-Register, geführte Partner-Links für deine Interessen und ehrliche Hinweise. Keine KI, kein Zufall — dieselbe Eingabe ergibt immer dieselbe Antwort. Ein Admin kann die Antwort später manuell anreichern (auf der Antwortseite offengelegt). Limit: 3 Fragen pro Tag und E-Mail (UTC).",
      fr: "La réponse est un guide automatique déterministe : le registre officiel des destinations, des liens partenaires guidés pour tes centres d’intérêt et des notes honnêtes. Pas d’IA, pas d’aléatoire — la même entrée donne toujours la même réponse. Un administrateur peut ensuite enrichir la réponse manuellement (divulgué sur la page de réponse). Limite : 3 questions par jour et par e-mail (UTC).",
      es: "La respuesta es una guía automática determinista: el registro oficial de destinos, enlaces de socios guiados para tus intereses y notas honestas. Sin IA, sin azar — la misma entrada da siempre la misma respuesta. Un administrador puede luego enriquecer la respuesta manualmente (revelado en la página de la respuesta). Límite: 3 preguntas al día por correo (UTC).",
    },
    formTitle: { sl: "Tvoje vprašanje", en: "Your question", it: "La tua domanda", de: "Deine Frage", fr: "Ta question", es: "Tu pregunta" },
    email: { sl: "E-pošta", en: "Email", it: "E-mail", de: "E-Mail", fr: "E-mail", es: "Correo" },
    emailHint: {
      sl: "Za dnevno omejitev; naslov ne bo nikoli javno prikazan.",
      en: "Used for the daily limit; the address is never shown publicly.",
      it: "Serve per il limite giornaliero; l’indirizzo non viene mai mostrato pubblicamente.",
      de: "Dient dem Tageslimit; die Adresse wird nie öffentlich angezeigt.",
      fr: "Sert pour la limite quotidienne ; l’adresse n’est jamais affichée publiquement.",
      es: "Se usa para el límite diario; la dirección nunca se muestra públicamente.",
    },
    question: { sl: "Vprašanje", en: "Question", it: "Domanda", de: "Frage", fr: "Question", es: "Pregunta" },
    questionHint: {
      sl: `Med ${QUESTION_MIN} in ${QUESTION_MAX} znakov — čim več konteksta, tembolj uporaben vodnik.`,
      en: `Between ${QUESTION_MIN} and ${QUESTION_MAX} characters — the more context, the more useful the guide.`,
      it: `Tra ${QUESTION_MIN} e ${QUESTION_MAX} caratteri — più contesto scrivi, più utile sarà la guida.`,
      de: `Zwischen ${QUESTION_MIN} und ${QUESTION_MAX} Zeichen — je mehr Kontext, desto nützlicher die Anleitung.`,
      fr: `Entre ${QUESTION_MIN} et ${QUESTION_MAX} caractères — plus tu donnes de contexte, plus le guide est utile.`,
      es: `Entre ${QUESTION_MIN} y ${QUESTION_MAX} caracteres — cuánto más contexto, más útil la guía.`,
    },
    destination: { sl: "Destinacija (neobvezno)", en: "Destination (optional)", it: "Destinazione (facoltativa)", de: "Reiseziel (optional)", fr: "Destination (facultative)", es: "Destino (opcional)" },
    destinationPh: { sl: "npr. Bled, Ljubljana, Obala", en: "e.g. Bled, Ljubljana, the Coast", it: "es. Bled, Ljubljana, la Costa", de: "z. B. Bled, Ljubljana, die Küste", fr: "ex. Bled, Ljubljana, la Côte", es: "p. ej. Bled, Ljubljana, la Costa" },
    dates: { sl: "Datumi (neobvezno)", en: "Dates (optional)", it: "Date (facoltative)", de: "Termine (optional)", fr: "Dates (facultatives)", es: "Fechas (opcionales)" },
    datesPh: { sl: "npr. 24.–28. 10. 2026", en: "e.g. Oct 24–28, 2026", it: "es. 24–28 ott 2026", de: "z. B. 24.–28. Okt. 2026", fr: "ex. 24–28 oct. 2026", es: "p. ej. 24–28 oct 2026" },
    party: { sl: "Druščina (neobvezno)", en: "Party (optional)", it: "Gruppo (facoltativo)", de: "Gruppe (optional)", fr: "Groupe (facultatif)", es: "Grupo (opcional)" },
    partyPh: { sl: "npr. dva odrasla, otrok 4 leta", en: "e.g. two adults, one 4-year-old", it: "es. due adulti, un bambino di 4 anni", de: "z. B. zwei Erwachsene, ein 4-jähriges Kind", fr: "ex. deux adultes, un enfant de 4 ans", es: "p. ej. dos adultos, un niño de 4 años" },
    budget: { sl: "Proračun (neobvezno)", en: "Budget (optional)", it: "Budget (facoltativo)", de: "Budget (optional)", fr: "Budget (facultatif)", es: "Presupuesto (opcional)" },
    budgetNone: { sl: "Ne želim navesti", en: "Prefer not to say", it: "Preferisco non dirlo", de: "Möchte ich nicht angeben", fr: "Je préfère ne pas le dire", es: "Prefiero no decirlo" },
    interests: { sl: "Interesi (neobvezno, do 5)", en: "Interests (optional, up to 5)", it: "Interessi (facoltativi, fino a 5)", de: "Interessen (optional, bis zu 5)", fr: "Centres d’intérêt (facultatifs, jusqu’à 5)", es: "Intereses (opcionales, hasta 5)" },
    interestsHint: {
      sl: "Za izbrane interese dobiš vodene povezave preverjenih partnerjev.",
      en: "For selected interests you get guided links of vetted partners.",
      it: "Per gli interessi selezionati ottieni link guidati di partner verificati.",
      de: "Für ausgewählte Interessen erhältst du geführte Links geprüfter Partner.",
      fr: "Pour les centres d’intérêt sélectionnés, tu reçois des liens guidés de partenaires vérifiés.",
      es: "Para los intereses seleccionados obtienes enlaces guiados de socios verificados.",
    },
    submit: { sl: "Pošlji vprašanje", en: "Send question", it: "Invia la domanda", de: "Frage senden", fr: "Envoyer la question", es: "Enviar pregunta" },
    sending: { sl: "Pošiljanje …", en: "Sending …", it: "Invio …", de: "Senden …", fr: "Envoi …", es: "Enviando …" },
    doneTitle: { sl: "Vprašanje poslano!", en: "Question sent!", it: "Domanda inviata!", de: "Frage gesendet!", fr: "Question envoyée !", es: "¡Pregunta enviada!" },
    doneBody: {
      sl: "Tvoj osebni vodnik je ŽE pripravljen — odgovor je samodejen in takoj na voljo na zasebni povezavi spodaj. Povezavo si shrani (med zaznamke): e-pošte ne pošiljamo.",
      en: "Your personal guide is ALREADY ready — the answer is automatic and immediately available at the private link below. Save the link (bookmark it): we do not send email.",
      it: "La tua guida personale è GIÀ pronta — la risposta è automatica e subito disponibile al link privato qui sotto. Salva il link (nei preferiti): non inviamo e-mail.",
      de: "Deine persönliche Anleitung ist BEREITS fertig — die Antwort ist automatisch und sofort unter dem privaten Link unten verfügbar. Speichere den Link (als Lesezeichen): wir senden keine E-Mail.",
      fr: "Ton guide personnel est DÉJÀ prêt — la réponse est automatique et immédiatement disponible sur le lien privé ci-dessous. Enregistre le lien (dans tes favoris) : nous n’envoyons pas d’e-mail.",
      es: "Tu guía personal YA está lista — la respuesta es automática y está disponible de inmediato en el enlace privado de abajo. Guarda el enlace (en marcadores): no enviamos correo.",
    },
    open: { sl: "Odpri svoj odgovor", en: "Open your answer", it: "Apri la tua risposta", de: "Öffne deine Antwort", fr: "Ouvre ta réponse", es: "Abre tu respuesta" },
    copy: { sl: "Kopiraj povezavo", en: "Copy link", it: "Copia il link", de: "Link kopieren", fr: "Copier le lien", es: "Copiar enlace" },
    copiedToast: { sl: "Povezava kopirana.", en: "Link copied.", it: "Link copiato.", de: "Link kopiert.", fr: "Lien copié.", es: "Enlace copiado." },
    copyFailed: { sl: "Kopiranje ni uspelo — povezavo prepiši ročno.", en: "Copy failed — write the link down manually.", it: "Copia non riuscita — trascrivi il link a mano.", de: "Kopieren fehlgeschlagen — schreib den Link von Hand ab.", fr: "Échec de la copie — note le lien à la main.", es: "Error al copiar — anota el enlace a mano." },
    again: { sl: "Zastavi novo vprašanje", en: "Ask a new question", it: "Fai una nuova domanda", de: "Stell eine neue Frage", fr: "Pose une nouvelle question", es: "Haz una nueva pregunta" },
    errValidation: { sl: "Preveri vnose — e-pošta in vprašanje so obvezna.", en: "Check your input — email and question are required.", it: "Controlla i tuoi dati — e-mail e domanda sono obbligatorie.", de: "Prüfe deine Eingabe — E-Mail und Frage sind Pflicht.", fr: "Vérifie ta saisie — l’e-mail et la question sont obligatoires.", es: "Revisa tus datos — el correo y la pregunta son obligatorios." },
    errNetwork: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — try again.", it: "Errore di rete — riprova.", de: "Netzwerkfehler — versuche es erneut.", fr: "Erreur réseau — réessaie.", es: "Error de red — reintenta." },
  } as const;

  const t = <K extends keyof typeof L>(k: K): string => pick(l, L[k]);

  function toggleInterest(value: string) {
    setInterests((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      if (prev.length >= INTERESTS_MAX) {
        toast({
          title: pick(l, { sl: `Izberi največ ${INTERESTS_MAX} interesov.`, en: `Select at most ${INTERESTS_MAX} interests.`, it: `Seleziona al massimo ${INTERESTS_MAX} interessi.`, de: `Wähle höchstens ${INTERESTS_MAX} Interessen.`, fr: `Sélectionne au plus ${INTERESTS_MAX} centres d’intérêt.`, es: `Selecciona como máximo ${INTERESTS_MAX} intereses.` }),
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
                  it: "Cosa ti incuriosisce? es. Come pianificare tre giorni a Bled con un gruppo a cui non piace camminare?",
                  de: "Worum möchtest du wissen? z. B. Wie plane ich drei Tage am Bleder See mit einer Gruppe, die ungern wandert?",
                  fr: "Qu’aimerais-tu savoir ? ex. Comment planifier trois jours au lac de Bled avec un groupe qui n’aime pas marcher ?",
                  es: "¿Qué te gustaría saber? p. ej. ¿Cómo planificar tres días en Bled con un grupo al que no le gusta caminar?",
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
                {pick(l, { sl: "Odgovor takoj", en: "Instant answer", it: "Risposta immediata", de: "Sofortige Antwort", fr: "Réponse immédiate", es: "Respuesta inmediata" })}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
