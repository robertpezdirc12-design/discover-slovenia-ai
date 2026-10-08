/**
 * PLAN-EDIT-ENGINE — P1-B §6 (issue #3): POGOVORNO UREJANJE NAČRTA.
 * ============================================================================
 * Deterministični razčlenjevalnik slovenskih ukazov + nespremenljive
 * (immutable) mutacije nad KANONSKIM modelom SharedPlan (isti model kot
 * načrtovalnik/Go Mode/oblak — BREZ vzporednega chat-state) + strukturiran
 * diff za prikaz „Kaj se spremeni?" + razveljavitev (undo = prejšnje
 * stanje, ki ga hrani klicatelj — motor je brezstanjski).
 *
 * 0-AI kanon: 0 žetonov, 0 omrežja; isti vhod → isti izhod.
 * Iskrenost: neznan postanek/dan → jasna napaka z navodilom; naslov
 * nikoli ne ponareja uspeha.
 */

import {
  DESTINATIONS,
  getDestination,
  type Destination,
} from "@/lib/slovenia-data";
import type { SharedPlan, SharedPlanDay } from "@/lib/shared-plan";
import { sanitizeUntrustedText } from "@/lib/system-data-guard";

// ── ukazi ─────────────────────────────────────────────────────────────────

export type EditCommand =
  | { kind: "add"; destSlug: string; day: number | null }
  | { kind: "remove"; destSlug: string }
  | { kind: "move"; destSlug: string; toDay: number }
  | { kind: "swap"; fromSlug: string; toSlug: string }
  | { kind: "shorten" }
  | { kind: "extend" }
  | { kind: "optimize" };

export interface ParseOk {
  ok: true;
  command: EditCommand;
}
export interface ParseError {
  ok: false;
  /** Iskrena SL napaka z navodilom (za prikaz uporabniku). */
  error: string;
}
export type ParseResult = ParseOk | ParseError;

/** Pomoč z vsemi podprtimi ukazi (iskrena dokumentirana meja). */
export const PLAN_EDIT_HELP =
  "Podprti ukazi: „dodaj <destinacijo> [na dan N]“, „odstrani <destinacijo>“, „premakni <destinacijo> na dan N“, „zamenjaj <A> z <B>“, „skrajšaj“ (pobriše zadnji dan), „podaljšaj“ (doda dan z najboljšo novo destinacijo), „optimiziraj“ (preuredi postanke po vožnji znotraj dneva).";

function stripDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/č|ć/g, "c")
    .replace(/š/g, "s")
    .replace(/ž/g, "z");
}

/**
 * Poišči destinacijo po imenu ali slugu (narečno, brez naglasov).
 * Toleranca na slovenske sklone: če polna oblika ne zadane, poskusimo
 * okrajšano (npr. „Mariborom" → „Mariboro" → „Maribor") — deterministično,
 * najdaljja zadeta oblika zmaga (nikoli ne izmišljamo imena).
 */
function findDestination(query: string): Destination | null {
  const q = stripDiacritics(query.trim());
  if (q.length < 3) return null;
  // Kandidati od najdaljše proti krajšim okrajšanim oblikam (min 4 znaki).
  for (let len = q.length; len >= Math.min(4, q.length); len--) {
    const probe = q.slice(0, len);
    let byContains: Destination | null = null;
    for (const d of DESTINATIONS) {
      if (stripDiacritics(d.slug.replace(/-/g, " ")) === probe) return d;
      if (stripDiacritics(d.name) === probe) return d;
      if (!byContains && stripDiacritics(d.name).includes(probe)) byContains = d;
    }
    if (byContains) return byContains;
  }
  return null;
}

const DAY_RE = /(?:na\s+dan\s+(\d{1,2}))/;
const SWAP_RE = /zamenjaj\s+(.+?)\s+(?:z|za|za\s+namen)\s+(.+)$/;

/**
 * Razčleni slovenski ukaz (SYSTEM_DATA_GUARD: vhod sanitiziran, dolžina
 * omejena). Vrne EditCommand ali iskreno napako s pomočjo.
 */
