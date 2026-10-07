"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { pick } from "@/lib/i18n-pick";
import { cn } from "@/lib/utils";

/**
 * PWA OFFLINE — registracija service workerja + obvestili (v2.4.0).
 *
 * - Registracija: SAMO v produkciji (NODE_ENV === "production") ali z
 *   ?sw=1 (preizkusna pot za peskovnik/E2E — dokumentirano v README).
 * - Offline banner: fiksno nad mobilnim tab barom, aria-live, 6 jezikov
 *   (pick kanon — slovenščina resnica, ostali prekrivni prevodi).
 * - Osvežitev: ko nov SW čaka (waiting), majhen neblokirni prompt
 *   „Osveži" → postMessage SKIP_WAITING → controllerchange → ponovni nalož.
 *
 * Iskrenost: SW je NAPREDEN dodatek — ob napaki registracije aplikacija
 * normalno deluje (tiha napaka brez lažnih obljub).
 */
const L = {
  offline: {
    sl: "Brez povezave — shranjene vsebine ostajajo dosegljive",
    en: "Offline — saved content stays available",
    it: "Offline — i contenuti salvati restano disponibili",
    de: "Offline — gespeicherte Inhalte bleiben verfügbar",
    fr: "Hors ligne — le contenu enregistré reste accessible",
    es: "Sin conexión — el contenido guardado sigue disponible",
  },
  updateReady: {
    sl: "Nova različica je pripravljena",
    en: "A new version is ready",
    it: "Una nuova versione è pronta",
    de: "Eine neue Version ist bereit",
    fr: "Une nouvelle version est prête",
    es: "Hay una nueva versión lista",
  },
  refresh: {
    sl: "Osveži",
    en: "Refresh",
    it: "Aggiorna",
    de: "Aktualisieren",
    fr: "Actualiser",
    es: "Actualizar",
  },
} as const;

export function ServiceWorkerRegister() {
  const locale = useLocale();
  const [offline, setOffline] = React.useState(false);
  const [updateReady, setUpdateReady] = React.useState(false);
  const waitingRef = React.useRef<ServiceWorker | null>(null);
  const refreshingRef = React.useRef(false);

  React.useEffect(() => {
    // Stanje povezave (SSR-varno: privzeto online, popravek po mountu)
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
    }
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("offline", goOffline);
        window.removeEventListener("online", goOnline);
      };
    }

    // Registracija: produkcija, ?sw=1 (preizkusna pot) ALI stran že pod
    // nadzorom SW (controller obstaja — prejšnja registracija; tedaj mora
    // stran seveda spremljati tudi posodobitve, sicer bi prompt izginil
    // ob prvi navigaciji brez ?sw=1)
    const params = new URLSearchParams(window.location.search);
    const enabled =
      process.env.NODE_ENV === "production" ||
      params.has("sw") ||
      !!navigator.serviceWorker.controller;
    if (!enabled) {
      return () => {
        window.removeEventListener("offline", goOffline);
        window.removeEventListener("online", goOnline);
      };
    }

    let cancelled = false;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;
        // Če NOV SW ŽE čaka oz. se namešča (brskalnik sproži preverbo
        // posodobitve že ob navigaciji — pred priključitvijo poslušalcev)
        const checkWaiting = () => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            waitingRef.current = registration.waiting;
            setUpdateReady(true);
          }
        };
        const onInstallingState = (worker: ServiceWorker) => {
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              waitingRef.current = worker;
              setUpdateReady(true);
            }
          });
        };
        checkWaiting();
        if (registration.installing) onInstallingState(registration.installing);

        // Klasična pot: nov SW se začne nameščati kasneje
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          onInstallingState(installing);
        });

        // Varnostna mreža: dogodki pred priključitvijo poslušalcev
        if (safetyTimer === undefined) {
          safetyTimer = setTimeout(checkWaiting, 3000);
        }
      })
      .catch(() => {
        // Iskreno tiho — aplikacija deluje tudi brez SW
      });

    return () => {
      cancelled = true;
      if (safetyTimer !== undefined) clearTimeout(safetyTimer);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  const applyUpdate = () => {
    waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[68px] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {offline ? (
        <p
          role="status"
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-lg",
            "dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          )}
        >
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          <span className="text-center">{pick(locale, L.offline)}</span>
        </p>
      ) : null}

      {updateReady ? (
        <p
          role="status"
          className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-primary/30 bg-background px-4 py-2 text-sm shadow-lg"
        >
          <span className="font-medium">{pick(locale, L.updateReady)}</span>
          <button
            type="button"
            onClick={applyUpdate}
            aria-label={pick(locale, L.refresh)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {pick(locale, L.refresh)}
          </button>
        </p>
      ) : null}
    </div>
  );
}
