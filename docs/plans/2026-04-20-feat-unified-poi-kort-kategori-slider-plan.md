---
title: Unified POI-kort + kategori-slider i tekstseksjon
type: feat
date: 2026-04-20
related_brainstorm: docs/brainstorms/2026-04-20-unified-poi-kort-kategori-slider-brainstorm.md
status: Ready for implementation (pending tech-audit)
deepened: 2026-04-20
---

# Unified POI-kort + kategori-slider i tekstseksjon

## Enhancement Summary (2026-04-20)

Deepened med 8 parallelle agenter (5 review + 2 research + 1 spec-flow). Kritiske endringer vs. original:

**Must-fix (korrekt-hetfeil i original plan):**
- `touch-none` → `overscroll-behavior-x-contain` (Tailwind: `overscroll-x-contain`). Flagget av 4 agenter. `touch-none` bricker iOS horizontal swipe fullstendig. Safari 16+ støtter `overscroll-behavior` universelt.
- `role="listbox"` → `role="region"` + semantisk `<ul>/<li>`. Per W3C APG 2025+, listbox-mønsteret er semantisk feil for ikke-selekterbare editorial-kort. Dette gjør også at roving tabindex kan droppes — native Tab-order er tilstrekkelig.

**Bonus-fix: samme to bugs eksisterer i referanse-mønsteret `ReportMapBottomCarousel`** — fikses samtidig (Phase 2.5 NY) siden vi allerede berører området.

**Props-simplifisering:**
- Drop `allPOIs` + `displayPOIs` → bruk `pois: readonly POI[]` + `totalCount: number`. Fjerner implicit kontrakt, umulig for callere å tabbe seg bort.
- **`onOpenMap: () => void` non-optional** (tech-audit fix). CTA-synlighet deriveres internt fra `totalCount > pois.length`. Eliminerer dobbel-gate (parent `undefined` + child length-check) som skapte kontrakt-ambiguitet.
- Extract `rankScore(poi)` fra `getTopRankedPOIs` → isolert unit-testbar invariant. Dokumenter invariant `poiTier ∈ {1,2,3}` i JSDoc.
- Returner `readonly POI[]` fra ranking-util → propagerer immutability-kontrakt.
- **`ReportMapBottomCarousel` får også `ariaLabel`-prop** (tech-audit fix) — hardkoded "Steder i nabolaget" er per-theme feil når 7 instanser rendres.

**Performance + arkitektur (tech-audit oppdatering):**
- ~~Memoiser `getTopRankedPOIs` i ReportThemeSection~~ → **Precompute i `report-data.ts`** ved theme-assembly. `theme.topRanked: readonly POI[]` beregnes én gang når report-data bygges. Følger CLAUDE.md "ALDRI legg forretningslogikk i komponenter — flytt til `lib/`". Eliminerer også memoization-stabilitetsproblemet (`theme.allPOIs`-referanse er ikke stabil på locale-endringer).
- Ranking-util legges ikke i `blocks/` men co-located med `report-data.ts` som pure data-layer.

**Prosess-simplifisering:**
- Slå Phase 3 (cleanup) inn i Phase 2 — deletions i samme commit, trust git.
- Trim test-cases fra 21 → 10 meningsfulle (fjern regresjon-TCs som er uberørt av denne endringen).
- Fjern R4 (subsections) — resolved question, ikke risiko.
- Fjern QG-3 (before/after-logging) — visual QA dekker dette.

**Arkitektur-avgjørelse:**
- Konflikt mellom code-simplicity ("behold duplisering") og architecture-strategist ("extract shared base"). Løsning: behold ~80-linjers duplisering mellom `ReportThemePOICarousel` og `ReportMapBottomCarousel` for nå (to consumers ≠ third-rule), MEN legg til mirror-comments (`// @duplicated-from ReportMapBottomCarousel`) og lock-step a11y-kontrakt via delt test. Re-vurderes hvis tredje consumer oppstår.

**Deferred til followup:**
- `ResizeObserver` istedenfor `window.addEventListener("resize", ...)` — nice-to-have, ikke blokkerende.
- `scrollend`-event istedenfor debounced scroll — Baseline 2025, kan migreres senere.
- `scrollIntoView` med `inline: "center"` istedenfor `step = 232`-matte — race-fix, kan fikses senere.
- IntersectionObserver-gated map-mount for 7 dormant previews — separat performance-plan.
- Generalisering til shared `POICardCarouselBase` eller `useCarouselScrollState`-hook — ved tredje consumer.

**Key improvements (impact):**
1. iOS swipe-functionality bevart (ellers: feature brikker på iPhone)
2. A11y semantisk korrekt per W3C APG 2025+
3. TypeScript-kontrakt entydig (ingen implicit invariants)
4. ReportMapBottomCarousel også fikset (bonus — ingen ekstra cost)
5. Færre test-cases men høyere signal

