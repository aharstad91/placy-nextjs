# Plan: Report POI-kort redesign — Kun store kort med lazy loading

**Dato:** 2026-03-03
**Brainstorm:** `docs/brainstorms/2026-03-03-report-poi-card-redesign-brainstorm.md`
**Branch:** `feat/report-card-redesign`

---

## Sammendrag

Erstatt to-kolonne kompakte POI-rader med store 3-kolonne kort (ReportPOICard-formatet) for alle POI-er i Report. Vis 6 kort initialt per seksjon, "Hent flere" for resten. Fjern editorial/functional display mode-distinksjonen.

## Beslutninger fra brainstorm

- 6 kort initialt per seksjon/sub-section
- Subtil markering: Tier-badge på Tier 1/Local Gem beholdes
- 2 kolonner på mobil, 3 på desktop

---

## Implementeringsplan

### Steg 1: Oppdater ReportPOICard for grid-bruk
**Fil:** `components/variants/report/ReportPOICard.tsx`

- [ ] Fjern hardkodet ~180px bredde — la kortet fylle grid-cellen
- [ ] Oppdater `sizes`-prop på Image til responsive (`(min-width: 1024px) 33vw, 50vw`)
- [ ] Verifiser at kort ser bra ut i både 2-kol og 3-kol grid

### Steg 2: Forenkle report-data.ts — fjern highlight/list-split
**Fil:** `components/variants/report/report-data.ts`

- [ ] Fjern `pickHighlights()` funksjonen
- [ ] Fjern `highlightPOIs` og `listPOIs` fra `ThemeData` / `SubSectionData`
- [ ] Erstatt med en enkelt `pois`-array (sortert med `byTierThenScore`)
- [ ] Oppdater `INITIAL_VISIBLE_COUNT` fra 12 → 6
- [ ] Fjern `HIGHLIGHT_FALLBACK_COUNT`
- [ ] Oppdater per-kategori overrides til å bruke nye verdier

### Steg 3: Omskriv rendering i ReportThemeSection
**Fil:** `components/variants/report/ReportThemeSection.tsx`

- [ ] Slett `ReportPOIRow` inline-komponent
- [ ] Slett highlight-rendering (horizontal scroll-rad)
- [ ] Slett to-kolonne grid for kompakte kort
- [ ] Ny rendering: `grid grid-cols-2 lg:grid-cols-3 gap-3` med `ReportPOICard` for alle POI-er
- [ ] Vis første 6 POI-er, resten bak "Hent flere"-knappen
- [ ] Behold `useLoadMore` og `LoadMoreButton` (uendret)
- [ ] Fjern `CATEGORY_DISPLAY_MODE` og editorial/functional-logikk for kortvalg

### Steg 4: Oppdater flat theme-rendering (temaer uten sub-sections)
**Fil:** `components/variants/report/ReportThemeSection.tsx`

- [ ] Flat themes (< SUB_SECTION_THRESHOLD) bruker samme grid-layout
- [ ] Samme "6 initialt + Hent flere"-mønster

### Steg 5: Slett død kode
**Filer:** Diverse

- [ ] Slett `CATEGORY_DISPLAY_MODE` fra `report-themes.ts`
- [ ] Slett `pickHighlights()` og relaterte hjelpefunksjoner fra `report-data.ts`
- [ ] Slett ubrukte imports
- [ ] Verifiser ingen andre consumers bruker fjernet kode

### Steg 6: Visuell verifisering
- [ ] Screenshot: Hverdagsliv-seksjon (flat theme, bilder tilgjengelig)
- [ ] Screenshot: Barnehage sub-section (mange POIs, ikon-fallback)
- [ ] Screenshot: "Hent flere" fungerer
- [ ] Screenshot: Mobil 2-kolonne layout
- [ ] Screenshot: Kart-interaksjon (klikk kort → markør)

---

## Akseptansekriterier

1. Alle POI-er vises som store kort i 3-kol grid (desktop) / 2-kol (mobil)
2. Maks 6 kort vises initialt per seksjon/sub-section
3. "Hent flere (N)"-knapp viser resterende kort
4. Tier-badge synlig på Tier 1/Local Gem kort
5. Kart-interaksjon fungerer som før (klikk kort → markør)
6. Ingen kompakte rader eksisterer i kodebasen
7. TypeScript, lint, tester passerer
8. Visuell verifisering på desktop og mobil

---

## Filer som endres

| Fil | Endring |
|-----|---------|
| `ReportPOICard.tsx` | Responsive sizing |
| `report-data.ts` | Fjern highlight/list split, forenkle |
| `ReportThemeSection.tsx` | Ny grid-rendering, slett kompakte rader |
| `report-themes.ts` | Fjern CATEGORY_DISPLAY_MODE |

## Filer som IKKE endres

| Fil | Grunn |
|-----|-------|
| `ReportHero.tsx` | Uavhengig av kort-redesignet |
| `ReportFloatingNav.tsx` | Uavhengig |
| `ReportStickyMap.tsx` | Kart-interaksjon bruker POI-id, ikke kortformat |
| `report-data.ts` (sortering) | `byTierThenScore` beholdes |
