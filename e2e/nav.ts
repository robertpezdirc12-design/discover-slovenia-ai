/**
 * NAV-HARDENING ZA E2E PROTI ODDALJENEMU CILJU (2.51.0, issue #38):
 * testi so bili napisani za localhost, kjer je hidracija App Routerja
 * takojšnja. Proti oddaljenemu originu (Vercel preview, `E2E_BASE_URL`)
 * sta se pokazali dve deterministični oviri:
 *
 *  1. `page.goto` z privzetim `waitUntil: "load"` pogosto abortira
 *     (net::ERR_ABORTED) prek počasnega proxyja — polna `load` faza
 *     s številnimi podviri je nestabilna.
 *  2. Klik takoj po navigaciji/fill-u tekmuje s hidracijo in App
 *     Router soft-nav (debounce iskanja sproži router.replace) —
 *     DOM se odcepi sredi klika („element was detached“) ali pa klik
 *     padе na še ne-hidrirano stran in se tiho izgubi.
 *
 * Rešitev: v oddaljenem načinu navigiramo z `domcontentloaded`, ob
 * mrežni napaki poskusimo ENKRAT znova, po navigaciji in po fill-u
 * pa počakamo `networkidle` (klik ne tekmuje več s podatkovnim tokom).
 * Lokalni teki (brez E2E_BASE_URL) ostanejo povsem nespremenjeni.
 */
import { type Page } from "@playwright/test";

/** Oddaljen način = E2E_BASE_URL je nastavljen (Vercel preview/produkcija). */
export const ODDALJENO = Boolean(process.env.E2E_BASE_URL);

/**
 * Trd goto: v oddaljenem načinu `domcontentloaded` namesto `load` +
 * en ponovni poskus ob napaki (ERR_ABORTED je tranzieren) + `networkidle`
 * po navigaciji, da interakcije ne tekmujejo s hidracijo/soft-nav.
 */
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
  if (ODDALJENO) await page.waitForLoadState("networkidle");
}

/** Ustalitev po dejanjih, ki sprožijo debounce/soft-nav (npr. iskanje). */
export async function ustaliSe(page: Page): Promise<void> {
  if (ODDALJENO) await page.waitForLoadState("networkidle");
}
