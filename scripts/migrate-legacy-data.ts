// migrate-legacy-data.ts — PRODUKCIJSKA MIGRACIJA PODATKOV (issue #2).
//
// NAMEN: prenos obstoječih produkcijskih podatkov iz LEGACY baze (shema
// 1.163.4 — 39 modelov, Postgres/Neon; glej docs/recovery/schema-1.163.4.prisma
// in docs/RECOVERY-MODEL-MATRIX.md) v NOVO bazo 2.x (27 modelov).
//
// ISKRENOSTNI KANON (issue #2 STRICT RULE — "brez izgube podatkov" pomeni
// tudi: nikoli ne IZMIŠLJUJEMO podatkov):
//  - preslikamo SAMO tisto, kar je mehansko enoumno (matrika KEEP/RECONCILE);
//  - vsak izpust ima RAZLOG in ga skripta IZPIŠE s številom vrstic;
//  - RETIRE modeli se NE preslikajo (arhiv živi v backupu — matrika);
//  - idempotenca: enkrat zagnana skripta ob ponovnem zagonu NE podvoji
//    ničesar (prenos originalnih ID-jev + findUnique pred vsakim zapisom;
//    prekrivanje email/slug/shareId → uporabnik obstoječi zmagá, novi se
//    izpusti s poročilom).
//
// ZAGON (najprej VEDNO dry-run na kopiji!):
//   LEGACY_DATABASE_URL="postgres://…stara…" \
//   DATABASE_URL="postgres://…nova…" \
//     bun run migrate:legacy --dry-run     # samo štetja, brez pisanja
//   …                                    # preglej poročilo + matriko
//   LEGACY_DATABASE_URL=… DATABASE_URL=… \
//     bun run migrate:legacy --apply      # izvedi prenos
//   # ponoven --apply = 0 novih zapisov (idempotenca je TESTIRANA)
//
// OPOMBA O VARNOSTI: skripta NE izpisuje povezovalnih nizov nikjer
// (samo protokol). Gesla se prenašajo kot zapisi (hash) — nikoli se ne
// razširijo ali izpišejo. Zagon priporočamo iz produkcijske skrižnice
// (Render shell / lokalno z tunelom), ne iz CI logov.

import { Database as SqliteDatabase } from "bun:sqlite";
import { Client as PgClient } from "pg";
import {
  PREFERENCE_KEYS,
  validatePreferenceValue,
  type PreferenceKey,
} from "../src/lib/user-preferences";

// ─────────────────────────────────────────────────────────────────────────────
// ČISTE PRESLIKAVE (brez I/O — testirane v tests/legacy-migration.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** Legacy vrstica kot jo vrne RAW SQL (camelCase stolpci po Prisma shemi). */
export type LegacyRow = Record<string, unknown>;

export type SkipReason = { reason: string; count: number };

export type ModelReport = {
  model: string;
  scanned: number;
  toMigrate: number;
  skipped: SkipReason[];
};

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
/** Boolean med providerjima: SQLite vrne 0/1, PostgreSQL true/false. */
function flag(v: unknown): boolean {
  return v === true || v === 1 || v === "1";
}
function dateOrNull(v: unknown): Date | null {
  if (typeof v !== "string" && !(v instanceof Date)) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function isoDate(v: unknown): Date {
  const d = dateOrNull(v);
  return d ?? new Date(0);
}

/** User 1.163.4 → User 2.x (+ preferences JSON → UserPreference IMPORTED). */
export function mapUser(row: LegacyRow): {
  user: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  };
  legacyPreferencesJson: string | null;
} {
  const email = String(row.email ?? "").toLowerCase();
  return {
    user: {
      id: String(row.id ?? ""),
      email,
      // name je v 1.163.4 NULLABLE — e-pošta je uporabnikova lastna
      // identiteta (ni izmišljena vsebina, je njegov podatek).
      name: str(row.name) ?? email,
      passwordHash: String(row.passwordHash ?? ""),
      role: "user",
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
    },
    legacyPreferencesJson: str(row.preferences),
  };
}

/**
 * Legacy preferences JSON → kanonske UserPreference vrstice (matrika §1:
 * "legacy preferences JSON → ločena plast UserPreference, source IMPORTED").
 *
 * ISKRENOSTNI KANON (dokazano na PostgreSQL 17, 2026-10-10):
 *  - prenesijo se SAMO ključi iz kanonske množice PREFERENCE_KEYS, katerih
 *    vrednost kanonsko VALIDIRA (validatePreferenceValue — isti varovalni
 *    sloj kot /api/preferences PUT); NE ugibamo preslikav neznanih vrednosti;
 *  - prazni seznami/besedila se ne prenesejo (ni vsebine = ni zapisa);
 *  - vsak izpust ima razlog s števcem (arhiv živi v backupu — matrika).
 */
