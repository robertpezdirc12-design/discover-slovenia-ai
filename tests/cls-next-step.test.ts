/**
 * CLS-NEXT-STEP (POLIR13, 2.40.0) — CWV STABILNOST: SSR REZERVACIJA PROSTORA
 * ZA NEXT-STEP KARTICO
 * ============================================================================
 * Živa produkcija 2.39.0 (mobilna emulacija CPU 4×/Fast 3G) je na treh
 * poteh presegala CLS prag 0,1 (web.dev „Optimize CLS"):
 *   /  CLS 0,161 (vstavitev kartice 379 px na y≈541 po hidraciji)
 *   /nacrtuj  CLS 0,239 (347 px na y≈210)
 *   /trznica  CLS 0,231
 * EDINI vzrok na vseh treh straneh: `{nextStepReady && <NextStepCard/>}` —
 * kartica je odvisna od lokalnih shramb (strežnik ne more izrisati) ⇒ SSR
 * izriše NIČ, ob hidraciji (~1,5–1,8 s) se vstavi ovoj + kartica in VSA
 * vsebina pod vložiščem se pomakne navzdol (web.dev: „the root cause is
 * the addition of the new element above").
 *
 * Rešitev po web.dev kanonu „Reserve space for late-loading content":
 *  1. SSR izriše kartico z gostovskim privzetim stanjem NEVIDNO
 *     (visibility:hidden — prostor rezerviran, ni interakcije, izven a11y
 *     drevesa); ob `ready` se razkrije (obstoječi framer-motion fade).
 *     Predpogoj: vse tri shrambe (useMyTripList/useLastPlan/useGoTrip)
 *     uporabljajo useState z determinističnimi NIČLAMI + useEffect ⇒ SSR
 *     kontekst ≡ prvi hidracijski render (explore-first izhod) — 0
 *     hidracijskega mismatcha (zaklep ⑨).
 *  2. Dismiss zrcali sessionStorage v SEJNI piškotek
 *     dai:next-step-dismissed; strežniški starši ga preberejo s cookies()
 *     in kartico IZPUSTIJO že v SSR (brez rezervacije, brez premika).
 *
 * Ta datoteka: SOURCE-CONTRACT + DEFENZIVNA statična preverba (vzorec
 * mobile-overflow/deep-states-overflow) — UI komponente se NE importujejo
 * (0 omrežja, 0 DOM, 0 AI).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const CARD = readFileSync(
  join(import.meta.dir, "../src/components/next-step-card.tsx"),
  "utf8"
);

const HOME = readFileSync(
  join(import.meta.dir, "../src/components/home/home-view.tsx"),
  "utf8"
);

const PLAN_VIEW = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/nacrtuj/view.tsx"),
  "utf8"
);

const MARKET = readFileSync(
  join(import.meta.dir, "../src/components/trznica-explorer.tsx"),
  "utf8"
);

const HOME_PAGE = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/page.tsx"),
  "utf8"
);

const PLAN_PAGE = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/nacrtuj/page.tsx"),
  "utf8"
);

const MARKET_PAGE = readFileSync(
  join(import.meta.dir, "../src/app/[locale]/trznica/page.tsx"),
  "utf8"
);

const PLAN_STORE = readFileSync(
  join(import.meta.dir, "../src/lib/plan-store.ts"),
  "utf8"
);

const MY_TRIP = readFileSync(
  join(import.meta.dir, "../src/lib/my-trip.ts"),
  "utf8"
);

/** Vrata `{nextStepReady && (` — oklepaji so LITERALNI, presledki
 *  tolerirni (defenzivno proti pretipkanju/prerazporeditvi). */
