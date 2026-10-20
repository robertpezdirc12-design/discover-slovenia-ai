import { sanitizeGuideState, type GuideState } from '@/lib/guide-store';

/**
 * Prenos lastnih podatkov (GDPR/DSAR vzorec) iz strežniškega profila.
 *
 * V izvoz ne sodijo sejni žetoni (v bazi je samo hash) niti interni podatki,
 * ki niso uporabnikovi. GuideState se pred izvozom še enkrat sanitizira,
 * da tudi stari ali ročno popravljeni zapisi ne uhajajo v datoteko.
 */
export interface AccountExportUser {
  id: string;
  email: string | null;
  name: string;
  createdAt: Date;
}

export interface AccountExportProfile {
  guideData: unknown;
  updatedAt: Date;
}

export interface AccountExportReservation {
  stayId: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  priceFrom: number | null;
  createdAt: Date;
}

export interface AccountExport {
  format: 'discover-slovenia-account-export';
  version: 1;
  exportedAt: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    createdAt: string;
  };
  profile: {
    state: GuideState | null;
    updatedAt: string;
  } | null;
  reservations: Array<{
    stayId: string;
    name: string;
    city: string;
    lat: number;
    lng: number;
    priceFrom: number | null;
    createdAt: string;
  }>;
}

export function buildAccountExport({
  user,
  profile,
  reservations,
  exportedAt = new Date(),
}: {
  user: AccountExportUser;
  profile: AccountExportProfile | null;
  reservations: AccountExportReservation[];
  exportedAt?: Date;
}): AccountExport {
  return {
    format: 'discover-slovenia-account-export',
    version: 1,
    exportedAt: exportedAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    },
    profile: profile
      ? {
          state: sanitizeGuideState(profile.guideData),
          updatedAt: profile.updatedAt.toISOString(),
        }
      : null,
    reservations: reservations.map((reservation) => ({
      stayId: reservation.stayId,
      name: reservation.name,
      city: reservation.city,
      lat: reservation.lat,
      lng: reservation.lng,
      priceFrom: reservation.priceFrom,
      createdAt: reservation.createdAt.toISOString(),
    })),
  };
}
