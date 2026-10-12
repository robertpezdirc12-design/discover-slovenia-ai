"use client";

/**
 * TRAVEL-MAP — polen Leaflet zemljevid 38 destinacij (rekonstrukcija /zemljevid).
 *
 * Leaflet/OSM (react-leaflet 5, leaflet 1.9): MapContainer s slojem
 * tile.openstreetmap.org, markerji za VSE destinacije kanonskega nabora
 * (divIcon po tipu — BREZ slikovnih ikon, kar obide znano težavo
 * bundler+leaflet z manjkajočimi ikonami), popup z dejanskimi podatki
 * destinacije + gumboma "Dodaj v mojo pot" in "Več". Nad zemljevidom
 * filtri (tip/regija/iskanje), ob njem sinhroniziran seznam (hover/klik),
 * pod njim legenda tipov.
 *
 * PLASTI (FAZA 3 / 51-b):
 *  ① "Lokali" — preklop, ki ob povečavi ≥ 15 pridobi pine lokalov iz
 *     /api/map/pins (debounce 400 ms ob premiku); koordinate lokalov so
 *     IZPELJANE iz središča destinacije in v popupu iskreno označene.
 *  ② "Pot" — če ima uporabnik ≥ 2 destinaciji v Moji poti, gumb nariše
 *     vozno pot prek /api/journey/route (OSRM = polna črta; hevristična
 *     ocena = črtkana premica z oznako — nikoli prikrito kot OSRM).
 *  ③ "Bencinske" (v2.5.0, analiza MindTrip) — preklop, ki pridobi črpalke
 *     iz /api/map/fuel za trenutni pogled (kurirani odprti podatki OSM,
 *     pošteno označena PRIbližna lega; brez cen goriv — uravnavane in
 *     spremenljive). Prikaz na vseh ravneh povečave (država → koridorji).
 *  ④ Rezervacijske povezave v popupu destinacije (v2.5.0): nastanitev /
 *     doživetje / leti / rent-a-car prek /api/affiliate/go (vodeni klik,
 *     rel="sponsored" — provizijski model po vzorcu MindTrip).
 *  ⑤ "POI (OSM živo)" (P0-C) — preklop, ki ob moveend (debounce 600 ms)
 *     pridobi žive POI iz /api/pois (javni Overpass vir; obvezna
 *     atribucija ODbL, vidna vedno ko je plast vklopljena). Namerni
 *     limti vira so iskerno izpisani: viewport > 0,25°² → amber pasica
 *     „približajte zemljevid" (brez markerjev); 429/502 → dostojna amber
 *     pasica + retry (po 429 ≥ 6 s brez novih klicev — refetchBlock).
 *
 * Hidracija: komponento nalagamo IZKLJUČNO klientno prek next/dynamic
 * ssr:false (glej app/[locale]/zemljevid/page.tsx) — Leaflet potrebuje
 * window, zato SSR ni mogoč (nalagalni Skeleton med čakanjem).
 */

import L from "leaflet";
import {
  Check,
  Fuel,
  Heart,
  List,
  Loader2,
  Map as MapIcon,
  MapPin,
  RotateCw,
  Route,
  Search,
  Star,
  Store,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import { AffiliateChip } from "@/components/affiliate-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/navigation";
import { pick } from "@/lib/i18n-pick";
import { LOKAL_CATEGORIES, type LokalCategory } from "@/lib/lokali-data";
import { myTrip, useMyTripList } from "@/lib/my-trip";
import {
  DEST_TYPES,
  DESTINATIONS,
  REGIONS,
  type Destination,
  type DestinationType,
  regionLabel,
  typeLabel,
} from "@/lib/slovenia-data";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

/** Barvna paleta tipov (zemeljski toni — brez indigo/modre sheme). */
const TYPE_COLORS: Record<DestinationType, string> = {
  castle: "#8B5E3C",
  cave: "#757575",
  city: "#C77D2E",
  coast: "#2A9D8F",
  gorge: "#6B8E23",
  lake: "#1E7F86",
  mountain: "#8D6E63",
  river: "#48A9A6",
  spa: "#C2586E",
};

/** Barve pinov lokalov po kategoriji (zemeljski toni — ločeno od tipov). */
const LOKAL_COLORS: Record<LokalCategory, string> = {
  hotel: "#8B5E3C",
  restaurant: "#C77D2E",
  bar: "#C2586E",
  activity: "#6B8E23",
  shop: "#A0522D",
  transport: "#616A6B",
  other: "#7A6C5D",
};

/** Barva plasti Pot — primarna zelena teme (#2d6a3e). */
const ROUTE_COLOR = "#2d6a3e";

/** Sredina pogleda: Slovenija; zoom, ki primerja državo na enem pogledu. */
const MAP_CENTER: [number, number] = [46.15, 14.5];
const MAP_ZOOM = 8;

/** divIcon marker po tipu (aktivni/hover marker je večji). */
function typeIcon(type: DestinationType, active: boolean): L.DivIcon {
  const color = TYPE_COLORS[type];
  const size = active ? 20 : 14;
  return L.divIcon({
    className: "dsa-map-pin",
    html:
      `<span style="box-sizing:border-box;display:block;width:${size}px;height:${size}px;` +
      `border-radius:9999px;background:${color};border:3px solid #fff;` +
      `box-shadow:0 1px 4px rgba(0,0,0,.45);transition:width .12s,height .12s"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

/**
 * divIcon marker lokalnega pina — majhen zaobljen kvadrat (ločen izgled od
 * destinacijskih krogov: manjši, drugačen lik, barva po kategoriji).
 */
function lokalIcon(type: string): L.DivIcon {
  const color = LOKAL_COLORS[type as LokalCategory] ?? LOKAL_COLORS.other;
  const size = 10;
  return L.divIcon({
    className: "dsa-map-pin",
    html:
      `<span style="box-sizing:border-box;display:block;width:${size}px;height:${size}px;` +
      `border-radius:3px;background:${color};border:2px solid #fff;` +
      `box-shadow:0 1px 3px rgba(0,0,0,.45)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

/**
 * divIcon marker bencinske črpalke (v2.5.0) — ZA OBRNJEN KVADRAT
 * (romb) v topli sivi, ločeno od krogov destinacij in kvadratov lokalov
 * po obliki IN barvi; brez slikovnih ikon (isti kanon kot ostali pini).
 */
function fuelIcon(): L.DivIcon {
  const size = 12;
  return L.divIcon({
    className: "dsa-map-pin",
    html:
      `<span style="box-sizing:border-box;display:block;width:${size}px;height:${size}px;` +
      `transform:rotate(45deg);border-radius:2.5px;background:#57534E;border:2px solid #fff;` +
      `box-shadow:0 1px 3px rgba(0,0,0,.45)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

/**
 * Barve POI markerjev po vrsti (kind) — živi OSM sloj (P0-C). Zemeljski
 * toni projekta; POI so NAJMANJŠI krožci na zemljevidu (9 px, tanka
 * bela obroba), ločeni od destinacijskih krogov (14 px) in lokalnih
 * kvadratov (10 px) po velikosti in gostoti.
 */
const POI_KIND_COLORS: Record<string, string> = {
  tourism: "#C2586E", // atrakcija (turizem)
  "amenity=restaurant": "#C77D2E", // restavracija
  "amenity=cafe": "#8B5E3C", // kavarna
  "amenity=bar": "#A0522D", // bar
  "amenity=fast_food": "#B08968", // hitra hrana
  historic: "#757575", // zgodovinska točka
  "leisure=park": "#6B8E23", // park
  "natural=beach": "#2A9D8F", // plaža
  "amenity=fuel": "#57534E", // črpalka
};

/** Oznake vrst POI (kind → jezik; SL kanon + EN). */
const POI_KIND_LABELS_SL: Record<string, string> = {
  tourism: "atrakcija",
  "amenity=restaurant": "restavracija",
  "amenity=cafe": "kavarna",
  "amenity=bar": "bar",
  "amenity=fast_food": "hitra hrana",
  historic: "zgodovinska točka",
  "leisure=park": "park",
  "natural=beach": "plaža",
  "amenity=fuel": "bencinska črpalka",
};
const POI_KIND_LABELS_EN: Record<string, string> = {
  tourism: "attraction",
  "amenity=restaurant": "restaurant",
  "amenity=cafe": "café",
  "amenity=bar": "bar",
  "amenity=fast_food": "fast food",
  historic: "historic site",
  "leisure=park": "park",
  "natural=beach": "beach",
  "amenity=fuel": "fuel station",
};
const POI_KIND_LABELS_IT: Record<string, string> = {
  tourism: "attrazione",
  "amenity=restaurant": "ristorante",
  "amenity=cafe": "caffè",
  "amenity=bar": "bar",
  "amenity=fast_food": "fast food",
  historic: "sito storico",
  "leisure=park": "parco",
  "natural=beach": "spiaggia",
  "amenity=fuel": "benzinaio",
};
const POI_KIND_LABELS_DE: Record<string, string> = {
  tourism: "Sehenswürdigkeit",
  "amenity=restaurant": "Restaurant",
  "amenity=cafe": "Café",
  "amenity=bar": "Bar",
  "amenity=fast_food": "Fastfood",
  historic: "historische Stätte",
  "leisure=park": "Park",
  "natural=beach": "Strand",
  "amenity=fuel": "Tankstelle",
};
const POI_KIND_LABELS_FR: Record<string, string> = {
  tourism: "attraction",
  "amenity=restaurant": "restaurant",
  "amenity=cafe": "café",
  "amenity=bar": "bar",
  "amenity=fast_food": "restauration rapide",
  historic: "site historique",
  "leisure=park": "parc",
  "natural=beach": "plage",
  "amenity=fuel": "station-service",
};
const POI_KIND_LABELS_ES: Record<string, string> = {
  tourism: "atracción",
  "amenity=restaurant": "restaurante",
  "amenity=cafe": "cafetería",
  "amenity=bar": "bar",
  "amenity=fast_food": "comida rápida",
  historic: "sitio histórico",
  "leisure=park": "parque",
  "natural=beach": "playa",
  "amenity=fuel": "gasolinera",
};

/** divIcon marker živega OSM POI — majhen krogec po kind (P0-C). */
function poiIcon(kind: string): L.DivIcon {
  const color = POI_KIND_COLORS[kind] ?? "#7A6C5D";
  const size = 9;
  return L.divIcon({
    className: "dsa-map-pin",
    html:
      `<span style="box-sizing:border-box;display:block;width:${size}px;height:${size}px;` +
      `border-radius:9999px;background:${color};border:2px solid #fff;` +
      `box-shadow:0 1px 3px rgba(0,0,0,.45)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

/** Pin iz /api/map/pins (pins način, zoom ≥ 15). */
interface MapPinDTO {
  id: string;
  lat: number;
  lng: number;
  type: string;
  name: string;
  precision: "exact" | "destination_center";
}

/** Odgovor /api/map/pins — grid nosi cells, pins način nosi pins. */
interface PinsApiResponseDTO {
  mode: "grid" | "pins";
  cells?: unknown;
  pins?: MapPinDTO[];
  total: number;
  returned: number;
  capped: boolean;
}

/** Črpalka iz /api/map/fuel (v2.5.0 — kurirani odprti podatki OSM). */
interface FuelStationDTO {
  id: string;
  name: string;
  brand: string;
  lat: number;
  lng: number;
  fuels: string[];
  highway: boolean;
}

/** Odgovor /api/map/fuel. */
interface FuelApiResponseDTO {
  stations: FuelStationDTO[];
  total: number;
  returned: number;
  precision: string;
}

/** POI iz /api/pois (P0-C — živi OSM Overpass sloj po viewportu). */
interface OsmPoiDTO {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Vrsta (prvi ujemajoč filter, npr. „tourism" ali „amenity=cafe"). */
  kind: string;
  tags: Record<string, string>;
}

/** Odgovor /api/pois (ok = pois; error ima razlog + atribucijo ODbL). */
interface PoisApiResponseDTO {
  status: "ok" | "error";
  total?: number;
  pois?: OsmPoiDTO[];
  attribution?: string;
  error?: string;
  endpoint?: string;
}

/** Odsek poti iz /api/journey/route. */
interface JourneyLegDTO {
  from: string;
  to: string;
  km: number;
  min: number;
  source: "osrm" | "heuristic";
  geometry: [number, number][];
}

interface JourneyRouteDTO {
  legs: JourneyLegDTO[];
  totalKm: number;
  totalMin: number;
  method: "osrm" | "heuristic" | "mixed";
}

/** Stanje plasti Pot (iskrene napake — pot se nikoli ne izmišljuje). */
type RouteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; data: JourneyRouteDTO };

/**
 * FIT-BOUNDS krmilnik: ob spremembi filtrov pogled obsegne vidne markerje.
 * (Child znotraj MapContainer — kanon za imperativni dostop do instance
 * zemljevida v react-leaflet.)
 */
function FitBounds({ dests }: { dests: Destination[] }) {
  const map = useMap();
  const lastKey = React.useRef("");

  React.useEffect(() => {
    const key = dests.map((d) => d.slug).join("|");
    if (key === lastKey.current || dests.length === 0) return;
    lastKey.current = key;
    if (dests.length === 1) {
      map.setView([dests[0].coords.lat, dests[0].coords.lng], 11);
      return;
    }
    const bounds = L.latLngBounds(
      dests.map((d) => [d.coords.lat, d.coords.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 10 });
  }, [dests, map]);

  return null;
}

/** Plast Lokali — prag zoom za prikaz pinov lokalov (usklajeno z API: zoom ≥ 15). */
const LOKALI_MIN_ZOOM = 15;

/**
 * PLAST "LOKALI" — krmilnik pridobivanja pinov: ob vključitvi takoj, nato
 * ob vsakem premiku/povečavi (moveend/zoomend, debounce 400 ms) zahteva
 * /api/map/pins za trenutni pogled. Zahtevek se prekliče ob izklopu
 * plasti ali odmontiranju (AbortController) — brez obeženih zahtevkov.
 *
 * Pri zoom < 15 zahtevek SPLOŠNO NE GRE NA OMREŽJE: strežnik bi agregiral
 * pine v celice, ki jih ne rišemo — iskren hint „povečaj" je pravilen
 * odziv (in priprega tudi 400 ob preširokem pogledu cele države).
 *
 * Pine tipa "destination" starš ne riše: destinacije so že stalna plast
 * zemljevida (brez dvojnikov na istih koordinatah).
 */
function LokaliLayer({
  enabled,
  onResult,
  onError,
  onLoading,
  retryKey,
}: {
  enabled: boolean;
  onResult: (pins: MapPinDTO[], mode: "grid" | "pins") => void;
  onError: () => void;
  onLoading: () => void;
  retryKey: number;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: number | undefined;

    const fetchPins = async () => {
      const bounds = map.getBounds();
      const zoom = Math.round(map.getZoom());
      if (zoom < LOKALI_MIN_ZOOM) {
        // Iskren hint namesto brezpomenslenega zahtevka (celic ne rišemo;
        // preširok pogled bi sicer dobil 400 po razponu bbox).
        onResult([], "grid");
        return;
      }
      onLoading();
      try {
        const res = await fetch(
          `/api/map/pins?bbox=${bounds.getSouth().toFixed(6)},${bounds
            .getWest()
            .toFixed(6)},${bounds.getNorth().toFixed(6)},${bounds
            .getEast()
            .toFixed(6)}&zoom=${zoom}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("pins");
        const data = (await res.json()) as PinsApiResponseDTO;
        if (data.mode === "pins") {
          onResult(
            (data.pins ?? []).filter((p) => p.type !== "destination"),
            "pins"
          );
        } else {
          // zoom < 15: strežnik agregira v celice — teh ne rišemo, ampak
          // iskerno povemo, da je treba povečati (hint chip v staršu).
          onResult([], "grid");
        }
      } catch {
        if (controller.signal.aborted) return; // izklop — tiho
        onError();
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fetchPins, 400);
    };

    void fetchPins();
    map.on("moveend", schedule);
    map.on("zoomend", schedule);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
    };
  }, [enabled, map, onResult, onError, onLoading, retryKey]);

  return null;
}

