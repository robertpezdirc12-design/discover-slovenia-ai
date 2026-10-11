import {
  DESTINATIONS,
  getDestination,
  type Destination,
} from "@/lib/slovenia-data";
import type { SharedPlan } from "@/lib/shared-plan";
import {
  detectPromptInjection,
  sanitizeUntrustedText,
} from "@/lib/system-data-guard";
import {
  buildCandidateReasons,
  formatReasonsInline,
} from "@/lib/recommendation-reasons";
import {
  formatBookingSummary,
  summarizeReservations,
  type ReservationRowLike,
} from "@/lib/booking-summary";

/**
 * TRIP-CHAT-ENGINE — DETERMINISTIČNO jedro odgovarjalča @AI za skupinski
 * klepet na poti (mostovna rekonstrukcija izvirnika 1.131.0, W2 / Issue #15).
 *
 * Kanon iskrenosti (jedro, semantika nespremenjena od 2.23.0):
 *  - 0 AI žetonov, 0 AI modelov, 0 zunanjih klicev — IZKLJUČNO podatki
 *    poti (plan) + statično znanje o destinacijah iz src/lib/slovenia-data.ts;
 *  - vreme je v tem jedru vedno NEZNANO (žive napovedi ni — povedano
 *    izrecno, svetuje le sezone iz baze);
 *  - razdalje so naravnost (haversine) + cestna ocena po kanonu
 *    načrtovalnika (×1,3, ~60 km/h) — ocena je vidna kot ocena;
 *  - isti vhod → isti izhod (determinizem).
 *
 * 2.24.0 (P1 — SKRIPTE NAMESTO AI MODELA): jedro je OMEGA sloj skriptnega
 * svetovalca (src/lib/advisor/answer.ts — answerAdvisorScript), ki nad istim
 * kanonom doda živo vreme (Open-Meteo, podatkovni API, ne AI) in citate STO
 * (lokalna datoteka slovenia.info). Ob napaki vira svetovalec pade TUKAJ —
 * na čisto 0-omrežno jedro. Ta modul ostane 0-žetonski in brez omrežja.
 */

export const AI_ADVISOR_NAME = "AI svetovalec";

/** Omemba @AI v telesu sporočila (rezervirana beseda — glej messages API). */
export function isAiMention(body: string): boolean {
  return /(^|\s)@ai\b/i.test(body);
}

// ── orodja ─────────────────────────────────────────────────────────────

function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

/** Haversine razdalja v km (naravnost — po zraku). */
function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SEASON_LABELS: Record<string, string> = {
  spring: "pomlad",
  summer: "poletje",
  autumn: "jesen",
  winter: "zima",
};

/** Postanki pote, obogateni s kanonskimi destinacijami (kjer se ujemajo). */
export interface PlanStopRef {
  day: number;
  name: string;
  destSlug?: string;
  dest?: Destination;
}

function planStops(plan: SharedPlan): PlanStopRef[] {
  const out: PlanStopRef[] = [];
  for (const day of plan.days ?? []) {
    for (const loc of day.locations ?? []) {
      out.push({
        day: day.day,
        // SYSTEM_DATA_GUARD (P0-I §23): ime postanka je UPORABNIŠKI vnos —
        // ob vstopu sanitizirano (nadzorni/zero-width/bidi znaki ven, dolžina
        // omejena). Imena destinacij iz registra so kanonska in se ne čistijo.
        name: sanitizeUntrustedText(loc.name, { maxLen: 80, fallback: "Neimenovan postanek" }),
        destSlug: loc.destSlug,
        dest: loc.destSlug ? getDestination(loc.destSlug) : undefined,
      });
    }
  }
  return out;
}

/** Poišči vse destinacije, omenjene v besedilu (po imenu ali slugu). */
function findMentionedDestinations(body: string): Destination[] {
  const nb = stripDiacritics(body);
  const found: Destination[] = [];
  for (const d of DESTINATIONS) {
    const byName = stripDiacritics(d.name);
    const bySlug = stripDiacritics(d.slug.replace(/-/g, " "));
    if (nb.includes(byName) || nb.includes(bySlug)) {
      found.push(d);
    }
  }
  return found;
}

