---
title: Report + Story Merge — Unified Report med Storytelling
date: 2026-04-09
type: brainstorm
---

# Report + Story Merge — Unified Report med Storytelling

## Hva vi bygger

Merge Report og Story til ett produkt under Report-fanen. Report beholder sin infrastruktur (sticky kart, floating nav, sporsmalsbokser), men POI-grid erstattes med Story sin storytelling-tilnarming: narrativ tekst med inline-POI-lenker som er klikkbare.

## Hvorfor

Report foltes maskinelt — systematisk grid av POI-kort uten sjel. Story sin storytelling gjenskaper hvordan en megler forteller om omradet pa en visning. Det gir gjenkjenningseffekt for meglere og bedre brukeropplevelse. De to produktene er for like til a eksistere side om side.

## Nokkelbesluninger

### 1. Report er basen, Story merges inn
- Report har tung infrastruktur: sticky kart med marker-pooling, scroll-tracking, floating nav, 50/50 layout, mobil-layout, datapipeline
- Story sin innovasjon (narrativ tekst + inline-POI + 5-variant dialog) er portable features
- Mindre risiko enn å bygge nytt fra scratch

### 2. Hva beholdes fra Report
- **ReportStickyMap** — marker-pooling, theme visibility, fly-to, popup
- **ReportFloatingNav** — sticky pill-nav med scroll-progress
- **ReportHero** — sporsmalsbokser (ThemeChips), prosjektnavn, intro
- **report-data.ts** — datapipeline (tier-sorting, category filters, stats)
- **Scroll tracking** + section reveal-animasjoner
- **Desktop/mobil layouts** — responsive arkitektur

### 3. Hva hentes fra Story
- **story-text-linker.ts** — matcher POI-navn i tekst til klikkbare spans
- **StoryPOIDialog** med 5 varianter (standard, transit, bysykkel, Hyre, skole)
- **bridge-text-generator.ts** — genererer editorial tekst per tema (allerede i lib/generators/)
- **HoverCard-pattern** — hover-preview pa inline-POI (desktop)
- **extendedBridgeText** rendering med inline-POI-lenker

### 4. Hva fjernes fra Report
- POI-kort grid (ReportPOICard, ReportHighlightCard) — erstattes av storytelling
- Kategori-stats rad per tema ("12 steder | Snitt ★ 4.2 | 2733 anmeldelser") — ratings horer til pa kortene
- Sub-section grid layout og "Hent flere"-knapp
- Kartet far mindre plass

### 5. Layout: 40/60 split
- Desktop: tekst 60%, kart 40% (ned fra 50/50)
- Teksten far mer plass — den er na hovedinnholdet, ikke bare en indeks
- Kartet supplementerer og harmonerer med storytelling

### 6. Ny interaksjon
- **Klikk inline-POI i tekst** → POI-dialog apnes + kart flyr til marker
- **Klikk marker i kart** → MapPopupCard (eksisterende) — ingen tekst-highlight
- **Hover inline-POI** (desktop) → HoverCard mini-preview

### 7. Story-fanen deaktiveres
- Fjernes fra navigasjon, men koden slettes ikke enna
- Git har historikk — ryddes nar vi er sikre pa at merge fungerer

## Apne sporsmal
- Mobil-layout: hvordan vises storytelling + kart? Inline kart per tema (som Story) eller noe nytt?
- Skal bridgeText og extendedBridgeText genereres on-the-fly eller cached i reportConfig?
- Hva med temaer som har mange POI-er (20+) men kort tekst? Trenger vi en "se alle"-mekanisme?
