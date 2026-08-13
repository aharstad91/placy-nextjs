import { describe, it, expect } from "vitest";
import {
  boardReducer,
  initialBoardState,
  type BoardState,
} from "./board-state";
import type { BoardCategoryId, BoardPOIId } from "./board-data";

// DOKUMENTASJON (r05.7 / §5.5) — `useActivePOI`-navnekollisjon: board-laget
// eksporterer `useActivePOI` fra board-state.tsx:219 (retur `BoardPOI | null`,
// Context-reducer-drevet), DISTINKT fra Explorer-Zustand-storens `useActivePOI`
// (lib/store.ts:46, annen retur-type). Board-komponenter (PRD 9) MÅ importere
// board-versjonen fra @/components/variants/report/board/board-state — aldri fra
// @/lib/store. Reduceren under er den rene state-kjernen som board-useActivePOI
// leser fra (ingen hooks involvert i denne testen).

const CAT_A = "cat-a" as BoardCategoryId;
const CAT_B = "cat-b" as BoardCategoryId;
const POI_1 = "poi-1" as BoardPOIId;
const POI_2 = "poi-2" as BoardPOIId;

describe("boardReducer", () => {
  describe("SELECT_CATEGORY", () => {
    it("transitions default → active and sets categoryId", () => {
      const next = boardReducer(initialBoardState, {
        type: "SELECT_CATEGORY",
        id: CAT_A,
      });
      expect(next).toEqual({
        phase: "active",
        activeCategoryId: CAT_A,
        activePOIId: null,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    it("from poi → re-selects new category, clearing POI", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "SELECT_CATEGORY", id: CAT_B });
      expect(next).toEqual({
        phase: "active",
        activeCategoryId: CAT_B,
        activePOIId: null,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    it("aborts a running intro (navigation takes over)", () => {
      const start: BoardState = { ...initialBoardState, introPlaying: true };
      const next = boardReducer(start, {
        type: "SELECT_CATEGORY",
        id: CAT_A,
        source: "rail",
      });
      expect(next.introPlaying).toBe(false);
    });

    // Source-discriminator (stayInDefault, board-state.tsx:65-82): scroll-/rail-/
    // index-/audio-utløste valg holder phase: "default" (kontinuerlig scroll-
    // narrativ → BoardScrollPanel fortsetter å rendre, audio driver scroll-
    // panelet, ikke legacy BoardDetailPanel). Verbatim-portet spike-arv (§10 Q7)
    // som bærer en live feedback-loop-vakt PRD 9 avhenger av.
    describe("source-discriminator (stayInDefault)", () => {
      it.each(["scroll", "rail", "index", "audio"] as const)(
        "source=%s holder phase: 'default' (beholder scroll-narrativ)",
        (source) => {
          const next = boardReducer(initialBoardState, {
            type: "SELECT_CATEGORY",
            id: CAT_A,
            source,
          });
          expect(next.phase).toBe("default");
          expect(next.activeCategoryId).toBe(CAT_A);
          expect(next.activePOIId).toBeNull();
        },
      );

      it("uten source (legacy mobile category-grid) → phase: 'active'", () => {
        const next = boardReducer(initialBoardState, {
          type: "SELECT_CATEGORY",
          id: CAT_A,
        });
        expect(next.phase).toBe("active");
      });
    });
  });

  describe("OPEN_POI", () => {
    it("from active → poi with given POI id", () => {
      const start: BoardState = {
        phase: "active",
        activeCategoryId: CAT_A,
        activePOIId: null,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "OPEN_POI", id: POI_1 });
      expect(next).toEqual({
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    it("from poi → swap POI in-place (same category)", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "OPEN_POI", id: POI_2 });
      expect(next).toEqual({
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_2,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    it("with explicit categoryId from default → poi with that category", () => {
      // Kallesteder som bevisst ETABLERER kategori-kontekst (event-panelet,
      // «Verdt å merke seg»-chips) sender fortsatt categoryId.
      const next = boardReducer(initialBoardState, {
        type: "OPEN_POI",
        id: POI_1,
        categoryId: CAT_A,
      });
      expect(next).toEqual({
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    // 2026-08-13: markørklikk skal ÅPNE punktet uten å kapre kategorien.
    // Tidligere no-op'et reduceren her (og markørklikk i overblikk gjorde
    // ingenting hvis BoardMap ikke sendte kategori), og satte kategorien ellers
    // — som filtrerte kartet og drillet desktop-sidebaren inn på ett klikk.
    it("uten categoryId fra overblikk → åpner POI-en, kategorien forblir null", () => {
      const next = boardReducer(initialBoardState, {
        type: "OPEN_POI",
        id: POI_1,
      });
      expect(next).toEqual({
        phase: "poi",
        activeCategoryId: null,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    it("uten categoryId med aktiv kategori → kategorien beholdes uendret", () => {
      const start: BoardState = {
        phase: "active",
        activeCategoryId: CAT_B,
        activePOIId: null,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "OPEN_POI", id: POI_1 });
      expect(next.activeCategoryId).toBe(CAT_B);
      expect(next.phase).toBe("poi");
      expect(next.activePOIId).toBe(POI_1);
    });

    it("nullstiller ALDRI kategorien — nivå-2-panelet ville lukket seg under brukeren", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "OPEN_POI", id: POI_2 });
      expect(next.activeCategoryId).toBe(CAT_A);
    });

    it("avbryter en pågående intro (brukeren tok over)", () => {
      const start: BoardState = { ...initialBoardState, introPlaying: true };
      const next = boardReducer(start, { type: "OPEN_POI", id: POI_1 });
      expect(next.introPlaying).toBe(false);
    });
  });

  describe("BACK_TO_ACTIVE", () => {
    it("from poi → active (clears POI)", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "BACK_TO_ACTIVE" });
      expect(next).toEqual({
        phase: "active",
        activeCategoryId: CAT_A,
        activePOIId: null,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    it("without active category → resets to default", () => {
      const next = boardReducer(initialBoardState, { type: "BACK_TO_ACTIVE" });
      expect(next).toEqual(initialBoardState);
    });
  });

  // 7/7-transisjon (r05.7): BACK_TO_DEFAULT (board-state.tsx:105-113) lukker POI-
  // overlay men beholder activeCategoryId så scroll-posisjon + audio-tour-state
  // forblir konsistent; phase→default, activePOIId nullstilt.
  describe("BACK_TO_DEFAULT", () => {
    it("from poi → default (behold activeCategoryId, nullstill activePOIId, phase→default)", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "BACK_TO_DEFAULT" });
      expect(next).toEqual({
        phase: "default",
        activeCategoryId: CAT_A,
        activePOIId: null,
        introPlaying: false,
        exploreOpen: false,
      });
    });

    it("beholder activeCategoryId fra active-fase (scroll-/audio-state konsistent)", () => {
      const start: BoardState = {
        phase: "active",
        activeCategoryId: CAT_B,
        activePOIId: null,
        introPlaying: false,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "BACK_TO_DEFAULT" });
      expect(next.phase).toBe("default");
      expect(next.activeCategoryId).toBe(CAT_B);
      expect(next.activePOIId).toBeNull();
    });
  });

  describe("RESET_TO_DEFAULT", () => {
    it("from any phase → initial state", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: true,
        exploreOpen: false,
      };
      const next = boardReducer(start, { type: "RESET_TO_DEFAULT" });
      expect(next).toEqual(initialBoardState);
    });
  });

  describe("START_INTRO / END_INTRO", () => {
    it("START_INTRO sets introPlaying without touching phase/category", () => {
      const next = boardReducer(initialBoardState, { type: "START_INTRO" });
      expect(next).toEqual({ ...initialBoardState, introPlaying: true });
    });

    it("END_INTRO clears introPlaying", () => {
      const start: BoardState = { ...initialBoardState, introPlaying: true };
      const next = boardReducer(start, { type: "END_INTRO" });
      expect(next.introPlaying).toBe(false);
    });
  });
});

describe("OPEN_EXPLORE / CLOSE_EXPLORE (Utforsk-modalen)", () => {
  const withPoi: BoardState = {
    ...initialBoardState,
    phase: "poi",
    activeCategoryId: "cat" as BoardState["activeCategoryId"],
    activePOIId: "poi-1" as BoardState["activePOIId"],
  };

  it("OPEN_EXPLORE setter exploreOpen uten å røre fase eller POI", () => {
    const next = boardReducer(withPoi, { type: "OPEN_EXPLORE" });
    expect(next).toEqual({ ...withPoi, exploreOpen: true });
  });

  it("OPEN_EXPLORE uten aktiv POI er no-op — ingen modal uten innhold", () => {
    const next = boardReducer(initialBoardState, { type: "OPEN_EXPLORE" });
    expect(next).toBe(initialBoardState);
  });

  it("CLOSE_EXPLORE nullstiller flagget og beholder POI-fasen (desktop: popupen står bak)", () => {
    const open: BoardState = { ...withPoi, exploreOpen: true };
    const next = boardReducer(open, { type: "CLOSE_EXPLORE" });
    expect(next.exploreOpen).toBe(false);
    expect(next.phase).toBe("poi");
    expect(next.activePOIId).toBe("poi-1");
  });

  // Modalen skal ALDRI overleve inn i en annen POI-kontekst enn den ble åpnet i.
  it.each([
    ["BACK_TO_DEFAULT", { type: "BACK_TO_DEFAULT" as const }],
    ["BACK_TO_ACTIVE", { type: "BACK_TO_ACTIVE" as const }],
    ["RESET_TO_DEFAULT", { type: "RESET_TO_DEFAULT" as const }],
    ["OPEN_POI (annen POI)", { type: "OPEN_POI" as const, id: "poi-2" as BoardState["activePOIId"] & string }],
    ["SELECT_CATEGORY", { type: "SELECT_CATEGORY" as const, id: "cat2" as BoardState["activeCategoryId"] & string }],
  ])("%s nullstiller exploreOpen", (_label, action) => {
    const open: BoardState = { ...withPoi, exploreOpen: true };
    expect(boardReducer(open, action).exploreOpen).toBe(false);
  });
});
