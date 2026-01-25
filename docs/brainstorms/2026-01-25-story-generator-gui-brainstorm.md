---
date: 2026-01-25
topic: story-generator-gui
---

# Story Generator GUI

## What We're Building

Et Pipeline Dashboard for programmatisk story-generering - en enkelt prosjektside som gir full oversikt over genererings-pipelinen med steg-for-steg kontroll.

**Hovedkomponenter:**
- Pipeline-status panel (Discovery → Structure → Editorial)
- Kart-preview med POI-fordeling
- POI-liste med filter og dekningstatus per kategori
- Editorial batch-workflow med Claude-støtte

**Brukergruppe:** Utviklere/tekniske brukere

## Why This Approach

**Vurderte alternativer:**

1. **Pipeline Dashboard** (valgt) - Alt på én side, visuell feedback, kart gir kontekst
2. **Wizard-flyt** - Lineær steg-for-steg, men for mye klikking frem/tilbake
3. **Kanban** - God for mange prosjekter, men overkill for nåværende behov

Dashboard-tilnærmingen gir best oversikt uten kontekst-bytte, og passer for tekniske brukere som vil se hele bildet.

## Key Decisions

### Data-lagring: Supabase
- Flytte fra JSON-filer til database
- Muliggjør bedre GUI-integrasjon og sanntidsoppdateringer
- POI-tabellen finnes allerede, må utvide med prosjekt-struktur

### Pipeline-kontroll: Steg-for-steg
- Separate triggere for hvert steg (Discovery, Structure, Editorial)
- Ikke alt-i-ett automasjon - brukeren vil ha kontroll
- Visuell status på hvert steg (pending/running/done)

### Editorial workflow: Curated batch
- Claude foreslår hvilke POIs som trenger editorial
- Bruker reviewer/justerer listen
- Claude genererer hooks/insights for valgte POIs
- Bruker gjør endelig review/redigering

### UI-layout: Tre-panels dashboard
```
┌─────────────────┬──────────────────────────────────┐
│ Pipeline-steg   │         Kart-preview             │
├─────────────────┤         (POI-fordeling)          │
│ POI-liste med   ├──────────────────────────────────┤
│ filter & status │ POI-detaljer/Editor              │
└─────────────────┴──────────────────────────────────┘
```

### AI-integrasjon: Bruk eksisterende abonnement
- Gjenbruk eksisterende mønstre der mulig
- Hold implementasjonen enkel
- Konkret mekanisme avklares under planlegging

## Open Questions

- **Database-schema:** Hvordan strukturere prosjekter, stories, themes i Supabase?
- **Pipeline-state:** Hvor lagres status for hvert steg? (database-kolonne vs egen tabell)
- **Generator-refactor:** Må lib/generators/* refaktoreres for å fungere med Supabase i stedet for JSON?
- **Editorial AI-trigger:** API route vs Claude Code MCP vs annen løsning?
- **Autentisering:** Beholde enkel ADMIN_ENABLED-toggle eller innføre auth?

## Design Notes

- Iterativ utvikling - vi må revidere når vi har noe visuelt
- Teknisk OK å vise JSON, status, etc.
- Hold det minimalt - mest mulig automasjon, minst mulig manuelt arbeid
- Eksisterende `/admin/pois` kan gjenbrukes/utvides

## Next Steps

→ `/workflows:plan` for detaljert implementeringsplan