**Agents that reviewed:** code-simplicity-reviewer, kieran-typescript-reviewer, architecture-strategist, pattern-recognition-specialist, julik-frontend-races-reviewer, performance-oracle, best-practices-researcher, framework-docs-researcher.

---

## Overview

Konsolider POI-kort-UI-et i Report-produktet: fjern Mat & Drikke's bilde-baserte `FeatureCarousel`, og bruk en uniform tekst-only slider basert på eksisterende `ReportMapBottomCard` på alle 7 tema-seksjoner. Slideren plasseres mellom narrativ og dormant kart-preview, og avslutter med en "Se alle N steder på kart"-CTA som åpner `UnifiedMapModal` for kategorien.

**Scope:** 2 nye filer (1 carousel + 1 test), 3 filer endret (`ReportThemeSection.tsx` + `ReportMapBottomCarousel.tsx` + `report-data.ts` for precomputed ranking), 2 filer slettet (`FeatureCarousel.tsx` + `matdrikke-carousel.ts`). Ingen data-migrasjoner, ingen API-endringer, ingen feature flags.

## Problem Statement

### Tre symptomer av samme rot-årsak

1. **Mat & Drikke er visuelt unik** — kategorien har en bilde-slider (`FeatureCarousel`), mens alle andre tema-seksjoner er tekst-only. Bilder finnes kun her fordi restauranter har best Google-Places-bildedata. Det skaper en falsk hierarki: Mat & Drikke oppleves som "rik" mens de andre 6 temaene fremstår som "fattige".

2. **To forskjellige kort-komponenter for POI-er i samme kategori** — i Mat & Drikke-tekstseksjonen rendres kort med bilde (`CarouselCard`), men i kart-modalens bunn rendres samme POI-er uten bilde (`ReportMapBottomCard`). Bryter den mentale modellen "dette er samme sted".

3. **Ingen bro mellom tekst og kart** — de andre 6 temaene har kun et dormant kart-preview som eneste inngang til POI-oversikt. Sliderne mangler fullstendig, så brukeren får ikke en "preview"-opplevelse av hva som finnes i kartet.

### Rot-årsaken

Tre uavhengige kort-implementasjoner i kodebasen (`CarouselCard` internal i `FeatureCarousel`, `ReportMapBottomCard`, `ReportPOICard`) uten noen felles base, pluss en kategori-spesifikk slider som aldri ble generalisert. Konsolidering tvinger et felles visuelt språk og muliggjør gjenbruk.

## Proposed Solution

### Arkitekturprinsipper

- **Ett POI-kort:** `ReportMapBottomCard` blir den autoritative POI-kort-komponenten i Report. Brukes identisk i tekst-slider og kart-bunn-carousel.
- **Ett ranking-oppslag:** `getTopRankedPOIs(pois, limit)` brukes både i tekst-slider (`limit=6`) og kart-bunn (`limit=10`). Sikrer at de første 6 i kart-bunn = alle 6 i tekst-slider. Ingen avvik tillatt.
- **Slim ny carousel:** `ReportThemePOICarousel` er en ren tekst-slider med intern `activePOIId`-state, uten map-integrasjon. Speiler scroll/keyboard-logikken fra `ReportMapBottomCarousel` — duplisering av ~80 linjer er akseptabelt per CLAUDE.md "Three similar lines is better than a premature abstraction"; senere refaktorering til shared base er mulig om behov dukker opp andre steder.
- **CTA gjenbruker eksisterende modal-state:** `setMapDialogOpen(true)` — samme handler som klikk på dormant kart-preview. Ingen ny modal-state.

### Plassering i tema-seksjonen

Eksisterende flyt i `ReportThemeSection.tsx` (etter denne endringen):

```
<section id={theme.id}>
  <div className="md:max-w-4xl">
    [hero icon + title + bridge-text]          ← uendret
    [optional banner illustrasjon]             ← uendret
    [EditorialPull (kun hverdagsliv)]          ← uendret
    [upperNarrative + HeroInsight]             ← uendret
    [lowerNarrative / intro-fallback]          ← uendret
    [AddressInput (kun transport)]             ← uendret
    [ReportGroundingInline / CuratedGrounded]  ← uendret
    [ReportThemePOICarousel]                   ← NY (alle 7 tema)
  </div>
  [dormant kart-preview]                       ← uendret
  [UnifiedMapModal]                            ← uendret
</section>
```

Slideren legges inne i `md:max-w-4xl` for å matche tekstbredden visuelt. Dormant kart-preview (som er full-width) følger rett under.

