import { CATALOG_ATTRIBUTION } from '@/lib/poi-catalog';
import type { DayTrackDay } from '@/lib/day-track';
import { POI_CATEGORY_LABELS, type RoutePoi } from '@/lib/route-poi';
import { formatEur, nightsNoun, personsNoun, unpricedNote, type TripBudget } from '@/lib/trip-budget';
import type { TripStop } from '@/lib/trip-plan';

export interface PrintStay {
  name: string;
  city: string;
  lat: number;
  lng: number;
  priceFrom: number | null;
}

export interface TripPrintInput {
  stops: readonly TripStop[];
  dayTrack: readonly DayTrackDay[];
  pois: readonly RoutePoi[];
  budget: TripBudget;
  stays: readonly PrintStay[];
  regionLabel?: string | null;
  /** Opomba v lokalni valuti (npr. »≈ 18.400 RSD«) — opcijsko. */
  localCurrencyNote?: string | null;
  generatedAt?: Date;
}

function escapeHtml(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .slice(0, maxLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKm(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text} km`;
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  const minutes = Math.round(value);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

function coordinateText(lat: number, lng: number): string | null {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function stopCountLabel(count: number): string {
  if (count === 1) return '1 postanek';
  if (count === 2) return '2 postanka';
  if (count === 3 || count === 4) return `${count} postanki`;
  return `${count} postankov`;
}

function generatedAtLabel(value?: Date): string {
  const date = value && Number.isFinite(value.getTime()) ? value : new Date();
  return new Intl.DateTimeFormat('sl-SI', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

function renderStop(stop: TripStop, index: number, drive?: string): string {
  const details = [
    typeof stop.note === 'string' && stop.note ? `<span>${escapeHtml(stop.note)}</span>` : '',
    coordinateText(stop.lat, stop.lng)
      ? `<span>GPS ${escapeHtml(coordinateText(stop.lat, stop.lng))}</span>`
      : '',
    drive ? `<span class="drive">${escapeHtml(drive)}</span>` : '',
  ]
    .filter(Boolean)
    .join('<span class="separator" aria-hidden="true">·</span>');

  return `<li class="stop-row"><span class="index">${index + 1}</span><div><strong>${escapeHtml(stop.name)}</strong><div class="details">${details}</div></div></li>`;
}

function renderDay(day: DayTrackDay): string {
  const dayNumber = Number.isFinite(day.day) ? Math.max(1, Math.round(day.day)) : 1;
  const duration = formatDuration(day.driveMinInDay);
  const distance = formatKm(day.driveKmInDay);
  const hasDriveData = Boolean(duration && distance && (day.driveMinInDay > 0 || day.driveKmInDay > 0));
  const summary = hasDriveData
    ? `${escapeHtml(duration)} · ${escapeHtml(distance)} vožnje`
    : 'Časi vožnje niso na voljo';
  const stops = day.stops
    .filter((stop) => stop && typeof stop.name === 'string')
    .map((stop, index) => {
      const durationToStop = stop.driveMin === null ? '' : formatDuration(stop.driveMin);
      const distanceToStop = stop.driveKm === null ? '' : formatKm(stop.driveKm);
      const drive = durationToStop && distanceToStop ? `${durationToStop} · ${distanceToStop}` : '';
      return renderStop(stop, index, drive);
    })
    .join('');

  return `<section class="day"><h3><span>${dayNumber}. dan</span><span class="day-summary">${summary}</span></h3><ol class="stops">${stops}</ol></section>`;
}

function renderStay(stay: PrintStay): string {
  const coordinates = coordinateText(stay.lat, stay.lng);
  const price = stay.priceFrom !== null && Number.isFinite(stay.priceFrom) && stay.priceFrom >= 0
    ? `od ${escapeHtml(formatEur(stay.priceFrom))} / noč`
    : 'cena ni objavljena';
  const details = [
    stay.city ? escapeHtml(stay.city) : '',
    coordinates ? `GPS ${escapeHtml(coordinates)}` : '',
    price,
  ]
    .filter(Boolean)
    .join('<span class="separator" aria-hidden="true">·</span>');
  return `<li><strong>${escapeHtml(stay.name)}</strong><div class="details">${details}</div></li>`;
}

function renderPoi(poi: RoutePoi): string {
  const category = POI_CATEGORY_LABELS[poi.category] ?? 'Zanimivost';
  const source = poi.source === 'osm' ? 'OpenStreetMap' : 'urejeni izbor';
  const distance = formatKm(poi.distanceKm);
  const details = [
    escapeHtml(category),
    distance ? `${escapeHtml(distance)} od poti` : '',
    `vir: ${source}`,
  ]
    .filter(Boolean)
    .join('<span class="separator" aria-hidden="true">·</span>');
  return `<li><strong>${escapeHtml(poi.name)}</strong><div class="details">${details}</div></li>`;
}

function renderBudget(budget: TripBudget, localCurrencyNote?: string | null): string {
  if (budget.items.length === 0) return '';

  const rows = budget.items.slice(0, 60).map((item) => {
    const price = item.priceFrom === null || !Number.isFinite(item.priceFrom)
      ? 'ni objavljena'
      : `${formatEur(item.priceFrom)} / noč`;
    const subtotal = item.subtotalEur === null || !Number.isFinite(item.subtotalEur)
      ? '—'
      : formatEur(item.subtotalEur);
    const nights = Number.isFinite(item.nights) ? Math.max(0, Math.round(item.nights)) : 0;
    return `<tr><th scope="row">${escapeHtml(item.name)}<span class="table-detail">${escapeHtml(item.city)}</span></th><td>${nights} ${escapeHtml(nightsNoun(nights))}</td><td>${escapeHtml(price)}</td><td>${escapeHtml(subtotal)}</td></tr>`;
  }).join('');

  const total = budget.totalEur !== null && Number.isFinite(budget.totalEur)
    ? `<p class="budget-total">Skupaj: <strong>${escapeHtml(formatEur(budget.totalEur))}</strong></p>`
    : '<p class="budget-total">Skupnega zneska zaradi neobjavljenih cen ni mogoče oceniti.</p>';
  const perPerson = budget.perPersonEur !== null && Number.isFinite(budget.perPersonEur)
    ? `<p>${Math.max(1, Math.round(budget.persons))} ${escapeHtml(personsNoun(Math.max(1, Math.round(budget.persons))))} · ${escapeHtml(formatEur(budget.perPersonEur))} na osebo</p>`
    : '';
  const unpriced = budget.unpricedCount > 0
    ? `<p class="fine-print">${escapeHtml(unpricedNote(budget.unpricedCount))}</p>`
    : '';
  const localNote = localCurrencyNote
    ? `<p class="fine-print local-currency">${escapeHtml(localCurrencyNote)}</p>`
    : '';

  return `<section class="section"><h2>Ocena proračuna prenočišč</h2><div class="table-wrap"><table><thead><tr><th>Prenočišče</th><th>Noči</th><th>Cena</th><th>Ocena</th></tr></thead><tbody>${rows}</tbody></table></div>${total}${perPerson}${unpriced}${localNote}<p class="fine-print">Cene so indikativne; končni znesek preveri pri ponudniku.</p></section>`;
}

export function buildTripPrintHtml(input: TripPrintInput): string {
  const stops = input.stops
    .filter((stop) => stop && typeof stop.name === 'string' && Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
    .slice(0, 60);
  const days = input.dayTrack
    .filter((day) => day && Array.isArray(day.stops))
    .slice(0, 30);
  const stays = input.stays
    .filter((stay) => stay && typeof stay.name === 'string' && typeof stay.city === 'string')
    .slice(0, 60);
  const pois = input.pois
    .filter((poi) => poi && typeof poi.name === 'string' && Number.isFinite(poi.distanceKm))
    .slice(0, 60);
  const title = 'Načrt poti po Sloveniji';
  const subtitle = [
    input.regionLabel ? `Regija: ${escapeHtml(input.regionLabel)}` : '',
    stopCountLabel(stops.length),
  ]
    .filter(Boolean)
    .join(' · ');
  const routeSection = days.length > 0
    ? `<section class="section" id="sec-route"><h2>Dnevni načrt</h2>${days.map(renderDay).join('')}</section>`
    : stops.length > 0
      ? `<section class="section" id="sec-route"><h2>Postanki po vrstnem redu</h2><ol class="stops">${stops.map((stop, index) => renderStop(stop, index)).join('')}</ol></section>`
      : '<p class="empty">V načrtu še ni postankov.</p>';
  const staySection = stays.length > 0
    ? `<section class="section" id="sec-stays"><h2>Rezervirana prenočišča</h2><ul class="stay-list">${stays.map(renderStay).join('')}</ul></section>`
    : '';
  const poiSection = pois.length > 0
    ? `<section class="section" id="sec-pois"><h2>Zanimivosti ob poti</h2><ul class="poi-list">${pois.map(renderPoi).join('')}</ul></section>`
    : '';
  const sources = new Set<string>();
  if (pois.some((poi) => poi.source === 'osm')) {
    sources.add('<a href="https://www.openstreetmap.org/copyright" rel="noreferrer">© OpenStreetMap contributors</a>');
  }
  if (pois.some((poi) => poi.source === 'izbor')) sources.add(escapeHtml(CATALOG_ATTRIBUTION));
  if (days.some((day) => day.stops.some((stop) => stop.driveMin !== null && stop.driveKm !== null))) {
    sources.add('Časi vožnje: OSRM, podatki OpenStreetMap.');
  }
  const sourceSection = sources.size > 0
    ? `<p class="sources">Viri: ${Array.from(sources).join(' · ')}</p>`
    : '';
  const dateLabel = escapeHtml(generatedAtLabel(input.generatedAt));
  const safeTitle = escapeHtml(title);

  // KAZALO KNJIGE — poglavja, ki dejansko obstajajo.
  const chapters: Array<[string, string]> = [];
  if (days.length > 0 || stops.length > 0) chapters.push(['#sec-route', 'Dnevni načrt / postanki']);
  if (stays.length > 0) chapters.push(['#sec-stays', 'Rezervirana prenočišča']);
  if (input.budget.items.length > 0) chapters.push(['#sec-budget', 'Ocena proračuna']);
  if (pois.length > 0) chapters.push(['#sec-pois', 'Zanimivosti ob poti']);
  const tocHtml =
    chapters.length > 0
      ? `<nav class="toc" aria-label="Kazalo"><ul>${chapters
          .map(([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`)
          .join('')}</ul></nav>`
      : '';

  return `<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${safeTitle}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #18372e; background: #fff; font: 11pt/1.5 Arial, Helvetica, sans-serif; }
    main { max-width: 760px; margin: 0 auto; padding: 28px; }
    header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #d8e6df; }
    .brand { margin: 0 0 6px; color: #247251; font-size: 9pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; color: #18372e; font-size: 24pt; line-height: 1.15; }
    .subtitle, .generated { margin: 8px 0 0; color: #53675f; font-size: 10pt; }
    .generated { font-size: 9pt; }
    .section { margin-top: 24px; }
    .toc { margin: 16px 0 4px; padding: 12px 14px; border: 1px solid #d8e6df; border-radius: 8px; background: #f4f9f6; }
    .toc ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
    .toc a { color: #247251; text-decoration: none; font-size: 10.5pt; }
    .toc a:hover { text-decoration: underline; }
    h2 { margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #d8e6df; color: #204e3f; font-size: 15pt; }
    h3 { display: flex; justify-content: space-between; gap: 12px; margin: 18px 0 8px; color: #204e3f; font-size: 12pt; }
    .day-summary, .details, .fine-print, .sources, .empty { color: #53675f; font-size: 9.5pt; font-weight: 400; }
    .stops, .stay-list, .poi-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .stop-row { display: grid; grid-template-columns: 26px 1fr; gap: 8px; break-inside: avoid; }
    .index { display: grid; width: 22px; height: 22px; place-items: center; border-radius: 50%; background: #e7f1eb; color: #247251; font-size: 9pt; font-weight: 700; }
    .details { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 2px; }
    .separator { color: #87978f; }
    .drive { color: #247251; font-weight: 600; }
    .day { break-inside: avoid; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    th, td { padding: 8px 6px; border-bottom: 1px solid #e4ebe7; text-align: left; vertical-align: top; }
    thead th { color: #53675f; font-size: 8.5pt; }
    td:last-child, th:last-child { text-align: right; }
    .table-detail { display: block; color: #53675f; font-size: 8.5pt; font-weight: 400; }
    .budget-total { margin: 12px 0 4px; font-size: 12pt; }
    .fine-print { margin: 4px 0; }
    .local-currency { color: #247251; font-weight: 600; }
    .sources a { color: inherit; }
    footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #d8e6df; color: #53675f; font-size: 9pt; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      main { max-width: none; padding: 0; }
      .section, .day, .stop-row, .stay-list li, .poi-list li { break-inside: avoid; }
      .table-wrap { overflow: visible; }
    }
    @media screen and (max-width: 520px) {
      main { padding: 20px; }
      h1 { font-size: 21pt; }
      h3 { display: block; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="brand">Discover Slovenia AI</p>
      <h1>${safeTitle}</h1>
      <p class="subtitle">${subtitle}</p>
      <p class="generated">Pripravljeno ${dateLabel}</p>
    </header>
    ${tocHtml}
    ${routeSection}
    ${staySection}
    <div id="sec-budget">${renderBudget(input.budget, input.localCurrencyNote)}</div>
    ${poiSection}
    <footer>
      ${sourceSection}
      <p>Načrt poti je informativen. Pred odhodom preveri odpiralne čase, razmere na cestah in cene pri ponudnikih.</p>
    </footer>
  </main>
</body>
</html>`;
}

export function printTripFileName(date = new Date()): string {
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  return `pot-po-sloveniji-${safeDate.toISOString().slice(0, 10)}.html`;
}
