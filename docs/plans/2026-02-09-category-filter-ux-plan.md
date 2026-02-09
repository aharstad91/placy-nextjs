# Plan: Category Filter Tag UX — Dropdown on Click

**Brainstorm:** `docs/brainstorms/2026-02-09-category-filter-ux-brainstorm.md`

## Oversikt

Endre kategori-filter chips slik at klikk på hele chippen åpner dropdown (ikke toggle). Flytt "deaktiver alle"-funksjonalitet inn i dropdown.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/variants/explorer/ExplorerThemeChips.tsx` | Hovedendring — klikk-oppførsel og dropdown-innhold |
| `components/variants/explorer/ExplorerPage.tsx` | Ny callback for toggle-alle-i-tema |

## Implementasjonssteg

### Steg 1: ExplorerPage — Ny callback

- [ ] Legg til `handleToggleAllInTheme(themeId: string)` callback
  - Finner alle kategorier i temaet
  - Hvis alle er aktive → deaktiver alle (legg til i `disabledCategories`)
  - Hvis noen/ingen er aktive → aktiver alle (fjern fra `disabledCategories`)
- [ ] Behold `handleToggleTheme` inntil videre (kan fjernes etter) — eller erstatt direkte
- [ ] Send ny prop `onToggleAllInTheme` til `ExplorerThemeChips`

### Steg 2: ExplorerThemeChips — Endre klikk-oppførsel

- [ ] Fjern `onToggleTheme`-kallet fra hovedknappen
- [ ] Hovedknapp klikk → åpner/lukker dropdown (samme som chevron)
- [ ] Chevron klikk → åpner/lukker dropdown (uendret)
- [ ] Dropdown skal alltid vises for alle temaer (uavhengig av antall kategorier)
- [ ] For temaer med 1 kategori: dropdown viser den ene kategorien + toggle-alle

### Steg 3: ExplorerThemeChips — "Toggle alle" i dropdown

- [ ] Legg til "Skjul alle" / "Vis alle"-knapp i bunnen av dropdown
  - Separator linje over knappen
  - Tekst: "Skjul alle" når alle er aktive, "Vis alle" ellers
  - Ikonet: EyeOff / Eye fra Lucide
- [ ] Kaller `onToggleAllInTheme(themeId)` ved klikk

### Steg 4: Visuell tilstand for chips

- [ ] Chip-styling basert på kategori-tilstand (ikke tema-tilstand):
  - **Alle kategorier aktive:** Normal — farget ikon, svart tekst
  - **Noen deaktiverte:** Normal med partial count `(aktive/total)`
  - **Alle deaktiverte:** Dimmet — grå ikon, grå tekst (som i dag)
- [ ] Fjern avhengighet av `activeThemes` for visuell tilstand — bruk `disabledCategories` direkte

### Steg 5: Opprydding

- [ ] Fjern `onToggleTheme` prop fra `ExplorerThemeChips`
- [ ] Fjern `activeThemes` state fra `ExplorerPage` (hvis mulig, eller behold for bakoverkompatibilitet)
- [ ] Oppdater props i `ExplorerPanel` og `ExplorerPOIList` som sender videre til `ExplorerThemeChips`

## Designnotater

- Split-button visuelt beholdes (chevron-separator)
- Begge deler av knappen åpner dropdown
- Dropdown-bredde: `w-56` (uendret)
- Toggle-alle knapp med separator i bunnen
- Chippen selv skal **ikke** toggle noe direkte — alt skjer via dropdown

## Risiko

- **Lav:** Ren frontend-endring, ingen API/database-påvirkning
- **Lav:** `activeThemes`-state kan fjernes, all filtrering baseres på `disabledCategories`
