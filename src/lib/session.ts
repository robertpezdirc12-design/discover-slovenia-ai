import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
} from '@/lib/session-token';

export interface SessionUser {
  userId: string;
  name: string;
}

/**
 * Prebere sejo iz httpOnly piškotka in jo preveri v bazi.
 * Ob nedosegljivi bazi vrne null — stran se izriše kot odjavljena, ne 500.
 * `cache()` prepreči več enakih poizvedb v istem requestu.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = await withDbTimeout(
      db.session.findUnique({
        where: { tokenHash: hashSessionToken(token) },
        select: {
          expiresAt: true,
          user: { select: { id: true, name: true } },
        },
      }),
      2_500,
    );
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return { userId: session.user.id, name: session.user.name };
  } catch {
    return null;
  }
});

/** Ustvari uporabnika in novo sejo; vrne surov žeton za piškotek. */
export async function createUserSession(name: string): Promise<{
  token: string;
  user: { id: string; name: string };
}> {
  const token = generateSessionToken();
  const user = await withDbTimeout(
    db.user.create({
      data: {
        name,
        sessions: {
          create: {
            tokenHash: hashSessionToken(token),
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          },
        },
      },
    }),
    4_000,
  );

  // Počisti stare seje ob vsakem novem prijavljanju (ne blokira odgovora).
  void db.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {
      /* čiščenje je prijetnost */
    });

  return { token, user: { id: user.id, name: user.name } };
}
