"use client";

import { useState, useCallback } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

interface SaveButtonProps {
  poiId: string;
  poiName: string;
  className?: string;
}

/**
 * Client-side bookmark button for "Min samling" (My Collection).
 * Uses localStorage for now — can be upgraded to Supabase auth later.
 */
export default function SaveButton({ poiId, poiName, className = "" }: SaveButtonProps) {
  const [saved, setSaved] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const collection = JSON.parse(localStorage.getItem("placy-collection") ?? "[]");
      return collection.includes(poiId);
    } catch {
      return false;
    }
  });

  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const collection: string[] = JSON.parse(
          localStorage.getItem("placy-collection") ?? "[]"
        );

        if (saved) {
          const updated = collection.filter((id) => id !== poiId);
          localStorage.setItem("placy-collection", JSON.stringify(updated));
          setSaved(false);
        } else {
          collection.push(poiId);
          localStorage.setItem("placy-collection", JSON.stringify(collection));
          setSaved(true);
        }

        // Dispatch custom event for CollectionBar to listen to
        window.dispatchEvent(new CustomEvent("placy-collection-change"));
      } catch {
        // localStorage unavailable — fail silently
      }
    },
    [poiId, saved]
  );

  const Icon = saved ? BookmarkCheck : Bookmark;

  return (
    <button
      onClick={toggle}
      aria-label={saved ? `Fjern ${poiName} fra samling` : `Lagre ${poiName} til samling`}
      title={saved ? "Fjern fra samling" : "Lagre til samling"}
      className={`p-1.5 rounded-full transition-all ${
        saved
          ? "text-[#b45309] bg-[#fef3c7]"
          : "text-[#a0937d] hover:text-[#1a1a1a] hover:bg-white/80"
      } ${className}`}
    >
      <Icon className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
    </button>
  );
}
