# Brainstorm: Story Forside med Mini Bento Grids

**Dato:** 2026-01-24
**Status:** Klar for planlegging
**Deepened:** 2026-01-24

## Enhancement Summary

**Research agents brukt:** 6 parallelle agenter
- Bento grid layout patterns
- Generative backgrounds
- Card preview UI/UX
- Mobile-first grid patterns
- Codebase patterns analysis
- Tailwind CSS documentation

### Nøkkelfunn fra research
1. **YAGNI-forenkling:** Redusert fra 4 nye komponenter til 1 modifikasjon av eksisterende
2. **Mobil-strategi:** Horisontal scroll med snap points (ikke vertikal stacking)
3. **Design-system:** Komplett farge-palett per tema-kategori for å unngå generisk look
4. **Performance:** Image loading strategi og GPU-akselererte animasjoner er kritisk

---

## Hva vi bygger

En ny forsidestruktur for stories der hver tema-seksjon presenteres med et mini bento grid som gir en visuell preview av innholdet. Designet kombinerer artikkelens narrative flyt med bento gridens dashboard-estetikk.

### Konsept

```
[MINIMAL HEADER]
Tittel + kort intro

[TEMA 1: TRANSPORT OG MOBILITET]
Kort beskrivelse av temaet
┌──────────────┬─────────┬──────────┐
│ Bakke bru    │ 3       │   →      │
│ Busstasjon   │ bysykkel│ Se alle  │
│ 2 min å gå   │ stasj.  │ 10 steder│
└──────────────┴─────────┴──────────┘

[TEMA 2: SPISESTEDER]
Kort beskrivelse av temaet
┌──────────────┬─────────┬──────────┐
│ Habitat      │ 8       │   →      │
│ Kafé         │ steder  │ Se alle  │
│ 4 min å gå   │ totalt  │          │
└──────────────┴─────────┴──────────┘

...osv
```

### Kjernekomponenter

**1. Minimal Header**
- Prosjekt/eiendoms-tittel
- Kort intro-tekst (1-2 setninger)
- Eventuelt hero-bilde (valgfritt)

**2. Tema-seksjon**
- Tema-tittel med ikon
- Kort bridgeText som kontekstualiserer
- Mini bento grid med:
  - **Utvalgte POI-kort:** 2-3 highlights med navn og reisetid
  - **Statistikk-kort:** Antall steder, kategorier representert
  - **CTA-kort:** "Se alle X steder" som åpner tema-story modal

**3. Grid-layout per tema**
- Fast mønster (f.eks. 2+1 eller 1+2 layout)
- Responsivt: stacker på mobil
- Visuell distinksjon per tema via farge/ikon

---

## Research Insights

### 1. Bento Grid Layout Best Practices

**CSS Grid Implementasjon:**
```tsx
// Tailwind-mønster for asymmetrisk bento
<div className="
  flex gap-3 overflow-x-auto px-4 snap-x snap-mandatory scrollbar-hide
  md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0
  lg:auto-rows-[180px]
">
```

**Desktop Layout Patterns (velg ett per tema):**

Pattern A: Hero Left
```
+------------------+--------+
|   POI HIGHLIGHT  |  STAT  |
|   (2 col, 2 row) +--------+
|                  |  CTA   |
+------------------+--------+
```

Pattern B: Horizontal Flow
```
+--------+--------+--------+
| POI 1  | POI 2  |  STAT  |
+--------+--------+--------+
|         CTA (full width) |
+--------------------------+
```

**Anbefalt Grid CSS:**
```css
.theme-bento {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 180px;
  gap: 12px;
}
```

### 2. Generative Backgrounds (CSS-only)

**Anbefaling:** CSS gradients + subtle patterns, ikke Canvas eller tunge SVG-filter.

**Transport tema:**
```css
.theme-bg--transport {
  background: linear-gradient(135deg, hsl(220, 70%, 97%) 0%, hsl(210, 60%, 94%) 100%);
  background-image:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(59, 130, 246, 0.03) 10px,
      rgba(59, 130, 246, 0.03) 20px
    );
}
```

**Spisesteder tema:**
```css
.theme-bg--dining {
  background: linear-gradient(135deg, hsl(25, 100%, 97%) 0%, hsl(35, 80%, 95%) 100%);
  background-image:
    radial-gradient(circle at 20% 80%, rgba(249, 115, 22, 0.08), transparent 40%);
}
```

