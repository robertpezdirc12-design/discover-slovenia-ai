// RKD sloj — smoke test (leno nalaganje, gruče, približanje, popup).
// Uporaba: node .playwright-cli/rkd-smoke.cjs <baseUrl>
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:3100';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#rkd-toggle', { timeout: 30000 });

  // Pomakni se do zemljevida (orodna vrstica je v sekciji #zemljevid)
  await page.evaluate(() => document.getElementById('zemljevid')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(800);

  // Vklopi RKD sloj (force: vrstica je lepljiva in lahko pod prekrivnim glavnikom)
  await page.locator('#rkd-toggle').click({ force: true });
  await page.waitForFunction(() => document.querySelectorAll('.dsa-rkd-cluster').length > 0, null, { timeout: 60000 });
  const clusters = await page.locator('.dsa-rkd-cluster').count();
  console.log(`gruče na začetku: ${clusters}`);

  // Klik na prvo gručo → približanje (pojavi naj se več označevalcev)
  await page.locator('.dsa-rkd-cluster').first().click();
  await page.waitForTimeout(1500);
  const singles = await page.locator('.dsa-rkd-pin').count();
  const clustersAfter = await page.locator('.dsa-rkd-cluster').count();
  console.log(`po kliku na gručo: pike=${singles}, gruče=${clustersAfter}`);

  // Odpri popup na posamezni enoti. Leaflet drži vse markerje v DOM-u
  // (tudi zunaj ekrana); najti je treba piko v VIDNEM polju. Če trenutni
  // pogled nima posameznih enot, približamo sredino (dvojni klik), dokler
  // se ne pojavijo, nato kliknemo sredino prve vidne pike.
  if (singles > 0) {
    const visiblePins = async () => {
      const out = [];
      const pins = page.locator('.dsa-rkd-pin');
      const n = await pins.count();
      for (let i = 0; i < n; i++) {
        const box = await pins.nth(i).boundingBox();
        if (box && box.x >= 0 && box.y >= 120 && box.x <= 1280 && box.y <= 780) out.push(box);
      }
      return out;
    };

    let clicked = false;
    for (let attempt = 0; attempt < 10 && !clicked; attempt++) {
      const all = await page.locator('.dsa-rkd-pin').count();
      const visible = await visiblePins();
      console.log(`status: pin=${all} visible=${visible.length}`);
      if (visible.length === 0) {
        // Približaj prek Leafletove kontrole (zanesljiveje kot dvojni klik).
        await page.locator('.leaflet-control-zoom-in').click({ force: true });
        await page.waitForTimeout(800);
        continue;
      }
      for (const box of visible) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(600);
        const href = await page
          .locator('.leaflet-popup-content a[href^="https://eid.gov.si/S/"]')
          .first()
          .getAttribute('href')
          .catch(() => null);
        if (href && /^https:\/\/eid\.gov\.si\/S\/\d+$/.test(href)) {
          const text = await page.locator('.leaflet-popup-content').innerText();
          console.log('popup vsebuje:', text.split('\n')[0]);
          console.log('popup povezava:', href);
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) throw new Error('ni uspelo odpreti popupa RKD s povezavo eID');
  }

  await page.screenshot({ path: '.playwright-cli/rkd-smoke.png', fullPage: false });

  if (errors.length > 0) {
    console.error('PRIPOMBE:');
    errors.forEach((e) => console.error(' -', e));
    await browser.close();
    process.exit(1);
  }
  console.log('SMOKE_OK');
  await browser.close();
})().catch((e) => {
  console.error('SMOKE_FAIL', e);
  process.exit(1);
});
