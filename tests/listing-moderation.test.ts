/**
 * P0-H TESTI — statusni stroj moderacije listingov (§22) + geo pin.
 *
 * Čiste funkcije (0 DB, 0 omrežje) — isto ime kot canon v
 * src/lib/listing-moderation.ts in src/lib/geo-bbox.ts.
 */

import { describe, expect, test } from "bun:test";

import {
  canActorTransitionListing,
  canTransitionListing,
  isListingPubliclyVisible,
  isListingStatus,
  LISTING_STATUSES,
  statusAfterContentEdit,
  transitionAuditAction,
  validateListingContent,
} from "@/lib/listing-moderation";
import { pointInCountryBbox, validateGeoPin, GEO_COUNTRY_BBOXES } from "@/lib/geo-bbox";

// ── Statusni stroj ─────────────────────────────────────────────────────────

describe("listing-moderation: dovoljeni prehodi", () => {
  test("① vsak status ima vsaj en zakonit prehod", () => {
    for (const s of LISTING_STATUSES) {
      expect(canTransitionListing(s, "draft") || canTransitionListing(s, "pending") || canTransitionListing(s, "published") || canTransitionListing(s, "rejected")).toBe(true);
    }
  });

  test("② klasična pot: draft → pending → published", () => {
    expect(canTransitionListing("draft", "pending")).toBe(true);
    expect(canTransitionListing("pending", "published")).toBe(true);
  });

  test("③ zavrnitev in umik", () => {
    expect(canTransitionListing("pending", "rejected")).toBe(true);
    expect(canTransitionListing("pending", "draft")).toBe(true);
    expect(canTransitionListing("rejected", "draft")).toBe(true);
  });

  test("④ NEVELJAVNI prehodi (zastavljene laži)", () => {
    expect(canTransitionListing("draft", "published")).toBe(false); // partner ne more kar objaviti
    expect(canTransitionListing("draft", "rejected")).toBe(false); // zavrnemo lahko samo predajo
    expect(canTransitionListing("rejected", "published")).toBe(false);
    expect(canTransitionListing("rejected", "pending")).toBe(false); // najprej predelava (draft)
    expect(canTransitionListing("published", "rejected")).toBe(false); // s police le dol/prega
  });
});

describe("listing-moderation: akterji (partner NIKOLI ne objavi sebe)", () => {
  test("⑤ objava je SAMO skrbniška", () => {
    expect(canActorTransitionListing("pending", "published", "admin")).toBe(true);
    expect(canActorTransitionListing("pending", "published", "partner")).toBe(false);
  });

  test("⑥ zavrnitev je SAMO skrbniška", () => {
    expect(canActorTransitionListing("pending", "rejected", "admin")).toBe(true);
    expect(canActorTransitionListing("pending", "rejected", "partner")).toBe(false);
  });

  test("⑦ partner lahko predlaga, umakne, vzame s police, predela", () => {
    expect(canActorTransitionListing("draft", "pending", "partner")).toBe(true);
    expect(canActorTransitionListing("pending", "draft", "partner")).toBe(true);
    expect(canActorTransitionListing("published", "draft", "partner")).toBe(true);
    expect(canActorTransitionListing("rejected", "draft", "partner")).toBe(true);
  });

  test("⑧ skrbnik lahko tudi umakne/prevzame v ponovno moderacijo", () => {
    expect(canActorTransitionListing("published", "draft", "admin")).toBe(true);
    expect(canActorTransitionListing("published", "pending", "admin")).toBe(true);
  });
});

// ── Ponovna moderacija ob spremembi vsebine (§22) ──────────────────────────

describe("listing-moderation: sprememba vsebine sproži ponovno moderacijo", () => {
  test("⑨ urejanje OBJAVLJENEGA → nazaj v predajo", () => {
    expect(statusAfterContentEdit("published")).toBe("pending");
  });

  test("⑩ urejanje V PREDAJI ostane v predaji (vsebina se posodobi v vrsti)", () => {
    expect(statusAfterContentEdit("pending")).toBe("pending");
  });

  test("⑪ urejanje zavrnjenega/osnutka → osnutek (partner predeluje)", () => {
    expect(statusAfterContentEdit("rejected")).toBe("draft");
    expect(statusAfterContentEdit("draft")).toBe("draft");
  });
});

// ── Javna vidljivost ───────────────────────────────────────────────────────

describe("listing-moderation: javna vidljivost", () => {
  test("⑫ javno vidi SAMO objavljeno in aktivno", () => {
    expect(isListingPubliclyVisible("published", true)).toBe(true);
    expect(isListingPubliclyVisible("published", false)).toBe(false);
    expect(isListingPubliclyVisible("pending", true)).toBe(false);
    expect(isListingPubliclyVisible("draft", true)).toBe(false);
    expect(isListingPubliclyVisible("rejected", true)).toBe(false);
  });
});

// ── Kanonska imena dejanj za AuditLog ──────────────────────────────────────

