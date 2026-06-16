"use client";

import { useEffect, useRef } from "react";
import type { IntroReelCard } from "./reels-data";
import { useReels } from "./reels-state";
import { useAudioElement } from "../board/audio-tour/use-audio-element";

interface Props {
  card: IntroReelCard;
  isActive: boolean;
}

export function IntroReel({ card, isActive }: Props) {
  const { state, markAudioUnlocked } = useReels();
  const { unlock } = useAudioElement();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isActive]);

  // Page Visibility — iOS Safari pauser muted video automatisk ved tab-switch
  // og resumer ikke alltid. Re-play når tab blir synlig igjen.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && isActive) {
        void video.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isActive]);

  const handleUnlock = async () => {
    await unlock();
    markAudioUnlocked();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={card.videoSrc}
        muted
        loop
        playsInline
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

      {!state.audioUnlocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-32 px-8 z-10">
          <button
            onClick={handleUnlock}
            className="rounded-full bg-white text-black px-8 py-4 font-medium text-lg shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Start opplevelsen
          </button>
          <p className="mt-3 text-white/80 text-xs">
            Trykk for å låse opp lyd
          </p>
        </div>
      )}

    </div>
  );
}
