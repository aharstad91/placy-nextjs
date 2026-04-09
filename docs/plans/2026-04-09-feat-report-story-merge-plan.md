---
title: "feat: Merge Report + Story til unified storytelling-rapport"
type: feat
date: 2026-04-09
---

# feat: Merge Report + Story til unified storytelling-rapport

## Overview

Report og Story er for like til a eksistere side om side. Story sin storytelling-tilnarming gjenskaper hvordan en megler forteller om omradet — det er "the missing piece" Report manglet. Denne planen merger de to ved a bruke Report som base (infrastruktur, sticky kart, sporsmalsbokser) og erstatte POI-grid med Story sin narrative tekst + inline-POI-lenker.

## Problem Statement

- Report foler seg maskinelt — systematisk grid av POI-kort uten sjel
- Story har den redaksjonelle storytelling-kvaliteten meglere kjenner igjen fra visninger
- Begge produktene lever side om side og forvirrer — for like til a rettferdiggjore to faner
- Report har rik infrastruktur (sticky kart, scroll-tracking, floating nav) som Story mangler
- Story har rik innholdsopplevelse (narrativ tekst, inline-POI, 5-variant dialog) som Report mangler

## Proposed Solution

**Report beholder sin infrastruktur, Story sin innhold merges inn.**

### Beholdes fra Report
- ReportStickyMap — marker-pooling, theme visibility, fly-to, popup
- ReportFloatingNav — sticky pill-nav med scroll-progress
- ReportHero — sporsmalsbokser (ThemeChips), prosjektnavn, intro
- report-data.ts — datapipeline (tier-sorting, category filters)
- Scroll tracking + section reveal-animasjoner
- Desktop/mobil responsive layout

### Hentes fra Story
- `story-text-linker.ts` — matcher POI-navn i tekst til klikkbare spans
- `StoryPOIDialog` med 5 varianter (standard, transit, bysykkel, Hyre, skole)
- `bridge-text-generator.ts` — genererer editorial tekst per tema (allerede i lib/generators/)
- HoverCard-pattern fra StoryThemeChapter — hover-preview pa desktop
- extendedBridgeText rendering med inline-POI-lenker

### Fjernes fra Report
- POI-kort grid (ReportPOICard) — erstattes av storytelling
- Kategori-stats rad per tema ("12 steder | Snitt ★ 4.2 | 2733 anmeldelser")
- Sub-section grid layout og "Hent flere"-knapp
- ReportHighlightCard (brukt i mobil inline map)

### Layout-endring
- Desktop: 60/40 split (tekst 60%, kart 40%) — ned fra 50/50
- Teksten er na hovedinnholdet, kartet supplementerer

### Ny interaksjon
- Klikk inline-POI i tekst → POI-dialog apnes + kart flyr til marker
- Klikk marker i kart → MapPopupCard (eksisterende) — ingen tekst-highlight
- Hover inline-POI (desktop) → HoverCard mini-preview

## Technical Approach

### Steg 1: Flytt story-text-linker til shared

Flytt `components/variants/story/story-text-linker.ts` → `lib/utils/story-text-linker.ts` sa den kan brukes av Report.

**Filer:**
- `lib/utils/story-text-linker.ts` (ny plassering)
- `components/variants/story/StoryThemeChapter.tsx` (oppdater import)

### Steg 2: Utvid ReportTheme med extendedBridgeText

Legg til `extendedBridgeText` pa `ReportTheme` interface i `report-data.ts`. Hentes fra reportConfig eller genereres automatisk.

**Filer:**
- `components/variants/report/report-data.ts` — legg til felt pa interface + pipeline

### Steg 3: Refaktorer ReportThemeSection — erstatt POI-grid med storytelling

Dette er kjerneendringen. Erstatt `StickyMapContent` (POI-grid) med narrativ tekst + inline-POI-lenker.

**Gammel struktur:**
```
Theme heading → quote → stats row → intro → bridgeText → [POI card grid med load-more]
```

**Ny struktur:**
```
Theme heading → quote (editorial pitch) → narrativ tekst med inline-POI-lenker
```

**Fjern fra ReportThemeSection:**
- `POICardGrid` komponent
- `SubSectionContent` komponent  
- `FlatThemeContent` komponent
- `useProgressiveLoad` hook
- `LoadMoreButton` komponent
- Stats-raden ("12 steder | Snitt ★ 4.2 | 2733 anmeldelser")
- Import av `ReportPOICard`

