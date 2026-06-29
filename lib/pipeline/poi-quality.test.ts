import { describe, it, expect } from "vitest";
import {
  isBusinessClosed,
  isWithinCategoryDistance,
  hasMinimumQualitySignals,
  isNameCategoryMismatch,
  evaluateGooglePlaceQuality,
  findNearbyGroups,
  calculateQualityStats,
  WALK_METERS_PER_MINUTE,
  type QualityRejection,
  type NearbyGroupInput,
} from "./poi-quality";

// === isBusinessClosed ===

describe("isBusinessClosed", () => {
  it("avviser permanently closed", () => {
    expect(isBusinessClosed({ business_status: "CLOSED_PERMANENTLY" })).toBe(
      true
    );
  });

  it("godtar temporarily closed (trust-systemet håndterer)", () => {
    expect(isBusinessClosed({ business_status: "CLOSED_TEMPORARILY" })).toBe(
      false
    );
  });

  it("godtar operational", () => {
    expect(isBusinessClosed({ business_status: "OPERATIONAL" })).toBe(false);
  });

  it("godtar missing status (ukjent)", () => {
    expect(isBusinessClosed({})).toBe(false);
  });
});

// === isWithinCategoryDistance ===

describe("isWithinCategoryDistance", () => {
  it("avviser restaurant 22 min unna (Crispy Fried Chicken case)", () => {
    // 22 min * 80 m/min = 1760m
    expect(isWithinCategoryDistance(1760, "restaurant")).toBe(false);
  });

  it("godtar restaurant 10 min unna", () => {
    expect(isWithinCategoryDistance(800, "restaurant")).toBe(true);
  });

  it("godtar sykehus 30 min unna", () => {
    // 30 min * 80 = 2400m, maks er 45 min
    expect(isWithinCategoryDistance(2400, "hospital")).toBe(true);
  });

  it("godtar kjøpesenter 25 min unna (bil-destinasjon)", () => {
    // 25 min * 80 = 2000m, maks er 30 min
    expect(isWithinCategoryDistance(2000, "shopping")).toBe(true);
  });

  it("avviser busstopp 12 min unna", () => {
    // 12 min * 80 = 960m, maks er 10 min
    expect(isWithinCategoryDistance(960, "bus")).toBe(false);
  });

  it("godtar busstopp 8 min unna", () => {
    expect(isWithinCategoryDistance(640, "bus")).toBe(true);
  });

  it("bruker default 25 min for ukjent kategori", () => {
    // 23 min * 80 = 1840m, default maks er 25 min
    expect(isWithinCategoryDistance(1840, "unknown_category")).toBe(true);
  });

  it("avviser ukjent kategori over default 25 min", () => {
    // 27 min * 80 = 2160m
    expect(isWithinCategoryDistance(2160, "unknown_category")).toBe(false);
  });

  it("bruker WALK_METERS_PER_MINUTE = 80", () => {
    expect(WALK_METERS_PER_MINUTE).toBe(80);
  });
});

// === hasMinimumQualitySignals ===

describe("hasMinimumQualitySignals", () => {
  it("avviser POI uten rating og reviews (Oasen Yoga case)", () => {
    expect(hasMinimumQualitySignals({}, "restaurant")).toBe(false);
  });

  it("avviser POI med 0 reviews og ingen rating", () => {
    expect(
      hasMinimumQualitySignals({ user_ratings_total: 0 }, "restaurant")
    ).toBe(false);
  });

  it("godtar POI med rating og reviews", () => {
    expect(
      hasMinimumQualitySignals(
        { rating: 4.0, user_ratings_total: 5 },
        "restaurant"
      )
    ).toBe(true);
  });

  it("godtar POI med kun reviews >= 1", () => {
    expect(
      hasMinimumQualitySignals({ user_ratings_total: 3 }, "restaurant")
    ).toBe(true);
  });

  it("godtar POI med kun rating (0 reviews)", () => {
    expect(
      hasMinimumQualitySignals(
        { rating: 3.5, user_ratings_total: 0 },
        "restaurant"
      )
    ).toBe(true);
  });

  it("unntar park fra kvalitetssjekk", () => {
    expect(hasMinimumQualitySignals({}, "park")).toBe(true);
  });

  it("unntar skole fra kvalitetssjekk", () => {
    expect(hasMinimumQualitySignals({}, "skole")).toBe(true);
  });

  it("unntar barnehage fra kvalitetssjekk", () => {
    expect(hasMinimumQualitySignals({}, "barnehage")).toBe(true);
  });

  it("unntar buss fra kvalitetssjekk", () => {
    expect(hasMinimumQualitySignals({}, "bus")).toBe(true);
  });

  it("unntar idrett fra kvalitetssjekk", () => {
    expect(hasMinimumQualitySignals({}, "idrett")).toBe(true);
  });
});

