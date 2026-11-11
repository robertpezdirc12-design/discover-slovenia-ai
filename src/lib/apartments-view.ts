/**
 * Skupni tipi za prikaz apartmajev (UI ← API).
 * Ločeno od `apartments-source.ts`, ker UI dela le z API obliko.
 */

/** En apartma, kot ga vrne GET /api/apartments. */
export interface ApartmentApiItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  region: string;
  street: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  stars: number | null;
  /** Indikativna cena od (EUR/noč) — jasno označena kot ocena v UI. */
  priceFrom: number;
  source: string;
}

/** Odgovor GET /api/apartments. */
export interface ApartmentsResponse {
  ok: boolean;
  count?: number;
  updatedAt?: string | null;
  source?: string | null;
  apartments?: ApartmentApiItem[];
  error?: string;
}

/** Odgovor POST /api/apartments/sync. */
export interface SyncResponse {
  ok: boolean;
  count?: number;
  source?: string;
  requests?: number;
  failures?: number;
  durationMs?: number;
  error?: string;
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
