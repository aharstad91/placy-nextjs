import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

interface CollectionState {
  collectionPOIs: string[];
  addToCollection: (poiId: string) => void;
  removeFromCollection: (poiId: string) => void;
  clearCollection: () => void;
  isInCollection: (poiId: string) => boolean;
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      collectionPOIs: [],

      addToCollection: (poiId: string) =>
        set((state) => {
          if (state.collectionPOIs.includes(poiId)) return state;
          return { collectionPOIs: [...state.collectionPOIs, poiId] };
        }),

      removeFromCollection: (poiId: string) =>
        set((state) => ({
          collectionPOIs: state.collectionPOIs.filter((id) => id !== poiId),
        })),

      clearCollection: () => set({ collectionPOIs: [] }),

      isInCollection: (poiId: string) => get().collectionPOIs.includes(poiId),
    }),
    {
      name: "placy-collection",
    }
  )
);

// Hook for collection state
export const useCollection = () =>
  useCollectionStore(
    useShallow((state) => ({
      collectionPOIs: state.collectionPOIs,
      addToCollection: state.addToCollection,
      removeFromCollection: state.removeFromCollection,
      clearCollection: state.clearCollection,
    }))
  );
