/**
 * LEGACY-MIGRATION (issue #2 §1/§4) — čiste preslikave 1.163.4 → 2.x.
 *
 * Zakon: preslikava je DETERMINISTIČNA, mehanska in ISKRENA:
 *  - nič izmišljenih podatkov (fiksne oznake so eksplicitne);
 *  - vsak nerazčrljiv zapis → null (klicni slo ga izpusti s poročilom);
 *  - valute: EUR Float → centi Int (×100, zaokroženo);
 *  - booleani: SQLite 0/1 in PostgreSQL true/false (flag helper);
 *  - bcrypt zapisi iz 1.163.4 se še vedno preverijo (prijava brez izgube).
 */

import { describe, expect, test } from "bun:test";
import {
  mapUser,
  planUserPreferences,
  mapItinerary,
  mapCollaborator,
  mapPoll,
  mapComment,
  mapProduct,
  mapOrder,
  mapOrderItems,
  mapAuditLog,
  mapLead,
  mapNewsletter,
  mapConsultation,
  mapStripeEvent,
  mapListing,
  RETIRED_LEGACY_MODELS,
} from "../scripts/migrate-legacy-data";
import { hashPassword, verifyPassword, isLegacyBcryptHash } from "../src/lib/password";
import bcrypt from "bcryptjs";

const T = "2026-01-15T10:00:00.000Z";

describe("mapUser — uporabniki", () => {
  test("cel zapis se preslika; name null → e-pošta (identiteta, ne izmišljeno)", () => {
    const r = mapUser({ id: "u1", email: "Ana@Example.si", name: null, passwordHash: "$2b$abc", createdAt: T, updatedAt: T });
    expect(r.user.name).toBe("ana@example.si");
    expect(r.user.email).toBe("ana@example.si");
    expect(r.user.role).toBe("user");
    expect(r.user.passwordHash).toBe("$2b$abc"); // zapis se NE spreminja
  });
  test("preferences JSON se izroči ločeno (razčlenjuje UserPreference plast)", () => {
    const r = mapUser({ id: "u1", email: "a@b.si", name: "Ana", passwordHash: "x", preferences: '{"budget":"€€"}', createdAt: T, updatedAt: T });
    expect(r.legacyPreferencesJson).toBe('{"budget":"€€"}');
  });
});

describe("planUserPreferences — preferences JSON → UserPreference IMPORTED (matrika §1)", () => {
  test("kanonske vrednosti se prenesejo (budget €€, interests seznam)", () => {
    const r = planUserPreferences('{"budget":"€€","interests":["gore","vino"]}');
    expect(r.entries).toEqual([
      { key: "budget", value: "\"€€\"" },
      { key: "interests", value: '["gore","vino"]' },
    ]);
    expect(r.skipped).toEqual([]);
  });

  test("neznan ključ (groupSize …) in nekanonska vrednost se arhivirata z razlogom — NE ugibamo", () => {
    const r = planUserPreferences('{"groupSize":2,"budget":"mid","season":"poletje"}');
    expect(r.entries).toEqual([]);
    const reasons = r.skipped.map((s) => s.reason).sort();
    expect(reasons).toContain('neznan ključ „groupSize" (ni v kanonu PREFERENCE_KEYS) — arhiv: backup');
    expect(reasons).toContain('neveljavna vrednost za „budget" — arhiv: backup');
    expect(reasons).toContain('neveljavna vrednost za „season" — arhiv: backup');
  });

  test("prazni seznami/besedila se ne prenesejo (ni vsebine = ni zapisa)", () => {
    const r = planUserPreferences('{"interests":[],"food":""}');
    expect(r.entries).toEqual([]);
    expect(r.skipped.some((s) => s.reason.includes("prazna vrednost"))).toBe(true);
  });

  test("nerazčrljiv JSON / ne-objekt / null → arhiv z razlogom (brez padca)", () => {
    expect(planUserPreferences("{pokvarjeno").skipped[0]?.reason).toContain("nerazčrljiv");
    expect(planUserPreferences('["tabela"]').skipped[0]?.reason).toContain("ni JSON objekt");
    expect(planUserPreferences(null).entries).toEqual([]);
  });

  test("duplikat ključa v JSON objektu → en zapis (JSON.parse: zadnji zmaga, deterministično)", () => {
    const r = planUserPreferences('{"budget":"€","budget":"€€€"}');
    expect(r.entries).toEqual([{ key: "budget", value: "\"€€€\"" }]);
  });
});