export function parseEditCommand(input: string): ParseResult {
  const clean = sanitizeUntrustedText(input, {
    maxLen: 200,
    fallback: "",
  });
  if (clean.length === 0) {
    return { ok: false, error: "Prazen ukaz. " + PLAN_EDIT_HELP };
  }
  const nb = stripDiacritics(clean);

  const dayMatch = nb.match(DAY_RE);
  const day = dayMatch ? Number.parseInt(dayMatch[1], 10) : null;

  if (/^(dodaj|dodajte|vstavi)/.test(nb)) {
    const rest = clean
      .replace(/^[dD]odaj(?:te)?\s+/, "")
      .replace(/[nN]a\s+[dD]an\s+\d{1,2}\s*$/, "")
      .trim();
    const dest = findDestination(rest);
    if (!dest) {
      return {
        ok: false,
        error: `„${rest}" ne prepoznam kot destinacijo iz registra (38 zapisov). Preveri ime (npr. Bled, Piran, Postojna).`,
      };
    }
    return { ok: true, command: { kind: "add", destSlug: dest.slug, day } };
  }

  if (/^(odstrani|odstranite|pobrisi|izbrisi|zbrisi)/.test(nb)) {
    const rest = clean
      .replace(/^[oO]dstrani(?:te)?\s+|^([pPiIzZzZbB][oBb])\s*(?:iz)?[bB]ri[sš]i\s*/u, "")
      .trim();
    const dest = findDestination(rest);
    if (!dest) {
      return { ok: false, error: `„${rest}" ne prepoznam — ime mora biti iz registra destinacij.` };
    }
    return { ok: true, command: { kind: "remove", destSlug: dest.slug } };
  }

  if (/^(premakni|premaknite|premesti)/.test(nb)) {
    const rest = clean
      .replace(/^[pP]remakni(?:te)?\s+/, "")
      .replace(/[nN]a\s+[dD]an\s+\d{1,2}\s*$/, "")
      .trim();
    const dest = findDestination(rest);
    if (!dest) {
      return { ok: false, error: `„${rest}" ne prepoznam kot obstoječi postanek.` };
    }
    if (day === null) {
      return { ok: false, error: "Premikanje zahteva ciljni dan, npr. „premakni Bled na dan 2“." };
    }
    return { ok: true, command: { kind: "move", destSlug: dest.slug, toDay: day } };
  }

  if (/^zamenjaj/.test(nb)) {
    const m = clean.match(SWAP_RE);
    if (!m) {
      return { ok: false, error: "Zamenjava zahteva obliko „zamenjaj <A> z <B>“." };
    }
    const a = findDestination(m[1].trim());
    const b = findDestination(m[2].trim());
    if (!a || !b) {
      return { ok: false, error: "Zamenjava potrebuje dve imeni iz registra destinacij." };
    }
    return { ok: true, command: { kind: "swap", fromSlug: a.slug, toSlug: b.slug } };
  }

  if (/^(skrajsaj|skrajsajte|kraj)/.test(nb) || /^odstrani zadnji dan/.test(nb)) {
    return { ok: true, command: { kind: "shorten" } };
  }
  if (/^(podaljsaj|podaljsajte|dodaj dan|dodal bi dan)/.test(nb)) {
    return { ok: true, command: { kind: "extend" } };
  }
  if (/^(optimiziraj|optimiraj|preuredi|urejen)/.test(nb)) {
    return { ok: true, command: { kind: "optimize" } };
  }

  return { ok: false, error: "Ukaza ne prepoznam. " + PLAN_EDIT_HELP };
}

// ── diff ──────────────────────────────────────────────────────────────────

export interface PlanDiff {
  added: string[];
  removed: string[];
  moved: { name: string; fromDay: number; toDay: number }[];
  daysBefore: number;
  daysAfter: number;
}

/** Strukturirana razlika dveh načrtov (deterministično, po imenih). */
export function buildPlanDiff(a: SharedPlan, b: SharedPlan): PlanDiff {
  const namesWithDay = (plan: SharedPlan) => {
    const map = new Map<string, number>();
    for (const d of plan.days ?? []) {
      for (const loc of d.locations ?? []) {
        const key = loc.destSlug ?? loc.name;
        if (!map.has(key)) map.set(key, d.day);
      }
    }
    return map;
  };
  const before = namesWithDay(a);
  const after = namesWithDay(b);
  const added: string[] = [];
  const removed: string[] = [];
  const moved: PlanDiff["moved"] = [];
  const nameOf = new Map<string, string>();
  for (const d of [...(a.days ?? []), ...(b.days ?? [])]) {
    for (const loc of d.locations ?? []) nameOf.set(loc.destSlug ?? loc.name, loc.name);
  }
  for (const [key, day] of after) {
    if (!before.has(key)) added.push(nameOf.get(key) ?? key);
    else if (before.get(key) !== day) {
      moved.push({ name: nameOf.get(key) ?? key, fromDay: before.get(key)!, toDay: day });
    }
  }
  for (const key of before.keys()) {
    if (!after.has(key)) removed.push(nameOf.get(key) ?? key);
  }
  added.sort();
  removed.sort();
  moved.sort((x, y) => x.name.localeCompare(y.name));
  return {
    added,
    removed,
    moved,
    daysBefore: (a.days ?? []).length,
    daysAfter: (b.days ?? []).length,
  };
}