### CTA-regel (avklart fra spec-flow-analyse)

| `theme.allPOIs.length` | Slider | CTA |
|------------------------|--------|-----|
| 0 | Skjult (hele slider-blokken rendres ikke) | — |
| 1–6 | Viser alle N kort | Skjult |
| 7+ | Viser top-6 kort | Synlig: "Se alle X steder på kart" |

### CTA-label og styling

- **Tekst:** `Se alle {X} steder på kart` (generisk "steder" på tvers av tema — ingen per-tema `unit`-felt)
- **Stil:** tertiær knapp (ikke primær) for å holde fokus på kortene. Underline-style med høyre-pil eller rounded-full bg-button.
- **Interaksjon:** klikk kaller `setMapDialogOpen(true)` (eksisterende state i `ReportThemeSection`).

### Ranking-endring (eksplisitt impact)

Nåværende `getMatDrikkeCarousel` sorterer med primær-tiebreaker på bilde-tilstedeværelse:

```ts
// NÅVÆRENDE
if (aImg !== bImg) return bImg - aImg;   // 1. bilde først
const aScore = (a.googleRating ?? 0) * (4 - (a.poiTier ?? 3));
const bScore = (b.googleRating ?? 0) * (4 - (b.poiTier ?? 3));
return bScore - aScore;                   // 2. rating × tier
```

Etter endring:

```ts
// NY
const aScore = (a.googleRating ?? 0) * (4 - (a.poiTier ?? 3));
const bScore = (b.googleRating ?? 0) * (4 - (b.poiTier ?? 3));
return bScore - aScore;                   // kun rating × tier
```

**Impact:** Mat & Drikke kart-bunn-carousel vil re-ordne i prosjekter der høyt rangerte spisesteder mangler Google-bilder. Non-Mat & Drikke temaer har sjelden `featuredImage`, så merkbart reorder-impact kun i Mat & Drikke. Akseptabelt — den nye rankingen er mer prinsipiell (rating × tier uavhengig av bildedata).

## Technical Approach

### Architecture

#### Data flow (text-slider)

```
theme.allPOIs (full list)
    ↓
getTopRankedPOIs(theme.allPOIs, 6)  ← ranking utility
    ↓
ReportThemePOICarousel (renders cards + optional CTA)
    ↓
ReportMapBottomCard × N  (reused card component)
```

#### Data flow (map-bottom, uendret arkitektur, samme utility)

```
theme.allPOIs (full list)
    ↓
getTopRankedPOIs(theme.allPOIs, 10)  ← samme ranking utility
    ↓
ReportMapBottomCarousel (existing, renders via UnifiedMapModal bottomSlot)
    ↓
ReportMapBottomCard × N  (samme card component)
```

**Invariant:** første 6 POI-er fra `getTopRankedPOIs(..., 10)` === alle 6 POI-er fra `getTopRankedPOIs(..., 6)`. Begge sorterer samme input med samme sammenligning; skillet er kun `limit`.

### Implementation Phases

#### Phase 1: Foundation — ranking precompute + slim carousel

**1.1 Utvid `report-data.ts` med precomputed `theme.topRanked` (tech-audit fix)**

Ranking flyttes fra komponent-layer til data-build-layer. Følger CLAUDE.md "ALDRI legg forretningslogikk i komponenter — flytt til `lib/`" og eliminerer memoization-stabilitetsproblem.

**Ny utility co-located i `components/variants/report/top-ranked-pois.ts`** (NB: ikke i `blocks/` — denne er pure data-logic, ikke en block-komponent):

```ts
// components/variants/report/top-ranked-pois.ts
import type { POI } from "@/lib/types";

/**
 * Ranking-score for én POI. Høyere = bedre.
 * Tier-vekt: tier 1 = 3, tier 2 = 2, tier 3/null = 1.
 * Missing rating behandles som 0 (synker til bunn).
 * Invariant: poiTier ∈ {1,2,3} — verdier utenfor gir meningsløs score.
 */
export function rankScore(
  poi: Pick<POI, "googleRating" | "poiTier">,
): number {
  return (poi.googleRating ?? 0) * (4 - (poi.poiTier ?? 3));
}

/**
 * Rangerer POI-er etter rankScore, cap ved `limit`.
 * Deterministisk comparator gir stabil rekkefølge (ES2019+).
 * Invariant: `getTopRankedPOIs(p, 10).slice(0, 6)` === `getTopRankedPOIs(p, 6)`.
 * Returnerer `readonly POI[]` — callsites har kontrakt om å ikke mutere.
 */
export function getTopRankedPOIs(
  pois: readonly POI[],
  limit: number,
): readonly POI[] {
  if (limit < 1) return [];
  return [...pois]
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, limit);
}
```

