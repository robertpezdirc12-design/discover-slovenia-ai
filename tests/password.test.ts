/**
 * PASSWORD — scrypt hash z soljo (strežniška avtentikacija 48-a).
 *
 * Invariante: isto geslo → preverjanje uspe; napačno geslo → zavrnitev;
 * vsak hash ima naključno sol (isti vhod → različna hasha); format
 * vsebuje parametre za kasnejšo overjanje.
 */

import { describe, expect, test } from "bun:test";

import { hashPassword, verifyPassword } from "../src/lib/password";

describe("password: scrypt roundtrip", () => {
  test("isto geslo → verify true", () => {
    const hash = hashPassword("slovenija2026");
    expect(verifyPassword("slovenija2026", hash)).toBe(true);
  });

  test("napačno geslo → verify false", () => {
    const hash = hashPassword("pravo-geslo");
    expect(verifyPassword("napacno-geslo", hash)).toBe(false);
  });

  test("vsak hash ima naključno sol (2× isto geslo → različna hasha)", () => {
    const a = hashPassword("enako-geslo");
    const b = hashPassword("enako-geslo");
    expect(a).not.toBe(b);
    // a oba seveda preverita isto geslo
    expect(verifyPassword("enako-geslo", a)).toBe(true);
    expect(verifyPassword("enako-geslo", b)).toBe(true);
  });

  test("pokvarjen zapis → false (fail-closed, nikoli izjema)", () => {
    expect(verifyPassword("karkoli", "smeti")).toBe(false);
    expect(verifyPassword("karkoli", "")).toBe(false);
  });

  test("hash nikoli vsebuje čistega gesla", () => {
    const hash = hashPassword("skrivnost-123");
    expect(hash.includes("skrivnost-123")).toBe(false);
  });
});
