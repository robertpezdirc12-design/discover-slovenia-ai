/**
 * JOURNEY BOOKING — KANONSKA ŽIVLJENJSKA CIKEL REZERVACIJ (51-c).
 * ============================================================================
 * Rekonstrukcija iz izvornih dokazov:
 *  - prisma/schema.prisma JourneyBooking (read_1790842578812:773-821):
 *    13 statusov TASK 99 + DRAFT iz Issue #4 val 3 = 14 statusov;
 *    invariante: EXTERNAL NIKOLI ne postane CONFIRMED (potrditev živi pri
 *    ponudniku), CONFIRMED/PAID ZAHTEVA providerBookingId, EXTERNAL nikoli
 *    ne nosi providerBookingId;
 *  - avditski zapis (read_1791301651555 §"JourneyBooking lifecycle"):
 *    INITIAL_CONFIRMATION_STATUSES (POST sprejema samo začetne, route:258),
 *    ALLOWED_TRANSITIONS (booking.ts:160-206), validateConfirmationRecord
 *    (266-323), S1 hardening (klient nikoli ne prinese atestacij),
 *    PATCH žeton-zaklenjen fail-closed, import pot (source USER/IMPORTED
 *    samo DRAFT/CONFIRMED @64).
 *
 * ISKRENOST (kanon izvirnika):
 *  - izvor zapisa je VEDNO razkrit (USER/IMPORTED/PROVIDER/null-legacy);
 *    UI nikoli ne trdi „provider potrjen prek naše integracije" za zapise,
 *    ki jih je prinesel uporabnik;
 *  - provider-ja polja (providerBookingId, confirmedPrice, confirmationUrl)
 *    sme nositi samo pošten izvor: PROVIDER (odgovor ponudnika) ali
 *    USER/IMPORTED ob statusu CONFIRMED (uporabnikova atestacija prave
 *    rezervacije, ki si jo je naredil sam — izvirna import pot);
 *  - vse funkcije so ČISTE (brez stranskih učinkov) — client-safe.
 * ============================================================================
 */

// ─── Statusi (izvorni types.ts:83-97 + DRAFT iz Issue #4 val 3) ─────────────

/** 14 statusov (izvorni types.ts:83-97 + DRAFT val 3). */
export type ConfirmationStatus =
  | "DRAFT"
  | "SELECTED"
  | "BOOKING_REQUESTED"
  | "PENDING"
  | "PAYMENT_REQUIRED"
  | "PAID"
  | "CONFIRMED"
  | "MODIFIED"
  | "REFUNDED"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED"
  | "UNKNOWN"
  | "EXTERNAL";

/** Vseh 14 statusov — enkraten vir resnice (testi + UI). */
export const CONFIRMATION_STATUSES: readonly ConfirmationStatus[] = [
  "DRAFT",
  "SELECTED",
  "BOOKING_REQUESTED",
  "PENDING",
  "PAYMENT_REQUIRED",
  "PAID",
  "CONFIRMED",
  "MODIFIED",
  "REFUNDED",
  "EXPIRED",
  "FAILED",
  "CANCELLED",
  "UNKNOWN",
  "EXTERNAL",
];

/** Ali je niz eden od 14 statusov? (fail-closed: neznan → false) */
export function isConfirmationStatus(s: string): s is ConfirmationStatus {
  return (CONFIRMATION_STATUSES as readonly string[]).includes(s);
}

/** POST sprejema SAMO začetne statuse (izvirnik route:258). */
export const INITIAL_CONFIRMATION_STATUSES = [
  "SELECTED",
  "EXTERNAL",
  "BOOKING_REQUESTED",
  "DRAFT",
] as const;

export type InitialConfirmationStatus = (typeof INITIAL_CONFIRMATION_STATUSES)[number];

/** Terminalni statusi — življenjski cikel se v njih zaključi (brez povratkov). */
export const TERMINAL_STATUSES = ["REFUNDED", "EXPIRED", "CANCELLED"] as const;

export type TerminalConfirmationStatus = (typeof TERMINAL_STATUSES)[number];

// ─── Izvor zapisa (Issue #4 §4 val 3 — iskrenost izvora) ────────────────────

/**
 * Izvor zapisa (issue #4 §4 val 3) — iskrenost: UI nikoli ne trdi
 * „provider potrjen" za uporabniške vnose.
 *   "USER"     = ročni vnos uporabnika (potrjen z dejanjem vnosa);
 *   "IMPORTED" = parse dokumenta, ki ga je uporabnik PREGLEDAL in potrdil;
 *   "PROVIDER" = provider kanal (PATCH, žeton) — izključno;
 *   null       = legacy (dogodki iz VAL 1 — brez razkritega izvora).
 */
