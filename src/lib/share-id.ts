/**
 * SHARE-ID (klient) — CSPRNG generator za deljene pote (kanon 2.26.0).
 * ============================================================================
 * Ista abeceda/dolžina kot strežniški randomShareId iz /api/trips
 * ([a-z0-9] × 10) — zavrnitveno vzorčenje proti modulomu (252/256).
 * crypto.getRandomValues je edini varen vir v brskalniku (kanon P0 AUDIT H1
 * — Math.random je napovedljiv PRNG in javni shareId mora biti neugibljiv).
 *
 * Nauk iz e2e (2.26.0): Uint8Array se začne z NIČLAMI — vstopni vnos je
 * OBVEZEN pred prvo uporabo (napaka je dala "aaaaaaaaaa"); zaklenjeno z
 * testom (tests/share-id.test.ts).
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const LIMIT = 256 - (256 % ALPHABET.length); // 252 — pravični razpon
const LENGTH = 10;

/** Naključni shareId [a-z0-9] × 10 (CSPRNG, brez modulovega pristranskosti). */
export function randomShareIdClient(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes); // OBVEZNI začetni vnos (ne začni z ničlami)
  let out = "";
  let i = 0;
  while (out.length < LENGTH) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes);
      i = 0;
    }
    const b = bytes[i++];
    if (b < LIMIT) out += ALPHABET[b % ALPHABET.length];
  }
  return out;
}

/** Veljavnostna oblika (server: SHARE_ID_RE v /api/trips). */
export const SHARE_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