export function planUserPreferences(
  prefsJson: string | null,
): {
  entries: { key: PreferenceKey; value: string }[];
  skipped: SkipReason[];
} {
  const entries: { key: PreferenceKey; value: string }[] = [];
  const skipped: SkipReason[] = [];
  const bump = (reason: string) => {
    const found = skipped.find((s) => s.reason === reason);
    if (found) found.count += 1;
    else skipped.push({ reason, count: 1 });
  };
  if (!prefsJson) return { entries, skipped };

  let parsed: unknown;
  try {
    parsed = JSON.parse(prefsJson);
  } catch {
    bump("preferences JSON nerazčrljiv — arhiv: backup");
    return { entries, skipped };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    bump("preferences ni JSON objekt — arhiv: backup");
    return { entries, skipped };
  }
  const src = parsed as Record<string, unknown>;
  for (const [rawKey, rawValue] of Object.entries(src)) {
    if (!(PREFERENCE_KEYS as readonly string[]).includes(rawKey)) {
      bump(`neznan ključ „${rawKey}" (ni v kanonu PREFERENCE_KEYS) — arhiv: backup`);
      continue;
    }
    const key = rawKey as PreferenceKey;
    const validation = validatePreferenceValue(key, rawValue);
    if (!validation.ok) {
      bump(`neveljavna vrednost za „${key}" — arhiv: backup`);
      continue;
    }
    if (validation.canonical === "[]" || validation.canonical === "\"\"") {
      bump(`prazna vrednost „${key}" — nič za prenos`);
      continue;
    }
    if (!entries.some((e) => e.key === key)) {
      entries.push({ key, value: validation.canonical });
    }
  }
  return { entries, skipped };
}

/**
 * SavedItinerary 1.163.4 → TravelJourney 2.x. Vrača null, če prenos ni
 * mogoč (anonimna pot brez lastnika / nerazčrljiv itinerer) + razlog.
 *
 * Oblika `itinerary` JSON: sprejemamo kanonsko obliko SharedPlan
 * (days[].locations[].name) — enako normalizePlanInput (trip-auth.ts),
 * a STROŽJE: prenesemo samo pote z vsaj eno razpoznavno lokacijo
 * (prazna pot ni prenos vredna — poročamo jo kot nerazčrljivo).
 */
