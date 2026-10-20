import { describe, expect, test } from 'bun:test';
import { emptyGuideState, type GuideState } from '../src/lib/guide-store';
import { buildPersonalSuggestions } from '../src/lib/personalization';

function guide(patch: Partial<GuideState>): GuideState {
  return {
    ...emptyGuideState(),
    ...patch,
    updatedAt: '2026-10-20T10:00:00.000Z',
  };
}

describe('buildPersonalSuggestions — poštena personalizacija', () => {
  test('brez interesov in regije ne vrne ničesar', () => {
    expect(buildPersonalSuggestions({ guide: null })).toEqual([]);
    expect(buildPersonalSuggestions({ guide: emptyGuideState() })).toEqual([]);
  });

  test('vino + Štajerska → vinska doživetja z razlago in odstotkom', () => {
    const out = buildPersonalSuggestions({
      guide: guide({ interests: ['vino'], region: 'stajerska', pace: 'počasen' }),
      limit: 3,
    });

    expect(out.length).toBeGreaterThan(0);
    expect(out.some((s) => s.name === 'Ptuj' || s.name === 'Jeruzalem')).toBe(true);
    for (const s of out) {
      expect(s.match).toBeGreaterThan(0);
      expect(s.match).toBeLessThanOrEqual(100);
    }
    expect(out[0].reasons).toContain('V tvoji regiji');
    expect(out[0].reasons.some((r) => r.startsWith('Interesi:'))).toBe(true);
  });

  test('regija dvigne oceno v primerjavi z enakim interesom drugje', () => {
    const doma = buildPersonalSuggestions({
      guide: guide({ interests: ['vino'], region: 'stajerska', pace: 'počasen' }),
      limit: 6,
    }).find((s) => s.name === 'Jeruzalem');
    const drugje = buildPersonalSuggestions({
      guide: guide({ interests: ['vino'], region: 'primorska', pace: 'počasen' }),
      limit: 6,
    }).find((s) => s.name === 'Jeruzalem');

    expect(doma?.match).toBeGreaterThan(drugje?.match ?? 0);
  });

  test('že rezervirana imena izloči', () => {
    const out = buildPersonalSuggestions({
      guide: guide({ interests: ['vino'], region: 'stajerska' }),
      reservedNames: ['Ptuj', 'Jeruzalem'],
      limit: 6,
    });
    expect(out.some((s) => s.name === 'Ptuj' || s.name === 'Jeruzalem')).toBe(false);
  });

  test('omejitev in deterministični vrstni red', () => {
    const input = {
      guide: guide({ interests: ['narava', 'pohodništvo'] as GuideState['interests'], region: 'gorenjska' as const }),
      limit: 2,
    };
    const a = buildPersonalSuggestions(input);
    const b = buildPersonalSuggestions(input);
    expect(a).toHaveLength(2);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });

  test('neveljavna omejitev se varno postavi na 3', () => {
    const out = buildPersonalSuggestions({
      guide: guide({ interests: ['narava'], region: 'gorenjska' }),
      limit: Number.NaN,
    });
    expect(out).toHaveLength(3);
  });
});
