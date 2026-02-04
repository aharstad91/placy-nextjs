---
title: "Guide Library - Spotify-inspirert Discovery UI"
category: architecture-patterns
tags: [guide, library, discovery, horizontal-scroll, category-filter, search, nextjs]
module: guide
date: 2026-02-04
symptoms:
  - Ingen oppdagelsesflate for guides
  - Brukere trenger direkte link til hver guide
  - Hoteller kan ikke presentere flere guides
related_issues:
  - placy-guide-mobile-prototype.md
---

# Guide Library - Spotify-inspirert Discovery UI

## Problem

Brukere hadde ingen måte å oppdage tilgjengelige guides. De måtte ha direkte link til hver guide. Hoteller ønsket å tilby flere guides, men manglet en god presentasjonsflate.

## Solution

### 1. Data Model Extensions (lib/types.ts)

Utvidet `GuideConfig` med kategorisering:

```typescript
// Guide categories for library grouping
export const GUIDE_CATEGORIES = [
  "food",        // Mat & drikke
  "culture",     // Kultur og historie
  "nature",      // Natur
  "family",      // Familieutflukt
  "active",      // Aktiv tur
  "hidden-gems", // Skjulte perler
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

// Norwegian labels for categories
export const GUIDE_CATEGORY_LABELS: Record<GuideCategory, string> = {
  food: "Mat & drikke",
  culture: "Kultur og historie",
  // ...
};

// Extended GuideConfig
export interface GuideConfig {
  // ... existing fields ...
  category?: GuideCategory;  // For grouping in library
  tags?: string[];           // Extra tags for filtering
  featured?: boolean;        // Show in "Featured" section
  sortOrder?: number;        // Manual sorting within category
}
```

### 2. Server Data Function (lib/data-server.ts)

```typescript
export async function getGuidesByCustomer(customer: string): Promise<Project[]> {
  const customerPath = path.join(process.cwd(), "data", "projects", customer);
  const files = fs.readdirSync(customerPath);

  const guides: Project[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const project = await getProjectAsync(customer, file.replace(".json", ""));
    if (project?.productType === "guide") {
      guides.push(project);
    }
  }

  // Sort by sortOrder, then by title
  guides.sort((a, b) => {
    const orderA = a.guideConfig?.sortOrder ?? 999;
    const orderB = b.guideConfig?.sortOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.guideConfig?.title ?? a.name).localeCompare(b.guideConfig?.title ?? b.name);
  });

  return guides;
}
```

### 3. Component Structure

**Server Component** (`app/[customer]/guides/page.tsx`):
- Henter guides med `getGuidesByCustomer()`
- Grupperer etter kategori
- Sender data til Client Component

**Client Component** (`GuideLibraryClient.tsx`):
- Søkefelt med debounce
- Kategori-filter chips
- CategoryRow med horisontal scroll
- GuideCard med cover-bilde og metadata

### 4. UI Patterns

**GuideCard med faste dimensjoner (forhindrer CLS):**
```tsx
<Link className="flex-shrink-0 w-40 group snap-start">
  <div className="relative aspect-[4/5] rounded-xl overflow-hidden">
    <Image
      src={coverImage}
      fill
      sizes="160px"
      priority={isFirstRow && index < 4}
      className="object-cover group-hover:scale-105"
    />
    {/* Stop count badge */}
    <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full">
      {stopCount} stopp
    </div>
  </div>
  <h3 className="font-serif text-base mt-3">{title}</h3>
</Link>
```

**CategoryRow med horisontal scroll:**
```tsx
<div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
  {guides.map(guide => <GuideCard />)}
</div>
{/* Scroll fade indicator */}
<div className="absolute right-0 w-10 bg-gradient-to-l from-[#FAF8F5]" />
```

**Filter med useMemo (ikke useEffect + setState):**
```tsx
const filteredGuides = useMemo(() => {
  return guides
    .filter(g => !category || g.guideConfig?.category === category)
    .filter(g => !search || title.includes(search.toLowerCase()));
}, [guides, category, search]);
```

**Debounce med cancellation:**
```tsx
const searchAbortRef = useRef<AbortController | null>(null);

const handleSearchChange = useCallback((value: string) => {
  searchAbortRef.current?.abort();
  searchAbortRef.current = new AbortController();
  const signal = searchAbortRef.current.signal;

  const timeoutId = setTimeout(() => {
    if (signal.aborted) return;
    setSearchTerm(value);
  }, 150);

  signal.addEventListener("abort", () => clearTimeout(timeoutId));
}, []);
```

### 5. Design Tokens

```css
--library-bg: #FAF8F5;        /* Varm off-white */
--library-accent: #C45C3A;    /* Terracotta */
--library-text: #1A1A1A;      /* Dyp kull */
--library-text-muted: #6B6560;
```

### 6. Tailwind Utilities

```typescript
// tailwind.config.ts
plugins: [
  plugin(function ({ addUtilities }) {
    addUtilities({
      ".scrollbar-hide": {
        "-ms-overflow-style": "none",
        "scrollbar-width": "none",
        "&::-webkit-scrollbar": { display: "none" },
      },
    });
  }),
],
```

## Files Created/Modified

| File | Purpose |
|------|---------|
| `lib/types.ts` | GUIDE_CATEGORIES, GuideCategory, extended GuideConfig |
| `lib/data-server.ts` | getGuidesByCustomer() function |
| `app/[customer]/guides/page.tsx` | Server Component |
| `app/[customer]/guides/GuideLibraryClient.tsx` | Client Component with UI |
| `tailwind.config.ts` | scrollbar-hide utility, serif font |
| `next.config.mjs` | Unsplash image domain |

## Key Patterns

1. **Server/Client split** - Data fetching i Server Component, interaktivitet i Client Component
2. **useMemo for derived state** - Ikke useEffect + setState for filtrering
3. **Faste dimensjoner** - w-40, aspect-[4/5] forhindrer layout shift
4. **snap-x snap-mandatory** - Native scroll-snap for touch
5. **Debounce med AbortController** - Cancellable for race conditions
6. **Kategori-gruppering** - Union type for type-sikkerhet

## Prevention / Best Practices

1. **Alltid bruk useMemo** for filtrert/derived data, ikke useEffect + setState
2. **Faste dimensjoner på kort** for å unngå CLS (Cumulative Layout Shift)
3. **scrollbar-hide** utility for cleaner horizontal scroll
4. **Server Component for data** - unngå client-side fetching når mulig
5. **Union types med as const** - gir både runtime array og compile-time type

## URL

Guide Library: `/[customer]/guides`
Eksempel: `/visitnorway/guides`
