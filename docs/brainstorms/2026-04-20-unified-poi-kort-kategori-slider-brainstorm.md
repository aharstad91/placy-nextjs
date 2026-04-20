---
date: 2026-04-20
topic: Unified POI-kort + kategori-slider i tekstseksjon med CTA til kart
status: Ready for planning
related:
  - components/variants/report/ReportMapBottomCard.tsx
  - components/variants/report/blocks/ReportMapBottomCarousel.tsx
  - components/variants/report/ReportThemeSection.tsx
  - components/variants/report/blocks/FeatureCarousel.tsx (skal fjernes)
  - components/variants/report/blocks/matdrikke-carousel.ts (ranking gjenbrukes)
---

# Unified POI-kort + kategori-slider i tekstseksjon

## What we're building

Én POI-kort-komponent som brukes konsekvent på tvers av Report-produktet — i tekstseksjonen for hver av de 7 kategoriene og i bunnen av kartmodalen. Kortet har **ingen bilder** (tekst-only). Slideren plasseres rett før det dormante kartet i hver tema-seksjon, og avslutter med en "Vis resten i kart"-CTA som åpner kartmodalen.

**Tre delmål:**

1. **Konsolider kort-komponenten** — `ReportMapBottomCard` blir den enhetlige POI-korttypen. `FeatureCarousel` + internal `CarouselCard` + `matdrikke-carousel.ts` ranking-funksjonen revideres: ranking gjenbrukes, men kortet og carousel-wrapperen forenes med map-bunn-varianten.

2. **Slider i alle 7 kategorier** — hver tema-seksjon får en horisontal kort-rad plassert **etter narrativ, rett før dormant kart-preview**. Slider bruker samme visuelle språk som map-bunn-carousel.

3. **"Vis resten i kart"-CTA** — viser alle N POI-er via `setMapDialogOpen(true)` (samme handler som klikk på kart-preview). Siden slider og kart er visuelt stablet, trengs ingen scroll-animasjon — modal åpnes direkte.

## Why this approach

