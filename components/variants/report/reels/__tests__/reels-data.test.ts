import { describe, it, expect } from "vitest";
import { buildReelsCards, buildCategoryTracks } from "../reels-data";
import type {
  BoardCategory,
  BoardCategoryId,
  BoardData,
  BoardPOI,
} from "../../board/board-data";

function makeCategory(
  id: string,
  overrides: Partial<BoardCategory> = {},
): BoardCategory {
  return {
    id: id as BoardCategoryId,
    label: id,
    lead: "lead",
    body: "body",
    icon: "MapPin",
    color: "#3b82f6",
    illustration: { src: `/illustrations/stasjonskvartalet-${id}.jpg`, width: 100, height: 100 },
    audio: { url: `/audio/${id}.mp3`, manus: `${id} manus` },
    pois: [] as BoardPOI[],
    topRankedPois: [] as BoardPOI[],
    ...overrides,
  };
}

function makeBoardData(categories: BoardCategory[]): BoardData {
  return {
    projectSlug: "stasjonskvartalet",
    home: {
      name: "Stasjonskvartalet",
      coordinates: { lat: 63.4, lng: 10.4 },
      address: "Test 1",
    },
    categories,
    poisById: new Map(),
    audioTourEnabled: true,
  };
}

describe("buildReelsCards", () => {
  it("returnerer intro + alle kategorier med audio + illustration", () => {
    const data = makeBoardData([
      makeCategory("mat-drikke"),
      makeCategory("transport"),
      makeCategory("hverdagsliv"),
    ]);

    const cards = buildReelsCards(data, "/reels/intro.mp4");

    expect(cards).toHaveLength(4);
    expect(cards[0]).toEqual({ kind: "intro", videoSrc: "/reels/intro.mp4" });
    expect(cards.slice(1).map((c) => (c.kind === "category" ? c.categoryId : null))).toEqual([
      "mat-drikke",
      "transport",
      "hverdagsliv",
    ]);
  });

  it("filtrerer ut kategorier uten audio", () => {
    const data = makeBoardData([
      makeCategory("mat-drikke", { audio: undefined }),
      makeCategory("transport"),
    ]);

    const cards = buildReelsCards(data, "/reels/intro.mp4");

    expect(cards).toHaveLength(2);
    expect(cards[1].kind).toBe("category");
    if (cards[1].kind === "category") {
      expect(cards[1].categoryId).toBe("transport");
    }
  });

  it("bevarer kategori-rekkefølgen fra boardData", () => {
    const data = makeBoardData([
      makeCategory("kultur"),
      makeCategory("mat-drikke"),
    ]);

    const cards = buildReelsCards(data, "/reels/intro.mp4");

    expect(cards).toHaveLength(3);
    if (cards[1].kind === "category") {
      expect(cards[1].categoryId).toBe("kultur");
    }
  });
});

describe("buildCategoryTracks", () => {
  it("returnerer kun category-cards som AudioTrack[]", () => {
    const data = makeBoardData([makeCategory("mat-drikke"), makeCategory("transport")]);
    const cards = buildReelsCards(data, "/reels/intro.mp4");

    const tracks = buildCategoryTracks(cards);

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toEqual({
      categoryId: "mat-drikke",
      url: "/audio/mat-drikke.mp3",
      manus: "mat-drikke manus",
    });
    expect(tracks[1].categoryId).toBe("transport");
  });

  it("returnerer tom array når ingen category-cards", () => {
    expect(buildCategoryTracks([{ kind: "intro", videoSrc: "/x" }])).toEqual([]);
  });
});
