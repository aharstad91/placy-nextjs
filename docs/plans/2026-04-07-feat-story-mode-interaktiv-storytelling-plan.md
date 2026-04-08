---
title: "feat: Story Mode — Interaktiv storytelling for boligkjøpere"
type: feat
date: 2026-04-07
brainstorm: docs/brainstorms/2026-04-07-interaktiv-storytelling-brainstorm.md
deepened: 2026-04-07
---

## Enhancement Summary

**Deepened on:** 2026-04-07
**Research agents used:** 8 (frontend-design, best-practices, framework-docs, kieran-typescript, performance-oracle, architecture-strategist, pattern-recognition, julik-frontend-races)

### Key Improvements
1. **Proper discriminated union** — `StoryBlock` redesignet som ekte TypeScript discriminated union med separate interfaces per variant
2. **Delt IntersectionObserver** — Én observer for alle blokker (ikke per-element), med "scrolled past" fallback for raske scrollere
3. **Race condition-sikring** — Synkron ref-guard mot double-click, state machine for accordion, blokk-ID scroll-persistence
4. **Komplett UI-spec** — Tailwind-klasser, fargesystem, spacing og animasjoner for alle 8 komponenttyper
5. **Arkitektur avklart** — View mode via `ALWAYS_AVAILABLE_MODES`, React `useState` (ikke Zustand), switch-case med `assertNever`

### New Considerations Discovered
- `byTierThenScore` og `haversineMeters` må flyttes til `lib/utils/` for å unngå cross-variant import
- Mapbox Static Images: bruk `unoptimized` med `next/image` (allerede riktig størrelse)
- `content-visibility: auto` på passerte blokker for ytelse ved 80+ elementer
- `robots: { index: false }` i metadata for å unngå duplisert innhold med Explorer/Report

---

# Story Mode — Interaktiv storytelling for boligkjøpere

## Overview

En ny frittstående opplevelse under eiendom-produktet der områdeinnhold presenteres som **interaktiv scrollytelling** — en hybrid feed med chat-lignende tekstelementer, rike POI-kort, kart-snippets og valgknapper som lar brukeren forme reisen.

Konseptet heter **"conversational scrollytelling"**: pre-komponert innhold som avdekkes progressivt med brukervalg underveis. Ingen fri tekstinput, ingen runtime LLM-kall.

**URL:** `/eiendom/[customer]/[project]/story`

## Problem Statement / Motivasjon

Dagens Report viser alt på en gang — en lang, informasjonstett side. Boligkjøpere som mottar en megler-lenke møter en vegg av data uten narrativ eller personalisering.

Story Mode løser dette med:
1. **Progressiv avsløring** — innhold avdekkes steg for steg, skaper nysgjerrighet
2. **Personalisering via valg** — brukeren velger tema og former reisen
3. **Mobil-native estetikk** — chat-lignende layout som føles moderne og engasjerende
4. **Lavere terskel** — lettere å konsumere enn en komplett rapport

## Arkitekturbeslutninger

Avklart via brainstorm + SpecFlow-analyse + 8 review-agenter:

