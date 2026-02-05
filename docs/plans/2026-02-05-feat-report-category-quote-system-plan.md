---
title: "feat: Report Category Quote System + Address Input"
type: feat
date: 2026-02-05
deepened: 2026-02-05
brainstorm: docs/brainstorms/2026-02-05-report-for-eiendom-brainstorm.md
---

# feat: Report Category Quote System + Address Input

## Enhancement Summary

**Deepened on:** 2026-02-05
**Research agents used:** TypeScript Reviewer, Performance Oracle, Architecture Strategist, Code Simplicity Reviewer, Frontend Race Conditions, Pattern Recognition, Best Practices, Mapbox Docs

### Key Improvements from Research

1. **Simplified scoring approach** — Consider starting with count-only scoring (MVP), add factors later
2. **Race condition mitigation** — AbortController + request ID pattern for all async operations
3. **URL-based state** — Address input stored in URL params for shareability
4. **Walk Score methodology** — Industry-standard distance decay function
5. **Server-side geocoding** — Use existing `/api/geocode` proxy, not client-side

### Critical Findings

- **Simplicity reviewer:** 4 weighted factors may be over-engineered for MVP
- **Race conditions:** 4 distinct race conditions identified with mitigation patterns
- **Architecture:** Use URL searchParams for address state (shareable links)
- **Performance:** Hybrid build-time/runtime approach for score calculation

---

## Overview

Utvide Report-produktet for eiendomsbransjen med to nye features:
1. **Kategori-quote system** — automatisk generert karakteristikk per tema basert på sammensatt score
2. **Adresse-input i transport** — bruker skriver inn sin adresse og får personlig reisetid

Målet er å gjøre Report mer overbevisende for boligkjøpere og næringsleietakere, med fokus på lead-generering.

## Problem Statement / Motivation

### Dagens utfordring
Eiendomsmarkedsføring bruker ofte:
- Statiske kart med "5 min til sentrum"-bobler
- Generiske tekstlister: "Nær kollektivtransport, skoler og butikker"
- Påstander som er vanskelige å verifisere

### Løsningen
Report kan tilføre verdi ved å:
- **Kvantifisere** nabolagets kvalitet med faktiske data (antall, ratings, avstand)
- **Personalisere** med brukerens egen adresse
- **Karakterisere** området med nyanserte quotes, ikke bare "bra/dårlig"

---

## Proposed Solution

### Feature 1: Kategori-quote system

**Sammensatt score (0-100) beregnes per tema:**

| Faktor | Vekt | Logikk |
|--------|------|--------|
| Antall POI-er | 30% | Flere = høyere score |
| Gjennomsnittlig rating | 25% | Høyere rating = høyere score |
| Nærhet (gangavstand) | 25% | Flere innen 5 min = høyere score |
| Variasjon (underkategorier) | 20% | Flere typer = høyere score |

**Quote genereres basert på score + variasjon:**

| Score | Quote-stil | Eksempel |
|-------|------------|----------|
| 90+ | Eksepsjonelt | "Matmekka med alt fra gatemat til fine dining" |
| 75-89 | Svært godt | "Rikt utvalg av mat og drikke i gangavstand" |
| 60-74 | Godt | "Godt utvalg av spisesteder" |
| 40-59 | Tilstrekkelig | "Noen utvalgte spisesteder" |
| < 40 | Begrenset | "Begrenset mattilbud i umiddelbar nærhet" |

#### Research Insights: Scoring

**Walk Score Methodology (Industry Standard):**
- Use distance decay function, not linear scaling
- Maximum points for amenities within 5-minute walk (400m)
- Zero points after 30-minute walk (2400m)
- Document methodology for transparency

**Simplification Option (MVP):**
```typescript
// Start simple, add complexity when needed
function getCategoryScore(pois: POI[], maxMinutes: number): number {
  return pois.filter(p => p.travelTime?.walk && p.travelTime.walk <= maxMinutes).length;
}
```

**Type-Safe Constants (from TypeScript review):**
```typescript
const SCORE_WEIGHTS = {
  count: 0.30,
  rating: 0.25,
  proximity: 0.25,
  variety: 0.20,
} as const satisfies Record<string, number>;

const SCORE_THRESHOLDS = {
  maxPOIsForFullScore: 10,
  maxWalkTimeMinutes: 15,
  minCategoriesForVariety: 1,
  maxCategoriesForFullVariety: 5,
} as const;
```

