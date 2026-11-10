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
 * ZAKAJ POST: poizvedbe z več tagi so dolge ~1 KB. Nekateri posredniki/WAF
 * zavrnejo dolge `?data=…` URL-je (414/403), Overpass pa POST s
 * `application/x-www-form-urlencoded` podpira povsod.
 *
 * ZAKAJ SAMO GLOBALNA ZRCALA: `overpass.osm.ch` je ŠVICARSKI izvleček OSM in
 * za Slovenijo dosledno vrne HTTP 200 s PRAZNIM `elements`. Praznega odziva
 * zato ne štejemo za uspeh (prepreči lažen »ni zanimivosti«).
 */

/** Opisen User-Agent v skladu z OSM pravili uporabe. */
export const OSM_USER_AGENT =
  'discover-slovenia-ai/1.0 (slovenian travel guide; fair-use, 10-min cache)';

/** Globalna zrcala, vrstni red po izmerjeni odzivnosti. */
export const GLOBAL_OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

/** Posamezen poskus — za `?debug=1` in razumevanje degradiranega načina. */
export interface OverpassAttempt {
  endpoint: string;
  ms: number;
  ok: boolean;
  status?: number;
  count?: number;
  error?: string;
}

export interface OverpassRaceResult {
  raw: unknown;
  endpoint: string;
  count: number;
  ms: number;
}

export interface RaceOverpassOptions {
  endpoints?: readonly string[];
  budgetMs?: number;
  /** Vbrizgljiv fetch — omogoča teste brez omrežja. */
  fetchImpl?: typeof fetch;
}

export interface RaceOverpassOutcome {
  result: OverpassRaceResult | null;
  attempts: OverpassAttempt[];
}

/** Privzeti skupni proračun (produkcijska zrcala odgovarjajo v ~3–12 s). */
export const OVERPASS_DEFAULT_BUDGET_MS = 12_000;

function shortError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || /abort/i.test(error.message)) return 'preklican (časovni proračun ali zmaga drugega zrcala)';
    return error.message.slice(0, 160);
  }
  return String(error).slice(0, 160);
}

/**
 * Vzporedno povpraša zrcala in vrže prvi odgovor, ki vsebuje POIMENOVANE
 * zadetke (`countNamed(raw) > 0`). Prazno zrcalo je NEUSPEH, ne prazen rezultat.
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
  }));

  if (endpoints.length === 0) {
    return { result: null, attempts };
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), budgetMs);
  const body = new URLSearchParams({ data: query }).toString();

  try {
    const tasks = endpoints.map(async (endpoint, index): Promise<OverpassRaceResult> => {
      const record = attempts[index];
      const t0 = Date.now();
      try {
        const response = await doFetch(endpoint, {
          method: 'POST',
          body,
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
            'user-agent': OSM_USER_AGENT,
          },
          signal: controller.signal,
        });
        record.status = response.status;
        record.ms = Date.now() - t0;
        if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);

        const raw: unknown = await response.json();
        const count = countNamed(raw);
        record.count = count;
        record.ms = Date.now() - t0;
        if (count === 0) throw new Error('Overpass brez poimenovanih zadetkov');

        record.ok = true;
        record.error = undefined;
        return { raw, endpoint, count, ms: Date.now() - started };
      } catch (error) {
        record.ms = Date.now() - t0;
        record.ok = false;
        record.error = shortError(error);
        throw error;
      }
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
