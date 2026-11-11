import { test, expect } from '@playwright/test';

const GUIDE_KEY = 'dsa.guide.v1';
const CUSTOM_KEY = 'dsa.custom.stops.v1';

// Čisto stanje: brez shranjenih podatkov → brez statičnih pinov.
test('zemljevid: čisto stanje nima statičnih pinov in nima napak', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));

  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.leaflet-container', { timeout: 20000 });
  await page.waitForTimeout(3000);

  const markers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.leaflet-marker-icon')).map((el) => el.className),
  );
  expect(markers.filter((c) => c.includes('dsa-pin') && !c.includes('-plan') && !c.includes('-stay'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('»Iščem«: izbira kategorije prikaže pine in seznam rezultatov', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.leaflet-container', { timeout: 20000 });

  await page.selectOption('#place-cat', 'lekarne');
  await page.waitForSelector('.dsa-pin-place', { timeout: 60000 });
  await page.waitForSelector('ul li .dsa-add-poi-btn', { timeout: 10000 });

  const pins = await page.locator('.dsa-pin-place').count();
  const listItems = await page.locator('ul li .dsa-add-poi-btn').count();
  expect(pins).toBeGreaterThanOrEqual(5);
  expect(listItems).toBeGreaterThanOrEqual(5);
});

test('»Vodi me« se pojavi, ko pot vsebuje ≥2 postanki; pot se nariše', async ({ page }) => {
  const state = {
    version: 1,
    interests: [],
    region: null,
    extraRegions: [],
    days: null,
    pace: null,
    answered: [],
    stays: [],
    savedPois: [
      { id: 't1', name: 'Bled', note: '', lat: 46.3625, lng: 14.0936, category: 'Destinacija', source: 'izbor' },
      { id: 't2', name: 'Bohinj', note: '', lat: 46.2714, lng: 13.9526, category: 'Destinacija', source: 'izbor' },
    ],
    voiceEnabled: false,
    completedAt: null,
    updatedAt: '',
  };

  await page.goto('/');
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [GUIDE_KEY, state] as const);
  await page.reload();
  await page.waitForSelector('text=Vodi me', { timeout: 25000 });
  await page.waitForTimeout(15000);

  await expect(page.getByText('Vodi me', { exact: true })).toBeVisible();
  const polylines = await page.evaluate(() => document.querySelectorAll('.leaflet-overlay-pane path').length);
  expect(polylines).toBeGreaterThanOrEqual(1);

  // Počisti pot → Vodi me izgine
  await page.getByText('Počisti pot', { exact: true }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Vodi me', { exact: true })).toHaveCount(0);
});
