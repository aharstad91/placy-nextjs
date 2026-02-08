# Brainstorm: Adaptive Map Markers + Illustrated Map Style

**Dato:** 2026-02-08
**Status:** Besluttet — klar for planlegging

## Hva vi bygger

Zoom-adaptive markører som viser progressivt mer informasjon basert på kartets zoom-nivå, kombinert med en mykere, illustrert kart-stil med trær og naturlige elementer.

**Scope:** Alle tre produkter — Explorer, Guide, og Report.

## Hvorfor denne tilnærmingen

Nåværende markører er statiske (fast størrelse uavhengig av zoom) med enkle fargede sirkler. Screenshotene viser en mye rikere visuell opplevelse der markører adapterer seg til konteksten:

- **Zoomet ut:** Kun små prikker — hindrer visuell overbelastning
- **Medium zoom:** Ikon-sirkler med kategori-ikon gir gjenkjennelse
- **Tett zoom:** Full informasjon med navn, kategori, og rating

Kart-stilen med illustrerte trær gir en varmere, mer engasjerende visuell identitet.

## Nøkkelbeslutninger

### 1. Fire zoom-states med gradvis overgang

| State | Zoom-range | Visuelt |
|-------|-----------|---------|
| **Dot** | ~8-11 | Liten farget prikk (6-8px), kun posisjon |
| **Icon** | ~11-13 | Mørk sirkel (24-28px) med hvitt kategori-ikon |
| **Icon + Rating** | ~13-15 | Ikon-sirkel + grønn rating-badge (Google rating) |
| **Full Label** | ~15+ | Ikon + rating + navn (bold) + kategori-tekst |

Eksakte zoom-breakpoints kalibreres visuelt under implementering.

### 2. Markør-design (detaljert)

**Ikon-sirkel:**
- Kategori-farge bakgrunn (gjenbruker eksisterende `category.color`)
- Hvit Lucide-ikon sentrert
- Størrelse: ~36px diameter ved full state, ~24px ved ikon-state, ~8px ved dot-state
- Ingen border — ren sirkel

**Rating-badge:**
- Liten grønn sirkel (~18px) med hvit bold tekst (f.eks. "4.3")
- Posisjon: øverst til høyre, overlapper ikon-sirkelen litt
- Farge: klar grønn (#4CAF50)
- Vises kun når POI har `googleRating`

**Label-layout (full state):**
- Horisontalt: ikon til venstre, tekst til høyre
- **Navn:** Bold, ~14px, svart/mørk. Trunkeres med "..." ved >~15 tegn
- **Kategori:** Regular, ~12px, grå (#666). Viser `category.name` eller cuisine-types
- Tight spacing mellom navn og kategori-linje

**Active/Hover state:**
- Scale 1.2x med `transform: scale(1.2)`
- Drop-shadow: `0 4px 12px rgba(0,0,0,0.25)`
- Ingen pulsing ring — renere, moderne look
- Smooth transition: `transition: transform 150ms ease-out, box-shadow 150ms ease-out`

**Ingen postnummer-badge** — dropper dette for å holde det renere

### 3. Rating-kilde

Google Rating (`googleRating`-feltet). Vises kun når POI har rating-data.

### 4. Kart-stil

Finne en ferdig Mapbox-stil (Gallery/community) som matcher:
- Myk beige/krem bakgrunn
- Illustrerte grønne trær
- Subtile gate-farger
- Ikke for mye visuell støy

### 5. Scope: Alle tre produkter

Bygges som en **delt markør-komponent** (`AdaptiveMarker`) som brukes av:
- `ExplorerMap.tsx`
- `ReportStickyMap.tsx` og `ReportInteractiveMap.tsx`
- Guide-kartet (fremtidig)

### 6. Interaksjon bevares

Eksisterende interaksjoner (hover, active, click) fungerer på tvers av alle zoom-states. Active-state (pulsing ring, forstørret) forblir som i dag, men tilpasser seg markør-størrelsen.

## Teknisk kontekst

**Nåværende implementasjon:**
- `poi-marker.tsx` — enkel farget sirkel med Lucide-ikon
- `ExplorerMap.tsx` — rendrer alle POIs som React-markører
- `ReportStickyMap.tsx` — marker pooling med opacity-toggling
- Mapbox GL JS via `react-map-gl`
- Kategorier har `icon` (Lucide-navn) og `color` (hex)

**Tilnærming for zoom-adaptasjon:**
- Lytt på `zoom`-event fra kartet
- Beregn markør-state basert på gjeldende zoom
- Bruk CSS-transitions for smooth overganger mellom states
- Unngå DOM-manipulasjon under zoom — bruk opacity/scale-transitions

### 7. Animasjonsstrategi: CSS Transitions

- **Tilnærming:** Pre-render alle zoom-states med `opacity: 0`, toggle synlighet via CSS transitions
- **Transitions:** `transition: opacity 200ms ease-out, transform 200ms ease-out`
- **Hvorfor:** GPU-composited, ingen DOM-manipulasjon under zoom, gjenbruker pattern fra ReportStickyMap
- **Detaljer:**
  - Labels fader inn/ut med opacity
  - Ikon-sirkel skalerer med `transform: scale()`
  - Rating-badge fader inn separat
  - Ingen spring/bounce — clean og rask

### 8. Performance: Pure React Markers

- **Tilnærming:** Alle markører som React-komponenter (ingen Mapbox symbol layers)
- **Begrunnelse:** Typisk 10-60 POIs per prosjekt — godt innenfor DOM-grensen (~100)
- **Optimalisering:**
  - Marker pooling: pre-render alle ved mount, toggle opacity (fra ReportStickyMap-pattern)
  - `React.memo` med custom comparator for å unngå unødvendige re-renders
  - Zoom-state beregnes én gang per zoom-event, ikke per markør
  - `will-change: transform, opacity` for GPU-akselerasjon
- **Terskel:** Hvis et prosjekt har >100 POIs, vurder fallback til symbol layers (fremtidig)

## Åpne spørsmål

- Skal markører ha en "clustering"-mekanisme når mange overlapper ved lav zoom?
- Eksakte zoom-breakpoints — kalibreres visuelt under implementering

## Referanse

Screenshots fra Google Maps-lignende adaptive markører vedlagt i feature-beskrivelsen.
