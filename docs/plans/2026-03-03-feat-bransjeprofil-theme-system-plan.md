# Plan: Bransjeprofil — Tag-drevet tema-system

**Brainstorm:** Sesjon 2026-03-03 (direkte samtale, ikke fil)
**Compound docs:**
- `docs/solutions/architecture-patterns/bransjeprofil-eiendom-bolig-20260303.md`
- `docs/solutions/architecture-patterns/bransjeprofil-eiendom-naering-20260303.md`

## Enhancement Summary

**Deepened on:** 2026-03-03
**Research agents:** 3 (learnings analysis, hardcoding audit, tags flow trace)
**Tech audit:** YELLOW — 1 bug + 3 høy-risiko + 4 medium-risiko, alle med mitigering

### Key Improvements from Research
1. **Oppdaget blocker:** `tags` feltet mangler i `Project` og `ProjectContainer` types + query results — må fikses først
2. **Komplett hardcoding-audit:** 5 kritiske steder + 1 layout-problem (ReportHero grid)
3. **Learnings anvendt:** Filter på data-lag (ikke produkt-lag), NULL + app fallback for nye kolonner, `as const satisfies` for type-sikkerhet

### Tech Audit Findings (applied)
1. **BUG:** `lekeplass` mangler i categories-tabellen — lagt til i Fase 5 migrasjon
2. **Fase 0.5 lagt til:** Eksplisitt override-prioritet (reportConfig > bransjeprofil > fallback)
3. **`THEME_ID_ALIASES`:** Backward-kompatibilitet for gamle tema-IDer i bokmerkede URL-er
4. **`applyExplorerCaps()` signatur:** Oppdatert til å ta caps som parameter
5. **`category_slugs`:** Inkludert i migrasjon for alle nye kategorier
6. **`lekeplass` bugfix:** Eksisterende bug der kategori brukes i kode men mangler i DB

### New Considerations Discovered
- ReportHero.tsx bruker `grid-cols-5` — brekker med 7 temaer
- `CATEGORY_DISPLAY_MODE` i report-data.ts mangler entries for nye temaer (fallback "editorial" fungerer)
- Tags er i Supabase men returneres IKKE fra `getProjectFromSupabase()` eller `getProjectContainerFromSupabase()`

---

## Mål

Bransje-tag på prosjektet (envalg) bestemmer hvilke temaer og kategorier som brukes i WelcomeScreen, Explorer og Report. Én kilde til sannhet per bransje.

## Nåværende tilstand

- `DEFAULT_THEMES` i `lib/themes/default-themes.ts` — 6 temaer, brukt overalt
- Importert direkte i 5+ filer (ikke via getter)
- `explorer-caps.ts` — hardkodet per tema-ID
- `venue-profiles.ts` — hotel/residential/commercial, men kobler IKKE til temaer
- `report-themes.ts` — har override via `project.reportConfig.themes`, men ikke koblet til tag
- `ExplorerOnboarding.tsx` — UBRUKT legacy med hardkodede temaer (skal slettes)
- Prosjekt har `tags: string[]` felt i Supabase, nylig endret til envalg i admin UI
- **BLOCKER:** `tags` returneres IKKE fra query-funksjonene og finnes ikke i TypeScript-typene

## Endringer

### Fase 0: Gjør tags tilgjengelig (BLOCKER)

**Problem:** Tags er i Supabase (`projects.tags`), men:
- `Project` type i `lib/types.ts` mangler `tags` felt
- `ProjectContainer` type mangler `tags` felt
- `getProjectFromSupabase()` i `lib/supabase/queries.ts:577-591` returnerer ikke tags
- `getProjectContainerFromSupabase()` i `lib/supabase/queries.ts:861-883` returnerer ikke tags

**Endringer:**

1. **`lib/types.ts`** — Legg til `tags` på begge typer:
```typescript
export interface Project {
  // ... eksisterende felt ...
  tags?: string[];
}

export interface ProjectContainer {
  // ... eksisterende felt ...
  tags?: string[];
}
```

