"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { ReelsCard } from "./reels-data";

export type ReelsPhase =
  | "intro"
  | "reel"
  | "map-quarter"
  | "map-half"
  | "map-full";

export interface ReelsState {
  cards: ReelsCard[];
  activeIndex: number;
  currentPhase: ReelsPhase;
  audioUnlocked: boolean;
  mapMounted: boolean;
}

export type ReelsAction =
  | { type: "SET_ACTIVE_INDEX"; index: number }
  | { type: "SET_PHASE"; phase: ReelsPhase }
  | { type: "MARK_AUDIO_UNLOCKED" }
  | { type: "MARK_MAP_MOUNTED" };

function defaultPhaseForCard(card: ReelsCard | undefined): ReelsPhase {
  if (!card) return "intro";
  return card.kind === "intro" ? "intro" : "reel";
}

export function reelsReducer(state: ReelsState, action: ReelsAction): ReelsState {
  switch (action.type) {
    case "SET_ACTIVE_INDEX": {
      if (action.index === state.activeIndex) return state;
      const card = state.cards[action.index];
      return {
        ...state,
        activeIndex: action.index,
        currentPhase: defaultPhaseForCard(card),
      };
    }
    case "SET_PHASE":
      if (state.currentPhase === action.phase) return state;
      return { ...state, currentPhase: action.phase };
    case "MARK_AUDIO_UNLOCKED":
      if (state.audioUnlocked) return state;
      return { ...state, audioUnlocked: true };
    case "MARK_MAP_MOUNTED":
      if (state.mapMounted) return state;
      return { ...state, mapMounted: true };
    default:
      return state;
  }
}

interface ReelsContextValue {
  state: ReelsState;
  dispatch: Dispatch<ReelsAction>;
  setActiveIndex: (index: number) => void;
  setPhase: (phase: ReelsPhase) => void;
  markAudioUnlocked: () => void;
  markMapMounted: () => void;
}

const ReelsContext = createContext<ReelsContextValue | null>(null);

interface ProviderProps {
  cards: ReelsCard[];
  children: ReactNode;
}

export function ReelsProvider({ cards, children }: ProviderProps) {
  const initialState: ReelsState = useMemo(
    () => ({
      cards,
      activeIndex: 0,
      currentPhase: defaultPhaseForCard(cards[0]),
      audioUnlocked: false,
      mapMounted: false,
    }),
    [cards],
  );

  const [state, dispatch] = useReducer(reelsReducer, initialState);

  const value = useMemo<ReelsContextValue>(
    () => ({
      state,
      dispatch,
      setActiveIndex: (index) => dispatch({ type: "SET_ACTIVE_INDEX", index }),
      setPhase: (phase) => dispatch({ type: "SET_PHASE", phase }),
      markAudioUnlocked: () => dispatch({ type: "MARK_AUDIO_UNLOCKED" }),
      markMapMounted: () => dispatch({ type: "MARK_MAP_MOUNTED" }),
    }),
    [state],
  );

  return <ReelsContext.Provider value={value}>{children}</ReelsContext.Provider>;
}

export function useReels(): ReelsContextValue {
  const ctx = useContext(ReelsContext);
  if (!ctx) {
    throw new Error("useReels must be used within ReelsProvider");
  }
  return ctx;
}
