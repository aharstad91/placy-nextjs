import { createHash } from "node:crypto";
import { z } from "zod";

export const researchReviewStatusSchema = z.enum([
  "approved",
  "approved_time_sensitive",
  "historical",
  "unresolved",
  "rejected",
]);
export type ResearchReviewStatus = z.infer<typeof researchReviewStatusSchema>;

export const researchScopeSchema = z.enum([
  "global_place",
  "project",
  "address",
  "board_view",
]);
export type ResearchScope = z.infer<typeof researchScopeSchema>;

export const researchTemporalKindSchema = z.enum([
  "existing",
  "regulated",
  "planned",
  "marketed",
  "under_construction",
  "inference",
  "absence_of_evidence",
  "historical",
]);
export type ResearchTemporalKind = z.infer<typeof researchTemporalKindSchema>;

export const researchMappingStatusSchema = z.enum([
  "mapped",
  "unmapped",
  "not_applicable",
  "rejected",
]);

const dateSchema = z.iso.date();

const mappedSubjectSchema = z
  .object({
    mappingStatus: researchMappingStatusSchema.default("unmapped"),
    poiId: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.mappingStatus === "mapped" && !value.poiId) {
      context.addIssue({
        code: "custom",
        path: ["poiId"],
        message: "mapped krever poiId",
      });
    }
    if (value.mappingStatus !== "mapped" && value.poiId) {
      context.addIssue({
        code: "custom",
        path: ["poiId"],
        message: "poiId er bare tillatt når mappingStatus er mapped",
      });
    }
  });

export const researchEntitySchema = z
  .object({
    entityId: z.string().min(1),
    canonicalId: z.string().min(1),
    name: z.string().min(1),
    entityKind: z.string().min(1),
    scope: researchScopeSchema,
    geography: z.string().min(1),
    reusableAcrossBoards: z.boolean(),
    reuseConstraints: z.string().min(1).nullable().default(null),
    boardId: z.string().min(1).nullable().default(null),
  })
  .and(mappedSubjectSchema);

export const researchClaimSchema = z
  .object({
    claimId: z.string().min(1),
    subjectId: z.string().min(1),
    canonicalId: z.string().min(1),
    scope: researchScopeSchema,
    geography: z.string().min(1),
    field: z.string().min(1),
    value: z.json(),
    temporalKind: researchTemporalKindSchema,
    reviewStatus: researchReviewStatusSchema,
    sourceUrls: z.array(z.url()).default([]),
    sourceTitles: z.array(z.string().min(1)).default([]),
    sourceType: z.string().min(1).nullable().default(null),
    sourceDate: z.string().min(1).nullable().default(null),
    observedAt: dateSchema,
    validFrom: dateSchema.nullable().default(null),
    validUntil: dateSchema.nullable().default(null),
    confidence: z.enum(["low", "medium", "high"]),
    conflictNotes: z.string().min(1).nullable().default(null),
    editorialNote: z.string().min(1).nullable().default(null),
    approvedCopy: z.string().min(1).nullable().default(null),
    reason: z.string().min(1).nullable().default(null),
    reusableAcrossBoards: z.boolean(),
    reuseConstraints: z.string().min(1).nullable().default(null),
    boardId: z.string().min(1).nullable().default(null),
  })
  .and(mappedSubjectSchema);

export const researchPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    packageId: z.string().min(1),
    projectId: z.string().min(1),
    projectName: z.string().min(1),
    mode: z.enum(["full_snapshot", "delta"]),
    scopeKey: z.string().min(1),
    reviewedAt: dateSchema,
    sourcePath: z.string().min(1).nullable().default(null),
    entities: z.array(researchEntitySchema),
    claims: z.array(researchClaimSchema),
  })
  .superRefine((researchPackage, context) => {
    for (const [field, ids] of [
      ["entities", researchPackage.entities.map((entity) => entity.entityId)],
      ["claims", researchPackage.claims.map((claim) => claim.claimId)],
    ] as const) {
      const seen = new Set<string>();
      for (const [index, id] of ids.entries()) {
        if (seen.has(id)) {
          context.addIssue({
            code: "custom",
            path: [field, index],
            message: `duplikat ID: ${id}`,
          });
        }
        seen.add(id);
      }
    }

    const entityIds = new Set(
      researchPackage.entities.map((entity) => entity.entityId),
    );
    researchPackage.claims.forEach((claim, index) => {
      if (!entityIds.has(claim.subjectId)) {
        context.addIssue({
          code: "custom",
          path: ["claims", index, "subjectId"],
          message: `ukjent subjectId: ${claim.subjectId}`,
        });
      }
    });
  });

export type ResearchPackage = z.infer<typeof researchPackageSchema>;
export type ResearchClaim = ResearchPackage["claims"][number];

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function parseResearchPackage(input: unknown): ResearchPackage {
  return researchPackageSchema.parse(input);
}

