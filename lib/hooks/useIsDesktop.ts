"use client";

import { useState, useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Returns true when the viewport matches the `lg` Tailwind breakpoint (≥1024px).
 * SSR-safe: defaults to false (mobile-first) during hydration.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    setIsDesktop(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
