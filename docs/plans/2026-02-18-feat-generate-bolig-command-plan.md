---
title: "feat: Generate Bolig Command — Automated Real Estate Neighborhood Reports"
type: feat
date: 2026-02-18
deepened: 2026-02-18
---

# feat: Generate Bolig Command

## Enhancement Summary

**Deepened on:** 2026-02-18
**Research agents used:** School/kindergarten data sources (Norway), suburban POI discovery patterns, Placy Curator skill analysis

### Key Improvements from Research
1. **Official APIs replace web-research** — NSR/Udir API (skoler), Barnehagefakta API (barnehager), Overpass API (idrett) gir koordinater, er gratis, og krever ingen auth
2. **Max radius må heves i koden** — 7 steder i 6 filer har `.max(2000)` / `max={2000}` som må endres
3. **minRating = 0 for suburbs** — For få POIs i suburbs til å filtrere. Bruk rating kun til sortering/featuring
4. **Distance tiering** — Aldri feature POIs >1500m. "Nabolag" (0-800m), "Nærmiljø" (800-1500m), "Området" (1500-2500m)
5. **Ferskvare-skjerpet for skoler** — Aldri elevtall, aldri karaktersnitt, aldri opptak. Kun: type skole, nærhet, skolevei

### Fixes from Tech Audit (2026-02-18)
6. **6 radius-filer, ikke 3** — alle admin UI-sliders + begge API-validators
7. **Nye kategorier IKKE i GOOGLE_CATEGORY_MAP/ALLOWED_CATEGORIES** — de bypasser Import API
8. **DiscoveredPOI.source type extended** — trenger "nsr" | "barnehagefakta" | "osm"
9. **category_slugs i migrasjon** — SEO-slugs for nye kategorier (NO + EN)
10. **Scoring-fix for institusjonelle POIs** — default score for skoler/barnehager/idrett
11. **Link eksisterende POIs** — lekeplasser/badeplasser innenfor radius
12. **External-ID dedup** — nsr-{OrgNr}, bhf-{id}, osm-{nodeId}, ikke navn-basert
13. **`source` kolonne + external ID kolonner** — `pois.source TEXT`, `pois.nsr_id`, `pois.barnehagefakta_id`, `pois.osm_id` med partial unique indexes for dedup på databasenivå
14. **Parallelliser Steps 5.5-5.7** — `Promise.all` for NSR + Barnehagefakta + Overpass (sparer 2-6s)
15. **Metadata-baserte hooks for skoler/barnehager/idrett** — generer fra API-data, IKKE WebSearch (sparer 1.5-5 min)
16. **Retry + timeout for Overpass** — 1 retry med 5s backoff, `AbortSignal.timeout(30000)` på alle 3 nye fetch-kall
17. **Report-vs-Explorer tema-divergens** — Report bruker per-prosjekt tema-config, Explorer bruker DEFAULT_THEMES. `natur-friluftsliv` finnes kun i Report (bevisst trade-off)
18. **lekeplass cross-product** — flyttes fra fallback `hverdagsbehov` til `barnefamilier` i DEFAULT_THEMES. Påvirker Explorer-visning for alle prosjekter — men lekeplasser vises kun i prosjekter som har dem linked

---

## Overview

Ny Claude Code-kommando `/generate-bolig` som tar boligprosjekt-navn + adresse og automatisk genererer en komplett nabolagsrapport (Report + Explorer) tilpasset boligkjøpere. Fork av `/generate-hotel` med eiendomstilpassede temaer, større radius, og nye kategorier (skole, barnehage, idrett).

**Pilot:** Overvik (Fredensborg Bolig, Ranheim, Trondheim)

## Problem Statement / Motivation

Placy pivoterer til 100% eiendom. Report-produktet er designet for boligutbyggere (Fredensborg, OBOS, Veidekke), men `/generate-hotel` er optimalisert for byhoteller med 800m radius og gjeste-perspektiv. Boligkjøpere bryr seg om andre ting: skoler, barnehager, idrettsanlegg, natur — i en 2-3km "hverdagsradius".

## Proposed Solution

Fork `/generate-hotel` til `/generate-bolig` med:
1. DB-migrasjon for 3 nye kategorier (skole, barnehage, idrett)
2. Kodendringer for å støtte 2500m+ radius (6 steder i 5 filer)
3. 6 bolig-tilpassede temaer (vs 5 hotell-temaer)
4. Offisielle API-integrasjoner for skoler (NSR), barnehager (Barnehagefakta), idrett (Overpass)
5. Beboer-perspektiv i all redaksjonell tekst
6. minRating = 0 og distance tiering for suburban POI-dekning

