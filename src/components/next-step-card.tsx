"use client";

/**
 * NEXT-STEP-CARD — proaktivni pomočnik (issue #1/3).
 *
 * Kartica nad naslovom/hero prikaže DETERMINISTIČNI predlog naslednjega
 * koraka (src/lib/next-step — 0 AI žetonov): ikono, naslov, telo, CTA
 * gumb in PROZOREN razlog ("Zakaj to predlagam") + po možnosti sekundarni
 * predlog. Dismiss (X) se shrani v sessionStorage
 * "dai:next-step-dismissed" — skrito do konca seje.
 *
 * Površine (surface): kartica NE predlaga strani, na kateri uporabnik
 * že je (home "/"· plan "/nacrtuj" · market "/trznica") — v tem primeru
 * poviša sekundarni predlog ali se skrije (iskrenost: ne krožimo).
 *
 * useNextStepContext() zbere čisto stanje IZKLJUČNO iz obstoječih
 * lokalnih shramb (dai:my-trip, dai:last-plan, dai:go-trip, prijava +
 * dai:shared-plans) — BREZ novih omrežnih klicev.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  Map as MapIcon,
  PartyPopper,
  Route as RouteIcon,
  Share2,
  Sun,
  Ticket,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { useMyTripList } from "@/lib/my-trip";
import {
  nextStepsFor,
  type NextStepContext,
  type NextStepIcon,
  type NextStepSuggestion,
} from "@/lib/next-step";
import { useGoTrip, useLastPlan } from "@/lib/plan-store";
import { SHARED_PLAN_CHANGED_EVENT, sharedPlans } from "@/lib/shared-plan";

/** Dismiss zastavica (seja): vse next-step kartice se sejo skrijejo skupaj. */
const DISMISS_KEY = "dai:next-step-dismissed";

/** Dogodek ob dismissu — vse kartice na strani se sinhrono skrijejo. */
const DISMISS_EVENT = "dai:next-step-dismissed-changed";

/** Površina vstavitve — rahlo prilagodi nagovor in prepreči krožne predloge. */
export type NextStepSurface = "home" | "plan" | "market";

/** Lastna pot vsake površine (predlog nanjo ne kroži). */
const SURFACE_SELF_HREF: Record<NextStepSurface, string> = {
  home: "/",
  plan: "/nacrtuj",
  market: "/trznica",
};

/** Preslika ikon iz čistega modula v lucide-react (komponenta nosi UI). */
const ICONS: Record<NextStepIcon, ComponentType<{ className?: string }>> = {
  compass: Compass,
  map: MapIcon,
  ticket: Ticket,
  sun: Sun,
  route: RouteIcon,
  party: PartyPopper,
  share: Share2,
};

const L = {
  kicker: {
    home: { sl: "Tvoj naslednji korak", en: "Your next step", it: "Il tuo prossimo passo", de: "Dein nächster Schritt", fr: "Ta prochaine étape", es: "Tu próximo paso" },
    plan: { sl: "Naslednji korak", en: "Next step", it: "Prossimo passo", de: "Nächster Schritt", fr: "Prochaine étape", es: "Próximo paso" },
    market: { sl: "Naslednji korak", en: "Next step", it: "Prossimo passo", de: "Nächster Schritt", fr: "Prochaine étape", es: "Próximo paso" },
  },
  cardLabel: { sl: "Predlog naslednjega koraka", en: "Next step suggestion", it: "Suggerimento del prossimo passo", de: "Vorschlag für den nächsten Schritt", fr: "Suggestion de prochaine étape", es: "Sugerencia del próximo paso" },
  reasonPrefix: { sl: "Zakaj to predlagam: ", en: "Why we suggest this: ", it: "Perché lo suggeriamo: ", de: "Warum wir das vorschlagen: ", fr: "Pourquoi nous le suggérons : ", es: "Por qué lo sugerimos: " },
  secondaryLead: { sl: "Ali pa: ", en: "Or: ", it: "Oppure: ", de: "Oder: ", fr: "Ou : ", es: "O: " },
  dismissLabel: {
    sl: "Skrij predlog do konca seje",
    en: "Hide the suggestion for this session",
    it: "Nascondi il suggerimento per questa sessione",
    de: "Den Vorschlag für diese Sitzung ausblenden",
    fr: "Masquer la suggestion pour cette session",
    es: "Oculta la sugerencia por esta sesión",
  },
} as const;

