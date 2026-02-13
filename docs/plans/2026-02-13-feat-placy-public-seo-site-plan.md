---
title: "feat: Placy Public SEO Site (placy.no)"
type: feat
date: 2026-02-13
brainstorm: docs/brainstorms/2026-02-13-placy-public-seo-brainstorm.md
---

# feat: Placy Public SEO Site (placy.no)

## Overview

Eksponere Placy sine 1000+ POIs i Trondheim via offentlige, SEO-optimaliserte sider på placy.no. Mål: PageSpeed 100, SEO 100, posisjon 3-5 i Google for søk som "restauranter trondheim". Norsk + engelsk fra start. "Min samling" på alle sider for engagement og e-post-capture.

## Problem Statement / Motivation

Placy har allerede rikere innhold enn konkurrentene som ranker på posisjon 3-9 for lokale søk i Trondheim (helleskitchen, truestory, vinpuls). Men ingenting av dette er synlig for Google — alt lever bak B2B-URLer (`/scandic/scandic-lerkendal/report`). Å eksponere dette innholdet via offentlige ruter bygger organisk trafikk som grunnlag for fremtidig monetisering via promoterte steder.

## Proposed Solution

Nye offentlige ruter i eksisterende Next.js-app som gjenbruker eksisterende komponenter og data. B2B-ruter flyttes til `/for/`-prefix. Full teknisk SEO-optimalisering med ISR, JSON-LD, og Mapbox Static API for PageSpeed 100.

## Technical Approach

### URL-struktur

```
Offentlig (NO):
/                                    → By-oversikt
/trondheim                           → By-side
/trondheim/restauranter              → Kategori-side
/trondheim/steder/britannia-hotel    → POI-side
/trondheim/guide/historisk-byvandring → Guide-side

Offentlig (EN):
/en/trondheim/restaurants            → Category page
/en/trondheim/places/britannia-hotel → POI page
/en/trondheim/guide/historic-walk   → Guide page

B2B (flyttes):
/for/scandic/scandic-lerkendal/report
/for/scandic/scandic-lerkendal/explore
```

### Routing-arkitektur (Next.js Route Groups)

```
app/
├── (public)/                         # Offentlig layout (Placy header/footer)
│   ├── layout.tsx                    # PlacyPublicLayout
│   ├── page.tsx                      # Hjemmeside (by-oversikt)
│   ├── [area]/                       # By-sider
│   │   ├── page.tsx                  # /trondheim
│   │   ├── [category]/               # Kategori-sider
│   │   │   └── page.tsx              # /trondheim/restauranter
│   │   ├── steder/
│   │   │   └── [slug]/
│   │   │       └── page.tsx          # /trondheim/steder/britannia-hotel
│   │   └── guide/
│   │       └── [slug]/
│   │           └── page.tsx          # /trondheim/guide/byvandring
│   └── en/                           # Engelsk prefix
│       └── [area]/                   # Speiler norsk struktur
│           ├── page.tsx
│           ├── [category]/
│           │   └── page.tsx
│           ├── places/
│           │   └── [slug]/
│           │       └── page.tsx
│           └── guide/
│               └── [slug]/
│                   └── page.tsx
├── for/                              # B2B layout (kundeheader)
│   └── [customer]/
│       └── [project]/
│           ├── layout.tsx
│           ├── page.tsx              # Landing
│           ├── report/page.tsx
│           ├── explore/page.tsx
│           └── trips/...
├── admin/                            # Admin (uendret)
└── api/                              # API-ruter
```

### Database: Ny `areas`-tabell