---

### Feature 2: Adresse-input i transport-seksjon

**Flyt:**
1. Bruker ser knapp "Sjekk din reisetid" i transport-seksjonen
2. Klikker → input-felt vises
3. Skriver adresse → får forslag (via `/api/geocode`)
4. Velger adresse → system beregner reisetid FRA brukerens adresse TIL eiendommen
5. Resultat vises med walk/bike/car-tider

#### Research Insights: Address Input

**Architecture Decision: URL State**
Store address in URL params for shareability:
```typescript
// ?from=Storgata+1,+Oslo
const searchParams = useSearchParams();
const address = searchParams.get("from") ?? "";
```

**Simplification Option (MVP):**
Skip autocomplete initially — simple input + search button:
```tsx
<form onSubmit={handleSearch}>
  <input value={address} onChange={e => setAddress(e.target.value)} />
  <button type="submit">Sjekk reisetid</button>
</form>
```

**Geocoding Best Practices:**
- Use existing `/api/geocode` route (hides API token)
- 300ms debounce for autocomplete
- Minimum 3 characters before search
- Country filter: `NO` for Norway
- Language: `no` for Norwegian results

---

## Technical Considerations

### Eksisterende infrastruktur som gjenbrukes

| Komponent | Fil | Beskrivelse |
|-----------|-----|-------------|
| `richnessScore` | `report-data.ts:123-124` | Eksisterende score-logikk |
| `ReportThemeStats` | `report-data.ts:20-30` | Har totalPOIs, avgRating, editorialCount |
| `useTravelTimes` | `lib/hooks/useTravelTimes.ts` | Batch travel times med caching |
| `/api/geocode` | `app/api/geocode/route.ts` | Geocoding proxy (eksisterer!) |
| `/api/travel-times` | `app/api/travel-times/route.ts` | Matrix API proxy |

### Nye komponenter som trengs

```
lib/
├── utils/
│   └── category-score.ts          # calculateCategoryScore(), generateCategoryQuote()
│
├── hooks/
│   └── useSingleTravelTime.ts     # For address → property travel time
│
components/variants/report/
├── ReportCategoryQuote.tsx        # Quote-visning i tema-seksjon
├── ReportAddressInput.tsx         # Input med autocomplete (Report-prefiks!)
└── ReportTravelTimeDisplay.tsx    # Resultat-visning (unngå navnekollisjon)
```

### Data flow for score-beregning

#### Research Insight: Hybrid Approach

**Problem:** Travel times er asynkrone, men score-beregning skjer synkront.

**Løsning:** To-fase beregning:

```
Phase 1 (Build-time/SSR):
transformToReportData()
  → Calculate base score (count, rating, variety) = 75% weight
  → Fallback proximityScore = 50

Phase 2 (Client-side, after travel times load):
useMemo(() => {
  if (travelTimesLoading) return themes;
  return themes.map(t => ({
    ...t,
    score: calculateCategoryScore({
      ...t.stats,
      avgWalkTimeMinutes: calculateAvgWalkTime(t.allPOIs),
    }),
  }));
}, [themes, travelTimesLoading]);
```

---

## Race Condition Mitigation

### Identified Race Conditions (from Frontend Races review)

| Race Condition | Scenario | Mitigation |
|----------------|----------|------------|
| **Stale suggestions** | User types fast, old results arrive after new request | Request ID stamp + AbortController |
| **Selection during flight** | User clicks suggestion while previous geocode pending | Abort previous, state machine |
| **Address change mid-calculation** | User clears input while travel time calculating | Cancel on input change |
| **Unmount during flight** | Navigate away while request pending | Cleanup in useEffect return |

### Required Pattern: Request ID + AbortController

