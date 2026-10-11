import { describe, expect, test } from "bun:test";

/**
 * QA U14 (2026-10-11) — 429 (omejitev 30 sporočil/min) je bil v klepetu
 * TIH (API je vrnil [200,200,200,429], UI pa se tiho ponastavil).
 *
 * SOURCE-CONTRACT (enak kanon kot tests/p0h-ui-contract.test.ts): UI
 * komponente so "use client" elementi — zaklenemo STRUKTURO izvorne kode:
 *  · veja res.status === 429 z VIDNIM opomnikom v klepetu (role="alert");
 *  · besedilo v 6 jezikih po vzorcu pick (kanon i18n-pick);
 *  · besedilo uporabnika se ob 429 NE izgubi (ostane v vnosnem polju).
 * Zraven zaklenemo še U5 vezavo: messages ruta poda svetovalcu datume poti.
 */

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("QA U14 [source-contract]: viden odziv na 429 v klepetu", () => {
  test("① veja 429 obstaja PRED generično napako (ne pade v throw)", async () => {
    const code = await src("src/components/trips/trip-chat.tsx");
    expect(code).toContain("res.status === 429");
    // veja 429 je nad splošnim throw (vrne, ne pa izgubi besedila)
    const idx429 = code.indexOf("res.status === 429");
    const idxThrow = code.indexOf("throw new Error");
    expect(idx429).toBeGreaterThan(-1);
    expect(idxThrow).toBeGreaterThan(idx429);
  });

  test("② viden opomnik v klepetu (role=alert — ne le minljiv toast)", async () => {
    const code = await src("src/components/trips/trip-chat.tsx");
    expect(code).toContain("rateLimited");
    expect(code).toContain('role="alert"');
  });

  test("③ besedilo v 6 jezikih po vzorcu pick (sl/en/it/de/fr/es)", async () => {
    const code = await src("src/components/trips/trip-chat.tsx");
    expect(code).toContain("RATE_LIMIT_NOTICE");
    expect(code).toContain('sl: "Prehitro si');
    expect(code).toContain('en: "You');
    expect(code).toContain("it:");
    expect(code).toContain("de:");
    expect(code).toContain("fr:");
    expect(code).toContain("es:");
    expect(code).toContain("pick(l, RATE_LIMIT_NOTICE)");
  });

  test("④ ob 429 besedila NE počistimo (vrača pred setText(\"\") — sporočilo ostane)", async () => {
    const code = await src("src/components/trips/trip-chat.tsx");
    const idx429 = code.indexOf("if (res.status === 429) {");
    const idxSetText = code.indexOf('setText("")');
    expect(idx429).toBeGreaterThan(-1);
    expect(idxSetText).toBeGreaterThan(idx429); // setText("") je šele za uspehom
  });

  test("⑤ opomnik se izbriše ob naslednji uspešni objavi", async () => {
    const code = await src("src/components/trips/trip-chat.tsx");
    expect(code).toContain("setRateLimited(false)");
  });
});

describe("QA U5 [source-contract]: svetovalec prejme datume poti", () => {
  test("⑥ messages ruta poda dateStart/dateEnd v kontekst svetovalca", async () => {
    const code = await src("src/app/api/trips/[shareId]/messages/route.ts");
    expect(code).toContain("tripDates");
    expect(code).toContain("journey.dateStart");
    expect(code).toContain("journey.dateEnd");
  });

  test("⑦ advisor kontekst razglasi dnevno napoved (dep injiciran, strežniško)", async () => {
    const code = await src("src/lib/advisor/context.ts");
    expect(code).toContain("fetchDailyWeather");
    expect(code).toContain("api.open-meteo.com");
  });
});
