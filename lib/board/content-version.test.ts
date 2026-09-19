import { describe, expect, it } from "vitest";
import { projectContentVersion } from "@/lib/board/content-version";
import type { Project } from "@/lib/types";

function project(): Project {
  return {
    id: "product-1",
    name: "Leangenbukta",
    customer: "demo",
    urlSlug: "leangenbukta",
    productType: "report",
    centerCoordinates: { lat: 63.44, lng: 10.46 },
    story: { id: "story-1", title: "Leangenbukta" },
    pois: [],
    categories: [],
    publishedKnowledge: [],
  };
}

describe("projectContentVersion", () => {
  it("is deterministic and ignores its own previous value", () => {
    const original = project();
    const withOldVersion = { ...project(), contentVersion: "old" };

    expect(projectContentVersion(original)).toBe(
      projectContentVersion(withOldVersion),
    );
    expect(projectContentVersion(original)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes for POI membership, knowledge and assistant-relevant config", () => {
    const original = projectContentVersion(project());
    const withPoi = project();
    withPoi.pois = [
      {
        id: "poi-1",
        name: "Ringve",
        coordinates: { lat: 63.44, lng: 10.45 },
        category: { id: "museum", name: "Museum", icon: "Landmark", color: "#000" },
      },
    ];
    const withKnowledge = project();
    withKnowledge.publishedKnowledge = [
      {
        id: "claim-1",
        projectId: "project-1",
        scope: "project",
        subjectId: "topic:barnehage",
        topic: "topic",
        field: "status",
        factText: "Regulert, ikke vedtatt bygget.",
        confidence: "high",
        sourceUrls: ["https://example.com"],
        sourceTitles: ["Kilde"],
        reviewStatus: "approved",
        temporalKind: "regulated",
        reusableAcrossBoards: false,
        mappingStatus: "not_applicable",
      },
    ];
    const withConfig = project();
    withConfig.reportConfig = { district: "Lade" };

    expect(projectContentVersion(withPoi)).not.toBe(original);
    expect(projectContentVersion(withKnowledge)).not.toBe(original);
    expect(projectContentVersion(withConfig)).not.toBe(original);
  });
});