```typescript
const searchRequestIdRef = useRef(0);
const abortControllerRef = useRef<AbortController | null>(null);

const searchAddress = useCallback(async (query: string) => {
  // Cancel previous request
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();

  // Stamp this request
  const requestId = ++searchRequestIdRef.current;

  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
      signal: abortControllerRef.current.signal
    });
    const data = await res.json();

    // CRITICAL: Only update if this is still the latest request
    if (requestId !== searchRequestIdRef.current) return;

    setSuggestions(data.features || []);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    if (requestId === searchRequestIdRef.current) setError('Search failed');
  }
}, []);

// Cleanup on unmount
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

### State Machine for Selection Flow

```typescript
type SelectionState =
  | { status: 'idle' }
  | { status: 'geocoding'; query: string }
  | { status: 'calculating'; coordinates: Coordinates }
  | { status: 'complete'; coordinates: Coordinates; travelTime: TravelTimeResult }
  | { status: 'error'; message: string };
```

---

## Acceptance Criteria

### Feature 1: Kategori-quote

- [x] Hver tema-seksjon viser en automatisk generert quote
- [x] Quote reflekterer områdets faktiske karakteristikk (ikke generisk)
- [x] Score beregnes basert på antall, rating, nærhet, variasjon
- [x] Quote vises under tema-header, før POI-kort
- [x] Fungerer på desktop og mobil
- [x] **NEW:** Score breakdown kan vises (transparency)
- [x] **NEW:** Håndterer edge case: alle POI-er mangler rating

### Feature 2: Adresse-input

- [x] Knapp "Sjekk din reisetid" vises i transport-seksjonen
- [x] Autocomplete fungerer med norske adresser (via `/api/geocode`)
- [x] Reisetid beregnes og vises for walk/bike/car
- [x] Loading-tilstand vises under beregning
- [x] Feilhåndtering ved ugyldig adresse
- [x] Fungerer på desktop og mobil
- [x] **NEW:** URL oppdateres med `?from=adresse` (shareable)
- [x] **NEW:** Ingen race conditions (stale data, cancelled requests)
- [x] **NEW:** Keyboard navigation for autocomplete (WCAG)

### Kvalitetskrav

- [x] Ingen flimring av skeleton/loading
- [x] Quote-tekst er meningsfull og grammatisk korrekt
- [x] Adresse-input har god mobil-UX (tastatur, dropdown)
- [x] **NEW:** 300ms debounce på geocoding
- [x] **NEW:** Min 3 tegn før søk starter

---

## Performance Considerations

### Score Calculation
- **Complexity:** O(P) where P = total POIs — negligible
- **When to calculate:** In `useMemo` with `[project]` dependency
- **Travel time dependency:** Use hybrid approach (base score + enhancement)

### Geocoding
- **Debounce:** 300ms (industry standard)
- **Cache:** In-memory Map with 50-entry LRU limit
- **Rate limit:** 600 req/min (Mapbox v5), handle 429 with retry

### Travel Time (Single Point)
- **API choice:** Use Directions API (300 req/min) not Matrix (60 req/min)
- **Parallel fetch:** All 3 modes simultaneously
- **No caching:** Session-only, fresh results per user

---

## Success Metrics

1. **Engagement:** Andel brukere som bruker adresse-input
2. **Lead-kvalitet:** Brukere som interagerer er mer sannsynlig seriøse
3. **Kundefeedback:** Eiendomsaktører opplever Report som mer overbevisende

---

## Dependencies & Risks

### Dependencies
- Mapbox Geocoding API (via `/api/geocode` proxy)
- Mapbox Directions API (for single point-to-point travel time)
- Eksisterende travel time-infrastruktur

### Risks

| Risk | Sannsynlighet | Mitigering |
|------|---------------|------------|
| Geocoding gir dårlige resultater | Medium | Begrens til Norge (`country=NO`), vis feilmelding |
| Score føles "feil" for noen områder | Medium | Justerbare vekter, manuell override, vis breakdown |
| Quote-tekst blir generisk | Lav | Variasjon-baserte templates, seeded randomness |
| Race conditions i address input | Medium | AbortController + request ID pattern |
| **NEW:** Rate limiting (429) | Lav | Exponential backoff, user-friendly error |

---

## Åpne spørsmål (avklart via research)

### Kritiske (LØST)

**Q1: Hvordan beregnes "nærhet"?**
- **Løsning:** Bruk gjennomsnittlig `travelTime.walk` i minutter
- **Normalisering:** Distance decay function (Walk Score-inspirert)
- 0-5 min = 100 poeng, 15+ min = 0 poeng

**Q2: Hvordan defineres "variasjon"?**
- **Løsning:** Tell unike `category.id` verdier innenfor tema
- **Normalisering:** 1 type = 0 poeng, 5+ typer = 100 poeng
- **Bug fix:** Håndter `uniqueCategories = 0` (clamp til 0)

**Q3: Quote-source — templates eller AI?**
- **Løsning:** Templates med variasjon-pools
- Seeded randomness for konsistens per prosjekt
- Fallback templates for ukjente temaer

**Q4: Reisetid-retning for adresse-input?**
- **Løsning:** FRA brukerens adresse TIL eiendommen (pendler-perspektiv)

### Viktige (LØST)

**Q5: Hvor vises quote i UI?**
- **Løsning:** Under tema-header, over POI-kort (nytt felt `theme.quote`)

**Q6: Hva trigger adresse-input UI?**
- **Løsning:** Knapp "Sjekk din reisetid" i transport-seksjon header

**Q7: Skal adresse-input påvirke alle temaer eller bare transport?**
- **Løsning:** Kun transport-seksjonen

**Q8: Skal resultat lagres (URL/localStorage)?**
- **Løsning:** URL searchParams (`?from=...`) for shareability

---

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-05-report-for-eiendom-brainstorm.md`
- Score-logikk: `components/variants/report/report-data.ts:123-124`
- Travel times hook: `lib/hooks/useTravelTimes.ts`
- Theme section: `components/variants/report/ReportThemeSection.tsx`
- Geocode API: `app/api/geocode/route.ts`

