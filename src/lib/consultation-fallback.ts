/**
 * CONSULTATION-FALLBACK — "VPRAŠAJ LOKALCA" (P0-H, issue #1 §20/§29).
 *
 * Brezplačna globja konzultacija po vzoru izvirnika (docs/recovery/
 * schema-1.163.4.prisma:1033–1080): javni obrazec → ZASEBNA povezava
 * /konzultacija/{accessToken} → odgovor.
 *
 * ISKRENOSTNI KANON (issue §29): odgovor je DETERMINISTIČEN — sestavljen
 * IZKLJUČNO iz uradnega registra destinacij in vodenih povezav partnerjev,
 * brez AI ključa, brez naključnosti (isti vhod → isti izhod). Skrbnik
 * lahko odgovor kasneje ročno dopolni (answerSource "manual" — razkrit).
 * Dnevna omejitev 3 vprašanja na e-pošto (UTC dan) varuje stroške.
 */

import { randomBytes } from "node:crypto";

import { DESTINATIONS, getDestination } from "@/lib/slovenia-data";
import { getProvider, type AffiliateProviderId } from "@/lib/affiliate-providers";
import {
  CONSULTATION_BUDGETS,
  CONSULTATION_BUDGET_LABELS,
  type ConsultationBudget,
  CONSULTATION_INTERESTS,
  CONSULTATION_INTEREST_LABELS,
  type ConsultationInterest,
} from "@/lib/consultation-options";

// Oznake možnosti so javno dostopne (obrazec) — izvoz za udobje uvoznikov.
export {
  CONSULTATION_BUDGETS,
  CONSULTATION_BUDGET_LABELS,
  CONSULTATION_INTERESTS,
  CONSULTATION_INTEREST_LABELS,
};
export type { ConsultationBudget, ConsultationInterest };

/** Kateri partner (vodena povezava) pokriva kateri interes. */
const INTEREST_PARTNERS: Readonly<
  Record<ConsultationInterest, readonly AffiliateProviderId[]>
> = Object.freeze({
  narava: ["getyourguide"],
  gore: ["getyourguide"],
  kultura: ["tiqets", "viator"],
  hrana: ["getyourguide", "viator"],
  aktivnosti: ["getyourguide", "viator"],
  druzina: ["getyourguide", "tiqets"],
  wellness: ["booking"],
  "nocno-zivljenje": ["booking"],
});

// ── Validacija vnosa ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ConsultationInput {
  email?: unknown;
  question?: unknown;
  destinationName?: unknown;
  travelDates?: unknown;
  partyDescription?: unknown;
  budget?: unknown;
  interests?: unknown;
}

export interface ConsultationNormalized {
  email: string;
  question: string;
  destinationName: string | null;
  travelDates: string | null;
  partyDescription: string | null;
  budget: ConsultationBudget | null;
  interests: ConsultationInterest[];
}

export type ConsultationValidation =
  | { ok: true; value: ConsultationNormalized }
  | { ok: false; error: string };

/**
 * Validacija obrazca: e-pošta, vprašanje 20–2000 znakov, prosti dodatki
 * (destinacija/datumi/druščina) omejeni, proračun iz fiksne množice,
 * interesi podmnožica (največ 5).
 */
export function validateConsultationInput(input: ConsultationInput): ConsultationValidation {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 160) {
    return { ok: false, error: "Vpiši veljaven e-poštni naslov." };
  }
  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (question.length < 20 || question.length > 2000) {
    return { ok: false, error: "Vprašanje mora imeti med 20 in 2000 znakov." };
  }
  const optText = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length === 0 ? null : t.slice(0, max);
  };
  const destinationName = optText(input.destinationName, 80);
  const travelDates = optText(input.travelDates, 60);
  const partyDescription = optText(input.partyDescription, 120);

  let budget: ConsultationBudget | null = null;
  if (typeof input.budget === "string" && input.budget !== "") {
    if (!(CONSULTATION_BUDGETS as readonly string[]).includes(input.budget)) {
      return { ok: false, error: "Neznan proračun." };
    }
    budget = input.budget as ConsultationBudget;
  }

  const interests: ConsultationInterest[] = [];
  if (input.interests !== undefined && input.interests !== null) {
    if (!Array.isArray(input.interests)) {
      return { ok: false, error: "Interesi morajo biti seznam." };
    }
    for (const raw of input.interests) {
      if (typeof raw !== "string" || !(CONSULTATION_INTERESTS as readonly string[]).includes(raw)) {
        return { ok: false, error: "Neznan interes." };
      }
      const value = raw as ConsultationInterest;
      if (!interests.includes(value)) interests.push(value);
    }
    if (interests.length > 5) {
      return { ok: false, error: "Izberi največ 5 interesov." };
    }
  }

  return {
    ok: true,
    value: { email, question, destinationName, travelDates, partyDescription, budget, interests },
  };
}

// ── Ujemanje destinacije (deterministično) ─────────────────────────────────

/** Normalizacija za primerjavo (brez presledkov, mala črka). */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Poišče destinacijo iz registra po imenu ali slug-u (prvi zadetek po
 * vrstnem redu registra — deterministično). Podprta je tudi vsebovanost
 * (»blede« → Bled) nad 3 znaki.
 */
