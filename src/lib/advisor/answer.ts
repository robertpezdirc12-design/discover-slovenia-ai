import {
  answerAiQuestion,
  AI_GUARD_ANSWER,
  detectChatIntent,
  type AdvisorContext,
} from "@/lib/trip-chat-engine";
import { weatherLabel, type WeatherDay } from "@/lib/weather";
import {
  searchStoContent,
  STO_ATTRIBUTION,
} from "@/lib/supply/providers/sto/content";
import { detectPromptInjection } from "@/lib/system-data-guard";
import type { SharedPlan } from "@/lib/shared-plan";
import type { Destination } from "@/lib/slovenia-data";
import {
  advisorDeps,
  mentionedDestinations,
  planStopInfos,
  stripDiacritics,
  type AdvisorDeps,
  type PlanStopInfo,
} from "@/lib/advisor/context";
import {
  LOKAL_CATEGORIES,
  searchLokaliFor,
  type LokalCategory,
} from "@/lib/lokali-data";
import {
  addDaysIso,
  daysBetweenIso,
  eachTripDay,
  forecastAvailabilityFor,
  formatDateShort,
  isIsoDate,
  todayIso,
  weekdayLong,
  type TripDates,
} from "@/lib/trip-dates";

/**
 * ADVISOR ANSWER — SKRIPTNI @AI svetovalec za skupinski klepet (2.24.0).
 *
 * Kje bi bil AI model, tu je SKRIPTA: odgovori se sestavljajo deterministično
 * iz kanonskih virov (register destinacij + lokalna STO vsebina + trenutno
 * vreme Open-Meteo). 0 AI žetonov, 0 AI modelov — kanon P1 (PARITY-SCORECARD:
 * „100 % deterministično — vse zmožnosti so skripte/pravila“).
 *
 * Arhitektura (nadgradnja 2.23.0, ne zamenjava):
 *  1. namen razpozna detectChatIntent (izvožen iz jedra — ISTA kascada);
 *  2. namen „vreme“ → živo trenutno vreme za omenjene destinacije ali
 *     postanke poti (Open-Meteo, PODATKOVNI API, iskreno označen vir in
 *     „ni zagotovilo“; meja 2 klica na vprašanje) + sezone iz registra;
 *     QA U5 (2026-10-11): vprašanje o PRIHODNOSTI („jutri“, „v ponedeljek“,
 *     datum …) + shranjeni datumi poti → DNEVNA napoved (Open-Meteo, isti
 *     vir kot zastavica na /pot) za relevantne dneve, iskreno označena;
 *  3. namen „destinacija“ → jedrni odgovor iz registra + uradni citat STO
 *     (slovenia.info, lokalna datoteka — 0 omrežja) z viri;
 *  4. QA U3 (2026-10-11): namen „hrana“ → predlogi iz zbirke Lokali
 *     (deterministično iskanje po kraju/regiji/vezavi na destinacijo;
 *     iskrena atribucija vira + meje zbirke; brez zadetka → jedro);
 *  5. QA U9 (2026-10-11): sestavljena vprašanja („… IN …“) → odgovor po
 *     delih; nerazumljeni del se IZRECNO pove kot odprt (nikoli tiho);
 *  6. VSAK drug namen (rezervacije, razdalje, predlogi, proračun,
 *     fallback) → NEPOSRREDNO jedro answerAiQuestion (nespremenjeno).
 *
 * FAIL-QUIET nadgradnje: če vreme/napoved ne vrne podatka ali STO datoteka
 * manjka, se enrichment TIHO izpusti in odgovor pade na iskreni jedrni
 * odgovor („NEZNANO“) — NIKOLI se nič ne izmišljuje. Prompt injekcija →
 * varnostni odgovor jedra (AI_GUARD_ANSWER), enako kot 2.23.0.
 *
 * Zasebnost (kanon P1-A §11): kontekst vsebuje SAMO pot + rezervacije +
 * javne kanonske vire; osebni spomin/profil NAMENOMA manjka — sodelavci v
 * skupinskem klepetu ne vidijo zasebnih podatkov.
 */