function firstStopCoords(stops: PlanStopRef[]): { lat: number; lng: number } | null {
  for (const s of stops) if (s.dest?.coords) return s.dest.coords;
  return null;
}

// ── namere ─────────────────────────────────────────────────────────────

const KW = {
  weather: ["vreme", "dež", "dez", "dežuje", "dezuje", "sončno", "soncno", "temperatura", "napoved", "toplo", "hladno", "sneg", "padavine", "deževno"],
  distance: ["kako daleč", "kako dalec", "razdalja", "razdalj", "kilometrov", "km", "eta", "kako dolgo", "vozni čas", "vozni cas", "urah", "potovanje do", "vožnja", "voznja", "daleč", "dalec"],
  food: ["večerja", "vecerja", "kosilo", "zajtrk", "hrana", "jesti", "restavracija", "gostilna", "lokal", "lokalov", "picerija", "kava", "vino", "večerjamo", "vecerjamo", "jesva"],
  suggest: ["kaj naslednje", "kam", "predlagaj", "priporoča", "priporca", "nasvet", "manjka", "dodaj", "zmanjka", "kaj še", "kaj se", "naslednji postanek", "naslednja postaja", "kje biti", "kaj videti", "kaj doživetja"],
  budget: ["cena", "strošek", "strosek", "proračun", "proracun", "drago", "poceni", "koliko stane", "evrov", "eur", "€"],
  // P1-B (issue #3 §7): samo-bralna inteligenca rezervacij.
  bookings: ["rezervacij", "rezervacije", "rezervacijo", "potrjeno", "potrjena", "potrjene", "rezerviral", "rezervirano", "imamo rezervirano", "imate rezervirano", "naročeno", "naroceno", "booked"],
  // P1-B (issue #3 §5): razlaga predlogov („Zakaj to predlagaš?").
  why: ["zakaj", "razlog", "utemelji", "od kod predlog", "explain"],
};

function hasAny(nb: string, words: string[]): boolean {
  return words.some((w) => nb.includes(w));
}

// ── odgovori ───────────────────────────────────────────────────────────

function answerWeather(body: string, stops: PlanStopRef[]): string {
  const mentioned = findMentionedDestinations(body);
  const targets = mentioned.length > 0 ? mentioned : stops.map((s) => s.dest).filter((d): d is Destination => Boolean(d)).slice(0, 3);
  if (targets.length === 0) {
    return "Trenutno vreme je NEZNANO — odgovarjam izključno iz podatkov poti in baze destinacij (0 zunanjih klicev). Dnevno napoved za dneve poti vidiš na strani potovanja (vir Open-Meteo); za uradno napoved preveri ARSO (meteo.arso.gov.si); pred odhodom pa glej zavihek Pot — vsak postanek ima navedene sezone.";
  }
  const lines = targets.map(
    (d) =>
      `· ${d.name}: najlepše v ${d.bestSeason.map((s) => SEASON_LABELS[s] ?? s).join(", ") || "NEZNANO (ni podatka)"}`
  );
  return `Trenutno vreme je NEZNANO — vremenski vir je pravkar odpovedal (iskrena meja tega sloja: 0 zunanjih klicev, odgovarjam samo iz baze 38 destinacij). Dnevno napoved za dneve poti vidiš na strani potovanja (vir Open-Meteo); za uradno napoved preveri ARSO (meteo.arso.gov.si). Iz baze pa vem, kdaj je najlepše:\n${lines.join("\n")}`;
}

