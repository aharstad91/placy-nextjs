"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Livsfase } from "@/lib/themes/profil-filter-mapping";
import { LIVSFASE_OPTIONS } from "@/lib/themes/profil-filter-mapping";

interface BoligProfilFilterProps {
  projectName: string;
  onSelect: (livsfase: Livsfase) => void;
  onSkip: () => void;
}

export default function BoligProfilFilter({
  projectName,
  onSelect,
  onSkip,
}: BoligProfilFilterProps) {
  const [selectedId, setSelectedId] = useState<Livsfase | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSelect = useCallback(
    (livsfase: Livsfase) => {
      setSelectedId(livsfase);
      timeoutRef.current = setTimeout(() => {
        onSelect(livsfase);
      }, 400);
    },
    [onSelect]
  );

  return (
    <div className="absolute inset-0 z-40 flex items-end lg:items-center lg:justify-center">
      {/* Backdrop — lighter than Kompass so map markers remain visible */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={onSkip}
      />

      {/* Bottom sheet (mobile) / Modal (desktop) */}
      <div className="relative w-full lg:w-[400px] lg:rounded-2xl bg-[#faf9f7] rounded-t-2xl shadow-2xl animate-slide-up max-h-[70vh] flex flex-col">
        {/* Drag handle — mobile only */}
        <div className="w-10 h-1 bg-[#ddd9d3] rounded-full mx-auto mt-3 mb-1 lg:hidden" />

        {/* Content */}
        <div className="px-5 pt-4 pb-6 flex flex-col gap-4">
          {/* Header */}
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#a0937d] mb-2 select-none">
              {projectName}
            </p>
            <h2 className="text-base font-semibold text-[#1a1a1a]">
              Hva passer deg best?
            </h2>
          </div>

          {/* Option cards */}
          <div className="flex flex-col gap-2.5">
            {LIVSFASE_OPTIONS.map((option, i) => {
              const isSelected = selectedId === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  disabled={selectedId !== null}
                  className={[
                    "w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-all duration-150 cursor-pointer text-left",
                    isSelected
                      ? "border-[#1a1a1a] bg-[#f5f3f0] shadow-sm scale-[0.98]"
                      : selectedId !== null
                        ? "border-[#e8e4de] bg-white opacity-40"
                        : "border-[#ddd9d3] bg-white hover:border-[#c5bfb8] hover:shadow-sm active:scale-[0.98]",
                  ].join(" ")}
                  style={{
                    animation: `profil-filter-rise 0.4s ${0.1 + i * 0.06}s cubic-bezier(0.16, 1, 0.3, 1) both`,
                  }}
                >
                  <span className="text-2xl flex-shrink-0">{option.icon}</span>
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[#1a1a1a] block">
                      {option.label}
                    </span>
                    <p className="text-xs text-[#6a6360] leading-snug">
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Skip CTA */}
          <button
            onClick={onSkip}
            disabled={selectedId !== null}
            className="py-2 text-xs uppercase tracking-[0.15em] text-[#6a6360] hover:text-[#1a1a1a] transition-colors disabled:opacity-40"
            style={{
              animation: "profil-filter-rise 0.4s 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            Hopp over
          </button>
        </div>
      </div>

      {/* Namespaced keyframes to avoid collision with other animations */}
      <style>{`
        @keyframes profil-filter-rise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="profil-filter-rise"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
