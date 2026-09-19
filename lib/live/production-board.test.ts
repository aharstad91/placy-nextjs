import { describe, expect, it } from "vitest";
import type { BoardData } from "@/components/variants/report/board/board-data";
import {
  boardKnowledgeBase,
  buildProductionAssistantSource,
} from "@/lib/live/production-board";

function board(): BoardData {
  const raw = {
    id: "cafe-1",
    name: "Fyr",
    address: "Lade allé 9",
    coordinates: { lat: 63.44, lng: 10.45 },
    category: { id: "cafe", name: "Kafé", icon: "Coffee", color: "#000" },
  };
  return {
    projectId: "project-1",
    projectCustomer: "customer",
    projectSlug: "leangenbukta",
    contentVersion: "version-1",
    assistant: { enabled: true, name: "Anja", guided: true },
    home: {
      name: "Leangenbukta",
      address: "Haakon VIIs gate 14",
      coordinates: { lat: 63.44, lng: 10.46 },
    },
    categories: [
      {
        id: "servering" as never,
        label: "Servering",
        lead: "",
        body: "",
        icon: "Coffee",
        color: "#000",
        pois: [
          {
            id: "cafe-1" as never,
            name: "Fyr",
            categoryId: "servering" as never,
            coordinates: raw.coordinates,
            icon: "Coffee",
            color: "#000",
            raw,
          },
        ],
        topRankedPois: [],
      },
    ],
    poisById: new Map([["cafe-1", raw]]),
    publishedKnowledge: [
      {
        id: "claim-place",
        poiId: "cafe-1",
        projectId: "project-1",
        scope: "project",
        subjectId: "fyr",
        subjectName: "Fyr",
        topic: "Servering",
        field: "concept",
        factText: "Serverer mat og drikke.",
        confidence: "high",
        sourceUrls: ["https://example.com/fyr"],
        sourceTitles: ["Fyr"],
        reviewStatus: "approved",
        temporalKind: "existing",
        reusableAcrossBoards: false,
        mappingStatus: "mapped",
      },
      {
        id: "claim-project",
        projectId: "project-1",
        scope: "project",
        subjectId: "planned-kindergarten",
        subjectName: "Planlagt barnehage",
        topic: "Oppvekst",
        field: "status",
        factText: "Tomten er regulert, men byggestart er ikke dokumentert.",
        confidence: "high",
        sourceUrls: ["https://example.com/plan"],
        sourceTitles: ["Reguleringsplan"],
        reviewStatus: "approved",
        temporalKind: "regulated",
        reusableAcrossBoards: false,
        mappingStatus: "not_applicable",
      },
    ],
    audioTourEnabled: false,
  };
}

describe("production board assistant source", () => {
  it("bygger kildegrunnlag av publishedKnowledge uten demoidentitet", () => {
    const source = buildProductionAssistantSource(board());
    expect(source.contentVersion).toBe("version-1");
    expect(source.backendInstructions).toContain("Leangenbukta");
    expect(source.backendInstructions).not.toContain("Nyhavna");
    expect(source.voiceInstructions).toContain("Anja");
    expect(source.tools.map((tool) => tool.name)).toContain("find_places");
  });

  it("beholder prosjektfakta uten falsk kart-ID", () => {
    const knowledge = boardKnowledgeBase(board());
    expect(knowledge.area.facts.map((fact) => fact.text)).toContain(
      "Tomten er regulert, men byggestart er ikke dokumentert.",
    );
    expect(knowledge.entities[0]?.mapPoiId).toBe("cafe-1");
  });

  it("avviser boards uten eksplisitt assistent-opt-in", () => {
    const input = board();
    input.assistant = { enabled: false };
    expect(() => buildProductionAssistantSource(input)).toThrow(
      "Assistenten er ikke aktivert",
    );
  });
});
