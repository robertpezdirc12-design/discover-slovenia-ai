import { describe, expect, test } from 'bun:test';

import { buildDayTrack, driveLabel, stopsPerDayForPace } from '@/lib/day-track';

const STOPS = [
  { name: 'Bled', note: 'Jezerski otok', lat: 46.3625, lng: 14.0936 },
  { name: 'Bohinj', note: 'Pod Triglavom', lat: 46.2714, lng: 13.9526 },
  { name: 'Dolina Soče', note: 'Smaragdna reka', lat: 46.3377, lng: 13.5556 },
  { name: 'Piran', note: 'Soline', lat: 45.528, lng: 13.568 },
];

const LEGS = [
  { distanceKm: 18.7, durationMin: 25 },
  { distanceKm: 65.2, durationMin: 70 },
  { distanceKm: 98.4, durationMin: 95 },
];

describe('day-track — dnevni trak z OSRM časi vožnje', () => {
  test('tempo → postanki na dan', () => {
    expect(stopsPerDayForPace('počasen')).toBe(2);
    expect(stopsPerDayForPace('zmeren')).toBe(3);
    expect(stopsPerDayForPace('športen')).toBe(4);
    expect(stopsPerDayForPace(null)).toBe(3);
  });

  test('2 dni, 4 postanke → enakomerna razdelitev 2+2', () => {
    const days = buildDayTrack(STOPS, 2, 'zmeren', LEGS);
    expect(days).toHaveLength(2);
    expect(days[0].stops.map((s) => s.name)).toEqual(['Bled', 'Bohinj']);
    expect(days[1].stops.map((s) => s.name)).toEqual(['Dolina Soče', 'Piran']);
  });

  test('prva postanka dneva NIMA vožnje (ni predhodnika znotraj dneva)', () => {
    const days = buildDayTrack(STOPS, 2, 'zmeren', LEGS);
    expect(days[0].stops[0].driveMin).toBeNull();
    expect(days[0].stops[1].driveMin).toBe(25);
    // drugi dan: prva postanka ima vožnjo od prejšnjega dneva, a ne šteje v dan
    expect(days[1].stops[0].driveMin).toBe(70);
  });

  test('vožnja znotraj dneva se sešteje SAMO med postanki istega dneva', () => {
    const days = buildDayTrack(STOPS, 2, 'zmeren', LEGS);
    expect(days[0].driveMinInDay).toBe(25);
    expect(days[0].driveKmInDay).toBe(18.7);
    expect(days[1].driveMinInDay).toBe(95); // 70 ne šteje (med dnevi), 95 šteje
    expect(days[1].driveKmInDay).toBe(98.4);
  });

  test('brez OSRM nožic → dnevi obstajajo, vožnje so null', () => {
    const days = buildDayTrack(STOPS, 2, 'zmeren', null);
    expect(days).toHaveLength(2);
    expect(days[0].stops[1].driveMin).toBeNull();
    expect(days[0].driveMinInDay).toBe(0);
  });

  test('dnevi > postanke → vsak postanek svoj dan (ni praznih dni)', () => {
    const days = buildDayTrack(STOPS.slice(0, 2), 5, 'počasen', LEGS);
    expect(days).toHaveLength(2);
    expect(days[0].stops).toHaveLength(1);
    expect(days[1].stops).toHaveLength(1);
  });

  test('prazna pot → prazen trak', () => {
    expect(buildDayTrack([], 2, 'zmeren', null)).toEqual([]);
  });

  test('napis vožnje: "25 min · 18.7 km"', () => {
    expect(driveLabel({ name: 'x', note: '', lat: 0, lng: 0, driveMin: 25, driveKm: 18.7 })).toBe('25 min · 18.7 km');
    expect(driveLabel({ name: 'x', note: '', lat: 0, lng: 0, driveMin: 1, driveKm: 2.3 })).toBe('1 min · 2.3 km');
    expect(driveLabel({ name: 'x', note: '', lat: 0, lng: 0, driveMin: null, driveKm: null })).toBe('');
  });
});
