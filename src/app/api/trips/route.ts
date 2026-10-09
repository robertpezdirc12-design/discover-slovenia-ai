import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSessionUserId, normalizePlanInput } from "@/lib/trip-auth";
import { getDestination } from "@/lib/slovenia-data";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

/**
 * /api/trips — poti prijavljenega uporabnika v oblaku (48-a).
 *
 *  GET  → seznam svojih poti (iskanje po shareId v hubu /moja-potovanja)
 *  POST → shrani lokalno pot v oblak: { plan, title?, shareId? } → { shareId }
 *         (sinhronizacija iz localStorage „deljene pote"/načrta)
 *
 * Iskrenost: 401 brez prijave; deljeni shareId zavrnemo z 409 (nikoli
 * ne prepišemo tuje pote).
 */

const SHARE_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

function randomShareId(): string {
  // P0 AUDIT H1: crypto-naključni vir (Math.random je napovedljiv PRNG —
  // javni shareId mora biti neugibljiv). Enaka abeceda/dolžina kot prej.
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 10; i++) {
    const b = bytes[i];
    out +=
      b >= 256 - (256 % alphabet.length)
        ? alphabet[randomBytes(1)[0] % alphabet.length]
        : alphabet[b % alphabet.length];
  }
  return out;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Za seznanjanje poti v oblaku se prijavi." },
      { status: 401 }
    );
  }
  const journeys = await db.travelJourney.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { collaborators: true } } },
  });
  const trips = journeys.map((j) => {
    let dayCount = 0;
    let stopCount = 0;
    // P1-D (issue #3 §9): prvi RAZPOZNAVEN postanek (destSlug → register) —
    // deterministična podlaga za ploščico „vreme naslednje pote" na domov.
    // Brez razpoznavnega postanka → null (iskrena odsotnost, nikoli ugib).
    let firstStop: { name: string; lat: number; lng: number } | null = null;
    try {
      const plan = JSON.parse(j.data) as { days?: unknown[] };
      if (Array.isArray(plan.days)) {
        dayCount = plan.days.length;
        for (const d of plan.days) {
          if (typeof d !== "object" || d === null) continue;
          const locations = (d as { locations?: unknown[] }).locations;
          stopCount += Array.isArray(locations) ? locations.length : 0;
          if (!firstStop && Array.isArray(locations)) {
            for (const loc of locations) {
              if (typeof loc !== "object" || loc === null) continue;
              const slug = (loc as { destSlug?: unknown }).destSlug;
              if (typeof slug !== "string") continue;
              const dest = getDestination(slug);
              if (dest?.coords) {
                firstStop = {
                  name: dest.name,
                  lat: dest.coords.lat,
                  lng: dest.coords.lng,
                };
                break;
              }
            }
          }
        }
      }
    } catch {
      // Pokvarjen zapis → 0/0/null (iskrenost: števca niso znana).
    }
    return {
      shareId: j.shareId,
      title: j.title,
      isPublic: j.isPublic,
      // P1-D §9: realni datumi poti (lokalni YYYY-MM-DD, null = nedoločeno).
      dateStart: j.dateStart,
      dateEnd: j.dateEnd,
      firstStop,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
      dayCount,
      stopCount,
      collaboratorCount: j._count.collaborators,
    };
  });
  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  // P0 AUDIT M8: meja 10/min — prijavljene pote je bilo mogoče ustvarjati neomejeno.
  if (rateLimited(request, 10)) {
    return tooManyRequests();
  }
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Za shranjevanje poti v oblak se prijavi." },
      { status: 401 }
    );
  }

  let body: {
    plan?: unknown;
    title?: unknown;
    shareId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const normalized = normalizePlanInput(body.plan);
  if (!normalized) {
    return NextResponse.json(
      { error: "Pot nima veljavnih dni s postanki — nič ni shranjeno." },
      { status: 400 }
    );
  }

  const explicitTitle =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 120)
      : null;
  const title = explicitTitle ?? normalized.title ?? "AI načrt potovanja";

  // Izbrani shareId (npr. obstoječa lokalna pote, da URL ostane enak) —
  // tuja pot → iskren 409; svoja obstoječa pot → posodobitev (sinhronizacija).
  let shareId = randomShareId();
  if (typeof body.shareId === "string" && body.shareId.length > 0) {
    if (!SHARE_ID_RE.test(body.shareId)) {
      return NextResponse.json(
        { error: "Neveljaven shareId (dovoljeni mali znaki a-z0-9, do 32)." },
        { status: 400 }
      );
    }
    const clash = await db.travelJourney.findUnique({
      where: { shareId: body.shareId },
      select: { ownerId: true },
    });
    if (clash && clash.ownerId !== userId) {
      return NextResponse.json(
        { error: "Ta shareId že pripada drugi poti v oblaku — pot lahko shranimo pod novim." },
        { status: 409 }
      );
    }
    if (clash && clash.ownerId === userId) {
      await db.travelJourney.update({
        where: { shareId: body.shareId },
        data: { title, data: normalized.data },
      });
      return NextResponse.json({ success: true, shareId: body.shareId, updated: true });
    }
    shareId = body.shareId;
  }

  const journey = await db.travelJourney.create({
    data: {
      shareId,
      ownerId: userId,
      title,
      isPublic: false,
      data: normalized.data,
    },
    select: { shareId: true },
  });

  return NextResponse.json({ success: true, shareId: journey.shareId }, { status: 201 });
}
