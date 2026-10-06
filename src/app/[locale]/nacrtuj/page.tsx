"use client";

import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Footprints,
  Loader2,
  Plus,
  Printer,
  Route as RouteIcon,
  Save,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { StopKindIcon } from "@/components/plan/plan-bits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import {
  formatDuration,
  formatMoney,
  interestChips,
  roadKm,
  round5,
  travelMinutes,
  type PlannerLang,
} from "@/lib/itinerary-engine";
import { myTrip } from "@/lib/my-trip";
import { saveLastPlan } from "@/lib/plan-store";
import { normalizeInterests, REGIONS, regionLabel, typeLabel } from "@/lib/slovenia-data";
import type { Budget, Season } from "@/lib/slovenia-data";
import type { ItineraryPlan, TripStop } from "@/lib/types";

/**
 * /nacrtuj — DETERMINISTIČNI načrtovalnik (faza 45-d).
 *
 * Obrazec (interesni čipi iz activities ∪ bestFor, dnevi 1–5, regija,
 * sezona, proračun) → POST /api/itinerary → prikaz načrta s časovnico,
 * skupno ceno in izhodi: Shrani v Moja pot / Zaženi na poti / Natisni.
 * Isti vhod vedno da isti načrt (0 AI žetonov).
 */

const POPULAR_CHIPS = 24;

// ---------------------------------------------------------------------------
// Oznake (L vzorec — kanon izvirnika)
// ---------------------------------------------------------------------------