```sql
-- supabase/migrations/018_areas_table.sql
CREATE TABLE areas (
  id TEXT PRIMARY KEY,                  -- 'trondheim'
  name_no TEXT NOT NULL,                -- 'Trondheim'
  name_en TEXT NOT NULL,                -- 'Trondheim'
  slug_no TEXT NOT NULL UNIQUE,         -- 'trondheim'
  slug_en TEXT NOT NULL UNIQUE,         -- 'trondheim' (same for cities)
  description_no TEXT,                  -- AI-generert intro
  description_en TEXT,
  center_lat DECIMAL NOT NULL,
  center_lng DECIMAL NOT NULL,
  zoom_level INTEGER DEFAULT 13,
  bounding_box JSONB,                   -- {north, south, east, west}
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Koble POIs til områder
ALTER TABLE pois ADD COLUMN area_id TEXT REFERENCES areas(id);
CREATE INDEX idx_pois_area_id ON pois(area_id);

-- Kategori-slugs for offentlige sider
CREATE TABLE category_slugs (
  category_id TEXT REFERENCES categories(id),
  locale TEXT NOT NULL,                 -- 'no' | 'en'
  slug TEXT NOT NULL,                   -- 'restauranter' / 'restaurants'
  seo_title TEXT,                       -- 'Restauranter i Trondheim'
  seo_description TEXT,
  intro_text TEXT,                      -- AI-generert
  PRIMARY KEY (category_id, locale)
);
```

### Middleware: Routing-logikk

```typescript
// middleware.ts — utvidet
const KNOWN_AREAS = ['trondheim']; // Utvides over tid
const KNOWN_CUSTOMERS = ['klp-eiendom', 'scandic', ...];

export function middleware(request: NextRequest) {
  const segments = pathname.split('/').filter(Boolean);

  // /for/customer/project/... → B2B (passthrough)
  if (segments[0] === 'for') return NextResponse.next();

  // /en/... → English public (passthrough)
  if (segments[0] === 'en') return NextResponse.next();

  // /trondheim/... → Norwegian public (passthrough)
  if (KNOWN_AREAS.includes(segments[0])) return NextResponse.next();

  // /admin/... → Admin (passthrough)
  if (segments[0] === 'admin') return NextResponse.next();

  // Legacy: /scandic/... → Redirect til /for/scandic/...
  if (KNOWN_CUSTOMERS.includes(segments[0])) {
    return NextResponse.redirect(
      new URL(`/for/${pathname}`, request.url), 308
    );
  }

  return NextResponse.next();
}
```

---

## Implementation Phases

### Fase 1: Fundament & Routing

**Mål:** B2B flyttes, offentlig layout ferdig, middleware oppdatert.

- [ ] **DB-migrasjon 018:** `areas`-tabell + `pois.area_id` + `category_slugs` (`supabase/migrations/018_areas_table.sql`)
- [ ] **Seed Trondheim:** Insert area + sett `area_id` på alle eksisterende Trondheim-POIs + kategori-slugs for NO/EN
- [ ] **Flytt B2B-ruter:** `app/[customer]/` → `app/for/[customer]/` med alle underruter
- [ ] **Oppdater middleware:** Legacy redirects `/scandic/...` → `/for/scandic/...`
- [ ] **Offentlig layout:** `app/(public)/layout.tsx` med PlacyHeader + PlacyFooter-komponenter
- [ ] **PlacyHeader:** Logo, navigasjon (Byer, Guider), språkbytte (NO/EN)
- [ ] **PlacyFooter:** Om Placy, kontakt, sosiale lenker
- [ ] **Verifiser:** Alle eksisterende B2B-URLer fungerer via redirect, admin uendret

**Filer som endres:**
- `middleware.ts`
- `app/[customer]/` → `app/for/[customer]/` (flytt)
- Ny: `app/(public)/layout.tsx`
- Ny: `components/public/PlacyHeader.tsx`
- Ny: `components/public/PlacyFooter.tsx`
- Ny: `supabase/migrations/018_areas_table.sql`

### Fase 2: Kjerne-sider (NO)

**Mål:** Hjemmeside, by-side, kategori-sider, POI-sider live med norsk innhold.