### Learnings
- Skeleton loading: `docs/solutions/ux-loading/skeleton-loading-report-map-20260204.md`
- State machine pattern: `docs/solutions/ux-loading/skeleton-loading-explorer-20260204.md`

### External References
- Walk Score Methodology: https://www.walkscore.com/methodology.shtml
- Mapbox Geocoding API: https://docs.mapbox.com/api/search/geocoding/
- Mapbox Matrix API: https://docs.mapbox.com/api/navigation/matrix/
- WAI-ARIA Combobox: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

---

## Implementeringsforslag (Forbedret)

### Fase 1: Score-beregning (type-safe)

```typescript
// lib/utils/category-score.ts

// Named constants (no magic numbers)
const SCORE_WEIGHTS = {
  count: 0.30,
  rating: 0.25,
  proximity: 0.25,
  variety: 0.20,
} as const;

const THRESHOLDS = {
  maxPOIsForFullScore: 10,
  maxWalkTimeMinutes: 15,
  maxCategoriesForVariety: 5,
} as const;

const DEFAULT_SCORE_WHEN_NO_DATA = 50;

// Individual score functions (testable)
export function normalizeCount(totalPOIs: number): number {
  return Math.min(100, (totalPOIs / THRESHOLDS.maxPOIsForFullScore) * 100);
}

export function normalizeRating(avgRating: number | null): number {
  return avgRating !== null ? (avgRating / 5) * 100 : DEFAULT_SCORE_WHEN_NO_DATA;
}

export function normalizeProximity(avgWalkMinutes: number | null): number {
  if (avgWalkMinutes === null) return DEFAULT_SCORE_WHEN_NO_DATA;
  return Math.max(0, 100 - (avgWalkMinutes / THRESHOLDS.maxWalkTimeMinutes) * 100);
}

export function normalizeVariety(uniqueCategories: number): number {
  const adjusted = Math.max(0, uniqueCategories - 1);
  return Math.min(100, (adjusted / (THRESHOLDS.maxCategoriesForVariety - 1)) * 100);
}

// Main function (composition)
export interface CategoryScoreInput {
  totalPOIs: number;
  avgRating: number | null;
  avgWalkTimeMinutes: number | null;
  uniqueCategories: number;
}

export interface CategoryScoreBreakdown {
  readonly count: number;
  readonly rating: number;
  readonly proximity: number;
  readonly variety: number;
}

export interface CategoryScore {
  readonly total: number;
  readonly breakdown: CategoryScoreBreakdown;
}

export function calculateCategoryScore(input: CategoryScoreInput): CategoryScore {
  const breakdown: CategoryScoreBreakdown = {
    count: Math.round(normalizeCount(input.totalPOIs)),
    rating: Math.round(normalizeRating(input.avgRating)),
    proximity: Math.round(normalizeProximity(input.avgWalkTimeMinutes)),
    variety: Math.round(normalizeVariety(input.uniqueCategories)),
  };

  const total = Math.round(
    breakdown.count * SCORE_WEIGHTS.count +
    breakdown.rating * SCORE_WEIGHTS.rating +
    breakdown.proximity * SCORE_WEIGHTS.proximity +
    breakdown.variety * SCORE_WEIGHTS.variety
  );

  return { total, breakdown };
}
```

