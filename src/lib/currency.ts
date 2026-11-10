/**
 * VALUTE BALKANA — čista podatkovna plast za večvalutni proračun.
 *
 * Tečaji prihajajo iz /api/open-data/rates (ER-API → currency-api rezerva;
 * pokriva RSD/MKD/ALL/BAM, ki jih ECB nima). Ta datoteka NE kliče omrežja —
 * pretvorba in oblikovanje na podlagi podanih tečajev.
 */

import type { GuideRegionId } from '@/lib/guide-store';

/** Valuta po regiji vodiča (RSD za Srbijo, BAM za BiH, ALL za Albanijo …). */
export const REGION_CURRENCY: Record<GuideRegionId, string> = {
  gorenjska: 'EUR',
  osrednja: 'EUR',
  primorska: 'EUR',
  stajerska: 'EUR',
  koroska: 'EUR',
  hrvaska: 'EUR', // Hrvaška je v območju EUR od 2023
  'bosna-hercegovina': 'BAM',
  srbija: 'RSD',
  kosovo: 'EUR', // Kosovo uporablja EUR (unilateralno)
  'crna-gora': 'EUR', // Črna gora uporablja EUR (unilateralno)
  albanija: 'ALL',
  'severna-makedonija': 'MKD',
};

export const CURRENCY_LABELS: Record<string, string> = {
  EUR: 'EUR (€)',
  RSD: 'RSD (din)',
  BAM: 'BAM (KM)',
  ALL: 'ALL (L)',
  MKD: 'MKD (den)',
};

/** Ali valuta ni EUR (takrat prikažemo še lokalni znesek)? */
export function isNonEuro(currency: string): boolean {
  return currency !== 'EUR';
}

/**
 * Pretvori EUR v poljubno valuto ob danih tečajih (1 EUR = rates[code]).
 * Vrne null, če tečaj manjka ali ni veljaven.
 */
export function convertFromEur(
  amountEur: number,
  currency: string,
  rates: Readonly<Record<string, number>>,
): number | null {
  if (!Number.isFinite(amountEur) || amountEur < 0) return null;
  const rate = rates[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(amountEur * rate * 100) / 100;
}

/** Oblikovanje zneska v valuti (sl-SI slog; rezerva brez Intl). */
export function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '';
  try {
    return new Intl.NumberFormat('sl-SI', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString('sl-SI')} ${currency}`;
  }
}

/** Enovrstična opomba »v lokalni valuti« (ali null, če ni smiselna). */
export function localCurrencyNote(
  regionId: GuideRegionId | null,
  totalEur: number | null,
  rates: Readonly<Record<string, number>> | null,
): string | null {
  if (!regionId) return null;
  const currency = REGION_CURRENCY[regionId];
  if (!currency || !isNonEuro(currency)) return null;
  if (totalEur === null || !rates) return null;
  const local = convertFromEur(totalEur, currency, rates);
  if (local === null) return null;
  return `Približno v lokalni valuti: ${formatMoney(local, currency)} (${CURRENCY_LABELS[currency] ?? currency}).`;
}
