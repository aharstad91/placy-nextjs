"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

interface KompassState {
  // User answers
  selectedThemes: string[];
  selectedDay: string | null;
  selectedTimeOfDay: string[]; // "morning" | "afternoon" | "evening"

  // UI state
  activeTab: "kompass" | "all";
  hasCompletedFlow: boolean;
  showBottomSheet: boolean;
  bottomSheetStep: 1 | 2 | 3;

  // Actions
  setSelectedThemes: (themes: string[]) => void;
  setSelectedDay: (day: string | null) => void;
  setSelectedTimeOfDay: (times: string[]) => void;
  setActiveTab: (tab: "kompass" | "all") => void;
  completeFlow: () => void;
  skipFlow: () => void;
  resetFlow: () => void;
  nextStep: () => void;
  prevStep: () => void;
  openBottomSheet: () => void;
}

export const useKompassStore = create<KompassState>()(
  persist(
    (set) => ({
      // User answers
      selectedThemes: [],
      selectedDay: null,
      selectedTimeOfDay: [],

      // UI state (not persisted)
      activeTab: "all" as const,
      hasCompletedFlow: false,
      showBottomSheet: true,
      bottomSheetStep: 1 as const,

      // Actions
      setSelectedThemes: (themes) => set({ selectedThemes: themes }),
      setSelectedDay: (day) => set({ selectedDay: day }),
      setSelectedTimeOfDay: (times) => set({ selectedTimeOfDay: times }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      completeFlow: () =>
        set({
          hasCompletedFlow: true,
          showBottomSheet: false,
          activeTab: "kompass",
        }),

      skipFlow: () =>
        set({
          showBottomSheet: false,
          activeTab: "all",
        }),

      resetFlow: () =>
        set({
          selectedThemes: [],
          selectedDay: null,
          selectedTimeOfDay: [],
          hasCompletedFlow: false,
          showBottomSheet: true,
          bottomSheetStep: 1,
          activeTab: "all",
        }),

      nextStep: () =>
        set((state) => ({
          bottomSheetStep: Math.min(state.bottomSheetStep + 1, 3) as 1 | 2 | 3,
        })),

      prevStep: () =>
        set((state) => ({
          bottomSheetStep: Math.max(state.bottomSheetStep - 1, 1) as 1 | 2 | 3,
        })),

      openBottomSheet: () =>
        set({
          showBottomSheet: true,
          bottomSheetStep: 1,
        }),
    }),
    {
      name: "placy-kompass",
      partialize: (state) => ({
        selectedThemes: state.selectedThemes,
        selectedDay: state.selectedDay,
        selectedTimeOfDay: state.selectedTimeOfDay,
        hasCompletedFlow: state.hasCompletedFlow,
      }),
    }
  )
);

// Selector hooks
export function useKompassAnswers() {
  return useKompassStore(
    useShallow((s) => ({
      selectedThemes: s.selectedThemes,
      selectedDay: s.selectedDay,
      selectedTimeOfDay: s.selectedTimeOfDay,
      hasCompletedFlow: s.hasCompletedFlow,
    }))
  );
}

export function useKompassUI() {
  return useKompassStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      showBottomSheet: s.showBottomSheet,
      bottomSheetStep: s.bottomSheetStep,
    }))
  );
}