## Technical Approach

### Architecture

Bygger på eksisterende infrastruktur + 3 nye eksterne API-er:

**Eksisterende (uendret):**
- Import API (`/api/admin/import`) — Google Places + Entur + Bysykkel
- Geocode API (`/api/geocode`) — adresse → koordinater
- Fetch-photos API (`/api/admin/fetch-photos`) — bulk bildehenting
- Revalidate API (`/api/admin/revalidate`) — cache-invalidering
- Supabase REST — alle CRUD-operasjoner

**Nytt — offisielle norske API-er (gratis, ingen auth):**
- **NSR/Udir API** (`data-nsr.udir.no`) — alle registrerte skoler med koordinater
- **Barnehagefakta API** (`barnehagefakta.no/api`) — alle barnehager med radius-søk
- **Overpass API** (`overpass-api.de`) — idrettsanlegg, haller, baner fra OpenStreetMap

### Kodeendringer (7 steder i 6 filer — max radius)

Import API og admin-UI har hardkodet `.max(2000)` / `max={2000}` for radius. Alle 7 steder må heves:

| Fil | Linje | Endring |
|-----|-------|---------|
| `app/api/admin/import/route.ts` | 66 | CircleSchema `.max(2000)` → `.max(3000)` |
| `app/api/admin/import/route.ts` | 82 | Legacy radiusMeters `.max(2000)` → `.max(3000)` |
| `app/api/admin/projects/[id]/route.ts` | 16 | DiscoveryCircleSchema `.max(2000)` → `.max(3000)` |
| `app/admin/projects/[id]/discovery-circles-editor.tsx` | 344 | Slider `max={2000}` → `max={3000}` |
| `app/admin/import/import-client.tsx` | 706 | Slider `max={2000}` → `max={3000}` |
| `app/admin/generate/generate-client.tsx` | 437 | Slider `max={2000}` → `max={3000}` |
| `app/admin/projects/[id]/import-tab.tsx` | 752 | Slider `max={2000}` → `max={3000}` |

### Implementation Phases

#### Phase 1: Database + kodeendringer

**1a. Migrasjon:** `supabase/migrations/NNN_bolig_categories.sql`

```sql
BEGIN;

-- Step 1: Nye kategorier for boligrapporter
INSERT INTO categories (id, name, icon, color) VALUES
  ('skole', 'Skole', 'GraduationCap', '#f59e0b'),
  ('barnehage', 'Barnehage', 'Baby', '#f59e0b'),
  ('idrett', 'Idrettsanlegg', 'Trophy', '#f59e0b')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Source-kolonne for data governance (hvilken API en POI kommer fra)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_pois_source ON pois(source);

-- Backfill eksisterende POIs
UPDATE pois SET source = 'google' WHERE google_place_id IS NOT NULL AND source IS NULL;
UPDATE pois SET source = 'entur' WHERE entur_stopplace_id IS NOT NULL AND source IS NULL;
UPDATE pois SET source = 'bysykkel' WHERE bysykkel_station_id IS NOT NULL AND source IS NULL;

-- Step 3: External ID-kolonner med partial unique indexes (dedup på databasenivå)
ALTER TABLE pois ADD COLUMN IF NOT EXISTS nsr_id TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS barnehagefakta_id TEXT;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS osm_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_nsr_id ON pois(nsr_id) WHERE nsr_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_barnehagefakta_id ON pois(barnehagefakta_id) WHERE barnehagefakta_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pois_osm_id ON pois(osm_id) WHERE osm_id IS NOT NULL;

-- Step 4: SEO-slugs for nye kategorier (norsk + engelsk)
INSERT INTO category_slugs (category_id, locale, slug, seo_title) VALUES
  ('skole', 'no', 'skoler', 'Skoler i nærheten'),
  ('skole', 'en', 'schools', 'Nearby Schools'),
  ('barnehage', 'no', 'barnehager', 'Barnehager i nærheten'),
  ('barnehage', 'en', 'kindergartens', 'Nearby Kindergartens'),
  ('idrett', 'no', 'idrettsanlegg', 'Idrettsanlegg i nærheten'),
  ('idrett', 'en', 'sports-facilities', 'Nearby Sports Facilities')
ON CONFLICT (category_id, locale) DO NOTHING;

COMMIT;
```

