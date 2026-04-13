"use client";

import { useCallback } from "react";

/**
 * Scroll reveal hook — attaches reveal animation to elements.
 * Uses IntersectionObserver for below-fold elements.
 * Elements in viewport at mount are revealed immediately.
 */
export function useScrollReveal() {
  const revealRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;

    // Reduced motion: no animation
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Set initial hidden state
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";

    const reveal = () => {
      el.style.transition = "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transitionDelay = el.style.getPropertyValue("--story-delay") || "0ms";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    };

    // Check if element is in or near viewport
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 100) {
      // In viewport — reveal after double-rAF for smooth animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          reveal();
        });
      });
      return;
    }

    // Below viewport — observe
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px 100px 0px" },
    );
    observer.observe(el);
  }, []);

  return revealRef;
}
