import Link from "next/link";
import type { POI } from "@/lib/types";
import { Star } from "lucide-react";

interface ReportHighlightCardProps {
  poi: POI;
  explorerBaseUrl?: string | null;
  themeCategories?: string[];
  onClick?: () => void;
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
      className={`group block bg-white rounded-lg p-3 transition-all cursor-pointer ${
        isActive
          ? "shadow-md ring-2"
          : "border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm"
      }`}
      style={isActive ? { ringColor: poi.category.color } as React.CSSProperties : undefined}
    >
      {/* Category tag */}
      <span
        className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mb-2"
        style={{
          backgroundColor: poi.category.color + "18",
          color: poi.category.color,
        }}
      >
        {poi.category.name}
      </span>

      {/* Title + Rating row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="font-semibold text-[#1a1a1a] text-sm leading-snug">
          {poi.name}
        </h4>
        {poi.googleRating != null && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
            <span className="text-xs font-semibold text-[#1a1a1a]">
              {poi.googleRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Editorial hook */}
      {poi.editorialHook && (
        <p className="text-xs text-[#6a6a6a] leading-relaxed line-clamp-2">
          {poi.editorialHook}
        </p>
      )}
    </CardWrapper>
  );
}