**Legg til i ReportThemeSection:**
- Import `linkPOIsInText` fra `@/lib/utils/story-text-linker`
- Import `HoverCard`, `HoverCardTrigger`, `HoverCardContent` fra `@/components/ui/hover-card`
- Import `StoryPOIDialog` fra `@/components/variants/story/StoryPOIDialog`
- `POIInlineLink` komponent (adapter fra StoryThemeChapter sin versjon)
- `NarrativeContent` komponent som rendrer extendedBridgeText med inline-POI-lenker
- `useState<POI | null>` for activePOI (dialog)

**Moenster (hentet fra StoryThemeChapter):**
```tsx
const segments = extendedBridgeText
  ? linkPOIsInText(extendedBridgeText, allPOIs)
  : [];

// Render segments som tekst + klikkbare POI-lenker
{segments.map((seg, i) =>
  seg.type === "poi" && seg.poi ? (
    <POIInlineLink poi={seg.poi} content={seg.content} onClick={() => handlePOIClick(seg.poi)} />
  ) : (
    <span key={i}>{seg.content}</span>
  )
)}
```

**Filer:**
- `components/variants/report/ReportThemeSection.tsx` — stor refaktor

### Steg 4: Koble inline-POI til kart-sync

Nar bruker klikker inline-POI:
1. Apne StoryPOIDialog (lokal state i ReportThemeSection)
2. Kall `onPOIClick(poi.id)` for a synke med sticky map (fly-to)

ReportPage sin `handleCardClick` fungerer allerede — bare koble den til inline-POI-klikk.

**Filer:**
- `components/variants/report/ReportThemeSection.tsx` — koble onClick
- `components/variants/report/ReportPage.tsx` — fjern expandedThemes state (ikke lenger nodvendig)

### Steg 5: Endre desktop-layout til 60/40

Endre `ReportPage.tsx`:
- Venstre kolonne: `w-[50%]` → `w-[60%]`
- Hoyre kolonne: `w-[50%]` → `w-[40%]`

**Filer:**
- `components/variants/report/ReportPage.tsx`

### Steg 6: Fjern stats-rad og opprydding

Fjern fra ReportThemeSection:
- Stats-raden med "X steder | Snitt ★ Y | Z anmeldelser"
- `Star` import (brukes bare i stats)
- `ChevronDown`, `Loader2` imports (brukes bare i load-more)

**Filer:**
- `components/variants/report/ReportThemeSection.tsx`

### Steg 7: Deaktiver Story-fane

Fjern Story fra navigasjonen i layout.tsx.

**Filer:**
- `app/eiendom/[customer]/[project]/layout.tsx` — fjern `{ label: "Story", mode: "story" }` fra `ALWAYS_AVAILABLE_MODES`

### Steg 8: Mobil-layout tilpasning

Mobil bruker `ReportInteractiveMapSection` i dag. Erstatt med:
- Narrativ tekst med inline-POI-lenker (samme som desktop)
- StoryPOIDialog (Drawer pa mobil, automatisk via useMediaQuery)
- Behold per-tema kart men gjor det mindre/enklere

**Filer:**
- `components/variants/report/ReportThemeSection.tsx` — mobil-sti bruker samme narrative innhold

## Acceptance Criteria

- [ ] Report viser narrativ tekst med inline-POI-lenker i stedet for POI-grid
- [ ] Klikk pa inline-POI apner StoryPOIDialog (5 varianter)
- [ ] Klikk pa inline-POI flyr kart til markoren
- [ ] Klikk pa kartmarkor viser MapPopupCard (eksisterende atferd)
- [ ] HoverCard pa hover over inline-POI (desktop)
- [ ] Desktop-layout er 60/40 (tekst/kart)
- [ ] Stats-rad per tema er fjernet
- [ ] Story-fane er deaktivert fra navigasjon
- [ ] Mobil fungerer med narrativ tekst + Drawer-dialog
- [ ] Floating nav fungerer som for
- [ ] Sporsmalsbokser i hero fungerer som for
- [ ] Scroll-tracking og section-reveal fungerer som for
- [ ] Eksisterende mekaniske sjekker passer (lint, typecheck, build)

## References

- `components/variants/report/ReportThemeSection.tsx` — hovedfil for refaktor
- `components/variants/report/ReportPage.tsx` — layout og state
- `components/variants/report/report-data.ts` — datapipeline
- `components/variants/story/StoryThemeChapter.tsx:112-172` — POIInlineLink moenster
- `components/variants/story/story-text-linker.ts` — POI-tekst-linking
- `components/variants/story/StoryPOIDialog.tsx` — 5-variant dialog
- `lib/generators/bridge-text-generator.ts` — narrativ tekstgenerering
- `app/eiendom/[customer]/[project]/layout.tsx:45-48` — Story nav-deaktivering
