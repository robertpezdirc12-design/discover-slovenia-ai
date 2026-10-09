/**
 * WATCH-ENGINE — P1-C (issue #3 §4 „Watch / proactive monitoring" in §10
 * „Notification center"): ČISTA, deterministična plast spremljanja.
 * ============================================================================
 * 0-AI kanon: NIČ LLM klicev, 0 žetonov, 0 omrežja — samo fiksna pravila,
 * preslikave in validacije nad preverljivimi podatki (isti vhod → isti izhod).
 *
 * ISKRENOSTNI KANON (§4 CRITICAL):
 *  - »cena je padla« nastane SAMO iz dveh preverljivih cen (prejšnje
 *    opažanje iz lastObservation + trenutna cena izdelka iz baze);
 *    BREZ prejšnje osnove zabeležimo samo izhodišče (baseline) — NO alert;
 *  - če vir ne potrjuje (razpoložljivost restavracij, spremembe letov),
 *    vrsto ZAVRNEMO ob dodajanju z iskrenim sporočilom (NE podpreti);
 *  - zamudo/odsotnost vira → UNKNOWN/UNAVAILABLE, NIKOLI optimistično
 *    »vse je v redu«;
 *  - vremenski horizont omejuje VIR (Open-Meteo 16 dni) — pred tem je
 *    stanje PENDING (napoved še ne pokriva datumov), ne lažni mir.
 *
 * Vrste (kind) × cilji (targetKind):
 *  - price    × product  — padec cene tržniškega izdelka (prag dropPct %);
 *  - weather  × journey  — padavine/nevihta na dnevih poti (prag maxPrecipMm);
 *  - trip_day × journey  — odštev dni do začetka pote (mejnika 7 in 1 dan);
 *  - booking  × journey  — opomnik za nepotrjene (IDEA) rezervacije pred potjo.
 *
 * Ta modul je CLIENT-SAFE (čiste funkcije, brez Node API-jev); strežniška
 * integracija (baza, cron, Open-Meteo) živi v src/lib/watch-server.ts.
 *
 * Slovensko je resnica; komentarji so dvojezično strjeni.
 */

import {
  detectPromptInjection,
  sanitizeUntrustedText,
} from "@/lib/system-data-guard";
import {
  addDaysIso,
  daysBetweenIso,
  isIsoDate,
} from "@/lib/trip-dates";
import type { WeatherDay } from "@/lib/weather";

// ─── §4 FIKSNI NABORI ───────────────────────────────────────────────────────

/** Podprte vrste spremljanja (fiksna množica — nič dinamičnega). */
export const WATCH_KINDS = ["price", "weather", "trip_day", "booking"] as const;
export type WatchKind = (typeof WATCH_KINDS)[number];

/**
 * ZAVRŽENE vrste (§4 CRITICAL — vir NE potrjuje stanja, zato iskreno
 * odklonimo, namesto da bi lažno obljubljali opazovanje).
 */
export const UNSUPPORTED_WATCH_KINDS: Readonly<
  Record<string, { sl: string; en: string; it: string; de: string; fr: string; es: string }>
> = {
  availability: {
    sl: "Razpoložljivost lokala ne morem spremljati — ponudnik tega stanja ne potrjuje prek naše plasti (iskrena zavrnitev, ne lažno opazovanje).",
    en: "Restaurant availability cannot be watched — the provider does not confirm this state through our layer (honest refusal, not a fake watch).",
    it: "Non posso monitorare la disponibilità del locale — il fornitore non conferma questo stato tramite il nostro livello (rifiuto onesto, non una falsa osservazione).",
    de: "Die Verfügbarkeit des Lokals kann ich nicht beobachten — der Anbieter bestätigt diesen Zustand nicht über unsere Ebene (ehrliche Absage, keine falsche Beobachtung).",
    fr: "Je ne peux pas surveiller la disponibilité du restaurant — le prestataire ne confirme pas cet état via notre couche (refus honnête, pas une fausse surveillance).",
    es: "No puedo seguir la disponibilidad del local — el proveedor no confirma este estado a través de nuestra capa (negativa honesta, no una falsa observación).",
  },
  flight: {
    sl: "Spremljanja letov ne podpiramo — nimamo preverljivega vira letalskih podatkov (ne bomo izmišljevali sprememb).",
    en: "Flight watching is not supported — we have no verifiable flight data source (we will not invent changes).",
    it: "Il monitoraggio dei voli non è supportato — non abbiamo una fonte verificabile di dati di volo (non inventeremo cambiamenti).",
    de: "Flugbeobachtung wird nicht unterstützt — wir haben keine überprüfbare Flugdatenquelle (wir erfinden keine Änderungen).",
    fr: "La surveillance des vols n'est pas prise en charge — nous n'avons pas de source vérifiable de données de vol (nous n'inventerons pas de changements).",
    es: "No damos soporte al seguimiento de vuelos — no tenemos una fuente verificable de datos de vuelo (no inventaremos cambios).",
  },
};

