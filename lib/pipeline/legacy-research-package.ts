import { z } from "zod";

import {
  parseResearchPackage,
  type ResearchPackage,
} from "@/lib/pipeline/research-package";

const nullableText = z.string().min(1).nullable().default(null);

const legacyEntitySchema = z.object({
  canonical_id: z.string().min(1),
  name: z.string().min(1),
  entity_kind: z.string().min(1),
  scope: z.enum(["global_place", "project", "address", "board_view"]),
  geography: z.string().min(1),
  reusable_across_boards: z.boolean(),
  reuse_constraints: nullableText,
  board_id: nullableText,
});

const legacyClaimSchema = z.object({
  claim_id: z.string().min(1),
  subject_id: z.string().min(1),
  canonical_id: z.string().min(1),
  scope: z.enum(["global_place", "project", "address", "board_view"]),
  geography: z.string().min(1),
  field: z.string().min(1),
  value: z.json(),
  temporal_kind: z.enum([
    "existing",
    "regulated",
    "planned",
    "marketed",
    "under_construction",
    "inference",
    "absence_of_evidence",
    "historical",
  ]),
  status: z.enum([
    "approved",
    "approved_time_sensitive",
    "historical",
    "unresolved",
    "rejected",
  ]),
  source_urls: z.array(z.url()).default([]),
  source_titles: z.array(z.string().min(1)).default([]),
  source_type: nullableText,
  source_date: nullableText,
  observed_at: z.iso.date(),
  valid_from: z.iso.date().nullable().default(null),
  valid_to: z.iso.date().nullable().default(null),
  confidence: z.enum(["low", "medium", "high"]),
  conflict_notes: nullableText,
  editorial_note: nullableText,
  approved_copy: nullableText,
  reason: nullableText,
  reusable_across_boards: z.boolean(),
  reuse_constraints: nullableText,
  board_id: nullableText,
});

export const legacyResearchPackageSchema = z.object({
  project: z.object({
    name: z.string().min(1),
  }).passthrough(),
  entities: z.array(legacyEntitySchema),
  claims: z.array(legacyClaimSchema),
  unresolved_questions: z.array(z.unknown()).default([]),
  excluded_claims: z.array(z.unknown()).default([]),
});

export interface LegacyResearchConversionOptions {
  packageId: string;
  projectId: string;
  projectName?: string;
  reviewedAt: string;
  scopeKey: string;
  sourcePath: string;
  /** Explicit editorial refresh deadline for reviewed time-sensitive claims. */
  timeSensitiveValidUntil?: string;
}

/**
 * Converts the completed Leangenbukta-era audit export into the shared ledger
 * contract. The legacy package has no authoritative POI identifiers, so every
 * subject stays explicitly detached from the POI graph. Name or coordinate
 * similarity must never create a mapping as a side effect of this conversion.
 */
export function convertLegacyResearchPackage(
  input: unknown,
  options: LegacyResearchConversionOptions,
): ResearchPackage {
  const legacy = legacyResearchPackageSchema.parse(input);

  return parseResearchPackage({
    schemaVersion: 1,
    packageId: options.packageId,
    projectId: options.projectId,
    projectName: options.projectName ?? legacy.project.name,
    mode: "full_snapshot",
    scopeKey: options.scopeKey,
    reviewedAt: options.reviewedAt,
    sourcePath: options.sourcePath,
    entities: legacy.entities.map((entity) => ({
      entityId: entity.canonical_id,
      canonicalId: entity.canonical_id,
      name: entity.name,
      entityKind: entity.entity_kind,
      scope: entity.scope,
      geography: entity.geography,
      reusableAcrossBoards: entity.reusable_across_boards,
      reuseConstraints: entity.reuse_constraints,
      boardId: entity.board_id,
      mappingStatus: "not_applicable",
    })),
    claims: legacy.claims.map((claim) => ({
      claimId: claim.claim_id,
      subjectId: claim.subject_id,
      canonicalId: claim.canonical_id,
      scope: claim.scope,
      geography: claim.geography,
      field: claim.field,
      value: claim.value,
      temporalKind: claim.temporal_kind,
      reviewStatus: claim.status,
      sourceUrls: claim.source_urls,
      sourceTitles: claim.source_titles,
      sourceType: claim.source_type,
      sourceDate: claim.source_date,
      observedAt: claim.observed_at,
      validFrom: claim.valid_from,
      validUntil: claim.valid_to ?? (
        claim.status === "approved_time_sensitive"
          ? options.timeSensitiveValidUntil ?? null
          : null
      ),
      confidence: claim.confidence,
      conflictNotes: claim.conflict_notes,
      editorialNote: claim.editorial_note,
      approvedCopy: claim.approved_copy,
      reason: claim.reason,
      reusableAcrossBoards: claim.reusable_across_boards,
      reuseConstraints: claim.reuse_constraints,
      boardId: claim.board_id,
      mappingStatus: "not_applicable",
    })),
  });
}
