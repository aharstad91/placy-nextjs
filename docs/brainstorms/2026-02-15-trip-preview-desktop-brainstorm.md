# Brainstorm: Trip Preview Desktop Layout

**Dato:** 2026-02-15
**Kontekst:** TripPreview.tsx har kun mobil-optimert layout — single-column som strekkes ut på desktop. Trenger en dedikert desktop-variant.

## Nåværende tilstand

### Mobil (fungerer bra)
```
┌─────────────────────────────┐
│  Hero Image (16:9)          │
│  Title + City overlay       │
├─────────────────────────────┤
│  Metadata: 30 min · 1.2 km  │
├─────────────────────────────┤
│  Description                │
├─────────────────────────────┤
│  Map (280px inline)         │
├─────────────────────────────┤
│  Stop list (timeline)       │
├─────────────────────────────┤
│  Reward teaser              │
├─────────────────────────────┤
│  CTA: "Start turen" (sticky)│
└─────────────────────────────┘
```

### Desktop (problem)
Samme layout, bare bredere. Hero er 1440px bred, kartet er en liten stripe, stopp-listen har masse tom plass.

## Krav

1. Desktop-optimert layout for `lg:` (1024px+)
2. Mobil-layout skal forbli uendret
3. Samme data — ingen nye props/API-kall
4. Skal føles som en "landingsside" for turen, ikke en aktiv navigasjonsvisning

## Tilnærminger

### A: Split Layout (Map + Content) — Anbefalt
Inspirert av TripPage desktop-layout, men tilpasset preview-kontekst.

```
lg: breakpoint (1024px+)
┌────────────────────────────────────────────────────────────┐
│  Hero image (full width, max-h-[400px])                    │
│  Title + metadata overlay                                  │
├──────────────────────────┬─────────────────────────────────┤
│                          │  Description                    │
│  Map (sticky)            │  Stop list                      │
│  h-[calc(100vh-400px)]   │  Reward teaser                  │
│                          │  CTA button                     │
│                          │                                 │
└──────────────────────────┴─────────────────────────────────┘
```

**Fordeler:**
- Kartet får skikkelig plass og er sticky mens man scroller stopp-listen
- Naturlig to-kolonne layout som utnytter bredden
- Samme mønster som TripPage — konsistent opplevelse

**Ulemper:**
- Hero + to-kolonne er litt hybrid

### B: Side-by-side Hero + Content
Hero til venstre (fast), innhold til høyre (scrollbar).

```
┌──────────────────────────┬─────────────────────────────────┐
│  Hero image (sticky)     │  Title + metadata               │
│  + Map below hero        │  Description                    │
│  (50% width)             │  Stop list                      │
│                          │  Reward + CTA                   │
└──────────────────────────┴─────────────────────────────────┘
```

**Fordeler:**
- Rent split uten full-width hero
- Visuelt innhold til venstre, tekst til høyre

**Ulemper:**
- Hero-bildet mister dramatisk effekt i smalere format
- Bryter med mobil-layoutens flow

### C: Centered Content med Max-Width
Behold single-column men med `max-w-3xl mx-auto` og bedre proportioner.

**Fordeler:**
- Enklest å implementere
- Fungerer som en artikkelside

**Ulemper:**
- Utnytter ikke desktop-bredden — 60% av skjermen er tom
- Kartet forblir lite

## Anbefaling

**Tilnærming A** — Split layout med full-width hero og sticky map under. Dette:
- Gir kartet plass det fortjener (turens viktigste visuelle element etter hero)
- Stopp-listen kan scrolles uavhengig med kartet synlig
- CTA-knappen trenger ikke være sticky på desktop — den er alltid synlig
- Konsistent med TripPage desktop-mønster

## Detaljert layout (Tilnærming A)

### Hero (full-width, begrenset høyde)
- `max-h-[400px]` på desktop (i stedet for `aspect-[16/9]`)
- Title, city, category badge som nå
- Back-knapp og category-badge plassert som nå

### Under hero: to-kolonne
- **Venstre (55%):** Sticky map som fyller tilgjengelig høyde
- **Høyre (45%):** Scrollbar innhold
  - Metadata stripe
  - Description
  - Stop list (med større thumbnails og mer tekst synlig)
  - Reward teaser
  - CTA button (ikke sticky, bare i flow)

### Stop cards på desktop
- Større thumbnails: `w-20 h-20` (opp fra `w-14 h-14`)
- Vis full beskrivelse (fjern `line-clamp-2`)
- Mer romslig padding

## Implementeringsnotat

Hele endringen skjer i `TripPreview.tsx`. Ingen nye komponenter trengs — vi bruker responsive Tailwind-klasser (`lg:`) for å bytte layout.

Eksisterende `TripPreviewMap` gjenbrukes uendret.