// === isNameCategoryMismatch ===

describe("isNameCategoryMismatch", () => {
  // Positive cases — mismatch detected (should return true)
  it("avviser renholdsfirma som restaurant (Brilliance Cleaning)", () => {
    expect(isNameCategoryMismatch("Brilliance Cleaning", "restaurant")).toBe(
      true
    );
  });

  it("avviser byggefirma som park (MT Byggteknikk)", () => {
    expect(isNameCategoryMismatch("MT Byggteknikk", "park")).toBe(true);
  });

  it("avviser parkeringsplass som kjøpesenter (Parkering IKEA Leangen)", () => {
    expect(isNameCategoryMismatch("Parkering IKEA Leangen", "shopping")).toBe(
      true
    );
  });

  it("avviser norsk renholdsfirma som restaurant", () => {
    expect(isNameCategoryMismatch("Renhold Service AS", "restaurant")).toBe(
      true
    );
  });

  it("avviser eiendomsfirma som park", () => {
    expect(isNameCategoryMismatch("Eiendom Invest AS", "park")).toBe(true);
  });

  // Negative cases — legitimate POI (should return false)
  it("godtar ekte restaurant", () => {
    expect(isNameCategoryMismatch("Pizzapizza", "restaurant")).toBe(false);
  });

  it("godtar ekte park", () => {
    expect(isNameCategoryMismatch("Estenstadmarka", "park")).toBe(false);
  });

  it("godtar norsk kafé", () => {
    expect(isNameCategoryMismatch("Dromedar Kaffebar", "cafe")).toBe(false);
  });

  it("ignorerer kategorier uten blocklist", () => {
    expect(isNameCategoryMismatch("Whatever Corp", "bus")).toBe(false);
  });

  it("godtar 'Transport' som restaurant (word-boundary matching)", () => {
    // "Transport" er et kjent restaurantnavn i Oslo
    // Skal IKKE matche "transport" i blocklist pga word-boundary
    expect(isNameCategoryMismatch("Transport", "restaurant")).toBe(false);
  });

  it("avviser 'Transport Service AS' som restaurant", () => {
    // Her er "transport" et ord i et firmanavn
    expect(
      isNameCategoryMismatch("Transport Service AS", "restaurant")
    ).toBe(true);
  });

  it("godtar hotel uten blocklist", () => {
    expect(isNameCategoryMismatch("Park Inn by Radisson", "hotel")).toBe(false);
  });
});

// === evaluateGooglePlaceQuality ===

describe("evaluateGooglePlaceQuality", () => {
  const makePlace = (overrides: Record<string, unknown> = {}) => ({
    name: "Test Restaurant",
    rating: 4.0,
    user_ratings_total: 10,
    ...overrides,
  });

  it("godtar god restaurant innenfor avstand", () => {
    const result = evaluateGooglePlaceQuality(
      makePlace(),
      "restaurant",
      800 // 10 min
    );
    expect(result.pass).toBe(true);
  });

  it("avviser permanently closed", () => {
    const rejections: QualityRejection[] = [];
    const result = evaluateGooglePlaceQuality(
      makePlace({ business_status: "CLOSED_PERMANENTLY" }),
      "restaurant",
      800,
      rejections
    );
    expect(result.pass).toBe(false);
    expect(result.rejection?.filter).toBe("business_status");
    expect(rejections).toHaveLength(1);
  });

  it("avviser for langt (Crispy Fried Chicken case)", () => {
    const rejections: QualityRejection[] = [];
    const result = evaluateGooglePlaceQuality(
      makePlace(),
      "restaurant",
      1760, // 22 min
      rejections
    );
    expect(result.pass).toBe(false);
    expect(result.rejection?.filter).toBe("distance");
  });

  it("avviser uten kvalitetssignaler (Oasen Yoga case)", () => {
    const result = evaluateGooglePlaceQuality(
      makePlace({ rating: undefined, user_ratings_total: 0 }),
      "restaurant",
      800
    );
    expect(result.pass).toBe(false);
    expect(result.rejection?.filter).toBe("quality");
  });

  it("avviser feilkategorisert (Brilliance Cleaning case)", () => {
    const result = evaluateGooglePlaceQuality(
      makePlace({ name: "Brilliance Cleaning" }),
      "restaurant",
      800
    );
    expect(result.pass).toBe(false);
    expect(result.rejection?.filter).toBe("name_mismatch");
  });

  it("sjekker billigste filter først (business_status før distance)", () => {
    const rejections: QualityRejection[] = [];
    evaluateGooglePlaceQuality(
      makePlace({ business_status: "CLOSED_PERMANENTLY" }),
      "restaurant",
      1760, // Også for langt
      rejections
    );
    // Skal stoppes av business_status, ikke distance
    expect(rejections[0].filter).toBe("business_status");
  });

  it("unntar park fra kvalitetssjekk", () => {
    const result = evaluateGooglePlaceQuality(
      makePlace({ rating: undefined, user_ratings_total: 0 }),
      "park",
      800
    );
    expect(result.pass).toBe(true);
  });

  it("accumulator er optional — fungerer uten", () => {
    const result = evaluateGooglePlaceQuality(
      makePlace({ business_status: "CLOSED_PERMANENTLY" }),
      "restaurant",
      800
    );
    expect(result.pass).toBe(false);
    // Ingen crash uten rejections-parameter
  });
});

