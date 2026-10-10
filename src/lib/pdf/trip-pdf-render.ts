/**
 * TRIP-PDF-RENDER — izris TripPdfDoc v PDF (jsPDF, P5).
 *
 * Kanoni:
 *  - DETERMINIZEM: isti (doc, issuedAt) → bitno isti PDF (setCreationDate
 *    fiksiran na issuedAt — ni skrite ure v izhodu); dokazano s testi;
 *  - LENI NALOŽEK: jsPDF + fonta (~50 KB) se naložita šele ob kliku
 *    (dinamični import → ločen chunk, začetni load nespremenjen);
 *  - FONT: podnaboran Liberation Sans (Regular + Bold) — polna podpora
 *    č/š/ž za vseh 6 jezikov (privzeti PDF fonti so WinAnsi in jih ne morejo);
 *  - 0 AI: izris je čista projekcija vsebinskega modela.
 *
 * Uporaba iz komponent:
 *   const doc = buildTripPdf(input, locale);
 *   await downloadTripPdf(doc);   // v brskalniku sproži prenos
 */

import {
  PDF_FONT_BOLD_B64,
  PDF_FONT_FAMILY,
  PDF_FONT_REGULAR_B64,
} from "@/lib/pdf/fonts";
import type { TripPdfDoc } from "@/lib/pdf/trip-pdf-doc";

const REGULAR_FILE = "LiberationSans-Regular-subset.ttf";
const BOLD_FILE = "LiberationSans-Bold-subset.ttf";

/** Preklopljivi konstruktor za teste (injektirana odvisnost, kanon projekta). */
export type JsPdfCtor = new (options: {
  orientation: "p" | "portrait";
  unit: "mm";
  format: "a4";
}) => JsPdfLike;

export interface JsPdfLike {
  addFileToVFS(name: string, b64: string): JsPdfLike;
  addFont(file: string, family: string, style: string): JsPdfLike;
  setFont(family: string, style: string): JsPdfLike;
  setFontSize(pt: number): JsPdfLike;
  setTextColor(r: number, g: number, b: number): JsPdfLike;
  setDrawColor(r: number, g: number, b: number): JsPdfLike;
  setLineWidth(w: number): JsPdfLike;
  text(str: string, x: number, y: number, options?: { align?: "left" | "right" | "center" }): JsPdfLike;
  line(x1: number, y1: number, x2: number, y2: number): JsPdfLike;
  splitTextToSize(str: string, maxWidth: number): string[];
  getNumberOfPages(): number;
  setPage(page: number): JsPdfLike;
  addPage(): JsPdfLike;
  setCreationDate(d: Date): JsPdfLike;
  output(kind: "arraybuffer"): ArrayBuffer;
  save(filename: string): JsPdfLike;
}

export interface RenderTripPdfOptions {
  /** Datum izdaje — gre v /CreationDate in nogo (del vhoda → determinizem). */
  issuedAt: Date;
}

const PAGE = { margin: 18, width: 210, height: 297 } as const;
const CONTENT_W = PAGE.width - 2 * PAGE.margin;

const ink = [17, 24, 39] as const;      // slate-900 (glave)
const body = [30, 41, 59] as const;     // slate-800 (besedilo)
const muted = [100, 116, 139] as const; // slate-500 (noga, opombe)
const rule = [203, 213, 225] as const;  // slate-300 (ločilne črte)

