import { describe, it, expect } from "vitest";
import {
  buildReelsCards,
  buildCategoryTracks,
  deriveSplashPrimaryLabel,
} from "../reels-data";
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

  it("filtrerer ut kategorier uten audio og uten reelsAudio", () => {
    const data = makeBoardData([
      makeCategory("kultur", { audio: undefined }),
      makeCategory("shopping"),
    ]);

    const cards = buildReelsCards(data, "/reels/intro.mp4");

    expect(cards).toHaveLength(2);
    expect(cards[1].kind).toBe("category");
    if (cards[1].kind === "category") {
      expect(cards[1].categoryId).toBe("shopping");
    }
  });

  it("bruker reelsAudio fremfor audio-tour-sporet når begge finnes", () => {
    const data = makeBoardData([
      makeCategory("transport", {
        audio: { url: "/audio/tour.mp3", manus: "tour manus" },
        reelsAudio: { url: "/audio/reels.mp3", manus: "reels manus" },
      }),
    ]);

    const tracks = buildCategoryTracks(buildReelsCards(data, "/reels/intro.mp4"));

    expect(tracks).toHaveLength(1);
    expect(tracks[0].url).toBe("/audio/reels.mp3");
    expect(tracks[0].manus).toBe("reels manus");
  });

  it("inkluderer kategori som kun har reelsAudio (ingen audio-tour-spor)", () => {
    const data = makeBoardData([
      makeCategory("transport", {
        audio: undefined,
        reelsAudio: { url: "/audio/reels.mp3", manus: "reels manus" },
      }),
    ]);

    const cards = buildReelsCards(data, "/reels/intro.mp4");

    expect(cards).toHaveLength(2);
    expect(cards[1].kind).toBe("category");
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

  it("velkommen-kortet bruker welcomeVideoSrc som video-bakgrunn", () => {
    const data: BoardData = {
      ...makeBoardData([makeCategory("kultur")]),
      welcome: { url: "/audio/welcome.mp3", manus: "velkommen" },
      home: {
        name: "Stasjonskvartalet",
        coordinates: { lat: 63.4, lng: 10.4 },
        address: "Test 1",
        heroImage: "/illustrations/hero.jpg",
      },
    };

    const cards = buildReelsCards(data, "/reels/intro.mp4", "/reels/welcome.mp4");
    const welcome = cards.find((c) => c.kind === "welcome");

    expect(welcome).toBeDefined();
    if (welcome?.kind === "welcome") {
      expect(welcome.videoBgSrc).toBe("/reels/welcome.mp4");
      // Stillbildet beholdes som fallback (poster/no-video-state).
      expect(welcome.illustrationSrc).toBe("/illustrations/hero.jpg");
    }
  });

  it("velkommen-kortet faller tilbake til stillbilde uten welcomeVideoSrc", () => {
    const data: BoardData = {
      ...makeBoardData([makeCategory("kultur")]),
      welcome: { url: "/audio/welcome.mp3", manus: "velkommen" },
      home: {
        name: "Stasjonskvartalet",
        coordinates: { lat: 63.4, lng: 10.4 },
        address: "Test 1",
        heroImage: "/illustrations/hero.jpg",
      },
    };

    const cards = buildReelsCards(data, "/reels/intro.mp4");
    const welcome = cards.find((c) => c.kind === "welcome");

    expect(welcome?.kind === "welcome" && welcome.videoBgSrc).toBeUndefined();
  });

  it("oppsummert-kortet bruker welcomeVideoSrc som video-bakgrunn (symmetri start↔slutt)", () => {
    const data: BoardData = {
      ...makeBoardData([makeCategory("kultur")]),
      outro: { url: "/audio/outro.mp3", manus: "oppsummert" },
      home: {
        name: "Stasjonskvartalet",
        coordinates: { lat: 63.4, lng: 10.4 },
        address: "Test 1",
        heroImage: "/illustrations/hero.jpg",
      },
    };

    const cards = buildReelsCards(data, "/reels/intro.mp4", "/reels/welcome.mp4");
    const outro = cards.find((c) => c.kind === "outro");

    expect(outro).toBeDefined();
    if (outro?.kind === "outro") {
      expect(outro.videoBgSrc).toBe("/reels/welcome.mp4");
      expect(outro.illustrationSrc).toBe("/illustrations/hero.jpg");
    }
  });

  it("nabolaget-kortet bruker homeVideoSrc som video-bakgrunn", () => {
    const data: BoardData = {
      ...makeBoardData([makeCategory("kultur")]),
      home: {
        name: "Stasjonskvartalet",
        coordinates: { lat: 63.4, lng: 10.4 },
        address: "Test 1",
        heroImage: "/illustrations/hero.jpg",
        audio: { url: "/audio/home.mp3", manus: "nabolaget" },
      },
    };

    const cards = buildReelsCards(
      data,
      "/reels/intro.mp4",
      undefined,
      "/reels/nabolaget.mp4",
    );
    const home = cards.find((c) => c.kind === "home");

    expect(home).toBeDefined();
    if (home?.kind === "home") {
      expect(home.videoBgSrc).toBe("/reels/nabolaget.mp4");
      expect(home.illustrationSrc).toBe("/illustrations/hero.jpg");
    }
  });
});