- [ ] **Hjemmeside** `app/(public)/page.tsx`: By-oversikt med Trondheim-kort (bilde, antall steder, kategorier)
- [ ] **By-side** `app/(public)/[area]/page.tsx`: Hero, kategori-grid med antall/snitt-rating, Tier 1-highlights, guider
- [ ] **Kategori-side** `app/(public)/[area]/[category]/page.tsx`: Intro-tekst, featured highlights (Report-stil), kompakt liste, sticky kart
- [ ] **POI-side** `app/(public)/[area]/steder/[slug]/page.tsx`: Heltebilde, editorial hook, local insight, kart, åpningstider, lignende steder, "finnes i guider"
- [ ] **Data-lag:** `lib/public-queries.ts` — Supabase-queries for offentlige sider (POIs by area, by category, single POI)
- [ ] **ISR:** `revalidate = 86400` (24 timer) på alle offentlige sider
- [ ] **generateMetadata:** Unike title/description per side

**Gjenbrukbare komponenter fra Report (med utvidelse):**
- `ReportHighlightCard.tsx` → Featured highlights — **legg til optional `onSave`-prop for bookmark-ikon**
- `ReportPOICard.tsx` → Kompakte foto-kort — **legg til optional `onSave`-prop**
- `ReportCompactList.tsx` → POI-liste — **legg til optional `onSave` per rad**
- `ReportStickyMap.tsx` → Kart (wraps med lazy loading)
- `ReportThemeSection.tsx` → Kategori-seksjoner

**"Lagre til samling"-integrasjon i POI-kort:**
- [ ] Legg til `onSave?: (poiId: string) => void`-prop på `ReportHighlightCard`, `ReportPOICard`, og kompakt-rader i `ReportCompactList`
- [ ] Når `onSave` er satt: vis bookmark-ikon (Lucide `Bookmark`/`BookmarkCheck`) i kortets hjørne
- [ ] Når `onSave` ikke er satt: ingen visuell endring — B2B-sider forblir uendret
- [ ] Bookmark-ikon viser filled state når POI allerede er i samlingen (via `useCollection().isInCollection()`)

**Nye komponenter:**
- `components/public/CategoryGrid.tsx`
- `components/public/POIProfile.tsx`
- `components/public/SimilarPlaces.tsx`
- `components/public/Breadcrumb.tsx`
- `components/public/CollectionBar.tsx` — sticky bar nederst med "Min samling (N steder)" + CTA

### Fase 3: SEO-infrastruktur

**Mål:** PageSpeed 100, SEO 100, structured data, sitemap.

- [ ] **Mapbox Static API:** `lib/mapbox-static.ts` — genererer statisk kartbilde-URL med markører
- [ ] **LazyMap-komponent:** `components/public/LazyMap.tsx` — statisk bilde → IntersectionObserver → interaktivt Mapbox
- [ ] **Bilde-proxy:** `app/api/image/route.ts` — proxy Google Places-bilder via next/image med caching
- [ ] **JSON-LD-komponenter:** `components/seo/JsonLd.tsx` — Restaurant, Cafe, LocalBusiness, ItemList, BreadcrumbList
- [ ] **sitemap.xml:** `app/sitemap.ts` — generert fra POI-database (alle areas, kategorier, POIs, guider × 2 språk)
- [ ] **robots.txt:** `app/robots.ts` — tillat alt offentlig, blokk /for/, /admin/
- [ ] **Canonical URLs:** Per side, med hreflang alternate links
- [ ] **Open Graph:** OG title, description, image per side
- [ ] **Breadcrumbs:** Placy → Trondheim → Restauranter → Britannia Hotel

**PageSpeed-optimalisering:**
- [ ] Verifiser LCP < 2.5s (tekst/bilde, ikke kart)
- [ ] Verifiser CLS = 0 (fast størrelse på kart-container)
- [ ] Verifiser TBT < 200ms (Mapbox loader etter målevindu)
- [ ] `next/image` med riktig `sizes`-attributt på alle bilder
- [ ] Ingen render-blocking resources
- [ ] Inline critical CSS (Tailwind håndterer dette)

### Fase 4: Engelsk versjon

