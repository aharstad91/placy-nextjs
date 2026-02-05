---
title: "feat: Project Detail Page with Per-Product POI Selection"
type: feat
date: 2026-02-05
---

# Project Detail Page with Per-Product POI Selection

## Overview

Utvide prosjektdetalj-siden (`/admin/projects/[id]`) med en ny "Produkter"-fane som lar admin velge hvilke POI-er som skal vises i hvert produkt (Explorer, Report, Guide) tilknyttet prosjektet.

## Problem Statement

Dagens situasjon:
- Prosjektlisten viser prosjekter med produktbadges (Explorer, Report, etc.)
- Man kan klikke inn på prosjektet og se POI-er på prosjektnivå
- Men man kan IKKE velge hvilke POI-er som skal vises i hvert enkelt produkt

Ønsket situasjon:
- Klikk på "Quality Hotel Augustin" i prosjektlisten
- Se en "Produkter"-fane med Explorer og Report
- Velg hvilke POI-er som skal være synlige i Explorer vs Report

## Proposed Solution

Legge til en ny "Produkter"-fane i prosjektdetalj-siden med:
1. Liste over produkter tilknyttet prosjektet
2. Ekspanderbart panel per produkt med checkbox-liste over POI-er
3. Optimistisk lagring ved toggle (matcher eksisterende mønster)

### Arkitektur-beslutninger

| Beslutning | Valg | Begrunnelse |
|------------|------|-------------|
| Lagringsmetode | Optimistisk UI | Matcher eksisterende mønster i category-change |
| Standard POI-valg for nytt produkt | Alle POI-er valgt | Mest intuitivt for "legg til Report til eksisterende Explorer" |
| Kategori-override per produkt | Utenfor scope | Fokus på POI-valg først, kategori-override som fremtidig forbedring |
| Sortering av POI-er | Alfabetisk | Manuell sortering som fremtidig forbedring |

## Technical Approach

### Database-tabeller (eksisterer allerede)

```
products
├── id (UUID)
├── project_id (FK -> projects)
├── product_type (explorer | report | guide)
└── UNIQUE(project_id, product_type)

product_pois
├── product_id (FK -> products)
├── poi_id (FK -> pois)
├── category_override_id (FK -> categories, nullable)
└── sort_order (nullable)
```

### Nye Server Actions

```typescript
// app/admin/projects/[id]/page.tsx

async function addPoiToProduct(formData: FormData) {
  // Insert into product_pois
}

async function removePoiFromProduct(formData: FormData) {
  // Delete from product_pois
}

async function togglePoiForProduct(formData: FormData) {
  // Upsert/delete based on current state
}
```

### UI-komponenter

```
project-detail-client.tsx
├── TABS = ["details", "categories", "pois", "products"]  // Ny tab
└── ProductsTab
    ├── ProductCard (for hvert produkt)
    │   ├── Header med type-badge og POI-count
    │   └── Ekspanderbar POI-liste med checkboxes
    └── Empty state hvis ingen produkter
```

### Data-henting

```typescript
// Fetch products with POIs for this project
const { data: products } = await supabase
  .from("products")
  .select(`
    id,
    product_type,
    story_title,
    product_pois (
      poi_id
    )
  `)
  .eq("project_id", projectId);
```

## Acceptance Criteria

### Funksjonelle krav

- [ ] Ny "Produkter"-fane vises i prosjektdetalj-siden
- [ ] Produkter vises som ekspanderbare kort med type-badge
- [ ] Hvert produktkort viser antall valgte POI-er (f.eks. "15 av 23 POI-er")
- [ ] Ekspandert produkt viser checkbox-liste over alle prosjekt-POI-er
- [ ] Avhukede POI-er er de som er inkludert i produktet
- [ ] Toggle lagrer umiddelbart (optimistisk UI)
- [ ] Empty state vises hvis prosjektet ikke har noen produkter
- [ ] Empty state vises hvis prosjektet ikke har noen POI-er i bassenget

### Edge cases

- [ ] Prosjekt uten produkter → Vis "Ingen produkter" med forklaring
- [ ] Prosjekt uten POI-er → Vis "Legg til POI-er først" med link til POI-er-fanen
- [ ] Nettverksfeil ved toggle → Vis feilmelding, reverser UI-endring
- [ ] Produkt med 0 POI-er valgt → Tillatt, men vis advarsel-indikator

## Implementation Plan

### Fase 1: Server-side (page.tsx)

- [x] Utvid data-henting til å inkludere `products` med `product_pois`
- [x] Legg til Server Action `addPoiToProduct`
- [x] Legg til Server Action `removePoiFromProduct`
- [x] Pass nye props til ProjectDetailClient

### Fase 2: Client-side UI (project-detail-client.tsx)

- [x] Legg til "products" i TABS-konstanten
- [x] Opprett `ProductsTab` komponent
- [x] Opprett `ProductCard` sub-komponent
- [x] Implementer checkbox-liste med POI-er
- [x] Håndter toggle med optimistisk UI
- [x] Implementer empty states

### Fase 3: Testing og polish

- [x] Test med prosjekt med flere produkter
- [x] Test empty states
- [x] Test nettverksfeil-håndtering
- [x] Verifiser at endringer reflekteres i public-facing produkter

## File Changes

| Fil | Endring |
|-----|---------|
| `app/admin/projects/[id]/page.tsx` | Ny data-henting + Server Actions |
| `app/admin/projects/[id]/project-detail-client.tsx` | Ny ProductsTab + UI |

## UI Wireframe

```
┌─────────────────────────────────────────────────────────┐
│ ← Tilbake til prosjekter                                │
│                                                         │
│ Quality Hotel Augustin                                  │
│ Kunde: Strawberry Hotels                                │
│                                                         │
│ ┌──────────┬────────────┬─────────┬───────────┐        │
│ │ Detaljer │ Kategorier │ POI-er  │ Produkter │        │
│ └──────────┴────────────┴─────────┴───────────┘        │
│                                                         │
│ 2 produkter                                             │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ▼ 🧭 Explorer                          15/23 POI-er │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ ☑ Britannia Hotel                                   │ │
│ │ ☑ Cafe Ni Muser                                     │ │
│ │ ☐ Egon Solsiden                                     │ │
│ │ ☑ Frati                                             │ │
│ │ ☐ Habitat                                           │ │
│ │ ...                                                 │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ▶ 📊 Report                            20/23 POI-er │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## References

### Internal

- `app/admin/projects/[id]/page.tsx:62-124` — Eksisterende data-henting mønster
- `app/admin/projects/[id]/project-detail-client.tsx:602-931` — PoisTab som referanse for checkbox-mønster
- `lib/supabase/database.types.ts:228-270` — product_pois schema

### External

- [Supabase JS v2 - Upsert](https://supabase.com/docs/reference/javascript/upsert)

## Future Enhancements (Out of Scope)

- Kategori-override per produkt (`product_pois.category_override_id`)
- Manuell sortering av POI-er med drag-and-drop (`product_pois.sort_order`)
- Opprette/slette produkter fra Produkter-fanen
- Virtualisering for store POI-lister (>100 POI-er)
