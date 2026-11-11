/* E2E: »Zanimivosti ob poti« — OSM + urejeni izbor, označevalci, ena postanka, mobilno. */
const { chromium } = require('C:/Users/admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

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

async function scenario(browser, region, label, expectedRadius) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((g) => localStorage.setItem('dsa.guide.v1', JSON.stringify(g)), guideFor(region));
  await page.goto('http://localhost:3100/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1000);

  console.log(`\n=== ${label} (${region}) ===`);
  const trigger = page.getByRole('button', { name: 'Prikaži ali skrij zanimivosti ob poti' });
  console.log('BUTTON_VISIBLE:', await trigger.isVisible());
  console.log('BUTTON_TEXT:', (await trigger.innerText()).trim());

  // aria-label je stalen, zato čakamo na spremembo BESEDILA gumba.
  // API ima 5-sekundni proračun za Overpass; počakamo na končno stanje.
  await trigger.click();
  await page.waitForFunction(() => {
    const b = document.querySelector('button[aria-label="Prikaži ali skrij zanimivosti ob poti"]');
    return !!b && b.innerText.includes('Skrij zanimivosti');
  }, null, { timeout: 40000 });
  console.log('HIDE_LABEL:', (await trigger.innerText()).trim());

  const items = page.getByRole('button', { name: /Prikaži zanimivost .* na zemljevidu/ });
  const count = await items.count();
  console.log('POI_COUNT:', count);
  console.log('FIRST_POI:', count > 0 ? (await items.first().innerText()).replace(/\n/g, ' | ') : '—');

  const body = await page.locator('body').innerText();
  console.log('ATTRIBUTION_OK:', body.includes('urejeni izbor slovenskih znamenitosti'));
  console.log('RADIUS_OK:', body.includes(`odmik ≤ ${expectedRadius} km`));
  console.log('DEGRADED_NOTE:', body.includes('OpenStreetMap trenutno ni dosegljiv'));

  const markers = await page.locator('.dsa-pin-poi').count();
  console.log('MAP_MARKERS:', markers);
  console.log('COUNT_MATCHES_MARKERS:', count === markers);

  if (count > 0) {
    await items.first().click();
    await page.waitForTimeout(900);
    const popup = page.locator('.leaflet-popup-content').first();
    const popupText = await popup.innerText().catch(() => '');
    console.log('POPUP_VISIBLE:', await popup.isVisible().catch(() => false));
    console.log('POPUP_TEXT:', popupText.replace(/\n/g, ' | ').trim());
    console.log('POPUP_HAS_SOURCE:', popupText.includes('urejeni izbor') || popupText.includes('OpenStreetMap'));
  }

  await page.screenshot({ path: `poi-desktop-${region}.png` });
  await trigger.click();
  await page.waitForTimeout(400);
  console.log('MARKERS_AFTER_HIDE:', await page.locator('.dsa-pin-poi').count());

  // Najprej mobilni pogled, nato ponovno odpremo predloge (kot v resnični
  // uporabi): samodejni pomik do rezultata se zgodi pri mobilni višini.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await trigger.click();
  await page.waitForFunction(() => {
    const b = document.querySelector('button[aria-label="Prikaži ali skrij zanimivosti ob poti"]');
    return !!b && b.innerText.includes('Skrij zanimivosti');
  }, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `poi-mobile-${region}.png` });
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
