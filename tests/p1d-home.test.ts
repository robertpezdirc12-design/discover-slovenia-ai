/**
 * P1D-HOME TESTS (issue #3 §9 + §14) — personalizirana domača stran in
 * parity scorecard.
 *
 * SOURCE-CONTRACT (pošteno označeno, vzorec p1a/p1c): /api/trips razširitev
 * in domača sekcija so UI/DB-vezani — zaklenemo STRUKTURO izvorne kode:
 *  - /api/trips GET nosi dateStart/dateEnd/firstStop (iskrene null vrednosti);
 *  - osebna sekcija se izriše SAMO prijavljenim (gost = javni Discover);
 *  - vse poizvedbe so lastniške (session), GPS živi samo klientno;
 *  - vreme ima ISKRENA stanja (vir nedosegljiv → sporočilo, ne izmišljeno);
 *  - PARITY-SCORECARD pokriva vseh 16+ zmožnosti iz §14 z dokazi.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

const TRIPS_ROUTE = "src/app/api/trips/route.ts";
const HOME = "src/components/home/home-view.tsx";
const PERSONAL = "src/components/home/personal-home-section.tsx";
const SCORECARD = "docs/PARITY-SCORECARD.md";

// ── ① /api/trips: aditivna razširitev za osebno ploščo ──────────────────────

describe("p1d [source-contract]: /api/trips razširitev", () => {
  test("① GET nosi dateStart/dateEnd (P1-D §9 — realni datumi poti)", async () => {
    const code = await src(TRIPS_ROUTE);
    expect(code).toContain("dateStart: j.dateStart");
    expect(code).toContain("dateEnd: j.dateEnd");
    // Iskrenost: null = nedoločeno (dokumentirano v komentarju):
    expect(code).toContain("null = nedoločeno");
  });

  test("② firstStop je STREŽNIŠKO razrešen (destSlug → register, null brez ugibanja)", async () => {
    const code = await src(TRIPS_ROUTE);
    expect(code).toContain("getDestination(slug)");
    expect(code).toContain("firstStop");
    expect(code).toContain("nikoli ugib");
  });

  test("③ pokvarjen zapis pote → iskrene ničle (0/0/null, ne izjema)", async () => {
    const code = await src(TRIPS_ROUTE);
    expect(code).toContain("// Pokvarjen zapis → 0/0/null (iskrenost: števca niso znana).");
  });
});

// ── ② Osebna sekcija domov: gost/prijavljen + zasebnost ─────────────────────

describe("p1d [source-contract]: osebna sekcija domov", () => {
  test("④ se izriše SAMO prijavljenim (POLIR15-c: strežniška vrata gate prop)", async () => {
    const code = await src(PERSONAL);
    // POLIR15-c (2.42.0): vrata so ZDAJ STREŽNIŠKA (prop gate iz page.tsx —
    // getSessionGate: cache getServerSession, fail-closed); zaklep ④ iz
    // P1-D posodobljen — useSession klientni status ni več vir vrata
    // (vstavljanje sekce po hidraciji = 2 premika vsebine).
    expect(code).toContain("if (!gate) return null;");
    expect(code).not.toContain("useSession()");
  });

  test("⑤ vgrajena v HomeView za javnim Discoverjem (NextStep ostaja)", async () => {
    const home = await src(HOME);
    // POLIR15-c (2.42.0): sekca dobi strežniška vrata (personalGate).
    expect(home).toContain("<PersonalHomeSection gate={personalGate} />");
    expect(home).toContain('NextStepCard ctx={nextStepCtx} surface="home"');
  });

  test("⑥ uporablja SAMO obstoječe lastniške API-je (0 novih poti)", async () => {
    const code = await src(PERSONAL);
    expect(code).toContain('fetch("/api/trips")');
    expect(code).toContain('fetch("/api/watch")');
    expect(code).toContain('fetch("/api/notifications")');
    expect(code).toContain('fetch("/api/preferences")');
    // NI novih API poti (kanon „brez vzporednih modelov"):
    expect(code).not.toContain('fetch("/api/home');
  });

  test("⑦ GPS v bližini je 100 % klienten (haversine nad registrom, 0 strežniških klicev z lego)", async () => {
    const code = await src(PERSONAL);
    expect(code).toContain("getCurrentPosition");
    expect(code).toContain("DESTINATIONS");
    // Zasebnostni kanon izrecno zapisan:
    expect(code).toContain("nikoli ne gre na strežnik");
    // Prepovedano pošiljanje lege na strežnik:
    expect(code).not.toContain("fetch(`/api/weather?lat=${lat}");
  });

  test("⑧ vreme ima ISKRENA stanja (vir nedosegljiv → sporočilo, ne izmišljeno)", async () => {
    const code = await src(PERSONAL);
    expect(code).toContain("setState(\"unreachable\")");
    expect(code).toContain("izmišljujemo");
    expect(code).toContain("pokriva datumov");
  });

  test("⑨ ideje so DETERMINISTIČNE iz preferenc z razlogi (isti reason slovar)", async () => {
    const code = await src(PERSONAL);
    expect(code).toContain("buildCandidateReasons");
    expect(code).toContain("formatReasonsInline");
    // Personalizacija OFF → iskrena ploščica z linkom na profil:
    expect(code).toContain("ideasOff");
    expect(code).toContain('href="/moj-profil"');
    // 0-AI izrecno:
    expect(code).toContain("0-AI");
  });

  test("⑩ odprte naloge so deterministične (poti brez datumov/profil/spremljanja)", async () => {
    const code = await src(PERSONAL);
    expect(code).toContain("taskDates");
    expect(code).toContain("taskProfile");
    expect(code).toContain("taskWatch");
  });
});

// ── ③ §14 Parity scorecard ──────────────────────────────────────────────────

describe("p1d [source-contract]: PARITY-SCORECARD (issue #3 §14)", () => {
  const REQUIRED_ROWS = [
    "Personalization",
    "Long-term memory",
    "Conversational planning",
    "Reasoning",
    "Proactive assistant",
    "Watch / alerts",
    "Price monitoring",
    "Booking",
    "Itinerary",
    "Maps",
    "Collaboration",
    "Guides / creators",
    "Affiliate / provizije",
    "Offline / PWA",
    "GPS / on-trip",
    "source provenance",
    "Notification center",
    "Personalized home",
    "Zasebnost / IDOR",
    "Deterministično jedro",
  ];

  test("⑪ scorecard obstaja z glavnim ciljem (parity + superiority)", async () => {
    const doc = await src(SCORECARD);
    expect(doc).toContain("MINDTRIP PARITY");
    expect(doc).toContain("DISCOVERY SUPERIORITY");
    expect(doc).toContain("0 AI modelov");
  });

  test("⑫ vseh zmožnosti ima vrstico z dokazom (Evidence stolpec)", async () => {
    const doc = await src(SCORECARD);
    for (const row of REQUIRED_ROWS) {
      expect(doc).toContain(row);
    }
    // Vsaka vrstica nosi dokaz (datoteka/test/E2E):
    expect(doc).toContain("docs/evidence/p1-a/");
    expect(doc).toContain("docs/evidence/p1-b/");
    expect(doc).toContain("docs/evidence/p1-c/");
    expect(doc).toContain("docs/evidence/p1-d/");
  });

  test("⑬ iskrene vrzeli so dokumentirane (push, real booking, creators)", async () => {
    const doc = await src(SCORECARD);
    expect(doc).toContain("PWA push");
    expect(doc).toContain("fail-closed");
    expect(doc).toContain("Creator/guide plast");
  });
});
