import {
  localSourcesSchema,
  localTopicsSchema,
} from "@/lib/demo/local-board/schema";
import {
  parseResearchPackage,
  type ResearchPackage,
  type ResearchTemporalKind,
} from "@/lib/pipeline/research-package";

export interface LocalTopicPackageOptions {
  packageId: string;
  projectId: string;
  projectName: string;
  reviewedAt: string;
  scopeKey: string;
  sourcePath: string;
  validUntil: string;
  claimIdPrefix: string;
}

function temporalKind(status: string): ResearchTemporalKind {
  switch (status) {
    case "planned": return "planned";
    case "adopted-plan": return "regulated";
    case "vision": return "marketed";
    case "unresolved": return "absence_of_evidence";
    default: return "existing";
  }
}

/** Converts the local board's source-backed theme prose into project claims. */
export function buildLocalTopicPackage(
  topicsInput: unknown,
  sourcesInput: unknown,
  options: LocalTopicPackageOptions,
): ResearchPackage {
  const topics = localTopicsSchema.parse(topicsInput);
  const sources = localSourcesSchema.parse(sourcesInput);
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  const entities = topics.map((topic) => ({
    entityId: `topic:${topic.id}`,
    canonicalId: `topic:${topic.id}`,
    name: topic.title,
    entityKind: "local_board_topic",
    scope: "project" as const,
    geography: options.projectName,
    reusableAcrossBoards: false,
    reuseConstraints: "Project-specific context; do not reuse on another board without review.",
    boardId: options.projectId,
    mappingStatus: "not_applicable" as const,
  }));
  const claims = topics.map((topic) => {
    const topicSources = topic.sourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`Ukjent kilde ${sourceId} for ${topic.id}`);
      return source;
    });
    return {
      claimId: `${options.claimIdPrefix}-${topic.id}`,
      subjectId: `topic:${topic.id}`,
      canonicalId: `topic:${topic.id}`,
      scope: "project" as const,
      geography: options.projectName,
      field: "topic_fact",
      value: topic.text,
      temporalKind: temporalKind(topic.status),
      reviewStatus: "approved_time_sensitive" as const,
      sourceUrls: topicSources.map((source) => source.url),
      sourceTitles: topicSources.map((source) => `${source.publisher} – ${source.page}`),
      sourceType: "local_board_topic",
      sourceDate: null,
      observedAt: topic.checkedAt,
      validFrom: null,
      validUntil: options.validUntil,
      confidence: "high" as const,
      conflictNotes: null,
      editorialNote: "Migrated from the audited local-board dataset; refresh before expiry.",
      approvedCopy: topic.text,
      reason: null,
      reusableAcrossBoards: false,
      reuseConstraints: "Project-specific context; do not reuse on another board without review.",
      boardId: options.projectId,
      mappingStatus: "not_applicable" as const,
    };
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