| Spørsmål | Beslutning | Begrunnelse |
|----------|-----------|-------------|
| Produkttype? | **View mode** via `ALWAYS_AVAILABLE_MODES` (som Visning) | Gjenbruker explorer POI-data, ingen ny DB-schema. Vises som tab i ProductNav. |
| POI-utvelgelse? | **`byTierThenScore`** med `trustScore`-filtrering | Samme som Report — viser de beste stedene først. |
| Tema-velger? | **Single-select** — velg ett tema først | Skaper lineær narrativ. Neste tema tilbys via ChoicePrompt. |
| Tomme temaer? | **Skjul temaer med < 2 POI-er** | Matcher Report's `THEME_MIN_POIS = 2`. |
| Mikro-valg? | **Genuint interaktive** — endrer strømmen | Klient-side state driver hvilke blokker som vises. |
| ChatBubble-innhold? | **Template-basert** via eksisterende i18n-system | `interpolate()` fra `lib/i18n/strings.ts`. Ingen editorial-avhengighet. |
| Kart? | **Statiske Mapbox-bilder** med `next/image unoptimized` | Unngår Mapbox GL JS (~200KB). Allerede i `remotePatterns`. |
| POI-utvidelse? | **Inline accordion** med `grid-template-rows: 0fr/1fr` | GPU-vennlig, ingen height-beregning. |
| Desktop-layout? | **Sentrert kolonne** (`max-w-xl` = 576px) | Mobil-først. Chat-kolonne med generous whitespace. |
| Minimum data? | **≥ 2 temaer med ≥ 2 POI-er** | Under dette → `redirect()` til Explorer. |
| Deep linking? | **`?theme=barn-oppvekst`** lest server-side | `searchParams` er Promise i Next.js 14.2+. |
| Scroll-posisjon? | **Blokk-ID i sessionStorage** (ikke pikseloffset) | Robust mot layout-endringer ved dynamisk innhold. |
| Story state? | **`localStorage`** med 30 dagers expiry | Besøkte temaer og valg overlever tab-lukking. |
| State management? | **React `useState`** (ikke Zustand) | Ephemeral view-state, matcher Explorer/Report mønster. |
| Animasjoner? | **Kun `transform` + `opacity`** (S-tier GPU) | `prefers-reduced-motion` → instant visibility. |
| SEO? | **`robots: { index: false, follow: false }`** | Unngår duplisert innhold med Explorer/Report. |
| Block rendering? | **Switch-case med `assertNever`** | Exhaustiveness checking, greppbar. |

## Proposed Solution

### Story-rytme (template)

```
INTRO
  → ChatBubble: "La oss utforske området rundt [adresse]"
  → FactBubble: "[N] steder innen gangavstand"

TEMA-VELGER
  → StoryThemeSelector (single-select, radio semantics)

PER TEMA (gjentas for hvert valgt tema):
  → ThemeBridge: ikon + separator + tema-intro
  → ChatBubble: "Her er de beste [tema]-stedene i nærheten"
  → StoryPOICard × 3 (scroll-reveal, én om gangen)
  → FactBubble: "[N] [kategori] innen [avstand]"
  → ChoicePrompt: "Se flere?" / "Neste tema" / "Oppsummering"
  → (Hvis "Se flere") → StoryPOICard × 3 + ny ChoicePrompt
  → MapReveal: Statisk kart med alle tema-POI-er

OPPSUMMERING
  → ChatBubble: "Her er området ditt oppsummert"
  → StorySummary: 2-kolonne grid med highlights per tema
  → CTA: "Utforsk mer i Explorer" / "Se full rapport"
```

### Komponenttyper (med UI-spec)

| Komponent | Layout | Bredde | Nøkkel-detalj |
|-----------|--------|--------|----------------|
| `StoryChatBubble` | Venstrejustert med Placy-avatar (P i charcoal sirkel) | `max-w-[85%]` | `rounded-tl-md` for chat-tail |
| `StoryPOICard` | Full-bredde kort med 16:9 bilde + inline accordion | 100% | `grid-template-rows: 0fr/1fr` for expand |
| `StoryMapReveal` | Full-bredde statisk kart med fade-in | 100% | Venter på bilde-load FØR fade-in |
| `StoryChoicePrompt` | Høyrejustert knapper (som "brukerens svar") | `max-w-[80%]` | `rounded-br-md`, synkron ref-guard |
| `StoryFactBubble` | Venstrejustert med tema-ikon | `max-w-[75%]` | Stor tall + liten label, `tabular-nums` |
| `StoryThemeBridge` | Sentrert separator med ikon mellom linjer | 100% | `py-8` for visuell pause |
| `StorySummary` | 2-kolonne grid med tema-highlights + CTA-er | 100% | Favoritt-POI per tema, snitt gangavstand |
| `StoryThemeSelector` | Vertikal liste, radio semantikk | 100% | Besøkte temaer greyed + checkmark |

