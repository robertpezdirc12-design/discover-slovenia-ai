import type { Destination, DestinationType } from "@/lib/slovenia-data";
import { DESTINATIONS } from "@/lib/slovenia-data";
import type { PlannerIntent } from "@/lib/advisor/nlu";
import type { DestinationMention } from "./match";

/**
 * START ANYWHERE — IZPELJAVA PREDLOGA (2.25.0, P2).
 * ============================================================================
 * Iz prepoznanih krajev (registarske destinacije) in NLU namena (če ga
 * skripta razume) izpelje izhodišče za determinističnega načrtovalnika:
 *  · interesi: tip vsake destinacije → bazni žeton (jezero/gora/mesto/…)
 *    — izpeljano IZKLJUČNO iz registra (kanon), nato NLU interesi dodani;
 *    meja 8 (ista meja kot NLU — ne moremo zasipati motorja);
 *  · regija: modus regij zadetih destinacij (št. padcev desc, nato
 *    abc po ključu — deterministično tudi ob izenačenju); brez zadetkov
 *    → NLU regija (če je);
 *  · dnevi/sezona/proračun: prepisani iz NLU namena (če jih besedilo
 *    pove) — uporabnikova izbira ostane, če ne.
 *
 * 0 AI, 0 ugibanj: izpeljava je čista funkcija nad kanonskimi podatki.
 */

/** Tip destinacije → bazni interest-žeton (združljiv z načrtovalnikom). */
export const TYPE_INTERESTS: Record<DestinationType, string> = {
  castle: "grad",
  cave: "jame",
  city: "mesto",
  coast: "morje",
  gorge: "soteska",
  lake: "jezero",
  mountain: "gora",
  river: "reka",
  spa: "zdravje",
};

const MAX_INTERESTS = 8;

export interface Suggestion {
  /** Bazni interest-žetoni (≤ 8, urejeni: registarski red tipov, nato NLU). */
  interests: string[];
  /** Ključ regije iz REGIONS ali undefined (izbira uporabnika ostane). */
  region?: string;
}

/**
 * Deterministična izpeljava predloga.
 * Red zadetkov = vrstni red registra (findDestinationMentions zagotavlja).
 */
export function deriveSuggestion(
  mentions: DestinationMention[],
  intent: PlannerIntent | null
): Suggestion {
  const interests: string[] = [];
  const push = (token: string) => {
    const t = token.trim().toLowerCase();
    if (t.length > 0 && !interests.includes(t) && interests.length < MAX_INTERESTS) {
      interests.push(t);
    }
  };

  // 1) tipi prepoznanih destinacij (registarski red).
  for (const m of mentions) {
    push(TYPE_INTERESTS[m.dest.type] ?? "mesto");
  }
  // 2) NLU interesi (iz istega besedila, če jih skripta razume).
  if (intent?.interests) {
    for (const i of intent.interests) push(i);
  }

  // regija: modus po zadetkih (štetje desc, nato abc) — sicer NLU regija.
  let region: string | undefined;
  if (mentions.length > 0) {
    const counts = new Map<string, number>();
    for (const m of mentions) {
      counts.set(m.dest.region, (counts.get(m.dest.region) ?? 0) + 1);
    }
    region = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "sl"))[0][0];
  } else if (intent?.region) {
    region = intent.region;
  }

  return { interests, region };
}

/** Pomoč za UI: registrske destinacije po slugu (prikaz rezultatov). */
export function destinationsBySlug(): Map<string, Destination> {
  return new Map(DESTINATIONS.map((d) => [d.slug, d]));
}
