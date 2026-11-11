/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  GUIDE_STEPS,
  addSavedPoi,
  clearGuideState,
  emptyGuideState,
  firstUnansweredStep,
  guideSummaryChips,
  isGuideComplete,
  isStepAnswered,
  loadGuideState,
  nextStepSuggestion,
  sanitizeGuideState,
  saveGuideState,
  type GuideState,
  type GuideStorage,
} from '../src/lib/guide-store';
import { arsoLidarTileUrl, tileBbox3857 } from '../src/lib/arso-lidar';

/** Shramba v pomnilniku (deterministična, brez brskalnika). */
function memStorage(seed: Record<string, string> = {}): GuideStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function stateWith(overrides: Partial<GuideState>): GuideState {
  return { ...emptyGuideState(), ...overrides };
}

describe('guide-store — trajanje odgovorov (Komoot onboarding)', () => {
  test('prazen zapis → loadGuideState vrne null', () => {
    expect(loadGuideState(memStorage())).toBeNull();
  });

  test('odgovor se shrani in ohrani med naložbami (zapomni si ga)', () => {
    const s = memStorage();
    saveGuideState(s, stateWith({ region: 'gorenjska', answered: ['region'] }));
    const loaded = loadGuideState(s);
    expect(loaded?.region).toBe('gorenjska');
    expect(loaded?.answered).toContain('region');
  });

  test('pokvarjen JSON → fail-clean (null, ne napaka)', () => {
    expect(loadGuideState(memStorage({ 'dsa.guide.v1': '{neveljaven' }))).toBeNull();
  });

  test('neznana verzija → zavrnjena (fail-clean)', () => {
    expect(loadGuideState(memStorage({ 'dsa.guide.v1': JSON.stringify({ version: 99 }) }))).toBeNull();
  });

  test('neznani interesi/regioni so odstranjeni (sanitizacija)', () => {
    const raw = JSON.stringify({ version: 1, interests: ['narava', 'orbita'], region: 'atlantida', answered: ['huh'] });
    const loaded = loadGuideState(memStorage({ 'dsa.guide.v1': raw }));
    expect(loaded?.interests).toEqual(['narava']);
    expect(loaded?.region).toBeNull();
    expect(loaded?.answered).toEqual([]);
  });

  test('isStepAnswered zahteva tako potrditev kot vsebino', () => {
    expect(isStepAnswered(stateWith({ answered: ['region'], region: null }), 'region')).toBe(false);
    expect(isStepAnswered(stateWith({ answered: ['region'], region: 'gorenjska' }), 'region')).toBe(true);
    expect(isStepAnswered(stateWith({ answered: [] }), 'region')).toBe(false);
    expect(isStepAnswered(stateWith({ answered: ['days'], days: 3 }), 'days')).toBe(true);
    expect(isStepAnswered(stateWith({ answered: ['days'], days: 0 }), 'days')).toBe(false);
  });

  test('firstUnansweredStep — tok nadaljuje na prvem praznem koraku', () => {
    expect(firstUnansweredStep(emptyGuideState())).toBe('region');
    expect(firstUnansweredStep(stateWith({ region: 'gorenjska', answered: ['region'] }))).toBe('days');
    expect(
      firstUnansweredStep(stateWith({ region: 'gorenjska', days: 2, answered: ['region', 'days'] })),
    ).toBe('pace');
  });

  test('popoln tok → firstUnansweredStep null + isGuideComplete true', () => {
    const full = stateWith({
      region: 'gorenjska',
      days: 2,
      pace: 'zmeren',
      answered: ['region', 'days', 'pace'],
    });
    expect(isGuideComplete(full)).toBe(true);
    expect(firstUnansweredStep(full)).toBeNull();
  });

  test('clearGuideState pobriše spomin (»začni znova«)', () => {
    const s = memStorage();
    saveGuideState(s, stateWith({ region: 'gorenjska', answered: ['region'] }));
    clearGuideState(s);
    expect(loadGuideState(s)).toBeNull();
  });
});

describe('nextStepSuggestion — izrečen naslednji korak (vodenje)', () => {
  test('začetek: povabi k izbiri regije', () => {
    const s = nextStepSuggestion(emptyGuideState());
    expect(s.nextStep).toBe('region');
    expect(s.text).toContain('regija');
  });

  test('po regiji: pove, da je shranjena, in vpraša po dnevih', () => {
    const s = nextStepSuggestion(stateWith({ region: 'gorenjska', answered: ['region'] }));
    expect(s.nextStep).toBe('days');
    expect(s.text).toContain('dni');
  });

  test('KONČNI NASVET (izrazita želja): »Želiš še eno destinacijo, ali zaključiš?«', () => {
    const full = stateWith({
      region: 'gorenjska',
      days: 2,
      pace: 'zmeren',
      answered: ['region', 'days', 'pace'],
    });
    const sl = nextStepSuggestion(full);
    expect(sl.nextStep).toBe('done');
    expect(sl.text).toContain('še eno destinacijo');
    expect(sl.text).toContain('zaključiš');
    const en = nextStepSuggestion(full, 'en');
    expect(en.text).toContain('another destination');
  });

  test('determinizem: isti vhod → isti izhod', () => {
    const st = stateWith({ region: 'gorenjska', answered: ['region'] });
    expect(nextStepSuggestion(st)).toEqual(nextStepSuggestion(st));
  });

  test('vsi koraki so pokriti v vrstnem redu', () => {
    expect(GUIDE_STEPS).toEqual(['region', 'days', 'pace']);
  });
});

