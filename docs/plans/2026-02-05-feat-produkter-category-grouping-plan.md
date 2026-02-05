# Plan: Kategorigruppering i Produkter-fanen

**Brainstorm:** `docs/brainstorms/2026-02-05-produkter-category-grouping-brainstorm.md`
**Fil som endres:** `app/admin/projects/[id]/project-detail-client.tsx`
**Server-endringer:** Ingen (batch-operasjonene støtter allerede subset av POI-er)

## Mål

Erstatt flat, alfabetisk POI-liste i Produkter-fanen med kategorigrupper. Hver kategori får en header med checkbox for å velge/fjerne alle POI-er i kategorien.

## Endringer

### 1. Legg til `handleToggleCategory`-funksjon

Ny funksjon i `ProductsTab` som bruker eksisterende `batchAddPoisToProduct`/`batchRemovePoisFromProduct` for å toggle alle POI-er i en kategori.

```typescript
const handleToggleCategory = async (
  product: ProductWithPois,
  categoryName: string,
  poisInCategory: typeof projectPois,
  selectAll: boolean
) => {
  // Filter to only POIs that need toggling
  // Use existing batch operations
  // Optimistic updates per POI
};
```

### 2. Legg til `getSelectedCountForCategory`-funksjon

Helper som teller valgte POI-er innenfor en kategori, med optimistiske oppdateringer.

### 3. Grupper POI-er etter kategori

I render-logikken, grupper `projectPois` etter `poi.categories.name`:

```typescript
const poisByCategory = useMemo(() => {
  const groups: Record<string, typeof projectPois> = {};
  for (const pp of projectPois) {
    const catName = pp.pois.categories?.name || "Ukategorisert";
    if (!groups[catName]) groups[catName] = [];
    groups[catName].push(pp);
  }
  // Sort categories alphabetically, "Ukategorisert" last
  // Sort POIs within each category alphabetically
  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === "Ukategorisert") return 1;
      if (b === "Ukategorisert") return -1;
      return a.localeCompare(b);
    })
    .map(([name, pois]) => ({
      name,
      pois: pois.sort((a, b) => a.pois.name.localeCompare(b.pois.name)),
    }));
}, [projectPois]);
```

### 4. Erstatt flat liste med grupperte seksjoner

Erstatt innholdet i `{isExpanded && (...)}` blokken (linje 1423-1514) med:

**Toppnivå:** Behold "X av Y valgt" + "Velg alle"/"Fjern alle" (fungerer på hele produktet som nå)

**Per kategori:**
- Kategori-header med: checkbox, kategorinavn, "X/Y valgt"-badge
- POI-rader under med eksisterende checkbox-design

```
[Toppnivå: 84 av 84 valgt] [Velg alle] [Fjern alle]
─────────────────────────────────────────────────────
☑ Buss (8)                                    8/8 valgt
  ☑ Bakkegata bussholdeplass
  ☑ Dronningens gate bussholdeplass
  ...
☑ Bysykkel (30)                              30/30 valgt
  ☑ Trondheim Bysykkel: Bakke bru
  ...
☑ Dagligvare (3)                              3/3 valgt
  ☑ Coop Prix Øya                        ★ 3.8
  ...
☐ Kafé (15)                                  12/15 valgt
  ☑ Antikvariatet                        ★ 4.6
  ☐ Espresso House                       ★ 3.9
  ...
☑ Restaurant (15)                            15/15 valgt
  ☑ AiSuma Restaurant                    ★ 4.5
  ...
☑ Tog (1)                                     1/1 valgt
  ☑ Trondheim S stasjon
```

### 5. Kategori-header design

```tsx
<div className="flex items-center gap-3 p-2 bg-gray-100 rounded-lg">
  <checkbox /> {/* tri-state: all/some/none */}
  <span className="text-sm font-semibold text-gray-700">{categoryName}</span>
  <span className="text-xs text-gray-500">({count})</span>
  <span className="ml-auto text-xs text-gray-500">{selected}/{total} valgt</span>
</div>
```

Kategori-checkbox states:
- **Alle valgt:** checked (filled blue)
- **Noen valgt:** indeterminate (dash/minus)
- **Ingen valgt:** unchecked

## Implementasjonsrekkefølge

- [ ] 1. Legg til `useMemo` for `poisByCategory` gruppering
- [ ] 2. Legg til `getSelectedCountForCategory` helper
- [ ] 3. Legg til `handleToggleCategory` med batch-operasjoner og optimistiske oppdateringer
- [ ] 4. Erstatt flat POI-liste med grupperte seksjoner inkl. kategori-headers
- [ ] 5. Verifiser visuelt i browser

## Ikke i scope

- Søkefelt
- Kollapserbare kategorier
- Endring av POI-kategori fra denne visningen
- Endringer i server actions