/** Vrste ciljev: product (slug tržnice) | journey (shareId pote). */
export const WATCH_TARGET_KINDS = ["product", "journey"] as const;
export type WatchTargetKind = (typeof WATCH_TARGET_KINDS)[number];

/** Dovoljena kombinacija vrsta × cilj (vse ostalo → 400). */
export const WATCH_KIND_TARGETS: Readonly<Record<WatchKind, WatchTargetKind>> = {
  price: "product",
  weather: "journey",
  trip_day: "journey",
  booking: "journey",
};

/** Stanja spremljanja: aktivno | pavza (izbris je fizičen — ni arhiva). */
export const WATCH_STATES = ["active", "paused"] as const;
export type WatchState = (typeof WATCH_STATES)[number];

/** Zgornja meja števila spremljanj na uporabnika (bounded — 0 neomejenosti). */
export const WATCH_MAX_PER_USER = 50;

/** Zgornja meja števila obvestil na zahtevo (bounded retrieval). */
export const NOTIFICATION_LIST_MAX = 100;

/** Horizont dnevne napovedi (vir Open-Meteo — prek trip-dates kanona). */
export const WATCH_FORECAST_HORIZON_DAYS = 16;

/**
 * WMO kode, ki jih pri vremenskem spremljanju obravnavamo kot VROČE
 * (jugovzhodni dež s snežno odejo / nevihte): 65, 82, 95, 96, 99.
 */
export const SEVERE_WEATHER_CODES: readonly number[] = [65, 82, 95, 96, 99];

/** Mejnika odšteva dni do pote (fiksna množica — 7 dni in 1 dan). */
export const TRIP_DAY_MILESTONES: readonly number[] = [7, 1];

// ─── Pogoji (pragi po vrsti) ────────────────────────────────────────────────

/** Privzeti in mejni pragi po vrsti (deterministično, brez izpeljav). */
export const WATCH_CONDITION_BOUNDS = {
  price: { dropPct: { min: 1, max: 90, default: 10 } },
  weather: { maxPrecipMm: { min: 0, max: 100, default: 5 } },
  trip_day: {}, // mejniki so fiksni (TRIP_DAY_MILESTONES)
  booking: { remindDaysBefore: { min: 1, max: 30, default: 7 } },
} as const;

export interface PriceCondition {
  kind: "price";
  /** Sprožitev, ko cena pade za ≥ dropPct % (1–90, privzeto 10). */
  dropPct: number;
}
export interface WeatherCondition {
  kind: "weather";
  /** Sprožitev, ko napoved za dan poti obeta ≥ maxPrecipMm mm padavin (0–100). */
  maxPrecipMm: number;
}
export interface TripDayCondition {
  kind: "trip_day";
}
export interface BookingCondition {
  kind: "booking";
  /** Opomnik za nepotrjene rezervacije toliko dni pred začetkom pote (1–30). */
  remindDaysBefore: number;
}
export type WatchCondition =
  | PriceCondition
  | WeatherCondition
  | TripDayCondition
  | BookingCondition;

// ─── Revizijska dejanja (AuditLog, append-only) ─────────────────────────────

export const WATCH_AUDIT_ACTIONS = {
  watchCreated: "watch.created",
  watchUpdated: "watch.updated",
  watchPaused: "watch.paused",
  watchResumed: "watch.resumed",
  watchDeleted: "watch.deleted",
  watchCheckRun: "watch.check_run",
  notificationRead: "notification.read",
  notificationReadAll: "notification.read_all",
  notificationCleared: "notification.cleared",
} as const;

// ─── Oznake SL/EN (enak vzorec kot ostale plasti) ───────────────────────────

export const WATCH_KIND_LABELS: Readonly<
  Record<WatchKind, { sl: string; en: string; it: string; de: string; fr: string; es: string }>
