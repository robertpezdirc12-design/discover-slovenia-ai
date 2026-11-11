/**
 * AJPES — POSLOVNI REGISTER SLOVENIJE (PRS) kot vir prenočišč.
 *
 * Uporabnikova zahteva: URADNI podatki — uradna prenočišča, uradni naslovi.
 * AJPES dvakrat mesečno objavlja odprte podatke PRS (CC BY 4.0) na
 * podatki.gov.si. V PRS so vpisani tudi vsi registrirani sobodajalci
 * (pravnoorganizacijski obliki »Registrirani sobodajalec« in
 * »Del pri sobodajalcu«) — to je izčrpen uradni seznam zasebnih
 * ponudnikov prenočitvenih storitev v Sloveniji, vsak z uradnim
 * poslovnim naslovom (ulica, hišna številka, naselje, pošta).
 *
 * CSV: UTF-16LE, ločilo vejica, polja v navedkah; stolpci:
 *   0 Matična številka, 1 Popolno ime, 2 HSEID, 3 Pravnoorganizacijska
 *   oblika, 4 Registrski organ, 5 Ulica, 6 Hišna št, 7 Hišna št dodatek,
 *   8 Naselje, 9 Poštna št, 10 Pošta, 11 Država.
 *
 * Čisto in testabilno: razčlenjevanje dela na nizu/bajtih, brez fetch.
 */

/** En ponudnik iz PRS (uradni vpis). */
export interface AjpesProvider {
  /** Matična številka (8 mest) — stabilen uradni identifikator. */
  maticna: string;
  /** Popolno ime iz registra (velike črke). */
  rawName: string;
  /** Urejeno ime za prikaz (naslovne črke, brez » - SOBODAJALEC « pripone). */
  name: string;
  /** Vrsta ponudnika iz imena (»sobodajalec«, »oddajanje sob« …) ali null. */
  role: string | null;
  /** Pravnoorganizacijska oblika (npr. »Registrirani sobodajalec«). */
  legalForm: string;
  ulica: string;
  hs: string;
  hsDodatek: string;
  naselje: string;
  postnaSt: string;
  posta: string;
}

/** Pravnoorganizacijske oblike v PRS, ki pomenijo ponudnika prenočitve. */
export const SOBODAJALEC_LEGAL_FORMS = [
  'Registrirani sobodajalec',
  'Del pri sobodajalcu',
] as const;

/** Uradni CSV vir (podatki.gov.si — AJPES PRS, dvotedensko osveževanje). */
export const PRS_CSV_URL =
  'https://podatki.gov.si/dataset/9ee1a9aa-c224-4995-b2ad-3760d7af0748' +
  '/resource/beb70929-3d0d-41c6-9af2-25d525d906d3/download/opsiprs.csv';

// ─── Pomožne pretvorbe ───────────────────────────────────────────────────────

/** Odstrani vodilne ničle hišne številke (»017« → »17«, »00« → »0«). */
export function normalizeHouseNumber(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const stripped = trimmed.replace(/^0+(?=\d)/, '');
  return stripped;
}

/** Manjše začetnice vsebujejo šumnike — primerjaj brez diakritik/presledkov. */
export function normalizeCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Besedne številke: samo besede, ne okrajšav z piko (s.p., d.o.o. …). */
const KEEP_UPPERCASE = new Set(['s.p.', 'd.o.o.', 'd.d.', 'd.n.o.', 'k.d.', 'd.o.o.', 'i.z.', 'o.p.']);

