"use client";

/**
 * PLAN-MAP — zemljevid ob načrtu (/nacrtuj, izdaja 2.29.0, POLIR2 B).
 *
 * Leaflet/OSM zemljevid načrta potovanja (vzorci iz travel-map.tsx —
 * Leaflet 1.9 + react-leaflet 5, OSM ploščice, divIcon brez slik):
 *  - MARKERJI po dnevih: okrogel znak s ŠTEVILKO DNEVA (divIcon, BREZ
 *    slikovnih ikon — obide znano bundler past leaflet+marker png), barva
 *    ozadja DAY_COLORS[dayIdx % 8], bela številka. Poudarjen postanek
 *    (highlightId === stop.id) je povečan, z belo obrobo in višjim
 *    zIndexOffset (kanon sinhronizacije seznam ↔ zemljevid).
 *  - POVEZAVE med postanki dneva: ČRTKANE PREMOCRTNE črte (dashArray
 *    "6 8", barva dneva) — iskrena opomba pod zemljevidom izrecno pove,
 *    da gre za premočrtne povezave in NE vozljivo pot (vozljiva pot z
 *    OSRM je izrecno izpuščena v prihodnjo izdajo — glej raziskavo
 *    2026-10-12-polir2.md).
 *  - ISKRENOST: postankov brez znanih koordinat se NE izmišljuje — niso
 *    prikazani; kadar jih je > 0, pod zemljevidom stoji iskren števec
 *    izpuščenih (planMapData.skippedNoCoords).
 *  - VARNOST (XSS kanon): tooltip „Dan d · ura | brez ure · ime" je
 *    sestavljen IZKLJUČNO prek DOM elementa (document.createElement +
 *    textContent) — ime postanka je lahko uporabnikov vnos (custom
 *    postanki), zato vsebina tooltipa NIKOLI ni html niz. Edini html v
 *    divIconu je statična številka dneva + barva (brez uporabniških
 *    podatkov).
 *  - 0 omrežja, 0 useSession: samo Leaflet + čisti podatki (planMapData
 *    je čista funkcija; nič se ne pridobiva med prikazom).
 *
 * SSR: Leaflet potrebuje window (že uvoz modula leaflet brez DOM povzroči
 * „window is not defined") — komponento nalagaj IZKLJUČNO klientno:
 *
 *   const PlanMap = dynamic(
 *     () => import("@/components/plan/plan-map").then((m) => m.PlanMap),
 *     { ssr: false }
 *   );
 *
 * Sam modul ne dostopa do window/document na vrhu — ves DOM dostop je v
 * efektih/klikalnih rutah (odpravlja se šele po montaži na klientu).
 */

import L from "leaflet";
import { useLocale } from "next-intl";
import * as React from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";

import { pick } from "@/lib/i18n-pick";
import {
  DAY_COLORS,
  planMapData,
  type PlanMapMarker,
} from "@/lib/plan-map-data";
import type { TripStop } from "@/lib/types";

import "leaflet/dist/leaflet.css";

/** Sredina pogleda: Slovenija; zoom, ki primerja državo na enem pogledu. */
const MAP_CENTER: [number, number] = [46.15, 14.99];
const MAP_ZOOM = 8;

/** Velikost znaka dneva (px) — poudarjen postanek je povečan. */
const BADGE_SIZE = 24;
const BADGE_SIZE_ACTIVE = 30;

/** zIndexOffset poudarjenega markerja (nad vsemi ostalimi znaki). */
const Z_ACTIVE = 1000;

/**
 * Interni i18n slovar ×6 (kanon i18n-pick: „sl" je vedno resnica,
 * ostali jeziki so prevodi po istem ključu). Množinske oblike so
 * funkcije (n) => niz — enako kot daysWord/ratingOf v travel-map.
 */
