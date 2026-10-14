"use client";

/**
 * TRAVEL-MAP-VECTOR-POC — #35 faza 1 (re-deizija 14. 10. 2026): PoC
 * vektorskega zemljevida MapLibre GL JS 6.14.0 + OpenFreeMap javni primerek
 * (slog Liberty, `tiles.openfreemap.org`).
 *
 * ZAKAJ: verifikacija v R35-F4A je refutirala fazo 1, kot je bila napisana
 * ("sprememba 1 URL") — OFM javni primerek je VEKTORSKI, Leaflet ga ne zna
 * risati. Re-deizija dokumenta #35 §9 ponuja pot (a) = MapLibre PoC. Ta
 * komponenta je ta PoC: merljiv material za lastniško odločitev (izgled,
 * obnašanje, paket, CSP) — NI zamenjava obstoječega zemljevida.
 *
 * PRIPONOST (iskreno):
 *  - privzeti zemljevid ostaja Leaflet (status quo); ta PoC se naloži SAMO
 *    ob `?zemljevid=vektorji` na /zemljevid (pogojno next/dynamic ssr:false
 *    — paket MapLibre se NALOŽI ŠELE ob vstopu v PoC, sicer 0 vpliva);
 *  - brez plasti Lokali/Pot/Bencinske/POI in brez rezervacijskih povezav
 *    (te ostajajo v standardnem zemljevidu — napis v PoC pasici);
 *  - isti kanon destinacij (DESTINATIONS, 74) in ISTA višina/center/zoom
 *    kot Leaflet MapContainer (pariteta izgleda);
 *  - atribucija je VEDNO vidna (© OpenStreetMap contributors + OpenFreeMap)
 *    — obveznost dokumenta #35 in ATTRIBUTIONS.md.
 *
 * CSP: vse pridobitve (slog JSON, vektorski .pbf, glyphs, sprite, NE raster)
 * prihajajo iz ENEGA gostitelja `tiles.openfreemap.org` (curl verifikacija
 * 14. 10. 2026) → connect-src + img-src v src/lib/csp.ts (CSP_MAPLIBRE_HOSTS).
 *
 * ČIŠČENJE: map.remove() v unmount čistilni funkciji (tudi StrictMode
 * dvojni priklop v razvoju je s tem varen); popups/markerji se uničijo s
 * stranjo zemljevida.
 */

import {
  config as mlConfig,
  Map as MlMap,
  Marker as MlMarker,
  NavigationControl,
  Popup as MlPopup,
} from "maplibre-gl";
import { ArrowLeft, FlaskConical, Loader2, TriangleAlert } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { Link } from "@/i18n/navigation";
import { localePrefixPath } from "@/i18n/routing";
import { pick } from "@/lib/i18n-pick";
import {
  DESTINATIONS,
  type DestinationType,
  typeLabel,
} from "@/lib/slovenia-data";

import "maplibre-gl/dist/maplibre-gl.css";

