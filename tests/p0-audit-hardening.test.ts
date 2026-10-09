/**
 * P0-AUDIT-HARDENING (issue #2 P0 AUDIT) — pogodbene zaklenitve varnostnih
 * in iskrenostnih popravkov iz produkcijskega pregleda.
 *
 * SOURCE-CONTRACT (vzorec p1a/p1c): zaklenemo STRUKTURO izvorne kode.
 * Če kdo vrne Math.random žetone, ne-timing-safe cron primerjavo, gole
 * --accept-data-loss, puščanje detail napak ali lažno „naročilo potrjeno",
 * regresijska mreža pade.
 *
 * Popravljeni najdi (issue #2):
 *  H1  Math.random → crypto (shareId + vabila)
 *  M1/M2/M3/M8  manjkajoči rate limiti (register/contact/newsletter/
 *      checkout/affiliate-go/trips)
 *  M4  cron Bearer NE timing-safe
 *  M5  manjkajoče varnostne glave
 *  M6  Prisma query dnevnik v produkciji (PII)
 *  L1  err.message razkritje k odjemalcu
 *  L2  checkout success URL iz glav zahteve (host-header past)
 *  Iskrenost: pasica „placilo=uspeh" trdi potrditev iz podtaknjenega URL
 */

import { describe, expect, test } from "bun:test";

import {
  allowRequest,
  clientKey,
  rateLimited,
} from "../src/lib/rate-limit";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

// ── H1: crypto-naključni žetoni (shareId + vabila) ─────────────────────────

describe("p0-audit [source-contract]: H1 — žetoni iz crypto vira, NE Math.random", () => {
  test("H1a trip-auth: issueTripInvite uporablja randomBytes (CSPRNG)", async () => {
    const code = await src("src/lib/trip-auth.ts");
    expect(code).toContain('import { randomBytes } from "crypto"');
    expect(code).toContain("cryptoToken(24)");
    // Nikjer več Math.random v tej poti:
    expect(code).not.toContain("Math.random()");
  });

  test("H1b trips/route: randomShareId uporablja randomBytes (CSPRNG)", async () => {
    const code = await src("src/app/api/trips/route.ts");
    expect(code).toContain('import { randomBytes } from "crypto"');
    expect(code).not.toContain("Math.random()");
  });
});

// ── M4: timing-safe cron primerjava ────────────────────────────────────────

describe("p0-audit [source-contract]: M4 — cron Bearer timing-safe", () => {
  test("M4a cron-auth uporablja timingSafeEqual (ne !==)", async () => {
    const code = await src("src/lib/cron-auth.ts");
    expect(code).toContain('import { timingSafeEqual } from "crypto"');
    expect(code).toContain("bearerMatches");
    expect(code).not.toMatch(/auth !== `Bearer \$\{secret\}`/);
  });
});

// ── M6: Prisma dnevnik samo v razvoju ──────────────────────────────────────

describe("p0-audit [source-contract]: M6 — query dnevnik NE v produkciji", () => {
  test("M6a db.ts pogojno logiranje (error-only v produkciji)", async () => {
    const code = await src("src/lib/db.ts");
    expect(code).toContain("process.env.NODE_ENV === 'production'");
    expect(code).not.toMatch(/^\s*log: \['query'\],\s*$/m);
  });
});

// ── M5: varnostne glave ────────────────────────────────────────────────────

describe("p0-audit [source-contract]: M5 — varnostne glave", () => {
  test("M5a next.config.ts nastavi osnovne glave na vseh poteh", async () => {
    const code = await src("next.config.ts");
    expect(code).toContain("X-Content-Type-Options");
    expect(code).toContain("nosniff");
    expect(code).toContain("X-Frame-Options");
    expect(code).toContain("Referrer-Policy");
    expect(code).toContain("Permissions-Policy");
    expect(code).toContain("Strict-Transport-Security");
  });
});

// ── M1/M2/M3/M8: rate limiti na prej odprtih poteh ─────────────────────────

describe("p0-audit [source-contract]: M1/M2/M3/M8 — rate limiti", () => {
  const routes: Array<[string, string]> = [
    ["src/app/api/auth/register/route.ts", "rateLimited(request, 5)"],
    ["src/app/api/contact/route.ts", "rateLimited(request, 5)"],
    ["src/app/api/newsletter/subscribe/route.ts", "rateLimited(request, 5)"],
    ["src/app/api/checkout/route.ts", "rateLimited(req, 10)"],
    ["src/app/api/trips/route.ts", "rateLimited(request, 10)"],
    [
      "src/app/api/trips/[shareId]/messages/route.ts",
      "rateLimited(request, 30)",
    ],
    [
      "src/app/api/trips/[shareId]/reservations/route.ts",
      "rateLimited(request, 30)",
    ],
    ["src/app/api/trips/[shareId]/polls/route.ts", "rateLimited(request, 30)"],
    [
      "src/app/api/trips/[shareId]/polls/[pollId]/vote/route.ts",
      "rateLimited(request, 30)",
    ],
  ];

  for (const [route, call] of routes) {
    test(`M8 ${route} ima ${call} + 429`, async () => {
      const code = await src(route);
      expect(code).toContain(call);
      // 429 se zgodi prek tooManyRequests() (vsebuje Retry-After) ali izrecno
      expect(code).toMatch(/tooManyRequests\(\)|status: 429/);
    });
  }

  test("M8 affiliate/go: zapis klika omejen, preusmeritev NIKOLI", async () => {
    const code = await src("src/app/api/affiliate/go/route.ts");
    expect(code).toContain("allowRequest");
    // Zapis je pogojen (mayRecord), preusmeritev pa izven pogoja:
    expect(code).toContain("if (mayRecord) {");
    expect(code).toContain("NextResponse.redirect(built.link.url, 302)");
  });

  test("M0 skupni helper rate-limit obstaja z varnostno mrežo 5.000", async () => {
    const code = await src("src/lib/rate-limit.ts");
    expect(code).toContain("5_000");
    expect(code).toContain("Retry-After");
  });
});

