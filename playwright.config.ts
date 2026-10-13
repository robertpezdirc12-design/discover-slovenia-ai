/**
 * PLAYWRIGHT E2E — zlata pot uporabnika (issue #38, P1 ponovljivost,
 * 2.45.0): /destinacije → iskanje Bled → filter Gorenjska → filter Jezero
 * → Bled → „Dodaj v mojo pot“ → /moja-potovanja → prednastavitev na
 * /nacrtuj → sestavi načrt → „Shrani v Mojo pot“ → /potovanje +
 * /moja-potovanja → „Zaženi na poti“ → aktivna pot v /na-poti →
 * „Opravljeno“ → napredek/naslednji postanek → preskok postanka →
 * osvežitev → zaključek potovanja.
 *
 * IZOLACIJA (zahteva #38): vsak test dobi svež brskalniški kontekst
 * (Playwright privzeto) — localStorage/cookies so prazni, „začasno
 * stanje“ se konča s testom (kontekst se zapre). Pred vsakim testom
 * izrecno očistimo localStorage (dai:* ključi), da je izolacija
 * eksplicitna tudi ob reuse-u strežnika.
 *
 * ZAGON: `bun run e2e` (glej package.json). Strežnik webServer sam
 * zažene `next dev` na vratih 3100 (reuseExistingServer za lokalni
 * razvoj); potrebna je prej zagnana `bun run db:generate` + `bun run db:push`.
 * V CI je reuse izklopljen (vedno svež strežnik).
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "sl-SI",
    timezoneId: "Europe/Ljubljana",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `bunx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
