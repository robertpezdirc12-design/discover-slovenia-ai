/**
 * GTFS PoC MERITVE — javni prevozi (odločitveni paket za lastnika, issue #35 razširitev)
 * ============================================================================
 * Namen: IZMERITI javno dostopen GTFS feed po hišni iskrenostni disciplini —
 * brez nove odvisnosti in brez vpliva na aplikacijski runtime:
 *   1. ZDRAVJE FEEDA: veljavnost (calendar_dates), štetja (postaje, vožnje,
 *      odhodi), preverjanje skladnosti brez calendar.txt;
 *   2. POKRITOST KANONA: za vsako izmed 74 kanonskih destinacij najbližja
 *      postaja + število postaj ≤1 km in ≤2 km (haversine, kanon koordinat
 *      iz src/lib/slovenia-data.ts);
 *   3. PROTOTIP ODHODOV: naslednjih 8 odhodov na izbrani postaji za dani
 *      datum/uro (storitve po GTFS spec: calendar.txt tedenska maska ±
 *      calendar_dates izjeme; brez calendar.txt je storitev aktivna IZKLJUČNO
 *      z exception_type=1 vrstico za tisti datum);
 *   4. OPICIJSKI SQLite PROTOTIP (--db pot): pretakanje stop_times v
 *      bun:sqlite z meritvijo trajanja uvoza + velikosti baze + časa
 *      indeksirane odhodne poizvedbe.
 *
 * Kanoni:
 *  - SAMO MERITVE: skripta ne piše v aplikacijsko bazo; SQLite nastane SAMO s
 *    --db in je merilni artefakt (ne strežniška shema);
 *  - ISKRENOST: zastarelost/neuveljavnost se izpiše kot DEJSTVO (stale =
 *    stale) — nič se ne „zeleni“; manjkajoča polja se izpišejo po imenu;
 *  - 0 NOVIH ODVISNOSTI: CSV ročni razčlenjevalnik (narekovaji + ""), SQLite
 *    prek vgrajenega bun:sqlite;
 *  - ZAGON:
 *      bun scripts/gtfs-poc-meritve.ts <mapa-feeda> [--db <pot.db>]
 *          [--datum YYYYMMDD] [--cas HH:MM] [--postaja <stop_id>]
 *
 * Meritveni vir (17. 10. 2026): LPP https://avl.lpp.si/transit/api/gtfs
 *   (stari https://data.lpp.si/api/gtfs/feed.zip zdaj 302 sem in po preusmeritvi vrača
 *    ODREZAN zip — prenašaj NEPOSREDNO z nove domene; GET edino, HEAD=405)
 * — neposredni vir je SVEŽ (okno ~30 dni), zrcalo mdb-latest kataloga
 * MobilityData je za isti feed ZASTARELO; ostalih 5 SI feedov v katalogu je
 * zaščitenih z B2B registracijo (HTTP 401) — glej
 * docs/research/gtfs-javni-prevozi-poc.md.
 */

import { Database } from "bun:sqlite";
import { rmSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { DESTINATIONS } from "../src/lib/slovenia-data";

// ---------- argumenti ----------
const args = process.argv.slice(2);
function optValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const feedDir = args[0];
if (!feedDir) {
  console.error("UPORABA: bun scripts/gtfs-poc-meritve.ts <mapa-feeda> [--db <pot.db>] [--datum YYYYMMDD] [--cas HH:MM] [--postaja <stop_id>]");
  process.exit(1);
}
const dbPath = optValue("--db");
const datumArg = optValue("--datum");
const casArg = optValue("--cas");
const postajaArg = optValue("--postaja");

// ---------- pomožniki ----------
/** razčleni eno CSV vrstico (GTFS: narekovaji, "" ubežnik) */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** preberi CSV v spomin (samo MAJHNE datoteke: agency/routes/stops/trips/calendar*) */
function readCsv(path: string): { header: string[]; rows: string[][] } {
  const raw = readFileSync(path, "utf8") as string;
  // \r?\n — CRLF feedi (LPP) sicer onesnažijo ZADNJI stolpec (stop_lon "14.50\r" → NaN, exception_type "1\r" ≠ "1")
  const lines = raw.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  const header = parseCsvLine(lines[0].replace(/^\uFEFF/, ""));
  const rows = lines.slice(1).map((l) => parseCsvLine(l));
  return { header, rows };
}

/** "HH:MM:SS" (ure lahko >23 po GTFS spec) → sekunde od polnoči */
function hmsToSeconds(v: string): number {
  const p = v.split(":");
  if (p.length !== 3) return NaN;
  return Number(p[0]) * 3600 + Number(p[1]) * 60 + Number(p[2]);
}

/** danes v Europe/Ljubljana kot YYYYMMDD oziroma HH:MM */
function ljParts(kind: "datum" | "cas"): string {
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Ljubljana",
    ...(kind === "datum"
      ? { year: "numeric", month: "2-digit", day: "2-digit" }
      : { hour: "2-digit", minute: "2-digit", hour12: false }),
  });
  const s = f.format(new Date());
  return kind === "datum" ? s.replaceAll("-", "") : s;
}

