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
  return !site || site === 'same-origin' || site === 'none';
}