**Utvid `ReportTheme` i `report-data.ts`:**

```ts
// components/variants/report/report-data.ts — ReportTheme interface (line ~111)
export interface ReportTheme {
  // ... existing fields ...
  allPOIs: POI[];
  topRanked: readonly POI[];  // NY: top-10 precomputed, brukt av text-slider + map-bottom
}
```

**Populate ved theme-assembly (line ~572):**

```ts
// Ved theme-bygging, etter `filtered`-array er klar
const topRanked = getTopRankedPOIs(filtered, 10);
// ...
themes.push({
  // ... existing fields ...
  allPOIs: filtered,
  topRanked,
});
```

Tekst-slider bruker `theme.topRanked.slice(0, 6)`. Map-bottom bruker `theme.topRanked` direkte. Null sort per render, ett sort per report-data-build.

**1.2 Enhets-test `top-ranked-pois.test.ts`**

Dekker:
- TC-20 ranking-parity (same order for different limits)
- Empty input
- Missing rating / tier (fallback-verdier)
- Stabil output (input ikke mutert)

**1.3 Opprett `components/variants/report/blocks/ReportThemePOICarousel.tsx`**

Slim wrapper — speiler `ReportMapBottomCarousel`-mønsteret (med mirror-comments), men uten map-integrasjon:

```tsx
// @duplicated-scroll-logic: ReportMapBottomCarousel.tsx:34-108
// Duplisering akseptert for nå (to consumers). Update begge ved endring.

interface ReportThemePOICarouselProps {
  /** POI-er som skal rendres i slideren (allerede top-N av ranking). */
  pois: readonly POI[];
  /** Total antall POI-er i kategorien — brukes i CTA-label.
      CTA rendres internt iff totalCount > pois.length. */
  totalCount: number;
  /** Klikk på CTA. Required — CTA-synlighet styres kun av totalCount > pois.length. */
  onOpenMap: () => void;
  /** Slug for "Les mer"-link i aktivert kort. Null → "Les mer" skjules. */
  areaSlug?: string | null;
  /** Aria-label for region (f.eks. "Steder i Mat & Drikke"). Required for a11y. */
  ariaLabel: string;
}

// Defensive guard i komponent:
// if (pois.length === 0) return null;
```

- Intern `activePOIId` (useState) — ingen ekstern sync med map
- **A11y-struktur (W3C APG 2025+):**
  ```tsx
  <section aria-label={ariaLabel} aria-roledescription="carousel">
    <ul role="group" className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain ...">
      {pois.map((poi, i) => (
        <li key={poi.id} aria-roledescription="slide" aria-label={`${i+1} av ${pois.length}: ${poi.name}`}>
          <ReportMapBottomCard ... />
        </li>
      ))}
    </ul>
    {onOpenMap && totalCount > pois.length && (
      <button onClick={onOpenMap} className="...">Se alle {totalCount} steder på kartet</button>
    )}
  </section>
  ```
- **Ingen roving tabindex** — native Tab-order gjennom card-buttons er tilstrekkelig. Eliminerer race mellom `scrollByAmount` og `.focus()`.
- Arrow-buttons (`ChevronLeft/Right`) med `canScrollLeft/Right`-state beholdes — visual affordance for desktop
- **Scroll-behavior:** `overscroll-x-contain` (Tailwind) for å forhindre iOS pull-to-refresh uten å drepe swipe. NB: IKKE `touch-none` — den bricker horizontal swipe fullstendig.
- **Snap-mode:** `snap-mandatory` beholdes (brukeren forventer snap), men dokumenter orientasjons-endring som kjent paint-jank på mobil (akseptabelt, 7-instans-problemet er allerede realitet).

**1.4 Component-test `ReportThemePOICarousel.test.tsx`** (minimal, ny pattern)

Dekker:
- TC-2/3/4/5 rendering med ulike POI-counts
- TC-6 CTA-synlighet basert på total
- TC-11 fallback når body-text mangler

#### Phase 2: Integration — wire inn i ReportThemeSection

**2.1 Importer og bruk ny ranking-utility**

```tsx
// components/variants/report/ReportThemeSection.tsx
- import { getMatDrikkeCarousel } from "./blocks/matdrikke-carousel";
+ import { getTopRankedPOIs } from "./blocks/top-ranked-pois";
+ import ReportThemePOICarousel from "./blocks/ReportThemePOICarousel";
```

**2.2 Fjern Mat & Drikke-spesifikk `FeatureCarousel`-blokk**

Slett hele blokk `ReportThemeSection.tsx:287-304` (det som starter med `{variant !== "secondary" && theme.id === "mat-drikke" && theme.allPOIs.length > 0 && (() => {`).

