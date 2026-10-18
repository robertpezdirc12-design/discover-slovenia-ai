/**
 * VODENI TOK — trajna shramba odgovorov (Komoot onboarding vzorec).
 *
 * Načelo (izrazita želja uporabnika): »vodeni tok si zapomne odgovore kot
 * komoot onboarding« — vsak odgovor se shrani ENKRAT in se uporabniku
 * naslednjič ne ponovi; tok nadaljuje na prvem neodgovorjenem koraku,
 * že odgovorjene vrednosti so predpripravljene (predizpolnjene).
 *
 * Čista logika (brez `window`): React komponenta vbrizga adapter
 * (`GuideStorage`), unit testi uporabljajo shrambo v pomnilniku.
 */

export const GUIDE_STORAGE_KEY = 'dsa.guide.v1';
export const GUIDE_EVENT = 'dsa:guide-updated';

export const GUIDE_REGIONS = [
  { id: 'gorenjska', label: 'Gorenjska (Bled, Bohinj)', lat: 46.3625, lng: 14.0936 },
  { id: 'osrednja', label: 'Osrednja Slovenija (Ljubljana)', lat: 46.0569, lng: 14.5058 },
  { id: 'primorska', label: 'Primorska (Soča, Piran)', lat: 45.9, lng: 13.7 },
  { id: 'stajerska', label: 'Štajerska (Maribor, Pohorje)', lat: 46.5547, lng: 15.6459 },
  { id: 'koroska', label: 'Koroška (Dravograd)', lat: 46.5864, lng: 15.0019 },
] as const;

export type GuideRegionId = (typeof GUIDE_REGIONS)[number]['id'];

export const GUIDE_INTEREST_OPTIONS = [
  'narava',
  'hrana',
  'kultura',
  'zgodovina',
  'pohodništvo',
  'družina',
  'romantika',
  'vino',
] as const;

export type GuideInterest = (typeof GUIDE_INTEREST_OPTIONS)[number];

export type GuidePace = 'počasen' | 'zmeren' | 'športen';

/**
 * Rezervirano prenočišče (»Rezerviraj« na zemljevidu) — del »Moje poti«.
 * Shranjeno trajno: ob vrnitvi se oznaka + vnos v plošči PONOVIJO
 * (Komootov vzorec — aplikacija si zapomni vse, kar je uporabnik potrdil).
 */
export interface GuideStayStop {
  /** OSM id iz rezultata iskanja ("n123"/"w456") — enoličen ključ. */
  id: string;
  name: string;
  /** Kraj iskanja (npr. "Skopje") — prikaz v plošči. */
  city: string;
  lat: number;
  lng: number;
  /** Indikativna cena od (EUR/noč) ali null — v UI označena kot ocena. */
  priceFrom: number | null;
  /** ISO čas rezervacije. */
  reservedAt: string;
}

/** Koraki toka — vrstni red je hkrati definicija "naslednjega koraka". */
export const GUIDE_STEPS = ['interests', 'region', 'days', 'pace'] as const;
export type GuideStepId = (typeof GUIDE_STEPS)[number];

export interface GuideState {
  /** Shema — pri nezdružljivi verziji počistimo (fail-clean). */
  version: 1;
  interests: GuideInterest[];
  region: GuideRegionId | null;
  days: number | null;
  pace: GuidePace | null;
  /** Koraki, ki jih je uporabnik potrdil (tipkal "Naprej" / "Zaključi"). */
  answered: GuideStepId[];
  /** Rezervirana prenočišča — »Rezerviraj« jih doda samodejno. */
  stays: GuideStayStop[];
  /** Govorni nasveti (Web Speech) — privzeto izklopljeno. */
  voiceEnabled: boolean;
  completedAt: string | null;
  updatedAt: string;
}

export interface GuideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function emptyGuideState(): GuideState {
  return {
    version: 1,
    interests: [],
    region: null,
    days: null,
    pace: null,
    answered: [],
    stays: [],
    voiceEnabled: false,
    completedAt: null,
    updatedAt: new Date(0).toISOString(),
  };
}

