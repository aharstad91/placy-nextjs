---
title: "feat: Guide Gamification med Hotellbelønninger"
type: feat
date: 2026-02-02
brainstorm: docs/brainstorms/2026-02-02-guide-gamification-brainstorm.md
deepened: 2026-02-02
---

# ✨ Guide Gamification med Hotellbelønninger

## Enhancement Summary

**Deepened on:** 2026-02-02
**Research agents used:** 11 parallel agents (simplicity, security, performance, TypeScript, frontend-races, patterns, frontend-design, best-practices, learnings, Context7 x2)

### Key Improvements
1. **Drastisk forenklet MVP** — Simplicity-reviewer foreslo 60-70% reduksjon i kode ved å droppe GPS-verifisering for lavverdi-belønning
2. **Race condition-håndtering** — Identifisert 5 kritiske race conditions med løsninger (timer vs GPS, rapid marking, hydration)
3. **Adaptiv GPS-strategi** — Batterisparing via to-lags GPS (lavoppløsning i bakgrunn, høy når nær stopp)
4. **Voucher-sikkerhet** — Dynamisk tid på skjerm + enkel signatur hindrer screenshot-deling
5. **Branded TypeScript-typer** — Konsistent med eksisterende `GuideStopId`-mønster

### Note on Simplification
Simplicity-reviewer foreslo å droppe GPS-verifisering, men **vi beholder alle planlagte funksjoner**:
- ✅ GPS-verifisering (50m) med 30s fallback
- ✅ Intro overlay med belønningsinfo
- ✅ Konfetti-animasjon
- ✅ Full voucher-skjerm med statistikk
- ✅ Zustand store med persistence

---

## Overview

Implementer et belønningssystem for Placy Guide der hotelgjester får en konkret belønning (F&B-rabatt eller gratis produkt) når de fullfører en kuratert byvandring. Systemet verifiserer fullføring gjennom GPS-posisjon med enkel fallback.

**MVP-scope:** Ingen backend, alt i localStorage, manuell verifisering i resepsjon.

## Problem Statement / Motivation

Hoteller ønsker:
- **Mersalg:** Gjesten kommer tilbake til hotellet og bruker penger i bar/restaurant
- **Gjesteopplevelse:** Differensiering, bedre anmeldelser, gjester føler seg ivaretatt
- **Lojalitet:** Gjesten husker hotellet, kommer tilbake neste gang
- **Markedsføring:** "Vi tilbyr gratis byvandring med belønning" som salgsargument

Gjester ønsker:
- Motivasjon til å fullføre hele turen
- Konkret belønning for innsatsen
- Feiring av prestasjon

## Proposed Solution

### Kjerneflyt

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Åpne guide │────▶│  Se intro   │────▶│  Gå turen   │
│             │     │  m/belønning│     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
            ┌─────────────────┐
            │  Ved hvert stopp│
            │  Marker besøkt  │
            └─────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  GPS innenfor   │     │  GPS utilgjeng. │
│  50m = OK       │     │  Vent 30s = OK  │
└─────────────────┘     └─────────────────┘
                    │
                    ▼
            ┌─────────────────┐
            │  Alle stopp     │
            │  fullført?      │
            └─────────────────┘
                    │ JA
                    ▼
            ┌─────────────────┐
            │  🎉 Konfetti!   │
            │  Vis voucher    │
            └─────────────────┘
                    │
                    ▼
            ┌─────────────────┐
            │  Vis i resepsjon│
            │  → Få belønning │
            └─────────────────┘
