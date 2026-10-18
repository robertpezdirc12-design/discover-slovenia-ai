import { describe, expect, test } from 'bun:test';

import { GUIDE_REGIONS } from '@/lib/guide-store';
import { isInSloveniaBbox } from '@/lib/arso-lidar';
import { TRIP_PLAN, tripPlanFor } from '@/lib/trip-plan';

/**
 * MOJA POT — vodič obljubi, zemljevid MORA pokazati.
 * Kritična invarianta: vsaka regija vodnega toka ima vsaj eno destinacijo
 * (Koroška je zgodovinsko zamudila seznam — test je to ulovil pred produkcijo).
 */

describe('TRIP_PLAN — vodič in zemljevid sta povezana', () => {
  test('VSAKA regija vodnega toka ima vsaj eno destinacijo', () => {
    for (const region of GUIDE_REGIONS) {
      const plan = TRIP_PLAN[region.id];
      expect(plan.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('vse postanke so znotraj Slovenije (DMR/LiDAR meje)', () => {
    for (const stops of Object.values(TRIP_PLAN)) {
      for (const stop of stops) {
        expect(Number.isFinite(stop.lat)).toBe(true);
        expect(Number.isFinite(stop.lng)).toBe(true);
        expect(isInSloveniaBbox(stop.lat, stop.lng)).toBe(true);
      }
    }
  });

  test('imena destinacij so enolična (ključi označevalcev na karti)', () => {
    const names = Object.values(TRIP_PLAN)
      .flat()
      .map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('vsak postanek ima neprazen opis (pojavno okno zemljevida)', () => {
    for (const stops of Object.values(TRIP_PLAN)) {
      for (const stop of stops) {
        expect(stop.note.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('tripPlanFor — izbrana regija', () => {
  test('Gorenjska: Bled + Bohinj', () => {
    const plan = tripPlanFor('gorenjska');
    expect(plan.map((s) => s.name)).toEqual(['Bled', 'Bohinj']);
  });

  test('Primorska: Soča in Piran (2 postanki)', () => {
    expect(tripPlanFor('primorska').length).toBe(2);
  });

  test('Koroška: ni prazna (vodič ne sme obljubiti prazne poti)', () => {
    expect(tripPlanFor('koroska').length).toBeGreaterThanOrEqual(1);
    expect(tripPlanFor('koroska')[0].name).toBe('Dravograd');
  });
});
