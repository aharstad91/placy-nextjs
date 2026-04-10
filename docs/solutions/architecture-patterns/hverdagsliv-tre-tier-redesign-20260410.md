---
title: "Hverdagsliv — Tre-tier hierarki med kjøpesenter-anker"
category: architecture-patterns
tags: [hverdagsliv, report, hero-insight, poi, kategorier, bridge-text, shopping_mall, liquor_store]
module: ReportHeroInsight
symptom: "Hverdagsliv viste frisør med like mye visuell vekt som dagligvare; kjøpesenter nevnes aldri; ingen Vinmonopol"
root_cause: "HVERDAGS_TYPES var flat liste uten hierarki; shopping_mall var i poi-discovery men ikke i bransjeprofil"
---

# Hverdagsliv — Tre-tier hierarki med kjøpesenter-anker

## Problem

Hverdagsliv-temaet (~95% av megler-dekning) var implementert som sekundært tema med flat POI-liste. Frisør fikk like mye visuell vekt som dagligvare. Kjøpesenter — det faktiske hverdagslivsankeret — fantes ikke i noen visning.

## Løsning

### Nytt hierarki i HverdagslivInsight

```typescript
// Tier 1 — Kjøpesenter-anker (grønn, alltid øverst)
const HVERDAGS_ANCHOR = { catIds: ["shopping"], label: "Kjøpesenter" };

// Tier 2 — Primærtjenester (standard størrelse)
const HVERDAGS_PRIMARY = [
  { catIds: ["supermarket", "convenience"], label: "Dagligvare" },
  { catIds: ["pharmacy"], label: "Apotek" },
  { catIds: ["doctor", "dentist", "hospital"], label: "Lege" },
];

// Tier 3 — Sekundærtjenester (kompakt, vises kun hvis data)
const HVERDAGS_SECONDARY = [
  { catIds: ["liquor_store"], label: "Vinmonopol" },
  { catIds: ["post"], label: "Post" },  // NB: Placy ID er "post", ikke "post_office"
  { catIds: ["bank"], label: "Bank" },
  { catIds: ["haircare"], label: "Frisør" },
];
```

### Guard-logikk (viktig!)

```typescript
if (!anchor && primaryRows.length < 1) return null;
```

Bruker `< 1` ikke `< 2` — matcher original terskel. **Bruk IKKE `< 2`** — det bryter hverdagstjenester-tema (Næring) som kan ha bare 1 primær-POI.

### TIER1_EXTRACTORS — atomisk endring

TIER1_EXTRACTORS og HVERDAGS-konstantene MÅ landes i **samme commit**. Disse to avhenger av hverandre — bridge text excludes POI-er basert på extractor-output.

```typescript
hverdagsliv: (pois, center) => {
  const anchor = nearestOf(pois, center, ...HVERDAGS_ANCHOR.catIds);
  const tier2 = HVERDAGS_PRIMARY.map((t) => nearestOf(pois, center, ...t.catIds));
  return [anchor, ...tier2].filter(Boolean) as POI[];
},
```

### KjøpesenterCard — sikkerhetsmønstre

```tsx
// data-google-ai-target: bruk KUN googlePlaceId, aldri ?? poi.name
// poi.name er ukontrollert input og kan brukes som XSS-vektor
{...(anchor.googlePlaceId ? { "data-google-ai-target": anchor.googlePlaceId } : {})}

// googleWebsite: alltid isSafeUrl()-guard
const hasWebsite = anchor.googleWebsite && isSafeUrl(anchor.googleWebsite);
```

### Nye kategorier

**shopping** (shopping_mall):
- Fantes allerede i `poi-discovery.ts` som `shopping_mall: { id: "shopping", ... }`
- Manglet i `bransjeprofiler.ts` categories[] — bare å legge til `"shopping"` (ikke `"shopping_mall"`!)

**liquor_store** (Vinmonopol):
- Ny kategori, lagt til i GOOGLE_CATEGORY_MAP, VALID_TYPES_FOR_CATEGORY, bransjeprofiler, rating-categories
- Ikon: `Wine`, Farge: `#7c3aed` (lilla)
- **0 rader i DB per 2026-04-10** — data kommer ved neste Google Places import

### Pre-eksisterende bug fikset

```typescript
// Feil (var): "post_office" (Google Places type)
// Riktig: "post" (Placy category id fra GOOGLE_CATEGORY_MAP)
// poi.category.id === "post", ikke "post_office"
```

Bransjeprofiler bruker **Placy category IDs** (verdiene i `id`-feltet), ikke Google-typenavnene.

### Bridge text — ny logikk

```typescript
// Kjøpesenter i hero → løft det som knutepunkt
const kjøpesenter = pois.find((p) => p.category.id === "shopping" && exclude.has(p.id));
if (kjøpesenter) {
  // "I tillegg til Valentinlyst kjøpesenter finnes Rema 1000 5 min unna for daglig handel."
}
```

## Gotchas

1. **shopping_mall vs "shopping"**: Google-type er `shopping_mall`, Placy category id er `"shopping"`. Legg `"shopping"` i bransjeprofiler, ikke `"shopping_mall"`.

2. **post_office vs "post"**: Google-type er `post_office`, Placy ID er `"post"`. `bransjeprofiler.categories[]` bruker alltid Placy IDs.

3. **hverdagstjenester deler komponenten**: Næring-temaet bruker HverdagslivInsight. Anchor-guard MÅ matche original terskel (`< 1`, ikke `< 2`).

4. **Liquor_store mangler data**: Ingen POI-er med `category_id = 'liquor_store'` i prod per april 2026. UI er klar — Tier 3 vises kun hvis POI-er finnes.

5. **TIER1_EXTRACTORS og HVERDAGS-konstantene**: Alltid endre i samme commit. Divergens gir dobbelvisning i bridge text.

## Filer endret

- `lib/themes/bransjeprofiler.ts` — shopping + liquor_store + fix post
- `lib/generators/poi-discovery.ts` — liquor_store i GOOGLE_CATEGORY_MAP + VALID_TYPES
- `lib/themes/rating-categories.ts` — liquor_store
- `components/variants/report/ReportHeroInsight.tsx` — HverdagslivInsight + TIER1_EXTRACTORS
- `lib/generators/bridge-text-generator.ts` — hverdagsliv() funksjon
