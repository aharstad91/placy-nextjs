"use client";

import { SkeletonPOICard } from "./SkeletonPOICard";

interface SkeletonPOIListProps {
  count?: number;
  variant?: "desktop" | "mobile";
}

export function SkeletonPOIList({
  count = 5,
  variant = "desktop",
}: SkeletonPOIListProps) {
  const spacing =
    variant === "mobile" ? "space-y-2 p-4" : "space-y-2.5 px-8 py-4";

  return (
    <div
      className={spacing}
      role="status"
      aria-busy="true"
      aria-label="Laster steder"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 overflow-hidden"
        >
          <SkeletonPOICard />
        </div>
      ))}
    </div>
  );
}
