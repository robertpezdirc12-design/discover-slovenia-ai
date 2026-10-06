import { DESTINATIONS } from "@/lib/slovenia-data";

export const dynamic = "force-dynamic";

/**
 * /rss.xml — dinamičen RSS (oblika 1:1 po produkciji: naslov kanala,
 * description, language sl-si, atom:self; vsak item = vodnik destinacije
 * "X — kaj početi in videti" z izvlečkom in kategorijo regije).
 *
 * Osnovni URL se izpelje iz zahteve (razvoj/produkcija brez trdo kodirane
 * domene).
 */

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const items = DESTINATIONS.map(
    (d) => `    <item>
      <title>${esc(d.name)} — kaj početi in videti</title>
      <link>${origin}/destinacija/${esc(d.slug)}</link>
      <guid>${origin}/destinacija/${esc(d.slug)}</guid>
      <description>${esc(
        `${d.tagline}. ${d.highlights.join(", ")} — vodnik z aktivnostmi, nasveti in praktičnimi informacijami.`
      )}</description>
      <category>${esc(d.region)}</category>
    </item>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Discover Slovenia AI — vodniki po Sloveniji</title>
    <link>${origin}</link>
    <description>AI načrtovalec potovanj po Sloveniji: destinacije, itinererji, vodniki, kaj početi, najboljši čas obiska, krožna potovanja po Sloveniji in jadranska potovanja.</description>
    <language>sl-si</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${origin}/rss.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
