"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";

/**
 * Tracks which theme section is most visible in the viewport using IntersectionObserver.
 *
 * Uses `intersectionRect.height` (pixels visible) for arbitration instead of
 * `intersectionRatio` — tall sections never reach high ratios, so ratio-based
 * comparison would incorrectly favor short sections.
 *
 * Debounce uses `leading: true` for immediate response on first crossing.
 */
export function useActiveSection(initialThemeId: string | null) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialThemeId);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [refCount, setRefCount] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const debouncedSet = useDebouncedCallback(setActiveSectionId, 200, {
    leading: true,
    trailing: true,
  });

  // Callback ref factory — call registerSectionRef(themeId) to get a ref callback.
  // Increments refCount to signal the observer effect to (re)initialize.
  const refCallbackCache = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map());

  const registerSectionRef = useCallback(
    (themeId: string) => {
      if (!refCallbackCache.current.has(themeId)) {
        refCallbackCache.current.set(themeId, (el: HTMLElement | null) => {
          if (el) {
            const hadKey = sectionRefs.current.has(themeId);
            sectionRefs.current.set(themeId, el);
            if (!hadKey) setRefCount((c) => c + 1);
          } else {
            if (sectionRefs.current.has(themeId)) {
              sectionRefs.current.delete(themeId);
              setRefCount((c) => c - 1);
            }
          }
        });
      }
      return refCallbackCache.current.get(themeId)!;
    },
    []
  );

  // Set up IntersectionObserver when sections are mounted (refCount > 0)
  useEffect(() => {
    if (sectionRefs.current.size === 0) return;

    // Disconnect previous observer before creating new one
    observerRef.current?.disconnect();

    const entries = new Map<string, IntersectionObserverEntry>();

    observerRef.current = new IntersectionObserver(
      (observerEntries) => {
        for (const entry of observerEntries) {
          entries.set(entry.target.id, entry);
        }

        // Find section with most visible pixels (not ratio)
        let bestId: string | null = null;
        let bestHeight = 0;

        Array.from(entries.entries()).forEach(([id, entry]) => {
          const visibleHeight = entry.intersectionRect.height;
          if (visibleHeight > bestHeight) {
            bestHeight = visibleHeight;
            bestId = id;
          }
        });

        if (bestId) {
          debouncedSet(bestId);
        }
      },
      { threshold: [0, 0.5, 1.0] }
    );

    Array.from(sectionRefs.current.values()).forEach((el) => {
      observerRef.current!.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [refCount, debouncedSet]);

  return { activeSectionId, registerSectionRef };
}