describe("mapItinerary — poti", () => {
  const base = { id: "t1", shareId: "sh1", userId: "u1", name: null, isPublic: 1, createdAt: T, updatedAt: T };

  test("veljaven SharedPlan itinerer → TravelJourney z lokacijami", () => {
    const r = mapItinerary({
      ...base,
      itinerary: JSON.stringify({ days: [{ day: 1, locations: [{ name: "Bled", destSlug: "bled", time: "09:00" }] }] }),
    });
    expect(r).not.toBeNull();
    expect(r!.journey.title).toBe("Prenesena pot"); // fiksna iskrena oznaka
    expect(r!.journey.data).toContain('"Bled"');
    expect(r!.journey.isPublic).toBe(true); // sqlite 1 → true
    expect(r!.journey.dateStart).toBeNull();
  });

  test("anonimna pot (userId null) → null (2.x zahteva lastnika)", () => {
    expect(mapItinerary({ ...base, userId: null, itinerary: "{}" })).toBeNull();
  });

  test("pot brez razpoznavnih lokacij → null (iskren izpust, ne prazna pot)", () => {
    expect(mapItinerary({ ...base, itinerary: JSON.stringify({ days: [{ day: 1, locations: [] }] }) })).toBeNull();
    expect(mapItinerary({ ...base, itinerary: "ne- json" })).toBeNull();
  });

  test("postgres boolean (true) deluje enako kot sqlite 1", () => {
    const r = mapItinerary({
      ...base,
      isPublic: true,
      itinerary: JSON.stringify({ days: [{ day: 1, locations: [{ name: "Kranj" }] }] }),
    });
    expect(r!.journey.isPublic).toBe(true);
  });
});

describe("mapCollaborator — sodelovanja", () => {
  const base = { id: "c1", shareId: "sh1", userId: "u2", role: "EDITOR", status: "ACTIVE", invitedBy: "session:u1", createdAt: T };
  test("ACTIVE EDITOR → EDITOR", () => {
    expect(mapCollaborator(base)!.collaborator.role).toBe("EDITOR");
  });
  test("COMMENTER → VIEWER (2.x nima komentar-vloge)", () => {
    expect(mapCollaborator({ ...base, role: "COMMENTER" })!.collaborator.role).toBe("VIEWER");
  });
  test("PENDING/REVOKED/brez uporabnika → null", () => {
    expect(mapCollaborator({ ...base, status: "PENDING" })).toBeNull();
    expect(mapCollaborator({ ...base, status: "REVOKED" })).toBeNull();
    expect(mapCollaborator({ ...base, userId: null })).toBeNull();
  });
});

describe("mapPoll — ankete", () => {
  const base = { id: "p1", shareId: "sh1", question: "Kateri dan?", options: '["Petek","Sobota"]', closed: 0, createdAt: T };
  test("anketa + 2 možnosti (sortOrder 0..1)", () => {
    const r = mapPoll(base)!;
    expect(r.poll.question).toBe("Kateri dan?");
    expect(r.poll.status).toBe("OPEN");
    expect(r.options).toHaveLength(2);
    expect(r.options[1]!.sortOrder).toBe(1);
  });
  test("zaprta anketa → CLOSED", () => {
    expect(mapPoll({ ...base, closed: 1 })!.poll.status).toBe("CLOSED");
  });
  test("<2 veljavnih možnosti → null", () => {
    expect(mapPoll({ ...base, options: '["Samo ena"]' })).toBeNull();
    expect(mapPoll({ ...base, options: "pokvarjen json" })).toBeNull();
  });
});

