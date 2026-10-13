/**
 * ZLATA POT (E2E, issue #38 P1 — 2.45.0):
 * /destinacije → iskanje Bled → filter Gorenjska → filter Jezero → Bled →
 * „Dodaj v mojo pot“ → /moja-potovanja → prednastavitev na /nacrtuj →
 * sestavi načrt → „Shrani v Mojo pot“ → /potovanje + /moja-potovanja →
 * „Zaženi na poti“ → aktivna pot v /na-poti → „Opravljeno“ →
 * napredek/naslednji postanek → preskok postanka → osvežitev →
 * zaključek potovanja.
 *
 * Izolacija: svež kontekst na test (prazen localStorage — glej
 * playwright.config.ts); stanje je začasno in se uniči s kontekstom.
 */
import { expect, test, type Page } from "@playwright/test";
import { gotoTrdo, ustaliSe } from "./nav";

/**
 * Vsi dai:* ključi (my-trip, last-plan, go-trip, dismissed …) počistimo
 * ENKRAT na kontekst: init skripta teče ob vsaki navigaciji, zato brez
 * oznake bi pometla tudi stanje, ki ga zlata pot vmes USTVARI (dai:last-plan
 * pred /potovanje). Oznaka dai:e2e-seen je del začasnega stanja konteksta.
 */
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

test("zlata pot: destinacije → Moja pot → načrtuj → Na poti → zaključek", async ({
  page,
}) => {
  test.setTimeout(120_000);

  // ── 1. /destinacije: iskanje Bled ───────────────────────────────────────
  await gotoTrdo(page, "/destinacije");
  await page.getByLabel(/Išči/i).fill("Bled");
  await ustaliSe(page); // debounce/soft-nav po iskanju se ne sme tekmovati s klikom

  // ── 2. filter Gorenjska (Radix Select; #41 F0: državni filter je zdaj
  // prvi combobox — ciljamo po semantičnem ID, ne po vrstnem redu) ────────
  await page.locator("#dest-region").click();
  await page.getByRole("option", { name: "Gorenjska" }).click();

  // ── 3. filter Jezero ────────────────────────────────────────────────────
  await page.locator("#dest-type").click();
  await page.getByRole("option", { name: "Jezero" }).click();

  // Iskanje + oba filtra ⇒ natanko Bled (Bohinj ne ustreza poizvedbi „Bled“).
  const bledCard = page.getByRole("link", { name: /Bled/ }).first();
  await expect(bledCard).toBeVisible();

  // ── 4. Bled → „Dodaj v mojo pot“ ────────────────────────────────────────
  await bledCard.click();
  await expect(page).toHaveURL(/\/destinacija\/bled/);
  const addBtn = page.getByRole("button", { name: "Dodaj v mojo pot" });
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  // potrjeno stanje: gumb postane „V mojo pot ✓“ (destinacijski gumb menja
  // oznako + variant — EXACT ime, ker »Dodaj v mojo pot« vsebuje isti niz)
  await expect(
    page.getByRole("button", { name: "V mojo pot ✓" })
  ).toBeVisible();
  // stanje v izoliranem kontekstu (dai:my-trip; destinacija ima refId = slug):
  const trip = await page.evaluate(() =>
    window.localStorage.getItem("dai:my-trip")
  );
  expect(trip).toContain('"refId":"bled"');

  // ── 5. /moja-potovanja: Bled je v zbirki ────────────────────────────────
  await gotoTrdo(page, "/moja-potovanja");
  await expect(page.getByText("Bled").first()).toBeVisible();

  // ── 6. /nacrtuj: prednastavitev „Miren vikend ob reki“ (en klik = načrt) ─
  await gotoTrdo(page, "/nacrtuj");
  await page.getByRole("button", { name: /Miren vikend ob reki/ }).click();
  // načrt se sestavi takoj (deterministični motor) — počakamo na akcije:
  const saveBtn = page.getByRole("button", { name: "Shrani v Moja pot" });
  await expect(saveBtn).toBeVisible({ timeout: 15_000 });

  // ── 7. „Shrani v Moja pot“ → potrditveno sporočilo ──────────────────────
  await saveBtn.click();
  await expect(page.getByText("Shranjeno v Moja pot").first()).toBeVisible();
  // načrt (dai:last-plan) je za Go Mode:
  const lastPlan = await page.evaluate(() =>
    window.localStorage.getItem("dai:last-plan")
  );
  expect(lastPlan).toContain("days");

  // ── 8. /moja-potovanja + /potovanje: zbirka in načrt ────────────────────
  await gotoTrdo(page, "/moja-potovanja");
  await expect(page.getByText("Bled").first()).toBeVisible();
  await gotoTrdo(page, "/potovanje");
  const goLink = page.getByRole("link", { name: /Zaženi na poti/ });
  await expect(goLink).toBeVisible();

  // ── 9. „Zaženi na poti“ → aktivna pot v /na-poti ────────────────────────
  await goLink.click();
  await expect(page).toHaveURL(/\/na-poti/);
  // jutranji uvod („ZAČNI DAN“), če ga obstoječi tok prikaže:
  const startDay = page.getByRole("button", { name: /ZAČNI DAN/ });
  if (await startDay.isVisible().catch(() => false)) {
    await startDay.click();
  }
  const doneBtn = page.getByRole("button", { name: "Opravljeno" }).first();
  await expect(doneBtn).toBeVisible({ timeout: 15_000 });

  // ── 10. „Opravljeno“ na prvem postanku → napredek (X/N opravljenih) ────
  await doneBtn.click();
  await expect(
    page.getByText(/1\/\d+ opravljenih/).first()
  ).toBeVisible();

  // ── 11. preskok postanka (kjer obstaja „Preskoči“) ───────────────────────
  const skipBtn = page.getByRole("button", { name: "Preskoči" });
  if (await skipBtn.isVisible().catch(() => false)) {
    await skipBtn.click();
    // preskočen postanek je v dnevni vrsti označen („Preskočeno“)
    await expect(
      page.getByText("Preskočeno", { exact: true }).first()
    ).toBeVisible();
  }

  // ── 12. osvežitev: napredek je vztrajen (dai:go-trip) ────────────────────
  await page.reload();
  await ustaliSe(page); // po osvežitvi počakamo hidracijo
  const startDay2 = page.getByRole("button", { name: /ZAČNI DAN|Začni dan/ });
  if (await startDay2.isVisible().catch(() => false)) {
    await startDay2.first().click();
  }
  // po osvežitvi ni ničesar izgubljeno: napredek dneva se prikaže znova
  await expect(
    page.getByText(/\d+\/\d+ opravljenih/).first()
  ).toBeVisible({ timeout: 15_000 });

  // ── 13. zaključek potovanja: opravimo/preskočimo vse preostale postanke ─
  for (let i = 0; i < 30; i++) {
    const done = page.getByRole("button", { name: "Opravljeno" });
    const nextDay = page.getByRole("button", { name: /^Začni dan \d+$/ });
    const finished = page.getByText("POTOVANJE ZAKLJUČENO");

    if (await finished.isVisible().catch(() => false)) break;
    if (await done.isVisible().catch(() => false)) {
      await done.first().click();
      await page.waitForTimeout(150);
      continue;
    }
    if (await nextDay.isVisible().catch(() => false)) {
      await nextDay.first().click();
      await page.waitForTimeout(150);
      continue;
    }
    // brez gumba in brez zaključka → izstopi (varovalka zanke)
    break;
  }

  // sklenjeno stanje: potovanje zaključeno (vsi dnevi porabljeni)
  await expect(page.getByText("POTOVANJE ZAKLJUČENO")).toBeVisible();
});

