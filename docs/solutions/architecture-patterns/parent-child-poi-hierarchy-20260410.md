---
name: Parent-child POI-hierarki (kjøpesenter-anker)
description: Self-referencing parent_poi_id på pois-tabellen kobler barn-POI-er (butikker) til parent (senter). Filtreres fra kart og hero-rader, vises innfoldet i drawer + anker-rad.
type: feature-implementation
module: report-variant
date: 2026-04-10
tags: [poi, hierarchy, parent-child, shopping-center, report, hverdagsliv, cross-theme]
---

# Parent-Child POI-hierarki (Kjøpesenter-anker)

## Kontekst

Kjøpesenteret (f.eks. Valentinlyst Senter) samler 20+ butikker. Hero insight-kortet viste tidligere 5 enkeltbutikker (Coop Mega, Boots, Vinmonopolet, frisør, senter) uten å kommunisere at alle var under ett tak. Brukeren så butikkene, men forsto ikke at senteret hadde hele pakken. Senteret er verdien — ikke de 5 vi viste.

Løsning: **Senteret blir en POI med eget markør**, og butikkene inne i senteret får `parent_poi_id` pekende til senteret. Barn-POI-er filtreres fra kart-markører og hero-rader, men vises kompakt under senter-raden i hero-kortet og i "Butikker i senteret"-seksjonen i kart-draweren.

## Datamodell

```sql
-- Migration 056
ALTER TABLE pois ADD COLUMN IF NOT EXISTS parent_poi_id TEXT
  CONSTRAINT pois_parent_poi_id_fkey REFERENCES pois(id) ON DELETE SET NULL;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS anchor_summary TEXT;
ALTER TABLE pois ADD CONSTRAINT pois_no_self_parent
  CHECK (parent_poi_id IS NULL OR parent_poi_id != id);
CREATE INDEX IF NOT EXISTS idx_pois_parent_poi_id ON pois(parent_poi_id);
```

**Hvorfor `ON DELETE SET NULL`:** Sletting av parent-POI skal ikke kaskadere og slette barna. Barn-POI-ene blir standalone (parent_poi_id = NULL) — mister relasjonen men eksisterer fortsatt.

**Hvorfor CHECK constraint:** Forhindrer at en POI peker til seg selv som parent.

## TypeScript-typer

```typescript
// lib/types.ts
export interface POI {
  // ...eksisterende felt
  parentPoiId?: string;
  anchorSummary?: string;
  childPOIs?: POI[]; // Runtime-populated, ikke i DB
}
```

`childPOIs` lever kun i runtime — populeres i `transformToReportData` fra parent-POI-er.

## Single Filter Point — VIKTIG

**All filtrering av barn-POI-er skjer ETT sted:** `components/variants/report/report-data.ts` → `transformToReportData()`. Ingen downstream-filtrering i `ReportThemeSection`, `ReportThemeMap`, eller andre komponenter.

Dette er en bevisst arkitektonisk beslutning: én kilde, alle konsumenter arver automatisk. Unngår dobbel-filtrering eller inkonsistent state hvor noen kanaler viser barn og andre ikke.

## Cross-Theme Guard

**Kritisk edge case:** Hvis parent (`shopping`-kategori) er i Hverdagsliv-tema, og et barn (`restaurant`) hører til Mat & Drikke-tema, skal IKKE barnet filtreres fra Mat & Drikke (parent er ikke der).

```typescript
// Filter children ONLY when parent is in the same theme
const parentIdsInTheme = new Set(
  categoryFiltered.filter(p => !p.parentPoiId).map(p => p.id)
);
const filtered = categoryFiltered
  .filter(p => !p.parentPoiId || !parentIdsInTheme.has(p.parentPoiId))
  .map(p => {
    const children = childByParent.get(p.id);
    return children ? { ...p, childPOIs: children } : p;
  });
```

Uten cross-theme guard ville et barn i feil tema forsvinne helt.

## Hero Metrics

Toppnivå-beregninger (`heroMetrics.totalPOIs`, `ratedPOIs`, `totalReviews`, `transportCount`) ekskluderer barn-POI-er for å unngå dobbel-telling:

