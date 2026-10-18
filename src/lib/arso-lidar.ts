/**
 * ARSO LiDAR — visokoločljivostni relief (hladčenje) kot dodatni sloj.
 *
 * VIR (izmerjeno 18. 10. 2026, glej research/arso-lidar/SUMMARY.md):
 *   • Storitev: http://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer
 *   • Dinamični izvoz: /export?bbox=…&bboxSR=3857&imageSR=3857&size=256,256&format=png&f=image
 *     (test: HTTP 200, PNG 256×256, območje Bleda — pravi LiDAR relief)
 *   • Licenca: CC BY 4.0 (OPSI "Digitalni model višin", MOP/GURS)
 *   • Suha gradnja DMV0050 (5 m, LiDAR izpeljan): 4 četrtine, ≈ 3,47 GB — potrjeno z HEAD.
 *
 * Fair-use disciplina: ena zahteva na ploščico (256×256), brez prefetcha,
 * `updateWhenIdle` — strežnik ni CDN. Produkcija: proxy + lokalni predpomnilnik.
 */

/** Zemepisna širina/dolžina ploščice XYZ (Web Mercator tiling scheme). */
function tileLonLat(x: number, y: number, z: number): { lon1: number; latTop: number; lon2: number; latBottom: number } {
  const n = Math.pow(2, z);
  const lon1 = (x / n) * 360 - 180;
  const lon2 = ((x + 1) / n) * 360 - 180;
  // zgornji rob ploščice (y) ima večjo širino kot spodnji (y+1)
  const latTop = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const latBottom = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return { lon1, latTop, lon2, latBottom };
}

/** BBox ploščice v EPSG:3857 (metri) — čista funkcija, testirana. */
export function tileBbox3857(x: number, y: number, z: number): { xmin: number; ymin: number; xmax: number; ymax: number } {
  const R = 6378137;
  const { lon1, latTop, lon2, latBottom } = tileLonLat(x, y, z);
  const x1 = R * (lon1 * (Math.PI / 180));
  const x2 = R * (lon2 * (Math.PI / 180));
  const yTop = R * Math.log(Math.tan(Math.PI / 4 + latTop / 2));
  const yBottom = R * Math.log(Math.tan(Math.PI / 4 + latBottom / 2));
  return { xmin: Math.min(x1, x2), ymin: Math.min(yBottom, yTop), xmax: Math.max(x1, x2), ymax: Math.max(yBottom, yTop) };
}

/** URL dinamičnega izvoza ARSO LiDAR hladčenja za XYZ ploščico. */
export function arsoLidarTileUrl(x: number, y: number, z: number, size = 256): string {
  const b = tileBbox3857(x, y, z);
  const p = (v: number) => Math.round(v * 100) / 100;
  const params = new URLSearchParams({
    bbox: `${p(b.xmin)},${p(b.ymin)},${p(b.xmax)},${p(b.ymax)}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${size},${size}`,
    format: 'png',
    f: 'image',
    transparent: 'true',
  });
  return `https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export?${params.toString()}`;
}

export const ARSO_LIDAR_ATTRIBUTION =
  'LiDAR relief &copy; <a href="https://www.gov.si/drzavni-organi/organi-v-sestavi/geodetska-uprava/" rel="noopener">GURS</a>/<a href="https://www.arso.gov.si" rel="noopener">ARSO</a> (CC BY 4.0)';
