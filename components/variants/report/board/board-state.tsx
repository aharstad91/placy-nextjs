"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { BoardCategoryId, BoardPOIId, BoardData } from "./board-data";
import {
  useSubCategoryFilter,
  type SubCategoryFilterApi,
} from "./use-sub-category-filter";

export type BoardPhase = "default" | "active" | "poi";

export interface BoardState {
  phase: BoardPhase;
  activeCategoryId: BoardCategoryId | null;
  activePOIId: BoardPOIId | null;
}

export type BoardAction =
  | { type: "SELECT_CATEGORY"; id: BoardCategoryId }
  | { type: "OPEN_POI"; id: BoardPOIId; categoryId?: BoardCategoryId }
  | { type: "BACK_TO_ACTIVE" }
  | { type: "RESET_TO_DEFAULT" };

export const initialBoardState: BoardState = {
  phase: "default",
  activeCategoryId: null,
  activePOIId: null,
};

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "SELECT_CATEGORY":
      return {
        phase: "active",
        activeCategoryId: action.id,
        activePOIId: null,
      };

    case "OPEN_POI": {
      const categoryId = action.categoryId ?? state.activeCategoryId;
      if (!categoryId) return state;
      return {
        phase: "poi",
        activeCategoryId: categoryId,
        activePOIId: action.id,
      };
    }

    case "BACK_TO_ACTIVE":
      if (!state.activeCategoryId) {
        return initialBoardState;
      }
      return {
        ...state,
        phase: "active",
        activePOIId: null,
      };

    case "RESET_TO_DEFAULT":
      return initialBoardState;

    default:
      return state;
  }
}

interface BoardContextValue {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
  data: BoardData;
  subFilter: SubCategoryFilterApi;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
  data,
  children,
}: {
  data: BoardData;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);
  const subFilter = useSubCategoryFilter(state.activeCategoryId);

  useEffect(() => {
    if (!state.activePOIId || !state.activeCategoryId) return;
    const cat = data.categories.find((c) => c.id === state.activeCategoryId);
    const poi = cat?.pois.find((p) => p.id === state.activePOIId);
    if (!poi) return;
    if (subFilter.hiddenIds.has(poi.raw.category.id)) {
      dispatch({ type: "BACK_TO_ACTIVE" });
    }
  }, [
    subFilter.hiddenIds,
    state.activePOIId,
    state.activeCategoryId,
    data.categories,
  ]);

  return (
    <BoardContext.Provider value={{ state, dispatch, data, subFilter }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard må brukes inne i en BoardProvider");
  }
  return ctx;
}

export function useActiveCategory() {
  const { state, data } = useBoard();
  if (!state.activeCategoryId) return null;
  return data.categories.find((c) => c.id === state.activeCategoryId) ?? null;
}

export function useActivePOI() {
  const cat = useActiveCategory();
  const { state } = useBoard();
  if (!cat || !state.activePOIId) return null;
  return cat.pois.find((p) => p.id === state.activePOIId) ?? null;
}

export function useFilteredActiveCategory() {
  const cat = useActiveCategory();
  const { subFilter } = useBoard();
  if (!cat) return null;
  if (subFilter.hiddenIds.size === 0) return cat;
  return {
    ...cat,
    pois: cat.pois.filter((p) => !subFilter.hiddenIds.has(p.raw.category.id)),
  };
}