### Fase 2: Quote-generering (med fallbacks)

```typescript
// lib/utils/category-score.ts (continued)

const QUOTE_LEVELS = ["exceptional", "very_good", "good", "sufficient", "limited"] as const;
type QuoteLevel = typeof QUOTE_LEVELS[number];

// Default fallbacks for any theme
const DEFAULT_TEMPLATES: Record<QuoteLevel, string> = {
  exceptional: "Eksepsjonelt tilbud i området",
  very_good: "Svært godt tilbud i området",
  good: "Godt tilbud i området",
  sufficient: "Tilstrekkelig tilbud i området",
  limited: "Begrenset tilbud i umiddelbar nærhet",
};

const QUOTE_TEMPLATES: Record<string, Record<QuoteLevel, string[]>> = {
  food: {
    exceptional: [
      "Matmekka med alt fra gatemat til fine dining",
      "Et område som bugner av matopplevelser",
    ],
    very_good: [
      "Rikt utvalg av mat og drikke i gangavstand",
      "Solid matscene med varierte muligheter",
    ],
    good: ["Godt utvalg av spisesteder"],
    sufficient: ["Noen utvalgte spisesteder"],
    limited: ["Begrenset mattilbud i umiddelbar nærhet"],
  },
  transport: {
    exceptional: ["Knutepunkt med alle transportformer"],
    very_good: ["Svært godt utvalg av transportmuligheter"],
    good: ["God kollektivdekning"],
    sufficient: ["Tilgang til kollektivtransport"],
    limited: ["Begrenset kollektivtilbud"],
  },
  // Add more themes...
};

function getQuoteLevel(score: number): QuoteLevel {
  if (score >= 90) return "exceptional";
  if (score >= 75) return "very_good";
  if (score >= 60) return "good";
  if (score >= 40) return "sufficient";
  return "limited";
}

// Seeded random for consistency
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function generateCategoryQuote(
  themeId: string,
  score: number,
  variety: number,
  seed?: string
): string {
  const level = getQuoteLevel(score);
  const templates = QUOTE_TEMPLATES[themeId]?.[level];

  if (!templates || templates.length === 0) {
    return DEFAULT_TEMPLATES[level];
  }

  // Select based on variety or seed
  const index = seed
    ? Math.abs(hashCode(seed)) % templates.length
    : variety > 3 ? 0 : Math.min(1, templates.length - 1);

  return templates[index];
}
```

### Fase 3: Adresse-input med race condition håndtering

