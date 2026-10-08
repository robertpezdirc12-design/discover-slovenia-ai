/**
 * USER-PREFERENCES — P1-A (issue #3 §1/§2): ČISTA, deterministična plast
 * osebnega profila potovanja in dolgoročnega spomina.
 * ============================================================================
 * 0-AI kanon: NIČ LLM klicev, 0 žetonov, 0 omrežja — samo preslikave in
 * validacije nad fiksno množico vrednosti (isti vhod → isti izhod).
 *
 * Vsebina:
 *  - PREFERENCE_KEYS: fiksni nabor ključev profila (personalization/budget/
 *    interests/pace/season/party/transport/food/avoid);
 *  - validatePreferenceValue: strežniška validacija proti kanoničnemu
 *    besednjaku (budget/season POVCUJETA tipa iz slovenia-data — brez
 *    vzporednih modelov; interests uporabljajo besede, ki jih razume
 *    obstoječi deterministični itinerary engine);
 *  - personalizacijska zapora (off): isPersonalizationOff — fail-closed
 *    (pokvarjen zapis šteje kot IZKLOPLJENO);
 *  - MEMORY_*: fiksni nabor vrst/izvorov spomina, confidence iz pravil,
 *    bounded retrieval, mehko brisanje + načrt zadrževanja (retention);
 *  - kanonska revizijska dejanja (AuditLog).
 *
 * Slovensko je resnica; komentarji so dvojezično strjeni.
 */

import {
  detectPromptInjection,
  sanitizeUntrustedText,
} from "@/lib/system-data-guard";

// ─── §1 PREFERENCE — fiksni nabor ključev ───────────────────────────────────

export const PREFERENCE_KEYS = [
  "personalization",
  "budget",
  "interests",
  "pace",
  "season",
  "party",
  "transport",
  "food",
  "avoid",
] as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

/** Preveri, da je niz veljaven ključ preferenco. */
export function preferenceKeyIsValid(key: unknown): key is PreferenceKey {
  return (
    typeof key === "string" &&
    (PREFERENCE_KEYS as readonly string[]).includes(key)
  );
}

/**
 * Kanonske vrednosti enojnih ključev (shranjene kot JSON niz).
 * budget/season so POVCUJČI kanon iz slovenia-data.ts (Budget/Season) —
 * season ima dodano "any" (brez preference) izključno na nivoju profila.
 */
export const PREFERENCE_SINGLE_VALUES: Record<
  Exclude<PreferenceKey, "interests" | "food" | "avoid">,
  readonly string[]
> = {
  personalization: ["on", "off"],
  budget: ["€", "€€", "€€€"],
  season: ["any", "spring", "summer", "autumn", "winter"],
  pace: ["relaxed", "balanced", "intense"],
  party: ["solo", "couple", "family", "friends", "group"],
  transport: ["car", "bus", "bike", "hiking", "mixed"],
};

/** Ključi seznamske oblike (JSON tabela besed). */
export const PREFERENCE_LIST_KEYS: readonly PreferenceKey[] = [
  "interests",
  "avoid",
];

/** Ključi prostega besedila (sanitizirano, omejeno). */
export const PREFERENCE_TEXT_KEYS: readonly PreferenceKey[] = ["food"];

/** Največ besed v seznamu (isti prag kot itinerary engine: 12). */
export const PREFERENCE_LIST_MAX = 12;

/** Največja dolžina posamezne besede seznama. */
export const PREFERENCE_WORD_MAX = 40;

/** Največja dolžina prostega besedila (food). */
export const PREFERENCE_TEXT_MAX = 200;

export interface PreferenceValidationOk {
  ok: true;
  /** Kanonska JSON serializacija za shranjevanje. */
  canonical: string;
}
export interface PreferenceValidationError {
  ok: false;
  error: string;
  /** Iskren seznam dovoljenih vrednosti (za prikaz uporabniku). */
  allowed?: readonly string[];
}
export type PreferenceValidation = PreferenceValidationOk | PreferenceValidationError;

/**
 * Validiraj vrednost preference Glede na ključ (STREŽNIŠKO — klient nikoli
 * ne odloča). Vrne kanonski JSON za shranjevanje ali iskreno napako.
 */
