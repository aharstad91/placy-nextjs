"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { useReels } from "./reels-state";
import { useAudioElement } from "../board/audio-tour/use-audio-element";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";
import {
  firstAudioBearingIndex,
  isAudioBearing,
  posterForVideo,
} from "./reels-data";
import type { ReelsCard } from "./reels-data";
import type { BoardHome } from "../board/board-data";

/**
 * Desktop-adaptiv storytelling-lane (kun >=1024px, rendres fra
 * ResponsiveLayoutInner i ReportReelsPage).
 *
 * Player-modell (erstatter det gamle scroll-løpebåndet): ÉN aktiv chapter vises
 * stort i 9:16-kortet, og kategoriene komprimeres til en klikkbar thumbnail-rad
 * i bunn — en "spiller" der hele historien er synlig på én skjerm uten scroll.
 * Mål: dempe kognitiv last. I stedet for en stabel kort som beveger seg under
 * scroll (oppå video + kart-bevegelse + voice-over), skifter nå KUN det aktive
 * kort-komponentet ved kategori-bytte. Thumbnailene er statiske postere (ingen
 * autoplay), så raden i seg selv tilfører ingen bevegelse.
 *
 * Avspilling gjenbruker mobil-maskineriet 1:1:
 * - Det aktive kortet rendrer den ekte `CategoryReel`/`MeglerReel` via
 *   `renderActiveCard` (CardRouter desktopMode) → samme video/karaoke-VO som
 *   mobil-feeden. Ingen endring i de delte komponentene.
 * - "Start/Fortsett"-knappen låser opp audio (samme `unlock()`-gesture som
 *   IntroReel) og setter activeIndex; `useReelsAudioOrchestration` driver touren.
 * - Auto-advance håndteres i ReelsAudioShell.handleTrackEnded (desktop).
 *
 * Mobil-komponenten (ReelsStack + CardRouter-stack) er urørt og brukes
 * fortsatt <1024px.
 */

interface Props {
  home: BoardHome;
  /** Rendrer det aktive kortets media (video/bilde-bg + karaoke-VO, eller
   *  megler-kort). Gjenbruk av CardRouter i desktopMode — samme presentasjon
   *  som mobil. */
  renderActiveCard: (cardIndex: number) => React.ReactNode;
  /** Prosjekt-logo (SVG). Vises klikkbar i header → re-åpner velkomst-splash. */
  logoSrc?: string;
  /** Trykk på logo → animer splash-laget inn igjen (ingen refresh). */
  onLogoClick?: () => void;
}

/** Poster/tittel for thumbnail-raden. Megler har ikke media → portrett brukes. */
function thumbView(card: ReelsCard): { title: string; image?: string } {
  switch (card.kind) {
    case "welcome":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "home":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "category":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "outro":
      return { title: card.label, image: posterForVideo(card.videoBgSrc) ?? card.illustrationSrc };
    case "megler":
      return { title: card.label, image: card.brokers[0]?.photoUrl };
    default:
      return { title: "" };
  }
}

