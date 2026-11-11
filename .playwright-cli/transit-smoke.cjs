// Javni prevoz — smoke test: popup postanke → gumb »Javni prevoz« → načrti.
// Uporaba: node .playwright-cli/transit-smoke.cjs <baseUrl>
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:3100';

const GUIDE = {
  version: 1,
  interests: ['narava'],
  region: 'gorenjska',
  days: 3,
  pace: 'zmeren',
  answered: ['interests', 'region', 'days', 'pace'],
  stays: [],
  voiceEnabled: false,
  completedAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z',
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate((g) => {
    window.localStorage.setItem('dsa.guide.v1', JSON.stringify(g));
  }, GUIDE);
  await page.reload({ waitUntil: 'networkidle' });

  await page.waitForSelector('.dsa-pin-plan', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('zemljevid')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(800);

  // Odpri popup prve postanke (Bled/Bohinj)
  await page.locator('.dsa-pin-plan').first().click();
  await page.waitForSelector('.leaflet-popup-content .dsa-transit-btn', { timeout: 10000 });

  // Klik na gumb »Javni prevoz«
  await page.locator('.leaflet-popup-content .dsa-transit-btn').click();
  await page.waitForSelector('.leaflet-popup-content .dsa-plan-row', { timeout: 45000 });

  const plans = await page.locator('.leaflet-popup-content .dsa-plan-row').count();
  const text = await page.locator('.leaflet-popup-content').innerText();
  console.log(`načrtov v popupu: ${plans}`);
  console.log('prva vrstica:', text.split('\n')[0]);
  if (!/Javni prevoz/i.test(text)) errors.push('manjka naslov Javni prevoz');
  if (!/OJPP|brezavta/i.test(text)) errors.push('manjka atribucija');
  if (!/Bus|Vlak/i.test(text)) errors.push('ni prevoznega načina');

  // Linija naj bi bila narisana (vijolična polyline v overlay pane)
  const lineCount = await page.evaluate(() => {
    const paths = Array.from(document.querySelectorAll('.leaflet-overlay-pane path'));
    return paths.filter((p) => p.getAttribute('stroke') === '#4f46e5').length;
  });
  console.log('vijoličnih linij:', lineCount);
  if (lineCount < 1) errors.push('ni narisane linije javnega prevoza');

  await page.screenshot({ path: '.playwright-cli/transit-smoke.png' });

  if (errors.length > 0) {
    console.error('PRIPOMBE:');
    errors.forEach((e) => console.error(' -', e));
    await browser.close();
    process.exit(1);
  }
  console.log('SMOKE_OK');
  await browser.close();
})().catch((e) => {
  console.error('SMOKE_FAIL', e.message);
  process.exit(1);
});