> = {
  price: { sl: "Cena izdelka", en: "Product price", it: "Prezzo del prodotto", de: "Produktpreis", fr: "Prix du produit", es: "Precio del producto" },
  weather: { sl: "Vreme na poti", en: "Trip weather", it: "Meteo del viaggio", de: "Wetter auf der Reise", fr: "Météo du voyage", es: "Clima del viaje" },
  trip_day: { sl: "Dnevi do poti", en: "Trip countdown", it: "Conto alla rovescia del viaggio", de: "Countdown zur Reise", fr: "Compte à rebours du voyage", es: "Cuenta atrás del viaje" },
  booking: { sl: "Rezervacije pred potjo", en: "Bookings before trip", it: "Prenotazioni prima del viaggio", de: "Buchungen vor der Reise", fr: "Réservations avant le voyage", es: "Reservas antes del viaje" },
};

export const NOTIFICATION_SOURCE_LABELS: Readonly<
  Record<string, { sl: string; en: string; it: string; de: string; fr: string; es: string }>
> = {
  watch: { sl: "Spremljanje", en: "Watch", it: "Monitoraggio", de: "Beobachtung", fr: "Surveillance", es: "Seguimiento" },
  trip: { sl: "Pot", en: "Trip", it: "Viaggio", de: "Reise", fr: "Voyage", es: "Viaje" },
  booking: { sl: "Rezervacija", en: "Booking", it: "Prenotazione", de: "Buchung", fr: "Réservation", es: "Reserva" },
  system: { sl: "Sistem", en: "System", it: "Sistema", de: "System", fr: "Système", es: "Sistema" },
};

export const SEVERITY_LABELS: Readonly<
  Record<string, { sl: string; en: string; it: string; de: string; fr: string; es: string }>
> = {
  info: { sl: "Informacija", en: "Info", it: "Informazione", de: "Info", fr: "Info", es: "Información" },
  warning: { sl: "Opozorilo", en: "Warning", it: "Avviso", de: "Warnung", fr: "Avertissement", es: "Aviso" },
  success: { sl: "Dobra novica", en: "Good news", it: "Buona notizia", de: "Gute Nachricht", fr: "Bonne nouvelle", es: "Buena noticia" },
};

// ─── Validacija vnosa ───────────────────────────────────────────────────────

export interface WatchValidationOk {
  ok: true;
  kind: WatchKind;
  targetKind: WatchTargetKind;
  /** Kanonski pogoj (JSON niz za shranjevanje). */
  condition: string;
}
export interface WatchValidationError {
  ok: false;
  error: string;
  /** Iskren seznam dovoljenih vrednosti (za prikaz). */
  allowed?: readonly string[];
  /** Znana, a ZAVRŽENA vrsta → iskreno sporočilo iz UNSUPPORTED_WATCH_KINDS. */
  unsupported?: { sl: string; en: string };
}
export type WatchValidation = WatchValidationOk | WatchValidationError;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampInt(
  v: unknown,
  bounds: { min: number; max: number; default: number }
): number | null {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim() !== ""
        ? Number(v)
        : bounds.default;
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < bounds.min || i > bounds.max) return null;
  return i;
}

/**
 * Validiraj pogoj glede na vrsto (STREŽNIŠKO). Neznan/odsoten pogoj →
 * privzete vrednosti (determinizem); znane vrednosti IZVEN meja → iskrena
 * napaka z intervalom (nikoli tiho popravljeno — uporabnik ve, kaj velja).
 */
