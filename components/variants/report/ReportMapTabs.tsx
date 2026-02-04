"use client";

import { List, Map } from "lucide-react";

interface ReportMapTabsProps {
  activeTab: "list" | "map";
  onTabChange: (tab: "list" | "map") => void;
}

export default function ReportMapTabs({
  activeTab,
  onTabChange,
}: ReportMapTabsProps) {
  return (
    <div className="flex border-b border-[#eae6e1]">
      <button
        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
          activeTab === "list"
            ? "text-[#1a1a1a] border-b-2 border-[#1a1a1a]"
            : "text-[#8a8a8a] hover:text-[#5a5a5a]"
        }`}
        onClick={() => onTabChange("list")}
      >
        <List className="w-4 h-4" />
        Liste
      </button>
      <button
        className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
          activeTab === "map"
            ? "text-[#1a1a1a] border-b-2 border-[#1a1a1a]"
            : "text-[#8a8a8a] hover:text-[#5a5a5a]"
        }`}
        onClick={() => onTabChange("map")}
      >
        <Map className="w-4 h-4" />
        Kart
      </button>
    </div>
  );
}
