import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { withDbTimeout } from '@/lib/db-timeout';
import { SESSION_COOKIE, hashSessionToken } from '@/lib/session-token';

export interface SessionUser {
  userId: string;
  name: string;
  email: string | null;
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
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      2_500,
    );
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };
  } catch {
    return null;
  }
});

/** Prekliče samo trenutno sejo; profil in drugi brskalniki ostanejo prijavljeni. */
export async function revokeSessionToken(token: string): Promise<void> {
  await withDbTimeout(
    db.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } }),
    3_000,
  );
}
