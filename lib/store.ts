import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { TravelMode, TimeBudget, PlacyState } from "./types";

// Placy Global State med localStorage persistering
export const usePlacyStore = create<PlacyState>()(
  persist(
    (set) => ({
      // Standard verdier
      travelMode: "walk",
      timeBudget: 15,
      activePOI: null,
      activeThemeStory: null,

      // Actions
      setTravelMode: (mode: TravelMode) => set({ travelMode: mode }),
      setTimeBudget: (budget: TimeBudget) => set({ timeBudget: budget }),
      setActivePOI: (poiId: string | null) => set({ activePOI: poiId }),
      setActiveThemeStory: (themeStoryId: string | null) =>
        set({ activeThemeStory: themeStoryId }),
    }),
    {
      name: "placy-settings",
      // Bare persister reiseinnstillinger, ikke aktive elementer
      partialize: (state) => ({
        travelMode: state.travelMode,
        timeBudget: state.timeBudget,
      }),
    }
  )
);

// Hook for å hente kun reiseinnstillinger - med shallow comparison
export const useTravelSettings = () =>
  usePlacyStore(
    useShallow((state) => ({
      travelMode: state.travelMode,
      timeBudget: state.timeBudget,
      setTravelMode: state.setTravelMode,
      setTimeBudget: state.setTimeBudget,
    }))
  );

// Hook for aktiv POI - med shallow comparison
export const useActivePOI = () =>
  usePlacyStore(
    useShallow((state) => ({
      activePOI: state.activePOI,
      setActivePOI: state.setActivePOI,
    }))
  );

// Hook for aktiv Theme Story - med shallow comparison
export const useActiveThemeStory = () =>
  usePlacyStore(
    useShallow((state) => ({
      activeThemeStory: state.activeThemeStory,
      setActiveThemeStory: state.setActiveThemeStory,
    }))
  );