/** Varstvo pred neveljavnimi vnosi — fail-clean (neenaka shema → prazen state). */
export function sanitizeGuideState(raw: unknown): GuideState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  if (!Array.isArray(r.answered)) return null;
  const interests = Array.isArray(r.interests)
    ? (r.interests.filter((i): i is GuideInterest =>
        typeof i === 'string' && (GUIDE_INTEREST_OPTIONS as readonly string[]).includes(i)))
    : [];
  const answered = (r.answered as unknown[]).filter((s): s is GuideStepId =>
    typeof s === 'string' && (GUIDE_STEPS as readonly string[]).includes(s));
  const pace = typeof r.pace === 'string' && ['počasen', 'zmeren', 'športen'].includes(r.pace)
    ? (r.pace as GuidePace)
    : null;
  const region = typeof r.region === 'string' &&
      (GUIDE_REGIONS.some((g) => g.id === r.region))
    ? (r.region as GuideRegionId)
    : null;
  const days = typeof r.days === 'number' && Number.isFinite(r.days) && r.days >= 1 && r.days <= 30
    ? Math.round(r.days)
    : null;
  // stays: tolerira stare zapise brez polja; neveljavne vnosi odstrani; podvojeni id-ji izloči.
  const stays: GuideStayStop[] = [];
  if (Array.isArray(r.stays)) {
    for (const s of r.stays) {
      if (!s || typeof s !== 'object') continue;
      const o = s as Record<string, unknown>;
      if (typeof o.id !== 'string' || o.id.length === 0 || o.id.length > 64) continue;
      if (typeof o.name !== 'string' || o.name.trim().length === 0) continue;
      if (typeof o.city !== 'string' || o.city.trim().length === 0) continue;
      const lat = typeof o.lat === 'number' ? o.lat : Number.NaN;
      const lng = typeof o.lng === 'number' ? o.lng : Number.NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;
      const price = typeof o.priceFrom === 'number' && Number.isFinite(o.priceFrom) && o.priceFrom >= 0 ? o.priceFrom : null;
      if (stays.some((x) => x.id === o.id)) continue;
      stays.push({
        id: o.id,
        name: o.name.trim().slice(0, 120),
        city: o.city.trim().slice(0, 120),
        lat,
        lng,
        priceFrom: price === null ? null : Math.round(price),
        reservedAt: typeof o.reservedAt === 'string' ? o.reservedAt : new Date(0).toISOString(),
      });
    }
  }
  return {
    version: 1,
    interests,
    region,
    days,
    pace,
    answered,
    stays: stays.slice(0, 30),
    voiceEnabled: r.voiceEnabled === true,
    completedAt: typeof r.completedAt === 'string' ? r.completedAt : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date(0).toISOString(),
  };
}

export function loadGuideState(storage: GuideStorage): GuideState | null {
  try {
    const raw = storage.getItem(GUIDE_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeGuideState(JSON.parse(raw));
  } catch {
    return null; // pokvarjen zapis ne sme nikoli porušiti UX
  }
}

export function saveGuideState(storage: GuideStorage, state: GuideState): void {
  const clean = sanitizeGuideState(state) ?? emptyGuideState();
  const withStamp: GuideState = { ...clean, updatedAt: new Date().toISOString() };
  storage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(withStamp));
}

export function clearGuideState(storage: GuideStorage): void {
  storage.removeItem(GUIDE_STORAGE_KEY);
}

/** Ali je korak že odgovorjen (vsebina + potrditev)? */
export function isStepAnswered(state: GuideState, step: GuideStepId): boolean {
  if (!state.answered.includes(step)) return false;
  switch (step) {
    case 'interests':
      return state.interests.length > 0;
    case 'region':
      return state.region !== null;
    case 'days':
      return typeof state.days === 'number' && state.days >= 1;
    case 'pace':
      return state.pace !== null;
  }
}

