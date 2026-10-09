import { timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

/**
 * CRON-AUTH — skupni fail-closed vhodni varovalni seznam za VSE cron poti
 * (P0-I, issue #1 §21 „cron secure and idempotent").
 * ============================================================================
 * Kanon (enak za vse jobe):
 *  - CRON_SECRET MORA biti nastavljen v okolju — brez njega je cron ZAPRT
 *    (401 „fail-closed", nikoli „odprt za vse");
 *  - glava Authorization MORA biti natanko `Bearer <CRON_SECRET>`
 *    (timingSafeEqual primerjava po dolžini-izenačenih zapisov — brez
 *    timing ortanske analize; P0 AUDIT M4: prejšnja !== primerjava je bila
 *    NENAMERNO zgodnja prekinitvena past, komentar „konstantna primerjava"
 *    je bil napačen — zdaj je trditev resnična);
 *    sporočilo napake NE razkrije, kateri del je bil napačen);
 *  - GET + POST sta podprta (Vercel cron pošilja GET z glavo).
 *
 * Uporaba v routi:
 *   const denied = requireCronSecret(req);
 *   if (denied) return denied; // 401
 */

const DENIED_BODY = { error: "cron je zaprt — potreben je veljaven Bearer žeton (fail-closed)" } as const;

/**
 * Vrne NextResponse 401, če zahtevek NI avtoriziran (skrivnost manjka ali se
 * ne ujema). Vrne null, če je zahtevek upravičen — routa nadaljuje z delom.
 */
export function requireCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (typeof secret !== "string" || secret.trim().length === 0) {
    // Skrivnost ni nastavljena: cron je namerno ZAPRT (nikoli odprt brez
    // skrivnosti — privzetek „prazno = dovoli vse" bi bil varnostna luknja).
    return NextResponse.json(
      { ...DENIED_BODY, reason: "CRON_SECRET ni nastavljen v okolju" },
      { status: 401 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!bearerMatches(auth, secret)) {
    return NextResponse.json(
      { ...DENIED_BODY, reason: "neveljaven žeton" },
      { status: 401 },
    );
  }
  return null;
}

/**
 * Timing-safe primerjava `Bearer <token>` proti pričakovani skrivnosti.
 * Dolžinska razlika se NE razkrije takoj — zapolnemo na skupno dolžino
 * in primerjamo z timingSafeEqual (enako delovanje, enak čas).
 */
function bearerMatches(auth: string, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const provided = Buffer.from(auth, "utf8");
  const len = Math.max(expected.length, provided.length);
  const a = Buffer.alloc(len);
  expected.copy(a);
  const b = Buffer.alloc(len);
  provided.copy(b);
  return timingSafeEqual(a, b) && expected.length === provided.length;
}

/** Ali je CRON_SECRET nastavljen? (za health preverbo — brez razkritja vrednosti.) */
export function cronSecretConfigured(): boolean {
  const secret = process.env.CRON_SECRET;
  return typeof secret === "string" && secret.trim().length > 0;
}