**Komplett fargepalett per kategori:**
```typescript
const themePalettes = {
  transport: {
    bg: 'hsl(220, 70%, 97%)',
    accent: 'hsl(220, 85%, 55%)',
    text: 'hsl(220, 60%, 35%)',
  },
  dining: {
    bg: 'hsl(25, 100%, 97%)',
    accent: 'hsl(15, 85%, 55%)',
    text: 'hsl(15, 50%, 30%)',
  },
  nature: {
    bg: 'hsl(140, 40%, 96%)',
    accent: 'hsl(150, 60%, 40%)',
    text: 'hsl(150, 40%, 25%)',
  },
  culture: {
    bg: 'hsl(280, 50%, 97%)',
    accent: 'hsl(270, 65%, 55%)',
    text: 'hsl(270, 45%, 30%)',
  },
  shopping: {
    bg: 'hsl(340, 60%, 97%)',
    accent: 'hsl(340, 75%, 55%)',
    text: 'hsl(340, 50%, 30%)',
  },
};
```

### 3. Card Preview UI/UX

**Informasjonshierarki (prioritert rekkefølge):**
1. Tema-tittel + ikon - umiddelbar gjenkjennelse
2. 2-3 POI-navn med reisetid - konkret verdi
3. Statistikk (totalt antall) - scope-indikasjon
4. CTA - handlingsdriver

**Touch targets:**
- Minimum 44x44px for alle klikkbare elementer
- Hele kortet skal være klikkbart
- Minimum 120px høyde på kort for komfortabel touch

**Hover-effekter (kun desktop):**
```css
.card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
}
```

### 4. Mobile-First Grid Patterns

**Anbefaling: Horisontal scroll med peek + snap**

Fordeler over vertikal stacking:
- Reduserer total sidehøyde med 60-70%
- Naturlig swipe-gesture
- "Peek pattern" indikerer at det er mer innhold

```tsx
// Mobile: Horisontal scroll
<div className="
  flex gap-3 overflow-x-auto px-4 pb-4
  snap-x snap-mandatory
  scrollbar-hide
  -webkit-overflow-scrolling-touch
">
  {cards.map(card => (
    <div className="
      w-[280px] min-w-[280px] flex-shrink-0
      snap-start scroll-ml-4
    ">
      <Card {...card} />
    </div>
  ))}
</div>
```

**Edge fade indicator:**
```tsx
<div className="relative">
  <div className="flex overflow-x-auto ...">...</div>
  {/* Gradient hint at more content */}
  <div className="
    absolute top-0 right-0 bottom-0 w-8
    bg-gradient-to-l from-white to-transparent
    pointer-events-none
    md:hidden
  " />
</div>
```

### 5. Performance Considerations

**Image Loading Strategy:**
```typescript
const getImageLoading = (sectionIndex: number, cardIndex: number) => {
  // Første seksjon, første 2 kort: eager (LCP-kandidater)
  if (sectionIndex === 0 && cardIndex < 2) {
    return { loading: 'eager', priority: true };
  }
  // Alt annet: lazy
  return { loading: 'lazy', priority: false };
};
```

**CLS Prevention:**
- Alltid sett `aspect-ratio` på bildebeholdere
- Bruk skeleton loading med eksakte dimensjoner
- Reservér plass for travel time badges med `min-width`

**Animation Performance:**
```css
/* GOOD: GPU-composited */
.card:hover { transform: translateY(-4px); }

/* BAD: Trigger layout */
.card:hover { margin-top: -4px; }
```

**Performance Budget:**
| Metric | Budget |
|--------|--------|
| LCP | < 2.5s |
| CLS | < 0.1 |
| Total Images (initial) | < 500KB |

---

## Forenkling (YAGNI-analyse)

### Opprinnelig forslag: 4 nye komponenter
- `ThemeBentoPreview`
- `POIHighlightCard`
- `ThemeStatCard`
- `ThemeCTACard`

### Forenklet forslag: 1 modifikasjon + inline JSX

**Endre eksisterende `POICard`:**
Legg til `variant?: "default" | "compact"` prop (~15 linjer endring)

**Gjenbruk `ThemeStoryCTA`:**
Eksisterende komponent gjør allerede det `ThemeCTACard` skulle gjøre

**Inline stat-visning:**
```tsx
// I stedet for <ThemeStatCard count={12} />
<div className="bg-gray-50 rounded-lg p-4 text-center">
  <span className="text-2xl font-bold">{pois.length}</span>
  <span className="text-sm text-gray-500 block">steder</span>
</div>
```

**Bento grid som inline CSS:**
```tsx
// I stedet for <ThemeBentoPreview>
<div className="grid grid-cols-3 gap-3 md:auto-rows-[180px]">
  {/* cards */}
</div>
```

### Datamodell: Ingen endringer nødvendig

**Opprinnelig forslag:**
- `highlightedPois: string[]`
- `priority: number`

**Forenklet:**
- POI-utvalg: Slice første 2-3 fra eksisterende array, sortert på reisetid
- Rekkefølge: Array-rekkefølge i JSON er prioriteten

```typescript
// Auto-select highlights
const highlights = themePois
  .sort((a, b) => (a.travelTime?.walk ?? 999) - (b.travelTime?.walk ?? 999))
  .slice(0, 3);
```

