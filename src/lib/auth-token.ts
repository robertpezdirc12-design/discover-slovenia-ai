import { createHash, randomBytes } from 'node:crypto';
import { normalizeDisplayName } from '@/lib/display-name';
import { SITE_URL } from '@/lib/site';

/**
 * Enkratna prijavna povezava (magic link).
 *
 * Surov žeton se pošlje samo v e-pošti; v bazi hranimo SHA-256 hash. Tako
 * uhajanje baze ne omogoči prijave v uporabniške profile.
 */
export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1_000;

export function generateLoginToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashLoginToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Normalizira e-poštni naslov za iskanje in shranjevanje.
 * Vrača null za očitno neveljavne vnose; podrobnega preverjanja ne delamo,
 * ker končno veljavnost potrdi šele dostava pošte.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  if (/[\u0000-\u001f\u007f]/.test(email)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  return email;
}

/** Prikazno ime iz lokalnega dela e-pošte, dokler uporabnik ne nastavi svojega. */
export function displayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  return normalizeDisplayName(localPart, 'Popotnik');
}

/**
 * Javni URL za prijavne povezave. `AUTH_URL` lahko prepiše gradbeni
 * `NEXT_PUBLIC_SITE_URL` (npr. lokalni test na drugem portu ali preview).
 */
export function authBaseUrl(): string {
  const raw = process.env.AUTH_URL?.trim();
  if (!raw) return SITE_URL;

  try {
    const url = new URL(raw);
    const isLoopback =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]';
    if (url.protocol !== 'https:' && !isLoopback) return SITE_URL;
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
  } catch {
    /* neveljaven AUTH_URL — uporabi varen privzetek */
  }
  return SITE_URL;
}
