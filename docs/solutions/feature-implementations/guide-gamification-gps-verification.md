---
title: Guide Gamification with GPS Verification and Fallback Timer
category: feature-implementations
tags: [react, localStorage, gps, geolocation, state-management, gamification, ux, morphing-ui]
module: Guide
symptom: "Need to verify user visited physical stops with GPS, with graceful fallback"
root_cause: "GPS can be unavailable, delayed, or inaccurate - need timeout fallback"
date: 2026-02-02
---

# Guide Gamification with GPS Verification and Fallback Timer

## Problem

Implementing a gamification system for guided tours that:
1. Verifies user physically visited stops using GPS (50m radius)
2. Handles GPS unavailability with a 30-second fallback timer
3. Persists progress in localStorage across sessions
4. Shows clear UX feedback during verification process
5. Rewards completion with a digital voucher

## Solution

### 1. State Management with localStorage (Not Zustand Persist)

**Key Learning:** Zustand's persist middleware caused infinite hydration loops. Simple useState + useEffect pattern works reliably.

```typescript
// lib/hooks/useGuideCompletion.ts
const STORAGE_KEY = "placy-guide-completions";

function getStoredCompletions(): Record<string, GuideCompletionState> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function useGuideCompletion(guideId: string) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [completion, setCompletion] = useState<GuideCompletionState | undefined>();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const completions = getStoredCompletions();
    setCompletion(completions[guideId]);
    setIsHydrated(true);
  }, [guideId]);

  // ... rest of hook
}
```

### 2. GPS Verification with Cancel Token Pattern

Handle race conditions when GPS arrives during fallback timer:

```typescript
// components/variants/guide/GuideStopPanel.tsx
type VerificationState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "near-stop"; distance: number }
  | { status: "waiting-fallback"; remainingSeconds: number }
  | { status: "verified"; method: "gps" | "fallback" };

const handleMarkCompleteClick = useCallback(() => {
  if (isCompleted) return;

  // If already near stop via GPS, mark immediately
  if (isNearStop && gpsAvailable) {
    setVerificationState({ status: "verified", method: "gps" });
    onMarkComplete(true, undefined, userPosition ?? undefined);
    return;
  }

  // Start fallback timer with cancel token
  setVerificationState({ status: "waiting-fallback", remainingSeconds: 30 });

  const cancelToken = { canceled: false };
  const timeoutId = setTimeout(() => {
    if (cancelToken.canceled) return;
    cleanupTimers();
    setVerificationState({ status: "verified", method: "fallback" });
    onMarkComplete(false);
  }, 30000);

  fallbackTimerRef.current = { timeoutId, canceled: cancelToken.canceled };
}, [/* deps */]);

// Handle GPS arriving while waiting for fallback
useEffect(() => {
  if (
    verificationState.status === "waiting-fallback" &&
    isNearStop &&
    gpsAvailable
  ) {
    cleanupTimers();
    setVerificationState({ status: "verified", method: "gps" });
    onMarkComplete(true, undefined, userPosition ?? undefined);
  }
}, [isNearStop, gpsAvailable, verificationState.status]);
```

### 3. Morphing Button UX

Clear feedback with time-based state transitions:

```typescript
// First 20 seconds: Amber, checking GPS
// Last 10 seconds: Green, almost done
{verificationState.status === "waiting-fallback" ? (
  verificationState.remainingSeconds <= 10 ? (
    <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700">
      <Check className="w-4 h-4" />
      <span>Godkjennes om {verificationState.remainingSeconds}s</span>
    </div>
  ) : (
    <div className="flex items-center gap-2 bg-amber-100 text-amber-700">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Sjekker GPS... {verificationState.remainingSeconds}s</span>
    </div>
  )
) : /* other states */}
```

### 4. SSR Hydration Guard

Prevent hydration mismatch with dual isHydrated checks:

```typescript
// GuidePage.tsx
const [isHydrated, setIsHydrated] = useState(false);
const { isHydrated: completionHydrated } = useGuideCompletion(guideId);

useEffect(() => {
  setIsHydrated(true);
}, []);

if (!isHydrated || !completionHydrated) {
  return <div>Laster guide...</div>;
}
```

### 5. Anti-Screenshot Voucher Security

Dynamic clock makes screenshots useless for fraud:

```typescript
// GuideCompletionScreen.tsx
const [currentTime, setCurrentTime] = useState(new Date());

useEffect(() => {
  const interval = setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);
  return () => clearInterval(interval);
}, []);

// Display with live clock
<span>{currentTime.toLocaleTimeString("nb-NO")}</span>
```

## Type Definitions

```typescript
// lib/types.ts
export type GuideId = Brand<string, "GuideId">;
export type RewardValidityDays = 1 | 3 | 7 | 14 | 30;

export interface StopCompletionRecord {
  markedAt: number;
  verifiedByGPS: boolean;
  accuracy?: number;
  coordinates?: Coordinates;
}

export interface GuideCompletionState {
  guideId: GuideId;
  startedAt: number;
  completedAt?: number;
  redeemedAt?: number;
  celebrationShownAt?: number;
  stops: Record<string, StopCompletionRecord>;
}

export interface RewardConfig {
  title: string;
  description: string;
  hotelName: string;
  hotelLogoUrl?: string;
  validityDays: RewardValidityDays;
}
```

## Files Modified

- `lib/types.ts` - New types for gamification
- `lib/hooks/useGuideCompletion.ts` - State management hook
- `components/variants/guide/GuideStopPanel.tsx` - Verification UI
- `components/variants/guide/GuideIntroOverlay.tsx` - Reward intro
- `components/variants/guide/GuideCompletionScreen.tsx` - Completion voucher
- `components/variants/guide/GuidePage.tsx` - Integration
- `components/variants/guide/confetti.ts` - Celebration utility

## Pitfalls to Avoid

1. **Don't use Zustand persist for hydration-sensitive state** - causes infinite loading loops
2. **Always cleanup timers on unmount and stop changes** - prevents memory leaks and stale callbacks
3. **Check both component hydration AND hook hydration** - prevents SSR mismatch
4. **Use cancel tokens for async operations** - handles race conditions gracefully
5. **GeolocationMode has specific values** - use `"disabled"` and `"fallback"`, not `"denied"`

## UX Lessons

1. **Morphing states are clearer than static text** - users understand progress better
2. **Color transitions (amber→green) communicate state changes** - visual feedback matters
3. **Show countdown timers** - reduces user anxiety about what's happening
4. **Dynamic elements prevent fraud** - live clocks make screenshots useless
