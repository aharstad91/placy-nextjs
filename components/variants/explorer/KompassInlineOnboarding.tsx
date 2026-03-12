"use client";

import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useKompassStore } from "@/lib/kompass-store";
import type { TimeSlot } from "@/lib/kompass-store";
import { formatEventDay } from "@/lib/hooks/useEventDayFilter";
import type { ThemeDefinition } from "@/lib/themes";

interface KompassInlineOnboardingProps {
  themes: ThemeDefinition[];
  eventDays: string[];
  dayLabels?: Record<string, string>;
}

const THEME_EMOJIS: Record<string, string> = {
  "of-konserter": "🎵",
  "of-samtale": "💬",
  "of-familie": "👨‍👩‍👧",
  "of-folkeliv": "🎪",
  "of-kirke": "⛪",
  "of-utstilling": "🎨",
};

const TIME_SLOTS: { id: TimeSlot; label: string; emoji: string; description: string }[] = [
  { id: "morning", label: "Formiddag", emoji: "☀️", description: "Før kl. 12" },
  { id: "afternoon", label: "Ettermiddag", emoji: "🌤️", description: "12:00–17:00" },
  { id: "evening", label: "Kveld", emoji: "🌙", description: "Etter kl. 17" },
];

export default function KompassInlineOnboarding({
  themes,
  eventDays,
  dayLabels,
}: KompassInlineOnboardingProps) {
  const step = useKompassStore((s) => s.onboardingStep);
  const selectedThemes = useKompassStore((s) => s.selectedThemes);
  const selectedDay = useKompassStore((s) => s.selectedDay);
  const selectedTimeSlots = useKompassStore((s) => s.selectedTimeSlots);
  const toggleTheme = useKompassStore((s) => s.toggleTheme);
  const setSelectedDay = useKompassStore((s) => s.setSelectedDay);
  const toggleTimeSlot = useKompassStore((s) => s.toggleTimeSlot);
  const setSelectedTimeSlots = useKompassStore((s) => s.setSelectedTimeSlots);
  const setSelectedThemes = useKompassStore((s) => s.setSelectedThemes);
  const nextStep = useKompassStore((s) => s.nextStep);
  const prevStep = useKompassStore((s) => s.prevStep);
  const completeKompass = useKompassStore((s) => s.completeKompass);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return selectedThemes.length > 0;
      case 2:
        return true;
      case 3:
        return true;
    }
  }, [step, selectedThemes]);

  const handleNext = useCallback(() => {
    if (step === 3) {
      completeKompass();
    } else {
      nextStep();
    }
  }, [step, nextStep, completeKompass]);

  const handleSelectAll = useCallback(() => {
    if (selectedThemes.length === themes.length) {
      setSelectedThemes([]);
    } else {
      setSelectedThemes(themes.map((t) => t.categories[0]));
    }
  }, [selectedThemes, themes, setSelectedThemes]);

  const handleSelectAllDay = useCallback(() => {
    setSelectedDay(null);
  }, [setSelectedDay]);

  const handleSelectAllTime = useCallback(() => {
    if (selectedTimeSlots.length === TIME_SLOTS.length) {
      setSelectedTimeSlots([]);
    } else {
      setSelectedTimeSlots(TIME_SLOTS.map((s) => s.id));
    }
  }, [selectedTimeSlots, setSelectedTimeSlots]);

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="flex-shrink-0 px-6 pt-4 pb-3">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                s === step ? "w-8 bg-gray-900" : s < step ? "w-4 bg-gray-400" : "w-4 bg-gray-200"
              )}
            />
          ))}
          <span className="text-xs text-gray-400 ml-2">{step} av 3</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {/* Step 1: Tema */}
        {step === 1 && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              Hva vil du oppleve?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Velg kategorier du er interessert i
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {themes.map((theme) => {
                const catId = theme.categories[0];
                const isSelected = selectedThemes.includes(catId);
                const emoji = THEME_EMOJIS[catId] ?? "📌";
                return (
                  <button
                    key={catId}
                    onClick={() => toggleTheme(catId)}
                    className={cn(
                      "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all",
                      isSelected
                        ? "border-gray-900 bg-gray-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-gray-900" : "text-gray-600"
                    )}>
                      {theme.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSelectAll}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              {selectedThemes.length === themes.length ? "Fjern alle" : "Velg alle"}
            </button>
          </div>
        )}

        {/* Step 2: Dag */}
        {step === 2 && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              Hvilken dag?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Velg en dag, eller se hele festivalen
            </p>

            <div className="space-y-2">
              <button
                onClick={handleSelectAllDay}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all",
                  selectedDay === null
                    ? "border-gray-900 bg-gray-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <span className="text-lg">📅</span>
                <span className={cn(
                  "text-sm font-medium",
                  selectedDay === null ? "text-gray-900" : "text-gray-600"
                )}>
                  Hele festivalen
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {eventDays.map((day) => {
                  const isSelected = selectedDay === day;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        "flex items-center px-4 py-2.5 rounded-xl border-2 text-left transition-all",
                        isSelected
                          ? "border-gray-900 bg-gray-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        isSelected ? "text-gray-900" : "text-gray-600"
                      )}>
                        {formatEventDay(day, dayLabels)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Tid */}
        {step === 3 && (
          <div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              Når er du ledig?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Velg tidspunkt, eller se hele dagen
            </p>

            <div className="space-y-2">
              {TIME_SLOTS.map((slot) => {
                const isSelected = selectedTimeSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    onClick={() => toggleTimeSlot(slot.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all",
                      isSelected
                        ? "border-gray-900 bg-gray-50 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <span className="text-xl">{slot.emoji}</span>
                    <div>
                      <span className={cn(
                        "text-sm font-medium block",
                        isSelected ? "text-gray-900" : "text-gray-600"
                      )}>
                        {slot.label}
                      </span>
                      <span className="text-xs text-gray-400">{slot.description}</span>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={handleSelectAllTime}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all",
                  selectedTimeSlots.length === 0
                    ? "border-gray-900 bg-gray-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <span className="text-xl">📅</span>
                <div>
                  <span className={cn(
                    "text-sm font-medium block",
                    selectedTimeSlots.length === 0 ? "text-gray-900" : "text-gray-600"
                  )}>
                    Hele dagen
                  </span>
                  <span className="text-xs text-gray-400">Vis alle tidspunkter</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 pb-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Tilbake
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={cn(
              "flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
              canProceed
                ? "bg-gray-900 text-white hover:bg-gray-800 shadow-sm"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {step === 3 ? (
              <>
                <Sparkles className="w-4 h-4" />
                Se mitt program
              </>
            ) : (
              <>
                Neste
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
