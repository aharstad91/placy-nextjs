---
title: "feat: Spotify-inspirert Guide-bibliotek"
type: feat
date: 2026-02-04
brainstorm: docs/brainstorms/2026-02-04-guide-library-spotify-brainstorm.md
deepened: 2026-02-04
---

# feat: Spotify-inspirert Guide-bibliotek

## Enhancement Summary

**Deepened on:** 2026-02-04
**Research agents used:** best-practices-researcher, framework-docs-researcher, kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer, architecture-strategist, julik-frontend-races-reviewer, frontend-design skill

### Key Improvements
1. **Forenklet komponentstruktur** - Fra 6 filer til 2-3 for MVP
2. **Type-sikkerhet** - Union types for kategorier, branded IDs, separerte runtime/serialized typer
3. **Race condition håndtering** - Hydration guards, cancellable debounce, image preloading
4. **Design-oppgradering** - Editorial/magazine-estetikk fremfor generisk Spotify-kopi

### New Considerations Discovered
- Reserved slug validering for å unngå URL-konflikt med "guides"
- `useMemo` for filter-state, ikke `useEffect + setState`
- Faste dimensjoner på kort for å forhindre layout shift
- Vurder localStorage fremfor cookies for "nylig sett"

---

## Overview

Bygg en bibliotek-side for guides på `/[customer]/guides` inspirert av Spotifys layout. Viser tilgjengelige guides i horisontalt scrollbare rader gruppert etter kategori, med søk og filtrering.

**Hovedmål:** Gi hotellgjester en visuelt engasjerende måte å oppdage og velge guides på.

## Problem Statement / Motivation

I dag må brukere ha direkte link til en spesifikk guide. Det finnes ingen oppdagelsesflate der de kan:
- Se alle tilgjengelige guides for et hotell
- Filtrere på tema/kategori
- Søke etter spesifikke guides
- Se hvilke guides de har sett på tidligere

Hotellene ønsker å tilby flere guides, men mangler en god måte å presentere dem på.

## Proposed Solution

En ny side `/[customer]/guides` med:

1. **Header:** Søkefelt + kategori-filter chips
2. **"Nylig sett" rad:** Cookie-basert historikk (øverst hvis relevant)
3. **Kategoriserte rader:** Horisontalt scrollbare seksjoner gruppert etter tema
4. **Guide-kort:** Cover-bilde + tittel + antall stopp

### Mockup-struktur

```
┌─────────────────────────────────────────┐
│  🔍 Søk...          [Filter ▼]          │
├─────────────────────────────────────────┤
│  Nylig sett                    Vis alle │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ 📸   │ │ 📸   │ │ 📸   │ →          │
│  │      │ │      │ │      │            │
│  │Tittel│ │Tittel│ │Tittel│            │
│  │7 stop│ │5 stop│ │9 stop│            │
│  └──────┘ └──────┘ └──────┘            │
├─────────────────────────────────────────┤
│  Mat & drikke                  Vis alle │
│  ┌──────┐ ┌──────┐ ┌──────┐            │
│  │ 📸   │ │ 📸   │ │ 📸   │ →          │
│  └──────┘ └──────┘ └──────┘            │
├─────────────────────────────────────────┤
│  Kultur og historie            Vis alle │
│  ...                                    │
└─────────────────────────────────────────┘
```

## Technical Considerations

### Routing

Ny route: `app/[customer]/guides/page.tsx`

**Fra architecture-strategist - Slug Collision Analysis:**

Next.js App Router: Statiske segmenter (`guides`) har prioritet over dynamiske (`[project]`). Så `/klp/guides` vil korrekt route til guides-siden, ikke et project kalt "guides".

**MEN:** Hvis en kunde oppretter et project med `urlSlug: "guides"`, blir det utilgjengelig.

**Anbefalt løsning - Reserved Slug Validation:**