/** Izriše dokument NA obstoječo instanco (jedro, brez output/save). */
function renderOnto(pdf: JsPdfLike, doc: TripPdfDoc, options: RenderTripPdfOptions): void {
  // Fonti (podnaboran Liberation Sans) — č š ž za vseh 6 jezikov.
  pdf.addFileToVFS(REGULAR_FILE, PDF_FONT_REGULAR_B64);
  pdf.addFileToVFS(BOLD_FILE, PDF_FONT_BOLD_B64);
  pdf.addFont(REGULAR_FILE, PDF_FONT_FAMILY, "normal");
  pdf.addFont(BOLD_FILE, PDF_FONT_FAMILY, "bold");

  // Determinizem: /CreationDate = issuedAt (ni skrite trenutne ure).
  pdf.setCreationDate(options.issuedAt);

  let y = 0;

  /** Nadaljuj na novi strani, ko zmanjka prostora (noge se narišejo na koncu). */
  const ensureSpace = (needed: number) => {
    if (y + needed <= PAGE.height - 24) return;
    pdf.addPage();
    y = PAGE.margin;
  };

  // — GLAVA ————————————————————————————————————————
  y = PAGE.margin + 6;
  pdf.setFont(PDF_FONT_FAMILY, "bold");
  pdf.setFontSize(19);
  pdf.setTextColor(...ink);
  pdf.text(doc.heading, PAGE.margin, y);
  y += 7;

  pdf.setFont(PDF_FONT_FAMILY, "normal");
  pdf.setFontSize(12.5);
  pdf.setTextColor(...body);
  pdf.text(doc.subtitle, PAGE.margin, y);
  y += 8;

  pdf.setDrawColor(...rule);
  pdf.setLineWidth(0.4);
  pdf.line(PAGE.margin, y - 3.5, PAGE.margin + CONTENT_W, y - 3.5);
  y += 5;

  // — META (datumi, dnevi, postanki, stroški) ————————————————
  pdf.setFontSize(10.5);
  for (const line of doc.metaLines) {
    ensureSpace(6.5);
    pdf.setFont(PDF_FONT_FAMILY, "normal");
    pdf.setTextColor(...body);
    pdf.text(line, PAGE.margin, y);
    y += 6.2;
  }

  // — DNEVI ————————————————————————————————————————
  for (const day of doc.daySections) {
    ensureSpace(24);
    y += 4;

    pdf.setFont(PDF_FONT_FAMILY, "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...ink);
    pdf.text(day.label, PAGE.margin, y);

    if (day.dateLine) {
      pdf.setFont(PDF_FONT_FAMILY, "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...muted);
      pdf.text(day.dateLine, PAGE.margin + CONTENT_W, y, { align: "right" });
    }
    y += 6;

    pdf.setDrawColor(...rule);
    pdf.setLineWidth(0.3);
    pdf.line(PAGE.margin, y - 3.4, PAGE.margin + CONTENT_W, y - 3.4);
    y += 3;

    if (day.locations.length === 0) {
      ensureSpace(6.5);
      pdf.setFont(PDF_FONT_FAMILY, "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...muted);
      pdf.text("—", PAGE.margin + 5, y);
      y += 6.5;
      continue;
    }

    pdf.setFontSize(10.5);
    for (const loc of day.locations) {
      ensureSpace(6.5);
      const line = loc.time ? `${loc.time}   ${loc.name}` : loc.name;
      pdf.setFont(PDF_FONT_FAMILY, "normal");
      pdf.setTextColor(...body);
      pdf.text(line, PAGE.margin + 5, y);
      y += 6.5;
    }
  }

  // — POKRITJE (samo načrti iz /nacrtuj) ————————————————
  if (doc.coverage && doc.coverageHeading) {
    ensureSpace(20);
    y += 5;
    pdf.setFont(PDF_FONT_FAMILY, "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...ink);
    pdf.text(doc.coverageHeading, PAGE.margin, y);
    y += 5.5;
    pdf.setFont(PDF_FONT_FAMILY, "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...body);
    for (const ln of pdf.splitTextToSize(doc.coverage, CONTENT_W)) {
      ensureSpace(5.5);
      pdf.text(ln, PAGE.margin, y);
      y += 5.5;
    }
  }

  // — ISKRENOSTNA OPOMBA ————————————————————————
  ensureSpace(24);
  y += 6;
  pdf.setDrawColor(...rule);
  pdf.setLineWidth(0.4);
  pdf.line(PAGE.margin, y - 3.5, PAGE.margin + CONTENT_W, y - 3.5);
  y += 4;
  pdf.setFontSize(8.5);
  pdf.setTextColor(...muted);
  for (const ln of pdf.splitTextToSize(doc.honesty, CONTENT_W)) {
    ensureSpace(5);
    pdf.text(ln, PAGE.margin, y);
    y += 5;
  }

  drawFooters(pdf, doc, options);
}

/** Noga na VSAKI strani: vir + izdano levo, stran desno. */
function drawFooters(pdf: JsPdfLike, doc: TripPdfDoc, options: RenderTripPdfOptions): void {
  const issued = new Intl.DateTimeFormat(doc.lang === "sl" ? "sl-SI" : doc.lang, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(options.issuedAt);

  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    const footY = PAGE.height - 12;
    pdf.setFont(PDF_FONT_FAMILY, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...muted);
    pdf.text(
      `${doc.sourceLine} · ${doc.issuedLabel}: ${issued}`,
      PAGE.margin,
      footY
    );
    pdf.text(doc.pageOfLabel(p, total), PAGE.margin + CONTENT_W, footY, {
      align: "right",
    });
  }
}

/**
 * Deterministični /ID (jsPDF ga gradi iz Math.random → prepišemo).
 * FNV-1a ×4 z različnimi semeni → 32 hex (enaka dolžina kot jsPDF-jev;
 * zamenjava ne premika offsetov — /ID ni stream, /Length se ne spremeni).
 */
function fnv1a(bytes: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function deterministicPdfId(doc: TripPdfDoc, issuedAt: Date): string {
  const issuedIso = issuedAt.toISOString();
  return (
    fnv1a(doc.filename, 0x811c9dc5) +
    fnv1a(doc.heading + doc.subtitle, 0x1b873593) +
    fnv1a(doc.metaLines.join("|"), 0x9dc58a1c) +
    fnv1a(issuedIso, 0x735a2d81)
  ).toUpperCase();
}

/** Prepiše naključni /ID z determinističnim (ista dolžina — bitno varno). */
function patchPdfId(bytes: Uint8Array, doc: TripPdfDoc, options: RenderTripPdfOptions): Uint8Array {
  const id = deterministicPdfId(doc, options.issuedAt);
  const s = new TextDecoder("latin1").decode(bytes);
  const patched = s.replace(
    /\/ID \[ <[0-9A-F]+> <[0-9A-F]+> \]/,
    `/ID [ <${id}> <${id}> ]`
  );
  return new TextEncoder().encode(patched);
}

/** Strežniško/testni vstop z injiciranim konstruktorjem (0 omrežja). */
export function renderWith(
  ctor: JsPdfCtor,
  doc: TripPdfDoc,
  options: RenderTripPdfOptions
): { bytes: Uint8Array; filename: string; pages: number } {
  const pdf = new ctor({ orientation: "p", unit: "mm", format: "a4" });
  renderOnto(pdf, doc, options);
  return {
    bytes: patchPdfId(new Uint8Array(pdf.output("arraybuffer")), doc, options),
    filename: doc.filename,
    pages: pdf.getNumberOfPages(),
  };
}

/** Pravi izris v brskalniku/app (leni import jsPDF). */
export async function renderTripPdf(
  doc: TripPdfDoc,
  options: RenderTripPdfOptions
): Promise<{ bytes: Uint8Array; filename: string; pages: number }> {
  const { jsPDF } = await import("jspdf");
  return renderWith(new jsPDF({ orientation: "p", unit: "mm", format: "a4" }) as unknown as JsPdfCtor, doc, options);
}

/** Prenos v brskalniku (blob + <a download> — ENOTA pot z renderWith).
 *  (pdf.save() ne bi šel skozi patchPdfId — zato lasten prenos.) */
export async function downloadTripPdf(
  doc: TripPdfDoc,
  options?: Partial<RenderTripPdfOptions>
): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" }) as unknown as JsPdfLike;
  const opts: RenderTripPdfOptions = { issuedAt: options?.issuedAt ?? new Date() };
  renderOnto(pdf, doc, opts);
  const bytes = patchPdfId(new Uint8Array(pdf.output("arraybuffer")), doc, opts);

  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
  return doc.filename;
}