```

### Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Stopp-rekkefølge | **Fri** | Fleksibilitet for gjest |
| Verifisering | **GPS (50m) + 30s fallback** | Balanse mellom sikkerhet og UX |
| Innløsning | **Vis skjerm i resepsjon** | Enklest, ingen integrasjon |
| Persistering | **localStorage** | Ingen backend for MVP |
| Voucher-validitet | **7 dager** | Rimelig for hotellopphold |

## Technical Considerations

### Eksisterende infrastruktur å bygge på

| Fil | Gjenbruk |
|-----|----------|
| `components/variants/guide/GuidePage.tsx` | `completedStops` state, `handleMarkComplete` |
| `components/variants/guide/GuideStopPanel.tsx` | "Merk som besøkt"-knapp |
| `lib/hooks/useGeolocation.ts` | GPS-posisjon og modus |
| `lib/utils.ts` | `haversineDistance()` for avstandsberegning |
| `lib/store.ts` | Zustand + persist-mønster |

### Ny kode

| Komponent/Hook | Ansvar |
|----------------|--------|
| `useGuideCompletion.ts` | State management, localStorage, verifiseringslogikk |
| `GuideCompletionScreen.tsx` | Konfetti, badge, stats, voucher-kort |
| `GuideIntroOverlay.tsx` | Viser belønningsinfo ved oppstart |

### Dataskjema (localStorage)

```typescript
// lib/types.ts - nye typer

// Branded type for Guide ID (konsistent med eksisterende GuideStopId)
export type GuideId = Brand<string, "GuideId">;

export function createGuideId(value: string): GuideId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid Guide ID: ${value}`);
  }
  return value as GuideId;
}

// Validity days - eksplisitte tillatte verdier
export type RewardValidityDays = 1 | 3 | 7 | 14 | 30;

// Stop completion record - ekstrahert for testbarhet
export interface StopCompletionRecord {
  markedAt: number;           // Unix timestamp (enklere å sammenligne)
  verifiedByGPS: boolean;
  accuracy?: number;          // GPS nøyaktighet i meter (for audit)
  coordinates?: Coordinates;
}

// Guide completion state - bruker branded types og unix timestamps
export interface GuideCompletionState {
  guideId: GuideId;
  startedAt: number;           // Unix timestamp
  completedAt?: number;        // Unix timestamp
  redeemedAt?: number;         // Unix timestamp
  celebrationShownAt?: number; // Forhindrer dobbel konfetti
  stops: Record<GuideStopId, StopCompletionRecord>;
}

// Reward configuration
export interface RewardConfig {
  title: string;               // "15% rabatt i baren"
  description: string;         // "Vis denne skjermen i resepsjonen"
  hotelName: string;           // "Scandic Nidelven"
  hotelLogoUrl?: string;
  validityDays: RewardValidityDays;
}

// Utvid GuideConfig
interface GuideConfig {
  // ... eksisterende felter
  reward?: RewardConfig;
}
```

### Research Insights: TypeScript Types

**Best Practices (fra Kieran TypeScript Reviewer):**
- Bruk `number` for timestamps — enklere å sammenligne og beregne utløp
- Eksplisitte union types for `validityDays` forhindrer ugyldige verdier
- Ekstraher `StopCompletionRecord` for bedre testbarhet
- `celebrationShownAt` forhindrer dobbel konfetti-triggering

**Konsistens med eksisterende kode:**
- Følger branded type-mønster fra `lib/types.ts:236-257`
- Matcher `GuideStopStatus.completedAt: number` på linje 296

### Hydration Guard (kritisk)

```typescript
// Må følge eksisterende mønster fra Guide-prototypen
const [isHydrated, setIsHydrated] = useState(false);
useEffect(() => setIsHydrated(true), []);

if (!isHydrated) return <LoadingSkeleton />;
```

### Konfetti-bibliotek

```bash
npm install canvas-confetti
```

Lett (8kb gzipped), populært, ingen avhengigheter.

### Research Insights: canvas-confetti

**Optimal implementasjon (fra Context7 docs):**

