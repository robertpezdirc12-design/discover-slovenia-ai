"use client";

import { Brain, Loader2, Undo2, Wand2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pick } from "@/lib/i18n-pick";
import { durationToMinutes } from "@/lib/itinerary-engine";
import type { ItineraryPlan } from "@/lib/types";
import { getDestination } from "@/lib/slovenia-data";
import { saveLastPlan, useLastPlan } from "@/lib/plan-store";
import type { SharedPlan } from "@/lib/shared-plan";
import type { TripStop } from "@/lib/types";

/**
 * PLAN-EDIT-PANEL — P1-B §3/§6 (issue #3): pogovorno urejanje NAČRTA z
 * determinističnimi ukazi + načrt iz osebnih preferenc.
 *
 *  - „Uredi z ukazi“: SL ukazi (dodaj/odstrani/premakni/zamenjaj/skrajšaj/
 *    podaljšaj/optimiziraj) nad ZADNJIM načrtom (dai:last-plan) prek
 *    /api/plan-edit (brezstanjska strežniška transformacija istega
 *    kanonskega modela); pokaže DIFF + povzetek, Shrani zapiše prek
 *    obstoječe poti saveLastPlan, Razveljavi vrne prejšnje stanje
 *    (undo sklad klienta, max 10);
 *  - „Iz mojih preferenc“ (prijavljeni): čipi preferenc (interesi/
 *    proračun/sezona) + en klik → obstoječi deterministični motor
 *    /api/itinerary (isti vhod → isti načrt; 0 AI).
 */

const L = {
  title: { sl: "Uredi načrt z ukazi", en: "Edit the plan with commands" },
  desc: {
    sl: "Deterministično urejanje zadnjega načrta: napiši ukaz, preglej spremembo (diff) in shrani ali razveljavi.",
    en: "Deterministic editing of the last plan: type a command, review the diff, save or undo.",
  },
  ph: { sl: "npr. dodaj Bled na dan 2", en: "e.g. add Bled to day 2" },
  run: { sl: "Izvedi", en: "Apply" },
  example: { sl: "Zgledi ukazov", en: "Example commands" },
  diffTitle: { sl: "Sprememba (diff)", en: "Change (diff)" },
  save: { sl: "Shrani v načrt", en: "Save to plan" },
  undo: { sl: "Razveljavi", en: "Undo" },
  cancel: { sl: "Prekliči", en: "Cancel" },
  saved: { sl: "Načrt shranjen ✓", en: "Plan saved ✓" },
  noPlan: {
    sl: "Najprej sestavi načrt v načrtovalniku — urejanje deluje na zadnjem načrtu.",
    en: "Build a plan in the planner first — editing works on the last plan.",
  },
  fromPrefs: { sl: "Iz mojih preferenc", en: "From my preferences" },
  fromPrefsDesc: {
    sl: "Tvoje preference sestavijo novi deterministični načrt z enim klikom (isti motor kot načrtovalnik).",
    en: "Your preferences build a new deterministic plan in one click (the same engine as the planner).",
  },
  buildFromPrefs: { sl: "Sestavi načrt iz preferenc", en: "Build plan from preferences" },
  noPrefs: {
    sl: "Nimaš še nastavljenih interesov — dodaj jih na /moj-profil.",
    en: "No interests set yet — add them on /moj-profil.",
  },
  notSavedNote: {
    sl: "Sprememba je še NEshranjena — pregledujš predlog.",
    en: "The change is NOT saved yet — you are reviewing a proposal.",
  },
} as const;

const EXAMPLES = [
  "dodaj Bled na dan 2",
  "odstrani Piran",
  "premakni Bled na dan 1",
  "zamenjaj Bled z Bohinjem",
  "podaljšaj",
  "skrajšaj",
  "optimiziraj",
] as const;

/** ItineraryPlan → SharedPlan (kanonska oblika za /api/plan-edit). */
function toSharedPlan(plan: ItineraryPlan, title: string, createdAt: string): SharedPlan {
  return {
    shareId: "",
    name: title,
    createdAt,
    days: plan.days.map((stops, i) => ({
      day: i + 1,
      title: plan.dayTitles?.[i],
      locations: stops.map((s) => ({
        name: s.name,
        ...(s.slug ? { destSlug: s.slug } : {}),
        ...(s.time ? { time: s.time } : { time: null }),
      })),
    })),
    ...(plan.totalCost > 0 ? { totalBudget: plan.totalCost } : {}),
  };
}