const L = {
  kicker: { sl: "Načrtuj", en: "Plan" },
  title: { sl: "Načrtuj svojo pot po Sloveniji", en: "Plan your journey across Slovenia" },
  lead: {
    sl: "Izberi želje — deterministični motor sestavi dnevni načrt iz kanonskih podatkov 38 destinacij. Isti vhod vedno da isti načrt (0 AI žetonov, 0 presenečenj).",
    en: "Pick your wishes — the deterministic engine builds a day plan from the canonical data of 38 destinations. The same input always yields the same plan (0 AI tokens, 0 surprises).",
  },
  formTitle: { sl: "Kaj želiš doživeti?", en: "What do you want to experience?" },
  formLead: {
    sl: "Izberi interese (čipi iz dejanskih podatkov destinacij) ali napiši svoje — nato sestavi načrt.",
    en: "Pick interests (chips from actual destination data) or write your own — then build the plan.",
  },
  interestsLabel: { sl: "Interesi", en: "Interests" },
  customLabel: {
    sl: "Ali napiši svoje želje (loči z vejico)",
    en: "Or write your own wishes (comma-separated)",
  },
  customAdd: { sl: "Dodaj", en: "Add" },
  customPlaceholder: { sl: "npr. jezero, družina, kremšnita", en: "e.g. lake, family, cream cake" },
  searchChips: { sl: "Išči med čipi …", en: "Search chips …" },
  showAll: { sl: "Pokaži vse", en: "Show all" },
  showLess: { sl: "Pokaži manj", en: "Show less" },
  remove: { sl: "Odstrani", en: "Remove" },
  daysLabel: { sl: "Število dni", en: "Number of days" },
  fewerDays: { sl: "Manj dni", en: "Fewer days" },
  moreDays: { sl: "Več dni", en: "More days" },
  daysUnit: { sl: "dni", en: "days" },
  regionLabel: { sl: "Regija", en: "Region" },
  regionAny: { sl: "Vse regije", en: "All regions" },
  seasonLabel: { sl: "Sezona (prednost)", en: "Season (preference)" },
  seasonAny: { sl: "Katera koli", en: "Any" },
  budgetLabel: { sl: "Proračun na postanek", en: "Budget per stop" },
  budgetAny: { sl: "Brez omejitve", en: "No limit" },
  generate: { sl: "Sestavi načrt", en: "Build the plan" },
  generating: { sl: "Sestavljam …", en: "Building …" },
  pickInterest: {
    sl: "Izberi ali napiši vsaj en interes.",
    en: "Pick or write at least one interest.",
  },
  networkError: { sl: "Omrežna napaka — poskusi znova.", en: "Network error — please try again." },
  presetsTitle: { sl: "Hitre prednastavitve", en: "Quick presets" },
  presetsLead: {
    sl: "Trije preizkušeni izhodi — en klik in načrt je tu.",
    en: "Three proven starting points — one click and the plan is here.",
  },
  usePreset: { sl: "Uporabi", en: "Use" },
  planTitle: { sl: "Tvoj načrt", en: "Your plan" },
  totalCost: { sl: "skupaj na osebo", en: "total per person" },
  coverage: { sl: "Pokritje", en: "Coverage" },
  driveEstimate: { sl: "ocena vožnje", en: "drive estimate" },
  duration: { sl: "trajanje", en: "duration" },
  cost: { sl: "cena", en: "cost" },
  free: { sl: "brezplačno", en: "free" },
  save: { sl: "Shrani v Moja pot", en: "Save to My trip" },
  saved: { sl: "Shranjeno v Moja pot", en: "Saved to My trip" },
  go: { sl: "Zaženi na poti", en: "Start on the road" },
  print: { sl: "Izpiši / natisni", en: "Print" },
  openJourney: { sl: "Odpri potovanje", en: "Open the journey" },
  emptyTitle: { sl: "Načrt še ni sestavljen", en: "No plan yet" },
  emptyBody: {
    sl: "Izberi vsaj en interes in pritisni „Sestavi načrt“ — ali pa uporabi prednastavitev.",
    en: "Pick at least one interest and press “Build the plan” — or use a preset.",
  },
  errorTitle: { sl: "Načrta ni bilo mogoče sestaviti", en: "The plan could not be built" },
  retry: { sl: "Poskusi znova", en: "Try again" },
  deterministic: {
    sl: "Deterministični motor: isti vhod → isti izhod; vsi časi in cene izhajajo iz realnih podatkov destinacij (vožnje so ocene ~60 km/h).",
    en: "Deterministic engine: same input → same output; all times and prices come from real destination data (drives are ~60 km/h estimates).",
  },
  selectedInterests: { sl: "Izbrani interesi", en: "Selected interests" },
  noChipsFound: { sl: "Noben čip ne ustreza iskanju.", en: "No chips match your search." },
  stopsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : "postankov"}`,
    en: (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`,
  },
  daysWord: {
    sl: (n: number) => `${n} ${n === 1 ? "dan" : n === 2 ? "dneva" : "dni"}`,
    en: (n: number) => `${n} ${n === 1 ? "day" : n === 2 ? "days" : "days"}`,
  },
  regionsWord: {
    sl: (n: number) => `${n} ${n === 1 ? "regija" : n === 2 ? "regiji" : n <= 4 ? "regije" : "regij"}`,
    en: (n: number) => `${n} ${n === 1 ? "region" : "regions"}`,
  },
} as const;

const SEASONS: { value: Season; sl: string; en: string }[] = [
  { value: "spring", sl: "Pomlad", en: "Spring" },
  { value: "summer", sl: "Poletje", en: "Summer" },
  { value: "autumn", sl: "Jesen", en: "Autumn" },
  { value: "winter", sl: "Zima", en: "Winter" },
];

const BUDGETS: { value: Budget; sl: string; en: string }[] = [
  { value: "€", sl: "Najceneje (€)", en: "Cheapest (€)" },
  { value: "€€", sl: "Zmerno (€€)", en: "Moderate (€€)" },
  { value: "€€€", sl: "Brez omejitve (€€€)", en: "No limit (€€€)" },
];

interface PresetDef {
  id: string;
  days: number;
  interests: string[];
  season?: Season;
  region?: string;
  budget?: Budget;
  title: { sl: string; en: string };
  body: { sl: string; en: string };
}

