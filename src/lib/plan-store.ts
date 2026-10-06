"use client";

/**
 * PLAN-STORE — localStorage hub načrtovalniške plasti (45-d).
 *
 * Ključi (kanon predpon dai: kot v izvirniku):
 * - "dai:last-plan"  → SavedPlan: zadnji deterministični načrt (iz /nacrtuj)
 * - "dai:go-trip"    → GoTripRecord: napredek Go Mode "Na poti"
 *   (po vzorcu go-persist izvirnika: planRef, dayIndex, stopIndex,
 *    startedAt, completed[])
 *
 * Vsi dostopi so SSR-varni (branje → null/undefined na strežniku) in
 * se sproži dogodek za reaktiven prikaz (badge/strani).
 */

import { useEffect, useState } from "react";

import type { ItineraryPlan } from "./types";

export const LAST_PLAN_KEY = "dai:last-plan";
export const GO_TRIP_KEY = "dai:go-trip";

export const PLAN_CHANGED_EVENT = "dai:last-plan-changed";
export const GO_TRIP_CHANGED_EVENT = "dai:go-trip-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// ---------------------------------------------------------------------------
// Zadnji načrt (dai:last-plan)
// ---------------------------------------------------------------------------

export interface SavedPlan {
  plan: ItineraryPlan;
  /** ISO čas shranjevanja (PEL klienta — motor ostane determinističen). */
  savedAt: string;
  source: "planner";
}

export function loadLastPlan(): SavedPlan | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(LAST_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlan;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.plan?.days)) {
      return null;
    }
    return parsed;
  } catch {
    // Pokvarjen zapis → iskreno "ni načrta" (nikoli izmišljenih podatkov).
    return null;
  }
}

export function saveLastPlan(plan: ItineraryPlan): SavedPlan {
  const record: SavedPlan = { plan, savedAt: new Date().toISOString(), source: "planner" };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(LAST_PLAN_KEY, JSON.stringify(record));
      window.dispatchEvent(new CustomEvent(PLAN_CHANGED_EVENT));
    } catch {
      // Zasebni način brez prostora — tiho ignoriramo.
    }
  }
  return record;
}

export function clearLastPlan(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(LAST_PLAN_KEY);
    window.dispatchEvent(new CustomEvent(PLAN_CHANGED_EVENT));
  } catch {
    /* ignoriramo */
  }
}

// ---------------------------------------------------------------------------
// Go Mode "Na poti" (dai:go-trip) — po vzorcu go-persist izvirnika
// ---------------------------------------------------------------------------

/** Na kateri vir potuje Go Mode: zadnji načrt ali osnutek iz Moje poti. */
export type GoPlanRef = "last-plan" | "my-trip";

export interface GoTripRecord {
  planRef: GoPlanRef;
  dayIndex: number;
  stopIndex: number;
  startedAt: string;
  /** IDs opravljenih postankov (danes in prejšnje dni). */
  completed: string[];
}

export function loadGoTrip(): GoTripRecord | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(GO_TRIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoTripRecord;
    if (
      !parsed ||
      (parsed.planRef !== "last-plan" && parsed.planRef !== "my-trip") ||
      typeof parsed.dayIndex !== "number" ||
      typeof parsed.stopIndex !== "number" ||
      !Array.isArray(parsed.completed) ||
      typeof parsed.startedAt !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveGoTrip(record: GoTripRecord): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(GO_TRIP_KEY, JSON.stringify(record));
    window.dispatchEvent(new CustomEvent(GO_TRIP_CHANGED_EVENT));
  } catch {
    /* ignoriramo */
  }
}

export function clearGoTrip(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(GO_TRIP_KEY);
    window.dispatchEvent(new CustomEvent(GO_TRIP_CHANGED_EVENT));
  } catch {
    /* ignoriramo */
  }
}

// ---------------------------------------------------------------------------
// Reaktivni hooki (isti vzorec kot useMyTripCount/useMyTripList)
// ---------------------------------------------------------------------------

/**
 * useLastPlan — reaktiven zadnji načrt + zastavica hidracije (SSR-varno:
 * `ready:false` na strežniku/prvem renderu — brez utripanja “ni načrta”).
 */
export function useLastPlan(): { saved: SavedPlan | null; ready: boolean } {
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setSaved(loadLastPlan());
      setReady(true);
    };
    refresh();
    window.addEventListener(PLAN_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PLAN_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { saved, ready };
}

/** useGoTrip — reaktiven zapis Go Mode + zastavica hidracije. */
export function useGoTrip(): { go: GoTripRecord | null; ready: boolean } {
  const [go, setGo] = useState<GoTripRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setGo(loadGoTrip());
      setReady(true);
    };
    refresh();
    window.addEventListener(GO_TRIP_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(GO_TRIP_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { go, ready };
}
