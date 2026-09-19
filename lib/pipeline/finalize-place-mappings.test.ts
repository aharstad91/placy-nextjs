import { describe, expect, it } from "vitest";

import { finalizePlaceMappings } from "@/lib/pipeline/finalize-place-mappings";

const row = (localPlaceId: string, decision: "mapped" | "review_required" | "unmapped") => ({
  localPlaceId,
  localName: localPlaceId,
  localAddress: null,
  decision,
  ...(decision === "mapped" ? { poiId: `poi-${localPlaceId}`, evidence: "Exact ID." } : {}),
  candidates: decision === "unmapped" ? [] : [{
    poiId: `poi-${localPlaceId}`,
    productionName: localPlaceId,
    productionAddress: null,
    distanceMeters: 0,
  }],
});

const review = {
  schemaVersion: 1,
  reviewedAt: "2026-09-19",
  projectId: "project-1",
  sourcePath: "places.json",
  poolSize: 10,
  counts: { mapped: 1, review_required: 1, unmapped: 1 },
  mappings: [row("auto", "mapped"), row("manual", "review_required"), row("missing", "unmapped")],
};

describe("finalizePlaceMappings", () => {
  it("requires a final decision for every ambiguous or missing row", () => {
    expect(() => finalizePlaceMappings(review, {
      schemaVersion: 1,
      reviewedAt: "2026-09-19",
      projectId: "project-1",
      overrides: [],
    })).toThrow("Mangler manuell beslutning for manual");
  });

  it("keeps safe automatic matches and records every final decision", () => {
    const result = finalizePlaceMappings(review, {
      schemaVersion: 1,
      reviewedAt: "2026-09-19",
      projectId: "project-1",
      overrides: [
        {
          localPlaceId: "manual",
          decision: "mapped",
          poiId: "poi-manual",
          reason: "Same venue.",
          evidence: "Name and entrance agree.",
        },
        {
          localPlaceId: "missing",
          decision: "unmapped",
          reason: "No equivalent production POI.",
        },
      ],
    });
    expect(result.mappings).toHaveLength(2);
    expect(result.receipt.totalPlaces).toBe(3);
    expect(result.receipt.counts).toMatchObject({ mapped: 2, unmapped: 1 });
    expect(result.receipt.decisions.find((entry) => entry.localPlaceId === "missing"))
      .toMatchObject({ finalDecision: "unmapped", poiId: null });
  });

  it("allows a reviewer to reject a false automatic identity", () => {
    const result = finalizePlaceMappings({ ...review, mappings: [row("auto", "mapped")] }, {
      schemaVersion: 1,
      reviewedAt: "2026-09-19",
      projectId: "project-1",
      overrides: [{
        localPlaceId: "auto",
        decision: "unmapped",
        reason: "Same label, different concept.",
      }],
    });
    expect(result.mappings).toEqual([]);
    expect(result.receipt.counts.unmapped).toBe(1);
  });
});
