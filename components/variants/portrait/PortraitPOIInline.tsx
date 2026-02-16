import type { POI } from "@/lib/types";
import { Star, MapPin } from "lucide-react";

interface PortraitPOIInlineProps {
  poi: POI;
  mode: "feature" | "woven";
  /** For woven mode: the narrative text that mentions this POI */
  narrative?: string;
}

export default function PortraitPOIInline({
  poi,
  mode,
  narrative,
}: PortraitPOIInlineProps) {
  const googleUrl = poi.googleMapsUrl;

  if (mode === "woven") {
    const text = narrative || poi.editorialHook || poi.name;
    // Bold the POI name within the narrative text (case-insensitive match)
    // Try full name first, then name before comma (e.g. "Hevd Bakery, Adressahuset" → "Hevd Bakery")
    const namesToTry = [poi.name];
    if (poi.name.includes(",")) namesToTry.push(poi.name.split(",")[0].trim());
    if (poi.name.includes("(")) namesToTry.push(poi.name.split("(")[0].trim());
    let matchedNameStr = "";
    let nameIndex = -1;
    for (const candidate of namesToTry) {
      const idx = text.toLowerCase().indexOf(candidate.toLowerCase());
      if (idx !== -1) {
        nameIndex = idx;
        matchedNameStr = candidate;
        break;
      }
    }
    const renderText = () => {
      if (nameIndex === -1) {
        return <>{text}</>;
      }
      const before = text.slice(0, nameIndex);
      const matchedName = text.slice(nameIndex, nameIndex + matchedNameStr.length);
      const after = text.slice(nameIndex + matchedNameStr.length);
      const nameEl = googleUrl ? (
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[#1a1a1a] hover:text-[#8b6914] transition-colors"
        >
          {matchedName}
        </a>
      ) : (
        <strong className="text-[#1a1a1a]">{matchedName}</strong>
      );
      return (
        <>
          {before}
          {nameEl}
          {after}
        </>
      );
    };

    return (
      <p className="text-lg md:text-xl text-[#3d3d3d] leading-[1.8] mb-8">
        {renderText()}
      </p>
    );
  }

  // Feature block mode
  return (
    <figure className="my-12 md:my-16">
      {/* Image or gradient */}
      <div className="aspect-[16/9] rounded-lg overflow-hidden mb-5 bg-gradient-to-br from-[#e8e4df] to-[#d4cec6]">
        {poi.featuredImage ? (
          <img
            src={poi.featuredImage}
            alt={poi.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-end p-6">
            <div
              className="text-xs uppercase tracking-[0.2em] font-medium"
              style={{ color: poi.category.color }}
            >
              {poi.category.name}
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      <figcaption>
        <div className="text-xs uppercase tracking-[0.2em] text-[#9a8e80] mb-2">
          {poi.category.name}
        </div>
        <h3
          className="text-xl md:text-2xl text-[#1a1a1a] mb-2"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {googleUrl ? (
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#8b6914] transition-colors"
            >
              {poi.name}
            </a>
          ) : (
            poi.name
          )}
        </h3>
        {poi.editorialHook && (
          <p className="text-base md:text-lg text-[#5a5a5a] leading-relaxed italic">
            {poi.editorialHook}
          </p>
        )}
        <div className="flex items-center gap-3 mt-3 text-sm text-[#9a8e80]">
          {poi.googleRating && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-[#c9a84c] text-[#c9a84c]" />
              {poi.googleRating}
            </span>
          )}
          {poi.address && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {poi.address}
            </span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}
