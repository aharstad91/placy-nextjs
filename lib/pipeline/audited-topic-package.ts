import { z } from "zod";

import {
  parseResearchPackage,
  type ResearchPackage,
} from "@/lib/pipeline/research-package";

const candidateSchema = z.object({
  name: z.string().min(1),
  canonical_id: z.string().startsWith("topic:"),
  decision: z.literal("topic_only"),
  primary_source_urls: z.array(z.url()).min(1),
  observed_at: z.iso.date(),
  approved_facts: z.array(z.string().min(1)).min(1),
  reusable_across_boards: z.boolean(),
  reuse_constraints: z.string().min(1).nullable(),
  refresh_required_before_publish: z.boolean(),
});

const reviewSchema = z.object({
  category: z.string().min(1),
  candidates: z.array(z.unknown()),
});

export interface AuditedTopicPackageOptions {
  packageId: string;
  projectId: string;
  projectName: string;
  reviewedAt: string;
  scopeKey: string;
  sourcePath: string;
  timeSensitiveValidUntil?: string;
}

/**
 * Converts reviewed theme-only claims that deliberately have no map pin.
 * Place-shaped topic rows are omitted because their facts already travel in
 * the audited-place snapshot; only canonical `topic:` identities belong here.
 */
export function buildAuditedTopicPackage(
  categoryReviews: unknown[],
  options: AuditedTopicPackageOptions,
): ResearchPackage {
  const grouped = new Map<
    string,
    {
      name: string;
      categories: Set<string>;
      facts: Set<string>;
      urls: Set<string>;
      observedAt: string;
      reusableAcrossBoards: boolean;
      reuseConstraints: string | null;
      timeSensitive: boolean;
    }
  >();

  for (const input of categoryReviews) {
    const review = reviewSchema.parse(input);
    for (const rawCandidate of review.candidates) {
      const parsed = candidateSchema.safeParse(rawCandidate);
      if (!parsed.success) continue;
      const candidate = parsed.data;
      const current = grouped.get(candidate.canonical_id) ?? {
        name: candidate.name,
        categories: new Set<string>(),
        facts: new Set<string>(),
        urls: new Set<string>(),
        observedAt: candidate.observed_at,
        reusableAcrossBoards: candidate.reusable_across_boards,
        reuseConstraints: candidate.reuse_constraints,
        timeSensitive: candidate.refresh_required_before_publish,
      };
      current.categories.add(review.category);
      candidate.approved_facts.forEach((fact) => current.facts.add(fact));
      candidate.primary_source_urls.forEach((url) => current.urls.add(url));
      current.timeSensitive ||= candidate.refresh_required_before_publish;
      grouped.set(candidate.canonical_id, current);
    }
  }

  const rows = [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const entities = rows.map(([canonicalId, row]) => ({
    entityId: canonicalId,
    canonicalId,
    name: row.name,
    entityKind: "reviewed_topic",
    scope: "project" as const,
    geography: options.projectName,
    reusableAcrossBoards: row.reusableAcrossBoards,
    reuseConstraints: row.reuseConstraints,
    boardId: options.projectId,
    mappingStatus: "not_applicable" as const,
  }));
  const claims = rows.flatMap(([canonicalId, row]) =>
    [...row.facts].sort().map((fact, index) => ({
      claimId: `LB-TOPIC-${canonicalId.slice("topic:".length)}-${index + 1}`,
      subjectId: canonicalId,
      canonicalId,
      scope: "project" as const,
      geography: options.projectName,
      field: "topic_fact",
      value: fact,
      temporalKind: "existing" as const,
      reviewStatus: row.timeSensitive
        ? "approved_time_sensitive" as const
        : "approved" as const,
      sourceUrls: [...row.urls].sort(),
      sourceTitles: [...row.urls].sort().map((url) => new URL(url).hostname),
      sourceType: "audited_category_review",
      sourceDate: null,
      observedAt: row.observedAt,
      validFrom: null,
      validUntil: row.timeSensitive
        ? options.timeSensitiveValidUntil ?? null
        : null,
      confidence: "high" as const,
      conflictNotes: null,
      editorialNote: `Tema uten kartpunkt (${[...row.categories].sort().join(", ")}).`,
      approvedCopy: fact,
      reason: null,
      reusableAcrossBoards: row.reusableAcrossBoards,
      reuseConstraints: row.reuseConstraints,
      boardId: options.projectId,
      mappingStatus: "not_applicable" as const,
    })),
  );

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