```typescript
// components/variants/guide/confetti.ts
import confetti from 'canvas-confetti';

export function celebrateCompletion() {
  // Respekter reduced motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }

  const duration = 3000;
  const end = Date.now() + duration;
  const colors = ['#d4af37', '#fbbf24', '#34d399', '#60a5fa']; // Gull + farger

  return new Promise<void>((resolve) => {
    const frame = () => {
      if (Date.now() > end) {
        resolve();
        return;
      }

      // Dual burst fra sidene - bedre visuelt enn enkelt burst
      confetti({
        particleCount: 3,  // Lavt for ytelse
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors,
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors,
      });

      requestAnimationFrame(frame);
    };

    frame();
  });
}

// KRITISK: Cleanup på unmount
export function stopConfetti() {
  confetti.reset();
}
```

**Performance tips:**
- Hold `particleCount` under 50 for mobil
- Bruk `requestAnimationFrame` for smooth animasjon
- **Alltid kall `confetti.reset()`** på komponent unmount
- `disableForReducedMotion: true` for accessibility

## Acceptance Criteria

### Funksjonelle krav

- [ ] **Intro:** Når guide åpnes vises overlay med belønningsinfo
- [ ] **Markering:** Stopp kan markeres i vilkårlig rekkefølge
- [ ] **GPS-verifisering:** Innenfor 50m → umiddelbar markering tillatt
- [ ] **Fallback:** Uten GPS → må vente 30 sek før markering
- [ ] **Visuell feedback:** Tydelig indikator på verifiseringsstatus
- [ ] **Fullføring:** Når alle stopp er markert → vis CompletionScreen
- [ ] **Konfetti:** Animasjon ved fullføring (respekter `prefers-reduced-motion`)
- [ ] **Statistikk:** Vis total tid og antall stopp
- [ ] **Voucher:** Vis hotellnavn, belønning, tidsstempel
- [ ] **Persistering:** State overlever sideoppdatering og app-lukking
- [ ] **Validitet:** Voucher viser utløpsdato (7 dager fra fullføring)

### Tekniske krav

- [ ] Hydration guard for localStorage-tilgang
- [ ] AbortController for async operasjoner
- [ ] Graceful degradation ved GPS-nekt
- [ ] Zustand persist-mønster for state
- [ ] TypeScript-typer for all ny data

### Edge cases

- [ ] **Pause >4 timer mellom stopp:** Tillatt (fri rekkefølge)
- [ ] **Delt telefon:** Én voucher per enhet per guide
- [ ] **Nett-avbrudd:** localStorage + GPS fungerer offline
- [ ] **Avbrutt tur:** State bevares, kan fortsette senere
- [ ] **Allerede fullført:** Vis voucher-skjerm direkte
- [ ] **Allerede innløst:** Vis "Innløst"-badge

## Implementation Plan

### Fase 1: Data & Types

**Filer å endre:**

```
lib/types.ts                           # Nye typer
data/projects/visitnorway/10000-skritt-trondheim.json  # Legg til reward-config
```

**Oppgaver:**
1. Legg til `GuideCompletionState` interface
2. Legg til `RewardConfig` interface
3. Utvid `GuideConfig` med optional `reward`
4. Oppdater demo-guide med reward-data

### Fase 2: State Management Hook

**Ny fil:**

```
lib/hooks/useGuideCompletion.ts
```

**Oppgaver:**
1. Opprett Zustand store med persist
2. Implementer `markStopComplete(stopId, gpsVerified, coords?)`
3. Implementer `isStopCompleted(stopId): boolean`
4. Implementer `isGuideCompleted(): boolean`
5. Implementer `getCompletionStats(): { totalTime, stopsCompleted }`
6. Implementer `markRedeemed()`
7. Håndter validitet-sjekk (7 dager)

### Research Insights: Zustand Persist

**Anbefalt implementasjon (fra Context7 + best practices):**

