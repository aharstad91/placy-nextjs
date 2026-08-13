import { describe, it, expect } from "vitest";
import { pointInGeometry } from "@/lib/utils/geo";
import {
  planBoundaryDerivation,
  type AreaForDerivation,
  type PostalAreaGeometry,
} from "./derive-area-boundary";

// ── Test-fixtures ─────────────────────────────────────────────────────────

/** Lukket kvadrat rundt (lat, lng) med gitt halvbredde, som GeoJSON-ring. */
function square(lng: number, lat: number, d = 0.01): number[][] {
  return [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ];
}

function postalArea(lng: number, lat: number): PostalAreaGeometry {
  return { type: "MultiPolygon", coordinates: [[square(lng, lat)]] };
}

/** To adskilte postnummer-flater — Ranheim-aktig og Hommelvik-aktig. */
const PN_7053 = postalArea(10.52, 63.42);
const PN_7054 = postalArea(10.56, 63.43);

function postalMap(
  entries: Record<string, PostalAreaGeometry> = { "7053": PN_7053, "7054": PN_7054 }
): Map<string, PostalAreaGeometry> {
  return new Map(Object.entries(entries));
}

function area(overrides: Partial<AreaForDerivation> = {}): AreaForDerivation {
  return {
    id: "ranheim",
    name_no: "Ranheim",
    boundary: null,
    boundary_source: null,
    postal_codes: ["7053"],
    ...overrides,
  };
}

// ── R4: håndtegnet geometri er urørlig ────────────────────────────────────

describe("planBoundaryDerivation — R4: håndtegnet geometri røres ikke", () => {
  it("hopper over område som allerede har boundary, uten å planlegge noen skriving", () => {
    const håndtegnet = { type: "Polygon", coordinates: [square(10.5, 63.4)] };
    const plan = planBoundaryDerivation(
      [area({ boundary: håndtegnet, boundary_source: "curated" })],
      postalMap()
    );

    expect(plan.derive).toEqual([]);
    expect(plan.skipped).toEqual([
      { id: "ranheim", name: "Ranheim", reason: "har-boundary" },
    ]);
  });

  it("hopper over selv når postnumrene finnes og ville gitt en annen form", () => {
    // Det farlige tilfellet: en kurator har tegnet en presis grense, og
    // postnummerformen er grovere. Avledningen skal aldri «forbedre» den.
    const plan = planBoundaryDerivation(
      [
        area({ boundary: { type: "Polygon", coordinates: [square(10.9, 63.9)] }, boundary_source: "curated", postal_codes: ["7053", "7054"] }),
      ],
      postalMap()
    );
    expect(plan.derive).toHaveLength(0);
  });

  it("hopper over et område med avledet boundary fra en tidligere kjøring (idempotens)", () => {
    const plan = planBoundaryDerivation(
      [area({ boundary: PN_7053, boundary_source: "derived" })],
      postalMap()
    );
    expect(plan.derive).toEqual([]);
    expect(plan.skipped[0].reason).toBe("har-boundary");
  });
});

// ── Happy path ────────────────────────────────────────────────────────────

describe("planBoundaryDerivation — happy path", () => {
  it("avleder MultiPolygon med én flate fra ett postnummer", () => {
    const plan = planBoundaryDerivation([area({ postal_codes: ["7053"] })], postalMap());

    expect(plan.derive).toHaveLength(1);
    expect(plan.derive[0].boundary.type).toBe("MultiPolygon");
    expect(plan.derive[0].boundary.coordinates).toHaveLength(1);
    expect(plan.derive[0].postnumre).toEqual(["7053"]);
  });

  it("avleder MultiPolygon med to flater fra to postnumre", () => {
    const plan = planBoundaryDerivation(
      [area({ postal_codes: ["7053", "7054"] })],
      postalMap()
    );
    expect(plan.derive[0].boundary.coordinates).toHaveLength(2);
  });

  it("gir en geometri geofencen faktisk kan bruke", () => {
    // Nøstedybden er den stille feilen her: flater du ett nivå for mye, blir
    // coordinates[0][0] et punkt i stedet for en ring, og pointInGeometry
    // returnerer false for alt uten å klage.
    const plan = planBoundaryDerivation(
      [area({ postal_codes: ["7053", "7054"] })],
      postalMap()
    );
    const boundary = plan.derive[0].boundary;

    expect(pointInGeometry(10.52, 63.42, boundary)).toBe(true); // inne i 7053
    expect(pointInGeometry(10.56, 63.43, boundary)).toBe(true); // inne i 7054
    expect(pointInGeometry(11.5, 63.9, boundary)).toBe(false); // utenfor begge
  });

  it("merker avledet geometri som 'derived' slik at den kan skilles fra kurert", () => {
    const plan = planBoundaryDerivation([area()], postalMap());
    expect(plan.derive[0].boundary_source).toBe("derived");
  });

  it("bevarer rekkefølgen på postnumrene slik kurator listet dem", () => {
    const plan = planBoundaryDerivation(
      [area({ postal_codes: ["7054", "7053"] })],
      postalMap()
    );
    expect(plan.derive[0].postnumre).toEqual(["7054", "7053"]);
  });
});

// ── Kanttilfeller ─────────────────────────────────────────────────────────

