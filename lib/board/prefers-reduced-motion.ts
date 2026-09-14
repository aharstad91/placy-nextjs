/**
 * Leser `prefers-reduced-motion: reduce` synkront ved render (2026-09-15).
 *
 * Markørene setter stilene sine inline, så Tailwinds `motion-reduce:`-variant
 * er ikke tilgjengelig der. En hook per markør ville dessuten vært én
 * `matchMedia`-lytter til i et sett på rundt tusen; et enkelt oppslag ved
 * render er nok — innstillingen endres praktisk talt aldri mens siden er
 * åpen, og neste render leser den uansett på nytt.
 *
 * Trygg på server: uten `window` svarer den false, som er det samme som
 * «ingen preferanse».
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
