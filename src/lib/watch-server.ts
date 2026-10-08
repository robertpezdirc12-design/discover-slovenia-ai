/**
 * WATCH-SERVER — P1-C (issue #3 §4/§10): STREŽNIŠKA integracija spremljanja.
 * ============================================================================
 * Nad čisto plastjo src/lib/watch-engine.ts (fiksna pravila) doda:
 *  - writeWatchAudit: revizijska sled (AuditLog, append-only);
 *  - resolveJourneyWatchContext: dnevi poti × lokacije opazovanja (koordinate
 *    so VEDNO koordinate POSTANKA iz registra destinacij — NIKOLI uporabnikove
 *    GPS lege, kanon zasebnosti /api/weather);
 *  - runWatchCheck: telo crona /api/cron/watch-check — BOUNDED (≤ 12 unikatnih
 *    lokacij na zagon), fail-closed (vir nedosegljiv → unavailable, BREZ
 *    izmišljenih napovedi), IDEMPOTENTEN (Notification.dedupeKey unique →
 *    vzporedni/ponovljeni zagon ne podvoji), z revizijskim zapisom.
 *
 * ZASEBNOST (§11): spremljanje pote se vrednoti SAMO, če lastnik spremljanja
 * še ima dostop do pote (lastnik / sodelujoč / javna pot) — sicer se tiho
 * preskoči (izguba dostopa ne razkrije vsebine pote).
 *
 * 0-AI kanon: 0 LLM klicev, 0 žetonov — samo baza + eden javni vremenski vir.
 */

import { db } from "@/lib/db";
import { getDestination } from "@/lib/slovenia-data";
import { eachTripDay, todayIso } from "@/lib/trip-dates";
import { parseJourneyPlan } from "@/lib/trip-auth";
import {
  cacheKeyFor,
  mapUpstreamDaily,
  type WeatherDay,
} from "@/lib/weather";
import {
  evaluateBookingWatch,
  evaluatePriceWatch,
  evaluateTripDayWatch,
  evaluateWeatherWatch,
  parsePriceObservation,
  parseStoredCondition,
  WATCH_AUDIT_ACTIONS,
  type WatchEvaluation,
  type WeatherWatchDay,
} from "@/lib/watch-engine";

// ─── Revizijska sled ────────────────────────────────────────────────────────

export async function writeWatchAudit(entry: {
  actorType: "customer" | "system";
  actorId: string | null;
  action: string;
  entityType: "watch" | "notification";
  entityId: string;
  meta: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        meta: JSON.stringify(entry.meta),
      },
    });
  } catch (err) {
    // Dnevnik je pomemben, a NE sme podreti uporabniškega dejanja —
    // napaka se zabeleži (strežniški dnevnik), zahtevek nadaljuje.
    console.error("[watch-server] audit napaka:", err);
  }
}

// ─── Dnevi poti × lokacije opazovanja ───────────────────────────────────────

export interface JourneyWatchContext {
  /** Dnevi poti z lokacijo opazovanja (koordinate postanka iz registra). */
  tripDays: WeatherWatchDay[];
  /** coordKey → koordinate (za pridobitev napovedi; 2 dec. ~1,1 km mreža). */
  coordByKey: Map<string, { lat: number; lng: number }>;
  dateStart: string | null;
  dateEnd: string | null;
}

/**
 * Zgradi kontekst vremenskega opazovanja za pot: vsak dan poti dobi
 * koordinate PRVEGA razpoznavnega postanka tega dne (destSlug → register);
 * če dan nima razpoznavnega postanka, pade na prvi razpoznavni postanek
 * celotne pote (deterministično). Brez datumov ali brez razpoznavnih
 * lokacij → prazna množica (iskreno not_applicable v vrednotenju).
 */