```typescript
// lib/hooks/useGuideCompletion.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORE_VERSION = 1;
const MAX_STORED_COMPLETIONS = 50;
const RETENTION_DAYS = 90;

interface GuideCompletionStore {
  completions: Record<string, GuideCompletionState>;
  _hasHydrated: boolean;

  // Actions
  startGuide: (guideId: GuideId) => void;
  markStopComplete: (guideId: GuideId, stopId: GuideStopId, gpsVerified: boolean, coords?: Coordinates) => void;
  completeGuide: (guideId: GuideId) => void;
  markCelebrationShown: (guideId: GuideId) => void;
  markRedeemed: (guideId: GuideId) => void;

  // Selectors
  isStopCompleted: (guideId: GuideId, stopId: GuideStopId) => boolean;
  isGuideCompleted: (guideId: GuideId) => boolean;
  getCompletionStats: (guideId: GuideId) => { totalTime: number; stopsCompleted: number } | null;
}

export const useGuideCompletionStore = create<GuideCompletionStore>()(
  persist(
    (set, get) => ({
      completions: {},
      _hasHydrated: false,

      markStopComplete: (guideId, stopId, gpsVerified, coords) =>
        set((state) => {
          const completion = state.completions[guideId];
          if (!completion) return state;

          // Forhindre duplikat-markering
          if (completion.stops[stopId]) return state;

          return {
            completions: {
              ...state.completions,
              [guideId]: {
                ...completion,
                stops: {
                  ...completion.stops,
                  [stopId]: {
                    markedAt: Date.now(),
                    verifiedByGPS: gpsVerified,
                    coordinates: coords,
                  },
                },
              },
            },
          };
        }),

      // ... andre actions
    }),
    {
      name: 'placy-guide-completions',
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),

      // Kun persist data, ikke funksjoner
      partialize: (state) => ({
        completions: state.completions,
      }),

      // Håndter versjon-migrasjoner
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Eksempel: migrer fra string timestamps til number
          const completions = persistedState.completions || {};
          Object.keys(completions).forEach((guideId) => {
            if (typeof completions[guideId].startedAt === 'string') {
              completions[guideId].startedAt = new Date(completions[guideId].startedAt).getTime();
            }
          });
          return { ...persistedState, completions };
        }
        return persistedState;
      },

      // Sett hydration flag
      onRehydrateStorage: () => () => {
        useGuideCompletionStore.setState({ _hasHydrated: true });
      },
    }
  )
);

// Selector for hydration state
export const useGuideCompletionHydrated = () =>
  useGuideCompletionStore((state) => state._hasHydrated);
```

**Kritisk: Cleanup av gamle completions**

```typescript
// Kjør ved rehydration
function cleanupOldCompletions(completions: Record<string, GuideCompletionState>) {
  const now = Date.now();
  const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const valid = Object.entries(completions)
    .filter(([_, c]) => now - c.startedAt < retentionMs)
    .sort((a, b) => b[1].startedAt - a[1].startedAt)
    .slice(0, MAX_STORED_COMPLETIONS);

  return Object.fromEntries(valid);
}
```

### Fase 3: Verifiseringslogikk

**Endre fil:**

```
components/variants/guide/GuidePage.tsx
```

**Oppgaver:**
1. Integrer `useGuideCompletion` hook
2. Implementer GPS-sjekk (50m radius via `haversineDistance`)
3. Implementer 30s fallback-timer
4. Koble til `handleMarkComplete`

### Research Insights: Race Conditions (fra Julik Frontend Races Reviewer)

**5 kritiske race conditions identifisert:**

| Race Condition | Problem | Løsning |
|----------------|---------|---------|
| Timer vs GPS | GPS ankommer mens 30s timer kjører | Cancel token på timer |
| Rapid marking | Bruker markerer 3 stopp raskt | Mutex/queue for markering |
| GPS update vs verification | Stale GPS-data brukes | Atomic state fra samme GPS-reading |
| Hydration vs completion | Completion trigges før hydration | Vent på `_hasHydrated` |
| Confetti dobbel-trigger | Re-render trigger konfetti igjen | `celebrationShownAt` flag |