**2.3 Legg til generell slider etter grounding, før kart-preview**

Bruker precomputed `theme.topRanked` fra `report-data.ts` (se Phase 1.1). Ingen memoization i komponent — data er allerede precomputed.

Etter `{theme.grounding?.groundingVersion === 2 ? ...` blokken (line 371-378) og før `</div>` som lukker `md:max-w-4xl`:

```tsx
{/* POI-slider — top-6 rangerte steder for kategorien.
    Plasseres etter narrativ/grounding, rett over dormant kart-preview.
    Rendres ikke når kategorien har 0 POI-er. */}
{theme.allPOIs.length > 0 && (
  <div className="mt-8">
    <ReportThemePOICarousel
      pois={theme.topRanked.slice(0, 6)}
      totalCount={theme.allPOIs.length}
      onOpenMap={useCallback(() => setMapDialogOpen(true), [])}
      areaSlug={areaSlug}
      ariaLabel={`Steder i ${theme.name}`}
    />
  </div>
)}
```

NB: `onOpenMap` wrap i `useCallback([])` for stabil identitet — forebygger unødvendig re-render hvis karusellen senere bruker `React.memo` eller `useEffect([onOpenMap])`.

**2.4 Oppdater `bottomSlot` til å bruke precomputed `theme.topRanked`**

Erstatt `getMatDrikkeCarousel(theme.allPOIs, center)` + topPOIs-utleding på linje 469-475 med:

```tsx
bottomSlot={(ctx) => {
  if (theme.topRanked.length === 0) return null;
  return (
    <ReportMapBottomCarousel
      pois={theme.topRanked}
      ariaLabel={`Steder i ${theme.name}`}  // NY — parameteriseres per theme
      activePOIId={ctx.activePOI}
      onCardClick={(poiId) => {
        if (ctx.activePOI === poiId) {
          ctx.setActivePOI(null);
          return;
        }
        ctx.setActivePOI(poiId, "card");
        ctx.mapController.flyTo(poiId);
      }}
      registerCardRef={ctx.registerCardElement}
      areaSlug={areaSlug}
    />
  );
}}
```

**2.5 (NY) Fiks eksisterende a11y + iOS bugs i `ReportMapBottomCarousel.tsx`**

Samme to bugs som ble oppdaget i plan-review ligger i referanse-mønsteret. Fikses samtidig siden begge consumers ender opp speilet og drift starter umiddelbart hvis vi fikser bare én.

**Endringer i `ReportMapBottomCarousel.tsx`:**

1. **Ny required prop `ariaLabel: string`** — eksisterende hardkodet `aria-label="Steder i nabolaget"` er feil når 7 instanser rendres, alle med samme label. Parameteriseres per theme.

2. **A11y semantic update:** 
   - Bytt `role="listbox"` til `role="group"` på scroll-container
   - Legg til `aria-roledescription="carousel"` på outer wrapper, `aria-roledescription="slide"` på hvert kort
   - **Behold roving tabindex + arrow-key-nav** (bevisst valg) siden map-kontekst krever presis kort-navigasjon for å trigge flyTo. For å kompensere for at `role="group"` ikke kommuniserer arrow-key-affordance, legg til `aria-keyshortcuts="ArrowLeft ArrowRight Home End"` på scroll-container. Dokumenter i JSDoc.

3. **Scroll-container className:** legg til `overscroll-x-contain` for iOS pull-to-refresh-beskyttelse (dagens kode har `overflow-x-auto` men ingen overscroll-kontroll).

**Note for QA:** Test VoiceOver/iOS Safari at `aria-roledescription="slide"` faktisk annonseres inne i `<ul role="group">`. Hvis ikke, vurder `role="list"` istedenfor `role="group"` (APG-implementasjoner varierer). Dokumenter valgt retning etter QA.

#### Phase 3: ~~Cleanup~~ — slått inn i Phase 2 per code-simplicity-review

Slette dead code i samme commit som Phase 2-endringene. Git håndterer rollback; separate "verify grep → delete → verify lint"-faser er safety theater.

**Slett-operasjoner (inklusive grep-verifisering):**

```bash
# Verifiser at ingen ytterligere imports finnes (inkludert barrel-re-exports)
rg "from.*FeatureCarousel|from.*matdrikke-carousel" --type ts --type tsx
# Forventet: 0 treff etter Phase 2 (før sletting gjør grep, etter Phase 2-endringer)
```

- Slett `components/variants/report/blocks/FeatureCarousel.tsx`
- Slett `components/variants/report/blocks/matdrikke-carousel.ts`

**Ikke slett `ReportPOICard.tsx`** — `components/guide/GuideMapLayout.tsx:13` er fortsatt consumer. Separat cleanup-story hvis Guide migrerer senere.