export function validateWatchCondition(
  kind: WatchKind,
  raw: unknown
): { ok: true; condition: WatchCondition } | { ok: false; error: string } {
  if (raw !== undefined && raw !== null && !isRecord(raw)) {
    return { ok: false, error: "Pogoj spremljanja mora biti objekt." };
  }
  const input = (raw ?? {}) as Record<string, unknown>;

  if (kind === "price") {
    const dropPct = clampInt(input.dropPct, WATCH_CONDITION_BOUNDS.price.dropPct);
    if (dropPct === null) {
      return {
        ok: false,
        error: `Prag padca cene mora biti med ${WATCH_CONDITION_BOUNDS.price.dropPct.min} in ${WATCH_CONDITION_BOUNDS.price.dropPct.max} %.`,
      };
    }
    return { ok: true, condition: { kind, dropPct } };
  }
  if (kind === "weather") {
    const maxPrecipMm = clampInt(
      input.maxPrecipMm,
      WATCH_CONDITION_BOUNDS.weather.maxPrecipMm
    );
    if (maxPrecipMm === null) {
      return {
        ok: false,
        error: `Prag padavin mora biti med ${WATCH_CONDITION_BOUNDS.weather.maxPrecipMm.min} in ${WATCH_CONDITION_BOUNDS.weather.maxPrecipMm.max} mm.`,
      };
    }
    return { ok: true, condition: { kind, maxPrecipMm } };
  }
  if (kind === "booking") {
    const remindDaysBefore = clampInt(
      input.remindDaysBefore,
      WATCH_CONDITION_BOUNDS.booking.remindDaysBefore
    );
    if (remindDaysBefore === null) {
      return {
        ok: false,
        error: `Število dni opomnika mora biti med ${WATCH_CONDITION_BOUNDS.booking.remindDaysBefore.min} in ${WATCH_CONDITION_BOUNDS.booking.remindDaysBefore.max}.`,
      };
    }
    return { ok: true, condition: { kind, remindDaysBefore } };
  }
  // trip_day: mejniki so fiksni (brez konfiguracije).
  return { ok: true, condition: { kind: "trip_day" } };
}

/**
 * Validiraj celoten vnos za novo spremljanje. Preverja: vrsto (zavrnjene
 * vrste → iskrena napaka), ciljno vrsto in kombinacijo vrsta × cilj.
 * ID cilja NE validira obstoja tukaj (to je naloga strežnika ob bazi) —
 * samo obliko (dolžina, sanitizacija, brez injekcije).
 */
export function validateWatchInput(input: {
  kind: unknown;
  targetKind: unknown;
  targetId: unknown;
  condition?: unknown;
}): WatchValidation {
  if (typeof input.kind !== "string") {
    return {
      ok: false,
      error: "Manjka vrsta spremljanja.",
      allowed: WATCH_KINDS,
    };
  }
  if (typeof input.kind === "string" && input.kind in UNSUPPORTED_WATCH_KINDS) {
    return {
      ok: false,
      error: UNSUPPORTED_WATCH_KINDS[input.kind].sl,
      unsupported: UNSUPPORTED_WATCH_KINDS[input.kind],
    };
  }
  if (!(WATCH_KINDS as readonly string[]).includes(input.kind)) {
    return {
      ok: false,
      error: "Neznana vrsta spremljanja.",
      allowed: WATCH_KINDS,
    };
  }
  const kind = input.kind as WatchKind;

  if (
    typeof input.targetKind !== "string" ||
    !(WATCH_TARGET_KINDS as readonly string[]).includes(input.targetKind)
  ) {
    return {
      ok: false,
      error: "Neveljavna vrsta cilja.",
      allowed: WATCH_TARGET_KINDS,
    };
  }
  const targetKind = input.targetKind as WatchTargetKind;

  if (WATCH_KIND_TARGETS[kind] !== targetKind) {
    return {
      ok: false,
      error: `Vrsta „${kind}" spremlja samo cilje vrste „${WATCH_KIND_TARGETS[kind]}".`,
    };
  }

  if (
    typeof input.targetId !== "string" ||
    input.targetId.trim().length < 1 ||
    input.targetId.length > 120
  ) {
    return { ok: false, error: "Neveljaven ali predolg ciljni identifikator." };
  }
  const targetId = sanitizeUntrustedText(input.targetId.trim(), { maxLen: 120 });
  if (detectPromptInjection(targetId).hit) {
    return {
      ok: false,
      error: "Ciljni identifikator vsebuje nedovoljeno vsebino.",
    };
  }

  const cond = validateWatchCondition(kind, input.condition);
  if (!cond.ok) return { ok: false, error: cond.error };

  return {
    ok: true,
    kind,
    targetKind,
    condition: JSON.stringify(cond.condition),
  };
}

/**
 * Razčleni SHRANJENI pogoj (iz baze). Napacen/pokvarjen zapis → null
 * (fail-closed: preverjanje takega spremljanja se preskoči, nič izmišljenih
 * pragov). Zapisi nastanejo IZKLJUČNO prek validateWatchCondition, zato je
 * null napaka stanja baze — ne uporabnikova.
 */
export function parseStoredCondition(
  kind: string,
  condition: string
): WatchCondition | null {
  if (!(WATCH_KINDS as readonly string[]).includes(kind)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(condition);
  } catch {
    return null;
  }
  const validated = validateWatchCondition(kind as WatchKind, parsed);
  return validated.ok ? validated.condition : null;
}