export type BookingSource = "USER" | "IMPORTED" | "PROVIDER";

export const BOOKING_SOURCES = ["USER", "IMPORTED", "PROVIDER"] as const;

/** Ali je niz veljaven izvor zapisa? */
export function isBookingSource(s: string): s is BookingSource {
  return (BOOKING_SOURCES as readonly string[]).includes(s);
}

// ─── Matrika prehodov (izvirnik booking.ts:160-206) ─────────────────────────

/**
 * Dovoljeni prehodi statusov:
 *  - EXTERNAL je absorpcijsko — zunanji vir lahko prevzame zapis, potem
 *    ostane zunanje (potrditev živi pri ponudniku, nikoli pri nas);
 *  - REFUNDED/EXPIRED/CANCELLED so terminalni (prazni seznami);
 *  - DRAFT je vstopni status import poti → SELECTED | CONFIRMED | CANCELLED;
 *  - FAILED dovoljuje retry (BOOKING_REQUESTED/SELECTED);
 *  - UNKNOWN se lahko razreši v katerikoli (razen DRAFT/UNKNOWN) status;
 *  - MODIFIED → MODIFIED (samo-veriga) dovoljuje zaporedne spremembe.
 */
export const ALLOWED_TRANSITIONS: Record<ConfirmationStatus, readonly ConfirmationStatus[]> = {
  DRAFT: ["SELECTED", "CONFIRMED", "CANCELLED"], // import pot (USER/IMPORTED vnese DRAFT, uporabnik potrdi → CONFIRMED)
  SELECTED: ["BOOKING_REQUESTED", "CANCELLED", "EXPIRED", "EXTERNAL"],
  BOOKING_REQUESTED: ["PENDING", "FAILED", "CANCELLED", "EXTERNAL"],
  PENDING: ["PAYMENT_REQUIRED", "CONFIRMED", "FAILED", "CANCELLED", "EXPIRED", "EXTERNAL"],
  PAYMENT_REQUIRED: ["PAID", "FAILED", "CANCELLED", "EXPIRED", "EXTERNAL"],
  PAID: ["CONFIRMED", "REFUNDED", "FAILED", "EXTERNAL"],
  CONFIRMED: ["MODIFIED", "REFUNDED", "CANCELLED", "UNKNOWN", "EXTERNAL"],
  MODIFIED: ["MODIFIED", "REFUNDED", "CANCELLED", "UNKNOWN", "EXTERNAL"],
  REFUNDED: [], // terminal
  EXPIRED: [], // terminal
  FAILED: ["BOOKING_REQUESTED", "SELECTED", "EXTERNAL"], // retry
  CANCELLED: [], // terminal
  UNKNOWN: [
    "SELECTED",
    "BOOKING_REQUESTED",
    "PENDING",
    "PAYMENT_REQUIRED",
    "PAID",
    "CONFIRMED",
    "MODIFIED",
    "REFUNDED",
    "EXPIRED",
    "FAILED",
    "CANCELLED",
    "EXTERNAL",
  ], // UNKNOWN se lahko razreši v karkoli
  EXTERNAL: ["EXTERNAL"], // absorpcijsko — zunanji vir prevzame; ostane zunanje
};

/** Ali je status začeten (sprejemljiv na POST)? */
export function isInitial(s: string): boolean {
  return (INITIAL_CONFIRMATION_STATUSES as readonly string[]).includes(s);
}

/** Ali je status terminalen (iz njega ni prehodov)? */
export function isTerminal(s: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(s);
}

