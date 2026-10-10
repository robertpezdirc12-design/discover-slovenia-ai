import { describe, expect, test } from "bun:test";

import {
  consultationAnswerEmail,
  draftReminderEmail,
  isEmailConfigured,
  isValidEmail,
  newsletterWelcomeEmail,
  publicOrigin,
  sendEmail,
  tripInviteEmail,
} from "../src/lib/email";

/**
 * E-POŠTNA PLAST (P3, 2.26.0) — pogodbena bateria.
 * ============================================================================
 * Kanoni, ki jih ta datoteka ZAKLENE:
 *  1. FAIL-CLOSED: brez RESEND_API_KEY sendEmail NE pošilja in iskreno
 *     vrne reason "not_configured" (nikoli lažni uspeh).
 *  2. NIKOLI ne meče izjem (napake → reason + detail).
 *  3. Veljavnost naslova pred pošiljanjem (invalid_recipient).
 *  4. Vse predloge imajo subject + html + text in VSEBUJEJO povezavo
 *     (e-pošta brez delujoče povezave je pokvarjeno obvestilo).
 *  5. HTML vsebuje izhodno varno vsebino (vprašanje escapano).
 *  6. publicOrigin: env > x-forwarded-host > host > URL (serverless vrstni red).
 *  7. 0 omrežja: fetchImpl je injiciran (vsi testi brez povezave).
 */

// ── okolje ─────────────────────────────────────────────────────────────

const ENV_BEFORE = { ...process.env };

function clearEmailEnv() {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.NEXT_PUBLIC_SITE_URL;
}

// ── 1) fail-closed ─────────────────────────────────────────────────────

