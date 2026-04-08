---
title: "Story-visning — S&J-inspirert editorial storytelling med interaktive POI-er"
date: 2026-04-08
tags: [story, editorial, sem-johnsen, bridge-text, poi-linking, interactive-map, mapbox]
category: feature-implementations
module: story-visning
symptoms:
  - "Report-produktet er kjedelig — grid av POI-kort, lite narrativ"
  - "Ingen S&J-stil beliggenhetstekst i produktet"
  - "POI-data og narrativ tekst er separert — ikke sydd sammen"
---

# Story-visning — S&J-inspirert editorial storytelling

## Problem

Report-produktet viser alt som grid/liste med POI-kort. Boligkjøpere møter en vegg av data uten narrativ. Sem & Johnsen (S&J) — Norges premium eiendomsmegler — skriver beliggenhetstekster med historisk kontekst, emosjonelle ankerpunkter, og livsfase-perspektiv. Placy hadde ingen måte å presentere POI-data i dette formatet.

## Løsning

### 1. Research-fase: Mønsteranalyse av 160 beliggenhetstekster

Scrapet og analysert ~160 tekster fra 8 meglerkjeder. Identifisert:
- 10 gjennomgående temaer i megler-beliggenhetstekster
- S&J sin 7-stegs strukturmal (Karakter → Historie → Hverdag → Natur → Skoler → Transport → Livsstil)
- S&J sine signaturkvaliteter: navngitte steder med karakter, sesongvariasjon, emosjonelle ankerpunkter, kombinasjonsargumentet ("rolig og landlig, men sentralt")

**Fil:** `docs/research/2026-04-08-beliggenhetstekst-moensteranalyse.md`

### 2. Bridge Text Generator (auto-generert narrativ)

Template-basert generator som produserer S&J-kalibrert bridgeText per tema fra faktiske POI-data. Ingen runtime LLM-kall.

**Prinsipper fra Brøset 046 gullstandard:**
- 1-2 ankersteder per tema (vis spenn, ikke liste)
- Kontrastpar: nær ↔ fjern, innendørs ↔ utendørs
- Siste setning = hverdagskonklusjon
- Alltid navngi faktiske POI-er

**Fil:** `lib/generators/bridge-text-generator.ts`

### 3. Story-visning (ny rute)

`/eiendom/[customer]/[project]/story` — premium editorial article-format:

| Komponent | Funksjon |
|-----------|----------|
| `StoryHero` | Prosjektnavn + heroIntro + tema-navigasjon |
| `StoryThemeChapter` | Kapittel per tema: bridge → extended med inline POI-lenker → kart |
| `StoryPOIDialog` | Modal dialog med POI-detaljer (rating, hook, insight) |
| `StoryMap` | Interaktivt Mapbox-kart med aktiverings-overlay |
| `story-text-linker.ts` | Matcher POI-navn i prosa → klikkbare elementer |

### 4. Inline POI-interaktivitet (nøkkelinnsikt)

**Problemet med separate POI-kort:** Tekst og data er "dobbelt opp" — narrativet nevner steder, og kortene under gjentar dem.

**Løsningen:** POI-navn i extendedBridgeText gjøres til klikkbare `<span>`-elementer. Klikk åpner en `<dialog>` med POI-detaljer. Narrativ og data er sydd sammen.

```typescript
// story-text-linker.ts matcher POI-navn i tekst
const segments = linkPOIsInText(extendedBridgeText, allPOIs);
// → [{ type: "text", content: "... ned til " }, 
//    { type: "poi", content: "Valentinlyst Senter", poi: {...} },
//    { type: "text", content: " — Coop Mega..." }]
```

### 5. Kart-overlay for scroll-lock

Statisk kart med "Utforsk kartet"-overlay som CTA:
- Overlay har `pointer-events: none` → sidescroll passerer gjennom
- CTA-knapp har `pointer-events: auto` → klikkbar
- Klikk → fjern overlay, aktiver kart-interaktivitet

**Status:** Implementert men har rendering-bug (overlay rendres ikke pga SSR/hydration mismatch med `dynamic({ ssr: false })`). Trenger fix i neste sesjon.

## Data-flow

```
Supabase (products.config.reportConfig)
  → getProductAsync()
  → transformToStoryData()      // Henter heroIntro, bridgeText, extendedBridgeText
  → fallback: generateBridgeText()  // Auto-generert hvis manuelt mangler
  → StoryPage → StoryThemeChapter × N
```

reportConfig.themes[].bridgeText (Curator-kvalitet) overstyrer alltid auto-generert bridgeText.

## Nøkkelinnsikter

1. **Interaktivitet i teksten > separate POI-kort.** Klikkbare stedsnavn i prosa binder narrativ og data.
2. **Template-basert bridgeText er ~70% av Curator-kvalitet.** Ankersteder + kontraster + gangavstand fungerer uten LLM.
3. **reportConfig.extendedBridgeText er det som gjør S&J-nivå.** 4-6 setninger med bevegelse gjennom nabolaget, overraskelsesmomenter, spesifikke detaljer.
4. **Story og Report deler data, ikke UI.** Same Supabase-data, men helt forskjellig presentasjon.

## Relevante filer

- `app/eiendom/[customer]/[project]/story/page.tsx` — Server component
- `components/variants/story/` — Alle Story-komponenter
- `lib/generators/bridge-text-generator.ts` — Auto-generator
- `docs/research/2026-04-08-beliggenhetstekst-moensteranalyse.md` — Research
- `.claude/skills/curator/references/bridge-text-calibration.md` — Gullstandard
