"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark, X } from "lucide-react";

/**
 * Sticky bottom bar showing "Min samling" count.
 * Appears when user has saved places via SaveButton.
 */
export default function CollectionBar() {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const updateCount = useCallback(() => {
    try {
      const collection = JSON.parse(localStorage.getItem("placy-collection") ?? "[]");
      setCount(collection.length);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    updateCount();
    window.addEventListener("placy-collection-change", updateCount);
    return () => window.removeEventListener("placy-collection-change", updateCount);
  }, [updateCount]);

  if (count === 0 || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1a1a1a] text-white px-4 py-3 shadow-lg">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-[#b45309] fill-[#b45309]" />
          <span className="text-sm font-medium">
            Min samling ({count} {count === 1 ? "sted" : "steder"})
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-[#a0937d] hover:text-white transition-colors"
          aria-label="Lukk"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
