/**
 * P1A-SECURITY-CONTRACT (issue #3 §1/§2/§11) — IDOR/BOLA izolacija osebne
 * plasti (preferences + memory), fail-closed personalizacijska zapora,
 * sanitizacija vhodov, revizijska sled in 0-AI poštenost.
 *
 * SOURCE-CONTRACT (pošteno označeno): API poti v peskovniku niso enotsko
 * testabilne brez žive seje — zaklenemo STRUKTURO izvorne kode. Če kdo
 * odstrani session preverbo, sestavljeni where poizvedbi (IDOR),
 * personalizacijsko zaporo, guard ali revizijo, regresijska mreža pade.
 */

import { describe, expect, test } from "bun:test";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

const PREF_ROUTE = "src/app/api/preferences/route.ts";
const MEM_ROUTE = "src/app/api/memory/route.ts";
const MEM_ID_ROUTE = "src/app/api/memory/[id]/route.ts";
const PAGE = "src/app/[locale]/moj-profil/view.tsx";
const SERVER_LIB = "src/lib/user-preferences-server.ts";
const PURE_LIB = "src/lib/user-preferences.ts";

// ── ① Avtentikacija: 401 za goste na VSAKI poti ────────────────────────────

describe("p1a [source-contract]: avtentikacija (401 gostje)", () => {
  for (const route of [PREF_ROUTE, MEM_ROUTE, MEM_ID_ROUTE]) {
    test(`① ${route} zahteva sejo (getSessionUserId + 401)`, async () => {
      const code = await src(route);
      expect(code).toContain("getSessionUserId");
      expect(code).toContain("status: 401");
      // Fail-closed: brez userId se NE sme zgoditi noben DB dostop prej:
      expect(code).toContain("if (!userId) return guest();");
    });
  }
});

// ── ② IDOR/BOLA: sestavljene poizvedbe po userId ───────────────────────────

describe("p1a [source-contract]: IDOR izolacija", () => {
  test("② vsaka poizvedba po preferencah nosi userId (where: { userId })", async () => {
    const code = await src(PREF_ROUTE);
    expect(code).toContain("where: { userId }");
    expect(code).toContain("userId_key: { userId, key }"); // upsert je vlastniški
    expect(code).toContain("where: { userId, key }"); // deleteMany je vlastniški
    // Prepovedana oblika: poizvedba samo po ključu brez userId:
    expect(code).not.toContain("deleteMany({\n      where: { key }");
  });

  test("③ PATCH/DELETE [id] preverita lastništvo (404 za tuje, ne 403)", async () => {
    const code = await src(MEM_ID_ROUTE);
    // DELETE: sestavljena poizvedba { id, userId } — tuji zapis ni dosegljiv:
    expect(code).toContain("where: { id, userId, active: true }");
    // PATCH: eksplicitno preverjanje lastništva po branju:
    expect(code).toContain("existing.userId !== userId");
    expect(code).toContain("status: 404");
    // Prepovedano: razkritje obstoja tujega zapisa z 403:
    expect(code).not.toContain("status: 403 }");
  });

  test("④ spomin ruti vedno vračata where: { userId … } poizvedbe", async () => {
    const code = await src(MEM_ROUTE);
    expect(code).toContain("where: { userId, active: true }");
    expect(code).toContain("where: { userId }");
  });
});

// ── ③ Personalizacijska zapora (fail-closed) ───────────────────────────────

