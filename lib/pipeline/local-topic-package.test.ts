import { describe, expect, it } from "vitest";

import { buildLocalTopicPackage } from "@/lib/pipeline/local-topic-package";
import { claimPublicationState } from "@/lib/pipeline/research-package";

describe("buildLocalTopicPackage", () => {
  it("keeps project context searchable without inventing a map marker", () => {
    const result = buildLocalTopicPackage([{
      id: "plan",
      title: "Planen",
      categoryIds: ["hverdag"],
      status: "planned",
      text: "Et torg planlegges.",
      keywords: [],
      sourceIds: ["source"],
      relatedPlaceIds: [],
      checkedAt: "2026-09-14",
      caveats: [],
    }], [{
      id: "source",
      label: "Kilde",
      page: "Plan",
      url: "https://example.com/plan",
      publisher: "Utbygger",
      checkedAt: "2026-09-14",
    }], {
      packageId: "topics-1",
      projectId: "project-1",
      projectName: "Nyhavna",
      reviewedAt: "2026-09-19",
      scopeKey: "local-topics",
      sourcePath: "topics.json",
      validUntil: "2026-10-19",
      claimIdPrefix: "NYH-TOPIC",
    });
    expect(result.entities[0]).toMatchObject({
      entityId: "topic:plan",
      mappingStatus: "not_applicable",
      boardId: "project-1",
    });
    expect(result.claims[0]).toMatchObject({
      claimId: "NYH-TOPIC-plan",
      temporalKind: "planned",
      reviewStatus: "approved_time_sensitive",
    });
    expect(claimPublicationState(result.claims[0]!, new Date("2026-09-20T00:00:00Z")))
      .toBe("publishable");
  });
});