### Visuell stil — "Editorial conversation"

**Fargesystem (alle eksisterende, ingen nye):**

| Token | Hex | Bruk |
|-------|-----|------|
| Side-bakgrunn | `#faf9f7` | Varm parchment |
| Kort-bakgrunn | `#ffffff` | Bobler, kort |
| Primær border | `#eae6e1` | Alle kort-kanter |
| Primær tekst | `#1a1a1a` | Overskrifter, CTA |
| Sekundær tekst | `#6a6a6a` | Brødtekst, hooks |
| Muted label | `#a0937d` | "Placy", "Favoritt" |
| Tema-aksent | `theme.color` | Ikon-sirkler (inline `style={}`) |
| Tema-aksent 18% | `theme.color + '18'` | Ikon-bakgrunner |

**Page container:**
```html
<main class="min-h-screen bg-[#faf9f7]">
  <div class="max-w-xl mx-auto px-4 py-8 md:py-16">
    <!-- Alle story-blokker -->
  </div>
</main>
```

### Type-system (ekte discriminated union)

```typescript
// lib/story/types.ts

interface StoryBlockBase {
  readonly id: string;
}

interface ChatBlock extends StoryBlockBase {
  readonly type: "chat";
  readonly text: string;
  readonly showAvatar?: boolean;
}

interface POIBlock extends StoryBlockBase {
  readonly type: "poi";
  readonly poi: POI;
  readonly preRevealed?: boolean; // For deep-linked themes
}

interface MapBlock extends StoryBlockBase {
  readonly type: "map";
  readonly pois: POI[];
  readonly center: Coordinates;
  readonly themeColor: string;
  readonly staticMapUrl: string; // Pre-built server-side
}

interface ChoiceBlock extends StoryBlockBase {
  readonly type: "choice";
  readonly options: readonly ChoiceOption[];
}

interface FactBlock extends StoryBlockBase {
  readonly type: "fact";
  readonly icon: string;
  readonly number: number;
  readonly label: string;
  readonly themeColor: string;
}

interface BridgeBlock extends StoryBlockBase {
  readonly type: "bridge";
  readonly themeId: BoligThemeId;
  readonly themeName: string;
  readonly themeIcon: string;
  readonly themeColor: string;
  readonly bridgeText: string;
}

interface SummaryBlock extends StoryBlockBase {
  readonly type: "summary";
  readonly themes: readonly SummaryTheme[];
}

type StoryBlock =
  | ChatBlock
  | POIBlock
  | MapBlock
  | ChoiceBlock
  | FactBlock
  | BridgeBlock
  | SummaryBlock;

// Exhaustiveness guard
function assertNever(x: never): never {
  throw new Error(`Unexpected block type: ${JSON.stringify(x)}`);
}

// Theme ID literal union
type BoligThemeId =
  | "barn-oppvekst"
  | "hverdagsliv"
  | "mat-drikke"
  | "opplevelser"
  | "natur-friluftsliv"
  | "trening-aktivitet"
  | "transport-mobilitet";

// Type-safe template keys
type TemplateKey =
  | "projectName" | "address" | "poiName"
  | "poiCategory" | "travelTime" | "themeName"
  | "poiCount" | "themePoiCount";

type TemplateVars = Partial<Record<TemplateKey, string>>;
```

### Data-transformasjon

```typescript
// lib/story/compose-story-blocks.ts

interface StoryComposition {
  readonly intro: readonly StoryBlock[];
  readonly themes: readonly ThemeDefinition[];
  readonly getThemeBlocks: (themeId: string) => readonly StoryBlock[];
  readonly getSummary: (visitedThemes: readonly string[]) => readonly StoryBlock[];
}

function composeStoryBlocks(
  project: Project,
  themes: ThemeDefinition[],
  locale: string,
  staticMapUrls: Record<string, string>, // Pre-built server-side
): StoryComposition
```