describe("email — fail-closed vrata", () => {
  test("brez RESEND_API_KEY ni konfigurirano", () => {
    clearEmailEnv();
    expect(isEmailConfigured()).toBe(false);
  });

  test("brez ključa sendEmail NE pošlje (reason not_configured) — tudi če bi fetch deloval", async () => {
    clearEmailEnv();
    let called = 0;
    const fetchImpl = (() => {
      called += 1;
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as unknown as typeof fetch;
    const res = await sendEmail(
      { to: "a@b.si", subject: "x", html: "x", text: "x" },
      fetchImpl
    );
    expect(res).toEqual({ sent: false, reason: "not_configured" });
    expect(called).toBe(0); // fetch sploh NI klican (0 stroškov)
  });

  test("kratek/prazen ključ se šteje kot nekonfiguriran", () => {
    process.env.RESEND_API_KEY = "short";
    expect(isEmailConfigured()).toBe(false);
    process.env.RESEND_API_KEY = "";
    expect(isEmailConfigured()).toBe(false);
    clearEmailEnv();
  });
});

// ── 2) nikoli izjeme ───────────────────────────────────────────────────

describe("email — sendEmail z injiciranim fetchem (0 omrežja)", () => {
  test("uspeh: 200 + id → sent:true", async () => {
    process.env.RESEND_API_KEY = "re_test_key_123456";
    const res = await sendEmail(
      { to: "ana@primer.si", subject: "Vabilo", html: "<p>x</p>", text: "x" },
      (async (_url: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        // Pogodba telesa: from/to/subject/html/text (Resend REST).
        expect(body.from).toBeString();
        expect(Array.isArray(body.to)).toBe(true);
        expect(body.subject).toBe("Vabilo");
        return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
      }) as unknown as typeof fetch
    );
    expect(res).toEqual({ sent: true, id: "email-1" });
    clearEmailEnv();
  });

  test("napaka HTTP 500 → http_error z detail (brez izjeme)", async () => {
    process.env.RESEND_API_KEY = "re_test_key_123456";
    const res = await sendEmail(
      { to: "ana@primer.si", subject: "x", html: "x", text: "x" },
      (async () =>
        new Response("boom", { status: 500 })) as unknown as typeof fetch
    );
    expect(res.sent).toBe(false);
    if (!res.sent) {
      expect(res.reason).toBe("http_error");
      expect(res.detail ?? "").toContain("500");
    }
    clearEmailEnv();
  });

  test("omrežna napaka → network_error (brez izjeme)", async () => {
    process.env.RESEND_API_KEY = "re_test_key_123456";
    const res = await sendEmail(
      { to: "ana@primer.si", subject: "x", html: "x", text: "x" },
      (async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch
    );
    expect(res).toEqual({
      sent: false,
      reason: "network_error",
      detail: "ECONNREFUSED",
    });
    clearEmailEnv();
  });

  test("timeout (AbortError) → reason timeout", async () => {
    process.env.RESEND_API_KEY = "re_test_key_123456";
    const res = await sendEmail(
      { to: "ana@primer.si", subject: "x", html: "x", text: "x" },
      (async () => {
        throw new Error("The operation was aborted due to timeout");
      }) as unknown as typeof fetch
    );
    expect(res.sent).toBe(false);
    if (!res.sent) expect(res.reason).toBe("timeout");
    clearEmailEnv();
  });

  test("neveljaven naslov → invalid_recipient, fetch ni klican", async () => {
    process.env.RESEND_API_KEY = "re_test_key_123456";
    let called = 0;
    const res = await sendEmail(
      { to: "ni-veljaven", subject: "x", html: "x", text: "x" },
      (() => {
        called += 1;
        return Promise.resolve(new Response("{}", { status: 200 }));
      }) as unknown as typeof fetch
    );
    expect(res.sent).toBe(false);
    if (!res.sent) expect(res.reason).toBe("invalid_recipient");
    expect(called).toBe(0);
    clearEmailEnv();
  });
});

// ── 3) veljavnost naslovov ─────────────────────────────────────────────

describe("email — isValidEmail", () => {
  test("veljavni naslovi", () => {
    for (const ok of [
      "ana@primer.si",
      "ime.priimek@domena.org",
      "a+tag@gmail.com",
      "UPPER@primer.si",
    ]) {
      expect(isValidEmail(ok)).toBe(true);
    }
  });
  test("neveljavni naslovi", () => {
    for (const bad of [
      "",
      "ni-veljaven",
      "manjka@domena",
      "@domena.si",
      "a b@c.si",
      " ".repeat(200),
    ]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

// ── 4) predloge ────────────────────────────────────────────────────────

describe("email — predloge (subject + html + text + povezava)", () => {
  test("tripInviteEmail vsebuje naslov poti, vlogo, vlogo in ABSOLUTNO povezavo", () => {
    const tpl = tripInviteEmail({
      tripTitle: "Vikend na Bledu",
      inviteUrl: "https://dsa.si/pot/abc123?invite=tok",
      role: "EDITOR",
      inviterName: "Ana",
    });
    expect(tpl.subject).toContain("Vikend na Bledu");
    expect(tpl.html).toContain("https://dsa.si/pot/abc123?invite=tok");
    expect(tpl.text).toContain("https://dsa.si/pot/abc123?invite=tok");
    expect(tpl.text).toContain("Ana");
    // relativna povezava se pretvori v absolutno (varno za e-pošto)
    const rel = tripInviteEmail({
      tripTitle: "X",
      inviteUrl: "/pot/abc?invite=t",
      role: "VIEWER",
      inviterName: "B",
    });
    expect(rel.html).toContain("https://");
  });

  test("consultationAnswerEmail: povezava + ESCAPANO vprašanje (XSS kanon)", () => {
    const tpl = consultationAnswerEmail({
      question: 'Kje je <script>alert(1)</script> dober gostilni? Dolgo vprašanje '.repeat(3),
      answerUrl: "https://dsa.si/konzultacija/tok123",
    });
    expect(tpl.html).not.toContain("<script>");
    expect(tpl.html).toContain("&lt;script&gt;");
    expect(tpl.html).toContain("https://dsa.si/konzultacija/tok123");
    expect(tpl.subject).toBeString();
    expect(tpl.text).toContain("https://dsa.si/konzultacija/tok123");
  });

  test("draftReminderEmail: ime izdelka, starost, povezava /partner", () => {
    const tpl = draftReminderEmail({
      productName: "Rafting na Soči",
      daysOld: 9,
      partnerUrl: "https://dsa.si/partner",
    });
    expect(tpl.subject).toContain("Rafting na Soči");
    expect(tpl.subject).toContain("9");
    expect(tpl.html).toContain("https://dsa.si/partner");
    expect(tpl.text).toContain("pred 9 dnevi");
  });

  test("newsletterWelcomeEmail: brez osebnih podatkov, z povezavo na /nacrtuj", () => {
    const tpl = newsletterWelcomeEmail();
    expect(tpl.subject).toBeString();
    expect(tpl.html).toContain("/nacrtuj");
    expect(tpl.text).toContain("/nacrtuj");
  });
});

// ── 5) publicOrigin ────────────────────────────────────────────────────

describe("email — publicOrigin (serverlese-varni vrstni red)", () => {
  test("NEXT_PUBLIC_SITE_URL ima prednost", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://saya.example";
    const req = new Request("https://ignored.example/x", {
      headers: { "x-forwarded-host": "fw.example" },
    });
    expect(publicOrigin(req)).toBe("https://saya.example");
    clearEmailEnv();
  });

  test("x-forwarded-host + proto (Vercel vzorec)", () => {
    const req = new Request("https://internal/x", {
      headers: {
        "x-forwarded-host": "i-feel-slovenia.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(publicOrigin(req)).toBe("https://i-feel-slovenia.vercel.app");
  });

  test("fallback na host glavo", () => {
    const req = new Request("https://internal/x", {
      headers: { host: "plain.example" },
    });
    expect(publicOrigin(req)).toBe("https://plain.example");
  });
});

// ── 6) obnova okolja ───────────────────────────────────────────────────

process.env = ENV_BEFORE;
