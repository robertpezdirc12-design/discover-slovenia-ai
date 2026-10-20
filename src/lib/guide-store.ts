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
const MAX_STAYS = 30;
const MAX_TIMESTAMP_LENGTH = 40;
const EPOCH_ISO = new Date(0).toISOString();

/**
 * Normalizira časovni žig iz localStorage/API-ja. Neznane ali predolge
 * vrednosti ne smejo priti v bazo ali v primerjavo svežine stanja.
 */
function normalizeTimestamp(value: unknown, fallback: string | null): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TIMESTAMP_LENGTH) {
    return fallback;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : fallback;
}

/** Stisne ponovitve — API lahko prejme poljubno dolge sezname. */
function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function sanitizeGuideState(raw: unknown): GuideState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  if (!Array.isArray(r.answered)) return null;
  const interests = unique(Array.isArray(r.interests)
    ? r.interests.filter((i): i is GuideInterest =>
        typeof i === 'string' && (GUIDE_INTEREST_OPTIONS as readonly string[]).includes(i))
    : []);
  const answered = unique((r.answered as unknown[]).filter((s): s is GuideStepId =>
    typeof s === 'string' && (GUIDE_STEPS as readonly string[]).includes(s)));
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
      if (stays.length >= MAX_STAYS) break;
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
        reservedAt: normalizeTimestamp(o.reservedAt, EPOCH_ISO) ?? EPOCH_ISO,
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
    stays,
    voiceEnabled: r.voiceEnabled === true,
    completedAt: normalizeTimestamp(r.completedAt, null),
    updatedAt: normalizeTimestamp(r.updatedAt, EPOCH_ISO) ?? EPOCH_ISO,
  };
}

/**
 * Enakost vsebine brez `updatedAt` — za preprečevanje nepotrebnih PUT
 * zahtevkov in za odločitev, ali je treba osvežiti strežniški render.
 */
export function sameGuideContent(a: GuideState | null, b: GuideState | null): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify({
    interests: a.interests,
    region: a.region,
    days: a.days,
    pace: a.pace,
    answered: a.answered,
    stays: a.stays,
    voiceEnabled: a.voiceEnabled,
    completedAt: a.completedAt,
  }) === JSON.stringify({
    interests: b.interests,
    region: b.region,
    days: b.days,
    pace: b.pace,
    answered: b.answered,
    stays: b.stays,
    voiceEnabled: b.voiceEnabled,
    completedAt: b.completedAt,
  });
}

/**
 * Ali je stanje brez vsebinskih odgovorov (dovoljeni so le govor in
 * morebitni koraki)? Uporablja se pri varnem spajanju med sinhronizacijo.
 */
export function isGuideSparse(state: GuideState): boolean {
  return (
    state.interests.length === 0 &&
    state.region === null &&
    state.days === null &&
    state.pace === null &&
    state.stays.length === 0 &&
    state.completedAt === null
  );
}

/**
 * Varno spoji novo lokalno stanje s strežniškim profilom.
 *
 * Uporablja se, ko je uporabnik v novem brskalniku kliknil, še preden se je
 * končalo prvo branje profila. Takrat lokalno stanje ni popolna resnica
 * (npr. vsebuje samo vklop govora), zato ga ne smemo poslati čez celoten
 * profil. Ohranimo strežniške odgovore, lokalne pa dodamo/prevzamemo.
 */
export function mergeGuideStates(server: GuideState, local: GuideState): GuideState {
  const voiceOnly = isGuideSparse(local) && local.answered.length === 0;

  const stays = new Map(server.stays.map((s) => [s.id, s]));
  for (const stay of local.stays) stays.set(stay.id, stay);

  return {
    version: 1,
    interests: unique([...server.interests, ...local.interests]),
    region: local.region ?? server.region,
    days: local.days ?? server.days,
    pace: local.pace ?? server.pace,
    answered: unique([...server.answered, ...local.answered]),
    stays: Array.from(stays.values()).slice(0, MAX_STAYS),
    // Ob drugih spremembah je lokalni `voiceEnabled: false` samo privzeta
    // vrednost, ne izrecna odločitev uporabnika — ohrani strežniško izbiro.
    voiceEnabled: local.voiceEnabled || (voiceOnly ? false : server.voiceEnabled),
    completedAt: local.completedAt ?? server.completedAt,
    updatedAt: new Date().toISOString(),
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

/** Koliko dni — 1 dan, 2 dneva, sicer dni (uporaba: trajanje poti). */
export function formatDaysCount(days: number): string {
  const n = Number.isFinite(days) ? Math.max(0, Math.round(days)) : 0;
  if (n === 1) return '1 dan';
  if (n === 2) return '2 dneva';
  return `${n} dni`;
}

/** Slovensko sklanjanje prenočišč: 1 prenočišče, 2 prenočišči, 3–4 prenočišča, 5+ prenočišč. */
export function formatStayCount(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  if (n === 1) return '1 prenočišče';
  if (n === 2) return '2 prenočišči';
  if (n === 3 || n === 4) return `${n} prenočišča`;
  return `${n} prenočišč`;
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
  if (state.days) chips.push(formatDaysCount(state.days));
  if (state.pace) chips.push(`tempo: ${state.pace}`);
  return chips;
}
