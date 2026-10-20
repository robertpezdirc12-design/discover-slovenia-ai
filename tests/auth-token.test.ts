/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  LOGIN_TOKEN_TTL_MS,
  authBaseUrl,
  displayNameFromEmail,
  generateLoginToken,
  hashLoginToken,
  normalizeEmail,
} from '../src/lib/auth-token';

describe('auth-token — magic link in e-pošta', () => {
  test('normalizira veljaven e-poštni naslov', () => {
    expect(normalizeEmail('  Ana.Kovac@Example.COM ')).toBe('ana.kovac@example.com');
  });

  test('zavrne prazne, predolge in očitno neveljavne naslove', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('ana')).toBeNull();
    expect(normalizeEmail('ana@example')).toBeNull();
    expect(normalizeEmail('ana example@example.com')).toBeNull();
    expect(normalizeEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
    expect(normalizeEmail('ana\u0000@example.com')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  test('iz lokalnega dela e-pošte sestavi varno prikazno ime', () => {
    expect(displayNameFromEmail('ana@example.com')).toBe('ana');
    expect(displayNameFromEmail('@example.com')).toBe('Popotnik');
  });

  test('žeton je naključen, hash pa stabilen in ga ni mogoče obrniti', () => {
    const first = generateLoginToken();
    const second = generateLoginToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(hashLoginToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLoginToken(first)).toBe(hashLoginToken(first));
    expect(hashLoginToken(first)).not.toBe(hashLoginToken(second));
    expect(LOGIN_TOKEN_TTL_MS).toBe(15 * 60 * 1_000);
  });

  test('AUTH_URL prepiše privzeti javni URL za prijavne povezave', () => {
    const previous = process.env.AUTH_URL;
    try {
      process.env.AUTH_URL = 'https://preview.example.com/neki';
      expect(authBaseUrl()).toBe('https://preview.example.com');

      process.env.AUTH_URL = 'http://localhost:3101/kaj';
      expect(authBaseUrl()).toBe('http://localhost:3101');

      process.env.AUTH_URL = 'http://evil.example.com';
      expect(authBaseUrl()).not.toBe('http://evil.example.com');

      process.env.AUTH_URL = 'neveljaven-url';
      expect(authBaseUrl()).not.toBe('neveljaven-url');
    } finally {
      if (previous === undefined) delete process.env.AUTH_URL;
      else process.env.AUTH_URL = previous;
    }
  });
});
