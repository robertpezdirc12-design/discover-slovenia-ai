/**
 * BOOKING-SUMMARY — P1-B §7 (issue #3): BOOKING INTELLIGENCE, SAMO-BRALNO.
 * ============================================================================
 * Iskren povzetek rezervacijskega stanja poti za @AI svetovalca iz
 * KANONSKEGA modela rezervacij (TripReservation — isti vir resnice kot
 * /api/trips/[shareId]/reservations). Agent NE izvaja nobene mutacije:
 * brez potrjevanja, brez preklicev, brez statusnih prehodov — te
 * izvajajo izključno obstoječe S1 poti z uporabnikovo atestacijo.
 *
 * Kanon resnice rezervacij (booking.ts): CONFIRMED zahteva atestacijo
 * (številka ponudnika + cena); CANCELLED je terminalen; kanal je v
 * zapisu (note) in se strežniško razreši — tu GA SAMO BEREMO.
 *
 * 0-AI: 0 žetonov; isti vhod → isti izhod.
 */

import { sanitizeUntrustedText } from "@/lib/system-data-guard";

export interface ReservationRowLike {
  dayIndex: number;
  stopName: string;
  status: string;
  note?: string | null;
}

export interface ReservationSummaryLine {
  day: number;
  name: string;
  status: "IDEA" | "CONFIRMED" | "CANCELLED" | "UNKNOWN";
  channel: string | null;
  userNote: string | null;
}

export interface BookingSummary {
  total: number;
  confirmed: number;
  ideas: number;
  cancelled: number;
  lines: ReservationSummaryLine[];
}

/**
 * Preberi kanal iz zapiskega polja (note). Attestacijski JSON nosi
 * { source, providerBookingId, confirmedPrice, userNote } — kanal je
 * izpeljan iz vsebine (demo/partner/atestacija), NIKOLI izmišljen.
 */
function cleanOrNull(text: string, maxLen: number): string | null {
  const clean = sanitizeUntrustedText(text, { maxLen, fallback: "" });
  return clean.length > 0 ? clean : null;
}

export function channelFromNote(note?: string | null): {
  channel: string | null;
  userNote: string | null;
} {
  if (!note || note.trim().length === 0) return { channel: null, userNote: null };
  try {
    const parsed = JSON.parse(note) as {
      source?: unknown;
      userNote?: unknown;
      providerBookingId?: unknown;
    };
    const userNote =
      typeof parsed.userNote === "string" ? cleanOrNull(parsed.userNote, 120) : null;
    if (parsed.providerBookingId) return { channel: "partner-potrdilo", userNote };
    if (parsed.source === "USER") return { channel: "uporabnikova atestacija", userNote };
    return { channel: null, userNote };
  } catch {
    // Navadna besedilna zapiska (brez atestacije) — kanal neznan, pošteno.
    return { channel: null, userNote: cleanOrNull(note, 120) };
  }
}

/**
 * Determinističen, iskren povzetek rezervacij (samo branje).
 * Neznani statusi se izpišejo kot UNKNOWN — nikoli optimistično.
 */
export function summarizeReservations(
  rows: readonly ReservationRowLike[]
): BookingSummary {
  const lines: ReservationSummaryLine[] = rows.map((r) => {
    const { channel, userNote } = channelFromNote(r.note);
    const status =
      r.status === "IDEA" || r.status === "CONFIRMED" || r.status === "CANCELLED"
        ? r.status
        : "UNKNOWN";
    return {
      day: r.dayIndex,
      name: sanitizeUntrustedText(r.stopName, {
        maxLen: 80,
        fallback: "Neimenovan postanek",
      }),
      status,
      channel,
      userNote,
    };
  });
  return {
    total: lines.length,
    confirmed: lines.filter((l) => l.status === "CONFIRMED").length,
    ideas: lines.filter((l) => l.status === "IDEA").length,
    cancelled: lines.filter((l) => l.status === "CANCELLED").length,
    lines,
  };
}

/**
 * SL izpis povzetka za @AI (iskren: potrjeno = samo z atestacijo;
 * naslednje dejanje usmeri na obstoječe UI poti, ne izvaja ga agent).
 */
export function formatBookingSummary(s: BookingSummary): string {
  if (s.total === 0) {
    return "Na tej poti še ni rezervacijskih vrstic (0 zapisov — iskreno: nimam kaj potrditi). Rezervacije se dodajajo na strani poti (IDEA) oz. prek partner kanala; potrjena je samo vrstica s številko ponudnika in ceno (atestacija uporabnika).";
  }
  const parts: string[] = [];
  parts.push(
    `Rezervacijske vrstice na tej poti: ${s.total} (potrjene ${s.confirmed}, ideje ${s.ideas}` +
      (s.cancelled > 0 ? `, preklicane ${s.cancelled}` : "") +
      ")."
  );
  for (const l of s.lines) {
    const statusLabel =
      l.status === "CONFIRMED"
        ? "POTRJENA"
        : l.status === "IDEA"
          ? "ideja"
          : l.status === "CANCELLED"
            ? "preklicana"
            : "NEZNANO";
    const channel = l.channel ? ` · vir: ${l.channel}` : "";
    const note = l.userNote ? ` · „${l.userNote}“` : "";
    parts.push(`· Dan ${l.day}: ${l.name} — ${statusLabel}${channel}${note}`);
  }
  parts.push(
    "Stanje je samo-bralno (jazen rezervacij NE spreminjam) — potrditve in preklice izvedeš na strani poti prek obstoječih poti z atestacijo."
  );
  return parts.join("\n");
}