---

## Nøkkelbeslutninger (oppdatert)

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Sidestruktur | Minimal header + tema-seksjoner | Fokus på innhold, rask til substans |
| Grid-størrelse | Fast mønster per tema | Forutsigbart, skalerbart, autonomt |
| Kort-innhold | POI-highlights + statistikk + CTA | Gir konkret verdi før klikk |
| Tema-rekkefølge | Array-rekkefølge i JSON | Ingen ekstra felt nødvendig |
| Visuell stil | CSS gradients + kategori-farger | Performant, unikt uttrykk |
| Antall temaer | Optimalisert for 5-8 | Typisk for eiendomsprosjekter |
| Mobil layout | Horisontal scroll med snap | Reduserer sidehøyde, naturlig gesture |
| Komponenter | Utvid `POICard` med variant | Unngå duplisering |
| POI-utvalg | Automatisk (nærmest først) | Ingen manuell kuratering nødvendig |

---

## Åpne spørsmål (besvart)

### 1. POI-utvalg
**Beslutning:** Automatisk basert på reisetid (nærmest først)
- Slice første 2-3 POI-er fra tema, sortert på `travelTime[mode]`
- Hvis manuell kuratering trengs senere, legg til felt da

### 2. Statistikk-kort innhold
**Beslutning:** Kontekstuelle stats basert på kategori
- **Transport:** "X avganger/time" eller "X bysykkelstasjoner"
- **Spisesteder:** "X steder innen 5 min"
- **Natur:** "X km turstier" eller "X parker"
- **Default:** Totalt antall med reisetidskontekst

### 3. Generativ bakgrunn
**Beslutning:** CSS-only gradients + subtle patterns
- Ingen eksterne assets
- Performant
- Per-kategori fargepalett (se over)

### 4. Mobil-opplevelse
**Beslutning:** Horisontal scroll med snap points
- POI-kort snapper til venstre kant
- CTA alltid synlig på slutten
- Edge fade indikerer mer innhold

---

## Tekniske hensyn (oppdatert)

### Datamodell-endringer
**Ingen** - bruk eksisterende struktur

### Komponent-endringer
1. **`POICard`:** Legg til `variant: "compact"` prop
2. **Ny seksjon i ProjectPageClient:** Inline bento grid per tema

### CSS/Tailwind tillegg

```typescript
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: {
        theme: {
          transport: { bg: '...', accent: '...', text: '...' },
          dining: { bg: '...', accent: '...', text: '...' },
          // etc.
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
      },
    },
  },
};
```

### Gjenbruk
- `POICard` med ny `compact` variant
- `ThemeStoryCTA` uendret
- `cn()` utility for conditional classes
- Zustand store hooks (`useTravelSettings`, etc.)

---

## Designspesifikasjoner

### Typografi

```css
/* Tema-tittel */
.theme-title {
  font-size: 1.75rem; /* 28px */
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* POI-navn i kort */
.poi-name {
  font-size: 0.9375rem; /* 15px */
  font-weight: 600;
}

/* Statistikk-tall */
.stat-number {
  font-size: 2rem; /* 32px */
  font-weight: 700;
}
```

### Spacing

```css
/* Mellom tema-seksjoner */
.theme-section { margin-bottom: 3rem; /* 48px */ }

/* Grid gap */
.bento-grid { gap: 0.75rem; /* 12px */ }

/* Kort padding */
.card-content { padding: 1rem; /* 16px */ }
```

### Border Radius

```css
/* Asymmetrisk for visuell interesse */
.poi-card { border-radius: 24px 24px 8px 24px; }
.stat-card { border-radius: 16px; }
.cta-card { border-radius: 4px; /* Sharp for action */ }
```

---

## Inspirasjon

- **Supabase.com:** Bento grid med asymmetriske kort, ren estetikk
- **Linear.app:** Tema-seksjoner med visuell preview
- **Notion.so:** Kort-basert dashboard med data-preview

---

## Implementeringssti

### Fase 1: Minimal viable
1. Legg til `variant="compact"` på `POICard` (~15 linjer)
2. Lag én ny seksjon i `ProjectPageClient` med inline bento grid
3. Test med eksisterende data

### Fase 2: Visuell polish
1. Implementer kategori-fargepalett
2. Legg til CSS gradients per tema
3. Finjuster hover/animasjoner

### Fase 3: Performance
1. Implementer image loading strategi
2. Legg til skeleton loading
3. Test på mobile enheter

**Estimert total ny kode:** ~80-120 linjer (ned fra ~200+ med original plan)

---

## Neste steg

1. **Kjør `/workflows:plan`** for detaljert implementeringsplan
2. Prototype bento grid i eksisterende kodebase
3. Test på mobil for å validere scroll-opplevelse
