/**
 * Confetti celebration utility for guide completion
 *
 * Uses canvas-confetti for lightweight celebration effects.
 * Respects prefers-reduced-motion for accessibility.
 */

import confetti from "canvas-confetti";

// Detect low-end device for performance optimization
function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const concurrency = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;

  return concurrency <= 2 || memory <= 2;
}

/**
 * Trigger celebration confetti animation
 *
 * Dual burst from sides, gold + accent colors, 3 second duration.
 * Automatically respects prefers-reduced-motion.
 */
export function celebrateCompletion(): Promise<void> {
  // Respect reduced motion preference
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return Promise.resolve();
  }

  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ["#d4af37", "#fbbf24", "#34d399", "#60a5fa"]; // Gold + accent colors

  // Adjust particle count for device capability
  const baseParticleCount = isLowEndDevice() ? 2 : 3;

  return new Promise<void>((resolve) => {
    const frame = () => {
      if (Date.now() > end) {
        resolve();
        return;
      }

      // Dual burst from sides - better visual than single burst
      confetti({
        particleCount: baseParticleCount,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors,
        disableForReducedMotion: true,
      });

      confetti({
        particleCount: baseParticleCount,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors,
        disableForReducedMotion: true,
      });

      requestAnimationFrame(frame);
    };

    frame();
  });
}

/**
 * Single burst confetti - for less prominent celebrations
 */
export function celebrateBurst(): void {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const particleCount = isLowEndDevice() ? 30 : 50;

  confetti({
    particleCount,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#d4af37", "#fbbf24", "#34d399"],
    disableForReducedMotion: true,
  });
}

/**
 * CRITICAL: Call this on component unmount to cleanup
 */
export function stopConfetti(): void {
  confetti.reset();
}
