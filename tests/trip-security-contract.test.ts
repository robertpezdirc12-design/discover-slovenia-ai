/**
 * TRIP-SECURITY-CONTRACT (P0-G, issue #1 §18) — varnostne invariante
 * sodelovanja (IDOR/BOLA, vloge, vabila, CAS, ankete).
 *
 * DVE VRSTI trditev:
 *  1. VEDENJSKE — čisti deli (roleAtLeast hierarhija) tečejo povsod;
 *  2. SOURCE-CONTRACT — DB-vezane poti (brez Postgresa v peskovniku
 *     niso enotsko testabilne) zaklenemo z branjem izvorne kode:
 *     trditev ne preverja vedenja, ampak da STRUKTURA ostane
 *     fail-closed (regresijska mreža — če kdo odstrani varovalko,
 *     test pade). Pošteno označeno kot source-contract.
 */

import { describe, expect, test } from "bun:test";

import { roleAtLeast, type TripRole } from "../src/lib/trip-auth";

async function src(path: string): Promise<string> {
  return Bun.file(path).text();
}

// ── 1. VEDENJSKO: hierarhija vlog (čista funkcija) ────────────────────────

describe("trip-security: roleAtLeast — hierarhija NONE < VIEWER < EDITOR < OWNER", () => {
  const order: TripRole[] = ["NONE", "VIEWER", "EDITOR", "OWNER"];

  test("monotonost: vsaka višja vloga zadostuje nižji", () => {
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j <= i; j++) {
        expect(roleAtLeast(order[i]!, order[j]!)).toBe(true);
      }
    }
  });

  test("strogo ne: nižja vloga NE zadostuje višji", () => {
    expect(roleAtLeast("NONE", "VIEWER")).toBe(false);
    expect(roleAtLeast("VIEWER", "EDITOR")).toBe(false);
    expect(roleAtLeast("EDITOR", "OWNER")).toBe(false);
    expect(roleAtLeast("NONE", "OWNER")).toBe(false);
  });

  test("identiteta: vsaka vloga zadostuje sebi", () => {
    for (const r of order) expect(roleAtLeast(r, r)).toBe(true);
  });
});

// ── 2. SOURCE-CONTRACT: fail-closed struktura varnostnih poti ────────────

describe("trip-security [source-contract]: trip-auth.ts — IDOR/BOLA jedro", () => {
  test("zasebna pot + vloga NONE → null (404 klicatelju, obstoj se ne razkrije)", async () => {
    const s = await src("src/lib/trip-auth.ts");
    expect(s).toContain('if (!ctx.journey.isPublic && ctx.role === "NONE") return null;');
  });

  test("getTripForWrite je fail-closed 401/403/404; zasebna+NONE = 404 (ne 403)", async () => {
    const s = await src("src/lib/trip-auth.ts");
    expect(s).toContain("export async function getTripForWrite");
    expect(s).toContain("status: 401");
    expect(s).toContain("status: 403");
    expect(s).toContain("status: 404");
  });

  test("vloga NIKOLI ne pride iz klienta — samo iz ownerId/TripCollaborator (strežniška)", async () => {
    const s = await src("src/lib/trip-auth.ts");
    expect(s).toContain("journey.ownerId === userId");
    expect(s).toContain("where: { journeyId_userId: { journeyId: journey.id, userId } }");
  });
});

describe("trip-security [source-contract]: /api/trips/[shareId] — mutacije", () => {
  test("PATCH: privzeto EDITOR+, preklop javnosti pa OWNER (najstrožja zahteva)", async () => {
    const s = await src("src/app/api/trips/[shareId]/route.ts");
    expect(s).toContain('const minRole = wantsPublic ? "OWNER" : "EDITOR";');
    expect(s).toContain("const guard = await getTripForWrite(shareId, minRole);");
    // Preimenovanje nosi CAS — razhod baseVersion → 409
    expect(s).toContain("{ status: 409 }");
  });

  test("DELETE je izrecno nepodprt (405) — brisanje ni del obsega", async () => {
    const s = await src("src/app/api/trips/[shareId]/route.ts");
    expect(s).toContain("{ status: 405 }");
  });

  test("realni datumi poti gredo skozi validateTripDates (fail-closed 400)", async () => {
    const s = await src("src/app/api/trips/[shareId]/route.ts");
    expect(s).toContain("const v = validateTripDates(body.tripDates);");
    expect(s).toContain("if (!v.ok) {");
  });
});

