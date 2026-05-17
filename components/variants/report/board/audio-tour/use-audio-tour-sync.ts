"use client";

import { useEffect, useRef } from "react";
import { useBoard } from "../board-state";
import {
  useAudioTourSyncTargets,
  type AudioTourPhase,
} from "@/lib/stores/audio-tour-store";
import type { BoardCategoryId } from "../board-data";

/**
 * To-veis-sync mellom `useAudioTourStore` og `BoardContext`:
 *
 *   1. Når tour bytter spor: dispatch `SELECT_CATEGORY` til BoardContext
 *      (eller `RESET_TO_DEFAULT` for Hjem-sporet) så rail/tab-bar/map følger.
 *
 *   2. Når bruker manuelt bytter kategori (eller åpner POI som flytter
 *      activeCategoryId) under playing → kall `pause("category-clicked")`.
 *
 *   3. Når bruker klikker "Fortsett tour" fra category-clicked-pause:
 *      snap BoardContext tilbake til track-kategorien (Design D3, option 3
 *      — "resume + navigate panel tilbake"). Uten denne snap-bakken vil
 *      audio fortsette på Hverdagsliv mens panelet står på Mat & Drikke.
 *
 * `lastDispatchSource` (Adversarial F2) sporer hvem som drev forrige
 * `SELECT_CATEGORY` slik at vi ikke triggers en pause når store selv
 * dispatchet endringen — det ville vært sirkulær trigger.
 */
export function useAudioTourSync(): void {
  const { state: boardState, dispatch } = useBoard();
  const { phase, trackIndex, tracks, pause } = useAudioTourSyncTargets();

  const lastDispatchSource = useRef<"tour" | "user">("user");
  const lastTrackIndex = useRef<number | null>(null);
  const prevPhase = useRef<AudioTourPhase>(phase);
  const lastActiveCategoryId = useRef(boardState.activeCategoryId);

  // 1) tour-driven → BoardContext
  useEffect(() => {
    if (phase !== "playing" && phase !== "paused") return;
    if (lastTrackIndex.current === trackIndex) return;
    lastTrackIndex.current = trackIndex;

    const current = tracks[trackIndex];
    if (!current) return;

    lastDispatchSource.current = "tour";
    if (current.categoryId === "home") {
      dispatch({ type: "RESET_TO_DEFAULT" });
    } else {
      dispatch({
        type: "SELECT_CATEGORY",
        id: current.categoryId as BoardCategoryId,
      });
    }
  }, [phase, trackIndex, tracks, dispatch]);

  // Reset cursor når tour avsluttes/lukkes
  useEffect(() => {
    if (phase === "idle" || phase === "ended") {
      lastTrackIndex.current = null;
    }
  }, [phase]);

  // 2) BoardContext-driven → pause hvis bruker bytter til annen kategori.
  // Vi må KUN reagere når `activeCategoryId` faktisk endrer seg — ikke
  // på phase- eller trackIndex-bytter. Uten ref-sjekken fyrer effekten
  // ved hver phase-overgang (inkl. paused→playing resume), ser den
  // utdaterte mismatch-en, og kaller pause() før effekt 3 rekker å snappe
  // BoardContext tilbake. Ref-sammenligning gir effekten en "ekte change"-
  // gate.
  useEffect(() => {
    const prevActiveId = lastActiveCategoryId.current;
    const activeId = boardState.activeCategoryId;
    lastActiveCategoryId.current = activeId;
    if (prevActiveId === activeId) return;

    if (phase !== "playing") return;
    if (lastDispatchSource.current === "tour") {
      lastDispatchSource.current = "user";
      return;
    }
    const current = tracks[trackIndex];
    if (!current) return;

    if (current.categoryId === "home") {
      if (activeId !== null) {
        pause("category-clicked");
      }
      return;
    }
    if (activeId !== current.categoryId) {
      pause("category-clicked");
    }
  }, [
    boardState.activeCategoryId,
    boardState.phase,
    phase,
    trackIndex,
    tracks,
    pause,
  ]);

  // 3) Resume-snap: paused → playing-overgang skal re-synce BoardContext
  // til track-kategorien (Design D3, option 3). Effekt 1 alene gjør ikke
  // dette fordi den bare fyrer ved trackIndex-bytte.
  useEffect(() => {
    const wasPaused = prevPhase.current === "paused";
    prevPhase.current = phase;
    if (!wasPaused || phase !== "playing") return;

    const current = tracks[trackIndex];
    if (!current) return;
    const expectedActiveId =
      current.categoryId === "home" ? null : current.categoryId;
    if (boardState.activeCategoryId === expectedActiveId) return;

    lastDispatchSource.current = "tour";
    if (current.categoryId === "home") {
      dispatch({ type: "RESET_TO_DEFAULT" });
    } else {
      dispatch({
        type: "SELECT_CATEGORY",
        id: current.categoryId as BoardCategoryId,
      });
    }
  }, [phase, trackIndex, tracks, boardState.activeCategoryId, dispatch]);
}
