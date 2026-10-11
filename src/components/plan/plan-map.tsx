"use client";

/**
 * PLAN-MAP — zemljevid ob načrtu (/nacrtuj; 2.29.0 POLIR2 B, 2.30.0 POLIR3 A).
 *
 * Leaflet/OSM zemljevid načrta potovanja (vzorci iz travel-map.tsx —
 * Leaflet 1.9 + react-leaflet 5, OSM ploščice, divIcon brez slik):
 *  - MARKERJI po dnevih: okrogel znak s ŠTEVILKO DNEVA (divIcon, BREZ
 *    slikovnih ikon — obide znano bundler past leaflet+marker png), barva
 *    ozadja DAY_COLORS[dayIdx % 8], bela številka. Poudarjen postanek
 *    (highlightId === stop.id) je povečan, z belo obrobo in višjim
 *    zIndexOffset (kanon sinhronizacije seznam ↔ zemljevid).
 *  - POVEZAVE med postanki dneva (POLIR3 A, 2.30.0): izriše se ČRTKANA
 *    PREMOCRTNA črta (dashArray "6 8", weight 3) TAKOJ ob spremembi dni
 *    (nalaganje NE blokira), po odgovoru strežniškega proxyja
 *    /api/plan/directions (OSRM) pa jo za uspešne dneve zamenja POLNA
 *    črta iz DEJANSKE OSRM geometry (weight 4, opacity 0.9). Polna črta
 *    nastane IZKLJUČNO iz dejanske geometry — ob padcu/timeoutu ostane
 *    črtkana premočrtna črta z obstoječo iskreno opombo (nikoli
 *    izmišljene poti).
 *  - ISKRENOST: postankov brez znanih koordinat se NE izmišljuje — niso
 *    prikazani; kadar jih je > 0, pod zemljevidom stoji iskren števec
 *    izpuščenih (planMapData.skippedNoCoords). Dan, ki ima sredinski
 *    postanek brez koordinat, OSTANE črtkan: proxy prejme samo CELE dneve
 *    (OSRM ne sme dobiti vrzeli v poti, mi pa ne izmišljujemo medtočk).
 *  - VARNOST (XSS kanon): tooltip „Dan d · ura | brez ure · ime" je
 *    sestavljen IZKLJUČNO prek DOM elementa (document.createElement +
 *    textContent) — ime postanka je lahko uporabnikov vnos (custom
 *    postanki), zato vsebina tooltipa NIKOLI ni html niz. Edini html v
 *    divIconu je statična številka dneva + barva (brez uporabniških
 *    podatkov).
 *  - OMREŽJE: 0 zunanjih klicov; ob spremembi dni pošljemo EN POST na
 *    lastni proxy /api/plan/directions (RELATIVNA pot — kanon vremenskega
 *    proxyja; ZUNANJI URL-ji so v komponenti prepovedani). Stanje poti je
 *    VEZANO NA REFERENCO dni (isti kanon kot predogled vlečenja v 2.29.0):
 *    regeneracija/reurejanje samodejno razveljavi zastarelo stanje — brez
 *    setState v efektu (eslint react-hooks/set-state-in-effect čist).
 *  - POLIR5 A (2.32.0): neobvezen prop onMeasured — ob VSAKEM odgovoru
 *    proxyja (tudi delnem) pokliče izmerjene vrednosti dni { day, status,
 *    km?, min? } (km = distanceM/1000 na 1 decimalko, min = durationS/60 na
 *    5 — čista zaokrožitvi measuredKm/measuredMin iz plan-map-data). Padli
 *    dnevi so v seznamu s statusom "straight" in BREZ km/min (iskrena
 *    odsotnost). IZRIS SE NE SPREMINI — zemljevid ostaja sloj črt; izmerna
 *    poročila so POVZETEK NAČRTA v view.tsx, ne vir urnika (odločitev 2.30.0).
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
  measuredKm,
  measuredMin,
  planMapData,
  planMapLines,
  type DayGeometry,
  type MeasuredDay,
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

/** Prazno stanje poti (deljena konstanta — nikoli se ne mutira). */
const NO_ROUTES: Readonly<Record<number, DayGeometry>> = {};

/**
 * Koordinate dneva za proxy [lon, lat] (OSRM vrstni red) — ali null, če dan
 * NI upravičen do usmerjanja: < 2 postanka ali KATERIKOLI postanek brez
 * koordinat. Dan z vrzeljo OSTANE črtkan (glej opombo POLIR3 A zgoraj):
 * proxy prejme samo CELE dni, OSRM ne sme dobiti vrzeli v poti, mi pa ne
 * izmišljujemo medtočk (iskrenost).
 */
