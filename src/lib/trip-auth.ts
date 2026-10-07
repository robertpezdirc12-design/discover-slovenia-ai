import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SharedPlan } from "@/lib/shared-plan";

/**
 * TRIP-AUTH — STREŽNIŠKI izračun vloge na poti (fail-closed kanon 48-a).
 *
 * Vloga se NIKOLI ne zaupa klientu:
 *   OWNER   → journey.ownerId === session.user.id
 *   EDITOR  → vrstica v TripCollaborator z role "EDITOR"
 *   VIEWER  → vrstica v TripCollaborator z role "VIEWER"
 *   NONE    → vse ostalo (vključno anonimnim obiskovalcem javne pote)
 *
 * Dostop do zasebne pote: samo OWNER/EDITOR/VIEWER (ostalim 404 —
 * obstoj zasebne pote se ne razkrije, kanon izvirnika).
 */

export type TripRole = "OWNER" | "EDITOR" | "VIEWER" | "NONE";

const ROLE_RANK: Record<TripRole, number> = {
  NONE: 0,
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function roleAtLeast(role: TripRole, min: TripRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Seja iz NextAuth (JWT) — userId ali null za anonimnega obiskovalca. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export interface TripContext {
  journey: {
    id: string;
    shareId: string;
    ownerId: string;
    ownerName: string;
    title: string;
    isPublic: boolean;
    data: string;
    renameVersion: number;
    createdAt: Date;
    updatedAt: Date;
  };
  role: TripRole;
  userId: string | null;
}

/**
 * Poišči pot po shareId in izračunaj vlogo prijavljenega uporabnika.
 * Vrne null, če pot ne obstaja. NE odloča o javnosti — klicar lepo
 * odgovori 404, če pot ni javna in uporabnik nima vloge.
 */
export async function getTripContext(
  shareId: string
): Promise<TripContext | null> {
  const journey = await db.travelJourney.findUnique({
    where: { shareId },
    include: { owner: { select: { id: true, name: true } } },
  });
  if (!journey) return null;

  const userId = await getSessionUserId();

  let role: TripRole = "NONE";
  if (userId) {
    if (journey.ownerId === userId) {
      role = "OWNER";
    } else {
      const collab = await db.tripCollaborator.findUnique({
        where: { journeyId_userId: { journeyId: journey.id, userId } },
      });
      if (collab?.role === "EDITOR") role = "EDITOR";
      else if (collab?.role === "VIEWER") role = "VIEWER";
    }
  }

  return {
    journey: {
      id: journey.id,
      shareId: journey.shareId,
      ownerId: journey.ownerId,
      ownerName: journey.owner.name,
      title: journey.title,
      isPublic: journey.isPublic,
      data: journey.data,
      renameVersion: journey.renameVersion,
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
    },
    role,
    userId,
  };
}

/**
 * Pogoj za branje: javna pot (vsakdo, vloga NONE ostane NONE) ali
 * sodelujoč/lastnik. Vrne kontekst ali null → klicar odgovori 404.
 */
export async function getTripForRead(shareId: string): Promise<TripContext | null> {
  const ctx = await getTripContext(shareId);
  if (!ctx) return null;
  if (!ctx.journey.isPublic && ctx.role === "NONE") return null;
  return ctx;
}

/**
 * Pogoj za mutacijo z najmanjšo vlogo (fail-closed): preveri tudi
 * dostop za branje (zasebna pot + NONE → 404, ne 403).
 */
export async function getTripForWrite(
  shareId: string,
  min: TripRole
): Promise<
  | { ok: true; ctx: TripContext }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const ctx = await getTripContext(shareId);
  if (!ctx) return { ok: false, status: 404, error: "Ta pot ne obstaja." };
  if (!ctx.journey.isPublic && ctx.role === "NONE") {
    return { ok: false, status: 404, error: "Ta pot ne obstaja." };
  }
  if (ctx.role === "NONE") {
    return {
      ok: false,
      status: 401,
      error: "Za to dejanje se prijavi (pot je javna, urejanje pa zahteva vlogo).",
    };
  }
  if (!roleAtLeast(ctx.role, min)) {
    return {
      ok: false,
      status: 403,
      error: "Za to dejanje nimaš dovoljenja (potrebna vloga: " + min + ").",
    };
  }
  return { ok: true, ctx };
}

/**
 * Razčleni shrambljeni JSON pote v obliko SharedPlan (obstoječa oblika
 * iz src/lib/shared-plan.ts). Pokvarjen zapis → minimalna iskrena pot
 * (prazni dnevi, nikoli izmišljeni podatki).
 */
export function parseJourneyPlan(data: string): SharedPlan & { totalBudget?: number } {
  try {
    const parsed = JSON.parse(data) as SharedPlan;
    if (parsed && Array.isArray(parsed.days)) {
      return {
        shareId: typeof parsed.shareId === "string" ? parsed.shareId : "",
        name: typeof parsed.name === "string" ? parsed.name : null,
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
        days: parsed.days,
        totalBudget: typeof parsed.totalBudget === "number" ? parsed.totalBudget : undefined,
      };
    }
  } catch {
    // Pokvarjen zapis → spodaj iskrena prazna pot.
  }
  return { shareId: "", name: null, createdAt: "", days: [] };
}

/**
 * Normaliziraj VHODNO strukturo pote (POST /api/trips): sprejme obliko
 * SharedPlan (localStorage „deljene pote") in vrne kanonski JSON za stolpec
 * data. Vrača null, če vhod ni veljavna pot (vsaj 1 dan z lokacijami).
 */
export function normalizePlanInput(input: unknown): {
  data: string;
  title: string | null;
  createdAt: string;
} | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as {
    name?: unknown;
    createdAt?: unknown;
    days?: unknown;
    totalBudget?: unknown;
  };
  if (!Array.isArray(raw.days) || raw.days.length === 0) return null;

  const days: SharedPlan["days"] = [];
  for (const d of raw.days) {
    if (typeof d !== "object" || d === null) continue;
    const day = d as { day?: unknown; title?: unknown; locations?: unknown };
    const locations: SharedPlan["days"][number]["locations"] = [];
    if (Array.isArray(day.locations)) {
      for (const l of day.locations) {
        if (typeof l !== "object" || l === null) continue;
        const loc = l as { name?: unknown; destSlug?: unknown; time?: unknown };
        if (typeof loc.name !== "string" || loc.name.trim().length === 0) continue;
        locations.push({
          name: loc.name.trim().slice(0, 200),
          ...(typeof loc.destSlug === "string" ? { destSlug: loc.destSlug.slice(0, 80) } : {}),
          ...(typeof loc.time === "string" ? { time: loc.time.slice(0, 10) } : { time: null }),
        });
      }
    }
    days.push({
      day: typeof day.day === "number" && Number.isInteger(day.day) ? day.day : days.length + 1,
      ...(typeof day.title === "string" ? { title: day.title.slice(0, 160) } : {}),
      locations,
    });
  }
  if (days.length === 0) return null;

  const createdAt =
    typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : new Date().toISOString();
  const title =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim().slice(0, 120)
      : null;

  return {
    title,
    createdAt,
    data: JSON.stringify({
      createdAt,
      ...(title ? { name: title } : {}),
      days,
      ...(typeof raw.totalBudget === "number" && raw.totalBudget >= 0
        ? { totalBudget: Math.round(raw.totalBudget) }
        : {}),
    }),
  };
}

/** Ustvari vabilo (žeton) za pot — skupna logika collaborators/invites POST. */
export async function issueTripInvite(
  journeyId: string,
  role: "EDITOR" | "VIEWER"
): Promise<string> {
  let token = "";
  for (let i = 0; i < 5; i++) {
    const t = Array.from({ length: 24 }, () =>
      "abcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 36))
    ).join("");
    const clash = await db.tripInvite.findUnique({ where: { token: t } });
    if (!clash) {
      token = t;
      break;
    }
  }
  if (!token) throw new Error("Žetona vabila ni bilo mogoče izstaviti.");
  await db.tripInvite.create({
    data: { journeyId, token, role, status: "PENDING" },
  });
  return token;
}