```typescript
const topLevelPOIs = allPOIs.filter(p => !p.parentPoiId);
const ratedPOIs = topLevelPOIs.filter(p => p.googleRating != null);
// ... resten av metrics bruker topLevelPOIs
```

## Hero Insight Anchor-rad

`HverdagslivInsight` i `ReportHeroInsight.tsx` viser anker-raden med:
- Senter-navn + ShoppingBag-ikon
- Gangavstand
- Nettside-lenke (ExternalLink-ikon) om `googleWebsite` finnes og passer `isSafeUrl()`
- Google AI-lenke (Sparkles-ikon) — alltid tilgjengelig via `google.com/search?udm=50&q=...`
- `anchorSummary` som beskrivelse under navnet
- `childPOIs` som kompakt liste (ikon + navn + kategori-label)

## Map Drawer

`ReportMapDrawer.tsx` viser "Butikker i senteret"-seksjon når POI-en har `childPOIs`. Seksjonen bruker `ShoppingBag`-ikon som header, og listen er samme format som i hero-anker-raden.

Både desktop (venstre sidebar) og mobile (bottom drawer) viser `anchorSummary` og `childPOIs` når tilgjengelig.

## Supabase Types Gotcha

Supabase genererte typer (`DbPoi = Tables<"pois">`) oppdateres IKKE automatisk når kolonner legges til via psql. Dette betyr at `parent_poi_id` og `anchor_summary` ikke er kjent av typesystemet før `supabase gen types` kjøres.

**Mønster:** Bruk cast i `transformPOI`:
```typescript
parentPoiId: ((dbPoi as Record<string, unknown>).parent_poi_id as string | null) ?? undefined,
anchorSummary: ((dbPoi as Record<string, unknown>).anchor_summary as string | null) ?? undefined,
```

Samme mønster brukes allerede for andre kolonner (eventDates, facebookUrl, etc.).

## Upsert Preservation

`upsertPOIsWithEditorialPreservation()` i `mutations.ts` inkluderer IKKE `parent_poi_id`/`anchor_summary` i sin `.select()` eller merge-logikk. Det er trygt fordi Supabase upsert kun oppdaterer kolonner som er presente i payload-objektet — kolonner som ikke er med forblir uendret.

**Viktig:** Dette gjelder fordi feltene settes manuelt via migrasjoner, ikke via importløpet. Hvis de noen gang skal settes via import, må preservation-logikken oppdateres.

## Filer endret

| Fil | Endring |
|-----|---------|
| `supabase/migrations/056_parent_poi_id.sql` | Ny — schema |
| `supabase/migrations/057_wesselslokka_parent_pois.sql` | Ny — Valentinlyst data |
| `lib/types.ts` | `parentPoiId`, `anchorSummary`, `childPOIs` på POI |
| `lib/supabase/queries.ts` | `transformPOI` + manuell `DbPoi` i `getPOIsWithinRadius` |
| `components/variants/report/report-data.ts` | Child lookup + filter + childPOIs populering |
| `components/variants/report/ReportHeroInsight.tsx` | Anker-rad berikelse |
| `components/variants/report/ReportMapDrawer.tsx` | "Butikker i senteret"-seksjon |

## Læringer

1. **Single filter point er avgjørende.** Tech audit fanget at filtrering i ReportThemeSection + report-data ville skape dobbel-filtrering. Én kilde.
2. **Cross-theme guard.** Uten det kunne et barn i "Mat & Drikke" forsvinne fordi parent var i "Hverdagsliv". Audit-mitigasjon.
3. **ON DELETE SET NULL** er trygg default for parent-child relasjoner der barna har egen verdi.
4. **Supabase upsert bevarer kolonner** som ikke er i payload — ingen behov for å inkludere parent_poi_id i import-pipeline.
5. **Cast-pattern** fungerer for nye kolonner som ikke er i generert Supabase-type.

## Referanser

- Plan: `docs/plans/2026-04-10-feat-kjopesenter-anker-parent-poi-plan.md`
- Brainstorm: `docs/brainstorms/2026-04-10-kjopesenter-anker-brainstorm.md`
- Relatert mønster: `docs/solutions/architecture-patterns/area-hierarki-strok-eiendom-20260409.md` (parent-child for areas)
