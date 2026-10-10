import { describe, expect, test } from "bun:test";

import { SHARE_ID_RE, randomShareIdClient } from "../src/lib/share-id";

/**
 * SHARE-ID (klient, 2.26.0) — zaklep popravka iz e2e:
 * Uint8Array se začne z NIČLAMI → vstopni vnos crypto.getRandomValues je
 * OBVEZEN. Brez njega je generator vrnil "aaaaaaaaaa" (10 × alphabet[0]).
 * (Bun/crypto na strežniku ima isti getRandomValues API kot brskalnik.)
 */

describe("share-id — randomShareIdClient", () => {
  test("oblika: [a-z0-9] × 10, veljavna po strežniškem SHARE_ID_RE", () => {
    for (let i = 0; i < 50; i++) {
      const id = randomShareIdClient();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^[a-z0-9]+$/);
      expect(SHARE_ID_RE.test(id)).toBe(true);
    }
  });

  test("NIČELNA napaka: 100 zaporednih id-jev ne more biti „aaaaaaaaaa“", () => {
    // Brez začetnega vnosa bi VSAK id bil "aaaaaaaaaa" (16 ničelnih bajtov
    // pokrije vseh 10 znakov). Z popravkom je to praktično nemogoče.
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(randomShareIdClient());
    expect(ids.has("aaaaaaaaaa")).toBe(false);
    // Prava naključnost: 100 klicev da precej različnih id-jev.
    expect(ids.size).toBeGreaterThan(50);
  });

  test("celotna abeceda je dosegljiva (ne samo 'a')", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      for (const ch of randomShareIdClient()) seen.add(ch);
    }
    // 36 znakov abecede — v 2000 znakih mora priti večina (≥ 30).
    expect(seen.size).toBeGreaterThanOrEqual(30);
  });
});
