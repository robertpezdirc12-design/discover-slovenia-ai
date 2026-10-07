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
 *
 * Hidracija: komponento nalagamo IZKLJUČNO klientno prek next/dynamic
 * ssr:false (glej app/[locale]/zemljevid/page.tsx) — Leaflet potrebuje
 * window, zato SSR ni mogoč (nalagalni Skeleton med čakanjem).
 */

import L from "leaflet";
import {
  Check,
  Heart,
  Loader2,
  MapPin,
  Route,
  Search,
  Star,
  Store,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import Image from "next/image";
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
}: {
  enabled: boolean;
  onResult: (pins: MapPinDTO[], mode: "grid" | "pins") => void;
  onError: () => void;
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
  }, [enabled, map, onResult, onError]);

  return null;
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
  labels: { add: string; added: string; more: string; ratingOf: (v: string) => string };
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

  // ── Plasti (FAZA 3 / 51-b): Lokali (pins API) + Pot (OSRM route) ────
  const [lokaliOn, setLokaliOn] = React.useState(false);
  const [lokaliPins, setLokaliPins] = React.useState<MapPinDTO[]>([]);
  const [lokaliMode, setLokaliMode] = React.useState<"grid" | "pins" | null>(
    null
  );
  const [lokaliError, setLokaliError] = React.useState(false);
  const [routeState, setRouteState] = React.useState<RouteState>({
    status: "idle",
  });

  const mapRef = React.useRef<L.Map | null>(null);
  const markerRefs = React.useRef<Record<string, L.Marker | null>>({});
  const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

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
      fr: "Aucune destination ne correspond à votre recherche ou à vos filtres — effacez-les et réessayez.",
      es: "Ningún destino coincide con tu búsqueda o filtros — bórralos e inténtalo de nuevo.",
    },
    legend: { sl: "Legenda tipov", en: "Type legend", it: "Legenda dei tipi", de: "Typen-Legende", fr: "Légende des types", es: "Leyenda de tipos" },
    hint: {
      sl: "Klikni marker za podrobnosti · Podatki: OpenStreetMap (ODbL)",
      en: "Click a marker for details · Data: OpenStreetMap (ODbL)",
      it: "Clicca un marker per i dettagli · Dati: OpenStreetMap (ODbL)",
      de: "Klicke auf einen Marker für Details · Daten: OpenStreetMap (ODbL)",
      fr: "Cliquez sur un marqueur pour les détails · Données : OpenStreetMap (ODbL)",
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
    },
    []
  );

  const handlePinsError = React.useCallback(() => setLokaliError(true), []);

  /** Preklop plasti Lokali — ob izklopu takoj počisti (brez ostankov). */
  const toggleLokali = () => {
    const next = !lokaliOn;
    setLokaliOn(next);
    if (!next) {
      setLokaliPins([]);
      setLokaliMode(null);
      setLokaliError(false);
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      {/* ── Nadzorna vrstica: iskanje + regija + ponastavitev ─────────── */}
      <div className="mt-8 grid gap-3 md:grid-cols-[1fr_auto_auto]">
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
          <SelectTrigger className="h-11 md:w-56" aria-label={t("regionFilter")}>
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
          <Button type="button" variant="outline" onClick={reset} className="h-11">
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
      <div
        role="group"
        aria-label={t("allTypes")}
        className="scrollbar-slim mt-3 flex gap-2 overflow-x-auto pb-1"
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

      {/* ── Plasti: Lokali + Pot (FAZA 3 / 51-b) ─────────────────────── */}
      <div
        role="group"
        aria-label={t("layersLabel")}
        className="mt-3 flex flex-wrap items-center gap-2"
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

        {lokaliOn && lokaliMode === "grid" && !lokaliError && (
          <span className="inline-flex h-11 items-center rounded-full border border-dashed bg-card px-4 text-xs font-medium text-muted-foreground">
            {t("zoomHint")}
          </span>
        )}
        {lokaliOn && lokaliError && (
          <span
            role="status"
            className="inline-flex h-11 items-center rounded-full border border-destructive/40 bg-destructive/10 px-4 text-xs font-medium text-destructive"
          >
            {t("pinsUnavailable")}
          </span>
        )}
        {routeState.status === "error" && (
          <span
            role="status"
            className="inline-flex h-11 items-center rounded-full border border-destructive/40 bg-destructive/10 px-4 text-xs font-medium text-destructive"
          >
            {t("routeUnavailable")}
          </span>
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

      {/* ── Zemljevid + stranski seznam ──────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Zemljevid — a11y oznaka na ovojnem elementu (MapContainer ne
            sprejema ARIA atributov v tipih react-leaflet). */}
        <div
          className="overflow-hidden rounded-xl border shadow-sm"
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
            className="h-[62vh] min-h-80 w-full sm:h-[70vh] lg:h-[calc(100dvh-15rem)] lg:min-h-[540px]"
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
                    }}
                    locale={l}
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

        {/* Sinhroniziran seznam destinacij (hover/klik ↔ markerji). */}
        <aside aria-label={t("listTitle")}>
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
            <ul className="scrollbar-slim max-h-[62vh] list-none space-y-1.5 overflow-y-auto pr-1 sm:max-h-[70vh] lg:max-h-[calc(100dvh-16rem)]">
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

      {/* ── Legenda tipov + attribution ──────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
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
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
    </div>
  );
}