2. **`lib/supabase/queries.ts`** — Returner tags fra begge funksjoner:
```typescript
// I getProjectFromSupabase() ~linje 591:
return {
  // ... eksisterende ...
  tags: project.tags ?? [],
};

// I getProjectContainerFromSupabase() ~linje 883:
return {
  // ... eksisterende ...
  tags: project.tags ?? [],
};
```

### Fase 0.5: Definer override-prioritet

**Problem:** Report har allerede `project.reportConfig.themes` som override. Når bransjeprofil legges til, må prioritetsrekkefølgen være eksplisitt definert.

**Override-prioritet (høyest til lavest):**
1. `project.reportConfig.themes` — prosjektspesifikk override (eksisterer allerede)
2. `bransjeprofil.themes` — bransje-tag-drevet (NY)
3. `DEFAULT_THEMES` — global fallback (eksisterer allerede)

**Endring i `report-themes.ts`:**
```typescript
export function getReportThemes(project: Project): ReportThemeDefinition[] {
  // 1. Prosjektspesifikk override
  if (project.reportConfig?.themes) {
    return project.reportConfig.themes;
  }
  // 2. Bransjeprofil fra tag
  const profil = getBransjeprofil(project.tags);
  if (profil) {
    return profil.themes.map(toReportTheme);
  }
  // 3. Global fallback
  return REPORT_THEMES;
}
```

**Dokumenter denne prioriteten** i `bransjeprofiler.ts` med kommentar.

### Fase 1: Bransjeprofil-definisjon

**Ny fil: `lib/themes/bransjeprofiler.ts`**

Definerer en `Bransjeprofil` type og mapping fra bransje-tag til profil:

```typescript
import type { ThemeDefinition } from "./theme-definitions";

export interface Bransjeprofil {
  tag: string;                    // "Eiendom - Bolig"
  themes: ThemeDefinition[];      // Tema-sett i ønsket rekkefølge
  defaults: {
    radius: number;               // Standardradius
    minRating: number;            // Min Google-rating
    venueType: "hotel" | "residential" | "commercial";
  };
  explorerCaps: Record<string, number>; // Tema-ID → maks POI-er
  explorerTotalCap: number;
}
```

**Research Insight — Type-sikkerhet med `as const satisfies`:**
```typescript
// Bruk Record<string, Bransjeprofil> for å tvinge komplethet:
export const BRANSJEPROFILER = {
  "Eiendom - Bolig": { ... },
  "Eiendom - Næring": { ... },
} as const satisfies Record<string, Bransjeprofil>;
```

To profiler defineres:

**Eiendom - Bolig (7 temaer):**
1. `barn-oppvekst` — Barn & Oppvekst
2. `hverdagsliv` — Hverdagsliv
3. `mat-drikke` — Mat & Drikke
4. `opplevelser` — Opplevelser
5. `natur-friluftsliv` — Natur & Friluftsliv
6. `trening-aktivitet` — Trening & Aktivitet
7. `transport` — Transport & Mobilitet

**Eiendom - Næring (5 temaer):**
1. `mat-drikke` — Mat & Drikke
2. `transport` — Transport & Mobilitet
3. `trening-aktivitet` — Trening & Aktivitet
4. `hverdagstjenester` — Hverdagstjenester
5. `nabolaget` — Nabolaget

**Fallback:** Prosjekter uten tag bruker dagens 6 temaer (DEFAULT_THEMES).

**Resolver-funksjon:**
```typescript
export function getBransjeprofil(tags?: string[]): Bransjeprofil
```

**Inkluder `buildCategoryToTheme()` her:**
```typescript
export function buildCategoryToTheme(themes: ThemeDefinition[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const theme of themes) {
    for (const cat of theme.categories) {
      map[cat] = theme.id;
    }
  }
  return map;
}
```

### Fase 2: Erstatt hardkodet DEFAULT_THEMES

**Komplett hardcoding-audit (fra research):**