```typescript
// lib/validation/project-schema.ts
const RESERVED_SLUGS = ['guides', 'settings', 'admin', 'api'] as const;

export function validateProjectSlug(slug: string): boolean {
  if (RESERVED_SLUGS.includes(slug as any)) {
    throw new Error(`Slug "${slug}" is reserved and cannot be used`);
  }
  return true;
}
```

**Fra framework-docs-researcher - Route Priority:**
```
app/[customer]/
├── guides/page.tsx      # Statisk - matcher /klp/guides
└── [project]/page.tsx   # Dynamisk - matcher /klp/anything-else
```
Statiske segmenter vinner alltid over dynamiske på samme nivå.

### Datamodell-utvidelser

Legg til i `GuideConfig` (lib/types.ts):

```typescript
// Union type for kategorier - gir compile-time sikkerhet
const GUIDE_CATEGORIES = [
  'food',      // Mat & drikke
  'culture',   // Kultur og historie
  'nature',    // Natur
  'family',    // Familieutflukt
  'active',    // Aktiv tur
  'hidden-gems' // Skjulte perler
] as const;

type GuideCategory = typeof GUIDE_CATEGORIES[number];

interface GuideConfig {
  // ... eksisterende felter ...
  category?: GuideCategory;    // Union type, ikke string
  tags?: string[];            // Ekstra tags for filtrering
  featured?: boolean;         // Vis i "Fremhevet" seksjon
  sortOrder?: number;         // Manuell sortering innen kategori
}
```

### Research Insights: Type Safety

**Fra kieran-typescript-reviewer:**
- Bruk `as const` array for å få både runtime-array (for dropdowns) og compile-time type
- Separér runtime-typer (`Date`) fra serialiserte typer (`string`) for localStorage
- Vurder branded types for GuideId hvis ID-mixing blir et problem

### Data Fetching

Ny funksjon i `lib/data-server.ts`:

```typescript
export async function getGuidesByCustomer(customer: string): Promise<Project[]> {
  // Hent alle projects for customer der productType === "guide"
}
```

### LocalStorage (anbefalt over cookies)

**Hvorfor localStorage fremfor cookies:**
- Data kun brukt client-side
- Ikke behov for server-tilgang under SSR
- Unngår cookie overhead på hver request

```typescript
// Runtime type
interface GuideViewRecord {
  guideId: string;
  lastViewedAt: Date;
  viewCount: number;
}

// Serialized type for localStorage
interface GuideViewRecordJSON {
  guideId: string;
  lastViewedAt: string; // ISO string
  viewCount: number;
}

interface GuideLibraryHistory {
  version: 1;  // For fremtidige migrasjoner
  records: GuideViewRecord[];
}

const HISTORY_KEY = "placy-guide-library-history";
const MAX_RECENT_ITEMS = 10;
```

### Research Insights: Hydration & Race Conditions

**Fra julik-frontend-races-reviewer:**

```typescript
// KRITISK: Hydration guard pattern
const [recentlyViewed, setRecentlyViewed] = useState<GuideViewRecord[]>([]);
const [isHydrated, setIsHydrated] = useState(false);

useEffect(() => {
  setIsHydrated(true);
  const stored = localStorage.getItem(HISTORY_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      setRecentlyViewed(deserializeHistory(parsed));
    } catch {
      localStorage.removeItem(HISTORY_KEY);
    }
  }
}, []);

// Vis skeleton til hydration er ferdig
if (!isHydrated) {
  return <RecentlyViewedSkeleton />;
}
```

**Aldri bruk `suppressHydrationWarning` - det skjuler bare problemet.**

### Komponent-struktur (forenklet etter review)

**Fra code-simplicity-reviewer:** Opprinnelig forslag med 6 filer er over-engineered for MVP. Start minimalt:

```
app/[customer]/guides/
└── page.tsx                    # Alt i én fil for MVP

components/variants/guide-library/
└── GuideCard.tsx               # Kun hvis gjenbrukt/kompleks
```

**Detaljert MVP-struktur:**

