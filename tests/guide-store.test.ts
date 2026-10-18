/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  GUIDE_STEPS,
  clearGuideState,
  emptyGuideState,
  firstUnansweredStep,
  guideSummaryChips,
  isGuideComplete,
  isStepAnswered,
  loadGuideState,
  nextStepSuggestion,
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
    saveGuideState(s, stateWith({ interests: ['narava', 'hrana'], answered: ['interests'] }));
    const loaded = loadGuideState(s);
    expect(loaded?.interests).toEqual(['narava', 'hrana']);
    expect(loaded?.answered).toContain('interests');
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
    expect(isStepAnswered(stateWith({ answered: ['interests'], interests: [] }), 'interests')).toBe(false);
    expect(isStepAnswered(stateWith({ answered: ['interests'], interests: ['narava'] }), 'interests')).toBe(true);
    expect(isStepAnswered(stateWith({ interests: ['narava'], answered: [] }), 'interests')).toBe(false);
    expect(isStepAnswered(stateWith({ answered: ['days'], days: 3 }), 'days')).toBe(true);
    expect(isStepAnswered(stateWith({ answered: ['days'], days: 0 }), 'days')).toBe(false);
  });

  test('firstUnansweredStep — tok nadaljuje na prvem praznem koraku', () => {
    expect(firstUnansweredStep(emptyGuideState())).toBe('interests');
    expect(
      firstUnansweredStep(stateWith({ interests: ['narava'], answered: ['interests'] })),
    ).toBe('region');
    expect(
      firstUnansweredStep(
        stateWith({ interests: ['narava'], answered: ['interests'], region: 'gorenjska' }),
      ),
    ).toBe('region');
    expect(
      firstUnansweredStep(
        stateWith({ interests: ['narava'], answered: ['interests', 'region'], region: 'gorenjska' }),
      ),
    ).toBe('days');
  });

  test('popoln tok → firstUnansweredStep null + isGuideComplete true', () => {
    const full = stateWith({
      interests: ['narava'],
      region: 'gorenjska',
      days: 2,
      pace: 'zmeren',
      answered: ['interests', 'region', 'days', 'pace'],
    });
    expect(isGuideComplete(full)).toBe(true);
    expect(firstUnansweredStep(full)).toBeNull();
  });

  test('clearGuideState pobriše spomin (»začni znova«)', () => {
    const s = memStorage();
    saveGuideState(s, stateWith({ interests: ['narava'], answered: ['interests'] }));
    clearGuideState(s);
    expect(loadGuideState(s)).toBeNull();
  });
});

describe('nextStepSuggestion — izrečen naslednji korak (vodenje)', () => {
  test('začetek: povabi k interesom', () => {
    const s = nextStepSuggestion(emptyGuideState());
    expect(s.nextStep).toBe('interests');
    expect(s.text).toContain('interes');
  });

  test('po interesih: pove, koliko jih je shranjeno, in vpraša po regiji', () => {
    const s = nextStepSuggestion(stateWith({ interests: ['narava', 'hrana'], answered: ['interests'] }));
    expect(s.nextStep).toBe('region');
    expect(s.text).toContain('2');
  });

  test('KONČNI NASVET (izrazita želja): »Želiš še eno destinacijo, ali zaključiš?«', () => {
    const full = stateWith({
      interests: ['narava'],
      region: 'gorenjska',
      days: 2,
      pace: 'zmeren',
      answered: ['interests', 'region', 'days', 'pace'],
    });
    const sl = nextStepSuggestion(full);
    expect(sl.nextStep).toBe('done');
    expect(sl.text).toContain('še eno destinacijo');
    expect(sl.text).toContain('zaključiš');
    const en = nextStepSuggestion(full, 'en');
    expect(en.text).toContain('another destination');
  });

  test('determinizem: isti vhod → isti izhod', () => {
    const st = stateWith({ interests: ['narava'], answered: ['interests'] });
    expect(nextStepSuggestion(st)).toEqual(nextStepSuggestion(st));
  });

  test('vsi koraki so pokriti v vrstnem redu', () => {
    expect(GUIDE_STEPS).toEqual(['interests', 'region', 'days', 'pace']);
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
