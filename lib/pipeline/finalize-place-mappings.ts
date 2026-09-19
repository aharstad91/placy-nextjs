import { z } from "zod";

const mappingCandidateSchema = z.object({
  poiId: z.string().min(1),
  productionName: z.string().min(1),
  productionAddress: z.string().nullable(),
  distanceMeters: z.number().nonnegative(),
});

const mappingReviewRowSchema = z.object({
  localPlaceId: z.string().min(1),
  localName: z.string().min(1),
  localAddress: z.string().nullable(),
  decision: z.enum(["mapped", "review_required", "unmapped"]),
  poiId: z.string().min(1).optional(),
  evidence: z.string().min(1).optional(),
  candidates: z.array(mappingCandidateSchema),
});

const mappingReviewSchema = z.object({
  schemaVersion: z.literal(1),
  reviewedAt: z.iso.date(),
  projectId: z.string().min(1),
  sourcePath: z.string().min(1),
  poolSize: z.number().int().nonnegative(),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  mappings: z.array(mappingReviewRowSchema),
});

const mappingOverrideSchema = z.object({
  localPlaceId: z.string().min(1),
  decision: z.enum(["mapped", "unmapped"]),
  poiId: z.string().min(1).optional(),
  reason: z.string().min(1),
  evidence: z.string().min(1).optional(),
}).superRefine((entry, context) => {
  if (entry.decision === "mapped" && !entry.poiId) {
    context.addIssue({
      code: "custom",
      path: ["poiId"],
      message: "mapped krever poiId",
    });
  }
  if (entry.decision === "unmapped" && entry.poiId) {
    context.addIssue({
      code: "custom",
      path: ["poiId"],
      message: "unmapped kan ikke ha poiId",
    });
  }
});

const mappingOverridesSchema = z.object({
  schemaVersion: z.literal(1),
  reviewedAt: z.iso.date(),
  projectId: z.string().min(1),
  overrides: z.array(mappingOverrideSchema),
});

export interface FinalizedPlaceMappings {
  mappings: Array<{
    localPlaceId: string;
    poiId: string;
    evidence: string;
  }>;
  receipt: {
    schemaVersion: 1;
    reviewedAt: string;
    projectId: string;
    sourcePath: string;
    poolSize: number;
    totalPlaces: number;
    counts: Record<string, number>;
    decisions: Array<{
      localPlaceId: string;
      localName: string;
      originalDecision: "mapped" | "review_required" | "unmapped";
      finalDecision: "mapped" | "unmapped";
      reviewMethod: "automatic_rule" | "manual_override";
      poiId: string | null;
      candidateMatched: boolean;
      reason: string;
      evidence: string | null;
    }>;
  };
}

/**
 * Closes every row in a generated candidate review. Automatic mappings remain
 * accepted unless a reviewer overrides them; every ambiguous or missing row
 * must have an explicit manual decision. The returned mapping manifest only
 * contains identities that may safely attach research to a production POI.
 */
export function finalizePlaceMappings(
  reviewInput: unknown,
  overridesInput: unknown,
): FinalizedPlaceMappings {
  const review = mappingReviewSchema.parse(reviewInput);
  const overrides = mappingOverridesSchema.parse(overridesInput);
  if (review.projectId !== overrides.projectId) {
    throw new Error("Mappingreview og overrides gjelder ulike prosjekter");
  }

  const reviewIds = new Set(review.mappings.map((row) => row.localPlaceId));
  if (reviewIds.size !== review.mappings.length) {
    throw new Error("Mappingreview har duplikate localPlaceId");
  }
  const overrideById = new Map<string, z.infer<typeof mappingOverrideSchema>>();
  for (const override of overrides.overrides) {
    if (!reviewIds.has(override.localPlaceId)) {
      throw new Error(`Override viser til ukjent sted: ${override.localPlaceId}`);
    }
    if (overrideById.has(override.localPlaceId)) {
      throw new Error(`Duplikat override: ${override.localPlaceId}`);
    }
    overrideById.set(override.localPlaceId, override);
  }

  const decisions = review.mappings.map((row) => {
    const override = overrideById.get(row.localPlaceId);
    if (!override && row.decision !== "mapped") {
      throw new Error(`Mangler manuell beslutning for ${row.localPlaceId}`);
    }
    const finalDecision = override?.decision ?? "mapped";
    const poiId = finalDecision === "mapped"
      ? override?.poiId ?? row.poiId ?? null
      : null;
    if (finalDecision === "mapped" && !poiId) {
      throw new Error(`Mangler poiId for ${row.localPlaceId}`);
    }
    const candidateMatched = poiId !== null && (
      row.poiId === poiId || row.candidates.some((candidate) => candidate.poiId === poiId)
    );
    const evidence = finalDecision === "mapped"
      ? override?.evidence ?? row.evidence ?? null
      : null;
    if (finalDecision === "mapped" && !evidence) {
      throw new Error(`Mangler mappingbevis for ${row.localPlaceId}`);
    }
    return {
      localPlaceId: row.localPlaceId,
      localName: row.localName,
      originalDecision: row.decision,
      finalDecision,
      reviewMethod: override ? "manual_override" as const : "automatic_rule" as const,
      poiId,
      candidateMatched,
      reason: override?.reason ?? "Accepted exact identifier or unique normalized name match.",
      evidence,
    };
  });

  const mappedPoiIds = decisions
    .filter((decision) => decision.finalDecision === "mapped")
    .map((decision) => decision.poiId!);
  const counts = {
    mapped: decisions.filter((decision) => decision.finalDecision === "mapped").length,
    unmapped: decisions.filter((decision) => decision.finalDecision === "unmapped").length,
    automatic: decisions.filter((decision) => decision.reviewMethod === "automatic_rule").length,
    manual: decisions.filter((decision) => decision.reviewMethod === "manual_override").length,
    mappedToSharedPoi: mappedPoiIds.length - new Set(mappedPoiIds).size,
  };
  return {
    mappings: decisions.flatMap((decision) =>
      decision.finalDecision === "mapped"
        ? [{
            localPlaceId: decision.localPlaceId,
            poiId: decision.poiId!,
            evidence: decision.evidence!,
          }]
        : [],
    ),
    receipt: {
      schemaVersion: 1,
      reviewedAt: overrides.reviewedAt,
      projectId: review.projectId,
      sourcePath: review.sourcePath,
      poolSize: review.poolSize,
      totalPlaces: decisions.length,
      counts,
      decisions,
    },
  };
}