```tsx
// app/[customer]/guides/page.tsx - Server Component
export default async function GuidesPage({ params }) {
  const guides = await getGuidesByCustomer(params.customer);
  const grouped = groupByCategory(guides);

  return (
    <main className="min-h-screen bg-[#FAF8F5] py-6">
      <Suspense fallback={<SearchSkeleton />}>
        <SearchFilter /> {/* Client Component */}
      </Suspense>

      <Suspense fallback={<RecentlyViewedSkeleton />}>
        <RecentlyViewedSection /> {/* Client Component */}
      </Suspense>

      {Object.entries(grouped).map(([category, items]) => (
        <CategoryRow key={category} title={category} guides={items} />
      ))}
    </main>
  );
}
```

**Prinspipp:** Du kan alltid legge til kompleksitet senere. Du kan ikke enkelt fjerne den.

### Performance

**Fra performance-oracle:**

#### Bildestrategi

```tsx
<Image
  src={guide.coverImage}
  fill
  sizes="(max-width: 640px) 160px, 200px" // Match kortbredde
  priority={rowIndex === 0 && cardIndex < 4} // Første rad prioritert
  loading={rowIndex === 0 ? 'eager' : 'lazy'}
  className="object-cover"
/>
```

#### Faste dimensjoner (forhindrer CLS)

```tsx
// VIKTIG: Alltid faste dimensjoner på kort
<article className="flex-shrink-0 w-40 h-60 snap-start">
  <div className="relative w-full h-[200px]"> {/* Fast høyde */}
    <Image fill ... />
  </div>
</article>
```

#### Filter-performance

```tsx
// RIKTIG: useMemo for derived state
const filteredGuides = useMemo(() => {
  return guides
    .filter(g => !category || g.category === category)
    .filter(g => !search || g.title.toLowerCase().includes(search.toLowerCase()));
}, [guides, category, search]);

// FEIL: useEffect + setState for derived data (vil flimre)
```

#### Debounce med cancellation

```tsx
const searchAbortRef = useRef<AbortController | null>(null);

const handleSearch = useCallback((query: string) => {
  searchAbortRef.current?.abort();
  searchAbortRef.current = new AbortController();

  const currentFilters = { ...filters }; // Snapshot
  const signal = searchAbortRef.current.signal;

  const timeoutId = setTimeout(() => {
    if (signal.aborted) return;
    setSearchTerm(query);
  }, 150);

  signal.addEventListener('abort', () => clearTimeout(timeoutId));
}, [filters]);
```

### Accessibility

**Fra best-practices-researcher - Roving Tabindex Pattern:**

```tsx
// Keyboard-navigasjon for horisontale rader
const [focusedIndex, setFocusedIndex] = useState(0);

const handleKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, items.length - 1));
      break;
    case 'ArrowLeft':
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
      break;
    case 'Home':
      e.preventDefault();
      setFocusedIndex(0);
      break;
    case 'End':
      e.preventDefault();
      setFocusedIndex(items.length - 1);
      break;
  }
};

// Kun fokusert element har tabindex=0
<div role="list" aria-label={categoryTitle} onKeyDown={handleKeyDown}>
  {items.map((item, i) => (
    <a
      key={item.id}
      role="listitem"
      tabIndex={i === focusedIndex ? 0 : -1}
      ref={el => i === focusedIndex && el?.focus()}
    >
      ...
    </a>
  ))}
</div>
```

**Tilgjengelighets-sjekkliste:**
- [ ] Touch targets minimum 44x44px
- [ ] Synlige focus-ringer med accent-farge
- [ ] `prefers-reduced-motion` respektert
- [ ] Kontrast WCAG AA (4.5:1 for brødtekst)

## Acceptance Criteria

### Funksjonelle krav

- [ ] `/[customer]/guides` viser alle guides for kunden
- [ ] Guides grupperes i horisontalt scrollbare rader etter kategori
- [ ] Søkefelt filtrerer guides på tittel og beskrivelse
- [ ] Kategori-filter viser/skjuler rader
- [ ] "Nylig sett" rad vises øverst hvis brukeren har historikk
- [ ] Klikk på guide-kort navigerer til `/[customer]/[guide-slug]`
- [ ] Responsivt design: mobil (1.5 kort synlig), tablet (2-3), desktop (4-5)

