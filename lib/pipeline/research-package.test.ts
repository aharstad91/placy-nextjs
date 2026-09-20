import { describe, expect, it } from "vitest";
import {
  applyResearchPackageToLedger,
  claimPublicationState,
  currentPublishableClaims,
  EMPTY_RESEARCH_LEDGER,
  parseResearchPackage,
  researchPackageHash,
  type ResearchLedgerState,
} from "@/lib/pipeline/research-package";

const NOW = new Date("2026-09-19T08:00:00.000Z");

function entity(overrides: Record<string, unknown> = {}) {
  return {
    entityId: "place:ringve",
    canonicalId: "place:ringve",
    name: "Ringve",
    entityKind: "place",
    scope: "global_place",
    geography: "Lade, Trondheim",
    reusableAcrossBoards: true,
    reuseConstraints: null,
    boardId: null,
    mappingStatus: "mapped",
    poiId: "poi-ringve",
    ...overrides,
  };
}

function claim(
  claimId: string,
  reviewStatus:
    | "approved"
    | "approved_time_sensitive"
    | "historical"
    | "unresolved"
    | "rejected" = "approved",
  overrides: Record<string, unknown> = {},
) {
  return {
    claimId,
    subjectId: "place:ringve",
    canonicalId: "place:ringve",
    scope: "global_place",
    geography: "Lade, Trondheim",
    field: "access",
    value: "Åpen",
    temporalKind: "existing",
    reviewStatus,
    sourceUrls: ["https://example.com/source"],
    sourceTitles: ["Kilde"],
    sourceType: "primary",
    sourceDate: "2026-09-18",
    observedAt: "2026-09-18",
    validFrom: null,
    validUntil: null,
    confidence: "high",
    conflictNotes: null,
    editorialNote: null,
    approvedCopy: reviewStatus.startsWith("approved") ? "Åpen" : null,
    reason: null,
    reusableAcrossBoards: true,
    reuseConstraints: null,
    boardId: null,
    mappingStatus: "mapped",
    poiId: "poi-ringve",
    ...overrides,
  };
}

function researchPackage(
  packageId: string,
  mode: "full_snapshot" | "delta",
  claims: ReturnType<typeof claim>[],
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: 1,
    packageId,
    projectId: "project-leangenbukta",
    projectName: "Leangenbukta",
    mode,
    scopeKey: "project-leangenbukta:places",
    reviewedAt: "2026-09-18",
    sourcePath: "docs/research/package.json",
    entities: [entity()],
    claims,
    ...overrides,
  };
}

const OPTIONS = { knownPoiIds: new Set(["poi-ringve"]), now: NOW };

