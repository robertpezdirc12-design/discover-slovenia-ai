import { extractPageText, corpusOf, type PageText } from "./extract";

/**
 * START ANYWHERE — SSRF-VAROVAN STREŽNIŠKI DOSTOP DO PODSTRANI (2.25.0, P2).
 * ============================================================================
 * Javna pot sprejme poljubno povezavo → pred izvedbo gre skozi varovalke
 * (kanon P0 AUDIT — nikoli ne dostopamo do zasebnega omrežja iz javne
 * poti):
 *
 *  · SCHEMA: samo http/https (vse ostalo → zavrnjeno);
 *  · VRATA: samo privzeta (80/443) — nobenih :8080/:3000 … ;
 *  · ZASEBNO OMREŽJE: IP-doji (v4 + v6, vključno z ::ffff: preslikanimi)
 *    v RNG 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16,
 *    100.64/10 in imena localhost/*.local/*.internal se ZAVRNEJO;
 *    (iskrenost: delujemo na ravni imena/IP-ja v URL-ju — ne re-resolviramo
 *    DNS; kanon dokumentiran v glavi poti);
 *  · PREUSMERITVE: največ 3, vsaka ponovno validirana (preklic = ovira);
 *  · ODGOVOR: samo 200 + content-type text/html | application/xhtml |
 *    text/plain;
 *  · VELIKOST: največ 256 KiB (nad → zavrnjeno — ne prebiramo romanov);
 *  · ČAS: skupna meja 8 s (Hobby-varno).
 *
 * Vse napake so ISKRENE (vrsta + sporočilo) — klicatelj jih vrne kot 502
 * z nasvetom, naj uporabnik prilepi besedilo namesto povezave.
 * Odvisnosti so injicirane (deps.fetchImpl) → testi brez omrežja.
 */

export type FetchPageResult =
  | { ok: true; page: PageText; host: string; finalUrl: string }
  | { ok: false; error: FetchPageError };

export interface FetchPageError {
  kind:
    | "scheme"
    | "invalid"
    | "port"
    | "private"
    | "http"
    | "type"
    | "size"
    | "redirect"
    | "timeout"
    | "network";
  message: string;
}

export interface FetchDeps {
  fetchImpl?: typeof fetch;
}

const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

// ── varovalke (čiste funkcije — testirane posebej) ───────────────────────

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; kind: "scheme" | "invalid" | "port" | "private"; message: string };

/** Je hostname IP-doj (v4 ali v6)? */
function parseIp(host: string): { v4: number[]; v6: string } | null {
  // v4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split(".").map((p) => Number.parseInt(p, 10));
    if (parts.every((p) => p >= 0 && p <= 255)) return { v4: parts, v6: "" };
    return null;
  }
  // v6 (URL oglica vrne brez oglatih oklepajev)
  const h = host.replace(/^\[|\]$/g, "");
  if (h.includes(":")) {
    // ::ffff:192.0.2.1 — preslikan v4 (decimalna oblika)
    const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(h);
    if (dotted) {
      const parts = dotted[1].split(".").map((p) => Number.parseInt(p, 10));
      if (parts.every((p) => p >= 0 && p <= 255)) return { v4: parts, v6: "" };
    }
    // ::ffff:a00:9 — preslikan v4 (šestnajstiška oblika; URL oglica
    // normalizira decimalne naslove v to obliko)
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(h);
    if (hex) {
      const hi = Number.parseInt(hex[1], 16);
      const lo = Number.parseInt(hex[2], 16);
      if (hi <= 0xffff && lo <= 0xffff) {
        return { v4: [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff], v6: "" };
      }
    }
    return { v4: [], v6: h };
  }
  return null;
}

/** Zasebni/rezervirani razredi (SSRF-ovo jedro). */
function isPrivateAddress(v4: number[], v6: string): boolean {
  if (v4.length === 4) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127) return true; // 0/8, 10/8, 127/8
    if (a === 169 && b === 254) return true; // 169.254/16 (meta podatki!)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 (CGNAT)
    return false;
  }
  const v = v6.toLowerCase();
  if (v === "::1" || v === "::") return true; // loopback
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // fc00::/7 (ULA)
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb"))
    return true; // fe80::/10 (link-local)
  return false;
}