export function resolveJourneyWatchContext(journey: {
  data: string;
  dateStart: string | null;
  dateEnd: string | null;
}): JourneyWatchContext {
  const out: JourneyWatchContext = {
    tripDays: [],
    coordByKey: new Map(),
    dateStart: journey.dateStart,
    dateEnd: journey.dateEnd,
  };
  if (!journey.dateStart || !journey.dateEnd) return out;

  const plan = parseJourneyPlan(journey.data);

  // Prvi razpoznavni postanek celotne pote (deterministični nadomestek).
  let fallbackCoords: { lat: number; lng: number } | null = null;
  for (const day of plan.days ?? []) {
    for (const loc of day.locations ?? []) {
      const dest = loc.destSlug ? getDestination(loc.destSlug) : undefined;
      if (dest?.coords) {
        fallbackCoords = dest.coords;
        break;
      }
    }
    if (fallbackCoords) break;
  }
  if (!fallbackCoords) return out; // nobena razpoznavna lokacija → prazno

  const days = eachTripDay({ start: journey.dateStart, end: journey.dateEnd });
  if (!days) return out;

  const keyOf = (lat: number, lng: number) => {
    const key = cacheKeyFor(lat, lng);
    if (!out.coordByKey.has(key)) out.coordByKey.set(key, { lat, lng });
    return key;
  };

  for (const day of days) {
    const planDay = (plan.days ?? []).find((d) => d.day === day.dayIndex);
    let dayCoords: { lat: number; lng: number } | null = null;
    for (const loc of planDay?.locations ?? []) {
      const dest = loc.destSlug ? getDestination(loc.destSlug) : undefined;
      if (dest?.coords) {
        dayCoords = dest.coords;
        break;
      }
    }
    const coords = dayCoords ?? fallbackCoords;
    out.tripDays.push({ iso: day.iso, coordKey: keyOf(coords.lat, coords.lng) });
  }
  return out;
}

// ─── Vremenski vir (bounded, fail-closed) ───────────────────────────────────

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_DAILY_FIELDS =
  "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum";
const UPSTREAM_TIMEOUT_MS = 8_000;

/** Zgornja meja unikatnih lokacij na zagon (bounded run — določena meja). */
export const WATCH_WEATHER_MAX_COORDS = 12;

/**
 * Pridobi dnevno napoved za eno lokacijo (ISTI vir in oblika kot
 * /api/weather?daily=1 — Open-Meteo, 16 dni, timezone=auto).
 * Vrača null ob KATERI koli napaki — NIKOLI izmišljenih podatkov.
 * ZASEBNOST: koordinate so vedno koordinate postanka načrta.
 */
