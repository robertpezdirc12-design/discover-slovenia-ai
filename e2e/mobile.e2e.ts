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
 * ⑩ GRUČENJE (PR #62): gostita destinaciji Bled in Vintgarska soteska
 *   sta pri privzeti povečavi v gruči (44-px cilja bi se prekrivala) in
 *   po tapu gruče posamezno izberljivi — brez iskanja in brez ročnega
 *   povečanja (sprejemni test odprave prekrivanja).
 * ⑪ SEZNAM → destinacija v gruči: klik imena v seznamu odpre popup
 *   (showDestination razpre gručo s poletom, popup po moveend).
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
    // Počakaj na dogodek load in dejansko zgrajene markerje, ne zgolj canvas.
    // Pri privzetem pogledu (vseh 74) je Bled v gruči (prekrivanje 44-px
    // ciljev, PR #62) — prisoten marker + vidna gruča z njegovim imenom
    // dokažeta gradnjo markerjev IN aktivno gručenje na vseh 5 širinah:
    await expect(page.locator('[data-destination-slug="bled"]')).toHaveCount(1, {
      timeout: 30_000,
    });
    await expect(
      page.locator('[data-cluster][aria-label*="Bled"]').first(),
    ).toBeVisible({ timeout: 30_000 });
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

  // Postojnska jama: edinstven iskalni zadetek (q="Postojnska"), ~38 km od
  // najbližje destinacije — pri flyTo na zoom 11 se 44-px dotikana območja
  // NE prekrivajo (invarianta: tests/map-clustering.test.ts ⑪).
  // Pri privzetem pogledu je destinacija v gruči (prekrivanje 44-px ciljev
  // pri zoom ≤ 8, PR #62) — zato preverba markerja ŠELE po iskanju, ko je
  // kamerna povečava loči ostale. (Klikniti „Bled“ pri privzetem pogledu
  // sicer ne gre — njegov cilj je v gruči; glej test ⑩ za gručni pot.)
  const iskanje = page.getByRole("searchbox", {
    name: "Išči destinacijo, opis ali zanimivost",
  });
  await iskanje.fill("Postojnska");
  await expect(page.getByText(/^1 destinacij$/)).toBeVisible();

  const marker = page.locator('[data-destination-slug="postojnska-jama"]');
  await expect(marker).toBeVisible({ timeout: 30_000 });
  const target = await marker.boundingBox();
  expect(target, "Marker mora imeti merljivo površino dotika").not.toBeNull();
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);

  // Sredina platna je na 390×844 pod zavihki fiksnega mobilnega nav
  // trakom — premaknimo stran, da je marker nad njim in klikljiv.
  await page.evaluate(() => window.scrollBy({ top: 280, behavior: "instant" }));

  await marker.click();
  const popup = page.locator(".maplibregl-popup").first();
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("Postojnska jama");

  const add = popup.getByRole("button", { name: "Dodaj v mojo pot", exact: true });
  await expect(add).toBeVisible();
  await add.click();
  // Gumb po dodajanju SPREMENI besedilo („V moji poti“) in se onemogoči —
  // lokator po starem imenu zato ne ujame več; znova lociraj po novem.
  const dodano = popup.getByRole("button", { name: "V moji poti" });
  await expect(dodano).toBeVisible();
  await expect(dodano).toBeDisabled();

  const saved = await page.evaluate(() => {
    const raw = window.localStorage.getItem("dai:my-trip");
    const items = raw ? JSON.parse(raw) as Array<{ refId?: string }> : [];
    return items.some((item) => item.refId === "postojnska-jama");
  });
  expect(saved).toBe(true);
});