/** Človeški SL izpis diffa (za klepet/UI). */
export function formatPlanDiff(diff: PlanDiff): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`dodano: ${diff.added.join(", ")}`);
  if (diff.removed.length) parts.push(`odstranjeno: ${diff.removed.join(", ")}`);
  if (diff.moved.length)
    parts.push(
      diff.moved.map((m) => `${m.name}: dan ${m.fromDay} → dan ${m.toDay}`).join(", ")
    );
  if (diff.daysBefore !== diff.daysAfter)
    parts.push(`dni: ${diff.daysBefore} → ${diff.daysAfter}`);
  if (parts.length === 0) return "Brez sprememb.";
  return parts.join(" · ") + ".";
}

// ── mutacije (immutable) ─────────────────────────────────────────────────

export interface ApplyOk {
  ok: true;
  plan: SharedPlan;
  diff: PlanDiff;
  /** Kratek SL opis izvedenega dejanja. */
  summary: string;
}
export type ApplyResult = ApplyOk | { ok: false; error: string };

function clonePlan(plan: SharedPlan): SharedPlan {
  return JSON.parse(JSON.stringify(plan)) as SharedPlan;
}

function normDays(plan: SharedPlan): SharedPlanDay[] {
  return (plan.days ?? []).filter((d) => Array.isArray(d.locations));
}

