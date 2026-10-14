/**
 * BALKAN-FOLLOWUP (2.60.0) — rešitev dokumentiranega dolga iz F4 (#41):
 *  · DEST_NEEDLES + DEST_NEEDLES_MIRROR pokrivata VSAH 74 destinacij
 *    kanona (prej 38 — 36 balkanskih destinacij F1 NLU-ja ni prepoznalo);
 *  · pogodba igel (koreni ≥ 3, izrecne oblike ≥ 4, red = vrstni red
 *    registra, vse igle na obstoječe sluge) — testno zaklenjena;
 *  · lažno-pozitivni zaklepi: generične besede (blagajna, prespan,
 *    meteor, meter, kastori/bobra, banska …, veliko …) NE zadenejo;
 *  · kopna sinhronizacija: uporabnik-vidni nizi govorijo o 74, nihče več
 *    o zastarelem „38 destinacij“ (source-contract nad ključnimi datotekami).
 *
 * Kanon #38: copy = resnica — števec opisuje dejanski kanon (74), ne
 * zgodovinskega stanja (38). Igle so ročno kurirane (brez generičnih
 * zadetkov); vsaka razširitev registra sledi isti pogodbi.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { DESTINATIONS } from "../src/lib/slovenia-data";
import {
  DEST_NEEDLES,
  findDestinationMentions,
} from "../src/lib/start-anywhere/match";
import { DEST_NEEDLES_MIRROR } from "../src/lib/plan-import";

const REPO_ROOT = join(import.meta.dir, "..");

/** Vrni unikatne sluge zadetkov (v vrstnem redu zadetkov — registrski red). */
function hits(text: string): string[] {
  return findDestinationMentions(text).map((m) => m.dest.slug);
}

