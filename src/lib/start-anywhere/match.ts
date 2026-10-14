import { DESTINATIONS, type Destination } from "@/lib/slovenia-data";
import { stripDiacritics } from "@/lib/advisor/context";

/**
 * START ANYWHERE — UJEMALEC KRAJEV (2.25.0, P2).
 * ============================================================================
 * Kje bi bil AI model (Mindtrip Start Anywhere = video → LLM), je tu
 * SKRIPTA: ujemanje omenjenih krajev v poljubnem besedilu (prilepljena
 * povezava → strežniško prebrano besedilo, ali uporabnikovo besedilo)
 * proti KANONSKEMU registru 74 destinacij (src/lib/slovenia-data.ts;
 * 38 do F1, od 2.55.0 cel Balkan — igle sledijo registru od 2.60.0).
 *
 * Kanoni:
 *  · DETERMINIZEM: isti vhod → isti izhod; vrstni red registra (nikoli
 *    naključno); prva zadeta igla na destinacijo se zapiše kot dokaz;
 *  · NIKOLI NE UGIBAMO: »Prepoznal sem Bled, ker piše ‹bledu›« — dokaz
 *    (evidence) je vedno izhod iz besedila samoga;
 *  · SLOVENSKI SKLONI: predponsko ujemanje besed po korenu („na Bledu“ →
 *    bled, „po Ljubljani“ → ljubljana, „Postojni jami“ → postojnska jama)
 *    + izrecne oblike za kraje s šibkim korenom (Pula, Soča, Novo mesto);
 *  · 0 AI, 0 žetonov, 0 modelov; 0 omrežja (ta modul je čista funkcija).
 *
 * Tabela igel je KURIRANA (kot DEST_HINTS v NLU): vsak vnos ročno
 * pregledan, da ne zadenja generičnih besed. Pogodba (testi): vsaka
 * igla se nanaša na obstoječ slug registra; koreni ≥ 3; izrecne oblike
 * ≥ 4.
 */

// ── oblike igel ──────────────────────────────────────────────────────────

/**
 * Igla za eno destinacijo:
 *  · stems: zaporedja korenov besed — besedilo ujame, če obstaja zaporedje
 *    besed [w₀…wₙ], da za vsako besedo velja wᵢ.startsWith(korenᵢ)
 *    (diakritike odstranjene, mali znaki). Pokriva sklone s pripono IN
 *    z zamenjanim končnikom (koren = beseda brez končnega samoglasnika).
 *  · exact: izrecne (večbesedne) oblike — besedilo vsebuje dobesedno to
 *    zaporedje besed (uporabno, kjer je koren preveč generičen: Pula,
 *    Soča, Novo mesto).
 */
export interface DestNeedle {
  /** Slug iz registra (DESTINATIONS). */
  dest: string;
  /** Korenska zaporedja (fuzzy, pokrivajo sklene). */
  stems?: readonly (readonly string[])[];
  /** Izrecne oblike (dobesedno, po besedah). */
  exact?: readonly string[];
}

/**
 * KURIRANA TABELA — 74 destinacij registra (38 + 36 balkanskih).
 * Red = vrstni red registra (determinizem; prva zadeta igla velja).
 */