Ren funksjon, klient-side. Kalles i `useMemo()` i `StoryPage`. Statiske kart-URL-er bygges server-side i `page.tsx` med `getStaticMapUrlMulti()`.

### Block renderer

```typescript
function renderBlock(block: StoryBlock) {
  switch (block.type) {
    case "chat":    return <StoryChatBubble key={block.id} text={block.text} showAvatar={block.showAvatar} />;
    case "poi":     return <StoryPOICard key={block.id} poi={block.poi} />;
    case "map":     return <StoryMapReveal key={block.id} staticMapUrl={block.staticMapUrl} pois={block.pois} themeColor={block.themeColor} />;
    case "choice":  return <StoryChoicePrompt key={block.id} options={block.options} onChoose={handleChoice} />;
    case "fact":    return <StoryFactBubble key={block.id} icon={block.icon} number={block.number} label={block.label} themeColor={block.themeColor} />;
    case "bridge":  return <StoryThemeBridge key={block.id} themeName={block.themeName} themeIcon={block.themeIcon} themeColor={block.themeColor} bridgeText={block.bridgeText} />;
    case "summary": return <StorySummary key={block.id} themes={block.themes} />;
    default:        return assertNever(block);
  }
}
```

## Technical Considerations

### Gjenbruk fra eksisterende kode

| Hva | Fra | Tilpasning |
|-----|-----|------------|
| Data loading | `rapport/page.tsx` server component | Kopier mønster, kall `getProductAsync("explorer")` |
| POI-gruppering | Ny `lib/utils/theme-grouping.ts` | Ekstraher fra `report-data.ts`, del mellom Report og Story |
| POI-scoring | Ny `lib/utils/poi-score.ts` → `byTierThenScore` | Flytt fra `report-data.ts` (unngå cross-variant import) |
| Haversine | `lib/utils.ts` → `haversineDistance()` | Gjenbruk direkte (ikke kopier `haversineMeters` fra report) |
| Tema-definisjoner | `bransjeprofiler.ts` → `getBransjeprofil` | Gjenbruk direkte |
| Kart-URL | `lib/mapbox-static.ts` → `getStaticMapUrlMulti` | Gjenbruk direkte, bygg URL-er server-side |
| i18n templates | `lib/i18n/strings.ts` → `interpolate()` | Gjenbruk for template-tekster |
| White-label | Layout CSS custom properties | Arves automatisk |
| URL-helper | `lib/urls.ts` → `eiendomUrl()` | Legg til `"story"` som mode |

### Documented gotchas (fra docs/solutions/ + review-agenter)

1. **IntersectionObserver:** Bruk `intersectionRect.height`, ikke `intersectionRatio`. Én delt observer for alle blokker.
2. **Fast-scroll fallback:** Sjekk `entry.boundingClientRect.top < entry.rootBounds.bottom` — elementer som ble scrollet forbi uten callback skal også reveals.
3. **CSS keyframes:** Prefix med `story-` (f.eks. `story-block-reveal`). Duplikate `@keyframes`-navn overwriter hverandre stille.
4. **Mapbox import shadowing:** `react-map-gl/mapbox` eksporterer `Map` som shadower `globalThis.Map` — irrelevant for Story (bruker statiske bilder).
5. **Tailwind dynamiske farger:** Bruk `style={{ borderColor: theme.color }}`, aldri `border-[${color}]`.
6. **Accordion:** `grid-template-rows: 0fr/1fr` i stedet for `max-height` — GPU-vennlig, ingen height-beregning.
7. **Double-click guard:** Synkron `useRef`-guard på ChoicePrompt — React batching er for tregt.
8. **MapReveal timing:** Vent på bilde-load OG in-view FØR fade-in animasjon.
9. **`<img>` i Portrait:** `PortraitContextMap` bruker `<img>` — IKKE kopier dette. Bruk `next/image unoptimized`.
10. **Mapbox static `unoptimized`:** Bildet er allerede riktig størrelse — skip Next.js Image Optimization.

### Scroll-system (3 utilities å bygge først)

