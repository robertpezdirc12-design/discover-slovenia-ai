'use client';

/**
 * ZEMLJEVID (Leaflet) — čist regijski pregled, pini apartmajev + popupi.
 *
 * Tok po uporabnikovi zahtevi (brez zelenih krogec / pinov držav):
 *  1) regijski pregled (Slovenija + Balkan) — brez oznak držav,
 *  2) državo izbereš v spustnem okencu → starš pokliče flyTo/fit-bounds
 *     in se zemljevid približa izbrani državi,
 *  3) izbira »Apartmaji« → pini vseh apartmajev v Sloveniji z popupi.
 *
 * Apartmajski pini se gradijo imperativno v LayerGroup (stotine kosov →
 * brez React overheada). Komunikacija s staršem: callback propi +
 * imperativni handle (flyTo …).
 */

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { REGION_VIEW, SLOVENIA_BOUNDS, countryById } from '@/lib/countries-view';
import type { ApartmentApiItem } from '@/lib/apartments-view';

export interface MapViewHandle {
  flyToCountry: (id: string) => void;
  fitSlovenia: () => void;
  flyToApartment: (id: string) => void;
  resetRegion: () => void;
}

export interface MapViewProps {
  apartments: ApartmentApiItem[];
  apartmentsVisible: boolean;
  activeApartmentId: string | null;
  onSelectApartment: (id: string) => void;
}

/** Escapaj besedila za HTML popup (varnost: imena so iz tujih virov). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML vsebine popupa apartmaja (ime, naslov, cena, povezave). */
function apartmentPopupHtml(a: ApartmentApiItem): string {
  const place = [a.city, a.postcode].filter(Boolean).join(' · ');
  const streetLine = a.street ? `<div class="dsa-popup__meta">${escapeHtml(a.street)}</div>` : '';
  const stars = a.stars ? `${'★'.repeat(a.stars)}${'☆'.repeat(5 - a.stars)}` : '';
  const website = a.website
    ? `<a class="dsa-popup__link" href="${escapeHtml(a.website)}" target="_blank" rel="noopener noreferrer">spletna stran ↗</a>`
    : '';
  const phone = a.phone
    ? `<a class="dsa-popup__link" href="tel:${escapeHtml(a.phone.replace(/\s+/g, ''))}">${escapeHtml(a.phone)}</a>`
    : '';
  const metaBits = [website, phone].filter(Boolean).join('<span class="dsa-popup__meta"> · </span>');
  return (
    `<div>` +
    `<div class="dsa-popup__name">${escapeHtml(a.name)}</div>` +
    (place ? `<div class="dsa-popup__meta">${escapeHtml(place)}</div>` : '') +
    streetLine +
    `<div class="dsa-popup__row"><span class="dsa-popup__price">od ~${a.priceFrom} € / noč</span>${stars ? `<span class="dsa-popup__meta" title="zvezdice (OSM)">${stars}</span>` : ''}</div>` +
    `<div class="dsa-popup__row"><small class="dsa-popup__meta">Indikativna ocena, ne uradni cenik.</small></div>` +
    (metaBits ? `<div class="dsa-popup__row">${metaBits}</div>` : '') +
    `<span class="dsa-popup__badge">vir: OpenStreetMap (${escapeHtml(a.source)})</span>` +
    `</div>`
  );
}

/** SVG hišica za apartma pin (bela, na zelenem označevalniku). */

const HOUSE_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

function apartmentIcon(active: boolean): L.DivIcon {
  return L.divIcon({
    className: 'dsa-pin-apartment',
    html: `<div class="dsa-apartment-pin${active ? ' dsa-apartment-pin--active' : ''}" role="img" aria-label="apartma">${HOUSE_SVG}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 23],
    popupAnchor: [0, -20],
  });
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    apartments,
    apartmentsVisible,
    activeApartmentId,
    onSelectApartment,
  },
  ref,
) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const prevActiveRef = useRef<string | null>(null);
  const selectApartmentRef = useRef(onSelectApartment);
  useEffect(() => {
    selectApartmentRef.current = onSelectApartment;
  }, [onSelectApartment]);

  // Imperativni ukazi za starša (flyTo po kliku na državo/apartma/reset)
  useImperativeHandle(ref, () => ({
    flyToCountry(id: string) {
      const c = countryById(id);
      if (!c || !mapRef.current) return;
      mapRef.current.flyTo([c.lat, c.lng], c.zoom, { duration: 1.1 });
    },
    fitSlovenia() {
      mapRef.current?.flyToBounds(SLOVENIA_BOUNDS, { padding: [24, 24], duration: 1.1 });
    },
    flyToApartment(id: string) {
      const marker = markersRef.current.get(id);
      if (!marker || !mapRef.current) return;
      const latlng = marker.getLatLng();
      mapRef.current.flyTo(latlng, Math.max(mapRef.current.getZoom(), 14), { duration: 0.9 });
      marker.openPopup();
    },
    resetRegion() {
      mapRef.current?.flyTo([REGION_VIEW.lat, REGION_VIEW.lng], REGION_VIEW.zoom, { duration: 1.0 });
    },
  }));

  // Apartmajska plast — imperativno (stotine pinov brez React overheada)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map);
    }
    const layer = layerRef.current;
    const nextIds = new Set(apartmentsVisible ? apartments.map((a) => a.id) : []);

    // Odstrani zastarele pine
    for (const [id, marker] of markersRef.current) {
      if (!nextIds.has(id)) {
        layer.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    // Dodaj nove pine (ko plast preklopi na vidno / pridejo novi podatki)
    if (apartmentsVisible) {
      for (const a of apartments) {
        if (markersRef.current.has(a.id)) continue;
        const marker = L.marker([a.lat, a.lng], {
          icon: apartmentIcon(false),
          title: a.name,
          alt: `Apartma ${a.name}`,
        })
          .bindPopup(apartmentPopupHtml(a), { maxWidth: 280 })
          .on('click', () => selectApartmentRef.current(a.id));
        marker.addTo(layer);
        markersRef.current.set(a.id, marker);
      }
    }
  }, [apartments, apartmentsVisible]);

  // Poudarek izbranega apartmaja (zamenjata se samo 2 pina — cenovno)
  useEffect(() => {
    if (prevActiveRef.current === activeApartmentId) return;
    const prev = prevActiveRef.current ? markersRef.current.get(prevActiveRef.current) : null;
    if (prev) prev.setIcon(apartmentIcon(false));
    const next = activeApartmentId ? markersRef.current.get(activeApartmentId) : null;
    if (next) next.setIcon(apartmentIcon(true));
    prevActiveRef.current = activeApartmentId;
  }, [activeApartmentId]);

  return (
    <MapContainer
      ref={(instance) => {
        mapRef.current = instance;
      }}
      center={[REGION_VIEW.lat, REGION_VIEW.lng]}
      zoom={REGION_VIEW.zoom}
      minZoom={4}
      maxZoom={18}
      zoomSnap={0.25}
      zoomDelta={0.5}
      scrollWheelZoom
      className="h-full w-full"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> sodelavci'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
});

export default MapView;
