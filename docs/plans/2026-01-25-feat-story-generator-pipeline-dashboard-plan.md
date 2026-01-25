---
title: Story Generator GUI
type: feat
date: 2026-01-25
revised: 2026-01-25
---

# Story Generator GUI

## Overview

En enkel genererings-side som erstatter manuell `.input.json`-opprettelse med et visuelt skjema. Klikk på kart for koordinater, velg kategorier, trykk "Generer".

**Målgruppe:** Utviklere/tekniske brukere
**Brainstorm:** `docs/brainstorms/2026-01-25-story-generator-gui-brainstorm.md`

## Problem Statement

**Nåværende smerte:** Manuelt opprette `.input.json` er kjedelig - må finne koordinater, huske kategori-IDer, kjøre CLI.

**Løsning:** Skjema med kart-basert koordinat-valg og "Generer"-knapp.

## Proposed Solution

### UI Layout

Følg eksisterende `/admin/pois` pattern: floating panel over fullskjerm-kart.

```
┌────────────────┬─────────────────────────────────────────┐
│ Floating Panel │                                         │
│ ┌────────────┐ │           Full Map                      │
│ │ Prosjekt   │ │                                         │
│ │ [Navn]     │ │      (Klikk for å sette senter)         │
│ │ [Kunde]    │ │                                         │
│ ├────────────┤ │         ◉ <- senter-markør              │
│ │ Radius     │ │         ○ <- radius-sirkel              │
│ │ [○───●───] │ │                                         │
│ ├────────────┤ │                                         │
│ │ Kategorier │ │                                         │
│ │ ☑ Restaurant│ │                                        │
│ │ ☑ Café     │ │                                         │
│ │ ☐ Gym      │ │                                         │
│ ├────────────┤ │                                         │
│ │ [Generer]  │ │                                         │
│ └────────────┘ │                                         │
└────────────────┴─────────────────────────────────────────┘
```

### Teknisk tilnærming

**3 filer:**

1. **`app/admin/generate/page.tsx`** - Server component, auth-sjekk
2. **`app/admin/generate/generate-client.tsx`** - Skjema + kart
3. **`app/api/generate/route.ts`** - Kaller eksisterende generator-moduler

**Gjenbruk:**
- Kart-patterns fra `poi-admin-client.tsx`
- Generator-moduler: `discoverPOIs()`, `generateStoryStructure()`

## Acceptance Criteria

### Skjema

- [ ] Navn-input (påkrevd)
- [ ] Kunde-input (slug-format, påkrevd)
- [ ] Kart-klikk setter senter-koordinater
- [ ] Radius-slider (500m, 1000m, 1500m)
- [ ] Kategori-checkboxes (standard: restaurant, cafe, transport)
- [ ] "Generer"-knapp

### Generering

- [ ] Vise loading-state under generering
- [ ] Vise feilmelding hvis noe feiler
- [ ] Vise suksess med link til generert story
- [ ] Skrive output til `data/projects/{kunde}/{slug}.json`

### Kart

- [ ] Fullskjerm kart (Mapbox)
- [ ] Klikk plasserer senter-markør
- [ ] Radius-sirkel rundt senter
- [ ] Oppdateres når radius endres

## Technical Details

### API Route

```typescript
// app/api/generate/route.ts
import { discoverPOIs } from '@/lib/generators/poi-discovery'
import { generateStoryStructure } from '@/lib/generators/story-structure'

export async function POST(request: Request) {
  const { name, customer, center, radius, categories } = await request.json()

  // 1. Discover POIs (10-20 sek)
  const pois = await discoverPOIs({
    center,
    radius,
    googleCategories: categories,
    // ... config
  })

  // 2. Generate structure
  const { story, allCategories } = generateStoryStructure(pois, {
    themes: defaultThemes,
    // ...
  })

  // 3. Write to file
  const outputPath = `data/projects/${customer}/${slug}.json`
  await writeFile(outputPath, JSON.stringify(project, null, 2))

  return Response.json({ success: true, path: outputPath, poiCount: pois.length })
}
```

### Loading State

Generering tar 10-30 sek. Vis:
```
Genererer story...
✓ Søker POIs (12 funnet)
○ Bygger struktur...
```

Bruk `useState` for steg - ingen database-persistering nødvendig.

## Implementation

### Fil 1: `app/admin/generate/page.tsx`

```typescript
import { redirect } from 'next/navigation'
import { GenerateClient } from './generate-client'

export default async function GeneratePage() {
  if (process.env.ADMIN_ENABLED !== 'true') {
    redirect('/')
  }
  return <GenerateClient />
}
```

### Fil 2: `app/admin/generate/generate-client.tsx`

Client component med:
- react-map-gl kart (kopi fra poi-admin)
- Form state med useState
- Kart onClick for koordinater
- Radius-slider
- Kategori-checkboxes
- Submit som kaller API route

### Fil 3: `app/api/generate/route.ts`

Se "Technical Details" over.

## What We're NOT Building

- Pipeline status-tracking i database
- Batch editorial workflow (bruk Claude Code)
- Filter/sortering av POIs (bruk eksisterende /admin/pois)
- Virtual scrolling
- Mobil-optimalisering

## Success Criteria

- Kan generere ny story fra GUI på under 2 min
- Ingen manuell JSON-redigering nødvendig
- Fungerer like godt som CLI

## References

### Patterns å følge

- Kart + floating panel: `app/admin/pois/poi-admin-client.tsx:340-500`
- Form validation: `app/admin/pois/poi-admin-client.tsx:200-250`
- Generator-kall: `scripts/generate-story.ts:50-150`

### Gjenbruk

- `lib/generators/poi-discovery.ts` - discoverPOIs()
- `lib/generators/story-structure.ts` - generateStoryStructure()
- `data/templates/input.template.json` - default kategorier
