/// <reference types="bun-types" />
import { describe, expect, test } from 'bun:test';
import {
  TRANSIT_DEFAULT_ORIGIN,
  buildTransitUrl,
  formatTransitTime,
  parseTransitResponse,
  transitLegSummary,
  transitPlanDurationMin,
  transitPlanSummary,
} from '../src/lib/public-transport';

/** Miniaturni veljavni odziv (surov, kot ga vrne brezavta API). */
const SAMPLE = {
  plans: [
    {
      start_time: 1793954125000,
      end_time: 1793960208000,
      legs: [
        {
          mode: 'WALK',
          distance: 944.84,
          start_time: 1793954125000,
          end_time: 1793954880000,
          from_point: { lat: 46.0569, lon: 14.5058, name: 'Origin', type: 'ORIGIN' },
          to_point: {
            lat: 46.0602302,
            lon: 14.4977638,
            name: 'Ljubljana Tivoli',
            type: 'INTERMEDIATE',
            gtfs_id: 'IJPP:1165687',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [14.5058, 46.0569],
              [14.50581, 46.05692],
            ],
          },
        },
        {
          mode: 'BUS',
          distance: 12500,
          start_time: 1793954880000,
          end_time: 1793958840000,
          from_point: { lat: 46.0602302, lon: 14.4977638, name: 'Ljubljana Tivoli', type: 'TRANSIT' },
          to_point: { lat: 46.36, lon: 14.09, name: 'Bled', type: 'TRANSIT' },
          geometry: null,
        },
      ],
    },
  ],
  next_page: 'MnxORVhUX1BBR0V8',
};

describe('public-transport — razčlenitev odziva (varstvo vnosa)', () => {
  test('veljaven odziv → plans z legi in geometrijo', () => {
    const parsed = parseTransitResponse(SAMPLE);
    expect(parsed).not.toBeNull();
    expect(parsed!.plans).toHaveLength(1);
    const plan = parsed!.plans[0];
    expect(plan.legs).toHaveLength(2);
    expect(plan.legs[0].mode).toBe('WALK');
    expect(plan.legs[0].distanceM).toBeCloseTo(944.84);
    expect(plan.legs[0].toPoint.gtfsId).toBe('IJPP:1165687');
    expect(plan.legs[0].geometry).toHaveLength(2);
    expect(plan.legs[1].geometry).toBeNull();
    expect(parsed!.nextPage).toBe('MnxORVhUX1BBR0V8');
  });

  test('napačen/prazen odziv → null', () => {
    expect(parseTransitResponse(null)).toBeNull();
    expect(parseTransitResponse({})).toBeNull();
    expect(parseTransitResponse({ plans: [] })).toBeNull();
    expect(parseTransitResponse({ plans: 'x' })).toBeNull();
  });

  test('zavrže leg z neveljavno geometrijo/koordinatami', () => {
    const bad = {
      plans: [
        {
          start_time: 1,
          end_time: 2,
          legs: [
            {
              mode: 'BUS',
              distance: 5,
              start_time: 1,
              end_time: 2,
              from_point: { lat: 999, lon: 14 },
              to_point: { lat: 46, lon: 14 },
              geometry: null,
            },
          ],
        },
      ],
    };
    const parsed = parseTransitResponse(bad);
    expect(parsed).toBeNull(); // noben leg ni veljaven
  });

  test('omeji število plans/legs (varstvo pred zlorabo)', () => {
    const huge = {
      plans: Array.from({ length: 30 }, (_, i) => ({
        start_time: i,
        end_time: i + 1,
        legs: Array.from({ length: 50 }, () => ({
          mode: 'WALK',
          distance: 1,
          start_time: i,
          end_time: i + 1,
          from_point: { lat: 46, lon: 14, name: 'a' },
          to_point: { lat: 46.01, lon: 14.01, name: 'b' },
          geometry: null,
        })),
      })),
    };
    const parsed = parseTransitResponse(huge)!;
    expect(parsed.plans.length).toBeLessThanOrEqual(10);
    expect(parsed.plans[0].legs.length).toBeLessThanOrEqual(30);
  });
});

describe('public-transport — pripomočki', () => {
  test('buildTransitUrl sestavi pravilen URL (lon,lat)', () => {
    const url = buildTransitUrl('https://api.example', 'BUS', TRANSIT_DEFAULT_ORIGIN, {
      lat: 46.36,
      lng: 14.09,
    });
    expect(url).toBe('https://api.example/plan/BUS/14.505800,46.056900/14.090000,46.360000');
  });

  test('transitLegSummary: WALK v km, prevoz v minutah', () => {
    const walk = { mode: 'WALK', distanceM: 944.84, startTime: 0, endTime: 10 * 60000 } as const;
    const bus = { mode: 'BUS', distanceM: 12500, startTime: 0, endTime: 24 * 60000 } as const;
    expect(transitLegSummary(walk as never)).toBe('Pohod 0,9 km');
    expect(transitLegSummary(bus as never)).toBe('Bus 24 min');
  });

  test('transitPlanSummary: čas, trajanje, način in relacija', () => {
    const plan = parseTransitResponse(SAMPLE)!.plans[0];
    const summary = transitPlanSummary(plan);
    expect(summary).toContain('od ');
    expect(summary).toContain('h');
    expect(summary).toContain('Bus');
    expect(summary).toContain('Origin → Bled');
    expect(transitPlanDurationMin(plan)).toBeGreaterThan(0);
  });

  test('formatTransitTime: veljaven datum → hh:mm', () => {
    const out = formatTransitTime(Date.UTC(2026, 10, 6, 7, 45));
    expect(out).toMatch(/^\d{2}:\d{2}$/);
  });
});