### Tekniske krav

- [ ] GuideConfig type utvidet med `category`, `tags`, `featured`, `sortOrder`
- [ ] `getGuidesByCustomer()` funksjon implementert
- [ ] localStorage-basert view-historikk med hydration guard
- [ ] Eksisterende guide-data oppdatert med category-felt

### Edge cases

- [ ] 0 guides: Vis "Ingen guides tilgjengelig ennå"-melding
- [ ] 1 guide: Vis som enkel rad (ikke skip til guide)
- [ ] Søk uten treff: Vis "Ingen treff"-melding med tøm-søk-knapp
- [ ] Kategori uten guides: Skjul raden

## Success Metrics

1. **Brukerengasjement:** Økt antall påbegynte guides per bruker
2. **Oppdagelse:** Brukere starter andre guides enn den de først klikket på
3. **Tilbakevendende brukere:** "Nylig sett" raden brukes (målt via localStorage)

## Dependencies & Risks

### Dependencies

- Eksisterende GuideConfig og GuidePage fungerer som de skal
- Hotellene må legge til category-felt i sine guide-data

### Risks

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| URL-konflikt med "guides" slug | Lav | Routing feiler | Sjekk reserved slugs |
| For få guides til å fylle rader | Medium | Ser tomt ut | Spotify-layout uansett antall |
| Bilder mangler på guides | Medium | Dårlig visuelt | Fallback placeholder |

## Design Recommendations (fra frontend-design skill)

### Visuell Retning: Editorial Travel Magazine

**Ikke kopier Spotifys mørke streaming-estetikk.** Gå for en raffinert reise-editorial look som differensierer og føles premium for hotellgjester.

### Fargepalett

```css
:root {
  --library-bg: #FAF8F5;        /* Varm off-white, ikke ren hvit */
  --library-card: #FFFFFF;
  --library-text: #1A1A1A;       /* Dyp kull */
  --library-text-muted: #6B6560; /* Varm grå */
  --library-accent: #C45C3A;     /* Terracotta - varm, innbydende */
  --library-chip-active: #1A1A1A;
  --library-chip-inactive: #F0EDE8;
}
```

### Typografi

- **Titler:** Playfair Display eller Cormorant Garamond (serif) - editorial feel
- **UI/Metadata:** DM Sans (geometrisk sans-serif) - ren lesbarhet

### Kort-design (GuideCard)

```tsx
<article className="flex-shrink-0 w-40 group cursor-pointer snap-start">
  {/* Cover med 4:5 aspect ratio */}
  <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-stone-200">
    <Image
      src={guide.coverImage}
      fill
      sizes="160px"
      className="object-cover transition-transform duration-500 group-hover:scale-105"
    />

    {/* Gradient overlay for lesbarhet */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

    {/* Stopp-badge */}
    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium">
      {guide.stopCount} stopp
    </div>
  </div>

  {/* Metadata med serif-tittel */}
  <div className="mt-3">
    <h3 className="font-serif text-base font-semibold leading-tight line-clamp-2">
      {guide.title}
    </h3>
    <p className="mt-1 text-xs text-library-text-muted">
      {guide.category}
    </p>
  </div>
</article>
```

### Horisontal Scroll Row

```tsx
<section className="mt-8">
  <div className="flex items-center justify-between mb-3 px-4">
    <h2 className="font-serif text-lg font-semibold">{category}</h2>
    <ChevronRight className="w-5 h-5 text-stone-400" />
  </div>

  <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory"
       style={{ WebkitOverflowScrolling: 'touch' }}>
    {guides.map(guide => <GuideCard key={guide.id} guide={guide} />)}
  </div>
</section>
```

### Scroll-fade indikator

```css
.scroll-container::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 40px;
  background: linear-gradient(to right, transparent, var(--library-bg));
  pointer-events: none;
}
```

