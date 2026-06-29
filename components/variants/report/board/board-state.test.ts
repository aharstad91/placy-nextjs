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
      });
    });

    it("from poi → re-selects new category, clearing POI", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
      };
      const next = boardReducer(start, { type: "SELECT_CATEGORY", id: CAT_B });
      expect(next).toEqual({
        phase: "active",
        activeCategoryId: CAT_B,
        activePOIId: null,
        introPlaying: false,
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
      };
      const next = boardReducer(start, { type: "OPEN_POI", id: POI_1 });
      expect(next).toEqual({
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
      });
    });

    it("from poi → swap POI in-place (same category)", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
      };
      const next = boardReducer(start, { type: "OPEN_POI", id: POI_2 });
      expect(next).toEqual({
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_2,
        introPlaying: false,
      });
    });

    it("with explicit categoryId from default → poi with that category", () => {
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
      });
    });

    it("from default with no categoryId → no-op", () => {
      const next = boardReducer(initialBoardState, {
        type: "OPEN_POI",
        id: POI_1,
      });
      expect(next).toBe(initialBoardState);
    });
  });

  describe("BACK_TO_ACTIVE", () => {
    it("from poi → active (clears POI)", () => {
      const start: BoardState = {
        phase: "poi",
        activeCategoryId: CAT_A,
        activePOIId: POI_1,
        introPlaying: false,
      };
      const next = boardReducer(start, { type: "BACK_TO_ACTIVE" });
      expect(next).toEqual({
        phase: "active",
        activeCategoryId: CAT_A,
        activePOIId: null,
        introPlaying: false,
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
      };
      const next = boardReducer(start, { type: "BACK_TO_DEFAULT" });
      expect(next).toEqual({
        phase: "default",
        activeCategoryId: CAT_A,
        activePOIId: null,
        introPlaying: false,
      });
    });

    it("beholder activeCategoryId fra active-fase (scroll-/audio-state konsistent)", () => {
      const start: BoardState = {
        phase: "active",
        activeCategoryId: CAT_B,
        activePOIId: null,
        introPlaying: false,
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
