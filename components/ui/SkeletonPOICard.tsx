"use client";

import { cn } from "@/lib/utils";

interface SkeletonPOICardProps {
  className?: string;
}

export function SkeletonPOICard({ className }: SkeletonPOICardProps) {
  return (
    <div
      className={cn("flex items-center gap-3 px-4 py-3", className)}
      aria-hidden="true"
    >
      {/* Thumbnail placeholder */}
      <div className="w-12 h-12 rounded-xl skeleton-shimmer flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Name */}
        <div className="h-4 w-3/4 rounded skeleton-shimmer" />
        {/* Metadata row */}
        <div className="flex gap-2">
          <div className="h-3 w-16 rounded skeleton-shimmer" />
          <div className="h-3 w-12 rounded skeleton-shimmer" />
        </div>
      </div>

      {/* Save button placeholder */}
      <div className="w-16 h-8 rounded-full skeleton-shimmer flex-shrink-0" />
    </div>
  );
}
