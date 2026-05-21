"use client";

import Image from "next/image";
import { MoreHorizontal, Pause, Play, Share2 } from "lucide-react";
import { useBoard } from "./board-state";
import { useStartTour } from "./audio-tour/use-start-tour";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";

/** Maks antall ord i hero-velkomst. Plan-deferred: skikkelig generert kort
 *  velkomst-tekst kommer senere. Pilot truncater `heroIntro` til naturlig
 *  setnings-grense ≤ MAX-ord. */
const WELCOME_MAX_WORDS = 50;

/**
 * Spotify-mønstret top-seksjon i sidebar — hero-image, tittel, sub-line,
 * meta-pill, slank velkomst-tekst, og action-row med stor rund play-knapp.
 *
 * Den store play-knappen er primær audio-tour-CTA. Bytter til pause når tour
 * spiller — samme posisjon, samme størrelse (konsistent affordance).
 *
 * Hjem-pitchens 70-ord-manus er audio-only og leses av megleren. Topp-tekst
 * her er en kort velkomst (40-50 ord) som setter rammen uten å konkurrere
 * med audio.
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
  const totalCategories = data.categories.length;
  const welcomeText = data.home.heroIntro
    ? truncateToWords(data.home.heroIntro, WELCOME_MAX_WORDS)
    : null;

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
      <div className="flex flex-col gap-3 px-6 pt-6 pb-5">
        <h1 className="text-3xl font-bold leading-tight text-stone-900">
          {data.home.name}
        </h1>
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {data.home.address}
          {canStart && (
            <>
              <span className="mx-1.5 text-stone-300">·</span>
              {totalTracks} spor
            </>
          )}
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-600">
          <span>{totalPois} punkter</span>
          <span className="text-stone-300">·</span>
          <span>{totalCategories} kategorier</span>
        </div>

        {welcomeText && (
          <p
            data-board-body
            className="text-[15px] leading-relaxed text-stone-700"
          >
            {welcomeText}
          </p>
        )}

        {canStart && <ActionRow />}
      </div>
    </header>
  );
}

/** Action-row: sekundære (mer/del) til venstre, stor rund play til høyre.
 *  Speil av Spotify artist-page action-row. */
function ActionRow() {
  return (
    <div className="mt-2 flex items-center justify-between">
      <div className="flex items-center gap-1">
        <SecondaryAction label="Del rapport" icon={Share2} />
        <SecondaryAction label="Flere alternativer" icon={MoreHorizontal} />
      </div>
      <PrimaryPlayButton />
    </div>
  );
}

function PrimaryPlayButton() {
  const phase = useAudioTourStore((s) => s.phase);
  const { pause, resume, retryTrack } = useAudioTourActions();
  const { startTour } = useStartTour();

  const isPlaying = phase === "playing";
  const isPaused = phase === "paused";
  const isError = phase === "error";
  // idle/ended → start tour fra Hjem; playing → pause; paused → resume;
  // error → retry. Konsistent affordance: én knapp, en handling.
  const handleClick = () => {
    if (isPlaying) return pause("manual");
    if (isPaused) return resume();
    if (isError) return retryTrack();
    startTour();
  };
  const label = isPlaying ? "Pause tour" : isPaused ? "Fortsett tour" : "Start tour";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-white shadow-lg transition hover:scale-105 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
    >
      {isPlaying ? (
        <Pause className="h-6 w-6" />
      ) : (
        <Play className="ml-0.5 h-6 w-6" />
      )}
    </button>
  );
}

function SecondaryAction({
  label,
  icon: Icon,
}: {
  label: string;
  icon: typeof Share2;
}) {
  // Pilot-placeholder: ingen handler. Konkrete actions (kopi-link, share,
  // mer-meny) populeres når use-case-er er klare. Knappene er disabled så
  // brukeren ikke får forventning om at de gjør noe.
  return (
    <button
      type="button"
      aria-label={label}
      disabled
      className="flex h-10 w-10 items-center justify-center rounded-full text-stone-400 transition hover:text-stone-600 disabled:cursor-not-allowed"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

/** Truncater tekst til ≤ `maxWords` ord, men søker bakover for å lande på
 *  setningsgrense (`.`, `!`, `?`) — gir naturlig cut-off i stedet for hard
 *  midt-i-setning-klipp. Fallback: rå word-cut + ellipsis.
 *
 *  Pilot-shim: `heroIntro`-feltet er 70+ ord, vi viser 40-50. Skikkelig kort
 *  velkomst-tekst-felt på BoardHome introduseres senere. */
function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();

  const cut = words.slice(0, maxWords).join(" ");
  const sentenceEnd = cut.search(/[.!?][^.!?]*$/);
  if (sentenceEnd !== -1) {
    const candidate = cut.slice(0, sentenceEnd + 1);
    const candidateWords = candidate.split(/\s+/).length;
    if (candidateWords >= maxWords * 0.6) return candidate;
  }
  return `${cut}…`;
}