/** Sezonske oznake (kanon jedra — isti prevodi kot trip-chat-engine). */
const SEASON_LABELS: Record<string, string> = {
  spring: "pomlad",
  summer: "poletje",
  autumn: "jesen",
  winter: "zima",
};

/** Zunanji odvisnosti + kontekst poti (rezervacije, datumi — samo-bralno). */
export interface AdvisorScriptContext extends AdvisorContext {
  deps?: AdvisorDeps;
  /**
   * Realni datumi poti (P0-E — lokalni „YYYY-MM-DD“; null = nedoločeni).
   * QA U5: brez datumov svetovalec iskreno odgovarja s trenutnim stanjem,
   * dnevno napoved pa ponudi, ko datumi obstajajo (kot zastavica na /pot).
   */
  tripDates?: TripDates | null;
}

/** Največ destinacij, za katere svetovalec pridobi živo vreme (meja). */
const MAX_WEATHER_TARGETS = 2;

/** Največ dni v enem odgovoru z dnevno napovedjo (berljivost klepeta). */
const MAX_FORECAST_DAYS = 3;

/** Prednostni vrstni red kategorij za vprašanja o hrani (QA U3). */
const FOOD_CATEGORY_ORDER: readonly LokalCategory[] = [
  "restaurant",
  "bar",
  "hotel",
];

/** Ciljne destinacije za vreme: omenjene v vprašanju, sicer postanki poti. */
function weatherTargets(body: string, stops: PlanStopInfo[]): Destination[] {
  const mentioned = mentionedDestinations(body);
  if (mentioned.length > 0) return mentioned.slice(0, MAX_WEATHER_TARGETS);
  return stops
    .map((s) => s.dest)
    .filter((d): d is Destination => Boolean(d))
    .slice(0, MAX_WEATHER_TARGETS);
}

// ── QA U5: razpoznavanje prihodnosti v vprašanju ─────────────────────────

/** Razpoznan sklic na prihodnji dan/teden v vprašanju (deterministično). */
export type FutureMention =
  | { kind: "tomorrow" }
  | { kind: "date"; iso: string }
  | { kind: "nextweek" }
  | { kind: "weekday"; dow: number };

/** Dnevi tedna po besedah (SL + EN + IT; normalizirano brez diakritik). */
const WEEKDAY_WORDS: ReadonlyArray<{ words: readonly string[]; dow: number }> =
  [
    { words: ["ponedeljek", "monday", "lunedi"], dow: 1 },
    { words: ["torek", "tuesday", "martedi"], dow: 2 },
    { words: ["sreda", "wednesday", "mercoledi"], dow: 3 },
    { words: ["cetrtek", "thursday", "giovedi"], dow: 4 },
    { words: ["petek", "friday", "venerdi"], dow: 5 },
    { words: ["sobota", "saturday", "sabato"], dow: 6 },
    { words: ["nedelja", "sunday", "domenica"], dow: 0 },
  ];

/**
 * Ali vprašanje omenja PRIHODNOST („jutri“, „čez 3 dni“, „v ponedeljek“,
 * „5. 11.“, „naslednji teden“ …). Čista funkcija: ista besedila → isti izhod
 * (relativni/datumski obliki se vežeta na DANES — deterministično na dan).
 * Vrstni red prioritet: jutri > čez N dni > datum > naslednji teden > dan
 * v tednu.
 */