### Consistency over category-specific UI
Placy har i dag **tre uavhengige kort-komponenter** (`FeatureCarousel`'s `CarouselCard`, `ReportMapBottomCard`, `ReportPOICard`). Mat & Drikke har bilder kun fordi restauranter har best bildedata. Dette skaper visuell støy: brukeren lærer ett kort-språk per kategori, og ett annet i kartmodalen. Å standardisere på ett kort (uten bilde) fjerner støyen og gir jevn presentasjon uansett datagrunnlag.

### Slider som bro til kartet
Hver kategori har allerede et tilhørende kart. Å legge sliderene rett over kartet gir en naturlig redaksjonell progresjon: **intro → narrativ → utdyping (Google AI) → slider (konkrete POI-er) → kart (geografisk kontekst)**. CTA-en blir en organisk overgang: du har nettopp sett 6 kort, nå kan du se alle i kartet for å forstå hvor de ligger.

### Bildebevarelse er lokket
Brukeren var tydelig: "konsekvens" vinner over bilderikhet. Bilder i Mat & Drikke-kortene oppleves som en "rik" kategori mens andre ser "fattige" ut — det bryter redaksjonelt inntrykk. Ved å fjerne bildene fra alle kortene, blir helhetsinntrykket premium og rent. Brukeren nevnte at "bildekollasjer som en pust i teksten" kan komme senere som en separat redaksjonell blokk — det er ikke scope for dette kortet.

### Gjenbruk av eksisterende kode
`ReportMapBottomCard` er allerede skreddersydd for tekst-first POI-presentasjon (kategori-badge, rating, walk-time, editorialHook). Den kan brukes som-er, med `isActive`-state lokalt i text-section-karusellen (så "Vis rute / Les mer / Google"-action-row dukker opp ved tap). Ingen ny kort-design nødvendig.

## Key decisions

| Decision | Valg | Begrunnelse |
|----------|------|-------------|
| Kort-komponent | `ReportMapBottomCard` (eksisterende) | Allerede optimal for tekst-first POI-kort. Gjenbrukbar uten modifikasjon. |
| Slider-plassering | Etter narrativ, før kart-preview | Redaksjonelt flow: tekst setter scene → kort viser konkrete steder → kart gir geografi |
| Antall synlige kort | 6 first (N av total) | Brukerens eksplisitte ønske. Resten tilgjengelig via CTA. |
| Sortering | Match kart-bunn (rating × tier-vekting) | Sikrer at text-slider og map-bottom-carousel viser samme POI-er i samme rekkefølge. Én kilde til sannhet. |
| Bilder på Mat & Drikke | Fjernes (bruk samme tekst-kort som resten) | Konsistens vinner over kategori-spesifikk rikhet |
| CTA-label | "Vis X av Y → se resten i kart" | Vises kun når slider er kuttet (dvs. når Y > 6) |
| CTA-atferd | Åpner UnifiedMapModal for kategori | Samme handler som klikk på kart-preview. Visuell nærhet gjør scroll overflødig. |
| Tom tilstand | Slider skjules hvis < 1 POI | Eksisterende "theme.allPOIs.length === 0"-guard dekker dette |
| Kort-klikk i text-section | Aktiverer lokalt (samme mønster som kart) | Viser action-row (Vis rute / Les mer / Google). Konsistens med map-kontekst. |
| Eksisterende FeatureCarousel | Slettes | Ingen andre bruksområder. Unngår dead code per CLAUDE.md-regel. |
| Ranking-funksjon | Rename `getMatDrikkeCarousel` → generisk `getTopRankedPOIs` | Allerede en top-N ranker; navnet må gjenspeile at den brukes bredt. |

## Approach considered but rejected

- **Beholde bilder på Mat & Drikke**: Gir visuell variasjon men bryter konsistens. Brukerens "konsekvens"-krav peker tydelig mot full uniformering.
- **Scroll til dormant kart uten modal-åpning**: Overflødig siden slider + kart ligger visuelt stablet. CTA-en blir svakere om den bare "viser hvor kartet er".
- **Generalisere `ReportMapBottomCarousel`**: Overveid, men map-spesifikke props (`activePOIId`, `registerCardRef`, `onCardClick` med flyTo) forurenser API-en. Ny slim `ReportThemePOICarousel` er renere.
- **Kurator-sortering (isLocalGem først)**: Avvist fordi det ikke matcher map-bunn-rekkefølgen. Vi kan legge til curator-prioritering senere hvis ønsket, men da på begge steder samtidig.

## Open questions

Ingen blokkerende åpne spørsmål. To fremtidige idéer nevnt av bruker, utenfor scope:

- **Bildekollasj-blokk som "pust i teksten"** — separat redaksjonell blokk mellom upperNarrative og lowerNarrative. Ikke del av dette kortet.
- **Kurator-merkede POI-er først** — kan legges til ranking-funksjonen senere, men krever endring både i text-slider og map-bottom-carousel samtidig for å beholde synkronisering.

## Success criteria

1. Alle 7 tema-seksjoner har en slider med opp til 6 POI-kort rett over dormant kart-preview.
2. Mat & Drikke-sliderens bilder er fjernet — kortet viser samme visuelle språk som de andre 6 kategoriene.
3. Kortene i text-slider ser identiske ut med kortene i kart-modalens bunn-carousel (pixel-parity).
4. "Vis X av Y → se resten i kart"-CTA vises kun når det finnes flere enn 6 POI-er, og åpner kart-modalen ved klikk.
5. Slideren rekkefølge matcher kart-bunn-carouselens rekkefølge (samme ranking-funksjon).
6. `FeatureCarousel.tsx` og dens subkomponent `CarouselCard` er slettet fra kodebasen.
7. Ingen regresjon: kart-modal, grounding, POI-lenker i narrativ, transport-widgets fungerer som før.
8. Visuell QA på stasjonskvartalet rapport — alle 7 seksjoner screenshot-verifisert.

## Technical context for planning

### Existing components to reuse
- `ReportMapBottomCard.tsx` — kort-komponenten (uten bilde), bruker `isActive`-state, har action-row
- Ranking-logikk fra `matdrikke-carousel.ts:30-62` — top-N med rating × tier-vekting, image-preference kan fjernes siden vi ikke bruker bilder lenger
- `UnifiedMapModal` + `setMapDialogOpen`-mønsteret i `ReportThemeSection.tsx:387-417`

### New components to create
- `ReportThemePOICarousel` (nytt) — slim wrapper rundt en liste `ReportMapBottomCard`-kort, med lokal `isActive`-state og "Vis X av Y"-CTA som callback-prop

### Components to remove
- `components/variants/report/blocks/FeatureCarousel.tsx` — ikke lenger brukt etter migrering

### Files to modify
- `components/variants/report/ReportThemeSection.tsx` — fjern Mat & Drikke-spesifikk FeatureCarousel-block (289-304), legg til generell ReportThemePOICarousel-block som alltid rendres etter narrativ men før map-preview (når `theme.allPOIs.length > 0`)
- `components/variants/report/blocks/matdrikke-carousel.ts` — rename → `top-ranked-pois.ts` og gjør generisk (fjern image-preference-vekting hvis den ikke matcher map-bunn-behov)
- `components/map/UnifiedMapModal.tsx` — ingen endring forventet (bottomSlot-mønsteret beholdes)

### Invariant: text-slider og map-bottom må vise samme POI-er i samme rekkefølge
Begge bruker samme ranking-funksjon med samme parametere. Ingen divergens tillatt uten eksplisitt begrunnelse.

## Scope boundaries

### In scope
- UI-konsolidering i `ReportThemeSection`
- Ny slim carousel-wrapper
- Rename/generalisering av ranking-funksjonen
- Slette `FeatureCarousel`-komponenten
- Visuell QA på alle 7 tema-seksjoner

### Out of scope (senere arbeid)
- Bildekollasj-blokk som "pust i teksten"
- Curator-basert ranking-override
- Mobile-spesifikk slider-UX-endring (beholder dagens scroll-snap)
- Guide-produkt-endringer (dette er Report-only)
- Endringer i `ReportOverviewMap` eller den globale "Alt rundt"-seksjonen
