"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { AudioBearingCard } from "./reels-data";
import { posterForVideo } from "./reels-data";
import { useReels } from "./reels-state";
import { KaraokeTeleprompter } from "./KaraokeTeleprompter";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";

interface Props {
  /** Et hvilket som helst audio-bærende card (home, category, outro). */
  card: AudioBearingCard;
  /** Index i audio-tour-store sin tracks-array. -1 hvis cardet ikke har audio. */
  audioIndex: number;
  isActive: boolean;
  /** Når true: 2-kolonner desktop — karaoke ankres til bunn-kant (5%-marg). */
  desktopMode?: boolean;
}

export function CategoryReel({ card, audioIndex, isActive, desktopMode = false }: Props) {
  const { state } = useReels();
  const currentPhase = isActive ? state.currentPhase : null;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isCurrentAudio = useAudioTourStore(
    (s) =>
      audioIndex >= 0 &&
      s.trackIndex === audioIndex &&
      s.tracks.length > audioIndex,
  );
  const audioPhase = useAudioTourStore((s) => s.phase);

  // Bg-videoen skal stoppe SAMMEN med voice-overen — bildene er del av samme
  // narrative som stemmen.
  // - Desktop (player): bind til audio-fasen. Når brukeren pauser, fryser
  //   videoen på siste frame så kortet føles ekte pauset og ikke tar kognitiv
  //   last i bakgrunnen. Spiller kun når DETTE kortets spor faktisk går.
  // - Mobil (to-flate): historie-flaten rendrer kun det aktive kortet, så vi
  //   spiller bg-videoen mens kortet vises (currentPhase "reel"). Når brukeren
  //   åpner kart-flaten unmountes historie-flaten → videoen stopper.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const shouldPlay = desktopMode
      ? isActive && isCurrentAudio && audioPhase === "playing"
      : currentPhase === "reel";
    if (shouldPlay) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [desktopMode, isActive, isCurrentAudio, audioPhase, currentPhase]);

  // Desktop: karaoke aktiveres så lenge cardet er aktivt + dets spor spilles.
  // Mobil: aktivt kort i historie-flate (currentPhase "reel") + dets spor.
  const karaokeActive = desktopMode
    ? isActive && isCurrentAudio
    : isActive && currentPhase === "reel" && isCurrentAudio;

  // Karaoke-ankerhøyde fra bunn. Desktop: 5%-marg (ingen sheet). Mobil
  // (to-flate): fast lav anker som klarerer den vedvarende transport-baren —
  // den gamle sheet-snap-stigen (peek/quarter/half/full) finnes ikke lenger.
  const karaokeBottomPct = desktopMode ? 5 : 10;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Bakgrunns-lag — video (om tilgjengelig) eller statisk illustrasjon */}
      <div className="absolute inset-0">
        {card.videoBgSrc ? (
          <video
            ref={videoRef}
            src={card.videoBgSrc}
            poster={posterForVideo(card.videoBgSrc)}
            muted
            loop
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          card.illustrationSrc && (
            <Image
              src={card.illustrationSrc}
              alt={card.label}
              fill
              sizes="100vw"
              priority={isActive}
              className="object-cover"
            />
          )
        )}
        {/* Topp-gradient — KUN mobil. Der masker den hard kant mellom
            video-loops ved kort-bytte. På desktop (sidebar-løpebånd) er det
            ingen loop å maske, så vi dropper den for ren video-topp. 20% høyde. */}
        {!desktopMode && (
          <div className="absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-black/95 via-black/60 to-transparent pointer-events-none" />
        )}
        {/* Bunn-gradient — dekker bottom 50% av cardet (over karaoke +
            label) for tekst-kontrast. */}
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
      </div>

      {/* Karaoke + label — posisjonert like over transport-baren (mobil) eller
          bunn-kant (desktop). */}
      <div
        className="absolute left-0 right-0 px-6 z-10 transition-all duration-500 ease-out"
        style={{ bottom: `${karaokeBottomPct + 3}%` }}
      >
        <div
          className="inline-block text-[11px] uppercase tracking-[0.15em] text-white/95 mb-3 font-semibold"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,1)" }}
        >
          {card.label}
        </div>
        <KaraokeTeleprompter
          text={card.audio.manus}
          timings={card.audio.timings}
          isActive={karaokeActive}
          className="text-white text-lg leading-snug font-semibold"
        />
      </div>
    </div>
  );
}