#### Phase 4: Verify — visuell QA

**4.1 Start dev server**

```bash
PORT=3001 npm run dev
```

**4.2 Visuell verifisering på stasjonskvartalet rapport**

- URL: `http://localhost:3001/eiendom/banenor-eiendom/stasjonskvartalet/rapport`
- Screenshot hver av de 7 tema-seksjonene: slider + kart
- Verifiser:
  - Alle 7 sliderene rendres
  - Mat & Drikke-kortene har ingen bilde
  - Slider-kortene ser identiske ut med kart-bunn-carouselens kort (åpne modal og sammenlign)
  - CTA "Se alle X steder på kart" vises kun når X > 6
  - Klikk CTA åpner UnifiedMapModal
  - Første 6 POI-er i slider === første 6 POI-er i kart-bunn-carousel (samme rekkefølge)

**4.3 Mobile verifisering**

- DevTools responsive mode, iPhone 14 Pro
- Swipe gjennom slideren
- Verifiser ingen pull-to-refresh-konflikt
- Verifiser scroll-snap-alignment

**4.4 Keyboard-only verifisering**

- Tab gjennom siden
- ArrowLeft/Right i hver slider
- Enter/Space aktiverer kort
- Escape lukker modal

## Acceptance Criteria

### Functional Requirements

- [ ] **AC-1:** Alle 7 tema-seksjoner på rapport-siden rendrer en slider med opp til 6 POI-kort plassert etter narrativ/grounding, rett før dormant kart-preview.
- [ ] **AC-2:** Mat & Drikke-slideren bruker samme tekst-only kort som de andre 6 kategoriene — ingen bilde rendres i kort.
- [ ] **AC-3:** Kortene i tekst-slider er visuelt identiske med kortene i kart-modalens bunn-carousel (samme `ReportMapBottomCard`-komponent).
- [ ] **AC-4:** "Se alle X steder på kartet"-CTA vises når og kun når `theme.allPOIs.length > 6`. Klikk åpner `UnifiedMapModal` for kategorien (samme handler som dormant kart-preview-klikk).
- [ ] **AC-5:** Tekst-slider og kart-bunn-carousel viser samme POI-er i samme rekkefølge for samme kategori (kart-bunn er superset med limit=10, tekst er subset med limit=6).
- [ ] **AC-6:** Klikk på kort i tekst-slider aktiverer kortet lokalt (viser "Vis rute / Les mer / Google"-action-row). "Les mer" navigerer til `/[areaSlug]/steder/[slug]`.
- [ ] **AC-7:** `FeatureCarousel.tsx` og `matdrikke-carousel.ts` er slettet fra kodebasen.
- [ ] **AC-8:** `getTopRankedPOIs` (+ eksponert `rankScore`-hjelp) brukes både i tekst-slider og i `bottomSlot`-render-prop. Ranking-resultatet er memoisert i `ReportThemeSection` via `useMemo`.
- [ ] **AC-9:** `ReportPOICard.tsx` er IKKE slettet (fortsatt brukt av `GuideMapLayout.tsx`).
- [ ] **AC-10:** Ingen regresjon: kart-modal, grounding, POI-inline-lenker i narrativ, transport-widgets, hero-insight, EditorialPull — alle fungerer som før.
- [ ] **AC-11:** Bonus — `ReportMapBottomCarousel` bruker nå semantisk `<ul role="group">` (ikke `role="listbox"`) og har `overscroll-x-contain` på scroll-container.

### Non-Functional Requirements

- [ ] **NFR-1 (a11y):** Slideren er `<section>` med `aria-label="Steder i {theme.name}"` + `aria-roledescription="carousel"`. Indre `<ul role="group">` med `<li>` per kort (`aria-roledescription="slide"`). Native Tab-rekkefølge gjennom card-buttons. **Ingen `role="listbox"`** (W3C APG 2025+: listbox er semantisk feil for ikke-selekterbare kort).
- [ ] **NFR-2 (mobile):** `overscroll-x-contain` på slider-container unngår iOS pull-to-refresh-konflikt UTEN å drepe horizontal swipe. **Ikke `touch-none`** (bricker swipe på iOS).
- [ ] **NFR-3 (performance):** Rapport-siden rendrer 7 slidere × opp til 6 kort = ≤ 42 kort i DOM. Ingen bilder → ingen ekstra nettverk-requests. `getTopRankedPOIs` memoisert i parent → én sort per theme-render.
- [ ] **NFR-4 (code quality):** `npm run lint` 0 errors, `npx tsc --noEmit` 0 errors, `npm test` alle tester passerer, `npm run build` bygger uten feil.

### Quality Gates