---

## Open Questions (fra SpecFlow)

Disse bør avklares under implementering:

1. **Skal reward-tilstedeværelse vises på kortet?** (Badge/ikon vs. overraskelse)
2. **Eksakt kategori-taksonomi?** (Bruk forslag over som utgangspunkt)
3. **Desktop-spesifikk layout?** (Mer enn bare flere kort per rad?)

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-04-guide-library-spotify-brainstorm.md`
- GuideConfig type: `lib/types.ts:267-291`
- useGuideCompletion hook: `lib/hooks/useGuideCompletion.ts`
- Horisontal scroll-mønster: `components/poi/poi-list.tsx`
- Kort-mønster: `components/variants/report/ReportHighlightCard.tsx`

### Institutional Learnings

- **Hydration guard:** Bruk `useState + useEffect` for localStorage, ikke Zustand persist
- **Flex split > overlay:** Bruk flex-layout for sidebar/liste, unngå absolutt posisjonering
- **Array.from(new Set()):** Ikke `[...new Set()]` uten downlevelIteration

---

## MVP Implementerings-checklist (revidert)

**Fase 1: Fundament (må ha)**
```
[x] 1. Legg til GUIDE_CATEGORIES const + GuideCategory type i lib/types.ts
[x] 2. Utvid GuideConfig med category, tags, featured, sortOrder
[ ] 3. Legg til reserved slug validering (blokkér "guides" som project slug)
[x] 4. Opprett getGuidesByCustomer() i lib/data-server.ts
[x] 5. Opprett app/[customer]/guides/page.tsx (Server Component)
[x] 6. Oppdater eksisterende guide-data med category-felt
```

**Fase 2: UI (må ha)**
```
[x] 7. Bygg GuideCard med faste dimensjoner og Image-optimalisering
[x] 8. Bygg CategoryRow med horisontal scroll + snap
[x] 9. Legg til Tailwind scrollbar-hide utility
[x] 10. Implementer design-tokens (farger, typografi)
```

**Fase 3: Interaktivitet (kan vente)**
```
[x] 11. Søkefelt med debounce + cancellation
[x] 12. Kategori-filter chips
[ ] 13. useGuideLibraryHistory hook med hydration guard
[ ] 14. "Nylig sett" seksjon
```

**Fase 4: Polish**
```
[ ] 15. Keyboard-navigasjon (roving tabindex)
[ ] 16. Loading skeletons
[x] 17. Empty states
[x] 18. Scroll-fade indikatorer
[x] 19. Test på mobil og desktop
```

---

## Scalability Assessment

| Metrikk | Nåværende (<50 guides) | Ved 200 guides | Ved 1000 guides |
|---------|------------------------|----------------|-----------------|
| Filter-ytelse | <1ms | ~5ms | Vurder server-side |
| Minnebruk | ~50KB | ~200KB | ~1MB (akseptabelt) |
| Initial render | Rask | Legg til virtualisering | Krever virtualisering |

**Konklusjon:** Arkitekturen er passende for forventet skala. Ingen endringer nødvendig før 200+ guides.

---

## Research References

### Best Practices (eksterne kilder)
- [Tailwind CSS Scroll Snap](https://v3.tailwindcss.com/docs/scroll-snap-type)
- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [W3C WAI-ARIA Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [TanStack Virtual](https://tanstack.com/virtual/latest) - for fremtidig virtualisering

### Institutional Learnings (docs/solutions/)
- `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md` - Hydration guard, AbortController
- `docs/solutions/ui-patterns/explorer-desktop-layout-pattern.md` - Flex split layout
- `docs/solutions/feature-implementations/guide-gamification-gps-verification.md` - localStorage patterns

### Codebase References
- `lib/types.ts:267-291` - Eksisterende GuideConfig
- `lib/hooks/useGuideCompletion.ts` - localStorage hydration pattern
- `components/poi/poi-list.tsx` - Horisontal scroll mønster
- `components/variants/report/ReportHighlightCard.tsx` - Kort-mønster
