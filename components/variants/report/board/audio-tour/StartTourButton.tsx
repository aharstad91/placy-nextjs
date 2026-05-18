"use client";

import { Headphones } from "lucide-react";
import { useBoard } from "../board-state";
import {
  useAudioTourActions,
  type AudioTrack,
  type AudioTrackCategoryId,
} from "@/lib/stores/audio-tour-store";

/**
 * CTA i Hjem-panel som starter audio-touren. Renderes kun hvis ALLE:
 *   - `data.audioTourEnabled === true` (eksplisitt opt-in per prosjekt), OG
 *   - `data.home.audio` finnes (Hjem-spor klar), OG
 *   - alle synlige kategorier har audio (helhetlig empty-state-policy).
 *
 * Eksplisitt opt-in tillater forhåndsgenerering av audio på prosjekter
 * vi ikke er klar til å eksponere CTA-en på enda. Manglende audio på én
 * kategori → skjul CTA; vi vil ikke at brukeren skal starte en tour som
 * plutselig hopper over en kategori uten varsel.
 *
 * Track-rekkefølge: Hjem først, deretter kategorier i den rekkefølgen de
 * ligger i `boardData.categories` (som matcher `reportConfig.themes`-
 * rekkefølgen). Dette gir megler-pitch-flyten en rød tråd.
 */
export function StartTourButton() {
  const { data } = useBoard();
  const { start } = useAudioTourActions();

  const homeAudio = data.home.audio;
  const allCategoriesHaveAudio = data.categories.every((c) => c.audio);

  if (
    !data.audioTourEnabled ||
    !homeAudio ||
    !allCategoriesHaveAudio ||
    data.categories.length === 0
  ) {
    return null;
  }

  const tracks: AudioTrack[] = [
    {
      categoryId: "home" as AudioTrackCategoryId,
      url: homeAudio.url,
      manus: homeAudio.manus,
    },
    ...data.categories.map((c) => ({
      categoryId: c.id,
      // Safe — `allCategoriesHaveAudio` garanterer at audio er definert
      // for hver kategori.
      url: c.audio!.url,
      manus: c.audio!.manus,
    })),
  ];

  const totalTracks = tracks.length;

  return (
    <button
      type="button"
      onClick={() => start(tracks)}
      className="group flex w-full items-center gap-3 rounded-2xl border border-stone-900/10 bg-stone-900 px-4 py-3.5 text-left text-white shadow-sm transition hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
        <Headphones className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Megler-pitch · {totalTracks} spor
        </span>
        <span className="text-[15px] font-semibold leading-tight">
          ▶ Start tour
        </span>
      </span>
    </button>
  );
}