const L10N = {
  mapLabel: {
    sl: "Zemljevid načrta Discover Slovenia",
    en: "Discover Slovenia plan map",
    it: "Mappa del piano di Discover Slovenia",
    de: "Discover-Slovenia-Plankarte",
    fr: "Carte du plan Discover Slovenia",
    es: "Mapa del plan de Discover Slovenia",
  },
  straightNote: {
    sl: "Povezave so premočrtne (ne vozljiva pot) · Podatki: OpenStreetMap",
    en: "Connections are straight lines (not a drivable route) · Data: OpenStreetMap",
    it: "I collegamenti sono linee rette (non un percorso percorribile) · Dati: OpenStreetMap",
    de: "Verbindungen sind gerade Linien (keine befahrbare Route) · Daten: OpenStreetMap",
    fr: "Les liaisons sont des lignes droites (pas un itinéraire routable) · Données : OpenStreetMap",
    es: "Las conexiones son líneas rectas (no una ruta transitable) · Datos: OpenStreetMap",
  },
  skippedNote: {
    sl: (n: number) =>
      n === 1
        ? `${n} postanek brez znanih koordinat ni prikazan`
        : n === 2
        ? `${n} postanka brez znanih koordinat nista prikazana`
        : n < 5
        ? `${n} postanki brez znanih koordinat niso prikazani`
        : `${n} postankov brez znanih koordinat ni prikazanih`,
    en: (n: number) =>
      `${n} ${n === 1 ? "stop" : "stops"} without known coordinates ${n === 1 ? "is" : "are"} not shown`,
    it: (n: number) =>
      `${n} ${n === 1 ? "tappa senza coordinate note non è mostrata" : "tappe senza coordinate note non sono mostrate"}`,
    de: (n: number) =>
      `${n} ${n === 1 ? "Halt ohne bekannte Koordinaten wird nicht angezeigt" : "Halte ohne bekannte Koordinaten werden nicht angezeigt"}`,
    fr: (n: number) =>
      `${n} ${n === 1 ? "étape sans coordonnées connues n'est pas affichée" : "étapes sans coordonnées connues ne sont pas affichées"}`,
    es: (n: number) =>
      `${n} ${n === 1 ? "parada sin coordenadas conocidas no se muestra" : "paradas sin coordenadas conocidas no se muestran"}`,
  },
  dayLabel: {
    sl: (n: number) => `Dan ${n}`,
    en: (n: number) => `Day ${n}`,
    it: (n: number) => `Giorno ${n}`,
    de: (n: number) => `Tag ${n}`,
    fr: (n: number) => `Jour ${n}`,
    es: (n: number) => `Día ${n}`,
  },
  noTime: {
    sl: "brez ure",
    en: "no time",
    it: "senza orario",
    de: "ohne Uhrzeit",
    fr: "sans horaire",
    es: "sin hora",
  },
};

export interface PlanMapProps {
  days: TripStop[][];
  highlightId?: string | null;
  onMarkerClick?: (stopId: string) => void;
}

/**
 * divIcon znak dneva — okrogel krogec s ŠTEVILKO DNEVA v barvi dneva in
 * belo pisavo (BREZ slikovnih ikon — isti kanon kot travel-map: divIcon
 * z lastnim html obide past manjkajočih marker png ikon).
 *
 * Edini html vsebini sta STATIČNA številka dneva (dayIdx + 1) in barva —
 * noben uporabniški podatek (ime postanka) nikoli ne pride v html niz
 * (XSS kanon; ime je izključno v tooltipu prek textContent).
 */