// === findNearbyGroups ===

describe("findNearbyGroups", () => {
  // H2 Frisør og H2 Grilstad Marina — begge haircare, < 200m fra hverandre
  const h2Frisor: NearbyGroupInput = {
    id: "h2-1",
    name: "H2 Frisør",
    categoryId: "haircare",
    lat: 63.4305,
    lng: 10.4700,
  };
  const h2Grilstad: NearbyGroupInput = {
    id: "h2-2",
    name: "H2 Grilstad Marina",
    categoryId: "haircare",
    lat: 63.4310,
    lng: 10.4705,
  };

  it("grupperer POI-er innen 300m med samme kategori", () => {
    const groups = findNearbyGroups([h2Frisor, h2Grilstad]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("grupperer IKKE POI-er med ulik kategori", () => {
    const restaurant: NearbyGroupInput = {
      id: "r1",
      name: "Nearby Restaurant",
      categoryId: "restaurant",
      lat: 63.4305,
      lng: 10.4700, // Samme lokasjon som h2Frisor
    };
    const groups = findNearbyGroups([h2Frisor, restaurant]);
    expect(groups).toHaveLength(0);
  });

  it("grupperer IKKE POI-er > 300m fra hverandre", () => {
    const farAway: NearbyGroupInput = {
      id: "far",
      name: "Far Away Frisør",
      categoryId: "haircare",
      lat: 63.4400, // ~1km unna
      lng: 10.4700,
    };
    const groups = findNearbyGroups([h2Frisor, farAway]);
    expect(groups).toHaveLength(0);
  });

  it("returnerer tom array for ingen duplikater", () => {
    const solo: NearbyGroupInput = {
      id: "solo",
      name: "Solo Frisør",
      categoryId: "haircare",
      lat: 63.4000,
      lng: 10.4000,
    };
    const groups = findNearbyGroups([solo]);
    expect(groups).toHaveLength(0);
  });

  it("håndterer tre nærliggende POI-er som én gruppe", () => {
    const third: NearbyGroupInput = {
      id: "h2-3",
      name: "H2 Bakklandet",
      categoryId: "haircare",
      lat: 63.4307,
      lng: 10.4702,
    };
    const groups = findNearbyGroups([h2Frisor, h2Grilstad, third]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });
});

// === calculateQualityStats ===

describe("calculateQualityStats", () => {
  it("beregner korrekte stats", () => {
    const rejections: QualityRejection[] = [
      {
        name: "A",
        categoryId: "restaurant",
        reason: "test",
        filter: "business_status",
      },
      {
        name: "B",
        categoryId: "restaurant",
        reason: "test",
        filter: "distance",
      },
      {
        name: "C",
        categoryId: "park",
        reason: "test",
        filter: "distance",
      },
    ];
    const stats = calculateQualityStats(10, rejections);
    expect(stats.total).toBe(10);
    expect(stats.passed).toBe(7);
    expect(stats.rejected).toBe(3);
    expect(stats.byReason.business_status).toBe(1);
    expect(stats.byReason.distance).toBe(2);
  });

  it("håndterer 0 rejections", () => {
    const stats = calculateQualityStats(5, []);
    expect(stats.passed).toBe(5);
    expect(stats.rejected).toBe(0);
  });
});
