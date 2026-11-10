import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_GPX_NAME,
  MAX_GPX_POINTS,
  buildGpx,
  escapeXml,
  gpxFileName,
  sanitizeGpxPoints,
  type GpxPoint,
} from '@/lib/gpx-export';

const POINTS: GpxPoint[] = [
  { name: 'Bled', lat: 46.3625, lng: 14.0936, note: 'Jezerski otok' },
  { name: 'Bohinj', lat: 46.2714, lng: 13.9526, kind: 'destinacija' },
  { name: 'Hotel Bled', lat: 46.36, lng: 14.09, note: 'Prenočišče', kind: 'prenocisce' },
];

const AT = new Date('2026-11-10T12:00:00.000Z');

describe('gpx-export — XML zaščita', () => {
  test('escapeXml: & < > " \'', () => {
    expect(escapeXml('A & B <C> "D" \'E\'')).toBe('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
  });

  test('ime z & se ne pokvari GPX dokumenta', () => {
    const gpx = buildGpx([{ name: 'Grad & "Stari" <grad>', lat: 46, lng: 14 }], { generatedAt: AT })!;
    expect(gpx).toContain('<name>Grad &amp; &quot;Stari&quot; &lt;grad&gt;</name>');
    expect(gpx).not.toContain('<name>Grad & "');
  });
});

describe('gpx-export — čiščenje vhodov', () => {
  test('neveljavne koordinate in prazna imena se izločijo', () => {
    const clean = sanitizeGpxPoints([
      { name: 'Ok', lat: 46, lng: 14 },
      { name: '', lat: 46, lng: 14 },
      { name: 'NaN', lat: Number.NaN, lng: 14 },
      { name: 'Pol', lat: 91, lng: 14 },
      { name: 'Dolžina', lat: 46, lng: 200 },
    ]);
    expect(clean.map((p) => p.name)).toEqual(['Ok']);
  });

  test('največ 60 točk', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ name: `T${i}`, lat: 46, lng: 14 }));
    expect(sanitizeGpxPoints(many)).toHaveLength(MAX_GPX_POINTS);
  });

  test('privzeta vrsta je destinacija, dolžina imena je omejena', () => {
    const [p] = sanitizeGpxPoints([{ name: 'x'.repeat(200), lat: 46, lng: 14 }]);
    expect(p.kind).toBe('destinacija');
    expect(p.name).toHaveLength(120);
  });
});

describe('gpx-export — GPX 1.1 dokument', () => {
  test('prazna pot → null (ni prazne datoteke)', () => {
    expect(buildGpx([])).toBeNull();
    expect(buildGpx([{ name: 'X', lat: 999, lng: 0 }])).toBeNull();
  });

  test('glava, metadata in čas', () => {
    const gpx = buildGpx(POINTS, { generatedAt: AT })!;
    expect(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(gpx).toContain('<gpx version="1.1" creator="Discover Slovenia AI" xmlns="http://www.topografix.com/GPX/1/1">');
    expect(gpx).toContain('<time>2026-11-10T12:00:00.000Z</time>');
    expect(gpx).toContain(`<name>${DEFAULT_GPX_NAME}</name>`);
  });

  test('waypointi: pravilne koordinate, opisi in tipi', () => {
    const gpx = buildGpx(POINTS, { generatedAt: AT })!;
    expect(gpx).toContain('<wpt lat="46.3625000" lng="14.0936000">');
    expect(gpx.match(/<wpt /g)).toHaveLength(3);
    expect(gpx).toContain('<desc>Jezerski otok</desc>');
    expect(gpx).toContain('<type>prenocisce</type>');
    expect(gpx).toContain('<type>destinacija</type>');
  });

  test('rte ohrani vrstni red postankov', () => {
    const gpx = buildGpx(POINTS, { generatedAt: AT, name: 'Moja Gorenjska' })!;
    expect(gpx.match(/<rtept /g)).toHaveLength(3);
    const rte = gpx.slice(gpx.indexOf('<rte>'));
    expect(rte.indexOf('Bled')).toBeLessThan(rte.indexOf('Bohinj'));
    expect(rte.indexOf('Bohinj')).toBeLessThan(rte.indexOf('Hotel Bled'));
    expect(gpx).toContain('<name>Moja Gorenjska</name>');
  });

  test('ime poti se escapa, prazno pade na privzeto', () => {
    expect(buildGpx(POINTS, { name: 'A&B', generatedAt: AT })).toContain('<name>A&amp;B</name>');
    expect(buildGpx(POINTS, { name: '   ', generatedAt: AT })).toContain(`<name>${DEFAULT_GPX_NAME}</name>`);
  });

  test('dokument je zaključen in ponovljiv', () => {
    const a = buildGpx(POINTS, { generatedAt: AT });
    const b = buildGpx(POINTS, { generatedAt: AT });
    expect(a).toBe(b);
    expect(a!.trimEnd().endsWith('</gpx>')).toBe(true);
  });
});

describe('gpx-export — ime datoteke', () => {
  test('pot-po-sloveniji-YYYY-MM-DD.gpx', () => {
    expect(gpxFileName(AT)).toBe('pot-po-sloveniji-2026-11-10.gpx');
  });

  test('neveljaven datum ne vrže napake', () => {
    expect(gpxFileName(new Date('x'))).toMatch(/^pot-po-sloveniji-\d{4}-\d{2}-\d{2}\.gpx$/);
  });
});