**Timer med cancel token:**

```typescript
function createCancellableTimeout(fn: () => void, delay: number) {
  const cancelToken = { canceled: false };
  const timeoutId = setTimeout(() => {
    if (cancelToken.canceled) return;  // KRITISK: Sjekk før kjøring
    fn();
  }, delay);
  return {
    timeoutId,
    cancel: () => {
      cancelToken.canceled = true;
      clearTimeout(timeoutId);
    }
  };
}

// Bruk:
const fallbackTimer = createCancellableTimeout(() => {
  if (verificationState.status === 'awaiting-fallback') {
    markComplete(stopId, { gpsVerified: false });
  }
}, 30_000);

// Når GPS ankommer innenfor 50m:
if (verificationState.status === 'awaiting-fallback') {
  fallbackTimer.cancel();
  markComplete(stopId, { gpsVerified: true });
}
```

**Verification state machine:**

```typescript
type VerificationState =
  | { status: "idle" }
  | { status: "verifying-gps" }
  | { status: "waiting-fallback"; remainingSeconds: number; timer: { cancel: () => void } }
  | { status: "verified"; method: "gps" | "fallback" };
```

### Fase 4: Intro Overlay

**Ny fil:**

```
components/variants/guide/GuideIntroOverlay.tsx
```

**Oppgaver:**
1. Vis guidenavn og belønningsinfo
2. "Start turen"-knapp
3. Lagre at intro er sett (unngå gjentatt visning)
4. Animert inngang

### Fase 5: Completion Screen

**Ny fil:**

```
components/variants/guide/GuideCompletionScreen.tsx
```

**Oppgaver:**
1. Konfetti-animasjon med `canvas-confetti`
2. Badge/logo med "Fullført!"-banner
3. Statistikk-kort (tid, stopp, dato)
4. Voucher-kort med hotellinfo
5. "Vis i resepsjon"-instruksjon
6. Respekter `prefers-reduced-motion`

### Research Insights: Voucher Design & Security

**Fra Security Sentinel — Voucher fraud prevention:**

```typescript
// KRITISK: Dynamisk tid på voucher-skjerm
// Forhindrer screenshot-deling (tid vil være stale)
function VoucherCard({ completedAt, reward }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="voucher-card">
      {/* ... voucher innhold ... */}

      {/* Dynamisk tid - oppdateres hvert sekund */}
      <p className="text-lg font-mono tabular-nums">
        {now.toLocaleTimeString('nb-NO')}
      </p>
      <p className="text-xs text-stone-500">
        Vis til resepsjonen NÅ
      </p>
    </div>
  );
}
```

**Fra Frontend Design skill — Voucher visual design:**

```css
.voucher-card {
  /* Paper-like texture for "ekte voucher"-følelse */
  background:
    linear-gradient(180deg, #fffef8 0%, #fdfcf5 100%);

  /* Elegant border - ticket-style */
  border: 2px solid #e8dcc8;
  border-radius: 12px;

  /* Depth */
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 10px 20px -5px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);

  /* Subtil rotasjon for playfulness */
  transform: rotate(-1deg);
}

.voucher-inner-border {
  border: 1px dashed #d4af37;  /* Gull farge */
  margin: 12px;
  padding: 16px;
}
```

**Stats-kort layout:**

```tsx
<div className="grid grid-cols-3 gap-3 mt-4">
  <StatCard value="47" label="min" />
  <StatCard value="8/8" label="stopp" />
  <StatCard value="3.2" label="km" />
</div>
```

### Fase 6: UI-oppdateringer

**Endre filer:**

```
components/variants/guide/GuideStopPanel.tsx
components/variants/guide/GuidePage.tsx
```

