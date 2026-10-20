/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import { buildAccountExport } from '../src/lib/account-export';

const user = {
  id: 'usr_1',
  email: 'ana@example.com',
  name: 'Ana',
  createdAt: new Date('2026-10-01T08:00:00.000Z'),
};

describe('account-export — prenos lastnih podatkov', () => {
  test('izvozi uporabnika, sanitiziran vodič in rezervacije', () => {
    const payload = buildAccountExport({
      user,
      profile: {
        guideData: {
          version: 1,
          interests: ['narava', 'neznano'],
          region: 'gorenjska',
          days: 3,
          pace: 'zmeren',
          answered: ['interests', 'region', 'neveljaven'],
          stays: [],
          voiceEnabled: true,
          completedAt: null,
          updatedAt: '2026-10-02T09:00:00.000Z',
        },
        updatedAt: new Date('2026-10-02T09:00:00.000Z'),
      },
      reservations: [
        {
          stayId: 'n123',
          name: 'Hiša ob jezeru',
          city: 'Bled',
          lat: 46.36,
          lng: 14.09,
          priceFrom: 120,
          createdAt: new Date('2026-10-03T10:00:00.000Z'),
        },
      ],
      exportedAt: new Date('2026-10-20T12:00:00.000Z'),
    });

    expect(payload.format).toBe('discover-slovenia-account-export');
    expect(payload.version).toBe(1);
    expect(payload.exportedAt).toBe('2026-10-20T12:00:00.000Z');
    expect(payload.user).toEqual({
      id: 'usr_1',
      email: 'ana@example.com',
      name: 'Ana',
      createdAt: '2026-10-01T08:00:00.000Z',
    });
    expect(payload.profile?.updatedAt).toBe('2026-10-02T09:00:00.000Z');
    expect(payload.profile?.state?.interests).toEqual(['narava']);
    expect(payload.profile?.state?.answered).toEqual(['interests', 'region']);
    expect(payload.reservations).toEqual([
      {
        stayId: 'n123',
        name: 'Hiša ob jezeru',
        city: 'Bled',
        lat: 46.36,
        lng: 14.09,
        priceFrom: 120,
        createdAt: '2026-10-03T10:00:00.000Z',
      },
    ]);
  });

  test('brez profila vrne null in ne izmišljenega stanja', () => {
    const payload = buildAccountExport({
      user,
      profile: null,
      reservations: [],
      exportedAt: new Date('2026-10-20T12:00:00.000Z'),
    });

    expect(payload.profile).toBeNull();
    expect(payload.reservations).toEqual([]);
  });

  test('neveljaven vodič se ne izvozi kot surov JSON', () => {
    const payload = buildAccountExport({
      user,
      profile: {
        guideData: { version: 99, interests: ['narava'] },
        updatedAt: new Date('2026-10-02T09:00:00.000Z'),
      },
      reservations: [],
      exportedAt: new Date('2026-10-20T12:00:00.000Z'),
    });

    expect(payload.profile?.state).toBeNull();
  });
});
