import { NextResponse } from 'next/server';
import { fetchWikiChain } from '@/lib/open-data-upstream';
import { parseWikiParam } from '@/lib/open-data-server';
import type { WikiSummary } from '@/lib/open-data';

/**
 * Wikipedia povzetek kraja — strežniški posrednik (odprti podatki, CC BY-SA).
 *
 * Opisni User-Agent je OBVEZEN (brez njega Wikimedia odgovarja 403 — izmerjeno),
 * zato brskalnik NE sme klicati direktno. Predpomnilnik 24 h/200 naslovov
 * (manjkajoči članki negativno 5 min). Rezerva: bun storitev 3033.
 *
 * GET /api/open-data/wiki?title=Bled&lang=sl
 *   → 200 { ok:true, wiki:{ title, description, extract, thumb } | null }
 *     (wiki === null pomeni "članka ni" — ni napaka)
 *   → 400 { ok:false, error }   (neveljaven naslov/jezik)
 *   → 502 { ok:false, error }   (Wikipedia nedosegljiva)
 */

export const dynamic = 'force-dynamic';

const SERVICE_URL = 'http://127.0.0.1:3033/wiki';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const NEG_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const SERVICE_TIMEOUT_MS = 15_000;

type CacheEntry = { value: WikiSummary | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<WikiSummary | null>>();

function cacheGet(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function cacheSet(key: string, value: WikiSummary | null, ttl: number): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

function isValidSummary(w: unknown): w is WikiSummary {
  if (!w || typeof w !== 'object') return false;
  const j = w as { title?: unknown; extract?: unknown };
  return typeof j.title === 'string' && j.title.length > 0 && typeof j.extract === 'string' && j.extract.length > 0;
}

async function viaService(title: string, lang: string): Promise<WikiSummary | null> {
  const res = await fetch(`${SERVICE_URL}?title=${encodeURIComponent(title)}&lang=${lang}`, {
    signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  const j = (await res.json()) as { ok?: boolean; wiki?: unknown };
  if (j.ok !== true) throw new Error('open-data-service: wikipedia ni dosegljiva');
  return j.wiki === null ? null : isValidSummary(j.wiki) ? j.wiki : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseWikiParam(url.searchParams.get('title'), url.searchParams.get('lang'));
  if ('error' in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const key = `${parsed.lang}:${parsed.title.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return NextResponse.json({ ok: true, wiki: cached.value });

  const pending = inFlight.get(key);
  if (pending) return NextResponse.json({ ok: true, wiki: await pending });

  const task = (async () => {
    try {
      return await fetchWikiChain(parsed.title, parsed.lang);
    } catch (directError) {
      try {
        return await viaService(parsed.title, parsed.lang);
      } catch {
        throw directError;
      }
    }
  })();
  inFlight.set(key, task);
  try {
    const wiki = await task;
    cacheSet(key, wiki, wiki === null ? NEG_TTL_MS : CACHE_TTL_MS);
    return NextResponse.json({ ok: true, wiki });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'neznan odziv vira';
    return NextResponse.json(
      { ok: false, error: `Wikipedia trenutno ni dosegljiva (${message}).` },
      { status: 502 },
    );
  } finally {
    inFlight.delete(key);
  }
}
