"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { useReels } from "./reels-state";
import { useAudioElement } from "../board/audio-tour/use-audio-element";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";
import { firstAudioBearingIndex, posterForVideo, audioDurationSec } from "./reels-data";
import type { ReelsCard } from "./reels-data";
import type { BoardHome } from "../board/board-data";

/**
 * Desktop-adaptiv storytelling-lane (kun >=1024px, rendres fra
 * ResponsiveLayoutInner i ReportReelsPage). Erstatter den gamle "mobil-reel
 * i flytende 9:16-ramme"-løsningen med en full-høyde sidebar der kategoriene
 * ligger på et løpebånd — ~2.5 synlige om gangen.
 *
 * Avspilling gjenbruker mobil-maskineriet 1:1:
 * - Det AKTIVE kortet ekspanderer og rendrer det ekte `CategoryReel`
 *   (via `renderActiveCard` = CardRouter desktopMode) → samme video/bilde-bg
 *   + karaoke-voice-over-transcript som mobil-feeden. Ingen endring i den
 *   delte komponenten, så det unike fra mobil bevares.
 * - "Start"-knappen låser opp audio (samme `unlock()`-gesture som IntroReel)
 *   og setter activeIndex; `useReelsAudioOrchestration` starter touren.
 * - Auto-advance håndteres i ReelsAudioShell.handleTrackEnded (desktop).
 *
 * Mobil-komponenten (ReelsStack + CardRouter-stack) er urørt og brukes
 * fortsatt <1024px.
 */

interface Props {
  home: BoardHome;
  /** Rendrer det aktive kortets media (video/bilde-bg + karaoke-VO). Gjenbruk
   *  av CardRouter/CategoryReel i desktopMode — samme presentasjon som mobil. */
  renderActiveCard: (cardIndex: number) => React.ReactNode;
}

interface CardView {
  title: string;
  subtitle?: string;
  image?: string;
  meta?: string;
  /** Lengden på kategoriens lydspor i sekunder (avledet fra timings). */
  durationSec?: number;
}

