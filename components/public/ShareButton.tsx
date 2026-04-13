"use client";

import { Share2, Check, AlertCircle } from "lucide-react";
import { useCopyShare } from "@/components/variants/report/summary/hooks/useCopyShare";

interface ShareButtonProps {
  /** Tittel sendt til share-sheet. Fallback: "Del rapport". */
  title?: string;
  /** Valgfri className for å overstyre default-styling. */
  className?: string;
}

/**
 * Del-knapp for rapport-header.
 *
 * - Native share sheet på mobile (iOS Safari, Android Chrome)
 * - Clipboard copy på desktop, med execCommand-fallback
 * - Inline ikon-swap (Share2 → Check) som bekreftelse
 * - Persistent `role="status"` sr-only region for screen readers
 * - Disabled under 2s cooldown for å unngå rapid-click timer-race
 */
export default function ShareButton({
  title = "Del rapport",
  className = "",
}: ShareButtonProps) {
  const { share, copied, error } = useCopyShare();

  const handleClick = () => {
    if (copied) return; // cooldown
    share({ title });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={copied}
        aria-label={copied ? "Lenke kopiert" : "Del rapport"}
        className={`inline-flex items-center gap-1.5 text-sm font-medium opacity-90 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-primary disabled:cursor-default rounded-md px-2 py-1 ${className}`}
      >
        {error ? (
          <>
            <AlertCircle size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Kunne ikke dele</span>
          </>
        ) : copied ? (
          <>
            <Check size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Kopiert</span>
          </>
        ) : (
          <>
            <Share2 size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Del</span>
          </>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Lenke kopiert til utklippstavlen" : ""}
      </span>
    </>
  );
}