**Oppgaver:**
1. Oppdater "Merk som besøkt"-knapp med verifiseringsstatus
2. Vis GPS-indikator (grønn = nær, grå = venter)
3. Vis countdown hvis fallback-timer aktiv
4. Legg til fullført-deteksjon → vis CompletionScreen

### Fase 7: Testing & Polish

**Oppgaver:**
1. Test offline-scenario
2. Test GPS-nekt-scenario
3. Test resume etter app-lukking
4. Test voucher-utløp
5. Verifiser hydration fungerer

## Success Metrics

- Fullføringsrate: % av brukere som starter guide og fullfører
- Innløsningsrate: % av fullførte guider som innløses i resepsjon
- Drop-off-punkter: Hvilke stopp har høyest frafall

## Dependencies & Risks

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|--------------|------------|------------|
| GPS fungerer dårlig | Lav | Medium | 30s fallback |
| Bruker jukser med manuell markering | Medium | Lav | Belønning har lav verdi |
| localStorage fylles opp | Lav | Lav | Rydd opp gamle completions |
| Hotell glemmer å informere stab | Medium | Medium | Instruksjoner i voucher |

### Research Insights: Performance (fra Performance Oracle)

**GPS batteridrenering (KRITISK for 60-90 min tur):**

```typescript
// To-lags GPS-strategi for batterisparing
const GPS_CONFIG = {
  backgroundIntervalMs: 15_000,      // 15s mellom sjekk når ikke nær stopp
  proximityActivationRadius: 200,    // Aktiver kontinuerlig 200m før stopp
  verificationRadius: 50,            // Verifisering innenfor 50m
};

// Adaptiv accuracy basert på avstand til stopp
function useAdaptiveGeolocation(distanceToStop: number | null) {
  const [useHighAccuracy, setUseHighAccuracy] = useState(false);

  useEffect(() => {
    if (distanceToStop !== null && distanceToStop < 200) {
      setUseHighAccuracy(true);
    } else if (distanceToStop !== null && distanceToStop > 300) {
      setUseHighAccuracy(false);  // Hysterese forhindrer toggling
    }
  }, [distanceToStop]);

  return useHighAccuracy;
}
```

**Forventet batterisparing:** 40-60% sammenlignet med kontinuerlig høy-nøyaktighet GPS.

**Confetti ytelse på low-end enheter:**

```typescript
// Detekter low-end enhet
const isLowEndDevice =
  navigator.hardwareConcurrency <= 2 ||
  (navigator as any).deviceMemory <= 2;

// Reduser partikler på low-end
const particleCount = isLowEndDevice ? 30 : 100;
const ticks = isLowEndDevice ? 100 : 200;
```

### Research Insights: Security (fra Security Sentinel)

**Sårbarhet-matrise for MVP:**

| Sårbarhet | Sannsynlighet | Konsekvens | Mitigering |
|-----------|--------------|------------|------------|
| localStorage tampering | Medium | Lav | Enkel signatur (hever terskel) |
| GPS spoofing | Lav | Lav | Tidskrav som backup |
| Screenshot-deling | Medium | Medium | **Dynamisk tid på voucher** |
| Ingen backend-validering | N/A | Lav | Akseptabelt for MVP |

**Enkel signatur (optional, hever terskel):**

```typescript
const SALT = 'placy-guide-2026';
const dataString = JSON.stringify(state) + SALT;
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataString));
state.__sig = btoa(String.fromCharCode(...new Uint8Array(hash))).slice(0, 16);
```

**Konklusjon:** For 15% F&B rabatt er dette sikkerhetsnivået akseptabelt. Dynamisk tid på voucher er den viktigste mitigeringen.

## References & Research

### Interne referanser
- Brainstorm: `docs/brainstorms/2026-02-02-guide-gamification-brainstorm.md`
- Guide-prototype: `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md`
- Zustand persist: `lib/store.ts`
- localStorage TTL: `lib/hooks/useTravelTimes.ts:13-66`