**Mål:** Engelske sider under /en/ prefix, dobler indexerbare sider.

- [ ] **Engelsk rute-gruppe:** `app/(public)/en/[area]/...` — speiler norsk struktur
- [ ] **Engelske slugs:** `category_slugs`-tabell med `locale = 'en'` (restaurants, cafes, bars etc.)
- [ ] **hreflang-tags:** `<link rel="alternate" hreflang="no" href="..." />` + `<link rel="alternate" hreflang="en" href="..." />`
- [ ] **Oversettelser:** Gjenbruk eksisterende `translations`-tabell for editorial hooks/insights
- [ ] **AI-genererte engelske tekster:** Intro-tekster, SEO-descriptions på engelsk
- [ ] **Sitemap:** Doblet med engelske URLer

### Fase 5: Engagement & Analytics

**Mål:** "Min samling" på alle offentlige sider, Plausible analytics.

- [ ] **"Min samling" på offentlige sider:** Gjenbruk `CollectionDrawer.tsx` med tilpasninger for offentlig kontekst (ingen projectId-avhengighet)
- [ ] **"Lagre"-knapp:** På alle POI-kort (featured, kompakt, POI-side)
- [ ] **Sticky samling-bar:** Nederst på skjermen når steder er lagret
- [ ] **Plausible-integrasjon:** `<Script>` i public layout med Plausible tracking
- [ ] **Google Search Console:** Verifiser eierskap, submit sitemap

### Fase 6: Guide-sider + Innhold

**Mål:** Guide-sider live, AI-genererte intro-tekster.

- [ ] **Guide-sider:** `app/(public)/[area]/guide/[slug]/page.tsx` — gjenbruk Trip-komponenter via tripToProject adapter
- [ ] **AI-genererte intro-tekster:** Script som genererer NO + EN intro for hver by og kategori
- [ ] **Manuell review:** Gjennomgå og justere AI-genererte tekster
- [ ] **OG-bilder:** Auto-genererte social share-bilder per side (Vercel OG)

---

## Acceptance Criteria

### Functional Requirements

- [ ] placy.no viser by-oversikt med Trondheim
- [ ] /trondheim viser by-side med kategorier og highlights
- [ ] /trondheim/restauranter viser kategori-side med 99 restauranter
- [ ] /trondheim/steder/britannia-hotel viser rik POI-profil
- [ ] /en/trondheim/restaurants viser engelsk versjon
- [ ] /for/scandic/scandic-lerkendal/report fungerer (B2B)
- [ ] /scandic/... redirecter til /for/scandic/... med 308
- [ ] "Min samling" fungerer på alle offentlige sider
- [ ] Sitemap inkluderer alle offentlige sider (NO + EN)
- [ ] robots.txt blokkerer /for/ og /admin/

### Non-Functional Requirements (PageSpeed 100 / SEO 100)

- [ ] Lighthouse Performance: 100
- [ ] Lighthouse SEO: 100
- [ ] Lighthouse Accessibility: 95+
- [ ] Lighthouse Best Practices: 100
- [ ] LCP < 2.5s
- [ ] CLS = 0
- [ ] TBT < 200ms
- [ ] FCP < 1.5s
- [ ] Alle sider har unike `<title>` og `<meta description>`
- [ ] JSON-LD structured data validerer i Google Rich Results Test
- [ ] hreflang-tags korrekt på alle sider
- [ ] Canonical URLs på alle sider
- [ ] ISR regenererer hvert 24. time

### Quality Gates

- [ ] Google PageSpeed Insights: 100/100/95+/100
- [ ] Google Rich Results Test: ingen feil
- [ ] Google Search Console: ingen indexeringsfeil etter submit
- [ ] Alle bilder har alt-tekst
- [ ] Heading-hierarki er korrekt (h1 → h2 → h3)
- [ ] Ingen console errors

---

## Gotchas fra docs/solutions/

