"use client";

import { useBoard } from "../board-state";
import {
  useAudioTourActions,
  type AudioTrack,
  type AudioTrackCategoryId,
} from "@/lib/stores/audio-tour-store";

export interface UseStartTour {
  /** True når audio-tour er konfigurert OG alle nødvendige spor finnes
   *  (Hjem + alle kategorier). Driver om CTA-flater (play-knapp, banner)
   *  skal rendres i det hele tatt. */
  canStart: boolean;
  /** Antall spor som vil bli spilt — Hjem + N kategorier. 0 når `canStart` er
   *  false. */
  totalTracks: number;
  /** Bygger track-array fra BoardData og kaller `start()` på store.
   *  No-op hvis `canStart` er false. */
  startTour: () => void;
}

/** Felles "start tour"-logikk for play-CTA-flater (BottomPlayer-idle, hero
 *  action-row, StartTourButton). Bygger Hjem-først-track-array fra BoardData
 *  og delegerer til `useAudioTourActions().start()`.
 *
 *  Gating-kontrakt (identisk med BottomPlayer + StartTourButton + CategoryAudio-
 *  Button): audioTourEnabled + Hjem-audio + alle kategorier har audio. Manglende
 *  audio på én kategori → canStart=false så vi ikke starter en tour som plutselig
 *  hopper over en kategori uten varsel. */
export function useStartTour(): UseStartTour {
  const { data } = useBoard();
  const { start } = useAudioTourActions();

  const welcomeAudio = data.welcome;
  const homeAudio = data.home.audio;
  const outroAudio = data.outro;
  const allCategoriesHaveAudio = data.categories.every((c) => c.audio);
  const canStart =
    !!data.audioTourEnabled &&
    !!homeAudio &&
    allCategoriesHaveAudio &&
    data.categories.length > 0;

  // Welcome + outro inkluderes i count og tracks når de finnes — fullverdige
  // spor som spilles automatisk hhv før første kategori og etter siste.
  // Telles utenfor "kategori-antall" i CategoryIndex, men inn i totalTracks.
  const totalTracks = canStart
    ? data.categories.length +
      1 +
      (welcomeAudio ? 1 : 0) +
      (outroAudio ? 1 : 0)
    : 0;

  const startTour = () => {
    if (!canStart || !homeAudio) return;
    const tracks: AudioTrack[] = [
      ...(welcomeAudio
        ? [
            {
              categoryId: "welcome" as AudioTrackCategoryId,
              url: welcomeAudio.url,
              manus: welcomeAudio.manus,
            },
          ]
        : []),
      {
        categoryId: "home" as AudioTrackCategoryId,
        url: homeAudio.url,
        manus: homeAudio.manus,
      },
      ...data.categories.map((c) => ({
        categoryId: c.id,
        url: c.audio!.url,
        manus: c.audio!.manus,
      })),
      ...(outroAudio
        ? [
            {
              categoryId: "outro" as AudioTrackCategoryId,
              url: outroAudio.url,
              manus: outroAudio.manus,
            },
          ]
        : []),
    ];
    start(tracks);
  };

  return { canStart, totalTracks, startTour };
}
