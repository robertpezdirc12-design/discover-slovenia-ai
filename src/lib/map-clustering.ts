/**
 * MAP-CLUSTERING — gručenje markerjev po prekrivanju dotikalnih ciljev
 * (PR #62, pripomba lastnika: Bled in Vintgarska soteska se pri gosti
 * povečavi prekrivata — 44-px dotikalna cilja sta pri zoom 8 le ~18,6 px
 * narazen — zato dotik lahko izbere napačno destinacijo).
 *
 * ZAKAJ NE supercluster (GeoJSON vir + clusterRadius): supercluster gruči
 * po fiksnem radiju in NE zagotavlja, da se po razpetju gruče 44-px cilji
 * dejansko NE prekrivajo (razpetje pomeni le "ni več ene gruče", ne
 * "vsak cilj je posamezno dosegljiv"). Ta modul neposredno zakodeje
 * invarianto, ki jo zahteva PR #62:
 *
 *   1. dve destinaciji sta v isti gruči natanko takrat, ko bi se njuna
 *      44 × 44 px dotikalna cilja fizično prekrivala (groupOverlapping);
 *   2. klik gruče poveča kamero na NAJMANJŠO povečavo, pri kateri so vsi
 *      člani ≥ MIN_TOUCH_TARGET_PX narazen (requiredSeparationZoom) —
 *      vsaka destinacija postane posamezno izberljiva;
 *   3. dotikalni cilji se NIKOLI ne zmanjšajo pod 44 × 44 px — namesto
 *      tega se število ciljev zmanjša (ena gruča namesto prekrivanja).
 *
 * Čista logika (brez MapLibre/DOM) — enotsko testirana v
 * tests/map-clustering.test.ts, vključno z invarianto kanona DESTINATIONS
 * (najgostejši par piran ↔ portorož se loči pri zoom ≈ 10,1 ≪ maxZoom 18,
 * zato klik gruče VEDNO razpre skupino v tej podatkovni množici).
 */

/** Najmanjša (in privzeta) stran dotikalnega cilja v px — enako kot
 * markerji v travel-map-vector-poc.tsx (h-11 w-11 = 44 px) in kontrole
 * zooma v globals.css (width/height: 44px). Prag WCAG 2.5.8 / iOS HIG. */
export const MIN_TOUCH_TARGET_PX = 44;

export interface PointXY {
  x: number;
  y: number;
}

export interface LngLatPoint {
  lng: number;
  lat: number;
}

/** Web Mercator (512-px svet, MapLibre konvencija): lng/lat → svetovni px
 * pri danem zoomu. Pan kamere se ne upošteva — za prekrivanje so odločilne
 * le razdalje MED točkami, te so od pan-a neodvisne. */
export function lngLatToWorldPx(
  lngLat: LngLatPoint,
  zoom: number,
): PointXY {
  const worldSize = 512 * 2 ** zoom;
  const lat = Math.min(85.05112878, Math.max(-85.05112878, lngLat.lat));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lngLat.lng + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  };
}

/** Združi točke v povezane komponente prekrivanja: dve točki sta v isti
 * skupini, če je razdalja med središčema < minDistancePx (44-px kvadrata
 * se prekrivata). Verige (A–B in B–C se prekrivata, A–C ne) postanejo ENA
 * skupina — v gruči so lahko tudi sosedje, ki si ne delita cilja neposredno.
 * Deterministično: skupine in člani sledijo vrstnemu redu vhoda. */
export function groupOverlapping<T extends PointXY>(
  points: readonly T[],
  minDistancePx: number = MIN_TOUCH_TARGET_PX,
): T[][] {
  const n = points.length;
  if (n <= 1) return n === 1 ? [[points[0]]] : [];

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) {
      const next = parent[i];
      parent[i] = root;
      i = next;
    }
    return root;
  };

  const min2 = minDistancePx * minDistancePx;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      if (dx * dx + dy * dy < min2) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
    }
  }

  const groups = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(points[i]);
    else groups.set(root, [points[i]]);
  }
  return [...groups.values()];
}

/** Najmanjši zoom, pri katerem so VSI pari točk ≥ minDistancePx narazen
 * (px razdalja raste 2^zoom). < 2 točki → 0; identični koordinati (se
 * nikoli ne ločita) → maxZoom — eksplicitna "mrtva točka", ki je v kanonu
 * DESTINATIONS izključena (invariantni test ⑪). */
export function requiredSeparationZoom(
  points: readonly LngLatPoint[],
  minDistancePx: number = MIN_TOUCH_TARGET_PX,
  maxZoom: number = 18,
): number {
  // Razdalja pri zoom 0 (svet 512 px) se nato skalira z 2^zoom:
  const base = points.map((p) => lngLatToWorldPx(p, 0));
  let needed = 0;
  for (let i = 0; i < base.length; i++) {
    for (let j = i + 1; j < base.length; j++) {
      const d0 = Math.hypot(base[i].x - base[j].x, base[i].y - base[j].y);
      if (d0 <= 0) return maxZoom;
      needed = Math.max(needed, Math.log2(minDistancePx / d0));
    }
  }
  return Math.min(needed, maxZoom);
}
