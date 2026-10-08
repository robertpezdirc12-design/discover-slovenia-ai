import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

/**
 * PASSWORD — čisti Node crypto (scrypt + naključna sol), BREZ zunanjih
 * odvisnosti za NOVE račune (bcryptjs ni nameščen za hashing; scrypt je v
 * Node stdlib in asimetrično močnejši od čistega SHA-256).
 *
 * Zapis: "scrypt$<sol-hex>$<izpeljek-hex>" — geslo NIKOLI ni shranjeno
 * v navadni obliki (kanon: žetoni/gesla samo kot hash).
 *
 * ISSUE #2 (PRODUCTION CUTOVER): verifyPassword PODPIRA tudi zapise,
 * ki jih je prinesla migracija iz produkcije 1.163.4 (bcrypt —
 * "$2a$/$2b$/$2y$"): preneseni uporabniki se prijavijo z obstoječim
 * geslom (brez izgube dostopa). Novi računi ostajajo scrypt;
 * re-hash ob naslednji prijavi NI izveden (hash ostane tak, kot ga je
 * prinesel vir — nikoli ne spreminjamo dokaznega zapisa tiho).
 */

const KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Ali je zapis v starem (bcrypt) formatu — prenesen iz 1.163.4? */
export function isLegacyBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$/.test(stored);
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (isLegacyBcryptHash(stored)) {
      return bcrypt.compareSync(password, stored);
    }
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