describe("planBoundaryDerivation — kanttilfeller", () => {
  it("hopper over område med postal_codes = null", () => {
    const plan = planBoundaryDerivation([area({ postal_codes: null })], postalMap());
    expect(plan.derive).toEqual([]);
    expect(plan.skipped[0].reason).toBe("mangler-postnummer");
  });

  it("hopper over område med tom postal_codes-liste", () => {
    const plan = planBoundaryDerivation([area({ postal_codes: [] })], postalMap());
    expect(plan.skipped[0].reason).toBe("mangler-postnummer");
  });

  it("bruker de postnumrene som finnes, og rapporterer det som mangler", () => {
    const plan = planBoundaryDerivation(
      [area({ postal_codes: ["7053", "9999"] })],
      postalMap()
    );

    expect(plan.derive[0].boundary.coordinates).toHaveLength(1);
    expect(plan.derive[0].postnumre).toEqual(["7053"]);
    expect(plan.ukjentePostnumre).toEqual([
      { id: "ranheim", name: "Ranheim", postnummer: "9999" },
    ]);
  });

  it("skriver ingen boundary når ingen av postnumrene finnes", () => {
    // En tom MultiPolygon ville gjort raden synlig for geofencen uten å treffe
    // noe — verre enn ingen form, fordi den ser dekket ut.
    const plan = planBoundaryDerivation(
      [area({ id: "asker", name_no: "Asker", postal_codes: ["1383", "1384"] })],
      postalMap()
    );

    expect(plan.derive).toEqual([]);
    expect(plan.skipped[0].reason).toBe("ingen-postnummer-funnet");
    expect(plan.ukjentePostnumre).toHaveLength(2);
  });

  it("håndterer et postnummer med flere flater (eksklave) uten å miste noen", () => {
    const toFlater: PostalAreaGeometry = {
      type: "MultiPolygon",
      coordinates: [[square(10.52, 63.42)], [square(10.9, 63.6)]],
    };
    const plan = planBoundaryDerivation(
      [area({ postal_codes: ["7053"] })],
      postalMap({ "7053": toFlater })
    );
    expect(plan.derive[0].boundary.coordinates).toHaveLength(2);
  });

  it("dedupliserer et postnummer som er listet to ganger i samme område", () => {
    const plan = planBoundaryDerivation(
      [area({ postal_codes: ["7053", "7053"] })],
      postalMap()
    );
    expect(plan.derive[0].boundary.coordinates).toHaveLength(1);
    expect(plan.derive[0].postnumre).toEqual(["7053"]);
  });

  it("returnerer tom plan for tom områdeliste", () => {
    const plan = planBoundaryDerivation([], postalMap());
    expect(plan.derive).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.kollisjoner).toEqual([]);
  });
});

// ── Kollisjoner: flere strøk på samme postnummer ──────────────────────────

describe("planBoundaryDerivation — kollisjoner", () => {
  it("rapporterer når flere avledede områder ender med samme postnummer", () => {
    // Ekte tilfelle: Møllenberg, Rosenborg og Solsiden er alle 7014. Avledet
    // får de identisk geometri, og findAreaForPoint velger matches[0] —
    // vilkårlig. Det må være synlig, ikke stille.
    const plan = planBoundaryDerivation(
      [
        area({ id: "mollenberg", name_no: "Møllenberg", postal_codes: ["7053"] }),
        area({ id: "rosenborg", name_no: "Rosenborg", postal_codes: ["7053"] }),
        area({ id: "solsiden", name_no: "Solsiden", postal_codes: ["7053"] }),
      ],
      postalMap()
    );

    expect(plan.derive).toHaveLength(3);
    expect(plan.kollisjoner).toEqual([
      { postnummer: "7053", areaIds: ["mollenberg", "rosenborg", "solsiden"] },
    ]);
  });

  it("rapporterer delvis overlapp, ikke bare identiske lister", () => {
    const plan = planBoundaryDerivation(
      [
        area({ id: "strindheim", name_no: "Strindheim", postal_codes: ["7053", "7054"] }),
        area({ id: "leangen", name_no: "Leangen", postal_codes: ["7054"] }),
      ],
      postalMap()
    );
    expect(plan.kollisjoner).toEqual([
      { postnummer: "7054", areaIds: ["strindheim", "leangen"] },
    ]);
  });

  it("regner ikke et håndtegnet område som kollisjon — det har sin egen form", () => {
    const plan = planBoundaryDerivation(
      [
        area({
          id: "ranheim",
          boundary: { type: "Polygon", coordinates: [square(10.5, 63.4)] },
          boundary_source: "curated",
          postal_codes: ["7053"],
        }),
        area({ id: "vikasen", name_no: "Vikåsen", postal_codes: ["7053"] }),
      ],
      postalMap()
    );

    expect(plan.derive.map((d) => d.id)).toEqual(["vikasen"]);
    expect(plan.kollisjoner).toEqual([]);
  });

  it("melder ingen kollisjon når postnumrene er disjunkte", () => {
    const plan = planBoundaryDerivation(
      [
        area({ id: "a", postal_codes: ["7053"] }),
        area({ id: "b", postal_codes: ["7054"] }),
      ],
      postalMap()
    );
    expect(plan.kollisjoner).toEqual([]);
  });
});
