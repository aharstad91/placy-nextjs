"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTransition, ENTER_DURATION } from "./TransitionProvider";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export default function PageTransition({
  children,
  className,
}: PageTransitionProps) {
  const { state } = useTransition();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimatedIn = useRef(false);

  // Fade-in on initial mount
  useEffect(() => {
    if (!ref.current || hasAnimatedIn.current) return;
    hasAnimatedIn.current = true;

    const el = ref.current;
    el.style.opacity = "0";
    el.style.transform = "translateY(5px)";

    // Trigger reflow then animate
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${ENTER_DURATION}ms ease-out, transform ${ENTER_DURATION}ms ease-out`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }, []);

  // Fade-in on route change (after exit)
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    // Reset for new page content
    el.style.opacity = "0";
    el.style.transform = "translateY(5px)";
    el.style.transition = "none";

    requestAnimationFrame(() => {
      el.style.transition = `opacity ${ENTER_DURATION}ms ease-out, transform ${ENTER_DURATION}ms ease-out`;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }, [pathname]);

  // Handle exit animation
  useEffect(() => {
    if (state !== "exiting" || !ref.current) return;
    const el = ref.current;

    el.style.transition = "opacity 120ms ease-in, transform 120ms ease-in";
    el.style.opacity = "0";
    el.style.transform = "translateY(-3px)";
  }, [state]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
