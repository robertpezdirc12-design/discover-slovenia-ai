/**
 * PRODUCTION SMOKE — varen dim (P0-I, issue #1 §24 „safe production smoke";
 * P0-J ga povezuje v CI vrata).
 * ============================================================================
 * Kanoni:
 *  - SAMO BRANJE: izključno GET zahtevki — nobenega POST/PUT/DELETE, nič
 *    ne piše v bazo (naročila/izdelki/audit ostanejo nedotaknjeni);
 *  - VARNOSTNI NEGATIVNI PREVERI: cron poti MORAJO biti 401 brez žetona
 *    (fail-closed dokaz — če bi kdaj odprle, dim pade);
 *  - ISKRENOST: vsak padec se izpiše z razlogom (status/markiranje);
 *    nic se ne „zeleni" na pamet;
 *  - ZAGON: `bun run smoke` (privzeto BASE_URL=http://localhost:3000,
 *    preglasi z env SMOKE_BASE_URL).
 *
 * Izhod: vrstično PASS/FAIL + povzetek; izhodna koda 0 = vse zeleno,
 * 1 = vsaj en padec (CI-ljivo).
 *
 * P0-J ARTEFAKT: če je nastavljen env SMOKE_REPORT (pot datoteke), dim
 * ob zaključku zapiše strojno berljivo JSON poročilo {baseUrl, version,
 * generatedAt, passed, total, results[]} na to pot — CI ga shrani kot
 * artefakt (GitLab .gitlab-ci.yml / GitHub Actions upload-artifact).
 */

const BASE_URL = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);
const TIMEOUT_MS = 10_000;

/** Pričakovana verzija — iz package.json (en vir resnice). */
async function expectedVersion(): Promise<string> {
  const pkg = await Bun.file("package.json").json();
  return String(pkg.version);
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function fetchOk(
  path: string,
  init?: { redirect?: "manual" | "follow" }
): Promise<{ status: number; location: string | null; body: string }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    redirect: init?.redirect ?? "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": "dsa-smoke/1.0 (+production smoke)" },
  });
  const location = res.headers.get("location");
  const body = await res.text();
  return { status: res.status, location, body };
}

// ── Preverbe ───────────────────────────────────────────────────────────────

async function checkPages(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const pages: { name: string; path: string; marker?: string }[] = [
    { name: "domaca-stran", path: "/", marker: "Discover Slovenia" },
    { name: "destinacije", path: "/destinacije" },
    { name: "destinacija-bled", path: "/destinacija/bled" },
    { name: "trznica", path: "/trznica" },
    { name: "zemljevid", path: "/zemljevid" },
    { name: "na-poti", path: "/na-poti" },
    { name: "konzultacija", path: "/konzultacija" },
    { name: "za-ponudnike", path: "/za-ponudnike" },
    { name: "sw-js", path: "/sw.js" },
  ];
  for (const page of pages) {
    try {
      const { status, body } = await fetchOk(page.path);
      const markerOk = page.marker ? body.includes(page.marker) : true;
      out.push({
        name: `page:${page.name}`,
        ok: status === 200 && markerOk,
        detail:
          status === 200
            ? markerOk
              ? "200 + marker"
              : `200, a marker „${page.marker}" manjka v telesu`
            : `status ${status}`,
      });
    } catch (err) {
      out.push({
        name: `page:${page.name}`,
        ok: false,
        detail: `napaka omrežja: ${err instanceof Error ? err.message : "neznana"}`,
      });
    }
  }
  return out;
}

async function checkHealth(version: string): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  try {
    const { status, body } = await fetchOk("/api/health");
    let parsed: { status?: string; version?: string; startup?: unknown[] } = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      // neveljaven JSON se izpiše spodaj
    }
    const checks = Array.isArray(parsed.startup) ? parsed.startup.length : 0;
    out.push({
      name: "api:health-status",
      ok: status === 200 && parsed.status === "ok",
      detail: `status ${status}, reported "${parsed.status ?? "?"}"`,
    });
    out.push({
      name: "api:health-version",
      ok: status === 200 && parsed.version === version,
      detail: `prijavljena ${parsed.version ?? "?"} ≡ package.json ${version}`,
    });
    out.push({
      name: "api:health-checks",
      ok: checks >= 8,
      detail: `${checks} startup preverb (pričakovano ≥ 8)`,
    });
  } catch (err) {
    out.push({
      name: "api:health",
      ok: false,
      detail: `napaka omrežja: ${err instanceof Error ? err.message : "neznana"}`,
    });
  }
  return out;
}