/**
 * PLAST "BENCINSKE" (v2.5.0) — krmilnik pridobivanja črpalk iz
 * /api/map/fuel za trenutni pogled (moveend/zoomend, debounce 400 ms).
 * Brez praga povečave: črpalke so redke (66 po državi), zato so smiselne
 * že na ravni cele države. Preklic ob izklopu/odmontiranju (AbortController)
 * — isti kanon kot plast Lokali. Napaka se izpiše iskreno (retry chip).
 */
function FuelLayer({
  enabled,
  onResult,
  onError,
  onLoading,
  retryKey,
}: {
  enabled: boolean;
  onResult: (stations: FuelStationDTO[]) => void;
  onError: () => void;
  onLoading: () => void;
  retryKey: number;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: number | undefined;

    const fetchStations = async () => {
      const bounds = map.getBounds();
      onLoading();
      try {
        const res = await fetch(
          `/api/map/fuel?bbox=${bounds.getSouth().toFixed(6)},${bounds
            .getWest()
            .toFixed(6)},${bounds.getNorth().toFixed(6)},${bounds
            .getEast()
            .toFixed(6)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("fuel");
        const data = (await res.json()) as FuelApiResponseDTO;
        onResult(Array.isArray(data.stations) ? data.stations : []);
      } catch {
        if (controller.signal.aborted) return; // izklop — tiho
        onError();
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fetchStations, 400);
    };

    void fetchStations();
    map.on("moveend", schedule);
    map.on("zoomend", schedule);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
    };
  }, [enabled, map, onResult, onError, onLoading, retryKey]);

  return null;
}

/**
 * PLAST "POI (OSM žIVO)" (P0-C) — krmilnik pridobivanja živih POI iz
 * /api/pois za trenutni pogled (moveend/zoomend, debounce 600 ms).
 *
 * ISKRENO RAVNANJE Z JAVNIM VIROM (Overpass):
 *  · viewport > 0,25°² → API 400 „viewport prevelik" → amber pasica
 *    „približajte zemljevid", BREZ markerjev (namerna omejitev vira);
 *  · 429 (rate limit 5 s) → napaka + po njej ≥ 6 s brez novih klicev
 *    (refetchBlock timestamp — spoštljivo hlajenje proti javnemu viru);
 *  · vsak nov fetch prekliče prejšnjega in-flight (AbortController) —
 *    ob izklopu plasti/odmontiranju ostane 0 obeženih zahtevkov.
 */
const POI_FETCH_DEBOUNCE_MS = 600;
const POI_REFETCH_BLOCK_MS = 6000;

function OsmPoiLayer({
  enabled,
  onResult,
  onViewportTooBig,
  onError,
  onLoading,
  retryKey,
}: {
  enabled: boolean;
  onResult: (pois: OsmPoiDTO[]) => void;
  onViewportTooBig: () => void;
  onError: () => void;
  onLoading: () => void;
  retryKey: number;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let inflight: AbortController | null = null;
    // Po 429 (rate limit javnega vira) ≥ 6 s ne ponavljamo klica —
    // enostavni refetchBlock timestamp (naloga P0-C UI).
    let refetchBlockedUntil = 0;

    const fetchPois = async () => {
      const bounds = map.getBounds();
      onLoading();
      // Vsak nov fetch prekliče prejšnjega in-flight (brez podvajanja
      // in brez tvegane zamenjave vrstn reda odzivov).
      inflight?.abort();
      const controller = new AbortController();
      inflight = controller;
      try {
        const res = await fetch(
          `/api/pois?bbox=${bounds.getSouth().toFixed(6)},${bounds
            .getWest()
            .toFixed(6)},${bounds.getNorth().toFixed(6)},${bounds
            .getEast()
            .toFixed(6)}`,
          { signal: controller.signal }
        );
        if (res.status === 400) {
          // Uporabniška omejitev (pogled preširok) — ločena od napak
          // omrežja; razlog iz telesa preverimo, ne ugibamo.
          let tooBig = false;
          try {
            const body = (await res.json()) as { error?: string };
            tooBig =
              typeof body.error === "string" &&
              body.error.includes("viewport prevelik");
          } catch {
            /* okvarjeno telo ne sme zlomiti stanja */
          }
          if (tooBig) onViewportTooBig();
          else onError();
          return;
        }
        if (res.status === 429) {
          // Javni vir nas je omejil — ohladimo vsaj 6 s (limit API-ja 5 s).
          refetchBlockedUntil = Date.now() + POI_REFETCH_BLOCK_MS;
          onError();
          return;
        }
        if (!res.ok) {
          onError(); // 502 ipd. — zunanji vir, dostojna pasica v staršu
          return;
        }
        const data = (await res.json()) as PoisApiResponseDTO;
        if (data.status !== "ok" || !Array.isArray(data.pois)) {
          onError();
          return;
        }
        onResult(data.pois);
      } catch {
        if (controller.signal.aborted) return; // izklop/nadomestitev — tiho
        onError();
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      if (Date.now() < refetchBlockedUntil) return; // hlajenje po 429
      timer = window.setTimeout(fetchPois, POI_FETCH_DEBOUNCE_MS);
    };

    void fetchPois();
    map.on("moveend", schedule);
    map.on("zoomend", schedule);

    return () => {
      window.clearTimeout(timer);
      inflight?.abort(); // izklop = preklic in-flight fetcha
      map.off("moveend", schedule);
      map.off("zoomend", schedule);
    };
  }, [enabled, map, onResult, onViewportTooBig, onError, onLoading, retryKey]);

  return null;
}

/** Popup ene črpalke (veriga, ime, goriva, iskrena opomba o legi). */
function FuelPinPopup({
  s,
  labels,
}: {
  s: FuelStationDTO;
  labels: {
    fuelApproximate: string;
    fuelHighway: string;
    fuelFuels: string;
    fuelSource: string;
  };
}) {
  return (
    <div className="w-[190px]">
      <p className="text-[11px] font-medium text-muted-foreground">{s.brand}</p>
      <h3 className="text-sm leading-tight font-bold">{s.name}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {labels.fuelFuels}: {s.fuels.join(" · ")}
      </p>
      {s.highway && (
        <p className="mt-1 inline-flex rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {labels.fuelHighway}
        </p>
      )}
      {/* Iskrenost: koordinate črpalk so PRIbližne (kurirani odprti podatki
          OSM — občina/priključek) in tako tudi označene; brez cen goriv. */}
      <p className="mt-1 text-[11px] text-muted-foreground italic">
        {labels.fuelApproximate}
      </p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        {labels.fuelSource}
      </p>
    </div>
  );
}

/**
 * Popup enega živega OSM POI (P0-C): vrsta (kind), ime, relevantne
 * oznake in OBVEZNA atribucija ODbL (vir je vedno razkrit).
 */
function OsmPoiPopup({
  poi,
  kindLabel,
  attribution,
}: {
  poi: OsmPoiDTO;
  kindLabel: string;
  attribution: string;
}) {
  return (
    <div className="w-[190px]">
      <p className="text-[11px] font-medium text-muted-foreground">{kindLabel}</p>
      <h3 className="text-sm leading-tight font-bold">{poi.name}</h3>
      {poi.tags.cuisine && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {poi.tags.cuisine}
        </p>
      )}
      {poi.tags.opening_hours && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {poi.tags.opening_hours}
        </p>
      )}
      {poi.tags.website && (
        <a
          href={poi.tags.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate text-[11px] font-medium text-primary hover:underline"
        >
          {poi.tags.website.replace(/^https?:\/\//, "")}
        </a>
      )}
      {/* ODbL: atribucija ob vsaki uporabi podatkov OSM. */}
      <p className="mt-1 text-[10px] text-muted-foreground">{attribution}</p>
    </div>
  );
}

/** Popup enega lokalnega pina (kategorija, ime, iskrena opomba o lokaciji). */
function LokalPinPopup({
  pin,
  locale,
  labels,
}: {
  pin: MapPinDTO;
  locale: string;
  labels: { approximate: string; venuesLink: string };
}) {
  const cat = LOKAL_CATEGORIES[pin.type as LokalCategory];
  const catLabel = pick(locale, {
    sl: cat?.sl ?? LOKAL_CATEGORIES.other.sl,
    en: cat?.en ?? LOKAL_CATEGORIES.other.en,
    it: cat?.it ?? LOKAL_CATEGORIES.other.it,
    de: cat?.de ?? LOKAL_CATEGORIES.other.de,
    fr: cat?.fr ?? LOKAL_CATEGORIES.other.fr,
    es: cat?.es ?? LOKAL_CATEGORIES.other.es,
  });
  return (
    <div className="w-[190px]">
      <p className="text-[11px] font-medium text-muted-foreground">{catLabel}</p>
      <h3 className="text-sm leading-tight font-bold">{pin.name}</h3>
      {/* Iskrenost: koordinate lokalov so IZPELJANE iz središča povezane
          destinacije (precision "destination_center") — nikoli prikazane
          kot natančne lokacije. */}
      {pin.precision === "destination_center" && (
        <p className="mt-1 text-[11px] text-muted-foreground italic">
          {labels.approximate}
        </p>
      )}
      <Button
        asChild
        size="sm"
        variant="outline"
        className="mt-2 h-8 w-full text-xs"
      >
        <Link href="/lokali">{labels.venuesLink}</Link>
      </Button>
    </div>
  );
}

/** Popup ene destinacije (slika, ime, tagline, ocena, gumba). */
function DestinationPopup({
  d,
  inTrip,
  onAdd,
  labels,
  locale,
}: {
  d: Destination;
  inTrip: boolean;
  onAdd: (d: Destination) => void;
  labels: {
    add: string;
    added: string;
    more: string;
    ratingOf: (v: string) => string;
    bookTitle: string;
    bookStays: string;
    bookExperiences: string;
    bookFlights: string;
    bookCar: string;
    bookingLinksNote: string;
  };
  locale: string;
}) {
  return (
    <div className="w-[218px]">
      <div className="relative aspect-[3/2] overflow-hidden rounded-md bg-muted">
        <Image
          src={d.image}
          alt={`${d.name} — ${d.tagline}`}
          fill
          sizes="218px"
          className="object-cover"
        />
      </div>
      <p className="mt-2 text-[11px] font-medium text-muted-foreground">
        {regionLabel(d.region, locale)} · {typeLabel(d.type, locale)}
      </p>
      <h3 className="text-sm leading-tight font-bold">{d.name}</h3>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{d.tagline}</p>
      <p className="mt-1 flex items-center gap-1 text-xs font-semibold">
        <Star className="size-3.5 fill-primary text-primary" aria-hidden="true" />
        {d.rating.toFixed(1)}
        <span className="sr-only">{labels.ratingOf(d.rating.toFixed(1))}</span>
      </p>
      <div className="mt-2 flex gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={inTrip ? "secondary" : "default"}
          className="h-8 flex-1 text-xs"
          onClick={() => onAdd(d)}
          aria-disabled={inTrip}
        >
          {inTrip ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Heart className="size-3.5" aria-hidden="true" />
          )}
          {inTrip ? labels.added : labels.add}
        </Button>
        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
          <Link href={`/destinacija/${d.slug}`}>{labels.more}</Link>
        </Button>
      </div>

      {/* ── Rezervacijske povezave (v2.5.0, provizijski sloj) ──────────
          Vodeni klik prek /api/affiliate/go (strežnik zapiše klik in
          preusmeri k partnerju); rel="sponsored" je obvezen razkrivni
          atribut affiliate povezav, mikrovrstica pa uporabniku iskreno
          pove, da partner izplača provizijo brez višje cene. */}
      <div className="mt-2 border-t pt-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          {labels.bookTitle}
        </p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
          >
            <a
              href={`/api/affiliate/go?provider=booking&dest=${d.slug}`}
              target="_blank"
              rel="nofollow sponsored noopener"
            >
              {labels.bookStays}
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
          >
            <a
              href={`/api/affiliate/go?provider=getyourguide&dest=${d.slug}`}
              target="_blank"
              rel="nofollow sponsored noopener"
            >
              {labels.bookExperiences}
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
          >
            <a
              href={`/api/affiliate/go?provider=kiwi&dest=${d.slug}`}
              target="_blank"
              rel="nofollow sponsored noopener"
            >
              {labels.bookFlights}
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
          >
            <a
              href={`/api/affiliate/go?provider=rentalcars&dest=${d.slug}`}
              target="_blank"
              rel="nofollow sponsored noopener"
            >
              {labels.bookCar}
            </a>
          </Button>
        </div>
        {/* POLIR B (FTC): razkritje OB povezavah — čip vodi na
            /zaupanje-in-varnost (celotna objava o proviziji). */}
        <div className="mt-1.5 flex justify-center">
          <AffiliateChip />
        </div>
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
          {labels.bookingLinksNote}
        </p>
      </div>
    </div>
  );
}

/** ZEMLJEVID RAZISKOVALEC — filtri + zemljevid + sinhroniziran seznam. */
export default function TravelMap() {
  const l = useLocale();
  const { toast } = useToast();
  const tripItems = useMyTripList();

  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | DestinationType>("all");
  const [region, setRegion] = React.useState<string>("all");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // ── POLIR14 (2.41.0): mobilni preklop pogleda „Zemljevid ⇄ Seznam“ ──
  // Privzeto „map“ — zemljevid je NAMEN strani (raziskava §3.3: prej je
  // bil zemljevid šele na y=735 od 844 px prvega zaslona @390×844, seznam
  // pa 472 px pod pragom; saasfactor kanon „list-vs-map toggle should be
  // persistent and easy to switch“ — vrstica je vedno prisoten, lg:hidden).
  const [mobileView, setMobileView] = React.useState<"map" | "list">("map");

  // ── Plasti (FAZA 3 / 51-b): Lokali (pins API) + Pot (OSRM route) ────
  const [lokaliOn, setLokaliOn] = React.useState(false);
  const [lokaliPins, setLokaliPins] = React.useState<MapPinDTO[]>([]);
  const [lokaliMode, setLokaliMode] = React.useState<"grid" | "pins" | null>(
    null
  );
  const [lokaliError, setLokaliError] = React.useState(false);
  // Issue #1 §4 — loading/empty/error stanja plasti: shimmer chip med
  // nalaganjem pinov, subtilno prazno stanje (0 pinov v bbox) in retry
  // ob napaki (iskren odgoviv, ne tiha napaka).
  const [lokaliLoading, setLokaliLoading] = React.useState(false);
  const [lokaliRetryKey, setLokaliRetryKey] = React.useState(0);
  // ── Plast Bencinske (v2.5.0, provizijska analiza MindTrip) — črpalke
  // iz /api/map/fuel za trenutni pogled; enak vzorec stanj kot Lokali
  // (loading/empty/error + retry, ob izklopu takoj počiščeno). ─────────
  const [fuelOn, setFuelOn] = React.useState(false);
  const [fuelStations, setFuelStations] = React.useState<FuelStationDTO[]>([]);
  const [fuelLoading, setFuelLoading] = React.useState(false);
  const [fuelError, setFuelError] = React.useState(false);
  const [fuelEmpty, setFuelEmpty] = React.useState(false);
  const [fuelRetryKey, setFuelRetryKey] = React.useState(0);
  // ── Plast POI (OSM živo) — P0-C: živi Overpass POI po viewportu;
  //    enak vzorec stanj (loading/empty/error + retry) + ločeno stanje
  //    „viewport prevelik" (amber, ni napaka — samo hint za približavo). ──
  const [poiOn, setPoiOn] = React.useState(false);
  const [poiList, setPoiList] = React.useState<OsmPoiDTO[]>([]);
  const [poiLoading, setPoiLoading] = React.useState(false);
  const [poiEmpty, setPoiEmpty] = React.useState(false);
  const [poiError, setPoiError] = React.useState(false);
  const [poiTooBig, setPoiTooBig] = React.useState(false);
  const [poiRetryKey, setPoiRetryKey] = React.useState(0);
  const [routeState, setRouteState] = React.useState<RouteState>({
    status: "idle",
  });
  const reduceMotion = useReducedMotion();

  const mapRef = React.useRef<L.Map | null>(null);
  const markerRefs = React.useRef<Record<string, L.Marker | null>>({});
  const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  // ── POLIR14 (2.41.0): Leaflet display:none past — skrit zemljevid
  // (max-lg:hidden v pogledu „list“) ima velikost 0; ob POVRATKU na „map“
  // je treba velikost izmeriti na novo, sicer zemljevid ostane siv
  // (prazne ploščice — invalidateSize je uradno Leaflet zdravilo). ────
  React.useEffect(() => {
    if (mobileView === "map") mapRef.current?.invalidateSize();
  }, [mobileView]);

  const L10n = {
    searchLabel: {
      sl: "Išči destinacijo po imenu",
      en: "Search destinations by name",
      it: "Cerca destinazioni per nome",
      de: "Reiseziele nach Name suchen",
      fr: "Rechercher des destinations par nom",
      es: "Buscar destinos por nombre",
    },
    searchPlaceholder: {
      sl: "Iskanje: Bled, jama, Piran …",
      en: "Search: Bled, cave, Piran …",
      it: "Cerca: Bled, grotta, Pirano …",
      de: "Suche: Bled, Höhle, Piran …",
      fr: "Rechercher : Bled, grotte, Piran …",
      es: "Buscar: Bled, cueva, Pirán …",
    },
    allTypes: { sl: "Vsi tipi", en: "All types", it: "Tutti i tipi", de: "Alle Typen", fr: "Tous les types", es: "Todos los tipos" },
    allRegions: { sl: "Vse regije", en: "All regions", it: "Tutte le regioni", de: "Alle Regionen", fr: "Toutes les régions", es: "Todas las regiones" },
    regionFilter: {
      sl: "Filtriraj po regiji",
      en: "Filter by region",
      it: "Filtra per regione",
      de: "Nach Region filtern",
      fr: "Filtrer par région",
      es: "Filtrar por región",
    },
    reset: { sl: "Počisti filtre", en: "Clear filters", it: "Azzera i filtri", de: "Filter zurücksetzen", fr: "Effacer les filtres", es: "Borrar filtros" },
    count: {
      sl: (n: number) => `${n} od ${DESTINATIONS.length} destinacij`,
      en: (n: number) => `${n} of ${DESTINATIONS.length} destinations`,
      it: (n: number) => `${n} di ${DESTINATIONS.length} destinazioni`,
      de: (n: number) => `${n} von ${DESTINATIONS.length} Reisezielen`,
      fr: (n: number) => `${n} sur ${DESTINATIONS.length} destinations`,
      es: (n: number) => `${n} de ${DESTINATIONS.length} destinos`,
    },
    listTitle: {
      sl: "Seznam destinacij",
      en: "Destination list",
      it: "Elenco delle destinazioni",
      de: "Liste der Reiseziele",
      fr: "Liste des destinations",
      es: "Lista de destinos",
    },
    emptyTitle: {
      sl: "Ni zadetkov na zemljevidu",
      en: "No matches on the map",
      it: "Nessun risultato sulla mappa",
      de: "Keine Treffer auf der Karte",
      fr: "Aucun résultat sur la carte",
      es: "Sin resultados en el mapa",
    },
    emptyLead: {
      sl: "Za iskani niz ali kombinacijo filtrov ni destinacij — počisti filtre in poskusi znova.",
      en: "No destinations match your search or filters — clear them and try again.",
      it: "Nessuna destinazione corrisponde alla ricerca o ai filtri — azzerali e riprova.",
      de: "Keine Reiseziele entsprechen deiner Suche oder den Filtern — setze sie zurück und versuche es erneut.",
      fr: "Aucune destination ne correspond à ta recherche ou à tes filtres — efface-les et réessaie.",
      es: "Ningún destino coincide con tu búsqueda o filtros — bórralos e inténtalo de nuevo.",
    },
    legend: { sl: "Legenda tipov", en: "Type legend", it: "Legenda dei tipi", de: "Typen-Legende", fr: "Légende des types", es: "Leyenda de tipos" },
    hint: {
      sl: "Klikni marker za podrobnosti · Podatki: OpenStreetMap (ODbL)",
      en: "Click a marker for details · Data: OpenStreetMap (ODbL)",
      it: "Clicca un marker per i dettagli · Dati: OpenStreetMap (ODbL)",
      de: "Klicke auf einen Marker für Details · Daten: OpenStreetMap (ODbL)",
      fr: "Clique sur un marqueur pour les détails · Données : OpenStreetMap (ODbL)",
      es: "Pulsa un marcador para ver detalles · Datos: OpenStreetMap (ODbL)",
    },
    mapLabel: {
      sl: "Zemljevid destinacij Discover Slovenia",
      en: "Discover Slovenia destination map",
      it: "Mappa delle destinazioni di Discover Slovenia",
      de: "Discover-Slovenia-Reisezielkarte",
      fr: "Carte des destinations Discover Slovenia",
      es: "Mapa de destinos de Discover Slovenia",
    },
    // ── POLIR14 (2.41.0): mobilni preklop pogleda Zemljevid ⇄ Seznam ──
    mapView: { sl: "Zemljevid", en: "Map", it: "Mappa", de: "Karte", fr: "Carte", es: "Mapa" },
    listView: { sl: "Seznam", en: "List", it: "Elenco", de: "Liste", fr: "Liste", es: "Lista" },
    viewToggleLabel: { sl: "Preklop pogleda", en: "Switch view", it: "Cambia vista", de: "Ansicht wechseln", fr: "Changer de vue", es: "Cambiar vista" },
    add: { sl: "Dodaj v mojo pot", en: "Add to my trip", it: "Aggiungi al mio viaggio", de: "Zu meiner Reise hinzufügen", fr: "Ajouter à mon voyage", es: "Añadir a mi viaje" },
    added: { sl: "V moji poti", en: "In my trip", it: "Nel mio viaggio", de: "In meiner Reise", fr: "Dans mon voyage", es: "En mi viaje" },
    more: { sl: "Več", en: "More", it: "Dettagli", de: "Mehr", fr: "Plus", es: "Más" },
    toastAdded: {
      sl: "Dodano v mojo pot",
      en: "Added to my trip",
      it: "Aggiunto al mio viaggio",
      de: "Zu meiner Reise hinzugefügt",
      fr: "Ajouté à mon voyage",
      es: "Añadido a mi viaje",
    },
    ratingOf: {
      sl: (v: string) => `Ocena ${v} od 5`,
      en: (v: string) => `Rating ${v} out of 5`,
      it: (v: string) => `Valutazione ${v} su 5`,
      de: (v: string) => `Bewertung ${v} von 5`,
      fr: (v: string) => `Note ${v} sur 5`,
      es: (v: string) => `Valoración ${v} sobre 5`,
    },
    // ── Plasti (51-b): Lokali + Pot ─────────────────────────────────
    layersLabel: { sl: "Plasti zemljevida", en: "Map layers", it: "Livelli della mappa", de: "Kartenebenen", fr: "Calques de la carte", es: "Capas del mapa" },
    lokaliLabel: { sl: "Lokali", en: "Venues", it: "Locali", de: "Lokale", fr: "Établissements", es: "Lugares" },
    zoomHint: { sl: "Povečaj za lokalne pin", en: "Zoom in for local pins", it: "Ingrandisci per i pin locali", de: "Vergrößern für lokale Pins", fr: "Zoomez pour voir les épingles locales", es: "Amplía para ver los pins locales" },
    approximate: { sl: "okvirna lokacija (središče destinacije)", en: "approximate location (destination center)", it: "posizione approssimativa (centro della destinazione)", de: "ungefähre Lage (Zentrum des Reiseziels)", fr: "position approximative (centre de la destination)", es: "ubicación aproximada (centro del destino)" },
    venuesLink: { sl: "Vsi lokalni ponudniki", en: "All local venues", it: "Tutti i locali", de: "Alle lokalen Anbieter", fr: "Tous les établissements", es: "Todos los lugares" },
    pinsUnavailable: { sl: "Lokali trenutno niso dosegljivi", en: "Venues currently unavailable", it: "Locali attualmente non disponibili", de: "Lokale derzeit nicht verfügbar", fr: "Établissements actuellement indisponibles", es: "Lugares no disponibles actualmente" },
    // Issue #1 §4 — stanja plasti (nalaganje/prazno/retry).
    pinsLoading: { sl: "Nalagam pin …", en: "Loading pins …", it: "Caricamento pin …", de: "Pins werden geladen …", fr: "Chargement des épingles …", es: "Cargando pines …" },
    pinsEmpty: { sl: "V tem območju ni pinov", en: "No pins in this area", it: "Nessun pin in quest'area", de: "Keine Pins in diesem Bereich", fr: "Aucune épingle dans cette zone", es: "No hay pines en esta zona" },
    retry: { sl: "Poskusi znova", en: "Try again", it: "Riprova", de: "Erneut versuchen", fr: "Réessayer", es: "Reintentar" },
    showRoute: { sl: "Prikaži pot", en: "Show route", it: "Mostra il percorso", de: "Route anzeigen", fr: "Afficher l'itinéraire", es: "Mostrar la ruta" },
    hideRoute: { sl: "Skrij pot", en: "Hide route", it: "Nascondi il percorso", de: "Route ausblenden", fr: "Masquer l'itinéraire", es: "Ocultar la ruta" },
    routeLoading: { sl: "Pot se izračunava …", en: "Calculating route …", it: "Calcolo del percorso …", de: "Route wird berechnet …", fr: "Calcul de l'itinéraire …", es: "Calculando la ruta …" },
    routeUnavailable: { sl: "Pot trenutno ni dosegljiva", en: "Route currently unavailable", it: "Percorso attualmente non disponibile", de: "Route derzeit nicht verfügbar", fr: "Itinéraire actuellement indisponible", es: "Ruta no disponible actualmente" },
    heuristicLeg: { sl: "ocena (heuristična pot)", en: "estimate (heuristic path)", it: "stima (percorso euristico)", de: "Schätzung (heuristische Route)", fr: "estimation (chemin heuristique)", es: "estimación (ruta heurística)" },
    routeSummary: {
      sl: (km: number, min: number) => `${km} km · ${min} min`,
      en: (km: number, min: number) => `${km} km · ${min} min`,
      it: (km: number, min: number) => `${km} km · ${min} min`,
      de: (km: number, min: number) => `${km} km · ${min} min`,
      fr: (km: number, min: number) => `${km} km · ${min} min`,
      es: (km: number, min: number) => `${km} km · ${min} min`,
    },
    routeMethod: {
      sl: (m: string) => (m === "osrm" ? "OSRM (realne ceste)" : m === "heuristic" ? "ocena poti (heuristika)" : "mešano"),
      en: (m: string) => (m === "osrm" ? "OSRM (real roads)" : m === "heuristic" ? "route estimate (heuristic)" : "mixed"),
      it: (m: string) => (m === "osrm" ? "OSRM (strade reali)" : m === "heuristic" ? "stima del percorso (euristica)" : "misto"),
      de: (m: string) => (m === "osrm" ? "OSRM (echte Straßen)" : m === "heuristic" ? "Routenschätzung (heuristisch)" : "gemischt"),
      fr: (m: string) => (m === "osrm" ? "OSRM (routes réelles)" : m === "heuristic" ? "estimation d'itinéraire (heuristique)" : "mixte"),
      es: (m: string) => (m === "osrm" ? "OSRM (calles reales)" : m === "heuristic" ? "estimación de ruta (heurística)" : "mixta"),
    },
    // ── Plast Bencinske + rezervacije (v2.5.0) ──────────────────────
    fuelLabel: { sl: "Bencinske", en: "Fuel", it: "Benzinaio", de: "Tankstellen", fr: "Stations-service", es: "Gasolineras" },
    fuelLoading: { sl: "Nalagam črpalke …", en: "Loading stations …", it: "Caricamento stazioni …", de: "Tankstellen werden geladen …", fr: "Chargement des stations …", es: "Cargando gasolineras …" },
    fuelEmpty: { sl: "V tem območju ni črpalk", en: "No stations in this area", it: "Nessuna stazione in quest'area", de: "Keine Tankstellen in diesem Bereich", fr: "Aucune station dans cette zone", es: "No hay gasolineras en esta zona" },
    fuelUnavailable: { sl: "Bencinske trenutno niso dosegljive", en: "Stations currently unavailable", it: "Stazioni attualmente non disponibili", de: "Tankstellen derzeit nicht verfügbar", fr: "Stations actuellement indisponibles", es: "Gasolineras no disponibles actualmente" },
    fuelApproximate: { sl: "približna lokacija (odprti podatki OSM)", en: "approximate location (OSM open data)", it: "posizione approssimativa (dati OSM)", de: "ungefähre Lage (OSM offene Daten)", fr: "position approximative (données OSM)", es: "ubicación aproximada (datos OSM abiertos)" },
    fuelHighway: { sl: "ob avtocesti", en: "near motorway", it: "vicino all'autostrada", de: "an der Autobahn", fr: "près de l'autoroute", es: "junto a la autopista" },
    fuelFuels: { sl: "Goriva", en: "Fuels", it: "Carburanti", de: "Kraftstoffe", fr: "Carburants", es: "Combustibles" },
    fuelSource: { sl: "Vir: kurirani odprti podatki (ODbL)", en: "Source: curated open data (ODbL)", it: "Fonte: dati aperti curati (ODbL)", de: "Quelle: kuratierte offene Daten (ODbL)", fr: "Source : données ouvertes curatorisées (ODbL)", es: "Fuente: datos abiertos curados (ODbL)" },
    bookTitle: { sl: "Rezerviraj", en: "Book", it: "Prenota", de: "Buchen", fr: "Réserver", es: "Reservar" },
    bookStays: { sl: "Nastanitev", en: "Stay", it: "Pernottamento", de: "Unterkunft", fr: "Hébergement", es: "Alojamiento" },
    bookExperiences: { sl: "Doživetje", en: "Experience", it: "Esperienza", de: "Erlebnis", fr: "Expérience", es: "Experiencia" },
    bookFlights: { sl: "Leti", en: "Flights", it: "Voli", de: "Flüge", fr: "Vols", es: "Vuelos" },
    bookCar: { sl: "Rent-a-car", en: "Car rental", it: "Autonoleggio", de: "Mietwagen", fr: "Location de voiture", es: "Alquiler de coches" },
    bookingLinksNote: { sl: "Povezave partnerjev — provizija, cena zate nespremenjena", en: "Partner links — commission, your price unchanged", it: "Link partner — commissione, prezzo invariato", de: "Partnerlinks — Provision, Preis unverändert", fr: "Liens partenaires — commission, prix inchangé", es: "Enlaces de socios — comisión, precio sin cambios" },
    // ── Plast POI (OSM živo) — P0-C. Slovar vseh 6 jezikov (i18n-pick 48-b). ──
    poiLabel: { sl: "POI (OSM živo)", en: "POI (OSM live)", it: "POI (OSM in tempo reale)", de: "POI (OSM live)", fr: "POI (OSM en temps réel)", es: "POI (OSM en tiempo real)" },
    poiLoading: { sl: "Nalagam POI …", en: "Loading POIs …", it: "Caricamento POI …", de: "POIs werden geladen …", fr: "Chargement des POI …", es: "Cargando POI …" },
    poiEmpty: { sl: "V tem območju ni POI", en: "No POIs in this area", it: "Nessun POI in quest'area", de: "Keine POIs in diesem Bereich", fr: "Aucun POI dans cette zone", es: "No hay POI en esta zona" },
    poiTooBig: {
      sl: "Pogled prevelik za POI sloj — približajte zemljevid",
      en: "Viewport too large for the POI layer — zoom in",
      it: "Vista troppo ampia per il livello POI — ingrandisci la mappa",
      de: "Ausschnitt zu groß für die POI-Ebene — vergrößere die Karte",
      fr: "Vue trop étendue pour la couche POI — zoome la carte",
      es: "Vista demasiado amplia para la capa de POI — amplía el mapa",
    },
    poiUnavailable: {
      sl: "POI sloj trenutno nedosegljiv (javni Overpass vir) — podatki © OpenStreetMap avtorji",
      en: "POI layer currently unreachable (public Overpass source) — data © OpenStreetMap contributors",
      it: "Livello POI attualmente non raggiungibile (fonte pubblica Overpass) — dati © Contributori OpenStreetMap",
      de: "POI-Ebene derzeit nicht erreichbar (öffentliche Overpass-Quelle) — Daten © OpenStreetMap-Mitwirkende",
      fr: "Couche POI actuellement injoignable (source Overpass publique) — données © Contributeurs OpenStreetMap",
      es: "Capa de POI actualmente inaccesible (fuente pública Overpass) — datos © Colaboradores de OpenStreetMap",
    },
    poiAttributionLegend: {
      sl: "POI (OSM živo): podatki © OpenStreetMap avtorji (ODbL)",
      en: "POI (OSM live): data © OpenStreetMap contributors (ODbL)",
      it: "POI (OSM in tempo reale): dati © Contributori OpenStreetMap (ODbL)",
      de: "POI (OSM live): Daten © OpenStreetMap-Mitwirkende (ODbL)",
      fr: "POI (OSM en temps réel) : données © Contributeurs OpenStreetMap (ODbL)",
      es: "POI (OSM en tiempo real): datos © Colaboradores de OpenStreetMap (ODbL)",
    },
    poiPopupAttribution: {
      sl: "© OpenStreetMap avtorji (ODbL)",
      en: "© OpenStreetMap contributors (ODbL)",
      it: "© Contributori OpenStreetMap (ODbL)",
      de: "© OpenStreetMap-Mitwirkende (ODbL)",
      fr: "© Contributeurs OpenStreetMap (ODbL)",
      es: "© Colaboradores de OpenStreetMap (ODbL)",
    },
    poiKind: {
      sl: (k: string) => POI_KIND_LABELS_SL[k] ?? "točka interesa",
      en: (k: string) => POI_KIND_LABELS_EN[k] ?? "point of interest",
      it: (k: string) => POI_KIND_LABELS_IT[k] ?? "punto di interesse",
      de: (k: string) => POI_KIND_LABELS_DE[k] ?? "interessanter Ort",
      fr: (k: string) => POI_KIND_LABELS_FR[k] ?? "point d'intérêt",
      es: (k: string) => POI_KIND_LABELS_ES[k] ?? "punto de interés",
    },
  } as const;
  const t = <K extends keyof typeof L10n>(k: K) => pick(l, L10n[k]);

  const inTrip = React.useCallback(
    (slug: string) => tripItems.some((x) => x.refId === slug),
    [tripItems]
  );

  const onAdd = (d: Destination) => {
    if (inTrip(d.slug)) return;
    myTrip.add(d.slug, d.name, "destination", "zemljevid");
    toast({ title: pick(l, L10n.toastAdded) });
  };

  // ── Plast Lokali: rezultati pins API-ja (stabilna callbacka za efekt) ─
  const handlePinsResult = React.useCallback(
    (pins: MapPinDTO[], mode: "grid" | "pins") => {
      setLokaliPins(pins);
      setLokaliMode(mode);
      setLokaliError(false);
      setLokaliLoading(false);
    },
    []
  );

  const handlePinsError = React.useCallback(() => {
    setLokaliError(true);
    setLokaliLoading(false);
  }, []);

  const handlePinsLoading = React.useCallback(() => setLokaliLoading(true), []);

  /** Retry plasti Lokali — bump ključa ponovno zažene efekt pridobivanja. */
  const retryLokali = React.useCallback(
    () => setLokaliRetryKey((k) => k + 1),
    []
  );

  /** Preklop plasti Lokali — ob izklopu takoj počisti (brez ostankov). */
  const toggleLokali = () => {
    const next = !lokaliOn;
    setLokaliOn(next);
    if (!next) {
      setLokaliPins([]);
      setLokaliMode(null);
      setLokaliError(false);
      setLokaliLoading(false);
    }
  };

  // ── Plast Bencinske: stabilne callbacka + preklop (isti kanon Lokali) ──
  const handleFuelResult = React.useCallback((stations: FuelStationDTO[]) => {
    setFuelStations(stations);
    setFuelEmpty(stations.length === 0);
    setFuelError(false);
    setFuelLoading(false);
  }, []);

  const handleFuelError = React.useCallback(() => {
    setFuelError(true);
    setFuelLoading(false);
  }, []);

  const handleFuelLoading = React.useCallback(() => {
    setFuelLoading(true);
    // Ob novem nalaganju pošteno umaknemo prejšnje „prazno" stanje (chip
    // ne sme ostati obešen, medtem ko se nov pogled že nalaga).
    setFuelEmpty(false);
  }, []);

  const retryFuel = React.useCallback(
    () => setFuelRetryKey((k) => k + 1),
    []
  );

  /** Preklop plasti Bencinske — ob izklopu takoj počisti pine. */
  const toggleFuel = () => {
    const next = !fuelOn;
    setFuelOn(next);
    if (!next) {
      setFuelStations([]);
      setFuelEmpty(false);
      setFuelError(false);
      setFuelLoading(false);
    }
  };

  // ── Plast POI (OSM živo): stabilni callbacki + preklop (isti kanon) ──
  const handlePoiResult = React.useCallback((pois: OsmPoiDTO[]) => {
    // Nov fetch = NOV seznam (stari markerji se zamenjajo, nikoli ne
    // seštevajo — brez podvajanja ob premikanju zemljevida).
    setPoiList(pois);
    setPoiEmpty(pois.length === 0);
    setPoiError(false);
    setPoiTooBig(false);
    setPoiLoading(false);
  }, []);

  /** Viewport > 0,25°² — namerna omejitev vira: hint, ne napaka. */
  const handlePoiTooBig = React.useCallback(() => {
    setPoiList([]); // brez markerjev
    setPoiTooBig(true);
    setPoiError(false);
    setPoiEmpty(false);
    setPoiLoading(false);
  }, []);

  const handlePoiError = React.useCallback(() => {
    setPoiError(true);
    setPoiLoading(false);
  }, []);

  /** Ob vsakem novem fetchu počistimo prejšnje stanje in markerje. */
  const handlePoiLoading = React.useCallback(() => {
    setPoiLoading(true);
    setPoiList([]);
    setPoiEmpty(false);
    setPoiError(false);
    setPoiTooBig(false);
  }, []);

  const retryPoi = React.useCallback(() => setPoiRetryKey((k) => k + 1), []);

  /** Preklop plasti POI — izklop = 0 markerjev (+ preklic fetcha v plasti). */
  const togglePoi = () => {
    const next = !poiOn;
    setPoiOn(next);
    if (!next) {
      setPoiList([]);
      setPoiEmpty(false);
      setPoiError(false);
      setPoiTooBig(false);
      setPoiLoading(false);
    }
  };

  /** Destinacije iz Moje poti v shranjenem vrstnem redu (samo veljavne). */
  const tripDestinations = React.useMemo(
    () =>
      tripItems
        .filter((x) => x.kind === "destination")
        .map((x) => DESTINATIONS.find((d) => d.slug === x.refId))
        .filter((d): d is Destination => !!d),
    [tripItems]
  );

  /**
   * Preklop plasti Pot: POST /api/journey/route z destinacijami Moje poti
   * (vrstni red kot v zbirki). Ob napaki iskreno sporočilo — pot se NE
   * izmišljuje. Ob uspehu pogled obsegne celotno pot.
   */
  const onToggleRoute = async () => {
    if (routeState.status === "loading") return;
    if (routeState.status === "done") {
      setRouteState({ status: "idle" }); // skrij pot
      return;
    }
    if (tripDestinations.length < 2) return;
    setRouteState({ status: "loading" });
    try {
      const res = await fetch("/api/journey/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slugs: tripDestinations.map((d) => d.slug),
        }),
      });
      if (!res.ok) throw new Error("route");
      const data = (await res.json()) as JourneyRouteDTO;
      if (!Array.isArray(data.legs) || data.legs.length === 0) {
        throw new Error("route");
      }
      setRouteState({ status: "done", data });
      // Obsegni pogled na celotno pot (vse točke vseh odsekov).
      const points = data.legs.flatMap((leg) => leg.geometry);
      if (points.length > 0 && mapRef.current) {
        mapRef.current.fitBounds(L.latLngBounds(points), {
          padding: [48, 48],
        });
      }
    } catch {
      setRouteState({ status: "error" }); // iskrena napaka — brez poti
    }
  };

  /** Regije, ki dejansko nastopajo v naboru (kanonski vrstni red slovarja). */
  const activeRegions = React.useMemo(() => {
    const present = new Set(DESTINATIONS.map((d) => d.region));
    return Object.keys(REGIONS).filter((r) => present.has(r));
  }, []);

  const results = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DESTINATIONS.filter((d) => {
      if (type !== "all" && d.type !== type) return false;
      if (region !== "all" && d.region !== region) return false;
      if (
        needle &&
        !d.name.toLowerCase().includes(needle) &&
        !d.tagline.toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [q, type, region]);

  const hasFilters = q.trim() !== "" || type !== "all" || region !== "all";
  const reset = () => {
    setQ("");
    setType("all");
    setRegion("all");
  };

  /** Klik na postavko seznama: prileti do markerja in odpre popup. */
  const focusDestination = (d: Destination) => {
    setActiveId(d.id);
    mapRef.current?.flyTo([d.coords.lat, d.coords.lng], 11, { duration: 0.8 });
    // Popup odpremo z zamikom (flyTo traja ~0,8 s in marker je stabilen).
    window.setTimeout(() => markerRefs.current[d.id]?.openPopup(), 400);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 max-lg:flex max-lg:flex-col">
      {/* POLIR14 (2.41.0): MOBILNA GLAVA ZEMLJEVIDA — zemljevid najprej.
          Root postane na <lg FLEX STOLPEC + vrstni red razredov (order-1…7):
          iskanje → čipi → preklop → ZEMLJEVID/SEZNAM → plasti → pasice →
          legenda (raziskava §3.3/§6.1: zemljevid ≥ 55 % prvega zaslona,
          seznam dosegljiv z 1 dejanjem, vsi filtri odkriti z afordanco).
          Namizje (lg+) NI fleks — bločna postavitev po DOM = IDENTIČNO
          današnjemu (plasti NAD zemljevidom, split view). */}
      {/* ── Nadzorna vrstica: iskanje + regija + ponastavitev ─────── */}
      {/* POLIR14: iskanje in regija v ENI vrstici na mobilnem
          (grid-cols-[1fr_auto]); reset gumb čez celo vrstico (col-span-2).
          mt-4 namesto mt-8 na mobilnem — vsaka vrstica nad zemljevidom je
          draga; namizje (md/lg) IDENTIČNO (lg:mt-8). */}
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 md:grid-cols-[1fr_auto_auto] lg:mt-8 max-lg:order-1">
        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            className="h-11 pl-9"
          />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="h-11 w-36 md:w-56" aria-label={t("regionFilter")}>
            <SelectValue placeholder={t("allRegions")} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">{t("allRegions")}</SelectItem>
            {activeRegions.map((r) => (
              <SelectItem key={r} value={r}>
                {regionLabel(r, l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            // POLIR14: na mobilnem čez celo drugo vrstico (col-span-2),
            // md+ nespremenjeno (en sam stolpec — md:col-span-1).
            className="h-11 col-span-2 md:col-span-1"
          >
            <X className="size-4" aria-hidden="true" />
            {t("reset")}
          </Button>
        ) : (
          <div
            aria-hidden="true"
            className="hidden items-center px-3 text-sm text-muted-foreground md:flex"
          >
            {t("count")(results.length)}
          </div>
        )}
      </div>

      {/* ── Čipi tipov (vodoravno drsenje na mobilnem) ────────────────── */}
      {/* POLIR14: trak je OVIT v relativni ovoj — (a) mt-3 se preseli z
          traku na ovoj (trak ohrani čiste drsne razrede), (b) fade
          afordanca na desnem robu namiga, da se trak nadaljuje desno
          (raziskava §3.3: zadnji čipi so bili skriti BREZ namiga). */}
      <div className="relative mt-3 max-lg:order-2">
        <div
          role="group"
          aria-label={t("allTypes")}
          className="scrollbar-slim flex gap-2 overflow-x-auto pb-1"
        >
          <button
            type="button"
            onClick={() => setType("all")}
            aria-pressed={type === "all"}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              type === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:border-primary/40 hover:text-primary"
            )}
          >
            {t("allTypes")}
          </button>
          {(Object.keys(DEST_TYPES) as DestinationType[]).map((ty) => {
            const active = type === ty;
            return (
              <button
                key={ty}
                type="button"
                onClick={() => setType(active ? "all" : ty)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:border-primary/40 hover:text-primary"
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[ty] }}
                />
                {typeLabel(ty, l)}
              </button>
            );
          })}
        </div>
        {/* POLIR14: fade afordanca — gradient proti ozadju na desnem robu
            traku namiga, da se čipi nadaljujejo desno (raziskava §4.1
            „skriti čipi brez namiga“); ne prestreza dotikov
            (pointer-events-none), na namizju skrita (lg:hidden). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent lg:hidden"
        />
      </div>

      {/* ── POLIR14: VZTRAJEN preklop „Zemljevid ⇄ Seznam“ (samo <lg) ──
          saasfactor kanon (raziskava §6.1): „list-versus-map toggle should
          be persistent and easy to switch“ — seznam je bil prej 472 px
          pod pragom prvega zaslona, zdaj je 1 dejanje stran. Aktivni gumb
          variant="default", neaktivni "outline"; stanje v aria-pressed.
          POLIR15-a (2.42.0): vrstica je STICKY pod glavo (top-16 = h-16
          glave) — ob globokem drsenju po seznamu (ali pod zemljevidom) je
          preklop VEDNO dosegljiv z 1 dejanjem (prej: scroll nazaj na vrh).
          bg-background je obvezen: vrstica lebdi nad drseno vsebino;
          pb-2 prekrije vsebino v reži med gumboma. Z-index 30 je dovolj,
          ker je zemljevid zdaj v lastnem stacking kontekstu (izolacija
          spodaj) — Leafletove pane (z 400) in kontrole (z 800–1000) ne
          morejo več prekrite vrstice. */}
      <div
        role="group"
        aria-label={t("viewToggleLabel")}
        className="sticky top-16 z-30 mt-3 flex gap-2 bg-background pb-2 max-lg:order-3 lg:hidden"
      >
        <Button
          type="button"
          variant={mobileView === "map" ? "default" : "outline"}
          aria-pressed={mobileView === "map"}
          onClick={() => setMobileView("map")}
          className="h-11 flex-1"
        >
          <MapIcon className="size-4" aria-hidden="true" />
          {t("mapView")}
        </Button>
        <Button
          type="button"
          variant={mobileView === "list" ? "default" : "outline"}
          aria-pressed={mobileView === "list"}
          onClick={() => setMobileView("list")}
          className="h-11 flex-1"
        >
          <List className="size-4" aria-hidden="true" />
          {t("listView")}
        </Button>
      </div>

      {/* ── Plasti: Lokali + Pot (FAZA 3 / 51-b) ─────────────────────── */}
      {/* POLIR14: plasti dobijo na mobilnem max-lg:order-5 — POD
          zemljevidom (legendi podoben pas ob svojih stikalih); namizje:
          DOM vrstni red = plasti NAD zemljevidom, nespremenjeno. */}
      <div
        role="group"
        aria-label={t("layersLabel")}
        className="mt-3 flex flex-wrap items-center gap-2 max-lg:order-5"
      >
        <button
          type="button"
          onClick={toggleLokali}
          aria-pressed={lokaliOn}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            lokaliOn
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:border-primary/40 hover:text-primary"
          )}
        >
          <Store className="size-4" aria-hidden="true" />
          {t("lokaliLabel")}
        </button>

        {/* Plast Bencinske (v2.5.0) — preklop + stanja po vzorcu Lokali. */}
        <button
          type="button"
          onClick={toggleFuel}
          aria-pressed={fuelOn}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            fuelOn
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:border-primary/40 hover:text-primary"
          )}
        >
          <Fuel className="size-4" aria-hidden="true" />
          {t("fuelLabel")}
        </button>

        {/* Plast POI (OSM živo) — P0-C: preklop + stanja po vzorcu ostalih
            plasti; atribucija ODbL je ob vklopu vidna v legendi pod zemljevidom. */}
        <button
          type="button"
          onClick={togglePoi}
          aria-pressed={poiOn}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            poiOn
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:border-primary/40 hover:text-primary"
          )}
        >
          <MapPin className="size-4" aria-hidden="true" />
          {t("poiLabel")}
        </button>

        {tripDestinations.length >= 2 && (
          <Button
            type="button"
            variant={routeState.status === "done" ? "secondary" : "default"}
            className="h-11 rounded-full px-4"
            onClick={onToggleRoute}
            disabled={routeState.status === "loading"}
            aria-busy={routeState.status === "loading"}
          >
            {routeState.status === "loading" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Route className="size-4" aria-hidden="true" />
            )}
            {routeState.status === "done" ? t("hideRoute") : t("showRoute")}
            {routeState.status === "loading" && (
              <span className="sr-only">{t("routeLoading")}</span>
            )}
          </Button>
        )}

        {lokaliOn && lokaliMode === "grid" && !lokaliError && !lokaliLoading && (
          <span className="inline-flex h-11 items-center rounded-full border border-dashed bg-card px-4 text-xs font-medium text-muted-foreground">
            {t("zoomHint")}
          </span>
        )}
        {/* Nalaganje pinov — skeleton chip (spinner + besedilo, ~180 ms fade);
            iskrena povratna informacija med vsakim osvežitvom bbox-a. */}
        {lokaliOn && lokaliLoading && !lokaliError && (
          <motion.span
            role="status"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-xs font-medium text-muted-foreground"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t("pinsLoading")}
          </motion.span>
        )}
        {/* Prazno (0 pinov v trenutnem bbox) — subtilno, iskreno stanje. */}
        {lokaliOn &&
          lokaliMode === "pins" &&
          !lokaliError &&
          !lokaliLoading &&
          lokaliPins.length === 0 && (
            <motion.span
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="inline-flex h-11 items-center rounded-full border border-dashed bg-card px-4 text-xs font-medium text-muted-foreground"
            >
              {t("pinsEmpty")}
            </motion.span>
          )}
        {lokaliOn && lokaliError && (
          <motion.span
            role="status"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 py-1.5 pl-4 pr-2 text-xs font-medium text-destructive"
          >
            {t("pinsUnavailable")}
            <button
              type="button"
              onClick={retryLokali}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCw className="size-3" aria-hidden="true" />
              {t("retry")}
            </button>
          </motion.span>
        )}
        {/* Stanja plasti Bencinske — nalaganje / prazno / napaka + retry. */}
        {fuelOn && fuelLoading && !fuelError && !fuelEmpty && (
          <motion.span
            role="status"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-xs font-medium text-muted-foreground"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t("fuelLoading")}
          </motion.span>
        )}
        {fuelOn && fuelEmpty && !fuelLoading && !fuelError && (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center rounded-full border border-dashed bg-card px-4 text-xs font-medium text-muted-foreground"
          >
            {t("fuelEmpty")}
          </motion.span>
        )}
        {fuelOn && fuelError && (
          <motion.span
            role="status"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 py-1.5 pl-4 pr-2 text-xs font-medium text-destructive"
          >
            {t("fuelUnavailable")}
            <button
              type="button"
              onClick={retryFuel}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCw className="size-3" aria-hidden="true" />
              {t("retry")}
            </button>
          </motion.span>
        )}
        {/* Stanja plasti POI (OSM živo) — nalaganje / prazno (isti kanon);
            „prevelik pogled" in nedosegljivost sta širši amber pasici pod
            vrstico (daljše sporočilo, dostojno, ne rdeče alarmantne). */}
        {poiOn && poiLoading && !poiError && !poiTooBig && (
          <motion.span
            role="status"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center gap-2 rounded-full border bg-card px-4 text-xs font-medium text-muted-foreground"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t("poiLoading")}
          </motion.span>
        )}
        {poiOn && poiEmpty && !poiLoading && !poiError && !poiTooBig && (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center rounded-full border border-dashed bg-card px-4 text-xs font-medium text-muted-foreground"
          >
            {t("poiEmpty")}
          </motion.span>
        )}
        {routeState.status === "error" && (
          <motion.span
            role="status"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 py-1.5 pl-4 pr-2 text-xs font-medium text-destructive"
          >
            {t("routeUnavailable")}
            {/* Retry = ponovni izračun poti (isto dejanje kot gumb „Prikaži
                pot" — izrecen, ne skrit). */}
            <button
              type="button"
              onClick={() => void onToggleRoute()}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-semibold transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <RotateCw className="size-3" aria-hidden="true" />
              {t("retry")}
            </button>
          </motion.span>
        )}
        {routeState.status === "done" && (
          <span className="inline-flex h-11 items-center rounded-full border bg-card px-4 text-xs font-medium text-muted-foreground">
            {t("routeSummary")(
              routeState.data.totalKm,
              routeState.data.totalMin
            )}{" "}
            · {t("routeMethod")(routeState.data.method)}
          </span>
        )}
      </div>

      {/* ── POI (OSM živo) — iskreni pasici (P0-C) ─────────────────────
          Obe sta AMBER (dostojni, ne rdeči): prevelik pogled je namerna
          omejitev javnega vira (hint za približavo), nedosegljivost pa
          je v peskovniku pričakovano stanje — sloj deluje v produkciji.
          POLIR14: pasici na mobilnem POD plastmi (max-lg:order-6, ob
          svojih stikalih) — brez tega bi v fleks koloni roota skočili
          NAD iskanje (privzeti order:0 pred order-1…5). */}
      {poiOn && poiTooBig && !poiLoading && (
        <motion.div
          role="status"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mt-3 rounded-lg border border-amber-500/50 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40 max-lg:order-6"
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {t("poiTooBig")}
          </p>
        </motion.div>
      )}
      {poiOn && poiError && (
        <motion.div
          role="status"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mt-3 flex flex-col items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between max-lg:order-6"
        >
          <p className="flex items-start gap-2 text-xs font-medium text-amber-900 dark:text-amber-200">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("poiUnavailable")}
          </p>
          <button
            type="button"
            onClick={retryPoi}
            className="focus-green inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-amber-600/50 bg-background px-4 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
          >
            <RotateCw className="size-3.5" aria-hidden="true" />
            {t("retry")}
          </button>
        </motion.div>
      )}

      {/* ── Zemljevid + stranski seznam ──────────────────────────────── */}
      {/* POLIR14: mreža dobi max-lg:order-4 — na mobilnem ZA preklopnim
          pasom (zemljevid čim višje v prvem zaslonu); podniz mreže
          (grid gap-4 lg:grid-cols-[1fr_340px]) OSTAJA — zaklep ⑭
          reflow-320; namizje nespremenjeno (split view). */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px] max-lg:order-4">
        {/* Zemljevid — a11y oznaka na ovojnem elementu (MapContainer ne
            sprejema ARIA atributov v tipih react-leaflet).
            POLIR12 (2.39.0): višina zemljevida v svh enotah (mobilni
            različici + lg: kalkulacija) — svh = delež NAJMANJŠEGA stabilnega
            viewporta: pri VIDNI naslovni vrstici (iOS Safari / Chrome
            Android) spodnji rob zemljevida ne zajema več površine pod
            vrstico (prejšnja enota velikega viewporta je merila z vrstico
            skrčeno); dinamična enota je zavrnjena (WebKit #266835 — jank
            med drsenjem na tokovnih blokih); v brezglavem brskalniku
            svh ≡ vh (ničelna vizualna sprememba, ista podporna okna). */}
        {/* POLIR14: ovoj zemljevida se na mobilnem v pogledu „list“
            skrije (max-lg:hidden) — seznam zasede prvi zaslon; namizje
            (lg+) sploh ne pozna preklopa (razred se ne aktivira).
            POLIR15-a (2.42.0): relative z-0 isolate — Leaflet pane (z 400)
            in kontrole (z 800–1000) bežijo iz vsebinskega toka kar nad
            sticky preklop (z 30) in glavo (z 40); isolate zapre nov
            stacking kontekst, tako da vse Leafletove plasti ostanejo
            ZNOTRAJ ovoja (z 0 glede na starša). Leaflet CSS se NE
            spreminja — izolacija je čisto na strani ovoja. */}
        <div
          className={cn(
            "relative z-0 isolate overflow-hidden rounded-xl border shadow-sm",
            mobileView === "list" && "max-lg:hidden"
          )}
          role="region"
          aria-label={t("mapLabel")}
        >
          <MapContainer
            center={MAP_CENTER}
            zoom={MAP_ZOOM}
            minZoom={5}
            maxZoom={18}
            scrollWheelZoom
            ref={(m: L.Map | null) => {
              mapRef.current = m;
            }}
            className="h-[62svh] min-h-80 w-full sm:h-[70svh] lg:h-[calc(100svh-15rem)] lg:min-h-[540px]"
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> prispevalci'
            />
            <FitBounds dests={results} />
            <LokaliLayer
              enabled={lokaliOn}
              onResult={handlePinsResult}
              onError={handlePinsError}
              onLoading={handlePinsLoading}
              retryKey={lokaliRetryKey}
            />
            {/* Plast Bencinske (v2.5.0) — krmilnik pridobivanja za pogled. */}
            <FuelLayer
              enabled={fuelOn}
              onResult={handleFuelResult}
              onError={handleFuelError}
              onLoading={handleFuelLoading}
              retryKey={fuelRetryKey}
            />
            {/* Plast POI (OSM živo) — P0-C: krmilnik pridobivanja za pogled
                (debounce 600 ms, refetchBlock po 429, abort ob izklopu). */}
            <OsmPoiLayer
              enabled={poiOn}
              onResult={handlePoiResult}
              onViewportTooBig={handlePoiTooBig}
              onError={handlePoiError}
              onLoading={handlePoiLoading}
              retryKey={poiRetryKey}
            />
            {results.map((d) => (
              <Marker
                key={d.id}
                position={[d.coords.lat, d.coords.lng]}
                icon={typeIcon(d.type, activeId === d.id)}
                ref={(m: L.Marker | null) => {
                  markerRefs.current[d.id] = m;
                }}
                eventHandlers={{
                  click: () => {
                    setActiveId(d.id);
                    itemRefs.current[d.id]?.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                    });
                  },
                }}
              >
                <Popup className="dsa-popup">
                  <DestinationPopup
                    d={d}
                    inTrip={inTrip(d.slug)}
                    onAdd={onAdd}
                    labels={{
                      add: t("add"),
                      added: t("added"),
                      more: t("more"),
                      ratingOf: t("ratingOf"),
                      bookTitle: t("bookTitle"),
                      bookStays: t("bookStays"),
                      bookExperiences: t("bookExperiences"),
                      bookFlights: t("bookFlights"),
                      bookCar: t("bookCar"),
                      bookingLinksNote: t("bookingLinksNote"),
                    }}
                    locale={l}
                  />
                </Popup>
              </Marker>
            ))}

            {/* Plast Bencinske: rombasti markerji črpalk (pošteno označena
                PRIbližna lega v popupu; brez cen — vir ODbL v opombi). */}
            {fuelOn &&
              fuelStations.map((s) => (
                <Marker
                  key={`fuel-${s.id}`}
                  position={[s.lat, s.lng]}
                  icon={fuelIcon()}
                >
                  <Popup className="dsa-popup">
                    <FuelPinPopup
                      s={s}
                      labels={{
                        fuelApproximate: t("fuelApproximate"),
                        fuelHighway: t("fuelHighway"),
                        fuelFuels: t("fuelFuels"),
                        fuelSource: t("fuelSource"),
                      }}
                    />
                  </Popup>
                </Marker>
              ))}

            {/* Plast Lokali: majhni markerji lokalov (samo pins način,
                zoom ≥ 15 — manjši in drugačni od destinacijskih krogov). */}
            {lokaliOn &&
              lokaliPins.map((p) => (
                <Marker
                  key={`lokal-${p.id}`}
                  position={[p.lat, p.lng]}
                  icon={lokalIcon(p.type)}
                >
                  <Popup className="dsa-popup">
                    <LokalPinPopup
                      pin={p}
                      locale={l}
                      labels={{
                        approximate: t("approximate"),
                        venuesLink: t("venuesLink"),
                      }}
                    />
                  </Popup>
                </Marker>
              ))}

            {/* Plast POI (OSM živo) — P0-C: majhni krožci po kind s tooltipom
                (ime + vrsta) in popupom z obvezno atribucijo ODbL. Seznam se
                ob vsakem fetchu ZAMENJA (nikoli ne sešteva — brez podvajanj). */}
            {poiOn &&
              poiList.map((p) => (
                <Marker
                  key={`poi-${p.id}`}
                  position={[p.latitude, p.longitude]}
                  icon={poiIcon(p.kind)}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    {p.name} · {t("poiKind")(p.kind)}
                  </Tooltip>
                  <Popup className="dsa-popup">
                    <OsmPoiPopup
                      poi={p}
                      kindLabel={t("poiKind")(p.kind)}
                      attribution={t("poiPopupAttribution")}
                    />
                  </Popup>
                </Marker>
              ))}

            {/* Plast Pot: OSRM odseki = polna črta teme; hevristična
                ocena = črtkana premica z iskreno oznako (nikoli "OSRM"). */}
            {routeState.status === "done" &&
              routeState.data.legs.map((leg, i) => (
                <Polyline
                  key={`leg-${i}-${leg.from}-${leg.to}`}
                  positions={leg.geometry}
                  pathOptions={{
                    color: ROUTE_COLOR,
                    weight: 4,
                    opacity: 0.9,
                    ...(leg.source === "heuristic"
                      ? { dashArray: "8 8" }
                      : {}),
                  }}
                >
                  <Tooltip sticky>
                    {leg.source === "heuristic"
                      ? `${t("heuristicLeg")} · ${leg.km} km · ${leg.min} min`
                      : `${leg.km} km · ${leg.min} min`}
                  </Tooltip>
                </Polyline>
              ))}
          </MapContainer>
        </div>

        {/* Sinhroniziran seznam destinacij (hover/klik ↔ markerji).
            POLIR8 (2.35.0): min-w-0 — aside je PREDMET mreže
            grid gap-4 lg:grid-cols-[1fr_340px] z min-width:auto, ki ni
            dovoljeval skrčitve (FR/IT/ES 3–4 px @360, do 44 px @320);
            truncate veriga (li > button > span.min-w-0 > span.truncate)
            prevzame delo, živi dokaz: minWidth 0 → preliv 4 → 0. */}
        <aside
          aria-label={t("listTitle")}
          className={cn("min-w-0", mobileView === "map" && "max-lg:hidden")}
        >
          <p className="mb-2 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {t("listTitle")} · {t("count")(results.length)}
          </p>
          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <MapPin className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">{t("emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("emptyLead")}</p>
            </div>
          ) : (
            <ul className="scrollbar-slim max-h-[62svh] list-none space-y-1.5 overflow-y-auto pr-1 sm:max-h-[70svh] lg:max-h-[calc(100svh-16rem)]">
              {/* POLIR12 (2.39.0): seznam v istih svh enotah kot zemljevid
                  (mobilni max-h različici + lg: kalkulacija) — drsi v
                  istem koraku z višino zemljevida (POLIR12 komentar pri
                  MapContainerju zgoraj), stabilen najmanjši viewport brez
                  rezanja pri vidni naslovni vrstici (iOS Safari /
                  Chrome Android). */}
              {results.map((d) => {
                const active = activeId === d.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      ref={(el: HTMLButtonElement | null) => {
                        itemRefs.current[d.id] = el;
                      }}
                      onMouseEnter={() => setActiveId(d.id)}
                      onMouseLeave={() => setActiveId(null)}
                      onFocus={() => setActiveId(d.id)}
                      onBlur={() => setActiveId(null)}
                      onClick={() => focusDestination(d)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border bg-card p-2.5 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        active
                          ? "border-primary/60 shadow-md"
                          : "hover:border-primary/30 hover:shadow-sm"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: TYPE_COLORS[d.type] }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{d.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {regionLabel(d.region, l)} · {typeLabel(d.type, l)}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                        <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
                        {d.rating.toFixed(1)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {/* ── Legenda tipov + attribution ──────────────────────── */}
      {/* POLIR14: legenda na mobilnem zadnja (max-lg:order-7) — kot na
          namizju (DOM konec = mobilni konec); brez razreda bi v fleks
          koloni roota skočila na VRH (privzeti order:0 pred order-1…6). */}
      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between max-lg:order-7">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
            {t("legend")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {(Object.keys(DEST_TYPES) as DestinationType[]).map((ty) => (
              <li
                key={ty}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[ty] }}
                />
                {typeLabel(ty, l)}
              </li>
            ))}
          </ul>
          {/* ODbL atribucija živega POI sloja — VIDNA vedno, ko je plast
              vklopljena (licenčna zahteva vira; tudi brez markerjev). */}
          {poiOn && (
            <p className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {t("poiAttributionLegend")}
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
    </div>
  );
}