**Migrasjonsnotat:** `ALTER TABLE ADD COLUMN IF NOT EXISTS` er metadata-only i PostgreSQL (nullable kolonne) — ingen table rewrite, ingen lock. Partial unique indexes sikrer at re-import ikke skaper duplikater. `UPDATE` backfill er safe — kun NULL-rader berøres.

**1b. Max radius hevet i 6 steder** (se tabell ovenfor)

**1c. Oppdater tema-system:**

- [ ] Opprett migrasjonsfil med neste ledige nummer
- [ ] Kjør migrasjon via psql mot produksjon
- [ ] Verifiser at kategoriene eksisterer i databasen
- [ ] Oppdater `lib/themes/default-themes.ts` — legg til `barnefamilier`-tema med skole, barnehage, idrett, lekeplass. Flytt `lekeplass` fra fallback (`hverdagsbehov`) til `barnefamilier`. **NB: cross-product effekt** — endrer Explorer-visning for alle prosjekter, men lekeplasser vises kun der de er linked.
- [ ] Legg til `barnefamilier` i `lib/themes/explorer-caps.ts` med cap 15
- [ ] **IKKE legg til `natur-friluftsliv` i DEFAULT_THEMES** — dette ville flytte `park`/`outdoor` fra `kultur-opplevelser` og brekke hotel Explorer. `natur-friluftsliv` eksisterer kun i per-prosjekt Report-config. **Bevisst trade-off:** Report og Explorer viser ulike tema-grupperinger for boligprosjekter.
- [ ] Extend `DiscoveredPOI.source` type i `lib/generators/poi-discovery.ts` linje 30 og 473 med `"nsr" | "barnehagefakta" | "osm"`. Oppdater også `determineSource()` i `lib/generators/story-writer.ts` linje 25.
- [ ] Oppdater `POIImportData` type i `lib/supabase/mutations.ts` med `source?: string`, `nsr_id?: string`, `barnehagefakta_id?: string`, `osm_id?: string`
- [ ] IKKE oppdater `GOOGLE_CATEGORY_MAP` eller `ALLOWED_CATEGORIES` — skole/barnehage/idrett er IKKE Google Places-typer. De kommer fra NSR/Barnehagefakta/Overpass og bypasser Import API.
- [ ] Hev max radius fra 2000 til 3000 i alle 6 steder (5 filer)
- [ ] Verifiser at `getThemeForCategory('skole')` returnerer `barnefamilier`
- [ ] Kjør `npx tsc --noEmit` — ingen typefeil
- [ ] Kjør `npm test` — alle tester passerer

#### Phase 2: Kommando — `.claude/commands/generate-bolig.md`

Fork av `generate-hotel.md` med følgende endringer:

**Boligprofil (erstatter byhotell-profil):**

```json
{
  "googleCategories": [
    "restaurant", "cafe", "bar", "bakery", "supermarket", "pharmacy",
    "gym", "park", "museum", "library", "shopping_mall", "movie_theater",
    "hair_care", "spa"
  ],
  "officialAPIs": {
    "skoler": "NSR/Udir API — data-nsr.udir.no",
    "barnehager": "Barnehagefakta API — barnehagefakta.no/api",
    "idrett": "Overpass API — overpass-api.de"
  },
  "perCityRadius": {
    "Trondheim": 2500,
    "Oslo": 2000,
    "Bergen": 2000,
    "default": 2500
  },
  "minRating": 0,
  "maxResultsPerCategory": 20,
  "featureMaxDistance": 1500
}
```

**6 Report-temaer (erstatter 5 hotell-temaer):**

```json
[
  {
    "id": "hverdagsliv",
    "name": "Hverdagsliv",
    "icon": "ShoppingCart",
    "categories": ["supermarket", "pharmacy", "shopping", "haircare", "bank", "post"],
    "color": "#22c55e"
  },
  {
    "id": "barnefamilier",
    "name": "Barn & Oppvekst",
    "icon": "GraduationCap",
    "categories": ["skole", "barnehage", "lekeplass", "idrett"],
    "color": "#f59e0b"
  },
  {
    "id": "mat-drikke",
    "name": "Mat & Drikke",
    "icon": "UtensilsCrossed",
    "categories": ["restaurant", "cafe", "bar", "bakery"],
    "color": "#ef4444"
  },
  {
    "id": "natur-friluftsliv",
    "name": "Natur & Friluftsliv",
    "icon": "Trees",
    "categories": ["park", "outdoor", "badeplass"],
    "color": "#10b981"
  },
  {
    "id": "transport",
    "name": "Transport & Mobilitet",
    "icon": "Bus",
    "categories": ["bus", "train", "tram", "bike", "parking", "carshare", "taxi"],
    "color": "#3b82f6"
  },
  {
    "id": "trening-velvare",
    "name": "Trening & Velvære",
    "icon": "Dumbbell",
    "categories": ["gym", "spa", "swimming"],
    "color": "#ec4899"
  }
]
```

