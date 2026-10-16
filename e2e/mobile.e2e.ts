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
 * ⑤ DRŽAVNA STRAN (#41 F3, 2.57.0): /drzava/BA × 5 širin — hero viden,
 *   brez vodoravnega preliva (pravilo: vsaka nova državna stran mora
 *   opraviti 5-prelomni suite).
 * ⑥ VSEH 10 DRŽAV (#41 F3): /drzava/[code] @ 375 px — hero + preliv.
 *
 * Izolacija: svež kontekst na test (prazen localStorage — isti vzorec
 * kot golden-path.e2e.ts).
 */
import { expect, test, type Page } from "@playwright/test";
import { gotoTrdo, ustaliSe } from "./nav";

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
      await gotoTrdo(page, stran);
      if (stran === "/") {
        await expect(page.getByTestId("featured-destination-panel")).toBeVisible();
      }
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

  await gotoTrdo(page, "/");
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

  await gotoTrdo(page, "/destinacije");
  await page.getByLabel(/Išči/i).fill("Bled");
  await ustaliSe(page); // debounce/soft-nav po iskanju se ne sme tekmovati s klikom
  await page.locator("#dest-region").click(); // #41 F0: ID, ne vrstni red (državni filter je zdaj prvi)
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

  await gotoTrdo(page, "/moja-potovanja");
  await expect(page.getByText("Bled").first()).toBeVisible();
});

// ── ④ — zemljevid uporaben na mobilnem ───────────────────────────────────

test("④ zemljevid: Leaflet vsebnik + zoom + OSM atribucija @ 390 px", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoTrdo(page, "/zemljevid");

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

// ── ⑤ — vektorski MapLibre: mobilni prelomni paket ──────────────────────
// Testira prototip ločeno od privzetega Leafleta. To je namerni gate pred
// kakršnimkoli preklopom privzete karte; produkcijskih nastavitev ne spreminja.
test("⑤ MapLibre: zemljevid, kontrola povečave in atribucija na 5 širinah", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const sirina of SIRINE) {
    await page.setViewportSize({ width: sirina, height: 844 });
    await gotoTrdo(page, "/zemljevid?zemljevid=vektorji");

    await expect(page.locator("[data-poc-banner]")).toBeVisible();
    await expect(page.locator(".maplibregl-canvas").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator(".maplibregl-ctrl-zoom-in").first()).toBeVisible();

    const attribution = page.locator(".maplibregl-ctrl-attrib").first();
    await expect(attribution).toBeVisible();
    // Na ozkih zaslonih je atribucija lahko strnjena v gumb; razširimo jo,
    // da preverimo dejansko besedilo in ne zgolj prisotnost kontrolnika.
    const attributionText = await attribution.innerText();
    if (!attributionText.includes("OpenFreeMap")) {
      const attributionButton = attribution.locator(".maplibregl-ctrl-attrib-button");
      if (await attributionButton.isVisible().catch(() => false)) {
        await attributionButton.click();
      }
    }
    await expect(attribution).toContainText("OpenFreeMap");
    await expect(attribution).toContainText("OpenStreetMap");

    const horizontalOverflow = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    expect(
      horizontalOverflow,
      `MapLibre @ ${sirina}px: vodoravni preliv ${horizontalOverflow}px`,
    ).toBeLessThanOrEqual(1);
  }

  expect(pageErrors, "JavaScript napake na mobilnem MapLibre").toEqual([]);
});

test("⑥ MapLibre: destinacijo je mogoče izbrati in dodati v mojo pot", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoTrdo(page, "/zemljevid?zemljevid=vektorji");

  const marker = page.locator('[data-destination-slug="bled"]');
  await expect(marker).toBeVisible({ timeout: 30_000 });
  const target = await marker.boundingBox();
  expect(target, "Bled marker mora imeti merljivo površino dotika").not.toBeNull();
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);

  await marker.click();
  const popup = page.locator(".maplibregl-popup").first();
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("Bled");

  const add = popup.getByRole("button", { name: "Dodaj v mojo pot", exact: true });
  await expect(add).toBeVisible();
  await add.click();
  await expect(add).toHaveText("V moji poti");
  await expect(add).toBeDisabled();

  const saved = await page.evaluate(() => {
    const raw = window.localStorage.getItem("dai:my-trip");
    const items = raw ? JSON.parse(raw) as Array<{ refId?: string }> : [];
    return items.some((item) => item.refId === "bled");
  });
  expect(saved).toBe(true);
});

test("⑦ MapLibre: iskanje, filtri in seznam delujejo na telefonu", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoTrdo(page, "/zemljevid?zemljevid=vektorji");

  await expect(page.locator('[data-destination-slug="bled"]')).toBeVisible({
    timeout: 30_000,
  });
  const search = page.getByRole("searchbox", {
    name: "Išči destinacijo, opis ali zanimivost",
  });
  await search.fill("Bled");
  await expect(page.getByText(/^1 destinacij$/)).toBeVisible();
  await expect(page.locator('[data-destination-slug="bled"]')).toBeVisible();

  await page.getByRole("button", { name: "Seznam", exact: true }).click();
  const list = page.locator('section[aria-label="Seznam"]');
  await expect(list).toBeVisible();
  await expect(list).toContainText("Bled");

  const bledItem = list.locator("li").filter({
    has: list.getByRole("button", { name: "Bled", exact: true }),
  }).first();
  const add = bledItem.getByRole("button", {
    name: "Dodaj v mojo pot",
    exact: true,
  });
  await expect(add).toBeVisible();
  await add.click();
  await expect(add).toHaveText("V moji poti");
  await expect(add).toBeDisabled();

  const saved = await page.evaluate(() => {
    const raw = window.localStorage.getItem("dai:my-trip");
    const items = raw ? JSON.parse(raw) as Array<{ refId?: string }> : [];
    return items.some((item) => item.refId === "bled");
  });
  expect(saved).toBe(true);

  await page.getByRole("button", { name: "Zemljevid", exact: true }).click();
  await expect(page.locator('[data-destination-slug="bled"]')).toBeVisible();
});

// ── ⑧ — državna landing stran brez vodoravnega preliva (#41 F3) ──────────
// Pravilo #41: „E2E mobilni prelomi: vsaka nova državna stran mora
// opraviti 5-prelomni suite." BA = prva F3 landing stran z vso vsebino
// (destinacije + dogodki + lokali) — en test na širino (svež tab).

for (const sirina of SIRINE) {
  test(`⑤ državna stran /drzava/BA brez vodoravnega preliva @ ${sirina}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.setViewportSize({ width: sirina, height: 800 });
    await gotoTrdo(page, "/drzava/BA");

    // hero: zastava + ime države v aktivnem jeziku
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const preliv = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    expect(
      preliv,
      `/drzava/BA @ ${sirina}px: vodoravni preliv ${preliv}px`
    ).toBeLessThanOrEqual(1);
  });
}

// ── ⑥ — vseh 10 državnih strani uporabnih na mobilnem (@375) ─────────────

test("⑧ /drzava/[code]: vseh 10 držav brez preliva + hero @ 375 px", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.setViewportSize({ width: 375, height: 800 });
  const KODE = ["SI", "HR", "ME", "AL", "BA", "RS", "MK", "XK", "BG", "GR"];
  for (const kod of KODE) {
    await gotoTrdo(page, `/drzava/${kod}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const preliv = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    expect(
      preliv,
      `/drzava/${kod} @ 375px: vodoravni preliv ${preliv}px`
    ).toBeLessThanOrEqual(1);
  }
});
