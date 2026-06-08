import { describe, it, expect } from "vitest";
import {
  boardReducer,
  initialBoardState,
  type BoardState,
} from "./board-state";
import type { BoardCategoryId, BoardPOIId } from "./board-data";

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
