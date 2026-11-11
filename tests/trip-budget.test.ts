import { describe, expect, test } from 'bun:test';

import {
  allocateNights,
  buildTripBudget,
  formatEur,
  nightsNoun,
  personsNoun,
  unpricedNote,
} from '@/lib/trip-budget';

const STAYS = [
  { name: 'Hotel Bled', city: 'Bled', priceFrom: 90 },
  { name: 'Penzion Soča', city: 'Bovec', priceFrom: 60 },
  { name: 'Hostel Piran', city: 'Piran', priceFrom: 30 },
];

describe('trip-budget — razporeditev noči', () => {
  test('enakomerno: 3 noči / 3 prenočišča → 1+1+1', () => {
    expect(allocateNights(3, 3)).toEqual([1, 1, 1]);
  });

  test('ostanek gre prvima: 5 noči / 3 prenočišča → 2+2+1', () => {
    expect(allocateNights(5, 3)).toEqual([2, 2, 1]);
  });

  test('manj noči kot prenočišč → zadnje dobi 0', () => {
    expect(allocateNights(2, 3)).toEqual([1, 1, 0]);
  });

  test('robovi: 0 prenočišč → prazno; negativne noči → ničle', () => {
    expect(allocateNights(4, 0)).toEqual([]);
    expect(allocateNights(-2, 2)).toEqual([0, 0]);
  });
});

describe('trip-budget — izračun', () => {
  test('3 dni, 3 prenočišča, 2 osebi → total in delitev', () => {
    const b = buildTripBudget(STAYS, 3, 2);
    expect(b.nights).toBe(3);
    expect(b.items.map((i) => i.subtotalEur)).toEqual([90, 60, 30]);
    expect(b.totalEur).toBe(180);
    expect(b.perPersonEur).toBe(90);
    expect(b.unpricedCount).toBe(0);
  });

  test('5 noči: ostanek gre prvemu (2×90 + 2×60 + 1×30 = 330)', () => {
    const b = buildTripBudget(STAYS, 5, 3);
    expect(b.items.map((i) => i.nights)).toEqual([2, 2, 1]);
    expect(b.totalEur).toBe(330);
    expect(b.perPersonEur).toBe(110);
  });

  test('nights null → privzeto 1 noč na prenočišče', () => {
    const b = buildTripBudget(STAYS, null, 1);
    expect(b.nights).toBe(3);
    expect(b.totalEur).toBe(180);
  });

  test('prenočišče brez cene NI všteto, a je prišteto posebej', () => {
    const b = buildTripBudget(
      [STAYS[0], { name: 'Kmetija X', city: 'Bohinj', priceFrom: null }],
      2,
      2,
    );
    expect(b.totalEur).toBe(90); // samo hotel (1×90)
    expect(b.unpricedCount).toBe(1);
    expect(b.items[1].subtotalEur).toBeNull();
  });

  test('vse brez cen → totalEur null (pošteno: ocene ni)', () => {
    const b = buildTripBudget(
      [
        { name: 'A', city: 'a', priceFrom: null },
        { name: 'B', city: 'b', priceFrom: null },
      ],
      2,
      2,
    );
    expect(b.totalEur).toBeNull();
    expect(b.perPersonEur).toBeNull();
    expect(b.unpricedCount).toBe(2);
  });

  test('meje: persons 0→1, 99→8; nights 0→1, 999→60', () => {
    expect(buildTripBudget(STAYS, 3, 0).persons).toBe(1);
    expect(buildTripBudget(STAYS, 3, 99).persons).toBe(8);
    expect(buildTripBudget(STAYS, 0, 2).nights).toBe(1);
    expect(buildTripBudget(STAYS, 999, 2).nights).toBe(60);
  });

  test('prazen seznam → prazen proračun', () => {
    const b = buildTripBudget([], 5, 2);
    expect(b.items).toEqual([]);
    expect(b.totalEur).toBeNull();
    expect(b.nights).toBe(0);
  });
});

describe('trip-budget — slovenski zapisi', () => {
  test('oseba/osebi/osebe/oseb', () => {
    expect(personsNoun(1)).toBe('oseba');
    expect(personsNoun(2)).toBe('osebi');
    expect(personsNoun(3)).toBe('osebe');
    expect(personsNoun(4)).toBe('osebe');
    expect(personsNoun(5)).toBe('oseb');
  });

  test('noč/noči', () => {
    expect(nightsNoun(1)).toBe('noč');
    expect(nightsNoun(2)).toBe('noči');
    expect(nightsNoun(7)).toBe('noči');
  });

  test('opomba za cene — z dvojino', () => {
    expect(unpricedNote(1)).toBe('1 prenočišče brez cene ni všteto v oceno.');
    expect(unpricedNote(2)).toBe('2 prenočišči brez cene nista všteti v oceno.');
    expect(unpricedNote(3)).toBe('3 prenočišča brez cene niso všteta v oceno.');
    expect(unpricedNote(6)).toBe('6 prenočišč brez cene ni vštetih v oceno.');
  });

  test('formatEur: celi evri', () => {
    expect(formatEur(180)).toBe('180 €');
    expect(formatEur(90.4)).toBe('90 €');
  });
});
