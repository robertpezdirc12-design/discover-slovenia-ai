/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  arsoElevationIdentifyUrl,
  createElevationCache,
  decodeTerrariumElevation,
  formatElevation,
  isInSloveniaBbox,
  latLonToTile,
  openMeteoElevationUrl,
  parseArsoElevation,
  parseElevationQuery,
  parseOpenMeteoElevation,
  terrariumTileUrl,
} from '../src/lib/arso-lidar';

describe('parseElevationQuery — varnost vhoda API posrednika', () => {
  test('veljavna točka (Bled) → {lat, lon}', () => {
    expect(parseElevationQuery('46.3625', '14.0936')).toEqual({ lat: 46.3625, lon: 14.0936 });
  });

  test('pokritost celega sveta: Zagreb in Pariz sta veljavna (vir se izbere samodejno)', () => {
    expect(parseElevationQuery('45.815', '15.982')).toEqual({ lat: 45.815, lon: 15.982 });
    expect(parseElevationQuery('48.8566', '2.3522')).toEqual({ lat: 48.8566, lon: 2.3522 });
  });

  test('manjkajoči ali nesmiselni vhod → napaka (nikoli crash)', () => {
    expect(parseElevationQuery(null, '14.0')).toHaveProperty('error');
    expect(parseElevationQuery('46.3', null)).toHaveProperty('error');
    expect(parseElevationQuery('abc', '14.0')).toHaveProperty('error');
    expect(parseElevationQuery('999', '14.0')).toHaveProperty('error'); // |lat| > 85
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

  test('NoData (izmerjeno za Zagreb) → null (sproži padec na Copernicus)', () => {
    expect(parseArsoElevation({ value: 'NoData' })).toBeNull();
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

describe('Copernicus prek Open-Meteo — globalni vir (Balkan)', () => {
  test('URL vsebuje zaokroženi lat/lon', () => {
    expect(openMeteoElevationUrl(45.815012, 15.981999)).toBe(
      'https://api.open-meteo.com/v1/elevation?latitude=45.81501&longitude=15.98200',
    );
  });

  test('pravi odgovor (izmerjen): {"elevation":[142.0]} → 142', () => {
    expect(parseOpenMeteoElevation({ elevation: [142.0] })).toBe(142);
  });

  test('prazen seznam, niz, null → null', () => {
    expect(parseOpenMeteoElevation({ elevation: [] })).toBeNull();
    expect(parseOpenMeteoElevation({ elevation: ['142'] })).toBeNull();
    expect(parseOpenMeteoElevation({})).toBeNull();
    expect(parseOpenMeteoElevation(null)).toBeNull();
  });
});

describe('AWS Terrarium — globalni DEM brez kvote (Balkan, svet)', () => {
  test('latLonToTile: Zagreb z8 = (139, 91) — izmerjeno s python kalkulacijo', () => {
    expect(latLonToTile(45.815, 15.982, 8)).toEqual({ x: 139, y: 91 });
    expect(latLonToTile(46.383, 13.837, 8)).toEqual({ x: 137, y: 90 });
  });

  test('URL ploščice vsebuje z/x/y', () => {
    expect(terrariumTileUrl(45.815, 15.982, 11)).toBe(
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/11/1114/730.png',
    );
  });

  test('dekodiranje piksla: vrednost zapisana v RGB se točno prebere', () => {
    // sintetična 256×256 ploščica (z11), višina 12345.678 na pikslu Zagreba
    const width = 256;
    const height = 256;
    const data = new Uint8ClampedArray(width * height * 4);
    const v = 12345.678 + 32768;
    const r = Math.floor(v / 256);
    const g = Math.floor(v % 256);
    const b = Math.round((v % 1) * 256);
    // LOKALNI piksel znotraj ploščice (globalni − izvor ploščice), kot v lib
    const z = 11;
    const n = 2 ** z;
    const { x, y } = latLonToTile(45.815, 15.982, z);
    const px = Math.floor(((15.982 + 180) / 360) * n * 256) - x * 256;
    const py = Math.floor(((1 - Math.asinh(Math.tan((45.815 * Math.PI) / 180)) / Math.PI) / 2) * n * 256) - y * 256;
    const i = (py * width + px) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    const decoded = decodeTerrariumElevation({ width, height, data }, 45.815, 15.982, z);
    expect(decoded).toBeCloseTo(12345.678, 2);
  });

  test('znana morska raven (0 m) in negativne vrednosti (Mrtvo morje −430 m)', () => {
    const width = 1, height = 1;
    const mk = (elev: number) => {
      const data = new Uint8ClampedArray(4);
      const v = elev + 32768;
      data[0] = Math.floor(v / 256);
      data[1] = Math.floor(v % 256);
      data[2] = Math.round((v % 1) * 256);
      data[3] = 255;
      return data;
    };
    // z0, točka v zgornjem levem vogalu → lokalni piksel (0,0)
    expect(decodeTerrariumElevation({ width, height, data: mk(0) }, 85, -179.9, 0)).toBe(0);
    expect(decodeTerrariumElevation({ width, height, data: mk(-430.25) }, 85, -179.9, 0)).toBeCloseTo(-430.25, 2);
  });

  test('točka izven slike → null (nikoli crash)', () => {
    const data = new Uint8ClampedArray(4 * 4);
    expect(decodeTerrariumElevation({ width: 2, height: 2, data }, 89.9, 179.9, 0)).toBeNull();
    expect(decodeTerrariumElevation({ width: 2, height: 2, data }, NaN, 14, 11)).toBeNull();
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
