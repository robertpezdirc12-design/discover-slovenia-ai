'use client';

import { useSyncExternalStore } from 'react';
import {
  GUIDE_EVENT,
  GUIDE_STORAGE_KEY,
  sanitizeGuideState,
  type GuideState,
} from '@/lib/guide-store';

/**
 * Skupna naročnina na vodeni tok (Komoot onboarding vzorec).
 *
 * localStorage je ZUNANJA shramba → beremo prek useSyncExternalStore
 * (brez setState v efektih; mutacije = zapis + dogodek GUIDE_EVENT).
 * Uporablja ga vodič (GuidedFlow) IN zemljevid (MapSection) — tako se
 * "Moja pot" na karti takoj odzove na vsak odgovor v vodiču.
 */

/** Stabilen snapshot (useSyncExternalStore zahteva referenčno enakost). */
let snapshotCache: { raw: string | null; parsed: GuideState | null } | null = null;
function getGuideSnapshot(): GuideState | null {
  if (typeof window === 'undefined') return null;

  // V brskalnikih z blokirano shrambo `getItem` vrže SecurityError.
  // Takrat se vodič obnaša, kot da odgovorov še ni — stran se ne sesuje.
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(GUIDE_STORAGE_KEY);
  } catch {
    return null;
  }

  if (snapshotCache && snapshotCache.raw === raw) return snapshotCache.parsed;
  let parsed: GuideState | null = null;
  try {
    parsed = raw ? sanitizeGuideState(JSON.parse(raw)) : null;
  } catch {
    parsed = null;
  }
  snapshotCache = { raw, parsed };
  return parsed;
}

function getServerSnapshot(): GuideState | null {
  return null;
}

/** naročnina na dogodek toka + storage dogodek (prečni zavihki). */
function subscribeGuide(onChange: () => void): () => void {
  window.addEventListener(GUIDE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(GUIDE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Trenutno stanje vodenega toka (null = še ni odgovorov). */
export function useGuideState(): GuideState | null {
  return useSyncExternalStore(subscribeGuide, getGuideSnapshot, getServerSnapshot);
}
