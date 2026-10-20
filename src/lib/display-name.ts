/**
 * Varen prikazni ime za demo profil.
 *
 * Vnos je uporabniški, zato ga stisnemo in omejimo na 40 kodnih točk
 * (ne UTF-16 enot — emoji se ne sme razpoloviti). Krmilni in nevidni
 * formatni znaki (npr. bidi preklopi) se nadomestijo s presledkom, da ime
 * ne more pokvariti prikaza ali govora.
 */
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu;
const MAX_NAME_CODE_POINTS = 40;

export function normalizeDisplayName(raw: unknown, fallback = 'Popotnik'): string {
  if (typeof raw !== 'string') return fallback;

  const cleaned = raw
    .replace(INVISIBLE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) return fallback;
  return Array.from(cleaned).slice(0, MAX_NAME_CODE_POINTS).join('').trim() || fallback;
}
