/**
 * Skupni, testabilni odjemalec za javna Overpass zrcala (OpenStreetMap).
 *
 * POŠTENA RABA (OSM pravila):
 *   • opisen User-Agent (nekatera zrcala zavrnejo zahteve brez njega),
 *   • 10-min predpomnilnik + združevanje hkratnih zahtevkov v klicočih API-jih,
 *   • zmaga PRVI uporaben odgovor, preostali poskusi se takoj prekličejo,
 *   • skupni časovni proračun — počasen vir nikoli ne zadržuje uporabnika,
 *   • brskalnik nikoli ne kliče tujih virov neposredno (vedno prek našega API-ja).
 *
 * ZAKAJ GET NAJPREJ: produkcijska meritev na Vercelu — `overpass-api.de`
 * zavrne POST z `502` v ~100 ms, medtem ko enako poizvedbo prek
 * `?data=…` (GET) uspešno odgovori v ~10 s (dokaz: `/api/stays/search`).
 * POST ostane SAMO kot rezerva, ko posrednik zavrne predolg URL (403/414)
 * ali ko GET odpove. Obe obliki sta znotraj istega časovnega proračuna.
 *
 * ZAKAJ SAMO GLOBALNA ZRCALA: `overpass.osm.ch` je ŠVICARSKI izvleček OSM in
 * za Slovenijo dosledno vrne HTTP 200 s PRAZNIM `elements`. Praznega odziva
 * zato ne štejemo za uspeh (prepreči lažen »ni zanimivosti«).
 */

/** Opisen User-Agent v skladu z OSM pravili uporabe. */
export const OSM_USER_AGENT =
  'discover-slovenia-ai/1.0 (slovenian travel guide; fair-use, 10-min cache)';

/**
 * Globalna zrcala. `overpass-api.de` je PRVO, ker je edino izmerjeno
 * dosegljivo iz Vercela (produkcijski `/api/stays/search?q=Bled`).
 */
export const GLOBAL_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

export type OverpassMethod = 'GET' | 'POST';

/** Izid ene metode na enem zrcalu (GET in morebitni POST posebej). */
export interface OverpassTry {
  method: OverpassMethod;
  ms: number;
  ok: boolean;
  status?: number;
  count?: number;
  error?: string;
}

/** Posamezen poskus — za `?debug=1` in razumevanje degradiranega načina. */
export interface OverpassAttempt {
  endpoint: string;
  ms: number;
  ok: boolean;
  method?: OverpassMethod;
  status?: number;
  count?: number;
  error?: string;
  tries: OverpassTry[];
}

export interface OverpassRaceResult {
  raw: unknown;
  endpoint: string;
  count: number;
  ms: number;
  method: OverpassMethod;
}

export interface RaceOverpassOptions {
  endpoints?: readonly string[];
  budgetMs?: number;
  /** Vbrizgljiv fetch — omogoča teste brez omrežja. */
  fetchImpl?: typeof fetch;
  /** Vrsten red metod (testi lahko preverijo obe smeri). */
  methods?: readonly OverpassMethod[];
}

export interface RaceOverpassOutcome {
  result: OverpassRaceResult | null;
  attempts: OverpassAttempt[];
}

/** Privzeti skupni proračun (produkcijsko glavno zrcalo odgovarja v ~10 s). */
export const OVERPASS_DEFAULT_BUDGET_MS = 15_000;

const DEFAULT_METHODS: readonly OverpassMethod[] = ['GET', 'POST'];

function shortError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /abort/i.test(error.message)) return 'preklican (časovni proračun ali zmaga drugega zrcala)';
    return error.message.slice(0, 160);
  }
  return String(error).slice(0, 160);
}

export function overpassGetUrl(endpoint: string, query: string): string {
  return `${endpoint}?data=${encodeURIComponent(query)}`;
}

