import { describe, it, expect } from "vitest";
import {
  AREA_KRETS_MAP,
  planKretsBoundaries,
  type AreaForKrets,
  type KretsFeature,
} from "./krets-boundaries";
import type { GeoJsonPolygonGeometry } from "@/lib/utils/geo";

/** Kvadrat med hjørne i (lng, lat) og gitt bredde. */
function kvadrat(lng: number, lat: number, size = 1): GeoJsonPolygonGeometry {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + size, lat],
        [lng + size, lat + size],
        [lng, lat + size],
        [lng, lat],
      ],
    ],
  };
}

function krets(navn: string, lng: number, lat: number, size = 1): KretsFeature {
  return { navn, kretsnr: 1, boundary: kvadrat(lng, lat, size) };
}

function omrade(overstyr: Partial<AreaForKrets> & { id: string }): AreaForKrets {
  return {
    name_no: overstyr.id,
    boundary: null,
    boundary_source: null,
    ...overstyr,
  };
}

describe("planKretsBoundaries", () => {
  it("skriver ALDRI over et kuratert polygon", () => {
    const original = kvadrat(10, 63);
    const plan = planKretsBoundaries(
      [omrade({ id: "ranheim", boundary: original, boundary_source: "curated" })],
      [krets("RANHEIM", 20, 60)]
    );

    expect(plan.write).toHaveLength(0);
    expect(plan.skipped).toEqual([
      { id: "ranheim", name: "ranheim", reason: "kuratert-polygon", detalj: "RANHEIM" },
    ]);
  });

  it("erstatter en avledet form med kretsgeometri", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "vikasen", boundary: kvadrat(10, 63), boundary_source: "derived" })],
      [krets("VIKÅSEN", 10.5, 63.4)]
    );

    expect(plan.write).toHaveLength(1);
    expect(plan.write[0].kretser).toEqual(["VIKÅSEN"]);
    expect(plan.write[0].forrigeSource).toBe("derived");
    expect(plan.write[0].boundary.type).toBe("MultiPolygon");
    expect(plan.write[0].boundary.coordinates[0][0][0]).toEqual([10.5, 63.4]);
  });

  it("setter form på et område som ikke hadde noen", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "ila", boundary: null, boundary_source: null })],
      [krets("ILA", 10.3, 63.4)]
    );

    expect(plan.write).toHaveLength(1);
    expect(plan.write[0].forrigeSource).toBeNull();
  });

  it("hopper over områder uten kretsmapping", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "bakklandet", boundary_source: "derived" })],
      [krets("BISPEHAUGEN", 10.4, 63.43)]
    );

    expect(plan.write).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe("ingen-kretsmapping");
  });

  it("skriver ingenting når kretsen mangler i datasettet", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "singsaker", boundary_source: "derived" })],
      [krets("IKKE_SINGSAKER", 10, 63)]
    );

    expect(plan.write).toHaveLength(0);
    expect(plan.skipped[0].reason).toBe("krets-mangler-i-datasettet");
    expect(plan.skipped[0].detalj).toBe("SINGSAKER");
  });

  it("matcher kretsnavn uten hensyn til store/små bokstaver", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "nardo", boundary_source: "derived" })],
      [krets("nardo", 10.4, 63.4)]
    );

    expect(plan.write).toHaveLength(1);
  });

  it("lister kretser ingen område peker på", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "ila", boundary_source: "derived" })],
      [krets("ILA", 10.3, 63.4), krets("BISPEHAUGEN", 10.4, 63.43), krets("BERG", 10.5, 63.4)]
    );

    expect(plan.ubrukteKretser).toEqual(["BERG", "BISPEHAUGEN"]);
  });

  it("regner en kretsbrukt av et kuratert område som brukt", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "lade", boundary: kvadrat(10, 63), boundary_source: "curated" })],
      [krets("LADE", 10.4, 63.44)]
    );

    expect(plan.ubrukteKretser).toEqual([]);
  });

  it("flater en krets som selv er MultiPolygon ut i én liste", () => {
    const multi: KretsFeature = {
      navn: "ILA",
      kretsnr: 11,
      boundary: {
        type: "MultiPolygon",
        coordinates: [
          (kvadrat(10, 63).coordinates as number[][][]),
          (kvadrat(12, 63).coordinates as number[][][]),
        ],
      },
    };
    const plan = planKretsBoundaries([omrade({ id: "ila", boundary_source: "derived" })], [multi]);

    expect(plan.write[0].boundary.coordinates).toHaveLength(2);
  });

  it("rapporterer overlapp mellom to nye former", () => {
    // ILA og NARDO får kretser som ligger oppå hverandre.
    const plan = planKretsBoundaries(
      [
        omrade({ id: "ila", boundary_source: "derived" }),
        omrade({ id: "nardo", boundary_source: "derived" }),
      ],
      [krets("ILA", 10, 63, 2), krets("NARDO", 10.5, 63.5, 2)]
    );

    expect(plan.write).toHaveLength(2);
    expect(plan.overlapp.length).toBeGreaterThan(0);
    expect(plan.overlapp.map((o) => o.id)).toContain("ila");
  });

  it("rapporterer overlapp mot et kuratert område som ikke skrives", () => {
    // `nardo` er ikke eid av noe kuratert område, så den skrives — og skal
    // meldes som overlapp mot det kuraterte `eberg` den havner oppå.
    const eberg = kvadrat(10, 63, 5);
    const plan = planKretsBoundaries(
      [
        omrade({ id: "eberg", boundary: eberg, boundary_source: "curated" }),
        omrade({ id: "nardo", boundary_source: "derived" }),
      ],
      [krets("NARDO", 11, 64, 1)]
    );

    expect(plan.write.map((w) => w.id)).toEqual(["nardo"]);
    expect(plan.overlapp).toEqual([
      {
        id: "nardo",
        nyForm: true,
        kildeSource: "krets",
        motId: "eberg",
        motSource: "curated",
        treffpunkter: 5,
      },
    ]);
  });

  it("melder overlapp mellom to former som lå der fra før", () => {
    // Grilstad-tilfellet: `charlottenlund` og `ranheim` er begge kuraterte og
    // overlapper hverandre, uten at denne kjøringen rører noen av dem. Et
    // regnskap som bare så på egne skrivinger ville ikke fanget det.
    const plan = planKretsBoundaries(
      [
        omrade({ id: "charlottenlund", boundary: kvadrat(10, 63, 2), boundary_source: "curated" }),
        omrade({ id: "ranheim", boundary: kvadrat(11, 64, 2), boundary_source: "curated" }),
      ],
      []
    );

    expect(plan.write).toHaveLength(0);
    expect(plan.overlapp.map((o) => [o.id, o.motId].sort().join("↔"))).toEqual([
      "charlottenlund↔ranheim",
      "charlottenlund↔ranheim",
    ]);
    expect(plan.overlapp.every((o) => o.nyForm === false)).toBe(true);
    expect(plan.overlapp.every((o) => o.kildeSource === "curated")).toBe(true);
  });

  it("skiller gjettede former fra autoritative i overlapp-rapporten", () => {
    const plan = planKretsBoundaries(
      [
        omrade({ id: "bakklandet", boundary: kvadrat(10, 63, 2), boundary_source: "derived" }),
        omrade({ id: "sentrum", boundary: kvadrat(11, 64, 2), boundary_source: "curated" }),
      ],
      []
    );

    const gjettet = plan.overlapp.filter(
      (o) => o.kildeSource === "derived" || o.motSource === "derived"
    );
    expect(gjettet).toHaveLength(plan.overlapp.length);
  });

  it("skriver ikke et område som vil ha en krets et kuratert område eier", () => {
    // `sentrum` er kuratert som SINGSAKER + BISPEHAUGEN. Da er SINGSAKER opptatt,
    // og om `singsaker` skal finnes som eget strøk er en kurator-beslutning.
    const plan = planKretsBoundaries(
      [
        omrade({ id: "sentrum", boundary: kvadrat(10, 63, 5), boundary_source: "curated" }),
        omrade({ id: "singsaker", boundary_source: "derived" }),
      ],
      [krets("SINGSAKER", 11, 64), krets("BISPEHAUGEN", 12, 64)]
    );

    expect(plan.write).toHaveLength(0);
    const skip = plan.skipped.find((s) => s.id === "singsaker");
    expect(skip?.reason).toBe("krets-tatt-av-kuratert");
    expect(skip?.detalj).toBe("SINGSAKER eies av sentrum");
  });

  it("blokkerer ikke når eieren av kretsen ikke er kuratert", () => {
    // Er `sentrum` selv bare avledet, er den ingen autoritet å vike for.
    const plan = planKretsBoundaries(
      [
        omrade({ id: "sentrum", boundary: kvadrat(10, 63, 5), boundary_source: "derived" }),
        omrade({ id: "singsaker", boundary_source: "derived" }),
      ],
      [krets("SINGSAKER", 11, 64), krets("BISPEHAUGEN", 12, 64)]
    );

    expect(plan.write.map((w) => w.id).sort()).toEqual(["sentrum", "singsaker"]);
  });

  it("melder ikke overlapp når formene ligger fra hverandre", () => {
    const plan = planKretsBoundaries(
      [
        omrade({ id: "ila", boundary_source: "derived" }),
        omrade({ id: "kattem", boundary_source: "derived" }),
      ],
      [krets("ILA", 10, 63), krets("KATTEM", 20, 70)]
    );

    expect(plan.overlapp).toEqual([]);
  });

  it("teller ikke et område som overlappende med seg selv", () => {
    const plan = planKretsBoundaries(
      [omrade({ id: "ila", boundary: kvadrat(10, 63), boundary_source: "derived" })],
      [krets("ILA", 10, 63)]
    );

    expect(plan.overlapp).toEqual([]);
  });

  it("ignorerer områder uten form når overlapp beregnes", () => {
    const plan = planKretsBoundaries(
      [
        omrade({ id: "ila", boundary_source: "derived" }),
        omrade({ id: "bakklandet", boundary: null, boundary_source: null }),
      ],
      [krets("ILA", 10, 63)]
    );

    expect(plan.overlapp).toEqual([]);
  });
});

describe("AREA_KRETS_MAP", () => {
  it("peker bare på Trondheim-strøk vi faktisk har", () => {
    // Fanger skrivefeil i id-ene: alle nøkler må være kjente område-id-er.
    const kjente = [
      "brundalen",
      "byasen",
      "charlottenlund",
      "eberg",
      "flatasen",
      "ila",
      "kattem",
      "lade",
      "nardo",
      "ranheim",
      "sentrum",
      "singsaker",
      "strindheim",
      "vikasen",
    ];
    expect(Object.keys(AREA_KRETS_MAP).sort()).toEqual(kjente.sort());
  });

  it("har minst ett kretsnavn per område", () => {
    for (const [id, navn] of Object.entries(AREA_KRETS_MAP)) {
      expect(navn.length, id).toBeGreaterThan(0);
    }
  });

  it("bruker SINGSAKER to steder — konflikten er reell og skal fanges av planen", () => {
    const alle = Object.values(AREA_KRETS_MAP).flat();
    const doble = alle.filter((n, i) => alle.indexOf(n) !== i);
    expect(doble).toEqual(["SINGSAKER"]);
  });
});
