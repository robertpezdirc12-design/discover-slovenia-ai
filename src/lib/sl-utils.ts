/**
 * SL-UTILS — slovenski jezikovni helperji (ednina / dvojina / množina),
 * rekonstruirani 1:1 iz izvorne kode (trip-polls / trip-social / trip-diary
 * so vsi nosili isti podvojeni set — tu je enkraten vir kanona).
 *
 * Slovenščina: 1 → ednina, 2 → dvojina, 3–4 → množina (priredni),
 * 5+ → splošna množina. Za 100, 101, 102 … velja r = n % 100.
 */

/** Slovenščina: izberi obliko besede za število n. */
export function slUnit(
  n: number,
  one: string,
  two: string,
  few: string,
  many: string
): string {
  if (n === 1) return one;
  const r = n % 100;
  if (r === 2) return two;
  if (r === 3 || r === 4) return few;
  return many;
}

/** "pred 2 min", "pred 3 h" — relativni čas z varnostnim stropom
 *  (zapis ne more biti starejši od floorIso = nastanek potovanja). */
export function slTimeAgo(iso: string, floorIso?: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "neznano";

  // Sanity cap: zapis ne more biti starejši od potovanja samega
  // (pokvarjeni podatki) — v tem primeru pokažemo absolutni datum.
  if (floorIso) {
    const floor = Date.parse(floorIso);
    if (!Number.isNaN(floor) && ms < floor) {
      return new Date(ms).toLocaleDateString("sl-SI", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }

  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 45) return "pravkar";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `pred ${minutes} ${slUnit(minutes, "minuto", "minutama", "minutami", "minutami")}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `pred ${hours} ${slUnit(hours, "uro", "urama", "urami", "urami")}`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `pred ${days} ${slUnit(days, "dnem", "dnevoma", "dnevi", "dnevi")}`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `pred ${months} ${slUnit(months, "mesecem", "mesecema", "meseci", "meseci")}`;
  }

  const years = Math.floor(days / 365);
  return `pred ${years} ${slUnit(years, "letom", "letoma", "leti", "leti")}`;
}

/** "3 glasovi" — pravilne slovenske oblike. */
export function votesLabel(n: number): string {
  if (n === 0) return "Ni še glasov";
  return `${n} ${slUnit(n, "glas", "glasa", "glasi", "glasov")}`;
}

/** "X osebam je všeč" — dativne oblike. */
export function likesLabel(n: number): string {
  if (n === 0) return "Ni še všečkov";
  const people =
    n === 1 ? "1 osebi" : n === 2 ? "2 osebama" : `${n} osebam`;
  return `${people} je to potovanje všeč`;
}

/** "3 spomini" — pravilne slovenske oblike. */
export function entriesLabel(n: number): string {
  if (n === 0) return "še ni spominov";
  return `${n} ${slUnit(n, "spomin", "spomina", "spomini", "spominov")}`;
}

/** "2 sporočili" — pravilne slovenske oblike. */
export function messagesLabel(n: number): string {
  if (n === 0) return "Ni sporočil";
  return `${n} ${slUnit(n, "sporočilo", "sporočili", "sporočila", "sporočil")}`;
}
