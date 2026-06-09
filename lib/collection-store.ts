import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

interface CollectionState {
  projectId: string | null;
  collectionPOIs: string[];
  setProject: (projectId: string) => void;
  addToCollection: (poiId: string) => void;
  removeFromCollection: (poiId: string) => void;
  clearCollection: () => void;
  /** Erstatt hele samlingen med et eksakt sett IDer (dedupet, rekkefølge bevart).
   *  Brukes ved rehydrering av en delt `?c=`-lenke: den delte samlingen skal
   *  REPRODUSERES, ikke merges med en eksisterende lokal samling. */
  setCollection: (poiIds: string[]) => void;
  isInCollection: (poiId: string) => boolean;
}

export const useCollectionStore = create<CollectionState>()(
  persist(
    (set, get) => ({
      projectId: null,
      collectionPOIs: [],

      setProject: (projectId: string) => {
        if (get().projectId !== projectId) {
          set({ projectId, collectionPOIs: [] });
        }
      },

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

      setCollection: (poiIds: string[]) =>
        set({ collectionPOIs: Array.from(new Set(poiIds)) }),

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
      setProject: state.setProject,
      addToCollection: state.addToCollection,
      removeFromCollection: state.removeFromCollection,
      clearCollection: state.clearCollection,
      setCollection: state.setCollection,
    }))
  );
