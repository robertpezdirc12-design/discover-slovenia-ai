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
 *
 * GRUČENJE (PR #62, pripomba lastnika): pri gostih destinacijah (Bled ↔
 * Vintgarska soteska, Piran ↔ Portorož …) bi se 44-px dotikalna cilja
 * fizično prekrivala in dotik bi lahko izbral napačno destinacijo. Ciljev
 * NE zmanjšujemo — namesto tega se prekrivajoči markerji zlijejo v gručo
 * (44 × 44 px gumb s števcem in imeni članov), katere klik poveča kamero
 * toliko, da so vsi člani ≥ 44 px narazen in posamezno izberljivi. Čista
 * logika: @/lib/map-clustering (enote: tests/map-clustering.test.ts).
 */

import {
  config as mlConfig,
  type ErrorEvent as MlErrorEvent,
  LngLatBounds,
  Map as MlMap,
  Marker as MlMarker,
  NavigationControl,
  Popup as MlPopup,
} from "maplibre-gl";
import { ArrowLeft, FlaskConical, Loader2, TriangleAlert } from "lucide-react";
import { useLocale } from "next-intl";
import * as React from "react";

import { notifyMyTripAdded } from "@/components/my-trip-toast-action";
import { Link } from "@/i18n/navigation";
import { localePrefixPath } from "@/i18n/routing";
import { countryLabel } from "@/lib/countries-data";
import {
  groupOverlapping,
  MIN_TOUCH_TARGET_PX,
  requiredSeparationZoom,
} from "@/lib/map-clustering";
import { activeCountryKeys, activeRegionKeys, filterDestinations } from "@/lib/destinations-filter";
import { pick } from "@/lib/i18n-pick";
import { myTrip, useMyTripList } from "@/lib/my-trip";
import {
  DESTINATIONS,
  DEST_TYPES,
  type Destination,
  type DestinationType,
  regionLabel,
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

const POPUP_ACTION_LABELS = {
  add: {
    sl: "Dodaj v mojo pot",
    en: "Add to my trip",
    it: "Aggiungi al mio viaggio",
    de: "Zu meiner Reise hinzufügen",
    fr: "Ajouter à mon voyage",
    es: "Añadir a mi viaje",
  },
  added: {
    sl: "V moji poti",
    en: "In my trip",
    it: "Nel mio viaggio",
    de: "In meiner Reise",
    fr: "Dans mon voyage",
    es: "En mi viaje",
  },
  more: {
    sl: "Več",
    en: "More",
    it: "Dettagli",
    de: "Mehr",
    fr: "Plus",
    es: "Más",
  },
} as const;

/** Dostopno ime gruče (vseh 6 jezikov) — sledi imena članov, da sta
 * bralnik zaslona in E2E test ⑩ videla, katere destinacije gruča združuje. */
const CLUSTER_ARIA_LABELS = {
  sl: "Gruča destinacij",
  en: "Destination cluster",
  it: "Gruppo di destinazioni",
  de: "Reisezielgruppe",
  fr: "Groupe de destinations",
  es: "Grupo de destinos",
} as const;

/** Odmik povečave nad teoretičnim minimumom ločitve — rezerva proti
 * zaokroževanju px in offsetu popupa; invarianta "cilja se NE prekrivata"
 * mora držati tudi ob neceloštevilskem zoomu. */
const CLUSTER_ZOOM_MARGIN = 0.5;

export default function TravelMapVectorPoc() {
  const l = useLocale();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MlMap | null>(null);
  const markersRef = React.useRef<Map<string, MlMarker>>(new Map());
  const clusterMarkersRef = React.useRef<Map<string, MlMarker>>(new Map());
  const syncMarkersRef = React.useRef<(() => void) | null>(null);
  const loadedRef = React.useRef(false);
  // Vidna (filtrirana) množica slugov — skupna izhodiščna točka prikaza in
  // gručenja (gruče nastajajo IZKLJUČNO med vidnimi destinacijami):
  const visibleSlugsRef = React.useRef<Set<string>>(
    new Set(DESTINATIONS.map((d) => d.slug)),
  );
  const tripItems = useMyTripList();
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [q, setQ] = React.useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("q") ?? ""
      : "",
  );
  const [country, setCountry] = React.useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("country") ?? "all"
      : "all",
  );
  const [region, setRegion] = React.useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("region") ?? "all"
      : "all",
  );
  const [type, setType] = React.useState(() => {
    const raw =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("type")
        : null;
    return raw && Object.prototype.hasOwnProperty.call(DEST_TYPES, raw)
      ? raw
      : "all";
  });
  const [mobileView, setMobileView] = React.useState<"map" | "list">("map");
  const activeCountries = React.useMemo(() => activeCountryKeys(DESTINATIONS), []);
  const activeRegions = React.useMemo(() => activeRegionKeys(DESTINATIONS), []);
  const filteredDestinations = React.useMemo(
    () => filterDestinations(DESTINATIONS, { q, country, region, type }),
    [q, country, region, type],
  );
  const hasFilters =
    q.trim() !== "" || country !== "all" || region !== "all" || type !== "all";

  // Filtri o iskanje ostanejo v URL-ju, zato je pogled mogoče deliti in obnoviti.
  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("zemljevid", "vektorji");
    for (const [key, value] of [
      ["q", q.trim()],
      ["country", country],
      ["region", region],
      ["type", type],
    ] as const) {
      if (value && value !== "all") url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(window.history.state, "", next);
  }, [q, country, region, type]);

  const addToTrip = React.useCallback((slug: string, name: string) => {
    const result = myTrip.add(slug, name, "destination", "zemljevid");
    if (result.ok) notifyMyTripAdded(l);
    return result;
  }, [l]);

  const showDestination = React.useCallback((slug: string) => {
    const destination = DESTINATIONS.find((item) => item.slug === slug);
    const map = mapRef.current;
    const marker = markersRef.current.get(slug);
    if (!destination || !map || !marker) return;
    setMobileView("map");
    map.flyTo({
      center: [destination.coords.lng, destination.coords.lat],
      // Zoom 11 loči vsak par kanona DESTINATIONS (najgostejši par se
      // potrebuje ≈ 10,2 — invarianta tests/map-clustering.test.ts ⑪).
      zoom: Math.max(map.getZoom(), 11),
      essential: true,
    });
    const popup = marker.getPopup();
    if (!popup || popup.isOpen()) return;
    if (marker.getElement().style.display === "none") {
      // Marker je trenutno v gruči — popup odpremo šele, ko kamera po
      // poletu cilje loči (sicer bi popup stal nad gručo, ne nad svojo
      // destinacijo).
      map.once("moveend", () => {
        const currentPopup = marker.getPopup();
        if (currentPopup && !currentPopup.isOpen()) marker.togglePopup();
      });
    } else {
      marker.togglePopup();
    }
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Ponovna inicializacija (npr. React StrictMode ali menjava jezika) ne
    // sme podedovati starega stanja nalaganja ali napake.
    setReady(false);
    setFailed(false);
    loadedRef.current = false;
    markersRef.current.clear();

    const map = new MlMap({
      container: el,
      style: OFM_STYLE_URL,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      minZoom: 5,
      maxZoom: 18,
      scrollZoom: true,
      // Na telefonu enoprstno drsenje ostane namenjeno strani; zemljevid
      // se premika z dvema prstoma ali prek večjih kontrol povečave.
      cooperativeGestures: true,
      attributionControl: { customAttribution: ATTRIBUTION_HTML },
    });
    mapRef.current = map;

    map.addControl(
      new NavigationControl({ showCompass: false }),
      "top-right",
    );

    /** Prikaže/skrije posamezen marker (brez odvečnih DOM zapisov). */
    const setMarkerDisplay = (slug: string, show: boolean) => {
      const marker = markersRef.current.get(slug);
      if (!marker) return;
      const value = show ? "" : "none";
      const el = marker.getElement();
      if (el.style.display !== value) el.style.display = value;
    };

    /** Ustvari gručo: 44 × 44 px gumb (pravilo dotika ostane) s števcem
     * članov; klik poveča do najmanjše povečave ločitve ciljev. */
    const createClusterMarker = (
      members: Destination[],
      lngLat: [number, number],
    ): MlMarker => {
      const clusterEl = document.createElement("button");
      clusterEl.type = "button";
      clusterEl.className =
        "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-primary p-0 text-xs font-semibold text-primary-foreground shadow-md";
      clusterEl.style.touchAction = "manipulation";
      clusterEl.setAttribute("data-cluster", "");
      clusterEl.setAttribute("data-cluster-count", String(members.length));
      const names = members.map((member) => member.name);
      clusterEl.setAttribute(
        "aria-label",
        `${pick(l, CLUSTER_ARIA_LABELS)}: ${names.join(", ")}`,
      );
      clusterEl.title = names.join(", ");
      clusterEl.textContent = String(members.length);
      clusterEl.addEventListener("click", () => {
        const current = mapRef.current;
        if (!current) return;
        // fitBounds VSEH članov (drill-down, kot pri znanih zemljevidih):
        // po tapu je cela skupina videna in razpeta; omejitev maxZoom na
        // requiredSeparationZoom + odmik zagotavlja, da se 2-članska gruča
        // razreši V ENEM tapu (člana ≥ 44 px narazen), večje pa se naravno
        // razslopijo v manjše gruče (invarianta prekrivanja velja vedno,
        // saj syncMarkers gruči ob vsakem premiku kamere znova izračuna).
        const target = requiredSeparationZoom(
          members.map((member) => ({
            lng: member.coords.lng,
            lat: member.coords.lat,
          })),
          MIN_TOUCH_TARGET_PX,
          current.getMaxZoom(),
        ) + CLUSTER_ZOOM_MARGIN;
        const bounds = new LngLatBounds();
        for (const member of members) {
          bounds.extend([member.coords.lng, member.coords.lat]);
        }
        current.fitBounds(bounds, {
          padding: 52,
          maxZoom: target,
          essential: true,
        });
      });
      return new MlMarker({ element: clusterEl }).setLngLat(lngLat);
    };

    /** Gručenje (PR #62): markerje, katerih 44-px cilja bi se prekrivala,
     * skrij in namesto njih postavi gručo. Steče ob load, vsakem premiku
     * kamere ('move') in vsaki spremembi filtrov; dela nad VIDI množico. */
    const syncMarkers = () => {
      const current = mapRef.current;
      if (!current || !loadedRef.current) return;
      const groups = groupOverlapping(
        DESTINATIONS.filter((d) => visibleSlugsRef.current.has(d.slug)).map(
          (d) => {
            const p = current.project([d.coords.lng, d.coords.lat]);
            return { d, x: p.x, y: p.y };
          },
        ),
        MIN_TOUCH_TARGET_PX,
      );
      const liveClusterKeys = new Set<string>();
      for (const group of groups) {
        if (group.length === 1) {
          setMarkerDisplay(group[0].d.slug, true);
          continue;
        }
        const members = group.map((item) => item.d);
        const key = members.map((member) => member.slug).sort().join("|");
        liveClusterKeys.add(key);
        for (const member of members) setMarkerDisplay(member.slug, false);
        // Sidro = član najbliže središču gruče (px) — gruča stoji na pravi
        // destinaciji, ne na izmišljeni točki:
        const cx = group.reduce((sum, item) => sum + item.x, 0) / group.length;
        const cy = group.reduce((sum, item) => sum + item.y, 0) / group.length;
        const anchor = group.reduce((best, item) =>
          Math.hypot(item.x - cx, item.y - cy) <
            Math.hypot(best.x - cx, best.y - cy)
            ? item
            : best,
        );
        let marker = clusterMarkersRef.current.get(key);
        if (!marker) {
          marker = createClusterMarker(members, [
            anchor.d.coords.lng,
            anchor.d.coords.lat,
          ]);
          marker.addTo(current);
          clusterMarkersRef.current.set(key, marker);
        }
      }
      for (const [key, marker] of clusterMarkersRef.current) {
        if (!liveClusterKeys.has(key)) {
          marker.remove();
          clusterMarkersRef.current.delete(key);
        }
      }
    };
    syncMarkersRef.current = syncMarkers;

    const onLoad = () => {
      loadedRef.current = true;
      setFailed(false);
      // 74 markerjev (kanon DESTINATIONS) — pike po tipu, enaka paleta kot
      // Leaflet različica; popup prek idiomatskega marker.setPopup (MapLibre
      // sam upravlja preklop odprt/zapr in zapiranje ob kliku na mapo —
      // ročni click listener bi se zaprl sam sabo: v6 map-click zapre
      // popupe, odkrito z brskalniško verifikacijo 2.63.1).
      for (const d of DESTINATIONS) {
        // Dostopna površina za dotik (44×44 px); vidna pika ostane 14×14 px.
        // Tako je izbira na telefonu lažja, ne da bi marker postal vizualno velik.
        const markerEl = document.createElement("button");
        markerEl.type = "button";
        markerEl.className =
          "flex h-11 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0";
        markerEl.style.touchAction = "manipulation";
        markerEl.setAttribute("aria-label", d.name);
        markerEl.setAttribute("data-destination-slug", d.slug);
        markerEl.title = d.name;

        const markerDot = document.createElement("span");
        markerDot.className =
          "block h-3.5 w-3.5 rounded-full border-2 border-white shadow-md";
        markerDot.style.backgroundColor = TYPE_COLORS[d.type];
        markerDot.setAttribute("aria-hidden", "true");
        markerEl.appendChild(markerDot);

        const wrap = document.createElement("div");
        wrap.className = "space-y-1";

        const name = document.createElement("p");
        name.className = "pr-1 font-semibold leading-tight";
        name.textContent = d.name;

        const meta = document.createElement("p");
        meta.className = "text-xs text-muted-foreground";
        meta.textContent = `${typeLabel(d.type, l)} · ${d.country.toUpperCase()} · ★ ${d.rating.toFixed(1)}`;

        const actions = document.createElement("div");
        actions.className = "mt-2 flex gap-2";

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className =
          "inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground";
        const refreshAddButton = () => {
          const alreadyAdded = myTrip.has(d.slug);
          addButton.textContent = alreadyAdded ? pick(l, POPUP_ACTION_LABELS.added) : pick(l, POPUP_ACTION_LABELS.add);
          addButton.disabled = alreadyAdded;
          addButton.setAttribute("aria-pressed", alreadyAdded ? "true" : "false");
        };
        addButton.addEventListener("click", () => {
          const result = myTrip.add(d.slug, d.name, "destination", "zemljevid");
          if (result.ok) notifyMyTripAdded(l);
          refreshAddButton();
        });
        refreshAddButton();

        const more = document.createElement("a");
        more.className =
          "inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground underline-offset-4 hover:underline";
        more.href = `${localePrefixPath(l)}/destinacija/${d.slug}`;
        more.textContent = pick(l, POPUP_ACTION_LABELS.more);

        actions.append(addButton, more);
        wrap.append(name, meta, actions);

        const marker = new MlMarker({ element: markerEl }).setLngLat([
          d.coords.lng,
          d.coords.lat,
        ]);
        marker.setPopup(
          new MlPopup({ offset: 16, maxWidth: "280px" }).setDOMContent(wrap),
        );
        marker.addTo(map);
        markersRef.current.set(d.slug, marker);
      }
      // Gruče se izračunajo takoj ob prvem izrisu (privzeti pogled vseh 74
      // destinacij je na povečavi, kjer se dotikalni cilji gostih parov —
      // Bled/Vintgar, Piran/Portorož … — sicer fizikalno prekrivajo).
      syncMarkers();
      setReady(true);
    };

    // MapLibrejev ErrorEvent ne deklarira sourceId (samo error: ErrorLike),
    // napake ploščic pa ga pri runtimeu vseeno nosijo — intersekcija ohrani
    // točen tip in hkrati zadosti listener podpisu map.on("error", ...).
    const onError = (event: MlErrorEvent & { sourceId?: string }) => {
      // Napaka posamezne ploščice po nalaganju ne razglasi celega zemljevida
      // za pokvarjenega. Pred nalaganjem je napaka brez sourceId znak, da
      // se slog/worker morda ne naloži; ob uspešnem load ostane karta uporabna.
      if (loadedRef.current || event.sourceId) return;
      setFailed(true);
    };

    const onMove = () => syncMarkers();
    map.on("load", onLoad);
    map.on("move", onMove);
    map.on("error", onError);

    return () => {
      map.off("load", onLoad);
      map.off("move", onMove);
      map.off("error", onError);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
      markersRef.current.clear();
      clusterMarkersRef.current.clear();
      syncMarkersRef.current = null;
      loadedRef.current = false;
    };
  }, [l]);

  // Filtriramo že ustvarjene markerje in prilagodimo pogled; zemljevid se
  // ne ustvarja znova ob vsakem vnosu v iskalno polje. Prikaži/skrij presodi
  // syncMarkers — filtri in gručenje v ENEM mestu, zato gruče nastajajo
  // samo med vidnimi (filtriranimi) destinacijami.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    visibleSlugsRef.current = new Set(filteredDestinations.map((item) => item.slug));
    syncMarkersRef.current?.();
    if (filteredDestinations.length === 1) {
      const item = filteredDestinations[0];
      map.flyTo({
        center: [item.coords.lng, item.coords.lat],
        zoom: 11,
        essential: true,
      });
    } else if (filteredDestinations.length > 1) {
      const bounds = new LngLatBounds();
      for (const item of filteredDestinations) {
        bounds.extend([item.coords.lng, item.coords.lat]);
      }
      map.fitBounds(bounds, { padding: 40, maxZoom: 8, duration: 250 });
    }
  }, [ready, filteredDestinations]);

  // Ko uporabnik preklopi s seznama nazaj na zemljevid, MapLibre znova
  // izmeri vsebnik (skriti display:none je sicer lahko imel širino 0).
  React.useEffect(() => {
    if (mobileView === "map") mapRef.current?.resize();
  }, [mobileView]);

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
    add: {
      sl: "Dodaj v mojo pot",
      en: "Add to my trip",
      it: "Aggiungi al mio viaggio",
      de: "Zu meiner Reise hinzufügen",
      fr: "Ajouter à mon voyage",
      es: "Añadir a mi viaje",
    },
    added: {
      sl: "V moji poti",
      en: "In my trip",
      it: "Nel mio viaggio",
      de: "In meiner Reise",
      fr: "Dans mon voyage",
      es: "En mi viaje",
    },
    more: {
      sl: "Več",
      en: "More",
      it: "Dettagli",
      de: "Mehr",
      fr: "Plus",
      es: "Más",
    },
    searchLabel: {
      sl: "Išči destinacijo, opis ali zanimivost",
      en: "Search destinations, descriptions or highlights",
      it: "Cerca destinazioni, descrizioni o punti salienti",
      de: "Reiseziele, Beschreibungen oder Highlights suchen",
      fr: "Rechercher des destinations, descriptions ou points forts",
      es: "Buscar destinos, descripciones o lugares destacados",
    },
    allCountries: {
      sl: "Vse države",
      en: "All countries",
      it: "Tutti i paesi",
      de: "Alle Länder",
      fr: "Tous les pays",
      es: "Todos los países",
    },
    allRegions: {
      sl: "Vse regije",
      en: "All regions",
      it: "Tutte le regioni",
      de: "Alle Regionen",
      fr: "Toutes les régions",
      es: "Todas las regiones",
    },
    allTypes: {
      sl: "Vsi tipi",
      en: "All types",
      it: "Tutti i tipi",
      de: "Alle Typen",
      fr: "Tous les types",
      es: "Todos los tipos",
    },
    mapView: {
      sl: "Zemljevid",
      en: "Map",
      it: "Mappa",
      de: "Karte",
      fr: "Carte",
      es: "Mapa",
    },
    listView: {
      sl: "Seznam",
      en: "List",
      it: "Elenco",
      de: "Liste",
      fr: "Liste",
      es: "Lista",
    },
    clearFilters: {
      sl: "Ponastavi filtre",
      en: "Clear filters",
      it: "Azzera filtri",
      de: "Filter zurücksetzen",
      fr: "Effacer les filtres",
      es: "Borrar filtros",
    },
    results: {
      sl: "destinacij",
      en: "destinations",
      it: "destinazioni",
      de: "Reiseziele",
      fr: "destinations",
      es: "destinos",
    },
    noResults: {
      sl: "Nobena destinacija ne ustreza izbranim filtrom.",
      en: "No destination matches these filters.",
      it: "Nessuna destinazione corrisponde ai filtri.",
      de: "Keine Destination entspricht diesen Filtern.",
      fr: "Aucune destination ne correspond à ces filtres.",
      es: "Ningún destino coincide con estos filtros.",
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

      {/* Iskanje + filtri uporabljajo isto deterministično logiko kot Leaflet. */}
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="sr-only">{pick(l, L.searchLabel)}</span>
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={pick(l, L.searchLabel)}
            aria-label={pick(l, L.searchLabel)}
            className="h-11 w-full min-w-0 rounded-xl border border-border/70 bg-background px-4 text-sm shadow-sm outline-offset-2 focus-visible:outline"
          />
        </label>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="sr-only">{pick(l, L.allCountries)}</span>
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              aria-label={pick(l, L.allCountries)}
              className="h-11 w-full min-w-0 rounded-xl border border-border/70 bg-background px-3 text-sm"
            >
              <option value="all">{pick(l, L.allCountries)}</option>
              {activeCountries.map((code) => (
                <option key={code} value={code}>{countryLabel(l, code)}</option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">{pick(l, L.allRegions)}</span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              aria-label={pick(l, L.allRegions)}
              className="h-11 w-full min-w-0 rounded-xl border border-border/70 bg-background px-3 text-sm"
            >
              <option value="all">{pick(l, L.allRegions)}</option>
              {activeRegions.map((key) => (
                <option key={key} value={key}>{regionLabel(key, l)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="group" aria-label={pick(l, L.allTypes)}>
          <button
            type="button"
            onClick={() => setType("all")}
            aria-pressed={type === "all"}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${type === "all" ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {pick(l, L.allTypes)}
          </button>
          {(Object.keys(DEST_TYPES) as DestinationType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(type === key ? "all" : key)}
              aria-pressed={type === key}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium ${type === key ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
            >
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
              {pick(l, DEST_TYPES[key])}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2 lg:hidden" role="group" aria-label={pick(l, L.mapView)}>
            <button
              type="button"
              onClick={() => setMobileView("map")}
              aria-pressed={mobileView === "map"}
              className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${mobileView === "map" ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
            >{pick(l, L.mapView)}</button>
            <button
              type="button"
              onClick={() => setMobileView("list")}
              aria-pressed={mobileView === "list"}
              className={`min-h-11 rounded-lg border px-4 text-sm font-medium ${mobileView === "list" ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
            >{pick(l, L.listView)}</button>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filteredDestinations.length} {pick(l, L.results)}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setQ(""); setCountry("all"); setRegion("all"); setType("all"); }}
              className="min-h-11 rounded-lg border border-border bg-background px-4 text-sm font-medium"
            >{pick(l, L.clearFilters)}</button>
          )}
        </div>
      </div>

      {/* Mapa in seznam sta sinhronizirana; na telefonu je privzeto viden zemljevid. */}
      <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className={mobileView === "list" ? "max-lg:hidden" : ""}>
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
        <section
          aria-label={pick(l, L.listView)}
          className={`min-w-0 rounded-xl border border-border/70 bg-card p-3 sm:p-4 ${mobileView === "map" ? "max-lg:hidden" : ""} lg:max-h-[calc(100svh-13rem)] lg:overflow-y-auto`}
        >
          {filteredDestinations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{pick(l, L.noResults)}</p>
          ) : (
            <ul className="space-y-2">
              {filteredDestinations.map((destination) => {
                const inTrip = tripItems.some((item) => item.refId === destination.slug);
                return (
                  <li key={destination.slug} className="min-w-0 rounded-lg border border-border/60 p-3">
                    <button
                      type="button"
                      onClick={() => showDestination(destination.slug)}
                      className="block min-h-11 w-full break-words text-left font-semibold underline-offset-4 hover:underline"
                    >{destination.name}</button>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {typeLabel(destination.type, l)} · {countryLabel(l, destination.country)} · {regionLabel(destination.region, l)}
                    </p>
                    <p className="mt-1 break-words text-sm text-muted-foreground">{destination.tagline}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={inTrip}
                        onClick={() => addToTrip(destination.slug, destination.name)}
                        className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 text-xs font-medium disabled:cursor-default disabled:opacity-60"
                      >{inTrip ? pick(l, L.added) : pick(l, L.add)}</button>
                      <Link
                        href={`/destinacija/${destination.slug}`}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                      >{pick(l, L.more)}</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