describe("trip-security [source-contract]: collaborators — VSA dejanja OWNER-only", () => {
  test("POST vabila / PATCH vloge / Ponovno povabi / DELETE so vsi za OWNER (≥ 4 varovalke)", async () => {
    const s = await src("src/app/api/trips/[shareId]/collaborators/route.ts");
    const guards = s.match(/getTripForWrite\(shareId, "OWNER"\)/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(4);
  });

  test("vabilo je enkratni žeton v URL-ju (invite=?token)", async () => {
    const s = await src("src/app/api/trips/[shareId]/collaborators/route.ts");
    // P3 (2.26.0): inviteUrl je zgrajen kot spremenljivka (e-pošta ga
    // potrebuje kot absolutno povezavo) — žeton ostaja v ?invite=.
    expect(s).toContain("const inviteUrl = `/pot/${shareId}?invite=${token}`");
    expect(s).toContain("inviteUrl,");
  });
});

describe("trip-security [source-contract]: sprejem vabila — enkratno, transakcijsko", () => {
  test("PATCH /api/invites/[token]: 401/403/409 poti + $transaction (brez delne sprejetosti)", async () => {
    const s = await src("src/app/api/invites/[token]/route.ts");
    expect(s).toContain("$transaction");
    expect(s).toContain("{ status: 401 }");
    expect(s).toContain("{ status: 403 }");
    expect(s).toContain("{ status: 409 }");
  });
});

describe("trip-security [source-contract]: ankete — vezanost na pot + glasovanje VIEWER+", () => {
  test("mutacije anket so vezane na journeyId (ne na povsem prost pollId — BOLA)", async () => {
    const s = await src("src/app/api/trips/[shareId]/polls/route.ts");
    expect(s).toContain("where: { journeyId");
    expect(s).toContain("getTripForWrite(shareId");
  });

  test("vote pot zahteva vlogo ≥ VIEWER (getTripForWrite)", async () => {
    const s = await src(
      "src/app/api/trips/[shareId]/polls/[pollId]/vote/route.ts",
    );
    expect(s).toContain('getTripForWrite(shareId, "VIEWER")');
  });
});

// ── 3. SOURCE-CONTRACT: P0-G UI doslednost (geo URI + QR + ICS) ─────────

describe("trip-p0g [source-contract]: Go Mode geo: URI + geofence v UI", () => {
  test("na-poti stran ponudi geo: (sistemski zemljevidi) zraven OSM povezave", async () => {
    const s = await src("src/app/[locale]/na-poti/view.tsx");
    expect(s).toContain("geoUri(current.coords)");
    expect(s).toContain("geoUri(next.coords)");
    expect(s).toContain("arrivedNow"); // geofence prihoda uporabljen v UI
    expect(s).toContain('variant={arrivedNow?.arrived ? "default" : "secondary"}');
  });
});

describe("trip-p0g [source-contract]: shared-trip-view — pravi QR + ICS izvoz", () => {
  test("QR nima več placeholderja (v pripravi) — pravi izris qrcode", async () => {
    const s = await src("src/components/content/shared-trip-view.tsx");
    expect(s).toContain("QRCode.toCanvas");
    expect(s).not.toContain("v pripravi");
  });

  test("ICS izvoz ŽIV samo ob realnih datumih (iskrena odsotnost sicer)", async () => {
    const s = await src("src/components/content/shared-trip-view.tsx");
    expect(s).toContain("buildTripIcs");
    expect(s).toContain("{db.tripDates && (");
  });
});
