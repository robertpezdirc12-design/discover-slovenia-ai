import { describe, expect, test } from 'bun:test';

import {
  GLOBAL_OVERPASS_ENDPOINTS,
  OSM_USER_AGENT,
  OVERPASS_DEFAULT_BUDGET_MS,
  overpassGetUrl,
  raceOverpass,
} from '@/lib/overpass';

const QUERY = '[out:json][timeout:25];(node["tourism"="viewpoint"](46.2,14.0,46.4,14.2););out center 300;';

const named = (count: number) => JSON.stringify({
  elements: Array.from({ length: count }, (_, i) => ({
    type: 'node',
    id: i + 1,
    lat: 46.3 + i / 1000,
    lon: 14.1,
    tags: { name: `Točka ${i + 1}`, tourism: 'viewpoint' },
  })),
});

const jsonResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } });

/** Število poimenovanih elementov — enako kot v pravih razčlenjevalnikih. */
const countNamed = (raw: unknown): number => {
  const elements = (raw as { elements?: unknown[] } | null)?.elements;
  return Array.isArray(elements) ? elements.filter((e) => (e as { tags?: { name?: string } })?.tags?.name).length : 0;
};

const endpoints = ['https://a.example/api/interpreter', 'https://b.example/api/interpreter'] as const;

/** GET nosi poizvedbo v `?data=…`, POST pa kliče goli endpoint. */
const baseOf = (url: string | URL | Request) => String(url).split('?')[0];