function findStopIndex(days: SharedPlanDay[], slug: string): { dayIdx: number; locIdx: number } | null {
  for (let di = 0; di < days.length; di++) {
    const li = days[di].locations.findIndex((l) => l.destSlug === slug);
    if (li >= 0) return { dayIdx: di, locIdx: li };
  }
  return null;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Uredi kanonski načrt z ukazom (NESPREMENLJIVO — vhodni plan ostane
 * nedotaknjen; vrača nov objekt + diff). Vsa dejanja deterministična.
 */
export function applyEditCommand(plan: SharedPlan, command: EditCommand): ApplyResult {
  const next = clonePlan(plan);
  // POVRATI filtra dodelimo nazaj (push/pop dneva mora mutirati next.days).
  next.days = normDays(next);
  const days = next.days;
  if (days.length === 0) {
    return { ok: false, error: "Načrt nima dni — najprej ustvari načrt v načrtovalniku." };
  }

  switch (command.kind) {
    case "add": {
      const dest = getDestination(command.destSlug);
      if (!dest) return { ok: false, error: "Neznana destinacija." };
      if (findStopIndex(days, dest.slug)) {
        return { ok: false, error: `${dest.name} je že na načrtu.` };
      }
      const targetIdx =
        command.day !== null
          ? days.findIndex((d) => d.day === command.day)
          : days.length - 1;
      if (targetIdx < 0) {
        return {
          ok: false,
          error: `Načrt ima ${days.length} ${days.length === 1 ? "dan" : days.length === 2 ? "dneva" : "dneve"} — dan ${command.day} ne obstaja.`,
        };
      }
      days[targetIdx].locations.push({ name: dest.name, destSlug: dest.slug });
      return finish(plan, next, `Dodan postanek ${dest.name} (dan ${days[targetIdx].day}).`);
    }

    case "remove": {
      const dest = getDestination(command.destSlug);
      if (!dest) return { ok: false, error: "Neznana destinacija." };
      const at = findStopIndex(days, dest.slug);
      if (!at) return { ok: false, error: `${dest.name} ni na načrtu.` };
      days[at.dayIdx].locations.splice(at.locIdx, 1);
      return finish(plan, next, `Odstranjen postanek ${dest.name}.`);
    }

    case "move": {
      const dest = getDestination(command.destSlug);
      if (!dest) return { ok: false, error: "Neznana destinacija." };
      const at = findStopIndex(days, dest.slug);
      if (!at) return { ok: false, error: `${dest.name} ni na načrtu.` };
      const targetIdx = days.findIndex((d) => d.day === command.toDay);
      if (targetIdx < 0) {
        return {
          ok: false,
          error: `Dan ${command.toDay} ne obstaja (načrt ima ${days.length} dni).`,
        };
      }
      const [loc] = days[at.dayIdx].locations.splice(at.locIdx, 1);
      days[targetIdx].locations.push(loc);
      return finish(plan, next, `${dest.name} premaknjen na dan ${command.toDay}.`);
    }

    case "swap": {
      const from = getDestination(command.fromSlug);
      const to = getDestination(command.toSlug);
      if (!from || !to) return { ok: false, error: "Neznana destinacija." };
      const at = findStopIndex(days, from.slug);
      if (!at) return { ok: false, error: `${from.name} ni na načrtu.` };
      if (findStopIndex(days, to.slug)) {
        return { ok: false, error: `${to.name} je že na načrtu — najprej odstrani enega.` };
      }
      days[at.dayIdx].locations[at.locIdx] = { name: to.name, destSlug: to.slug };
      return finish(plan, next, `${from.name} zamenjan z ${to.name}.`);
    }

    case "shorten": {
      if (days.length <= 1) {
        return { ok: false, error: "Načrt ima samo en dan — skrajšanje ni mogoče." };
      }
      const removedDay = days[days.length - 1];
      if (removedDay.locations.length > 0) {
        const lastPrev = days[days.length - 2];
        lastPrev.locations.push(...removedDay.locations);
      }
      days.pop();
      return finish(plan, next, "Zadnji dan odstranjen (postanki prestavljeni na prejšnji dan).");
    }

    case "extend": {
      const inPlan = new Set(
        days.flatMap((d) => d.locations.map((l) => l.destSlug).filter(Boolean) as string[])
      );
      const lastStop = days[days.length - 1].locations
        .map((l) => (l.destSlug ? getDestination(l.destSlug) : undefined))
        .filter((d): d is Destination => Boolean(d))
        .pop();
      const candidate = DESTINATIONS.filter((d) => !inPlan.has(d.slug)).sort((a, b) => {
        if (lastStop) {
          const da = haversineKm(lastStop.coords, a.coords);
          const dbb = haversineKm(lastStop.coords, b.coords);
          if (da !== dbb) return da - dbb;
        }
        return b.rating - a.rating || a.slug.localeCompare(b.slug);
      })[0];
      if (!candidate) {
        return { ok: false, error: "Vseh 38 destinacij je že na načrtu — podaljšanje ni mogoče." };
      }
      const newDayNo = days[days.length - 1].day + 1;
      days.push({
        day: newDayNo,
        title: `Dan ${newDayNo}`,
        locations: [{ name: candidate.name, destSlug: candidate.slug }],
      });
      return finish(
        plan,
        next,
        `Dodan dan ${newDayNo} z ${candidate.name} (najbližja najbolje ocenjena nova destinacija).`
      );
    }

    case "optimize": {
      for (const day of days) {
        const withCoords = day.locations
          .map((l) => ({ loc: l, dest: l.destSlug ? getDestination(l.destSlug) : undefined }))
          .filter(
            (x): x is { loc: (typeof day.locations)[number]; dest: Destination } =>
              Boolean(x.dest)
          );
        if (withCoords.length < 3) continue;
        // Najbližji-sosed od prvega postanka (sidro ostane, deterministično).
        const anchor = withCoords[0];
        const rest = withCoords.slice(1);
        const ordered: { loc: (typeof withCoords)[number]["loc"]; dest: Destination }[] = [
          anchor,
        ];
        const remaining = [...rest];
        while (remaining.length > 0) {
          const last = ordered[ordered.length - 1].dest;
          remaining.sort((a, b) => {
            const da = haversineKm(last.coords, a.dest.coords);
            const db = haversineKm(last.coords, b.dest.coords);
            return da - db || a.dest.slug.localeCompare(b.dest.slug);
          });
          ordered.push(remaining.shift()!);
        }
        const withoutCoords = day.locations.filter(
          (l) => !(l.destSlug && getDestination(l.destSlug))
        );
        day.locations = [
          ...ordered.map((o) => o.loc),
          ...withoutCoords,
        ];
      }
      return finish(plan, next, "Postanki preurejeni po najkrajši vožnji znotraj dneva (prvi postanek ostaja sidro).");
    }
  }
}

function finish(before: SharedPlan, after: SharedPlan, summary: string): ApplyOk {
  return { ok: true, plan: after, diff: buildPlanDiff(before, after), summary };
}