/** mm:ss for lyd-lengde-pillen. 44.164 → "0:44". */
function formatDuration(sec: number): string {
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function toCardView(card: ReelsCard): CardView {
  // Preview-bildet prioriterer videoens første frame (poster) når kortet har
  // en video-bg — slik at det inaktive preview-kortet matcher det som faktisk
  // spilles når kategorien blir aktiv. Faller tilbake til det statiske
  // illustrasjonsbildet når kortet ikke har video.
  switch (card.kind) {
    case "welcome":
      return {
        title: card.label,
        subtitle: "Introduksjon",
        image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc,
      };
    case "home":
      return {
        title: card.label,
        subtitle: card.subline,
        image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc,
      };
    case "category":
      return {
        title: card.label,
        subtitle: card.lead,
        image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc,
        meta: `${card.pois.length} steder`,
        durationSec: audioDurationSec(card.audio),
      };
    case "outro":
      return {
        title: card.label,
        subtitle: "Oppsummering",
        image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc,
      };
    case "megler":
      return { title: card.label, subtitle: "Kontakt megler" };
    default:
      return { title: "" };
  }
}

export function DesktopStorySidebar({ home, renderActiveCard }: Props) {
  const { state, setActiveIndex, markAudioUnlocked } = useReels();
  const { unlock } = useAudioElement();
  const { pause, resume, goToTrack } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Løpebåndet viser alt unntatt intro-video-splashen.
  const items = state.cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.kind !== "intro");

  const subline = [home.district, home.city].filter(Boolean).join(", ");
  const isPlaying = phase === "playing";
  const firstIdx = firstAudioBearingIndex(state.cards);
  // "Ikke startet" dekker to tilfeller: (1) audio aldri unlocket, og (2) audio
  // unlocket via klikk på et ikke-audio-kort (megler/intro) uten at touren
  // faktisk startet — da står phase fortsatt "idle". Begge skal vise "Start".
  const notStarted = !state.audioUnlocked || phase === "idle";

  // Anchor-switch: det aktive kortet er scroll-ankeret. Når storien avanserer
  // (klikk eller auto-advance), ankrer vi det aktive kortet til toppen — spilte
  // kapitler glir opp og ut, og den resterende høyden viser neste kategori som
  // peek. Hele løpebåndet vandrer dermed nedover i takt med historien.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.activeIndex]);

  const activateCard = async (index: number) => {
    if (!state.audioUnlocked) {
      await unlock();
      markAudioUnlocked();
    }
    setActiveIndex(index);
  };

  const handlePrimary = () => {
    if (notStarted) {
      if (firstIdx !== -1) void activateCard(firstIdx);
      return;
    }
    if (isPlaying) {
      pause("manual");
    } else if (phase === "ended") {
      // Restart fra første kapittel. setActiveIndex flytter scroll-ankeret
      // tilbake til toppen; goToTrack(0) garanterer at audio-touren faktisk
      // re-spiller selv om activeIndex allerede skulle peke på første kort.
      if (firstIdx !== -1) setActiveIndex(firstIdx);
      goToTrack(0);
    } else {
      resume();
    }
  };

  // Klikk på det AKTIVE kortet (hover viser play/pause-ikon) veksler avspilling
  // for sporet som allerede er i gang. Idle/ended → (re)start fra dette kortet.
  const togglePlayActive = () => {
    if (isPlaying) {
      pause("manual");
    } else if (phase === "paused" || phase === "error") {
      resume();
    } else {
      void activateCard(state.activeIndex);
    }
  };

  const primaryLabel = notStarted
    ? "Start opplevelsen"
    : isPlaying
      ? "Pause"
      : phase === "ended"
        ? "Spill av på nytt"
        : "Fortsett";
  const PrimaryIcon = isPlaying ? Pause : Play;

  return (
    <aside className="relative z-20 flex h-full w-[438px] shrink-0 flex-col border-r border-stone-200 bg-white shadow-xl">
      {/* Header — tittel + play/pause */}
      <div className="shrink-0 border-b border-stone-200/80 px-6 pb-5 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
          Bli kjent med
        </p>
        <h2 className="mt-1 text-xl font-bold leading-tight text-stone-900">
          {home.name}
        </h2>
        {subline && <p className="mt-0.5 text-sm text-stone-500">{subline}</p>}
        <button
          type="button"
          onClick={handlePrimary}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-700"
        >
          <PrimaryIcon size={15} className="fill-white" />
          {primaryLabel}
        </button>
      </div>

      {/* Løpebånd — aktivt kort spiller i mobil-aspect (9:16) så video får
          høyde og teksten ikke ligger oppå; resten av høyden peeker neste
          kategori. scroll-padding gir ankeret litt luft fra toppen. */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 [scroll-padding-top:0.75rem] [scrollbar-width:thin]">
        {items.map(({ card, index }, pos) => {
          const view = toCardView(card);
          const isActive = state.activeIndex === index;

          if (isActive) {
            // Ekspandert "spiller nå"-kort — rendrer den ekte CategoryReel i
            // EKSAKT 9:16 (samme format som mobil-reelen) så video/karaoke-
            // komposisjonen er gjenbrukbar. Høyde-drevet: kortet skaleres til
            // tilgjengelig viewport-høyde (minus header + peek) og bredden
            // utledes fra 9:16 — slik fyller reelen alltid uten å klippe
            // teksten, og resten av høyden peeker neste kategori(er).
            return (
              <div
                key={index}
                ref={activeRef}
                className="group relative mx-auto h-[calc(100dvh-17rem)] max-h-[660px] w-[calc((100dvh-17rem)*0.5625)] max-w-[372px] shrink-0 scroll-mt-3 overflow-hidden rounded-2xl bg-black shadow-lg"
              >
                {renderActiveCard(index)}
                {/* Hover-overlay: play/pause-veksling for sporet som spilles. */}
                <button
                  type="button"
                  onClick={togglePlayActive}
                  aria-label={isPlaying ? "Pause" : "Spill av"}
                  className="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/40 backdrop-blur-sm">
                    {isPlaying ? (
                      <Pause size={24} className="fill-white text-white" />
                    ) : (
                      <Play size={24} className="translate-x-0.5 fill-white text-white" />
                    )}
                  </span>
                </button>
              </div>
            );
          }

          // Kompakt preview
          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                void activateCard(index);
              }}
              className="group relative mx-auto block h-[128px] w-[calc((100dvh-17rem)*0.5625)] max-w-[372px] shrink-0 scroll-mt-3 overflow-hidden rounded-2xl text-left opacity-90 transition-all duration-300 hover:opacity-100 hover:shadow-md"
            >
              {view.image ? (
                <Image
                  src={view.image}
                  alt={view.title}
                  fill
                  sizes="300px"
                  priority={pos < 2}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-stone-800" />
              )}
              <div className="absolute inset-x-0 bottom-0 top-1/4 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                {(view.meta || view.durationSec != null) && (
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    {view.meta && (
                      <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                        {view.meta}
                      </span>
                    )}
                    {view.durationSec != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                        <Volume2 size={10} />
                        {formatDuration(view.durationSec)}
                      </span>
                    )}
                  </div>
                )}
                <h3 className="text-base font-bold leading-tight text-white drop-shadow">
                  {view.title}
                </h3>
              </div>
              {/* Hover-CTA: play-ikon fader inn som signal om at kortet er spillbart. */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/40 backdrop-blur-sm">
                  <Play size={20} className="translate-x-px fill-white text-white" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