function answerDistance(body: string, stops: PlanStopRef[]): string {
  const mentioned = findMentionedDestinations(body);
  if (mentioned.length >= 2) {
    const [a, b] = mentioned;
    const km = haversineKm(a.coords, b.coords);
    const road = Math.round(km * 1.3);
    const min = Math.round((road / 60) * 60);
    return `Med ${a.name} in ${b.name} je približno ${Math.round(km)} km naravnost (po zraku). Cestna ocena po kanonu načrtovalnika: ~${road} km, vožnja ~${min} minut pri 60 km/h — TO JE OCENA, ne izmerjen vozni čas. Za točno navigacijo uporabi povezavo Navigiraj (OSM) na strani potovanja.`;
  }
  // ena ali nič omenjena → razdalja od prvega postanka pote
  const anchor = mentioned[0]?.coords ?? firstStopCoords(stops);
  const anchorName = mentioned[0]?.name ?? stops.find((s) => s.dest)?.name;
  if (!anchor || !anchorName) {
    return "Razdalje ne morem izračunati — v tej poti ni postankov z znanima koordinatama (NEZNANO). Vpiši dve destinaciji (npr. »@AI kako daleč je Bled od Pirana?«) in izračunam iz baze.";
  }
  const others = stops
    .map((s) => s.dest)
    .filter((d): d is Destination => Boolean(d) && d!.name !== anchorName)
    .slice(0, 2);
  if (others.length === 0) {
    return `Imam samo eno točko s koordinatami (${anchorName}) — za razdaljo vpiši še drugo destinacijo (npr. »@AI kako daleč je ${anchorName} od Ljubljane?«).`;
  }
  const lines = others.map(
    (d) =>
      `· ${anchorName} → ${d.name}: ${Math.round(haversineKm(anchor, d.coords))} km naravnost (cestna ocena ~${Math.round(haversineKm(anchor, d.coords) * 1.3)} km)`
  );
  return `Iz baze destinacij (haversine, po zraku — cestna ocena = ×1,3 po kanonu načrtovalnika):\n${lines.join("\n")}\nVozni časi so OCENA (~60 km/h); za točno navigacijo uporabi Navigiraj (OSM).`;
}

function answerFood(body: string, stops: PlanStopRef[]): string {
  const mentioned = findMentionedDestinations(body);
  const where = mentioned[0]?.name ?? stops[0]?.name ?? "na tvoji poti";
  return `Restavracij in jedilnikov v klepetu nimam — to je iskrena meja tega svetovalca (odgovarjam izključno iz podatkov poti in baze destinacij, 0 zunanjih klicev). Za hrano v okolici ${where} odpri zbirko Lokali (/lokali) — tam so realni lokalni ponudniki z regijo in lokacijo. Splošen nasvet: v Sloveniji kosilo ponudijo gostilne med 11. in 14. uro, sobote nedelje pa so polnejše — rezerviraj prej.`;
}

function answerSuggest(body: string, plan: SharedPlan, stops: PlanStopRef[], withReasons: boolean): string {
  const mentioned = findMentionedDestinations(body);
  const inPlan = new Set(stops.map((s) => s.destSlug ?? stripDiacritics(s.name)));
  // naslednji postanek po omenjeni destinaciji (ali prvi naslednji)
  let nextIdx = -1;
  if (mentioned.length > 0) {
    nextIdx = stops.findIndex((s) => s.dest?.slug === mentioned[0].slug);
  }
  const next = nextIdx >= 0 && nextIdx + 1 < stops.length ? stops[nextIdx + 1] : stops[0];
  const parts: string[] = [];
  if (next) {
    parts.push(`Naslednji postanek na tvoji poti: ${next.name} (dan ${next.day}).`);
  } else {
    parts.push("Tvoja pot še nima postankov — dodaj jih iz strani destinacij ali načrtovalnika.");
  }
  // do 3 predlogi, ki jih še ni na poti: najbližje sidru (če obstaja),
  // sicer najbolje ocenjene (deterministično)
  const anchor = mentioned[0]?.coords ?? firstStopCoords(stops);
  const candidates = DESTINATIONS.filter(
    (d) => !inPlan.has(d.slug) && (!mentioned[0] || d.slug !== mentioned[0].slug)
  )
    .sort((a, b) =>
      anchor
        ? haversineKm(anchor, a.coords) - haversineKm(anchor, b.coords) || b.rating - a.rating
        : b.rating - a.rating
    )
    .slice(0, 3);
  if (candidates.length > 0) {
    // P1-B §5 (issue #3): vsak predlog nosi DOKAZI PODPERTE razloge
    // (razdalja od sidra, cena, ocena, primernost — samo iz kanonskega
    // registra; delovni čas destinacij v registru NE obstaja → iskreno
    // izpuščen, nikoli izmišljen).
    const anchorName =
      mentioned[0]?.name ?? stops.find((s) => s.dest)?.name ?? null;
    parts.push(
      `Iz baze (še niso na poti${anchor ? ", najbližje sidru" : ""}):\n` +
        candidates
          .map((d) => {
            const base = `${d.name} — ocena ${d.rating}/10, ~${d.costPerPerson} €`;
            if (!anchor) return base;
            const reasons = buildCandidateReasons(d, {
              anchor: anchorName
                ? { name: anchorName, lat: anchor.lat, lng: anchor.lng }
                : null,
              budget: null,
              season: null,
              interests: [],
            });
            return `${base} (zakaj: ${formatReasonsInline(reasons)})`;
          })
          .join("\n")
    );
  }
  parts.push("Predloge doda v pot tisti, ki pot ureja — jaz svetujem, vi odločate.");
  return parts.join("\n");
}

