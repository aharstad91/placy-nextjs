# Plan: Admin Dashboard Samleside

**Dato:** 2026-01-25
**Status:** Draft

## Mål

Lage en samleside på `/admin` som gir oversikt over hele systemet med lenker til relevante admin-funksjoner.

## Design

Minimalistisk liste-design med:
- Enkel header
- Seksjoner med tall (counts) og lenker
- Rask skanning

## Seksjoner

| Seksjon | Beskrivelse | Lenke |
|---------|-------------|-------|
| **Kunder** | Antall kunder i systemet | `/admin/customers` (fremtidig) |
| **Prosjekter** | Antall prosjekter | `/admin/projects` (fremtidig) |
| **POI-er** | Antall POIs, lenke til eksisterende | `/admin/pois` |
| **Kategorier** | Antall kategorier | Inline visning |
| **Story Generator** | Verktøy for generering | `/admin/generate` |

## Implementering

### Fil: `app/admin/page.tsx`

```
- Server component (henter counts fra Supabase)
- Enkel grid/liste med seksjoner
- Hver seksjon viser:
  - Ikon
  - Tittel
  - Antall (count)
  - Kort beskrivelse
  - Lenke til detaljer
```

### Datakilder

```typescript
// Fra Supabase:
const customerCount = await supabase.from('customers').select('*', { count: 'exact', head: true })
const projectCount = await supabase.from('projects').select('*', { count: 'exact', head: true })
const poiCount = await supabase.from('pois').select('*', { count: 'exact', head: true })
const categoryCount = await supabase.from('categories').select('*', { count: 'exact', head: true })
```

## Arbeidspakker

1. **Opprett `/admin/page.tsx`** - Hovedsiden med counts og lenker
2. **(Valgfritt) Legg til navigasjon** - Felles header/nav for admin-sider

## Avhengigheter

- Supabase må være konfigurert
- `ADMIN_ENABLED=true` må være satt

## Ikke inkludert (fremtidig)

- `/admin/customers` - Kunde-administrasjon
- `/admin/projects` - Prosjekt-administrasjon
- Story-redigering
