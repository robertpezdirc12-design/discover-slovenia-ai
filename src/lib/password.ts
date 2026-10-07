import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * PASSWORD — čisti Node crypto (scrypt + naključna sol), BREZ zunanjih
 * odvisnosti (bcryptjs ni nameščen; scrypt je v Node stdlib in asimetrično
 * močnejši od čistega SHA-256).
 *
 * Zapis: "scrypt$<sol-hex>$<izpeljek-hex>" — geslo NIKOLI ni shranjeno
 * v navadni obliki (kanon: žetoni/gesla samo kot hash).
 */

const KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length, SCRYPT_PARAMS);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
