/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  arsoElevationIdentifyUrl,
  createElevationCache,
  formatElevation,
  isInSloveniaBbox,
  parseArsoElevation,
  parseElevationQuery,
} from '../src/lib/arso-lidar';

describe('parseElevationQuery — varnost vhoda API posrednika', () => {
  test('veljavna točka (Bled) → {lat, lon}', () => {
    expect(parseElevationQuery('46.3625', '14.0936')).toEqual({ lat: 46.3625, lon: 14.0936 });
  });

  test('manjkajoči ali nesmiselni vhod → napaka (nikoli crash)', () => {
    expect(parseElevationQuery(null, '14.0')).toHaveProperty('error');
    expect(parseElevationQuery('46.3', null)).toHaveProperty('error');
    expect(parseElevationQuery('abc', '14.0')).toHaveProperty('error');
  });

  test('točka izven Slovenije → zavrnjena (Pariz)', () => {
    const r = parseElevationQuery('48.8566', '2.3522');
    expect('error' in r).toBe(true);
  });
});

describe('isInSloveniaBbox', () => {
  test('Bled, Piran → true · Pariz, NaN → false', () => {
    expect(isInSloveniaBbox(46.3625, 14.0936)).toBe(true);
    expect(isInSloveniaBbox(45.528, 13.568)).toBe(true);
    expect(isInSloveniaBbox(48.8566, 2.3522)).toBe(false);
    expect(isInSloveniaBbox(NaN, 14)).toBe(false);
  });
});

describe('arsoElevationIdentifyUrl — URL točkovnega poizvedovanja', () => {
  test('vsebuje ImageServer/identify, geometry JSON, sr=4326', () => {
    const url = arsoElevationIdentifyUrl(46.3625, 14.0936);
    expect(url.startsWith('https://gis.arso.gov.si/arcgis/rest/services/Slovenija_DMR_D96TM/ImageServer/identify?')).toBe(true);
    expect(url).toContain('geometryType=esriGeometryPoint');
    expect(url).toContain('sr=4326');
    expect(url).toContain('returnGeometry=false');
    expect(url).toContain('f=json');
    // geometry = lon kot x, lat kot y (izmerjena oblika odgovora)
    expect(url).toContain(encodeURIComponent('"x":14.0936'));
    expect(url).toContain(encodeURIComponent('"y":46.3625'));
  });
});

describe('parseArsoElevation — izlušči višino iz identify odgovora', () => {
  test('pravi odgovor (izmerjen): {"value":"475.858"} → 475.858', () => {
    expect(parseArsoElevation({ value: '475.858' })).toBeCloseTo(475.858, 3);
  });

  test('številski value, vejica, brez value, neveljavni vnos', () => {
    expect(parseArsoElevation({ value: 1263.52 })).toBeCloseTo(1263.52, 3);
    expect(parseArsoElevation({ value: '297,742' })).toBeCloseTo(297.742, 3);
    expect(parseArsoElevation({})).toBeNull();
    expect(parseArsoElevation(null)).toBeNull();
    expect(parseArsoElevation('niz')).toBeNull();
    expect(parseArsoElevation({ value: 'ne-število' })).toBeNull();
  });
});

describe('formatElevation — slovensko oblikovanje', () => {
  test('475.858 → "475,9 m" · 297.742 → "297,7 m"', () => {
    expect(formatElevation(475.858)).toBe('475,9 m');
    expect(formatElevation(297.742)).toBe('297,7 m');
  });

  test('morska raven: −0,015 in 0 → "0,0 m" (brez minus ničle)', () => {
    expect(formatElevation(-0.015)).toBe('0,0 m');
    expect(formatElevation(0)).toBe('0,0 m');
  });

  test('ne-število → "— m"', () => {
    expect(formatElevation(NaN)).toBe('— m');
  });
});

describe('createElevationCache — pošten odmik (1 točka v oknu = 1 klic ARSO)', () => {
  function fakeNow() {
    let t = 1_000;
    return { tick: () => (t += 1), now: () => t };
  }

  test('poljub → loader → ponovni klic v TTL uporabi predpomnilnik', async () => {
    const { now } = fakeNow();
    let calls = 0;
    const cache = createElevationCache(10_000, 10, now);
    const loader = async () => {
      calls += 1;
      return 475.9;
    };
    expect(await cache.get('k1', loader)).toBe(475.9);
    expect(await cache.get('k1', loader)).toBe(475.9);
    expect(calls).toBe(1);
  });

  test('TTL preteče → loader se pokliče znova', async () => {
    let t = 1_000;
    let calls = 0;
    const cache = createElevationCache(10_000, 10, () => t);
    const loader = async () => {
      calls += 1;
      return 297.7;
    };
    await cache.get('k', loader);
    t += 10_001;
    await cache.get('k', loader);
    expect(calls).toBe(2);
  });

  test('hkratne identične zahteve → en sam klic (in-flight zlivanje)', async () => {
    let calls = 0;
    const cache = createElevationCache(10_000, 10);
    const slow = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return 2273.7;
    };
    const [a, b, c] = await Promise.all([
      cache.get('triglav', slow),
      cache.get('triglav', slow),
      cache.get('triglav', slow),
    ]);
    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  test('maxEntries → najstarejši vnosi se iztrebljajo', async () => {
    let t = 1_000;
    let calls = 0;
    const cache = createElevationCache(60_000, 2, () => t);
    const loader = async () => {
      calls += 1;
      return calls;
    };
    await cache.get('a', loader);
    await cache.get('b', loader);
    await cache.get('c', loader); // a je zdaj iztrebljen
    await cache.get('a', loader); // a je bil iztrebljen → ponoven klic; vstavljanje a iztisne b
    expect(calls).toBe(4);
    await cache.get('c', loader); // c še vedno predpomnjen
    expect(calls).toBe(4);
  });
});