export function researchPackageHash(researchPackage: ResearchPackage): string {
  return createHash("sha256").update(stableJson(researchPackage)).digest("hex");
}

export type ClaimPublicationState =
  | "publishable"
  | "not_yet_valid"
  | "expired"
  | "missing_valid_until"
  | "audit_only";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function claimPublicationState(
  claim: Pick<
    ResearchClaim,
    "reviewStatus" | "validFrom" | "validUntil"
  >,
  now: Date,
): ClaimPublicationState {
  if (
    claim.reviewStatus !== "approved" &&
    claim.reviewStatus !== "approved_time_sensitive"
  ) {
    return "audit_only";
  }

  const today = dateOnly(now);
  if (claim.validFrom && today < claim.validFrom) return "not_yet_valid";

  if (claim.reviewStatus === "approved_time_sensitive") {
    if (!claim.validUntil) return "missing_valid_until";
    if (today > claim.validUntil) return "expired";
  } else if (claim.validUntil && today > claim.validUntil) {
    return "expired";
  }

  return "publishable";
}

export function isPublicationEligible(
  claim: Pick<ResearchClaim, "reviewStatus" | "validUntil">,
): boolean {
  return (
    claim.reviewStatus === "approved" ||
    (claim.reviewStatus === "approved_time_sensitive" &&
      claim.validUntil !== null)
  );
}

export interface ImportedResearchPackage {
  packageHash: string;
  researchPackage: ResearchPackage;
  importedAt: string;
}

export interface ImportedResearchClaim {
  packageHash: string;
  projectId: string;
  scopeKey: string;
  claim: ResearchClaim;
  publicationEligible: boolean;
  supersededAt: string | null;
}

export interface ResearchLedgerState {
  packages: ImportedResearchPackage[];
  claims: ImportedResearchClaim[];
}

export const EMPTY_RESEARCH_LEDGER: ResearchLedgerState = {
  packages: [],
  claims: [],
};

function assertKnownMappings(
  researchPackage: ResearchPackage,
  knownPoiIds: ReadonlySet<string>,
): void {
  const mapped = [
    ...researchPackage.entities.map((entity) => ({
      owner: `entity ${entity.entityId}`,
      mappingStatus: entity.mappingStatus,
      poiId: entity.poiId,
    })),
    ...researchPackage.claims.map((claim) => ({
      owner: `claim ${claim.claimId}`,
      mappingStatus: claim.mappingStatus,
      poiId: claim.poiId,
    })),
  ];
  for (const item of mapped) {
    if (
      item.mappingStatus === "mapped" &&
      item.poiId &&
      !knownPoiIds.has(item.poiId)
    ) {
      throw new Error(`${item.owner} peker på ukjent POI «${item.poiId}»`);
    }
  }
}

/**
 * Pure transaction planner. The input state is never mutated; callers persist
 * the returned state atomically. U3 supplies the Supabase transaction adapter.
 */
export function applyResearchPackageToLedger(
  state: ResearchLedgerState,
  input: unknown,
  options: { knownPoiIds: ReadonlySet<string>; now: Date },
): ResearchLedgerState {
  const researchPackage = parseResearchPackage(input);
  assertKnownMappings(researchPackage, options.knownPoiIds);
  const packageHash = researchPackageHash(researchPackage);
  if (state.packages.some((item) => item.packageHash === packageHash)) {
    return state;
  }

  const importedAt = options.now.toISOString();
  const incomingIds = new Set(researchPackage.claims.map((claim) => claim.claimId));
  const claims = state.claims.map((existing) => {
    if (existing.supersededAt) return existing;
    const sameScope =
      existing.projectId === researchPackage.projectId &&
      existing.scopeKey === researchPackage.scopeKey;
    if (!sameScope) return existing;
    const replaced = incomingIds.has(existing.claim.claimId);
    const omittedFromSnapshot =
      researchPackage.mode === "full_snapshot" && !incomingIds.has(existing.claim.claimId);
    return replaced || omittedFromSnapshot
      ? { ...existing, supersededAt: importedAt }
      : existing;
  });

  claims.push(
    ...researchPackage.claims.map((claim) => ({
      packageHash,
      projectId: researchPackage.projectId,
      scopeKey: researchPackage.scopeKey,
      claim,
      publicationEligible: isPublicationEligible(claim),
      supersededAt: null,
    })),
  );

  return {
    packages: [
      ...state.packages,
      { packageHash, researchPackage, importedAt },
    ],
    claims,
  };
}

export function currentPublishableClaims(
  state: ResearchLedgerState,
  now: Date,
): ImportedResearchClaim[] {
  return state.claims.filter(
    (entry) =>
      entry.supersededAt === null &&
      entry.publicationEligible &&
      claimPublicationState(entry.claim, now) === "publishable",
  );
}
