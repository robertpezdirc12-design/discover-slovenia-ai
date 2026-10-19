import { NextRequest, NextResponse } from 'next/server';

/**
 * Demo seja (namesto next-auth getServerSession).
 * Bralca seje v produkciji zamenja `getSession()` (React cache + next-auth),
 * mehanika prikaza (Suspense + rezervirana višina) ostane enaka.
 */

export const SESSION_COOKIE = 'dsa_demo_user';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 40)
      : 'Ana';

  const res = NextResponse.json({ ok: true, name });
  res.cookies.set(SESSION_COOKIE, name, {
    path: '/',
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
