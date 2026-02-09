# Brainstorm: Category Filter Tag UX Improvement

**Dato:** 2026-02-09
**Kontekst:** Explorer sidebar — theme/category filter chips

## Problem

Nåværende oppførsel av kategori-chips har inkonsistent UX:

1. **Klikk på hovedknappen** → toggler hele temaet av/på (deaktiverer alle kategorier)
2. **Klikk på chevron** → åpner dropdown med underkategorier (bare når aktiv + >1 kategori)
3. Split-button designet antyder at *hele chippen* burde åpne dropdown, ikke toggle

**Brukerforvirring:** Split-button med chevron signaliserer "klikk åpner meny", men hovedknappen gjør noe helt annet (toggle). Dette bryter med standard UI-konvensjoner.

## Ønsket oppførsel

1. **Klikk på hovedknappen** → åpner dropdown (samme som chevron gjør i dag)
2. **Klikk på chevron** → åpner dropdown (uendret)
3. **Hele chippen** → åpner dropdown uansett hvor du klikker
4. **Toggle all av/på** → flyttes inn i dropdown som en egen handling

## Design: Dropdown med "Toggle alle"-funksjon

Dropdown inneholder:
- **Underkategorier** med toggle per kategori (som i dag)
- **Ny:** "Skjul alle" / "Vis alle" toggle-knapp i toppen eller bunnen av dropdown

### Scenarier

| Brukerhandling | Resultat |
|---|---|
| Klikk på "Mat & Drikke" chip | Dropdown åpnes med Restaurant, Kafé, Bar, Bakeri |
| Klikk på Restaurant i dropdown | Toggler Restaurant av/på |
| Klikk "Skjul alle" i dropdown | Alle underkategorier i temaet deaktiveres |
| Klikk "Vis alle" i dropdown | Alle underkategorier i temaet aktiveres |
| Klikk utenfor dropdown | Dropdown lukkes |

### "Skjul/Vis alle"-logikk

- Hvis **alle** kategorier er aktive → vis "Skjul alle"
- Hvis **noen eller ingen** er aktive → vis "Vis alle"
- Knappen toggler mellom disse tilstandene

## Visuell tilstand

Chippen selv reflekterer fremdeles tilstand:
- **Alle aktive:** normal stil (farget ikon, svart tekst)
- **Noen deaktiverte:** delvis stil (farget ikon, teller viser `aktive/total`)
- **Alle deaktiverte:** dimmet stil (grå ikon, grå tekst) — som dagens "deaktivert"-tilstand

## Endringer i kodebasen

Påvirker kun:
- `ExplorerThemeChips.tsx` — endre klikk-handler på hovedknapp, legg til toggle-alle i dropdown
- `ExplorerPage.tsx` — ny callback `handleToggleAllInTheme(themeId)`, fjern `handleToggleTheme`

Ingen endringer i:
- Zustand store
- Tema-definisjoner
- Kartet
- POI-filtrering (bruker allerede `disabledCategories`)

## Beslutning

Gå videre med dette designet. Beholder split-button visuelt, men begge deler åpner dropdown. Toggle-all funksjonen flyttes inn i dropdown.