export function matchDestination(name: string): ReturnType<typeof getDestination> {
  const q = norm(name);
  if (q.length < 2) return undefined;
  const bySlug = getDestination(q);
  if (bySlug) return bySlug;
  for (const d of DESTINATIONS) {
    if (norm(d.name) === q) return d;
  }
  if (q.length >= 3) {
    for (const d of DESTINATIONS) {
      if (norm(d.name).includes(q) || q.includes(norm(d.name))) return d;
    }
  }
  return undefined;
}

// ── Deterministični odgovor ────────────────────────────────────────────────

/** Vodena povezava partnerja (dest je kanonski slug, če je znan). */
function guidedLink(providerId: AffiliateProviderId, destSlug: string): string {
  const p = getProvider(providerId);
  const label = p ? p.name : providerId;
  const params = new URLSearchParams({ provider: providerId });
  if (destSlug) params.set("dest", destSlug);
  return `- ${label}: /api/affiliate/go?${params.toString()}`;
}

/**
 * Sestavi DETERMINISTIČNI odgovor (answerSource "fallback"): samo podatki
 * iz registra destinacij + vodene povezave partnerjev + iskrenostna opomba.
 * Isti vhod → isti izhod (0 naključnosti, 0 omrežja, 0 AI).
 */
export function buildConsultationFallbackAnswer(input: ConsultationNormalized): string {
  const lines: string[] = [];
  const dest = input.destinationName ? matchDestination(input.destinationName) : undefined;

  lines.push("Hvala za tvoje vprašanje! Tukaj je tvoj osebni potovalni vodnik.");

  if (dest) {
    lines.push("");
    lines.push(`DESTINACIJA: ${dest.name} — ${dest.tagline}`);
    lines.push(`Regija: ${dest.region} · Država: ${dest.country}`);
    if (dest.highlights.length > 0) {
      lines.push(`Ne zamudi: ${dest.highlights.slice(0, 4).join(" · ")}`);
    }
    if (dest.activities.length > 0) {
      lines.push(`Aktivnosti: ${dest.activities.slice(0, 4).join(" · ")}`);
    }
    lines.push(
      `Okvirni strošek na osebo (vir: uradni register): ${dest.costPerPerson} €.`
    );
    lines.push(`Več o destinaciji: /destinacija/${dest.slug}`);
  } else if (input.destinationName) {
    lines.push("");
    lines.push(
      `Za destinacijo „${input.destinationName}" še nimamo podatkov v uradnem registru — povej več v nadaljevanju vprašanja, kje natančno načrtuješ potovanje (Slovenija, Hrvaška, Črna gora, Albanija).`
    );
  } else {
    lines.push("");
    lines.push(
      "Nisi navedel destinacije — za začetek priporočam Bled (Alpe), Ljubljano (mesto) ali Obalo (Hrvaška)."
    );
  }

  if (input.interests.length > 0) {
    lines.push("");
    lines.push("ZA TVOJE INTERESE (vodene povezave partnerjev):");
    for (const interest of input.interests) {
      const providers = INTEREST_PARTNERS[interest];
      const label = CONSULTATION_INTEREST_LABELS[interest].sl;
      lines.push(`${label}:`);
      for (const providerId of providers) {
        lines.push(guidedLink(providerId, dest?.slug ?? ""));
      }
    }
  }

  if (input.budget && input.budget !== "neodlocen") {
    lines.push("");
    lines.push(
      `PRORAČUN: ${CONSULTATION_BUDGET_LABELS[input.budget].sl} — to je okvir za načrtovanje, ne ponudba. Dejanske cene vidiš pri partnerjih zgoraj.`
    );
  }

  if (input.travelDates) {
    lines.push("");
    lines.push(
      `DATUMI (${input.travelDates}): razpoložljivost preveri pri partnerjih ob rezervaciji; vremensko okno za tvoje dneve vidiš na strani svoje poti (zastavica dnevne napovedi).`
    );
  }

  if (input.partyDescription) {
    lines.push("");
    lines.push(
      `DRUŠČINA (${input.partyDescription}): pri rezervaciji pri partnerjih preveri kapaciteto in pogoje za otroke/skupine — najboljša resnica je na strani ponudnika.`
    );
  }

  lines.push("");
  lines.push(
    "— — —\nTo je samodejni deterministični vodnik (brez AI), sestavljen iz uradnega registra destinacij in vodenih povezav partnerjev. Osebni odgovor lokalca lahko sledi ročno — to stran Shrani med zaznamke in jo občasno osveži."
  );

  return lines.join("\n");
}

// ── Žeton + dnevna omejitev ────────────────────────────────────────────────

/** Zasebni žeton povezave (32 hex znakov — lastnik povezave = poznalec). */
export function generateConsultationToken(): string {
  return randomBytes(16).toString("hex");
}

/** Začetek tekočega UTC dneva (dnevna omejitev je pošteno razkrita). */
export function utcDayStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Dnevna omejitev vprašanj na e-pošto (kanon izvirnika). */
export const CONSULTATION_DAILY_LIMIT = 3;
