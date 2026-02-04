"use client";

import { cn } from "@/lib/utils";

interface SkeletonReportMapProps {
  className?: string;
}

export function SkeletonReportMap({ className }: SkeletonReportMapProps) {
  return (
    <div
      className={cn(
        "w-full h-full bg-[#f5f3f0] flex items-center justify-center",
        className
      )}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3">
        {/* Map pin icon placeholder */}
        <div className="w-12 h-12 rounded-full skeleton-shimmer" />
        <div className="h-3 w-24 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
