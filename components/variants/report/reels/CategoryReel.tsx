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
  /** Når true: ingen sheet-mekanikk under cardet — karaoke ankres til
   *  bunn-kant, video skjules ikke i map-full. Brukes i 2-kolonner desktop. */
  desktopMode?: boolean;
}

// Sheet-høyde-progresjon — driver karaoke-posisjonen som ligger like over.
//   reel      → 15% (peek)
//   map-half  → 50%
//   map-full  → 100% (karaoke skjult)
const SHEET_HEIGHT_PCT = {
  reel: 10,
  "map-quarter": 20,
  "map-half": 50,
  "map-full": 100,
} as const;

export function CategoryReel({ card, audioIndex, isActive, desktopMode = false }: Props) {
  const { state, markMapMounted } = useReels();
  const currentPhase = isActive ? state.currentPhase : null;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (isActive) markMapMounted();
  }, [isActive, markMapMounted]);

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
  // - Mobil: behold sheet-fase-styringen (video fryser når sheet ekspanderer).
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
  // Phase er irrelevant fordi sheet ikke finnes.
  const karaokeActive = desktopMode
    ? isActive && isCurrentAudio
    : isActive && currentPhase === "reel" && isCurrentAudio;

  // Desktop: ingen sheet, karaoke ankres på bunn-kant (5%-marg).
  // Mobil: følger sheet-høyde (10–100%).
  const sheetHeightPct = desktopMode
    ? 5
    : currentPhase && currentPhase !== "intro"
      ? SHEET_HEIGHT_PCT[currentPhase]
      : SHEET_HEIGHT_PCT.reel;

  // map-full er en mobil-tilstand. På desktop er den irrelevant — kartet
  // er en separat permanent panel, ikke en utvidet sheet.
  const isFull = !desktopMode && currentPhase === "map-full";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Bakgrunns-lag — video (om tilgjengelig) eller statisk illustrasjon */}
      <div
        className="absolute inset-0 transition-opacity duration-500 ease-out"
        style={{
          opacity: isFull ? 0 : 1,
          pointerEvents: isFull ? "none" : "auto",
        }}
      >
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
            video-loops ved swipe mellom kort. På desktop (sidebar-løpebånd)
            er det ingen swipe-loop å maske, så vi dropper den for ren
            video-topp. 20% høyde. */}
        {!desktopMode && (
          <div className="absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-black/95 via-black/60 to-transparent pointer-events-none" />
        )}
        {/* Bunn-gradient — dekker bottom 50% av cardet (over karaoke +
            label) for tekst-kontrast. */}
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />
      </div>

      {/* Karaoke + label — posisjonert like over sheet (3% gap).
          Flytter dynamisk når sheet vokser. Skjules i map-full. */}
      <div
        className="absolute left-0 right-0 px-6 z-10 transition-all duration-500 ease-out"
        style={{
          bottom: `${sheetHeightPct + 3}%`,
          opacity: isFull ? 0 : 1,
        }}
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

      {/* Map-full kontroller (chevron, swipe-hint) rendres i MapLayer. */}
    </div>
  );
}

export { SHEET_HEIGHT_PCT };
