import type { POI, Coordinates } from "@/lib/types";
import type { ChapterContent, NarrativeBlock } from "./portrait-content";
import PortraitPOIInline from "./PortraitPOIInline";
import PortraitContextMap from "./PortraitContextMap";

interface PortraitChapterProps {
  chapter: ChapterContent;
  poiMap: Map<string, POI>;
  projectCenter: Coordinates;
  isLast: boolean;
}

export default function PortraitChapter({
  chapter,
  poiMap,
  projectCenter,
  isLast,
}: PortraitChapterProps) {
  // Collect all POIs referenced in this chapter for the map
  const chapterPois: POI[] = chapter.blocks
    .filter((b): b is Extract<NarrativeBlock, { type: "poi" }> => b.type === "poi")
    .map((b) => poiMap.get(b.poiId))
    .filter((p): p is POI => p !== undefined);

  return (
    <section className={`py-20 md:py-28 ${!isLast ? "border-b border-[#e8e4df]" : ""}`}>
      <div className="max-w-prose mx-auto px-6">
        {/* Chapter label */}
        <div className="text-xs uppercase tracking-[0.25em] text-[#9a8e80] mb-4">
          {chapter.label}
        </div>

        {/* Chapter title */}
        <h2
          className="text-3xl md:text-4xl text-[#1a1a1a] leading-tight mb-10 md:mb-14"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {chapter.title}
        </h2>

        {/* Narrative blocks */}
        {chapter.blocks.map((block, i) => {
          if (block.type === "prose") {
            return (
              <p
                key={i}
                className="text-lg md:text-xl text-[#3d3d3d] leading-[1.8] mb-8"
              >
                {block.text}
              </p>
            );
          }

          if (block.type === "poi") {
            const poi = poiMap.get(block.poiId);
            if (!poi) return null;
            return (
              <PortraitPOIInline
                key={i}
                poi={poi}
                mode={block.mode}
                narrative={block.narrative}
              />
            );
          }

          if (block.type === "map") {
            return (
              <PortraitContextMap
                key={i}
                pois={chapterPois}
                center={projectCenter}
              />
            );
          }

          return null;
        })}
      </div>
    </section>
  );
}