const VRATA_NEXT_STEP_READY = /nextStepReady\s*&&\s*\(/g;

/** Ogledi (client komponente), kjer so ŽE bile vrata nextStepReady. */
const OGLEDI: Array<[ime: string, src: string]> = [
  ["home-view", HOME],
  ["nacrtuj/view", PLAN_VIEW],
  ["trznica-explorer", MARKET],
];

/** Strežniški starši, ki berejo piškotek in posredujejo prop. */
const STARŠI: Array<[ime: string, src: string]> = [
  ["page.tsx (domov)", HOME_PAGE],
  ["nacrtuj/page.tsx", PLAN_PAGE],
  ["trznica/page.tsx", MARKET_PAGE],
];

// ── ① SOURCE-CONTRACT: NextStepCard dobi OBVEZNI prop `ready` ──────────────

describe("POLIR13: CLS rezervacija prostora za next-step kartico", () => {
  test("① NextStepCard props: obvezni `ready: boolean` (ne opcijski) z jsdoc", () => {
    // Obvezni prop (jsdoc slovensko) — vseh 6 površin kartice ga posreduje.
    expect(CARD).toContain("ready: boolean;");
    // Opcijska oblika bi pomenila, da lahka stran pozabi posredovati ⇒
    // kartica ostane trajno invisible — zato zaklepamo OBVEZNI prop.
    expect(CARD).not.toContain("ready?: boolean");
  });

  test("② nevidna pot: zunanji motion.div dobi `invisible` do ready (vidnost, ne prikaz)", () => {
    // visibility:hidden (Tailwind invisible) rezervira prostor, kartica NI
    // interaktivna in NI v a11y drevesu, dokler kontekst ni ustaljen.
    expect(CARD).toContain('className={!ready ? "invisible" : undefined}');
    // display:none (hidden) NE bi rezerviral prostora — prepovedan.
    expect(CARD).not.toContain('className={!ready ? "hidden" : undefined}');
  });

  test("③ onDismiss piše OBA ključa: sessionStorage + sejni piškotek za strežnik", () => {
    // Reaktivna zastavica (isti zavihek).
    expect(CARD).toContain('window.sessionStorage.setItem(DISMISS_KEY, "1")');
    // Strežniško berljiv zrcal: brez max-age = sejen; path=/ + SameSite=Lax
    // točno po specifikaciji POLIR13 §4-A.
    expect(CARD).toContain(
      'document.cookie = "dai:next-step-dismissed=1; path=/; SameSite=Lax"'
    );
  });

  test("④ home-view: vrata strežniška (!nextStepDismissed) + kartica z ready", () => {
    // Stara vrata so povzročala CLS 0,161 (domov) — odstranjena.
    expect(HOME).not.toContain("nextStepReady && (");
    // Nova vrata: strežniški dismiss + posredovanje ready kartici.
    expect(HOME).toContain("!nextStepDismissed && (");
    expect(HOME).toContain('ready={nextStepReady}');
    expect(HOME).toContain('surface="home"');
    // Ovoj nespremenjen (isti razred rezervacije prostora kot pred POLIR13).
    expect(HOME).toContain(
      '"mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8"'
    );
  });

  test("⑤ nacrtuj/view: vrata strežniška (!nextStepDismissed) + kartica z ready", () => {
    expect(PLAN_VIEW).not.toContain("nextStepReady && (");
    expect(PLAN_VIEW).toContain("!nextStepDismissed && (");
    expect(PLAN_VIEW).toContain('ready={nextStepReady}');
    expect(PLAN_VIEW).toContain('surface="plan"');
    expect(PLAN_VIEW).toContain('<div className="mt-8">');
  });

  test("⑥ trznica-explorer: vrata strežniška (!nextStepDismissed) + kartica z ready", () => {
    expect(MARKET).not.toContain("nextStepReady && (");
    expect(MARKET).toContain("!nextStepDismissed && (");
    expect(MARKET).toContain('ready={nextStepReady}');
    expect(MARKET).toContain('surface="market"');
    expect(MARKET).toContain('<div className="mt-8">');
  });

  test("⑦ vsi 3 strežniški starši: cookies() + dai:next-step-dismissed + prop naprej", () => {
    for (const [ime, src] of STARŠI) {
      // cookies() iz next/headers (strežniško branje sejnega zrcala) —
      // regex dopušča vse oblike uvoza ({ cookies }, { cookies, headers }…).
      expect(
        src,
        `${ime}: import cookies`
      ).toMatch(/import\s*\{[^}]*\bcookies\b[^}]*\}\s*from\s*"next\/headers"/);
      expect(src, `${ime}: klic cookies()`).toContain("(await cookies())");
      // Točno ime piškotka.
      expect(src, `${ime}: piškotek`).toContain('get("dai:next-step-dismissed")');
      // Prop se posreduje ogledu.
      expect(src, `${ime}: prop`).toContain("nextStepDismissed={nextStepDismissed}");
    }
  });

  test("⑧ defenzivno: 0 zadetkov vrata `nextStepReady && (` v vseh 3 ogledih (regex)", () => {
    // Regex izraz (oklepaji literalno escapani) — ulovi tudi pretipkane
    // različice s poljubnimi presledki okrog &&.
    for (const [ime, src] of OGLEDI) {
      const zadetki = src.match(VRATA_NEXT_STEP_READY) ?? [];
      expect(
        zadetki.length,
        `${ime}: najdena vrata nextStepReady (${zadetki.join(", ")})`
      ).toBe(0);
    }
  });

  test("⑨ SSR-varnostni predpogoj: deterministične ničle shramb (hidracijska ujemanja)", () => {
    // plan-store: useLastPlan → saved=null, ready=false; useGoTrip →
    // go=null, ready=false (useState + useEffect ⇒ SSR ≡ 1. hidracija).
    expect(PLAN_STORE).toContain("useState<SavedPlan | null>(null)");
    expect(PLAN_STORE).toContain("useState<GoTripRecord | null>(null)");
    expect(PLAN_STORE.match(/useState\(false\)/g)?.length ?? 0).toBe(2);
    // my-trip: useMyTripList → items=[] (ničelni seznam).
    expect(MY_TRIP).toContain("useState<MyTripItem[]>([])");
  });

  test("⑩ sledljivost: oznaka POLIR13 v vseh 7 spremenjenih datotekah", () => {
    const datoteke: Array<[ime: string, src: string]> = [
      ["next-step-card.tsx", CARD],
      ["home-view.tsx", HOME],
      ["nacrtuj/view.tsx", PLAN_VIEW],
      ["trznica-explorer.tsx", MARKET],
      ["[locale]/page.tsx", HOME_PAGE],
      ["[locale]/nacrtuj/page.tsx", PLAN_PAGE],
      ["[locale]/trznica/page.tsx", MARKET_PAGE],
    ];
    for (const [ime, src] of datoteke) {
      expect(src, `${ime}: manjka oznaka POLIR13`).toContain("POLIR13");
    }
  });
});