export function validatePreferenceValue(
  key: PreferenceKey,
  raw: unknown
): PreferenceValidation {
  if (key === "interests" || key === "avoid") {
    // Seznam: string[] ali posamezen niz (vejice dovoljene → razcep).
    let words: string[] = [];
    if (typeof raw === "string") {
      words = raw.split(",");
    } else if (Array.isArray(raw)) {
      words = raw.map((w) => (typeof w === "string" ? w : ""));
    } else {
      return {
        ok: false,
        error: "Pričakujem seznam besed (ali niz z vejicami).",
      };
    }
    const cleaned: string[] = [];
    for (const w of words) {
      const c = sanitizeUntrustedText(w, {
        maxLen: PREFERENCE_WORD_MAX,
        fallback: "",
      });
      if (c.length > 0 && !cleaned.includes(c)) {
        cleaned.push(c);
      }
      if (cleaned.length >= PREFERENCE_LIST_MAX) break;
    }
    return { ok: true, canonical: JSON.stringify(cleaned) };
  }

  if (key === "food") {
    const text =
      typeof raw === "string"
        ? sanitizeUntrustedText(raw, {
            maxLen: PREFERENCE_TEXT_MAX,
            collapseWhitespace: false,
            fallback: "",
          })
        : "";
    if (typeof raw !== "string") {
      return { ok: false, error: "Pričakujem besedilo." };
    }
    return { ok: true, canonical: JSON.stringify(text) };
  }

  const allowed = PREFERENCE_SINGLE_VALUES[key];
  if (typeof raw !== "string" || !allowed.includes(raw)) {
    return {
      ok: false,
      error: `Neveljavna vrednost za „${key}".`,
      allowed,
    };
  }
  return { ok: true, canonical: JSON.stringify(raw) };
}

/** Obrambna razčlenitev shranjene vrednosti (pokvarjen zapis → undefined). */
export function parsePreferenceValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

// ─── Personalizacijska zapora (fail-closed) ────────────────────────────────

export interface PreferenceRowLike {
  key: string;
  value: string;
}

/**
 * Ali je personalizacija IZKLOPLJENA (ključ "personalization" = "off")?
 *  - manjkajoč zapis → ON (privzeto; spomin je prazen, dokler uporabnik
 *    ničesar ne doda — nič se ne zbere samo od sebe);
 *  - zapis "on" → ON;
 *  - VSE OSTALO (vključno s pokvarjenim/neveljavnim zapisom) → OFF
 *    (fail-closed: pri neznanih stanjih sistem spomina ne uporablja —
 *    zasebnost ima prednost).
 */
export function isPersonalizationOff(rows: readonly PreferenceRowLike[]): boolean {
  const row = rows.find((r) => r.key === "personalization");
  if (!row) return false;
  const parsed = parsePreferenceValue(row.value);
  return parsed !== "on";
}

export interface PersonalProfile {
  /** Ali sme agent/planer uporabljati osebne podatke. */
  enabled: boolean;
  budget: "€" | "€€" | "€€€" | null;
  season: "spring" | "summer" | "autumn" | "winter" | null;
  pace: "relaxed" | "balanced" | "intense" | null;
  party: "solo" | "couple" | "family" | "friends" | "group" | null;
  transport: "car" | "bus" | "bike" | "hiking" | "mixed" | null;
  interests: string[];
  avoid: string[];
  food: string | null;
}

const EMPTY_PROFILE: PersonalProfile = {
  enabled: false,
  budget: null,
  season: null,
  pace: null,
  party: null,
  transport: null,
  interests: [],
  avoid: [],
  food: null,
};

/**
 * Zgradi čisti osebni profil iz vrstic preferenc (za agenta v P1-B).
 * Personalizacija IZKLOPLJENA → PRAZEN profil z enabled:false (spomin
 * se sploh ne bere — fail-closed v strežniškem bralniku).
 * Neznani/pokvarjeni zapisi se ISKRENO izpustijo (nikoli izmišljeni).
 */
export function buildPersonalProfile(
  rows: readonly PreferenceRowLike[]
): PersonalProfile {
  if (isPersonalizationOff(rows)) {
    return { ...EMPTY_PROFILE, enabled: false };
  }
  const profile: PersonalProfile = { ...EMPTY_PROFILE, enabled: true };
  for (const row of rows) {
    const value = parsePreferenceValue(row.value);
    switch (row.key) {
      case "budget":
        if (value === "€" || value === "€€" || value === "€€€") {
          profile.budget = value;
        }
        break;
      case "season":
        if (
          value === "spring" ||
          value === "summer" ||
          value === "autumn" ||
          value === "winter"
        ) {
          profile.season = value;
        }
        break;
      case "pace":
        if (value === "relaxed" || value === "balanced" || value === "intense") {
          profile.pace = value;
        }
        break;
      case "party":
        if (
          value === "solo" ||
          value === "couple" ||
          value === "family" ||
          value === "friends" ||
          value === "group"
        ) {
          profile.party = value;
        }
        break;
      case "transport":
        if (
          value === "car" ||
          value === "bus" ||
          value === "bike" ||
          value === "hiking" ||
          value === "mixed"
        ) {
          profile.transport = value;
        }
        break;
      case "interests":
        if (Array.isArray(value)) {
          profile.interests = value.filter(
            (w): w is string => typeof w === "string" && w.length > 0
          );
        }
        break;
      case "avoid":
        if (Array.isArray(value)) {
          profile.avoid = value.filter(
            (w): w is string => typeof w === "string" && w.length > 0
          );
        }
        break;
      case "food":
        if (typeof value === "string" && value.length > 0) {
          profile.food = value;
        }
        break;
      default:
        break;
    }
  }
  return profile;
}

