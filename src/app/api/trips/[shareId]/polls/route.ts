import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getTripForRead, getTripForWrite } from "@/lib/trip-auth";

/**
 * /api/trips/[shareId]/polls — skupinske ankete na poti (rekonstrukcija
 * F11 „MindTrip vrzel #2"). Vsi števci/vloga strežniški.
 *
 *  GET    → seznam z možnostmi, števci, myVote (iz seje) in isAuthor
 *  POST   → ustvari anketo { question, options[2..6] } — EDITOR+
 *  PATCH  → { pollId, closed } zaključi/odpre — avtor ankete ali OWNER
 *  DELETE → { pollId } izbriše — avtor ankete ali OWNER
 *
 * Meje izvirnika: vprašanje ≤ 200, možnost ≤ 80, 2–6 možnosti.
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

const QUESTION_MAX = 200;
const OPTION_MAX = 80;
const OPTIONS_MIN = 2;
const OPTIONS_MAX = 6;

interface PollRow {
  id: string;
  question: string;
  options: string[];
  authorName: string | null;
  closed: boolean;
  createdAt: string;
  counts: number[];
  total: number;
  myVote: number | null;
  isAuthor: boolean;
}

async function loadPolls(
  journeyId: string,
  userId: string | null
): Promise<PollRow[]> {
  const polls = await db.tripPoll.findMany({
    where: { journeyId },
    orderBy: { createdAt: "desc" },
    include: {
      options: { orderBy: { sortOrder: "asc" }, include: { votes: true } },
    },
  });

  // Imena avtorjev izpeljemo ločeno (TripPoll ima samo createdBy — brez relacije).
  const authorIds = [...new Set(polls.map((p) => p.createdBy).filter(Boolean))];
  const authors = authorIds.length
    ? await db.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true },
      })
    : [];
  const authorNameById = new Map(authors.map((u) => [u.id, u.name]));

  return polls.map((p) => {
    const counts = p.options.map((o) => o.votes.length);
    let myVote: number | null = null;
    if (userId) {
      const idx = p.options.findIndex((o) =>
        o.votes.some((v) => v.userId === userId)
      );
      if (idx >= 0) myVote = idx;
    }
    return {
      id: p.id,
      question: p.question,
      options: p.options.map((o) => o.label),
      authorName: authorNameById.get(p.createdBy) ?? null,
      closed: p.status === "CLOSED",
      createdAt: p.createdAt.toISOString(),
      counts,
      total: counts.reduce((n, c) => n + c, 0),
      myVote,
      isAuthor: userId != null && p.createdBy === userId,
    };
  });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const ctx = await getTripForRead(shareId);
  if (!ctx) {
    return NextResponse.json({ error: "Ta pot ne obstaja (ali ni javna)." }, { status: 404 });
  }
  const polls = await loadPolls(ctx.journey.id, ctx.userId);
  return NextResponse.json({ polls });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "EDITOR");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId } = guard.ctx;

  let body: { question?: unknown; options?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const options = Array.isArray(body.options)
    ? body.options.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter((o) => o.length > 0)
    : [];

  if (question.length < 2 || question.length > QUESTION_MAX) {
    return NextResponse.json(
      { error: `Vprašanje mora imeti med 2 in ${QUESTION_MAX} znakov.` },
      { status: 400 }
    );
  }
  if (options.length < OPTIONS_MIN || options.length > OPTIONS_MAX) {
    return NextResponse.json(
      { error: `Anketa potrebuje ${OPTIONS_MIN}–${OPTIONS_MAX} nepraznih možnosti.` },
      { status: 400 }
    );
  }
  if (options.some((o) => o.length > OPTION_MAX)) {
    return NextResponse.json(
      { error: `Posamezna možnost je lahko dolga največ ${OPTION_MAX} znakov.` },
      { status: 400 }
    );
  }

  const poll = await db.tripPoll.create({
    data: {
      journeyId: journey.id,
      createdBy: userId ?? "",
      question,
      status: "OPEN",
      options: {
        create: options.map((label, i) => ({ label, sortOrder: i })),
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(
    {
      success: true,
      poll: {
        id: poll.id,
        question: poll.question,
        options: poll.options.map((o) => o.label),
        authorName: null,
        closed: false,
        createdAt: poll.createdAt.toISOString(),
        counts: poll.options.map(() => 0),
        total: 0,
        myVote: null,
        isAuthor: true,
      },
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "VIEWER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId, role } = guard.ctx;

  let body: { pollId?: unknown; closed?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  if (typeof body.pollId !== "string" || !body.pollId || typeof body.closed !== "boolean") {
    return NextResponse.json(
      { error: "Podaj pollId in closed (true/false)." },
      { status: 400 }
    );
  }

  const poll = await db.tripPoll.findFirst({
    where: { id: body.pollId, journeyId: journey.id },
  });
  if (!poll) {
    return NextResponse.json({ error: "Anketa ne obstaja." }, { status: 404 });
  }
  if (role !== "OWNER" && poll.createdBy !== userId) {
    return NextResponse.json(
      { error: "Anketo lahko zaključi samo njen avtor ali lastnik poti." },
      { status: 403 }
    );
  }

  await db.tripPoll.update({
    where: { id: poll.id },
    data: { status: body.closed ? "CLOSED" : "OPEN" },
  });

  const polls = await loadPolls(journey.id, userId);
  const updated = polls.find((p) => p.id === poll.id) ?? null;
  return NextResponse.json({ success: true, poll: updated });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "VIEWER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { journey, userId, role } = guard.ctx;

  let body: { pollId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }
  if (typeof body.pollId !== "string" || !body.pollId) {
    return NextResponse.json({ error: "Podaj pollId." }, { status: 400 });
  }

  const poll = await db.tripPoll.findFirst({
    where: { id: body.pollId, journeyId: journey.id },
  });
  if (!poll) {
    return NextResponse.json({ error: "Anketa ne obstaja." }, { status: 404 });
  }
  if (role !== "OWNER" && poll.createdBy !== userId) {
    return NextResponse.json(
      { error: "Anketo lahko izbriše samo njen avtor ali lastnik poti." },
      { status: 403 }
    );
  }

  await db.tripPoll.delete({ where: { id: poll.id } });
  return NextResponse.json({ success: true });
}
