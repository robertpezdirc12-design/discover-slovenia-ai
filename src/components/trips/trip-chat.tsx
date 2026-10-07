"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
// slovenski helperji — enkraten vir kanona (99-b / 48-a rekonstrukcija)
import { messagesLabel, slTimeAgo } from "@/lib/sl-utils";
// W2: čisti helperji @AI (omemba, rezervirano ime)
import { AI_ADVISOR_NAME, isAiMention } from "@/lib/trip-chat-engine";

// ============================================================================
// TRIP SOCIAL → SKUPINSKI KLEPET Z @AI na /pot/[shareId] — rekonstrukcija iz
// PRISTNE izvorne kode (read_1790956846903, W2 / Issue #15 / 1.131.0),
// mostovno prirejena 48-a:
//   - avtorstvo je vezano na PRIJAVLJEN račun (izvirnik: anonimno ime +
//     clientId; mostovni model je računski — vlogo potrjuje strežnik);
//   - živost: inkrementalni polling (6 s, viden zavihek) — socket pospešitev
//     iz izvirnika v mostu ni zgrajena, zato je oznaka iskreno
//     „osveževanje vsakih 6 s" (nikoli „v živo", ko ni);
//   - značka AI je STREŽNIŠKA (isAI vrstica; klient je ne more poslati);
//   - všečki (srčki) iz izvirnika niso del mostovnega modela (iskrena meja).
//
// Iskrenost: napake AI se izpišejo, sporočilo uporabnika ostane objavljeno.
// ============================================================================

const COMMENT_TEXT_MAX = 500;

/** Barve avatarjev — toplo/zeleno obarvana paleta (brez modre/indigo). */
const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-amber-600",
  "bg-teal-700",
  "bg-orange-700",
  "bg-lime-700",
] as const;

export interface TripChatItem {
  id: string;
  authorId: string | null;
  authorName: string;
  isAI: boolean;
  text: string;
  createdAt: string;
}

interface TripChatProps {
  shareId: string;
  /** ISO datum ustvarjanja potovanja (spodnja meja za relativen čas). */
  createdAt: string;
  /** Objavi sporočilo — VIEWER+ (sodelujoči); strežnik preveri vlogo. */
  canPost: boolean;
  /** Prikazno ime prijavljenega uporabnika (odvod seje). */
  myName: string | null;
}

/** Barva avatarja iz imena (stabilna za isto ime). */
function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Začetnica imena (varno za Unicode). */
function nameInitial(name: string): string {
  const trimmed = name.trim();
  const first = Array.from(trimmed)[0] ?? "?";
  return first.toUpperCase();
}

