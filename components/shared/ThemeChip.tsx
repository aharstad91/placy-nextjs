"use client";

import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/utils/map-icons";
import { ChevronDown, Check } from "lucide-react";

/**
 * Minimal data interface — works with both ThemeDefinition and ReportTheme
 * via duck typing (no coupling to specific types).
 */
export interface ThemeChipData {
  id: string;
  name: string;
  icon: string;
  color: string;
  question?: string; // Pre-resolved by parent with correct locale
  poiCount?: number;
}

interface ThemeChipProps {
  theme: ThemeChipData;
  variant: "scroll" | "select";
  isSelected?: boolean;
  onToggle?: () => void;
  onScrollTo?: () => void;
  className?: string;
}

/**
 * Shared chip component used by ReportHero (scroll variant) and WelcomeScreen (select variant).
 * Shows a question (bold) with theme name as subtitle, plus a scroll arrow or checkbox.
 */
export default function ThemeChip({
  theme,
  variant,
  isSelected,
  onToggle,
  onScrollTo,
  className,
}: ThemeChipProps) {
  const Icon = getIcon(theme.icon);
  const label = theme.question ?? theme.name;

  if (variant === "scroll") {
    return (
      <button
        onClick={onScrollTo}
        className={cn(
          "group flex items-center gap-3 px-4 py-3 rounded-xl border",
          "bg-white border-[#eae6e1] hover:bg-[#faf9f7] hover:border-[#c0b9ad]",
          "transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
          "active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none",
          className,
        )}
      >
        <Icon className="w-5 h-5 text-[#7a7062] flex-shrink-0" aria-hidden="true" />
        <div className="text-left min-w-0">
          <span className="font-semibold text-sm text-[#1a1a1a] whitespace-nowrap">
            {label}
          </span>
          {theme.question && (
            <span className="block text-xs text-[#a0998f]">{theme.name}</span>
          )}
        </div>
        <ChevronDown
          className="w-4 h-4 text-[#a0998f] flex-shrink-0 group-hover:translate-y-0.5 transition-transform motion-reduce:transform-none"
          aria-hidden="true"
        />
      </button>
    );
  }

  // Select variant — uses native label/input for accessibility
  return (
    <label
      className={cn(
        "group flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer",
        "transition-all duration-150",
        "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500",
        "active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none",
        !isSelected && "bg-white border-[#eae6e1] hover:bg-[#faf9f7] hover:border-[#c0b9ad]",
        className,
      )}
      style={isSelected ? {
        borderColor: theme.color,
        backgroundColor: theme.color + "1a", // ~10% opacity
      } : undefined}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={isSelected}
        onChange={onToggle}
        aria-label={theme.name}
      />
      <div
        className={cn(
          "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors",
          isSelected ? "bg-[#1a1a1a]" : "border border-[#d4cfc8]",
        )}
      >
        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>
      <Icon
        className={cn("w-5 h-5 flex-shrink-0", isSelected ? "text-[#7a7062]" : "text-[#a0998f]")}
        aria-hidden="true"
      />
      <div className="text-left min-w-0">
        <span
          className={cn(
            "font-semibold text-sm whitespace-nowrap",
            isSelected ? "text-[#1a1a1a]" : "text-[#a0998f]",
          )}
        >
          {label}
        </span>
        {theme.question && (
          <span className={cn("block text-xs", isSelected ? "text-[#6a6a6a]" : "text-[#b0a99f]")}>
            {theme.name}
          </span>
        )}
        {theme.poiCount != null && theme.poiCount > 0 && !theme.question && (
          <span className={cn("block text-xs", isSelected ? "text-[#6a6a6a]" : "text-[#b0a99f]")}>
            {theme.poiCount} steder
          </span>
        )}
      </div>
    </label>
  );
}