function answerDestinationInfo(body: string): string {
  const mentioned = findMentionedDestinations(body);
  if (mentioned.length === 0) return "";
  const d = mentioned[0];
  const seasons = d.bestSeason.map((s) => SEASON_LABELS[s] ?? s).join(", ") || "neznano";
  return `${d.name} — ${d.tagline}. Regija: ${d.region}; tip: ${d.type}; ocena obiskovalcev ${d.rating}/10; priporočen čas ${d.duration}; strošek ~${d.costPerPerson} € na osebo; najlepše v: ${seasons}.\nPoudarki: ${d.highlights.slice(0, 3).join(" · ")}.\n(podatki iz baze 38 destinacij — brez zunanjih klicev)`;
}

function answerBudget(plan: SharedPlan, stops: PlanStopRef[]): string {
  const known = stops.filter((s) => s.dest);
  const sum = known.reduce((n, s) => n + (s.dest?.costPerPerson ?? 0), 0);
  const lines: string[] = [];
  if (typeof plan.totalBudget === "number") {
    lines.push(`Načrtovalnik je za to pot ocenil skupni proračun ≈ ${plan.totalBudget} € na osebo.`);
  }
  if (known.length > 0) {
    lines.push(
      `Postanki z znanimi cenami (baza): ` +
        known.map((s) => `${s.name} ~${s.dest?.costPerPerson} €`).join(", ") +
        ` — skupaj ${sum} €.`
    );
  }
  if (lines.length === 0) {
    return "O cenah te poti nimam podatka — NEZNANO (postanki se ne povezujejo z bazo destinacij). Splošno: vstopnine in lokalna hrana sta v Sloveniji zmerni, glavni strošek je običajno prenočišče.";
  }
  lines.push("Cene so ocene na osebo iz baze destinacij — dejanske stroške preveri pri ponudniku.");
  return lines.join("\n");
}

function answerFallback(plan: SharedPlan, stops: PlanStopRef[]): string {
  const top = [...stops]
    .map((s) => s.dest)
    .filter((d): d is Destination => Boolean(d))
    .sort((a, b) => b.rating - a.rating)[0];
  const n = stops.length;
  const parts: string[] = [];
  parts.push(
    n === 0
      ? "Ta pot še nima postankov, zato imam malo konkretnega."
      : `Na tvoji poti je ${n} ${n === 1 ? "postanek" : n === 2 ? "postanka" : n < 5 ? "postanki" : "postankov"}.`
  );
  if (top) {
    parts.push(`Najbolje ocenjen postanek: ${top.name} (${top.rating}/10) — ${top.tagline}.`);
  }
  parts.push(
    "Odgovarjam deterministično iz baze 38 destinacij in podatkov te poti (0 AI žetonov, 0 zunanjih klicev). Vprašaj me o vremenu (trenutno stanje; ob shranjenih datumih poti tudi dnevna napoved), razdaljah med postanki, predlogih, cenah, hrani (zbirka Lokali) ali kateri destinaciji."
  );
  return parts.join("\n");
}

// ── glavni vstop ───────────────────────────────────────────────────────

