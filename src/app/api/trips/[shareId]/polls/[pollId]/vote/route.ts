import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForWrite } from "@/lib/trip-auth";
import { rateLimited, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/trips/[shareId]/polls/[pollId]/vote — glas v anketi.
 *
 * Glasuje lahko vsak sodelujoči (VIEWER+, lastnik/urednik seveda tudi).
 * Glas je ZADNJI veljaven (prestavitev): v transakciji pobrišemo prejšnje
 * glasove tega uporabnika v tej anketi in zapišemo novega. Zaprta anketa
 * → 403 (iskrenost: rezultati vidni, glasovanje zaprto).
 */

interface RouteParams {
  params: Promise<{ shareId: string; pollId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  // P0 AUDIT M8: meja 30/min na glasovanje (transakcijsko brisanje+vpis).
  if (rateLimited(request, 30)) {
    return tooManyRequests();
  }
  const { shareId, pollId } = await params;
  const guard = await getTripForWrite(shareId, "VIEWER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId } = guard.ctx;

  let body: { optionIdx?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  if (
    typeof body.optionIdx !== "number" ||
    !Number.isInteger(body.optionIdx) ||
    body.optionIdx < 0 ||
    body.optionIdx > 5
  ) {
    return NextResponse.json({ error: "Podaj optionIdx (indeks možnosti)." }, { status: 400 });
  }

  const poll = await db.tripPoll.findFirst({
    where: { id: pollId, journeyId: journey.id },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  if (!poll) {
    return NextResponse.json({ error: "Anketa ne obstaja." }, { status: 404 });
  }
  if (poll.status === "CLOSED") {
    return NextResponse.json(
      { error: "Anketa je zaključena — glasovanje je zaprto." },
      { status: 403 }
    );
  }
  const option = poll.options[body.optionIdx];
  if (!option) {
    return NextResponse.json({ error: "Možnost ne obstaja." }, { status: 400 });
  }

  // Zadnji glas velja: pobriši prejšnje glasove tega uporabnika v anketi,
  // nato zapiši novega (atomska transakcija).
  const optionIds = poll.options.map((o) => o.id);
  await db.$transaction([
    db.tripPollVote.deleteMany({
      where: { userId: userId ?? "", optionId: { in: optionIds } },
    }),
    db.tripPollVote.create({
      data: {
        optionId: option.id,
        userId: userId ?? "",
        journeyId: journey.id,
      },
    }),
  ]);

  const options = await db.tripPollOption.findMany({
    where: { pollId: poll.id },
    orderBy: { sortOrder: "asc" },
    include: { votes: true },
  });
  const counts = options.map((o) => o.votes.length);
  const total = counts.reduce((n, c) => n + c, 0);

  return NextResponse.json({
    success: true,
    counts,
    total,
    myVote: body.optionIdx,
  });
}
