/* E2E: klik "Izvozi GPX" → dejanski prenos datoteke + vsebina GPX 1.1. */
const fs = require('fs');
const { chromium } = require('C:/Users/admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const GUIDE = {
  version: 1,
  interests: ['narava'],
  region: 'gorenjska',
  days: 3,
  pace: 'zmeren',
  answered: ['interests', 'region', 'days', 'pace'],
  stays: [
    { id: 'n1', name: 'Hotel Bled & "Grad"', city: 'Bled', lat: 46.3625, lng: 14.0936, priceFrom: 90, reservedAt: new Date().toISOString() },
    { id: 'n2', name: 'Penzion Bohinj', city: 'Bohinj', lat: 46.2714, lng: 13.9526, priceFrom: 60, reservedAt: new Date().toISOString() },
  ],
  voiceEnabled: false,
  completedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.addInitScript((g) => localStorage.setItem('dsa.guide.v1', JSON.stringify(g)), GUIDE);
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1200);

  const btn = page.getByRole('button', { name: 'Izvozi svojo pot kot GPX datoteko' });
  console.log('BUTTON_VISIBLE:', await btn.isVisible());
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    btn.click(),
  ]);
  const out = 'gpx-export-sample.gpx';
  await download.saveAs(out);
  const xml = fs.readFileSync(out, 'utf8');
  console.log('FILENAME:', download.suggestedFilename());
  console.log('GPX_HEADER:', xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  console.log('WPT_COUNT:', (xml.match(/<wpt /g) || []).length);
  console.log('RTEPT_COUNT:', (xml.match(/<rtept /g) || []).length);
  console.log('HAS_PRENOCISCE:', xml.includes('<type>prenocisce</type>'));
  console.log('XML_ESCAPED:', xml.includes('Hotel Bled &amp; &quot;Grad&quot;'));

  const manual = page.getByRole('link', { name: /Odpri datoteko ročno/ });
  console.log('MANUAL_FALLBACK:', await manual.isVisible());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  console.log('MOBILE_SCROLLW:', await page.evaluate(() => document.documentElement.scrollWidth));
  console.log('PAGE_ERRORS:', JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
