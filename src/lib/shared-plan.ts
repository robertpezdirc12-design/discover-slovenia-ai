"use client";

/**
 * SHARED-PLAN — deljene pote v rekonstrukciji 45-b (localStorage).
 *
 * Izvirnik: SavedItinerary v bazi (shareId hex, isPublic, views …) —
 * v sandboxu brez te tabele je deljena pot shranjena LOKALNO pod
 * ključem 'dai:shared-plans' po shareId. Iskreno: povezava deluje na
 * napravi, kjer je bila ustvarjena (enako kot zbirka Moja pot).
 */

import * as React from "react";

export interface SharedPlanLocation {
  name: string;
  /** Kanonski slug destinacije, če lokacija zadeva nabor 38. */
  destSlug?: string;
  /** Ura postanka (HH:mm) — null/undefined, ko ni znana (iskrenostni kanon). */
  time?: string | null;
}

export interface SharedPlanDay {
  day: number;
  title?: string;
  locations: SharedPlanLocation[];
}

export interface SharedPlan {
  shareId: string;
  name: string | null;
  createdAt: string;
  days: SharedPlanDay[];
  /** Skupni proračun (EUR), če je znan. */
  totalBudget?: number;
}

const STORAGE_KEY = "dai:shared-plans";

export const SHARED_PLAN_CHANGED_EVENT = "dai:shared-plans-changed";

/** Veljavna oblika shareId (kanon izvirnika: kratki mali znaki). */
export const SHARE_ID_RE = /^[a-z0-9]{1,32}$/;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(): Record<string, SharedPlan> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, SharedPlan> = {};
    for (const [id, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof val === "object" &&
        val !== null &&
        !Array.isArray(val) &&
        typeof (val as SharedPlan).shareId === "string" &&
        Array.isArray((val as SharedPlan).days)
      ) {
        out[id] = val as SharedPlan;
      }
    }
    return out;
  } catch {
    // Pokvarjen zapis → iskreno prazno (nikoli izmišljenih podatkov).
    return {};
  }
}

function writeAll(plans: Record<string, SharedPlan>): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    window.dispatchEvent(new CustomEvent(SHARED_PLAN_CHANGED_EVENT));
  } catch {
    // Shramba nedosegljiva — tiho ignoriramo.
  }
}

export const sharedPlans = {
  /** Načrt po shareId (undefined, če ne obstaja — iskrenostni kanon). */
  get(shareId: string): SharedPlan | undefined {
    return readAll()[shareId];
  },

  /** Shrani (ali prepiše) načrt pod njegovim shareId. */
  save(plan: SharedPlan): void {
    const all = readAll();
    all[plan.shareId] = plan;
    writeAll(all);
  },

  /** Vsi shranjeni načrti (prazna tabela na strežniku). */
  list(): SharedPlan[] {
    return Object.values(readAll()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  /** Odstrani načrt po shareId (no-op, če ga ni). */
  remove(shareId: string): void {
    const all = readAll();
    delete all[shareId];
    writeAll(all);
  },
};

/** Reaktiven seznam deljenih načrtov (npr. hub /moja-potovanja). */
export function useSharedPlans(): SharedPlan[] {
  const [plans, setPlans] = React.useState<SharedPlan[]>([]);
  React.useEffect(() => {
    const refresh = () => setPlans(sharedPlans.list());
    refresh();
    window.addEventListener(SHARED_PLAN_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SHARED_PLAN_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return plans;
}
