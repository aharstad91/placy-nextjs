---
date: 2026-01-25
topic: storyteller-story-editor
---

# StoryTeller (Story Editor)

## Hva Vi Bygger

Et kurateringsgrensesnitt for å finpusse stories generert av story generator:

**StoryTeller** (`/admin/projects/[id]/story`) - Hierarkisk liste-view for å:
- Se oversikt over alle tema-stories med seksjoner og POI-utvalg
- Velge/fjerne POI-er fra seksjoner
- Sortere POI-er med drag-and-drop
- Finjustere tekster (bridge texts, seksjons-intro) manuelt

### Brukerreise

1. Story generator kjører og oppretter 90% av strukturen automatisk (inkl. template-tekster)
2. Bruker går til `/admin/projects/[id]/story`
3. Ser full oversikt: alle tema-stories med seksjoner og POI-utvalg
4. Velger/fjerner POI-er med checkboxes
5. Drar POI-er for å endre rekkefølge (drag-and-drop)
6. Finjusterer tekster manuelt i inline-editorer
7. Klikker "Lagre endringer"

**Merk:** AI-generering av tekster er IKKE del av denne featuren. Generatoren lager template-tekster, og StoryTeller brukes til manuell kuratering.

## Hvorfor Denne Tilnærmingen

**Vurderte alternativer:**

| Tilnærming | Vurdering |
|------------|-----------|
| Tab-basert per theme | Mer fokusert, men mister helhetsoversikt |
| Accordion + Preview | God feedback, men overkill for MVP |
| **Integrert Story Editor** | ✅ Valgt - enkel mental modell, ser alt på én side |

**Begrunnelse:**
- Følger eksisterende admin-mønster (hierarkisk, ekspanderbar)
- Naturlig plassering under prosjekt-admin
- Én side gir full kontroll uten kontekst-bytte
- Kan utvides med preview senere

## Nøkkelbeslutninger

- **Plassering:** `/admin/projects/[id]/story` - underside av prosjekt-admin
- **Struktur:** Hierarkisk liste med ekspanderbare tema-stories
- **POI-håndtering:** Checkboxes for valg, drag-and-drop for rekkefølge
- **Tekst-redigering:** Inline-editorer for bridge text og seksjons-intro (manuell)
- **Lagring:** Eksplisitt med "Lagre endringer"-knapp
- **Ingen AI-generering i denne featuren** - tekster kommer fra generator-templates

## UI-struktur

```
/admin/projects/[id]/story
┌─────────────────────────────────────────────────┐
│ ← Tilbake til prosjekt                   [Lagre] │
├─────────────────────────────────────────────────┤
│ ▼ Mat & Drikke                                  │
│   Bridge text: [________________]               │
│                                                 │
│   ▼ Kaffe & Bakeri                             │
│     Intro: [________________]                   │
│     ⠿ ☑ Jacobsen & Svart                       │
│     ⠿ ☑ Dromedar Kaffebar                      │
│     ⠿ ☐ Starbucks                              │
│                                                 │
│   ▼ Spisesteder                                │
│     Intro: [________________]                   │
│     ⠿ ☑ Trondhjem Mikrobryggeri                │
│     ...                                         │
│                                                 │
│ ▶ Transport                                     │
│ ▶ Daglig Liv                                    │
│ ▶ Trening & Helse                              │
└─────────────────────────────────────────────────┘

⠿ = drag handle
☑/☐ = checkbox for inkludering
```

## Åpne Spørsmål

- Skal det være mulig å legge til POI-er som ikke ble funnet av generator?
- Hvordan håndtere POI-er som tilhører flere kategorier/themes?
- Trenger vi undo/redo for endringer før lagring?
- Skal endringer lagres til JSON-fil eller database?

## Neste Steg

→ `/workflows:plan` for implementasjonsdetaljer
