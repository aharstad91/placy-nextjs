"use client";

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { BoardCategoryId, BoardPOIId, BoardData } from "./board-data";

export type BoardPhase = "default" | "active" | "reading" | "poi";

export interface BoardState {
  phase: BoardPhase;
  activeCategoryId: BoardCategoryId | null;
  activePOIId: BoardPOIId | null;
}

export type BoardAction =
  | { type: "SELECT_CATEGORY"; id: BoardCategoryId }
  | { type: "OPEN_READING" }
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
      // Velger ny kategori — alltid landing på "active" uavhengig av forrige fase
      return {
        phase: "active",
        activeCategoryId: action.id,
        activePOIId: null,
      };

    case "OPEN_READING":
      // Krever aktiv kategori — ellers no-op
      if (!state.activeCategoryId) return state;
      return { ...state, phase: "reading", activePOIId: null };

    case "OPEN_POI": {
      // categoryId kan være eksplisitt (f.eks. POI-marker-klikk fra default) eller arvet
      const categoryId = action.categoryId ?? state.activeCategoryId;
      if (!categoryId) return state;
      return {
        phase: "poi",
        activeCategoryId: categoryId,
        activePOIId: action.id,
      };
    }

    case "BACK_TO_ACTIVE":
      // Returnerer til "active" hvis vi har aktiv kategori, ellers default
      if (!state.activeCategoryId) {
        return initialBoardState;
      }
      return { ...state, phase: "active", activePOIId: null };

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
  return (
    <BoardContext.Provider value={{ state, dispatch, data }}>
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

/** Selector for aktiv kategori (eller null hvis phase=default eller ID ikke matcher). */
export function useActiveCategory() {
  const { state, data } = useBoard();
  if (!state.activeCategoryId) return null;
  return data.categories.find((c) => c.id === state.activeCategoryId) ?? null;
}

/** Selector for aktiv POI (eller null). */
export function useActivePOI() {
  const cat = useActiveCategory();
  const { state } = useBoard();
  if (!cat || !state.activePOIId) return null;
  return cat.pois.find((p) => p.id === state.activePOIId) ?? null;
}
