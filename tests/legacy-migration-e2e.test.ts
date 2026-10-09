/**
 * LEGACY-MIGRATION E2E (issue #2 §1/§3) — dokaz prenosa v živo.
 *
 * Za razliko od tests/legacy-migration.test.ts (čiste preslikave) ta test
 * ZAGRAJE CELO POT: materializira legacy bazo (shema 1.163.4 preslikana v
 * SQLite — enaka mehanska preslikava kot pg-schema-sync, samo v obratni
 * smeri) + novo 2.x bazo, vnese fixture vrstice, požene SKRIPTO kot proces
 * (dry-run → apply) in preveri števila po tabelah. Drugi --apply MORA
 * prenesti 0 novih zapisov (idempotenca — issue #2 "ponovljiva, idempotentna").
 *
 * Zahteva prisma CLI (bunx prisma — na voljo v peskovniku in CI).
 */

import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const T = "2026-01-15T10:00:00.000Z";

function run(cmd: string[], env: Record<string, string>): { exitCode: number; out: string; err: string } {
  const proc = Bun.spawnSync(cmd, {
    cwd: import.meta.dir + "/..",
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    out: proc.stdout.toString(),
    err: proc.stderr.toString(),
  };
}

describe("migrate-legacy-data — E2E (dve bazi, skripta, idempotenca)", () => {
  test("dry-run → apply → apply: prenos je pravilen in idempotenten", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dsa-mig-"));
    const legacySchemaPath = join(dir, "legacy-schema.prisma");
    const legacyDbUrl = `file:${join(dir, "legacy.db")}`;
    const newDbUrl = `file:${join(dir, "new.db")}`;

    // 1) Legacy shema = recovery 1.163.4, provider preslikan v sqlite
    //    (ISTI mehanski princip kot pg-schema-sync — samo obraten).
    const recovery = await Bun.file("docs/recovery/schema-1.163.4.prisma").text();
    if (!/provider\s*=\s*"postgresql"/.test(recovery)) {
      throw new Error("Recovery shema ni več postgres — posodobi test (preslikava).");
    }
    const legacySchema = recovery.replace(
      /^(\s*)provider\s*=\s*"postgresql"\s*$/m,
      `$1provider = "sqlite"`,
    );
    await Bun.write(legacySchemaPath, legacySchema);

    // 2) Materializiraj obe bazi (brez --accept-data-loss).
    const pushLegacy = run(
      ["bunx", "prisma", "db", "push", "--schema", legacySchemaPath, "--skip-generate"],
      { DATABASE_URL: legacyDbUrl },
    );
    expect(pushLegacy.exitCode).toBe(0);
    const pushNew = run(
      ["bunx", "prisma", "db", "push", "--schema", "prisma/schema.prisma", "--skip-generate"],
      { DATABASE_URL: newDbUrl },
    );
    expect(pushNew.exitCode).toBe(0);

    // 2b) Prisma klient MORA biti generiran iz GLAVNE (SQLite) sheme pred
    //     zagonom skripte — cutover faze (db:pg:generate) pustijo POSTGRES
    //     klienta v node_modules, ki na file: URL pade (dokazano 2026-10-10;
    //     CI to prikrije, ker generate teče pred testi — tu je eksplicitno).
    const genMain = run(["bunx", "prisma", "generate"], {});
    expect(genMain.exitCode).toBe(0);

    // 3) Fixture legacy vrstice (RAW INSERT — camelCase stolpci po shemi).
    const legacy = new Database(legacyDbUrl.slice("file:".length));
    const ins = (sql: string) => legacy.run(sql);
    ins(`INSERT INTO "User" ("id","email","name","passwordHash","preferences","createdAt","updatedAt")
         VALUES ('u1','ana@primer.si','Ana','$2b$legacypass','{"budget":"€€","interests":["gore"]}','${T}','${T}')`);
    ins(`INSERT INTO "User" ("id","email","name","passwordHash","createdAt","updatedAt")
         VALUES ('u2','bostjan@primer.si',NULL,'$2b$legacypass2','${T}','${T}')`);
    ins(`INSERT INTO "SavedItinerary" ("id","userId","itinerary","formData","name","shareId","isPublic","createdAt","updatedAt")
         VALUES ('s1','u1','{"createdAt":"${T}","days":[{"day":1,"locations":[{"name":"Bled","destSlug":"bled","time":"09:00"},{"name":"Bohinj"}]}]}','{}','Moj Bled','sh1',1,'${T}','${T}')`);
    ins(`INSERT INTO "SavedItinerary" ("id","userId","itinerary","formData","name","shareId","isPublic","createdAt","updatedAt")
         VALUES ('s2',NULL,'{}','{}',NULL,'sh2',1,'${T}','${T}')`); // anonimna → izpust
    ins(`INSERT INTO "SavedItinerary" ("id","userId","itinerary","formData","name","shareId","isPublic","createdAt","updatedAt")
         VALUES ('s3','u1','{pokvarjen','{}',NULL,'sh3',1,'${T}','${T}')`); // nerazčrljivo → izpust
    ins(`INSERT INTO "TripCollaborator" ("id","shareId","userId","inviteEmail","role","status","inviteToken","invitedBy","createdAt","updatedAt")
         VALUES ('c1','sh1','u2',NULL,'EDITOR','ACTIVE','tok-c1','session:u1','${T}','${T}')`);
    ins(`INSERT INTO "TripCollaborator" ("id","shareId","userId","inviteEmail","role","status","inviteToken","invitedBy","createdAt","updatedAt")
         VALUES ('c2','sh1',NULL,'x@y.si','VIEWER','PENDING','tok-c2','session:u1','${T}','${T}')`); // PENDING → izpust
    ins(`INSERT INTO "TripPoll" ("id","shareId","question","options","authorName","authorClientId","closed","createdAt")
         VALUES ('p1','sh1','Kateri dan?','["Petek","Sobota"]','Ana','cli1',0,'${T}')`);
    ins(`INSERT INTO "TripPollVote" ("id","pollId","voterId","optionIdx","createdAt")
         VALUES ('v1','p1','anon-1',0,'${T}')`); // anonimni glas → NE prenese
    ins(`INSERT INTO "TripComment" ("id","shareId","authorName","text","isAI","payload","createdAt")
         VALUES ('m1','sh1','Maja','Vidimo se ob 9h!',0,NULL,'${T}')`);
    ins(`INSERT INTO "TripComment" ("id","shareId","authorName","text","isAI","payload","createdAt")
         VALUES ('m2','sh1','AI svetovalec','Predlagam Bohinj.',1,NULL,'${T}')`);
    ins(`INSERT INTO "Product" ("id","name","slug","description","category","price","images","stock","saleCount","status","sellerName","createdAt","updatedAt")
         VALUES ('pr1','Med','med-gorica','Lokalni med','honey',12.5,'[]',5,2,'published','Kmetija Gorica','${T}','${T}')`);
    ins(`INSERT INTO "Product" ("id","name","slug","description","category","price","images","stock","saleCount","status","sellerName","createdAt","updatedAt")
         VALUES ('pr2','Negativna cena','negativna-cena','Opis','other',-5,'[]',0,0,'draft','Kmetija X','${T}','${T}')`); // neveljavna cena → izpust
    ins(`INSERT INTO "Order" ("id","orderNumber","buyerEmail","buyerName","status","paymentMethod","stripeSessionId","subtotal","total","items","currency","createdAt","updatedAt","paidAt")
         VALUES ('o1','IF-1','kupec@x.si','Kupec','paid','stripe','cs_1',25,25,'[{"productId":"pr1","qty":2,"price":12.5,"name":"Med"},{"productId":"pr999","qty":1,"price":3}]','EUR','${T}','${T}','${T}')`);
    ins(`INSERT INTO "Lead" ("id","name","email","businessName","businessType","location","plan","message","status","createdAt","updatedAt")
         VALUES ('le1','Jože','joze@kmetija.si','Kmetija','farm','Ljubljana','premium','Zanima nas.','nov','${T}','${T}')`);
    ins(`INSERT INTO "Lead" ("id","name","email","businessName","businessType","location","plan","message","status","createdAt","updatedAt")
         VALUES ('le2','Miha','miha@x.si','X','shop','Kranj','free',NULL,'zakljucen','${T}','${T}')`); // zaključen → arhiv
    ins(`INSERT INTO "NewsletterSubscriber" ("id","email","createdAt") VALUES ('n1','n@x.si','${T}')`);
    ins(`INSERT INTO "Consultation" ("id","accessToken","email","question","status","createdAt")
         VALUES ('k1','tok-k1','k@x.si','Kam na Bled?','pending','${T}')`);
    ins(`INSERT INTO "ProcessedStripeEvent" ("id","eventType","createdAt") VALUES ('evt_1','checkout.session.completed','${T}')`);
    ins(`INSERT INTO "AuditLog" ("id","actorId","actorRole","action","resourceType","resourceId","createdAt")
         VALUES ('a1','own1','owner','listing_approved','listing','l1','${T}')`);
    ins(`INSERT INTO "Listing" ("id","name","slug","description","category","address","images","createdAt","updatedAt")
         VALUES ('li1','Gostilna','gostilna-1','Opis','restaurant','Ljubljana 1','[]','${T}','${T}')`);
    ins(`INSERT INTO "UserTripItem" ("id","userId","kind","refId","title","href","addedAt","createdAt","updatedAt")
         VALUES ('uti1','u1','destination','bled','Bled','/destinacije/bled','${T}','${T}','${T}')`); // RETIRE
    legacy.close();

    // 4) DRY-RUN: izpiše načrt, NE piše.
    const dry = run(["bun", "scripts/migrate-legacy-data.ts"], {
      DATABASE_URL: newDbUrl,
      LEGACY_DATABASE_URL: legacyDbUrl,
    });
    expect(dry.exitCode).toBe(0);
    expect(dry.err).toContain("DRY-RUN");

    // 5) APPLY #1.
    const apply1 = run(["bun", "scripts/migrate-legacy-data.ts", "--apply"], {
      DATABASE_URL: newDbUrl,
      LEGACY_DATABASE_URL: legacyDbUrl,
    });
    expect(apply1.exitCode).toBe(0);
    expect(apply1.err).toContain("APPLY zaključen");

    // 6) Preveri stanje NOVE baze po preslikavi.
    const check = (table: string): number => {
      const c = new Database(newDbUrl.slice("file:".length), { readonly: true });
      try {
        return (c.query(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c;
      } finally {
        c.close();
      }
    };
    expect(check("User")).toBe(2); // u1 + u2 (name null → email)
    expect(check("TravelJourney")).toBe(1); // samo s1 (s2 anonimna, s3 pokvarjena)
    expect(check("TripCollaborator")).toBe(1); // samo ACTIVE
    expect(check("TripPoll")).toBe(1);
    expect(check("TripPollOption")).toBe(2);
    expect(check("TripPollVote")).toBe(0); // anonimni glasovi se NE prenesejo
    expect(check("TripMessage")).toBe(2); // m1 + m2 (isAiBot)
    expect(check("Product")).toBe(1); // pr1 (pr2 brez cene izpuščen)
    expect(check("Order")).toBe(1);
    expect(check("OrderItem")).toBe(1); // samo pr1 (pr999 ne obstoja)
    expect(check("Lead")).toBe(1); // le1 (le2 zaključen → arhiv)
    expect(check("NewsletterSubscriber")).toBe(1);
    expect(check("Consultation")).toBe(1);
    expect(check("ProcessedStripeEvent")).toBe(1);
    expect(check("AuditLog")).toBe(1);
    expect(check("Listing")).toBe(1);
    expect(check("UserPreference")).toBe(2); // u1: budget €€ + interests ["gore"] → IMPORTED (matrika §1; u2 brez preferences)
    expect(check("WatchItem")).toBe(0);
    expect(check("Notification")).toBe(0);

    // Vsebina: prenesena pot vsebuje Bled.
    const j = new Database(newDbUrl.slice("file:".length), { readonly: true });
    const journey = j.query(`SELECT "title","data","ownerId" FROM "TravelJourney" WHERE id = 's1'`).get() as {
      title: string;
      data: string;
      ownerId: string;
    };
    j.close();
    expect(journey.title).toBe("Moj Bled");
    expect(journey.ownerId).toBe("u1");
    expect(JSON.parse(journey.data).days[0].locations[0].name).toBe("Bled");
    expect(JSON.parse(journey.data).days[0].locations).toHaveLength(2);

    // 7) APPLY #2 — IDEMPOTENCA: ničesar novega.
    const apply2 = run(["bun", "scripts/migrate-legacy-data.ts", "--apply"], {
      DATABASE_URL: newDbUrl,
      LEGACY_DATABASE_URL: legacyDbUrl,
    });
    expect(apply2.exitCode).toBe(0);
    const m = /skupno prenesenih: (\d+) zapisov/.exec(apply2.err);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(0);
    expect(check("User")).toBe(2);
    expect(check("TravelJourney")).toBe(1);
    expect(check("OrderItem")).toBe(1);
  }, 120_000);
});