### Eksisterende kode å bygge på
- `components/variants/guide/GuidePage.tsx:42` — completedStops state
- `components/variants/guide/GuideStopPanel.tsx:89` — "Merk som besøkt"-knapp
- `lib/hooks/useGeolocation.ts:15` — GPS hook
- `lib/utils.ts:45` — haversineDistance()

---

## Implementation Checklist (Full Feature Set)

### Fase 1: Data & Types
- [ ] Legg til `GuideId` branded type i `lib/types.ts`
- [ ] Legg til `RewardValidityDays` union type
- [ ] Legg til `StopCompletionRecord` interface
- [ ] Legg til `GuideCompletionState` interface
- [ ] Legg til `RewardConfig` interface
- [ ] Utvid `GuideConfig` med optional `reward`
- [ ] Oppdater `data/projects/visitnorway/10000-skritt-trondheim.json` med reward-data

### Fase 2: State Management
- [ ] Opprett `lib/hooks/useGuideCompletion.ts`
- [ ] Implementer Zustand store med persist middleware
- [ ] Implementer `markStopComplete(guideId, stopId, gpsVerified, coords?)`
- [ ] Implementer `isStopCompleted(guideId, stopId)`
- [ ] Implementer `isGuideCompleted(guideId)`
- [ ] Implementer `getCompletionStats(guideId)`
- [ ] Implementer `markCelebrationShown(guideId)`
- [ ] Implementer `markRedeemed(guideId)`
- [ ] Legg til version + migrate for fremtidige schema-endringer
- [ ] Legg til cleanup av gamle completions ved rehydration

### Fase 3: GPS Verifisering
- [ ] Opprett verification state machine type
- [ ] Implementer cancel token for 30s fallback timer
- [ ] Implementer GPS-sjekk (50m radius via `haversineDistance`)
- [ ] Integrer med eksisterende `useGeolocation` hook
- [ ] Håndter timer vs GPS race condition

### Fase 4: Intro Overlay
- [ ] Opprett `components/variants/guide/GuideIntroOverlay.tsx`
- [ ] Vis guidenavn og belønningsinfo
- [ ] "Start turen"-knapp
- [ ] Lagre at intro er sett (unngå gjentatt visning)
- [ ] Animert inngang (respekter reduced-motion)

### Fase 5: Completion Screen
- [ ] Opprett `components/variants/guide/GuideCompletionScreen.tsx`
- [ ] Opprett `components/variants/guide/confetti.ts` utility
- [ ] Konfetti-animasjon med canvas-confetti
- [ ] Respekter `prefers-reduced-motion`
- [ ] Badge/logo med "Fullført!"-banner
- [ ] Statistikk-kort (tid, stopp, dato)
- [ ] Voucher-kort med paper-tekstur og gull-border
- [ ] **Dynamisk tid** som oppdateres hvert sekund (anti-screenshot)
- [ ] "Vis i resepsjon"-instruksjon
- [ ] Cleanup confetti på unmount

### Fase 6: UI Oppdateringer
- [ ] Oppdater `GuideStopPanel.tsx` med GPS-indikator
- [ ] Vis "Du er her!" når innenfor 50m
- [ ] Vis countdown timer når fallback aktiv
- [ ] Oppdater "Merk som besøkt"-knapp states
- [ ] Integrer hydration guard i `GuidePage.tsx`
- [ ] Legg til fullført-deteksjon → vis CompletionScreen

### Fase 7: Testing
- [ ] Test offline-scenario (localStorage + GPS fungerer)
- [ ] Test GPS-nekt-scenario (fallback til 30s timer)
- [ ] Test resume etter app-lukking
- [ ] Test voucher-utløp (7 dager)
- [ ] Test hydration (ingen flash of incorrect content)
- [ ] Test confetti dobbel-trigger (celebrationShownAt flag)
- [ ] Test race condition: GPS ankommer mens timer kjører
