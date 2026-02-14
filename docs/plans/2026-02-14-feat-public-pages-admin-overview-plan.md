# Plan: Admin-oversikt for offentlige sider

**Dato:** 2026-02-14
**Brainstorm:** `docs/brainstorms/2026-02-14-public-pages-admin-overview-brainstorm.md`
**Branch:** `feat/public-pages-admin`

## Oversikt

Legg til en "Offentlige sider"-seksjon i admin som gir oversikt over alt innhold Placy publiserer på egne offentlige sider — områder, kategorisider, guider og landingssider.

## Leveranser

### 1. Dashboard-oppdatering (`app/admin/page.tsx`)

Legg til ny seksjon "Offentlige sider" på Dashboard mellom "Data" og "Verktøy":

```
OFFENTLIGE SIDER
┌─────────────────────────────────────────────────┐
│ 🌐 Områder          1 aktive                  > │
│ 📄 Kategorisider    19 sider                  > │
│ 🗺  Guider           7 kuraterte              > │
│ 📊 Landingssider     2 sider                  > │
│ 📍 Offentlige POIs  405 steder (62% editorial)  │
└─────────────────────────────────────────────────/
```

- [x] Hent tellere: områder, kategorier med POIs, guider fra curated-lists, landingssider (hardkodet)
- [x] Hent editorial coverage: `count(editorial_hook IS NOT NULL) / count(*)` for POIs i aktive areas
- [x] Lenke til `/admin/public` for detaljer

### 2. Ny side: `/admin/public` (`app/admin/public/page.tsx`)

Dedikert oversiktsside med alt offentlig innhold, gruppert per område.

**Layout:**
```
Offentlige sider
X sider · Y POIs · Z% editorial

[Per område — ekspanderbar eller flat]

── Trondheim ──────────────────────────
   Slug: trondheim / trondheim (EN)
   POIs: 405 · Editorial: 62% · Tier 1: 33

   KATEGORISIDER (19)
   ┌──────────────────────────────────┐
   │ Restaurant  │ 98 POIs │ SEO ✓ │↗│
   │ Kafé        │ 52 POIs │ SEO ✓ │↗│
   │ Lekeplass   │ 45 POIs │ SEO ✗ │↗│
   │ ...                              │
   └──────────────────────────────────/

   KURATERTE GUIDER (7)
   ┌──────────────────────────────────┐
   │ Beste restauranter │ Tier 1, 20 │↗│
   │ Badeplasser         │ All, 15   │↗│
   │ Bakklandet          │ Bbox      │↗│
   │ ...                              │
   └──────────────────────────────────/

   LANDINGSSIDER
   ┌──────────────────────────────────┐
   │ Visit Trondheim (NO + EN)       │↗│
   └──────────────────────────────────/
```

- [x] Server component med data fra Supabase + curated-lists.ts
- [x] Per område: stats + kategoriliste + guideliste + landingssider
- [x] Hver rad: navn, POI-telling, SEO-status (har seo_title?), ekstern lenke
- [x] Landingssider: hardkodet liste over kjente routes

### 3. Sidebar-oppdatering (`components/admin/admin-sidebar.tsx`)

- [x] Legg til "Offentlige sider" i NAV_ITEMS med Globe-ikon
- [x] Plasser mellom "Prosjekter" og "Trips" (logisk gruppering: kundeprosjekter → placy-sider)

### 4. Data-henting (serverside queries)

Ingen ny modul — bruk eksisterende `createServerClient()` direkte i page.tsx:

```typescript
// Områder
const areas = await supabase.from("areas").select("*").eq("active", true);

// Kategorier per område med POI-telling
const categoryStats = await supabase
  .from("pois")
  .select("area_id, category_id, editorial_hook, poi_tier")
  .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`);

// Category slugs for SEO-status
const slugs = await supabase.from("category_slugs").select("*");

// Guider fra curated-lists.ts
import { CURATED_LISTS } from "@/lib/curated-lists";
```

## Filer som endres/opprettes

| Fil | Endring |
|-----|---------|
| `app/admin/page.tsx` | Legg til "Offentlige sider"-seksjon |
| `app/admin/public/page.tsx` | **NY** — dedikert oversiktsside |
| `components/admin/admin-sidebar.tsx` | Legg til nav-item |

## Ikke i scope

- Redigering av innhold
- Nye DB-migrasjoner
- EN-versjoner som separate rader
- CMS-funksjonalitet

## Rekkefølge

1. Sidebar-oppdatering (rask, låser opp navigasjon)
2. `/admin/public` side (hoveddelen)
3. Dashboard-oppdatering (nøkkeltall)