```typescript
// components/variants/report/ReportAddressInput.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

interface TravelTimeResult {
  walk: number | null;
  bike: number | null;
  car: number | null;
}

type SelectionState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "suggestions"; items: Suggestion[] }
  | { status: "calculating"; address: string }
  | { status: "complete"; result: TravelTimeResult }
  | { status: "error"; message: string };

interface ReportAddressInputProps {
  propertyCoordinates: [number, number];
}

export function ReportAddressInput({ propertyCoordinates }: ReportAddressInputProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState(searchParams.get("from") ?? "");
  const [state, setState] = useState<SelectionState>({ status: "idle" });

  // Abort controllers
  const searchAbortRef = useRef<AbortController | null>(null);
  const selectionAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
      selectionAbortRef.current?.abort();
    };
  }, []);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setState({ status: "idle" });
      return;
    }

    searchAbortRef.current?.abort();
    searchAbortRef.current = new AbortController();
    const requestId = ++searchRequestIdRef.current;

    setState({ status: "searching" });

    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(searchQuery)}&country=NO&language=no`,
        { signal: searchAbortRef.current.signal }
      );
      const data = await res.json();

      if (requestId !== searchRequestIdRef.current) return;

      setState({
        status: "suggestions",
        items: data.features?.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
        })) ?? [],
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (requestId === searchRequestIdRef.current) {
        setState({ status: "error", message: "Kunne ikke søke etter adresse" });
      }
    }
  }, 300);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    selectionAbortRef.current?.abort();
    debouncedSearch(value);
  }, [debouncedSearch]);

  const handleSelectSuggestion = useCallback(async (suggestion: Suggestion) => {
    selectionAbortRef.current?.abort();
    selectionAbortRef.current = new AbortController();

    setState({ status: "calculating", address: suggestion.place_name });
    setQuery(suggestion.place_name);

    // Update URL
    const params = new URLSearchParams(searchParams);
    params.set("from", suggestion.place_name);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });

    try {
      const [lng, lat] = suggestion.center;
      const [propLng, propLat] = propertyCoordinates;

      // Fetch all modes in parallel
      const profiles = ["walking", "cycling", "driving"] as const;
      const times = await Promise.all(
        profiles.map(async (profile) => {
          const res = await fetch(
            `/api/directions?` +
            `origin=${lng},${lat}&destination=${propLng},${propLat}&profile=${profile}`,
            { signal: selectionAbortRef.current!.signal }
          );
          const data = await res.json();
          return data.routes?.[0]?.duration
            ? Math.ceil(data.routes[0].duration / 60)
            : null;
        })
      );

      if (selectionAbortRef.current?.signal.aborted) return;

      setState({
        status: "complete",
        result: { walk: times[0], bike: times[1], car: times[2] },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState({ status: "error", message: "Kunne ikke beregne reisetid" });
    }
  }, [propertyCoordinates, searchParams, router, pathname]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Skriv inn din adresse..."
        className="w-full px-4 py-2 border rounded-lg"
        aria-autocomplete="list"
        aria-expanded={state.status === "suggestions"}
      />

      {state.status === "searching" && (
        <div className="mt-2 text-sm text-gray-500">Søker...</div>
      )}

      {state.status === "suggestions" && state.items.length > 0 && (
        <ul role="listbox" className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
          {state.items.map((item) => (
            <li
              key={item.id}
              role="option"
              onClick={() => handleSelectSuggestion(item)}
              className="px-4 py-2 cursor-pointer hover:bg-gray-100"
            >
              {item.place_name}
            </li>
          ))}
        </ul>
      )}

      {state.status === "calculating" && (
        <div className="mt-2 text-sm text-gray-500">Beregner reisetid...</div>
      )}

      {state.status === "complete" && (
        <div className="mt-4 grid grid-cols-3 gap-4">
          {state.result.walk !== null && (
            <div className="text-center">
              <div className="text-2xl font-bold">{state.result.walk} min</div>
              <div className="text-sm text-gray-500">Gange</div>
            </div>
          )}
          {state.result.bike !== null && (
            <div className="text-center">
              <div className="text-2xl font-bold">{state.result.bike} min</div>
              <div className="text-sm text-gray-500">Sykkel</div>
            </div>
          )}
          {state.result.car !== null && (
            <div className="text-center">
              <div className="text-2xl font-bold">{state.result.car} min</div>
              <div className="text-sm text-gray-500">Bil</div>
            </div>
          )}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-2 text-sm text-red-500">{state.message}</div>
      )}
    </div>
  );
}
```

---

## Sjekkliste før implementering

- [x] Installer `use-debounce` pakke
- [x] Verifiser at `/api/geocode` støtter `country` og `language` params
- [x] Opprett `/api/directions` endpoint hvis den ikke finnes (for single point-to-point)
- [ ] Legg til unit tests for `calculateCategoryScore()` med edge cases
- [ ] Test autocomplete med norske tegn (æ, ø, å)
- [ ] Test på mobil (tastatur, dropdown plassering)
- [x] Verifiser WCAG compliance for autocomplete (keyboard nav)

---

*Plan opprettet 2026-02-05, deepened 2026-02-05*
