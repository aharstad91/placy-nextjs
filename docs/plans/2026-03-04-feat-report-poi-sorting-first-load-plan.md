# Plan: Smartere POI-sortering i Report tema-seksjoner

**Dato:** 2026-03-04
**Brainstorm:** `docs/brainstorms/2026-03-04-report-poi-sorting-first-load-brainstorm.md`
**Tilnærming:** D — Diversifisert + tier-bevisst hybrid

## Enhancement Summary

**Deepened on:** 2026-03-04
**Reviewers:** kieran-typescript-reviewer, code-simplicity-reviewer, performance-oracle
**Learnings checked:** trust-filter-missing-report-data-layer, empty-product-categories-explorer-zero-pois

### Key Improvements from Deepening
1. **Removed ≤2 fallback branch** — round-robin handles 1-2 categories correctly, no special case needed
2. **Fixed termination condition** — replaced unreliable `catIdx - selected.length` with bounded `totalAvailable` ceiling
3. **Extract shared `effectiveDistance` utility** — distance fallback (walk time → haversine) is duplicated 3+ places

### New Considerations Discovered
- Distance fallback logic exists in `transformToReportData:371-378`, `byTierThenDistance`, and `applyThemeCategoryFilters` — extract once
- `byTierThenScore` is still used by `buildSubSections` — after this change it will only be used as export (grep to verify)
- Learning from trust-filter bug: our change is at the correct layer (data transform, not rendering)

## Mål

Erstatt `byTierThenScore`-sorteringen for flat tema-visning med en kategori-diversifisert algoritme som sikrer at første 6 POI-er viser bredde (1 buss + 1 sykkel + 1 tog) i stedet for konsentrasjon (3x bysykkel).

## Hvorfor

I dag overskriver `byTierThenScore` (linje 386 i `report-data.ts`) avstandssorteringen fullstendig. En godt-ratet togstasjon 1km unna vises i første batch, mens en bussholdeplass 200m unna gjemmes bak "Hent flere". Dette gir dårlig brukeropplevelse for alle temaer — ikke bare transport.

## Algoritme

### Flat tema-visning (ingen sub-sections)

**Ny funksjon: `diversifiedSelection(pois: POI[], center: Coordinates, count: number)`**

Input: `filtered` — allerede avstandssortert og kategorifiltrert.

1. **Grupper etter kategori** — behold avstandsrekkefølge innen hver gruppe
2. **Innen hver kategori:** re-sorter etter `tier → avstand` (IKKE score)
   - Tier er primær (lavere = bedre)
   - Avstand er sekundær (nærmere = bedre)
   - Google-score ignoreres — en bussholdeplass med 0 reviews er like nyttig som en med 500
3. **Round-robin:** plukk beste (tier → avstand) fra hver kategori, roter mellom kategorier
4. **Fyll opp til `count`** (default 6) med neste beste fra hver kategori
5. **Resten → hiddenPOIs**, sortert etter `tier → avstand`

> **Deepening note:** Ingen ≤2-kategorier fallback. Round-robin degenererer korrekt for 1-2 kategorier (sekvensiell plukking fra én/to bøtter). Ekstra branch gir inkonsistens-risiko uten gevinst.

### Sub-sections (≥15 POI-er i én kategori)

Sub-sections er allerede gruppert per kategori, så round-robin er irrelevant. **Eneste endring:** Bytt sekundærsortering fra `score` til `avstand` innen `buildSubSections`.

Erstatt:
```typescript
const sortedCatPOIs = [...filteredPOIs].sort(byTierThenScore);
```
Med:
```typescript
const sortedCatPOIs = [...filteredPOIs].sort(byTierThenDistance(center));
```

### Sorteringsrekkefølge for hiddenPOIs

Etter `diversifiedSelection` har plukket de første N, sorteres resten etter `tier → avstand`. Grunnen: brukeren som klikker "Hent flere" vil se det nærmeste først, med tier som tiebreaker.

> **Performance note:** Hidden-sort er O(n log n) på n≤44 items — koster ingenting. Behold for bedre UX.

## Scope — Filer som endres

| Fil | Endring |
|-----|---------|
| `components/variants/report/report-data.ts` | Ny `diversifiedSelection()`, ny `byTierThenDistance()`, oppdater `transformToReportData` og `buildSubSections` |
| `components/variants/report/report-data.test.ts` | Nye tester for diversifisert sortering |
| `lib/utils/poi-score.ts` | Ingen endring (score-funksjonen beholdes for andre bruksområder) |

**Ingen UI-endringer.** Ingen nye avhengigheter. Ingen migrasjoner.

## Implementeringssteg

