/**
 * PLAYWRIGHT E2E — zlata pot uporabnika (issue #38, P1 ponovljivost,
 * 2.45.0) + MOBILNI PROJEKT (2.46.0, issue #38 P2 — „Pri širinah 320,
 * 375, 390, 768 in 1440 px preveri vodoravni preliv, prekrivanje kontrol
 * in uporabnost zemljevida“): ročna 24/24 preverba (2.44.0) je zdaj
 * avtomatizirana kot stalni mobilni projekt (Pixel 7 — dotik, mobilni
 * UA, 412×915; testi znotraj preklapljajo širine 320/375/390).
 *
 * /destinacije → iskanje Bled → filter Gorenjska → filter Jezero
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
 * ZAGON: `bun run e2e` (obe projekta: desktop zlata pot + mobilni
 * paket) ali `bun run e2e:mobile` (samo mobilni projekt). Strežnik
 * webServer sam zažene `next dev` na vratih 3100 (reuseExistingServer
 * za lokalni razvoj); potrebna je prej zagnana `bun run db:generate` +
 * `bun run db:push`. V CI je reuse izklopljen (vedno svež strežnik).
 *
 * LOČITEV PROJEKTOV: desktop teče ZA VSAKO testno datoteko RAZEN
 * e2e/mobile.e2e.ts (testIgnore); mobilni projekt teče SAMO
 * e2e/mobile.e2e.ts (testMatch) — zlata pot se ne podvaja in ne
 * podvaja runtime-a. Globova past: za testMatch/testIgnore velja vzorec
 * „dve zvezdici, poševnica, mobile.e2e.ts“ — vzorec s predpono zvezdico
 * pred „.mobile“ bi zahteval ime datoteke tipa „ime.mobile.e2e.ts“ in
 * NE bi ujel „mobile.e2e.ts“ (vzorci so testirani: niz z dodano
 * predpono ujame 0 datotek).
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
    // Vsebniško okolje: majhen /dev/shm sesuje Chromium tab („Page
    // crashed“ ob živem next dev) — klasičen popavek za Docker/sandbox.
    launchOptions: { args: ["--disable-dev-shm-usage"] },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testIgnore: "**/mobile.e2e.ts",
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: "**/mobile.e2e.ts",
    },
  ],
  webServer: {
    command: `bunx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
