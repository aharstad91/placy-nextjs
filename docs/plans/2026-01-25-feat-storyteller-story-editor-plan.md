---
title: feat: StoryTeller - Story Editor for POI Curation
type: feat
date: 2026-01-25
---

# StoryTeller - Story Editor for POI Curation

## Overview

Et kurateringsgrensesnitt på `/admin/projects/[id]/story` for å finpusse stories generert av story generator. Brukeren kan velge/fjerne POI-er, sortere med drag-and-drop, og redigere tekster (bridge texts, seksjons-beskrivelser).

**Brainstorm:** `docs/brainstorms/2026-01-25-storyteller-story-editor-brainstorm.md`

## Problem Statement / Motivation

Etter at story generator kjører, har brukeren ingen måte å kuratere resultatet via UI:
- Må redigere JSON-filer manuelt
- Kan ikke fjerne uønskede POI-er visuelt
- Kan ikke justere rekkefølge på POI-er
- Kan ikke redigere bridge texts eller seksjons-beskrivelser

Dette gjør siste 10% av kurateringen unødvendig tungvint.

## Proposed Solution

En ny admin-side med hierarkisk liste-view:

```
/admin/projects/[id]/story
┌─────────────────────────────────────────────────┐
│ ← Tilbake til prosjekt                   [Lagre] │
├─────────────────────────────────────────────────┤
│ ▼ Mat & Drikke                                  │
│   Bridge text: [________________]               │
│   ▼ Kaffe & Bakeri                             │
│     Intro: [________________]                   │
│     ⠿ ☑ Jacobsen & Svart                       │
│     ⠿ ☑ Dromedar Kaffebar                      │
│     ⠿ ☐ Starbucks                              │
│   ▼ Spisesteder                                │
│     ...                                         │
│ ▶ Transport                                     │
│ ▶ Daglig Liv                                    │
└─────────────────────────────────────────────────┘
```

## Technical Considerations

### Data Source

**Supabase-tabeller (ikke JSON-filer):**
- `theme_stories` - Tema-stories med `bridge_text`, `sort_order`
- `theme_story_sections` - Seksjoner med `description`, `sort_order`
- `theme_section_pois` - Join-tabell med `poi_id`, `sort_order`
- `pois` - POI-data

### State Management

- Lokal React state for pending endringer
- Eksplisitt lagring med "Lagre"-knapp
- Server Actions med `revalidatePath()` etter mutasjoner

### Drag-and-Drop

**Må installere:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

**Scope:** Kun innenfor samme seksjon - ikke på tvers av seksjoner/themes.

### Key Decisions

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| POI-deseleksjon | Fjerner fra join-tabell | Enklere enn flagging |
| Tom seksjon | Tillatt med advarsel | Fleksibilitet for brukeren |
| Auto-save | Nei, eksplisitt | Unngå utilsiktede endringer |
| Expand-state | I localStorage | Bevarer UX ved refresh |

## Acceptance Criteria

### Funksjonelle krav

- [x] Side tilgjengelig på `/admin/projects/[id]/story`
- [x] Viser alle theme stories for prosjektet hierarkisk
- [x] Theme stories kan ekspanderes/kollapses
- [x] Seksjoner innenfor themes kan ekspanderes/kollapses
- [x] POI-er vises med checkbox og drag-handle
- [x] Checkbox toggle oppdaterer lokal state (ikke lagret ennå)
- [x] Drag-and-drop reordner POI-er innenfor seksjon
- [x] Bridge text og seksjonsbeskrivelse har inline-editorer
- [x] "Lagre"-knapp er disabled når ingen endringer
- [x] "Lagre"-knapp lagrer alle pending endringer til Supabase
- [x] Suksess-toast vises etter lagring
- [x] Feil-toast vises ved lagringsfeil

### Ikke-funksjonelle krav

- [x] Responsiv ned til tablet (1024px)
- [x] Keyboard-navigering for expand/collapse
- [x] Loading-state under lagring

## Success Metrics

- Brukere kan kuratere en story uten å redigere JSON
- Redusert tid fra generering til ferdig story

## Dependencies & Risks

### Avhengigheter

| Avhengighet | Status | Risiko |
|-------------|--------|--------|
| `@dnd-kit` pakker | Må installeres | Lav |
| Supabase theme_stories-tabeller | Eksisterer | Ingen |
| Eksisterende admin-styling | Tilgjengelig | Ingen |

### Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Drag-drop ytelse med 50+ POI-er | Medium | UX-degradering | Virtualisering hvis nødvendig |
| Samtidige redigeringer | Lav | Data-tap | "Last save wins" for MVP |

## Implementation Outline

### Filer som opprettes

```
app/admin/projects/[id]/story/
├── page.tsx                    # Server Component + Server Actions
└── story-editor-client.tsx     # Client Component med all UI-logikk

components/admin/story-editor/
├── theme-story-item.tsx        # Ekspanderbar theme story
├── section-item.tsx            # Ekspanderbar seksjon med inline-edit
├── sortable-poi-item.tsx       # POI med checkbox og drag-handle
└── inline-text-editor.tsx      # Tekst-felt med edit-modus
```

### Server Actions

```typescript
// page.tsx
async function saveStoryChanges(formData: FormData) {
  "use server";
  // 1. Parse JSON payload fra formData
  // 2. Oppdater theme_stories (bridge_text)
  // 3. Oppdater theme_story_sections (description)
  // 4. Oppdater theme_section_pois (selection + sort_order)
  // 5. revalidatePath(`/admin/projects/${projectId}/story`)
}
```

### Client State

```typescript
// story-editor-client.tsx
interface EditorState {
  themeStories: ThemeStoryEdit[];
  expandedThemes: Set<string>;
  expandedSections: Set<string>;
  hasChanges: boolean;
}

interface ThemeStoryEdit {
  id: string;
  bridgeText: string;
  sections: SectionEdit[];
}

interface SectionEdit {
  id: string;
  description: string;
  pois: { id: string; selected: boolean; sortOrder: number }[];
}
```

## References & Research

### Internal References

- Admin page pattern: `app/admin/projects/page.tsx`
- Client component pattern: `app/admin/projects/projects-admin-client.tsx`
- Confirm dialog: `components/admin/ConfirmDialog.tsx`
- Types: `lib/types.ts` (ThemeStory, ThemeStorySection)
- Database types: `lib/supabase/types.ts`

### External References

- @dnd-kit docs: https://docs.dndkit.com/
- Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions

### Related Work

- Brainstorm: `docs/brainstorms/2026-01-25-storyteller-story-editor-brainstorm.md`
- Admin pattern learning: `docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md`
