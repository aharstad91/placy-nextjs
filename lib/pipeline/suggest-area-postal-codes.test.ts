import { describe, it, expect } from "vitest";
import {
  suggestPostalCodes,
  type AreaForSuggestion,
  type PostalAreaWithMeta,
} from "./suggest-area-postal-codes";

// ── Test-fixtures ─────────────────────────────────────────────────────────

/** Lukket kvadrat som GeoJSON-ring, [lng, lat]. */
function square(lng: number, lat: number, d: number): number[][] {
  return [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ];
}

function postal(
  postnummer: string,
  lng: number,
  lat: number,
  d = 0.02
): PostalAreaWithMeta {
  return {
    postnummer,
    poststed: `POSTSTED-${postnummer}`,
    kommunenavn: "Testheim",
    boundary: { type: "MultiPolygon", coordinates: [[square(lng, lat, d)]] },
  };
}

function area(overrides: Partial<AreaForSuggestion> = {}): AreaForSuggestion {
  return {
    id: "straumen",
    name_no: "Straumen",
    boundary: { type: "Polygon", coordinates: [square(10.5, 63.4, 0.03)] },
    postal_codes: null,
    center_lat: 63.4,
    center_lng: 10.5,
    ...overrides,
  };
}

// ── Hvem som vurderes ─────────────────────────────────────────────────────

describe("suggestPostalCodes — hvem som vurderes", () => {
  it("hopper over område som allerede har postnumre", () => {
    const res = suggestPostalCodes([area({ postal_codes: ["7670"] })], [postal("7670", 10.5, 63.4)]);
    expect(res.suggestions).toEqual([]);
    expect(res.hoppetOver).toEqual([
      { id: "straumen", name: "Straumen", reason: "har-postnummer" },
    ]);
  });

  it("hopper over område uten boundary — det kan ikke overlappe noe", () => {
    const res = suggestPostalCodes([area({ boundary: null })], [postal("7670", 10.5, 63.4)]);
    expect(res.hoppetOver[0].reason).toBe("mangler-boundary");
  });

  it("vurderer område med tom postnummerliste, ikke bare null", () => {
    const res = suggestPostalCodes([area({ postal_codes: [] })], [postal("7670", 10.5, 63.4)]);
    expect(res.suggestions).toHaveLength(1);
  });
});

// ── Overlappstesten, to retninger ─────────────────────────────────────────

describe("suggestPostalCodes — overlapp", () => {
  it("finner postnummer som overlapper områdets polygon", () => {
    const res = suggestPostalCodes([area()], [postal("7670", 10.5, 63.4)]);

    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].kandidater.map((k) => k.postnummer)).toEqual(["7670"]);
    expect(res.suggestions[0].kandidater[0].poststed).toBe("POSTSTED-7670");
  });

  it("finner et lite område som ligger helt inne i ett stort postnummer", () => {
    // Ingen av postnummerets ringpunkter er innenfor det lille området, så bare
    // senterpunkt-testen kan fange dette. Uten den ville et lite strøk inne i et
    // stort postnummer fått «ingen treff».
    const lite = area({
      boundary: { type: "Polygon", coordinates: [square(10.5, 63.4, 0.002)] },
      center_lat: 63.4,
      center_lng: 10.5,
    });
    const res = suggestPostalCodes([lite], [postal("7670", 10.5, 63.4, 0.1)]);

    expect(res.suggestions[0].kandidater[0].postnummer).toBe("7670");
    expect(res.suggestions[0].kandidater[0].senterTreff).toBe(true);
    expect(res.suggestions[0].kandidater[0].treffpunkter).toBe(0);
  });

  it("melder ingen treff for et postnummer som ligger et helt annet sted", () => {
    const res = suggestPostalCodes([area()], [postal("9999", 20.0, 69.0)]);
    expect(res.suggestions).toEqual([]);
    expect(res.utenTreff).toEqual([{ id: "straumen", name: "Straumen" }]);
  });

  it("sorterer kandidatene med flest treffpunkter først", () => {
    // 7670 ligger midt i området (alle fire hjørner innenfor), 7671 så vidt inntil.
    const res = suggestPostalCodes(
      [area()],
      [postal("7671", 10.529, 63.4, 0.005), postal("7670", 10.5, 63.4, 0.005)]
    );
    const rekkefølge = res.suggestions[0].kandidater.map((k) => k.postnummer);
    expect(rekkefølge[0]).toBe("7670");
    expect(res.suggestions[0].kandidater[0].treffpunkter).toBeGreaterThan(
      res.suggestions[0].kandidater[1]?.treffpunkter ?? -1
    );
  });

  it("teller ringpunkter fra alle flater i et postnummer med eksklave", () => {
    const eksklave: PostalAreaWithMeta = {
      postnummer: "7670",
      poststed: "INDERØY",
      kommunenavn: "Inderøy",
      boundary: {
        type: "MultiPolygon",
        coordinates: [[square(10.5, 63.4, 0.005)], [square(10.49, 63.39, 0.005)]],
      },
    };
    const res = suggestPostalCodes([area()], [eksklave]);
    expect(res.suggestions[0].kandidater[0].treffpunkter).toBeGreaterThan(4);
  });

  it("håndterer område med MultiPolygon-boundary", () => {
    const multi = area({
      boundary: {
        type: "MultiPolygon",
        coordinates: [[square(10.5, 63.4, 0.01)], [square(11.0, 63.5, 0.01)]],
      },
    });
    const res = suggestPostalCodes([multi], [postal("7670", 11.0, 63.5, 0.005)]);
    expect(res.suggestions[0].kandidater[0].postnummer).toBe("7670");
  });
});

// ── Kanttilfeller ─────────────────────────────────────────────────────────

describe("suggestPostalCodes — kanttilfeller", () => {
  it("kjører bare ringpunkt-testen når senterkoordinatene mangler", () => {
    const utenSenter = area({ center_lat: null, center_lng: null });
    const res = suggestPostalCodes([utenSenter], [postal("7670", 10.5, 63.4, 0.005)]);

    expect(res.suggestions[0].kandidater[0].treffpunkter).toBeGreaterThan(0);
    expect(res.suggestions[0].kandidater[0].senterTreff).toBe(false);
  });

  it("melder ingen treff når postnummerlista er tom", () => {
    const res = suggestPostalCodes([area()], []);
    expect(res.suggestions).toEqual([]);
    expect(res.utenTreff).toHaveLength(1);
  });

  it("returnerer tomt resultat for tom områdeliste", () => {
    const res = suggestPostalCodes([], [postal("7670", 10.5, 63.4)]);
    expect(res).toEqual({ suggestions: [], utenTreff: [], hoppetOver: [] });
  });

  it("foreslår flere postnumre når området strekker seg over dem", () => {
    const res = suggestPostalCodes(
      [area()],
      [postal("7670", 10.49, 63.4, 0.005), postal("7671", 10.51, 63.4, 0.005)]
    );
    expect(res.suggestions[0].kandidater).toHaveLength(2);
  });

  it("skriver aldri — resultatet inneholder ingen skriveinstruksjon, bare forslag", () => {
    // Postnummer-tilknytning er en påstand om hvor et strøk ER. Metoden er
    // tilnærmet, så den skal aldri lande i basen uten at en kurator har sett den.
    const res = suggestPostalCodes([area()], [postal("7670", 10.5, 63.4)]);
    expect(Object.keys(res).sort()).toEqual(["hoppetOver", "suggestions", "utenTreff"]);
  });
});
