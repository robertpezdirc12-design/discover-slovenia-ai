/* Vizualni + funkcijski preveritveni skript za nov blok »Ocena proračuna«. */
const { chromium } = require('C:/Users/admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const GUIDE = {
  version: 1,
  interests: ['narava', 'hrana'],
  region: 'gorenjska',
  days: 3,
  pace: 'zmeren',
  answered: ['interests', 'region', 'days', 'pace'],
  stays: [
    { id: 'n1', name: 'Hotel Bled', city: 'Bled', lat: 46.3625, lng: 14.0936, priceFrom: 90, reservedAt: new Date().toISOString() },
    { id: 'n2', name: 'Penzion Bohinj', city: 'Bohinj', lat: 46.2714, lng: 13.9526, priceFrom: 60, reservedAt: new Date().toISOString() },
    { id: 'n3', name: 'Kamp Soča', city: 'Bovec', lat: 46.3377, lng: 13.5556, priceFrom: null, reservedAt: new Date().toISOString() },
  ],
  voiceEnabled: false,
  completedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.addInitScript((g) => {
    localStorage.setItem('dsa.guide.v1', JSON.stringify(g));
  }, GUIDE);
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);

  const panel = page.locator('aside[aria-label="Tvoja pot — postanke in prenočišča"]');
  console.log('PANEL_VISIBLE:', await panel.isVisible());
  const budget = panel.locator('div[aria-label="Ocena proračuna prenočišč"]');
  console.log('BUDGET_VISIBLE:', await budget.isVisible());
  console.log('BUDGET_TEXT:', (await budget.innerText()).replace(/\n/g, ' | '));
  console.log('HEADER_CHIP:', await panel.locator('span[title="Ocena proračuna prenočišč"]').innerText());

  // Interakcija: 2 osebi → 3 osebe
  await budget.getByRole('button', { name: '3 osebe' }).click();
  console.log('AFTER_CLICK:', (await budget.innerText()).replace(/\n/g, ' | '));

  await page.screenshot({ path: 'home-budget.png', fullPage: false });
  await panel.screenshot({ path: 'panel-budget.png' });

  // Mobilni pregled preliva
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log('MOBILE_SCROLLW:', scrollW);
  console.log('PAGE_ERRORS:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
