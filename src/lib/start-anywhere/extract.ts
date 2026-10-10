/**
 * START ANYWHERE — EKSTRAKCIJA BESEDILA IZ HTML (2.25.0, P2).
 * ============================================================================
 * Čista, deterministična funkcija (0 odvisnosti, 0 omrežja): iz surovega
 * HTML-ja (YouTube, članek, TikTok og:description …) izlušči naslov,
 * opis in vidno besedilo — vse, kar strežniška skripta potrebuje za
 * ujemanje krajev. Isti HTML → isti izhod.
 *
 * Iskrenost: ekstrakcija je konzervativna — vzamemo SAMO meta podatke in
 * vidno besedilo; skripte/style/komentarji se ODSTRANJO (ne morejo
 * vplivati na ujemanje). Dolžine so pokrite (naslov 200, opis 500,
 * besedilo 4.000) — ujemalec išče kraje, ne bere romanov.
 */

export interface PageText {
  title: string | null;
  description: string | null;
  /** Vidno besedilo (brez značk), presledki strnjeni, največ 4.000 znakov. */
  text: string;
}

/** Osnovne HTML entitete (dovolj za meta vsebino; ostalo pusti pri miru). */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, d: string) => {
      const code = Number.parseInt(d, 10);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    });
}

function cap(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

/** Vsebina <title> (prvi zadetek; entitete dekodirane; pokrite 200). */
function titleOf(html: string): string | null {
  const m = /<title[^>]*>([\s\S]{0,600}?)<\/title>/i.exec(html);
  if (!m) return null;
  const t = cap(decodeEntities(m[1]).replace(/\s+/g, " "), 200);
  return t.length > 0 ? t : null;
}

/** Vsebina meta/property (og:description, description …). */
function metaContent(
  html: string,
  names: readonly string[]
): string | null {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`,
      "i"
    );
    const tag = re.exec(html)?.[0];
    if (!tag) continue;
    const cm = /content=["']([\s\S]*?)["']/i.exec(tag);
    if (!cm) continue;
    const t = cap(decodeEntities(cm[1]).replace(/\s+/g, " "), 500);
    if (t.length > 0) return t;
  }
  return null;
}

/** Vidno besedilo: odstranjene skripte/stili/noscript/naslov/komentarji + značke. */
function visibleText(html: string): string {
  const stripped = html
    // blokovski elementi, ki jih nikoli ne beremo (naslov je že v
    // page.title — v vidnem besedilu bi se podvajal):
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<title[\s\S]*?<\/title>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // značke → presledek (besede se ne smejo zliti: „Bled</b>otok“)
    .replace(/<[^>]+>/g, " ");
  return cap(decodeEntities(stripped).replace(/\s+/g, " ").trim(), 4_000);
}

/**
 * Ekstrakcija iz HTML-ja (čista funkcija).
 * Red podatkov v izhodu je nepomemben — ujemalec dobi ZLITINO
 * (naslov + opis + besedilo), ki jo zgradi klicatelj.
 */
export function extractPageText(html: string): PageText {
  return {
    title: titleOf(html),
    description:
      metaContent(html, ["og:description", "description"]) ??
      metaContent(html, ["twitter:description"]),
    text: visibleText(html),
  };
}

/** Korpus za ujemanje: naslov + opis + vidno besedilo (strnjeno, pokrito). */
export function corpusOf(page: PageText): string {
  return cap(
    [page.title ?? "", page.description ?? "", page.text]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    5_000
  );
}
