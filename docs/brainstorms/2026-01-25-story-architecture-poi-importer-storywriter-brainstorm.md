# Story Architecture: POI Importer & StoryWriter

**Dato:** 2026-01-25
**Status:** Design besluttet

## Hva vi bygger

En to-delt arkitektur for story-generering:

### 1. POI Importer (bakgrunnsprosess)
- Henter POI-er fra eksterne kilder (Google Places, Entur, Bysykkel)
- Lagrer direkte til Supabase `pois`-tabellen
- Kjøres manuelt/periodisk, separat fra story-generering
- Unngår unødvendige API-kall ved å gjenbruke eksisterende data

### 2. StoryWriter (autonom story-generator)
- Bruker **kun** POI-er som allerede finnes i Supabase
- Tar input: prosjekt, senterkoordinater, radius, kategorier
- Output: Genererer theme_stories, theme_story_sections, og theme_section_pois direkte i Supabase
- Full autonom strukturering - themes, seksjoner, bridge-tekster

### 3. Story Editor (manuell redigering - eksisterer)
- Redigerer generert struktur fra StoryWriter
- Drag & drop sortering av POI-er
- Redigering av tekster
- Allerede implementert i `/admin/projects/[id]/story`

## Dataflyt

```
[Google/Entur/Bysykkel API]
          ↓
   [POI Importer]  ← Kjøres separat (manuelt/scheduled)
          ↓
      [Supabase pois]
          ↓
   [StoryWriter]   ← Bruker radius + kategorier for å filtrere
          ↓
      [Supabase theme_stories + sections + pois]
          ↓
   [Story Editor]  ← Manuell finjustering
          ↓
      [Frontend Story Visning]
```

## Hvorfor denne tilnærmingen

1. **Separasjon av ansvar:** Import er dyrt (API-kall), strukturering er billig (database-queries)
2. **Gjenbruk:** POI-er importert én gang kan brukes i mange stories
3. **Forutsigbarhet:** StoryWriter feiler ikke pga. API-issues
4. **Kostnadskontroll:** Google API-kall kun ved bevisst import, ikke ved hver story

## Viktige beslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| POI-kilde for StoryWriter | Kun Supabase | Separerer import fra strukturering |
| POI-utvalg | Radius + kategorier | Gir kontroll over hvilke POI-er som inkluderes |
| Autonomi-nivå | Full auto | Themes, seksjoner og tekster genereres automatisk |
| GUI-forhold | Import er bakgrunn | Ren separasjon, StoryWriter bruker det som finnes |

## Åpne spørsmål

1. **Import-strategi:** Skal POI Importer dekke hele Trondheim på forhånd, eller kjøres on-demand for nye områder?
2. **Oppdatering:** Hvor ofte skal eksisterende POI-er oppdateres (rating, åpningstider)?
3. **Deduplisering:** Hvordan håndtere POI-er som finnes fra flere kilder?

## Neste steg

Kjør `/workflows:plan` for å planlegge implementasjon av:
1. StoryWriter (høyest prioritet - kritisk feature)
2. POI Importer (for å fylle databasen)