test("⑦ MapLibre: iskanje, filtri in seznam delujejo na telefonu", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoTrdo(page, "/zemljevid?zemljevid=vektorji");

  // Pri privzetem pogledu (vseh 74) je Bled v gruči (prekrivanje 44-px
  // ciljev, PR #62) — vidna gruča z njegovim imenom dokazuje naložen markerje:
  await expect(
    page.locator('[data-cluster][aria-label*="Bled"]').first(),
  ).toBeVisible({ timeout: 30_000 });
  const search = page.getByRole("searchbox", {
    name: "Išči destinacijo, opis ali zanimivost",
  });
  await search.fill("Bled");
  // Kanon filtra (src/lib/destinations-filter.ts, zaklenjen z enotskimi
  // testi): iskanje pokrije name/tagline/description/highlights. „Bled“
  // torej najde Bled in Vintgarsko sotesko (opis omenja Bled) — 2 zadetka.
  await expect(page.getByText(/^2 destinacij$/)).toBeVisible();
  // 2 gosti zadetka (Bled + Vintgarska soteska) ostajata v gruči — tap
  // gruče ju loči (obnašanje zaklenjeno s sprejemnim testom ⑩):
  await page.locator('[data-cluster][aria-label*="Bled"]').first().click();
  await expect(page.locator('[data-destination-slug="bled"]')).toBeVisible();

  await page.getByRole("button", { name: "Seznam", exact: true }).click();
  const list = page.locator('section[aria-label="Seznam"]');
  await expect(list).toBeVisible();
  await expect(list).toContainText("Bled");

  const bledItem = list.locator("li").first();
  await expect(bledItem).toContainText("Bled");
  const add = bledItem.getByRole("button", {
    name: "Dodaj v mojo pot",
    exact: true,
  });
  await expect(add).toBeVisible();
  await add.click();
  // Gumb po dodajanju spremeni besedilo v „V moji poti“ in se onemogoči —
  // lokator po starem imenu ne ujame več; znova lociraj po novem imenu.
  const dodano = bledItem.getByRole("button", { name: "V moji poti" });
  await expect(dodano).toBeVisible();
  await expect(dodano).toBeDisabled();

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
  test(`⑧ državna stran /drzava/BA brez vodoravnega preliva @ ${sirina}px`, async ({
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

// ── ⑨ — vseh 10 državnih strani uporabnih na mobilnem (@375) ─────────────

test("⑨ /drzava/[code]: vseh 10 držav brez preliva + hero @ 375 px", async ({
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

// ── ⑩ — gručenje: Bled in Vintgarska soteska izberljiva posamezno ────────
// SPREJEMNI TEST PR #62 (pripomba lastnika): pri gostih destinacijah se
// 44-px dotikalna cilja prekrivata (Bled ↔ Vintgar je ~18,6 px narazen
// pri zoom 8) in dotik lahko izbere napačno destinacijo. Rešitev je
// gručenje (44-px ciljev NE zmanjšamo): markerja prekrivanja zlijeta v
// gručo, tap pa ju loči. Test poteka pri PRIVZETEM pogledu (problematična
// povečava) — brez iskanja in brez ročnega povečanja, torej NE obide
// težave, ki jo zaklepa.
test("⑩ MapLibre gručenje: Bled in Vintgarska soteska posamezno izberljiva (brez iskanja in ročnega zooma)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoTrdo(page, "/zemljevid?zemljevid=vektorji");

  const bled = page.locator('[data-destination-slug="bled"]');
  const vintgar = page.locator('[data-destination-slug="vintgarska-soteska"]');

  // Privzeti pogled: posamezna markerja sta SKRITA (v gruči) — dotik v
  // to območje ne more prestreči napačne destinacije:
  await expect(bled).toHaveCount(1, { timeout: 30_000 });
  await expect(bled).toBeHidden();
  await expect(vintgar).toBeHidden();

  // Gruča, ki vsebuje Bled, je vidna in ima vsaj 2 člana:
  const graca = page.locator('[data-cluster][aria-label*="Bled"]').first();
  await expect(graca).toBeVisible({ timeout: 30_000 });
  const stevec = await graca.getAttribute("data-cluster-count");
  expect(Number(stevec), "Gruča z Bledom mora imeti ≥ 2 člana").toBeGreaterThanOrEqual(2);

  // Privzeti pogled je fitBounds vseh 74 destinacij (Balkan) — Slovenija je
  // na severozahodnem robu platna, zato je gruča lahko IZVEN viewporta
  // (isti vzorec kot „Bled x=-125“ v diagnozi E2E ⑥). Pano s TIPKOVNICO
  // (dostopnostna pot MapLibre: puščice premaknejo kamero za ~100 px) premika
  // kamero BREZ spremembe povečave — gruče ostanejo enake, torej test še
  // vedno ne obide težave prekrivanja. (Enoprstni dotik-pan je pod
  // cooperativeGestures namenoma blokiran; miškin vlečenje pa v tem
  // postavitvi zanesljivo zaidelo pod fiksni mobilni nav trak.)
  await page.evaluate(() => window.scrollBy({ top: 280, behavior: "instant" }));
  // Fokus NA PLATNO (canvas ima tabindex="0"; spodnji kot platna pokriva
  // fiksni mobilni tab-bar, zato klik ni varen — programski fokus je):
  await page.evaluate(() => {
    (document.querySelector(".maplibregl-canvas") as HTMLElement | null)?.focus();
  });
  /** Je gruča znotraj klikljivega območja (viewport − fiksni nav trak)? */
  const jeKlikljiva = async (): Promise<boolean> => {
    const box = await graca.boundingBox().catch(() => null);
    const vp = page.viewportSize();
    if (!box || !vp) return false;
    const dno = vp.height - 120; // rezerva za fiksni mobilni nav trak
    return (
      box.x >= 8 &&
      box.y >= 8 &&
      box.x + box.width <= vp.width - 8 &&
      box.y + box.height <= dno
    );
  };
  for (let poskus = 0; poskus < 6; poskus++) {
    if (await jeKlikljiva()) break;
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(450);
  }
  await expect
    .poll(jeKlikljiva, "Gruča z Bledom mora biti po pano znotraj viewporta")
    .toBe(true);

  // Drill-down: vsak tap gruče razpre skupino (fitBounds VSEH članov z
  // omejitvijo ločitve) — mega gruča se razslopi v regionalne, te v
  // posamezne markerje. Ponavljamo, dokler Bled ni posamezno viden:
  for (let poskus = 0; poskus < 3; poskus++) {
    if (await bled.isVisible().catch(() => false)) break;
    const aktivna = page.locator('[data-cluster][aria-label*="Bled"]').first();
    await expect(aktivna).toBeVisible();
    await aktivna.click();
    await page.waitForTimeout(900); // fitBounds animacija + prerazporeditev gruč
  }
  await expect(bled).toBeVisible({ timeout: 20_000 });
  await expect(vintgar).toBeVisible();

  // INVARIANTA PR #62: po razpetju se 44-px cilja NE smeta prekrivati.
  const bledBox = await bled.boundingBox();
  const vintgarBox = await vintgar.boundingBox();
  expect(bledBox, "Bled mora imeti merljiv cilj dotika").not.toBeNull();
  expect(vintgarBox, "Vintgar mora imeti merljiv cilj dotika").not.toBeNull();
  for (const box of [bledBox!, vintgarBox!]) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const locevana =
    bledBox!.x + bledBox!.width <= vintgarBox!.x + 0.5 ||
    vintgarBox!.x + vintgarBox!.width <= bledBox!.x + 0.5 ||
    bledBox!.y + bledBox!.height <= vintgarBox!.y + 0.5 ||
    vintgarBox!.y + vintgarBox!.height <= bledBox!.y + 0.5;
  expect(
    locevana,
    `44-px cilja se po razpetju gruče ne smeta prekrivati (bled=${JSON.stringify(bledBox)}, vintgar=${JSON.stringify(vintgarBox)})`,
  ).toBe(true);

  // Vsaka destinacija posebej: popup z PRAVIM imenom + dodajanje v mojo pot.
  await bled.click();
  const bledPopup = page.locator(".maplibregl-popup").first();
  await expect(bledPopup).toBeVisible();
  await expect(bledPopup).toContainText("Bled");
  await expect(bledPopup).toContainText("★ 4.8"); // Bled (Vintgar ima 4.6) — diskriminator
  const dodajBled = bledPopup.getByRole("button", {
    name: "Dodaj v mojo pot",
    exact: true,
  });
  await dodajBled.click();
  // Gumb se po dodajanju preimenuje in onemogoči — lociraj po novem imenu:
  await expect(bledPopup.getByRole("button", { name: "V moji poti" })).toBeDisabled();

  await bledPopup.locator(".maplibregl-popup-close-button").click();
  await vintgar.click();
  const vintgarPopup = page.locator(".maplibregl-popup").first();
  await expect(vintgarPopup).toBeVisible();
  await expect(vintgarPopup).toContainText("Vintgarska soteska");
  const dodajVintgar = vintgarPopup.getByRole("button", {
    name: "Dodaj v mojo pot",
    exact: true,
  });
  await dodajVintgar.click();
  await expect(vintgarPopup.getByRole("button", { name: "V moji poti" })).toBeDisabled();

  const shranjena = await page.evaluate(() => {
    const raw = window.localStorage.getItem("dai:my-trip");
    const items = raw ? (JSON.parse(raw) as Array<{ refId?: string }>) : [];
    return (
      items.some((item) => item.refId === "bled") &&
      items.some((item) => item.refId === "vintgarska-soteska")
    );
  });
  expect(shranjena, "Iz gruče je mogoče dodati obe destinaciji posebej").toBe(true);

  expect(pageErrors, "JavaScript napake med gručenjem").toEqual([]);
});

// ── ⑪ — seznam → destinacija v gruči: showDestination razpre gručo ───────
test("⑪ MapLibre: destinacija v gruči iz seznama odpre popup (showDestination)", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoTrdo(page, "/zemljevid?zemljevid=vektorji");

  // Privzeti pogled: Vintgarska soteska je v gruči (skrit marker):
  const vintgar = page.locator('[data-destination-slug="vintgarska-soteska"]');
  await expect(vintgar).toHaveCount(1, { timeout: 30_000 });
  await expect(vintgar).toBeHidden();

  // Klik imena v seznamu → preklop na zemljevid + polet do ločitve gruče
  // + popup PO moveend (marker je bil v gruči):
  await page.getByRole("button", { name: "Seznam", exact: true }).click();
  const list = page.locator('section[aria-label="Seznam"]');
  await expect(list).toBeVisible();
  await list.getByRole("button", { name: "Vintgarska soteska", exact: true }).click();

  const popup = page.locator(".maplibregl-popup").first();
  await expect(popup).toBeVisible({ timeout: 20_000 });
  await expect(popup).toContainText("Vintgarska soteska");
  // Po letu (zoom ≥ 11) je marker posamezno viden — gruča je razprta:
  await expect(vintgar).toBeVisible();
});