/** Urejen SharedPlan → ItineraryPlan (POSTANEK iz registra ohrani vse
 *  metapodatke obstoječih postankov; novi postanki so iskreni iz registra). */
function fromSharedPlan(
  next: SharedPlan,
  prev: ItineraryPlan,
  title: string,
  summary: string,
  coverageNote: string
): ItineraryPlan {
  const prevBySlug = new Map<string, TripStop>();
  for (const s of prev.days.flat()) {
    if (s.slug) prevBySlug.set(s.slug, s);
  }
  const stopFrom = (loc: { name: string; destSlug?: string; time?: string | null }): TripStop => {
    if (loc.destSlug) {
      const kept = prevBySlug.get(loc.destSlug);
      if (kept) return { ...kept, time: loc.time ?? kept.time };
      const dest = getDestination(loc.destSlug);
      if (dest) {
        return {
          id: dest.slug,
          name: dest.name,
          time: loc.time ?? null,
          durationMin: durationToMinutes(dest.duration),
          cost: dest.costPerPerson,
          kind: dest.type,
          coords: dest.coords,
          slug: dest.slug,
          region: dest.region,
        };
      }
    }
    return {
      id: `custom-${loc.name}`,
      name: loc.name,
      time: loc.time ?? null,
      durationMin: 60,
      cost: 0,
      kind: "custom",
    };
  };
  const days = next.days.map((d) => d.locations.map(stopFrom));
  const allStops = days.flat();
  return {
    days,
    title,
    summary,
    totalCost: allStops.reduce((n, s) => n + s.cost, 0),
    coverageNote,
    dayTitles: next.days.map((d, i) => {
      const head = d.locations[0]?.name ?? "";
      return `Dan ${i + 1}${head ? " · " + head : ""}`;
    }),
  };
}

interface EditResponse {
  ok: boolean;
  error?: string;
  plan?: SharedPlan;
  diffText?: string;
  summary?: string;
}

interface PrefsResponse {
  preferences: { key: string; value: string }[];
  personalization: "on" | "off";
}