// ── L1: brez razkritja notranjih napak ─────────────────────────────────────

describe("p0-audit [source-contract]: L1 — detail napake NE grejo k odjemalcu", () => {
  test("L1a contact + newsletter brez err.message v odzivu", async () => {
    for (const route of [
      "src/app/api/contact/route.ts",
      "src/app/api/newsletter/subscribe/route.ts",
    ]) {
      const code = await src(route);
      expect(code).not.toContain("detail:");
      expect(code).not.toContain("err.message.split");
    }
  });
});

// ── L2: checkout origin iz env ─────────────────────────────────────────────

describe("p0-audit [source-contract]: L2 — checkout origin pripet na env", () => {
  test("L2a resolveOrigin najprej NEXT_PUBLIC_SITE_URL (https-only)", async () => {
    const code = await src("src/app/api/checkout/route.ts");
    expect(code).toContain("NEXT_PUBLIC_SITE_URL");
    expect(code).toContain("https:");
    expect(code).toContain("envSite.replace");
  });
});

// ── Iskrenost: plačilna pasica NE trdi potrditve iz URL parametra ──────────

describe("p0-audit [source-contract]: iskrenost plačilne pasice", () => {
  test("I1 banner govori „oddano/potrdilo pride", async () => {
    const code = await src(
      "src/components/marketplace/payment-return-banner.tsx",
    );
    expect(code).toContain("je bilo uspešno oddano");
    expect(code).not.toContain("naročilo je potrjeno");
  });

  test("I2 checkout modal NE trdi, da plačilo poganja Stripe, pred oddajo", async () => {
    const code = await src(
      "src/components/marketplace/checkout-modal.tsx",
    );
    // Stara UI niza NE smeta več obstajati (komentar izrecno uporablja drug
    // vrstni red besed, da ta pogodba ostane ostrokaljena na UI besedilo):
    expect(code).not.toContain("Plačilo poganja Stripe");
    expect(code).not.toContain("Payments are powered by Stripe");
    expect(code).toContain("plačilni ponudnik");
  });
});

// ── Affiliate trdnost ──────────────────────────────────────────────────────

describe("p0-audit [source-contract]: affiliate trdnost", () => {
  test("A1 dsa_aff piškotek secure v produkciji", async () => {
    const code = await src("src/app/api/affiliate/go/route.ts");
    expect(code).toContain('secure: process.env.NODE_ENV === "production"');
  });

  test("A2 tmplOverride MORA biti https (sicer padec na javno predlogo)", async () => {
    const code = await src("src/lib/affiliate-providers.ts");
    expect(code).toContain('overrideUrl.startsWith("https://")');
  });
});

// ── Podatkovna plast: db-push varovalka ────────────────────────────────────

describe("p0-audit [source-contract]: db-push varovalka", () => {
  test("D1 package.json db:push pelje skozi varovalko", async () => {
    const pkg = await Bun.file("package.json").json();
    expect(pkg.scripts["db:push"]).toBe("bun scripts/db-push-guarded.ts");
  });

  test("D2 varovalka zavrača postgres:// in zahteva file:", async () => {
    const code = await src("scripts/db-push-guarded.ts");
    expect(code).toContain('url.startsWith("postgres://")');
    expect(code).toContain('url.startsWith("file:")');
    expect(code).toContain("process.exit(1)");
  });

  test("D3 cutover-evidence/ je gitignored (pg_dump nikoli v git)", async () => {
    const gitignore = await src(".gitignore");
    expect(gitignore).toContain("cutover-evidence/");
  });
});

// ── Funkcijski testi skupnega omejevalnika (čista logika) ──────────────────

describe("p0-audit [funkcijsko]: rate-limit lib", () => {
  test("R1 dovolj do meje, čez meje zavrne", () => {
    const key = "test:ip";
    for (let i = 0; i < 5; i++) {
      expect(allowRequest(key, 5, 1_000)).toBe(true);
    }
    expect(allowRequest(key, 5, 1_000)).toBe(false);
  });

  test("R2 okno se ponastavi po 60 s", () => {
    const key = "test:reset";
    for (let i = 0; i < 3; i++) allowRequest(key, 3, 1_000);
    expect(allowRequest(key, 3, 1_000)).toBe(false);
    // 61. sekunda — novo okno:
    expect(allowRequest(key, 3, 61_001)).toBe(true);
  });

  test("R3 različni ključi so neodvisni", () => {
    allowRequest("a", 1, 1_000);
    expect(allowRequest("a", 1, 1_000)).toBe(false);
    expect(allowRequest("b", 1, 1_000)).toBe(true);
  });

  test("R4 clientKey bere x-forwarded-for prvo vrednost", () => {
    const req = new Request("https://dsa.test/x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientKey(req)).toBe("1.2.3.4");
    expect(clientKey(new Request("https://dsa.test/x"))).toBe("local");
  });

  test("R5 rateLimited uporablja clientKey + mejo", () => {
    const req = () =>
      new Request("https://dsa.test/x", {
        headers: { "x-forwarded-for": "9.9.9.9" },
      });
    expect(rateLimited(req(), 1)).toBe(false);
    expect(rateLimited(req(), 1)).toBe(true);
  });
});
