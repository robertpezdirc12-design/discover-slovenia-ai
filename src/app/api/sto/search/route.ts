import { NextRequest, NextResponse } from "next/server";

import { loadStoContent, searchStoContent } from "@/lib/supply/providers/sto/content";
import { STO_ATTRIBUTION } from "@/lib/supply/providers/sto/llms-source";

export const dynamic = "force-dynamic";

/**
 * /api/sto/search?q=&lang= — iskanje po URADNI turistični vsebini
 * slovenia.info (llms.txt ingest, P0-C). Deterministično iskanje;
 * vsak odziv nosi atribucijo vira. Datoteka manjka → 503 z razlogom
 * (fail-closed — nikoli prazni „zadetki", ki bi izgledali kot resnica).
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").slice(0, 120).trim();
  const lang = params.get("lang") ?? "sl";

  if (q.length === 0) {
    return NextResponse.json(
      { error: "manjka q (iskalni niz)" },
      { status: 400 },
    );
  }

  const loaded = await loadStoContent();
  if (loaded.status !== "ok") {
    return NextResponse.json(
      {
        error:
          loaded.status === "missing"
            ? "STO vsebina še ni ingescirana (bun run sto:ingest)"
            : `STO vsebina je neveljavna: ${loaded.reason}`,
        attribution: STO_ATTRIBUTION,
      },
      { status: 503 },
    );
  }

  const hits = searchStoContent(q, loaded.dataset.entries, {
    language: lang,
    limit: 12,
  });

  return NextResponse.json({
    query: q,
    language: lang,
    total: hits.length,
    results: hits.map((h) => ({
      section: h.entry.section,
      title: h.entry.title,
      url: h.entry.url,
      description: h.entry.description,
    })),
    attribution: STO_ATTRIBUTION,
    fetchedAt: loaded.dataset.fetchedAt,
  });
}
