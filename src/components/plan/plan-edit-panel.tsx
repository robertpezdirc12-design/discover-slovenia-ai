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
  title: { sl: "Uredi načrt z ukazi", en: "Edit the plan with commands", it: "Modifica il piano con i comandi", de: "Plan mit Befehlen bearbeiten", fr: "Modifie le plan avec des commandes", es: "Edita el plan con comandos" },
  desc: {
    sl: "Deterministično urejanje zadnjega načrta: napiši ukaz, preglej spremembo (diff) in shrani ali razveljavi.",
    en: "Deterministic editing of the last plan: type a command, review the diff, save or undo.",
    it: "Modifica deterministica dell’ultimo piano: scrivi un comando, rivedi il diff, salva o annulla.",
    de: "Deterministische Bearbeitung des letzten Plans: gib einen Befehl ein, prüfe den Diff, speichere oder mache rückgängig.",
    fr: "Édition déterministe du dernier plan : saisis une commande, révise le diff, enregistre ou annule.",
    es: "Edición determinista del último plan: escribe un comando, revisa el diff, guarda o deshaz.",
  },
  ph: { sl: "npr. dodaj Bled na dan 2", en: "e.g. add Bled to day 2", it: "es. aggiungi Bled al giorno 2", de: "z. B. füge Bled zu Tag 2 hinzu", fr: "ex. ajoute Bled au jour 2", es: "p. ej. añade Bled al día 2" },
  run: { sl: "Izvedi", en: "Apply", it: "Applica", de: "Ausführen", fr: "Appliquer", es: "Aplicar" },
  example: { sl: "Zgledi ukazov", en: "Example commands", it: "Esempi di comandi", de: "Beispielbefehle", fr: "Exemples de commandes", es: "Ejemplos de comandos" },
  diffTitle: { sl: "Sprememba (diff)", en: "Change (diff)", it: "Modifica (diff)", de: "Änderung (Diff)", fr: "Modification (diff)", es: "Cambio (diff)" },
  save: { sl: "Shrani v načrt", en: "Save to plan", it: "Salva nel piano", de: "Im Plan speichern", fr: "Enregistrer dans le plan", es: "Guardar en el plan" },
  undo: { sl: "Razveljavi", en: "Undo", it: "Ripristina", de: "Rückgängig", fr: "Annuler", es: "Deshacer" },
  cancel: { sl: "Prekliči", en: "Cancel", it: "Annulla", de: "Abbrechen", fr: "Abandonner", es: "Cancelar" },
  saved: { sl: "Načrt shranjen ✓", en: "Plan saved ✓", it: "Piano salvato ✓", de: "Plan gespeichert ✓", fr: "Plan enregistré ✓", es: "Plan guardado ✓" },
  noPlan: {
    sl: "Najprej sestavi načrt v načrtovalniku — urejanje deluje na zadnjem načrtu.",
    en: "Build a plan in the planner first — editing works on the last plan.",
    it: "Crea prima un piano nel pianificatore — la modifica agisce sull’ultimo piano.",
    de: "Baue zuerst einen Plan im Planer — die Bearbeitung wirkt auf den letzten Plan.",
    fr: "Crée d’abord un plan dans le planificateur — l’édition agit sur le dernier plan.",
    es: "Crea primero un plan en el planificador — la edición actúa sobre el último plan.",
  },
  fromPrefs: { sl: "Iz mojih preferenc", en: "From my preferences", it: "Dalle mie preferenze", de: "Aus meinen Präferenzen", fr: "À partir de mes préférences", es: "A partir de mis preferencias" },
  fromPrefsDesc: {
    sl: "Tvoje preference sestavijo novi deterministični načrt z enim klikom (isti motor kot načrtovalnik).",
    en: "Your preferences build a new deterministic plan in one click (the same engine as the planner).",
    it: "Le tue preferenze costruiscono un nuovo piano deterministico in un clic (lo stesso motore del pianificatore).",
    de: "Deine Präferenzen bauen mit einem Klick einen neuen deterministischen Plan (dieselbe Engine wie im Planer).",
    fr: "Tes préférences construisent un nouveau plan déterministe en un clic (le même moteur que le planificateur).",
    es: "Tus preferencias crean un nuevo plan determinista en un clic (el mismo motor que el planificador).",
  },
  buildFromPrefs: { sl: "Sestavi načrt iz preferenc", en: "Build plan from preferences", it: "Crea il piano dalle preferenze", de: "Plan aus Präferenzen erstellen", fr: "Créer le plan à partir des préférences", es: "Crear plan a partir de las preferencias" },
  noPrefs: {
    sl: "Nimaš še nastavljenih interesov — dodaj jih na /moj-profil.",
    en: "No interests set yet — add them on /moj-profil.",
    it: "Non hai ancora interessi impostati — aggiungili su /moj-profil.",
    de: "Noch keine Interessen gesetzt — füge sie auf /moj-profil hinzu.",
    fr: "Tu n’as pas encore d’intérêts définis — ajoute-les sur /moj-profil.",
    es: "Aún no tienes intereses definidos — añádelos en /moj-profil.",
  },
  notSavedNote: {
    sl: "Sprememba je še NEshranjena — pregledujš predlog.",
    en: "The change is NOT saved yet — you are reviewing a proposal.",
    it: "La modifica NON è ancora salvata — stai esaminando una proposta.",
    de: "Die Änderung ist noch NICHT gespeichert — du prüfst einen Vorschlag.",
    fr: "La modification n’est PAS encore enregistrée — tu examines une proposition.",
    es: "El cambio aún NO está guardado — estás revisando una propuesta.",
  },
  errCommand: { sl: "Ukaza ni bilo mogoče izvesti.", en: "The command could not be applied.", it: "Non è stato possibile eseguire il comando.", de: "Der Befehl konnte nicht ausgeführt werden.", fr: "La commande n’a pas pu être exécutée.", es: "No se pudo ejecutar el comando." },
  errPrefs: { sl: "Načrta iz preferenc ni bilo mogoče sestaviti.", en: "A plan from your preferences could not be built.", it: "Non è stato possibile creare il piano dalle preferenze.", de: "Der Plan konnte nicht aus den Präferenzen erstellt werden.", fr: "Le plan n’a pas pu être créé à partir des préférences.", es: "No se pudo crear el plan a partir de las preferencias." },
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
        setError(data.error ?? t("errCommand"));
        return;
      }
      setProposal(data);
    } catch {
      setError(t("errCommand"));
    } finally {
      setBusy(false);
    }
  }, [command, saved, t]);

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
        setError(t("errPrefs"));
        return;
      }
      const plan = (await res.json()) as ItineraryPlan;
      if (saved) setUndoStack((prev) => [...prev.slice(-9), saved.plan]);
      saveLastPlan(plan);
      setFlash(t("saved"));
      setTimeout(() => setFlash(null), 2500);
    } catch {
      setError(t("errPrefs"));
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
