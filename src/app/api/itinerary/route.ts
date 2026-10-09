import { NextResponse } from "next/server";

import { type PlannerLang } from "@/lib/itinerary-engine";
import { buildDeterministicItinerary } from "@/lib/deterministic-itinerary";
import { REGIONS } from "@/lib/slovenia-data";
import type { Budget, Season } from "@/lib/slovenia-data";

/**
 * POST /api/itinerary — DETERMINISTIČNI načrtovalnik (jedro izvirnika,
 * rekonstrukcija 45-d): 0 AI žetonov, 0 omrežja, 0 ure — isti vhod vedno
 * da isti izvedek.
 *
 * Vhod: { interests: string[]|string, days: 1–5, region?, season?, budget?, locale? }
 * Izhod: ItineraryPlan (dnevi s postanki, totalCost, coverageNote, dayTitles)
 *        + engine: "deterministic" + fingerprint (P0-D: dokazljiva
 *        reproducibilnost — isti vhod → isti prstni odtis; geo-validacija
 *        teče nad vsakim načrtom, izhod je enoten s /potovanje prikazom).
 */

/** Dvojezična helperka po vzorcu PL() izvirnika (sl privzeta). */
function PL(
  lang: PlannerLang,
  texts: { sl: string; en: string; it: string; de: string; fr: string; es: string }
): string {
  return lang === "en" ? texts.en : texts.sl;
}

const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
const BUDGETS: Budget[] = ["€", "€€", "€€€"];

interface ItineraryInput {
  interests?: unknown;
  days?: unknown;
  region?: unknown;
  season?: unknown;
  budget?: unknown;
  locale?: unknown;
}

export async function POST(request: Request) {
  let input: ItineraryInput;
  try {
    input = JSON.parse(await request.text()) as ItineraryInput;
  } catch {
    return NextResponse.json(
      { error: "Neveljaven JSON v telesu zahteve / Invalid JSON body" },
      { status: 400 }
    );
  }

  const lang: PlannerLang = input.locale === "en" ? "en" : "sl";

  // interests: string[] | string → normalizirana tabela malih besed.
  let interests: string[] = [];
  if (typeof input.interests === "string") {
    interests = input.interests
      .split(/[,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  } else if (Array.isArray(input.interests)) {
    interests = input.interests
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  interests = [...new Set(interests)].slice(0, 12);

  if (interests.length === 0) {
    return NextResponse.json(
      {
        error: PL(lang, {
          sl: "Manjka obvezno polje: interests (vsaj ena želja)",
          en: "Missing required field: interests (at least one wish)",
          it: "Manca il campo obbligatorio: interests (almeno un desiderio)",
          de: "Pflichtfeld fehlt: interests (mindestens ein Wunsch)",
          fr: "Champ obligatoire manquant : interests (au moins un souhait)",
          es: "Falta el campo obligatorio: interests (al menos un deseo)",
        }),
      },
      { status: 400 }
    );
  }

  // days: celo število 1–5.
  const daysNum = typeof input.days === "string" ? Number(input.days) : input.days;
  if (
    typeof daysNum !== "number" ||
    !Number.isInteger(daysNum) ||
    daysNum < 1 ||
    daysNum > 5
  ) {
    return NextResponse.json(
      {
        error: PL(lang, {
          sl: "Število dni je neveljavno (celo število 1–5)",
          en: "Number of days is invalid (integer 1–5)",
          it: "Il numero di giorni non è valido (intero 1–5)",
          de: "Die Anzahl der Tage ist ungültig (ganze Zahl 1–5)",
          fr: "Le nombre de jours est invalide (entier 1–5)",
          es: "El número de días no es válido (entero 1–5)",
        }),
      },
      { status: 400 }
    );
  }

  // region: znan ID regije (ključi REGIONS).
  let region: string | undefined;
  if (input.region != null && input.region !== "" && input.region !== "all") {
    if (typeof input.region !== "string" || !(input.region in REGIONS)) {
      return NextResponse.json(
        {
          error: PL(lang, {
            sl: "Regija je neznana — uporabi ID iz /api/destinations ali pusti prazno",
            en: "Unknown region — use an ID from /api/destinations or leave empty",
            it: "Regione sconosciuta — usa un ID da /api/destinations oppure lascia vuoto",
            de: "Unbekannte Region — verwende eine ID aus /api/destinations oder lasse leer",
            fr: "Région inconnue — utilise un identifiant de /api/destinations ou laisse vide",
            es: "Región desconocida — usa un ID de /api/destinations o deja vacío",
          }),
        },
        { status: 400 }
      );
    }
    region = input.region;
  }

  // season: spring|summer|autumn|winter.
  let season: Season | undefined;
  if (input.season != null && input.season !== "" && input.season !== "any") {
    if (typeof input.season !== "string" || !SEASONS.includes(input.season as Season)) {
      return NextResponse.json(
        {
          error: PL(lang, {
            sl: "Sezona je neveljavna (spring, summer, autumn, winter)",
            en: "Season is invalid (spring, summer, autumn, winter)",
            it: "La stagione non è valida (spring, summer, autumn, winter)",
            de: "Die Saison ist ungültig (spring, summer, autumn, winter)",
            fr: "La saison est invalide (spring, summer, autumn, winter)",
            es: "La temporada no es válida (spring, summer, autumn, winter)",
          }),
        },
        { status: 400 }
      );
    }
    season = input.season as Season;
  }

  // budget: € | €€ | €€€ (največja raven cene na postanek).
  let budget: Budget | undefined;
  if (input.budget != null && input.budget !== "" && input.budget !== "any") {
    if (typeof input.budget === "string" && BUDGETS.includes(input.budget as Budget)) {
      budget = input.budget as Budget;
    } else {
      return NextResponse.json(
        {
          error: PL(lang, {
            sl: "Proračun je neveljaven (€, €€ ali €€€)",
            en: "Budget is invalid (€, €€ or €€€)",
            it: "Il budget non è valido (€, €€ oppure €€€)",
            de: "Das Budget ist ungültig (€, €€ oder €€€)",
            fr: "Le budget est invalide (€, €€ ou €€€)",
            es: "El presupuesto no es válido (€, €€ o €€€)",
          }),
        },
        { status: 400 }
      );
    }
  }

  const result = buildDeterministicItinerary({
    interests,
    days: daysNum,
    region,
    season,
    budget,
    locale: lang,
  });

  return NextResponse.json(
    {
      ...result.plan,
      engine: result.engine,
      fingerprint: result.fingerprint,
    },
    {
      headers: { "cache-control": "no-store" },
    }
  );
}

/** GET ni podprt — načrtovalnik je izključno POST (deterministični vhod). */
export async function GET() {
  return NextResponse.json(
    {
      error: "Uporabi POST z {interests, days, region?, season?, budget?, locale?} / Use POST with {interests, days, region?, season?, budget?, locale?}",
    },
    { status: 405 }
  );
}