**Pipeline (16 steg):**

**Steg 1: Geocode adresse** — identisk med hotel

**Steg 2: Opprett/finn kunde** — utled utbygger-navn (spør bruker)
- "Overvik" → spør: "Utbygger-navn?" → "Fredensborg Bolig" → slug: "fredensborg-bolig"

**Steg 3: Opprett prosjekt** — med bolig-radius i discovery_circles, `venueType = "residential"`

**Steg 4: Opprett produkter** — Report med bolig-temaer + Explorer

**Steg 5: Google Places POI Discovery** — med bolig-kategorier, minRating=0, radius per by

**Steg 5.5: Skoler via NSR/Udir API (NYTT)**

```
1. Hent kommunenummer fra geocode-resultat (Trondheim = 5001)
2. GET https://data-nsr.udir.no/enheter/kommune/{kommuneNr}
3. Filtrer på NaceKode1:
   - 85.201 = Grunnskole (barneskole + ungdomsskole)
   - 85.310 = Videregående, allmennfag
   - 85.320 = Videregående, yrkesfag
4. Filtrer på ErAktiv = true
5. Beregn avstand fra prosjektsentrum — behold kun innenfor radius
6. Bruk GeoKvalitet-feltet — re-geocode via Mapbox hvis kvalitet er lav
7. Opprett POI med category_id = 'skole', source = 'nsr'
8. Insert via Supabase REST med dedup på external_id = 'nsr-{OrgNr}' (IKKE navn-basert dedup)
```

**Forventet resultat for Overvik:** Ranheim skole, Vikåsen skole, Charlottenlund ungdomsskole, Markaplassen skole, Solbakken skole m.fl.

**Steg 5.6: Barnehager via Barnehagefakta API (NYTT)**

```
1. GET https://www.barnehagefakta.no/api/Location/radius/{lat}/{lng}/0.025
   (0.025 grader ≈ 2.5km radius)
2. For hvert resultat:
   - Koordinater: koordinatLatLng[0] = lat, koordinatLatLng[1] = lng
   - Navn: navn
   - Metadata: eierform (Kommunal/Privat), alder, antallBarn
3. Beregn eksakt avstand — behold kun innenfor radius
4. Opprett POI med category_id = 'barnehage', source = 'barnehagefakta'
5. Insert via Supabase REST med dedup på external_id = 'bhf-{id}' (IKKE navn-basert dedup)
```

**Forventet resultat for Overvik:** 10-15 barnehager (Ranheimsfjæra, Grilstad Fus, Sjøskogbekken, Charlottenlund, Vikåsen m.fl.)

**Steg 5.7: Idrettsanlegg via Overpass API (NYTT)**

```
1. Beregn bounding box: center ± 0.025 grader
2. POST https://overpass-api.de/api/interpreter
   data=[out:json][timeout:25];(
     way["leisure"="sports_centre"]({bbox});
     node["leisure"="sports_centre"]({bbox});
     way["leisure"="pitch"]["sport"~"soccer|football|handball|tennis|basketball"]({bbox});
     way["leisure"="swimming_pool"]({bbox});
   );out center;
3. Filtrer: kun med navn (ignorer anonyme pitches)
4. Beregn avstand — behold innenfor radius
5. Opprett POI med category_id = 'idrett', source = 'osm'
6. Insert via Supabase REST med dedup på external_id = 'osm-{nodeId/wayId}' (IKKE navn-basert dedup)
```

**Forventet resultat for Overvik:** EXTRA Arena, Ranheimshallen, Charlottenlundhallen, Vikåsenhallen, diverse baner

**Performance: Parallelliser 5.5 + 5.6 + 5.7 med `Promise.all`**
```typescript
// Tre uavhengige API-kall til tre ulike servere — kjør parallelt
const [schools, kindergartens, sports] = await Promise.all([
  discoverSchoolsFromNSR(kommuneNr, center, radius),        // ~1-2s
  discoverKindergartensFromBarnehagefakta(center, radius),   // ~1-2s
  discoverSportsFromOverpass(center, radius),                // ~2-5s
]);
// Parallelt: 2-5s total. Sekvensielt ville vært 4-9s.
```

