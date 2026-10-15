/**
 * Stabilno čakanje na aplikacijo v oddaljenem/CI načinu.
 *
 * Oddaljeni origini lahko ohranijo aktivne zahteve (slike, vremenski podatki,
 * zemljevid ali druga omrežna aktivnost), zato `networkidle` ni zanesljiv
 * predpogoj za klik. Po navigaciji čakamo na vidno vsebino strani in
 * poskusimo kratko počakati na mirno omrežje; timeout omrežja ne blokira testa.
 */
import { type Page } from "@playwright/test";

/** CI uporablja E2E_BASE_URL, tudi kadar je cilj lokalni testni strežnik. */
export const ODDALJENO = Boolean(process.env.E2E_BASE_URL);

export async function gotoTrdo(page: Page, path: string): Promise<void> {
  for (let poskus = 0; ; poskus++) {
    try {
      await page.goto(path, {
        waitUntil: ODDALJENO ? "domcontentloaded" : "load",
      });
      break;
    } catch {
      if (poskus > 0 || !ODDALJENO) throw new Error(`goto ni uspel: ${path}`);
    }
  }

  if (ODDALJENO) {
    // Čakaj na dejansko vsebino, ne na umiritev vsake omrežne zahteve.
    await page.locator("#vsebina").waitFor({ state: "visible", timeout: 20_000 });
    await page.locator("#vsebina h1").first().waitFor({ state: "visible", timeout: 20_000 });
    // Kratek best-effort dodaten čas za hitro zaključene zahteve; nikoli ni
    // trda ovira, če je prisotno dolgoživo omrežje ali počasna zunanja storitev.
    await page.waitForLoadState("networkidle", { timeout: 1_500 }).catch(() => undefined);
  }
}

/** Po interakciji počakaj na naslednja okvirja prikaza, ne na globalni networkidle. */
export async function ustaliSe(page: Page): Promise<void> {
  if (!ODDALJENO) return;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}
