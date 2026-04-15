"use client";

import { useCallback } from "react";

interface ModeToggleProps {
  value: "2d" | "3d";
  onChange: (mode: "2d" | "3d") => void;
  disabled?: boolean;
  className?: string;
}

const OPTIONS: { value: "2d" | "3d"; label: string; ariaLabel: string }[] = [
  { value: "2d", label: "Kart", ariaLabel: "2D-kart" },
  { value: "3d", label: "3D", ariaLabel: "3D-kart" },
];

export default function ModeToggle({
  value,
  onChange,
  disabled,
  className,
}: ModeToggleProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = value === "2d" ? "3d" : "2d";
        onChange(next);
      }
    },
    [value, onChange],
  );

  return (
    <div
      role="group"
      aria-label="Kartvisning"
      onKeyDown={handleKeyDown}
      className={`inline-flex gap-1 rounded-full bg-[#f5f3f0] p-1 ${
        disabled ? "opacity-50 pointer-events-none" : ""
      } ${className ?? ""}`}
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-label={opt.ariaLabel}
            aria-pressed={isActive}
            disabled={disabled}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? "bg-[#1a1a1a] text-white"
                : "bg-white text-[#5d5348] border border-[#eae6e1] hover:border-[#d4cfc8]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