export function TripChat({ shareId, createdAt, canPost, myName }: TripChatProps) {
  const { toast } = useToast();

  const [messages, setMessages] = useState<TripChatItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [aiPending, setAiPending] = useState<boolean>(false);

  // Relativni čas računamo šele po mountu (SSR/klient ura se razlikujeta)
  const [mounted, setMounted] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(shareId)}/messages`,
        { cache: "no-store" }
      );
      if (res.status === 404) {
        setMessages([]);
        return;
      }
      if (!res.ok) {
        setLoadError(`Napaka ${res.status}`);
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        messages?: TripChatItem[];
      } | null;
      if (Array.isArray(data?.messages)) {
        setMessages(data.messages);
        setLoadError(null);
      }
    } catch {
      // Off-line / napaka — ohranimo trenutno stanje
    }
  }, [shareId]);

  useEffect(() => {
    setMounted(true);
    void load();
  }, [load]);

  // === Živost: inkrementalni polling (6 s, samo ko je zavihek viden —
  // originalni kanon; socket pospešitev v mostu ni zgrajena, oznaka je
  // zato iskreno „osveževanje vsakih 6 s"). ===
  useEffect(() => {
    if (!shareId) return;
    const id = window.setInterval(
      () => {
        if (document.visibilityState === "visible") void load();
      },
      6000
    );
    return () => window.clearInterval(id);
  }, [shareId, load]);

  // === Samodejni drs na dno ob novi vrstici (če je uporabnik že ob dnu —
  // ne smemo mu puliti brskalnika, če bere zgodovino) ===
  const stickToBottomRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const lastCount = useRef(0);
  useEffect(() => {
    const n = messages?.length ?? 0;
    const grew = n > lastCount.current;
    lastCount.current = n;
    if (!grew) return;
    if (!stickToBottomRef.current) return; // uporabnik bere višje — ne puli
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, aiPending]);

  // === @AI žeton — vstavi na položaj kazalca v vnosno polje ===
  const insertAiMention = useCallback(() => {
    const el = textareaRef.current;
    const value = text;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const needsSpace = before.length > 0 && !/\s$/.test(before);
    const insert = `${needsSpace ? " " : ""}@AI `;
    const next = `${before}${insert}${after}`;
    setText(next);
    // Fokus + kazalec za žetonom (naslednja slika — textarea se še rendra)
    requestAnimationFrame(() => {
      el?.focus();
      const pos = (before + insert).length;
      el?.setSelectionRange(pos, pos);
    });
  }, [text]);

  // === Objava sporočila (+ morebitno vprašanje @AI svetovalcu) ===
  const submitComment = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting || !shareId) return;

      const body = text.trim();
      const wantsAi = isAiMention(body);

      if (body.length < 2 || body.length > COMMENT_TEXT_MAX) {
        toast({
          title: "Sporočilo je prekratko ali predolgo",
          description: `Sporočilo mora imeti med 2 in ${COMMENT_TEXT_MAX} znakov.`,
          variant: "destructive",
        });
        return;
      }

      setSubmitting(true);
      stickToBottomRef.current = true; // svoja vrstica → drs na dno
      if (wantsAi) setAiPending(true);
      try {
        // 1. Sporočilo se vedno objavi (vidno vsem — tudi če AI kasneje
        //    odpove; iskrenost: napaka AI ne poje uporabnikovega sporočila).
        const res = await fetch(
          `/api/trips/${encodeURIComponent(shareId)}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body }),
          }
        );
        const data: unknown = await res.json().catch(() => null);
        const d = data as
          | { success?: unknown; message?: TripChatItem; aiMessage?: TripChatItem; aiError?: string; error?: unknown }
          | null;

        if (!res.ok || d?.success !== true || !d?.message) {
          throw new Error(
            typeof d?.error === "string" ? d.error : `HTTP ${res.status}`
          );
        }

        setMessages((prev) => [...(prev ?? []), d.message as TripChatItem]);
        setText("");

        if (!wantsAi) {
          toast({
            title: "Sporočilo je objavljeno",
            description: "Hvala, da deliš mnenje s skupino!",
          });
          return;
        }

        // 2. Vprašanje @AI — strežniški odgovor (deterministični pogon).
        //    Indikator tipkanja je LOKALEN (aiPending) — prisotni vidijo
        //    vrstico prek svojega pollinga.
        if (d.aiMessage) {
          setMessages((prev) => [...(prev ?? []), d.aiMessage as TripChatItem]);
        } else if (d.aiError) {
          toast({
            title: "AI svetovalec trenutno ne more odgovoriti",
            description: d.aiError,
            variant: "destructive",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Poskusi znova.";
        toast({
          title: "Sporočila ni bilo mogoče objaviti",
          description: message,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
        setAiPending(false);
      }
    },
    [submitting, shareId, text, toast]
  );

  const messageCountLabel = useMemo(() => {
    return messagesLabel(messages?.length ?? 0);
  }, [messages?.length]);

  return (
    <section aria-label="Skupinski klepet" className="print-hide print:hidden">
      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-6">
          {/* === Naslov odseka + živost + števec === */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <MessageCircle
                className="size-5 text-primary"
                aria-hidden="true"
              />
              Skupinski klepet
            </h2>
            <div className="flex items-center gap-2">
              {/* Iskren indikator živosti: v mostu ni socketa — polling
                  je edini vir osveževanja in je tako tudi označen. */}
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                aria-live="polite"
              >
                <span
                  className="size-1.5 rounded-full bg-emerald-600 motion-safe:animate-pulse"
                  aria-hidden="true"
                />
                osveževanje vsakih 6 s
              </span>
              <span className="text-sm text-muted-foreground">
                {messageCountLabel}
              </span>
            </div>
          </div>

          {/* === @AI pas — vzorec W9 (povedano je točno to, kar se zgodi) === */}
          <div className="flex items-start gap-2.5 border-b border-border py-3">
            <span
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Bot className="size-4" />
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Omeni <strong className="font-semibold text-foreground">@AI</strong> v
              sporočilu in vprašaj npr.{" "}
              <em className="italic">
                »@AI kje lahko večerjamo v Bledu?«
              </em>{" "}
              — svetovalec odgovarja vsem v klepetu, iz podatkov platforme
              (deterministično, z viri). Odgovarja o vremenu, razdaljah,
              predlogih in cenah — izključno iz te pote in baze destinacij.
            </p>
          </div>

          {/* === Klepet — kronološki seznam z drsom === */}
          <div
            ref={scrollRef}
            className="mt-4 max-h-96 space-y-4 overflow-y-auto pr-2"
            aria-label="Zgodovina klepeta"
          >
            {loadError ? (
              <p className="text-sm text-destructive" role="alert">
                {loadError}
              </p>
            ) : messages === null ? (
              <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                Nalagam klepet …
              </p>
            ) : messages.length === 0 && !aiPending ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <MessageCircle
                  className="size-8 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                  Trenutno ni sporočil — bodi prvi!
                </p>
                <p className="max-w-md text-xs text-muted-foreground/70">
                  Deli mnenje, se dogovori za termin (»vidimo se ob 9h pred
                  jezerom«) ali vprašaj <strong>@AI</strong> svetovalca.
                </p>
              </div>
            ) : (
              <ul className="space-y-4" aria-live="polite" aria-atomic="false">
                {messages.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    {c.isAI ? (
                      // AI avatar — enoten, primarni (nikoli barva po imenu)
                      <div
                        className="flex size-9 shrink-0 select-none items-center justify-center rounded-full bg-primary text-primary-foreground"
                        aria-hidden="true"
                      >
                        <Bot className="size-4" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex size-9 shrink-0 select-none items-center justify-center rounded-full text-sm font-bold text-white",
                          avatarColor(c.authorName)
                        )}
                        aria-hidden="true"
                      >
                        {nameInitial(c.authorName)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {c.isAI ? (
                          <>
                            <span className="font-semibold text-primary">
                              {AI_ADVISOR_NAME}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <Sparkles className="size-2.5" aria-hidden="true" />
                              deterministično · iz podatkov platforme
                            </span>
                          </>
                        ) : (
                          <span className="font-medium">{c.authorName}</span>
                        )}
                        <time
                          dateTime={c.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {mounted ? slTimeAgo(c.createdAt, createdAt) : "…"}
                        </time>
                      </p>
                      <p
                        className={cn(
                          "mt-1 break-words whitespace-pre-line text-sm text-foreground",
                          c.isAI &&
                            "rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/5 px-3.5 py-2.5"
                        )}
                      >
                        {c.text}
                      </p>
                    </div>
                  </li>
                ))}

                {/* Indikator tipkanja AI — LOKALEN (vidi ga vpraševalec,
                    dokler strežnik ne izstavi vrstice). */}
                {aiPending ? (
                  <li className="flex gap-3" aria-live="polite">
                    <div
                      className="flex size-9 shrink-0 select-none items-center justify-center rounded-full bg-primary text-primary-foreground"
                      aria-hidden="true"
                    >
                      <Bot className="size-4" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/5 px-3.5 py-2.5">
                      <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                      <span className="ml-1 text-xs text-muted-foreground">
                        {AI_ADVISOR_NAME} piše …
                      </span>
                    </div>
                  </li>
                ) : null}
              </ul>
            )}
          </div>

          {/* === Obrazec za novo sporočilo === */}
          {canPost ? (
            <form
              onSubmit={(e) => void submitComment(e)}
              className="space-y-3 border-t border-border pt-4"
            >
              <p className="text-xs text-muted-foreground">
                Pišeš kot <strong className="font-semibold text-foreground">{myName ?? "sodelujoči"}</strong>{" "}
                (ime tvojega računa — avtorstvo je vkleto v sejo).
              </p>
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Deli mnenje z družino in prijatelji … ali vprašaj @AI"
                required
                maxLength={COMMENT_TEXT_MAX}
                rows={3}
                aria-label="Sporočilo v skupinski klepet"
                className="min-h-[88px] resize-y"
                disabled={submitting}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-2.5 text-xs"
                    onClick={insertAiMention}
                    disabled={submitting}
                    aria-label="Vstavi omembo @AI svetovalca v sporočilo"
                    title="Vstavi @AI — svetovalec bo odgovoril v klepetu"
                  >
                    <Bot className="size-3.5 text-primary" aria-hidden="true" />
                    @AI
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {text.length}/{COMMENT_TEXT_MAX}
                  </span>
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 min-w-44 gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                      Pošiljam…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" aria-hidden="true" />
                      Pošlji
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <p className="border-t border-border pt-4 text-sm text-muted-foreground">
              Klepet je berljiv vsem; za pisanje in vprašanja{" "}
              <strong>@AI</strong> se prijavi kot sodelujoči na tej poti
              (vloga se dodeli s vabilom lastnika).
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default TripChat;
