/**
 * MOBILNI E2E PAKET (issue #38 P2 — 2.46.0):
 * „Pri širinah 320, 375, 390, 768 in 1440 px preveri vodoravni preliv,
 * prekrivanje kontrol in uporabnost zemljevida.“
 *
 * Ročna brskalniška preverba iz 2.44.0 (24/24 kombinacij brez vodoravnega
 * preliva) je zdaj STALNO avtomatizirana: projekt `chromium-mobile`
 * (Pixel 7 — dotik, mobilni UA) teče izključno proti tej datoteki
 * (glej playwright.config.ts — ločitev projektov), zato se zlata pot
 * na namiznem Chromiumu ne podvaja.
 *
 * Pokritje:
 * ① VODORAVNI PRELIV: 5 ključnih strani × 5 širin (320/375/390/768/1440)
 *   — document.scrollingElement.scrollWidth ≤ clientWidth (+1 px toleranca).
 * ② MOBILNI MENI: „Odpri meni“ → list viden → Escape zapre → navigacija
 *   prek menijske povezave („Načrtuj“) z uničenjem lista.
 * ③ DOTIK (zlata pot, skrajšana): /destinacije → iskanje Bled →
 *   „Dodaj v mojo pot“ → /moja-potovanja prikaže Bled — ista obljuba
 *   kot na namiznem, z dotikom (hasTouch).
 * ④ ZEMLJEVID UPORABEN: /zemljevid na mobilnem — Leaflet vsebnik, zoom
 *   kontrola in OSM atribucija so vidni in dostopni.
 *
 * Izolacija: svež kontekst na test (prazen localStorage — isti vzorec
 * kot golden-path.e2e.ts).
 */
import { expect, test, type Page } from "@playwright/test";

/** Širine iz merila sprejemanja #38 P2 (mobilni + tablet + namizni). */
const SIRINE = [320, 375, 390, 768, 1440] as const;

/** Ključne strani (domov, odkrij, načrtuj, dogodki, moja potovanja). */
const STRANI = ["/", "/destinacije", "/nacrtuj", "/dogodki", "/moja-potovanja"];

async function clearAppState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      if (window.localStorage.getItem("dai:e2e-seen") === "1") return;
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("dai:")) window.localStorage.removeItem(key);
      }
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith("dai:")) window.sessionStorage.removeItem(key);
      }
      window.localStorage.setItem("dai:e2e-seen", "1");
    } catch {
      /* shramba nedosegljiva — ničesar ne počistimo */
    }
  });
}

test.beforeEach(async ({ page }) => {
  await clearAppState(page);
});

// ── ① — vodoravni preliv: 5 strani × 5 širin ─────────────────────────────

// EN TEST NA ŠIRINO: vsaka širina dobi SVEŽ kontekst (nov tab) — akumulacija
// rendererjevega pomnilnika čez 25 navigacij v enem tab-u je v vsebniškem
// okolju sesula Chromium („Page crashed“); z svežim tab-om na širino je
// obremenitev po celicah (meritve iz peskovnika 2026-10-13).

for (const sirina of SIRINE) {
  test(`① brez vodoravnega preliva @ ${sirina}px: 5 ključnih strani`, async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: sirina, height: 800 });
    for (const stran of STRANI) {
      await page.goto(stran);
      const preliv = await page.evaluate(() => {
        const el = document.scrollingElement;
        return el ? el.scrollWidth - el.clientWidth : 0;
      });
      expect(
        preliv,
        `${stran} @ ${sirina}px: vodoravni preliv ${preliv}px`
      ).toBeLessThanOrEqual(1);
    }
  });
}

// ── ② — mobilni meni: odpri → Escape → navigacija ────────────────────────

test("② mobilni meni: odpri, Escape zapre, navigacija prek menija", async ({
  page,
}) => {
  test.setTimeout(60_000);

  await page.goto("/");
  const meniGumb = page.getByRole("button", { name: "Odpri meni" });
  await expect(meniGumb).toBeVisible();

  // odpri list
  await meniGumb.click();
  const list = page.getByRole("dialog");
  await expect(list).toBeVisible();

  // Escape zapre (P2 preverba: vidni fokus + Escape)
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();

  // navigacija prek menija z uničenjem lista (klik na povezavo)
  await meniGumb.click();
  await expect(list).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobilni meni" })
    .getByRole("link", { name: "Načrtuj" })
    .click();
  await expect(page).toHaveURL(/\/nacrtuj/);
});

// ── ③ — zlata pot na dotiku (skrajšana) ──────────────────────────────────

test("③ dotik: iskanje Bled → Dodaj v mojo pot → /moja-potovanja", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.goto("/destinacije");
  await page.getByLabel(/Išči/i).fill("Bled");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Gorenjska" }).click();

  const bledKartica = page.getByRole("link", { name: /Bled/ }).first();
  await expect(bledKartica).toBeVisible();
  await bledKartica.click();
  await expect(page).toHaveURL(/\/destinacija\/bled/);

  const dodajGumb = page.getByRole("button", { name: "Dodaj v mojo pot" });
  await expect(dodajGumb).toBeVisible();
  await dodajGumb.click();
  await expect(
    page.getByRole("button", { name: "V mojo pot ✓" })
  ).toBeVisible();

  await page.goto("/moja-potovanja");
  await expect(page.getByText("Bled").first()).toBeVisible();
});

// ── ④ — zemljevid uporaben na mobilnem ───────────────────────────────────

test("④ zemljevid: Leaflet vsebnik + zoom + OSM atribucija @ 390 px", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zemljevid");

  const vsebnik = page.locator(".leaflet-container").first();
  await expect(vsebnik).toBeVisible({ timeout: 30_000 });

  // zoom kontrola — uporabnost zemljevida brez tipkovnice
  const zoom = page.locator(".leaflet-control-zoom").first();
  await expect(zoom).toBeVisible();

  // avtorske pravice (OpenStreetMap) — obvezna atribucija pod zemljevidom
  const atribucija = page.locator(".leaflet-control-attribution").first();
  await expect(atribucija).toBeVisible();
  await expect(atribucija).toContainText("OpenStreetMap");
});
