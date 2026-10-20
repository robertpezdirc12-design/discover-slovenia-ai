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
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    if (originUrl.origin === requestUrl.origin) return true;

    // Za proxyjem je request.url lahko interni; primerjaj še z javnim Host
    // (in protokolom, ki ga nastavi proxy). Brskalnik ne more ponarediti
    // Host glave za tujo domeno.
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || request.headers.get('host')?.trim();
    if (!host) return false;

    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const protocol = forwardedProto ? `${forwardedProto}:` : requestUrl.protocol;
    const expected = new URL(`${protocol}//${host}`);
    return (
      originUrl.protocol === expected.protocol &&
      originUrl.hostname === expected.hostname &&
      originUrl.port === expected.port
    );
  } catch {
    return false;
  }
}