describe("balkan-followup — obseg igel (#41 dolg iz F4)", () => {
  test("DEST_NEEDLES pokriva vseh 74 destinacij registra", () => {
    expect(DEST_NEEDLES).toHaveLength(74);
    expect(DESTINATIONS).toHaveLength(74);
    const slugs = new Set(DESTINATIONS.map((d) => d.slug));
    for (const n of DEST_NEEDLES) {
      expect(slugs.has(n.dest), `igla na neznano destinacijo: ${n.dest}`).toBe(
        true,
      );
    }
    const uniq = new Set(DEST_NEEDLES.map((n) => n.dest));
    expect(uniq.size).toBe(74);
  });

  test("red igel = vrstni red registra (deterministični kanon, 1:1)", () => {
    for (let i = 0; i < DESTINATIONS.length; i++) {
      expect(DEST_NEEDLES[i].dest).toBe(DESTINATIONS[i].slug);
    }
  });

  test("pogodba igel: koreni ≥ 3, izrecne oblike ≥ 4, vsaj en dokaz", () => {
    for (const n of DEST_NEEDLES) {
      expect(n.stems ?? n.exact).toBeDefined();
      for (const seq of n.stems ?? []) {
        expect(seq.length).toBeGreaterThan(0);
        for (const stem of seq) {
          expect(
            stem.length,
            `koren < 3 pri ${n.dest}: "${stem}"`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
      for (const form of n.exact ?? []) {
        expect(
          form.length,
          `izrecna oblika < 4 pri ${n.dest}: "${form}"`,
        ).toBeGreaterThanOrEqual(4);
      }
    }
  });

  test("ZRCALO (plan-import) je bitno enako kanonu DEST_NEEDLES", () => {
    expect(DEST_NEEDLES_MIRROR).toEqual(DEST_NEEDLES);
    expect(DEST_NEEDLES_MIRROR).toHaveLength(DEST_NEEDLES.length);
  });
});

describe("balkan-followup — balkanske destinacije se PREPOZNAJO", () => {
  // Reprezentativne povedi za vseh 36 novih destinacij (F1 nabor).
  const PHRASES: readonly [string, string][] = [
    ["sarajevo", "Prvi dan raziskujemo Sarajevo in Baščaršijo."],
    ["mostar", "Stari most je simbol Mostara."],
    ["kravica", "Kopalci bomo pri slapu Kravica."],
    ["jahorina", "Za februar je smučanje na Jahorini."],
    ["blagaj", "Tekija ob izviru Bune je v Blagaju."],
    ["travnik", "Rojstna hiša Ive Andrića je v Travniku."],
    ["beograd", "Soboto začnemo v Beogradu na Kalemegdanu."],
    ["novi-sad", "Festival je v Novem Sadu."],
    ["kopaonik", "Rezervirali smo apartma na Kopaoniku."],
    ["derdap", "Plovba po Đerdapu traja dve uri."],
    ["derdap", "English text mentions Djerdap gorge."],
    ["sremski-karlovci", "Degustacija je v Sremskih Karlovcih."],
    ["subotica", "Sinagoga v Subotici je znana."],
    ["ohrid", "Ohridsko jezero bo počitek v Ohridu."],
    ["skopje", "Ura predvidi postanek v Skopju."],
    ["matka", "Kajaki po kanjonu Matka."],
    ["bitola", "Prospali smo dopoldan v Bitoli."],
    ["prespa", "Prenočili smo ob Prespanskem jezeru."],
    ["mavrovo", "Narodni park Mavrovo je v marskvem območju."],
    ["prizren", "Zvečer gremo v Prizren na Kalo."],
    ["rugova", "Iz Prizrena gre pot v Rugovo."],
    ["brezovica", "Marčevski sneg zdrži v Brezovici."],
    ["gjakova", "Stara čaršija je v Gjakovi."],
    ["gadime", "Marmorna jama Gadime je blizu Uroševca."],
    ["prishtina", "Glavno mesto je Priština (Prishtina)."],
    ["sofija", "Vitosha dominira nad Sofijo."],
    ["plovdiv", "Kapana je najstarejši predel Plovdiva."],
    ["rila-samostan", "UNESCO točka je Rilski samostan."],
    ["rila-samostan", "Sprehod k samostanu Rila je dolg."],
    ["nesebar", "Stari grad Nesebar je na otoku."],
    ["bansko", "Paprikaš pojemo v Bansku."],
    ["veliko-tarnovo", "Tsarevets gleda na Veliko Tarnovo."],
    ["solun", "Naslednja postaja je Solun."],
    ["meteora", "Viseči samostani Meteora so neverjetni."],
    ["kastoria", "Jezero Orestida meji na Kastorijo."],
    ["vergina", "Grobnica Filipa II. je v Vergini."],
    ["ioannina", "Veliko jezerce je v Ioannini."],
    ["halkidiki", "Trije prsti plaž Halkidiki."],
    ["halkidiki", "Greek spelling: Chalkidiki peninsula."],
  ];

  test("vsak novi vnos ima poved, ki ga ujame (36 destinacij)", () => {
    const covered = new Set(PHRASES.map(([dest]) => dest));
    // vsi F1 novi slugi so pokriti s povedmi
    const newSlugs = DESTINATIONS.filter(
      (d) => !["SI", "HR", "ME", "AL"].includes(d.country),
    ).map((d) => d.slug);
    for (const slug of newSlugs) {
      expect(covered.has(slug), `manjka poved za ${slug}`).toBe(true);
    }
  });

  for (const [dest, text] of PHRASES) {
    test(`poved ujame ${dest}: „${text.slice(0, 42)}“`, () => {
      const h = hits(text);
      expect(h).toContain(dest);
    });
  }
});

describe("balkan-followup — lažno-pozitivni zaklepi", () => {
  const NEGATIVES: readonly [string, string][] = [
    ["blagaj", "Blagajna muzeja je odprta do 19h."],
    ["prespa", "Zjutraj sem bil še prespan."],
    ["meteora", "Nad nami so padali meteorji."],
    ["meteora", "Pohod je dolg 20 meterov."],
    ["kastoria", "V gozdu smo videli kastori."],
    ["bansko", "Slovaška ruta: Banska Bystrica."],
    ["veliko-tarnovo", "Zbirka ima veliko eksponatov."],
    ["rila-samostan", "Na njivi so bile sveže rile."],
    ["travnik", "Na griču so travniki in sadovnjaki."],
  ];

  for (const [forbidden, text] of NEGATIVES) {
    test(`generik NE zadene ${forbidden}: „${text.slice(0, 42)}“`, () => {
      expect(hits(text)).not.toContain(forbidden);
    });
  }

  test("generično besedilo brez krajev → 0 zadetkov", () => {
    expect(hits("Odhod ob 7h, nazaj ob 19h. S seboj kopalke in japonke."))
      .toHaveLength(0);
  });
});

describe("balkan-followup — kopna sinhronizacija (source-contract)", () => {
  const READ = (rel: string) =>
    readFileSync(join(REPO_ROOT, rel), "utf8");

  const USER_VISIBLE_COPY: readonly string[] = [
    "src/app/[locale]/nacrtuj/view.tsx",
    "src/app/[locale]/zemljevid/view.tsx",
    "src/app/[locale]/slovenia-pass/view.tsx",
    "src/app/[locale]/vir-podatkov/view.tsx",
    "src/lib/trznica-data.ts",
    "src/lib/go-data.ts",
    "src/lib/trip-chat-engine.ts",
    "src/lib/jsonld.ts",
    "src/components/home/home-view.tsx",
    "src/app/api/start-anywhere/route.ts",
    "src/app/api/journey/route/route.ts",
    "messages/sl.json",
    "messages/en.json",
    "messages/it.json",
    "messages/de.json",
    "messages/fr.json",
    "messages/es.json",
    "public/manifest.json",
  ];

  test("nič več zastarelega „38 destinacij“ v uporabnik-vidni copy", () => {
    const STALE = /38 destinacij|38 destinations|38 destinos|38 destinazioni|38 Reiseziele|38 Destinationen|38 kuriranih|38 kuratierte|38 curated|registra 38|nabora 38|baze 38|iz nabora 38/;
    for (const rel of USER_VISIBLE_COPY) {
      const src = READ(rel);
      const m = src.match(STALE);
      expect(m, `${rel} vsebuje zastarel števec: ${m?.[0] ?? "?"}`).toBeNull();
    }
  });

  test("ključni kop nosi resnični kanon (74)", () => {
    expect(READ("src/components/home/home-view.tsx")).toContain(
      "74 kuriranih destinacij",
    );
    expect(READ("src/app/[locale]/zemljevid/view.tsx")).toContain(
      "74 destinacij od Alp do Albanije",
    );
    expect(READ("src/app/[locale]/nacrtuj/view.tsx")).toContain(
      "registra (74 destinacij)",
    );
    expect(READ("src/lib/jsonld.ts")).toContain(
      "74 kuriranih destinacij (cel Balkan — 10 držav)",
    );
    expect(READ("src/app/api/start-anywhere/route.ts")).toContain(
      "registra (74 destinacij)",
    );
    expect(READ("messages/sl.json")).toContain(
      "celem Balkanu: 74 kuriranih destinacij",
    );
    expect(READ("public/manifest.json")).toContain(
      "cel Balkan z AI-poganjanim načrtovalcem potovanj. 74 kuriranih destinacij",
    );
  });

  test("razširitev igel je označena v obeh tabelah (kanon + zrcalo)", () => {
    const marker = "Balkanska razširitev F1";
    expect(READ("src/lib/start-anywhere/match.ts")).toContain(marker);
    expect(READ("src/lib/plan-import.ts")).toContain(marker);
  });
});
