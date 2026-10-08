/**
 * P1C-SECURITY-CONTRACT (issue #3 §4/§10 + §11) — IDOR izolacija spremljanj
 * in obvestil, cron zaščita, idempotenca dedupe, bounded preverjanje,
 * strežniško določeni cilji in 0-AI poštenost.
 *
 * SOURCE-CONTRACT (pošteno označeno, vzorec p1a): API poti v peskovniku niso
 * enotsko testabilne brez žive seje — zaklenemo STRUKTURO izvorne kode.
 * Če kdo odstrani session preverbo, sestavljeno where poizvedbo (IDOR),
 * cron skrivnost, dedupe ali zasedeno mejo, regresijska mreža pade.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

const WATCH_ROUTE = "src/app/api/watch/route.ts";
const WATCH_ID_ROUTE = "src/app/api/watch/[id]/route.ts";
const NOTIF_ROUTE = "src/app/api/notifications/route.ts";
const CRON_ROUTE = "src/app/api/cron/watch-check/route.ts";
const ENGINE = "src/lib/watch-engine.ts";
const SERVER = "src/lib/watch-server.ts";
const SCHEMA = "prisma/schema.prisma";
const NAV = "src/components/layout/navigation.tsx";
const NAV_GROUPS = "src/components/layout/nav-groups.ts";
const BELL = "src/components/layout/notification-bell.tsx";
const PAGE = "src/app/[locale]/notifikacije/page.tsx";
const MARKET = "src/components/marketplace/own-marketplace-section.tsx";
const TRIP_VIEW = "src/components/content/shared-trip-view.tsx";

// ── ① Avtentikacija: 401 za goste na VSAKI poti ─────────────────────────────

describe("p1c [source-contract]: avtentikacija (401 gostje)", () => {
  for (const route of [WATCH_ROUTE, WATCH_ID_ROUTE, NOTIF_ROUTE]) {
    test(`① ${route} zahteva sejo (getSessionUserId + fail-closed 401)`, async () => {
      const code = await src(route);
      expect(code).toContain("getSessionUserId");
      expect(code).toContain("status: 401");
      expect(code).toContain("if (!userId) return guest();");
    });
  }
});

// ── ② IDOR/BOLA: sestavljene poizvedbe po userId ────────────────────────────

describe("p1c [source-contract]: IDOR izolacija", () => {
  test("② watch/[id]: PATCH in DELETE nosita { id, userId } (tuji = 404)", async () => {
    const code = await src(WATCH_ID_ROUTE);
    expect(code).toContain("findFirst({\n      where: { id, userId },");
    expect(code).toContain("where: { id, userId }"); // updateMany/deleteMany vlastniški
    expect(code).toContain("status: 404");
    // Ne razkrivamo obstoja tujega zapisa z 403:
    expect(code).not.toContain("status: 403 }");
  });

  test("③ notifications: PATCH enega nosi { id, userId }; DELETE/GET samo userId", async () => {
    const code = await src(NOTIF_ROUTE);
    expect(code).toContain("where: { id: body.id, userId }");
    expect(code).toContain("findFirst({\n      where: { id: body.id, userId },");
    expect(code).toContain("where: { userId, readAt: null }");
    // Brisanje samo lastnikovih (userId vedno v where):
    expect(code).toContain("userId,\n        ...(readOnly");
  });

  test("④ watch POST: cilj obstaja STREŽNIŠKO (ime cilja določi strežnik)", async () => {
    const code = await src(WATCH_ROUTE);
    expect(code).toContain("db.product.findUnique");
    expect(code).toContain("product.status !== \"published\"");
    expect(code).toContain("getTripContext(targetId)");
    expect(code).toContain("ctx.role === \"NONE\"");
    // Ime cilja NIKOLI iz klienta:
    expect(code).not.toContain("body.targetName");
  });

  test("⑤ cron vrednotenje spošuje dostop do pote (zasebnost §11)", async () => {
    const code = await src(SERVER);
    // Brez dostopa (ne lastnik, ne sodelujoč, ne javna) → NE vrednoti:
    expect(code).toContain("!journey.isPublic");
    expect(code).toContain("journey.ownerId !== w.userId");
    expect(code).toContain("allowedPairs.has(`${journey.id}:${w.userId}`)");
  });
});

// ── ③ Cron: skrivnost, idempotenca, bounded ─────────────────────────────────

describe("p1c [source-contract]: cron kanoni", () => {
  test("⑥ /api/cron/watch-check je Bearer CRON_SECRET fail-closed", async () => {
    const code = await src(CRON_ROUTE);
    expect(code).toContain("requireCronSecret(req)");
    expect(code).toContain("if (denied) return denied;");
    expect(code).toContain("runWatchCheck");
  });

  test("⑦ urnik je registriran v vercel.json", async () => {
    const code = await src("vercel.json");
    expect(code).toContain("/api/cron/watch-check");
  });

  test("⑧ dedupe: (userId, dedupeKey) unique → P2002 = prezrto (idempotenca)", async () => {
    const code = await src(SERVER);
    expect(code).toContain('code === "P2002"');
    expect(code).toContain("duplicatesSkipped += 1");
  });

  test("⑨ bounded: največ 12 vremenskih lokacij na zagon", async () => {
    const code = await src(SERVER);
    expect(code).toContain("WATCH_WEATHER_MAX_COORDS = 12");
    expect(code).toContain(".slice(0, WATCH_WEATHER_MAX_COORDS)");
  });

  test("⑩ revizija: vsak zagon cron zapiše watch.check_run", async () => {
    const code = await src(SERVER);
    expect(code).toContain("watchCheckRun");
    expect(code).toContain("actorType: \"system\"");
  });
});

// ── ④ Shema: unikatnost + kaskade ───────────────────────────────────────────

describe("p1c [source-contract]: shema (dedupe + izolacija)", () => {
  test("⑪ WatchItem: unique(userId,kind,targetKind,targetId) + kaskada na User", async () => {
    const schema = await src(SCHEMA);
    expect(schema).toContain("model WatchItem");
    expect(schema).toContain("@@unique([userId, kind, targetKind, targetId])");
    expect(schema).toContain("@@index([state, kind])");
  });

  test("⑫ Notification: unique(userId,dedupeKey) + readAt + kaskada", async () => {
    const schema = await src(SCHEMA);
    expect(schema).toContain("model Notification");
    expect(schema).toContain("@@unique([userId, dedupeKey])");
    expect(schema).toContain("@@index([userId, readAt, createdAt])");
  });

  test("⑬ User nosi obe relaciji (watches + notifications)", async () => {
    const schema = await src(SCHEMA);
    expect(schema).toContain("watches      WatchItem[]");
    expect(schema).toContain("notifications Notification[]");
  });
});

// ── ⑤ 0-AI poštenost + guard na mejah ───────────────────────────────────────

describe("p1c [source-contract]: 0-AI in guard", () => {
  test("⑭ watch-engine je ČIST (0 db, 0 fetch, 0 z-ai) z guardom na vhodu", async () => {
    const code = await src(ENGINE);
    expect(code).toContain("sanitizeUntrustedText");
    expect(code).toContain("detectPromptInjection");
    // 0-AI prepovedi (kanon projekta):
    expect(code).not.toContain("z-ai");
    expect(code).not.toContain("from \"@/lib/db\"");
    expect(code).not.toContain("fetch(");
  });

  test("⑮ zavrnjene vrste so v registru in pot jih odkloni prek validatorja", async () => {
    const engine = await src(ENGINE);
    expect(engine).toContain("UNSUPPORTED_WATCH_KINDS");
    expect(engine).toContain("availability");
    expect(engine).toContain("flight");
    const route = await src(WATCH_ROUTE);
    expect(route).toContain("validateWatchInput");
  });

  test("⑯ iskrenost cene: baseline brez prejšnje preverljive cene (brez opozorila)", async () => {
    const engine = await src(ENGINE);
    expect(engine).toContain("status: \"baseline\"");
    expect(engine).toContain("previous");
  });

  test("⑰ PWA push NI implementiran (iskrena opomba v UI)", async () => {
    const page = await src(PAGE);
    expect(page).toContain("PWA push NI implementiran");
  });
});

// ── ⑥ UI povezava (zvonček, center, gumbi) ─────────────────────────────────

describe("p1c [source-contract]: UI povezava", () => {
  test("⑱ zvonček je v glavi (navigation) in se skrije za goste", async () => {
    const nav = await src(NAV);
    expect(nav).toContain("<NotificationBell />");
    const bell = await src(BELL);
    expect(bell).toContain("notifications?summary=1");
    expect(bell).toContain("status !== \"authenticated\"");
  });

  test("⑲ stran /notifikacije obstaja z dostopom do obeh API-jev", async () => {
    const page = await src(PAGE);
    expect(page).toContain("/api/notifications");
    expect(page).toContain("/api/watch");
  });

  test("⑳ navigacijski vnos Obvestila v skupini Račun (6 jezikov)", async () => {
    const groups = await src(NAV_GROUPS);
    expect(groups).toContain('href: "/notifikacije"');
    expect(groups).toContain('es: "Notificaciones"');
  });

  test("㉑ gumb Spremljaj ceno na tržnici", async () => {
    const market = await src(MARKET);
    expect(market).toContain("WatchPriceButton");
  });

  test("㉒ meni Spremljaj na poti (samo udeleženci — canParticipate)", async () => {
    const view = await src(TRIP_VIEW);
    expect(view).toContain("TripWatchMenu");
    expect(view).toContain("canParticipate && (");
  });
});

// ── ⑦ Rate limit na mutacijah ───────────────────────────────────────────────

describe("p1c [source-contract]: omejitve zahtevkov", () => {
  test("㉓ vse tri uporabniške poti imajo pomnilniški rate limit", async () => {
    for (const route of [WATCH_ROUTE, WATCH_ID_ROUTE, NOTIF_ROUTE]) {
      const code = await src(route);
      expect(code).toContain("rateLimited(request)");
      expect(code).toContain("status: 429");
    }
  });
});
