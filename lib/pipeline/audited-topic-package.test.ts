import { describe, expect, it } from "vitest";

import { buildAuditedTopicPackage } from "@/lib/pipeline/audited-topic-package";

const options = {
  packageId: "topics-1",
  projectId: "project-1",
  projectName: "Leangenbukta",
  reviewedAt: "2026-09-18",
  scopeKey: "audited-topics",
  sourcePath: "categories/*.json",
};

describe("buildAuditedTopicPackage", () => {
  it("samler dupliserte temakandidater uten å lage en falsk kartpinne", () => {
    const candidate = (name: string) => ({
      name,
      canonical_id: "topic:cycle-route",
      decision: "topic_only",
      primary_source_urls: ["https://example.com/cycle"],
      observed_at: "2026-09-18",
      approved_facts: ["Delstrekningen er åpnet."],
      reusable_across_boards: false,
      reuse_constraints: "Prosjektspesifikk.",
      refresh_required_before_publish: false,
    });
    const result = buildAuditedTopicPackage(
      [
        { category: "transport", candidates: [candidate("Del A")] },
        { category: "transport", candidates: [candidate("Del B")] },
      ],
      options,
    );

    expect(result.entities).toHaveLength(1);
    expect(result.claims).toHaveLength(1);
    expect(result.entities[0]).toMatchObject({
      mappingStatus: "not_applicable",
      boardId: "project-1",
    });
  });

  it("utelater place-duplikater og holder ferskvarer uten utløp tilbake", () => {
    const result = buildAuditedTopicPackage(
      [{
        category: "servering",
        candidates: [{
          name: "Ladekaia",
          canonical_id: "place:ladekaia",
          decision: "topic_only",
          primary_source_urls: ["https://example.com"],
          observed_at: "2026-09-18",
          approved_facts: ["Åpent."],
          reusable_across_boards: true,
          reuse_constraints: "Globalt sted.",
          refresh_required_before_publish: true,
        }],
      }],
      options,
    );
    expect(result.entities).toEqual([]);
    expect(result.claims).toEqual([]);
  });
});
