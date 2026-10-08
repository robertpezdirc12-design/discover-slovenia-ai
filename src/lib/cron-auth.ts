import { NextRequest, NextResponse } from "next/server";

/**
 * CRON-AUTH — skupni fail-closed vhodni varovalni seznam za VSE cron poti
 * (P0-I, issue #1 §21 „cron secure and idempotent").
 * ============================================================================
 * Kanon (enak za vse jobe):
 *  - CRON_SECRET MORA biti nastavljen v okolju — brez njega je cron ZAPRT
 *    (401 „fail-closed", nikoli „odprt za vse");
 *  - glava Authorization MORA biti natanko `Bearer <CRON_SECRET>`
 *    (konstantna primerjava — brez timing-pasteho pomankanja skrbi;
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
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ...DENIED_BODY, reason: "neveljaven žeton" },
      { status: 401 },
    );
  }
  return null;
}

/** Ali je CRON_SECRET nastavljen? (za health preverbo — brez razkritja vrednosti.) */
export function cronSecretConfigured(): boolean {
  const secret = process.env.CRON_SECRET;
  return typeof secret === "string" && secret.trim().length > 0;
}