**Feilhåndtering for alle 3 nye API-kall:**
- `AbortSignal.timeout(30000)` på alle fetch-kall (30s client timeout)
- Overpass: 1 retry med 5s backoff ved HTTP 429/500 eller timeout
- Graceful degradation: hvis et API feiler etter retry, logg warning og fortsett med 0 POIs fra den kilden

**Checkpoint:** Vis alle funne skoler/barnehager/idrettsanlegg med avstand. Spør bruker om bekreftelse.

**Steg 5.8: Link eksisterende POIs innenfor radius (NYTT)**

```
Overvik har allerede 97 POIs (buss, lekeplasser, badeplasser).
1. Query alle eksisterende POIs innenfor radius fra prosjektsentrum
2. Filtrer på kategorier som er relevante for bolig-temaer (lekeplass, badeplass, park, outdoor)
3. Link disse til prosjektets produkter (Report + Explorer)
4. Viktig: lekeplass → barnefamilier-tema, badeplass → natur-friluftsliv-tema
```

**Steg 6: Link POIs til produkter** — identisk med hotel

**Steg 7: POI-scoring + featured-markering** — med suburban tilpasning:
- `minRating = 0` (ingen filtrering)
- Aldri feature POI >1500m fra sentrum
- Maks 2 featured fra samme kategori per tema (identisk med hotel)
- **Scoring for ikke-Google POIs:** Skoler, barnehager, idrettsanlegg har ingen `googleRating`/`googleReviewCount`. Scoring-formelen gir maks 0.5 (kun proximityBonus). For featured-markering av barnefamilier-tema: sett `google_rating=4.0, google_review_count=10` som default for institusjonelle POIs (skole, barnehage, idrett), slik at de kan features basert på nærhet OG en baseline score.
- Google-baserte POIs: scoring-formel uendret: `rating × min(reviews/50, 1.0) + proximity_bonus(0-0.5)`

**Steg 8: Product categories** — identisk med hotel

**Steg 9: Google Photos** — identisk med hotel (skoler/barnehager/idrett får ikke Google-bilder)

**Steg 10: Editorial hooks med beboer-perspektiv (tospråklig)**

**Performance-optimisering: 3-tier prosessering**

Steg 10 er den dominerende tidskostnaden (4-9s per POI med WebSearch). Med 50-110 non-transport POIs tar dette 4-16 minutter. Optimaliser med 3 tiers:

| Tier | POI-type | Metode | Tid per POI |
|------|----------|--------|-------------|
| **Tier 1 (instant)** | Skoler, barnehager, idrett | Generer fra API-metadata — INGEN WebSearch | <0.5s |
| **Tier 2 (skip)** | POIs med eksisterende editorial_hook | Hopp over | 0s |
| **Tier 3 (slow)** | Kommersielle POIs uten hooks | WebSearch + AI-generering | 4-9s |

**Estimert total:** Tier 1 (20-33 POIs × 0.5s = 10-17s) + Tier 3 (30-70 POIs × 6s = 3-7 min) = **3-8 min** (ned fra 4-16 min).

**Tier 1 — Metadata-baserte hooks (skoler/barnehager/idrett):**

Disse POIs har strukturert data fra API-ene (type, eierform, avstand). Generer hooks direkte fra metadata med en template-funksjon — ingen WebSearch nødvendig.

For skoler (fra NSR-data):
```
editorialHook: Type skole + etableringsår (hvis kjent) + nabolagskontekst
  "Ranheim skole er en 1-10-skole med lang tradisjon i bydelen. 800 meter gangavstand fra Overvik."
localInsight: Praktisk for foreldre — skolevei, SFO, aktivitetstilbud
  "Trygg skolevei via gang- og sykkelsti. SFO med utendørsaktiviteter i Ranheimsfjæra."

FERSKVARE-FORBUD for skoler:
  ❌ Elevtall (endres årlig)
  ❌ Karaktersnitt / nasjonale prøver
  ❌ Ledig kapasitet / opptak
  ❌ Spesifikke lærere eller rektor
  ✅ Type skole (1-7, 1-10, ungdomsskole, videregående)
  ✅ Etableringsår
  ✅ Gangavstand
  ✅ Skolevei-kvalitet
  ✅ SFO/AKS (at det finnes, ikke detaljer)
```