/** Prvi neodgovorjeni korak — tam tok nadaljuje ob vrnitvi. */
export function firstUnansweredStep(state: GuideState): GuideStepId | null {
  for (const step of GUIDE_STEPS) {
    if (!isStepAnswered(state, step)) return step;
  }
  return null;
}

/** Ali je tok popolnoma končan? */
export function isGuideComplete(state: GuideState): boolean {
  return firstUnansweredStep(state) === null;
}

/** Slovensko sklanjanje: 1 interes, 2 interesa, 3–4 interesi, 5+ interesov. */
function interestsNoun(n: number): string {
  if (n === 1) return 'interes';
  if (n === 2) return 'interesa';
  if (n === 3 || n === 4) return 'interesi';
  return 'interesov';
}

/**
 * Persuazivni "naslednji korak" nasvet (Komootov vzorec: aplikacija vodi,
 * uporabnik ne razmišlja, kaj klikniti). Čista funkcija → deterministična.
 */
export function nextStepSuggestion(
  state: GuideState,
  locale: 'sl' | 'en' = 'sl',
): { text: string; nextStep: GuideStepId | 'done' } {
  const next = firstUnansweredStep(state);
  if (locale === 'en') {
    if (next === null) {
      return { text: 'Plan is ready — see it on the map. Want another destination, or finish here?', nextStep: 'done' };
    }
    if (next === 'interests') return { text: 'Pick a few interests to get started — I\'ll remember them.', nextStep: next };
    if (next === 'region') return { text: `Saved ${state.interests.length} interest(s). Now: which region?`, nextStep: next };
    if (next === 'days') return { text: `Region saved. How many days do you have?`, nextStep: next };
    return { text: 'Last question: how fast should the trip feel?', nextStep: next };
  }
  if (next === null) {
    return { text: 'Načrt je pripravljen — poglej svojo pot na zemljevidu. Želiš še eno destinacijo, ali zaključiš?', nextStep: 'done' };
  }
  if (next === 'interests') return { text: 'Izberi interese, ki te zanimajo — si jih bom zapomnil.', nextStep: next };
  if (next === 'region') return { text: `Shranjeno: ${state.interests.length} ${interestsNoun(state.interests.length)}. Naslednje: katera regija te vabi?`, nextStep: next };
  if (next === 'days') return { text: 'Regija shranjena. Koliko dni imaš na voljo?', nextStep: next };
  return { text: 'Zadnje vprašanje: kakšen tempo potovanja ti ustreza?', nextStep: next };
}

/**
 * Čista mutacija: doda rezervirano prenočišče (idempotentno — isti id ne
 * podvoji). Nov zapis gre na KONEC vrste (vrstni red rezervacij).
 */
export function addStayStop(state: GuideState, stay: Omit<GuideStayStop, 'reservedAt'> & { reservedAt?: string }): GuideState {
  if (state.stays.some((s) => s.id === stay.id)) return state;
  const next: GuideState = {
    ...state,
    stays: [
      ...state.stays,
      {
        id: stay.id,
        name: stay.name,
        city: stay.city,
        lat: stay.lat,
        lng: stay.lng,
        priceFrom: stay.priceFrom,
        reservedAt: stay.reservedAt ?? new Date().toISOString(),
      },
    ],
  };
  return sanitizeGuideState(next) ?? next;
}

/** Ali je prenočišče (id) že v »Moji poti«? */
export function isStayReserved(state: GuideState | null, id: string): boolean {
  return state?.stays.some((s) => s.id === id) ?? false;
}

/** Kratki povzetek stanja (čipi v "Nadaljuj, kjer sem ostal"). */
export function guideSummaryChips(state: GuideState): string[] {
  const chips: string[] = [];
  const region = GUIDE_REGIONS.find((g) => g.id === state.region);
  if (state.interests.length) chips.push(state.interests.join(', '));
  if (region) chips.push(region.label);
  if (state.days) chips.push(`${state.days} dni`);
  if (state.pace) chips.push(`tempo: ${state.pace}`);
  return chips;
}
