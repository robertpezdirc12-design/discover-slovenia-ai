'use client';

/**
 * ZEMLJEVID (Leaflet) — čist regijski pregled, pini apartmajev + popupi.
 *
 * Tok po uporabnikovi zahtevi (brez zelenih krogec / pinov držav):
 *  1) regijski pregled (Slovenija + Balkan) — brez oznak držav,
 *  2) državo izbereš v spustnem okencu → starš pokliče flyTo/fit-bounds
 *     in se zemljevid približa izbrani državi,
 *  3) izbira »Apartmaji« → pini VSEH uradno registriranih ponudnikov
 *     prenočitev (AJPES PRS) v Sloveniji; klik na pin pokaže popup
 *     z uradnim naslovom in statusom registracije.
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
import type { PlaceResult } from '@/lib/place-categories';

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
  /** »Iščem« — pini kategorije krajev (muzeji, restavracije …). */
  places: PlaceResult[];
  placesLabel: string | null;
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

/** HTML vsebine popupa prenočišča (ime, uradni naslov, vir). */
function apartmentPopupHtml(a: ApartmentApiItem): string {
  const isAjpes = a.source === 'ajpes';
  const place = [a.city, a.postcode].filter(Boolean).join(' · ');
  const streetLine = a.street ? `<div class="dsa-popup__meta">${escapeHtml(a.street)}</div>` : '';
  const obcinaLine = a.obcina
    ? `<div class="dsa-popup__meta">občina ${escapeHtml(a.obcina)}</div>`
    : '';
  const stars = a.stars ? `${'★'.repeat(a.stars)}${'☆'.repeat(5 - a.stars)}` : '';
  const website = a.website
    ? `<a class="dsa-popup__link" href="${escapeHtml(a.website)}" target="_blank" rel="noopener noreferrer">spletna stran ↗</a>`
    : '';
  const phone = a.phone
    ? `<a class="dsa-popup__link" href="tel:${escapeHtml(a.phone.replace(/\s+/g, ''))}">${escapeHtml(a.phone)}</a>`
    : '';
  const metaBits = [website, phone].filter(Boolean).join('<span class="dsa-popup__meta"> · </span>');

  if (isAjpes) {
    // URADNI vir (AJPES) — samo pravi podatki registra, brez ocen.
    const official =
      `<div class="dsa-popup__row">` +
      `<span class="dsa-popup__badge">✔ uradno registriran ponudnik</span>` +
      (a.legalForm ? `<span class="dsa-popup__meta">${escapeHtml(a.legalForm)}</span>` : '') +
      `</div>` +
      (a.maticna
        ? `<div class="dsa-popup__row"><small class="dsa-popup__meta">matična št. ${escapeHtml(a.maticna)} · AJPES Poslovni register RS</small></div>`
        : '');
    return (
      `<div>` +
      `<div class="dsa-popup__name">${escapeHtml(a.name)}</div>` +
      (place ? `<div class="dsa-popup__meta">${escapeHtml(place)}</div>` : '') +
      streetLine +
      obcinaLine +
      official +
      `</div>`
    );
  }

  // OSM rezerva — prikažemo le resnične podatke (brez ocenjenih cen).
  const starsRow = stars ? `<div class="dsa-popup__row"><span class="dsa-popup__meta" title="zvezdice (OSM)">${stars}</span></div>` : '';
  return (
    `<div>` +
    `<div class="dsa-popup__name">${escapeHtml(a.name)}</div>` +
    (place ? `<div class="dsa-popup__meta">${escapeHtml(place)}</div>` : '') +
    streetLine +
    obcinaLine +
    starsRow +
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
    places,
    placesLabel,
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

  // ── »Iščem« plast — pini kategorije krajev (muzeji, restavracije …) ──
  const placesLayerRef = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!placesLayerRef.current) placesLayerRef.current = L.layerGroup().addTo(map);
    const layer = placesLayerRef.current;
    layer.clearLayers();
    if (places.length === 0) return;

    /** Osnovna vsebina popupa (prikaže se takoj ob kliku). */
    const baseHtml = (p: PlaceResult): string =>
      `<div>` +
      `<div class="dsa-popup__name">${escapeHtml(p.name)}</div>` +
      (p.address
        ? `<div class="dsa-popup__meta">${escapeHtml(p.address)}</div>`
        : p.city
          ? `<div class="dsa-popup__meta">${escapeHtml(p.city)}</div>`
          : '') +
      `<div class="dsa-popup__meta">${escapeHtml(placesLabel ?? '')}</div>` +
      (p.note ? `<div class="dsa-popup__meta" style="margin-top:2px">${escapeHtml(p.note)}</div>` : '') +
      (p.source === 'remk'
        ? `<span class="dsa-popup__badge">✔ uradno vpisan — Razvid muzejev RS (REMK)</span>`
        : `<span class="dsa-popup__badge">vir: ${p.curated ? 'kuriran katalog (približna lokacija)' : 'OpenStreetMap'}</span>`) +
      `</div>`;

    /** Obogatitev z Wikipedijo (asinhrono): slika + povzetek + povezavi.
     *  Deluje za vse muzeje, tudi za tiste brez kurirane spletne strani. */
    const enrichWithWiki = (marker: L.Marker, p: PlaceResult) => {
      const popup = marker.getPopup();
      if (!popup || !popup.isOpen()) return;
      fetch(`/api/open-data/wiki?title=${encodeURIComponent(p.name)}&lang=sl`)
        .then((r) =>
          r.ok ? (r.json() as Promise<{ ok: boolean; wiki?: { title: string; extract: string; thumb: string | null } }>) : null,
        )
        .then((j) => {
          if (!j?.ok || !j.wiki) return;
          if (!popup.isOpen()) return;
          const wikiLink = `https://sl.wikipedia.org/wiki/${encodeURIComponent(j.wiki.title.replace(/ /g, '_'))}`;
          popup.setContent(
            `<div>` +
              (j.wiki.thumb
                ? `<img src="${escapeHtml(j.wiki.thumb)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:6px"/>`
                : '') +
              `<div class="dsa-popup__name">${escapeHtml(p.name)}</div>` +
              (p.address
                ? `<div class="dsa-popup__meta">${escapeHtml(p.address)}</div>`
                : p.city
                  ? `<div class="dsa-popup__meta">${escapeHtml(p.city)}</div>`
                  : '') +
              (p.note ? `<div class="dsa-popup__meta" style="margin-top:2px">${escapeHtml(p.note)}</div>` : '') +
              `<div class="dsa-popup__meta" style="margin-top:2px">${escapeHtml(j.wiki.extract.slice(0, 220))}${j.wiki.extract.length > 220 ? '…' : ''}</div>` +
              `<div class="dsa-popup__row"><a class="dsa-popup__link" href="${escapeHtml(wikiLink)}" target="_blank" rel="noopener noreferrer">Wikipedija ↗</a>` +
              (p.website
                ? `<span class="dsa-popup__meta"> · </span><a class="dsa-popup__link" href="${escapeHtml(p.website)}" target="_blank" rel="noopener noreferrer">uradna stran ↗</a>`
                : '') +
              `</div>` +
              (p.source === 'remk'
                ? `<span class="dsa-popup__badge">✔ uradno vpisan — Razvid muzejev RS (REMK)</span>`
                : '') +
              `</div>`,
          );
        })
        .catch(() => {
          /* brez Wikipedije ostane osnovni popup */
        });
    };

    for (const p of places) {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'dsa-pin-place',
          html:
            `<div style="width:16px;height:16px;border-radius:50%;background:#0891b2;border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.45)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        title: p.name,
        alt: `${placesLabel ?? 'Kraj'} ${p.name}`,
      })
        .bindPopup(baseHtml(p), { maxWidth: 280 })
        .on('click', () => enrichWithWiki(marker, p));
      marker.addTo(layer);
    }
  }, [places, placesLabel]);

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