/** haversine v km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- 1. zdravje feeda ----------
const t0 = performance.now();
console.log(`# GTFS PoC meritve — ${feedDir}`);
console.log(`# zagon (Europe/Ljubljana): ${ljParts("datum")} ${ljParts("cas")}`);

const agency = readCsv(`${feedDir}/agency.txt`);
console.log(`agency: ${agency.rows.length} | ${agency.rows.map((r) => r[1]).join("; ")}`);

const stopsCsv = readCsv(`${feedDir}/stops.txt`);
const sIdx = Object.fromEntries(stopsCsv.header.map((h, i) => [h, i]));
type Stop = { id: string; name: string; lat: number; lon: number };
const stops: Stop[] = stopsCsv.rows.map((r) => ({
  id: r[sIdx["stop_id"]],
  name: r[sIdx["stop_name"]],
  lat: Number(r[sIdx["stop_lat"]]),
  lon: Number(r[sIdx["stop_lon"]]),
}));
console.log(`stops: ${stops.length}`);

const routesCsv = readCsv(`${feedDir}/routes.txt`);
const routes = new Map<string, { short: string; long: string; type: string }>();
for (const r of routesCsv.rows) {
  const g = (h: string) => r[routesCsv.header.indexOf(h)] ?? "";
  routes.set(g("route_id"), { short: g("route_short_name"), long: g("route_long_name"), type: g("route_type") });
}
console.log(`routes: ${routes.size} (tipi: ${[...new Set([...routes.values()].map((v) => v.type))].join(",")})`);

const tripsCsv = readCsv(`${feedDir}/trips.txt`);
const tIdx = Object.fromEntries(tripsCsv.header.map((h, i) => [h, i]));
type Trip = { routeId: string; serviceId: string; headsign: string };
const trips = new Map<string, Trip>();
for (const r of tripsCsv.rows) {
  trips.set(r[tIdx["trip_id"]], {
    routeId: r[tIdx["route_id"]],
    serviceId: r[tIdx["service_id"]],
    headsign: r[tIdx["trip_headsign"]],
  });
}
console.log(`trips: ${trips.size}`);

const calPath = `${feedDir}/calendar.txt`;
const calExists = Bun.file(calPath).size > 0;
const cdCsv = readCsv(`${feedDir}/calendar_dates.txt`);
type Cd = { serviceId: string; date: string; type: string };
const calDates: Cd[] = cdCsv.rows.map((r) => ({
  serviceId: r[cdCsv.header.indexOf("service_id")],
  date: r[cdCsv.header.indexOf("date")],
  type: r[cdCsv.header.indexOf("exception_type")],
}));
const cdMin = calDates.length ? calDates.map((c) => c.date).reduce((a, b) => (a < b ? a : b)) : "-";
const cdMax = calDates.length ? calDates.map((c) => c.date).reduce((a, b) => (a > b ? a : b)) : "-";
console.log(`calendar.txt: ${calExists ? "DA" : "NE"} | calendar_dates: ${calDates.length} vrstic, okno ${cdMin} → ${cdMax}`);

// ---------- 2. aktivne storitve za datum ----------
const datum = datumArg ?? ljParts("datum");
const aktivne = new Set<string>();
if (calExists) {
  const cal = readCsv(calPath);
  const gi = (h: string) => cal.header.indexOf(h);
  const dan = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    Math.floor(Date.parse(`${datum.slice(0, 4)}-${datum.slice(4, 6)}-${datum.slice(6, 8)}T12:00:00Z`) / 86400000) % 7
  ];
  for (const r of cal.rows) {
    const from = r[gi("start_date")], to = r[gi("end_date")];
    if (datum >= from && datum <= to && r[gi(dan)] === "1") aktivne.add(r[gi("service_id")]);
  }
}
for (const c of calDates) {
  if (c.date !== datum) continue;
  if (c.type === "1") aktivne.add(c.serviceId);
  else if (c.type === "2") aktivne.delete(c.serviceId);
}
const jeVKrnu = datum >= cdMin && datum <= cdMax;
console.log(`datum meritve: ${datum} | aktivnih storitev: ${aktivne.size} | datum znotraj okna feeda: ${jeVKrnu ? "DA" : "NE (stale za ta datum!)"}`);
if (!aktivne.size) {
  console.log("ISKRENOST: za ta datum ni aktivnih storitev — odhodni prototip se ne izvede (meri se samo zdravje + pokritost).");
}

// ---------- 3. pretakanje stop_times ----------
const stPath = `${feedDir}/stop_times.txt`;
const stSize = Bun.file(stPath).size;
let stRows = 0;
let stServedStops = new Set<string>();
let stAktivniOdhodi = 0;
/** odhodi za ciljno postajo (določimo po bližini kanonske Ljubljane, če ni --postaja) */
const ljubljana = DESTINATIONS.find((d) => d.slug === "ljubljana");
const ciljna = postajaArg
  ? stops.find((s) => s.id === postajaArg)
  : stops
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
      .sort((a, b) => haversineKm(ljubljana!.coords.lat, ljubljana!.coords.lng, a.lat, a.lon) - haversineKm(ljubljana!.coords.lat, ljubljana!.coords.lng, b.lat, b.lon))[0];
