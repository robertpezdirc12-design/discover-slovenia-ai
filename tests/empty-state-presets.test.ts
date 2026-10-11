import { describe, expect, test } from "bun:test";

/**
 * POLIR B (2.28.0) — prazno stanje /moja-potovanja z one-click vzorčnimi
 * načrti (Link na /nacrtuj?preset=<id>).
 *
 * SOURCE-CONTRACT (kanon tests/trip-chat-rate-limit.test.ts): prazno stanje
 * navaja preset ID-je, ki jih NE definiramo sami — živijo v PRESETS seznamu
 * na /nacrtuj (nacrtuj/view.tsx, ?preset= avto-generacija). Če kdorkoli
 * preimenuje/odstrani prednastavitev na /nacrtuj, ta test takoj pade
 * (razbita povezava = tiha nedelujoča funkcija, kar je nesprejemljivo).
 * Zraven zaklenemo i18n popolnost ×6 novih ključev.
 * 0 omrežja — testi berejo izključno izvorno kodo.
 */

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

/** Izlušči vse `id: "…"` iz bloka, ki se začne pri `anchor`. */
function idsInBlock(code: string, anchor: string): string[] {
  const start = code.indexOf(anchor);
  expect(start).toBeGreaterThan(-1);
  const end = code.indexOf("];", start);
  const block = code.slice(start, end);
  return [...block.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
}

/** Izlušči vrstico/blok slovarja za ključ L (do zaključka `},`). */
function dictBlock(code: string, key: string): string {
  const start = code.indexOf(`${key}: {`);
  expect(start).toBeGreaterThan(-1);
  const end = code.indexOf("},", start);
  return code.slice(start, end);
}

const LANGS = ["sl", "en", "it", "de", "fr", "es"] as const;

describe("POLIR B [source-contract]: vzorčni načrti v praznem stanju moja-potovanja", () => {
  test("① vsak preset id iz praznega stanja OBSTOJA v PRESETS na /nacrtuj", async () => {
    const moja = await src("src/app/[locale]/moja-potovanja/view.tsx");
    const nacrtuj = await src("src/app/[locale]/nacrtuj/view.tsx");

    const sampleIds = idsInBlock(moja, "const SAMPLE_PLANS");
    const presetIds = idsInBlock(nacrtuj, "const PRESETS");

    // naloga zahteva 2-3 gumbe — prazno stanje brez njih je mrtvo
    expect(sampleIds.length).toBeGreaterThanOrEqual(2);
    expect(sampleIds.length).toBeLessThanOrEqual(3);
    expect(new Set(sampleIds).size).toBe(sampleIds.length); // brez duplikatov

    for (const id of sampleIds) {
      expect(presetIds).toContain(id);
    }
  });

  test("② povezave gumbov vodijo na /nacrtuj?preset=<id> (avto-generacija)", async () => {
    const moja = await src("src/app/[locale]/moja-potovanja/view.tsx");
    expect(moja).toContain("/nacrtuj?preset=${p.id}");

    // ciljna logika na /nacrtuj res podpira ?preset= (izhodišna pogodba)
    const nacrtuj = await src("src/app/[locale]/nacrtuj/view.tsx");
    expect(nacrtuj).toContain('searchParams.get("preset")');
    expect(nacrtuj).toContain("PRESETS.find");
  });

  test("③ naslov sekcije + gumbi v praznem stanju (Začni z vzorčnim načrtom)", async () => {
    const moja = await src("src/app/[locale]/moja-potovanja/view.tsx");
    expect(moja).toContain("Začni z vzorčnim načrtom");
    expect(moja).toContain("Vzorčni načrt: ");
    // dotik ≥44 px (hišni a11y kanon .tap-target / min-h-11)
    expect(moja).toContain("min-h-11");
  });

  test("④ i18n popolnost ×6 novih ključev (sampleTitle/samplePlan/sampleNote)", async () => {
    const moja = await src("src/app/[locale]/moja-potovanja/view.tsx");
    for (const key of ["sampleTitle", "samplePlan", "sampleNote"] as const) {
      const block = dictBlock(moja, key);
      for (const lang of LANGS) {
        expect(block).toContain(`${lang}:`);
      }
    }
    // naslovi vzorčnih načrtov prav tako ×6 (vidni so v vseh jezikih)
    const sampleBlock = moja.slice(
      moja.indexOf("const SAMPLE_PLANS"),
      moja.indexOf("];", moja.indexOf("const SAMPLE_PLANS")),
    );
    for (const lang of LANGS) {
      const count = sampleBlock.split(`${lang}: "`).length - 1;
      expect(count).toBe(3); // vsak od 3 vzorčnih načrtov nosi naslov
    }
  });

  test("⑤ iskrena opomba: fiksni vnosi v deterministični motor — brez AI", async () => {
    const moja = await src("src/app/[locale]/moja-potovanja/view.tsx");
    // slovenska resnica (kanon):
    expect(moja).toContain(
      "Vzorčni načrti so fiksni vnosi v isti deterministični motor — brez AI, brez ugibanj.",
    );
    // prevodi istega sporočila (nikoli brez opombe v tujih jezikih):
    expect(moja).toContain("same deterministic engine — no AI, no guessing");
    expect(moja).toContain("stesso motore deterministico — niente AI");
    expect(moja).toContain("dieselbe deterministische Engine — keine KI");
    expect(moja).toContain("même moteur déterministe — pas d’IA");
    expect(moja).toContain("mismo motor determinista — sin IA");
  });

  test("⑥ prazno stanje obdrži prvotni CTA (Razišči destinacije) — nič ne odstranimo", async () => {
    const moja = await src("src/app/[locale]/moja-potovanja/view.tsx");
    expect(moja).toContain("Zbirka je prazna");
    expect(moja).toContain('href="/destinacije"');
  });
});