/** Validacija enega URL-ja (schema, vrata, zasebno omrežje). */
export function checkUrl(input: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, kind: "invalid", message: "Neveljaven URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      ok: false,
      kind: "scheme",
      message: "Dovoljeni sta samo shemi http in https.",
    };
  }
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    return {
      ok: false,
      kind: "port",
      message: "Dovoljena so samo privzeta vrata (80/443).",
    };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const badNames = new Set(["localhost", "local", "internal"]);
  const labels = host.split(".");
  if (badNames.has(host) || labels.some((l) => l === "localhost")) {
    return {
      ok: false,
      kind: "private",
      message: "Ime gostitelja je notranje (localhost).",
    };
  }
  if (labels.length >= 2 && (badNames.has(labels[labels.length - 1]))) {
    return {
      ok: false,
      kind: "private",
      message: "Ime gostitelja je notranje (*.local/*.internal).",
    };
  }
  const ip = parseIp(host);
  if (ip && isPrivateAddress(ip.v4, ip.v6)) {
    return {
      ok: false,
      kind: "private",
      message: "Naslov je v zasebnem/rezerviranem obsegu.",
    };
  }
  return { ok: true, url };
}

/** Prebere telo z omejitvijo velikosti (nad mejo → size). */
async function readCapped(
  res: Response,
  limit: number
): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; kind: "size" }> {
  if (res.body === null) {
    // brez toka (testni lažni odgovori) — preberi celo
    const buf = await res.arrayBuffer();
    if (buf.byteLength > limit) return { ok: false, kind: "size" };
    return { ok: true, buf };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        return { ok: false, kind: "size" };
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return { ok: true, buf: out.buffer };
}

/**
 * Strežniški dostop do javne strani + ekstrakcija besedila.
 * Vse odvisnosti injicirane; privzeto globalni fetch.
 */
export async function fetchPageText(
  input: string,
  deps: FetchDeps = {}
): Promise<FetchPageResult> {
  const doFetch = deps.fetchImpl ?? fetch;
  const first = checkUrl(input);
  if (!first.ok) return { ok: false, error: first };

  const deadline = Date.now() + TIMEOUT_MS;
  let current = first.url;
  let host = current.hostname;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return {
        ok: false,
        error: { kind: "timeout", message: "Potekla časovna meja (8 s)." },
      };
    }
    let res: Response;
    try {
      res = await doFetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(remaining),
        headers: {
          // NAMENOMA čisti ASCII (ne-ASCII znak v glavi sproži TypeError
          // pri fetch — preverjeno; em-dash je bil tukaj bug 2.25.0):
          "user-agent":
            "Mozilla/5.0 (compatible; dsa-startanywhere/1.0; +https://i-feel-slovenia.vercel.app; deterministic script, no AI)",
          accept: "text/html, application/xhtml+xml, text/plain;q=0.8, */*;q=0.5",
        },
      });
    } catch (e) {
      // ločimo preteklo mejo (AbortError/TimeoutError) od ostalih napak —
      // iskrena vrsta napake, ne vse pod „timeout“:
      const isTimeout =
        e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
      return {
        ok: false,
        error: isTimeout
          ? { kind: "timeout", message: "Vir ni odgovoril v 8 s." }
          : { kind: "network", message: "Dostop do vira ni uspel (omrežje)." },
      };
    }

    // preusmeritve: Location → ponovna validacija (istega varovalka!)
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return {
          ok: false,
          error: { kind: "redirect", message: "Preusmeritev brez cilja." },
        };
      }
      if (hop === MAX_REDIRECTS) {
        return {
          ok: false,
          error: { kind: "redirect", message: "Preveč preusmeritev (meja 3)." },
        };
      }
      let next: URL;
      try {
        next = new URL(loc, current);
      } catch {
        return {
          ok: false,
          error: { kind: "redirect", message: "Neveljaven cilj preusmeritve." },
        };
      }
      const checked = checkUrl(next.toString());
      if (!checked.ok) return { ok: false, error: checked };
      current = checked.url;
      host = current.hostname;
      continue;
    }

    if (res.status !== 200) {
      return {
        ok: false,
        error: {
          kind: "http",
          message: `Vir je odgovoril s statusom ${res.status}.`,
        },
      };
    }

    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const ctOk =
      ct.startsWith("text/html") ||
      ct.startsWith("application/xhtml") ||
      ct.startsWith("text/plain");
    if (!ctOk) {
      return {
        ok: false,
        error: {
          kind: "type",
          message: `Nepodprt tip vsebine (${ct.split(";")[0] || "neznan"}).`,
        },
      };
    }

    const read = await readCapped(res, MAX_BYTES);
    if (!read.ok) {
      return {
        ok: false,
        error: { kind: "size", message: "Stran je večja od 256 KiB." },
      };
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(read.buf);
    const page = extractPageText(html);
    return { ok: true, page, host, finalUrl: current.toString() };
  }

  return {
    ok: false,
    error: { kind: "redirect", message: "Preveč preusmeritev (meja 3)." },
  };
}

/** Korpus za ujemanje (izvoz za klicatelja poti). */
export { corpusOf };
