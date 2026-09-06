"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import { useTransition, ENTER_DURATION } from "./TransitionProvider";

/**
 * Ruter som eier sin egen overgang. De har en RAMME som skal stå stille —
 * sidepanel, velger, fane-rad — og en fade som ligger over hele treet tar
 * rammen med seg. Da ser hvert klikk ut som at siden lastes på nytt, selv når
 * navigasjonen verken rører nettverket eller bygger panelet om. Disse rutene
 * animerer i stedet bare innholdskolonnen sin, innenfra.
 *
 * Segmentet leses relativt til layouten som monterer denne komponenten
 * (`/eiendom/[customer]/[project]/layout.tsx`), altså «innsikt» mot
 * «rapport-board».
 */
const OWN_TRANSITION_SEGMENTS = new Set(["innsikt"]);

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/** Nullstiller wrapperen til synlig og uanimert. */
function resetVisible(el: HTMLDivElement) {
  el.style.transition = "none";
  el.style.opacity = "";
  el.style.transform = "";
}

export default function PageTransition({
  children,
  className,
}: PageTransitionProps) {
  const { state } = useTransition();
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const skip = segment !== null && OWN_TRANSITION_SEGMENTS.has(segment);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimatedIn = useRef(false);

  // Fade-in on initial mount
  useEffect(() => {
    if (!ref.current || hasAnimatedIn.current) return;
    if (skip) return void resetVisible(ref.current);
    hasAnimatedIn.current = true;

    const el = ref.current;
    el.style.opacity = "0";
    el.style.transform = "translateY(5px)";

    // Trigger reflow then animate
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${ENTER_DURATION}ms ease-out, transform ${ENTER_DURATION}ms ease-out`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";

      // Remove transform after animation so position:fixed children work correctly
      // (any transform on an ancestor creates a new containing block, breaking fixed positioning)
      el.addEventListener("transitionend", () => { el.style.transform = ""; }, { once: true });
    });
  }, [skip]);

  // Fade-in on route change (after exit)
  useEffect(() => {
    if (!ref.current) return;
    /* Kommer man INN på en slik rute fra en vanlig side, har utgangs-effekten
       alt satt opacity 0 på denne wrapperen. Uten denne opprydningen ville
       siden blitt stående blank. */
    if (skip) return void resetVisible(ref.current);
    const el = ref.current;

    // Reset for new page content
    el.style.opacity = "0";
    el.style.transform = "translateY(5px)";
    el.style.transition = "none";

    requestAnimationFrame(() => {
      el.style.transition = `opacity ${ENTER_DURATION}ms ease-out, transform ${ENTER_DURATION}ms ease-out`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";

      el.addEventListener("transitionend", () => { el.style.transform = ""; }, { once: true });
    });
  }, [pathname, skip]);

  // Handle exit animation
  useEffect(() => {
    if (state !== "exiting" || !ref.current || skip) return;
    const el = ref.current;

    el.style.transition = "opacity 120ms ease-in, transform 120ms ease-in";
    el.style.opacity = "0";
    el.style.transform = "translateY(-3px)";
  }, [state, skip]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