describe("p1a [source-contract]: personalizacijska zapora", () => {
  test("⑤ POST /api/memory ZAVRNE nove zapise, ko je personalizacija izklopljena (403)", async () => {
    const code = await src(MEM_ROUTE);
    expect(code).toContain("isPersonalizationOff(prefRows)");
    expect(code).toContain("status: 403");
    expect(code).toContain("ne zbiramo");
  });

  test("⑥ DELETE forget-all deluje TUDI pri izklopu (pravica izbrisa)", async () => {
    const code = await src(MEM_ROUTE);
    // Pozabi-vse NE preverja isPersonalizationOff (arhiviranje je dovoljeno):
    const deleteSection = code.slice(code.indexOf("export async function DELETE"));
    expect(deleteSection).not.toContain("isPersonalizationOff");
    expect(deleteSection).toContain("confirm");
    expect(deleteSection).toContain("forget-all");
  });

  test("⑦ agentska pot getPersonalContext pri izklopu spomina SPOLOH NE bere", async () => {
    const code = await src(SERVER_LIB);
    expect(code).toContain("getPersonalContext");
    // Vračilo PRAZNEGA konteksta pred vsakim memoryItem klicem:
    const gateBlock = code.slice(
      code.indexOf("export async function getPersonalContext")
    );
    const returnIdx = gateBlock.indexOf("return { enabled: false, profile, memories: [] };");
    const memReadIdx = gateBlock.indexOf("db.memoryItem.findMany");
    expect(returnIdx).toBeGreaterThan(-1);
    expect(memReadIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeLessThan(memReadIdx);
  });

  test("⑧ pozaba-vse zahteva izrecno potrditev ?confirm=forget-all (400 brez)", async () => {
    const code = await src(MEM_ROUTE);
    expect(code).toContain('confirm !== "forget-all"');
  });
});

// ── ④ Sanitizacija + injekcijska zaščita na vsaki meji ─────────────────────

describe("p1a [source-contract]: SYSTEM_DATA_GUARD na mejah", () => {
  test("⑨ čista plast uvaža sanitizeUntrustedText + detectPromptInjection", async () => {
    const code = await src(PURE_LIB);
    expect(code).toContain("sanitizeUntrustedText");
    expect(code).toContain("detectPromptInjection");
    expect(code).toContain("injection: true");
  });

  test("⑩ validacija preferenc in spomina je STREŽNIŠKA (izvoženi validatorji)", async () => {
    const code = await src(PURE_LIB);
    expect(code).toContain("export function validatePreferenceValue");
    expect(code).toContain("export function validateMemoryInput");
    // Rute jih dejansko uporabljajo:
    expect(await src(PREF_ROUTE)).toContain("validatePreferenceValue(");
    expect(await src(MEM_ROUTE)).toContain("validateMemoryInput(");
    expect(await src(MEM_ID_ROUTE)).toContain("validateMemoryInput(");
  });
});

// ── ⑤ Revizijska sled (append-only AuditLog) ───────────────────────────────

describe("p1a [source-contract]: revizija dejanj", () => {
  test("⑪ vsa kanonska dejanja so definirana na enem mestu", async () => {
    const code = await src(PURE_LIB);
    for (const action of [
      "preference.updated",
      "preference.deleted",
      "memory.created",
      "memory.updated",
      "memory.deleted",
      "memory.forget_all",
      "memory.purged",
    ]) {
      expect(code).toContain(`"${action}"`);
    }
  });

  test("⑫ rute zapisujejo revizijo prek writePersonalAudit (actorType customer)", async () => {
    const serverCode = await src(SERVER_LIB);
    expect(serverCode).toContain('actorType: "customer"');
    expect(serverCode).toContain("auditLog.create");
    for (const route of [PREF_ROUTE, MEM_ROUTE, MEM_ID_ROUTE]) {
      const code = await src(route);
      expect(code).toContain("writePersonalAudit");
    }
  });
});

// ── ⑥ Omejevanje hitrosti (rate limit) ─────────────────────────────────────

describe("p1a [source-contract]: omejevanje hitrosti", () => {
  const rateRoutes = [PREF_ROUTE, MEM_ROUTE, MEM_ID_ROUTE];
  for (const route of rateRoutes) {
    test(`⑬ ${route} ima omejitev 30/min z varnostno mrežo 5000`, async () => {
      const code = await src(route);
      expect(code).toContain("const RATE_LIMIT = 30");
      expect(code).toContain("rateBuckets.size > 5_000");
      expect(code).toContain("status: 429");
    });
  }
});

// ── ⑦ 0-AI poštenost (determinizem brez LLM) ───────────────────────────────

describe("p1a [source-contract]: 0-AI (brez LLM/omrežja)", () => {
  for (const file of [PURE_LIB, SERVER_LIB]) {
    test(`⑭ ${file} ne vsebuje LLM/omrežnih klicev`, async () => {
      const code = await src(file);
      expect(code).not.toContain("z-ai");
      expect(code).not.toContain("openai");
      expect(code).not.toContain("anthropic");
      expect(code).not.toContain("fetch(");
      expect(code).not.toContain("https://");
    });
  }
});

// ── ⑧ Shema: modeli + kaskadno brisanje ────────────────────────────────────

describe("p1a [source-contract]: Prisma modeli", () => {
  test("⑮ UserPreference + MemoryItem obstajata z unikatnimi/iskalnimi ključi", async () => {
    const schema = await src("prisma/schema.prisma");
    expect(schema).toContain("model UserPreference");
    expect(schema).toContain("@@unique([userId, key])");
    expect(schema).toContain("model MemoryItem");
    expect(schema).toContain("@@index([userId, active, updatedAt])");
    // Kaskadno brisanje z uporabnikom (pozabi ob izbrisu računa):
    expect(schema).toContain(
      "user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)"
    );
  });
});

// ── ⑨ UI + navigacija ──────────────────────────────────────────────────────

describe("p1a [source-contract]: UI /moj-profil", () => {
  test("⑯ stran obstaja z iskrenim neprijavljenim stanjem", async () => {
    const code = await src(PAGE);
    expect(code).toContain("unauthenticated");
    expect(code).toContain("/prijava");
    expect(code).toContain("Kaj si zapomnim o tebi");
    expect(code).toContain("forget-all");
    expect(code).toContain('confirm=forget-all');
  });

  test("⑰ navigacija Račun vsebuje Moj profil", async () => {
    const code = await src("src/components/layout/nav-groups.ts");
    expect(code).toContain('"/moj-profil"');
    expect(code).toContain("Moj profil");
  });
});
