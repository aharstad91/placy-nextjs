"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

type TransitionState = "idle" | "exiting" | "entering";

interface TransitionContextValue {
  state: TransitionState;
  navigate: (href: string) => void;
}

const TransitionContext = createContext<TransitionContextValue>({
  state: "idle",
  navigate: () => {},
});

export function useTransition() {
  return useContext(TransitionContext);
}

const EXIT_DURATION = 120; // ms — snappy exit
const ENTER_DURATION = 200; // ms — slightly slower enter

export { EXIT_DURATION, ENTER_DURATION };

interface TransitionProviderProps {
  children: ReactNode;
}

export default function TransitionProvider({
  children,
}: TransitionProviderProps) {
  const [state, setState] = useState<TransitionState>("idle");
  const router = useRouter();
  const pathname = usePathname();
  const isNavigating = useRef(false);

  const navigate = useCallback(
    (href: string) => {
      // Skip if already navigating or same page
      if (isNavigating.current || href === pathname) return;

      isNavigating.current = true;
      setState("exiting");

      // After exit animation completes, navigate
      setTimeout(() => {
        router.push(href);
        setState("entering");

        // Reset after enter animation
        setTimeout(() => {
          setState("idle");
          isNavigating.current = false;
        }, ENTER_DURATION);
      }, EXIT_DURATION);
    },
    [router, pathname]
  );

  // Document-level click handler in CAPTURE phase — fires before Next.js Link
  // Without capture, Link's handler calls router.push() first, skipping our fade-out
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Only handle left clicks without modifiers
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement;

      // Skip if clicking a button/interactive element inside a link (e.g., bookmark buttons)
      if (target.closest("button, [role='button'], input, select, textarea")) return;

      // Find the closest <a> element
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip: external, hash, mailto, tel, admin, target=_blank
      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("/admin") ||
        anchor.target === "_blank"
      ) {
        return;
      }

      // Opt-out: links with data-no-transition skip the animation
      if (anchor.dataset.noTransition !== undefined) return;

      // Capture phase: prevent Link from handling the click
      e.preventDefault();
      e.stopPropagation();
      navigate(href);
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [navigate]);

  return (
    <TransitionContext.Provider value={{ state, navigate }}>
      {children}
    </TransitionContext.Provider>
  );
}