**1. Delt reveal-observer (`lib/hooks/useScrollReveal.ts`):**
```typescript
// Én IntersectionObserver for alle story-blokker
// - One-shot: observe → add "revealed" class → unobserve
// - Fast-scroll fallback: reveal hvis scrollet forbi
// - prefers-reduced-motion: reveal umiddelbart
// - Cleanup: disconnect() ved unmount
```

**2. Interaksjons-state-machine:**
```typescript
// Forhindrer konflikter mellom:
// - Double-click på ChoicePrompt (synkron ref-guard)
// - To accordions som animerer samtidig (bare én om gangen)
// - Observer-firing under DOM-mutasjon (grace period etter theme-inject)
```

**3. Blokk-basert scroll-persistence (`lib/hooks/useStoryProgress.ts`):**
```typescript
// sessionStorage: siste synlige blokk-ID (ikke pikseloffset)
// localStorage: besøkte temaer + valg (med 30d expiry)
// Restore: scrollIntoView(blockId) med double-rAF
// Deep link: pre-reveal blokker, skip intro, instant scroll
```

### Performance

| Bekymring | Strategi | Budget |
|-----------|----------|--------|
| Observer-proliferasjon | Én delt observer, ikke per-element | 1 IntersectionObserver totalt |
| Bilde-waterfall | `priority` på 3 første bilde-bærende blokker, `sizes` overalt | LCP < 2.5s på 4G |
| DOM-vekst | `React.memo()` på alle 7 blokk-typer, `useReducer` for blokk-liste | < 5ms per append |
| Off-screen ytelse | `content-visibility: auto` på passerte blokker | < 1500 aktive DOM-noder |
| GPU-lag | `will-change` kun på urevealed, fjern etter animasjon | < 5 samtidige GPU-lag |
| Animasjon | Kun `transform` + `opacity` (S-tier GPU) | 60fps på mid-range Android |
| Bundle | Ingen mapbox-gl import, ingen nye dependencies | < 5KB gzipped tillegg |
| Mapbox API | `unoptimized` via `next/image`, CDN-cache 12t | < 1250 req/min |
| Scroll-handler | sessionStorage med rAF-throttle, kun blokk-ID | < 1ms per frame |

### Race condition-sikring

| Race | Symptom | Prevention |
|------|---------|------------|
| Observer leaked on unmount | Memory leak, stale DOM refs | Single shared observer med `disconnect()` cleanup |
| Fast scroll miss | Usynlige hull i feeden | `boundingClientRect.top` fallback |
| ChoicePrompt double-click | To temaer appendet | `useRef` synkron guard (sjekk FØR React batching) |
| Accordion overlap | Layout-hopp, scroll-flicker | State machine: bare én expanding om gangen, instant-collapse forrige |
| MapReveal blank fade | Animert ingenting | `inView && imageReady` join — begge må være true |
| Theme inject + observer | Feil active section i nav | Grace period (1s) for nylig injiserte temaer |
| Deep link + hydration | Flash ved scroll 0 → theme | Pre-reveal blokker server-side, double-rAF scroll |
| Scroll restore + observer | Feil initial active section | Init observer ETTER scroll-restore er ferdig |
| localStorage to tabs | Feil scroll posisjon | sessionStorage for scroll, localStorage kun for state |

## Acceptance Criteria

### Funksjonelle krav