export const DEST_NEEDLES: readonly DestNeedle[] = [
  { dest: "bled", stems: [["bled"]] },
  { dest: "bohinj", stems: [["bohinj"]] },
  { dest: "ljubljana", stems: [["ljubljan"]] },
  {
    dest: "postojnska-jama",
    stems: [["postojnsk", "jam"], ["postojn"]],
  },
  { dest: "piran", stems: [["piran"]] },
  // Soča: koren „soc“ je preveč generičen (socialni, soda) → izrecne oblike.
  {
    dest: "reka-soca",
    exact: ["soca", "soci", "soce", "soco"],
  },
  { dest: "triglav", stems: [["triglav"]] },
  // Kobarid: tudi italijansko ime Caporetto (virniki v IT jezikih).
  { dest: "kobarid", stems: [["kobarid"]], exact: ["caporetto"] },
  { dest: "maribor", stems: [["maribor"]] },
  { dest: "portoroz", stems: [["portoroz"]] },
  {
    dest: "vintgarska-soteska",
    stems: [["vintgarsk", "sotesk"]],
    exact: ["vintgar", "vintgarju", "vintgarja"],
  },
  { dest: "rogaska-slatina", stems: [["rogask", "slatin"]] },
  { dest: "ptuj", stems: [["ptuj"]] },
  { dest: "celje", stems: [["celj"]] },
  { dest: "nova-gorica", stems: [["nov", "goric"]] },
  { dest: "slovenj-gradec", stems: [["slovenj", "gradec"], ["slovenj", "gradc"]] },
  { dest: "dravograd", stems: [["dravograd"]] },
  { dest: "murska-sobota", stems: [["mursk", "sobot"]] },
  { dest: "lendava", stems: [["lendav"]] },
  // Novo mesto: „nov … mest“ bi lažno zadelo „nova mesta“ (generično) →
  // izrecne sklonjske oblike + pridevnik novomeški kot koren.
  {
    dest: "novo-mesto",
    stems: [["novomest"]],
    exact: [
      "novo mesto",
      "novega mesta",
      "novem mestu",
      "novemu mestu",
      "novim mestom",
    ],
  },
  { dest: "otocec", stems: [["otocec"]] },
  { dest: "crnomelj", stems: [["crnomelj"], ["crnomlj"]] },
  { dest: "zagreb", stems: [["zagreb"]] },
  // Plitvice: tudi samo „plitvičk*“ (Hrvaška dvojina/množina: Plitvicama).
  { dest: "plitvicka-jezera", stems: [["plitvic", "jezer"], ["plitvic"]] },
  { dest: "rijeka", stems: [["rijek"]] },
  // Pula: koren „pul“ (pulover!) → izrecne oblike.
  { dest: "pula", exact: ["pula", "puli", "pule", "pulo"] },
  { dest: "zadar", stems: [["zadar"], ["zadr"]] },
  { dest: "split", stems: [["split"]] },
  { dest: "hvar", stems: [["hvar"]] },
  { dest: "dubrovnik", stems: [["dubrovnik"]] },
  { dest: "kotor", stems: [["kotor"]] },
  { dest: "budva", stems: [["budv"]] },
  { dest: "podgorica", stems: [["podgoric"]] },
  { dest: "durmitor", stems: [["durmitor"]] },
  { dest: "tirana", stems: [["tiran"]] },
  { dest: "berat", stems: [["berat"]] },
  // Gjirokastër: SL „Gjirokaster“ in EN/IT „Gjirokastra“ — dva korena.
  { dest: "gjirokaster", stems: [["gjirokast"], ["gjirokastr"]] },
  { dest: "saranda", stems: [["sarand"]] },

  // ── Balkanska razširitev F1 (#41, 2.60.0) — 36 novih destinacij ────────
  // Red = vrstni red registra (BA → RS → MK → XK → BG → GR). Vsaka igla
  // ročno pregledana proti lažnim pozitivom (glej komentarje posameznih).
  { dest: "sarajevo", stems: [["sarajev"]] },
  { dest: "mostar", stems: [["mostar"]] },
  // Kravica (slap): koren „kravic“ pokriva Kravica/Kravice/Kravicama.
  { dest: "kravica", stems: [["kravic"]] },
  { dest: "jahorina", stems: [["jahorin"]] },
  // Blagaj: koren „blagaj“ bi zadel tudi „blagajna“ (blagajniško okno) →
  // izrecne sklonjske oblike.
  { dest: "blagaj", exact: ["blagaj", "blagaja", "blagaju", "blagajem"] },
  // Travnik: tudi običajna samostalniška raba („travnik“ = trato) — v
  // potovalnem besedilu deterministično ujamemo sklonjske oblike.
  { dest: "travnik", exact: ["travnik", "travnika", "travniku", "travnikom"] },
  { dest: "beograd", stems: [["beograd"]] },
  // Novi Sad: korena „nov“+„sad“ pokrijeta tudi „Novega Sada“ (sklon);
  // zaporedje besed preprečuje generični zadetek na samem „nov“.
  { dest: "novi-sad", stems: [["nov", "sad"]] },
  { dest: "kopaonik", stems: [["kopaonik"]] },
  // Đerdap: SL folded „derdap“ + Madž.-srbska transliteracija „djerdap“.
  { dest: "derdap", stems: [["derdap"], ["djerdap"]] },
  // Sremski Karlovci: pridevnik „sremski“ je specifičen (Srem).
  { dest: "sremski-karlovci", stems: [["sremski", "karlovc"]] },
  { dest: "subotica", stems: [["subotic"]] },
  // Ohrid: koren zadane tudi „ohridsk*“ (Ohridsko jezero).
  { dest: "ohrid", stems: [["ohrid"]] },
  { dest: "skopje", stems: [["skopj"]] },
  { dest: "matka", stems: [["matka"]] },
  { dest: "bitola", stems: [["bitol"]] },
  // Prespa: koren „presp“ bi zadel „prespan“ (pretek. del. prespati) →
  // koren „prespansk“ (Prespansko jezero) + izrecne oblike.
  {
    dest: "prespa",
    stems: [["prespansk"]],
    exact: ["prespa", "prespi", "prespah"],
  },
  { dest: "mavrovo", stems: [["mavrov"]] },
  { dest: "prizren", stems: [["prizren"]] },
  { dest: "rugova", stems: [["rugov"]] },
  // Brezovica (Kosovo): homonim s slov. vasjo Brezovica — izrecne oblike
  // (potovalni kontekst registrira smučarskicenter; dokumentirano tveganje).
  {
    dest: "brezovica",
    exact: ["brezovica", "brezovice", "brezovico", "brezovici"],
  },
  // Gjakova: albansko „Gjakova“ + srbsko „Đakovica“ (fold „djakov“).
  { dest: "gjakova", stems: [["gjakov"], ["djakov"]] },
  { dest: "gadime", stems: [["gadime"]] },
  // Priština: SL/SPS „pristina“ (fold š) + AL/EN „prishtina“.
  { dest: "prishtina", stems: [["pristina"], ["prishtina"]] },
  // Sofija: koren „sofij“ (Sofija je tudi osebno ime — potovalni kontekst).
  { dest: "sofija", stems: [["sofij"]] },
  { dest: "plovdiv", stems: [["plovdiv"]] },
  // Rilski samostan: kombinacije „rila/rilski + samostan/monaster“ (gora
  // Rila sama) + izrecni skloni gore („Rili“, „Rilo“); NE korena „rile“.
  {
    dest: "rila-samostan",
    stems: [["rila", "samostan"], ["rilski", "samostan"], ["rila", "monaster"]],
    exact: ["rila", "rili", "rilo"],
  },
  // Nesebar: bolg. transliteraciji „nesebar“/„nessebar“.
  { dest: "nesebar", stems: [["nesebar"], ["nessebar"]] },
  // Bansko: izrecne sklonjske oblike — koren „bansk“ bi zadel slovaška
  // mesta (Banska Bystrica) in „banski svet“.
  { dest: "bansko", exact: ["bansko", "bansku", "banskog", "banskem"] },
  // Veliko Tarnovo: „tarnov“ je unikaten koren; kombinacija pokrije
  // redkejšo rabo z „Veliko“ („veliko“ samo je generično).
  { dest: "veliko-tarnovo", stems: [["veliko", "tarnov"], ["tarnov"]] },
  { dest: "solun", stems: [["solun"]] },
  // Meteora: izrecne oblike — korena „meteor“/„meter“ bi zadela
  // meteorje/metre (generična besedila).
  { dest: "meteora", exact: ["meteora", "meteri", "metere", "meteoro"] },
  // Kastoria: izrecne oblike — koren „kastori“ bi zadel bobra (množ.).
  {
    dest: "kastoria",
    exact: ["kastoria", "kastorijo", "kastorije", "kastoriji"],
  },
  { dest: "vergina", stems: [["vergin"]] },
  { dest: "ioannina", stems: [["ioannin"]] },
  // Halkidiki: grška transliteraciji „halkidiki“/„chalkidiki“.
  { dest: "halkidiki", stems: [["halkidik"], ["chalkidik"]] },
];