| Fil | Linje | Hva | Endring |
|-----|-------|-----|---------|
| `app/for/[customer]/[project]/page.tsx` | 14, 47-51 | `DEFAULT_THEMES` direkte | `getBransjeprofil(container.tags).themes` |
| `app/for/[customer]/[project]/explore/page.tsx` | 7, 51-55, 58-66 | `DEFAULT_THEMES` direkte | `profil.themes` |
| `components/variants/explorer/ExplorerPage.tsx` | 5, 56-88 | `DEFAULT_THEMES` direkte | Motta themes som prop |
| `components/variants/report/report-themes.ts` | 8-10 | `DEFAULT_THEMES.map(...)` | `getReportThemes()` bruker profil |
| `lib/themes/explorer-caps.ts` | 6-12 | Hardkodet per tema-ID | Flytt til `Bransjeprofil.explorerCaps` |
| `lib/themes/default-themes.ts` | 90-92 | Fallback `"hverdagsbehov"` | Endre til `"hverdagsliv"` |
| `components/variants/report/report-data.ts` | 111-117 | `CATEGORY_DISPLAY_MODE` per tema-ID | Legg til nye tema-IDer |
| `components/variants/report/ReportHero.tsx` | 167 | `grid-cols-5` layout | Oppdater for 5-7 temaer |
| `lib/themes/apply-explorer-caps.ts` | 56 | Fallback cap `?? 10` | Oppdater signatur til å ta caps som parameter |

**Endring i `applyExplorerCaps()` signatur:**
```typescript
// NÅ:
export function applyExplorerCaps(pois: POI[]): POI[]

// ETTER — ta caps som parameter:
export function applyExplorerCaps(
  pois: POI[],
  caps: Record<string, number>,
  totalCap: number
): POI[]
```
Alle kall-steder som sender POI-er til `applyExplorerCaps()` sender også caps fra bransjeprofilen.

**Strategi:**
- `ExplorerPage` mottar `themes` som prop i stedet for å importere `DEFAULT_THEMES`
- Prosjektets landing page resolver bransjeprofil fra tags og sender themes nedover
- `CATEGORY_TO_THEME` bygges dynamisk fra valgt profil

**Research Insight — ReportHero grid-layout:**
```typescript
// NÅ (brekker med 7 temaer):
className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"

// ETTER (dynamisk basert på antall):
className={`grid grid-cols-2 sm:grid-cols-3 ${
  themes.length <= 5 ? "lg:grid-cols-5" :
  themes.length <= 6 ? "lg:grid-cols-3" : "lg:grid-cols-4"
}`}
```

**Research Insight — CATEGORY_DISPLAY_MODE:**
```typescript
// Nye entries:
const CATEGORY_DISPLAY_MODE: Record<string, "editorial" | "functional"> = {
  "mat-drikke": "editorial",
  "opplevelser": "editorial",        // NY
  "natur-friluftsliv": "editorial",  // NY
  "trening-aktivitet": "editorial",  // NY (erstatter trening-velvare)
  "nabolaget": "editorial",          // NY (Næring)
  "hverdagsliv": "functional",       // NY (erstatter hverdagsbehov)
  "hverdagstjenester": "functional", // NY (Næring)
  "barn-oppvekst": "functional",     // NY (erstatter barnefamilier)
  "transport": "functional",
};
```

**URL-kompatibilitet — THEME_ID_ALIASES:**
Gamle tema-IDer (`kultur-opplevelser`, `barnefamilier`, `hverdagsbehov`, `trening-velvare`) kan finnes i bokmerker, delte URL-er eller analytics-data. Legg til alias-mapping i `bransjeprofiler.ts`:
```typescript
export const THEME_ID_ALIASES: Record<string, string> = {
  "kultur-opplevelser": "opplevelser",
  "barnefamilier": "barn-oppvekst",
  "hverdagsbehov": "hverdagsliv",
  "trening-velvare": "trening-aktivitet",
};
```
Bruk i URL-parsing der tema-ID fra query params resolves.

### Fase 3: Oppdater CATEGORY_TO_THEME

`CATEGORY_TO_THEME` er i dag bygget statisk fra `DEFAULT_THEMES` ved import-tid. Det erstattes av `buildCategoryToTheme()` i bransjeprofiler.ts.

**Steder som bruker `CATEGORY_TO_THEME` eller `getThemeForCategory()`:**
- `ExplorerPage.tsx:72-88` — beregner aktive kategorier
- `apply-explorer-caps.ts` — bruker det for tema-lookup
- Diverse steder i report-data