/** Ali je prehod dovoljen? (neznan status → false, fail-closed) */
export function canTransition(from: string, to: string): boolean {
  if (!isConfirmationStatus(from) || !isConfirmationStatus(to)) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Prehod z izrecno napako (slovensko) — za API rute in teste.
 * Vrne `{ ok: true }` ali `{ ok: false, error }`.
 */
export function assertTransition(
  from: string,
  to: string
): { ok: true } | { ok: false; error: string } {
  if (!isConfirmationStatus(from)) {
    return { ok: false, error: `Neznan status rezervacije: "${from}".` };
  }
  if (!isConfirmationStatus(to)) {
    return { ok: false, error: `Neznan ciljni status rezervacije: "${to}".` };
  }
  if (ALLOWED_TRANSITIONS[from].includes(to)) return { ok: true };
  return { ok: false, error: `Prehod "${from}" → "${to}" ni dovoljen.` };
}

// ─── Validator atestacij (izvirnik booking.ts:266-323, rekonstrukcija) ──────

/** Vhod validatorja — SAMO tista polja, ki jih pozna izvorna potrditvena pot. */
export interface ConfirmationRecordInput {
  status: ConfirmationStatus;
  source?: BookingSource | null;
  /** SAMO če ga je vrnil provider — ali ga je uporabnik prepisal iz svojega potrdila. */
  providerBookingId?: string | null;
  /** SAMO iz providerjevega odgovora — ali iz potrdila uporabnika (atestacija). */
  confirmedPrice?: number | null;
  confirmationUrl?: string | null;
}

export type ConfirmationValidation = { ok: true } | { ok: false; error: string };

/** Meje (sanity cap-i proti zlorabi / smetenju). */
export const MAX_BOOKING_ID_LENGTH = 200;
export const MAX_CONFIRMED_PRICE = 1_000_000;
export const MAX_CONFIRMATION_URL_LENGTH = 500;

const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

/**
 * validateConfirmationRecord — ISKRENOSTNA PRAVILA:
 *  1. status CONFIRMED → providerBookingId (neprazno, ≤ 200 znakov, brez
 *     kontrolnih znakov) IN confirmedPrice (število > 0) OBVEZNA — klient
 *     ne more ponarediti „potrjeno" brez atestacijskih polj;
 *  2. izvor USER/IMPORTED → SAMO statusa DRAFT ali CONFIRMED (import pot,
 *     izvirnik @64);
 *  3. provider-ja polja (providerBookingId, confirmedPrice, confirmationUrl)
 *     sme nositi samo pošten izvor:
 *       - source null/legacy → polja morajo MANJKATI;
 *       - source USER/IMPORTED → polja dovoljena SAMO ob statusu CONFIRMED
 *         (uporabnikova atestacija prave rezervacije — import pot);
 *       - source PROVIDER → polja dovoljena (operativna stanja);
 *  4. status EXTERNAL nikoli ne nosi providerBookingId (potrditev živi pri
 *     ponudniku — izvirna invarianta modela);
 *  5. CONFIRMED/PAID zahtevata providerBookingId (izvirna invarianta);
 *  6. sanity cap-i: cena ≤ 1.000.000, id ≤ 200 znakov, brez kontrolnih znakov.
 */
export function validateConfirmationRecord(
  rec: ConfirmationRecordInput
): ConfirmationValidation {
  // 1. status iz kanonskega nabora
  if (!isConfirmationStatus(rec.status)) {
    return { ok: false, error: `Neznan status rezervacije: "${String(rec.status)}".` };
  }
  // 2. izvor (če je naveden) iz kanonskega nabora
  if (rec.source != null && !isBookingSource(rec.source)) {
    return { ok: false, error: `Neznan izvor zapisa: "${String(rec.source)}".` };
  }

  const status = rec.status;
  const source = rec.source ?? null;
  const bookingId =
    typeof rec.providerBookingId === "string" ? rec.providerBookingId.trim() : null;
  const hasBookingId = bookingId !== null && bookingId.length > 0;
  const hasPrice = rec.confirmedPrice != null;
  const url = typeof rec.confirmationUrl === "string" ? rec.confirmationUrl.trim() : null;
  const hasUrl = url !== null && url.length > 0;
  const hasAnyProviderField = hasBookingId || hasPrice || hasUrl;

  // 3. import pot: izvor USER/IMPORTED sme samo DRAFT ali CONFIRMED (izvirnik @64)
  if (
    (source === "USER" || source === "IMPORTED") &&
    status !== "DRAFT" &&
    status !== "CONFIRMED"
  ) {
    return {
      ok: false,
      error: `Zapis z izvorom ${source} sme imeti samo status DRAFT ali CONFIRMED (dobljen: ${status}).`,
    };
  }

  // 4. provider-ja polja nosi samo pošten izvor (iskrenost izvora)
  if (source === null && hasAnyProviderField) {
    return {
      ok: false,
      error:
        "Polja ponudnika (providerBookingId, confirmedPrice, confirmationUrl) sme nositi samo zapis z razkritim izvorom (source).",
    };
  }
  if (
    (source === "USER" || source === "IMPORTED") &&
    hasAnyProviderField &&
    status !== "CONFIRMED"
  ) {
    return {
      ok: false,
      error: `Uporabniška atestacija (izvor ${source}) sme spremljati samo status CONFIRMED (dobljen: ${status}).`,
    };
  }

  // 5. EXTERNAL nikoli ne nosi številke rezervacije (izvirni model)
  if (status === "EXTERNAL" && hasBookingId) {
    return {
      ok: false,
      error:
        "Status EXTERNAL nikoli ne nosi številke rezervacije — potrditev živi pri ponudniku.",
    };
  }

  // 6. CONFIRMED/PAID zahtevata providerBookingId (izvirni invarianti)
  if ((status === "CONFIRMED" || status === "PAID") && !hasBookingId) {
    return {
      ok: false,
      error: `Status ${status} zahteva številko rezervacije (providerBookingId).`,
    };
  }
  // CONFIRMED zahteva tudi ceno (atestacija ali providerjev odgovor)
  if (status === "CONFIRMED" && !hasPrice) {
    return {
      ok: false,
      error: "Status CONFIRMED zahteva ceno (confirmedPrice) iz potrdila.",
    };
  }

  // 7. format providerBookingId
  if (hasBookingId) {
    if (bookingId!.length > MAX_BOOKING_ID_LENGTH) {
      return {
        ok: false,
        error: `Številka rezervacije je predolga (največ ${MAX_BOOKING_ID_LENGTH} znakov).`,
      };
    }
    if (CONTROL_CHARS_RE.test(bookingId!)) {
      return {
        ok: false,
        error: "Številka rezervacije vsebuje neveljavne (kontrolne) znake.",
      };
    }
  }

  // 8. cena — kadar je prisotna, je vedno veljavna in pozitivna (sanity)
  if (hasPrice) {
    const price = rec.confirmedPrice as number;
    if (typeof price !== "number" || !Number.isFinite(price)) {
      return { ok: false, error: "Cena (confirmedPrice) mora biti število." };
    }
    if (price <= 0) {
      return { ok: false, error: "Cena (confirmedPrice) mora biti večja od 0." };
    }
    if (price > MAX_CONFIRMED_PRICE) {
      return {
        ok: false,
        error: `Cena (confirmedPrice) presega zgornjo mejo ${MAX_CONFIRMED_PRICE} EUR (sanity).`,
      };
    }
  }

  // 9. format confirmationUrl
  if (hasUrl) {
    if (url!.length > MAX_CONFIRMATION_URL_LENGTH) {
      return {
        ok: false,
        error: `Povezava potrdila je predolga (največ ${MAX_CONFIRMATION_URL_LENGTH} znakov).`,
      };
    }
    if (CONTROL_CHARS_RE.test(url!)) {
      return { ok: false, error: "Povezava potrdila vsebuje neveljavne (kontrolne) znake." };
    }
  }

  return { ok: true };
}

// ─── Statusne oznake za UI (SL/EN za vseh 14 statusov) ──────────────────────

const STATUS_LABELS: Record<ConfirmationStatus, { sl: string; en: string; it: string; de: string; fr: string; es: string }> = {
  DRAFT: { sl: "Osnutek", en: "Draft", it: "Bozza", de: "Entwurf", fr: "Brouillon", es: "Borrador" },
  SELECTED: { sl: "Izbrano", en: "Selected", it: "Selezionato", de: "Ausgewählt", fr: "Sélectionné", es: "Seleccionado" },
  BOOKING_REQUESTED: { sl: "Zahtevek za rezervacijo poslan", en: "Booking requested", it: "Richiesta di prenotazione inviata", de: "Buchungsanfrage gesendet", fr: "Demande de réservation envoyée", es: "Solicitud de reserva enviada" },
  PENDING: { sl: "V obdelavi pri ponudniku", en: "Pending at provider", it: "In attesa dal fornitore", de: "Beim Anbieter in Bearbeitung", fr: "En attente chez le prestataire", es: "Pendiente en el proveedor" },
  PAYMENT_REQUIRED: { sl: "Čaka plačilo", en: "Payment required", it: "In attesa di pagamento", de: "Zahlung erforderlich", fr: "Paiement requis", es: "Pendiente de pago" },
  PAID: { sl: "Plačano", en: "Paid", it: "Pagato", de: "Bezahlt", fr: "Payé", es: "Pagado" },
  CONFIRMED: { sl: "Potrjeno", en: "Confirmed", it: "Confermato", de: "Bestätigt", fr: "Confirmé", es: "Confirmado" },
  MODIFIED: { sl: "Spremenjeno", en: "Modified", it: "Modificato", de: "Geändert", fr: "Modifié", es: "Modificado" },
  REFUNDED: { sl: "Povrnjeno", en: "Refunded", it: "Rimborsato", de: "Erstattet", fr: "Remboursé", es: "Reembolsado" },
  EXPIRED: { sl: "Poteklo", en: "Expired", it: "Scaduto", de: "Abgelaufen", fr: "Expiré", es: "Caducado" },
  FAILED: { sl: "Spodletelo", en: "Failed", it: "Non riuscito", de: "Fehlgeschlagen", fr: "Échec", es: "Fallido" },
  CANCELLED: { sl: "Preklicano", en: "Cancelled", it: "Cancellato", de: "Storniert", fr: "Annulé", es: "Cancelado" },
  UNKNOWN: { sl: "Neznano", en: "Unknown", it: "Sconosciuto", de: "Unbekannt", fr: "Inconnu", es: "Desconocido" },
  EXTERNAL: { sl: "Zunanja rezervacija (pri ponudniku)", en: "External booking (at provider)", it: "Prenotazione esterna (presso il fornitore)", de: "Externe Buchung (beim Anbieter)", fr: "Réservation externe (chez le prestataire)", es: "Reserva externa (en el proveedor)" },
};

/**
 * Oznaka statusa za UI (SL privzeto / EN). Neznan status se NE prevaja v
 * izmišljeno oznako — vrne surovo vrednost (iskrenost).
 */
export function statusLabel(status: string, locale: "sl" | "en" = "sl"): string {
  if (!isConfirmationStatus(status)) return status;
  const label = STATUS_LABELS[status];
  return locale === "en" ? label.en : label.sl;
}

// ─── Atestacijski JSON v stolpcu `note` (shema se NE spreminja, 51-c) ───────

/**
 * Uporabniška atestacija, shranjena kot kompakten JSON v stolpcu `note`
 * (TripReservation.note String? — brez migracije):
 *   { "source": "USER", "providerBookingId": "...", "confirmedPrice": 49.5,
 *     "userNote": "..." }
 */
export interface AttestationNote {
  source: BookingSource;
  providerBookingId: string;
  confirmedPrice: number;
  userNote?: string;
}

const USER_NOTE_MAX = 500;

/** Zgradi kompakten JSON atestacije za stolpec `note`. */
export function buildAttestationNote(a: AttestationNote): string {
  const userNote =
    typeof a.userNote === "string" ? a.userNote.trim().slice(0, USER_NOTE_MAX) : "";
  return JSON.stringify({
    source: a.source,
    providerBookingId: a.providerBookingId.trim().slice(0, MAX_BOOKING_ID_LENGTH),
    confirmedPrice: a.confirmedPrice,
    ...(userNote ? { userNote } : {}),
  });
}

/**
 * Razčleni atestacijski JSON iz stolpca `note`.
 * Vrne null za: manjkajočo opombo, golo (legacy) besedilo, pokvarjen JSON
 * ali JSON brez atestacijskih polj — klicar ga potem pošteno prikaže kot
 * navadno opombo (združljivost nazaj).
 */
export function parseAttestationNote(
  note: string | null | undefined
): AttestationNote | null {
  if (typeof note !== "string" || note.length === 0 || !note.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(note);
  } catch {
    return null; // golo besedilo, ki se začne s "{" — ali pokvarjen JSON
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.source !== "string" || !isBookingSource(obj.source)) return null;
  if (typeof obj.providerBookingId !== "string" || obj.providerBookingId.length === 0) {
    return null;
  }
  if (typeof obj.confirmedPrice !== "number" || !Number.isFinite(obj.confirmedPrice)) {
    return null;
  }
  const userNote =
    typeof obj.userNote === "string" && obj.userNote.trim().length > 0
      ? obj.userNote
      : null;
  return {
    source: obj.source,
    providerBookingId: obj.providerBookingId,
    confirmedPrice: obj.confirmedPrice,
    ...(userNote ? { userNote } : {}),
  };
}

/**
 * Uporabniška opomba iz zapisa: `userNote` iz atestacijskega JSON, sicer
 * golo besedilo (legacy) — ali null, ko opombe ni.
 */
export function noteTextOf(note: string | null | undefined): string | null {
  if (typeof note !== "string" || note.length === 0) return null;
  const att = parseAttestationNote(note);
  if (att) return att.userNote ?? null;
  return note; // legacy golo besedilo
}
