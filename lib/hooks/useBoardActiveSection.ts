"use client";

import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
import { useDebouncedCallback } from "use-debounce";

/**
 * Scroll-tracking hook scoped to a container element (the board scroll panel),
 * not the viewport. Mirrors useActiveSection's observer shape — see that file
 * for the intersectionRect.height arbitration rationale — but accepts a `root`
 * via ref so IntersectionObserver only fires for the panel's own scroll axis.
 *
 * Returns activeSectionId + a memoized ref callback factory. Each section
 * element must set its DOM `id` to match the registered key so observer can
 * resolve entries via `entry.target.id`.
 */
export function useBoardActiveSection(
  rootRef: RefObject<HTMLElement | null>,
  initialSectionId: string | null,
) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [refCount, setRefCount] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const debouncedSet = useDebouncedCallback(setActiveSectionId, 200, {
    leading: true,
    trailing: true,
  });

  const refCallbackCache = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map());

  const registerSectionRef = useCallback((sectionId: string) => {
    if (!refCallbackCache.current.has(sectionId)) {
      refCallbackCache.current.set(sectionId, (el: HTMLElement | null) => {
        if (el) {
          const hadKey = sectionRefs.current.has(sectionId);
          sectionRefs.current.set(sectionId, el);
          if (!hadKey) setRefCount((c) => c + 1);
        } else if (sectionRefs.current.has(sectionId)) {
          sectionRefs.current.delete(sectionId);
          setRefCount((c) => c - 1);
        }
      });
    }
    return refCallbackCache.current.get(sectionId)!;
  }, []);

  useEffect(() => {
    if (sectionRefs.current.size === 0) return;
    const root = rootRef.current;
    if (!root) return;

    observerRef.current?.disconnect();

    const entries = new Map<string, IntersectionObserverEntry>();

    observerRef.current = new IntersectionObserver(
      (observerEntries) => {
        for (const entry of observerEntries) {
          entries.set(entry.target.id, entry);
        }

        let bestId: string | null = null;
        let bestHeight = 0;

        for (const [id, entry] of Array.from(entries.entries())) {
          const visibleHeight = entry.intersectionRect.height;
          if (visibleHeight > bestHeight) {
            bestHeight = visibleHeight;
            bestId = id;
          }
        }

        if (bestId) {
          debouncedSet(bestId);
        }
      },
      {
        root,
        threshold: [0, 0.5, 1.0],
      },
    );

    for (const el of Array.from(sectionRefs.current.values())) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [refCount, debouncedSet, rootRef]);

  return { activeSectionId, registerSectionRef };
}