- [ ] Bruker lander på `/eiendom/[customer]/[project]/story` og ser intro med adresse
- [ ] Tema-velger viser kun temaer med ≥ 2 POI-er, med radio semantikk og staggered animasjon
- [ ] Velg ett tema → story-stream starter med ChatBubble + POI-kort som avdekkes ved scroll
- [ ] POI-kort viser bilde (eller kategori-ikon fallback), navn, gangavstand, editorial hook
- [ ] Tap POI-kort → inline accordion med rating, adresse, editorial hook, Google Maps-lenke
- [ ] Bare ett POI-kort kan være expanded om gangen
- [ ] ChoicePrompt etter 3 POI-er: "Se flere" / "Neste tema" / "Oppsummering"
- [ ] Valgt knapp forblir synlig (filled), uvalgte fader ut
- [ ] "Se flere" → 3 nye POI-er + ny ChoicePrompt (gjenta til tom)
- [ ] "Neste tema" → StoryThemeSelector (uten allerede besøkte temaer, med checkmark)
- [ ] MapReveal viser statisk kart med tema-POI-markører i tema-farge
- [ ] Oppsummering viser 2-kolonne grid med favoritt-POI + stats per besøkt tema
- [ ] Oppsummering har CTA til Explorer og Rapport
- [ ] Story vises som tab i ProductNav via `ALWAYS_AVAILABLE_MODES`
- [ ] `?theme=barn-oppvekst` deep-linker direkte (skip intro, instant scroll)
- [ ] Prosjekter med < 2 kvalifiserte temaer → `redirect()` til Explorer

### Visuelt / UX

- [ ] ChatBubble: Placy-avatar (P i charcoal sirkel), `rounded-tl-md`, `max-w-[85%]`
- [ ] ChoicePrompt: høyrejustert, `rounded-br-md`, `max-w-[80%]`, staggered appear
- [ ] POICard: full-bredde, 16:9 bilde, gangavstand-badge som overlay
- [ ] FactBubble: stor tall + liten label, tema-ikon, `max-w-[75%]`
- [ ] ThemeBridge: sentrert ikon mellom divider-linjer, `py-8`
- [ ] Scroll-reveal animasjon på hvert element (`story-block-reveal`, 0.5s, cubic-bezier)
- [ ] `prefers-reduced-motion` → instant visibility, ingen animasjoner
- [ ] Mobil: fullbredde kort, `px-4`
- [ ] Desktop: `max-w-xl` sentrert kolonne, `py-16`
- [ ] White-label farger/font fungerer (CSS custom properties)
- [ ] POI-er uten bilde viser kategori-ikon på `theme.color + '15'` bakgrunn

### Teknisk

- [ ] Server component for data loading (ingen `useEffect` for fetching)
- [ ] Ekte discriminated union for StoryBlock (7 separate interfaces)
- [ ] `assertNever` i block renderer switch
- [ ] Én delt IntersectionObserver med cleanup
- [ ] Synkron ref-guard på alle ChoicePrompt-er
- [ ] `React.memo()` på alle 7 blokk-komponenter
- [ ] Mapbox static images med `next/image unoptimized`
- [ ] `priority` på de 3 første bilde-bærende blokkene
- [ ] `sizes` attribute på alle `<Image>`-tags
- [ ] Alle imports bruker `@/` prefix
- [ ] `metadata` eksportert med `robots: { index: false }`
- [ ] CSS keyframes prefixet med `story-`
- [ ] TypeScript strict — ingen `any` eller `as`-casts
- [ ] ESLint passerer
- [ ] Bygger uten feil

## Implementeringsfaser

### Fase 0: Forberedelser (~10%)

**Mål:** Flytt delte utilities, bygg fundament-hooks.

**Refactoring av eksisterende kode:**
- Flytt `byTierThenScore()` fra `report-data.ts` → `lib/utils/poi-score.ts`
- Erstatt `haversineMeters()` i `report-data.ts` med import fra `lib/utils.ts`
- Ekstraher POI-tema-gruppering til `lib/utils/theme-grouping.ts`

**Nye hooks:**
- `lib/hooks/useScrollReveal.ts` — delt one-shot observer
- `lib/hooks/useStoryProgress.ts` — blokk-ID persistence + state restore

**Endringer i eksisterende filer:**
- `lib/urls.ts` — legg til `"story"` i mode-union
- `app/eiendom/[customer]/[project]/layout.tsx` — legg til Story i `ALWAYS_AVAILABLE_MODES`

**Verifisering:** Eksisterende Report fungerer fremdeles etter refactoring.

### Fase 1: Route & Data (~20%)

**Mål:** Route, server component, type definitions, story-komposisjon.

