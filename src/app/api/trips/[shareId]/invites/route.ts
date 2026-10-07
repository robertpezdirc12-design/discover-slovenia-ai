import { NextResponse } from "next/server";

import { getTripForWrite, issueTripInvite } from "@/lib/trip-auth";

/**
 * POST /api/trips/[shareId]/invites — izdaja vabila (enaka logika kot
 * POST .../collaborators; mostovni vzorec izvirnika, kjer je bila izdaja
 * na collaborators končni točki). SAMO lastnik.
 */

interface RouteParams {
  params: Promise<{ shareId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { shareId } = await params;
  const guard = await getTripForWrite(shareId, "OWNER");
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { role?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Neveljaven zahtevek (JSON)." }, { status: 400 });
  }

  const role = body.role === "VIEWER" ? "VIEWER" : body.role === "EDITOR" ? "EDITOR" : null;
  if (!role) {
    return NextResponse.json(
      { error: "Vloga mora biti EDITOR ali VIEWER." },
      { status: 400 }
    );
  }

  try {
    const token = await issueTripInvite(guard.ctx.journey.id, role as "EDITOR" | "VIEWER");
    return NextResponse.json(
      {
        success: true,
        inviteUrl: `/pot/${shareId}?invite=${token}`,
        emailHint: "E-poštna vrata še niso pripravljena — povezavo kopiraj in deli ročno.",
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Vabila ni bilo mogoče izstaviti." },
      { status: 500 }
    );
  }
}