function dayIcon(dayIdx: number, active: boolean): L.DivIcon {
  const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
  const size = active ? BADGE_SIZE_ACTIVE : BADGE_SIZE;
  const font = active ? 14 : 12;
  // Poudarek: dodatna bela obroba (ring) okrog povečanega znaka.
  const ring = active ? "0 0 0 3px #ffffff, " : "";
  return L.divIcon({
    className: "dsa-map-pin",
    html:
      `<span style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;` +
      `width:${size}px;height:${size}px;border-radius:9999px;background:${color};color:#ffffff;` +
      `border:2px solid #ffffff;box-shadow:${ring}0 1px 5px rgba(0,0,0,.5);` +
      `font:700 ${font}px/1 ui-sans-serif,system-ui,sans-serif">${dayIdx + 1}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * FIT-BOUNDS krmilnik: ob spremembi markerjev pogled obsegne cel načrt
 * (kanon travel-map: 1 marker → setView, ≥ 2 markerja → fitBounds).
 * Brez markerjev NE ukrepamo nič — pogled ostane na Sloveniji.
 */
function FitPlanBounds({ markers }: { markers: PlanMapMarker[] }) {
  const map = useMap();

  React.useEffect(() => {
    if (markers.length === 1) {
      map.setView([markers[0].coords.lat, markers[0].coords.lng], 11);
      return;
    }
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(
      markers.map(
        (m) => [m.coords.lat, m.coords.lng] as [number, number]
      )
    );
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [markers, map]);

  return null;
}

/**
 * EN MARKER NAČRTA — znak s številko dneva + tooltip po DOM kanonu.
 *
 * Tooltip „Dan d · ura | brez ure · ime" gradimo IZKLJUČNO z
 * document.createElement + textContent (ime postanka je lahko vnos
 * uporabnika — vsebina tooltipa se NIKOLI ne sestavi kot html niz).
 * Vezava je idempotentna (unbindTooltip → bindTooltip) in se obnovi ob
 * spremembi jezika ali podatkov postanka.
 */
function PlanMarker({
  stop,
  highlighted,
  dayLabel,
  noTime,
  onMarkerClick,
}: {
  stop: PlanMapMarker;
  highlighted: boolean;
  dayLabel: (n: number) => string;
  noTime: string;
  onMarkerClick?: (stopId: string) => void;
}) {
  const markerRef = React.useRef<L.Marker | null>(null);

  React.useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.unbindTooltip();
    const text = `${dayLabel(stop.dayIdx + 1)} · ${stop.time ?? noTime} · ${stop.name}`;
    const el = document.createElement("span");
    el.textContent = text; // DOM kanon: nikoli html niz z imenom postanka
    el.style.fontWeight = "600";
    el.style.whiteSpace = "nowrap";
    marker.bindTooltip(el, {
      direction: "top",
      offset: [0, -(BADGE_SIZE / 2 + 6)],
    });
  }, [stop, dayLabel, noTime]);

  return (
    <Marker
      ref={(m: L.Marker | null) => {
        markerRef.current = m;
      }}
      position={[stop.coords.lat, stop.coords.lng]}
      icon={dayIcon(stop.dayIdx, highlighted)}
      zIndexOffset={highlighted ? Z_ACTIVE : 0}
      eventHandlers={{
        click: () => {
          // Sinhronizacija seznam ↔ zemljevid (kanon Wanderlog #6).
          onMarkerClick?.(stop.id);
          markerRef.current?.openTooltip();
        },
      }}
    />
  );
}

/**
 * ZEMLJEVID NAČRTA — dnevno obarvani številčni markerji + črtkane
 * premočrtne povezave z iskreno opombo. Imenovani export PlanMap
 * (nalaganje izključno klientno: glej SSR opombo na vrhu modula).
 */
export function PlanMap({ days, highlightId, onMarkerClick }: PlanMapProps) {
  const l = useLocale();

  // Čista izpeljava (memo: isti `days` → isti objekti, zato se tooltipi
  // ne vežejo znova ob vsakem renderju).
  const data = React.useMemo(() => planMapData(days), [days]);

  const mapLabel = pick(l, L10N.mapLabel);
  const straightNote = pick(l, L10N.straightNote);
  const skippedNote = pick(l, L10N.skippedNote);
  const dayLabel = pick(l, L10N.dayLabel);
  const noTime = pick(l, L10N.noTime);

  return (
    <div>
      {/* Zemljevid — a11y oznaka na ovojnem elementu (MapContainer ne
          sprejema ARIA atributov v tipih react-leaflet); višina prek
          wrapper diva (h-72 sm:h-80), usklajeno z ostalimi vgrajenimi
          zemljevidi projekta. */}
      <div
        className="h-72 overflow-hidden rounded-xl border sm:h-80"
        role="region"
        aria-label={mapLabel}
      >
        <MapContainer
          center={MAP_CENTER}
          zoom={MAP_ZOOM}
          minZoom={5}
          maxZoom={18}
          scrollWheelZoom
          className="h-full w-full"
        >
          {/* OSM ploščice (CSP img-src že dovoljuje tile.openstreetmap.org
              globalno — glej csp.ts) + obvezna atribucija. */}
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          />
          <FitPlanBounds markers={data.markers} />
          {/* Povezave po dnevih — ČRTKANO = iskrena premočrtna črta
              (nikoli ne sugestira vozljive poti; glej opombo spodaj). */}
          {data.dayLines.map((line) => (
            <Polyline
              key={`day-line-${line.dayIdx}`}
              positions={line.points.map(
                (p) => [p.lat, p.lng] as [number, number]
              )}
              pathOptions={{
                color: DAY_COLORS[line.dayIdx % DAY_COLORS.length],
                weight: 3,
                opacity: 0.8,
                dashArray: "6 8",
              }}
            />
          ))}
          {data.markers.map((m) => (
            <PlanMarker
              key={m.id}
              stop={m}
              highlighted={highlightId === m.id}
              dayLabel={dayLabel}
              noTime={noTime}
              onMarkerClick={onMarkerClick}
            />
          ))}
        </MapContainer>
      </div>

      {/* Iskreni opombi pod zemljevidom: (1) povezave NISO vozljiva pot,
          vir ploščic OSM; (2) kadar so postanki brez koordinat, koliko
          jih ni prikazanih (koordinat ne izmišljujemo). */}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {straightNote}
      </p>
      {data.skippedNoCoords > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {skippedNote(data.skippedNoCoords)}
        </p>
      )}
    </div>
  );
}