- **Norsk slugify:** Bruk `lib/utils/slugify.ts` — æ/ø/å-replacements MÅ kjøres før NFD normalization. Aldri lag inline slugify.
- **Translations-tabell:** i18n-system med `translations`-tabell finnes allerede. Gjenbruk for engelske editorial hooks.
- **Server component caching:** Bruk `export const revalidate = 86400` for ISR. Ikke `force-dynamic` på offentlige sider.
- **Trip adapter:** `tripToProject()` finnes allerede for å konvertere Supabase-trips til legacy Project shape. Gjenbruk for guide-sider.
- **Google foto-referanser:** `photo_reference` kan expire. Bilde-proxy må håndtere 404/fallback gracefully.

---

## Dependencies & Prerequisites

- placy.no DNS allerede koblet til Vercel ✅
- Supabase CLI konfigurert ✅
- Mapbox API-nøkkel (Static API bruker samme token) ✅
- Plausible-konto ($9/mnd) — må opprettes
- Google Search Console — må verifiseres for placy.no

---

## Risk Analysis & Mitigation

| Risk | Sannsynlighet | Konsekvens | Mitigering |
|------|---------------|------------|------------|
| Route-konflikt mellom public/B2B | Medium | Høy | Middleware med KNOWN_AREAS/KNOWN_CUSTOMERS + tester |
| Mapbox Static API rate limits | Lav | Medium | Cache statiske bilder, ISR reduserer requests |
| Google Places bilde-proxy blokkeres | Medium | Medium | Fallback til kategori-ikon, vurder egen bilde-storage |
| Lav innholdsvolum for SEO | Lav | Medium | 1000+ POIs allerede, AI-genererte tekster |
| B2B redirect bryter eksisterende QR/lenker | Høy | Høy | 308 permanent redirect bevarer alt, test grundig |

---

## Estimert scope per fase

| Fase | Beskrivelse | Kompleksitet |
|------|-------------|-------------|
| 1 | Fundament & Routing | Medium — mest flytte filer + ny middleware |
| 2 | Kjerne-sider (NO) | Medium — mye gjenbruk av Report-komponenter |
| 3 | SEO-infrastruktur | Medium — Mapbox Static, JSON-LD, sitemap |
| 4 | Engelsk versjon | Lav — speiler norsk struktur |
| 5 | Engagement & Analytics | Lav — gjenbruk CollectionDrawer |
| 6 | Guide-sider + Innhold | Lav — gjenbruk Trip-adapter |

---

## Future Considerations (ikke del av denne planen)

- **Promotert-lag:** `promotions`-tabell, UI-plassering, admin-verktøy (Fase 3 i brainstorm)
- **Flere byer:** Oslo, Bergen, Stavanger — krever POI-import per by
- **Bruker-anmeldelser:** Placy-egne vurderinger som alternativ til Google
- **Samling-indexering:** Delte samlinger som indexerbare sider (avventer kvalitetsdata)
- **Google Business Profile:** Styrke domain authority

---

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-13-placy-public-seo-brainstorm.md`
- Middleware: `middleware.ts`
- Eksisterende SEO-rute: `app/trips/[slug]/page.tsx`
- CollectionDrawer: `components/variants/explorer/CollectionDrawer.tsx`
- Report-komponenter: `components/variants/report/`
- Trip adapter: `lib/trip-adapter.ts`
- Slugify: `lib/utils/slugify.ts`
- Translations: `supabase/migrations/010_create_translations.sql`
- POI-typer: `lib/types.ts`

### Institutional Learnings

- Norsk slugify: `docs/solutions/logic-errors/norwegian-slugify-nfd-ordering-20260206.md`
- i18n-system: `docs/solutions/feature-implementations/bilingual-i18n-report-translations-20260206.md`
- Trip adapter: `docs/solutions/architecture-patterns/trip-adapter-supabase-to-legacy-project-20260209.md`
- Server caching: `docs/solutions/architecture-patterns/nextjs-server-component-caching-force-dynamic-20260208.md`
