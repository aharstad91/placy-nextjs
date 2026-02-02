"use client";

import { useState, useEffect, useRef } from "react";
import { Award, Clock, MapPin, CheckCircle, Gift, X } from "lucide-react";
import type { GuideConfig, GuideCompletionState } from "@/lib/types";
import { celebrateCompletion, stopConfetti } from "./confetti";

interface GuideCompletionScreenProps {
  guideConfig: GuideConfig;
  completion: GuideCompletionState;
  onClose: () => void;
  onCelebrationShown: () => void;
  shouldCelebrate: boolean;
}

export default function GuideCompletionScreen({
  guideConfig,
  completion,
  onClose,
  onCelebrationShown,
  shouldCelebrate,
}: GuideCompletionScreenProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const celebrationTriggeredRef = useRef(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Dynamic time update for anti-screenshot (updates every second)
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Trigger confetti celebration (only once)
  useEffect(() => {
    if (shouldCelebrate && !celebrationTriggeredRef.current) {
      celebrationTriggeredRef.current = true;
      celebrateCompletion().then(() => {
        onCelebrationShown();
      });
    }

    // Cleanup confetti on unmount
    return () => {
      stopConfetti();
    };
  }, [shouldCelebrate, onCelebrationShown]);

  const { reward } = guideConfig;
  const hasReward = !!reward;

  // Calculate stats
  const totalTimeMinutes = completion.completedAt
    ? Math.round((completion.completedAt - completion.startedAt) / 60000)
    : 0;
  const stopsCompleted = Object.keys(completion.stops).length;
  const totalStops = guideConfig.stops.length;
  const completedDate = completion.completedAt
    ? new Date(completion.completedAt)
    : new Date();

  // Calculate expiry date for voucher
  const expiryDate = reward
    ? new Date(
        completedDate.getTime() + reward.validityDays * 24 * 60 * 60 * 1000
      )
    : null;

  const isExpired = expiryDate ? new Date() > expiryDate : false;
  const isRedeemed = !!completion.redeemedAt;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        isVisible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"
      }`}
    >
      <div
        className={`w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 max-h-[90vh] overflow-y-auto ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors z-10"
        >
          <X className="w-5 h-5 text-stone-600" />
        </button>

        {/* Celebration header */}
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 py-10 text-white text-center relative overflow-hidden">
          {/* Background decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          {/* Badge */}
          <div className="relative">
            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center shadow-lg">
              <Award className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full shadow">
              FULLFORT!
            </div>
          </div>

          <h1 className="mt-6 text-2xl font-bold">Gratulerer!</h1>
          <p className="mt-1 text-emerald-100">
            Du har fullfort {guideConfig.title}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-stone-50">
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            value={`${totalTimeMinutes}`}
            label="minutter"
          />
          <StatCard
            icon={<CheckCircle className="w-4 h-4" />}
            value={`${stopsCompleted}/${totalStops}`}
            label="stopp"
          />
          <StatCard
            icon={<MapPin className="w-4 h-4" />}
            value={
              guideConfig.precomputedDistanceMeters
                ? `${(guideConfig.precomputedDistanceMeters / 1000).toFixed(1)}`
                : "-"
            }
            label="km"
          />
        </div>

        {/* Voucher card (if reward exists) */}
        {hasReward && (
          <div className="px-6 py-4">
            <VoucherCard
              reward={reward}
              completedDate={completedDate}
              expiryDate={expiryDate}
              currentTime={currentTime}
              isExpired={isExpired}
              isRedeemed={isRedeemed}
            />
          </div>
        )}

        {/* Completion date */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-stone-400">
            Fullfort {completedDate.toLocaleDateString("nb-NO", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
      <div className="flex justify-center text-stone-400 mb-1">{icon}</div>
      <div className="text-xl font-bold text-stone-900">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

// Voucher card component with paper-like styling
function VoucherCard({
  reward,
  completedDate,
  expiryDate,
  currentTime,
  isExpired,
  isRedeemed,
}: {
  reward: NonNullable<GuideConfig["reward"]>;
  completedDate: Date;
  expiryDate: Date | null;
  currentTime: Date;
  isExpired: boolean;
  isRedeemed: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-transform ${
        isExpired || isRedeemed ? "opacity-60" : "hover:scale-[1.01]"
      }`}
      style={{
        background: "linear-gradient(180deg, #fffef8 0%, #fdfcf5 100%)",
        border: "2px solid #e8dcc8",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 20px -5px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        transform: "rotate(-0.5deg)",
      }}
    >
      {/* Inner dashed border */}
      <div
        className="m-3 p-4 rounded-lg"
        style={{
          border: "1px dashed #d4af37",
        }}
      >
        {/* Status badges */}
        {isRedeemed && (
          <div className="absolute top-4 right-4 bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded">
            INNLOST
          </div>
        )}
        {isExpired && !isRedeemed && (
          <div className="absolute top-4 right-4 bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">
            UTLOPT
          </div>
        )}

        {/* Gift icon and hotel */}
        <div className="flex items-center gap-2 text-amber-700 mb-3">
          <Gift className="w-5 h-5" />
          <span className="font-medium">{reward.hotelName}</span>
        </div>

        {/* Reward title */}
        <h3 className="text-xl font-bold text-stone-900 mb-1">{reward.title}</h3>
        <p className="text-sm text-stone-600 mb-4">{reward.description}</p>

        {/* Dynamic time - anti-screenshot */}
        {!isExpired && !isRedeemed && (
          <div className="bg-stone-100 rounded-lg p-3 text-center">
            <p className="text-2xl font-mono tabular-nums text-stone-900">
              {currentTime.toLocaleTimeString("nb-NO", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Vis denne skjermen til resepsjonen NA
            </p>
          </div>
        )}

        {/* Expiry info */}
        {expiryDate && !isRedeemed && (
          <p className="text-xs text-stone-400 text-center mt-3">
            {isExpired
              ? "Voucheren har utlopt"
              : `Gyldig til ${expiryDate.toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "long",
                })}`}
          </p>
        )}
      </div>
    </div>
  );
}