### Steg 1: Ny sorteringsfunksjon `byTierThenDistance`

Fil: `report-data.ts`

```typescript
/**
 * Sort comparator: tier first (lower = better), then distance to center (closer = better).
 * NULL_TIER_VALUE = 2.5 places unevaluated POIs between tier 2 and 3.
 */
function byTierThenDistance(center: Coordinates) {
  return (a: POI, b: POI): number => {
    const aTier = a.poiTier ?? NULL_TIER_VALUE;
    const bTier = b.poiTier ?? NULL_TIER_VALUE;
    if (aTier !== bTier) return aTier - bTier;
    // Distance: prefer walk time, fall back to haversine
    const aDist = a.travelTime?.walk ?? haversineMeters(center, a.coordinates);
    const bDist = b.travelTime?.walk ?? haversineMeters(center, b.coordinates);
    return aDist - bDist;
  };
}
```

- [ ] Implementer `byTierThenDistance`
- [ ] Verifiser at haversine og walk-time brukes konsistent med eksisterende avstandssortering (linje 371-378)

> **Research insight — distance fallback:** Samme walk → haversine fallback brukes i `transformToReportData:371-378`. For n=5-50 POI-er er haversine i komparator OK ytelsesmessig (microsekunder per kall). Vurder å ekstrahere til `effectiveDistance(center, poi)` utility for å unngå duplisering, men ikke kritisk for dette scopet.

### Steg 2: Ny funksjon `diversifiedSelection`

Fil: `report-data.ts`

```typescript
/**
 * Select POIs using category-diversified round-robin.
 * Ensures first N POIs show breadth across categories.
 * Within each category: sorted by tier → distance (not score).
 * Handles any number of categories correctly (1, 2, or many).
 */
function diversifiedSelection(
  pois: POI[],
  center: Coordinates,
  count: number = INITIAL_VISIBLE_COUNT,
): { visiblePOIs: POI[]; hiddenPOIs: POI[] } {
  if (pois.length === 0) return { visiblePOIs: [], hiddenPOIs: [] };

  // Group by category
  const byCat = new Map<string, POI[]>();
  for (const poi of pois) {
    const catId = poi.category.id;
    const arr = byCat.get(catId);
    if (arr) {
      arr.push(poi);
    } else {
      byCat.set(catId, [poi]);
    }
  }

  // Re-sort within each category: tier → distance
  const comparator = byTierThenDistance(center);
  for (const catPOIs of byCat.values()) {
    catPOIs.sort(comparator);
  }

  const categories = Array.from(byCat.keys());

  // Round-robin: pick best from each category in turn
  const selected: POI[] = [];
  const indices = new Map<string, number>(categories.map(c => [c, 0]));
  const totalAvailable = Math.min(count, pois.length);
  let catIdx = 0;

  while (selected.length < totalAvailable) {
    const catId = categories[catIdx % categories.length];
    const catPOIs = byCat.get(catId);
    const idx = indices.get(catId);
    if (catPOIs !== undefined && idx !== undefined && idx < catPOIs.length) {
      selected.push(catPOIs[idx]);
      indices.set(catId, idx + 1);
    }
    catIdx++;
  }

  // Hidden: everything not selected, sorted by tier → distance
  const selectedIds = new Set(selected.map(p => p.id));
  const hidden = pois.filter(p => !selectedIds.has(p.id)).sort(comparator);

  return { visiblePOIs: selected, hiddenPOIs: hidden };
}
```

- [ ] Implementer `diversifiedSelection`
- [ ] Håndter edge case: tomt tema (0 POI-er) — early return
- [ ] Håndter edge case: færre POI-er enn `count` — `totalAvailable` begrenser automatisk

> **Deepening changes fra original:**
> - **Fjernet ≤2-fallback** — round-robin degenererer korrekt (simplicity reviewer)
> - **Fjernet `catIdx - selected.length` safety break** — erstattet med `totalAvailable = Math.min(count, pois.length)` som while-tak. Terminering er garantert: `totalAvailable ≤ pois.length`, og alle POI-er er fordelt i bøttene, så while-loopen vil alltid finne noe å plukke (TS reviewer + simplicity reviewer enige)
> - **Fjernet `!` non-null assertions** — erstattet med structural guards `catPOIs !== undefined && idx !== undefined` (TS reviewer)
> - **Bruker `byCat.get(catId)` + push** i stedet for `has` + `get` + `push` — unngår dobbel lookup

### Steg 3: Oppdater `transformToReportData`

Fil: `report-data.ts`, linje 385-387