export function mapItinerary(row: LegacyRow): {
  journey: {
    id: string;
    shareId: string;
    ownerId: string;
    title: string;
    isPublic: boolean;
    data: string;
    dateStart: string | null;
    dateEnd: string | null;
    renameVersion: number;
    createdAt: Date;
    updatedAt: Date;
  };
} | null {
  const userId = str(row.userId);
  if (!userId) return null; // anonimne poti: 2.x zahteva račun (lastništvo)

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(row.itinerary ?? "null"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const raw = parsed as { days?: unknown; createdAt?: unknown; name?: unknown; totalBudget?: unknown };

  type Loc = { name: string; destSlug?: string; time: string | null };
  const days: { day: number; title?: string; locations: Loc[] }[] = [];
  let totalLocations = 0;
  if (Array.isArray(raw.days)) {
    for (const d of raw.days) {
      if (typeof d !== "object" || d === null) continue;
      const day = d as { day?: unknown; title?: unknown; locations?: unknown };
      const locations: Loc[] = [];
      if (Array.isArray(day.locations)) {
        for (const l of day.locations) {
          if (typeof l !== "object" || l === null) continue;
          const loc = l as { name?: unknown; destSlug?: unknown; time?: unknown };
          if (typeof loc.name !== "string" || loc.name.trim().length === 0) continue;
          locations.push({
            name: loc.name.trim().slice(0, 200),
            ...(typeof loc.destSlug === "string" ? { destSlug: loc.destSlug.slice(0, 80) } : {}),
            time: typeof loc.time === "string" ? loc.time.slice(0, 10) : null,
          });
        }
      }
      totalLocations += locations.length;
      days.push({
        day: typeof day.day === "number" && Number.isInteger(day.day) ? day.day : days.length + 1,
        ...(typeof day.title === "string" ? { title: day.title.slice(0, 160) } : {}),
        locations,
      });
    }
  }
  if (days.length === 0 || totalLocations === 0) return null;

  const createdAtIso =
    typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : isoDate(row.createdAt).toISOString();
  const name = str(row.name);
  return {
    journey: {
      id: String(row.id ?? ""),
      shareId: String(row.shareId ?? ""),
      ownerId: userId,
      // Fiksna iskrena oznaka, kadar stara pot ni imela imena (ni izmišljena
      // vsebina — oznaka izvora).
      title: name && name.trim().length > 0 ? name.trim().slice(0, 120) : "Prenesena pot",
      isPublic: flag(row.isPublic),
      data: JSON.stringify({
        createdAt: createdAtIso,
        ...(name && name.trim().length > 0 ? { name: name.trim().slice(0, 120) } : {}),
        days,
        ...(typeof raw.totalBudget === "number" && raw.totalBudget >= 0
          ? { totalBudget: Math.round(raw.totalBudget) }
          : {}),
      }),
      dateStart: null,
      dateEnd: null,
      renameVersion: 0,
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
    },
  };
}

/** TripCollaborator 1.163.4 → 2.x (samo ACTIVE z uporabnikom). */
export function mapCollaborator(row: LegacyRow): {
  collaborator: {
    id: string;
    journeyId: string;
    userId: string;
    role: string;
    invitedBy: string | null;
    createdAt: Date;
  };
} | null {
  const userId = str(row.userId);
  if (row.status !== "ACTIVE" || !userId) return null;
  const role = row.role === "EDITOR" ? "EDITOR" : "VIEWER"; // COMMENTER → VIEWER (2.x nima komentar-vloge)
  return {
    collaborator: {
      id: String(row.id ?? ""),
      journeyId: "", // dopolni klicni slo (shareId → nov id pote)
      userId,
      role,
      invitedBy: str(row.invitedBy),
      createdAt: isoDate(row.createdAt),
    },
  };
}

/** TripPoll 1.163.4 → 2.x TripPoll + TripPollOption vrstice. */
export function mapPoll(row: LegacyRow): {
  poll: {
    id: string;
    journeyId: string;
    createdBy: string;
    question: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  options: { pollId: string; label: string; sortOrder: number }[];
} | null {
  const question = str(row.question);
  if (!question) return null;
  let parsedOptions: unknown;
  try {
    parsedOptions = JSON.parse(String(row.options ?? "null"));
  } catch {
    parsedOptions = null;
  }
  const labels: string[] = [];
  if (Array.isArray(parsedOptions)) {
    for (const o of parsedOptions) {
      if (typeof o === "string" && o.trim().length > 0 && o.trim().length <= 80) {
        labels.push(o.trim());
      }
    }
  }
  if (labels.length < 2) return null; // anketa brez 2+ veljavnih možnosti ni prenosljiva
  const id = String(row.id ?? "");
  return {
    poll: {
      id,
      journeyId: "", // dopolni klicni slo
      createdBy: "", // dopolni klicni slo (lastnik pote)
      question: question.slice(0, 200),
      status: flag(row.closed) ? "CLOSED" : "OPEN",
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.createdAt),
    },
    options: labels.slice(0, 6).map((label, i) => ({ pollId: id, label, sortOrder: i })),
  };
}

/** TripComment 1.163.4 → TripMessage 2.x (skupinski klepet). */
export function mapComment(row: LegacyRow): {
  message: {
    id: string;
    journeyId: string;
    authorId: string | null;
    authorName: string;
    isAiBot: boolean;
    body: string;
    createdAt: Date;
  };
} | null {
  const text = str(row.text);
  const authorName = str(row.authorName);
  if (!text || !authorName) return null;
  return {
    message: {
      id: String(row.id ?? ""),
      journeyId: "", // dopolni klicni slo
      authorId: null, // stari komentarji so bili anonimni
      authorName: authorName.slice(0, 60),
      isAiBot: flag(row.isAI),
      body: text.slice(0, 2000),
      createdAt: isoDate(row.createdAt),
    },
  };
}

/** Product 1.163.4 → Product 2.x (cena EUR Float → centi Int). */
export function mapProduct(row: LegacyRow): {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    priceCents: number;
    kind: string;
    stock: number;
    saleCount: number;
    active: boolean;
    status: string;
    ownerId: string | null;
    lat: number | null;
    lng: number | null;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
} | null {
  const slug = str(row.slug);
  const name = str(row.name);
  const description = str(row.description);
  const price = num(row.price);
  if (!slug || !name || !description || price === null || price < 0) return null;
  const rawStatus = str(row.status) ?? "draft";
  const status = ["draft", "pending", "published", "rejected"].includes(rawStatus) ? rawStatus : "draft";
  return {
    product: {
      id: String(row.id ?? ""),
      slug,
      name,
      description,
      // EUR (Float) → centi (Int): mehanska preslikava valute.
      priceCents: Math.round(price * 100),
      // 1.163.4 tržnica so bili fizični izdelki (food/wine/craft/…).
      kind: "product",
      stock: num(row.stock) ?? 0,
      saleCount: num(row.saleCount) ?? 0,
      active: true,
      status,
      ownerId: str(row.ownerId),
      lat: null,
      lng: null,
      submittedAt: dateOrNull(row.submittedAt),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
    },
  };
}

const ORDER_STATUS_MAP = new Set(["pending", "paid", "cancelled", "expired"]);

/** Order 1.163.4 → Order 2.x (brez items — ločeno mapOrderItems). */
export function mapOrder(row: LegacyRow): {
  order: {
    id: string;
    userId: string | null;
    visitorKey: string | null;
    status: string;
    demo: boolean;
    paidAt: Date | null;
    stripeSessionId: string | null;
    totalCents: number;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
} | null {
  const status = str(row.status);
  const total = num(row.total);
  if (!status || !ORDER_STATUS_MAP.has(status) || total === null || total < 0) return null;
  return {
    order: {
      id: String(row.id ?? ""),
      userId: null, // stara naročila niso bila vezana na račun (buyerEmail se izgubi — poročilo)
      visitorKey: null,
      status,
      // KONSERVATIVNO: legacy nima demo zastavice; demo=true izključi zapis
      // iz payout osnove — nikoli ne označimo dvoumnega prihodka kot pravega.
      demo: true,
      paidAt: dateOrNull(row.paidAt),
      stripeSessionId: str(row.stripeSessionId),
      totalCents: Math.round(total * 100),
      expiresAt: null,
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
    },
  };
}

/** Order.items JSON 1.163.4 → OrderItem 2.x (best-effort, brez izmišljanja). */
export function mapOrderItems(row: LegacyRow): {
  productId: string;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  qty: number;
}[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(row.items ?? "null"));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: { productId: string; nameSnapshot: string; priceCentsSnapshot: number; qty: number }[] = [];
  for (const it of parsed) {
    if (typeof it !== "object" || it === null) continue;
    const item = it as { productId?: unknown; qty?: unknown; price?: unknown; name?: unknown };
    const productId = str(item.productId);
    const qty = num(item.qty);
    const price = num(item.price);
    if (!productId || qty === null || qty < 1 || price === null || price < 0) continue;
    out.push({
      productId,
      // Ime ob nakupu: iz zapisa, sicer izdelka ne poznamo (ne izmišljujemo).
      nameSnapshot: str(item.name) ?? "(izdelek iz stare naročilnice)",
      priceCentsSnapshot: Math.round(price * 100),
      qty: Math.min(Math.floor(qty), 999),
    });
  }
  return out.slice(0, 50);
}

const AUDIT_ACTOR_MAP: Record<string, string> = {
  admin: "owner",
  owner: "partner",
  system: "system",
  stripe: "system",
};

/** AuditLog 1.163.4 → 2.x (zgodovina se ohrani; polja se preslikajo mehansko). */
export function mapAuditLog(row: LegacyRow): {
  entry: {
    id: string;
    actorType: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    meta: string;
    createdAt: Date;
  };
} | null {
  const action = str(row.action);
  const resourceType = str(row.resourceType);
  const resourceId = str(row.resourceId) ?? str(row.resourceName);
  if (!action || !resourceType || !resourceId) return null;
  const actorRole = str(row.actorRole) ?? "system";
  return {
    entry: {
      id: String(row.id ?? ""),
      actorType: AUDIT_ACTOR_MAP[actorRole] ?? "system",
      actorId: str(row.actorId) ?? str(row.actorEmail),
      action: action.slice(0, 200),
      entityType: resourceType.slice(0, 100),
      entityId: resourceId.slice(0, 200),
      meta: str(row.metadata) ?? "{}",
      createdAt: isoDate(row.createdAt),
    },
  };
}

const LEAD_STATUS_MAP: Record<string, string> = {
  nov: "new",
  kontaktiran: "contacted",
};

/** Lead 1.163.4 → 2.x ("zakljucen" se ne prenese — zaključen lead ne potrebuje akcije). */
export function mapLead(row: LegacyRow): {
  lead: {
    id: string;
    email: string;
    interest: string | null;
    note: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
} | null {
  const email = str(row.email);
  if (!email) return null;
  const legacyStatus = str(row.status) ?? "";
  const status = LEAD_STATUS_MAP[legacyStatus];
  if (!status) return null; // "zakljucen" in neznan status → arhiv (backup)
  const businessName = str(row.businessName);
  const message = str(row.message);
  const noteParts = [businessName, message].filter((p): p is string => Boolean(p && p.trim()));
  return {
    lead: {
      id: String(row.id ?? ""),
      email: email.toLowerCase(),
      interest: str(row.businessType),
      // Podjetje + sporočilo sta DEJSTVI iz vrstice (formiranje, ne izmišljanje).
      note: noteParts.length > 0 ? noteParts.join(" — ").slice(0, 2000) : null,
      status,
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
    },
  };
}

/** NewsletterSubscriber 1.163.4 → 2.x (source se izgubi — poročilo). */
export function mapNewsletter(row: LegacyRow): {
  subscriber: { id: string; email: string; createdAt: Date };
} | null {
  const email = str(row.email);
  if (!email) return null;
  return {
    subscriber: { id: String(row.id ?? ""), email: email.toLowerCase(), createdAt: isoDate(row.createdAt) },
  };
}

/** Consultation 1.163.4 → 2.x (recommendedPartners se izgubi — poročilo). */
export function mapConsultation(row: LegacyRow): {
  consultation: {
    id: string;
    accessToken: string;
    email: string;
    question: string;
    destinationName: string | null;
    travelDates: string | null;
    partyDescription: string | null;
    budget: string | null;
    interests: string | null;
    answer: string | null;
    answerSource: string;
    status: string;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
} | null {
  const accessToken = str(row.accessToken);
  const email = str(row.email);
  const question = str(row.question);
  if (!accessToken || !email || !question) return null;
  const answer = str(row.answer);
  const legacySource = str(row.answerSource);
  const status = str(row.status) === "delivered" ? "delivered" : "pending";
  return {
    consultation: {
      id: String(row.id ?? ""),
      accessToken,
      email: email.toLowerCase(),
      question: question.slice(0, 4000),
      destinationName: str(row.destinationName),
      travelDates: str(row.travelDates),
      partyDescription: str(row.partyDescription),
      budget: str(row.budget),
      interests: str(row.interests),
      answer,
      answerSource: answer !== null ? (legacySource === "ai" ? "manual" : legacySource ?? "fallback") : "fallback",
      status,
      deliveredAt: dateOrNull(row.deliveredAt),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.createdAt),
    },
  };
}

/** ProcessedStripeEvent 1.163.4 → 2.x (eventId = legacy id evt_…). */
export function mapStripeEvent(row: LegacyRow): {
  event: { eventId: string; type: string; processedAt: Date };
} | null {
  const id = str(row.id);
  const eventType = str(row.eventType);
  if (!id || !eventType) return null;
  return { event: { eventId: id, type: eventType, processedAt: isoDate(row.createdAt) } };
}

/** Listing 1.163.4 → 2.x (minimalni pin register; region ostane null — iskreno). */
export function mapListing(row: LegacyRow): {
  listing: {
    id: string;
    name: string;
    category: string;
    region: string | null;
    lat: number | null;
    lng: number | null;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
} | null {
  const name = str(row.name);
  const category = str(row.category);
  if (!name || !category) return null;
  return {
    listing: {
      id: String(row.id ?? ""),
      name,
      category,
      region: null, // 1.163.4 nima regije (destinationName ≠ regija — ne preslikamo)
      lat: num(row.lat),
      lng: num(row.lng),
      address: str(row.address),
      createdAt: isoDate(row.createdAt),
      updatedAt: isoDate(row.updatedAt),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY BRANJE (RAW SQL — SQLite za teste, PostgreSQL za produkcijo)
// ─────────────────────────────────────────────────────────────────────────────

export interface LegacyReader {
  readonly provider: "sqlite" | "postgresql";
  rows(table: string): Promise<LegacyRow[]>;
  close(): Promise<void>;
}

export function openLegacyReader(url: string): LegacyReader {
  if (url.startsWith("file:")) {
    const db = new SqliteDatabase(url.slice("file:".length), { readonly: true });
    return {
      provider: "sqlite",
      async rows(table) {
        return db.query(`SELECT * FROM "${table}"`).all() as LegacyRow[];
      },
      async close() {
        db.close();
      },
    };
  }
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const client = new PgClient({ connectionString: url });
    // Lazy connect — rows() pokliče ensure().
    let connected = false;
    const ensure = async () => {
      if (!connected) {
        await client.connect();
        connected = true;
      }
    };
    return {
      provider: "postgresql",
      async rows(table) {
        await ensure();
        const res = await client.query(`SELECT * FROM "${table}"`);
        return res.rows as LegacyRow[];
      },
      async close() {
        if (connected) await client.end();
      },
    };
  }
  throw new Error("LEGACY_DATABASE_URL neprepoznan protokol (file: / postgres://).");
}

/** Modeli, ki se ZAVESTNO NE preslikajo (matrika RETIRE — arhiv: backup). */
export const RETIRED_LEGACY_MODELS = [
  "Owner",
  "UserTripItem",
  "SavedItineraryRevision",
  "TripGuide",
  "TripVote",
  "TripLike",
  "TripDiaryEntry",
  "ListingEvent",
  "Experience",
  "Review",
  "Booking",
  "ExperienceAvailability",
  "ExperienceAvailabilityDay",
  "JourneyBooking",
  "TripExpense",
  "TripDocument",
  "Sponsorship",
  "PageView",
  "AnalyticsEvent",
  "AIUsageLog",
  "LocalQuestion",
  "PushSubscription",
  "CommissionInvoice",
  "PayoutEntry",
  "PayoutSettlement",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// IZVEDBA (idempotentna; --dry-run privzeto)
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = Bun.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;

  const legacyUrl = process.env.LEGACY_DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;
  if (!legacyUrl || !targetUrl) {
    console.error("Napaka: potrebna sta LEGACY_DATABASE_URL (stara 1.163.4) in DATABASE_URL (nova 2.x).");
    return 2;
  }

  // Nova baza: Prisma klient prek obstoječega lib (DATABASE_URL).
  const { db } = await import("../src/lib/db");
  const reader = openLegacyReader(legacyUrl);
  console.error(
    `── MIGRACIJA PODATKOV 1.163.4 → 2.x (${reader.provider} → cilj) — način: ${dryRun ? "DRY-RUN (brez pisanja)" : "APPLY"} ──`,
  );

  const modelReports: ModelReport[] = [];
  const report = (model: string, scanned: number, toMigrate: number, skipped: SkipReason[]) => {
    modelReports.push({ model, scanned, toMigrate, skipped });
  };
  const bump = (skipped: SkipReason[], reason: string) => {
    const found = skipped.find((s) => s.reason === reason);
    if (found) found.count += 1;
    else skipped.push({ reason, count: 1 });
  };

  // Uporabniki (+ preferences JSON → UserPreference IMPORTED — matrika §1)
  const prefSkipped: SkipReason[] = [];
  let prefScanned = 0;
  let prefToMigrate = 0;
  /** preferences JSON → UserPreference (source IMPORTED) — SAMO kanonsko
   *  validirane vrednosti (planUserPreferences); idempotenca po (userId, key).
   *  Kliče se ŠELE ZA (obstoječim ali novim) uporabnikom — FK vrstni red. */
  const transferLegacyPreferences = async (
    userId: string,
    prefsJson: string | null,
  ): Promise<void> => {
    if (!prefsJson) return;
    prefScanned += 1;
    const plan = planUserPreferences(prefsJson);
    for (const s of plan.skipped) {
      for (let i = 0; i < s.count; i++) bump(prefSkipped, s.reason);
    }
    for (const entry of plan.entries) {
      const prefExists = await db.userPreference.findUnique({
        where: { userId_key: { userId, key: entry.key } },
      });
      if (prefExists) {
        bump(prefSkipped, "obstoječa preferenca (userId+key) — izpuščena");
        continue;
      }
      if (!dryRun) {
        await db.userPreference.create({
          data: { userId, key: entry.key, value: entry.value, source: "IMPORTED" },
        });
      }
      prefToMigrate += 1;
    }
  };
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("User");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapUser(row);
      const exists =
        (await db.user.findUnique({ where: { id: mapped.user.id } })) ??
        (await db.user.findUnique({ where: { email: mapped.user.email } }));
      if (exists) {
        bump(skipped, "obstoječi uporabnik (id/email) — novi zapis izpuščen");
        // preferenze se pripnejo na OBSTOJEČEGA uporabnika (email zadetek z
        // drugim id) — idempotenca po (userId, key) pokriva ponovne zagone:
        await transferLegacyPreferences(exists.id, mapped.legacyPreferencesJson);
        continue;
      }
      if (!dryRun) await db.user.create({ data: mapped.user });
      toMigrate += 1;
      // preferenze ŠELE ZA uporabnikom (FK vrstni red — dokazano 2026-10-10):
      await transferLegacyPreferences(mapped.user.id, mapped.legacyPreferencesJson);
    }
    report("User", rows.length, toMigrate, skipped);
    report("User→UserPreference(IMPORTED)", prefScanned, prefToMigrate, prefSkipped);
  }

  // Poti (SavedItinerary → TravelJourney) + slo shareId → id
  const shareIdMap = new Map<string, string>();
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("SavedItinerary");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapItinerary(row);
      if (!mapped) {
        bump(skipped, "anonimna pot (brez lastnika) ali nerazčrljiv itinerer — arhiv: backup");
        continue;
      }
      const exists =
        (await db.travelJourney.findUnique({ where: { id: mapped.journey.id } })) ??
        (await db.travelJourney.findUnique({ where: { shareId: mapped.journey.shareId } }));
      if (exists) {
        shareIdMap.set(mapped.journey.shareId, exists.id);
        bump(skipped, "obstoječa pot (id/shareId) — novi zapis izpuščen");
        continue;
      }
      const owner = await db.user.findUnique({ where: { id: mapped.journey.ownerId } });
      if (!owner) {
        bump(skipped, "lastnik ni bil prenesen (izpusten Uporabnik) — pot čaka v arhivu");
        continue;
      }
      if (!dryRun) await db.travelJourney.create({ data: mapped.journey });
      shareIdMap.set(mapped.journey.shareId, mapped.journey.id);
      toMigrate += 1;
    }
    report("SavedItinerary→TravelJourney", rows.length, toMigrate, skipped);
  }

  // Sodelujoči
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("TripCollaborator");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapCollaborator(row);
      if (!mapped) {
        bump(skipped, "status ≠ ACTIVE ali brez uporabnika (PENDING/REVOKED) — vabila izda lastnik znova");
        continue;
      }
      const journeyId = shareIdMap.get(String(row.shareId ?? ""));
      if (!journeyId) {
        bump(skipped, "pot ni bila prenesena — sodelovanje ostaja v arhivu");
        continue;
      }
      const user = await db.user.findUnique({ where: { id: mapped.collaborator.userId } });
      if (!user) {
        bump(skipped, "uporabnik ni bil prenesen — sodelovanje ostaja v arhivu");
        continue;
      }
      const exists = await db.tripCollaborator.findUnique({ where: { id: mapped.collaborator.id } });
      if (exists) {
        bump(skipped, "obstoječ zapis — izpuščen");
        continue;
      }
      const dup = await db.tripCollaborator.findUnique({
        where: { journeyId_userId: { journeyId, userId: mapped.collaborator.userId } },
      });
      if (dup) {
        bump(skipped, "sodelovanje že obstoja (journeyId+userId) — izpuščen");
        continue;
      }
      if (!dryRun) {
        await db.tripCollaborator.create({
          data: { ...mapped.collaborator, journeyId },
        });
      }
      toMigrate += 1;
    }
    report("TripCollaborator", rows.length, toMigrate, skipped);
  }

  // Ankete (+ možnosti; glasovi anonimnih obiskovalcev se NE morejo prenesti)
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("TripPoll");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapPoll(row);
      if (!mapped) {
        bump(skipped, "nerazčrljive možnosti (<2 veljavne) ali brez vprašanja");
        continue;
      }
      const journeyId = shareIdMap.get(String(row.shareId ?? ""));
      if (!journeyId) {
        bump(skipped, "pot ni bila prenesena — anketa ostaja v arhivu");
        continue;
      }
      const journey = await db.travelJourney.findUnique({ where: { id: journeyId } });
      if (!journey) {
        bump(skipped, "ciljna pot ne obstoja");
        continue;
      }
      const exists = await db.tripPoll.findUnique({ where: { id: mapped.poll.id } });
      if (exists) {
        bump(skipped, "obstoječa anketa — izpuščena");
        continue;
      }
      if (!dryRun) {
        await db.tripPoll.create({
          data: { ...mapped.poll, journeyId, createdBy: journey.ownerId },
        });
        for (const opt of mapped.options) {
          const dupOpt = await db.tripPollOption.findFirst({
            where: { pollId: opt.pollId, sortOrder: opt.sortOrder },
          });
          if (!dupOpt) {
            await db.tripPollOption.create({
              data: { pollId: opt.pollId, label: opt.label, sortOrder: opt.sortOrder },
            });
          }
        }
      }
      toMigrate += 1;
    }
    const votes = await reader.rows("TripPollVote");
    report(
      "TripPoll(+Options)",
      rows.length,
      toMigrate,
      [...skipped, { reason: "TripPollVote: glasovi so vezani na anonimni voterId — 2.x zahteva račun (glasovi se NE PRENESEJO, anketa pa da)", count: votes.length }],
    );
  }

  // Komentarji → sporočila klepeta
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("TripComment");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapComment(row);
      if (!mapped) {
        bump(skipped, "brez besedila ali avtorja");
        continue;
      }
      const journeyId = shareIdMap.get(String(row.shareId ?? ""));
      if (!journeyId) {
        bump(skipped, "pot ni bila prenesena — komentar ostaja v arhivu");
        continue;
      }
      const exists = await db.tripMessage.findUnique({ where: { id: mapped.message.id } });
      if (exists) {
        bump(skipped, "obstoječe sporočilo — izpuščeno");
        continue;
      }
      if (!dryRun) {
        await db.tripMessage.create({ data: { ...mapped.message, journeyId } });
      }
      toMigrate += 1;
    }
    report("TripComment→TripMessage", rows.length, toMigrate, skipped);
  }

  // Izdelki tržnice
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("Product");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapProduct(row);
      if (!mapped) {
        bump(skipped, "manjka slug/ime/opis/cena — zapis ni prenosljiv");
        continue;
      }
      const exists =
        (await db.product.findUnique({ where: { id: mapped.product.id } })) ??
        (await db.product.findUnique({ where: { slug: mapped.product.slug } }));
      if (exists) {
        bump(skipped, "obstoječi izdelek (id/slug) — izpuščen");
        continue;
      }
      if (!dryRun) await db.product.create({ data: mapped.product });
      toMigrate += 1;
    }
    report("Product", rows.length, toMigrate, skipped);
  }

  // Naročila (+ vrstice, best-effort)
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("Order");
    let toMigrate = 0;
    let itemsDropped = 0;
    for (const row of rows) {
      const mapped = mapOrder(row);
      if (!mapped) {
        bump(skipped, "neznan status ali neveljavna skupna cena — naročilo ostaja v arhivu (backup)");
        continue;
      }
      const exists = await db.order.findUnique({ where: { id: mapped.order.id } });
      if (exists) {
        bump(skipped, "obstoječe naročilo — izpuščeno");
        continue;
      }
      const items = mapOrderItems(row);
      const itemsOk: typeof items = [];
      for (const item of items) {
        const product = await db.product.findUnique({ where: { id: item.productId } });
        if (product) itemsOk.push(item);
        else itemsDropped += 1;
      }
      if (!dryRun) {
        await db.order.create({ data: mapped.order });
        for (const item of itemsOk) {
          const dupItem = await db.orderItem.findFirst({
            where: { orderId: mapped.order.id, productId: item.productId },
          });
          if (!dupItem) {
            await db.orderItem.create({
              data: {
                orderId: mapped.order.id,
                productId: item.productId,
                nameSnapshot: item.nameSnapshot,
                priceCentsSnapshot: item.priceCentsSnapshot,
                qty: item.qty,
              },
            });
          }
        }
      }
      toMigrate += 1;
    }
    if (itemsDropped > 0) {
      skipped.push({ reason: "OrderItem: izdelek ni bil prenesen — vrstica izpuščena", count: itemsDropped });
    }
    skipped.push({
      reason: "buyerEmail/buyerName/naslov se NE prenašajo (2.x nima stolpcev; gost = visitorKey kanon) — arhiv: backup",
      count: rows.length,
    });
    report("Order(+Items)", rows.length, toMigrate, skipped);
  }

  // Ostali modeli (Listing, Lead, Newsletter, Consultation, StripeEvent, AuditLog)
  {
    // Listing
    const skippedL: SkipReason[] = [];
    const listings = await reader.rows("Listing");
    let toMigrateL = 0;
    for (const row of listings) {
      const mapped = mapListing(row);
      if (!mapped) {
        bump(skippedL, "brez imena/kategorije");
        continue;
      }
      const exists = await db.listing.findUnique({ where: { id: mapped.listing.id } });
      if (exists) {
        bump(skippedL, "obstoječi zapis — izpuščen");
        continue;
      }
      if (!dryRun) await db.listing.create({ data: mapped.listing });
      toMigrateL += 1;
    }
    report("Listing", listings.length, toMigrateL, skippedL);
  }
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("Lead");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapLead(row);
      if (!mapped) {
        bump(skipped, 'status "zakljucen" ali neznan/brez e-pošte — zaključeni leadi ostanejo v arhivu');
        continue;
      }
      const exists = await db.lead.findUnique({ where: { id: mapped.lead.id } });
      if (exists) {
        bump(skipped, "obstoječi lead — izpuščen");
        continue;
      }
      if (!dryRun) await db.lead.create({ data: mapped.lead });
      toMigrate += 1;
    }
    report("Lead", rows.length, toMigrate, skipped);
  }
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("NewsletterSubscriber");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapNewsletter(row);
      if (!mapped) {
        bump(skipped, "brez e-pošte");
        continue;
      }
      const exists =
        (await db.newsletterSubscriber.findUnique({ where: { id: mapped.subscriber.id } })) ??
        (await db.newsletterSubscriber.findUnique({ where: { email: mapped.subscriber.email } }));
      if (exists) {
        bump(skipped, "obstoječa prijava (id/email) — izpuščena");
        continue;
      }
      if (!dryRun) await db.newsletterSubscriber.create({ data: mapped.subscriber });
      toMigrate += 1;
    }
    report("NewsletterSubscriber", rows.length, toMigrate, skipped);
  }
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("Consultation");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapConsultation(row);
      if (!mapped) {
        bump(skipped, "brez žetona/e-pošte/vprašanja");
        continue;
      }
      const exists =
        (await db.consultation.findUnique({ where: { id: mapped.consultation.id } })) ??
        (await db.consultation.findUnique({ where: { accessToken: mapped.consultation.accessToken } }));
      if (exists) {
        bump(skipped, "obstoječa konzultacija — izpuščena");
        continue;
      }
      if (!dryRun) await db.consultation.create({ data: mapped.consultation });
      toMigrate += 1;
    }
    skipped.push({
      reason: "recommendedPartners se NE prenaša (2.x nima stolpca — odgovori 2.x so deterministični iz registra)",
      count: rows.length,
    });
    report("Consultation", rows.length, toMigrate, skipped);
  }
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("ProcessedStripeEvent");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapStripeEvent(row);
      if (!mapped) {
        bump(skipped, "brez ID/tpia dogodka");
        continue;
      }
      const exists = await db.processedStripeEvent.findUnique({ where: { eventId: mapped.event.eventId } });
      if (exists) {
        bump(skipped, "obstoječi dogodek (dedup) — izpuščen");
        continue;
      }
      if (!dryRun) await db.processedStripeEvent.create({ data: mapped.event });
      toMigrate += 1;
    }
    report("ProcessedStripeEvent", rows.length, toMigrate, skipped);
  }
  {
    const skipped: SkipReason[] = [];
    const rows = await reader.rows("AuditLog");
    let toMigrate = 0;
    for (const row of rows) {
      const mapped = mapAuditLog(row);
      if (!mapped) {
        bump(skipped, "brez akcije/vrste/id entitete — vrstica ostaja v arhivu");
        continue;
      }
      const exists = await db.auditLog.findUnique({ where: { id: mapped.entry.id } });
      if (exists) {
        bump(skipped, "obstoječa vrstica — izpuščena");
        continue;
      }
      if (!dryRun) await db.auditLog.create({ data: mapped.entry });
      toMigrate += 1;
    }
    report("AuditLog", rows.length, toMigrate, skipped);
  }

  // RETIRE modeli — samo štetja (arhiv v backupu, klasifikacija v matriki)
  console.error("\n── RETIRE (se NE preslikajo — matrika + backup) ──");
  for (const model of RETIRED_LEGACY_MODELS) {
    try {
      const rows = await reader.rows(model);
      if (rows.length > 0) {
        console.error(`  · ${model}: ${rows.length} vrstic (arhiv: backup)`);
      }
    } catch {
      // Tabela ne obstoja (stara baza brez tega modela) — nič.
    }
  }

  // Skupni izpis
  console.error("\n── PREGLED PO MODELIH ──");
  for (const r of modelReports) {
    console.error(
      `  ${r.model}: pregledanih ${r.scanned} · ${dryRun ? "za prenos" : "prenesenih"} ${r.toMigrate}` +
        (r.skipped.length > 0 ? ` · izpusti: ${r.skipped.map((s) => `${s.reason} ×${s.count}`).join("; ")}` : ""),
    );
  }
  const total = modelReports.reduce((acc, r) => acc + r.toMigrate, 0);
  console.error(
    `\n${dryRun ? "DRY-RUN" : "APPLY"} zaključen — skupno ${dryRun ? "za prenos" : "prenesenih"}: ${total} zapisov.`,
  );
  console.error(dryRun ? "Preglej izpuste nad matriko (docs/RECOVERY-MODEL-MATRIX.md) in poženi --apply." : "Ponoven --apply mora poročati 0 novih zapisov (idempotenca).");
  await reader.close();
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main();
}
