"use client";

/**
 * USE-ONLINE-STATUS — živi kazatelj povezave za Go Mode „Na poti“
 * (QA U12, produkcija 2.27.0, 2026-10-11; raziskava R2).
 *
 * Tehnika: navigator.onLine ob mountu + dogodka „online“/„offline“ na
 * window — stanje se posodablja ŽIVO (brez osveževanja strani), kar
 * Go Mode potrebuje med vožnjo/pohodom (signal prihaja in izgine).
 * Oba poslušalca se ob unmountu ODJAVITA (idempotentna čistka,
 * StrictMode dvojni mount varna — glej vzorec use-geolocation).
 *
 * Hidracija: začetno stanje je „online“ (SSR nima navigatorja), prvi
 * klientki render se torej ujema s strežniškim; effect takoj po mountu
 * prevzame resnično stanje navigator.onLine — odklop ob prvem nalaganju
 * se pokaže v trenutku, brez hidratacijskega neskladja.
 *
 * Iskrenost: navigator.onLine je zgolj ZAZNAVA naprave (načeloma pove,
 * ali obstaja omrežni vmesnik) — UI jo pošteno prikaže kot takšno;
 * trden dokaz o povezavi je odgovor poizvedbe (glej go-offline.ts).
 */

import { useEffect, useState } from "react";

import type { OnlineStatus } from "@/lib/go-offline";

export function useOnlineStatus(): OnlineStatus {
  // SSR/hidracija: privzeto „online“; po mountu prevzame navigator.onLine.
  const [status, setStatus] = useState<OnlineStatus>("online");

  useEffect(() => {
    const sync = () => setStatus(navigator.onLine ? "online" : "offline");
    // Uskladitev ob mountu — naprava je lahko že brez povezave (QA: reload
    // brez signala mora kazalnik takoj postaviti na „Brez povezave“).
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return status;
}
