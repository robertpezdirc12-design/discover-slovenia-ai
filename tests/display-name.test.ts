import { describe, expect, test } from 'bun:test';
import { normalizeDisplayName } from '../src/lib/display-name';

describe('normalizeDisplayName — varen prikazni ime', () => {
  test('stisne presledke in odstrani krmilne znake', () => {
    expect(normalizeDisplayName('  Ana\n\tNovak  ')).toBe('Ana Novak');
    expect(normalizeDisplayName('Ana\u0000Novak')).toBe('Ana Novak');
    expect(normalizeDisplayName('Ana\u200BNovak')).toBe('Ana Novak');
    expect(normalizeDisplayName('\u202EAna')).toBe('Ana');
  });

  test('prazen ali neveljaven vnos → privzeto ime', () => {
    expect(normalizeDisplayName('')).toBe('Popotnik');
    expect(normalizeDisplayName('   ')).toBe('Popotnik');
    expect(normalizeDisplayName(null)).toBe('Popotnik');
    expect(normalizeDisplayName(42)).toBe('Popotnik');
  });

  test('omeji na 40 kodnih točk in ne razpolovi emojija', () => {
    expect(Array.from(normalizeDisplayName('a'.repeat(100)))).toHaveLength(40);
    expect(normalizeDisplayName('😀'.repeat(50))).toBe('😀'.repeat(40));
  });
});