describe("mapComment — komentarji → klepet", () => {
  const base = { id: "m1", shareId: "sh1", authorName: "Maja", text: "Vidimo se ob 9h!", isAI: 0, createdAt: T };
  test("običajen komentar", () => {
    const r = mapComment(base)!;
    expect(r.message.body).toBe("Vidimo se ob 9h!");
    expect(r.message.isAiBot).toBe(false);
    expect(r.message.authorId).toBeNull(); // stari komentarji so anonimni
  });
  test("AI vrstica → isAiBot true", () => {
    expect(mapComment({ ...base, isAI: true })!.message.isAiBot).toBe(true);
  });
  test("brez besedila/avtorja → null", () => {
    expect(mapComment({ ...base, text: null })).toBeNull();
    expect(mapComment({ ...base, authorName: null })).toBeNull();
  });
});

describe("mapProduct — izdelki", () => {
  const base = { id: "pr1", slug: "med-gorica", name: "Med", description: "Lokalni med", price: 12.5, stock: 5, saleCount: 2, status: "published", ownerId: null, createdAt: T, updatedAt: T };
  test("cena EUR Float → centi Int (×100 zaokroženo)", () => {
    const r = mapProduct(base)!;
    expect(r.product.priceCents).toBe(1250);
    expect(r.product.kind).toBe("product"); // 1.163.4 = fizični izdelki
    expect(r.product.status).toBe("published");
  });
  test("neznan status → draft (iskrena meja, ne izmišljanje)", () => {
    expect(mapProduct({ ...base, status: "weird" })!.product.status).toBe("draft");
  });
  test("brez cene/slug → null", () => {
    expect(mapProduct({ ...base, price: null })).toBeNull();
    expect(mapProduct({ ...base, slug: null })).toBeNull();
  });
});

describe("mapOrder / mapOrderItems — naročila", () => {
  const base = { id: "o1", status: "paid", total: 42.42, stripeSessionId: "cs_1", paidAt: T, createdAt: T, updatedAt: T };
  test("skupna cena → centi; demo KONSERVATIVNO true (payout varnost)", () => {
    const r = mapOrder(base)!;
    expect(r.order.totalCents).toBe(4242);
    expect(r.order.demo).toBe(true); // nikoli ne označimo dvoumnega prihodka kot pravega
    expect(r.order.status).toBe("paid");
  });
  test("neznan status → null (status je ključen za payout — fail-closed)", () => {
    expect(mapOrder({ ...base, status: "shipped" })).toBeNull();
  });
  test("items JSON → vrstice; brez cene izpuščene (ne izmišljujemo cene)", () => {
    const items = mapOrderItems({ items: JSON.stringify([{ productId: "pr1", qty: 2, price: 12.5, name: "Med" }, { productId: "pr2", qty: 1 }]) });
    expect(items).toHaveLength(1);
    expect(items[0]!.priceCentsSnapshot).toBe(1250);
  });
  test("pokvarjen items JSON → []", () => {
    expect(mapOrderItems({ items: "!!!NotJson" })).toHaveLength(0);
  });
});

describe("mapAuditLog — revizijski dnevnik", () => {
  const base = { id: "a1", actorId: "own1", actorEmail: null, actorRole: "owner", action: "listing_approved", resourceType: "listing", resourceId: "l1", resourceName: "Gostilna", metadata: '{"x":1}', createdAt: T };
  test("owner (B2B) → partner (2.x kanon)", () => {
    const r = mapAuditLog(base)!;
    expect(r.entry.actorType).toBe("partner");
    expect(r.entry.entityType).toBe("listing");
    expect(r.entry.entityId).toBe("l1");
  });
  test("admin → owner; stripe → system; neznan → system", () => {
    expect(mapAuditLog({ ...base, actorRole: "admin" })!.entry.actorType).toBe("owner");
    expect(mapAuditLog({ ...base, actorRole: "stripe" })!.entry.actorType).toBe("system");
    expect(mapAuditLog({ ...base, actorRole: "what" })!.entry.actorType).toBe("system");
  });
  test("resourceId null → uporabi resourceName; oba manjkata → null", () => {
    expect(mapAuditLog({ ...base, resourceId: null })!.entry.entityId).toBe("Gostilna");
    expect(mapAuditLog({ ...base, resourceId: null, resourceName: null })).toBeNull();
  });
});

