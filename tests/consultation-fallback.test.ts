/**
 * P0-H TESTI — konzultacije "VPRAŠAJ LOKALCA" (§20, §29).
 *
 * Validacija vnosa + DETERMINISTIČNI odgovor (isti vhod → isti izhod),
 * iskrenostne sestavine (razkritje vira, vodene povezave, okvirni
 * strošek iz registra — nikoli izmišljena cena).
 */

import { describe, expect, test } from "bun:test";

import {
  buildConsultationFallbackAnswer,
  CONSULTATION_BUDGETS,
  CONSULTATION_DAILY_LIMIT,
  CONSULTATION_INTERESTS,
  generateConsultationToken,
  matchDestination,
  utcDayStart,
  validateConsultationInput,
} from "@/lib/consultation-fallback";

const okInput = {
  email: "popotnik@example.com",
  question: "Kateri izleti so primerni za družino z dvema otrokoma pozimi?",
  destinationName: "Bled",
  travelDates: "24.–28. 12. 2026",
  partyDescription: "2 odrasla + 2 otroka (5 in 8 let)",
  budget: "300-600",
  interests: ["druzina", "narava"],
};

describe("consultation: validacija vnosa", () => {
  test("① veljaven popoln vnos", () => {
    const res = validateConsultationInput(okInput);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.email).toBe("popotnik@example.com");
      expect(res.value.interests).toEqual(["druzina", "narava"]);
    }
  });

  test("② e-pošta je obvezna in veljavna", () => {
    expect(validateConsultationInput({ ...okInput, email: "ni-veljavna" }).ok).toBe(false);
    expect(validateConsultationInput({ ...okInput, email: "" }).ok).toBe(false);
  });

  test("③ vprašanje 20–2000 znakov", () => {
    expect(validateConsultationInput({ ...okInput, question: "kratek" }).ok).toBe(false);
    expect(
      validateConsultationInput({ ...okInput, question: "x".repeat(2001) }).ok
    ).toBe(false);
    expect(
      validateConsultationInput({ ...okInput, question: "y".repeat(20) }).ok
    ).toBe(true);
  });

  test("④ proračun iz fiksne množice; interesi podmnožica (≤ 5)", () => {
    expect(validateConsultationInput({ ...okInput, budget: "300-600" }).ok).toBe(true);
    expect(validateConsultationInput({ ...okInput, budget: "iz-misli" }).ok).toBe(false);
    expect(validateConsultationInput({ ...okInput, interests: ["kriminalka"] }).ok).toBe(false);
    expect(
      validateConsultationInput({ ...okInput, interests: [...CONSULTATION_INTERESTS].slice(0, 5) }).ok
    ).toBe(true);
    expect(
      validateConsultationInput({ ...okInput, interests: [...CONSULTATION_INTERESTS].slice(0, 6) }).ok
    ).toBe(false);
  });

  test("⑤ prazni neobvezni dodatki → null (iskrena odsotnost)", () => {
    const res = validateConsultationInput({
      email: "a@example.com",
      question: "Kje je najlepša plaža za septembrski obisk z majhnim otrokom?",
      destinationName: "   ",
      travelDates: "",
      partyDescription: undefined,
      budget: "",
      interests: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.destinationName).toBeNull();
      expect(res.value.travelDates).toBeNull();
      expect(res.value.budget).toBeNull();
      expect(res.value.interests).toEqual([]);
    }
  });
});

describe("consultation: ujemanje destinacije", () => {
  test("⑥ točno ime in sklanjanje (blede → Bled)", () => {
    expect(matchDestination("Bled")?.slug).toBe("bled");
    expect(matchDestination("bled")?.slug).toBe("bled");
  });

  test("⑦ neznana destinacija → undefined (iskreno)", () => {
    expect(matchDestination("Mars")).toBeUndefined();
    expect(matchDestination("")).toBeUndefined();
  });
});

describe("consultation: deterministični odgovor", () => {
  const validValue = () => {
    const res = validateConsultationInput(okInput);
    if (!res.ok) throw new Error("testni vnos mora biti veljaven");
    return res.value;
  };

  test("⑧ isti vhod → BITNO isti izhod (0 naključnosti)", () => {
    const a = buildConsultationFallbackAnswer(validValue());
    const b = buildConsultationFallbackAnswer(validValue());
    expect(a).toBe(b);
  });

  test("⑨ znana destinacija → podatki registra + okvirni strošek + povezava", () => {
    const answer = buildConsultationFallbackAnswer(validValue());
    expect(answer).toContain("Bled");
    expect(answer).toContain("Okvirni strošek na osebo");
    expect(answer).toContain("/destinacija/bled");
  });

  test("⑩ interesi → vodene povezave partnerjev (/api/affiliate/go)", () => {
    const answer = buildConsultationFallbackAnswer(validValue());
    expect(answer).toContain("/api/affiliate/go?provider=getyourguide");
    expect(answer).toContain("Družinsko");
  });

  test("⑪ proračun je razkrit kot OKVIR, ne ponudba", () => {
    const answer = buildConsultationFallbackAnswer(validValue());
    expect(answer).toContain("to je okvir za načrtovanje, ne ponudba");
  });

  test("⑫ neznana destinacija → iskrena opomba (brez izmišljanja)", () => {
    const res = validateConsultationInput({
      ...okInput,
      destinationName: "Reykjavik",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const answer = buildConsultationFallbackAnswer(res.value);
      expect(answer).toContain("še nimamo podatkov v uradnem registru");
      expect(answer).not.toContain("/destinacija/");
    }
  });

  test("⑬ vedno vsebuje razkritje izvora (deterministično, brez AI)", () => {
    const answer = buildConsultationFallbackAnswer(validValue());
    expect(answer).toContain("samodejni deterministični vodnik (brez AI)");
  });

  test("⑭ brez interesov → brez bloka povezav (iskrena odsotnost)", () => {
    const res = validateConsultationInput({
      email: "a@example.com",
      question: "Kateri izleti so primerni za družino z dvema otrokoma pozimi?",
      interests: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const answer = buildConsultationFallbackAnswer(res.value);
      expect(answer).not.toContain("ZA TVOJE INTERESE");
    }
  });
});

describe("consultation: žeton + dnevna meja", () => {
  test("⑮ žeton je 32 hex znakov (URL varen)", () => {
    const t = generateConsultationToken();
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(generateConsultationToken()).not.toBe(t);
  });

  test("⑯ UTC dan se začne ob 00:00 UTC", () => {
    const now = new Date("2026-10-08T15:42:11Z");
    const start = utcDayStart(now);
    expect(start.toISOString()).toBe("2026-10-08T00:00:00.000Z");
  });

  test("⑰ dnevna omejitev je 3 (kanon izvirnika)", () => {
    expect(CONSULTATION_DAILY_LIMIT).toBe(3);
    expect(CONSULTATION_BUDGETS).toContain("300-600");
  });
});