Disse må få `categoryToTheme` som parameter eller bygge det fra themes-propen.

**Research Insight — Filter på data-lag:**
Bransjeprofil-filtrering som gjelder alle produkter (Explorer + Report + Guide) bør ligge i `lib/supabase/queries.ts`, ikke i individuelle produkt-komponenter. Ref: trust-filter-missing learning.

### Fase 4: Slett legacy-kode

- **Slett** `components/variants/explorer/ExplorerOnboarding.tsx` — ubrukt, hardkodede temaer med feil IDer
- **Fjern** globale `CATEGORY_TO_THEME` og `getThemeForCategory()` fra `default-themes.ts` — erstattet av dynamisk versjon
- Behold `DEFAULT_THEMES` som fallback for prosjekter uten tag
- **Grep grundig** etter alle referanser til slettede exports — kjør `npx tsc --noEmit` etter hver sletting

### Fase 5: Nye kategorier i database

Nye kategorier som trengs for de to profilene (krever migrasjon):

| Kategori | Tema (Bolig) | Tema (Næring) | Ikon | Farge |
|----------|-------------|---------------|------|-------|
| `bowling` | Opplevelser | — | Disc | #0ea5e9 |
| `amusement` | Opplevelser | — | Ticket | #0ea5e9 |
| `theatre` | Opplevelser | — | Drama | #0ea5e9 |
| `fitness_park` | Trening & Aktivitet | Trening & Aktivitet | TreePine | #ec4899 |
| `charging_station` | Transport | Transport | Zap | #3b82f6 |
| `scooter` | — | Transport | Bike | #3b82f6 |
| `airport_bus` | — | Transport | Plane | #3b82f6 |
| `conference` | — | Nabolaget | Users | #8b5cf6 |
| `hotel` | — | Nabolaget | BedDouble | #8b5cf6 |
| `lekeplass` | Barn & Oppvekst | — | Baby | #f59e0b |

**BUGFIX:** `lekeplass` er allerede i `DEFAULT_THEMES.categories` men mangler i `categories`-tabellen. Legges til i denne migrasjonen.

**Migrasjon:** `supabase/migrations/XXX_bransjeprofil_categories.sql`

**Inkluder `category_slugs`** for alle nye kategorier (kreves for URL-routing):
```sql
-- Alle nye kategorier må ha slug i category_slugs
INSERT INTO category_slugs (category_id, slug)
VALUES
  ('bowling', 'bowling'),
  ('amusement', 'aktivitetsparker'),
  ('theatre', 'teater'),
  ('fitness_park', 'treningspark'),
  ('charging_station', 'ladestasjon'),
  ('scooter', 'sparkesykkel'),
  ('airport_bus', 'flybuss'),
  ('conference', 'konferanse'),
  ('lekeplass', 'lekeplass')
ON CONFLICT DO NOTHING;
```

**Research Insight — NULL + app fallback:**
```sql
-- IKKE bruk NOT NULL DEFAULT for nye kolonner:
-- ✅ Bruk NULL og la app-laget håndtere fallback
INSERT INTO categories (id, name, icon, color)
VALUES ('bowling', 'Bowling', 'Disc', '#0ea5e9')
ON CONFLICT (id) DO NOTHING;
```

**Research Insight — Supabase types er MANUELLE:**
Etter migrasjon, oppdater `lib/supabase/types.ts` manuelt — auto-generering fanger ikke nye rader.

## Implementeringsrekkefølge

```
Fase 0: Tags i types + queries (BLOCKER — må gjøres først)
  ↓
Fase 0.5: Definer override-prioritet (reportConfig > bransjeprofil > fallback)
  ↓
Fase 1: bransjeprofiler.ts (ny fil, THEME_ID_ALIASES, ingen breaking changes)
  ↓
Fase 5: Database-migrasjon (nye kategorier + lekeplass bugfix + category_slugs)
  ↓
Fase 2: Erstatt DEFAULT_THEMES + oppdater applyExplorerCaps() signatur
  ↓
Fase 3: Dynamisk CATEGORY_TO_THEME
  ↓
Fase 4: Slett legacy-kode
  ↓
Verifiser: WelcomeScreen, Explorer, Report for begge bransje-tags
```

