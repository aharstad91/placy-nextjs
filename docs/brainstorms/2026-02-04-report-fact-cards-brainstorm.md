# Brainstorm: Report Fact Cards

**Dato:** 2026-02-04
**Status:** Klar for planlegging

## Hva Vi Bygger

**Sidebar Fact Grid** - en vertikal kolonne med 4-5 kompakte fact cards ved siden av kartet i Report-sidenes kategori-seksjoner. Kortene viser dynamisk generert innhold basert på POI-data for å tilføre redaksjonell verdi uten manuelt arbeid.

### Mål

1. **Engasjement:** Gi brukeren "wow"-øyeblikk og underholdning
2. **Valgstøtte:** Hjelpe med å velge riktig sted
3. **Troverdighet:** Vise at Placy har dyp lokalkunnskap

### Plassering

Sidebar til venstre for kartet på desktop. Erstatter/utnytter området som i dag er tomt.

## Korttyper (4-5 per kategori)

### 1. Statistikk-kort
- **Data:** totalPOIs, avgRating, totalReviews (allerede beregnet i report-data.ts)
- **Eksempel:** "13 steder • Snitt ★ 4.4 • 11k anmeldelser"

### 2. Top Pick
- **Data:** Høyest rangerte POI + editorialHook
- **Eksempel:** "★ Credo Restaurant" + "Trondheims eneste Michelin-restaurant"

### 3. Kategori-split
- **Data:** Antall per underkategori
- **Eksempel:** "8 restauranter • 5 kaféer" (med ikoner)

### 4. Fun Fact / Insight
- **Data:** Prioritert kilde:
  1. `categoryFacts[]` på theme-nivå (hvis definert)
  2. `localInsight` fra topp-POI
  3. Auto-generert: "Høyest rating: Credo (4.7)"

### 5. Hidden Gem (valgfritt)
- **Data:** POI med høy rating (>4.3) men relativt få anmeldelser (<500)
- **Eksempel:** "💎 Skjult perle: Baklandet Skydsstation"

## Hvorfor Denne Tilnærmingen

1. **Utnytter eksisterende plass** - området ved kartet er tomt i dag
2. **100% dynamisk** - ingen manuell vedlikehold, skalerer til alle prosjekter
3. **Fallback-strategi** - alltid noe å vise, selv uten redaksjonelt innhold
4. **Bento-estetikk** - varierende høyder gir visuell interesse

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Plassering | Sidebar ved kart | Utnytter tom plass, ikke i veien for POI-listen |
| Datakilde | Dynamisk fra POI | Skalerbart, ingen manuelt arbeid |
| Antall kort | 4-5 | Nok til bento-variasjon, ikke overveldende |
| Fun facts | Hybrid | Theme-facts > localInsight > auto-generert |
| Mobil | TBD | Må vurderes i plan-fasen |

## Åpne Spørsmål

- [ ] Mobil-plassering: Kollapset under kart? Egen tab? Horisontalt scroll?
- [ ] Interaksjon: Skal kort være klikkbare? Til hva?
- [ ] Fallback-styling: Hvordan håndtere kategorier med lite data?

## Teknisk Kontekst

**Eksisterende komponenter:**
- `ReportThemeSection.tsx` - container for kategori-seksjoner
- `ReportInteractiveMapSection.tsx` - kart + POI-grid
- `ReportHighlightCard.tsx` - kompakt kort-design (kan inspirere)

**Tilgjengelig data:**
- `highlightPOIs` - topp 3 per kategori (allerede sortert)
- `avgRating`, `totalReviews`, `totalPOIs` - statistikk beregnet
- `editorialHook`, `localInsight` - redaksjonelt innhold per POI

## Neste Steg

Kjør `/workflows:plan` for implementeringsplan med:
- Ny komponent: `ReportFactCards.tsx`
- Data-logikk for kort-generering
- Responsiv layout (desktop sidebar + mobil)
