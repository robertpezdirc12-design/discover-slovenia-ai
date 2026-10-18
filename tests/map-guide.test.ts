import { describe, expect, test } from 'bun:test';

import {
  MAP_GUIDE_BALKAN_BBOX,
  MAP_GUIDE_CATEGORIES,
  MAP_GUIDE_PLACES,
  isInBalkanBbox,
  mapGuideCategoryLabel,
  mapGuideCategoryNoun,
  mapGuideProgressLabel,
  mapGuideSpeakText,
  placesForCategories,
} from '@/lib/map-guide';

/**
 * VODIČ PO ZEMLJEVIDU — cel Balkan (izrazita želja uporabnika):
 * gumb Vklopi/Izklopi pelje uporabnika po VSEH kategorijah — mesta,
 * vasi, kmečki turizem, narava. Invarianta: katalog nikoli ne sme biti
 * prazen in VSAKA kategorija mora imeti vsaj dva kraja, sicer gumb
 * obljublja ("vska vasa, vsa mesta"), kar zemljevid ne pokaže.
 */

describe('MAP_GUIDE_PLACES — katalog celotnega Balkana', () => {
  test('katalog ni prazen (vsaj 24 krajev)', () => {
    expect(MAP_GUIDE_PLACES.length).toBeGreaterThanOrEqual(24);
  });

  test('id-ji so enolični (ključi označevalcev turneje)', () => {
    const ids = MAP_GUIDE_PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('vsi kraji imajo veljavne koordinate znotraj balkanskega okvira', () => {
    for (const p of MAP_GUIDE_PLACES) {
      expect(Number.isFinite(p.lat)).toBe(true);
      expect(Number.isFinite(p.lng)).toBe(true);
      expect(isInBalkanBbox(p.lat, p.lng)).toBe(true);
    }
  });

  test('vsaka kategorija ima vsaj dva kraja (mesta · vasi · kmečki · narava)', () => {
    for (const cat of MAP_GUIDE_CATEGORIES) {
      const n = MAP_GUIDE_PLACES.filter((p) => p.category === cat.id).length;
      expect(n).toBeGreaterThanOrEqual(2);
    }
  });

  test('kmečki turizem je zastopan s poimenovanimi kmetijami ali območji', () => {
    const farms = MAP_GUIDE_PLACES.filter((p) => p.category === 'kmecki');
    expect(farms.some((p) => p.name.includes('Lenar'))).toBe(true);
    expect(farms.some((p) => p.name.includes('Šolinc'))).toBe(true);
  });

  test('balkanska mesta so prisotna (Skopje, Zagreb, Sarajevo, Beograd …)', () => {
    const names = MAP_GUIDE_PLACES.map((p) => p.name);
    for (const city of ['Skopje', 'Zagreb', 'Sarajevo', 'Beograd', 'Mostar', 'Podgorica', 'Tirana']) {
      expect(names).toContain(city);
    }
  });

  test('vsak kraj ima neprazen opis (pojavno okno + govor vodiča)', () => {
    for (const p of MAP_GUIDE_PLACES) {
      expect(p.note.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('placesForCategories — filtri turneje', () => {
  const ALL_IDS = MAP_GUIDE_CATEGORIES.map((c) => c.id);

  test('vse kategorije → celoten katalog v istem vrstnem redu', () => {
    const all = placesForCategories(ALL_IDS);
    expect(all.length).toBe(MAP_GUIDE_PLACES.length);
    expect(all.map((p) => p.id)).toEqual(MAP_GUIDE_PLACES.map((p) => p.id));
  });

  test('ena kategorija → samo njeni kraji', () => {
    const farms = placesForCategories(['kmecki']);
    expect(farms.length).toBeGreaterThan(0);
    for (const p of farms) expect(p.category).toBe('kmecki');
  });

  test('prazen seznam → prazna turneja (UI onemogoči zadnjo kategorijo)', () => {
    expect(placesForCategories([]).length).toBe(0);
  });

  test('vrstni red ostaja geografski (podmnožica kataloga)', () => {
    const two = placesForCategories(['vas', 'narava']);
    const expected = MAP_GUIDE_PLACES.filter(
      (p) => p.category === 'vas' || p.category === 'narava',
    ).map((p) => p.id);
    expect(two.map((p) => p.id)).toEqual(expected);
  });
});

describe('oznake in pripoved vodiča', () => {
  test('napredek: "1 od N · <ime>" in omeji indeks na veljaven razpon', () => {
    const label = mapGuideProgressLabel(MAP_GUIDE_PLACES, 0);
    expect(label).toBe(`1 od ${MAP_GUIDE_PLACES.length} · ${MAP_GUIDE_PLACES[0].name}`);
    const last = mapGuideProgressLabel(MAP_GUIDE_PLACES, MAP_GUIDE_PLACES.length + 5);
    expect(last).toBe(`${MAP_GUIDE_PLACES.length} od ${MAP_GUIDE_PLACES.length} · ${MAP_GUIDE_PLACES[MAP_GUIDE_PLACES.length - 1].name}`);
  });

  test('napredek pri praznem izboru je prazen niz (ne sme meči)', () => {
    expect(mapGuideProgressLabel([], 0)).toBe('');
  });

  test('govor vsebuje ime in opis', () => {
    const p = MAP_GUIDE_PLACES[0];
    const text = mapGuideSpeakText(p);
    expect(text).toContain(p.name);
    expect(text).toContain(p.note);
  });

  test('oznake kategorij so neprazne in enolične (čipi filtra)', () => {
    const labels = MAP_GUIDE_CATEGORIES.map((c) => c.label);
    const nouns = MAP_GUIDE_CATEGORIES.map((c) => c.noun);
    for (const l of [...labels, ...nouns]) expect(l.trim().length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(nouns).size).toBe(nouns.length);
    expect(mapGuideCategoryLabel('kmecki')).toBe('Kmečki turizem');
    expect(mapGuideCategoryNoun('mesto')).toBe('mesto');
  });

  test('balkanski okvir pokrije vse pričakovane države', () => {
    expect(MAP_GUIDE_BALKAN_BBOX.minLat).toBeLessThanOrEqual(41.3); // Tirana
    expect(MAP_GUIDE_BALKAN_BBOX.maxLat).toBeGreaterThanOrEqual(46.7); // Goričko
    expect(MAP_GUIDE_BALKAN_BBOX.minLng).toBeLessThanOrEqual(13.4); // Soča
    expect(MAP_GUIDE_BALKAN_BBOX.maxLng).toBeGreaterThanOrEqual(21.5); // Skopje
  });
});