## Akseptansekriterier

- [x] `Project` og `ProjectContainer` har `tags` felt
- [x] Prosjekt med tag "Eiendom - Bolig" viser 7 temaer i WelcomeScreen
- [x] Prosjekt med tag "Eiendom - Næring" viser 5 temaer i WelcomeScreen
- [x] Prosjekt uten tag viser fallback (dagens 6 temaer)
- [x] Explorer tema-chips matcher bransjeprofilen
- [x] Report-seksjoner matcher bransjeprofilen (rekkefølge og navn)
- [x] ReportHero grid fungerer med 5 og 7 temaer
- [x] Tema-toggle i WelcomeScreen → riktige kategorier filtrert i Explorer/Report
- [x] Nye kategorier eksisterer i databasen
- [x] ExplorerOnboarding.tsx er slettet (did not exist in codebase)
- [x] `npm run lint`, `npm test`, `npx tsc --noEmit` passerer
- [ ] Brøset (Eiendom - Bolig) viser riktige 7 temaer live

## Risiko

| Risiko | Sannsynlighet | Tiltak |
|--------|---------------|--------|
| Tags mangler i types/queries | **Bekreftet** | Fase 0 fikser dette |
| POI-er med kategorier som ikke finnes i ny profil | Middels | `buildCategoryToTheme()` + fallback til første tema |
| Report bruker tema-IDer i CATEGORY_DISPLAY_MODE | **Bekreftet** | Legg til nye IDs i map (fallback "editorial" funker midlertidig) |
| ReportHero grid brekker med 7 temaer | **Bekreftet** | Dynamisk grid basert på theme count |
| Eksisterende prosjekter uten tag mister temaer | Lav | Fallback til DEFAULT_THEMES |
| Explorer caps hardkodet per tema-ID | **Bekreftet** | Flytt caps inn i bransjeprofil-definisjonen |
| Supabase types.ts ikke oppdatert etter migrasjon | Middels | Manuell oppdatering i Fase 5 |
| Report override-prioritet udefinert | **Bekreftet** | Fase 0.5: eksplisitt prioritet (reportConfig > bransjeprofil > fallback) |
| `lekeplass` mangler i categories-tabellen | **BUG** | Legges til i Fase 5 migrasjon |
| Gamle tema-IDer i bokmerkede URL-er | Middels | `THEME_ID_ALIASES` mapping i bransjeprofiler.ts |
| `applyExplorerCaps()` signaturendring kaskade | Middels | Oppdater alle kall-steder i Fase 2 |
| `category_slugs` mangler for nye kategorier | Middels | Inkluderes i Fase 5 migrasjon |

## Filer som endres

| Fil | Type endring |
|-----|-------------|
| `lib/types.ts` | Legg til `tags` på Project + ProjectContainer |
| `lib/supabase/queries.ts` | Returner tags fra begge query-funksjoner |
| `lib/themes/bransjeprofiler.ts` | **NY** — profil-definisjoner, resolver, buildCategoryToTheme |
| `lib/themes/default-themes.ts` | Behold som fallback, fjern globale helpers |
| `lib/themes/explorer-caps.ts` | **SLETT** — flytt til bransjeprofil |
| `lib/themes/index.ts` | Oppdater exports |
| `app/for/[customer]/[project]/page.tsx` | Bruk getBransjeprofil() |
| `app/for/[customer]/[project]/explore/page.tsx` | Bruk profil-themes |
| `components/variants/explorer/ExplorerPage.tsx` | Motta themes som prop |
| `components/variants/report/report-themes.ts` | Bruk profil-themes |
| `components/variants/report/report-data.ts` | Oppdater CATEGORY_DISPLAY_MODE |
| `components/variants/report/ReportHero.tsx` | Dynamisk grid for tema-antall |
| `lib/themes/apply-explorer-caps.ts` | Oppdater signatur: ta caps + totalCap som parameter |
| `components/variants/explorer/ExplorerOnboarding.tsx` | **SLETT** |
| `supabase/migrations/XXX_bransjeprofil_categories.sql` | **NY** — nye kategorier + lekeplass bugfix + category_slugs |