// ── ujemanje ─────────────────────────────────────────────────────────────

export interface DestinationMention {
  /** Registrska destinacija (kanon — zaupan vir). */
  dest: Destination;
  /** Igla, ki je zadela („bled“ / „postojn“ / „soci“ …). */
  needle: string;
  /** Dokaz iz besedila: zadeto zaporedje besed (npr. „bledu“, „Postojni jami“). */
  evidence: string;
  /** Vrsta igle — za prikaz (korensko ujemanje / izrecna oblika). */
  kind: "stem" | "exact";
}

/** Pogodba: igle → slugi registra (testira tests/start-anywhere.test.ts). */
export function needleIndex(): Map<string, DestNeedle> {
  return new Map(DEST_NEEDLES.map((n) => [n.dest, n]));
}

/**
 * Vse destinacije registra, omenjene v besedilu (deterministično, v
 * vrstnem redu registra). Besedilo naj bo že SANITIZIRANO
 * (SYSTEM_DATA_GUARD) — ta modul ne čisti, samo išče.
 */
export function findDestinationMentions(text: string): DestinationMention[] {
  const nb = stripDiacritics(text);
  // besedilo → besede (normalizirano; ločila ob besedah se odstranijo:
  // „v Vintgarju, s…“ → beseda „vintgarju“ — drugače izrecne oblike in
  // korenska ujemanja ob koncu stavka ne bi zadeli)
  const words = nb
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^[^a-z0-9]+/, "").replace(/[^a-z0-9]+$/, ""))
    .filter(Boolean);
  const padded = ` ${words.join(" ")} `;

  const out: DestinationMention[] = [];
  const seen = new Set<string>();

  for (const needle of DEST_NEEDLES) {
    const dest = DESTINATIONS.find((d) => d.slug === needle.dest) ?? null;
    if (!dest) continue; // pogodba: igla brez registra se preskoči (defenzivno)
    if (seen.has(needle.dest)) continue;

    // 1) korenska zaporedja: beseda[i].startsWith(koren[j]) za vse j.
    //    Prva zadeta zaporedje se šteje (dokaz); nadaljne igle iste
    //    destinacije se NE pregledujejo več (ena destinacija = en zadetek).
    if (needle.stems) {
      let found: DestinationMention | null = null;
      scan: for (const seq of needle.stems) {
        for (let i = 0; i + seq.length <= words.length; i++) {
          let ok = true;
          for (let j = 0; j < seq.length; j++) {
            if (!words[i + j].startsWith(seq[j])) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          found = {
            dest,
            needle: seq.join(" "),
            evidence: words.slice(i, i + seq.length).join(" "),
            kind: "stem",
          };
          break scan;
        }
      }
      if (found) {
        seen.add(needle.dest);
        out.push(found);
        continue;
      }
    }

    // 2) izrecne oblike: dobesedno zaporedje besed (obdano s presledki).
    if (needle.exact) {
      for (const phrase of needle.exact) {
        const p = ` ${phrase} `;
        if (padded.includes(p)) {
          seen.add(needle.dest);
          out.push({
            dest,
            needle: phrase,
            evidence: phrase,
            kind: "exact",
          });
          break;
        }
      }
    }
  }

  return out;
}
