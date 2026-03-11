import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export type TimeSlot = "morning" | "afternoon" | "evening";

export interface KompassState {
  // User selections
  selectedThemes: string[];       // Category IDs (multi-select)
  selectedDay: string | null;      // "2025-07-28" or null (whole festival)
  selectedTimeSlots: TimeSlot[];   // Multi-select time of day

  // UI state
  kompassCompleted: boolean;
  activeTab: "kompass" | "all";
  onboardingStep: 1 | 2 | 3;
  showOnboarding: boolean;

  // Actions
  setSelectedThemes: (themes: string[]) => void;
  toggleTheme: (themeId: string) => void;
  setSelectedDay: (day: string | null) => void;
  setSelectedTimeSlots: (slots: TimeSlot[]) => void;
  toggleTimeSlot: (slot: TimeSlot) => void;
  setActiveTab: (tab: "kompass" | "all") => void;
  nextStep: () => void;
  prevStep: () => void;
  completeKompass: () => void;
  skipKompass: () => void;
  resetKompass: () => void;
  reopenOnboarding: () => void;
}

export const useKompassStore = create<KompassState>()((set) => ({
  // Initial state
  selectedThemes: [],
  selectedDay: null,
  selectedTimeSlots: [],
  kompassCompleted: false,
  activeTab: "kompass",
  onboardingStep: 1,
  showOnboarding: true,

  // Actions
  setSelectedThemes: (themes) => set({ selectedThemes: themes }),

  toggleTheme: (themeId) =>
    set((state) => ({
      selectedThemes: state.selectedThemes.includes(themeId)
        ? state.selectedThemes.filter((t) => t !== themeId)
        : [...state.selectedThemes, themeId],
    })),

  setSelectedDay: (day) => set({ selectedDay: day }),

  setSelectedTimeSlots: (slots) => set({ selectedTimeSlots: slots }),

  toggleTimeSlot: (slot) =>
    set((state) => ({
      selectedTimeSlots: state.selectedTimeSlots.includes(slot)
        ? state.selectedTimeSlots.filter((s) => s !== slot)
        : [...state.selectedTimeSlots, slot],
    })),

  setActiveTab: (tab) => set({ activeTab: tab }),

  nextStep: () =>
    set((state) => ({
      onboardingStep: Math.min(state.onboardingStep + 1, 3) as 1 | 2 | 3,
    })),

  prevStep: () =>
    set((state) => ({
      onboardingStep: Math.max(state.onboardingStep - 1, 1) as 1 | 2 | 3,
    })),

  completeKompass: () =>
    set({
      kompassCompleted: true,
      showOnboarding: false,
      activeTab: "kompass",
    }),

  skipKompass: () =>
    set({
      kompassCompleted: false,
      showOnboarding: false,
      activeTab: "all",
    }),

  resetKompass: () =>
    set({
      selectedThemes: [],
      selectedDay: null,
      selectedTimeSlots: [],
      kompassCompleted: false,
      activeTab: "kompass",
      onboardingStep: 1,
      showOnboarding: true,
    }),

  reopenOnboarding: () =>
    set({
      showOnboarding: true,
      onboardingStep: 1,
    }),
}));

// Selector hooks (Zustand best practice: always use selectors)
export const useKompassSelections = () =>
  useKompassStore(
    useShallow((s) => ({
      selectedThemes: s.selectedThemes,
      selectedDay: s.selectedDay,
      selectedTimeSlots: s.selectedTimeSlots,
    }))
  );

export const useKompassUI = () =>
  useKompassStore(
    useShallow((s) => ({
      kompassCompleted: s.kompassCompleted,
      activeTab: s.activeTab,
      showOnboarding: s.showOnboarding,
      onboardingStep: s.onboardingStep,
    }))
  );

export const useKompassActions = () =>
  useKompassStore(
    useShallow((s) => ({
      setSelectedThemes: s.setSelectedThemes,
      toggleTheme: s.toggleTheme,
      setSelectedDay: s.setSelectedDay,
      setSelectedTimeSlots: s.setSelectedTimeSlots,
      toggleTimeSlot: s.toggleTimeSlot,
      setActiveTab: s.setActiveTab,
      nextStep: s.nextStep,
      prevStep: s.prevStep,
      completeKompass: s.completeKompass,
      skipKompass: s.skipKompass,
      resetKompass: s.resetKompass,
      reopenOnboarding: s.reopenOnboarding,
    }))
  );
