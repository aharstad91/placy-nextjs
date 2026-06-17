import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseAreaStaging } from "./area-staging";

// ── Test-fixtures ─────────────────────────────────────────────────────────

/** Lukket ytre ring rundt Ranheim-senteret (63.4350, 10.5200) — [lng, lat]. */
function closedRing(): number[][] {
  return [
    [10.505, 63.428],
    [10.535, 63.428],
    [10.535, 63.442],
    [10.505, 63.442],
    [10.505, 63.428],
  ];
}

function validStaging() {
  return {
    areaId: "ranheim",
    boundary: {
      type: "Polygon",
      coordinates: [closedRing()],
    },
    report_editorial: {
      "mat-drikke": {
        body: "Kuratert tekst om mat og drikke i nabolaget.",
        highlightCandidates: ["google-ChIJabc123", "bus-x", "entur-NSR-StopPlace-41742"],
      },
      transport: {
        body: "",
        highlightCandidates: [],
      },
    },
  };
}

function validMeta() {
  return {
    name_no: "Malvik",
    name_en: "Malvik",
    slug_no: "malvik",
    slug_en: "malvik",
    center_lat: 63.42,
    center_lng: 10.74,
  };
}

function expectFailure(raw: unknown): string[] {
  const result = parseAreaStaging(raw);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("unreachable");
  return result.errors;
}

// ── Happy path ────────────────────────────────────────────────────────────

describe("parseAreaStaging — gyldig staging", () => {
  it("passerer og bevarer kandidat-rekkefølgen (heterogene POI-IDer)", () => {
    const result = parseAreaStaging(validStaging());
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.areaId).toBe("ranheim");
    expect(result.data.boundary.type).toBe("Polygon");
    // google-ChIJ…/bus-…/entur-NSR-…-former passerer, rekkefølgen er bevart
    expect(result.data.report_editorial["mat-drikke"].highlightCandidates).toEqual([
      "google-ChIJabc123",
      "bus-x",
      "entur-NSR-StopPlace-41742",
    ]);
  });

  it("aksepterer tom body og tomme kandidatlister (mal-tilstand)", () => {
    const result = parseAreaStaging(validStaging());
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.report_editorial["transport"].body).toBe("");
    expect(result.data.report_editorial["transport"].highlightCandidates).toEqual([]);
  });

  it("aksepterer MultiPolygon med lukkede ringer", () => {
    const staging = {
      ...validStaging(),
      boundary: {
        type: "MultiPolygon",
        coordinates: [[closedRing()], [closedRing()]],
      },
    };
    const result = parseAreaStaging(staging);
    expect(result.success).toBe(true);
  });

  it("malfila data/areas/ranheim.staging.json validerer (inkl. _instructions)", () => {
    const file = path.resolve(process.cwd(), "data/areas/ranheim.staging.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    const result = parseAreaStaging(raw);
    expect(result).toEqual(expect.objectContaining({ success: true }));
    if (!result.success) throw new Error("unreachable");
    // Malen har alle 6 bolig-temaer
    expect(Object.keys(result.data.report_editorial).sort()).toEqual(
      [
        "barn-oppvekst",
        "hverdagsliv",
        "mat-drikke",
        "natur-friluftsliv",
        "transport",
        "trening-aktivitet",
      ].sort()
    );
  });
});

// ── meta-blokk (opprettelse av ny areas-rad) ───────────────────────────────

describe("parseAreaStaging — meta-blokk", () => {
  it("meta er valgfri — staging uten meta validerer (PATCH-tilfellet)", () => {
    const result = parseAreaStaging(validStaging());
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.meta).toBeUndefined();
  });

  it("gyldig meta validerer og defaulter level til 'city'", () => {
    const staging = { ...validStaging(), meta: validMeta() };
    const result = parseAreaStaging(staging);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.meta?.name_no).toBe("Malvik");
    expect(result.data.meta?.level).toBe("city");
  });

  it("eksplisitt level/zoom_level/postal_codes bevares", () => {
    const staging = {
      ...validStaging(),
      meta: { ...validMeta(), level: "strok", zoom_level: 14, postal_codes: ["7560", "7563"] },
    };
    const result = parseAreaStaging(staging);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.meta?.level).toBe("strok");
    expect(result.data.meta?.zoom_level).toBe(14);
    expect(result.data.meta?.postal_codes).toEqual(["7560", "7563"]);
  });

  it("meta uten påkrevd felt avvises (manglende name_no)", () => {
    const meta = validMeta() as Record<string, unknown>;
    delete meta.name_no;
    const errors = expectFailure({ ...validStaging(), meta });
    expect(errors.some((e) => e.includes("name_no"))).toBe(true);
  });

  it("meta.center_lng utenfor [-180, 180] avvises", () => {
    const staging = { ...validStaging(), meta: { ...validMeta(), center_lng: 200 } };
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("center_lng"))).toBe(true);
  });

  it("ugyldig level-enum avvises", () => {
    const staging = { ...validStaging(), meta: { ...validMeta(), level: "kommune" } };
    const errors = expectFailure(staging);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("ukjent meta-nøkkel avvises (strict — fanger typo)", () => {
    const staging = { ...validStaging(), meta: { ...validMeta(), centre_lat: 63.4 } };
    const errors = expectFailure(staging);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── Error paths ───────────────────────────────────────────────────────────

describe("parseAreaStaging — valideringsfeil", () => {
  it("ukjent tema-id gir høylytt feil med temanavnet i meldingen", () => {
    const staging = validStaging();
    (staging.report_editorial as Record<string, unknown>)["uteliv"] = {
      body: "Tekst",
      highlightCandidates: [],
    };
    const errors = expectFailure(staging);
    const themeError = errors.find((e) => e.includes('"uteliv"'));
    expect(themeError).toBeDefined();
    // Meldingen lister gyldige tema-IDer
    expect(themeError).toContain("hverdagsliv");
    expect(themeError).toContain("trening-aktivitet");
  });

  it("tom POI-id-streng avvises", () => {
    const staging = validStaging();
    staging.report_editorial["mat-drikke"].highlightCandidates = [
      "google-ChIJabc123",
      "",
    ];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("tom streng"))).toBe(true);
  });

  it("ulukket ytre ring avvises", () => {
    const staging = validStaging();
    const openRing = closedRing();
    openRing[openRing.length - 1] = [10.51, 63.43]; // siste != første
    staging.boundary.coordinates = [openRing];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("ikke lukket"))).toBe(true);
  });

  it("ring med færre enn 4 punkter avvises", () => {
    const staging = validStaging();
    staging.boundary.coordinates = [
      [
        [10.505, 63.428],
        [10.535, 63.428],
        [10.505, 63.428],
      ],
    ];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("minst 4 punkter"))).toBe(true);
  });

  it("koordinater utenfor verdensranger avvises (lat 95)", () => {
    const staging = validStaging();
    staging.boundary.coordinates = [
      [
        [10.505, 95],
        [10.535, 63.428],
        [10.535, 63.442],
        [10.505, 95],
      ],
    ];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("[-90, 90]"))).toBe(true);
  });

  it("tom areaId avvises", () => {
    const staging = { ...validStaging(), areaId: "" };
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.startsWith("areaId"))).toBe(true);
  });

  it("ukjent toppnivå-nøkkel avvises (strict — fanger typo som reportEditorial)", () => {
    const staging = { ...validStaging(), reportEditorial: {} };
    const errors = expectFailure(staging);
    expect(errors.length).toBeGreaterThan(0);
  });
});