console.log(`ciljna postaja (najbližja kanonski Ljubljani${postajaArg ? ", prek --postaja" : ""}): ${ciljna ? `${ciljna.name} (${ciljna.id})` : "NI NAJDEN"}`);

const tStream = performance.now();
const odhodi: { sec: number; tripId: string }[] = [];
{
  const file = Bun.file(stPath);
  const stream = file.stream();
  const decoder = new TextDecoder();
  let buffer = "";
  let header: string[] | null = null;
  let iTrip = -1, iSec = -1, iStop = -1, iDep = -1;
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).replace(/\r$/, "");
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      if (header === null) {
        header = parseCsvLine(line.replace(/^\uFEFF/, ""));
        iTrip = header.indexOf("trip_id");
        iStop = header.indexOf("stop_id");
        iDep = header.indexOf("departure_time");
        iSec = header.indexOf("stop_sequence");
        continue;
      }
      stRows++;
      const f = parseCsvLine(line);
      const stopId = f[iStop];
      stServedStops.add(stopId);
      if (aktivne.size) {
        const trip = trips.get(f[iTrip]);
        if (trip && aktivne.has(trip.serviceId)) stAktivniOdhodi++;
      }
      if (ciljna && stopId === ciljna.id) {
        const sec = hmsToSeconds(f[iDep]);
        if (Number.isFinite(sec)) odhodi.push({ sec, tripId: f[iTrip] });
      }
    }
  }
  buffer += decoder.decode();
}
const tStreamMs = Math.round(performance.now() - tStream);
console.log(`stop_times: ${stRows} vrstic (${(stSize / 1024 / 1024).toFixed(1)} MB) | postaj z odhodi: ${stServedStops.size} | odhodi aktivnih storitev za ${datum}: ${stAktivniOdhodi} | pretakanje: ${tStreamMs} ms`);

// ---------- 4. pokritost kanona (74 destinacij) ----------
console.log(`\n# Pokritost kanonskih destinacij (${DESTINATIONS.length})`);
let pok1 = 0, pok2 = 0;
const vrstice: string[] = [];
for (const d of DESTINATIONS) {
  const c = (d as unknown as { coords?: { lat: number; lng: number } }).coords;
  if (!c) { vrstice.push(`  ${d.slug}: BREZ KOORDINAT (preskočeno)`); continue; }
  let najb: { s: Stop; km: number } | null = null;
  let n1 = 0, n2 = 0;
  for (const s of stops) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
    const km = haversineKm(c.lat, c.lng, s.lat, s.lon);
    if (km <= 1) n1++;
    if (km <= 2) n2++;
    if (!najb || km < najb.km) najb = { s, km };
  }
  if (n1) pok1++;
  if (n2) pok2++;
  if (najb) vrstice.push(`  ${d.slug}: najbližja "${najb.s.name}" ${najb.km.toFixed(2)} km | ≤1 km: ${n1} | ≤2 km: ${n2}`);
}
console.log(`pokritost ≤1 km: ${pok1}/${DESTINATIONS.length} | ≤2 km: ${pok2}/${DESTINATIONS.length}`);
for (const v of vrstice.filter((x) => !x.includes("≤1 km: 0"))) console.log(v);
const brez = vrstice.filter((x) => x.includes("≤1 km: 0") && !x.includes("BREZ"));
console.log(`brez postaje ≤1 km (${brez.length}): ${brez.map((x) => x.trim().split(":")[0]).join(", ")}`);