describe('guideSummaryChips — povzetek za "Nadaljuj, kjer sem ostal"', () => {
  test('prazno stanje → brez čipov', () => {
    expect(guideSummaryChips(emptyGuideState())).toEqual([]);
  });

  test('polno stanje → interesi, regija, dni, tempo', () => {
    const chips = guideSummaryChips(
      stateWith({ interests: ['narava', 'vino'], region: 'primorska', days: 3, pace: 'počasen' }),
    );
    expect(chips).toEqual(['narava, vino', 'Primorska (Soča, Piran)', '3 dni', 'tempo: počasen']);
  });
});

describe('arso-lidar — čista geometrija ploščic', () => {
  test('tile (0,0,z=1) → standardni Web Mercator kvadrant', () => {
    const b = tileBbox3857(0, 0, 1);
    expect(b.xmin).toBeCloseTo(-20037508.34, -2);
    expect(b.xmax).toBeCloseTo(0, -2);
    expect(b.ymax).toBeCloseTo(20037508.34, -2);
    expect(b.ymin).toBeCloseTo(0, -2);
  });

  test('sosednje ploščice se stikajo (brez vrzeli pri z=3)', () => {
    const a = tileBbox3857(4, 3, 3);
    const b = tileBbox3857(5, 3, 3);
    expect(a.xmax).toBeCloseTo(b.xmin, -1);
  });

  test('URL izvoza vsebuje bbox, 3857 in format png', () => {
    const url = arsoLidarTileUrl(1, 1, 2);
    expect(url.startsWith('https://gis.arso.gov.si/arcgis/rest/services/Lidar_hillshade_D96TM/MapServer/export?')).toBe(true);
    expect(url).toContain('bboxSR=3857');
    expect(url).toContain('imageSR=3857');
    expect(url).toContain('size=256%2C256');
    expect(url).toContain('format=png');
  });
});

describe('guide-store — extraRegions (večdržavna pot)', () => {
  test('emptyGuideState ima prazno polje extraRegions', () => {
    expect(emptyGuideState().extraRegions).toEqual([]);
  });

  test('sanitize: ohrani veljavne, izloči neznane/podvojene in glavno regijo', () => {
    const raw = {
      version: 1,
      interests: [],
      region: 'srbija',
      extraRegions: ['hrvaska', 'neznana', 'srbija', 'hrvaska', 'albanija'],
      days: null,
      pace: null,
      answered: ['region'],
      stays: [],
      voiceEnabled: false,
      completedAt: null,
      updatedAt: '',
    };
    const s = sanitizeGuideState(raw);
    expect(s?.extraRegions).toEqual(['hrvaska', 'albanija']);
  });

  test('sanitize: odsotnost polja (stari zapisi) → []', () => {
    const old = {
      version: 1,
      interests: [],
      region: 'gorenjska',
      days: 2,
      pace: null,
      answered: ['region', 'days'],
      stays: [],
      voiceEnabled: false,
      completedAt: null,
      updatedAt: '',
    };
    expect(sanitizeGuideState(old)?.extraRegions).toEqual([]);
  });

  test('sanitize: omejitev na 6 dodatnih regij', () => {
    const all = ['hrvaska', 'bosna-hercegovina', 'srbija', 'kosovo', 'crna-gora', 'albanija', 'severna-makedonija'];
    const raw = {
      version: 1,
      interests: [],
      region: 'gorenjska',
      extraRegions: all,
      days: null,
      pace: null,
      answered: ['region'],
      stays: [],
      voiceEnabled: false,
      completedAt: null,
      updatedAt: '',
    };
    expect(sanitizeGuideState(raw)?.extraRegions.length).toBe(6);
  });
});

describe('guide-store — savedPois (»Dodaj v pot«)', () => {
  test('addSavedPoi: doda, idempotentno po id', () => {
    const poi = { id: 'poi-x', name: 'Blejski grad', note: '', lat: 46.3697, lng: 14.1067, category: 'kultura', source: 'izbor' };
    const a = addSavedPoi(emptyGuideState(), poi);
    expect(a.savedPois).toHaveLength(1);
    expect(addSavedPoi(a, poi)).toBe(a);
  });

  test('sanitize: ohrani veljavne, zavrže slabe', () => {
    const raw = {
      version: 1, interests: [], region: 'gorenjska', extraRegions: [],
      days: null, pace: null, answered: [], stays: [],
      savedPois: [
        { id: 'a', name: 'Vintgar', lat: 46.3903, lng: 14.0853, category: 'narava', source: 'osm' },
        { id: 'b', name: '', lat: 46, lng: 14, category: null, source: null },
        { id: 'c', name: 'Slab', lat: 999, lng: 0 },
      ],
      voiceEnabled: false, completedAt: null, updatedAt: '',
    };
    const s = sanitizeGuideState(raw);
    expect(s?.savedPois).toHaveLength(1);
    expect(s?.savedPois[0].name).toBe('Vintgar');
  });
});
