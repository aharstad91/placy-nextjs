import Link from "next/link";
import type { POI } from "@/lib/types";
import { Star } from "lucide-react";

interface ReportHighlightCardProps {
  poi: POI;
  explorerBaseUrl?: string | null;
  themeCategories?: string[];
  /** When provided, card becomes interactive (click to select) instead of a navigation link */
  onClick?: () => void;
  /** Shows highlight state when card is selected */
  isActive?: boolean;
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
  onClick,
  isActive,
}: ReportHighlightCardProps) {
  const explorerUrl = explorerBaseUrl
    ? buildExplorerUrl(explorerBaseUrl, poi.id, themeCategories)
    : null;

  // Category initial (first letter)
  const categoryInitial = poi.category.name.charAt(0).toUpperCase();

  // When onClick is provided, card is interactive (clickable div)
  // Otherwise, card navigates to Explorer or Google Maps
  const CardWrapper = onClick
    ? ({ children, className }: { children: React.ReactNode; className: string }) => (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => e.key === "Enter" && onClick()}
          className={className}
        >
          {children}
        </div>
      )
    : explorerUrl
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
    <CardWrapper
      className={`group flex items-stretch bg-white rounded-lg overflow-hidden transition-all cursor-pointer ${
        isActive
          ? "shadow-md ring-2"
          : "border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm"
      }`}
      style={isActive ? { ringColor: poi.category.color } as React.CSSProperties : undefined}
    >
      {/* Left color bar + category initial */}
      <div
        className="flex-shrink-0 w-12 flex flex-col items-center justify-center gap-1"
        style={{ backgroundColor: poi.category.color + "12" }}
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold text-white"
          style={{ backgroundColor: poi.category.color }}
        >
          {categoryInitial}
        </span>
        <span className="text-[10px] font-medium text-[#6a6a6a] text-center leading-tight px-1">
          {poi.category.name}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        {/* Top row: Name + Rating */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <h4 className="font-semibold text-[#1a1a1a] leading-snug truncate">
            {poi.name}
          </h4>

          {/* Rating - more prominent */}
          {poi.googleRating != null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="w-4 h-4 text-[#b45309] fill-[#b45309]" />
              <span className="text-sm font-semibold text-[#1a1a1a]">
                {poi.googleRating.toFixed(1)}
              </span>
              {poi.googleReviewCount != null && (
                <span className="text-xs text-[#8a8a8a]">
                  ({poi.googleReviewCount.toLocaleString("nb-NO")})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Editorial hook - main content */}
        {poi.editorialHook && (
          <p className="text-sm text-[#5a5a5a] leading-relaxed line-clamp-2">
            {poi.editorialHook}
          </p>
        )}

        {/* Explorer link - visible on hover */}
        {explorerUrl && (
          <Link
            href={explorerUrl}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[#7a7062] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#5a5042]"
          >
            Åpne i Explorer
          </Link>
        )}
      </div>
    </CardWrapper>
  );
}
