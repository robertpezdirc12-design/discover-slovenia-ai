/**
 * IZVOZ POTI V GPX 1.1 — offline uporabnost (vzorec Komoot/Outdooractive).
 *
 * Izrazita želja (raziskava UX vzorcev, worklog POLIRAJ-5): uporabnik naj
 * svojo pot lahko odnese s seboj — uvozi v navigacijo, Garmin, OsmAnd ali
 * Komoot tudi brez povezave. Izvoz je DETERMINISTIČEN in brez strežnika:
 *   • vsaka postanka poti in vsako rezervirano prenočišče → <wpt>;
 *   • celoten vrstni red → <rte> z <rtept> (prava pot po vrsti obiska).
 *
 * Čisto in testabilno: brez Reacta, brez `window`, brez omrežja.
 * Varnost: imena/opisi se XML-escapajo, koordinate se preverijo,
 * največ 60 točk (varstvo pred podatki iz pokvarjene shrambe).
 */

export type GpxPointKind = 'destinacija' | 'prenocisce';

export interface GpxPoint {
  name: string;
  lat: number;
  lng: number;
  /** Kratek opis — v GPX <desc> (neobvezno). */
  note?: string;
  kind?: GpxPointKind;
}

export interface GpxBuildOptions {
  /** Ime poti v <metadata> in <rte><name> — privzeto "Moja pot po Sloveniji". */
  name?: string;
  /** Čas nastanka (testi ga podajo za determinističen izpis). */
  generatedAt?: Date;
}

export const MAX_GPX_POINTS = 60;
export const DEFAULT_GPX_NAME = 'Moja pot po Sloveniji';

/** XML escaping — & < > " ' (prepreči pokvarjen GPX pri imenih z narekovaji). */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Veljavne točke, omejene na MAX_GPX_POINTS; neveljavne tiho izloči. */
export function sanitizeGpxPoints(points: readonly GpxPoint[]): GpxPoint[] {
  const out: GpxPoint[] = [];
  for (const p of points) {
    if (!p || typeof p.name !== 'string' || p.name.trim().length === 0) continue;
    const { lat, lng } = p;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;
    out.push({
      name: p.name.trim().slice(0, 120),
      lat,
      lng,
      note: typeof p.note === 'string' ? p.note.trim().slice(0, 240) : undefined,
      kind: p.kind === 'prenocisce' ? 'prenocisce' : 'destinacija',
    });
    if (out.length >= MAX_GPX_POINTS) break;
  }
  return out;
}

/** Koordinata v GPX zapisu (7 decimalk, vedno pika). */
function coord(n: number): string {
  return n.toFixed(7);
}

/**
 * Zgradi GPX 1.1 dokument ali `null`, če ni nobene veljavne točke.
 * Dokument vsebuje <metadata>, <wpt> za vsako točko in <rte> z <rtept>.
 */
export function buildGpx(points: readonly GpxPoint[], options: GpxBuildOptions = {}): string | null {
  const clean = sanitizeGpxPoints(points);
  if (clean.length === 0) return null;

  const name = (options.name ?? DEFAULT_GPX_NAME).trim().slice(0, 120) || DEFAULT_GPX_NAME;
  const time = (options.generatedAt ?? new Date()).toISOString();
  const escapedName = escapeXml(name);

  const wpts = clean.map((p) => {
    const desc = p.note ? `\n    <desc>${escapeXml(p.note)}</desc>` : '';
    const type = p.kind === 'prenocisce' ? 'prenocisce' : 'destinacija';
    return [
      `  <wpt lat="${coord(p.lat)}" lng="${coord(p.lng)}">`,
      `    <name>${escapeXml(p.name)}</name>${desc}`,
      `    <type>${type}</type>`,
      `  </wpt>`,
    ].join('\n');
  });

  const rtepts = clean.map((p) =>
    `    <rtept lat="${coord(p.lat)}" lng="${coord(p.lng)}"><name>${escapeXml(p.name)}</name></rtept>`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Discover Slovenia AI" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${escapedName}</name>`,
    `    <time>${time}</time>`,
    '  </metadata>',
    ...wpts,
    '  <rte>',
    `    <name>${escapedName}</name>`,
    ...rtepts,
    '  </rte>',
    '</gpx>',
    '',
  ].join('\n');
}

/** Ime datoteke: pot-po-sloveniji-YYYY-MM-DD.gpx. */
export function gpxFileName(date: Date = new Date()): string {
  const d = Number.isNaN(date.getTime()) ? new Date() : date;
  return `pot-po-sloveniji-${d.toISOString().slice(0, 10)}.gpx`;
}
