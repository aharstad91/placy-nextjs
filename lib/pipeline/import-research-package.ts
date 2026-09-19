import { z } from "zod";
import {
  parseResearchPackage,
  researchPackageHash,
  type ResearchPackage,
} from "@/lib/pipeline/research-package";
import { createServerClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

const importResultSchema = z.object({
  status: z.enum(["imported", "unchanged"]),
  package_hash: z.string().length(64),
  entities: z.number().int().nonnegative(),
  claims: z.number().int().nonnegative(),
});

export type ResearchPackageImportResult = z.infer<typeof importResultSchema>;

function entityPayload(entity: ResearchPackage["entities"][number]) {
  return {
    entity_id: entity.entityId,
    canonical_id: entity.canonicalId,
    name: entity.name,
    entity_kind: entity.entityKind,
    scope: entity.scope,
    geography: entity.geography,
    reusable_across_boards: entity.reusableAcrossBoards,
    reuse_constraints: entity.reuseConstraints,
    board_id: entity.boardId,
    mapping_status: entity.mappingStatus,
    mapped_poi_id: entity.poiId ?? null,
  };
}

function claimPayload(claim: ResearchPackage["claims"][number]) {
  return {
    claim_id: claim.claimId,
    subject_id: claim.subjectId,
    canonical_id: claim.canonicalId,
    scope: claim.scope,
    geography: claim.geography,
    field: claim.field,
    value: claim.value,
    temporal_kind: claim.temporalKind,
    review_status: claim.reviewStatus,
    source_urls: claim.sourceUrls,
    source_titles: claim.sourceTitles,
    source_type: claim.sourceType,
    source_date: claim.sourceDate,
    observed_at: claim.observedAt,
    valid_from: claim.validFrom,
    valid_until: claim.validUntil,
    confidence: claim.confidence,
    conflict_notes: claim.conflictNotes,
    editorial_note: claim.editorialNote,
    approved_copy: claim.approvedCopy,
    reason: claim.reason,
    reusable_across_boards: claim.reusableAcrossBoards,
    reuse_constraints: claim.reuseConstraints,
    board_id: claim.boardId,
    mapping_status: claim.mappingStatus,
    mapped_poi_id: claim.poiId ?? null,
  };
}

export function prepareResearchImportPayload(input: unknown): Json {
  const researchPackage = parseResearchPackage(input);
  return {
    package_hash: researchPackageHash(researchPackage),
    package_id: researchPackage.packageId,
    schema_version: researchPackage.schemaVersion,
    project_id: researchPackage.projectId,
    project_name: researchPackage.projectName,
    package_mode: researchPackage.mode,
    scope_key: researchPackage.scopeKey,
    reviewed_at: researchPackage.reviewedAt,
    source_path: researchPackage.sourcePath,
    entities: researchPackage.entities.map(entityPayload),
    claims: researchPackage.claims.map(claimPayload),
  };
}

export interface ResearchImportRpc {
  (payload: Json): Promise<{
    data: Json | null;
    error: { message: string } | null;
  }>;
}

function productionRpc(): ResearchImportRpc {
  const db = createServerClient().schema("v2");
  return async (payload) => {
    const { data, error } = await db.rpc("import_research_package", {
      p_payload: payload,
    });
    return { data, error };
  };
}

/** One RPC call; the Postgres function owns the complete transaction. */
export async function importResearchPackage(
  input: unknown,
  rpc: ResearchImportRpc = productionRpc(),
): Promise<ResearchPackageImportResult> {
  const payload = prepareResearchImportPayload(input);
  const { data, error } = await rpc(payload);
  if (error) {
    throw new Error(`Researchimport feilet: ${error.message}`);
  }
  return importResultSchema.parse(data);
}

