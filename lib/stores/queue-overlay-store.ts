"use client";

import { create } from "zustand";

/** Ephemeral UI-state for queue-overlay (Spotify-mønstret spilleliste-popup
 *  som åpnes fra player-klikk). Holdes utenfor `audio-tour-store` siden det
 *  er ren UI, ikke audio-state — close ved tour-slutt er ikke ønsket
 *  (brukeren kan ha åpnet kø for å se hva som er igjen). */
interface QueueOverlayState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useQueueOverlayStore = create<QueueOverlayState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
