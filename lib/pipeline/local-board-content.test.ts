import { describe, expect, it } from "vitest";

import { buildLocalBoardContent } from "@/lib/pipeline/local-board-content";

const board = {
  schemaVersion: 1,
  profile: "housing-development",
  id: "area",
  name: "Area",
  address: "",
  intro: "Intro",
  center: { lat: 63.4, lng: 10.4 },
  map3d: true,
  pinSubtitle: "District",
  greeting: "Hello",
  projectInfoLabel: "sources",
  categories: [{ id: "development", name: "Development", icon: "Building2", color: "#123456", lead: "Lead", body: "Body", unplaced: [] }],
  discoveryCategoryIds: [],
  presentation: [{ id: "development", categoryId: "development", text: "Presentation", placeIds: ["harbour", "missing"], sourceIds: ["source"], checkedAt: "2026-09-19" }],
};

describe("buildLocalBoardContent", () => {
  it("rewrites mapped links and degrades unmapped links to text", () => {
    const result = buildLocalBoardContent(board, [{
      id: "places",
      categoryId: "development",
      question: "Where?",
      answer: "See [Harbour](poi:harbour) and [Missing](poi:missing).",
      origin: "local",
      sourceIds: [],
      caveats: [],
    }], [{ localPlaceId: "harbour", poiId: "project:area:harbour", evidence: "Audited." }], {
      ownCategoryThemeIds: ["development"],
      faqAnswerOverrides: {},
      hideBrokerCard: true,
      standalonePoiIds: ["shared-harbour"],
    });
    expect(result.themes[0]).toMatchObject({
      id: "development",
      prepend: true,
      categories: ["development"],
      editorial: { body: "Presentation", highlightPoiIds: ["project:area:harbour"] },
      faq: [{ svar: "See [Harbour](poi:project:area:harbour) and Missing." }],
    });
    expect(result.reportConfig.standalonePoiIds).toEqual(["shared-harbour"]);
  });

  it("maps local category ids onto canonical standard-board theme ids", () => {
    const result = buildLocalBoardContent({
      schemaVersion: 1,
      profile: "housing-development",
      id: "local",
      name: "Local",
      address: "Gate 1",
      center: { lat: 63.4, lng: 10.4 },
      map3d: true,
      pinSubtitle: "",
      greeting: "Hei",
      projectInfoLabel: "prosjektet",
      categories: [{
        id: "hverdag",
        name: "Hverdag",
        icon: "ShoppingCart",
        color: "#36d16f",
        lead: "Hverdagen.",
        body: "Tilbudene.",
      }],
    }, [{
      id: "butikk",
      categoryId: "hverdag",
      question: "Hvor handler jeg?",
      answer: "På butikken.",
      origin: "local",
      sourceIds: ["source"],
    }], [], {
      themeIdMap: { hverdag: "hverdagsliv" },
    });

    expect(result.themes).toEqual([expect.objectContaining({
      id: "hverdagsliv",
      faq: [expect.objectContaining({ id: "butikk" })],
    })]);
  });
});
