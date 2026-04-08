# Plan: Trip Preview Desktop Layout

**Dato:** 2026-02-15
**Brainstorm:** `docs/brainstorms/2026-02-15-trip-preview-desktop-brainstorm.md`
**Fil:** `components/variants/trip/TripPreview.tsx` (eneste fil som endres)

## Mål

Legge til desktop-layout for TripPreview-siden (`lg:` breakpoint) med:
- Full-width hero (høydebegrenset)
- To-kolonne layout under hero: innhold + sticky map
- Gjenbruker ReportPage-mønsteret (scrollbar innhold + sticky kart)

## Referansemønster

Fra `ReportPage.tsx`:
```tsx
<div className="hidden lg:flex">
  {/* Left: Scrollable content */}
  <div className="w-[50%] px-16 min-w-0">
    {/* ... */}
  </div>
  {/* Right: Sticky map */}
  <div className="w-[50%] pt-16 pr-16 pb-16">
    <div className="sticky top-20 h-[calc(100vh-5rem-4rem)] rounded-2xl overflow-hidden">
      {/* Map */}
    </div>
  </div>
</div>
```

## Desktop Layout (lg:1024px+)

```
┌──────────────────────────────────────────────────────────┐
│  Hero (full-width, max-h-[400px], object-cover)          │
│  ← Tilbake              Sightseeing →                    │
│  Title + City                                            │
│  Metadata stripe                                         │
├───────────────────────────┬──────────────────────────────┤
│                           │                              │
│  Description              │  Map (sticky)                │
│                           │  h-[calc(100vh-5rem-4rem)]   │
│  "Stopp på turen"         │  rounded-2xl                 │
│  Stop 1: Scandic Nidelven │                              │
│  Stop 2: Torvet           │                              │
│  Stop 3: Stiftsgården     │                              │
│  Stop 4: Ravnkloa         │                              │
│  Stop 5: Gamle Bybro      │                              │
│                           │                              │
│  🎁 Reward teaser         │                              │
│                           │                              │
│  [Start turen] button     │                              │
│                           │                              │
└───────────────────────────┴──────────────────────────────┘
```

## Implementeringssteg

### 1. Wrap mobil-layout i `lg:hidden`

Hele nåværende `<main>` innhold (hero → CTA) wraps i:
```tsx
{/* Mobile layout */}
<div className="lg:hidden">
  {/* ... eksisterende kode, uendret ... */}
</div>
```

### 2. Desktop layout med `hidden lg:block`

```tsx
{/* Desktop layout */}
<div className="hidden lg:block min-h-screen bg-[#FAF8F5]">
  {/* Hero — full width, height-constrained */}
  <div className="relative w-full h-[400px] bg-stone-800 overflow-hidden">
    {/* Same hero image, title, badges */}
  </div>

  {/* Metadata stripe — full width */}
  <div className="flex items-center gap-4 px-16 py-4 bg-white border-b border-stone-100">
    {/* Same metadata items */}
  </div>

  {/* Two-column: content + sticky map */}
  <div className="flex max-w-[1920px] mx-auto">
    {/* Left: Scrollable content */}
    <div className="w-[50%] px-16 min-w-0 overflow-hidden py-8">
      {/* Description */}
      {/* Free mode hint */}
      {/* Stop list (enhanced cards) */}
      {/* Reward teaser */}
      {/* CTA button (in flow, not sticky) */}
    </div>

    {/* Right: Sticky map */}
    <div className="w-[50%] pt-8 pr-16 pb-16">
      <div className="sticky top-20 h-[calc(100vh-5rem-4rem)] rounded-2xl overflow-hidden shadow-sm">
        <TripPreviewMap center={trip.center} stops={stopPOIs} />
      </div>
    </div>
  </div>
</div>
```

### 3. Desktop stop cards — større og mer romslige

Desktop-versjonen av `PreviewStopCard`:
- Thumbnail: `w-20 h-20` (opp fra `w-14 h-14`)
- Beskrivelse: vis mer tekst (`line-clamp-3` i stedet for `line-clamp-2`)
- Mer padding mellom kort

### 4. CTA-knapp — i flow, ikke sticky

På desktop er CTA i normal dokumentflow (scrollbar forbi). Ikke sticky — sticky CTA er et mobil-mønster. Desktop-knappen kan ha `max-w-sm` for å ikke strekke hele bredden.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `components/variants/trip/TripPreview.tsx` | Desktop layout + responsive stop cards |

## Ikke i scope

- Ingen nye komponenter
- Ingen endring i TripPreviewMap
- Ingen nye API-kall eller props
- Mobil-layout forblir 100% uendret

## Sjekkpunkter

- [ ] Mobile layout uendret (visuell sjekk)
- [ ] Desktop hero vises korrekt (max-h, object-cover)
- [ ] Map er sticky og fyller høyden
- [ ] Stop cards er større på desktop
- [ ] CTA-knapp fungerer og er synlig
- [ ] Reward teaser vises korrekt
- [ ] Back-knapp og category-badge fungerer
- [ ] TypeScript kompilerer uten feil
