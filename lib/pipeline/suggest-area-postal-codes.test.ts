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

/**
 * Kvadrat med `n` punkter per side.
 *
 * Andelene i resultatet regnes per testpunkt, så et vanlig fire-hjørners
 * kvadrat gir bare 0 %, 20 %, 40 % … — for grovt til å treffe en terskel på
 * 15 %. Terskeltestene bruker derfor tettere ringer.
 */
function denseSquare(lng: number, lat: number, d: number, n = 10): number[][] {
  const hjorner = [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
  ];
  const ring: number[][] = [];
  for (let i = 0; i < hjorner.length; i++) {
    const [x0, y0] = hjorner[i];
    const [x1, y1] = hjorner[(i + 1) % hjorner.length];
    for (let s = 0; s < n; s++) {
      ring.push([x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n]);
    }
  }
  ring.push([...ring[0]]);
  return ring;
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
    boundary_source: "curated",
    postal_codes: null,
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

  it("tar med et område som har postnumre når inkluderEksisterende er satt", () => {
    const res = suggestPostalCodes(
      [area({ postal_codes: ["7040"] })],
      [postal("7670", 10.5, 63.4)],
      { inkluderEksisterende: true }
    );
    expect(res.suggestions).toHaveLength(1);
    expect(res.suggestions[0].naavaerende).toEqual(["7040"]);
    expect(res.suggestions[0].kandidater[0].postnummer).toBe("7670");
  });

  it("avviser en gjettet form når kunAutoritativForm er satt", () => {
    // Å utlede postnumre fra en form som selv er avledet av postnumre er en
    // sirkel — den ville bare bekreftet gjetningen den kom fra.
    const res = suggestPostalCodes(
      [area({ boundary_source: "derived" })],
      [postal("7670", 10.5, 63.4)],
      { kunAutoritativForm: true }
    );
    expect(res.suggestions).toEqual([]);
    expect(res.hoppetOver[0].reason).toBe("gjettet-form");
  });

  it("slipper gjennom både curated og krets som autoritativ form", () => {
    const res = suggestPostalCodes(
      [
        area({ id: "straumen", boundary_source: "curated" }),
        area({ id: "vikasen", boundary_source: "krets" }),
      ],
      [postal("7670", 10.5, 63.4)],
      { kunAutoritativForm: true }
    );
    expect(res.suggestions.map((s) => s.id)).toEqual(["straumen", "vikasen"]);
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
    // Ingen av postnummerets punkter er innenfor det lille området, så bare
    // retning 2 (området inn i postnummeret) kan fange dette.
    const lite = area({
      boundary: { type: "Polygon", coordinates: [square(10.5, 63.4, 0.002)] },
    });
    const res = suggestPostalCodes([lite], [postal("7670", 10.5, 63.4, 0.1)]);

    expect(res.suggestions[0].kandidater[0].postnummer).toBe("7670");
    expect(res.suggestions[0].kandidater[0].postnummerIOmrade).toBe(0);
    expect(res.suggestions[0].kandidater[0].omradeIPostnummer).toBeGreaterThan(0);
  });

  it("melder ingen treff for et postnummer som ligger et helt annet sted", () => {
    const res = suggestPostalCodes([area()], [postal("9999", 20.0, 69.0)]);
    expect(res.suggestions).toEqual([]);
    expect(res.utenTreff).toEqual([{ id: "straumen", name: "Straumen" }]);
  });

  it("melder ikke treff for et postnummer som bare grenser inntil området", () => {
    // Postnummeret ligger vegg i vegg med området og deler kant på lng 10.53.
    // Rå ringpunkt-testing ville gitt falske treff her; inntrukne testpunkter
    // gjør det ikke.
    const res = suggestPostalCodes(
      [area()],
      [postal("7671", 10.55, 63.4, 0.02)]
    );
    expect(res.suggestions).toEqual([]);
  });

  it("sorterer kandidatene med størst andel av området først", () => {
    // 7670 dekker hele området, 7671 bare en flik av det.
    const res = suggestPostalCodes(
      [area()],
      [postal("7671", 10.525, 63.4, 0.01), postal("7670", 10.5, 63.4, 0.05)]
    );
    const rekkefølge = res.suggestions[0].kandidater.map((k) => k.postnummer);
    expect(rekkefølge[0]).toBe("7670");
    expect(res.suggestions[0].kandidater[0].omradeIPostnummer).toBeGreaterThan(
      res.suggestions[0].kandidater[1]?.omradeIPostnummer ?? -1
    );
  });

  it("teller punkter fra alle flater i et postnummer med eksklave", () => {
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
    expect(res.suggestions[0].kandidater[0].postnummerIOmrade).toBeGreaterThan(4);
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

// ── Terskelen ─────────────────────────────────────────────────────────────

describe("suggestPostalCodes — terskel", () => {
  /** Tett ring, så andelene får finere oppløsning enn 20 %. */
  const tett = (overrides: Partial<AreaForSuggestion> = {}): AreaForSuggestion =>
    area({ boundary: { type: "Polygon", coordinates: [denseSquare(10.5, 63.4, 0.03)] }, ...overrides });
  const tettPostal = (nr: string, lng: number, lat: number, d: number): PostalAreaWithMeta => ({
    postnummer: nr,
    poststed: `POSTSTED-${nr}`,
    kommunenavn: "Testheim",
    boundary: { type: "MultiPolygon", coordinates: [[denseSquare(lng, lat, d)]] },
  });

  it("flytter et postnummer som så vidt klipper hjørnet til svakeTreff", () => {
    // Området spenner 10.47–10.53 × 63.37–63.43. `7671` er like stort og
    // forskjøvet slik at bare et lite hjørne er felles — da er overlappet en
    // liten andel av BEGGE, og OR-grenen skal ikke slå til.
    const res = suggestPostalCodes(
      [tett()],
      [tettPostal("7670", 10.5, 63.4, 0.05), tettPostal("7671", 10.585, 63.485, 0.06)]
    );

    expect(res.suggestions[0].kandidater.map((k) => k.postnummer)).toEqual(["7670"]);
    expect(res.suggestions[0].svakeTreff.map((k) => k.postnummer)).toEqual(["7671"]);
  });

  it("beholder et lite postnummer som ligger helt inne i området", () => {
    // Lite av strøket, men hele postnummeret — OR-grenen skal fange det.
    const res = suggestPostalCodes(
      [area()],
      [postal("7670", 10.5, 63.4, 0.004)]
    );

    const k = res.suggestions[0].kandidater[0];
    expect(k.postnummer).toBe("7670");
    expect(k.andelAvPostnummer).toBeGreaterThan(0.9);
    expect(k.andelAvOmrade).toBeLessThan(0.15);
  });

  it("melder området som uten treff når alt havner under terskelen", () => {
    const res = suggestPostalCodes([tett()], [tettPostal("7671", 10.585, 63.485, 0.06)]);

    expect(res.suggestions).toEqual([]);
    expect(res.utenTreff).toEqual([{ id: "straumen", name: "Straumen" }]);
  });

  it("respekterer en overstyrt terskel", () => {
    const hjorne = [tettPostal("7671", 10.585, 63.485, 0.06)];
    const streng = suggestPostalCodes([tett()], hjorne, { terskel: 0.5 });
    const slapp = suggestPostalCodes([tett()], hjorne, { terskel: 0.001 });

    expect(streng.suggestions).toHaveLength(0);
    expect(slapp.suggestions).toHaveLength(1);
  });

  it("regner ut andeler mot antall testpunkter på hver side", () => {
    const res = suggestPostalCodes([area()], [postal("7670", 10.5, 63.4, 0.05)]);
    const k = res.suggestions[0].kandidater[0];

    // Området ligger helt inne i postnummeret: alle områdets punkter treffer.
    expect(k.andelAvOmrade).toBe(1);
    // Postnummeret er større, så bare en del av det ligger i området.
    expect(k.andelAvPostnummer).toBeLessThan(1);
  });
});

// ── Kanttilfeller ─────────────────────────────────────────────────────────

describe("suggestPostalCodes — kanttilfeller", () => {
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

  it("bærer boundary_source videre så rapporten kan vise hvor sterk formen er", () => {
    const res = suggestPostalCodes([area({ boundary_source: "krets" })], [postal("7670", 10.5, 63.4)]);
    expect(res.suggestions[0].boundary_source).toBe("krets");
  });
});