export function PlanEditPanel() {
  const l = useLocale();
  const t = useCallback(
    <K extends keyof typeof L>(k: K): (typeof L[K])["sl"] => pick(l, L[k]),
    [l]
  );
  const { status } = useSession();
  const { saved, ready } = useLastPlan();

  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<EditResponse | null>(null);
  const [undoStack, setUndoStack] = useState<ItineraryPlan[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<PrefsResponse | null>(null);
  const [prefBusy, setPrefBusy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) setPrefs((await res.json()) as PrefsResponse);
      } catch {
        // tiho — plošča deluje tudi brez preferenc (iskrena odsotnost)
      }
    })();
  }, [status]);

  const prefValues = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of prefs?.preferences ?? []) map.set(p.key, p.value);
    const parse = (key: string): string | string[] | null => {
      const raw = map.get(key);
      if (!raw) return null;
      try {
        const v = JSON.parse(raw);
        if (typeof v === "string") return v;
        if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
      } catch {
        /* pokvarjen zapis iskreno ignoriramo */
      }
      return null;
    };
    return {
      interests: parse("interests"),
      budget: parse("budget"),
      season: parse("season"),
      enabled: prefs?.personalization === "on",
    };
  }, [prefs]);

  const runCommand = useCallback(async () => {
    if (!saved || command.trim().length === 0) return;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const shared = toSharedPlan(saved.plan, saved.plan.title, saved.savedAt);
      const res = await fetch("/api/plan-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: shared, command: command.trim() }),
      });
      const data = (await res.json()) as EditResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Ukaza ni bilo mogoče izvesti.");
        return;
      }
      setProposal(data);
    } catch {
      setError("Ukaza ni bilo mogoče izvesti.");
    } finally {
      setBusy(false);
    }
  }, [command, saved]);

  const saveProposal = useCallback(() => {
    if (!saved || !proposal?.plan) return;
    setUndoStack((prev) => [...prev.slice(-9), saved.plan]);
    const nextPlan = fromSharedPlan(
      proposal.plan,
      saved.plan,
      saved.plan.title,
      saved.plan.summary,
      saved.plan.coverageNote
    );
    saveLastPlan(nextPlan);
    setProposal(null);
    setCommand("");
    setFlash(t("saved"));
    setTimeout(() => setFlash(null), 2500);
  }, [proposal, saved, t]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      const last = prev[prev.length - 1];
      if (last) saveLastPlan(last);
      return prev.slice(0, -1);
    });
    setProposal(null);
    setFlash(t("undo"));
    setTimeout(() => setFlash(null), 2500);
  }, [t]);

  const buildFromPrefs = useCallback(async () => {
    const interests = Array.isArray(prefValues.interests) ? prefValues.interests : [];
    if (interests.length === 0) return;
    setPrefBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests,
          days: Math.min(5, Math.max(1, saved?.plan.days.length ?? 3)),
          ...(typeof prefValues.budget === "string" ? { budget: prefValues.budget } : {}),
          ...(typeof prefValues.season === "string" && prefValues.season !== "any"
            ? { season: prefValues.season }
            : {}),
          locale: l === "en" ? "en" : "sl",
        }),
      });
      if (!res.ok) {
        setError("Načrta iz preferenc ni bilo mogoče sestaviti.");
        return;
      }
      const plan = (await res.json()) as ItineraryPlan;
      if (saved) setUndoStack((prev) => [...prev.slice(-9), saved.plan]);
      saveLastPlan(plan);
      setFlash(t("saved"));
      setTimeout(() => setFlash(null), 2500);
    } catch {
      setError("Načrta iz preferenc ni bilo mogoče sestaviti.");
    } finally {
      setPrefBusy(false);
    }
  }, [l, prefValues, saved, t]);

  if (!ready) return null;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" aria-hidden />
          {t("title")}
        </CardTitle>
        <CardDescription className="max-w-2xl leading-relaxed">
          {t("desc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* §3: načrt iz osebnih preferenc (prijavljeni, interesi prisotni) */}
        {status === "authenticated" && prefValues.enabled && (
          <div className="rounded-lg border p-3 sm:p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-primary" aria-hidden />
              {t("fromPrefs")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("fromPrefsDesc")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t("fromPrefs")}>
              {(Array.isArray(prefValues.interests) ? prefValues.interests : []).map((w) => (
                <Badge key={w} variant="secondary">{w}</Badge>
              ))}
              {typeof prefValues.budget === "string" && (
                <Badge variant="outline">{prefValues.budget}</Badge>
              )}
              {typeof prefValues.season === "string" && prefValues.season !== "any" && (
                <Badge variant="outline">{prefValues.season}</Badge>
              )}
            </div>
            {Array.isArray(prefValues.interests) && prefValues.interests.length > 0 ? (
              <Button
                size="sm"
                className="mt-3 min-h-11"
                disabled={prefBusy}
                onClick={() => void buildFromPrefs()}
              >
                {prefBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Wand2 className="h-4 w-4" aria-hidden />
                )}
                {t("buildFromPrefs")}
              </Button>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("noPrefs")}</p>
            )}
          </div>
        )}

        {/* §6: ukazno urejanje */}
        {!saved ? (
          <p className="text-sm text-muted-foreground">{t("noPlan")}</p>
        ) : (
          <>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void runCommand();
              }}
            >
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={t("ph")}
                className="h-11"
                aria-label={t("title")}
                maxLength={200}
              />
              <Button
                type="submit"
                className="min-h-11"
                disabled={busy || command.trim().length === 0}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Wand2 className="h-4 w-4" aria-hidden />
                )}
                {t("run")}
              </Button>
            </form>
            <div className="flex flex-wrap gap-1.5" aria-label={t("example")}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="min-h-9 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                  onClick={() => setCommand(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {flash && (
              <p aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {flash}
              </p>
            )}

            {proposal?.ok && proposal.plan && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 sm:p-4" role="status">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {t("diffTitle")}
                </p>
                <p className="mt-1 text-sm font-medium">{proposal.summary}</p>
                <p className="mt-1 text-sm text-muted-foreground">{proposal.diffText}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("notSavedNote")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className="min-h-11" onClick={saveProposal}>
                    {t("save")}
                  </Button>
                  <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setProposal(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            )}

            {undoStack.length > 0 && (
              <Button size="sm" variant="outline" className="min-h-11" onClick={undo}>
                <Undo2 className="h-4 w-4" aria-hidden />
                {t("undo")} ({undoStack.length})
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
