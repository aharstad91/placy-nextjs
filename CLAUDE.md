# Placy - Prosjektkontekst for Claude

Dette er en Next.js 14-app for **Placy**, en lokasjonsbasert storytelling-plattform.

## Viktige filer

| Fil | Beskrivelse |
|-----|-------------|
| `context/placy-concept-spec.md` | Full produktspesifikasjon med all funksjonalitet |
| `PRD.md` | Gjeldende oppgaveliste og status |
| `.ralphy/config.yaml` | Ralphy-konfigurasjon med regler |
| `lib/types.ts` | Alle TypeScript-typer |
| `lib/store.ts` | Zustand global state |
| `data/projects/klp-eiendom/ferjemannsveien-10.json` | Demo-data |

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
- **Entur:** Sanntids kollektivtransport (ikke implementert)
- **Bysykkel GBFS:** Ledige sykler (ikke implementert)
- **Google Places:** POI-detaljer og bilder (ikke implementert)

## Kjør dev server

```bash
npm run dev
```

Appen redirecter automatisk til `/klp-eiendom/ferjemannsveien-10`.
