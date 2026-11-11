/**
 * Skupni tipi za prikaz apartmajev (UI ← API).
 * Ločeno od `apartments-source.ts`, ker UI dela le z API obliko.
 */

/** Ena prenočišče, kot jo vrne GET /api/apartments. */
export interface ApartmentApiItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  region: string;
  street: string | null;
  postcode: string | null;
  /** Občina (iz geokodiranega uradnega naslova). */
  obcina: string | null;
  /** Pravnoorganizacijska oblika (AJPES — npr. »Registrirani sobodajalec«). */
  legalForm: string | null;
  /** Matična številka AJPES (uradni identifikator). */
  maticna: string | null;
  website: string | null;
  phone: string | null;
  stars: number | null;
  /** 'ajpes' (uradni register) | 'overpass' | 'nominatim' (OpenStreetMap). */
  source: string;
}

/** Odgovor GET /api/apartments. */
export interface ApartmentsResponse {
  ok: boolean;
  count?: number;
  updatedAt?: string | null;
  source?: string | null;
  /** true, če poteka prvo usklajevanje (baza prazna) — glej syncProgress. */
  syncing?: boolean;
  syncProgress?: SyncProgressView | null;
  apartments?: ApartmentApiItem[];
  error?: string;
}

/** Stanje usklajevanja (odraz GET/POST /api/apartments/sync). */
export interface SyncProgressView {
  running: boolean;
  phase: 'idle' | 'download' | 'geocode' | 'persist' | 'done' | 'error';
  done: number;
  total: number;
  matched: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

/** Odgovor POST /api/apartments/sync (začetek v ozadju). */
export interface SyncStartResponse {
  ok: boolean;
  started?: boolean;
  progress?: SyncProgressView;
  error?: string;
}

/** Odgovor GET /api/apartments/sync (napredek). */
export interface SyncProgressResponse {
  ok: boolean;
  progress?: SyncProgressView;
  error?: string;
}

/** Človeku berljiv vir podatkov za statusno vrstico. */
export function sourceLabel(source: string | null | undefined, dataSource: string | null | undefined): string {
  if (source === 'ajpes-prs') return 'vir: AJPES — Poslovni register RS (uradno)';
  if (source) return `vir: OpenStreetMap (${dataSource ?? source})`;
  return 'vir: —';
}

/** Formatiran datum/čas v slovenščini (npr. »3. 11. 2025, 14:30«). */
export function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('sl-SI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}
