# Placy - Prosjektkontekst for Claude

Dette er en Next.js 14-app for **Placy**, en lokasjonsbasert storytelling-plattform.

## Viktige filer

| Fil | Beskrivelse |
|-----|-------------|
| `COMMANDS.md` | **Alle kommandoer og scripts** |
| `context/placy-concept-spec.md` | Full produktspesifikasjon med all funksjonalitet |
| `PRD.md` | Gjeldende oppgaveliste og status |
| `lib/types.ts` | Alle TypeScript-typer |
| `lib/store.ts` | Zustand global state |
| `lib/generators/` | Story-generering moduler |
| `data/projects/klp-eiendom/ferjemannsveien-10.json` | Demo-data |
| `data/templates/input.template.json` | Mal for nye prosjekter |

## Kjernekonsepter

**POI (Point of Interest):** Fysiske steder med koordinater, kategori, og valgfri Google-data/redaksjonelt innhold.

**Story:** Hovedsiden med hero, seksjoner og POI-lister.

**Theme Story:** Tematisk dypdykk som åpnes i 50/50 modal (liste + kart).

**Travel Mode:** walk/bike/car - påvirker reisetider og ruter.

**Time Budget:** 5/10/15 min - brukes til å filtrere/dimme POI-er.

## Teknisk stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Mapbox GL JS (kart)
- Lucide React (ikoner)

## API-er

- **Mapbox Directions:** `/api/directions` - ruteberegning
- **Mapbox Matrix:** `/api/travel-times` - reisetidsberegning
- **Entur:** `/api/entur` - sanntids kollektivtransport
- **Bysykkel GBFS:** `/api/bysykkel` - ledige sykler
- **Google Places:** `/api/places` - POI-detaljer og bilder

## Story Generator

Automatisk generering av stories fra koordinater:

```bash
# Generer ny story
npm run generate:story data/projects/kunde/prosjekt.input.json -- --skip-travel-times
```

Se `COMMANDS.md` for full dokumentasjon.

### Generator-moduler

| Modul | Beskrivelse |
|-------|-------------|
| `lib/generators/poi-discovery.ts` | Henter POI-er fra Google, Entur, Bysykkel |
| `lib/generators/travel-times.ts` | Beregner reisetider via Mapbox |
| `lib/generators/story-structure.ts` | Auto-strukturerer themes og seksjoner |
| `lib/generators/merge-data.ts` | Merger ny data med eksisterende |

## Editorial Hooks (Claude Code)

For å generere redaksjonelt innhold, si i Claude Code:

```
Generer editorial hooks for POI-ene i data/projects/kunde/prosjekt.json
```

Claude søker på nettet og genererer:
- `editorialHook` - Én setning om det unike ved stedet
- `localInsight` - Insider-tips

## Kjør dev server

```bash
npm run dev
```

Appen redirecter automatisk til `/klp-eiendom/ferjemannsveien-10`.
