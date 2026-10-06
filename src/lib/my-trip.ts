"use client";

/**
 * MOJA POT — localStorage hub (ključ 'dai:my-trip').
 *
 * Kanon izvirnika: zbirka "Moja pot" je osrednji shranjeni objekt
 * mentalnega modela ODKRIJ → DODAJ → MOJA POT → NAČRTUJ → POJDI.
 * V sandboxu (brez prijave) je lokalna shramba vir resnice; badge v
 * MobileTabBar in hub /moja-potovanja bereta od tu.
 */

import { useCallback, useEffect, useState } from "react";

import type { MyTripItem, MyTripItemKind } from "./types";

const STORAGE_KEY = "dai:my-trip";

/** Dogodek, ki se sproži ob vsaki spremembi zbirke (badge osveži tab bar). */
export const MY_TRIP_CHANGED_EVENT = "dai:my-trip-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readAll(): MyTripItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is MyTripItem =>
        !!x &&
        typeof (x as MyTripItem).refId === "string" &&
        typeof (x as MyTripItem).name === "string"
    );
  } catch {
    // Pokvarjen zapis → iskreno prazna zbirka (nikoli izmišljenih vrednosti).
    return [];
  }
}

function writeAll(items: MyTripItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(MY_TRIP_CHANGED_EVENT));
  } catch {
    // Shramba nedosegljiva (zasebni način) — tiho ignoriramo.
  }
}

export interface AddResult {
  ok: boolean;
  already: boolean;
}

export const myTrip = {
  /** Seznam vseh shranjenih postankov (prazna tabela na strežniku). */
  list(): MyTripItem[] {
    return readAll();
  },

  /** Število zapisov (badge v MobileTabBar). */
  count(): number {
    return readAll().length;
  },

  /** Ali je refId že v zbirki. */
  has(refId: string): boolean {
    return readAll().some((x) => x.refId === refId);
  },

  /**
   * Dodaj postanek. Vrne {ok:false, already:true}, če refId že obstaja
   * (dvojnik NE povzroči napake — idempotentna semantika izvirnika).
   */
  add(
    refId: string,
    name: string,
    kind: MyTripItemKind = "destination",
    source?: string
  ): AddResult {
    const items = readAll();
    if (items.some((x) => x.refId === refId)) {
      return { ok: false, already: true };
    }
    items.push({
      refId,
      name,
      kind,
      addedAt: new Date().toISOString(),
      ...(source ? { source } : {}),
    });
    writeAll(items);
    return { ok: true, already: false };
  },

  /** Odstrani zapis po refId (no-op, če ga ni). */
  remove(refId: string): void {
    writeAll(readAll().filter((x) => x.refId !== refId));
  },

  /** Pobriši celotno zbirko. */
  clear(): void {
    writeAll([]);
  },
};

/**
 * useMyTripCount — reaktiven števec za badge (tab bar / header).
 * Posluša custom dogodek + storage (sinhronizacija med zavihki).
 */
export function useMyTripCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(myTrip.count());
    refresh();
    window.addEventListener(MY_TRIP_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(MY_TRIP_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return count;
}

/** useMyTripList — reaktiven seznam za hub /moja-potovanja. */
export function useMyTripList(): MyTripItem[] {
  const [items, setItems] = useState<MyTripItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(myTrip.list());
    refresh();
    window.addEventListener(MY_TRIP_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(MY_TRIP_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return items;
}

/** useAddToMyTrip — prirojen klicnik z odzivnim stanjem gumba. */
export function useAddToMyTrip() {
  const [addedRef, setAddedRef] = useState<string | null>(null);

  const add = useCallback(
    (refId: string, name: string, kind: MyTripItemKind = "destination", source?: string) => {
      const res = myTrip.add(refId, name, kind, source);
      if (res.ok || res.already) setAddedRef(refId);
      return res;
    },
    []
  );

  return { add, addedRef };
}
