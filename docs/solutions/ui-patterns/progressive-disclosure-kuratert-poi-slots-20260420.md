---
title: "Progressiv disclosure + kuraterte POI-slots i Report-tekstseksjon"
category: ui-patterns
tags: [progressive-disclosure, poi-curation, anchor-slots, line-clamp, report, report-theme-section, ux]
module: Report
symptoms: "Alle brukere får full informasjonsmengde (narrativ + POI-slider + grounding + kart) uavhengig av interesse; POI-slider viser ren score-ranking uten hensyn til at boligkjøpere alltid vil vite nærmeste skole, dagligvare, buss."
root_cause: "Alle Report-blokker var alltid rendret og alltid pure-ranked. Ingen ankerplass-logikk, ingen signal-basert avsløring."
---

## Problem

`ReportThemeSection` rendret alltid full informasjonsmengde per tema: Placy-narrativ, ReportHeroInsight, Gemini-grounding, POI-slider og dormant kart-preview. Brukere som bare ville ha rask oversikt måtte scrolle forbi alt. I tillegg viste POI-slideren ren `rankScore`-ranking (googleRating × tier-vekt), uten å prioritere de faste spørsmålene boligkjøpere stiller: "nærmeste buss?", "nærmeste barnehage?", "nærmeste treningssenter?".

## Løsning

### 1. Progressiv disclosure — 3 nivåer

```
Nivå 1 — Default:
  Tema-header + ReportHeroInsight (structured cards)
  Placy narrativ (line-clamp-[6] + gradient fade to-[#f5f1ec])
  [Les mer om {theme.name}] ↓

Nivå 2 — Etter "Les mer":
  Narrativ (full, ingen clamp)
  [Vis mindre] ↑
  Address input (transport)
  POI-slider (kuratert 6 kort)
  Gemini grounding
  CTA "Se alle N steder på kartet"

Nivå 3 — Etter CTA-klikk:
  Dormant kart-preview (animate-in fade-in duration-300)
  Klikk → UnifiedMapModal
```

**State** i `ReportThemeSection`:
```tsx
const [expanded, setExpanded] = useState(false);
const [mapPreviewVisible, setMapPreviewVisible] = useState(false);
const [mapDialogOpen, setMapDialogOpen] = useState(false);
```

**Vis mindre** resetter `mapPreviewVisible` også — neste ekspansjon starter uten kart-preview.

**Line-clamp > max-h**: `line-clamp-[6]` er font-size-agnostisk og klipper presist på linjegrense. `max-h` i px gir halve linjer ved zoom eller custom font-size.

**Fade-gradient**: `bg-gradient-to-b from-transparent to-[#f5f1ec]` matcher seksjonsbakgrunn. `pointer-events-none` så klikk går gjennom til tekst-chips under.

### 2. Kuraterte POI-slots — anchor + ranking-fill

Ny `getCuratedPOIs`-funksjon i `components/variants/report/top-ranked-pois.ts`:

```typescript
export interface AnchorSlot {
  categoryId: string;  // poi.category.id eksakt match
}

export const THEME_ANCHOR_SLOTS: Record<string, readonly AnchorSlot[]> = {
  "barn-oppvekst": [
    { categoryId: "barnehage" },
    { categoryId: "skole" },
    { categoryId: "lekeplass" },
  ],
  "hverdagsliv": [
    { categoryId: "supermarket" },
    { categoryId: "pharmacy" },
    { categoryId: "shopping" },
  ],
  "trening-aktivitet": [
    { categoryId: "gym" },
    { categoryId: "gym" },
    { categoryId: "gym" },
  ],
  "transport": [
    { categoryId: "bus" },
    { categoryId: "bike" },
    { categoryId: "carshare" },
  ],
  "natur-friluftsliv": [
    { categoryId: "park" },
    { categoryId: "outdoor" },
    { categoryId: "badeplass" },
  ],
  "opplevelser": [
    { categoryId: "library" },
    { categoryId: "cinema" },
  ],
  // mat-drikke: ingen anchor-slots → pure ranking
};

export function getCuratedPOIs(
  pois: readonly POI[],
  themeId: string,
  limit: number,
): readonly POI[] {
  if (limit < 1) return [];
  const anchors = THEME_ANCHOR_SLOTS[themeId] ?? [];
  const byWalk = [...pois].sort(
    (a, b) =>
      (a.travelTime?.walk ?? Infinity) - (b.travelTime?.walk ?? Infinity),
  );
  const result: POI[] = [];
  for (const anchor of anchors) {
    if (result.length >= limit) break;
    const idx = byWalk.findIndex((p) => p.category.id === anchor.categoryId);
    if (idx >= 0) result.push(byWalk.splice(idx, 1)[0]);
  }
  const pinned = new Set(result.map((p) => p.id));
  const ranked = [...byWalk]
    .filter((p) => !pinned.has(p.id))
    .sort((a, b) => rankScore(b) - rankScore(a));
  for (const poi of ranked) {
    if (result.length >= limit) break;
    result.push(poi);
  }
  return result;
}
```

**Tiebreaker**: innen samme anchor-type (3 gyms) velges nærmest-først via `travelTime.walk` asc. Missing travel-time synker til bunn (`Infinity`).

**Deduplikasjon**: `splice` fjerner anchor-POI fra `byWalk`-pool. `pinned`-Set sikrer at ranking-fill ikke duplikerer. Immutabel (`[...byWalk].filter(...).sort(...)`).