describe('raceOverpass — GET/POST, User-Agent in poštena raba', () => {
  test('privzeta zrcala so izključno globalna (brez švicarskega izvlečka)', () => {
    expect(GLOBAL_OVERPASS_ENDPOINTS.length).toBeGreaterThanOrEqual(2);
    expect(GLOBAL_OVERPASS_ENDPOINTS.every((e) => e.includes('overpass'))).toBe(true);
    expect(GLOBAL_OVERPASS_ENDPOINTS.some((e) => e.includes('osm.ch'))).toBe(false);
    // Edino zrcalo, izmerjeno dosegljivo iz Vercela, mora biti prvo.
    expect(GLOBAL_OVERPASS_ENDPOINTS[0]).toContain('overpass-api.de');
    expect(OSM_USER_AGENT).toContain('discover-slovenia-ai');
    expect(OVERPASS_DEFAULT_BUDGET_MS).toBeGreaterThan(10_000);
  });

  test('GET je prvi: `?data=` v URL-ju, opisen UA, brez telesa', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return jsonResponse(named(2));
    }) as typeof fetch;

    const { result } = await raceOverpass(QUERY, countNamed, { endpoints: [endpoints[0]], fetchImpl });

    expect(result?.endpoint).toBe(endpoints[0]);
    expect(result?.method).toBe('GET');
    expect(result?.count).toBe(2);
    expect(calls).toHaveLength(1);
    const init = calls[0].init;
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(new URL(calls[0].url).searchParams.get('data')).toBe(QUERY);
    expect(overpassGetUrl(endpoints[0], QUERY)).toBe(calls[0].url);
    const headers = init.headers as Record<string, string>;
    expect(headers['user-agent']).toBe(OSM_USER_AGENT);
    expect(headers.accept).toBe('application/json');
  });

  test('ko GET odpove, POSKUSI še POST z URL-kodiranim `data`', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url: String(url), init: init ?? {} });
      if (method === 'GET') return jsonResponse('blocked', 403);
      expect(method).toBe('POST');
      expect(new URLSearchParams(String(init?.body)).get('data')).toBe(QUERY);
      expect((init?.headers as Record<string, string>)['content-type']).toContain('x-www-form-urlencoded');
      return jsonResponse(named(1));
    }) as typeof fetch;

    const { result, attempts } = await raceOverpass(QUERY, countNamed, { endpoints: [endpoints[0]], fetchImpl });

    expect(result?.method).toBe('POST');
    expect(result?.count).toBe(1);
    expect(calls.map((c) => c.init.method)).toEqual(['GET', 'POST']);
    expect(attempts[0].ok).toBe(true);
    expect(attempts[0].method).toBe('POST');
    // Diagnostika hrani IZID VSAKE metode — ne le zadnje (GET 502 ne sme izginiti).
    expect(attempts[0].tries.map((t) => t.method)).toEqual(['GET', 'POST']);
    expect(attempts[0].tries[0].status).toBe(403);
    expect(attempts[0].tries[0].ok).toBe(false);
    expect(attempts[0].tries[1].ok).toBe(true);
  });

  test('prvi odgovor s poimenovanimi zadetki zmaga; preostali se prekličejo', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const endpoint = baseOf(url);
      seen.push(endpoint);
      if (endpoint === endpoints[0]) return jsonResponse(named(3));
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    }) as typeof fetch;

    const { result, attempts } = await raceOverpass(QUERY, countNamed, { endpoints, fetchImpl, budgetMs: 500 });

    expect(result?.endpoint).toBe(endpoints[0]);
    expect(result?.count).toBe(3);
    expect(seen).toEqual([...endpoints]);
    expect(attempts).toHaveLength(2);
    expect(attempts[0].ok).toBe(true);
    expect(attempts[0].count).toBe(3);
    expect(attempts[1].ok).toBe(false);
    expect(attempts[1].error).toContain('preklican');
  });

  test('prazno zrcalo (200 + elements: []) je NEUSPEH — zmaga naslednje zrcalo', async () => {
    const fetchImpl = (async (url: string | URL | Request) =>
      jsonResponse(baseOf(url) === endpoints[0] ? named(0) : named(1))) as typeof fetch;

    const { result, attempts } = await raceOverpass(QUERY, countNamed, { endpoints, fetchImpl });

    expect(result?.endpoint).toBe(endpoints[1]);
    expect(result?.count).toBe(1);
    expect(attempts[0].ok).toBe(false);
    expect(attempts[0].error).toContain('brez poimenovanih zadetkov');
    expect(attempts[1].ok).toBe(true);
  });

  test('HTTP napake in neveljaven JSON se zapišejo; brez zmagovalca → result null', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      if (baseOf(url) === endpoints[0]) return jsonResponse('rate limited', 429);
      return jsonResponse('{ni json', 200);
    }) as typeof fetch;

    const { result, attempts } = await raceOverpass(QUERY, countNamed, { endpoints, fetchImpl });

    expect(result).toBeNull();
    expect(attempts).toHaveLength(2);
    expect(attempts[0].status).toBe(429);
    expect(attempts[0].ok).toBe(false);
    expect(attempts[0].error).toContain('429');
    expect(attempts[1].ok).toBe(false);
    expect(attempts[1].error).toBeTruthy();
    expect(attempts.every((a) => a.ms >= 0)).toBe(true);
  });

  test('časovni proračun prekliče vse počasne poskuse in vrne popolno diagnostiko', async () => {
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        signal?.addEventListener(
          'abort',
          () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          { once: true },
        );
      })) as typeof fetch;

    const { result, attempts } = await raceOverpass(QUERY, countNamed, { endpoints, fetchImpl, budgetMs: 25 });

    expect(result).toBeNull();
    expect(attempts).toHaveLength(2);
    expect(attempts.every((a) => !a.ok && a.error && a.error.length > 0)).toBe(true);
    expect(attempts.every((a) => a.endpoint.includes('example'))).toBe(true);
  });

  test('brez zrcal ne pokliče ničesar in ne vrže napake', async () => {
    let called = 0;
    const fetchImpl = (async (_url: string | URL | Request, _init?: RequestInit) => {
      called += 1;
      return jsonResponse(named(1));
    }) as typeof fetch;
    const { result, attempts } = await raceOverpass(QUERY, countNamed, { endpoints: [], fetchImpl });
    expect(result).toBeNull();
    expect(attempts).toEqual([]);
    expect(called).toBe(0);
  });
});
