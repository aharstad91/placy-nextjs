"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Play } from "lucide-react";

interface BoardEmbedProps {
  /** Full URL til boardet som skal demonstreres. */
  src: string;
  /** Plakat som vises til noen trykker «Start demoen». */
  poster: string;
  posterAlt: string;
}

/**
 * Demoen i pitchen. Iframen monteres FØRST når man trykker start — et nivå-2-
 * board med 3D er det tyngste vi har, og et deck som drar det i bakgrunnen
 * gjennom hele møtet risikerer å bli tregt akkurat når det gjelder. Plakaten
 * gjør at sliden ser ferdig ut før den lastes, og «åpne i ny fane» er
 * rømningsveien hvis maskinen sliter.
 */
export default function BoardEmbed({ src, poster, posterAlt }: BoardEmbedProps) {
  const [live, setLive] = useState(false);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#eae6e1] bg-white shadow-sm">
      {/* Fast høyde i vh, ikke aspect-ratio: sliden må få plass til faktakortene
          under demoen uten at man må scrolle midt i et møte. */}
      <div className="relative h-[44vh] w-full bg-[#f2efe9] md:h-[52vh]">
        {live ? (
          <iframe
            src={src}
            title="Placy – nabolagsboard for Wesselsløkka"
            className="absolute inset-0 h-full w-full border-0"
            allow="fullscreen; geolocation; autoplay"
          />
        ) : (
          <button
            type="button"
            onClick={() => setLive(true)}
            className="group absolute inset-0 h-full w-full"
            aria-label="Start demoen"
          >
            <Image
              src={poster}
              alt={posterAlt}
              fill
              sizes="(max-width: 768px) 100vw, 900px"
              className="object-cover object-top"
              priority
            />
            <span className="absolute inset-0 bg-[#1a1a1a]/25 transition-colors group-hover:bg-[#1a1a1a]/15" />
            <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-white px-5 py-3 text-sm font-medium shadow-lg">
              <Play className="h-4 w-4 fill-current" />
              Start demoen
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-[#eae6e1] px-4 py-2.5">
        <span className="truncate text-[12px] text-[#8a8a8a]">
          Live board — samme side kjøperen ville sett
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[#0284c7] hover:underline"
        >
          Åpne i ny fane
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
