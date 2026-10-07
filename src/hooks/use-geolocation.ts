"use client";

/**
 * USE-GEOLOCATION — živi GPS za Go Mode „Na poti“ (issue #1 področje 1;
 * rekonstrukcija po kanonu izvirnika v1.190.0: journey/use-geolocation,
 * TASK 64 — watchPosition high accuracy, iskreni statusi, pravilno
 * čiščenje watcherja).
 *
 * ZASEBNOSTNI KANON (izvirnik, nedotakljiv):
 *  - položaj živi SAMO v pomnilniku te komponente (React state) —
 *    0 persistenc: nikoli localStorage, nikoli analytics, nikoli žetoni;
 *  - na strežnik gre IZKLJUČNO zaokrožena pozicija (4 decimale, ~11 m —
 *    glej roundedPrivacy v src/lib/go-gps.ts), in sicer SAMO ob
 *    eksplicitnem preračunu poti, ki ga sproži uporabnik.
 *
 * Stanja (iskreni nabor — vsako je v UI izrecno prikazano, nič tihega):
 *  - "idle"         → sledenje izklopljeno (začetno stanje)
 *  - "prompt"       → watchPosition zahtevan; čakamo dovoljenje + 1. fiksacijo
 *  - "watching"     → dejaven watch, položaj se osvežuje
 *  - "denied"       → dovoljenje za lokacijo zavrnjeno (nastavitve brskalnika)
 *  - "error"        → druga napaka (položaj nedosegljiv, timeout …)
 *  - "unsupported"  → naprava/brskalnik brez Geolocation API
 *
 * Tehnika: navigator.geolocation.watchPosition z
 * { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }.
 * Napaka → clearWatch + prehod v "denied"/"error" (kanon izvirnika).
 * React strict-safe: id watcherja hrani ref (preživi dvojni mount
 * StrictMode-a), start() ima varovalko proti dvojni registraciji,
 * unmount → clearWatch cleanup (idempotenten).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type GeoStatus =
  | "idle"
  | "prompt"
  | "watching"
  | "denied"
  | "error"
  | "unsupported";

/** Ena GPS fiksacija — samo pomnilnik seje, nikoli persistirana. */
export interface GeoFix {
  lat: number;
  lng: number;
  /** Točnost v metrih (±), če jo naprava poda; sicer null. */
  accuracyM: number | null;
  /** Čas fiksacije (epoch ms, ura naprave). */
  timestamp: number;
}

export interface UseGeolocation {
  status: GeoStatus;
  /** Zadnja fiksacija ali null (izklop sledenja jo pozabi). */
  position: GeoFix | null;
  /** Vklopi sledenje (edina watchPosition registracija naenkrat). */
  start: () => void;
  /** Izklopi sledenje (clearWatch + pozabi položaj). */
  stop: () => void;
}

/** Koda napake GeolocationPositionError.PERMISSION_DENIED (spremenljivka ni na voljo v vseh okoljih SSR). */
const ERR_PERMISSION_DENIED = 1;

export function useGeolocation(): UseGeolocation {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<GeoFix | null>(null);
  /**
   * Id watcherja v ref-u: React StrictMode (dev) komponento monte-,
   * demonte- in remonta — ref PRENOSI id čez dvojni mount, tako da
   * unmount cleanup ne izgubi ali podvoji watcherja (dvojni mount
   * varovalka). Uspešni callbacki po clearWatch (id že null) se
   * ignorirajo — ne zaupamo zastarelimi fiksaciji.
   */
  const watchIdRef = useRef<number | null>(null);

  const clearWatchSafe = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const start = useCallback(() => {
    // Varovalka: EN sam watcher (ponovni klic start med aktivnim watchem
    // ne registrira drugega — prav tako je idempotenten po napaki).
    if (watchIdRef.current !== null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("prompt");
    setPosition(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (watchIdRef.current === null) return; // zastarel callback
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM:
            typeof pos.coords.accuracy === "number" &&
            Number.isFinite(pos.coords.accuracy)
              ? pos.coords.accuracy
              : null,
          timestamp: pos.timestamp,
        });
        setStatus("watching");
      },
      (err) => {
        // Napaka → clearWatch + iskreni stanji (kanon izvirnika):
        // zavrnjeno dovoljenje = "denied", ostalo = "error".
        clearWatchSafe();
        setStatus(err?.code === ERR_PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
    watchIdRef.current = id;
  }, [clearWatchSafe]);

  const stop = useCallback(() => {
    clearWatchSafe();
    setStatus("idle");
    setPosition(null);
  }, [clearWatchSafe]);

  // Unmount → clearWatch cleanup (idempotenten; StrictMode dvojni mount varen).
  useEffect(() => clearWatchSafe, [clearWatchSafe]);

  return { status, position, start, stop };
}