// ─── Opažanja (JSON v lastObservation) ──────────────────────────────────────

/** Prejšnje opažanje cene (preverljiva osnova za primerjavo). */
export interface PriceObservation {
  priceCents: number;
  observedAt: string;
}

export function parsePriceObservation(
  raw: string | null | undefined
): PriceObservation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    if (
      typeof parsed.priceCents !== "number" ||
      !Number.isFinite(parsed.priceCents) ||
      parsed.priceCents <= 0 ||
      !Number.isInteger(parsed.priceCents)
    ) {
      return null;
    }
    if (typeof parsed.observedAt !== "string" || parsed.observedAt === "") {
      return null;
    }
    return { priceCents: parsed.priceCents, observedAt: parsed.observedAt };
  } catch {
    return null;
  }
}

// ─── Vrednotenja (čiste funkcije) ───────────────────────────────────────────

/** Rezultat vrednotenja — statusi so IZKRENI, nikoli optimistični. */
export type WatchEvaluationStatus =
  | "triggered" // pogoj izpolnjen → obvestilo (dedupe ključ znotraj)
  | "baseline" // prvo opažanje zabeleženo, NO alert (ni osnove za primerjavo)
  | "quiet" // preverjeno, pogoj NI izpolnjen
  | "pending" // vir še ne pokriva (npr. napoved za oddaljene datume)
  | "not_applicable" // cilj brez datumov / že mimo / nedosegljiv za uporabnika
  | "unavailable"; // vir trenutno nedosegljiv / presežena meja — NO alert

export interface WatchNotificationDraft {
  source: "watch";
  severity: "info" | "warning" | "success";
  title: string;
  body: string;
  /** Kompakten JSON brez skrivnosti (dejanje, vrednosti). */
  data: string;
  /** Enoten na (userId, dedupeKey) → idempotenten cron. */
  dedupeKey: string;
}

export interface WatchEvaluation {
  status: WatchEvaluationStatus;
  /** Novo opažanje za shranjevanje (null = pusti obstoječe). */
  observation: string | null;
  notification: WatchNotificationDraft | null;
  /** Iskren razlog stanja (za poročilo crona / prikaz). */
  note: string;
}

