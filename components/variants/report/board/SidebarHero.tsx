"use client";

import Image from "next/image";
import { Pause, Play, Share2 } from "lucide-react";
import { useBoard } from "./board-state";
import { useStartTour } from "./audio-tour/use-start-tour";
import {
  useAudioTourActions,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";

/**
 * Spotify-mønstret top-seksjon i sidebar — hero-image, tittel, meta-pill og
 * action-row (del + stor rund play-knapp) på én kompakt rad.
 *
 * Den store play-knappen er primær audio-tour-CTA. Bytter til pause når tour
 * spiller — samme posisjon, samme størrelse (konsistent affordance).
 *
 * Hjem-pitchen rendres som første spor under CategoryIndex (egen seksjon med
 * karaoke-tekst når audio spiller). Topp har ingen velkomst-tekst — den ville
 * duplisert Hjem-sporets innhold.
 */
export function SidebarHero({
  imageSizes = "400px",
}: {
  /** next/image sizes — default matcher 400px desktop-sidebar. Mobil-sheet
   *  bør sende "100vw" så bilde-prioritering matcher viewport-bredde. */
  imageSizes?: string;
} = {}) {
  const { data } = useBoard();
  const { canStart } = useStartTour();

  const totalPois = data.categories.reduce((sum, c) => sum + c.pois.length, 0);
  const totalCategories = data.categories.length;

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
      <div className="flex flex-col gap-3 px-6 pt-5 pb-4">
        <h1 className="text-3xl font-bold leading-tight text-stone-900">
          {data.home.name}
        </h1>

        {/* Meta-rad + actions samlet på én linje — komprimert høyde.
            Stor play til høyre er primær audio-tour-CTA; del er sekundær. */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium text-stone-600">
            <span>{totalPois} punkter</span>
            <span className="text-stone-300">·</span>
            <span>{totalCategories} kategorier</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <SecondaryAction label="Del rapport" icon={Share2} />
            {canStart && <PrimaryPlayButton />}
          </div>
        </div>
      </div>
    </header>
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
      className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-white shadow-md transition hover:scale-105 hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
    >
      {isPlaying ? (
        <Pause className="h-5 w-5" />
      ) : (
        <Play className="ml-0.5 h-5 w-5" />
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

