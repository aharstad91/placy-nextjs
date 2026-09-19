import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { convertLegacyResearchPackage } from "@/lib/pipeline/legacy-research-package";
import {
  claimPublicationState,
  researchPackageHash,
} from "@/lib/pipeline/research-package";

const SOURCE_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-18-project-facts-package.json";

function converted() {
  const input = JSON.parse(readFileSync(resolve(SOURCE_PATH), "utf8"));
  return convertLegacyResearchPackage(input, {
    packageId: "leangenbukta-project-facts-2026-09-18",
    projectId: "placy-demo_leangenbukta",
    projectName: "Leangenbukta",
    reviewedAt: "2026-09-18",
    scopeKey: "project-facts",
    sourcePath: SOURCE_PATH,
    timeSensitiveValidUntil: "2026-09-25",
  });
}

describe("convertLegacyResearchPackage", () => {
  it("bevarer hele auditsporet med stabil cardinalitet", () => {
    const result = converted();
    const statusCounts = Object.groupBy(
      result.claims,
      (claim) => claim.reviewStatus,
    );

    expect(result.entities).toHaveLength(70);
    expect(result.claims).toHaveLength(565);
    expect(statusCounts.approved).toHaveLength(78);
    expect(statusCounts.approved_time_sensitive).toHaveLength(46);
    expect(statusCounts.unresolved).toHaveLength(397);
    expect(statusCounts.rejected).toHaveLength(33);
    expect(statusCounts.historical).toHaveLength(11);
  });

  it("publiserer tidsfølsomme godkjenninger bare i det eksplisitte refreshvinduet", () => {
    const result = converted();
    const states = Object.groupBy(result.claims, (claim) =>
      claimPublicationState(claim, new Date("2026-09-19T12:00:00Z")),
    );

    expect(states.publishable).toHaveLength(124);
    expect(states.audit_only).toHaveLength(441);

    const expired = Object.groupBy(result.claims, (claim) =>
      claimPublicationState(claim, new Date("2026-09-26T12:00:00Z")),
    );
    expect(expired.publishable).toHaveLength(78);
    expect(expired.expired).toHaveLength(46);
  });

  it("lager ingen POI-kobling fra navn eller koordinatlikhet", () => {
    const result = converted();

    expect(result.entities.every((entity) =>
      entity.mappingStatus === "not_applicable" && entity.poiId === undefined,
    )).toBe(true);
    expect(result.claims.every((claim) =>
      claim.mappingStatus === "not_applicable" && claim.poiId === undefined,
    )).toBe(true);
  });

  it("gir identisk hash for identisk auditinput", () => {
    expect(researchPackageHash(converted())).toBe(
      researchPackageHash(converted()),
    );
  });
});