function fmtEur(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

/** Datum "YYYY-MM-DD" → "24. okt." (lokalna, določena oblika). */
export function shortDateLabel(iso: string): string {
  const months = [
    "jan", "feb", "mar", "apr", "maj", "jun",
    "jul", "avg", "sep", "okt", "nov", "dec",
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])}. ${months[Number(m[2]) - 1]}`;
}

/**
 * PRICE — padec cene SAMO iz dveh preverljivih cen.
 * CRITICAL (§4): brez prejšnjega opažanja OBVEZNO baseline (izhodišče),
 * nikoli »padlo«. Enaka cena / zvišanje → quiet (opažanje se osveži).
 */
export function evaluatePriceWatch(input: {
  watchId: string;
  productSlug: string;
  productName: string;
  dropPct: number;
  /** Trenutna cena izdelka (baza) — null = izdelek ni več na voljo. */
  currentPriceCents: number | null;
  /** Prejšnje opažanje (lastObservation) — null = prvič. */
  previous: PriceObservation | null;
  now: string;
}): WatchEvaluation {
  const { watchId, productSlug, productName, dropPct } = input;

  if (input.currentPriceCents === null || input.currentPriceCents <= 0) {
    // Izdelek razprodan/pouflakan/izbrisan → NO alert, iskreno stanje.
    return {
      status: "not_applicable",
      observation: input.previous
        ? JSON.stringify({ ...input.previous, unavailable: true })
        : null,
      notification: null,
      note: "izdelek trenutno ni na voljo (brez lažnega opazovanja)",
    };
  }

  const observation: PriceObservation = {
    priceCents: input.currentPriceCents,
    observedAt: input.now,
  };
  const observationJson = JSON.stringify(observation);

  if (!input.previous) {
    return {
      status: "baseline",
      observation: observationJson,
      notification: null,
      note: "izhodiščna cena zabeležena (brez opozorila — št. preverljivih cen: 1)",
    };
  }

  const prev = input.previous.priceCents;
  const curr = input.currentPriceCents;
  if (curr < prev) {
    const dropPctActual = ((prev - curr) / prev) * 100;
    if (dropPctActual + 1e-9 >= dropPct) {
      return {
        status: "triggered",
        observation: observationJson,
        notification: {
          source: "watch",
          severity: "success",
          title: `Cena je padla: ${productName}`,
          body: `Cena je padla s ${fmtEur(prev)} na ${fmtEur(curr)} (−${Math.round(dropPctActual)} %, prag ${dropPct} %). Obe ceni sta preverjeni iz tržnice.`,
          data: JSON.stringify({
            action: "/trznica",
            kind: "price",
            productSlug,
            prevPriceCents: prev,
            priceCents: curr,
          }),
          dedupeKey: `price:${watchId}:${prev}:${curr}`,
        },
        note: `padec ${Math.round(dropPctActual)} % (≥ prag ${dropPct} %)`,
      };
    }
    return {
      status: "quiet",
      observation: observationJson,
      notification: null,
      note: `manjši padec (${Math.round(dropPctActual)} % < prag ${dropPct} %)`,
    };
  }

  return {
    status: "quiet",
    observation: observationJson,
    notification: null,
    note: curr > prev ? "cena se je zvišala (novo izhodišče)" : "cena je nespremenjena",
  };
}

// ─── WEATHER ────────────────────────────────────────────────────────────────

/** Dan poti z lokacijo opazovanja (coordKey = zaokroženi koordinati). */
export interface WeatherWatchDay {
  iso: string;
  coordKey: string;
}

/**
 * WEATHER — padavine/nevihta na dnevih poti (na lokaciji dnevnega postanka).
 *  - brez datumov pote → not_applicable (iskreno);
 *  - pot v preteklosti → not_applicable;
 *  - napoved za dan še ne obstaja (horizont 16 dni) → pending, NO alert;
 *  - vir nedosegljiv za katero koli lokacijo → unavailable, NO alert;
 *  - prvi dan z ≥ maxPrecipMm mm padavin ALI vročo WMO kodo → triggered
 *    (dedupe po dnevu — eno obvestilo na dan poti).
 */
export function evaluateWeatherWatch(input: {
  watchId: string;
  shareId: string;
  tripName: string;
  maxPrecipMm: number;
  /** Dnevi poti (samo prihodnji) z lokacijo opazovanja; prazno = brez datumov. */
  tripDays: WeatherWatchDay[];
  /** Napoved po lokaciji (null = pridobivanje ni uspelo). */
  forecastByCoord: ReadonlyMap<string, readonly WeatherDay[] | null>;
  todayIso: string;
}): WatchEvaluation {
  const { watchId, maxPrecipMm, todayIso } = input;

  if (input.tripDays.length === 0) {
    return {
      status: "not_applicable",
      observation: null,
      notification: null,
      note: "pot nima določenih datumov (ali je že mimo) — vremensko opazovanje čaka na datume",
    };
  }

  const horizonEnd = addDaysIso(todayIso, WATCH_FORECAST_HORIZON_DAYS - 1);
  if (!horizonEnd) {
    return { status: "unavailable", observation: null, notification: null, note: "napaka datuma" };
  }

  let worst: { iso: string; precipMm: number; code: number } | null = null;
  for (const day of input.tripDays) {
    if (day.iso < todayIso) continue; // že mimo
    if (day.iso > horizonEnd) continue; // še izven horizonta (spodaj: pending)

    const forecast = input.forecastByCoord.get(day.coordKey);
    if (forecast === undefined) {
      // Lokacija izven dovoljene meje preverjanja (bounded run) — iskreno.
      return {
        status: "unavailable",
        observation: null,
        notification: null,
        note: "preveč različnih lokacij v enem preverjanju (omejitev) — poskus bo znova",
      };
    }
    if (forecast === null) {
      return {
        status: "unavailable",
        observation: null,
        notification: null,
        note: "vremenski vir trenutno ni dosegljivo (brez izmišljenih napovedi)",
      };
    }
    const entry = forecast.find((d) => d.date === day.iso);
    if (!entry) continue; // dan brez vnosa v napovedi → preskoči (vir veje)

    if (
      !worst ||
      entry.precipMm > worst.precipMm ||
      (entry.precipMm === worst.precipMm && entry.code > worst.code)
    ) {
      worst = { iso: day.iso, precipMm: entry.precipMm, code: entry.code };
    }

    const severe = (SEVERE_WEATHER_CODES as readonly number[]).includes(entry.code);
    if (entry.precipMm >= maxPrecipMm || severe) {
      const label =
        entry.precipMm >= maxPrecipMm
          ? `${entry.precipMm.toFixed(1).replace(".", ",")} mm padavin (prag ${maxPrecipMm} mm)`
          : "vroča vremenska koda";
      return {
        status: "triggered",
        observation: JSON.stringify({
          worstDayIso: day.iso,
          precipMm: entry.precipMm,
          code: entry.code,
          observedAt: input.todayIso,
        }),
        notification: {
          source: "watch",
          severity: "warning",
          title: `Vreme na poti ${shortDateLabel(day.iso)}: ${label.split(" (")[0]}`,
          body: `Dan ${shortDateLabel(day.iso)} na pote „${input.tripName}" napoveduje ${label}. Napoved je iz Open-Meteo za lokacijo postanka tega dne — preveri notranje zamenjave (npr. jame/muzeje) na /pot/${input.shareId}.`,
          data: JSON.stringify({
            action: `/pot/${input.shareId}`,
            kind: "weather",
            dayIso: day.iso,
            precipMm: entry.precipMm,
            code: entry.code,
          }),
          dedupeKey: `weather:${watchId}:${day.iso}`,
        },
        note: `slabo vreme ${day.iso} (${label})`,
      };
    }
  }

  if (worst) {
    // Vsaj en dan znotraj horizonta preverjen in miren.
    const anyBeyond = input.tripDays.some(
      (d) => d.iso > horizonEnd && d.iso >= todayIso
    );
    return {
      status: anyBeyond ? "pending" : "quiet",
      observation: JSON.stringify({
        worstDayIso: worst.iso,
        precipMm: worst.precipMm,
        code: worst.code,
        observedAt: input.todayIso,
      }),
      notification: null,
      note: anyBeyond
        ? `največ padavin v horizontu: ${worst.precipMm.toFixed(1).replace(".", ",")} mm (${worst.iso}) — ostali dnevi še izven horizonta napovedi`
        : `največ padavin: ${worst.precipMm.toFixed(1).replace(".", ",")} mm (${worst.iso}) — pod pragom ${maxPrecipMm} mm`,
    };
  }

  // Noben dan še znotraj horizonta (pot je oddaljena > 16 dni).
  return {
    status: "pending",
    observation: null,
    notification: null,
    note: "napoved še ne pokriva datumov pote (horizont 16 dni) — brez lažnega miru",
  };
}