test("ponovljivost: ista prednastavitev ×2 → isti načrt (determinizem)", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const readPlanFingerprint = async (): Promise<unknown> => {
    const raw = await page.evaluate(() =>
      window.localStorage.getItem("dai:last-plan")
    );
    // primerjamo PLAN (determinističen del); ovoj vsebuje savedAt časovni
    // žig, ki je pričakovno različen med tekoma
    const parsed = JSON.parse(raw ?? "{}") as { plan?: { fingerprint?: string } };
    return parsed.plan;
  };

  // 1. tek: en klik na prednastavitev sestavi načrt; SHRAINJE (dai:last-plan
  // se zapiše šele ob Shrani/Go — pričakovano vedenje, zaklep P1)
  await gotoTrdo(page, "/nacrtuj");
  await page.getByRole("button", { name: /Miren vikend ob reki/ }).click();
  const saveBtn2 = page.getByRole("button", { name: "Shrani v Moja pot" });
  await expect(saveBtn2).toBeVisible({ timeout: 15_000 });
  await saveBtn2.click();
  await expect(page.getByText("Shranjeno v Moja pot").first()).toBeVisible();
  const first = await readPlanFingerprint();
  expect(first).toBeTruthy();

  // 2. tek: ista prednastavitev po ponovnem vstopu (isti kontekst, ponovljen
  // obisk) — enako vedenje ob ponovitvi (kanon determinističnega motorja)
  await gotoTrdo(page, "/nacrtuj");
  await page.getByRole("button", { name: /Miren vikend ob reki/ }).click();
  const saveBtn3 = page.getByRole("button", { name: "Shrani v Moja pot" });
  await expect(saveBtn3).toBeVisible({ timeout: 15_000 });
  await saveBtn3.click();
  await expect(page.getByText("Shranjeno v Moja pot").first()).toBeVisible();
  const second = await readPlanFingerprint();

  // enako vedenje ob ponovitvi: ISTI načrt (isti fingerprint) — obvoj z
  // savedAt se razlikuje, deterministični motor pa ne
  expect(second).toEqual(first);
});
