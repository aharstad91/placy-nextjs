"use client";

import { useCallback, useRef, useEffect } from "react";

/**
 * Shared one-shot scroll reveal using a single IntersectionObserver.
 * - One observer for all targets (not per-element)
 * - One-shot: observe → add "revealed" class → unobserve
 * - Fast-scroll fallback: reveal if element was scrolled past
 * - prefers-reduced-motion: instant reveal
 * - Cleanup: disconnect on unmount
 */

const OBSERVER_OPTIONS: IntersectionObserverInit = {
  threshold: 0.05,
  rootMargin: "0px 0px -60px 0px",
};

export function useScrollReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetsRef = useRef<Set<Element>>(new Set());

  // Create shared observer lazily
  const getObserver = useCallback(() => {
    if (observerRef.current) return observerRef.current;

    // Check reduced motion preference
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    observerRef.current = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target;

        // Reveal if intersecting OR if scrolled past (fast-scroll fallback)
        if (
          entry.isIntersecting ||
          (entry.rootBounds && entry.boundingClientRect.bottom < entry.rootBounds.bottom)
        ) {
          el.classList.add("revealed");
          observerRef.current?.unobserve(el);
          targetsRef.current.delete(el);
        }
      }
    }, OBSERVER_OPTIONS);

    return observerRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      targetsRef.current.clear();
    };
  }, []);

  // Callback ref for each block element
  const revealRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;

      // Reduced motion: reveal immediately
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        el.classList.add("revealed");
        return;
      }

      const obs = getObserver();
      targetsRef.current.add(el);
      obs.observe(el);
    },
    [getObserver],
  );

  return revealRef;
}