**Erstatt:**
```typescript
const sorted = [...filtered].sort(byTierThenScore);
const { visiblePOIs, hiddenPOIs } = splitVisibleHidden(sorted);
```

**Med:**
```typescript
const { visiblePOIs, hiddenPOIs } = diversifiedSelection(filtered, center);
```

- [ ] Erstatt sortering i `transformToReportData`
- [ ] Verifiser at `allPOIs` (linje 430) fortsatt er `filtered` (uendret)

### Steg 4: Oppdater `buildSubSections`

Fil: `report-data.ts`, innen `buildSubSections` (~linje 300)

**Erstatt:**
```typescript
const sortedCatPOIs = [...filteredPOIs].sort(byTierThenScore);
```

**Med:**
```typescript
const sortedCatPOIs = [...filteredPOIs].sort(byTierThenDistance(center));
```

- [ ] Erstatt sub-section sortering
- [ ] Verifiser at `center` er tilgjengelig i `buildSubSections` (den er — parameter)

### Steg 5: Grep `byTierThenScore`-bruk

- [ ] `grep -r byTierThenScore` — verifiser at den kun brukes i report-data.ts
- [ ] Hvis ingen andre brukere: fjern `export` fra `byTierThenScore` (den er nå kun brukt i tester)
- [ ] Behold funksjonen — eksisterende tester refererer til den

### Steg 6: Tester

Fil: `report-data.test.ts`

**Nye tester:**

1. **`diversifiedSelection` — round-robin across categories:**
   - 3 buss + 3 sykkel + 3 restaurant → første 6 = 1 buss + 1 sykkel + 1 restaurant + 1 buss + 1 sykkel + 1 restaurant

2. **`diversifiedSelection` — tier-bevisst innen kategori:**
   - Tier 1 buss langt unna + tier 3 buss nært → tier 1 velges først

3. **`diversifiedSelection` — single category:**
   - Bare busser → sortert tier → avstand, sekvensiell plukking

4. **`diversifiedSelection` — two categories:**
   - 5 buss + 5 sykkel → alternerer: buss, sykkel, buss, sykkel, buss, sykkel

5. **`diversifiedSelection` — avstand som sekundær:**
   - To tier-2 busser: 200m og 800m → 200m velges først

6. **`diversifiedSelection` — ujevne kategorier:**
   - 10 buss + 1 sykkel + 1 restaurant → sykkel og restaurant garantert i første 6

7. **`diversifiedSelection` — empty input:**
   - 0 POI-er → `{ visiblePOIs: [], hiddenPOIs: [] }`

8. **`diversifiedSelection` — fewer than count:**
   - 4 POI-er med count=6 → alle 4 visible, 0 hidden

9. **`diversifiedSelection` — hiddenPOIs sorted by tier → distance:**
   - Verifiser at hidden-listen er korrekt sortert

10. **`byTierThenDistance` — grunnleggende:**
    - Sorterer tier først, avstand sekundært

11. **Eksisterende `byTierThenScore`-tester:** Beholdes (funksjonen brukes i tester)

- [ ] Skriv alle tester
- [ ] Verifiser at eksisterende tester fortsatt passerer
- [ ] Eksporter `diversifiedSelection` og `byTierThenDistance` for testing

### Steg 7: Verifisering

- [ ] `npm test` — alle tester passerer
- [ ] `npx tsc --noEmit` — ingen typefeil
- [ ] `npm run lint` — ingen ESLint-feil
- [ ] `npm run build` — bygger uten feil
- [ ] Manuell sjekk: Åpne en Report med Transport & Mobilitet-temaet og verifiser at første 6 viser diversitet

## Akseptansekriterier

1. Første 6 POI-er i et tema viser minimum 3 ulike kategorier (når temaet har ≥3 kategorier)
2. Innen hver kategori: tier-1 POI slår tier-3 POI, uavhengig av Google-score
3. Innen same tier: nærmere POI slår fjernere POI
4. Sub-sections bruker tier → avstand (ikke tier → score)
5. Alle eksisterende tester passerer
6. Ingen UI-endringer — bare rekkefølgen endres

## Risiko

| Risiko | Sannsynlighet | Mitigation |
|--------|--------------|------------|
| Round-robin-loop terminerer ikke | **Eliminert** | `totalAvailable = Math.min(count, pois.length)` garanterer terminering |
| `byTierThenScore` brukes andre steder | Lav | Grep codebase, behold funksjonen |
| Eksisterende tester feiler | Medium | Oppdater tester som tester rekkefølge av sortert output |
| Ulike categorier returneres i ulik rekkefølge mellom kjøringer | Lav | `Map` preserverer insertion order, som igjen kommer fra avstandssorteringen — deterministisk |
