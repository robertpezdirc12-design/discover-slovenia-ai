// Globoka povezava ?dest=slug — smoke test.
// Uporaba: node .playwright-cli/focus-smoke.cjs <baseUrl>
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

  // 1) Brez seje → začasni marker s popupom Bled
  await page.goto(`${BASE}/?dest=bled#zemljevid`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.leaflet-popup-content', { timeout: 20000 });
  let text = await page.locator('.leaflet-popup-content').innerText();
  console.log('scenarij 1 (brez seje):', text.split('\n')[0]);
  if (!text.includes('Bled')) errors.push('brez seje: popup ne vsebuje Bled');

  // 2) S sejo gorenjska → plan marker Bled popup
  await page.evaluate((g) => window.localStorage.setItem('dsa.guide.v1', JSON.stringify(g)), GUIDE);
  await page.goto(`${BASE}/?dest=bled#zemljevid`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.leaflet-popup-content', { timeout: 20000 });
  text = await page.locator('.leaflet-popup-content').innerText();
  console.log('scenarij 2 (seja):', text.split('\n')[0]);
  if (!text.includes('Bled')) errors.push('s sejo: popup ne vsebuje Bled');

  await browser.close();
  if (errors.length) {
    console.error('PRIPOMBE:', errors.join(' | '));
    process.exit(1);
  }
  console.log('SMOKE_OK');
})().catch((e) => {
  console.error('SMOKE_FAIL', e.message);
  process.exit(1);
});
