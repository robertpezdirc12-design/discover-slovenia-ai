import {
  answerAiQuestion,
  AI_GUARD_ANSWER,
  detectChatIntent,
  type AdvisorContext,
} from "@/lib/trip-chat-engine";
import { weatherLabel } from "@/lib/weather";
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
  type AdvisorDeps,
  type PlanStopInfo,
} from "@/lib/advisor/context";

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
 *  3. namen „destinacija“ → jedrni odgovor iz registra + uradni citat STO
 *     (slovenia.info, lokalna datoteka — 0 omrežja) z viri;
 *  4. VSAK drug namen (rezervacije, razdalje, hrana, predlogi, proračun,
 *     fallback) → NEPOSRREDNO jedro answerAiQuestion (nespremenjeno).
 *
 * FAIL-QUIET nadgradnje: če vreme ne vrne podatka ali STO datoteka manjka,
 * se enrichment TIHO izpusti in odgovor pade na iskreni jedrni odgovor
 * („NEZNANO“) — NIKOLI se nič ne izmišljuje. Prompt injekcija → varnostni
 * odgovor jedra (AI_GUARD_ANSWER), enako kot 2.23.0.
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

/** Zunanji odvisnosti + kontekst poti (rezervacije — samo-bralno). */
export interface AdvisorScriptContext extends AdvisorContext {
  deps?: AdvisorDeps;
}

/** Največ destinacij, za katere svetovalec pridobi živo vreme (meja). */
const MAX_WEATHER_TARGETS = 2;

/** Ciljne destinacije za vreme: omenjene v vprašanju, sicer postanki poti. */
function weatherTargets(body: string, stops: PlanStopInfo[]): Destination[] {
  const mentioned = mentionedDestinations(body);
  if (mentioned.length > 0) return mentioned.slice(0, MAX_WEATHER_TARGETS);
  return stops
    .map((s) => s.dest)
    .filter((d): d is Destination => Boolean(d))
    .slice(0, MAX_WEATHER_TARGETS);
}

/**
 * Sestavi odgovor z živim trenutnim vremenom (deterministično iz podatkov
 * vira). Vrača null, kadar vira ni oz. ni vrnil nič uporabnega → klicatelj
 * pade na iskreni jedrni odgovor („NEZNANO“).
 */
async function answerWeatherLive(
  body: string,
  plan: SharedPlan,
  deps: AdvisorDeps
): Promise<string | null> {
  const targets = weatherTargets(body, planStopInfos(plan));
  if (targets.length === 0) return null; // brez ciljev → jedro odgovori iskreno

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

/**
 * SKRIPTNI odgovor @AI na sporočilo skupinskega klepeta (glavni vstop;
 * pokliče ga messages route). VEDNO vrne veljaven slovenski odgovor —
 * nikoli ne meče izjem (jedro je totalna funkcija).
 *
 * Determinizem: isti vhod + isti podatki virov → isti izhod. Živo vreme je
 * časovno spremenljivo in je IZRECNO označeno kot „stanje ob poizvedbi“ z
 * virom — nikoli ni predstavljeno kot zagotovilo.
 */
export async function answerAdvisorScript(
  body: string,
  plan: SharedPlan,
  ctx?: AdvisorScriptContext
): Promise<string> {
  // SYSTEM_DATA_GUARD (P0-I §23): poskus navodil → varnostni odgovor jedra
  // (isti kanon kot 2.23.0 — nikoli izvedba, nikoli odmev vsebine).
  if (detectPromptInjection(body).hit) return AI_GUARD_ANSWER;

  const deps = ctx?.deps;
  const intent = detectChatIntent(body);

  // 1) Vreme → živi podatkovni vir (Open-Meteo); fail-quiet → jedro.
  if (intent === "weather") {
    const live = await answerWeatherLive(body, plan, deps ?? {});
    if (live !== null) return live;
    return answerAiQuestion(body, plan, ctx);
  }

  // 2) Destinacija → jedrni odgovor registra + uradni citat STO.
  if (intent === "destination") {
    const base = answerAiQuestion(body, plan, ctx);
    const dest = mentionedDestinations(body)[0];
    if (!dest) return base; // (defenzivno — namen že zagotavlja omembo)
    const quote = await stoQuoteFor(dest, deps ?? {});
    return quote === null ? base : `${base}\n\n${quote}`;
  }

  // 3) Vsi ostali nameni → NEPOSRREDNO jedro (nespremenjeno od 2.23.0).
  return answerAiQuestion(body, plan, ctx);
}