/** Javni primerek OpenFreeMap — slog Liberty (vektorski, openmaptiles). */
export const OFM_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** MapLibre v6 računa worker URL iz import.meta.url, ki v bundlerjih NI
 * http(s) → „Worker failed to load“ (odkrito ob brskalniški verifikaciji
 * produkcije 2.63.0, PR #55). Uradni override = config.WORKER_URL: worker
 * strežemo iz istega izvora /maplibre/ (CSP worker-src 'self'; datoteka ima
 * BSD-3 licenčno glavo — korektna redistribucija). ?v= zaklep predpomnilnika
 * na izdajo. Nastavimo ENKRAT na nivoju modula (pred vsakim new MlMap). */
export const ML_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs?v=2.63.1";
mlConfig.WORKER_URL = ML_WORKER_URL;

/** Barvna paleta tipov — ZRCALANA iz travel-map.tsx TYPE_COLORS (PoC je
 * namerno samozadosten, da Leaflet datoteka ostane 100 % nedotaknjena). */
const TYPE_COLORS: Record<DestinationType, string> = {
  castle: "#8B5E3C",
  cave: "#757575",
  city: "#C77D2E",
  coast: "#2A9D8F",
  gorge: "#6B8E23",
  lake: "#1E7F86",
  monastery: "#6E4B7A",
  mountain: "#8D6E63",
  river: "#48A9A6",
  spa: "#C2586E",
};

/** Pariteta z Leaflet MapContainer (travel-map.tsx): Leaflet [lat, lng] →
 * MapLibre [lng, lat]; isti zoom 8 (produkcija se odpre na Sloveniji). */
const MAP_CENTER: [number, number] = [14.5, 46.15];
const MAP_ZOOM = 8;

/** Vidna atribucija (obveznost #35 + ATTRIBUTIONS.md) — MapLibre jo izriše
 * v AttributionControl spodaj desno; povezavi sta javni in brez zaselkov. */
const ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &middot; ploščice <a href="https://www.openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a>';

export default function TravelMapVectorPoc() {
  const l = useLocale();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = new MlMap({
      container: el,
      style: OFM_STYLE_URL,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      minZoom: 5,
      maxZoom: 18,
      scrollZoom: true,
      attributionControl: { customAttribution: ATTRIBUTION_HTML },
    });

    map.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right",
    );

    const onLoad = () => {
      // 74 markerjev (kanon DESTINATIONS) — pike po tipu, enaka paleta kot
      // Leaflet različica; popup prek idiomatskega marker.setPopup (MapLibre
      // sam upravlja preklop odprt/zapr in zapiranje ob kliku na mapo —
      // ročni click listener bi se zaprl sam sabo: v6 map-click zapre
      // popupe, odkrito z brskalniško verifikacijo 2.63.1).
      for (const d of DESTINATIONS) {
        const markerEl = document.createElement("div");
        markerEl.className =
          "h-3.5 w-3.5 cursor-pointer rounded-full border-2 border-white shadow-md";
        markerEl.style.backgroundColor = TYPE_COLORS[d.type];
        markerEl.title = d.name;

        const wrap = document.createElement("div");
        wrap.className = "space-y-1";

        const name = document.createElement("p");
        name.className = "pr-1 font-semibold leading-tight";
        name.textContent = d.name;

        const meta = document.createElement("p");
        meta.className = "text-xs text-muted-foreground";
        meta.textContent = `${typeLabel(d.type, l)} · ${d.country.toUpperCase()} · ★ ${d.rating.toFixed(1)}`;

        const more = document.createElement("a");
        more.className = "inline-block text-xs font-medium underline";
        more.href = `${localePrefixPath(l)}/destinacija/${d.slug}`;
        more.textContent = l === "sl" ? "Več" : l === "en" ? "More" : "Details";

        wrap.append(name, meta, more);

        const marker = new MlMarker({ element: markerEl }).setLngLat([
          d.coords.lng,
          d.coords.lat,
        ]);
        marker.setPopup(
          new MlPopup({ offset: 16, maxWidth: "260px" }).setDOMContent(wrap),
        );
        marker.addTo(map);
      }
      setReady(true);
    };

    const onError = () => {
      // PoC iskrenost: napaka stile/ploščic (npr. CSP/blokada) je VIDLJIVA.
      setFailed(true);
    };

    map.on("load", onLoad);
    map.on("error", onError);

    return () => {
      map.off("load", onLoad);
      map.off("error", onError);
      map.remove();
    };
  }, [l]);

  const L = {
    banner: {
      sl: "PoC — eksperimentalni vektorski zemljevid (MapLibre + OpenFreeMap). Plasti Lokali, Pot, Bencinske in POI ostajajo v standardnem zemljevidu.",
      en: "PoC — experimental vector map (MapLibre + OpenFreeMap). The Venues, Route, Fuel and POI layers remain in the standard map.",
      it: "PoC — mappa vettoriale sperimentale (MapLibre + OpenFreeMap). I livelli Locali, Percorso, Carburante e POI restano nella mappa standard.",
      de: "PoC — experimentelle Vektorkarte (MapLibre + OpenFreeMap). Die Ebenen Lokale, Route, Tankstellen und POI bleiben in der Standardkarte.",
      fr: "PoC — carte vectorielle expérimentale (MapLibre + OpenFreeMap). Les calques Lieux, Itinéraire, Carburant et POI restent dans la carte standard.",
      es: "PoC — mapa vectorial experimental (MapLibre + OpenFreeMap). Las capas de Locales, Ruta, Gasolineras y POI permanecen en el mapa estándar.",
    },
    back: {
      sl: "Standardni zemljevid",
      en: "Standard map",
      it: "Mappa standard",
      de: "Standardkarte",
      fr: "Carte standard",
      es: "Mapa estándar",
    },
    loading: {
      sl: "Nalaganje vektorskih ploščic …",
      en: "Loading vector tiles …",
      it: "Caricamento tile vettoriali …",
      de: "Vektorkacheln werden geladen …",
      fr: "Chargement des tuiles vectorielles …",
      es: "Cargando teselas vectoriales …",
    },
    failed: {
      sl: "Vektorskih ploščic ni bilo mogoče naložiti — preveri povezavo ali CSP (iskrena napaka PoC-ja).",
      en: "Vector tiles could not be loaded — check the connection or CSP (honest PoC error).",
      it: "Impossibile caricare le tile vettoriali — verifica la connessione o il CSP (errore onesto del PoC).",
      de: "Vektorkacheln konnten nicht geladen werden — Verbindung oder CSP prüfen (ehrlicher PoC-Fehler).",
      fr: "Impossible de charger les tuiles vectorielles — vérifie la connexion ou le CSP (erreur honnête du PoC).",
      es: "No se pudieron cargar las teselas vectoriales — comprueba la conexión o el CSP (error honesto del PoC).",
    },
    mapLabel: {
      sl: "Vektorski zemljevid (PoC) — 74 destinacij",
      en: "Vector map (PoC) — 74 destinations",
      it: "Mappa vettoriale (PoC) — 74 destinazioni",
      de: "Vektorkarte (PoC) — 74 Destinationen",
      fr: "Carte vectorielle (PoC) — 74 destinations",
      es: "Mapa vectorial (PoC) — 74 destinos",
    },
  } as const;

  return (
    <div>
      {/* Iskrena PoC pasica (amber) + povratek na standardni zemljevid */}
      <div
        className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200"
        data-poc-banner=""
      >
        <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-40 flex-1">{pick(l, L.banner)}</span>
        <Link
          href="/zemljevid"
          className="inline-flex shrink-0 items-center gap-1 font-medium underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {pick(l, L.back)}
        </Link>
      </div>

      {/* isti niz višin kot Leaflet MapContainer (0 premika med preklopi) */}
      <div
        ref={containerRef}
        role="application"
        aria-label={pick(l, L.mapLabel)}
        className="relative h-[62svh] min-h-80 w-full overflow-hidden rounded-xl sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]"
      >
        {!ready && !failed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/40 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {pick(l, L.loading)}
          </div>
        )}
        {failed && (
          <div className="absolute inset-x-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {pick(l, L.failed)}
          </div>
        )}
      </div>
    </div>
  );
}