// ─── TRIP DAY (odštev dni) ──────────────────────────────────────────────────

/**
 * TRIP_DAY — mejnika 7 dni in 1 dan pred začetkom pote (fiksna množica).
 * Dedupe po mejniku → vsak mejnik obvesti ENKRAT (idempotenten cron).
 */
export function evaluateTripDayWatch(input: {
  watchId: string;
  shareId: string;
  tripName: string;
  /** Začetni datum pote (YYYY-MM-DD) — null = nedoločen. */
  dateStart: string | null;
  todayIso: string;
}): WatchEvaluation {
  const { watchId, todayIso } = input;

  if (!input.dateStart || !isIsoDate(input.dateStart)) {
    return {
      status: "not_applicable",
      observation: null,
      notification: null,
      note: "pot nima določenega začetka — odštev čaka na datume",
    };
  }
  const daysUntil = daysBetweenIso(todayIso, input.dateStart);
  if (daysUntil === null) {
    return { status: "not_applicable", observation: null, notification: null, note: "neveljaven datum" };
  }
  if (daysUntil < 0) {
    return {
      status: "not_applicable",
      observation: JSON.stringify({ daysUntil, observedAt: todayIso }),
      notification: null,
      note: "pot se je že začela (ali je mimo) — odštev konec",
    };
  }

  const observation = JSON.stringify({ daysUntil, observedAt: todayIso });

  if ((TRIP_DAY_MILESTONES as readonly number[]).includes(daysUntil)) {
    return {
      status: "triggered",
      observation,
      notification: {
        source: "watch",
        severity: daysUntil === 0 ? "warning" : "info",
        title: daysUntil === 0 ? `Pot začenja DANES: ${input.tripName}` : `Pot se začenja čez ${daysUntil} dni: ${input.tripName}`,
        body:
          daysUntil === 0
            ? `Tvoja pot „${input.tripName}" se začenja danes. Preveri Go Mode (/na-poti) in potrditve rezervacij na /pot/${input.shareId}.`
            : `Tvoja pot „${input.tripName}" se začenja čez ${daysUntil} dni. Čas za potrditve rezervacij in pakiranje — pot je na /pot/${input.shareId}.`,
        data: JSON.stringify({
          action: `/pot/${input.shareId}`,
          kind: "trip_day",
          daysUntil,
        }),
        dedupeKey: `tripday:${watchId}:d${daysUntil}`,
      },
      note: `mejnik ${daysUntil} dni`,
    };
  }

  return {
    status: "quiet",
    observation,
    notification: null,
    note: `še ${daysUntil} dni do pote (mejnika: 7 in 1)`,
  };
}