// ---------- 5. prototip odhodov ----------
if (ciljna && aktivne.size && odhodi.length) {
  const cas = casArg ?? ljParts("cas");
  const ref = hmsToSeconds(`${cas}:00`);
  const naprej = odhodi
    .filter((o) => aktivne.has(trips.get(o.tripId)?.serviceId ?? ""))
    .filter((o) => o.sec >= ref)
    .sort((a, b) => a.sec - b.sec)
    .slice(0, 8);
  console.log(`\n# Prototip odhodov — "${ciljna.name}" @ ${datum} ${cas} (naslednjih 8)`);
  for (const o of naprej) {
    const t = trips.get(o.tripId)!;
    const r = routes.get(t.routeId);
    const h = String(Math.floor(o.sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((o.sec % 3600) / 60)).padStart(2, "0");
    console.log(`  ${h}:${m}  linija ${r?.short || "?"} → ${t.headsign || "?"} (vožnja ${o.tripId.slice(0, 8)}…)`);
  }
  if (naprej.length < 8) console.log(`  (iskrenost: najdenih samo ${naprej.length} odhodov ≥ ${cas} na tej postaji za ${datum})`);
} else if (ciljna) {
  console.log(`\n# Prototip odhodov: preskočen (aktivnih storitev: ${aktivne.size}, odhodov ciljne postaje: ${odhodi.length})`);
}

// ---------- 6. opcijski SQLite prototip ----------
if (dbPath) {
  console.log(`\n# SQLite prototip → ${dbPath}`);
  const t0db = performance.now();
  rmSync(dbPath, { force: true });
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = MEMORY; PRAGMA synchronous = OFF;");
  db.exec("CREATE TABLE stops (stop_id TEXT PRIMARY KEY, name TEXT, lat REAL, lon REAL); CREATE TABLE stop_times (stop_id TEXT, seconds INTEGER, trip_id TEXT, seq INTEGER);");
  const ins = db.prepare("INSERT INTO stops VALUES (?, ?, ?, ?)");
  db.exec("BEGIN");
  for (const s of stops) ins.run(s.id, s.name, s.lat, s.lon);
  db.exec("COMMIT");
  const insSt = db.prepare("INSERT INTO stop_times VALUES (?, ?, ?, ?)");
  const tSt = performance.now();
  db.exec("BEGIN");
  {
    const stream = Bun.file(stPath).stream();
    const decoder = new TextDecoder();
    let buffer = "";
    let header: string[] | null = null;
    let iS = -1, iD = -1, iT = -1, iQ = -1;
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        if (header === null) {
          header = parseCsvLine(line.replace(/^\uFEFF/, ""));
          iS = header.indexOf("stop_id"); iD = header.indexOf("departure_time"); iT = header.indexOf("trip_id"); iQ = header.indexOf("stop_sequence");
          continue;
        }
        const f = parseCsvLine(line);
        const sec = hmsToSeconds(f[iD]);
        if (Number.isFinite(sec)) insSt.run(f[iS], sec, f[iT], Number(f[iQ]) || 0);
      }
    }
  }
  db.exec("COMMIT");
  const tStMs = Math.round(performance.now() - tSt);
  const tIx = performance.now();
  db.exec("CREATE INDEX idx_st_stop ON stop_times (stop_id, seconds);");
  const tIxMs = Math.round(performance.now() - tIx);
  const tQ = performance.now();
  const ref = hmsToSeconds(`${casArg ?? ljParts("cas")}:00`);
  const q = db.prepare("SELECT seconds, trip_id FROM stop_times WHERE stop_id = ? AND seconds >= ? ORDER BY seconds LIMIT 8");
  if (!ciljna) {
    console.log("iskrenost: ciljna postaja ne obstaja — SQLite poizvedba preskočena");
    db.close();
  } else {
  const qRes = q.all(ciljna.id, ref) as { seconds: number; trip_id: string }[];
  const qMs2 = (() => { const a = performance.now(); q.all(ciljna.id, ref); return Math.round(performance.now() - a); })();
  const qMs = Math.round(performance.now() - tQ);
  const cnt = db.prepare("SELECT COUNT(*) c FROM stop_times").get() as { c: number };
  db.close();
  const dbMb = (statSync(dbPath).size / 1024 / 1024).toFixed(1);
  console.log(`uvoz: ${cnt.c} vrstic v ${tStMs} ms | indeks: ${tIxMs} ms | baza: ${dbMb} MB | skupaj (baza+indeks): ${Math.round(performance.now() - t0db)} ms`);
  console.log(`poizvedba (naslednjih 8 na "${ciljna.name}"): ${qMs} ms (prvi) / ${qMs2} ms (ponovitev) | zadetkov: ${qRes.length}`);
  }
}

console.log(`\n# skupni čas meritve: ${Math.round(performance.now() - t0)} ms`);