export async function fetchDailyForecast(
  lat: number,
  lng: number
): Promise<WeatherDay[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const url =
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lng}` +
      `&daily=${OPEN_METEO_DAILY_FIELDS}&timezone=auto&forecast_days=16`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (typeof json !== "object" || json === null) return null;
    const root = json as Record<string, unknown>;
    if (typeof root.daily !== "object" || root.daily === null) return null;
    const daily = mapUpstreamDaily(
      root.daily as Parameters<typeof mapUpstreamDaily>[0]
    );
    return daily && daily.length > 0 ? daily : null;
  } catch {
    return null; // timeout / omrežje → fail-closed
  } finally {
    clearTimeout(timer);
  }
}

// ─── Cron telo: runWatchCheck ───────────────────────────────────────────────

export interface WatchCheckReport {
  status: "ok";
  job: "watch-check";
  ranAt: string;
  scanned: number;
  evaluated: number;
  triggered: number;
  notificationsWritten: number;
  duplicatesSkipped: number;
  byStatus: Record<string, number>;
  weatherFetches: number;
  weatherFailures: number;
  note: string;
}

/** Notranja oblika aktivnega spremljanja (deterministično urejeno). */
interface WatchRow {
  id: string;
  userId: string;
  kind: string;
  targetKind: string;
  targetId: string;
  targetName: string;
  condition: string;
  lastObservation: string | null;
}

/**
 * En prehod vrednotenja VSEH aktivnih spremljanj (cron). IDEMPOTENTNO:
 * obvestila nosijo dedupeKey (unique na uporabnika) → ponovljeni zagon
 * ne podvoji; RETRY-VARNO: posodobitve spremljanj so neodvisne.
 */
export async function runWatchCheck(): Promise<WatchCheckReport> {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = todayIso(now);

  const byStatus: Record<string, number> = {};
  const bump = (s: string) => {
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  };

  const watches = (await db.watchItem.findMany({
    where: { state: "active" },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }], // determinizem
  })) as unknown as WatchRow[];
  const scanned = watches.length;

  const results: { watch: WatchRow; evaluation: WatchEvaluation }[] = [];

  // ── 1) PRICE: trenutne cene izdelkov iz baze (preverljiv vir) ──────────
  const priceWatches = watches.filter((w) => w.kind === "price");
  const productBySlug = new Map<
    string,
    { name: string; priceCents: number | null }
  >();
  if (priceWatches.length > 0) {
    const slugs = [...new Set(priceWatches.map((w) => w.targetId))];
    const products = await db.product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, name: true, priceCents: true },
    });
    for (const p of products) {
      productBySlug.set(p.slug, {
        name: p.name,
        priceCents:
          Number.isFinite(p.priceCents) && p.priceCents > 0 ? p.priceCents : null,
      });
    }
  }
  for (const w of priceWatches) {
    const cond = parseStoredCondition(w.kind, w.condition);
    const product = productBySlug.get(w.targetId) ?? null;
    if (!cond || cond.kind !== "price") {
      bump("invalid_condition");
      continue;
    }
    const evaluation = evaluatePriceWatch({
      watchId: w.id,
      productSlug: w.targetId,
      productName: product?.name ?? w.targetName,
      dropPct: cond.dropPct,
      currentPriceCents: product ? product.priceCents : null,
      previous: parsePriceObservation(w.lastObservation),
      now: nowIso,
    });
    bump(evaluation.status);
    results.push({ watch: w, evaluation });
  }

  // ── 2) JOURNEY: pote + dostop + datumi + rezervacije ───────────────────
  const journeyWatches = watches.filter(
    (w) => w.kind === "weather" || w.kind === "trip_day" || w.kind === "booking"
  );
  const journeyByShare = new Map<
    string,
    {
      id: string;
      ownerId: string;
      isPublic: boolean;
      data: string;
      title: string;
      dateStart: string | null;
      dateEnd: string | null;
    }
  >();
  if (journeyWatches.length > 0) {
    const shareIds = [...new Set(journeyWatches.map((w) => w.targetId))];
    const journeys = await db.travelJourney.findMany({
      where: { shareId: { in: shareIds } },
      select: {
        id: true,
        shareId: true,
        ownerId: true,
        isPublic: true,
        data: true,
        title: true,
        dateStart: true,
        dateEnd: true,
      },
    });
    for (const j of journeys) journeyByShare.set(j.shareId, j);
  }

  // Dostop (§11): lastnik / sodelujoč / javna pot — ostalo se preskoči.
  const accessPairs = journeyWatches
    .map((w) => {
      const j = journeyByShare.get(w.targetId);
      return j && !j.isPublic && j.ownerId !== w.userId
        ? { journeyId: j.id, userId: w.userId }
        : null;
    })
    .filter((p): p is { journeyId: string; userId: string } => p !== null);
  const allowedPairs = new Set<string>();
  if (accessPairs.length > 0) {
    const collabs = await db.tripCollaborator.findMany({
      where: { OR: accessPairs },
      select: { journeyId: true, userId: true },
    });
    for (const c of collabs) allowedPairs.add(`${c.journeyId}:${c.userId}`);
  }

  // Konteksti pote (dnevi × lokacije) — deljeni med spremljanji iste pote.
  const contextByShare = new Map<string, JourneyWatchContext>();

  // Rezervacije (samo za booking vrsto — grouped po pote, bounded).
  const ideaCountByJourneyId = new Map<string, number>();
  const bookingShareIds = [
    ...new Set(
      journeyWatches
        .filter((w) => w.kind === "booking")
        .map((w) => w.targetId)
    ),
  ];
  if (bookingShareIds.length > 0) {
    const grouped = await db.tripReservation.groupBy({
      by: ["journeyId"],
      where: {
        journey: { shareId: { in: bookingShareIds } },
        status: "IDEA",
      },
      _count: { _all: true },
    });
    for (const g of grouped) {
      ideaCountByJourneyId.set(g.journeyId, g._count._all);
    }
  }

  // Vremenska spremljanja se vrednotijo po pripravljenih napovedih (faza 3).
  const weatherPending: {
    watch: WatchRow;
    journeyId: string;
    tripName: string;
    maxPrecipMm: number;
    ctx: JourneyWatchContext;
  }[] = [];

  for (const w of journeyWatches) {
    const journey = journeyByShare.get(w.targetId) ?? null;
    if (!journey) {
      bump("not_applicable"); // cilj je bil izbrisan — iskreno brez opozorila
      continue;
    }
    // Zasebnost: brez dostopa NE vrednotimo (niti ne razkrijemo vsebine).
    if (
      !journey.isPublic &&
      journey.ownerId !== w.userId &&
      !allowedPairs.has(`${journey.id}:${w.userId}`)
    ) {
      bump("not_applicable");
      continue;
    }

    const cond = parseStoredCondition(w.kind, w.condition);
    if (!cond) {
      bump("invalid_condition");
      continue;
    }

    if (w.kind === "trip_day") {
      const evaluation = evaluateTripDayWatch({
        watchId: w.id,
        shareId: w.targetId,
        tripName: journey.title,
        dateStart: journey.dateStart,
        todayIso: today,
      });
      bump(evaluation.status);
      results.push({ watch: w, evaluation });
      continue;
    }

    if (w.kind === "booking") {
      const evaluation = evaluateBookingWatch({
        watchId: w.id,
        shareId: w.targetId,
        tripName: journey.title,
        remindDaysBefore: cond.kind === "booking" ? cond.remindDaysBefore : 7,
        dateStart: journey.dateStart,
        ideaCount: ideaCountByJourneyId.get(journey.id) ?? 0,
        todayIso: today,
      });
      bump(evaluation.status);
      results.push({ watch: w, evaluation });
      continue;
    }

    // weather: kontekst (dnevi × lokacije) gradimo enkrat na poto.
    let ctx = contextByShare.get(w.targetId);
    if (!ctx) {
      ctx = resolveJourneyWatchContext(journey);
      contextByShare.set(w.targetId, ctx);
    }
    const upcoming = ctx.tripDays.filter((d) => d.iso >= today);
    if (upcoming.length === 0) {
      // Brez prihodnjih dni (brez datumov / mimo / brez lokacij) → iskreno.
      const evaluation = evaluateWeatherWatch({
        watchId: w.id,
        shareId: w.targetId,
        tripName: journey.title,
        maxPrecipMm: cond.kind === "weather" ? cond.maxPrecipMm : 5,
        tripDays: [],
        forecastByCoord: new Map(),
        todayIso: today,
      });
      bump(evaluation.status);
      results.push({ watch: w, evaluation });
      continue;
    }
    weatherPending.push({
      watch: w,
      journeyId: journey.id,
      tripName: journey.title,
      maxPrecipMm: cond.kind === "weather" ? cond.maxPrecipMm : 5,
      ctx,
    });
  }

  // ── 3) WEATHER: napovedi po unikatnih lokacijah (bounded, določeno) ────
  const coordByKey = new Map<string, { lat: number; lng: number }>();
  for (const p of weatherPending) {
    for (const day of p.ctx.tripDays) {
      if (day.iso < today) continue;
      const coords = p.ctx.coordByKey.get(day.coordKey);
      if (coords && !coordByKey.has(day.coordKey)) {
        coordByKey.set(day.coordKey, coords);
      }
    }
  }
  // Deterministični vrstni red (abeceda ključev) + zgornja meja.
  const limitedKeys = [...coordByKey.keys()]
    .sort()
    .slice(0, WATCH_WEATHER_MAX_COORDS);
  const forecastByCoord = new Map<string, readonly WeatherDay[] | null>();
  let weatherFetches = 0;
  let weatherFailures = 0;
  for (const key of limitedKeys) {
    const coords = coordByKey.get(key)!;
    weatherFetches += 1;
    const daily = await fetchDailyForecast(coords.lat, coords.lng);
    if (daily === null) weatherFailures += 1;
    forecastByCoord.set(key, daily);
  }

  for (const p of weatherPending) {
    const evaluation = evaluateWeatherWatch({
      watchId: p.watch.id,
      shareId: p.watch.targetId,
      tripName: p.tripName,
      maxPrecipMm: p.maxPrecipMm,
      tripDays: p.ctx.tripDays.filter((d) => d.iso >= today),
      forecastByCoord,
      todayIso: today,
    });
    bump(evaluation.status);
    results.push({ watch: p.watch, evaluation });
  }

  // ── 4) ZAPISI: obvestila (dedupe) + posodobitve spremljanj ─────────────
  const triggered = results.filter((r) => r.evaluation.status === "triggered");
  const drafts = triggered
    .map((r) => ({
      userId: r.watch.userId,
      notification: r.evaluation.notification,
    }))
    .filter(
      (t): t is { userId: string; notification: NonNullable<WatchEvaluation["notification"]> } =>
        t.notification !== null
    );

  let notificationsWritten = 0;
  let duplicatesSkipped = 0;
  for (const d of drafts) {
    try {
      await db.notification.create({
        data: {
          userId: d.userId,
          source: d.notification.source,
          severity: d.notification.severity,
          title: d.notification.title,
          body: d.notification.body,
          data: d.notification.data,
          dedupeKey: d.notification.dedupeKey,
        },
      });
      notificationsWritten += 1;
    } catch (err) {
      // IDEMPOTENCA: (userId, dedupeKey) unique → P2002 pomeni že zapisano
      // (ponovljeni/vzporedni zagon) — prezrto, NI napaka (vzorec webhooka).
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        duplicatesSkipped += 1;
      } else {
        throw err;
      }
    }
  }

  for (const r of results) {
    await db.watchItem.updateMany({
      where: { id: r.watch.id, userId: r.watch.userId },
      data: {
        lastCheckedAt: now,
        ...(r.evaluation.observation !== null
          ? { lastObservation: r.evaluation.observation }
          : {}),
        ...(r.evaluation.status === "triggered"
          ? { lastTriggeredAt: now }
          : {}),
      },
    });
  }

  // ── 5) Revizija + poročilo ─────────────────────────────────────────────
  await writeWatchAudit({
    actorType: "system",
    actorId: null,
    action: WATCH_AUDIT_ACTIONS.watchCheckRun,
    entityType: "watch",
    entityId: "watch-check",
    meta: {
      scanned,
      evaluated: results.length,
      triggered: triggered.length,
      notificationsWritten,
      duplicatesSkipped,
      weatherFetches,
      weatherFailures,
    },
  });

  return {
    status: "ok",
    job: "watch-check",
    ranAt: nowIso,
    scanned,
    evaluated: results.length,
    triggered: triggered.length,
    notificationsWritten,
    duplicatesSkipped,
    byStatus,
    weatherFetches,
    weatherFailures,
    note:
      triggered.length === 0
        ? "nič za opozorilo (idempotenten zagon — dedupe po (userId, dedupeKey))"
        : `${triggered.length} opozoril zapisanih (idempotentno — ponovni zagon ne podvoji)`,
  };
}
