"use client";

import { useState, useEffect } from "react";
import { MapPin, Gift, Clock, ArrowRight } from "lucide-react";
import type { GuideConfig } from "@/lib/types";

interface GuideIntroOverlayProps {
  guideConfig: GuideConfig;
  onStart: () => void;
}

export default function GuideIntroOverlay({
  guideConfig,
  onStart,
}: GuideIntroOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    setIsVisible(false);
    // Wait for fade out animation before calling onStart
    setTimeout(onStart, 300);
  };

  const { reward } = guideConfig;
  const hasReward = !!reward;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center transition-all duration-300 ${
        isVisible ? "bg-black/50 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={handleStart}
    >
      <div
        className={`w-full max-w-lg mx-4 mb-8 bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-white">
          <h1 className="text-2xl font-bold">{guideConfig.title}</h1>
          {guideConfig.description && (
            <p className="mt-2 text-emerald-50 text-sm leading-relaxed">
              {guideConfig.description}
            </p>
          )}

          {/* Stats row */}
          <div className="flex gap-4 mt-4 text-emerald-100">
            {guideConfig.precomputedDurationMinutes && (
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="w-4 h-4" />
                <span>{guideConfig.precomputedDurationMinutes} min</span>
              </div>
            )}
            {guideConfig.precomputedDistanceMeters && (
              <div className="flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4" />
                <span>
                  {(guideConfig.precomputedDistanceMeters / 1000).toFixed(1)} km
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm">
              <span>{guideConfig.stops.length} stopp</span>
            </div>
          </div>
        </div>

        {/* Reward section */}
        {hasReward && (
          <div className="px-6 py-5 bg-amber-50 border-b border-amber-100">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Gift className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900">
                  Fullfør og få belønning!
                </h3>
                <p className="text-amber-700 text-sm mt-0.5">
                  {reward.title}
                </p>
                <p className="text-amber-600 text-xs mt-1">
                  fra {reward.hotelName}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="px-6 py-4 text-sm text-stone-600">
          <p>
            Besøk alle stoppene og marker dem som fullført. Du kan gå i
            vilkårlig rekkefølge.
          </p>
        </div>

        {/* Start button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleStart}
            className="w-full py-4 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>Start turen</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