**Nye filer:**
- `app/eiendom/[customer]/[project]/story/page.tsx` — Server component med `generateMetadata()`, `redirect()` for insufficient data, statiske kart-URL-er bygget her
- `lib/story/types.ts` — `StoryBlock` discriminated union, `BoligThemeId`, `TemplateKey`, `StoryComposition`
- `lib/story/compose-story-blocks.ts` — Ren transformasjonsfunksjon
- `lib/story/story-templates.ts` — Template-strings via `interpolate()`
- `components/variants/story/StoryPage.tsx` — Hoved klient-component med `useState`, block renderer

**Verifisering:** Ruten laster, server component henter data, `composeStoryBlocks()` returnerer riktig struktur, blokker logges til konsoll.

### Fase 2: Kjernekomponenter (~40%)

**Mål:** Alle 8 komponenttyper rendrer riktig med full UI-spec.

**Nye filer (alle i `components/variants/story/`):**
- `StoryChatBubble.tsx` — P-avatar, `rounded-tl-md`, `max-w-[85%]`
- `StoryPOICard.tsx` — 16:9 bilde, gang-badge, `grid-template-rows` accordion, `React.memo()`
- `StoryMapReveal.tsx` — `next/image unoptimized`, bilde-load → fade-in join, `React.memo()`
- `StoryChoicePrompt.tsx` — Høyrejustert, `rounded-br-md`, stagger, ref-guard, `React.memo()`
- `StoryFactBubble.tsx` — Stor tall + label, tema-ikon, `React.memo()`
- `StoryThemeBridge.tsx` — Sentrert ikon + dividers, `React.memo()`
- `StorySummary.tsx` — 2-kolonne grid, CTA-er, `React.memo()`
- `StoryThemeSelector.tsx` — Radio semantikk, visited state, stagger

**CSS (i `app/globals.css`):**
```css
/* Story Mode — namespaced animations */
@keyframes story-block-reveal {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes story-choice-appear {
  from { opacity: 0; transform: translateY(8px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.story-block { opacity: 0; transform: translateY(16px); }
.story-block.revealed {
  animation: story-block-reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--story-delay, 0ms);
}
.story-choice { opacity: 0; transform: translateY(8px) scale(0.95); }
.story-choice.revealed {
  animation: story-choice-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  animation-delay: var(--story-delay, 0ms);
}
@media (prefers-reduced-motion: reduce) {
  .story-block, .story-choice {
    opacity: 1 !important; transform: none !important; animation: none !important;
  }
  .story-poi-details { transition: none; }
}
```

**Verifisering:** Full story-flyt rendrer for et demo-prosjekt. Alle komponenttyper synlige med riktig styling.

### Fase 3: Interaktivitet & Polish (~30%)

**Mål:** Scroll-reveal, micro-choices, race-sikring, responsive, persistence.

**Funksjonalitet:**
- Scroll-reveal via delt `useScrollReveal` hook
- ChoicePrompt → nye blokker i feeden (synkron ref-guard)
- Inline POI accordion (state machine — bare én om gangen)
- MapReveal: in-view + image-ready join
- Deep linking (`?theme=` → pre-reveal + instant scroll)
- Story progress persistence (sessionStorage + localStorage)
- Responsive desktop (`max-w-xl` sentrert)
- `prefers-reduced-motion` full support
- Minimum data redirect
- `content-visibility: auto` på passerte blokker (P2)

**Verifisering:** Full interaktiv story-flyt på mobil og desktop. Alle acceptance criteria oppfylt. Test med:
- Throttled CPU (6x) + fast scroll → ingen usynlige hull
- Double-click macro (16ms) på ChoicePrompt → bare ett tema
- Slow 3G nettverk → MapReveal viser skeleton, ikke blank fade
- `?theme=barn-oppvekst` → instant scroll uten flash

## Success Metrics