const PRESETS: PresetDef[] = [
  {
    id: "mirni-vikend-reka",
    days: 2,
    interests: ["reka", "mir", "sprehod", "narava"],
    title: { sl: "Miren vikend ob reki", en: "A calm weekend by the river" },
    body: {
      sl: "Počasen tempo: reka, sprehodi in lokalna hrana.",
      en: "Slow pace: the river, walks and local food.",
    },
  },
  {
    id: "druzinski-izlet",
    days: 1,
    interests: ["družina", "jezero", "sprehod"],
    title: { sl: "Družinski izlet danes", en: "Family day trip today" },
    body: {
      sl: "Krajše razdalje, varne atrakcije, sladki zastanki.",
      en: "Shorter distances, safe sights, sweet stops.",
    },
  },
  {
    id: "romantika-vino",
    days: 2,
    interests: ["romantika", "vino", "hrana", "sončni zahod"],
    season: "autumn",
    title: { sl: "Romantičen vikend z vinom", en: "Romantic wine weekend" },
    body: {
      sl: "Vinske gorice, razgledi in večerja za dva.",
      en: "Wine hills, viewpoints and dinner for two.",
    },
  },
];

// ---------------------------------------------------------------------------
// Stran
// ---------------------------------------------------------------------------

export default function PlanPage() {
  const l = useLocale();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader kicker={pick(l, L.kicker)} title={pick(l, L.title)} lead={pick(l, L.lead)} />
      <Suspense fallback={<PlannerSkeleton />}>
        <PlannerApp />
      </Suspense>
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-hidden="true">
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

interface FormState {
  interests: string[];
  days: number;
  region: string;
  season: string;
  budget: string;
}

function PlannerApp() {
  const l = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang: PlannerLang = l === "en" ? "en" : "sl";

  const chips = useMemo(() => interestChips(), []);
  const chipLabels = useMemo(() => new Set(chips.map((c) => c.label)), [chips]);

  const [form, setForm] = useState<FormState>({
    interests: [],
    days: 2,
    region: "all",
    season: "any",
    budget: "any",
  });
  const [customInput, setCustomInput] = useState("");
  const [chipSearch, setChipSearch] = useState("");
  const [showAllChips, setShowAllChips] = useState(false);
  const [plan, setPlan] = useState<ItineraryPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const startedRef = React.useRef(false);

  const generate = useCallback(
    async (f: FormState) => {
      if (f.interests.length === 0) {
        setError(pick(l, L.pickInterest));
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/itinerary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interests: f.interests,
            days: f.days,
            region: f.region !== "all" ? f.region : undefined,
            season: f.season !== "any" ? f.season : undefined,
            budget: f.budget !== "any" ? f.budget : undefined,
            locale: lang,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : `HTTP ${res.status}`);
          return;
        }
        setPlan(data as ItineraryPlan);
        setSavedMsg(false);
        requestAnimationFrame(() => {
          document.getElementById("nacrt-rezultat")?.scrollIntoView({ behavior: "smooth" });
        });
      } catch {
        setError(pick(l, L.networkError));
      } finally {
        setLoading(false);
      }
    },
    [lang, l]
  );

  // ?preset= (izhodi s starih strani/domov) → enkratna prednaloga + generiranje.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const preset = PRESETS.find((p) => p.id === searchParams.get("preset"));
    if (preset) {
      const next: FormState = {
        interests: preset.interests,
        days: preset.days,
        region: preset.region ?? "all",
        season: preset.season ?? "any",
        budget: preset.budget ?? "any",
      };
      setForm(next);
      void generate(next);
    }
  }, []);

  const toggleInterest = (label: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(label)
        ? f.interests.filter((x) => x !== label)
        : [...f.interests, label],
    }));
  };

  const addCustomInterests = () => {
    const added = normalizeInterests(customInput);
    if (added.length === 0) return;
    setForm((f) => ({ ...f, interests: [...new Set([...f.interests, ...added])] }));
    setCustomInput("");
  };

  const applyPreset = (preset: PresetDef) => {
    const next: FormState = {
      interests: preset.interests,
      days: preset.days,
      region: preset.region ?? "all",
      season: preset.season ?? "any",
      budget: preset.budget ?? "any",
    };
    setForm(next);
    void generate(next);
  };

  const visibleChips = useMemo(() => {
    const q = chipSearch.trim().toLowerCase();
    const filtered = q ? chips.filter((c) => c.label.toLowerCase().includes(q)) : chips;
    return showAllChips || q ? filtered : filtered.slice(0, POPULAR_CHIPS);
  }, [chips, chipSearch, showAllChips]);

  const saveToMyTrip = () => {
    if (!plan) return;
    for (const stop of plan.days.flat()) {
      if (stop.slug) myTrip.add(stop.slug, stop.name, "destination", "nacrtuj");
    }
    saveLastPlan(plan);
    setSavedMsg(true);
  };

  const startGo = () => {
    if (!plan) return;
    saveLastPlan(plan);
    // Locale-zavedajoči push (iz @/i18n/navigation) — /en prefix se ohrani.
    router.push("/na-poti?start=1");
  };

  return (
    <>
      {/* PREDNASTAVITVE */}
      <section className="mt-10" aria-labelledby="prednastavitve">
        <h2 id="prednastavitve" className="text-xl font-bold tracking-tight">
          {pick(l, L.presetsTitle)}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{pick(l, L.presetsLead)}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={loading}
              className="group flex min-h-36 flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              <div>
                <h3 className="text-sm font-bold leading-snug group-hover:text-primary">
                  {p.title[lang]}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.body[lang]}</p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <Wand2 className="size-3.5" aria-hidden="true" />
                {pick(l, L.usePreset)} · {L.daysWord[lang](p.days)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* OBRAZEC */}
      <Card className="mt-8" id="nacrtuj-obrazec">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            {pick(l, L.formTitle)}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{pick(l, L.formLead)}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Izbrani interesi */}
          {form.interests.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {pick(l, L.selectedInterests)} ({form.interests.length})
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {form.interests.map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => toggleInterest(label)}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {label}
                      <X className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        {pick(l, L.remove)}: {label}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prosti vnos */}
          <div>
            <Label htmlFor="interests-custom">{pick(l, L.customLabel)}</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="interests-custom"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomInterests();
                  }
                }}
                placeholder={pick(l, L.customPlaceholder)}
                className="min-h-11 flex-1"
              />
              <Button type="button" variant="secondary" onClick={addCustomInterests} className="min-h-11">
                <Plus className="size-4" aria-hidden="true" />
                {pick(l, L.customAdd)}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Čipi */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="chip-search">{pick(l, L.interestsLabel)}</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="chip-search"
                  value={chipSearch}
                  onChange={(e) => setChipSearch(e.target.value)}
                  placeholder={pick(l, L.searchChips)}
                  className="h-9 w-56 pl-8"
                />
              </div>
            </div>
            <div
              className={`scrollbar-slim mt-3 flex flex-wrap gap-2 overflow-y-auto pr-1 ${
                showAllChips || chipSearch ? "max-h-96" : "max-h-44"
              }`}
            >
              {visibleChips.length === 0 && (
                <p className="text-sm text-muted-foreground">{pick(l, L.noChipsFound)}</p>
              )}
              {visibleChips.map((chip) => {
                const active = form.interests.includes(chip.label);
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => toggleInterest(chip.label)}
                    aria-pressed={active}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      active
                        ? "border-primary/50 bg-primary/10 font-medium text-primary"
                        : "bg-background text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {chip.label}
                    <span className="text-xs text-muted-foreground" aria-hidden="true">
                      {chip.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {!chipSearch && chips.length > POPULAR_CHIPS && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 min-h-11"
                onClick={() => setShowAllChips((v) => !v)}
              >
                {showAllChips ? (
                  <>
                    <ChevronUp className="size-4" aria-hidden="true" />
                    {pick(l, L.showLess)}
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" aria-hidden="true" />
                    {pick(l, L.showAll)} ({chips.length})
                  </>
                )}
              </Button>
            )}
          </div>

          <Separator />

          {/* Dnevi + filtri */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="days-stepper">{pick(l, L.daysLabel)}</Label>
              <div
                id="days-stepper"
                className="mt-2 flex items-center gap-2"
                role="group"
                aria-label={pick(l, L.daysLabel)}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setForm((f) => ({ ...f, days: Math.max(1, f.days - 1) }))}
                  disabled={form.days <= 1}
                >
                  <span aria-hidden="true">−</span>
                  <span className="sr-only">{pick(l, L.fewerDays)}</span>
                </Button>
                <span className="min-w-16 text-center text-lg font-bold tabular-nums">
                  {form.days}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {pick(l, L.daysUnit)}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setForm((f) => ({ ...f, days: Math.min(5, f.days + 1) }))}
                  disabled={form.days >= 5}
                >
                  <span aria-hidden="true">+</span>
                  <span className="sr-only">{pick(l, L.moreDays)}</span>
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="region-select">{pick(l, L.regionLabel)}</Label>
              <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                <SelectTrigger id="region-select" className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{pick(l, L.regionAny)}</SelectItem>
                  {Object.entries(REGIONS).map(([id, r]) => (
                    <SelectItem key={id} value={id}>
                      {lang === "en" ? r.en : r.sl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="season-select">{pick(l, L.seasonLabel)}</Label>
              <Select value={form.season} onValueChange={(v) => setForm((f) => ({ ...f, season: v }))}>
                <SelectTrigger id="season-select" className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{pick(l, L.seasonAny)}</SelectItem>
                  {SEASONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {lang === "en" ? s.en : s.sl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="budget-select">{pick(l, L.budgetLabel)}</Label>
              <Select value={form.budget} onValueChange={(v) => setForm((f) => ({ ...f, budget: v }))}>
                <SelectTrigger id="budget-select" className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{pick(l, L.budgetAny)}</SelectItem>
                  {BUDGETS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {lang === "en" ? b.en : b.sl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="min-h-12 w-full text-base sm:w-auto"
            onClick={() => void generate(form)}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                {pick(l, L.generating)}
              </>
            ) : (
              <>
                <Wand2 className="size-5" aria-hidden="true" />
                {pick(l, L.generate)}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* NAPAKA */}
      {error && (
        <Alert variant="destructive" className="mt-6" role="alert">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>{pick(l, L.errorTitle)}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" className="min-h-9" onClick={() => void generate(form)}>
              {pick(l, L.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* REZULTAT */}
      <section id="nacrt-rezultat" className="mt-10 scroll-mt-24" aria-live="polite">
        {loading && !plan && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {!loading && !plan && !error && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <RouteIcon className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="font-semibold">{pick(l, L.emptyTitle)}</p>
              <p className="max-w-md text-sm text-muted-foreground">{pick(l, L.emptyBody)}</p>
            </CardContent>
          </Card>
        )}

        {plan && (
          <PlanResult
            plan={plan}
            lang={lang}
            saved={savedMsg}
            onSave={saveToMyTrip}
            onGo={startGo}
          />
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prikaz načrta: povzetek + dnevi s časovnico
// ---------------------------------------------------------------------------

function PlanResult({
  plan,
  lang,
  saved,
  onSave,
  onGo,
}: {
  plan: ItineraryPlan;
  lang: PlannerLang;
  saved: boolean;
  onSave: () => void;
  onGo: () => void;
}) {
  const l = useLocale();
  const allStops = plan.days.flat();
  const regions = new Set(allStops.map((s) => s.region).filter(Boolean));

  return (
    <div>
      {/* Povzetek trak */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight">{plan.title}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {plan.summary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <RouteIcon className="size-3.5" aria-hidden="true" />
                {L.daysWord[lang](plan.days.length)}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {L.stopsWord[lang](allStops.length)}
              </Badge>
              {regions.size > 0 && (
                <Badge variant="secondary">{L.regionsWord[lang](regions.size)}</Badge>
              )}
              <Badge className="gap-1 bg-primary text-primary-foreground">
                {formatMoney(plan.totalCost, lang)}
                <span className="font-normal opacity-80">{pick(l, L.totalCost)}</span>
              </Badge>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold">{pick(l, L.coverage)}: </span>
            {plan.coverageNote}
          </p>
        </CardContent>
      </Card>

      {/* Dnevi s časovnico */}
      <div className="mt-6 space-y-6">
        {plan.days.map((stops, dayIdx) => {
          const dayTitle =
            plan.dayTitles?.[dayIdx] ?? (lang === "en" ? `Day ${dayIdx + 1}` : `Dan ${dayIdx + 1}`);
          const dayCost = stops.reduce((s, x) => s + x.cost, 0);
          return (
            <Card key={dayIdx}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{dayTitle}</CardTitle>
                  <Badge variant="outline" className="gap-1">
                    {formatMoney(dayCost, lang)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ol>
                  {stops.map((stop, i) => (
                    <li key={stop.id}>
                      {i > 0 && <LegRow prev={stops[i - 1]} stop={stop} lang={lang} />}
                      <StopRow stop={stop} lang={lang} />
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Akcije */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" size="lg" className="min-h-12" onClick={onSave}>
          {saved ? (
            <>
              <CircleCheck className="size-5" aria-hidden="true" />
              {pick(l, L.saved)}
            </>
          ) : (
            <>
              <Save className="size-5" aria-hidden="true" />
              {pick(l, L.save)}
            </>
          )}
        </Button>
        <Button type="button" size="lg" variant="secondary" className="min-h-12" onClick={onGo}>
          <Footprints className="size-5" aria-hidden="true" />
          {pick(l, L.go)}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-12"
          onClick={() => window.print()}
        >
          <Printer className="size-5" aria-hidden="true" />
          {pick(l, L.print)}
        </Button>
        <Button asChild type="button" size="lg" variant="ghost" className="min-h-12">
          <Link href="/potovanje">
            {pick(l, L.openJourney)}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {pick(l, L.deterministic)}
      </p>
    </div>
  );
}

/** Noga vožnje med postankoma (iskrena ocena, vir: hevristika). */
function LegRow({
  prev,
  stop,
  lang,
}: {
  prev: TripStop;
  stop: TripStop;
  lang: PlannerLang;
}) {
  const l = useLocale();
  if (!prev.coords || !stop.coords) return null;
  const km = round5(roadKm(prev.coords, stop.coords));
  const min = travelMinutes(prev.coords, stop.coords);
  const label = pick(l, L.driveEstimate);
  return (
    <div className="flex items-center gap-3 py-2 pl-4 sm:pl-6" aria-label={`${label}: ~${km} km, ~${min} min`}>
      <span className="h-6 w-px bg-border" aria-hidden="true" />
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
        <RouteIcon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{label}: </span>
        ~{km} km · ~{min} min · {label}
      </span>
    </div>
  );
}

/** Vrstica postanka: čas, ime, tip, trajanje, cena, regija. */
function StopRow({ stop, lang }: { stop: TripStop; lang: PlannerLang }) {
  const l = useLocale();
  const kindLabel = typeLabel(stop.kind, lang);
  const regionTxt = stop.region ? regionLabel(stop.region, lang) : "";
  return (
    <div className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-accent/50">
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary">
        <StopKindIcon kind={stop.kind} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-base font-bold tabular-nums">{stop.time ?? "—"}</span>
          <span className="font-semibold">{stop.name}</span>
          <Badge variant="outline" className="text-[11px]">
            {kindLabel}
          </Badge>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="sr-only">{pick(l, L.duration)}: </span>
            {formatDuration(stop.durationMin, lang)}
          </span>
          <span>
            <span className="sr-only">{pick(l, L.cost)}: </span>
            {stop.cost === 0 ? pick(l, L.free) : formatMoney(stop.cost, lang)}
          </span>
          {regionTxt && <span>{regionTxt}</span>}
        </p>
      </div>
    </div>
  );
}