export function DesktopStorySidebar({
  home,
  renderActiveCard,
  logoSrc,
  onLogoClick,
}: Props) {
  const { state, setActiveIndex, markAudioUnlocked } = useReels();
  const { unlock } = useAudioElement();
  const { pause, resume, goToTrack } = useAudioTourActions();
  const phase = useAudioTourStore((s) => s.phase);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  // Thumbnail-raden viser alle chapters unntatt intro-video-splashen. Megler
  // er med som siste chapter (kontakt) — CardRouter rendrer MeglerReel i det
  // aktive arealet når den velges, så modellen "bytte = skift aktivt kort"
  // holder for alle kort-typer.
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

  const activeCard = state.cards[state.activeIndex];
  // Før touren starter peker activeIndex på intro (splash dekker sidebaren da).
  // Vis et rolig stillbilde av første chapter i kort-arealet i stedet for å
  // (auto)spille intro-videoen bak splashen.
  const activeIsIntro = !activeCard || activeCard.kind === "intro";
  const activeIsAudio = !!activeCard && isAudioBearing(activeCard);
  const firstChapterImage = items[0] ? thumbView(items[0].card).image : undefined;

  // Hold det aktive chapter-thumbnailet synlig i raden når storien avanserer
  // (klikk eller auto-advance) — sentrer det horisontalt.
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [state.activeIndex]);

  const activateCard = async (index: number) => {
    if (!state.audioUnlocked) {
      await unlock();
      markAudioUnlocked();
    }
    setActiveIndex(index);
  };

  // Samlet transport-toggle. Drevet av klikk på selve kort-overlayet (knappen
  // under kortet er fjernet): pause/resume/replay avhengig av state.
  const handleToggle = () => {
    if (notStarted) {
      if (firstIdx !== -1) void activateCard(firstIdx);
      return;
    }
    if (isPlaying) {
      pause("manual");
    } else if (phase === "ended") {
      // Restart fra første kapittel. setActiveIndex flytter ankeret tilbake;
      // goToTrack(0) garanterer at audio-touren faktisk re-spiller.
      if (firstIdx !== -1) setActiveIndex(firstIdx);
      goToTrack(0);
    } else {
      resume();
    }
  };

  return (
    <aside className="relative z-20 flex h-full w-[438px] shrink-0 flex-col border-r border-black/5 bg-[#f2e9dc] shadow-xl">
      {/* Header — logo (→ velkomst) + tittel. Ingen divider; ren look som skisse. */}
      <div className="shrink-0 px-6 pb-3 pt-6">
        {logoSrc && (
          <button
            type="button"
            onClick={onLogoClick}
            aria-label="Tilbake til velkomst"
            className="mb-4 block transition-opacity hover:opacity-70"
          >
            <Image
              src={logoSrc}
              alt={home.name}
              width={132}
              height={51}
              unoptimized
              className="h-9 w-auto"
            />
          </button>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
          Bli kjent med
        </p>
        <h2 className="mt-1 text-xl font-bold leading-tight text-stone-900">
          {home.name}
        </h2>
        {subline && <p className="mt-0.5 text-sm text-stone-500">{subline}</p>}
      </div>

      {/* Aktivt chapter — ett kort i 9:16 (samme format som mobil-reelen). Fyller
          tilgjengelig høyde; bredden følger 9:16 og klampes så den aldri går
          bredere enn sidebaren. */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="group relative aspect-[9/16] h-full max-h-[640px] overflow-hidden rounded-2xl bg-black shadow-lg">
          {activeIsIntro ? (
            firstChapterImage && (
              <Image
                src={firstChapterImage}
                alt=""
                fill
                sizes="372px"
                className="object-cover opacity-90"
              />
            )
          ) : (
            renderActiveCard(state.activeIndex)
          )}
          {/* State-drevet transport-overlay (erstatter knappen under kortet):
              spiller → skjult, vises som Pause ved hover; pauset/ferdig →
              vedvarende Play + scrim så kortet leses som ekte pauset. Kun på
              spillbare (audio-bærende) kort. */}
          {activeIsAudio && (
            <button
              type="button"
              onClick={handleToggle}
              aria-label={isPlaying ? "Pause" : "Spill av"}
              className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300 ${
                isPlaying
                  ? "opacity-0 hover:opacity-100 focus-visible:opacity-100"
                  : "opacity-100"
              }`}
            >
              {!isPlaying && <span className="absolute inset-0 bg-black/30" />}
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/40 backdrop-blur-sm">
                {isPlaying ? (
                  <Pause size={26} className="fill-white text-white" />
                ) : (
                  <Play size={26} className="translate-x-0.5 fill-white text-white" />
                )}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Player-rad — komprimerte, klikkbare chapter-thumbnails. Statiske
          postere (ingen bevegelse). Aktiv = ring + full opasitet; resten dimmes.
          Hover viser kategori-navnet som tooltip over thumbnailet (knappen er
          borte → rom til det). Horisontal scroll når det er flere chapters enn
          som får plass; ekstra topp-padding gir tooltipen rom uten klipping. */}
      <div className="flex shrink-0 gap-2 overflow-x-auto px-6 pb-6 pt-9 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ card, index }) => {
          const view = thumbView(card);
          const isActive = state.activeIndex === index;
          return (
            <button
              key={index}
              ref={isActive ? activeThumbRef : undefined}
              type="button"
              onClick={() => void activateCard(index)}
              aria-label={view.title}
              aria-current={isActive}
              className={`group/thumb relative h-14 w-14 shrink-0 snap-center rounded-xl transition-all duration-300 ${
                isActive
                  ? "ring-2 ring-stone-900 ring-offset-2 ring-offset-[#f2e9dc]"
                  : "opacity-55 hover:opacity-90"
              }`}
            >
              <span className="absolute inset-0 overflow-hidden rounded-xl">
                {view.image ? (
                  <Image
                    src={view.image}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 bg-stone-700" />
                )}
                {/* Aktiv-markør: liten play/pause-dot nede til høyre. */}
                {isActive && (
                  <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-900/80">
                    {isPlaying ? (
                      <Pause size={9} className="fill-white text-white" />
                    ) : (
                      <Play size={9} className="translate-x-px fill-white text-white" />
                    )}
                  </span>
                )}
              </span>
              {/* Hover-tooltip: kategori-navn over thumbnailet. */}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/thumb:opacity-100">
                {view.title}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