For barnehager (fra Barnehagefakta-data):
```
editorialHook: Eierform + aldersgruppe + nabolagskontekst
  "Kommunal barnehage for barn 1-5 år. Ligger i rolige omgivelser nær Ranheimsfjæra."
localInsight: Praktisk for foreldre — beliggenhet, uteområde
  "Stort uteområde med nærhet til sjøen. Kort vei fra Overvik."

FERSKVARE-FORBUD for barnehager:
  ❌ Antall barn / ledige plasser
  ❌ Spesifikke ansatte
  ❌ Opptakskriterier
  ✅ Eierform (kommunal/privat)
  ✅ Aldersgruppe (1-5, 3-5)
  ✅ Beliggenhet og nabolagskontekst
```

For idrettsanlegg (fra Overpass-data):
```
editorialHook: Type anlegg + hva det tilbyr
  "Ranheimshallen er bydelens idrettshall med plass til håndball, basketball og turn."
localInsight: Praktisk — tilgjengelighet, aktiviteter
  "Åpent for organisert idrett og drop-in. Populært blant familier i bydelen."
```

**Tier 3 — WebSearch-baserte hooks (kommersielle POIs):**

For kommersielle POIs (restaurant, kafé, butikk, gym):
```
Perspektiv: "Slik er hverdagen i dette nabolaget" (beboer, ikke gjest)
Tone: Monocle/Kinfolk via Placy Curator-skill (register: nabolag/område)
Regel: Aldri ferskvare (priser, åpningstider, menyer)
```

**Steg 11: Report-intro + bridgeText per tema (tospråklig)**

heroIntro-mal for bolig:
```
"[Prosjektnavn] ligger [beskrivelse av beliggenhet]. [Nabolagskvalitet 1] og [kvalitet 2]
gjør dette til et attraktivt sted å bo — med [praktisk fordel] i hverdagen."

Eksempel Overvik:
"Overvik ligger mellom Trondheimsfjorden og Estenstadmarka, på høyden over Ranheim.
Sjønær med turstier rett utenfor døren, og alt du trenger i hverdagen innen kort avstand."
```

bridgeText-mal per tema — nabolagskarakter, ikke cherry-picking:
```
Mat & Drikke: "Ranheim har en voksende kaféscene langs fjæra, med dagligvare og bakeri
i gangavstand. Fra [anker 1] til [anker 2] — hverdagsmat og helgekos."

Barn & Oppvekst: "Bydelen har et godt utvalg skoler og barnehager, med trygge skoleveier
og idrettsanlegg i nabolaget. Fra [nærmeste skole] til [idrettshall]."
```

**Steg 12: Revalidate cache** — identisk med hotel

**Steg 13: QA-sjekk** — utvidet for 6 temaer:
```
QA-sjekk:
✅ POI-dekning: 6/6 temaer har POI-er (totalt XX)
  - Hverdagsliv: X POIs
  - Barn & Oppvekst: X skoler, X barnehager, X idrettsanlegg, X lekeplasser
  - Mat & Drikke: X POIs
  - Natur & Friluftsliv: X POIs
  - Transport: X POIs
  - Trening & Velvære: X POIs
✅ Bilder: X/X featured POI-er har bilde
✅ Tekst: X/X POI-er har editorialHook
✅ Report-tekster: heroIntro + 6/6 bridgeTexts
✅ Oversettelser: X/X EN translations lagret
```

**Steg 14: Natur & Friluftsliv-berikelse via WebSearch**

```
Søk etter:
1. "{bydel} tursti marka" — finn tursti-innganger
2. "{bydel} badeplass strand" — bekreft eksisterende badeplasser
3. "{bydel} park grøntområde" — finn parker vi mangler
4. Opprett POIs med category_id = park/outdoor/badeplass
```

Badeplasser finnes allerede i området (97 eksisterende POIs inkluderer 5 badeplasser). Steg 14 beriker med tursti-innganger og eventuelle parker Google Places ikke fant.

**Steg 15: Link nye POIs + revalidate**
- Link Steg 14-POIs til produkter
- Revalidate cache
- Vis endelig oppsummering med alle URL-er

**Steg 16: Oppsummering**
```
Prosjekt opprettet!
Kunde: Fredensborg Bolig (fredensborg-bolig)
Prosjekt: Overvik (overvik)
POIs: XX totalt (X restaurant, X skole, X barnehage, ...)
Featured: X POIs
Temaer: 6/6 med POIs

Report: http://localhost:3000/fredensborg-bolig/overvik/report
Explorer: http://localhost:3000/fredensborg-bolig/overvik/explore
Admin: http://localhost:3000/admin/projects/{shortId}
```