- **Engasjement:** Boligkjøpere bruker > 2 min i Story Mode (vs. < 1 min bounce fra Report)
- **Completion rate:** > 50% av brukere når oppsummeringen
- **Tema-valg:** Snitt 2+ temaer utforsket per sesjon
- **CTA-klikk:** > 20% klikker videre til Explorer eller Rapport
- **Core Web Vitals:** LCP < 2.5s, INP < 200ms, CLS < 0.1

## Dependencies & Risks

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Sparse POI-data i suburbs | Høy | Tynne stories med få kort | Minimum-data redirect + fallback til Explorer |
| POI-er uten bilder | Høy | Visuelt fattig | Kategori-ikon på `theme.color + '15'` bakgrunn |
| Animasjons-jank på eldre mobiler | Medium | Dårlig UX | `prefers-reduced-motion`, én observer, S-tier animasjoner |
| 100+ blokker ved power use | Medium | DOM-ytelse | `content-visibility: auto`, `React.memo()`, `useReducer` |
| Overlap med Report | Lav | Megler-forvirring | Ulike tabs, ulike formål — Story for engagement, Report for referanse |

## Filstruktur

```
lib/story/
  types.ts                      # StoryBlock discriminated union
  compose-story-blocks.ts       # Ren transformasjon
  story-templates.ts            # Template-strings

lib/utils/
  poi-score.ts                  # byTierThenScore (flyttet fra report-data)
  theme-grouping.ts             # Delt POI→tema grouping

lib/hooks/
  useScrollReveal.ts            # Delt one-shot observer
  useStoryProgress.ts           # Persistence (session + local storage)

components/variants/story/
  StoryPage.tsx                 # Hoved klient-component
  StoryChatBubble.tsx
  StoryPOICard.tsx
  StoryMapReveal.tsx
  StoryChoicePrompt.tsx
  StoryFactBubble.tsx
  StoryThemeBridge.tsx
  StorySummary.tsx
  StoryThemeSelector.tsx

app/eiendom/[customer]/[project]/story/
  page.tsx                      # Server component
```

## Åpne spørsmål (ikke-blokkerende)

- **Navn i ProductNav?** "Story", "Utforsk", "Discover", "Opplev"
- **Analytics events?** `story_theme_selected`, `story_poi_viewed`, `story_choice_made`, `story_completed` — spesifiseres separat
- **Typing indicator?** Valgfritt 300ms "..." før ChatBubble — nice-to-have, ikke MVP
- **Deling?** Brukeren deler sin reise med valg — v2-feature

## References & Research

### Interne referanser
- Brainstorm: `docs/brainstorms/2026-04-07-interaktiv-storytelling-brainstorm.md`
- Report data flow: `components/variants/report/report-data.ts`
- Portrait scrollytelling: `components/variants/portrait/PortraitPage.tsx`
- Tema-definisjoner: `lib/themes/bransjeprofiler.ts`
- Scroll-sync: `docs/solutions/feature-implementations/report-scroll-synced-sticky-map-20260208.md`
- CSS animation gotcha: `docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md`
- POI card: `docs/solutions/ui-patterns/report-unified-poi-card-grid-20260303.md`
- Desktop layout: `docs/solutions/ui-patterns/trip-preview-desktop-layout-20260215.md`
- Theme colors: `docs/solutions/ui-patterns/spoersmaalskort-report-hero-redesign-20260303.md`
- Skeleton loading: `docs/solutions/ux-loading/skeleton-loading-report-map-20260204.md`

### Eksterne referanser
- [Motion.dev — Web Animation Performance Tier List](https://motion.dev/magazine/web-animation-performance-tier-list)
- [Pudding.cool — Responsive Scrollytelling](https://pudding.cool/process/responsive-scrollytelling/)
- [Chrome I/O 2025 — New in Web UI](https://developer.chrome.com/blog/new-in-web-ui-io-2025-recap)
- [W3C WCAG 2.1 C39 — prefers-reduced-motion](https://www.w3.org/WAI/WCAG21/Techniques/css/C39)
- [Mapbox Static Images API](https://docs.mapbox.com/api/maps/static-images/)
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
