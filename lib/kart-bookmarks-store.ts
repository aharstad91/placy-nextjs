import { create } from "zustand";
import { persist } from "zustand/middleware";

interface KartBookmarksState {
  bookmarkedPOIs: string[];
  toggleBookmark: (poiId: string) => void;
}

export const useKartBookmarks = create<KartBookmarksState>()(
  persist(
    (set) => ({
      bookmarkedPOIs: [],
      toggleBookmark: (poiId) =>
        set((state) => ({
          bookmarkedPOIs: state.bookmarkedPOIs.includes(poiId)
            ? state.bookmarkedPOIs.filter((id) => id !== poiId)
            : [...state.bookmarkedPOIs, poiId],
        })),
    }),
    { name: "placy-kart-bookmarks" }
  )
);
