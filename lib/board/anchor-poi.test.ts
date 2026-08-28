import { describe, it, expect } from "vitest";
import {
  isAnchorPOI,
  visibleAnchorMembers,
  anchorRepresentsFilter,
  anchorMarkerName,
  withAnchorMarkerName,
  NO_HIDDEN_CATEGORIES,
} from "./anchor-poi";
import type { POI } from "@/lib/types";

function place(id: string, name: string, categoryId: string): POI {
  return {
    id,
    name,
    coordinates: { lat: 63.43, lng: 10.45 },
    category: { id: categoryId, name: categoryId, icon: "MapPin", color: "#888" },
  } as POI;
}

function anchor(name: string, children: POI[], summary = "Dagligvare og apotek"): POI {
  return {
    ...place("anchor", name, "shopping"),
    anchorSummary: summary,
    ...(children.length > 0 ? { childPOIs: children } : {}),
  } as POI;
}

const GYM = place("m-sats", "SATS Sirkus", "trening");
const REMA = place("m-rema", "Rema 1000", "dagligvare");
const EXTRA = place("m-extra", "Extra", "dagligvare");
const APOTEK = place("m-apotek", "Apotek 1", "apotek");

describe("isAnchorPOI", () => {
  it("anchorSummary er flagget, ikke antall barn", () => {
    // Thon Senter Verdal har null barn i basen og er like fullt et kjøpesenter.
    expect(isAnchorPOI(anchor("Thon Senter Verdal", []))).toBe(true);
    expect(isAnchorPOI(place("p", "Rema 1000", "dagligvare"))).toBe(false);
  });

  it("tom streng teller ikke", () => {
    expect(isAnchorPOI({ anchorSummary: "" })).toBe(false);
  });
});

describe("visibleAnchorMembers", () => {
  it("uten filter er alle medlemmene synlige", () => {
    expect(
      visibleAnchorMembers(anchor("Sirkus", [REMA, APOTEK])).map((p) => p.id),
    ).toEqual(["m-rema", "m-apotek"]);
  });

  it("returnerer SAMME array uten filter — ingen unødig allokering per render", () => {
    const a = anchor("Sirkus", [REMA, APOTEK]);
    expect(visibleAnchorMembers(a)).toBe(a.childPOIs);
  });

  it("filtrerer bort skjulte sub-kategorier", () => {
    expect(
      visibleAnchorMembers(anchor("Sirkus", [REMA, APOTEK]), new Set(["apotek"])).map(
        (p) => p.id,
      ),
    ).toEqual(["m-rema"]);
  });

  it("en vanlig POI har ingen medlemmer, uansett childPOIs", () => {
    const notAnchor = { ...place("p", "Bygget", "kontor"), childPOIs: [REMA] } as POI;
    expect(visibleAnchorMembers(notAnchor)).toEqual([]);
  });
});

describe("anchorRepresentsFilter", () => {
  it("ankeret overlever når et medlem er synlig", () => {
    // R4: seks dagligvarebutikker forsvinner ikke fra kartet fordi brukeren
    // filtrerte på dagligvare — de er absorbert og har ingen egen markør.
    const sirkus = anchor("Sirkus Shopping", [REMA, EXTRA, APOTEK]);
    expect(anchorRepresentsFilter(sirkus, new Set(["shopping", "apotek"]))).toBe(true);
  });

  it("faller når alle medlemmene er skjult", () => {
    const sirkus = anchor("Sirkus Shopping", [REMA, EXTRA]);
    expect(anchorRepresentsFilter(sirkus, new Set(["dagligvare"]))).toBe(false);
  });

  it("et anker uten medlemmer representerer ingenting", () => {
    expect(anchorRepresentsFilter(anchor("Thon Senter Verdal", []), new Set(["x"]))).toBe(
      false,
    );
  });
});

describe("anchorMarkerName", () => {
  it("navngir stedet når ankeret representerer nøyaktig ett", () => {
    // «Uten dette står treningssenteret inne i Sirkus alene i Trening &
    // Aktivitet, med Sirkus' koordinat og uten å si hvor det ligger.»
    expect(anchorMarkerName(anchor("Sirkus Shopping", [GYM]))).toBe(
      "SATS Sirkus — i Sirkus Shopping",
    );
  });

  it("beholder senterets navn ved flere treff — vi navngir ikke ett av seks", () => {
    expect(anchorMarkerName(anchor("Sirkus Shopping", [REMA, EXTRA, APOTEK]))).toBe(
      "Sirkus Shopping",
    );
  });

  it("teller ALDRI i labelen", () => {
    const name = anchorMarkerName(anchor("Sirkus Shopping", [REMA, EXTRA]));
    expect(name).not.toMatch(/\d/);
  });

  it("et filter som snevrer inn til ett medlem gir navnet", () => {
    const sirkus = anchor("Sirkus Shopping", [REMA, EXTRA, APOTEK]);
    expect(anchorMarkerName(sirkus, new Set(["dagligvare"]))).toBe(
      "Apotek 1 — i Sirkus Shopping",
    );
  });

  it("vanlige POI-er og medlemsløse ankre beholder navnet sitt", () => {
    expect(anchorMarkerName(place("p", "Rema 1000", "dagligvare"))).toBe("Rema 1000");
    expect(anchorMarkerName(anchor("Thon Senter Verdal", []))).toBe("Thon Senter Verdal");
  });
});

describe("withAnchorMarkerName", () => {
  it("beholder objekt-identiteten når navnet står uendret (memo-disiplin)", () => {
    const p = place("p", "Rema 1000", "dagligvare");
    expect(withAnchorMarkerName(p)).toBe(p);
    const big = anchor("Sirkus Shopping", [REMA, EXTRA]);
    expect(withAnchorMarkerName(big)).toBe(big);
  });

  it("kopierer og døper om når ankeret navngir ett sted — resten er urørt", () => {
    const sirkus = anchor("Sirkus Shopping", [GYM]);
    const renamed = withAnchorMarkerName(sirkus);
    expect(renamed).not.toBe(sirkus);
    expect(renamed.name).toBe("SATS Sirkus — i Sirkus Shopping");
    expect(renamed.id).toBe(sirkus.id);
    expect(renamed.coordinates).toBe(sirkus.coordinates);
    // Ankerflagget MÅ overleve — markøren leser det for `+`-merket og
    // utglisningen leser det for Infinity-prioriteten.
    expect(isAnchorPOI(renamed)).toBe(true);
  });
});

describe("NO_HIDDEN_CATEGORIES", () => {
  it("er tom og delt", () => {
    expect(NO_HIDDEN_CATEGORIES.size).toBe(0);
  });
});
