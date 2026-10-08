/**
 * TRIP-ICS — determinističen izvoz deljene pote v koledar (RFC 5545).
 *
 * P0-G (issue #1 §17 „ICS sharing“): pot uporabniku pomeni ZADELGAN
 * koledar — izvoz .ics, ki ga Google/Apple/Outlook koledar odprejo z
 * enkim klikom. Vir podatkov so DST-varni lokalni ISO datumi poti
 * (trip-dates.ts, P0-E) + dnevi načrta.
 *
 * KANONI:
 *  - ČISTA FUNKCIJA: isti vhod → bajtno-iden izhod (DTSTAMP je edini
 *    izjema — obvezen RFC podatek, prek parametra `now` testabilen);
 *  - CELODNEVNI dogodki (DTSTART;VALUE=DATE): koledarju NE podajamo
 *    ur (načrt ima predlagane ure, a so odvisne od dneva poti in
 *    prevoza — iskreno je „cel dan“, ne lažno natančen termin;
 *    celtednevni dogodki so hkrati naravno DST-varni);
 *  - RFC 5545: CRLF, beg (escape) besedila, prelom vrstic na 75 oktetov,
 *    DTEND je EKSKLUZIVEN dan po zadnjem dnevu (kanon celodnevnih
 *    dogodkov);
 *  - FAIL-CLOSED: katerikoli neveljaven podatek → null (nikoli
 *    izmišljenega datuma ali praznega koledarja).
 */

import { isIsoDate, validateTripDates } from "./trip-dates";

// ── Vnosi ────────────────────────────────────────────────────────────────

export interface IcsTripDay {
  /** Lokalni ISO datum dneva (YYYY-MM-DD — kanon trip-dates). */
  date: string;
  /** Povzetek dneva (npr. imena postankov ali naslov dneva). */
  summary: string;
}

export interface IcsTripInput {
  /** Ime poti (SUMMARY dogodka celotne pote). */
  title: string;
  /** Lokalni ISO datum začetka (YYYY-MM-DD, vključujoč). */
  dateStart: string;
  /** Lokalni ISO datum konca (YYYY-MM-DD, vključujoč). */
  dateEnd: string;
  /** Dnevi poti (vsaj 1; datumi znotraj [dateStart, dateEnd]). */
  days: readonly IcsTripDay[];
  /** Stabilni ključ poti (shareId) za UID — determinizem. */
  uidKey: string;
  /** Javni URL deljene pote (neobvezno — v DESCRIPTION dogodkov). */
  url?: string;
  /** Trenutek izdaje (obvezno podatek RFC; testi podajo fiksen). */
  now: Date;
}

// ── RFC 5545 pomočniki (čisti) ───────────────────────────────────────────

/** Beg besedila po RFC 5545 §3.3.11: \ ; , in prelomi vrstic. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\r/g, "\\n")
    .replace(/\n/g, "\\n");
}

/**
 * Prelom vrstice na ≤ 75 oktetov (RFC 5545 §3.1): prva vrstica do 75,
 * nadaljevanja uvodimo z enim presledkom. Šteje OKTETE (UTF-8), ne
 * znakov — čršče/šumniki so večbajtni.
 */
export function foldIcsLine(line: string): string {
  const chunks: string[] = [];
  let current = "";
  let octets = 0;
  const pushChunk = () => {
    if (current.length > 0) chunks.push(current);
    current = "";
    octets = 0;
  };
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    const limit = chunks.length === 0 ? 75 : 74; // nadaljevanje: 1 znak je uvodni presledek
    if (octets + size > limit) pushChunk();
    current += ch;
    octets += size;
  }
  pushChunk();
  return chunks.join("\r\n ");
}

/** Lokalni ISO (YYYY-MM-DD) → oblika datuma RFC 5545 (YYYYMMDD). */
function icsDate(iso: string): string {
  return iso.replaceAll("-", "");
}

/** Datum → oblika DTSTAMP (UTC, YYYYMMDDTHHMMSSZ). */
function icsStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

// ── Izvoz ────────────────────────────────────────────────────────────────

/**
 * Izgradi .ics vsebino celotne pote: en celodneven VEVENT na dan poti
 * (SUMMARY = Dan N — povzetek; DESCRIPTION = ime poti + URL, če je
 * podan). Krovni dogodek celotne pote bi se v koledarjih podvajal —
 * dnevi SO dogodki. Vrne null ob katerikoli nepravilnosti
 * (fail-closed).
 */
export function buildTripIcs(input: IcsTripInput): string | null {
  const { title, dateStart, dateEnd, days, uidKey, url, now } = input;

  if (typeof title !== "string" || title.trim() === "") return null;
  if (typeof uidKey !== "string" || uidKey.trim() === "") return null;
  if (!isIsoDate(dateStart) || !isIsoDate(dateEnd)) return null;
  if (!validateTripDates({ start: dateStart, end: dateEnd }).ok) return null;
  if (!Array.isArray(days) || days.length === 0) return null;

  const stamp = icsStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Discover Slovenia AI//Trip Export//SL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const day of days) {
    if (typeof day !== "object" || day === null) return null;
    if (typeof day.date !== "string" || !isIsoDate(day.date)) return null;
    if (day.date < dateStart || day.date > dateEnd) return null;
    const summary = typeof day.summary === "string" ? day.summary.trim() : "";
    if (summary === "") return null; // prazen dan ni dogodek — fail-closed
    // DTEND celodnevnega dogodka je EKSKLUZIVEN: dan + 1.
    const [y, m, d] = day.date.split("-").map(Number);
    const end = new Date(Date.UTC(y!, (m ?? 1) - 1, d!));
    end.setUTCDate(end.getUTCDate() + 1);
    const p = (n: number) => String(n).padStart(2, "0");
    const dtEnd =
      `${end.getUTCFullYear()}${p(end.getUTCMonth() + 1)}${p(end.getUTCDate())}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:dsa-trip-${uidKey}-${icsDate(day.date)}@discover-slovenia-ai`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(day.date)}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    const descParts = [title.trim()];
    if (url) descParts.push(url);
    lines.push(`DESCRIPTION:${escapeIcsText(descParts.join(" — "))}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map((l) => foldIcsLine(l)).join("\r\n") + "\r\n";
}

// ── Prenos (client-side) ─────────────────────────────────────────────────

/**
 * Sproži prenos .ics datoteke v brskalniku (Blob + a[download]).
 * Ime datoteke izhaja iz uidKey (sanitizirano) — brez poti, brez
 * presledkov. Vrne true ob uspehu (uporabniku pokažemo povratnico).
 */
export function downloadTripIcs(content: string, uidKey: string): boolean {
  if (typeof window === "undefined") return false;
  const safe = uidKey.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "pot";
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `pot-${safe}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}
