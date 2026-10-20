const FALLBACK_SITE_URL = 'https://i-feel-slovenia.vercel.app';

/**
 * Javni URL aplikacije. Nastavi ga z `NEXT_PUBLIC_SITE_URL` (lokalno
 * http://localhost:3000, v produkciji prava domena), da canonical,
 * Open Graph in JSON-LD ne kažejo na tujo domeno.
 */
function normalizeSiteUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return FALLBACK_SITE_URL;
    return url.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL,
);