// ─── BOOKING (nepotrjene rezervacije pred potjo) ────────────────────────────

/**
 * BOOKING — opomnik za nepotrjene (IDEA) rezervacije v oknu pred potjo.
 * Dedupe po koledarskem dnevu → največ en opomnik na dan (idempotentno).
 */
export function evaluateBookingWatch(input: {
  watchId: string;
  shareId: string;
  tripName: string;
  remindDaysBefore: number;
  dateStart: string | null;
  /** Število rezervacij v statusu IDEA na pote. */
  ideaCount: number;
  todayIso: string;
}): WatchEvaluation {
  const { watchId, todayIso, remindDaysBefore } = input;

  if (!input.dateStart || !isIsoDate(input.dateStart)) {
    return {
      status: "not_applicable",
      observation: null,
      notification: null,
      note: "pot nima določenega začetka — opomnik rezervacij čaka na datume",
    };
  }
  const daysUntil = daysBetweenIso(todayIso, input.dateStart);
  if (daysUntil === null || daysUntil < 0) {
    return {
      status: "not_applicable",
      observation: JSON.stringify({ daysUntil: daysUntil ?? null, observedAt: todayIso }),
      notification: null,
      note: "pot že poteka ali je mimo",
    };
  }

  const observation = JSON.stringify({
    daysUntil,
    ideaCount: input.ideaCount,
    observedAt: todayIso,
  });

  if (daysUntil <= remindDaysBefore && input.ideaCount > 0) {
    const wing = input.ideaCount === 1 ? "rezervacijo" : "rezervaciji";
    const many = input.ideaCount === 1 ? "" : input.ideaCount >= 5 ? "rezervacij" : "";
    const label = input.ideaCount === 1 ? wing : many || wing;
    return {
      status: "triggered",
      observation,
      notification: {
        source: "watch",
        severity: "warning",
        title: `${input.ideaCount} ${label} brez potrditve — pot čez ${daysUntil} dni`,
        body: `Na pote „${input.tripName}" je ${input.ideaCount} ${label} v statusu IDEA (zamisel, brez potrditve ponudnika). Pot se začenja čez ${daysUntil} dni — preveri in potrdi na /pot/${input.shareId} (rezervacija postane CONFIRMED samo z dokazom ponudnika).`,
        data: JSON.stringify({
          action: `/pot/${input.shareId}`,
          kind: "booking",
          ideaCount: input.ideaCount,
          daysUntil,
        }),
        dedupeKey: `booking:${watchId}:${todayIso}`,
      },
      note: `${input.ideaCount} IDEA v oknu ${remindDaysBefore} dni`,
    };
  }

  return {
    status: "quiet",
    observation,
    notification: null,
    note:
      input.ideaCount === 0
        ? "vse rezervacije so rešene (0 v statusu IDEA)"
        : `${daysUntil} dni do pote — izven okna opomnika (${remindDaysBefore} dni)`,
  };
}

// ─── Determinizem (kanon istega vhoda → isti izhod) ─────────────────────────

/** Stabilni sort seznamov spremljanj (updatedAt DESC, id DESC — kot spomin). */
export function sortWatchesForList<T extends { updatedAt: Date; id: string }>(
  items: readonly T[]
): T[] {
  return [...items].sort((a, b) => {
    const byDate = b.updatedAt.getTime() - a.updatedAt.getTime();
    return byDate !== 0 ? byDate : (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  });
}

/** Stabilni sort obvestil (novejša prej; createdAt DESC, id DESC). */
export function sortNotificationsForList<
  T extends { createdAt: Date; id: string },
>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const byDate = b.createdAt.getTime() - a.createdAt.getTime();
    return byDate !== 0 ? byDate : (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  });
}