/**
 * SYSTEM_DATA_GUARD odgovor (P0-I §23): sporočilo z znanimi vzorci navodil
 * za AI („ignore previous instructions", …) NE sproži vedenja po vzorcih —
 * odgovarjalč odkrito pove, da ukazov ne izvaja in ne odmeva vsebine.
 * Izvoženo za testiranje (determinizem).
 */
export const AI_GUARD_ANSWER =
  "Tvoje sporočilo vsebuje znake poskusa navodil za AI (npr. »ignoriraj prejšnja navodila«). Jih ne izvajam in jih tudi ne ponavljam — sem deterministični svetovalec (0 AI žetonov, 0 zunanjih klicev) in odgovarjam samo na vprašanja o tvoji poti: vreme (trenutno stanje; ob shranjenih datumih poti tudi dnevna napoved), razdalje, predlogi, cene, hrana, destinacije.";

/**
 * Deterministični odgovor @AI na sporočilo (tele brez omembe @AI).
 * Vedno SL (površina /pot je SL-only — kanon izvirnika).
 */
/**
 * P1-B (issue #3): izbirni kontekst agenta. reservations = kanonske
 * vrstice TripReservation te poti (samo-bralni povzetek §7 — agent
 * NIKOLI ne mutira rezervacij). OSEBNI SPOMIN/PROFIL NAMENOMA MANJKA:
 * skupinski klepet vidijo sodelavci — zasebni podatki se NE mešajo
 * (kanon P1-A §11, dve-poti arhitektura).
 */
export interface AdvisorContext {
  reservations?: readonly ReservationRowLike[];
}

/** Klasifikacija namena sporočila @AI (deterministična kaskada). */
export type ChatIntent =
  | "bookings"
  | "weather"
  | "distance"
  | "food"
  | "suggest"
  | "destination"
  | "budget"
  | "fallback";

/**
 * Namena sporočila NE odgovarja — samo GA RAZPOZNA (2.24.0: izvoženo za
 * skriptnega svetovalca, ki po namenu odloči, ali doda enrichment).
 * ISTA kascada kot answerAiQuestion, vrstni red pravil je kanon:
 * rezervacije > vreme > razdalje > hrana > predlogi > destinacija >
 * proračun > fallback. Deterministično, brez stanja.
 */
export function detectChatIntent(body: string): ChatIntent {
  const nb = stripDiacritics(body);
  // P1-B §7: namen rezervacij (samo-bralno, iz kanonskega modela).
  if (hasAny(nb, KW.bookings)) return "bookings";
  if (hasAny(nb, KW.weather)) return "weather";
  if (hasAny(nb, KW.distance)) return "distance";
  if (hasAny(nb, KW.food)) return "food";
  // P1-B §5: „zakaj" vodi v predloge Z razlogi (isti jedrni klic).
  if (hasAny(nb, KW.suggest) || hasAny(nb, KW.why)) return "suggest";
  if (findMentionedDestinations(body).length > 0) return "destination";
  if (hasAny(nb, KW.budget)) return "budget";
  return "fallback";
}

export function answerAiQuestion(body: string, plan: SharedPlan, ctx?: AdvisorContext): string {
  // SYSTEM_DATA_GUARD (P0-I §23): poskus navodil se izvede kot VARNOSTNI
  // odgovor — nikoli kot ukaz in nikoli z odmevom vsebine napadalca.
  const injection = detectPromptInjection(body);
  if (injection.hit) return AI_GUARD_ANSWER;

  const stops = planStops(plan);

  switch (detectChatIntent(body)) {
    case "bookings":
      return formatBookingSummary(summarizeReservations(ctx?.reservations ?? []));
    case "weather":
      return answerWeather(body, stops);
    case "distance":
      return answerDistance(body, stops);
    case "food":
      return answerFood(body, stops);
    case "suggest":
      // P1-B §5: „zakaj" vodi v predloge Z razlogi (isti jedrni klic).
      return answerSuggest(body, plan, stops, hasAny(stripDiacritics(body), KW.why));
    case "destination":
      return answerDestinationInfo(body);
    case "budget":
      return answerBudget(plan, stops);
    default:
      return answerFallback(plan, stops);
  }
}
