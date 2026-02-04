"use client";

export function SkeletonMapOverlay() {
  return (
    <div
      className="absolute inset-0 bg-white/85 z-10 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full skeleton-shimmer" />
        <div className="h-3 w-24 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
