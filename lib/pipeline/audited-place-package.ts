import { z } from "zod";

import {
  localPlacesSchema,
  localSourcesSchema,
} from "@/lib/demo/local-board/schema";
import {
  parseResearchPackage,
  type ResearchPackage,
} from "@/lib/pipeline/research-package";

const reviewedCandidateSchema = z.object({
  candidate_id: z.string().min(1),
  name: z.string().min(1),
  canonical_id: z.string().min(1),
  decision: z.enum(["start_set", "member"]),
  approved_facts: z.array(z.string().min(1)).min(1),
  observed_at: z.iso.date(),
  reusable_across_boards: z.boolean(),
  reuse_constraints: z.string().min(1).nullable(),
  refresh_required_before_publish: z.boolean(),
});

const categoryReviewSchema = z.object({
  candidates: z.array(z.unknown()),
});

const poiMappingsSchema = z.array(z.object({
  localPlaceId: z.string().min(1),
  poiId: z.string().min(1),
  evidence: z.string().min(1),
}));

export interface AuditedPlacePackageInput {
  places: unknown;
  sources: unknown;
  categoryReviews: unknown[];
  poiMappings: unknown;
}

export interface AuditedPlacePackageOptions {
  packageId: string;
  projectId: string;
  projectName: string;
  reviewedAt: string;
  scopeKey: string;
  sourcePath: string;
  /** Required when a candidate review says refresh is needed before publish. */
  timeSensitiveValidUntil?: string;
}

function selectedCandidates(categoryReviews: unknown[]) {
  return categoryReviews.flatMap((review) =>
    categoryReviewSchema
      .parse(review)
      .candidates
      .map((candidate) => reviewedCandidateSchema.safeParse(candidate))
      .filter((candidate) => candidate.success)
      .map((candidate) => candidate.data),
  );
}

/**
 * Turns the local demo's reviewed places into ledger claims. Candidate review
 * metadata decides freshness; the runtime summary never upgrades a fact. POI
 * identity comes exclusively from the checked mapping manifest.
 */
export function buildAuditedPlacePackage(
  input: AuditedPlacePackageInput,
  options: AuditedPlacePackageOptions,
): ResearchPackage {
  const places = localPlacesSchema.parse(input.places);
  const sources = localSourcesSchema.parse(input.sources);
  const candidates = selectedCandidates(input.categoryReviews);
  const mappings = poiMappingsSchema.parse(input.poiMappings);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const mappingByPlace = new Map(
    mappings.map((mapping) => [mapping.localPlaceId, mapping]),
  );

  const candidateByPlace = new Map(
    places.map((place) => {
      const factTexts = new Set(place.facts.map((fact) => fact.text));
      const matches = candidates.filter((candidate) =>
        factTexts.size > 0 &&
        [...factTexts].every((fact) => candidate.approved_facts.includes(fact)),
      );
      if (matches.length > 1) {
        throw new Error(`Flere reviewkandidater matcher ${place.id}`);
      }
      return [place.id, matches[0] ?? null] as const;
    }),
  );

  const entities = places.map((place) => {
    const candidate = candidateByPlace.get(place.id);
    const mapping = mappingByPlace.get(place.id);
    return {
      entityId: candidate?.canonical_id ?? `place:${place.id}`,
      canonicalId: candidate?.canonical_id ?? `place:${place.id}`,
      name: place.name,
      entityKind: place.placeType || place.categoryId,
      scope: "global_place" as const,
      geography: `${place.coordinates.lat}, ${place.coordinates.lng}`,
      reusableAcrossBoards: candidate?.reusable_across_boards ?? true,
      reuseConstraints: candidate?.reuse_constraints ??
        "Reuse verified place facts; keep board membership and travel times project-specific.",
      boardId: null,
      mappingStatus: mapping ? "mapped" as const : "unmapped" as const,
      ...(mapping ? { poiId: mapping.poiId } : {}),
    };
  });
  const entityByPlace = new Map(
    places.map((place, index) => [place.id, entities[index]!]),
  );

  const claims = places.flatMap((place) => {
    const candidate = candidateByPlace.get(place.id);
    const entity = entityByPlace.get(place.id)!;
    const mapping = mappingByPlace.get(place.id);
    const timeSensitive = candidate?.refresh_required_before_publish ?? true;
    return place.facts.map((fact) => {
      const source = sourceById.get(fact.sourceId);
      if (!source) throw new Error(`Ukjent kilde ${fact.sourceId} for ${fact.id}`);
      return {
        claimId: `LB-PLACE-${fact.id}`,
        subjectId: entity.entityId,
        canonicalId: entity.canonicalId,
        scope: "global_place" as const,
        geography: entity.geography,
        field: "place_fact",
        value: fact.text,
        temporalKind: "existing" as const,
        reviewStatus: timeSensitive
          ? "approved_time_sensitive" as const
          : "approved" as const,
        sourceUrls: [source.url],
        sourceTitles: [`${source.publisher} – ${source.page}`],
        sourceType: "audited_place_source",
        sourceDate: null,
        observedAt: fact.checkedAt,
        validFrom: null,
        validUntil: timeSensitive
          ? options.timeSensitiveValidUntil ?? null
          : null,
        confidence: "high" as const,
        conflictNotes: null,
        editorialNote: timeSensitive
          ? "Kandidatreview krever ny kontroll før publisering."
          : null,
        approvedCopy: fact.text,
        reason: null,
        reusableAcrossBoards: entity.reusableAcrossBoards,
        reuseConstraints: entity.reuseConstraints,
        boardId: null,
        mappingStatus: mapping ? "mapped" as const : "unmapped" as const,
        ...(mapping ? { poiId: mapping.poiId } : {}),
      };
    });
  });

  return parseResearchPackage({
    schemaVersion: 1,
    packageId: options.packageId,
    projectId: options.projectId,
    projectName: options.projectName,
    mode: "full_snapshot",
    scopeKey: options.scopeKey,
    reviewedAt: options.reviewedAt,
    sourcePath: options.sourcePath,
    entities,
    claims,
  });
}
