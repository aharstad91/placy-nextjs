"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Pause, Play } from "lucide-react";
import { useBoard } from "./board-state";
import { useStartTour } from "./audio-tour/use-start-tour";
import { KaraokePitchText } from "./audio-tour/KaraokePitchText";
import {
  useAudioTourActions,
  useAudioTourStore,
  useCurrentTrack,
} from "@/lib/stores/audio-tour-store";

/**
 * Spotify-mønstret top-seksjon i sidebar — hero-image, tittel, meta-pill og
 * en bred CTA-pille som primær audio-tour-engagement.
 *
 * CTA-pillen er en accordion: idle viser play + tekst. Under tour-start
 * ekspanderer den nedover med velkomst-karaoke (welcome-spor). Når welcome
 * er ferdig (auto-next → home/Nabolaget) kollapser accordion + scroll-panelet
 * scroller til Nabolaget-seksjonen.
 *
 * Hvis prosjektet ikke har welcome-audio, oppfører CTA seg som før — én klikk
 * starter tour direkte uten ekspansjon.
 */
export function SidebarHero({
  imageSizes = "400px",
}: {
  /** next/image sizes — default matcher 400px desktop-sidebar. Mobil-sheet
   *  bør sende "100vw" så bilde-prioritering matcher viewport-bredde. */
  imageSizes?: string;
} = {}) {
  const { data } = useBoard();
  const { canStart, totalTracks } = useStartTour();

  const totalPois = data.categories.reduce((sum, c) => sum + c.pois.length, 0);

  return (
    <header className="flex flex-col">
      {data.home.heroImage && (
        <div className="relative aspect-[4/3] w-full flex-none bg-stone-200">
          <Image
            src={data.home.heroImage}
            alt={data.home.name}
            fill
            sizes={imageSizes}
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="flex flex-col gap-4 px-6 pt-5 pb-4">
        <h1 className="text-3xl font-bold leading-tight text-stone-900">
          {data.home.name}
        </h1>

        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-600">
          <span>{totalPois} punkter</span>
          <span className="text-stone-300">·</span>
          <span>{data.categories.length} kategorier</span>
        </div>

        {canStart && <TourCTAAccordion totalTracks={totalTracks} />}
      </div>
    </header>
  );
}

/**
 * Bred audio-tour-CTA i pill-form med accordion-ekspansjon for welcome-spor.
 * Full bredde, ikon + 2-linjers tekst + chevron-affordance. Cycler gjennom
 * audio-tour-phase som primær engagement-flate: idle/ended → start; playing →
 * pause; paused → resume; error → retry.
 *
 * Når currentTrack er "welcome": pillen utvides nedover med karaoke-tekst
 * (welcome-manus). Pillen forblir åpen så lenge welcome-sporet er aktivt
 * (playing/paused/error på welcome). Når store.next() flytter trackIndex til
 * "home" (Nabolaget), kollapser pillen og scroll-panelet scroller til
 * Nabolaget-seksjonen.
 *
 * Hvis prosjektet ikke har welcome-audio (data.welcome undefined), oppfører
 * pillen seg som før — én klikk → tour starter direkte på home, ingen
 * ekspansjon, scroll til Nabolaget umiddelbart.
 */
function TourCTAAccordion({ totalTracks }: { totalTracks: number }) {
  const { data } = useBoard();
  const welcomeTrack = data.welcome;

  const phase = useAudioTourStore((s) => s.phase);
  const { pause, resume, retryTrack } = useAudioTourActions();
  const { startTour } = useStartTour();
  const currentTrack = useCurrentTrack();
  const previousTrackIdRef = useRef<string | undefined>(undefined);

  const isPlaying = phase === "playing";
  const isPaused = phase === "paused";
  const isError = phase === "error";
  const tourActive = isPlaying || isPaused || isError;
  const isWelcomeActive =
    tourActive && currentTrack?.categoryId === "welcome";

  // Auto-scroll til Nabolaget når welcome-sporet er ferdig og trackIndex
  // går videre til home. Vi watcher previous track-id slik at vi kun fyrer
  // én gang per overgang fra welcome → home (ikke ved hver re-render).
  // Hvis prosjektet ikke har welcome, scroller vi i startTour() direkte.
  useEffect(() => {
    const prev = previousTrackIdRef.current;
    const current = currentTrack?.categoryId;
    if (prev === "welcome" && current === "home") {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('[data-board-section="home"]')
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    previousTrackIdRef.current = current;
  }, [currentTrack?.categoryId]);

  const handleClick = () => {
    if (isPlaying) return pause("manual");
    if (isPaused) return resume();
    if (isError) return retryTrack();
    startTour();
    // Hvis ingen welcome-spor finnes, scroll direkte til Nabolaget. Med
    // welcome-spor: auto-scroll-effekten over tar over når trackIndex
    // skifter fra welcome → home.
    if (!welcomeTrack) {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('[data-board-section="home"]')
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const title = isPlaying
    ? "Pause tur"
    : isPaused
      ? "Fortsett tur"
      : isError
        ? "Prøv igjen"
        : "Start guidet tur";
  const subtitle = `${totalTracks} spor · audio-fortelling`;
  const ariaLabel = isPlaying
    ? "Pause tour"
    : isPaused
      ? "Fortsett tour"
      : "Start tour";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-expanded={isWelcomeActive}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white shadow-sm">
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-base font-semibold text-stone-900">
            {title}
          </span>
          <span className="text-[12px] text-stone-500">{subtitle}</span>
        </span>
        <ChevronDown
          className={`ml-auto h-5 w-5 shrink-0 text-stone-400 transition-transform duration-300 ${
            isWelcomeActive ? "rotate-180" : ""
          }`}
        />
      </button>
      {welcomeTrack && (
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-out ${
            isWelcomeActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-stone-100 px-4 py-4">
              <KaraokePitchText
                text={welcomeTrack.manus}
                timings={welcomeTrack.timings}
                isActive={isWelcomeActive}
                className="text-[15px] leading-relaxed text-stone-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