function requestInit(method: OverpassMethod, query: string, signal: AbortSignal): RequestInit {
  const headers = {
    accept: 'application/json',
    'user-agent': OSM_USER_AGENT,
    ...(method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
  };
  if (method === 'GET') return { method, headers, signal };
  return { method, body: new URLSearchParams({ data: query }).toString(), headers, signal };
}

/**
 * Vzporedno povpraša zrcala in vrže prvi odgovor, ki vsebuje POIMENOVANE
 * zadetke (`countNamed(raw) > 0`). Prazno zrcalo je NEUSPEH, ne prazen rezultat.
 * Vsako zrcalo poskusi GET, ob neuspehu še POST — vse znotraj skupnega
 * proračuna in z enim preklicnim signalom.
 *
 * Vedno vrne `attempts` z enim zapisom na zrcalo — tudi ko vse odpove — da
 * lahko `?debug=1` pove, zakaj je API v degradiranem načinu.
 */
export async function raceOverpass(
  query: string,
  countNamed: (raw: unknown) => number,
  options: RaceOverpassOptions = {},
): Promise<RaceOverpassOutcome> {
  const endpoints = options.endpoints ?? GLOBAL_OVERPASS_ENDPOINTS;
  const methods = options.methods ?? DEFAULT_METHODS;
  const budgetMs = Math.max(1, options.budgetMs ?? OVERPASS_DEFAULT_BUDGET_MS);
  const doFetch = options.fetchImpl ?? fetch;
  const started = Date.now();

  // Vsak zapis obstaja že ob startu → diagnostika je popolna tudi, če zmagovalec
  // prekliče preostale poskuse, preden ti zapišejo svoj rezultat.
  const attempts: OverpassAttempt[] = endpoints.map((endpoint) => ({
    endpoint,
    ms: 0,
    ok: false,
    error: 'v teku',
    tries: [],
  }));

  if (endpoints.length === 0) {
    return { result: null, attempts };
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), budgetMs);

  try {
    const tasks = endpoints.map(async (endpoint, index): Promise<OverpassRaceResult> => {
      const record = attempts[index];
      const t0 = Date.now();
      let lastError: unknown = new Error('brez poskusa');

      for (const method of methods) {
        if (controller.signal.aborted) throw new Error('preklican');
        record.method = method;
        const tryRecord: OverpassTry = { method, ms: 0, ok: false };
        record.tries.push(tryRecord);
        try {
          const url = method === 'GET' ? overpassGetUrl(endpoint, query) : endpoint;
          const response = await doFetch(url, requestInit(method, query, controller.signal));
          tryRecord.status = response.status;
          tryRecord.ms = Date.now() - t0;
          record.status = response.status;
          record.ms = Date.now() - t0;
          if (!response.ok) throw new Error(`Overpass HTTP ${response.status} (${method})`);

          const raw: unknown = await response.json();
          const count = countNamed(raw);
          tryRecord.count = count;
          record.count = count;
          tryRecord.ms = record.ms = Date.now() - t0;
          if (count === 0) throw new Error(`Overpass brez poimenovanih zadetkov (${method})`);

          tryRecord.ok = record.ok = true;
          record.error = undefined;
          return { raw, endpoint, count, ms: Date.now() - started, method };
        } catch (error) {
          lastError = error;
          tryRecord.ms = record.ms = Date.now() - t0;
          tryRecord.error = record.error = shortError(error);
          record.ok = false;
        }
      }
      throw lastError;
    });

    const result = await Promise.any(tasks);
    return { result, attempts };
  } catch {
    return { result: null, attempts };
  } finally {
    clearTimeout(deadline);
    // Zmagovalec je znan (ali je potekel proračun) — ne obremenjujemo javnih
    // zrcal z zahtevki, katerih odgovor ne potrebujemo več.
    controller.abort();
    for (const record of attempts) {
      if (record.error === 'v teku') record.error = 'preklican (zmaga drugega zrcala)';
    }
  }
}