// ---------------------------------------------------------------------------
// Zbiranje konteksta (čisto, brez novih omrežnih klicev)
// ---------------------------------------------------------------------------

/**
 * useNextStepContext — sestavi NextStepContext iz obstoječih shramb:
 * - myTripCount: dai:my-trip (reaktivno),
 * - hasPlan/planDays: dai:last-plan (uporaben načrt = ≥ 1 dan; prazen
 *   zapis ni načrt — iskrenost),
 * - goModeActive: dai:go-trip (zapis se pobriše ob zaključku potovanja),
 * - hasCloudTrip: prijava + lokalna znamenja shranjenih potovanj
 *   (dai:shared-plans — nastali so ob shranjevanju v oblak),
 * - reservationCount/confirmedCount: 0 (rezervacije živijo strežniško;
 *   brez znanega shareId jih iskreno ne izmišljujemo).
 *
 * `ready` se postavi šele, ko se ustali seja + lokalne shrambe —
 * kartica ne utripa s predlogom iz nepopolnega stanja.
 */
export function useNextStepContext(): {
  ctx: NextStepContext;
  ready: boolean;
} {
  const tripItems = useMyTripList();
  const { saved, ready: planReady } = useLastPlan();
  const { go, ready: goReady } = useGoTrip();
  const { status } = useSession();
  const [shared, setShared] = useState<{ count: number; ready: boolean }>({
    count: 0,
    ready: false,
  });

  // Lokalna znamenja shranjenih potovanj (dai:shared-plans) — reaktivno
  // po hišnem vzorcu iz my-trip/plan-store (dogodek + storage).

  useEffect(() => {
    const refresh = () =>
      setShared({ count: sharedPlans.list().length, ready: true });
    refresh();
    window.addEventListener(SHARED_PLAN_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SHARED_PLAN_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const ctx = useMemo<NextStepContext>(
    () => ({
      myTripCount: tripItems.length,
      hasCloudTrip: status === "authenticated" && shared.count > 0,
      hasPlan: (saved?.plan.days.length ?? 0) > 0,
      planDays: saved?.plan.days.length ?? 0,
      reservationCount: 0,
      confirmedCount: 0,
      goModeActive: go !== null,
    }),
    [tripItems.length, status, shared.count, saved, go]
  );

  const ready = planReady && goReady && shared.ready && status !== "loading";
  return { ctx, ready };
}

// ---------------------------------------------------------------------------
// Kartica
// ---------------------------------------------------------------------------

export function NextStepCard({
  ctx,
  surface = "home",
  className,
  ready,
}: {
  ctx: NextStepContext;
  surface?: NextStepSurface;
  className?: string;
  /** POLIR13 (2.40.0): ali se je kontekst (lokalne shrambe + seja) že
   *  ustalil. Do takrat je kartica NEVIDNA (visibility:hidden) — SSR že
   *  izriše prostor zanjo, da vstavitev po hidraciji ne porine vsebine
   *  navzdol (CLS 0,161/0,239/0,231 → ≈ 0; web.dev „Reserve space for
   *  late-loading content"). */
  ready: boolean;
}) {
  const l = useLocale();
  const reduceMotion = useReducedMotion();

  // Dismiss je sejni (sessionStorage) — bran prek useSyncExternalStore
  // (SSR-varno: strežniški posnetek = "ni skrito", po hidraciji dejansko
  // stanje; brez setState v efektu — kanon hiše po Tasku 51-a).
  const subscribeDismiss = useCallback((onStoreChange: () => void) => {
    window.addEventListener(DISMISS_EVENT, onStoreChange);
    return () => window.removeEventListener(DISMISS_EVENT, onStoreChange);
  }, []);
  const dismissed = useSyncExternalStore(
    subscribeDismiss,
    () => {
      try {
        return window.sessionStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        // sessionStorage nedosegljiv — predlog pustimo vidnega (iskreno).
        return false;
      }
    },
    () => false
  );

  const onDismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* tiho — kartico vseeno skrijemo za to sejo */
    }
    // POLIR13 (2.40.0): sejni piškotek kot STREŽNIŠKO BERLJIV zrcal
    // sessionStorage zastavice — naslednji SSR nalaganje kartico IZPUSTI
    // (brez rezervacije prostora, brez premika vsebine). Brez max-age =
    // sejen (izpade ob zaključku brskalnika); tiho ob napaki, isti kanon.
    try {
      document.cookie = "dai:next-step-dismissed=1; path=/; SameSite=Lax";
    } catch {
      /* tiho — sessionStorage zrcal že pokriva to sejo */
    }
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT));
  };

  const outcome = useMemo(() => nextStepsFor(ctx, l), [ctx, l]);
  if (!outcome) return null;

  // Površina: ne predlagaj strani, na kateri uporabnik že je —
  // povišaj sekundarni predlog (če ne cilja ista stran), sicer se skrij.
  const selfHref = SURFACE_SELF_HREF[surface];
  let primary: NextStepSuggestion = outcome.primary;
  let secondary: NextStepSuggestion | null = outcome.secondary;
  if (primary.ctaHref === selfHref) {
    if (secondary && secondary.ctaHref !== selfHref) {
      primary = secondary;
      secondary = null;
    } else {
      return null;
    }
  }

  const Icon = ICONS[primary.icon];
  const t = <K extends keyof typeof L>(k: K) =>
    pick(l, L[k][surface]);

  return (
    <section aria-live="polite" aria-label={pick(l, L.cardLabel)} className={className}>
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            // POLIR13 (2.40.0): invisible (visibility:hidden) do `ready` —
            // prostor za kartico je rezerviran ŽE v SSR (CLS ≈ 0), ni
            // interaktivna in ni v a11y drevesu, dokler kontekst ni ustrejen.
            className={!ready ? "invisible" : undefined}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
          >
            <Card className="rounded-2xl border-primary/30 bg-gradient-to-br from-primary/[0.08] via-card to-primary/[0.03] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">
                      {t("kicker")}
                    </p>
                    <p className="mt-1 text-base leading-snug font-bold sm:text-lg">
                      {primary.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {primary.body}
                    </p>

                    <div className="mt-4">
                      {/* POLIR8 (2.35.0): whitespace-normal h-auto — FR oznaka
                          „Parcourir les destinations" (251 px nowrap) je povzročala
                          16 px preliva na /nacrtuj in /trznica @320 (WCAG 1.4.10). */}
                      <Button asChild className="min-h-11 h-auto whitespace-normal font-semibold">
                        <Link href={primary.ctaHref}>
                          {primary.ctaLabel}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>

                    <p className="mt-3 border-l-2 border-primary/30 pl-3 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground/80">
                        {pick(l, L.reasonPrefix)}
                      </span>
                      {primary.reason}
                    </p>

                    {secondary && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {pick(l, L.secondaryLead)}
                        <Link
                          href={secondary.ctaHref}
                          className="inline-flex min-h-6 items-center font-semibold text-primary hover:underline"
                        >
                          {secondary.title}
                        </Link>
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={pick(l, L.dismissLabel)}
                    title={pick(l, L.dismissLabel)}
                    className="-mt-1 -mr-1 flex size-11 shrink-0 cursor-pointer items-center justify-center self-start rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
