/**
 * TRIP-DATES — testi DST-varnega datumskega jedra poti (P0-E, issue #1 §10).
 *
 * Kanoni:
 *  - datumi so LOKALNI "YYYY-MM-DD" — NIKOLI UTC polnoč (DST preklop
 *    25. 10. 2026 CEST→CET ne sme porušiti dneva);
 *  - poldnevno sidro (12:00 lokalno) obstaja v vsaki coni;
 *  - horizon napovedi: preteklo → past, 0..15 dni → available, ≥16 → too_far;
 *  - validacija: start ≤ end, razpon ≤ 30 dni, strogi ISO nizi.
 *
 * Kanon: 0 omrežja, 0 db; imena v slovenščini.
 */

import { describe, expect, test } from "bun:test";

import {
  MAX_TRIP_DAYS,
  addDaysIso,
  daysBetweenIso,
  eachTripDay,
  forecastAvailabilityFor,
  formatDateLong,
  formatDateShort,
  isIsoDate,
  isoOfLocalDate,
  toLocalNoon,
  todayIso,
  validateTripDates,
  weekdayLong,
  weekdayShort,
} from "../src/lib/trip-dates";

describe("trip-dates: osnovne oblike", () => {
  test("isIsoDate sprejme veljavne in zavrne neveljavne", () => {
    expect(isIsoDate("2026-10-17")).toBe(true);
    expect(isIsoDate("2026-1-7")).toBe(false); // ni nič-polnjena oblika
    expect(isIsoDate("17.10.2026")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false); // mesec 13
    expect(isIsoDate("2026-02-30")).toBe(false); // 30. februar
    expect(isIsoDate("2024-02-29")).toBe(true); // prestopno leto
    expect(isIsoDate("2100-02-29")).toBe(false); // 2100 NI prestopno
    expect(isIsoDate("1999-12-31")).toBe(false); // izven okvirja < 2000
  });

  test("toLocalNoon vrača poldne (12:00) lokalnega dne", () => {
    const noon = toLocalNoon("2026-10-17");
    expect(noon).not.toBeNull();
    expect(noon!.getHours()).toBe(12);
    expect(noon!.getDate()).toBe(17);
    expect(noon!.getMonth()).toBe(9); // oktober (0-based)
  });

  test("toLocalNoon null za smetje", () => {
    expect(toLocalNoon("abc")).toBeNull();
    expect(toLocalNoon("2026-10-99")).toBeNull();
    expect(toLocalNoon("")).toBeNull();
  });

  test("isoOfLocalDate je inverz toLocalNoon", () => {
    expect(isoOfLocalDate(toLocalNoon("2026-10-17")!)).toBe("2026-10-17");
  });
});

describe("trip-dates: DST-VARNO računanje (preklop CEST→CET 25. 10. 2026)", () => {
  test("addDaysIso čez preklop ure ohrani pravi dan", () => {
    // Sobota 24. 10. 2026 (CEST) + 1 = nedelja 25. 10. 2026 (CET) — dan se NE poruši.
    expect(addDaysIso("2026-10-24", 1)).toBe("2026-10-25");
    // Preklop nazaj CET→CEST: nedelja 29. 3. 2026 + 1 = 30. 3. 2026.
    expect(addDaysIso("2026-03-29", 1)).toBe("2026-03-30");
  });

  test("addDaysIso prek meseca in leta", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01"); // 2026 ni prestopno
  });

  test("addDaysIso 0 dni = isti dan (identiteta)", () => {
    expect(addDaysIso("2026-10-17", 0)).toBe("2026-10-17");
  });

  test("addDaysIso null ob neveljavnem vhodu", () => {
    expect(addDaysIso("smetje", 3)).toBeNull();
  });

  test("daysBetweenIso čez DST-preklop je točno število dni", () => {
    // 24. 10. → 31. 10. 2026 (čez preklop) = 7 dni, NE 6,99 ali 7,04.
    expect(daysBetweenIso("2026-10-24", "2026-10-31")).toBe(7);
    expect(daysBetweenIso("2026-03-28", "2026-03-31")).toBe(3);
  });

  test("daysBetweenIso negativen, ko je b pred a", () => {
    expect(daysBetweenIso("2026-10-31", "2026-10-24")).toBe(-7);
  });
});

