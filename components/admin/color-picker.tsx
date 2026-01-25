"use client";

import { useState } from "react";

// Preset color palette
const COLORS = [
  { name: "Rød", value: "#ef4444" },
  { name: "Oransje", value: "#f97316" },
  { name: "Gul", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Grønn", value: "#22c55e" },
  { name: "Smaragd", value: "#10b981" },
  { name: "Turkis", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Himmelblå", value: "#0ea5e9" },
  { name: "Blå", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Lilla", value: "#8b5cf6" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Grå", value: "#6b7280" },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customColor, setCustomColor] = useState(value || "#3b82f6");

  const isPresetColor = COLORS.some((c) => c.value === value);

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg border border-gray-200 shadow-inner"
          style={{ backgroundColor: value || "#3b82f6" }}
        />
        <span className="text-sm font-mono text-gray-600">{value || "#3b82f6"}</span>
      </div>

      {/* Preset colors */}
      <div className="grid grid-cols-8 gap-1.5">
        {COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(color.value)}
            className={`w-8 h-8 rounded-lg transition-all ${
              value === color.value
                ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                : "hover:scale-110"
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>

      {/* Custom color toggle */}
      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        {showCustom ? "Skjul egendefinert farge" : "Bruk egendefinert farge"}
      </button>

      {/* Custom color input */}
      {showCustom && (
        <div className="flex gap-2">
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              setCustomColor(e.target.value);
              onChange(e.target.value);
            }}
            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => {
              const val = e.target.value;
              setCustomColor(val);
              if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                onChange(val);
              }
            }}
            placeholder="#3b82f6"
            className="flex-1 px-3 py-2 text-sm font-mono bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300"
          />
        </div>
      )}
    </div>
  );
}
