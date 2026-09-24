import { describe, expect, it } from "vitest";

import type { BoardCategoryId, BoardData, BoardPOI } from "@/components/variants/report/board/board-data";
import { spokenBoardProjection } from "@/lib/realtime/spoken-projection";

describe("spokenBoardProjection", () => {
  it("beholder tall i fakta når en leverandøradresse begynner med husnummer", () => {
    const poi = {
      id: "building",
      name: "Bygget",
      address: "2, Stjørdalsveien 901, Trondheim",
      coordinates: { lat: 63.4, lng: 10.4 },
      categoryId: "project",
      icon: "Building2",
      color: "#91563e",
      raw: {
        id: "building",
        name: "Bygget",
        address: "2, Stjørdalsveien 901, Trondheim",
        coordinates: { lat: 63.4, lng: 10.4 },
        category: { id: "project", name: "Prosjekt", icon: "Building2", color: "#91563e" },
      },
    } as BoardPOI;
    const board = {
      home: { name: "Leangenbukta", address: "Haakon VIIs gate 14", coordinates: { lat: 63.4, lng: 10.4 } },
      audioTourEnabled: false,
      categories: [{
        id: "project" as BoardCategoryId,
        label: "Prosjekt",
        lead: "",
        body: "",
        icon: "Building2",
        color: "#91563e",
        pois: [poi],
        topRankedPois: [poi],
      }],
      poisById: new Map([[poi.id, poi.raw]]),
      publishedKnowledge: [{
        id: "fact",
        scope: "project",
        subjectId: "building",
        topic: "building_phase",
        field: "status",
        factText: "24 ledige per 21.09.2026, 32 boliger og ferdigstillelse i 2028.",
        confidence: "high",
        sourceUrls: [],
        sourceTitles: [],
        reviewStatus: "approved",
        temporalKind: "planned",
        reusableAcrossBoards: false,
        mappingStatus: "mapped",
      }],
    } as BoardData;

    const spoken = spokenBoardProjection(board);

    expect(spoken.publishedKnowledge?.[0]?.factText).toBe(
      "24 ledige per 21.09.2026, 32 boliger og ferdigstillelse i 2028.",
    );
    expect(spoken.categories[0]?.pois[0]?.address).toBeUndefined();
  });
});
