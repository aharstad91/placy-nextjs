import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildAuditedPlacePackage } from "@/lib/pipeline/audited-place-package";
import { claimPublicationState } from "@/lib/pipeline/research-package";

const CATEGORIES = [
  "hverdag",
  "natur",
  "opplevelser",
  "oppvekst",
  "servering",
  "transport",
  "trening",
];

const json = (path: string) =>
  JSON.parse(readFileSync(resolve(path), "utf8"));

function converted() {
  return buildAuditedPlacePackage({
    places: json("data/demo/leangenbukta-lokal/places-audited.json"),
    sources: json("data/demo/leangenbukta-lokal/sources.json"),
    categoryReviews: CATEGORIES.map((category) =>
      json(`docs/research/leangenbukta-lokal-demo/categories/${category}.json`),
    ),
    poiMappings: json(
      "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-production-poi-mappings.json",
    ),
  }, {
    packageId: "leangenbukta-audited-places-2026-09-18",
    projectId: "placy-demo_leangenbukta",
    projectName: "Leangenbukta",
    reviewedAt: "2026-09-18",
    scopeKey: "audited-places",
    sourcePath: "data/demo/leangenbukta-lokal/places-audited.json",
    timeSensitiveValidUntil: "2026-09-25",
  });
}

describe("buildAuditedPlacePackage", () => {
  it("bevarer de 56 stedene og 80 atomiske fakta", () => {
    const result = converted();
    expect(result.entities).toHaveLength(56);
    expect(result.claims).toHaveLength(80);
    expect(new Set(result.claims.map((claim) => claim.claimId)).size).toBe(80);
  });

  it("bruker bare den eksplisitte mappingkvitteringen", () => {
    const result = converted();
    expect(result.entities.filter((entity) => entity.mappingStatus === "mapped"))
      .toHaveLength(29);
    expect(result.entities.filter((entity) => entity.mappingStatus === "unmapped"))
      .toHaveLength(27);
    expect(result.entities.find((entity) => entity.name === "Burger King Lade Arena"))
      .toMatchObject({
        mappingStatus: "mapped",
        poiId: "google-ChIJ1-nTGgIxbUYR_L6AbKF6Qcw",
      });
  });

  it("holder reviewmerkede ferskvarer utenfor publisert kunnskap", () => {
    const result = converted();
    const states = Object.groupBy(result.claims, (claim) =>
      claimPublicationState(claim, new Date("2026-09-19T12:00:00Z")),
    );
    expect(states.publishable).toHaveLength(80);

    const expired = Object.groupBy(result.claims, (claim) =>
      claimPublicationState(claim, new Date("2026-09-26T12:00:00Z")),
    );
    expect(expired.publishable).toHaveLength(26);
    expect(expired.expired).toHaveLength(54);
  });
});
