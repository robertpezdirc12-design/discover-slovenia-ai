'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { BedDouble, Check, ChevronRight, Ear, EarOff, Map as MapIcon, MapPin, Navigation, RotateCcw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useGuideState } from '@/components/home/use-guide-state';
import { SHOW_TRIP_EVENT, speak } from '@/lib/speech';
import {
  GUIDE_EVENT,
  GUIDE_INTEREST_OPTIONS,
  GUIDE_REGIONS,
  GUIDE_STEPS,
  clearGuideState,
  emptyGuideState,
  firstUnansweredStep,
  guideSummaryChips,
  isGuideComplete,
  isStepAnswered,
  nextStepSuggestion,
  saveGuideState,
  type GuideInterest,
  type GuidePace,
  type GuideRegionId,
  type GuideState,
  type GuideStepId,
  type GuideStorage,
} from '@/lib/guide-store';

/**
 * VODENI TOK (Komoot onboarding vzorec):
 *   1) vsak odgovor se shrani trajno (localStorage) in se ne ponovi,
 *   2) ob vrnitvi tok nadaljuje na PRVEM neodgovorjenem koraku,
 *   3) vsak zaslon izreče "naslednji korak" nasvet (besedilo + glas sl-SI),
 *   4) na koncu vedno vpraša: »Želiš še eno destinacijo, ali zaključiš?«
 *
 * localStorage je ZUNANJA shramba → beremo prek useSyncExternalStore
 * (v use-guide-state.ts; mutacije = zapis + dogodek GUIDE_EVENT).
 */

const STEP_LABELS: Record<GuideStepId, string> = {
  interests: 'Interesi',
  region: 'Regija',
  days: 'Število dni',
  pace: 'Tempo',
};

/** Shramba v brskalniku (localStorage) — zamenljiva v testih. */
function browserStorage(): GuideStorage {
  return {
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => window.localStorage.removeItem(k),
  };
}

type ViewStep = GuideStepId | 'welcome' | 'done';