describe("buildCategoryTracks", () => {
  it("returnerer kun category-cards som AudioTrack[]", () => {
    const data = makeBoardData([makeCategory("kultur"), makeCategory("shopping")]);
    const cards = buildReelsCards(data, "/reels/intro.mp4");

    const tracks = buildCategoryTracks(cards);

    expect(tracks).toHaveLength(2);
    expect(tracks[0]).toEqual({
      categoryId: "kultur",
      url: "/audio/kultur.mp3",
      manus: "kultur manus",
      durationSec: undefined,
    });
    expect(tracks[1].categoryId).toBe("shopping");
  });

  it("populerer durationSec fra karaoke-timings (siste end-tid)", () => {
    const data = makeBoardData([
      makeCategory("kultur", {
        audio: {
          url: "/audio/kultur.mp3",
          manus: "kultur manus",
          timings: {
            characters: ["a", "b"],
            characterStartTimesSeconds: [0, 6],
            characterEndTimesSeconds: [6, 12.5],
          },
        },
      }),
    ]);
    const cards = buildReelsCards(data, "/reels/intro.mp4");

    const tracks = buildCategoryTracks(cards);

    expect(tracks).toHaveLength(1);
    expect(tracks[0].durationSec).toBe(12.5);
  });

  it("returnerer tom array når ingen category-cards", () => {
    expect(buildCategoryTracks([{ kind: "intro", videoSrc: "/x" }])).toEqual([]);
  });
});

describe("deriveSplashPrimaryLabel (B1 / D3)", () => {
  // Regresjonsfanger: event-board har ingen audio-tur (firstIdx === -1), så uten
  // event-grenen falt knappen tilbake til boligrapportens "Utforsk nærområdet"
  // — en eiendoms-streng som bryter D3. Dette er nøyaktig scenarioet som var
  // ufanget før fiksen.
  it("event-modus gir 'Utforsk programmet' — ALDRI 'nærområdet'", () => {
    const label = deriveSplashPrimaryLabel({
      eventMode: true,
      notStarted: true,
      firstIdx: -1, // events har ingen audio → ville ellers gitt boligrapport-fallback
      ended: false,
    });
    expect(label).toBe("Utforsk programmet");
    expect(label).not.toMatch(/nærområdet/i);
  });

  it("event-modus er eiendoms-fri uansett tur-state (D3)", () => {
    for (const notStarted of [true, false]) {
      for (const firstIdx of [-1, 0, 3]) {
        for (const ended of [true, false]) {
          const label = deriveSplashPrimaryLabel({
            eventMode: true,
            notStarted,
            firstIdx,
            ended,
          });
          expect(label).toBe("Utforsk programmet");
          expect(label).not.toMatch(/nærområdet/i);
        }
      }
    }
  });

  it("boligrapport uten audio beholder 'Utforsk nærområdet' (uendret)", () => {
    expect(
      deriveSplashPrimaryLabel({
        eventMode: false,
        notStarted: true,
        firstIdx: -1,
        ended: false,
      }),
    ).toBe("Utforsk nærområdet");
  });

  it("boligrapport med audio: 'Start opplevelsen' / 'Fortsett' / 'Spill av på nytt'", () => {
    expect(
      deriveSplashPrimaryLabel({
        eventMode: false,
        notStarted: true,
        firstIdx: 1,
        ended: false,
      }),
    ).toBe("Start opplevelsen");
    expect(
      deriveSplashPrimaryLabel({
        eventMode: false,
        notStarted: false,
        firstIdx: 1,
        ended: false,
      }),
    ).toBe("Fortsett");
    expect(
      deriveSplashPrimaryLabel({
        eventMode: false,
        notStarted: false,
        firstIdx: 1,
        ended: true,
      }),
    ).toBe("Spill av på nytt");
  });
});
