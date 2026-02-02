import Link from "next/link";
import type { POI } from "@/lib/types";
import { Star, MapPin, ExternalLink } from "lucide-react";

interface ReportHighlightCardProps {
  poi: POI;
  explorerBaseUrl?: string | null;
  themeCategories?: string[];
}

function buildExplorerUrl(
  baseUrl: string,
  poiId: string,
  categories?: string[]
): string {
  const params = new URLSearchParams();
  params.set("poi", poiId);
  if (categories && categories.length > 0) {
    params.set("categories", categories.join(","));
  }
  return `${baseUrl}?${params.toString()}`;
}

export default function ReportHighlightCard({
  poi,
  explorerBaseUrl,
  themeCategories,
}: ReportHighlightCardProps) {
  const hasImage = poi.photoReference;
  const imageUrl = hasImage
    ? `/api/places/photo?reference=${poi.photoReference}&maxwidth=400`
    : null;

  const walkMinutes = poi.travelTime?.walk
    ? Math.round(poi.travelTime.walk / 60)
    : null;

  const explorerUrl = explorerBaseUrl
    ? buildExplorerUrl(explorerBaseUrl, poi.id, themeCategories)
    : null;

  const CardWrapper = explorerUrl
    ? ({ children, className }: { children: React.ReactNode; className: string }) => (
        <Link href={explorerUrl} className={className}>
          {children}
        </Link>
      )
    : ({ children, className }: { children: React.ReactNode; className: string }) => (
        <a href={poi.googleMapsUrl ?? "#"} target="_blank" rel="noopener noreferrer" className={className}>
          {children}
        </a>
      );

  return (
    <CardWrapper className="group block bg-white rounded-xl shadow-sm border border-[#eae6e1] overflow-hidden hover:shadow-md transition-shadow">
      {/* Image or fallback */}
      <div className="relative h-40 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={poi.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center relative overflow-hidden"
            style={{ backgroundColor: poi.category.color + "10" }}
          >
            <div
              className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.07]"
              style={{ backgroundColor: poi.category.color }}
            />
            <div
              className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full opacity-[0.05]"
              style={{ backgroundColor: poi.category.color }}
            />
            <span
              className="text-5xl font-bold opacity-[0.12]"
              style={{ color: poi.category.color }}
            >
              {poi.category.name.charAt(0)}
            </span>
          </div>
        )}
        {/* Category badge */}
        <span className="absolute top-3 left-3 text-xs font-medium bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[#4a4a4a]">
          {poi.category.name}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Name + external links */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-[#1a1a1a] leading-snug">
            {poi.name}
          </h4>
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            {/* Google Maps secondary link */}
            {explorerUrl && poi.googleMapsUrl && (
              <a
                href={poi.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                title="Åpne i Google Maps"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#a0937d] hover:text-[#7a7062]" />
              </a>
            )}
            {/* Show external link icon when no explorer (original behavior) */}
            {!explorerUrl && (
              <ExternalLink className="w-3.5 h-3.5 text-[#a0937d] opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        {/* Rating */}
        {poi.googleRating != null && (
          <div className="flex items-center gap-1.5 mb-2">
            <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
            <span className="text-sm font-medium text-[#1a1a1a]">
              {poi.googleRating.toFixed(1)}
            </span>
            {poi.googleReviewCount != null && (
              <span className="text-sm text-[#8a8a8a]">
                ({poi.googleReviewCount.toLocaleString("nb-NO")})
              </span>
            )}
          </div>
        )}

        {/* Editorial hook */}
        {poi.editorialHook && (
          <p className="text-sm text-[#5a5a5a] leading-relaxed italic border-l-2 border-[#e8e4df] pl-3 mb-2">
            {poi.editorialHook}
          </p>
        )}

        {/* Walking distance */}
        {walkMinutes != null && (
          <div className="flex items-center gap-1 text-xs text-[#8a8a8a]">
            <MapPin className="w-3 h-3" />
            <span>{walkMinutes} min å gå</span>
          </div>
        )}
      </div>
    </CardWrapper>
  );
}