describe("research package contract", () => {
  it("produces a stable content hash independent of object key order", () => {
    const parsed = parseResearchPackage(
      researchPackage("pkg-1", "full_snapshot", [claim("claim-1")]),
    );
    const reordered = parseResearchPackage({
      claims: parsed.claims,
      entities: parsed.entities,
      sourcePath: parsed.sourcePath,
      reviewedAt: parsed.reviewedAt,
      scopeKey: parsed.scopeKey,
      mode: parsed.mode,
      projectName: parsed.projectName,
      projectId: parsed.projectId,
      packageId: parsed.packageId,
      schemaVersion: parsed.schemaVersion,
    });

    expect(researchPackageHash(parsed)).toBe(researchPackageHash(reordered));
  });

  it("stores every review status but publishes only eligible claims", () => {
    const statuses = [
      "approved",
      "approved_time_sensitive",
      "historical",
      "unresolved",
      "rejected",
    ] as const;
    const input = researchPackage(
      "pkg-statuses",
      "full_snapshot",
      statuses.map((status) =>
        claim(`claim-${status}`, status, {
          validUntil:
            status === "approved_time_sensitive" ? "2026-09-19" : null,
        }),
      ),
    );
    const state = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      input,
      OPTIONS,
    );

    expect(state.claims).toHaveLength(5);
    expect(
      currentPublishableClaims(state, NOW).map(
        (entry) => entry.claim.reviewStatus,
      ),
    ).toEqual(["approved", "approved_time_sensitive"]);
  });

  it("keeps a time-sensitive claim without valid_until in the audit ledger but not the publication", () => {
    const input = researchPackage("pkg-missing-validity", "delta", [
      claim("claim-price", "approved_time_sensitive"),
    ]);
    const state = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      input,
      OPTIONS,
    );

    expect(state.claims).toHaveLength(1);
    expect(state.claims[0].publicationEligible).toBe(false);
    expect(currentPublishableClaims(state, NOW)).toEqual([]);
    expect(claimPublicationState(state.claims[0].claim, NOW)).toBe(
      "missing_valid_until",
    );
  });

  it("treats valid_until as inclusive and expires the claim the next day", () => {
    const timeSensitive = parseResearchPackage(
      researchPackage("pkg-validity", "delta", [
        claim("claim-hours", "approved_time_sensitive", {
          validFrom: "2026-09-18",
          validUntil: "2026-09-19",
        }),
      ]),
    ).claims[0];

    expect(
      claimPublicationState(
        timeSensitive,
        new Date("2026-09-17T12:00:00Z"),
      ),
    ).toBe("not_yet_valid");
    expect(claimPublicationState(timeSensitive, NOW)).toBe("publishable");
    expect(
      claimPublicationState(
        timeSensitive,
        new Date("2026-09-20T00:00:00Z"),
      ),
    ).toBe("expired");
  });

  it("keeps a future approved claim eligible while withholding it until valid_from", () => {
    const state = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      researchPackage("pkg-future", "delta", [
        claim("claim-future", "approved", { validFrom: "2026-09-20" }),
      ]),
      OPTIONS,
    );

    expect(state.claims[0].publicationEligible).toBe(true);
    expect(currentPublishableClaims(state, NOW)).toEqual([]);
    expect(
      currentPublishableClaims(
        state,
        new Date("2026-09-20T00:00:00.000Z"),
      ),
    ).toHaveLength(1);
  });

  it("is idempotent for the same package hash", () => {
    const input = researchPackage("pkg-repeat", "delta", [claim("claim-1")]);
    const once = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      input,
      OPTIONS,
    );
    const twice = applyResearchPackageToLedger(once, input, OPTIONS);

    expect(twice).toBe(once);
    expect(twice.packages).toHaveLength(1);
    expect(twice.claims).toHaveLength(1);
  });

  it("full_snapshot supersedes omitted current claims in the same scope", () => {
    const first = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      researchPackage("pkg-1", "full_snapshot", [
        claim("claim-kept"),
        claim("claim-removed"),
      ]),
      OPTIONS,
    );
    const second = applyResearchPackageToLedger(
      first,
      researchPackage("pkg-2", "full_snapshot", [
        claim("claim-kept", "approved", { value: "Oppdatert" }),
      ]),
      OPTIONS,
    );

    expect(second.claims).toHaveLength(3);
    expect(
      second.claims.find(
        (entry) =>
          entry.claim.claimId === "claim-removed" && !entry.supersededAt,
      ),
    ).toBeUndefined();
    expect(
      currentPublishableClaims(second, NOW).map(
        (entry) => entry.claim.value,
      ),
    ).toEqual(["Oppdatert"]);
  });

  it("delta replaces included claims and leaves omitted claims current", () => {
    const first = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      researchPackage("pkg-1", "full_snapshot", [
        claim("claim-kept"),
        claim("claim-updated"),
      ]),
      OPTIONS,
    );
    const second = applyResearchPackageToLedger(
      first,
      researchPackage("pkg-2", "delta", [
        claim("claim-updated", "approved", { value: "Ny verdi" }),
      ]),
      OPTIONS,
    );

    expect(
      currentPublishableClaims(second, NOW).map(
        (entry) => entry.claim.claimId,
      ),
    ).toEqual(["claim-kept", "claim-updated"]);
  });

  it("allows project knowledge without a POI mapping", () => {
    const input = researchPackage(
      "pkg-topic",
      "delta",
      [
        claim("claim-topic", "approved", {
          subjectId: "topic:school-capacity",
          canonicalId: "topic:school-capacity",
          scope: "project",
          mappingStatus: "not_applicable",
          poiId: undefined,
        }),
      ],
      {
        entities: [
          entity({
            entityId: "topic:school-capacity",
            canonicalId: "topic:school-capacity",
            name: "Skolekapasitet",
            entityKind: "topic",
            scope: "project",
            reusableAcrossBoards: false,
            mappingStatus: "not_applicable",
            poiId: undefined,
          }),
        ],
      },
    );

    const state = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      input,
      OPTIONS,
    );
    expect(state.claims[0].claim.mappingStatus).toBe("not_applicable");
  });

  it("rejects an unknown POI mapping without mutating the previous state", () => {
    const initial = applyResearchPackageToLedger(
      EMPTY_RESEARCH_LEDGER,
      researchPackage("pkg-good", "delta", [claim("claim-good")]),
      OPTIONS,
    );
    const before: ResearchLedgerState = structuredClone(initial);
    const invalid = researchPackage(
      "pkg-bad",
      "delta",
      [claim("claim-bad", "approved", { poiId: "poi-missing" })],
      { entities: [entity({ poiId: "poi-missing" })] },
    );

    expect(() =>
      applyResearchPackageToLedger(initial, invalid, OPTIONS),
    ).toThrow(/ukjent POI/);
    expect(initial).toEqual(before);
  });
});
