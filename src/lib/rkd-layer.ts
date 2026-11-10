/**
 * RKD — Leaflet adapter (sloj na zemljevidu).
 *
 * Ločeno od `rkd.ts`, ker potrebuje brskalniški Leaflet; logika ostaja
 * preprosta in prenosljiva. Gruče (mrežne celice) so označevalci s
 * številom; klik na gručo približa, klik na posamezno enoto odpre
 * pojavno okno s fotografijo, opisom in povezavo v eID.
 */

import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import type { RkdCluster, RkdFeature } from './rkd';
import { rkdPhotoUrl, rkdUnitUrl } from './rkd';

export type LeafletModule = typeof import('leaflet');

/** Imena tipov (stabilna, indeks = RKD_TYPE_LABELS iz nabora). */
export const RKD_TYPE_LABELS: readonly string[] = [
  'stavbe',
  'spominski objekti in kraji',
  'arheološka najdišča',
  'naselja in njihovi deli',
  'drugi objekti in naprave',
  'kulturna krajina',
  'parki in vrtovi',
  'stavbe s parki ali z vrtovi',
  'ostalo',
];

/** Barve tipov (stabilne, indeks = RKD_TYPE_LABELS). */
export const RKD_TYPE_COLORS: readonly string[] = [
  '#b91c1c', // stavbe
  '#1d4ed8', // spominski objekti in kraji
  '#047857', // arheološka najdišča
  '#7c3aed', // naselja in njihovi deli
  '#b45309', // drugi objekti in naprave
  '#0e7490', // kulturna krajina
  '#15803d', // parki in vrtovi
  '#a21caf', // stavbe s parki ali z vrtovi
  '#57534e', // ostalo
];

function escapeHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML pojavnega okna za posamezno enoto (XSS-varno). */
export function rkdPopupHtml(
  feature: RkdFeature,
  typeLabels: readonly string[] = RKD_TYPE_LABELS,
): string {
  const label = typeLabels[feature.t] ?? 'Dediščina';
  const photo = rkdPhotoUrl(feature.ph);
  const photoHtml = photo
    ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:6px"/>`
    : '';
  const municipality = feature.m ? `<span style="color:#53675f;font-size:11px">${escapeHtml(feature.m)}</span>` : '';
  const desc = feature.d ? `<p style="margin:4px 0;color:#2d3f38;font-size:12px;line-height:1.4">${escapeHtml(feature.d)}</p>` : '';
  const url = rkdUnitUrl(feature.e);
  return `<div style="min-width:190px;max-width:240px">
    ${photoHtml}
    <span style="display:inline-block;background:#e7f1eb;color:#247251;font-size:10px;font-weight:600;padding:1px 8px;border-radius:999px">${escapeHtml(label)}</span>
    <strong style="display:block;margin-top:4px;font-size:13px;color:#18372e">${escapeHtml(feature.n)}</strong>
    <div style="display:flex;justify-content:space-between;gap:8px;margin-top:2px">${municipality}</div>
    ${desc}
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color:#247251;font-size:12px;text-decoration:underline">Več o enoti (eID) →</a>
    <br/><button type="button" class="dsa-add-poi-btn" data-kind="rkd" data-id="rkd-${feature.e}" data-name="${escapeHtml(feature.n)}" data-lat="${feature.lat}" data-lng="${feature.lng}" data-category="${escapeHtml(label)}" data-source="rkd" style="margin-top:4px;padding:3px 10px;border-radius:999px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-size:12px;cursor:pointer">+ Dodaj v pot</button>
  </div>`;
}

/** Označevalec za gručo (krog s številom). */
function clusterIcon(L: LeafletModule, cluster: RkdCluster): L.DivIcon {
  return L.divIcon({
    className: 'dsa-rkd-cluster',
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#0f766e;color:#fff;font:700 13px/34px system-ui,sans-serif;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.35);border:2px solid #fff">${cluster.count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

/** Označevalec za posamezno enoto (pika v barvi tipa). */
function featureIcon(L: LeafletModule, feature: RkdFeature): L.DivIcon {
  const color = RKD_TYPE_COLORS[feature.t] ?? '#57534e';
  return L.divIcon({
    className: 'dsa-rkd-pin',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export interface RkdLayerOptions {
  typeLabels?: readonly string[];
  /** Mapa za približanje ob kliku na gručo (drugače klik nič ne stori). */
  map?: LeafletMap;
}

/**
 * Zgradi sloj iz značk pri danem zoomu. Vrne LayerGroup (že pripeto ali
 * ne — klicatelj doda na mapo). Klik na gručo se prepusti klicatelju
 * (privzeto: približaj), da se izognemo neposredni odvisnosti od mape.
 */
export function buildRkdLayer(
  L: LeafletModule,
  clusters: readonly RkdCluster[],
  opts: RkdLayerOptions = {},
): LayerGroup {
  const group = L.layerGroup();
  const labels = opts.typeLabels ?? RKD_TYPE_LABELS;

  for (const cluster of clusters) {
    if (cluster.count > 1) {
      const marker = L.marker([cluster.centerLat, cluster.centerLng], {
        icon: clusterIcon(L, cluster),
        title: `${cluster.count} enot kulturne dediščine`,
        zIndexOffset: 400,
      });
      marker.on('click', () => {
        const map = opts.map;
        if (map) {
          map.setView([cluster.centerLat, cluster.centerLng], Math.max(12, map.getZoom() + 2));
        }
      });
      marker.addTo(group);
    } else {
      const feature = cluster.feature;
      if (!feature) continue;
      const marker = L.marker([feature.lat, feature.lng], {
        icon: featureIcon(L, feature),
        title: feature.n,
        zIndexOffset: 300,
      });
      marker.bindPopup(rkdPopupHtml(feature, labels), { maxWidth: 280 });
      marker.addTo(group);
    }
  }

  return group;
}
