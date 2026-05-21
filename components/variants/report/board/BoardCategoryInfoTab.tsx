"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { POI } from "@/lib/types";
import { linkPOIsInText, type TextSegment } from "@/lib/utils/story-text-linker";
import POIPopover from "../POIPopover";
import type { BoardCategory } from "./board-data";
import {
  useAudioTourPhase,
  useCurrentTrack,
} from "@/lib/stores/audio-tour-store";
import { KaraokePitchText } from "./audio-tour/KaraokePitchText";
import { CategoryFeaturedChips } from "./CategoryFeaturedChips";
import { pickFeaturedPOIs } from "@/lib/board/featured-pois";
import { useBoard } from "./board-state";

const FEATURED_CHIP_COUNT = 5;

const ReportCuratedGrounded = dynamic(() => import("../ReportCuratedGrounded"));
const ReportGroundingInline = dynamic(() => import("../ReportGroundingInline"));
const ReportGroundingChips = dynamic(() => import("../ReportGroundingChips"));

interface Props {
  category: BoardCategory;
  /** Hele prosjektets POI-lookup — brukes av grounding-rendering for å resolve [text](poi:uuid)-lenker. */
  poisById: Map<string, POI>;
  /** next/image sizes-attribute. Mobile (full-bredde modal) vs desktop-panel (400px) trenger ulike hint. */
  imageSizes?: string;
}

/**
 * Info-tab i kategori-detalj. Speiler rapport-mønsteret:
 * - Lead + body alltid synlig, med inline POI-popovers (linkPOIsInText)
 * - "Les mer om {label}" reveal grounding-narrativen + Google-chips
 *
 * Rendres av BoardDetailPanel (desktop) og BoardMobileSheet (mobile).
 */
export function BoardCategoryInfoTab({
  category,
  poisById,
  imageSizes = "(min-width: 1024px) 400px, 100vw",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { dispatch } = useBoard();
  const rawPois = category.pois.map((p) => p.raw);
  const featuredPois = useMemo(
    () => pickFeaturedPOIs(category.pois, FEATURED_CHIP_COUNT, category.id),
    [category.pois, category.id],
  );

  // Karaoke-aktiv = dette sporet spilles (eller pauset). Audio-manus blir den
  // synlige body-teksten (en og samme tekst, karaoke-effekt på når audio kjører,
  // plain ellers). Lead/body brukes kun som fallback når manus mangler.
  const phase = useAudioTourPhase();
  const currentTrack = useCurrentTrack();
  const isAudioActive =
    (phase === "playing" || phase === "paused") &&
    currentTrack?.categoryId === category.id;
  const karaokeText = category.audio?.manus;
  const karaokeTimings = category.audio?.timings;

  const leadSegments =
    !karaokeText && category.lead
      ? linkPOIsInText(category.lead, rawPois)
      : [];
  const bodyParagraphs =
    !karaokeText && category.body
      ? category.body.split(/\n+/).filter((p) => p.trim().length > 0)
      : [];

  const grounding = category.grounding;

  return (
    <div className="space-y-4">
      {category.illustration && (
        <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-stone-200">
          <Image
            src={category.illustration.src}
            alt=""
            fill
            sizes={imageSizes}
            className="object-cover"
          />
        </div>
      )}

      {karaokeText && (
        <KaraokePitchText
          text={karaokeText}
          timings={karaokeTimings}
          isActive={isAudioActive}
          className="text-base leading-relaxed text-stone-700"
        />
      )}

      {leadSegments.length > 0 && (
        <p
          data-board-body
          className="text-base leading-relaxed text-stone-700"
        >
          <LinkedSegments segments={leadSegments} />
        </p>
      )}

      {bodyParagraphs.length > 0 && (
        <div data-board-body className="space-y-3 text-stone-800">
          {bodyParagraphs.map((para, i) => (
            <p key={i} className="text-[15px] leading-relaxed">
              <LinkedSegments segments={linkPOIsInText(para, rawPois)} />
            </p>
          ))}
        </div>
      )}

      {featuredPois.length > 0 && (
        <CategoryFeaturedChips
          pois={featuredPois}
          category={category}
          onChipClick={(poi) =>
            dispatch({
              type: "OPEN_POI",
              id: poi.id,
              categoryId: category.id,
            })
          }
        />
      )}

      {grounding && (
        <>
          {!expanded && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                aria-expanded={false}
              >
                Les mer om {category.label}
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}

          <div
            className="grid transition-[grid-template-rows] duration-500 ease-in-out"
            style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
            aria-hidden={!expanded}
          >
            <div className="overflow-hidden">
              <div className="space-y-4 pt-2">
                {grounding.groundingVersion === 2 ? (
                  <ReportCuratedGrounded
                    grounding={grounding}
                    poisById={poisById}
                    variant="compact"
                  />
                ) : (
                  <ReportGroundingInline
                    grounding={grounding}
                    variant="compact"
                  />
                )}
                <ReportGroundingChips grounding={grounding} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LinkedSegments({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "poi" && seg.poi) {
          return <POIPopover key={i} poi={seg.poi} label={seg.content} />;
        }
        if (seg.type === "external" && seg.url) {
          return (
            <a
              key={i}
              href={seg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-stone-900 underline decoration-stone-300 decoration-2 underline-offset-2 transition-colors hover:decoration-stone-500"
            >
              {seg.content}
            </a>
          );
        }
        return <span key={i}>{seg.content}</span>;
      })}
    </>
  );
}
