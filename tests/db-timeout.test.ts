import { describe, expect, test } from 'bun:test';
import { DbTimeoutError, withDbTimeout } from '../src/lib/db-timeout';

describe('withDbTimeout — hitra napaka ob nedosegljivi bazi', () => {
  test('vrne rezultat, če je ta pravočasen', async () => {
    await expect(withDbTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  test('zavrne z DbTimeoutError po preteku', async () => {
    const never = new Promise<string>(() => {});
    await expect(withDbTimeout(never, 10)).rejects.toBeInstanceOf(DbTimeoutError);
  });

  test('počisti timer in ne vpliva na druge klice', async () => {
    await expect(withDbTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
    await expect(withDbTimeout(Promise.resolve(2), 50)).resolves.toBe(2);
  });
});
