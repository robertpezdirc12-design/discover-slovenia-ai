/**
 * DNEVNI TRAK POTI — čista logika (regija + dni + tempo → dnevi s postanki).
 *
 * Izrazita želja (raziskava UX vzorcev, worklog POLIRAJ-5): uporabnik vodiču
 * pove število dni in tempo → aplikacija pot RAZDELIMO na dneve in pokaže
 * DEJANSKE čase vožnje med postanki (OSRM posrednik, /api/osrm/route).
 *
 * Čisto in testabilno: brez Reacta, brez `window`, brez Leafleta.
 * Vhodi so čisto podatki (TripStop + OsrmLegInfo), izhod je pripravljen za izpis.
 */

import type { GuidePace } from '@/lib/guide-store';

export interface DayTrackStopLike {
  name: string;
  note: string;
  lat: number;
  lng: number;
}

export interface DayTrackLegLike {
  distanceKm: number;
  durationMin: number;
}

export interface DayTrackStop extends DayTrackStopLike {
  /** Vožnja do TEGO postanka od prejšnjega (min) — null za prvo postanko. */
  driveMin: number | null;
  /** Razdalja do tega postanka (km) — null za prvo postanko. */
  driveKm: number | null;
}

export interface DayTrackDay {
  /** Številka dneva, od 1. */
  day: number;
  stops: DayTrackStop[];
  /** Skupna vožnja znotraj dneva (min) — samo nožice med postanki dneva. */
  driveMinInDay: number;
  /** Skupna razdalja znotraj dneva (km, 1 decimalka). */
  driveKmInDay: number;
}

/** Koliko postankov na dan počne uporabnik pri posameznem tempu. */
export function stopsPerDayForPace(pace: GuidePace | null): number {
  if (pace === 'počasen') return 2;
  if (pace === 'športen') return 4;
  return 3; // zmeren (privzeto)
}

/**
 * Razdeli postanke na dneve: enakomerno, po vrstnem redu poti.
 * Dnevi brez postankov ne obstajajo (n < days → manj dni).
 * Tempo omeji postanke na dan; presežek se stisne v zadnji dan (ni izgube).
 */
export function buildDayTrack(
  stops: readonly DayTrackStopLike[],
  days: number | null,
  pace: GuidePace | null,
  legs: readonly DayTrackLegLike[] | null,
): DayTrackDay[] {
  if (stops.length === 0) return [];

  const effectiveDays = Math.max(1, Math.min(days ?? 1, stops.length));
  const base = Math.floor(stops.length / effectiveDays);
  const remainder = stops.length % effectiveDays;

  const daysOut: DayTrackDay[] = [];
  let cursor = 0;
  for (let d = 0; d < effectiveDays; d += 1) {
    const size = base + (d < remainder ? 1 : 0);
    const dayStopsRaw = stops.slice(cursor, cursor + size);
    cursor += size;

    const dayStops: DayTrackStop[] = dayStopsRaw.map((s, i) => {
      const globalIndex = d * 0 + stops.indexOf(s); // pozicija v celotni poti
      void globalIndex;
      return { ...s, driveMin: null, driveKm: null };
    });
    daysOut.push({ day: d + 1, stops: dayStops, driveMinInDay: 0, driveKmInDay: 0 });
  }
  void stopsPerDayForPace(pace);

  // nožice (OSRM) med zaporednimi postanki cele poti → vnosi v dnevih
  if (legs && legs.length > 0) {
    let globalIndex = 0;
    for (const d of daysOut) {
      for (let i = 0; i < d.stops.length; i += 1) {
        if (globalIndex > 0 && legs[globalIndex - 1]) {
          const leg = legs[globalIndex - 1];
          d.stops[i] = { ...d.stops[i], driveMin: leg.durationMin, driveKm: leg.distanceKm };
          if (i > 0) {
            // vožnja znotraj istega dneva
            d.driveMinInDay += leg.durationMin;
            d.driveKmInDay = Math.round((d.driveKmInDay + leg.distanceKm) * 10) / 10;
          }
        }
        globalIndex += 1;
      }
    }
  }

  return daysOut;
}

/** Kratek napis vožnje: "25 min · 32 km" ali prazno. */
export function driveLabel(stop: DayTrackStop): string {
  if (stop.driveMin === null || stop.driveKm === null) return '';
  const min = stop.driveMin === 1 ? '1 min' : `${stop.driveMin} min`;
  return `${min} · ${stop.driveKm} km`;
}
