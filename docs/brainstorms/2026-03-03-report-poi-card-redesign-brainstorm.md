# Brainstorm: Report POI-kort redesign — Kun store kort

**Dato:** 2026-03-03
**Kontekst:** Brukeren ønsker å gå bort fra to-kolonne kompakte kort (ReportPOIRow) og kun bruke store kort (ReportPOICard-formatet) for alle POI-er, med "Hent flere" lazy loading.

---

## Nåtilstand

Rapporten har **to kortformater**:

1. **Highlight-kort** (~180px, 3-kolonne grid) — Foto/ikon-fallback, navn, rating, editorial hook, gangavstand. Kun topp 3 per kategori.
2. **Kompakte rader** (2-kolonne, ~52px høye) — Thumbnail/ikon, navn, kategori, rating. Resten av POI-ene.

**Problemer med nåværende:**
- Kompakte rader gir lite "scannable" — ser ut som en liste, ikke en visuell opplevelse
- To ulike formater = visuell inkonsekvens
- Highlights (3 stk) er for få til å gi et godt bilde

---

## Foreslått endring

**Fjern kompakte rader helt.** Alle POI-er vises som store kort i 3-kolonne grid. Vis et begrenset antall initialt, "Hent flere" for resten.

### Kortdesign

Bruke nåværende `ReportPOICard`-format som utgangspunkt:
- 16:9 bilde eller kategorifarget bakgrunn med ikon (fallback)
- Navn (truncated)
- Rating + anmeldelser + gangavstand
- Editorial hook (om tilgjengelig, 1 linje)
- Tier-badge for Tier 1 / Local Gem

### Grid-layout

| Breakpoint | Kolonner |
|-----------|----------|
| Desktop (lg+) | 3 |
| Tablet (md) | 3 |
| Mobil (<md) | 2 (eller 1?) |

### Initialt antall

**Spørsmål:** Hvor mange kort vises før "Hent flere"?

**Alternativ A: 6 kort (2 rader á 3)** — Gir god oversikt uten å ta for mye plass. Balanserer informasjon vs scrolllengde.

**Alternativ B: 9 kort (3 rader á 3)** — Mer informasjon initialt, men kan gjøre seksjoner veldig lange.

**Alternativ C: Dynamisk basert på totalt antall** — Vis alle hvis ≤6, ellers vis 6 + "Hent flere (N)".

**Anbefaling:** Alternativ C. Vis 6 initialt, load more for resten. For veldig små kategorier (≤6 POIs) vises alle uten knapp.

### Sub-sections

Nåværende sub-section-logikk (kategorier ≥15 POIs) beholdes. Hver sub-section får sin egen "Hent flere"-knapp med 6 initiale kort.

### Editorial vs Functional themes

**Fjerne distinksjonen.** Nå bruker begge samme kortformat. `CATEGORY_DISPLAY_MODE` blir irrelevant for kortvalg (kan beholdes for andre formål).

---

## Hva slettes

1. **`ReportPOIRow`** (inline i ReportThemeSection.tsx) — den kompakte raden
2. **To-kolonne grid-logikken** for kompakte kort
3. **`CATEGORY_DISPLAY_MODE`** og editorial/functional-splitten (for kortvisning)
4. **`highlightPOIs` vs `listPOIs`-distinksjonen** i `report-data.ts` — alle POIs behandles likt
5. **`pickHighlights()`-funksjonen** — ikke lenger nødvendig

## Hva beholdes

1. **`ReportPOICard`** — utvides som eneste kortformat
2. **Sortering:** Tier-basert → formula score → avstand (nåværende `byTierThenScore`)
3. **"Hent flere"-mekanismen** — eksisterende `useLoadMore` + `LoadMoreButton`
4. **Sub-section-logikk** per kategori
5. **Kart-interaksjon** (klikk kort → highlight markør)

---

## Åpne spørsmål til brukeren

1. **Mobil-kolonner:** 2 kolonner på mobil, eller 1 kolonne?
2. **Kort-innhold:** Vise rating + gangavstand + editorial hook (som nå), eller forenkle?
3. **Initielt antall:** 6 per seksjon/sub-section — er det riktig balanse?
4. **Highlight-distinksjon:** Skal topp 3 ha noen visuell markering (f.eks. tykkere border, "Anbefalt"-badge), eller like kort for alle?

---

## Risiko

- **Scrolllengde:** Store kort tar mer plass. Mitigeres av "Hent flere" som begrenser initialt synlige kort.
- **Manglende bilder:** Mange POIs (barnehager, bussholdeplasser etc.) har ingen foto. Icon-fallback må se bra ut i grid.
- **Ytelse:** Flere store kort med bilder kan påvirke loading. Mitigeres av lazy loading og next/image optimization.