- [ ] Opprett `.claude/commands/generate-bolig.md` med alle 16 steg
- [ ] Boligprofil med 6 temaer, minRating=0, per-by radius, featureMaxDistance=1500
- [ ] Steg 1-4: Fork fra hotel med bolig-parametere
- [ ] Steg 5: Google Places Discovery med bolig-kategorier og minRating=0
- [ ] Steg 5.5-5.7: NSR + Barnehagefakta + Overpass parallelt med `Promise.all` (NYTT)
- [ ] Steg 5.5: NSR/Udir API for skoler — dedup på `nsr_id`, AbortSignal.timeout(30s)
- [ ] Steg 5.6: Barnehagefakta API for barnehager — dedup på `barnehagefakta_id`, AbortSignal.timeout(30s)
- [ ] Steg 5.7: Overpass API for idrettsanlegg — dedup på `osm_id`, 1 retry + 5s backoff
- [ ] Steg 5.8: Link eksisterende lekeplass/badeplass POIs innenfor radius (NYTT)
- [ ] Steg 6-9: Fork fra hotel
- [ ] Steg 10: Editorial hooks — Tier 1 (metadata-basert for skoler/bhg/idrett), Tier 3 (WebSearch for kommersielle)
- [ ] Steg 11: Report-intro med bolig-perspektiv
- [ ] Steg 12-13: Fork fra hotel (6 temaer i QA)
- [ ] Steg 14: Natur-berikelse via WebSearch
- [ ] Steg 15-16: Link + oppsummering

#### Phase 3: Pilot — Overvik

Kjør `/generate-bolig "Overvik" "Presthusvegen 45, Ranheim, Trondheim"` og verifiser:

- [ ] Geocode → 63.42, 10.51 (Ranheim)
- [ ] Kunde: "Fredensborg Bolig" (slug: fredensborg-bolig)
- [ ] Prosjekt: overvik (slug: overvik)
- [ ] Google Places: 15-45 kommersielle POIs (forventet suburban yield)
- [ ] NSR: 5-8 skoler innenfor 2500m
- [ ] Barnehagefakta: 10-15 barnehager innenfor 2500m
- [ ] Overpass: 5-10 idrettsanlegg innenfor 2500m
- [ ] Eksisterende POIs: 97 (buss, lekeplasser, badeplasser) allerede i området
- [ ] Total: 80-150 POIs fordelt på alle 6 temaer
- [ ] Editorial hooks: Beboer-perspektiv, tidløs info, ferskvare-fri
- [ ] Report vises korrekt på `localhost:3000/fredensborg-bolig/overvik/report`
- [ ] Explorer vises korrekt på `localhost:3000/fredensborg-bolig/overvik/explore`
- [ ] Alle 6 temaer har POIs
- [ ] Visuell sjekk via Chrome DevTools MCP

## Acceptance Criteria

### Functional Requirements

- [ ] `/generate-bolig "Navn" "Adresse"` genererer komplett Report + Explorer
- [ ] 3 nye kategorier (skole, barnehage, idrett) fungerer i systemet
- [ ] NSR API finner skoler med koordinater
- [ ] Barnehagefakta API finner barnehager med radius-søk
- [ ] Overpass API finner idrettsanlegg
- [ ] 6 bolig-temaer vises korrekt i Report
- [ ] Editorial hooks bruker beboer-perspektiv (ikke gjeste)
- [ ] Tospråklig (NO + EN) for alle tekster
- [ ] QA-sjekk verifiserer alle 6 temaer
- [ ] Max radius 3000m fungerer i import API

### Non-Functional Requirements

- [ ] Pipeline kjører uten manuell intervensjon (bortsett fra checkpoints)
- [ ] Repeterbart: kan kjøres for ethvert norsk boligprosjekt
- [ ] Eksisterende `/generate-hotel` forblir uendret og fungerende
- [ ] Offisielle API-er (NSR, Barnehagefakta) gir mer pålitelige data enn web-research

### Quality Gates

- [ ] `npm run lint` — 0 errors
- [ ] `npx tsc --noEmit` — ingen typefeil
- [ ] `npm test` — alle tester passerer
- [ ] Migrasjon kjørt og verifisert mot produksjon
- [ ] Overvik-rapport visuelt verifisert via screenshot
- [ ] `npm run build` — bygger uten feil

