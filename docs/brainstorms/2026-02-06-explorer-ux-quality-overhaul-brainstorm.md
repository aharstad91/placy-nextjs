---
title: Explorer UX Quality Overhaul
date: 2026-02-06
type: brainstorm
status: decided
---

# Explorer UX Quality Overhaul

## What We're Building

En omfattende oppgradering av Explorer-produktet for å gjore det fra "vis alle POI-er" til "vis de riktige POI-ene, vakkert". Syv sammenkoblede forbedringer:

1. **POI cap (100)** — Begrens til 100 POI-er for ytelse og mental load
2. **Smartere POI-utvalg** — Hotellprofil med blacklist + relevans-scoring
3. **Native points** — Ta i bruk lokalkuraterte POI-er der Google svikter
4. **Default til fots** — Gange som standard reisemodus
5. **Prosjektmarkør med navn + pulse** — Vis hotellets navn, puls-effekt
6. **Bilder på alle POI-er** — Hent Google Photos for alle 100, cache permanent
7. **Tema-chips med underkategorier** — Gjenbruk Report-temaer, erstatt flat dropdown

## Why This Approach

Basert pa visuell QA av Scandic Nidelven Explorer:
- 166 POI-er er for mange — kartet blir rotete, sidebar uoverkommelig
- Irrelevante POI-er (MMA, Kickboxing, frisorer) gir "AI-kuratert"-folelse
- "breheimen national" (screenshot #2) er et Google Places-resultat som gir ingen mening
- Sentrum-markoren viser "Sentrum" i stedet for hotellets navn
- Mange POI-kort mangler bilder — gir fattig UX
- 17 kategorier i flat dropdown er overveldende

## Key Decisions

### 1. POI Cap: Fast 100 for alle prosjekttyper
- Enklere a implementere, konsistent opplevelse
- 100 er nok til a dekke alle relevante kategorier uten overload
- Cap gjelder Explorer-produktet, Report kan ha egne caps per tema

### 2. Kategori-logikk: Hotellprofil + smartere scoring (begge deler)
- **Blacklist per prosjekttype:** Hotell ekskluderer MMA, kickboxing, kampsport, og lignende nisjekategorier. Frisorer fjernes for hotell (folk klipper seg hjemme).
- **Relevans-scoring:** Juster poi-score.ts med relevans-faktor per prosjekttype. Busstopp cappes til 3-4 narmeste. Transport-POI-er far lavere base-score sa de ikke fyller opp 100-cappen.
- **Implementering:** Ny `project_type` pa prosjektet (hotel, residential, commercial). Profiler definert i kode med kategori-vekter.

### 3. Native Points: Aktiver eksisterende system
- `google_place_id IS NULL` = native POI (allerede stottet i kode)
- Trenger: admin-UI for a opprette native POI-er per prosjekt
- Use case: Lokale perler, steder Google ikke vet om, fikse feil som "breheimen national"
- POI admin finnes allerede med kart-klikk for koordinater

### 4. Default travel mode: Til fots
- Allerede default i `lib/store.ts:11` — `travelMode: "walk"`
- MEN: UI-dropdown viser "Sykkel" som forste valg visuelt? Trenger verifisering.
- Persist i localStorage via Zustand — forste besok = walk

### 5. Prosjektmarkor: Navn + pulse
- Erstatt "Sentrum"-label med prosjektnavn (f.eks. "Scandic Nidelven")
- Legg til CSS pulse-animasjon pa markoren (blatt glod)
- Skru av pulse nar geolokasjon er aktiv (geoMode === "gps-near"/"gps-far")
- Fil: `ExplorerMap.tsx:262-278`

### 6. Bilder: Alle ved generering, permanent cache
- Hent Google Photos for alle 100 POI-er under /generate-hotel
- Lagre `photo_url` direkte pa POI-en (som `featured_image`)
- Engangskostnad ~$0.70 per prosjekt
- Oppdater med cron/manuelt hvert halvar
- Native POI-er far manuelt opplastet bilde via admin

### 7. Tema-chips: Gjenbruk Report-temaer
- Erstatt `CategoryPackage` i explorer-packages.ts med `ReportThemeDefinition` fra report-themes.ts
- Start med alle temaer synlige (alle POI-er vises)
- Toggle av/pa per tema med chip-knappar
- Chip-design: `[Ikon] Mat & Drikke (8) [v]` — chevron apner underkategori-dropdown
- Underkategorier: toggle individuelle kategorier innenfor tema
- Synkronisert med Report-temaer sa begge produkter bruker samme gruppering

## Resolved Questions

1. **Transport-tema:** Eget tema-chip, konsistent med de andre. Kan toggles av/pa.
2. **Cap-fordeling:** Vektet per tema — f.eks. mat: 30, kultur: 15, transport: 20, trening: 15, hverdag: 20. Justeres per prosjekttype.
3. **Native points:** Bare Placy-team kuraterer. Hoy kvalitet, skalering later.
4. **Bysykkel/transport dedup:** Begrenses via tema-cap (transport: ~20 totalt inkl buss+bysykkel+tog).

## Technical Notes

### Eksisterende filer som berores
- `components/variants/explorer/ExplorerPage.tsx` — Hoved-logikk
- `components/variants/explorer/ExplorerMap.tsx:262-278` — Sentrum-markor
- `components/variants/explorer/explorer-packages.ts` — Erstatt med tema-system
- `components/variants/explorer/ExplorerPOIList.tsx` — Ny filter-UI
- `lib/utils/poi-score.ts` — Utvid med relevans-faktor
- `lib/store.ts` — Verifiser walk default
- `components/variants/report/report-themes.ts` — Gjenbruk/del med Explorer
- `.claude/commands/generate-hotel.md` — Oppdater med bilde-henting for alle

### Ny kode som trengs
- `lib/utils/project-profiles.ts` — Hotell/bolig-profiler med kategori-vekter
- `components/variants/explorer/ExplorerThemeChips.tsx` — Tema-chip komponent
- Migrasjon: `project_type` kolonne pa `projects`-tabellen

### Avhengigheter
- POI scoring (WP1 fra forrige plan) allerede implementert
- Report-temaer allerede definert og fungerende
- Native POI-stotte finnes i database-skjema
