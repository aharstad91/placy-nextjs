"use client";

import { cn } from "@/lib/utils";
import { Compass } from "lucide-react";

interface KompassTabsProps {
  activeTab: "kompass" | "all";
  onTabChange: (tab: "kompass" | "all") => void;
  kompassCount: number;
  allCount: number;
}

export default function KompassTabs({
  activeTab,
  onTabChange,
  kompassCount,
  allCount,
}: KompassTabsProps) {
  return (
    <div className="flex-shrink-0 flex border-b border-gray-200">
      <button
        onClick={() => onTabChange("kompass")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative",
          activeTab === "kompass"
            ? "text-gray-900"
            : "text-gray-400 hover:text-gray-600"
        )}
      >
        <Compass className="w-4 h-4" />
        <span>Kompass</span>
        <span className={cn(
          "text-xs tabular-nums",
          activeTab === "kompass" ? "text-gray-500" : "text-gray-300"
        )}>
          ({kompassCount})
        </span>
        {activeTab === "kompass" && (
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full" />
        )}
      </button>

      <button
        onClick={() => onTabChange("all")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative",
          activeTab === "all"
            ? "text-gray-900"
            : "text-gray-400 hover:text-gray-600"
        )}
      >
        <span>Alle events</span>
        <span className={cn(
          "text-xs tabular-nums",
          activeTab === "all" ? "text-gray-500" : "text-gray-300"
        )}>
          ({allCount})
        </span>
        {activeTab === "all" && (
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full" />
        )}
      </button>
    </div>
  );
}