export function GuidedFlow() {
  const state = useGuideState();
  // uporabnikova navigacija povozi samodejni korak (null = sledi toku)
  const [userStep, setUserStep] = useState<ViewStep | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [draftInterests, setDraftInterests] = useState<GuideInterest[]>([]);
  const [draftRegion, setDraftRegion] = useState<GuideRegionId | null>(null);
  const [draftDays, setDraftDays] = useState<number>(2);
  const [draftPace, setDraftPace] = useState<GuidePace>('zmeren');
  const cardRef = useRef<HTMLDivElement | null>(null);

  const autoStep: ViewStep = state === null ? 'welcome' : (firstUnansweredStep(state) ?? 'done');
  const step: ViewStep = userStep ?? autoStep;
  const complete = state ? isGuideComplete(state) : false;

  const commit = useCallback(
    (patch: Partial<GuideState>, nextStep: ViewStep) => {
      const storage = browserStorage();
      const base: GuideState = state ?? emptyGuideState();
      const next: GuideState = {
        ...base,
        ...patch,
        answered: Array.from(new Set([...base.answered, ...(patch.answered ?? [])])),
        completedAt: nextStep === 'done' ? new Date().toISOString() : base.completedAt,
      };
      saveGuideState(storage, next);
      try {
        window.dispatchEvent(new CustomEvent(GUIDE_EVENT));
      } catch {
        /* dogodki so prijetnost */
      }
      setUserStep(nextStep);
      const s = nextStepSuggestion(next);
      speak(s.text, next.voiceEnabled);
    },
    [state],
  );

  const toggleVoice = () => {
    const storage = browserStorage();
    const next = { ...(state ?? emptyGuideState()), voiceEnabled: !(state?.voiceEnabled ?? false) };
    saveGuideState(storage, next);
    try {
      window.dispatchEvent(new CustomEvent(GUIDE_EVENT));
    } catch {
      /* prijetnost */
    }
    if (next.voiceEnabled) speak('Govorni nasveti so vklopljeni.', true);
  };

  const restart = () => {
    clearGuideState(browserStorage());
    try {
      window.dispatchEvent(new CustomEvent(GUIDE_EVENT));
    } catch {
      /* prijetnost */
    }
    setDraftInterests([]);
    setDraftRegion(null);
    setDraftDays(2);
    setDraftPace('zmeren');
    setUserStep(null);
    setDismissed(false);
  };

  /** Komoot predizpolnjevanje: pri ponovnem vstopu so odgovori že izpolnjeni. */
  const syncDrafts = (s: GuideState) => {
    setDraftInterests(s.interests);
    setDraftRegion(s.region);
    setDraftDays(s.days ?? 2);
    setDraftPace(s.pace ?? 'zmeren');
  };

  const enterStep = (target: ViewStep) => {
    if (state) syncDrafts(state);
    setUserStep(target);
  };

  const answeredCount = state ? GUIDE_STEPS.filter((s) => isStepAnswered(state, s)).length : 0;
  const progress = Math.round((answeredCount / GUIDE_STEPS.length) * 100);
  const suggestion = useMemo(
    () => nextStepSuggestion(state ?? emptyGuideState()),
    [state],
  );

  // ————— ZLOŽEN POGLED (po izrecnem zaključku) —————
  if (dismissed && state) {
    return (
      <section aria-labelledby="guide-mini" className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <Sparkles className="size-4 text-emerald-600" aria-hidden />
          <p id="guide-mini" className="text-sm font-medium">
            Tvoji odgovori so shranjeni:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {guideSummaryChips(state).map((c) => (
              <Badge key={c} variant="secondary" className="font-normal">
                {c}
              </Badge>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDismissed(false)}>
              Odpri vodič
            </Button>
            <Button size="sm" variant="ghost" onClick={restart} aria-label="Izbriši odgovore in začni znova">
              <RotateCcw className="size-4" aria-hidden />
              <span className="sr-only">Ponastavi odgovore</span>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const focusCard = () => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  return (
    <section id="vodic" aria-labelledby="guide-heading" className="mx-auto w-full scroll-mt-20 max-w-6xl px-4 sm:px-6">
      <Card ref={cardRef} className="border-emerald-600/20 bg-gradient-to-b from-emerald-600/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle id="guide-heading" className="flex items-center gap-2 text-lg">
              <Sparkles className="size-5 text-emerald-600" aria-hidden />
              {complete ? 'Tvoj vodič' : 'Vprašam le enkrat — ostalo si zapomnim'}
            </CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleVoice}
              aria-pressed={state?.voiceEnabled ?? false}
              aria-label={state?.voiceEnabled ? 'Izklopi govorne nasvete' : 'Vklopi govorne nasvete (glasovno vodenje)'}
              title={`Glasovno vodenje (sl-SI) — korak: ${STEP_LABELS[(step === 'welcome' || step === 'done') ? 'interests' : step] ?? 'vodič'}`}
            >
              {state?.voiceEnabled ? <Ear className="size-4" aria-hidden /> : <EarOff className="size-4" aria-hidden />}
            </Button>
          </div>
          {/* naslednji korak — vedno izrečen (besedilo), ob uporabi tudi glasovno */}
          <div aria-live="polite" className="text-sm text-muted-foreground">
            {suggestion.text}
          </div>
          <Progress value={progress} className="mt-2 h-1.5" aria-label={`Napredek: ${progress} %`} />
        </CardHeader>

        <CardContent>
          {step === 'welcome' && (
            <div className="space-y-4">
              {state && (
                <p className="text-sm">
                  Nadaljuj, kjer si ostal — že shranjeno:{' '}
                  {guideSummaryChips(state).map((c) => (
                    <Badge key={c} variant="secondary" className="mr-1 font-normal">
                      {c}
                    </Badge>
                  ))}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    enterStep(state ? (firstUnansweredStep(state) ?? 'done') : 'interests');
                    focusCard();
                  }}
                >
                  {state ? 'Nadaljuj' : 'Začni'}
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
                {state && (
                  <Button variant="ghost" onClick={restart}>
                    <RotateCcw className="size-4" aria-hidden />
                    Začni znova
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === 'interests' && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Kaj te zanimajo?</legend>
              <div className="flex flex-wrap gap-2">
                {GUIDE_INTEREST_OPTIONS.map((opt) => {
                  const active = draftInterests.includes(opt);
                  return (
                    <Button
                      key={opt}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      aria-pressed={active}
                      onClick={() =>
                        setDraftInterests((prev) =>
                          prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt],
                        )
                      }
                    >
                      {active && <Check className="size-3.5" aria-hidden />}
                      {opt}
                    </Button>
                  );
                })}
              </div>
              {state && isStepAnswered(state, 'interests') && (
                <p className="text-xs text-emerald-700">· odgovor shranjen prejšnjič (lahko ga spremeniš)</p>
              )}
              <Button
                disabled={draftInterests.length === 0}
                onClick={() => commit({ interests: draftInterests, answered: ['interests'] }, 'region')}
              >
                Naprej — regija
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </fieldset>
          )}

          {step === 'region' && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Katera regija te vabi?</legend>
              <RadioGroup
                value={draftRegion ?? ''}
                onValueChange={(v) => setDraftRegion(v as GuideRegionId)}
                className="grid gap-2 sm:grid-cols-2"
              >
                {GUIDE_REGIONS.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <RadioGroupItem value={r.id} id={`reg-${r.id}`} />
                    <Label htmlFor={`reg-${r.id}`} className="cursor-pointer text-sm font-normal">
                      <MapPin className="mr-1 inline size-3.5 text-emerald-600" aria-hidden />
                      {r.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {state && isStepAnswered(state, 'region') && (
                <p className="text-xs text-emerald-700">· odgovor shranjen prejšnjič</p>
              )}
              <div className="flex gap-2">
                <Button disabled={!draftRegion} onClick={() => commit({ region: draftRegion as GuideRegionId, answered: ['region'] }, 'days')}>
                  Naprej — dni
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" onClick={() => enterStep('interests')}>Nazaj</Button>
              </div>
            </fieldset>
          )}

          {step === 'days' && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Koliko dni imaš?</legend>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setDraftDays((d) => Math.max(1, d - 1))} aria-label="Manj dni">−</Button>
                <span className="min-w-12 text-center text-lg font-semibold" aria-live="polite">{draftDays}</span>
                <Button variant="outline" size="icon" onClick={() => setDraftDays((d) => Math.min(30, d + 1))} aria-label="Več dni">+</Button>
                <span className="text-sm text-muted-foreground">dni</span>
              </div>
              {state && isStepAnswered(state, 'days') && (
                <p className="text-xs text-emerald-700">· odgovor shranjen prejšnjič</p>
              )}
              <div className="flex gap-2">
                <Button onClick={() => commit({ days: draftDays, answered: ['days'] }, 'pace')}>
                  Naprej — tempo
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" onClick={() => enterStep('region')}>Nazaj</Button>
              </div>
            </fieldset>
          )}

          {step === 'pace' && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Kakšen tempo?</legend>
              <RadioGroup value={draftPace} onValueChange={(v) => setDraftPace(v as GuidePace)} className="flex flex-wrap gap-2">
                {(['počasen', 'zmeren', 'športen'] as const).map((p) => (
                  <div key={p} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <RadioGroupItem value={p} id={`pace-${p}`} />
                    <Label htmlFor={`pace-${p}`} className="cursor-pointer text-sm font-normal">
                      {p}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {state && isStepAnswered(state, 'pace') && (
                <p className="text-xs text-emerald-700">· odgovor shranjen prejšnjič</p>
              )}
              <div className="flex gap-2">
                <Button onClick={() => commit({ pace: draftPace, answered: ['pace'] }, 'done')}>
                  Zaključi nastavitve
                  <Check className="size-4" aria-hidden />
                </Button>
                <Button variant="ghost" onClick={() => enterStep('days')}>Nazaj</Button>
              </div>
            </fieldset>
          )}

          {step === 'done' && complete && state && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {guideSummaryChips(state).map((c) => (
                  <Badge key={c} variant="secondary" className="font-normal">
                    <Check className="mr-1 size-3" aria-hidden />
                    {c}
                  </Badge>
                ))}
              </div>
              {/* obvezen zaključni nasvet (izrazita želja uporabnika):
                  rezultat vodiča je VIDEN — "Moja pot" na zemljevidu;
                  "še ena destinacija" = nova REGIJA — interesi/dni/tempo ostanejo
                  shranjeni (Komootov vzorec: ne sprašujemo znova) */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    // aplikacija VODI: ob kliku se na karti SAMODEJNO odpre
                    // navigacija po poti (postanek 1) — uporabnik ni puščen
                    // pred prazno karto (izrazita želja: "se odpre navigacija")
                    try {
                      window.dispatchEvent(new Event(SHOW_TRIP_EVENT));
                    } catch {
                      /* dogodek je prijetnost */
                    }
                    document.getElementById('zemljevid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <MapIcon className="size-4" aria-hidden />
                  Pokaži tvojo pot na zemljevidu
                </Button>
                <Button variant="outline" onClick={() => { enterStep('region'); focusCard(); }}>
                  Želiš še eno destinacijo
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
                {/* vodenje naprej: po poti sledi NOČITEV — en klik do iskanja prenočišč */}
                <Button
                  variant="outline"
                  onClick={() => {
                    document.getElementById('zemljevid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    window.setTimeout(() => document.getElementById('stay-search-input')?.focus(), 650);
                  }}
                >
                  <BedDouble className="size-4" aria-hidden />
                  Dodaj prenočišče
                </Button>
                <Button variant="ghost" onClick={() => setDismissed(true)}>
                  Zaključi
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Odgovori so shranjeni na tej napravi — naslednjič vas vodič ne bo več vprašal.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
