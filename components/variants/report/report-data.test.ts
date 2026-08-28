import { describe, it, expect } from "vitest";
import {
  byTierThenScore,
  applyCategoryFilter,
  getInitialVisibleCount,
  transformToReportData,
} from "./report-data";
import { isAnchorPOI } from "@/lib/board/anchor-poi";
import type { POI } from "@/lib/types";

/** Minimal POI factory for testing sort behavior */
function makePOI(overrides: Partial<POI> & { id: string }): POI {
  return {
    name: overrides.id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: "restaurant", name: "Restaurant", icon: "Utensils", color: "#ef4444" },
    ...overrides,
  };
}

function makeBusPOI(id: string): POI {
  return makePOI({
    id,
    name: `Holdeplass ${id}`,
    category: { id: "bus", name: "Buss", icon: "Bus", color: "#3b82f6" },
  });
}

function makeSkolePOI(id: string, name: string): POI {
  return makePOI({
    id,
    name,
    category: { id: "skole", name: "Skole", icon: "School", color: "#22c55e" },
  });
}

describe("byTierThenScore", () => {
  it("sorts tier 1 before tier 2 before tier 3", () => {
    const pois = [
      makePOI({ id: "t3", poiTier: 3, googleRating: 4.9, googleReviewCount: 500 }),
      makePOI({ id: "t1", poiTier: 1, googleRating: 4.0, googleReviewCount: 50 }),
      makePOI({ id: "t2", poiTier: 2, googleRating: 4.5, googleReviewCount: 200 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("treats null tier as 2.5 (between tier 2 and tier 3)", () => {
    const pois = [
      makePOI({ id: "t3", poiTier: 3, googleRating: 4.9, googleReviewCount: 500 }),
      makePOI({ id: "null", googleRating: 4.5, googleReviewCount: 300 }),
      makePOI({ id: "t2", poiTier: 2, googleRating: 4.0, googleReviewCount: 50 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["t2", "null", "t3"]);
  });

  it("sorts by formula score within same tier", () => {
    const pois = [
      makePOI({ id: "low", poiTier: 2, googleRating: 4.0, googleReviewCount: 50 }),
      makePOI({ id: "high", poiTier: 2, googleRating: 4.7, googleReviewCount: 2000 }),
      makePOI({ id: "mid", poiTier: 2, googleRating: 4.5, googleReviewCount: 200 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });

  it("with all null tiers, falls back to pure formula score sort (backward compat)", () => {
    const pois = [
      makePOI({ id: "low", googleRating: 4.0, googleReviewCount: 50 }),
      makePOI({ id: "high", googleRating: 4.7, googleReviewCount: 2000 }),
      makePOI({ id: "mid", googleRating: 4.5, googleReviewCount: 200 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });
});

describe("applyCategoryFilter", () => {
  // Brøset center coordinates
  const brosetCenter = { lat: 63.418, lng: 10.395 };
  // Pre-computed schoolZone for Brøset (avoids importing GeoJSON in test)
  const brosetZone = { barneskole: "SINGSAKER", ungdomsskole: "ROSENBORG" };

  it("kaster IKKE holdeplasser — alle 10 slipper gjennom (maxCount fjernet 2026-08-24)", () => {
    const pois = Array.from({ length: 10 }, (_, i) => makeBusPOI(`bus-${i}`));
    const filtered = applyCategoryFilter("bus", pois, brosetCenter);
    expect(filtered.length).toBe(10);
    expect(filtered[0].id).toBe("bus-0");
    expect(filtered[9].id).toBe("bus-9");
  });

  it("kaster IKKE idrettsanlegg — alle 8 slipper gjennom", () => {
    const pois = Array.from({ length: 8 }, (_, i) =>
      makePOI({
        id: `idrett-${i}`,
        name: `Idrettsplass ${i}`,
        category: { id: "idrett", name: "Idrett", icon: "Activity", color: "#22c55e" },
      })
    );
    const filtered = applyCategoryFilter("idrett", pois, brosetCenter);
    expect(filtered.length).toBe(8);
  });

  it("initialVisibleCount styrer FØRSTE skjerm, ikke hva som finnes", () => {
    // Regelen for idrett er nå bare en visnings-terskel: 3 kort synlig, resten
    // bak «Hent flere». Filteret skal likevel levere alt.
    expect(getInitialVisibleCount("idrett")).toBe(3);
    expect(getInitialVisibleCount("bus")).toBe(5);
  });

  it("does not cap categories without rules (e.g. restaurant)", () => {
    const pois = Array.from({ length: 20 }, (_, i) => makePOI({ id: `r-${i}` }));
    const filtered = applyCategoryFilter("restaurant", pois, brosetCenter);
    expect(filtered.length).toBe(20);
  });

  it("does not cap haircare (frisør)", () => {
    const pois = Array.from({ length: 15 }, (_, i) =>
      makePOI({
        id: `hair-${i}`,
        name: `Frisør ${i}`,
        category: { id: "haircare", name: "Frisør", icon: "Scissors", color: "#22c55e" },
      })
    );
    const filtered = applyCategoryFilter("haircare", pois, brosetCenter);
    expect(filtered.length).toBe(15);
  });

  it("filters skole by school zone — keeps Singsaker barneskole for Brøset", () => {
    const pois = [
      makeSkolePOI("s1", "Singsaker skole"),
      makeSkolePOI("s2", "Ila skole"),
      makeSkolePOI("s3", "Lade skole"),
      makeSkolePOI("s4", "Rosenborg ungdomsskole"),
    ];
    const filtered = applyCategoryFilter("skole", pois, brosetCenter, brosetZone);
    const names = filtered.map((p) => p.name);
    expect(names).toContain("Singsaker skole");
    expect(names).toContain("Rosenborg ungdomsskole");
    expect(names).not.toContain("Ila skole");
    expect(names).not.toContain("Lade skole");
  });

  it("keeps higher education regardless of school zone", () => {
    const pois = [
      makeSkolePOI("s1", "Singsaker skole"),
      makeSkolePOI("s2", "Ila skole"),
      makeSkolePOI("ntnu", "NTNU Gløshaugen"),
      makeSkolePOI("vgs", "Trondheim Katedralskole VGS"),
    ];
    const filtered = applyCategoryFilter("skole", pois, brosetCenter, brosetZone);
    const names = filtered.map((p) => p.name);
    expect(names).toContain("Singsaker skole");
    expect(names).toContain("NTNU Gløshaugen");
    expect(names).toContain("Trondheim Katedralskole VGS");
    expect(names).not.toContain("Ila skole");
  });

  it("passes all skole POIs through when schoolZone is undefined", () => {
    // When no schoolZone is provided (e.g. non-Trondheim project), filter is a no-op
    const pois = [
      makeSkolePOI("s1", "Singsaker skole"),
      makeSkolePOI("s2", "Ila skole"),
    ];
    const filtered = applyCategoryFilter("skole", pois, brosetCenter, undefined);
    // No zone → school-zone filter skipped, all POIs pass through
    expect(filtered.length).toBe(2);
  });

  it("passes all skole POIs through when zone has BOTH nulls (utenfor kretsdekning)", () => {
    // Begge nulls = punktet ligger utenfor Trondheims kretspolygoner (f.eks.
    // Straumen/Inderøy). Før 2026-08-12 kastet filteret da alle ikke-høyere
    // skoler — barne- og ungdomsskolen forsvant fra alle boards utenfor
    // Trondheim. Nå: ingen dekning → ingen filtrering.
    const utenforDekning = { barneskole: null, ungdomsskole: null };
    const pois = [
      makeSkolePOI("s1", "Sakshaug skole"),
      makeSkolePOI("s2", "Inderøy ungdomsskole"),
    ];
    const filtered = applyCategoryFilter("skole", pois, brosetCenter, utenforDekning);
    expect(filtered.length).toBe(2);
  });

  it("filters normalt når kun én av kretsene er kjent (delvis dekning)", () => {
    // Én non-null = reell kretsdata — filteret skal fortsatt kjøre.
    const delvisZone = { barneskole: "Singsaker", ungdomsskole: null };
    const pois = [
      makeSkolePOI("s1", "Singsaker skole"),
      makeSkolePOI("s2", "Ila skole"),
    ];
    const filtered = applyCategoryFilter("skole", pois, brosetCenter, delvisZone);
    expect(filtered.map((p) => p.name)).toEqual(["Singsaker skole"]);
  });
});

// ---------------------------------------------------------------------------
// Anker (kjøpesenter) — Unit 4
// ---------------------------------------------------------------------------

const CENTER = { lat: 63.435107, lng: 10.505335 };

function cat(id: string, name = id) {
  return { id, name, icon: "MapPin", color: "#6b7280" };
}

/** Sirkus Shopping slik pipelinen etterlater det: anchorSummary satt, ingen forelder. */
function makeAnchor(overrides: Partial<POI> = {}): POI {
  return makePOI({
    id: "sirkus",
    name: "Sirkus Shopping",
    category: cat("shopping", "Kjøpesenter"),
    anchorSummary: "Butikk, frisør, restaurant, kafé, legesenter og mer",
    coordinates: CENTER,
    ...overrides,
  });
}

function makeChild(id: string, categoryId: string, parent = "sirkus"): POI {
  return makePOI({
    id,
    name: id,
    category: cat(categoryId),
    parentPoiId: parent,
    coordinates: CENTER,
  });
}

function makeProject(pois: POI[], categories: string[]) {
  return {
    id: "placy-demo_test",
    customer: "placy-demo",
    urlSlug: "test",
    name: "Testprosjekt",
    centerCoordinates: CENTER,
    pois,
    reportConfig: {
      themes: [{ id: "hverdagsliv", name: "Hverdagsliv", icon: "ShoppingCart", categories, color: "#36d16f" }],
    },
  } as unknown as Parameters<typeof transformToReportData>[0];
}

const themeOf = (pois: POI[], categories: string[]) =>
  transformToReportData(makeProject(pois, categories)).themes[0];

describe("isAnchorPOI", () => {
  it("anchorSummary er flagget — ikke antall barn", () => {
    expect(isAnchorPOI({ anchorSummary: "Butikk og kafé" })).toBe(true);
    expect(isAnchorPOI({ anchorSummary: undefined })).toBe(false);
    // Tom streng er ikke et register. Pipelinen skriver null, ikke "".
    expect(isAnchorPOI({ anchorSummary: "" })).toBe(false);
  });
});

describe("transformToReportData — ankeret absorberer barna (R5)", () => {
  it("seksti butikker i ett senter blir ÉN oppføring i temaet", () => {
    const children = Array.from({ length: 60 }, (_, i) => makeChild(`butikk-${i}`, "butikk"));
    const theme = themeOf([makeAnchor(), ...children], ["shopping", "butikk"]);

    expect(theme.allPOIs.map((p) => p.id)).toEqual(["sirkus"]);
    expect(theme.stats.totalPOIs).toBe(1);
    expect(theme.allPOIs[0].childPOIs).toHaveLength(60);
  });

  it("hero-metrikkene teller ankeret én gang, ikke 61", () => {
    const children = Array.from({ length: 60 }, (_, i) => makeChild(`butikk-${i}`, "butikk"));
    const data = transformToReportData(makeProject([makeAnchor(), ...children], ["shopping", "butikk"]));

    expect(data.heroMetrics.totalPOIs).toBe(1);
  });

  it("et sted UTEN anker-tekst absorberer ingenting — barna vises som i dag", () => {
    // Skrivefeil i pipelinen (begge anker-stegene er fail-soft) skal gi dagens
    // board, ikke seksti butikker skjult bak en forelder ingenting rendrer.
    const pois = [
      makeAnchor({ anchorSummary: undefined }),
      makeChild("butikk-1", "butikk"),
      makeChild("butikk-2", "butikk"),
    ];
    const theme = themeOf(pois, ["shopping", "butikk"]);

    expect(theme.allPOIs.map((p) => p.id).sort()).toEqual(["butikk-1", "butikk-2", "sirkus"]);
    expect(theme.allPOIs.every((p) => p.childPOIs === undefined)).toBe(true);
  });
});

describe("transformToReportData — ankeret oppfyller kategorier på vegne av barna (R4)", () => {
  it("treningssenteret inne i Sirkus løfter Sirkus inn i temaet", () => {
    // Uten dette står treningssenteret alene på Sirkus' koordinat, uten å si
    // hvor det ligger. `shopping` er ikke en trening-kategori.
    const pois = [makeAnchor(), makeChild("3T Sirkus", "gym")];
    const theme = themeOf(pois, ["gym", "swimming"]);

    expect(theme.allPOIs.map((p) => p.id)).toEqual(["sirkus"]);
    expect(theme.allPOIs[0].childPOIs?.map((c) => c.id)).toEqual(["3T Sirkus"]);
  });

  it("registeret er TEMA-avgrenset — Mat & Drikke lister ikke de seksti butikkene", () => {
    const pois = [
      makeAnchor(),
      makeChild("Peppes", "restaurant"),
      makeChild("Espresso House", "cafe"),
      ...Array.from({ length: 20 }, (_, i) => makeChild(`butikk-${i}`, "butikk")),
    ];
    const theme = themeOf(pois, ["restaurant", "cafe", "bar", "bakery"]);

    expect(theme.allPOIs.map((p) => p.id)).toEqual(["sirkus"]);
    expect(theme.allPOIs[0].childPOIs?.map((c) => c.id).sort()).toEqual([
      "Espresso House",
      "Peppes",
    ]);
  });

  it("løfter bare EKTE ankre — et barn under et vanlig sted står fortsatt alene", () => {
    const pois = [
      makeAnchor({ anchorSummary: undefined }),
      makeChild("3T Sirkus", "gym"),
    ];
    const theme = themeOf(pois, ["gym"]);

    expect(theme.allPOIs.map((p) => p.id)).toEqual(["3T Sirkus"]);
  });

  it("løfter ankeret bare én gang selv om flere barn matcher", () => {
    const pois = [
      makeAnchor(),
      makeChild("3T Sirkus", "gym"),
      makeChild("Sirkus Spa", "swimming"),
    ];
    const theme = themeOf(pois, ["gym", "swimming"]);

    expect(theme.allPOIs.map((p) => p.id)).toEqual(["sirkus"]);
    expect(theme.allPOIs[0].childPOIs).toHaveLength(2);
  });
});

describe("transformToReportData — ankeret overlever avstand (R2)", () => {
  it("Thon Senter Verdal 12 km unna står i temaet, uten ett eneste barn i basen", () => {
    // Ankre utenfor prosjektsirkelen får aldri medlemmene sine importert
    // (Unit 3), så anker-status kan ikke avhenge av barn. Og det finnes ingen
    // avstands- eller antallsport igjen å overleve: `maxCount` ble slettet
    // 2026-08-24, og `isWithinTimeBudget` har null kallere.
    const fjernt = makeAnchor({
      id: "thon-verdal",
      name: "Thon Senter Verdal",
      anchorSummary: "Butikk, apotek, dagligvare og hotell",
      coordinates: { lat: 63.791835, lng: 11.486321 },
    });
    const theme = themeOf([fjernt, makePOI({ id: "kiwi", category: cat("supermarket") })], [
      "shopping",
      "supermarket",
    ]);

    expect(theme.allPOIs.map((p) => p.id)).toContain("thon-verdal");
    // Nærmeste først: Kiwi i sentrum foran senteret 12 km unna.
    expect(theme.allPOIs).toHaveLength(2);
  });
});
