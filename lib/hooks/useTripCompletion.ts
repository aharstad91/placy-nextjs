/**
 * useTripCompletion - State management for trip gamification
 *
 * Handles:
 * - Persisted completion state in localStorage
 * - Stop marking with GPS verification
 * - Trip completion tracking
 * - Reward redemption
 */

import { useState, useEffect, useCallback } from "react";
import type {
  TripId,
  TripCompletionState,
  StopCompletionRecord,
  Coordinates,
} from "@/lib/types";
import { createTripId } from "@/lib/types";

const STORAGE_KEY = "placy-trip-completions";
const INTROS_KEY = "placy-trip-intros-seen";

// Legacy keys for migration
const LEGACY_STORAGE_KEY = "placy-guide-completions";
const LEGACY_INTROS_KEY = "placy-guide-intros-seen";

// Migrate old localStorage keys to new ones (idempotent, safe for multi-tab)
function migrateOldKeys() {
  if (typeof window === "undefined") return;
  try {
    const oldCompletions = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (oldCompletions && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, oldCompletions);
    }
    const oldIntros = localStorage.getItem(LEGACY_INTROS_KEY);
    if (oldIntros && !localStorage.getItem(INTROS_KEY)) {
      localStorage.setItem(INTROS_KEY, oldIntros);
    }
    // Don't delete old keys — harmless, avoids race conditions
  } catch {
    // Ignore migration errors
  }
}

// Get completions from localStorage
function getStoredCompletions(): Record<string, TripCompletionState> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save completions to localStorage
function saveCompletions(completions: Record<string, TripCompletionState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
  } catch (e) {
    console.error("Failed to save trip completions:", e);
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
    console.error("Failed to save trip intros:", e);
  }
}

/**
 * Hook for managing trip completion state for a specific trip
 */
export function useTripCompletion(tripId: string) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [completion, setCompletion] = useState<TripCompletionState | undefined>(
    undefined
  );
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  // Hydrate from localStorage on mount (with migration)
  useEffect(() => {
    migrateOldKeys();
    const completions = getStoredCompletions();
    const intros = getStoredIntros();

    setCompletion(completions[tripId]);
    setHasSeenIntro(intros[tripId] === true);
    setIsHydrated(true);
  }, [tripId]);

  // Start trip
  const startTrip = useCallback(() => {
    const completions = getStoredCompletions();
    if (completions[tripId]) return; // Already started

    const newCompletion: TripCompletionState = {
      tripId: createTripId(tripId),
      startedAt: Date.now(),
      stops: {},
    };

    completions[tripId] = newCompletion;
    saveCompletions(completions);
    setCompletion(newCompletion);
  }, [tripId]);

  // Mark intro as seen
  const markIntroSeen = useCallback(() => {
    const intros = getStoredIntros();
    intros[tripId] = true;
    saveIntros(intros);
    setHasSeenIntro(true);
  }, [tripId]);

  // Mark stop as complete
  const markStopComplete = useCallback(
    (
      stopId: string,
      gpsVerified: boolean,
      accuracy?: number,
      coords?: Coordinates
    ) => {
      const completions = getStoredCompletions();
      let current = completions[tripId];

      // Auto-start if not started
      if (!current) {
        current = {
          tripId: createTripId(tripId),
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
      completions[tripId] = current;
      saveCompletions(completions);
      setCompletion({ ...current });
    },
    [tripId]
  );

  // Complete the trip
  const completeTrip = useCallback(() => {
    const completions = getStoredCompletions();
    const current = completions[tripId];
    if (!current || current.completedAt) return;

    current.completedAt = Date.now();
    completions[tripId] = current;
    saveCompletions(completions);
    setCompletion({ ...current });
  }, [tripId]);

  // Mark celebration as shown
  const markCelebrationShown = useCallback(() => {
    const completions = getStoredCompletions();
    const current = completions[tripId];
    if (!current) return;

    current.celebrationShownAt = Date.now();
    completions[tripId] = current;
    saveCompletions(completions);
    setCompletion({ ...current });
  }, [tripId]);

  // Mark as redeemed
  const markRedeemed = useCallback(() => {
    const completions = getStoredCompletions();
    const current = completions[tripId];
    if (!current || !current.completedAt) return;

    current.redeemedAt = Date.now();
    completions[tripId] = current;
    saveCompletions(completions);
    setCompletion({ ...current });
  }, [tripId]);

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
    startTrip,
    markIntroSeen,
    markStopComplete,
    completeTrip,
    markCelebrationShown,
    markRedeemed,
    isStopCompleted,
  };
}