**Graceful fallback**: Ukjent theme-id → anchors = []. Manglende anchor → hopper videre. Færre POI-er enn limit → ingen padding.

### 3. ReportTheme: `curatedSliderPOIs?`

```typescript
export interface ReportTheme {
  /** Top-10 ranked for map-modal bottom carousel */
  topRanked: readonly POI[];
  /** Kuraterte 6 for text-slider (anchor + ranking-fill). Optional for test-fixtures. */
  curatedSliderPOIs?: readonly POI[];
  // ...
}
```

Populert i `transformToReportData`:
```typescript
topRanked: getTopRankedPOIs(filtered, 10),
curatedSliderPOIs: getCuratedPOIs(filtered, themeDef.id, 6),
```

`topRanked` beholdes uendret for kart-modal bottom-carousel (konsistent rekkefølge i hele kart-view).

### 4. ReportThemeSection — ny struktur

```tsx
{/* Narrativ med clamp + fade */}
<div className={`relative ... ${expanded ? "" : "line-clamp-[6] overflow-hidden"}`}>
  {segments.map(...)}
  {!expanded && <div className="... bg-gradient-to-b from-transparent to-[#f5f1ec]" />}
</div>

{/* Les mer / Vis mindre */}
{variant !== "secondary" && (segments.length > 0 || theme.intro) && (
  <button onClick={() => {
    if (expanded) { setExpanded(false); setMapPreviewVisible(false); }
    else { setExpanded(true); }
  }} aria-expanded={expanded}>
    {expanded ? "Vis mindre" : `Les mer om ${theme.name}`}
  </button>
)}

{/* Nivå 2 */}
{expanded && variant !== "secondary" && (
  <>
    {isTransport && projectName && <ReportAddressInput ... />}
    {theme.allPOIs.length > 0 && theme.curatedSliderPOIs?.length > 0 && (
      <ReportThemePOICarousel
        pois={theme.curatedSliderPOIs}
        totalCount={theme.allPOIs.length}
        onOpenMap={revealMapPreview}  // ← setMapPreviewVisible(true)
        ariaLabel={`Steder i ${theme.name}`}
      />
    )}
    {theme.grounding?.groundingVersion === 2 ? <ReportCuratedGrounded ... /> : ...}
  </>
)}

{/* Nivå 3 — !mapDialogOpen er load-bearing (iOS dual-WebGL) */}
{expanded && mapPreviewVisible && !mapDialogOpen && theme.allPOIs.length > 0 && (
  <div className="mt-8 animate-in fade-in duration-300">
    {/* dormant preview */}
  </div>
)}
```

## Gotchas

### Line-clamp > max-h
`max-h` i px krever justering når font-size eller linjehøyde endres. `line-clamp-[6]` er relativ til `line-height` og klipper presist.

### `!mapDialogOpen`-guard er load-bearing
Uten denne mountes kart-preview og modal samtidig → dobbel WebGL-context → iOS Safari krasjer. Gjenbrukt fra forrige plan (2026-04-15 unified-map-modal).

### `poiTier` er ikke skoletrinn
Tidlig plan antok `poiTier: 1/2/3` ≈ barneskole/ungdomsskole/VGS. **Dette er feil** — `poiTier` er kvalitetstier (primær/sekundær/øvrig). Skoler skilles via navn-matching og `lib/utils/school-zones.ts` (gjenbrukt i `ReportHeroInsight`). Løsning: `barn-oppvekst` anchors er `barnehage/skole/lekeplass` — skoletrinn håndteres allerede av `SchoolCard` i `ReportHeroInsight`.

### Ukjent theme-id = graceful fallback
`THEME_ANCHOR_SLOTS[themeId] ?? []` — næring-temaer (`hverdagstjenester`, `nabolaget`) er ikke konfigurert og faller tilbake til pure ranking. Ingen runtime-feil.

## Filer

| Fil | Status |
|-----|--------|
| `components/variants/report/top-ranked-pois.ts` | ENDRET — `AnchorSlot`, `THEME_ANCHOR_SLOTS`, `getCuratedPOIs` |
| `components/variants/report/top-ranked-pois.test.ts` | ENDRET — 10 nye tester (anchor, fallback, dedup, missing-theme) |
| `components/variants/report/report-data.ts` | ENDRET — `curatedSliderPOIs?` felt + populering |
| `components/variants/report/ReportThemeSection.tsx` | ENDRET — `expanded` + `mapPreviewVisible` state, progressive disclosure |

Ingen nye filer. Ingen slettinger.

## Invariant-tester

```typescript
// TC-A4: mat-drikke uten anchors === ren ranking
it("mat-drikke (ingen anchors) === getTopRankedPOIs", () => {
  const curated = getCuratedPOIs(pois, "mat-drikke", 6);
  const ranked = getTopRankedPOIs(pois, 6);
  expect(curated.map((p) => p.id)).toEqual(ranked.map((p) => p.id));
});

// TC-A7: anchor-POI vises aldri i ranking-fill
it("dedup — anchor-POI ikke duplikat i ranking-fill", () => {
  // barnehage med høyeste rankScore skal være i slot 1, ikke også i ranking-fill
  const result = getCuratedPOIs(pois, "barn-oppvekst", 6);
  const bhgCount = result.filter((p) => p.id === "bhg-1").length;
  expect(bhgCount).toBe(1);
});
```