describe("mapLead — B2B leadi", () => {
  const base = { id: "le1", email: "Info@Kmetija.si", businessName: "Kmetija Pezdirc", businessType: "farm", message: "Zanima nas prodaja.", status: "nov", createdAt: T, updatedAt: T };
  test('"nov" → new; note = podjetje — sporočilo (oba DEJSTVI)', () => {
    const r = mapLead(base)!;
    expect(r.lead.status).toBe("new");
    expect(r.lead.email).toBe("info@kmetija.si");
    expect(r.lead.note).toBe("Kmetija Pezdirc — Zanima nas prodaja.");
    expect(r.lead.interest).toBe("farm");
  });
  test('"kontaktiran" → contacted; "zakljucen" → null (arhiv)', () => {
    expect(mapLead({ ...base, status: "kontaktiran" })!.lead.status).toBe("contacted");
    expect(mapLead({ ...base, status: "zakljucen" })).toBeNull();
  });
});

describe("mapNewsletter / mapConsultation / mapStripeEvent / mapListing", () => {
  test("newsletter: lowercase email", () => {
    expect(mapNewsletter({ id: "n1", email: "A@B.si", createdAt: T })!.subscriber.email).toBe("a@b.si");
    expect(mapNewsletter({ id: "n1", email: null, createdAt: T })).toBeNull();
  });
  test("consultation: answerSource ai → manual (2.x nima AI odgovorov — iskrena preslikava vira)", () => {
    const r = mapConsultation({ id: "k1", accessToken: "tok1", email: "a@b.si", question: "Kam na Bled?", answer: "Odgovor", answerSource: "ai", status: "delivered", deliveredAt: T, createdAt: T })!;
    expect(r.consultation.answerSource).toBe("manual");
    expect(r.consultation.status).toBe("delivered");
  });
  test("consultation brez odgovora → fallback", () => {
    const r = mapConsultation({ id: "k2", accessToken: "tok2", email: "a@b.si", question: "?", answer: null, status: "pending", createdAt: T })!;
    expect(r.consultation.answerSource).toBe("fallback");
  });
  test("stripe event: eventId = legacy id (evt_…)", () => {
    expect(mapStripeEvent({ id: "evt_123", eventType: "checkout.session.completed", createdAt: T })!.event.eventId).toBe("evt_123");
  });
  test("listing: region ostane null (destinationName ≠ regija — NE preslikamo)", () => {
    const r = mapListing({ id: "li1", name: "Gostilna", category: "restaurant", lat: 46.1, lng: 14.5, address: "Ljubljana 1", createdAt: T, updatedAt: T })!;
    expect(r.listing.region).toBeNull();
    expect(r.listing.lat).toBe(46.1);
  });
});

describe("RETIRED_LEGACY_MODELS — zavestne izpustitve", () => {
  test("AIUsageLog in PushSubscription sta eksplicitno upokojena (0-AI / brez push infrastrukture)", () => {
    expect(RETIRED_LEGACY_MODELS).toContain("AIUsageLog");
    expect(RETIRED_LEGACY_MODELS).toContain("PushSubscription");
  });
  test("Booking (1.163.4 izkušnje) je upokojen — 2.x B2C tok = Order/OrderItem", () => {
    expect(RETIRED_LEGACY_MODELS).toContain("Booking");
  });
});

describe("password — bcrypt zapisi iz 1.163.4", () => {
  test("bcrypt zapis se preveri (migracija brez izgube dostopa)", () => {
    const bcryptHash = bcrypt.hashSync("staro-geslo", 4);
    expect(isLegacyBcryptHash(bcryptHash)).toBe(true);
    expect(verifyPassword("staro-geslo", bcryptHash)).toBe(true);
    expect(verifyPassword("napacno", bcryptHash)).toBe(false);
  });
  test("scrypt (2.x) ostane kanon za nove račune", () => {
    const h = hashPassword("novo");
    expect(isLegacyBcryptHash(h)).toBe(false);
    expect(verifyPassword("novo", h)).toBe(true);
  });
  test("bcrypt 2a/2b/2y predpone + smeti vrnejo false (fail-closed)", () => {
    expect(isLegacyBcryptHash("$2a$xx")).toBe(true);
    expect(verifyPassword("x", "smeti")).toBe(false);
  });
});
