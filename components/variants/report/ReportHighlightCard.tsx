"use client";

import { useState } from "react";
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
  const [imgError, setImgError] = useState(false);

  const explorerUrl = explorerBaseUrl
    ? buildExplorerUrl(explorerBaseUrl, poi.id, themeCategories)
    : null;

  const imageUrl = imgError ? null : (poi.featuredImage ?? null);

  const CardWrapper = onClick
    ? ({ children, className, style }: { children: React.ReactNode; className: string; style?: React.CSSProperties }) => (
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => e.key === "Enter" && onClick()}
          className={className}
          style={style}
        >
          {children}
        </div>
      )
    : explorerUrl
      ? ({ children, className, style }: { children: React.ReactNode; className: string; style?: React.CSSProperties }) => (
          <Link href={explorerUrl} className={className} style={style}>
            {children}
          </Link>
        )
      : ({ children, className, style }: { children: React.ReactNode; className: string; style?: React.CSSProperties }) => (
          <a href={poi.googleMapsUrl ?? "#"} target="_blank" rel="noopener noreferrer" className={className} style={style}>
            {children}
          </a>
        );

  return (
    <CardWrapper
      className={`group block bg-white rounded-lg overflow-hidden transition-all cursor-pointer ${
        isActive
          ? "shadow-md ring-2"
          : "border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm"
      }`}
      style={isActive ? { "--tw-ring-color": poi.category.color } as React.CSSProperties : undefined}
    >
      {/* Featured image */}
      {imageUrl && (
        <div className="w-full aspect-[16/9] bg-[#f5f3f0] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={poi.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="p-3">
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
      </div>
    </CardWrapper>
  );
}