describe("listing-moderation: audit dejanja", () => {
  test("⑬ vsak prehod ima kanonsko ime", () => {
    expect(transitionAuditAction("draft", "pending")).toBe("listing.submitted");
    expect(transitionAuditAction("pending", "published")).toBe("listing.published");
    expect(transitionAuditAction("pending", "rejected")).toBe("listing.rejected");
    expect(transitionAuditAction("pending", "draft")).toBe("listing.withdrawn");
    expect(transitionAuditAction("published", "draft")).toBe("listing.unpublished");
    expect(transitionAuditAction("published", "pending")).toBe("listing.remoderation");
    expect(transitionAuditAction("rejected", "draft")).toBe("listing.revised");
  });
});

// ── Validacija vsebine ─────────────────────────────────────────────────────

describe("listing-moderation: validacija vsebine", () => {
  const ok = {
    name: "Kolesarska tura po Kranjski gori",
    description: "Vodena kolesarska tura po ravninski progi z lokalnim vodičem, primerna za družine.",
    priceCents: 3500,
    stock: 12,
    kind: "experience",
  };

  test("⑭ veljaven vnos gre skozi", () => {
    const res = validateListingContent(ok);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.priceCents).toBe(3500);
      expect(res.value.kind).toBe("experience");
    }
  });

  test("⑮ meje imena (2–120) in opisa (20–2000)", () => {
    expect(validateListingContent({ ...ok, name: "a" }).ok).toBe(false);
    expect(validateListingContent({ ...ok, name: "x".repeat(121) }).ok).toBe(false);
    expect(validateListingContent({ ...ok, description: "prekratek" }).ok).toBe(false);
    expect(validateListingContent({ ...ok, description: "y".repeat(2001) }).ok).toBe(false);
  });

  test("⑯ cena 1 € – 10.000 €, zaloga 0–10.000, vrsta iz množice", () => {
    expect(validateListingContent({ ...ok, priceCents: 50 }).ok).toBe(false); // pod 1 €
    expect(validateListingContent({ ...ok, priceCents: 1_000_001 }).ok).toBe(false);
    expect(validateListingContent({ ...ok, stock: -1 }).ok).toBe(false);
    expect(validateListingContent({ ...ok, stock: 10_001 }).ok).toBe(false);
    expect(validateListingContent({ ...ok, kind: "car" }).ok).toBe(false);
    expect(validateListingContent({ ...ok, priceCents: 100 }).ok).toBe(true); // točno 1 €
  });
});

// ── Geo pin validacija ─────────────────────────────────────────────────────

describe("geo-bbox: veljavacija geo pina", () => {
  test("⑰ brez koordinat je veljavno (iskrena odsotnost)", () => {
    const res = validateGeoPin(null, undefined);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toBeNull();
      expect(res.country).toBeNull();
    }
  });

  test("⑱ Bled (SI) je znotraj okvirja", () => {
    const res = validateGeoPin(46.3683, 14.0944);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.country).toBe("SI");
  });

  test("⑲ Zagreb/Kotor/Tirana so VELJAVNI pinovi (okvirji se prekrivajo — prvi zadetek)", () => {
    // Bbox-i sosednjih držav se prekrivajo: Zagreb pade tudi v SI okvir,
    // Kotor tudi v HR — za veljavnost šteje katerikoli podprt okvir;
    // dodelitev države je informativna (dokumentirano v geo-bbox.ts).
    expect(pointInCountryBbox(45.815, 15.982)).toBe("SI"); // Zagreb → prvi zadetek SI
    expect(pointInCountryBbox(42.42, 18.77)).toBe("HR"); // Kotor → prvi zadetek HR
    expect(pointInCountryBbox(41.33, 19.82)).toBe("AL"); // Tirana → AL
    expect(validateGeoPin(45.815, 15.982).ok).toBe(true);
    expect(validateGeoPin(42.42, 18.77).ok).toBe(true);
    expect(validateGeoPin(41.33, 19.82).ok).toBe(true);
  });

  test("⑳ Dunaj (AT) in Beograd (RS) sta IZVEN — odklon", () => {
    expect(pointInCountryBbox(48.21, 16.37)).toBeNull();
    expect(pointInCountryBbox(44.79, 20.45)).toBeNull();
    const res = validateGeoPin(48.21, 16.37);
    expect(res.ok).toBe(false);
  });

  test("㉑ samo ena koordinata → odklon; ne-številsko → odklon", () => {
    expect(validateGeoPin(46.37, null).ok).toBe(false);
    expect(validateGeoPin("abc", 14.1).ok).toBe(false);
  });

  test("㉒ okvirji držav so zamrznjeni in smiselni (SI najseverneje 46.9)", () => {
    expect(GEO_COUNTRY_BBOXES.SI[2]).toBe(46.9);
    expect(Object.isFrozen(GEO_COUNTRY_BBOXES)).toBe(true);
  });
});