// ─── §2 MEMORY — fiksni nabor vrst/izvorov ─────────────────────────────────

export const MEMORY_KINDS = [
  "fact",
  "preference",
  "constraint",
  "visit",
  "feedback",
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_SOURCES = [
  "USER",
  "AGENT_DERIVED",
  "TRIP_HISTORY",
  "IMPORTED",
] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];

/** Največja dolžina vrednosti spomina (znaki). */
export const MEMORY_VALUE_MAX = 500;

/** Omejen, determinističen izsek spomina (zgornja meja branja). */
export const MEMORY_LIST_LIMIT = 100;

/**
 * Zadrževalna doba mehko izbrisanih zapisov (active=false): po toliko
 * dneh se fizično pobrišejo (lenko brisanje ob branju — planMemoryPurge).
 */
export const MEMORY_RETENTION_DAYS = 90;

/** Confidence po izvoru — iz PRAVIL, nikoli izmišljen (determinizem). */
export const MEMORY_SOURCE_CONFIDENCE: Record<MemorySource, number> = {
  USER: 1,
  TRIP_HISTORY: 0.8,
  IMPORTED: 0.7,
  AGENT_DERIVED: 0.6,
};

export function memoryConfidenceForSource(source: MemorySource): number {
  return MEMORY_SOURCE_CONFIDENCE[source];
}

export function memoryKindIsValid(kind: unknown): kind is MemoryKind {
  return (
    typeof kind === "string" &&
    (MEMORY_KINDS as readonly string[]).includes(kind)
  );
}

export interface MemoryInputOk {
  ok: true;
  kind: MemoryKind;
  value: string;
}
export interface MemoryInputError {
  ok: false;
  error: string;
  /** Ali je bil zavrnjen zaradi vzorcev ukazov za AI (iskano odkrito). */
  injection: boolean;
}
export type MemoryInput = MemoryInputOk | MemoryInputError;

/**
 * Validiraj novi/urejeni zapis spomina (STREŽNIŠKO):
 *  - kind mora biti iz fiksne množice;
 *  - value se sanitizira (SYSTEM_DATA_GUARD, max MEMORY_VALUE_MAX);
 *  - poskus navodil za AI (injection) se ISKRENO ZAVRNE — shranjevanje
 *    odklonjeno, vsebina se NE odmeva.
 */
export function validateMemoryInput(raw: {
  kind?: unknown;
  value?: unknown;
}): MemoryInput {
  if (!memoryKindIsValid(raw.kind)) {
    return {
      ok: false,
      error: "Neveljavna vrsta zapisa.",
      injection: false,
    };
  }
  if (typeof raw.value !== "string") {
    return {
      ok: false,
      error: "Pričakujem besedilo zapisa.",
      injection: false,
    };
  }
  const injection = detectPromptInjection(raw.value);
  if (injection.hit) {
    return {
      ok: false,
      error:
        "Sporočilo vsebuje vzorce navodil za AI — takega zapisa ne shranjujemo.",
      injection: true,
    };
  }
  const value = sanitizeUntrustedText(raw.value, {
    maxLen: MEMORY_VALUE_MAX,
    collapseWhitespace: false,
    fallback: "",
  });
  if (value.length === 0) {
    return {
      ok: false,
      error: "Zapis je prazen po čiščenju.",
      injection: false,
    };
  }
  return { ok: true, kind: raw.kind, value };
}

// ─── Deterministično branje + retention ────────────────────────────────────

export interface MemoryRowLike {
  id: string;
  updatedAt: Date | string;
}

/**
 * Sortiraj zapise za prikaz: updatedAt DESC, nato id DESC (stabilen
 * vrstni red za enake čase — determinizem).
 */
export function sortMemoriesForList<T extends MemoryRowLike>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    if (tb !== ta) return tb - ta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/**
 * Načrt zadrževalnega čiščenja: izračunaj mejo (cutoff) za fizični
 * izbris mehko izbrisanih zapisov. Čisto (isti čas → ista meja).
 */
export function planMemoryPurge(
  now: Date,
  retentionDays: number = MEMORY_RETENTION_DAYS
): { cutoff: Date } {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  return { cutoff };
}

// ─── Kanonska revizijska dejanja (AuditLog) ────────────────────────────────

export const PERSONAL_AUDIT_ACTIONS = {
  preferenceUpdated: "preference.updated",
  preferenceDeleted: "preference.deleted",
  memoryCreated: "memory.created",
  memoryUpdated: "memory.updated",
  memoryDeleted: "memory.deleted",
  memoryForgetAll: "memory.forget_all",
  memoryPurged: "memory.purged",
} as const;