async function checkDestinationsApi(): Promise<CheckResult[]> {
  try {
    const { status, body } = await fetchOk("/api/destinations");
    let total: number | null = null;
    try {
      total = (JSON.parse(body) as { total?: number }).total ?? null;
    } catch {
      // neveljaven JSON
    }
    return [
      {
        name: "api:destinations",
        ok: status === 200 && total !== null && total >= 38,
        detail: `status ${status}, total ${total ?? "?"} (register 38)`,
      },
    ];
  } catch (err) {
    return [
      {
        name: "api:destinations",
        ok: false,
        detail: `napaka omrežja: ${err instanceof Error ? err.message : "neznana"}`,
      },
    ];
  }
}

async function checkGoRedirects(): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  try {
    const res = await fetchOk("/api/affiliate/go?provider=getyourguide", {
      redirect: "manual",
    });
    out.push({
      name: "go:znan-partner-302",
      ok: [301, 302, 307, 308].includes(res.status) && !!res.location,
      detail: `status ${res.status} → ${res.location ? "Location prisoten" : "BREZ Location"}`,
    });
  } catch (err) {
    out.push({
      name: "go:znan-partner-302",
      ok: false,
      detail: `napaka omrežja: ${err instanceof Error ? err.message : "neznana"}`,
    });
  }
  try {
    const res = await fetchOk("/api/affiliate/go?provider=neznani-partner");
    out.push({
      name: "go:neznan-partner-400",
      ok: res.status === 400,
      detail: `status ${res.status} (pričakovano 400 — fail-closed)`,
    });
  } catch (err) {
    out.push({
      name: "go:neznan-partner-400",
      ok: false,
      detail: `napaka omrežja: ${err instanceof Error ? err.message : "neznana"}`,
    });
  }
  return out;
}

/** VARNOSTNI NEGATIVNI DIM: brez žetona MORA vsak cron odkloniti (401). */
async function checkCronFailClosed(): Promise<CheckResult[]> {
  const paths = [
    "/api/cron/sto-reingest",
    "/api/cron/kiwitaxi-reingest",
    "/api/cron/recalculate-status",
    "/api/cron/draft-reminders",
  ];
  const out: CheckResult[] = [];
  for (const path of paths) {
    try {
      const { status } = await fetchOk(path);
      out.push({
        name: `cron-fail-closed:${path.replace("/api/cron/", "")}`,
        ok: status === 401,
        detail: `brez žetona → ${status} (pričakovano 401 fail-closed)`,
      });
    } catch (err) {
      out.push({
        name: `cron-fail-closed:${path.replace("/api/cron/", "")}`,
        ok: false,
        detail: `napaka omrežja: ${err instanceof Error ? err.message : "neznana"}`,
      });
    }
  }
  return out;
}

// ── Zagon ──────────────────────────────────────────────────────────────────

const version = await expectedVersion();
console.log(`dsa-smoke → ${BASE_URL} (prikakovana verzija ${version})\n`);

const results: CheckResult[] = [
  ...(await checkPages()),
  ...(await checkHealth(version)),
  ...(await checkDestinationsApi()),
  ...(await checkGoRedirects()),
  ...(await checkCronFailClosed()),
];

let passed = 0;
for (const r of results) {
  const tag = r.ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${r.name} — ${r.detail}`);
  if (r.ok) passed += 1;
}

console.log(
  `\nPovzetek: ${passed}/${results.length} preverb je zelenih — ` +
    (passed === results.length
      ? "produkcija je zdrava (samo-bralni dim)."
      : "PROIZVODNJA NI ZDRAVA — glej FAIL vrstice zgoraj.")
);

// ── P0-J: strojno berljivo poročilo (CI artefakt) ──────────────────────────
// SMOKE_REPORT=pot/datoteke.json — poročilo se zapiše NEODVISNO od izida
// (iskrenost: tudi padec je artefakt; izhodna koda ostaja 0/1).
const reportPath = process.env.SMOKE_REPORT;
if (reportPath) {
  const report = {
    baseUrl: BASE_URL,
    expectedVersion: version,
    generatedAt: new Date().toISOString(),
    passed,
    total: results.length,
    ok: passed === results.length,
    results: results.map((r) => ({ ...r, ok: r.ok })),
  };
  const { dirname } = await import("node:path");
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Poročilo (artefakt): ${reportPath}`);
}

if (passed !== results.length) {
  process.exit(1);
}
export {}; // modul (top-level await)
