/**
 * useGuideCompletion - State management for guide gamification
 *
 * Handles:
 * - Persisted completion state in localStorage
 * - Stop marking with GPS verification
 * - Guide completion tracking
 * - Reward redemption
 */

import { useState, useEffect, useCallback } from "react";
import type {
  GuideId,
  GuideCompletionState,
  StopCompletionRecord,
  Coordinates,
} from "@/lib/types";
import { createGuideId } from "@/lib/types";

const STORAGE_KEY = "placy-guide-completions";
const INTROS_KEY = "placy-guide-intros-seen";

// Get completions from localStorage
function getStoredCompletions(): Record<string, GuideCompletionState> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save completions to localStorage
function saveCompletions(completions: Record<string, GuideCompletionState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
  } catch (e) {
    console.error("Failed to save guide completions:", e);
  }
}

// Get intros seen from localStorage
function getStoredIntros(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(INTROS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save intros seen to localStorage
function saveIntros(intros: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INTROS_KEY, JSON.stringify(intros));
  } catch (e) {
    console.error("Failed to save guide intros:", e);
  }
}

/**
 * Hook for managing guide completion state for a specific guide
 */
export function useGuideCompletion(guideId: string) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [completion, setCompletion] = useState<GuideCompletionState | undefined>(
    undefined
  );
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const completions = getStoredCompletions();
    const intros = getStoredIntros();

    setCompletion(completions[guideId]);
    setHasSeenIntro(intros[guideId] === true);
    setIsHydrated(true);
  }, [guideId]);

  // Start guide
  const startGuide = useCallback(() => {
    const completions = getStoredCompletions();
    if (completions[guideId]) return; // Already started

    const newCompletion: GuideCompletionState = {
      guideId: createGuideId(guideId),
      startedAt: Date.now(),
      stops: {},
    };

    completions[guideId] = newCompletion;
    saveCompletions(completions);
    setCompletion(newCompletion);
  }, [guideId]);

  // Mark intro as seen
  const markIntroSeen = useCallback(() => {
    const intros = getStoredIntros();
    intros[guideId] = true;
    saveIntros(intros);
    setHasSeenIntro(true);
  }, [guideId]);

  // Mark stop as complete
  const markStopComplete = useCallback(
    (
      stopId: string,
      gpsVerified: boolean,
      accuracy?: number,
      coords?: Coordinates
    ) => {
      const completions = getStoredCompletions();
      let current = completions[guideId];

      // Auto-start if not started
      if (!current) {
        current = {
          guideId: createGuideId(guideId),
          startedAt: Date.now(),
          stops: {},
        };
      }

      // Don't overwrite existing
      if (current.stops[stopId]) return;

      const record: StopCompletionRecord = {
        markedAt: Date.now(),
        verifiedByGPS: gpsVerified,
        accuracy,
        coordinates: coords,
      };

      current.stops[stopId] = record;
      completions[guideId] = current;
      saveCompletions(completions);
      setCompletion({ ...current });
    },
    [guideId]
  );

  // Complete the guide
  const completeGuide = useCallback(() => {
    const completions = getStoredCompletions();
    const current = completions[guideId];
    if (!current || current.completedAt) return;

    current.completedAt = Date.now();
    completions[guideId] = current;
    saveCompletions(completions);
    setCompletion({ ...current });
  }, [guideId]);

  // Mark celebration as shown
  const markCelebrationShown = useCallback(() => {
    const completions = getStoredCompletions();
    const current = completions[guideId];
    if (!current) return;

    current.celebrationShownAt = Date.now();
    completions[guideId] = current;
    saveCompletions(completions);
    setCompletion({ ...current });
  }, [guideId]);

  // Mark as redeemed
  const markRedeemed = useCallback(() => {
    const completions = getStoredCompletions();
    const current = completions[guideId];
    if (!current || !current.completedAt) return;

    current.redeemedAt = Date.now();
    completions[guideId] = current;
    saveCompletions(completions);
    setCompletion({ ...current });
  }, [guideId]);

  // Check if stop is completed
  const isStopCompleted = useCallback(
    (stopId: string) => {
      return completion?.stops[stopId] !== undefined;
    },
    [completion]
  );

  // Derived state
  const isCompleted = completion?.completedAt !== undefined;
  const isRedeemed = completion?.redeemedAt !== undefined;
  const completedStopsCount = completion
    ? Object.keys(completion.stops).length
    : 0;

  // Get completion stats
  const stats =
    completion?.completedAt
      ? {
          totalTimeMinutes: Math.round(
            (completion.completedAt - completion.startedAt) / 60000
          ),
          stopsCompleted: Object.keys(completion.stops).length,
        }
      : null;

  return {
    isHydrated,
    completion,
    hasSeenIntro,
    isCompleted,
    isRedeemed,
    completedStopsCount,
    stats,

    // Actions
    startGuide,
    markIntroSeen,
    markStopComplete,
    completeGuide,
    markCelebrationShown,
    markRedeemed,
    isStopCompleted,
  };
}
