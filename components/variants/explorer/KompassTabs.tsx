"use client";

import { cn } from "@/lib/utils";
import { Compass } from "lucide-react";

interface KompassTabsProps {
  activeTab: "kompass" | "all";
  onTabChange: (tab: "kompass" | "all") => void;
  kompassCount: number;
  allCount: number;
  kompassCompleted: boolean;
}

function Tab({
  label,
  count,
  icon,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors relative",
        isActive
          ? "text-gray-900"
          : "text-gray-400 hover:text-gray-600"
      )}
    >
      {icon}
      <span>{label}</span>
      <span className={cn(
        "text-xs tabular-nums",
        isActive ? "text-gray-500" : "text-gray-300"
      )}>
        ({count})
      </span>
      {isActive && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full" />
      )}
    </button>
  );
}

export default function KompassTabs({
  activeTab,
  onTabChange,
  kompassCount,
  allCount,
  kompassCompleted,
}: KompassTabsProps) {
  const kompassTab = (
    <Tab
      key="kompass"
      label="Kompass"
      count={kompassCount}
      icon={<Compass className="w-4 h-4" />}
      isActive={activeTab === "kompass"}
      onClick={() => onTabChange("kompass")}
    />
  );

  const allTab = (
    <Tab
      key="all"
      label="Alle events"
      count={allCount}
      isActive={activeTab === "all"}
      onClick={() => onTabChange("all")}
    />
  );

  // If Kompass was completed, Kompass tab goes first. Otherwise, Alle events first.
  const tabs = kompassCompleted ? [kompassTab, allTab] : [allTab, kompassTab];

  return (
    <div className="flex-shrink-0 flex border-b border-gray-200">
      {tabs}
    </div>
  );
}