function dayCoords(stops: TripStop[]): [number, number][] | null {
  if (stops.length < 2) return null;
  const coords: [number, number][] = [];
  for (const s of stops) {
    if (!s.coords) return null;
    coords.push([s.coords.lng, s.coords.lat]); // [lon, lat] = OSRM vrstni red
  }
  return coords;
}

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
  routedNote: {
    sl: "Vozljiva pot (OSRM/OpenStreetMap); urnik načrta ostaja ocena.",
    en: "Drivable route (OSRM/OpenStreetMap); the plan's schedule remains an estimate.",
    it: "Percorso percorribile (OSRM/OpenStreetMap); l'orario del piano resta una stima.",
    de: "Befahrbare Route (OSRM/OpenStreetMap); der Zeitplan des Plans bleibt eine Schätzung.",
    fr: "Itinéraire routable (OSRM/OpenStreetMap) ; l'horaire du plan reste une estimation.",
    es: "Ruta transitable (OSRM/OpenStreetMap); el horario del plan sigue siendo una estimación.",
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
  /**
   * POLIR5 A (2.32.0): neobvezen povzetek IZMERJENIH dni (km/min iz OSRM
   * distance/duration). Pokliče se ob VSAKEM odgovoru proxyja — tudi delnem:
   *  - status "route" + km/min (km na 1 decimalko, min na 5) — izmerjeno;
   *  - status "straight" BREZ km/min — padel dan (fail-closed proxyja).
   * Privzeto undefined (skupni pogled in /potovanje se NE spreminjata).
   */
  onMeasured?: (stats: MeasuredDay[]) => void;
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
 * ZEMLJEVID NAČRTA — dnevno obarvani številčni markerji + povezave po
 * dnevih (POLNA OSRM črta ob uspehu, sicer iskrena ČRTKANA premočrtna).
 * Imenovani export PlanMap (nalaganje izključno klientno: glej SSR opombo
 * na vrhu modula).
 */
export function PlanMap({
  days,
  highlightId,
  onMarkerClick,
  onMeasured,
}: PlanMapProps) {
  const l = useLocale();

  // Čista izpeljava (memo: isti `days` → isti objekti, zato se tooltipi
  // ne vežejo znova ob vsakem renderju).
  const data = React.useMemo(() => planMapData(days), [days]);

  // POLIR3 A: usmerjene geometrije iz lastnega proxyja. Stanje je VEZANO
  // NA REFERENCO dni (kanon predogleda vlečenja 2.29.0): velja samo za
  // `days`, ob katerih je nastalo — regeneracija/reurejanje (nova
  // referenca) ga samodejno razveljavi, brez čiščenja v efektu.
  const [routeState, setRouteState] = React.useState<{
    forDays: TripStop[][] | null;
    routes: Record<number, DayGeometry>;
  }>({ forDays: null, routes: {} });

  // EN POST na lastni proxy ob montiranju in ob spremembi dni: en zahtevek
  // pomeni VSE upravičene dneve naenkrat (dan = ena postavka). Dnevi z
  // manjkajočo koordinato kateregakoli postanka se NE pošljejo — ostanejo
  // črtkani (iskrenost; glej dayCoords). NALAGANJE NE BLOKIRA: črtkane
  // črte se izrišejo takoj (stanje = prazno), polne zamenjajo črtkane
  // šele, ko odgovor pride.
  React.useEffect(() => {
    const eligible: { dayIdx: number; coords: [number, number][] }[] = [];
    days.forEach((stops, dayIdx) => {
      const coords = dayCoords(stops);
      if (coords) eligible.push({ dayIdx, coords });
    });
    if (eligible.length === 0) return; // nič za usmerjanje → 0 omrežja

    let cancelled = false;
    fetch("/api/plan/directions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ days: eligible.map((d) => d.coords) }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<unknown>) : null))
      .then((body) => {
        // Fail-closed: karkoli manjka/je slabe oblike → stanje ostane
        // prazno (črtkane črte z iskreno opombo ostanejo).
        if (cancelled || body === null || typeof body !== "object") return;
        const daysOut = (body as { days?: unknown }).days;
        if (!Array.isArray(daysOut)) return;
        const routes: Record<number, [number, number][]> = {};
        // POLIR5 A: izmerni povzetek VSAKEGA dneva odgovora (tudi padlega —
        // status "straight" brez km/min). Vrstni red = vrstni red daysOut.
        const stats: MeasuredDay[] = [];
        for (const entry of daysOut) {
          if (typeof entry !== "object" || entry === null) continue;
          const e = entry as {
            day?: unknown;
            status?: unknown;
            geometry?: unknown;
            distanceM?: unknown;
            durationS?: unknown;
          };
          if (typeof e.day !== "number") continue;
          const origin = eligible[e.day]; // day = indeks dneva V ZAHTEVI
          if (!origin) continue;
          if (e.status !== "route") {
            // straight/padec dneva → črtkana črta, izmerni povzetek brez števil.
            stats.push({ day: origin.dayIdx, status: "straight" });
            continue;
          }
          const geometry = e.geometry;
          if (!Array.isArray(geometry) || geometry.length < 2) {
            // Obrambno: "route" z slabo geometry ni izmerjen dan — iskrena
            // ocena (straight), ne polna črta iz sumljivih točk.
            stats.push({ day: origin.dayIdx, status: "straight" });
            continue;
          }
          const pts: [number, number][] = [];
          let valid = true;
          for (const p of geometry) {
            if (
              Array.isArray(p) &&
              p.length === 2 &&
              typeof p[0] === "number" &&
              Number.isFinite(p[0]) &&
              typeof p[1] === "number" &&
              Number.isFinite(p[1])
            ) {
              pts.push([p[0], p[1]]); // [lat, lon] — Leaflet vrstni red
            } else {
              valid = false;
              break;
            }
          }
          // IZMERJENI distanceM/durationS iz istega odgovora (aditivna polji
          // 2.32.0): končna, nenegativna števila — drugače dan NI izmerjen
          // (fail-closed: ne izmišljujemo števil, ki jih proxy ni poslal).
          const distanceM = e.distanceM;
          const durationS = e.durationS;
          const numsOk =
            typeof distanceM === "number" &&
            Number.isFinite(distanceM) &&
            distanceM >= 0 &&
            typeof durationS === "number" &&
            Number.isFinite(durationS) &&
            durationS >= 0;
          if (!valid || !numsOk) {
            stats.push({ day: origin.dayIdx, status: "straight" });
            continue;
          }
          routes[origin.dayIdx] = pts;
          stats.push({
            day: origin.dayIdx,
            status: "route",
            km: measuredKm(distanceM),
            min: measuredMin(durationS),
          });
        }
        setRouteState({ forDays: days, routes });
        // Povzetek izmerjenih dni gre navzgor ob vsakem odgovoru. POLIR6 A
        // (2.33.0): onMeasured zdaj podajo VSI pogledi poti (/nacrtuj,
        // /potovanje, /pot/[shareId] — oblak in lokalno); brez podpisa se
        // neobvezni klic NE izvede (starši brez izmer ostanejo pri črtah).
        onMeasured?.(stats);
      })
      .catch(() => {
        // fail-closed: napaka/odmerek → črtkane črte ostanejo (0 utripanja)
      });
    return () => {
      cancelled = true; // days so se spremenila → zastarel odgovor ignoriramo
    };
  }, [days, onMeasured]);

  // Samo stanje, ki pripada TRENUTNI referenci dni (zastarelo → prazno).
  const routes = routeState.forDays === days ? routeState.routes : NO_ROUTES;

  // Čista presodba črt + opomb (plan-map-data — testabilna brez Leafleta).
  const lineState = React.useMemo(
    () => planMapLines(data, routes),
    [data, routes]
  );

  const mapLabel = pick(l, L10N.mapLabel);
  const straightNote = pick(l, L10N.straightNote);
  const routedNote = pick(l, L10N.routedNote);
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
          {/* Povezave po dnevih: POLNA črta IZKLJUČNO iz dejanske OSRM
              geometry (weight 4, opacity 0.9); sicer iskrena ČRTKANA
              premočrtna črta (dashArray "6 8", weight 3) — nalaganje/
              padec/dan z vrzeljo nikoli ne blokirata izrisa.

              POZOR (Leaflet/react-leaflet past, živo dokazano): ob prehodu
              črtkana → polna pathOptions NESMEJO izpustiti dashArray —
              setStyle le ZLIVA manjkajoče ključe, zato bi zastareli
              "6 8" ostal na elementu in polna črta bi ostala črtkana.
              Eksplicitni dashArray: undefined počisti atribut. */}
          {lineState.lines.map((line) => (
            <Polyline
              key={`day-line-${line.dayIdx}`}
              positions={line.points}
              pathOptions={
                line.solid
                  ? {
                      color: DAY_COLORS[line.dayIdx % DAY_COLORS.length],
                      weight: 4,
                      opacity: 0.9,
                      dashArray: undefined, // POČISTI zastarelo črtkanje
                    }
                  : {
                      color: DAY_COLORS[line.dayIdx % DAY_COLORS.length],
                      weight: 3,
                      opacity: 0.8,
                      dashArray: "6 8",
                    }
              }
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

      {/* Iskrene opombe pod zemljevidom (logika planMapLines.notes):
          (1) vsaj ena POLNA črta → „Vozljiva pot (OSRM/…) — urnik ostaja
          ocena"; (2) vsaj ena ČRTKANA črta ali nobena pot → „Povezave so
          premočrtne (ne vozljiva pot)"; mešano stanje pokaže OBE. Vir
          OSM/OSRM je vedno v opombi (atribucija). */}
      {lineState.notes.routed && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {routedNote}
        </p>
      )}
      {lineState.notes.straight && (
        <p
          className={
            lineState.notes.routed
              ? "mt-1 text-xs leading-relaxed text-muted-foreground"
              : "mt-2 text-xs leading-relaxed text-muted-foreground"
          }
        >
          {straightNote}
        </p>
      )}
      {data.skippedNoCoords > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {skippedNote(data.skippedNoCoords)}
        </p>
      )}
    </div>
  );
}
