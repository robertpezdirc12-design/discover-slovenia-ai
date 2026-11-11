/**
 * PAKIRNI SEZNAM — statične predloge po tipu potovanja (Wanderlog vzorec,
 * skriptno, brez AI). Seznam se sestavi iz vodiča: regija (gore/morje/
 * mesto), interesi, dni. Uporabnik vklapija postavke; napredek se hrani
 * lokalno (ključano na pot, da se ob novi poti ponastavi).
 */

import type { GuideInterest } from '@/lib/guide-store';

export const PACKING_KEY = 'dsa.packing.v1';

export interface PackingItem {
  id: string;
  label: string;
  /** Skupina za prikaz. */
  group: 'dokumenti' | 'oblačila' | 'toaletni' | 'tehnika' | 'razno';
}

export interface PackingList {
  /** Ključ poti, na katero je stanje vezano. */
  routeKey: string;
  items: readonly PackingItem[];
  done: ReadonlySet<string>;
}

const BASE_ITEMS: readonly PackingItem[] = [
  { id: 'dok', label: 'Osebna izkaznica / potni list', group: 'dokumenti' },
  { id: 'dok2', label: 'Zdravstvena kartica', group: 'dokumenti' },
  { id: 'dok3', label: 'Rezervacije in vozovnice (telefon)', group: 'dokumenti' },
  { id: 'obl1', label: 'Spodnje perilo (po dnevu)', group: 'oblačila' },
  { id: 'obl2', label: 'Nogavice (po dnevu)', group: 'oblačila' },
  { id: 'obl3', label: 'Majice (po dnevu)', group: 'oblačila' },
  { id: 'obl4', label: 'Hlače / krilo (2–3)', group: 'oblačila' },
  { id: 'obl5', label: 'Jopa / pulover', group: 'oblačila' },
  { id: 'obl6', label: 'Vodoodporna jakna', group: 'oblačila' },
  { id: 'toi1', label: 'Zobna ščetka in pasta', group: 'toaletni' },
  { id: 'toi2', label: 'Zdravila (osebna)', group: 'toaletni' },
  { id: 'toi3', label: 'Krema za sončenje', group: 'toaletni' },
  { id: 'teh1', label: 'Polnilec za telefon', group: 'tehnika' },
  { id: 'teh2', label: 'Polnilec powerbank', group: 'tehnika' },
  { id: 'teh3', label: 'Slušalke', group: 'tehnika' },
  { id: 'raz1', label: 'Steklenica za vodo', group: 'razno' },
  { id: 'raz2', label: 'Manjši nahrbtnik', group: 'razno' },
];

/** Dodatki po tipih (indeks: 0 gore, 1 morje, 2 mesto, 3 zima). */
const EXTRA_BY_TYPE: Readonly<Record<string, readonly PackingItem[]>> = {
  gore: [
    { id: 'gor1', label: 'Planinski čevlji', group: 'oblačila' },
    { id: 'gor2', label: 'Termo plast', group: 'oblačila' },
    { id: 'gor3', label: 'Dežni plašč', group: 'oblačila' },
    { id: 'gor4', label: 'Palice (opcijsko)', group: 'razno' },
  ],
  morje: [
    { id: 'mor1', label: 'Kopalke', group: 'oblačila' },
    { id: 'mor2', label: 'Brisača', group: 'oblačila' },
    { id: 'mor3', label: 'Natikači / japonke', group: 'oblačila' },
    { id: 'mor4', label: 'Nepremočljiva torbica za telefon', group: 'tehnika' },
  ],
  mesto: [
    { id: 'mes1', label: 'Udobni čevlji za hojo', group: 'oblačila' },
    { id: 'mes2', label: 'Elegantna večerna obleka', group: 'oblačila' },
  ],
  zima: [
    { id: 'zim1', label: 'Topla jakna', group: 'oblačila' },
    { id: 'zim2', label: 'Kapa, šal in rokavice', group: 'oblačila' },
    { id: 'zim3', label: 'Nepremočljivi čevlji', group: 'oblačila' },
  ],
};

export function isCoastalRegion(regionId: string | null): boolean {
  if (!regionId) return false;
  return regionId === 'primorska' || regionId === 'hrvaska' || regionId === 'crna-gora' || regionId === 'albanija';
}

export function isMountainRegion(regionId: string | null): boolean {
  if (!regionId) return false;
  return (
    regionId === 'gorenjska' ||
    regionId === 'koroska' ||
    regionId === 'crna-gora' ||
    regionId === 'severna-makedonija' ||
    regionId === 'bosna-hercegovina'
  );
}

/** Tipi za predloge (lahko več). */
export function packingTypesFor(
  regionId: string | null,
  interests: readonly GuideInterest[],
): readonly string[] {
  const types = new Set<string>();
  if (isMountainRegion(regionId) || interests.includes('pohodništvo')) types.add('gore');
  if (isCoastalRegion(regionId)) types.add('morje');
  if (regionId && !isMountainRegion(regionId) && !isCoastalRegion(regionId)) types.add('mesto');
  if (interests.includes('zgodovina') || interests.includes('kultura')) types.add('mesto');
  return Array.from(types);
}

/** Zgradi seznam za pot (baza + dodatki po tipih). */
export function buildPackingList(
  routeKey: string,
  regionId: string | null,
  interests: readonly GuideInterest[],
): PackingList {
  const types = packingTypesFor(regionId, interests);
  const items: PackingItem[] = [...BASE_ITEMS];
  for (const type of types) {
    for (const item of EXTRA_BY_TYPE[type] ?? []) {
      if (!items.some((i) => i.id === item.id)) items.push(item);
    }
  }
  return { routeKey, items, done: new Set() };
}

/** Prebere stanje iz localStorage; pokvarjen zapis → null. */
export function parsePackingState(raw: string | null): PackingList | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const o = value as Record<string, unknown>;
    if (typeof o.routeKey !== 'string') return null;
    const itemsRaw = o.items;
    const doneRaw = o.done;
    if (!Array.isArray(itemsRaw) || !Array.isArray(doneRaw)) return null;
    const items: PackingItem[] = [];
    for (const it of itemsRaw) {
      if (!it || typeof it !== 'object') continue;
      const i = it as Record<string, unknown>;
      if (typeof i.id !== 'string' || typeof i.label !== 'string') continue;
      const group = typeof i.group === 'string' ? i.group : 'razno';
      if (!['dokumenti', 'oblačila', 'toaletni', 'tehnika', 'razno'].includes(group)) continue;
      items.push({ id: i.id, label: i.label.slice(0, 80), group: group as PackingItem['group'] });
    }
    const done = new Set<string>();
    for (const id of doneRaw) {
      if (typeof id === 'string' && items.some((i) => i.id === id)) done.add(id);
    }
    return { routeKey: o.routeKey, items, done };
  } catch {
    return null;
  }
}

export function serializePackingList(list: PackingList): string {
  return JSON.stringify({
    routeKey: list.routeKey,
    items: list.items,
    done: Array.from(list.done).sort(),
  });
}

/** Odstotek opravljenega (0–100). */
export function packingProgress(list: PackingList): number {
  if (list.items.length === 0) return 0;
  return Math.round((list.done.size / list.items.length) * 100);
}
