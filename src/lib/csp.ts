/**
 * CSP (Content-Security-Policy) — gradilnik nonce politike (issue #2 §9,
 * priporočilo PRODUCT-AUDIT.md »CSP nonce«).
 *
 * NAČIN: nonce + 'strict-dynamic' (kanon Next.js App Router):
 *  - middleware postavi `content-security-policy` na ZAHTVEKO → Next.js
 *    samodejno pripne nonce vsem svojim skriptom (bootstrap + chunki);
 *  - 'strict-dynamic' omogoči, da nonce-v skripta dinamično naložijo
 *    nadaljnje chunke (React/Leaflet/qrcode so vsi npm-bundlani = 'self');
 *  - next-themes 0.4.6 dobi nonce IZRECNO (prop `nonce` v ThemeProvider).
 *
 * ZUNANJI VIROVI BRSKALNIKA (inventura 2026-10-14, rg po src/):
 *  - zemljevid (privzeti): Leaflet ploščice https://tile.openstreetmap.org (img-src)
 *  - zemljevid (PoC #35 faza 1, 2.63.0, ?zemljevid=vektorji): MapLibre +
 *    OpenFreeMap — VSE pridobitve (slog JSON, vektorski .pbf, glyphs, sprite,
 *    NE raster) iz ENEGA hosta https://tiles.openfreemap.org (curl
 *    verifikacija 14. 10. 2026) → connect-src (fetch/worker) + img-src
 *    (defenzivno za sprite/raster); nalaga se ŠELE ob vstopu v PoC
 *  - VREME/OSRM/STO/FSQ: IZKLJUČNO strežniško (fetch v /api/* prek proxyjev)
 *    → poleg OFM PoC hosta ostaja connect-src brez drugih absolutnih fetch
 *  - fonte: next/font/google = samogostujoče (/_next/static/media → 'self')
 *  - Stripe: strežniški SDK + preusmeritev na gostujočo stran (brez
 *    klientnega js.stripe.com) → brez CSP potrebe
 *  - QR: knjižnica qrcode riše na <canvas> (ni CSP-a)
 *
 * style-src 'unsafe-inline' je ZAVESTNO (Tailwind razredi + Leafletovi
 * inlineski slogi + chart.tsx <style>): nonce za stile brskalniki ne
 * podpirajo dosledno; zaščita skript je bistvo CSP (XSS vektor).
 *
 * 'unsafe-eval' samo v razvoju (React Refresh / HMR).
 * `upgrade-insecure-requests` samo v produkciji (lokalni http dev).
 */

/** Ploščice standardnega zemljevida (Leaflet TileLayer, travel-map.tsx). */
export const CSP_TILE_HOSTS = "https://tile.openstreetmap.org";

/** #35 faza 1 PoC (2.63.0): MapLibre + OpenFreeMap javni primerek — VSE
 * pridobitve (slog JSON, vektorski .pbf, glyphs, sprite, NE raster) iz
 * ENEGA hosta (curl verifikacija 14. 10. 2026); vektorski tile-i in glyphi
 * grejo prek fetch v workerju → connect-src; sprite/raster defenzivno tudi
 * v img-src. Nalaga se šele ob ?zemljevid=vektorji (travel-map-vector-poc). */
export const CSP_MAPLIBRE_HOSTS = "https://tiles.openfreemap.org";

export interface CspOptions {
  /** Naključni žeton zahteve (base64, brez presledkov). */
  nonce: string;
  /** Razvojni način (NODE_ENV !== "production") → 'unsafe-eval' za React Refresh. */
  dev?: boolean;
}

/**
 * Zgradi vrednost glave Content-Security-Policy.
 *
 * Deterministična in čista (isti vnosi → isti izhod) — primerna za
 * pogodbene teste. Vrstni red direktiv je fiksen.
 */
export function buildCspHeader({ nonce, dev = false }: CspOptions): string {
  if (!nonce || /[\s"'()]/.test(nonce)) {
    throw new Error("buildCspHeader: nonce mora biti neprazen base64 žeton brez presledkov");
  }

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Razvoj: React Refresh/HMR potrebuje eval; produkcija je strožja.
    ...(dev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind + Leaflet inline + chart.tsx <style> — glej opombo zgoraj.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${CSP_TILE_HOSTS} ${CSP_MAPLIBRE_HOSTS}`,
    "font-src 'self' data:",
    // 1 klientni absolutni fetch: OpenFreeMap PoC (#35 faza 1) — vsi ostali
    // zunanji API (vreme/OSRM/STO/FSQ) ostaja strežniško prek /api/*.
    `connect-src 'self' ${CSP_MAPLIBRE_HOSTS}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Vsi obrazci oddajo na lastne /api/* (Stripe = preusmeritev, ne forma).
    "form-action 'self'",
    // Zrcali X-Frame-Options: DENY iz next.config.ts (M5).
    "frame-ancestors 'none'",
    // Produkcija: vsi viri prek https (Vercel). Lokalni http dev izpuščen.
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ];

  return directives.join("; ");
}
