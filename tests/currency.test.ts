/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  CURRENCY_LABELS,
  REGION_CURRENCY,
  convertFromEur,
  formatMoney,
  isNonEuro,
  localCurrencyNote,
} from '../src/lib/currency';
import { GUIDE_REGIONS } from '../src/lib/guide-store';

const RATES = { EUR: 1, RSD: 117.6, BAM: 1.9558, ALL: 90.9, MKD: 61.5 };

describe('currency — preslikava regij v valute', () => {
  test('vsaka regija ima valuto; EUR regije so označene kot EUR', () => {
    for (const region of GUIDE_REGIONS) {
      expect(typeof REGION_CURRENCY[region.id]).toBe('string');
    }
    expect(REGION_CURRENCY.srbija).toBe('RSD');
    expect(REGION_CURRENCY['bosna-hercegovina']).toBe('BAM');
    expect(REGION_CURRENCY.albanija).toBe('ALL');
    expect(REGION_CURRENCY['severna-makedonija']).toBe('MKD');
    expect(REGION_CURRENCY.hrvaska).toBe('EUR');
    expect(REGION_CURRENCY.kosovo).toBe('EUR');
    expect(REGION_CURRENCY['crna-gora']).toBe('EUR');
  });

  test('isNonEuro', () => {
    expect(isNonEuro('EUR')).toBe(false);
    expect(isNonEuro('RSD')).toBe(true);
  });
});

describe('currency — pretvorba in oblikovanje', () => {
  test('convertFromEur ob danih tečajih', () => {
    expect(convertFromEur(100, 'RSD', RATES)).toBeCloseTo(11760, 0);
    expect(convertFromEur(50, 'BAM', RATES)).toBeCloseTo(97.79, 1);
    expect(convertFromEur(0, 'ALL', RATES)).toBe(0);
    expect(convertFromEur(20, 'MKD', RATES)).toBeCloseTo(1230, 0);
  });

  test('manjkajoči/neveljavni tečaj → null; negativni znesek → null', () => {
    expect(convertFromEur(10, 'XYZ', RATES)).toBeNull();
    expect(convertFromEur(10, 'RSD', {})).toBeNull();
    expect(convertFromEur(-5, 'RSD', RATES)).toBeNull();
  });

  test('formatMoney: oblika vsebuje valuto, številke', () => {
    expect(formatMoney(11760, 'RSD')).toContain('11.760');
    expect(formatMoney(97.79, 'BAM')).toMatch(/97|98/);
    expect(formatMoney(Number.NaN, 'EUR')).toBe('');
  });

  test('CURRENCY_LABELS: vse registrirane valute imajo oznako', () => {
    for (const currency of new Set(Object.values(REGION_CURRENCY))) {
      expect(typeof CURRENCY_LABELS[currency]).toBe('string');
    }
  });
});

describe('currency — opomba za UI', () => {
  test('non-EUR regija z zneskom in tečaji → opomba', () => {
    const note = localCurrencyNote('srbija', 100, RATES);
    expect(note).not.toBeNull();
    expect(note).toContain('RSD');
    expect(note).toContain('11.760');
  });

  test('EUR regija ali pomanjkljivi vnosi → null', () => {
    expect(localCurrencyNote('gorenjska', 100, RATES)).toBeNull();
    expect(localCurrencyNote('srbija', null, RATES)).toBeNull();
    expect(localCurrencyNote('srbija', 100, null)).toBeNull();
    expect(localCurrencyNote(null, 100, RATES)).toBeNull();
    expect(localCurrencyNote('srbija', 100, {})).toBeNull();
  });
});
