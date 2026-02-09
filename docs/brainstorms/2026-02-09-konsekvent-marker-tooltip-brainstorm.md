# Konsekvent Marker Tooltip

**Dato:** 2026-02-09
**Status:** Klar for planlegging

## Hva vi bygger

Erstatte de to forskjellige tooltip-designene (mørk hover-tooltip + hvit klikk-pille) med én enkelt, konsekvent hvit tooltip-komponent som brukes i begge tilstander.

### Problemet i dag

| Aspekt | Hover (nå) | Klikk (nå) |
|--------|-----------|------------|
| Bakgrunn | Mørk (bg-gray-900/90) | Hvit |
| Plassering | Over markør | Under markør |
| Innhold | Navn, kategori, rating, reisetid | Navn, reisetid, Rute-knapp |
| Design | Tooltip med pil ned | Pille uten pil |

To helt forskjellige komponenter som viser i bunn og grunn samme informasjon.

### Nytt design

**Én hvit tooltip-komponent** brukes for både hover og klikk:

- **Utseende:** Hvit bakgrunn, mørk tekst, plassert over markøren
- **Innhold:** POI-navn, kategori, Google-rating (med stjerne), reisetid (med travel mode-ikon)
- **Hover:** Tooltip vises på mouseover, forsvinner når musen forlater
- **Klikk:** Samme tooltip forblir synlig. Markøren under får aktiv-effekter (pulsering, scaling, shadow)

Visuell forskjell mellom tilstandene ligger utelukkende i markøren, ikke i tooltip-en.

## Hvorfor denne tilnærmingen

- **Konsekvent UX:** Brukeren ser samme informasjon uansett interaksjonstype
- **Mindre kode:** Én komponent i stedet for to separate implementasjoner
- **Klar visuell hierarki:** Markør-effektene (pulse/scale) signaliserer aktiv tilstand
- **Enklere vedlikehold:** Endringer i tooltip-design gjøres ett sted

## Nøkkelbeslutninger

1. **Hvit bakgrunn for begge tilstander** — den mørke tooltip-varianten fjernes helt
2. **Plassering alltid over markøren** — konsekvent posisjonering
3. **Rute-knappen droppes fra tooltip** — info finnes i bottom sheet / detaljer
4. **Travel time i tooltip** — beholdes som del av standard tooltip-innhold
5. **Tooltip-en er identisk i begge tilstander** — forskjellen er markør-effektene (pulse, scale, shadow)

## Scope

### Inkludert
- Ny felles tooltip-komponent (hvit) for hover og klikk
- Fjerne gammel mørk hover-tooltip
- Fjerne gammel hvit klikk-pille med Rute-knapp
- Sikre at tooltip samarbeider med markørens aktiv-effekter

### Ekskludert
- Endringer i markør-ikonet/formen
- Endringer i bottom sheet (mobil)
- Endringer i zoom-adaptive oppførselen

## Åpne spørsmål

- Skal tooltip-en ha en liten pil/trekant som peker ned mot markøren? (dagens hover-tooltip har det)
