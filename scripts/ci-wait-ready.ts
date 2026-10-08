/**
 * CI-WAIT-READY (P0-J) — pripravljenost produkcijskega strežnika za dim.
 * ============================================================================
 * Kanoni:
 *  - SAMO BRANJE: en sam GET na /api/health, nič drugega;
 *  - ISKRENOST: do 30 poskusov (1 s apart); če strežnik ne vstane,
 *    izpiše razlog in KONČA z izhodno kodo 1 — CI vrata padejo
 *    (ne čakajo v zeleno do nedogled);
 *  - NO CURL: teče na bun povsod (GitLab oven/bun slika + GitHub Actions),
 *    zato je odvisnost samo runtime, ne sistemska orodja.
 *
 * ZAGON: `bun scripts/ci-wait-ready.ts`
 * Env: SMOKE_BASE_URL (privzeto http://localhost:3100 — isti privzetek
 * kot produkcijska vrata, preglasil je bil nastavljen ob zagonu strežnika).
 */

const BASE_URL = (process.env.SMOKE_BASE_URL ?? "http://localhost:3100").replace(
  /\/+$/,
  ""
);
const ATTEMPTS = 30;
const STEP_MS = 1_000;
const REQUEST_TIMEOUT_MS = 2_000;

for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "user-agent": "dsa-ci-wait-ready/1.0" },
    });
    if (res.ok) {
      console.log(
        `Strežnik pripravljen: GET ${BASE_URL}/api/health → ${res.status} (${attempt}. poskus)`
      );
      process.exit(0);
    }
    console.log(
      `Poskus ${attempt}/${ATTEMPTS}: /api/health → ${res.status} (ni še ok)`
    );
  } catch (err) {
    console.log(
      `Poskus ${attempt}/${ATTEMPTS}: povezava še ni vzpostavljena (${
        err instanceof Error ? err.message.split("\n")[0] : "neznana"
      })`
    );
  }
  if (attempt < ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, STEP_MS));
  }
}

console.error(
  `Strežnik na ${BASE_URL} se v ${ATTEMPTS} s ni odzval — preveri reports/server.log`
);
process.exit(1);
export {}; // modul (top-level await)