export function resolveFutureMention(body: string): FutureMention | null {
  const nb = stripDiacritics(body);
  if (/\b(jutri|tomorrow|domani|morgen)\b/.test(nb)) {
    return { kind: "tomorrow" };
  }
  // Relativni dnevi: „čez 3 dni“ (meja 60 — čez horizont vira pade na
  // iskreno opombo o 16-dnevnem horizontu, ne na ugibanje)
  const rel = /\bcez\s+(\d{1,2})\s+dn/.exec(nb);
  if (rel) {
    const n = Math.min(60, Math.max(1, Number.parseInt(rel[1], 10)));
    const iso = addDaysIso(todayIso(), n);
    if (iso) return { kind: "date", iso };
  }
  // ISO datum „2026-10-17“
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(nb);
  if (iso) {
    const date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    if (isIsoDate(date)) return { kind: "date", iso: date };
  }
  // Slovenski zapis „17. 10.“ / „17.10.2026“ (le PRIHODNOST — preteklosti
  // ne ugibamo: datum v preteklosti pomeni, da sklica ne razumemo)
  const sl = /\b(\d{1,2})\.\s*(\d{1,2})\.(\s*(\d{4}))?/.exec(nb);
  if (sl) {
    const day = Number.parseInt(sl[1], 10);
    const month = Number.parseInt(sl[2], 10);
    const year = sl[4]
      ? Number.parseInt(sl[4], 10)
      : Number.parseInt(todayIso().slice(0, 4), 10);
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${year}-${pad(month)}-${pad(day)}`;
    if (isIsoDate(date)) return { kind: "date", iso: date };
  }
  if (/\b(naslednji teden|prihodnji teden|next week)\b/.test(nb)) {
    return { kind: "nextweek" };
  }
  for (const w of WEEKDAY_WORDS) {
    if (w.words.some((word) => new RegExp(`\\b${word}\\b`).test(nb))) {
      return { kind: "weekday", dow: w.dow };
    }
  }
  return null;
}

/**
 * Sklic na prihodnost → konkretni lokalni datumi „YYYY-MM-DD“ (DST-varno
 * prek trip-dates). Vrača null, kadar sklica ni mogoče pošteno razrešiti
 * (datum v preteklosti — nikoli ne ugibamo leta).
 */
export function futureIsoDays(
  mention: FutureMention,
  today: string
): string[] | null {
  switch (mention.kind) {
    case "tomorrow": {
      const iso = addDaysIso(today, 1);
      return iso ? [iso] : null;
    }
    case "date": {
      const diff = daysBetweenIso(today, mention.iso);
      if (diff === null || diff < 0) return null; // preteklost → ne ugibamo
      return [mention.iso];
    }
    case "nextweek": {
      // naslednji koledarski teden (pon–ned), omejen na horizont vira
      const todayDow = dayOfWeek(today);
      let untilMonday = (1 - todayDow + 7) % 7;
      if (untilMonday === 0) untilMonday = 7;
      const monday = addDaysIso(today, untilMonday);
      if (!monday) return null;
      const out: string[] = [];
      for (let i = 0; i < 7; i++) {
        const iso = addDaysIso(monday, i);
        if (!iso) break;
        if (forecastAvailabilityFor(iso, today) === "available") out.push(iso);
      }
      return out.length > 0 ? out : null;
    }
    case "weekday": {
      const todayDow = dayOfWeek(today);
      let until = (mention.dow - todayDow + 7) % 7;
      if (until === 0) until = 7; // „v ponedeljek“ ob ponedeljku = naslednji
      const iso = addDaysIso(today, until);
      return iso ? [iso] : null;
    }
  }
}

/** Dan v tednu iz ISO datuma (0=nedelja … 6=sobota) prek poldnevnega sidra. */
function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map((x) => Number.parseInt(x, 10));
  return new Date(y, m - 1, d, 12).getDay();
}

/** Označba sklica za izpis („jutri“, „v ponedeljek“, „naslednji teden“ …). */
function futureLabel(mention: FutureMention): string {
  switch (mention.kind) {
    case "tomorrow":
      return "jutri";
    case "date":
      return formatDateShort(mention.iso, "sl");
    case "nextweek":
      return "naslednji teden";
    case "weekday": {
      const iso = futureIsoDays(mention, todayIso())?.[0];
      return iso ? `v ${weekdayLong(iso, "sl")}` : "ta dan";
    }
  }
}

// ── vreme: trenutno stanje (obstoječa oblika, refaktorirana) ─────────────

/**
 * Sestavi odgovor z živim trenutnim vremenom (deterministično iz podatkov
 * vira). Vrača null, kadar vira ni oz. ni vrnil nič uporabnega → klicatelj
 * pade na iskreni jedrni odgovor („NEZNANO“).
 */
async function currentWeatherAnswer(
  targets: Destination[],
  deps: AdvisorDeps
): Promise<string | null> {
  const { fetchCurrentWeather } = advisorDeps(deps);
  const lines: string[] = [];
  for (const d of targets) {
    const w = await fetchCurrentWeather(d.coords.lat, d.coords.lng);
    if (w) {
      lines.push(
        `· ${d.name}: ${Math.round(w.temperatureC)} °C, ${weatherLabel(w.weatherCode, "sl")}`
      );
    }
  }
  if (lines.length === 0) return null; // vir odpovedal → jedro (iskrenost)

  const seasonLines = targets.map(
    (d) =>
      `· ${d.name}: najlepše v ${
        d.bestSeason.map((s) => SEASON_LABELS[s] ?? s).join(", ") || "NEZNANO (ni podatka)"
      }`
  );

  return (
    `Trenutno vreme (vir Open-Meteo — stanje ob poizvedbi, NI zagotovilo):\n` +
    `${lines.join("\n")}\n` +
    `Za uradno napoved preveri ARSO (meteo.arso.gov.si).\n` +
    `Iz registra destinacij pa vem, kdaj je najlepše:\n${seasonLines.join("\n")}`
  );
}

// ── vreme: dnevna napoved za prihodnost (QA U5) ──────────────────────────

/**
 * Cilji napovedi: omenjene destinacije; sicer postanki ustreznih dni poti;
 * sicer prvi postanki. VEDNO ≤ MAX_WEATHER_TARGETS (meja klicev vira).
 */
function forecastTargets(
  body: string,
  stops: PlanStopInfo[],
  tripDayIndexes: Set<number>
): Destination[] {
  const mentioned = mentionedDestinations(body);
  if (mentioned.length > 0) return mentioned.slice(0, MAX_WEATHER_TARGETS);
  const dayStops: Destination[] = [];
  for (const s of stops) {
    if (!s.dest) continue;
    if (tripDayIndexes.size > 0 && !tripDayIndexes.has(s.day)) continue;
    if (!dayStops.some((d) => d.slug === s.dest?.slug)) dayStops.push(s.dest);
    if (dayStops.length >= MAX_WEATHER_TARGETS) break;
  }
  if (dayStops.length > 0) return dayStops;
  return stops
    .map((s) => s.dest)
    .filter((d): d is Destination => Boolean(d))
    .slice(0, MAX_WEATHER_TARGETS);
}

/**
 * Odgovor z DNEVNO napovedjo za omenjene dni (QA U5). Iskreno:
 *  · brez shranjenih datumov poti → napovedi nimam, ponudim trenutno stanje;
 *  · dan čez 16-dnevni horizont vira → napovedi nimam, ponudim trenutno;
 *  · vir odpove → napovedi nisem dobil, ponudim trenutno (fail-quiet).
 * Vrača null samo, če tudi trenutno stanje ni na voljo → jedro (NEZNANO).
 */
async function answerWeatherForecast(
  body: string,
  mention: FutureMention,
  stops: PlanStopInfo[],
  deps: AdvisorDeps,
  tripDates: TripDates | null | undefined
): Promise<string | null> {
  const current = () =>
    currentWeatherAnswer(weatherTargets(body, stops), deps);

  // 1) Brez datumov poti napovedi NE obljuvimo (iskrena meja — datumi so
  //    tisto, zaradi česar sploh vemo, kateri dnevi te poti zanimajo).
  if (!tripDates) {
    const now = await current();
    if (now === null) return null;
    return (
      `Napovedi za prihodnje dni ti lahko povem, ko pot ima shranjene datume ` +
      `(zavihek Datumi na strani potovanja) — do tedaj napovedi nimam, ` +
      `tukaj je trenutno stanje:\n\n${now}`
    );
  }

  // 2) Sklic → konkretni datumi; preteklosti NE ugibamo (null → trenutno).
  const today = todayIso();
  const days = futureIsoDays(mention, today);
  if (days === null) return current();
  const available = days
    .filter((iso) => forecastAvailabilityFor(iso, today) === "available")
    .slice(0, MAX_FORECAST_DAYS);
  if (available.length === 0) {
    const now = await current();
    if (now === null) return null;
    return (
      `Ta dan je čez 16-dnevni horizont vira (Open-Meteo) — napovedi nimam, ` +
      `tukaj je trenutno stanje:\n\n${now}`
    );
  }

  // 3) Cilji: omenjene destinacije > postanki ustreznih dni > prvi postanki.
  const tripDays = eachTripDay(tripDates) ?? [];
  const dayIndexByIso = new Map(tripDays.map((t) => [t.iso, t.dayIndex]));
  const relevantDayIndexes = new Set(
    available
      .map((iso) => dayIndexByIso.get(iso))
      .filter((n): n is number => typeof n === "number")
  );
  const targets = forecastTargets(body, stops, relevantDayIndexes);
  if (targets.length === 0) return current();

  // 4) Dnevna napoved po ciljih (meja 2 klica — kot trenutno vreme).
  const { fetchDailyWeather } = advisorDeps(deps);
  const lines: string[] = [];
  for (const d of targets) {
    const daily: WeatherDay[] | null = await fetchDailyWeather(
      d.coords.lat,
      d.coords.lng
    );
    if (!daily) continue;
    for (const iso of available) {
      const day = daily.find((x) => x.date === iso);
      if (!day) continue; // tega dne vir ni izdal — izpustimo, ne izmišljamo
      const tripNo = dayIndexByIso.get(iso);
      const dayTag = tripNo
        ? ` (dan ${tripNo} tvoje poti)`
        : "";
      lines.push(
        `· ${d.name}${dayTag}: ${Math.round(day.tMinC)}–${Math.round(day.tMaxC)} °C, ` +
          `${weatherLabel(day.code, "sl")}, padavine ${day.precipProbPct} % — ` +
          `${weekdayLong(iso, "sl")}, ${formatDateShort(iso, "sl")}`
      );
    }
  }

  if (lines.length === 0) {
    const now = await current();
    if (now === null) return null;
    return (
      `Dnevne napovedi (${futureLabel(mention)}) trenutno nisem dobil od vira ` +
      `— tukaj je trenutno stanje:\n\n${now}`
    );
  }

  return (
    `Dnevna napoved za ${futureLabel(mention)} (vir Open-Meteo — NAPOVED, ne zagotovilo):\n` +
    `${lines.join("\n")}\n` +
    `Za uradno napoved preveri ARSO (meteo.arso.gov.si).`
  );
}

/** Vreme: preusmeritev trenutno/prihodnje (QA U5) + fail-quiet → jedro. */
async function answerWeatherLive(
  body: string,
  plan: SharedPlan,
  deps: AdvisorDeps,
  tripDates?: TripDates | null
): Promise<string | null> {
  const stops = planStopInfos(plan);

  // QA U5: vprašanje o prihodnosti → dnevna napoved (iskreno označena).
  const future = resolveFutureMention(body);
  if (future) {
    return answerWeatherForecast(body, future, stops, deps, tripDates);
  }

  const targets = weatherTargets(body, stops);
  if (targets.length === 0) return null; // brez ciljev → jedro odgovori iskreno
  return currentWeatherAnswer(targets, deps);
}

// ── hrana: predlogi iz zbirke Lokali (QA U3) ─────────────────────────────

/**
 * Odgovor na vprašanje o hrani iz ZBIRKE LOKALI (deterministično iskanje:
 * vezava na destinacijo/kraj > ista regija; kategorije samo jesti).
 * Vrača null, kadar zadetka ni (neznan kraj, prazna pot) ali zbirka za ta
 * kraj nima gostinskega zapisa → klicatelj pade na iskreni jedrni odgovor.
 */
function answerFoodLive(body: string, plan: SharedPlan): string | null {
  const mentioned = mentionedDestinations(body);
  const stops = planStopInfos(plan);
  const dest = mentioned[0] ?? stops.find((s) => s.dest)?.dest;
  if (!dest) return null; // brez kraja ne ugibamo

  const lokali = searchLokaliFor({
    destinationSlug: dest.slug,
    town: dest.name,
    region: dest.region,
    categories: FOOD_CATEGORY_ORDER,
    categoryOrder: FOOD_CATEGORY_ORDER,
    limit: 3,
  });
  if (lokali.length === 0) return null; // zbirka za ta kraj nima gostilce

  const lines = lokali.map(
    (l) => `· ${l.name} — ${LOKAL_CATEGORIES[l.category].sl}, ${l.town}`
  );
  return (
    `Za ${dest.name} imam v zbirki Lokali te predloge, kjer lahko jeste:\n` +
    `${lines.join("\n")}\n` +
    `(vir: zbirka Lokali — uredniška kuracija, ne rezervacijski sistem; ` +
    `natančnih naslovov, kontaktov in odpiralnih časov zbirka iskreno nima ` +
    `zaenkrat — ne izmišljujemo jih. Celoten imenik: /lokali)\n` +
    `Splošen nasvet: v Sloveniji kosilo ponudijo gostilne med 11. in 14. uro, ` +
    `sobote in nedelje pa so polnejše — rezerviraj prej.`
  );
}

/**
 * Uradni citat STO (slovenia.info) za destinacijo — LOKALNA datoteka
 * data/sto-content.json, 0 omrežja. Vrača null ob napaki/manjkanju zadetkov
 * (fail-quiet — enrichment se izpusti, jedrni odgovor ostane).
 */
async function stoQuoteFor(
  dest: Destination,
  deps: AdvisorDeps
): Promise<string | null> {
  try {
    const { loadSto } = advisorDeps(deps);
    const loaded = await loadSto();
    if (loaded.status !== "ok" || !loaded.dataset) return null;
    const hits = searchStoContent(dest.name, loaded.dataset.entries, {
      language: "sl",
      limit: 2,
    });
    if (hits.length === 0) return null;
    const lines = hits.map(
      (h) => `· ${h.entry.title} — ${h.entry.url}`
    );
    return `Uradna vsebina (vir ${STO_ATTRIBUTION}):\n${lines.join("\n")}`;
  } catch {
    return null; // fail-quiet: STO ni dosegljiv → brez citata
  }
}

// ── sestavljena vprašanja (QA U9) ────────────────────────────────────────

/** Vezniki za razdelitev sestavljenega vprašanja (SL/EN/DE/IT/FR/ES). */
const COMPOUND_SPLIT_RE = /\s+(?:in|ter|pa|and|und|e|et|y)\s+/i;

/** Največ podvprašanj, na katera odgovorimo v enem sporočilu. */
const MAX_SUBQUESTIONS = 3;

/**
 * Razdeli sestavljeno vprašanje na podvprašanja (QA U9). Del se šteje za
 * podvprašanje, kadar je razpoznaven njegov namen ALI je dovolj dolg
 * (≥ 3 besede). IZPUSTIJO SE:
 *  · kratki delci („kaj pa …“ — prašalni členi, ne podvprašanja);
 *  · samic destinacijski delček („Bled“) — to je najpogosteje ostanek
 *    angleske predlogovne zveze („weather in Bled“) ali seznam krajev
 *    („Bledu in Bohinju“), ne samostojno vprašanje.
 * Vrača [], kadar gre za eno samega vprašanja (veznika ni ali je samo en
 * smiseln del) — takrat teče obstoječa enovita pot.
 */
export function splitCompoundQuestion(body: string): string[] {
  const parts = body
    .split(COMPOUND_SPLIT_RE)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 2) return [];
  const kept = parts.filter((p) => {
    const words = p.split(/\s+/).filter(Boolean);
    if (words.length === 1 && mentionedDestinations(p).length > 0) {
      return false; // samic destinacijski delček — ni podvprašanje
    }
    return detectChatIntent(p) !== "fallback" || words.length >= 3;
  });
  if (kept.length < 2) return [];
  return kept.slice(0, MAX_SUBQUESTIONS);
}

/** Iskrena oznaka za del, ki ostaja brez odgovora (QA U9 — nikoli tiho). */
function unansweredPartNote(part: string): string {
  return (
    `Ta del (»${part}«) ostaja brez odgovora — iskreno: tega ne znam ` +
    `enoumeno razumeti in ne ugibam. Vprašaj me posebej o vremenu, ` +
    `razdaljah, predlogih, cenah, hrani ali kateri destinaciji.`
  );
}

// ── glavni vstop ────────────────────────────────────────────────────────

/** Odgovor na ENO (pod)vprašanje — obstoječa kaskada namenov. */
async function answerSingle(
  body: string,
  plan: SharedPlan,
  ctx?: AdvisorScriptContext
): Promise<string> {
  const deps = ctx?.deps;
  const intent = detectChatIntent(body);

  // 1) Vreme → živi podatkovni vir (Open-Meteo: trenutno ali dnevna
  //    napoved, odvisno od tega, ali vprašanje omenja prihodnost); fail-
  //    quiet → jedro.
  if (intent === "weather") {
    const live = await answerWeatherLive(body, plan, deps ?? {}, ctx?.tripDates);
    if (live !== null) return live;
    return answerAiQuestion(body, plan, ctx);
  }

  // 2) Hrana → zbirka Lokali (QA U3); brez zadetka → iskreni jedrni odgovor.
  if (intent === "food") {
    const lokali = answerFoodLive(body, plan);
    if (lokali !== null) return lokali;
    return answerAiQuestion(body, plan, ctx);
  }

  // 3) Destinacija → jedrni odgovor registra + uradni citat STO.
  if (intent === "destination") {
    const base = answerAiQuestion(body, plan, ctx);
    const dest = mentionedDestinations(body)[0];
    if (!dest) return base; // (defenzivno — namen že zagotavlja omembo)
    const quote = await stoQuoteFor(dest, deps ?? {});
    return quote === null ? base : `${base}\n\n${quote}`;
  }

  // 4) Vsi ostali nameni → NEPOSRREDNO jedro (nespremenjeno od 2.23.0).
  return answerAiQuestion(body, plan, ctx);
}

/**
 * SKRIPTNI odgovor @AI na sporočilo skupinskega klepeta (glavni vstop;
 * pokliče ga messages route). VEDNO vrne veljaven slovenski odgovor —
 * nikoli ne meče izjem (jedro je totalna funkcija).
 *
 * Determinizem: isti vhod + isti podatki virov → isti izhod. Živo vreme je
 * časovno spremenljivo in je IZRECNO označeno kot „stanje ob poizvedbi“ oz.
 * „napoved“ z virom — nikoli ni predstavljeno kot zagotovilo.
 */
export async function answerAdvisorScript(
  body: string,
  plan: SharedPlan,
  ctx?: AdvisorScriptContext
): Promise<string> {
  // SYSTEM_DATA_GUARD (P0-I §23): poskus navodil → varnostni odgovor jedra
  // (isti kanon kot 2.23.0 — nikoli izvedba, nikoli odmev vsebine).
  if (detectPromptInjection(body).hit) return AI_GUARD_ANSWER;

  // QA U9 (2026-10-11): sestavljeno vprašanje („… IN …“) → odgovor PO
  // DELIH; nerazumljeni del se izrecno pove kot odprt (nikoli tiho).
  const parts = splitCompoundQuestion(body);
  if (parts.length >= 2) {
    const answers: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const answer =
        detectChatIntent(part) === "fallback"
          ? unansweredPartNote(part)
          : await answerSingle(part, plan, ctx);
      answers.push(`${i + 1}) ${answer}`);
    }
    return (
      `Tvoje sporočilo vsebuje več vprašanj — odgovarjam po delih:\n\n` +
      answers.join("\n\n")
    );
  }

  return answerSingle(body, plan, ctx);
}