- [ ] **QG-1:** Visuell QA på stasjonskvartalet rapport godkjent — screenshot av alle 7 seksjoner.
- [ ] **QG-2:** Ranking-parity verifisert manuelt: åpne modal for Mat & Drikke, sammenlign kortrekkefølge i slider vs kart-bunn.
- [ ] **QG-3:** Guide-produktet fortsatt funksjonelt (stikk-test av en Guide-side for å bekrefte `GuideMapLayout` ikke brutt).
- [ ] **QG-4:** iOS swipe verifisert — slider kan swipes horisontalt på iPhone DevTools responsive mode (+ ekte iPhone om tilgjengelig).

## Test Cases

Trimmet fra 21 til 10 meningsfulle TC-er etter code-simplicity-review. Regresjon-scenarios (eksisterende funksjonalitet uberørt av denne endringen) flyttet til Visual QA Checklist under.

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| TC-1 | Tema med 0 POI | Slider-blokken rendres ikke |
| TC-2 | Tema med 6 POI | Slider viser 6 kort, CTA skjult (onOpenMap=undefined) |
| TC-3 | Tema med 7 POI | Slider viser 6 kort, CTA "Se alle 7 steder på kartet" synlig |
| TC-4 | Klikk CTA | Åpner UnifiedMapModal; bottom-carousel viser top-10 med samme rekkefølge som slider |
| TC-5 | Klikk kort i slider | Viser action-row (Vis rute / Les mer / Google); "Les mer" navigerer til `/[areaSlug]/steder/[slug]` |
| TC-6 | Missing editorialHook + localInsight + description | Kort viser kun tittel + walktime, ingen layout-brudd |
| TC-7 | Ranking unit test (invariant) | `getTopRankedPOIs(pois, 6)` første 6 === `getTopRankedPOIs(pois, 10)` første 6 |
| TC-8 | `rankScore` unit test | `rankScore({googleRating: 4.5, poiTier: 1}) === 4.5 * 3 === 13.5`; null-fallback cases |
| TC-9 | Mat & Drikke bilde-strip | Ingen `<img>` eller `next/image` i kort (DOM-inspeksjon) |
| TC-10 | iOS swipe på slider | Horizontal swipe fungerer på iOS; pull-to-refresh trigges ikke (overscroll-x-contain virker). **Må testes på ekte iPhone eller Safari responsive mode.** |

### Task → TC mapping

| Task | TC-er dekket |
|------|------|
| Phase 1.1 ranking-util (`rankScore` + `getTopRankedPOIs`) | TC-7, TC-8 |
| Phase 1.2 ranking-test | TC-7, TC-8 |
| Phase 1.3 ThemePOICarousel | TC-1, TC-2, TC-3, TC-6 |
| Phase 1.4 carousel-test | TC-1, TC-2, TC-3, TC-6 |
| Phase 2.1–2.4 integration | TC-4, TC-5, TC-9 |
| Phase 2.5 MapBottomCarousel a11y + overscroll | (dekket via visual QA) |
| Phase 4 visual QA | TC-1 – TC-10 + manual checklist |

## Dependencies & Risks

### Dependencies

- `ReportMapBottomCard.tsx` — uendret, brukes som-er (allerede tekst-only, har `isActive` + action-row)
- `UnifiedMapModal` — uendret, `bottomSlot`-render-prop allerede etablert
- `ReportThemeSection.tsx` — endret (del 2.1–2.4)
- `getIcon` fra `lib/utils/map-icons.ts` — eksisterende
- `slugify` fra `lib/utils/slugify.ts` — eksisterende

### Risks

**R1 — Ranking-re-order i Mat & Drikke (Low)**
Fjerning av bilde-preference-tiebreaker kan re-ordne kart-bunn-carousel-kortene i prosjekter der høyt-rangerte spisesteder mangler Google-bilder.
*Mitigation:* Dokumenter før/etter-listen i WORKLOG.md. Bekreft at ny rekkefølge er mer prinsipiell.

**R2 — Dupliseringskode i ny carousel (Low)**
`ReportThemePOICarousel` speiler scroll/keyboard-logikken fra `ReportMapBottomCarousel` (~80 linjer). Drift-risiko hvis én oppdateres senere.
*Mitigation:* Legg til kommentar i hver fil som peker til den andre. Planlagt "future refactor"-note. Akseptabelt per CLAUDE.md anti-abstraction-regel.

**R3 — GuideMapLayout ved uhell brutt (Low)**
`ReportPOICard` er fortsatt brukt av Guide. Hvis noe i Phase 3 (cleanup) ved uhell berører `ReportPOICard`, brekker Guide-produktet.
*Mitigation:* Eksplisitt "do not delete ReportPOICard"-note i plan. Stikk-test en Guide-side i Phase 4.

