/* E2E: produkcijska verifikacija »Zanimivosti ob poti« na Vercelu.
 *
 *   node .playwright-cli/verify-poi-production.cjs [baseUrl]
 *
 * Preveri: gumb, žive OSM zadetke ali pošten degradiran način, navedbo virov,
 * označevalce, pojavno okno, mobilno širino in odsotnost JS napak.
 * Lokalno stanje vodiča je posejano v localStorage (enako kot v lokalnih E2E).
 */
const { chromium } = require('C:/Users/admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const BASE = process.argv[2] || 'https://i-feel-slovenia.vercel.app';
const TRIGGER = 'button[aria-label="Prikaži ali skrij zanimivosti ob poti"]';

const guideFor = (region) => ({
  version: 1,
  interests: ['narava'],
  region,
  days: 3,
  pace: 'zmeren',
  answered: ['interests', 'region', 'days', 'pace'],
  stays: [
    { id: 'n1', name: 'Hotel Bled', city: 'Bled', lat: 46.3625, lng: 14.0936, priceFrom: 90, reservedAt: new Date().toISOString() },
    { id: 'n2', name: 'Penzion Bohinj', city: 'Bohinj', lat: 46.2714, lng: 13.9526, priceFrom: 60, reservedAt: new Date().toISOString() },
  ],
  voiceEnabled: false,
  completedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

async function settled(page) {
  await page.waitForFunction(
    (sel) => {
      const b = document.querySelector(sel);
      return !!b && (b.innerText.includes('Skrij zanimivosti') || b.innerText.includes('Zanimivosti'));
    },
    TRIGGER,
    { timeout: 45000 },
  );
}

async function scenario(browser, region, label, expectedRadius) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((g) => localStorage.setItem('dsa.guide.v1', JSON.stringify(g)), guideFor(region));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1200);

  console.log(`\n=== ${label} (${region}) @ ${BASE} ===`);
  const trigger = page.getByRole('button', { name: 'Prikaži ali skrij zanimivosti ob poti' });
  console.log('BUTTON_VISIBLE:', await trigger.isVisible());
  console.log('BUTTON_TEXT:', (await trigger.innerText()).trim());

  await trigger.click();
  // Počakamo na končno stanje (strežniški proračun za živi OSM je 12 s).
  await page.waitForFunction(
    (sel) => {
      const b = document.querySelector(sel);
      return !!b && b.innerText.includes('Skrij zanimivosti');
    },
    TRIGGER,
    { timeout: 45000 },
  );
  console.log('HIDE_LABEL:', (await trigger.innerText()).trim());

  const items = page.getByRole('button', { name: /Prikaži zanimivost .* na zemljevidu/ });
  const count = await items.count();
  console.log('POI_COUNT:', count);
  console.log('FIRST_POI:', count > 0 ? (await items.first().innerText()).replace(/\n/g, ' | ') : '—');

  const body = await page.locator('body').innerText();
  console.log('OSM_ATTRIBUTION:', body.includes('© OpenStreetMap'));
  console.log('CATALOG_ATTRIBUTION:', body.includes('urejeni izbor slovenskih znamenitosti'));
  console.log('RADIUS_OK:', body.includes(`odmik ≤ ${expectedRadius} km`));
  console.log('DEGRADED_NOTE:', body.includes('OpenStreetMap trenutno ni dosegljiv'));
  console.log('TIMEOUT_NOTE:', body.includes('Iskanje je trajalo predolgo'));

  const markers = await page.locator('.dsa-pin-poi').count();
  console.log('MAP_MARKERS:', markers);
  console.log('COUNT_MATCHES_MARKERS:', count === markers);

  if (count > 0) {
    await items.first().click();
    await page.waitForTimeout(900);
    const popup = page.locator('.leaflet-popup-content').first();
    const popupText = await popup.innerText().catch(() => '');
    console.log('POPUP_TEXT:', popupText.replace(/\n/g, ' | ').trim());
    console.log('POPUP_HAS_SOURCE:', popupText.includes('urejeni izbor') || popupText.includes('OpenStreetMap'));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  console.log('MOBILE_SCROLLW:', await page.evaluate(() => document.documentElement.scrollWidth));
  console.log('PAGE_ERRORS:', JSON.stringify(errors.slice(0, 5)));
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  await scenario(browser, 'gorenjska', 'Dve postanki = ob poti', 3);
  await scenario(browser, 'osrednja', 'Ena postanka = v okolici', 12);
  await browser.close();
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