/** »VELIKE ČRKE« → »Velike črke« (ohrani znane okrajšave). */
export function titleCaseSlovenian(raw: string): string {
  return raw
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (KEEP_UPPERCASE.has(lower)) return lower;
      // Pomišljaji/podpičja: prva črka vsakega dela
      return lower.replace(/(^|[-\/'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(' ');
}

/**
 * Ime iz registra pretvori v prikazno obliko.
 * »ALBREHT ANTON - SOBODAJALEC« → ime »Albreht Anton«, vloga »sobodajalec«.
 */
export function prettifyPrsName(rawName: string): { name: string; role: string | null } {
  const idx = rawName.indexOf(' - ');
  if (idx > 0) {
    const left = rawName.slice(0, idx).trim();
    const right = rawName.slice(idx + 3).trim();
    if (left.length >= 3) {
      return { name: titleCaseSlovenian(left), role: right ? titleCaseSlovenian(right) : null };
    }
  }
  return { name: titleCaseSlovenian(rawName.trim()), role: null };
}

// ─── CSV razčlenjevalnik (UTF-16LE, navedki, vejice v poljih) ───────────────

/** Razčleni eno CSV vrstico v polja (obravnavane navedke + vejice). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Normaliziran ključ predpomnilnika geokodiranja za poslovni naslov. */
export function geocodeCacheKey(p: {
  ulica: string;
  hs: string;
  hsDodatek: string;
  naselje: string;
  postnaSt: string;
}): string {
  return [
    normalizeCompare(p.ulica),
    normalizeHouseNumber(p.hs),
    normalizeCompare(p.hsDodatek),
    normalizeCompare(p.naselje),
    p.postnaSt.trim(),
  ].join('|');
}

/** Zloži ulico + hišno številko (+dodatek) v eno vrstico. */
export function streetLine(p: Pick<AjpesProvider, 'ulica' | 'hs' | 'hsDodatek'>): string {
  const hs = [normalizeHouseNumber(p.hs), p.hsDodatek.trim()].filter(Boolean).join('');
  return [p.ulica.trim(), hs].filter(Boolean).join(' ');
}

/** Polna naslovna vrstica (ulica, poštna št. pošta). */
export function fullAddressLine(p: Pick<AjpesProvider, 'ulica' | 'hs' | 'hsDodatek' | 'postnaSt' | 'posta'>): string {
  const street = streetLine(p);
  const post = [p.postnaSt.trim(), p.posta.trim()].filter(Boolean).join(' ');
  return [street, post].filter(Boolean).join(', ');
}

// ─── Razčlenjevanje celotnega PRS CSV ────────────────────────────────────────

/** Podatki o usklajevanju — za pošteno poročanje v UI. */
export interface PrsParseResult {
  providers: AjpesProvider[];
  totalRows: number;
  skippedForeign: number;
}

/**
 * Razčleni PRS CSV iz BAJTOV (UTF-16LE) in izvleči vse ponudnike prenočitve.
 * Podvojeni matični vpisi se odstranijo (prvi zmaguje). Fail-clean: [].
 *
 * Opomba: za velik uradni CSV (126 MB) raje uporabi `parsePrsCsvStream` —
 * procesa ne naloži celotne datoteke v pomnilnik.
 */
export function parsePrsCsv(bytes: Uint8Array): PrsParseResult {
  const text = new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
  return parsePrsCsvText(text);
}

/**
 * Razčleni PRS CSV iz PRETOKA bajtov (UTF-16LE) — varno za 126 MB uradni
 * vir: celotna datoteka nikoli ni v pomnilniku, obdelava poteka vrstico
 * po vrstici. Podvojeni matični vpisi se odstranijo (prvi zmaguje).
 */
export async function parsePrsCsvStream(
  stream: ReadableStream<Uint8Array>,
): Promise<PrsParseResult> {
  const state = createParserState();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-16le');
  let carry = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.length === 0) continue;
    carry += decoder.decode(value, { stream: true });
    const lines = carry.split(/\r?\n/);
    carry = lines.pop() ?? '';
    for (const line of lines) processPrsLine(state, line);
  }
  carry += decoder.decode();
  if (carry) processPrsLine(state, carry);

  return finishParser(state);
}

// ─── Skupno jedro razčlenjevanja (vrstica po vrstici) ───────────────────────

interface ParserState {
  byMaticna: Map<string, AjpesProvider>;
  totalRows: number;
  skippedForeign: number;
  headerSkipped: boolean;
}

function createParserState(): ParserState {
  return { byMaticna: new Map(), totalRows: 0, skippedForeign: 0, headerSkipped: false };
}

function processPrsLine(state: ParserState, line: string): void {
  if (!line || line.length < 10) return;
  if (!state.headerSkipped) {
    state.headerSkipped = true;
    if (line.includes('Mati')) return; // glavna glava (tudi morebitni BOM)
  }
  const cols = splitCsvLine(line);
  if (cols.length < 12) return;

  const maticna = cols[0].trim();
  const legalForm = cols[3].trim();
  if (!maticna || !SOBODAJALEC_LEGAL_FORMS.includes(legalForm as never)) return;

  state.totalRows += 1;
  if (cols[11].trim().toUpperCase() !== 'SLOVENIJA') {
    state.skippedForeign += 1;
    return;
  }
  if (state.byMaticna.has(maticna)) return;

  const rawName = cols[1].trim();
  if (!rawName) return;
  const pretty = prettifyPrsName(rawName);

  state.byMaticna.set(maticna, {
    maticna,
    rawName,
    name: pretty.name,
    role: pretty.role,
    legalForm,
    ulica: cols[5].trim(),
    hs: cols[6].trim(),
    hsDodatek: cols[7].trim(),
    naselje: cols[8].trim(),
    postnaSt: cols[9].trim(),
    posta: cols[10].trim(),
  });
}

function finishParser(state: ParserState): PrsParseResult {
  return {
    providers: Array.from(state.byMaticna.values()),
    totalRows: state.totalRows,
    skippedForeign: state.skippedForeign,
  };
}

/** (Notranje) razčleni celoten dekodiran tekst po vrsticah. */
function parsePrsCsvText(text: string): PrsParseResult {
  const state = createParserState();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) processPrsLine(state, lines[i]);
  return finishParser(state);
}