**R4 — iOS Safari scroll-bugs (Medium)**
Horizontal scroll-snap + nær topp av siden kan trigge pull-to-refresh på iOS. Eller — som i original plan — ved feil touch-action kan all swipe-interaksjon drepes.
*Mitigation:* `overscroll-behavior-x-contain` (Tailwind: `overscroll-x-contain`) istedenfor `touch-none`. Safari 16+ støtte universell. Testes i Phase 4.3 på iPhone DevTools + ekte device om mulig.

**R5 — Scroll-jank ved orientasjonsendring (Low)**
7 slidere med `snap-mandatory` recalcs snap-points samtidig ved rotate på mobil → potensielt 10+ frames droppet.
*Mitigation:* Dokumentert som akseptabel. Kan mitigeres ved å bytte til `snap-proximity` i followup hvis QA flagger det.

## Out of Scope

Eksplisitt utenfor scope for denne planen (nevnt i brainstorm eller spec-flow):

- **Bildekollasj-blokk som "pust i teksten"** — separat redaksjonell blokk (bruker nevnte i AskUserQuestion-svar). Fremtidig plan.
- **Curator-override-ranking (`isLocalGem` først)** — vurdert men avvist (må endres på begge carouseller samtidig).
- **Per-tema `unit`-felt** (e.g. "spisesteder", "transportpunkt") — bruker generisk "steder" for enkelhet. Hvis ønsket, gjøres separat.
- **Analytics / klikk-tracking** — spec-flow C4 flagget nye events (`report_theme_slider_card_click` etc.). Ingen eksisterende infrastruktur. Separat plan.
- **URL deep-linking av modal-state** — eksisterende modal har ikke URL-sync. Separat plan om ønsket.
- **Generalisering av ReportMapBottomCarousel** — duplisering-refaktor til shared `POICardCarousel`. Separat plan hvis tredje bruker oppstår.
- **Sletting av `ReportPOICard`** — Guide-produktet bruker den. Separat plan hvis Guide migrerer.
- **Explorer/Guide-produkt-endringer** — dette er Report-only.

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-04-20-unified-poi-kort-kategori-slider-brainstorm.md`
- Arkitekturregler: `CLAUDE.md` (Kodebase-hygiene, "SLETT det gamle umiddelbart")
- Komponenter til endring/opprettelse:
  - `components/variants/report/ReportThemeSection.tsx` (endre)
  - `components/variants/report/ReportMapBottomCard.tsx` (gjenbruk, ingen endring)
  - `components/variants/report/blocks/ReportMapBottomCarousel.tsx` (mønster-referanse)
  - `components/variants/report/blocks/FeatureCarousel.tsx` (slett)
  - `components/variants/report/blocks/matdrikke-carousel.ts` (slett)
  - `components/variants/report/blocks/top-ranked-pois.ts` (NY)
  - `components/variants/report/blocks/ReportThemePOICarousel.tsx` (NY)
- POI-type: `lib/types.ts`
- Relaterte solutions:
  - `docs/solutions/ui-patterns/apple-style-slide-up-modal-with-backdrop-blur-20260415.md`
  - `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md`
  - `docs/solutions/architecture-patterns/unified-map-modal-2d-3d-toggle-20260415.md`
  - `docs/solutions/best-practices/dead-code-api-route-audit-20260216.md`

### Related Work

- Tidligere fjerning av bilder fra kart-bunn-carousel (per worklog)
- Tidligere unified-map-modal-2D/3D-refactor
- ReportMapBottomCard redesign (gammel commit `e507462`)

## Mechanical Checks (kjøres før PR)

```bash
npm run lint         # ESLint — 0 errors
npm test             # Vitest — alle tester passerer (inkl. nye)
npx tsc --noEmit     # TypeScript — ingen typefeil
npm run build        # Next.js — bygger uten feil
```

## Visual QA Checklist

- [ ] `http://localhost:3001/eiendom/banenor-eiendom/stasjonskvartalet/rapport` lastes uten feil
- [ ] Alle 7 tema-seksjoner har slider under narrativ, over kart
- [ ] Mat & Drikke har INGEN bilder i kort
- [ ] CTA vises kun når total > 6
- [ ] CTA-klikk åpner kart-modal for riktig tema
- [ ] Kortene i slider matcher kortene i modal-bunn (visuelt identiske)
- [ ] Mobile DevTools: swipe fungerer, ingen pull-to-refresh
- [ ] Keyboard: Tab + Arrow-keys navigerer
- [ ] Screen reader: per-tema aria-label leses
- [ ] Guide-side stikk-test: `GuideMapLayout` fortsatt funksjonell