## Dependencies & Risks

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| NSR API nede / endret | Lav | Ingen skoler i rapport | Fallback til WebSearch. AbortSignal.timeout(30s) |
| Barnehagefakta API nede / endret | Lav | Ingen barnehager i rapport | Fallback til WebSearch. AbortSignal.timeout(30s) |
| NSR koordinater har lav GeoKvalitet | Medium | Feilplasserte skoler på kart | Re-geocode via Mapbox for GeoKvalitet < 3 |
| Google Places gir få resultater i Ranheim | Høy (forventet) | Tynt Mat & Drikke-tema | minRating=0 + aksepter at suburbs har færre kommersielle steder |
| Overpass API timeout/ratelimit | Lav | Ingen idrettsanlegg | timeout=25, retry 1x med 5s backoff, graceful degradation |
| Nye kategorier påvirker eksisterende rapporter | Lav | Uventet UI-endring | Nye kategorier brukes kun i bolig-temaer. `lekeplass` flyttes til `barnefamilier` (cross-product effekt, men kun synlig der lekeplasser er linked) |
| Import API budget (circles × categories ≤ 60) | Lav | Blokkert import | 1 circle × 14 kategorier = 14 (godt innenfor) |
| Duplikat-POIs ved re-import | Medium | Doble entries | Partial unique indexes på `nsr_id`, `barnehagefakta_id`, `osm_id` — database-nivå dedup |
| Report vs Explorer tema-divergens | Lav (designvalg) | Ulik gruppering | Dokumentert som bevisst trade-off. Report bruker per-prosjekt config, Explorer bruker DEFAULT_THEMES |
| Scoring nær null for ikke-Google POIs | Medium | Aldri featured | Default score (google_rating=4.0, google_review_count=10) for institusjonelle POIs |
| Editorial hooks tar 4-16 min | Medium | Lang pipeline | 3-tier prosessering: metadata-hooks for skoler/bhg/idrett (sparer 1.5-5 min) |

## Success Metrics

1. Overvik-rapport er visuelt imponerende nok til å vise Fredensborg Bolig
2. Rapporten har minst 80 POIs fordelt på alle 6 temaer
3. Barn & Oppvekst-tema har minst 15 POIs (skoler + barnehager + idrett + lekeplasser)
4. Hele pipelinen tar under 30 minutter å kjøre
5. Pipelinen kan gjenbrukes for neste boligprosjekt uten endringer

## References & Research

### Internal References
- Eksisterende pipeline: `.claude/commands/generate-hotel.md`
- Import API: `app/api/admin/import/route.ts` (radius-validering linje ~66)
- POI Discovery: `lib/generators/poi-discovery.ts`
- Scoring: `lib/utils/poi-score.ts`
- Tema-definisjoner: `lib/themes/default-themes.ts`
- Slugify: `lib/utils/slugify.ts`
- Translations: `lib/supabase/translations.ts`
- Curator-skill: `.claude/skills/curator/SKILL.md`
- Brainstorm: `docs/brainstorms/2026-02-18-generate-bolig-overvik-brainstorm.md`

### Institutional Learnings
- Scoring + featured: `docs/solutions/feature-implementations/generate-hotel-scoring-featured-capping-20260206.md`
- Generate-hotel pipeline: `docs/solutions/feature-implementations/generate-hotel-quality-upgrade-20260206.md`
- Ferskvare-regel: `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md`
- Idempotent backfill: `docs/solutions/feature-implementations/idempotent-backfill-patterns-supabase-20260215.md`
- Sub-category splitting: `docs/solutions/feature-implementations/report-subcategory-splitting-20260210.md`

### External Data Sources (Research Findings)
- **NSR/Udir API:** `https://data-nsr.udir.no/` — Nasjonalt Skoleregister. Gratis, ingen auth. Koordinater med GeoKvalitet-indikator. NACE-koder: 85.201 (grunnskole), 85.310/85.320 (vgs). Filtrér ErAktiv=true.
- **Barnehagefakta API:** `https://www.barnehagefakta.no/api/` — Radius-søk: `/Location/radius/{lat}/{lng}/{radiusInDegrees}`. 0.025° ≈ 2.5km. Returnerer koordinatLatLng, navn, eierform, alder, antallBarn. Gratis, ingen auth.
- **Overpass API:** `https://overpass-api.de/api/interpreter` — OpenStreetMap-data. Query: `leisure=sports_centre`, `leisure=pitch`, `leisure=swimming_pool`. Bounding box format. Gratis, rate limit ~10k/dag.
- **Swagger docs:** NSR: `data-nsr.udir.no/swagger`, Barnehagefakta: `barnehagefakta.no/swagger`
