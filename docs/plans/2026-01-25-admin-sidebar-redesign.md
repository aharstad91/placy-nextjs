# Admin Sidebar Redesign

**Dato:** 2026-01-25
**Status:** Planlagt

## Mål

Redesigne admin-sidebaren fra en 264px bred sidebar med tekst+ikoner til:
1. **Primær navbar:** 56px bred, kun ikoner med tooltip on hover
2. **Sekundær navbar:** 280px bred, vises på utvalgte sider, tar full høyde

## Spesifikasjoner

### Primær Navbar (56px)
- Fast bredde: 56px
- Kun ikoner (24x24px)
- Tooltip on hover med menypunkt-navn
- Vertikal layout, sentrerte ikoner
- Visuell indikator for aktiv side
- Logo/brand øverst (kompakt versjon)
- Fixed position, z-50

### Sekundær Navbar (280px)
- Bredde: 280px
- Vises kun på sider som trenger det
- Tar hele tilgjengelig høyde
- Innhold er side-spesifikt
- Alltid synlig når aktiv (ikke collapsible)

### Sider med sekundær navbar
| Side | Innhold i sekundær navbar |
|------|---------------------------|
| `/admin/pois` | Søkefelt, kategorifilter, "+ Ny POI", POI-form |
| `/admin/generate` | Kunde-velger, koordinat-input, genereringsvalg |

### Sider uten sekundær navbar
- `/admin` (Dashboard)
- `/admin/customers`
- `/admin/projects`
- `/admin/categories`
- `/admin/import`
- `/admin/stories`
- `/admin/editorial`

### Mobile
- Primær navbar: Synlig via hamburger-ikon (dagens pattern)
- Sekundær navbar: Triggers via egen knapp i hovedinnholdet
- Sekundær vises som slide-in panel/drawer

## Teknisk implementering

### Steg 1: Oppdater navigasjonsstruktur
**Fil:** `components/admin/admin-sidebar.tsx`

- Fjern tekst-labels, behold kun ikoner
- Reduser bredde til 56px
- Legg til tooltip-komponent for hover
- Oppdater aktiv-state styling

### Steg 2: Lag sekundær navbar-komponent
**Ny fil:** `components/admin/admin-secondary-nav.tsx`

- Wrapper-komponent som tar `children`
- Fast bredde 280px
- Full høyde (h-full)
- Posisjonert til høyre for primær navbar

### Steg 3: Oppdater admin layout
**Fil:** `app/admin/layout.tsx`

- Juster padding fra `lg:pl-64` til `lg:pl-14` (56px)
- Legg til støtte for sekundær navbar via context eller prop

### Steg 4: Refaktorer POI-siden
**Fil:** `app/admin/pois/poi-admin-client.tsx`

- Flytt søkepanel-innhold til sekundær navbar
- Fjern absolute positioning for panelet
- Kartet tar hele resten av plassen

### Steg 5: Refaktorer Generate-siden
**Fil:** `app/admin/generate/generate-client.tsx`

- Flytt kontrollpanel til sekundær navbar
- Samme pattern som POI-siden

### Steg 6: Mobile-tilpasninger
- Legg til knapp i hovedinnhold for å åpne sekundær nav
- Sekundær nav som slide-in drawer på mobil

## Filendringer

| Fil | Endring |
|-----|---------|
| `components/admin/admin-sidebar.tsx` | Redesign til 56px icon-only |
| `components/admin/admin-secondary-nav.tsx` | **NY** - Sekundær navbar wrapper |
| `components/admin/admin-nav-config.ts` | **NY** - Konfigurasjon for hvilke sider som har sekundær nav |
| `app/admin/layout.tsx` | Oppdater layout-struktur |
| `app/admin/pois/poi-admin-client.tsx` | Flytt panel til sekundær nav |
| `app/admin/generate/generate-client.tsx` | Flytt panel til sekundær nav |

## UI-skisse

```
┌────┬────────────────┬──────────────────────────┐
│ 56 │     280px      │                          │
│ px │                │                          │
│    │  Sekundær Nav  │      Hovedinnhold        │
│Icon│  (POI filter,  │      (Kart, lister)      │
│Nav │   search etc)  │                          │
│    │                │                          │
│    │                │                          │
└────┴────────────────┴──────────────────────────┘

Uten sekundær nav:
┌────┬───────────────────────────────────────────┐
│ 56 │                                           │
│ px │                                           │
│    │           Hovedinnhold                    │
│Icon│           (full bredde)                   │
│Nav │                                           │
│    │                                           │
│    │                                           │
└────┴───────────────────────────────────────────┘
```

## Avhengigheter

- Ingen nye npm-pakker nødvendig
- Tooltip kan implementeres med CSS `:hover` + `::after` pseudo-element

## Testing

1. Verifiser alle menypunkter har fungerende tooltips
2. Test at POI-filter og søk fungerer i ny posisjon
3. Test at kartet fyller tilgjengelig plass korrekt
4. Test mobile-visning med drawer
5. Test at sider uten sekundær nav får full bredde
