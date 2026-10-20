/**
 * Prepreči CSRF pri mutacijah, ki jih sproži brskalnik.
 *
 * Brskalniki ob pošiljanju pošljejo `Sec-Fetch-Site`. Če ga ni (npr. curl,
 * uptime monitoring), zahteve ne blokiramo, ker izvora ne moremo ugotoviti.
 * Piškotek seje je dodatno `SameSite=Lax`, zato tuja stran ne more poslati
 * seje ob navadnem fetchu.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';

  // Starejši brskalniki ne pošiljajo Sec-Fetch-Site, pošljejo pa Origin.
  // Če ga ni (curl, uptime), zahteve ne blokiramo — piškotka seje ni.
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
