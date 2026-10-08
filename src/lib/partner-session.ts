/**
 * PARTNER-SESSION — strežniški pomočnik za partnerje (P0-H).
 *
 * Vloga "partner" se bere IZ BAZE ob vsakem zahtevku (ne iz JWT —
 * žeton nikoli ne nosi pooblastil, ki bi ostala po preklicu vloge).
 * Fail-closed: brez seje ali brez vloge → null/false.
 */

import { getServerSession } from "next-auth";

import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";

export interface SessionContext {
  userId: string;
  email: string;
}

/** Prijavljena seja (katerikoli uporabnik) ali null. */
export async function getSessionContext(): Promise<SessionContext | null> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const email = session?.user?.email?.trim().toLowerCase();
    if (!userId || !email) return null;
    return { userId, email };
  } catch {
    return null; // napaka seje → fail-closed null
  }
}

/** Ali ima prijavljeni uporabnik vlogo "partner" (branje iz baze). */
export async function getPartnerContext(): Promise<SessionContext | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  try {
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    });
    if (user?.role !== "partner") return null;
    return ctx;
  } catch {
    return null;
  }
}
