"use client";

import { Check, Share2 } from "lucide-react";
import { useCopyShare } from "./hooks/useCopyShare";

interface ShareActionProps {
  shareTitle?: string;
}

function track(event: string) {
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    window.plausible(event);
  }
}

export default function ShareAction({ shareTitle }: ShareActionProps) {
  const { share, copied } = useCopyShare();

  const handleClick = () => {
    track("cta_share_click");
    share({ title: shareTitle });
  };

  return (
    <div className="absolute top-0 right-0">
      <button
        type="button"
        onClick={handleClick}
        disabled={copied}
        aria-label="Del rapporten"
        className="inline-flex items-center justify-center w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-80"
      >
        {copied ? (
          <Check className="w-5 h-5" aria-hidden="true" />
        ) : (
          <Share2 className="w-5 h-5" aria-hidden="true" />
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Lenke kopiert" : ""}
      </span>
    </div>
  );
}