describe("trip-dates: validacija množice", () => {
  test("veljavna množica", () => {
    const v = validateTripDates({ start: "2026-10-17", end: "2026-10-20" });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.dates.start).toBe("2026-10-17");
      expect(v.dates.end).toBe("2026-10-20");
    }
  });

  test("start == end je dovoljen (enodnevna pot)", () => {
    expect(validateTripDates({ start: "2026-10-17", end: "2026-10-17" }).ok).toBe(true);
  });

  test("start > end zavrnjen", () => {
    const v = validateTripDates({ start: "2026-10-20", end: "2026-10-17" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain("pred");
  });

  test("razpon > 30 dni zavrnjen", () => {
    const v = validateTripDates({ start: "2026-01-01", end: "2026-12-31" });
    expect(v.ok).toBe(false);
  });

  test("točno 30 dni je še dovoljeno", () => {
    expect(validateTripDates({ start: "2026-01-01", end: "2026-01-30" }).ok).toBe(true);
  });

  test("neveljavni datumi zavrnjeni (fail-closed)", () => {
    expect(validateTripDates({ start: "abc", end: "2026-10-20" }).ok).toBe(false);
    expect(validateTripDates(null).ok).toBe(false);
    expect(validateTripDates({ start: 17, end: 20 }).ok).toBe(false);
    expect(validateTripDates({ start: "2026-02-30", end: "2026-03-01" }).ok).toBe(false);
  });
});

describe("trip-dates: eachTripDay", () => {
  test("dni 1..N z zaporednimi dayIndex", () => {
    const days = eachTripDay({ start: "2026-10-17", end: "2026-10-19" });
    expect(days).not.toBeNull();
    expect(days!.map((d) => d.dayIndex)).toEqual([1, 2, 3]);
    expect(days![0].iso).toBe("2026-10-17");
    expect(days![2].iso).toBe("2026-10-19");
  });

  test("enodnevna pot = en dan", () => {
    const days = eachTripDay({ start: "2026-10-17", end: "2026-10-17" });
    expect(days).not.toBeNull();
    expect(days!.length).toBe(1);
  });

  test("čez DST-preklop so vsi dnevi zaporedni (brez lukenji/dvojnih)", () => {
    const days = eachTripDay({ start: "2026-10-24", end: "2026-10-27" });
    expect(days!.map((d) => d.iso)).toEqual([
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  test("null ob neveljavni množici", () => {
    expect(eachTripDay({ start: "2026-10-20", end: "2026-10-17" })).toBeNull();
    expect(eachTripDay({ start: "2026-01-01", end: "2026-03-01" })).toBeNull(); // > 30 dni
  });

  test("MAX_TRIP_DAYS = 30 (usklajeno s S1 dayIndex)", () => {
    expect(MAX_TRIP_DAYS).toBe(30);
  });
});

describe("trip-dates: oznake SL/EN", () => {
  test("weekdayShort/Long", () => {
    // 17. 10. 2026 = sobota
    expect(weekdayShort("2026-10-17", "sl")).toBe("sob");
    expect(weekdayLong("2026-10-17", "sl")).toBe("sobota");
    expect(weekdayShort("2026-10-17", "en")).toBe("Sat");
    expect(weekdayLong("2026-10-17", "en")).toBe("Saturday");
    // 19. 10. 2026 = ponedeljek
    expect(weekdayLong("2026-10-19", "sl")).toBe("ponedeljek");
  });

  test("formatDateShort", () => {
    expect(formatDateShort("2026-10-17", "sl")).toBe("17. okt 2026");
    expect(formatDateShort("2026-10-17", "en")).toBe("Oct 17, 2026");
  });

  test("formatDateLong", () => {
    expect(formatDateLong("2026-10-17", "sl")).toBe("17. oktobra 2026");
    expect(formatDateLong("2026-10-17", "en")).toBe("October 17, 2026");
  });

  test("neveljaven datum se NE izmišljuje (vrne vhod)", () => {
    expect(formatDateShort("smetje", "sl")).toBe("smetje");
    expect(weekdayLong("smetje", "sl")).toBe("");
  });
});

describe("trip-dates: horizont napovedi (iskrenost)", () => {
  test("danes = available, včeraj = past", () => {
    const today = todayIso(new Date(2026, 9, 17, 15, 0));
    expect(forecastAvailabilityFor(today, today)).toBe("available");
    expect(forecastAvailabilityFor("2026-10-16", today)).toBe("past");
  });

  test("danes + 15 = še available, + 16 = too_far", () => {
    const today = todayIso(new Date(2026, 9, 17, 15, 0));
    expect(forecastAvailabilityFor("2026-11-01", today)).toBe("available"); // +15
    expect(forecastAvailabilityFor("2026-11-02", today)).toBe("too_far"); // +16
  });

  test("neveljaven datum = too_far (fail-closed)", () => {
    expect(forecastAvailabilityFor("smetje", "2026-10-17")).toBe("too_far");
  });
});
