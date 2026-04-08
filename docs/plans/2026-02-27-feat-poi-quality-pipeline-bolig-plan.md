---
title: "feat: POI Quality Pipeline for Bolig"
type: feat
date: 2026-02-27
deepened: 2026-02-27
audited: 2026-02-27
---

# POI Quality Pipeline for Bolig

## Enhancement Summary

**Deepened on:** 2026-02-27
**Tech audit:** 2026-02-27 — YELLOW → mitigations applied
**Research agents:** LLM batch classification, geo-dedup algorithms, Google Places types reliability, edge case review

### Key Improvements from Research
1. **business_status-sjekk lagt til** — permanently closed POI-er passerte alle filtre (kritisk gap)
2. **Confidence-score på LLM-validering** — unngår false positives på tvetydige navn ("Park" er et restaurantnavn)
3. **Few-shot prompts med norske eksempler** — Haiku trenger kulturell kontekst for norske merkenavn
4. **Avstandstak differensiert** — shopping/sykehus har høyere tak fordi folk kjører dit
5. **Rejection logging** — audit trail for alle avviste POI-er, kritisk for feilsøking
6. **LLM fallback ved API-nedetid** — pipeline fortsetter med kun grovfiltre

### Key Corrections from Tech Audit
7. **LLM-filtre som Claude Code command-steg** — ikke Anthropic SDK (følger eksisterende mønster)
8. **Per-kategori minimum safety valve** — relakserer filtre når kategori < 2 POI-er
9. **Word-boundary matching** for navn-mismatch (unngår false positives på "Transport" restaurant)
10. **Kun `CLOSED_PERMANENTLY` hard-rejects** — `CLOSED_TEMPORARILY` lar trust-systemet håndtere
11. **Accumulator-parameter** for rejection logging (bryter ikke return-type)
12. **Co-lokaliserte tester** — `poi-quality.test.ts` (ikke `__tests__/`)

---

## Overview

Google Places-data i forstadsområder er full av søppel — feilkategoriserte bedrifter, duplikater, hjemmekontorer, og irrelevante POI-er. Hotell-generatoren slipper unna fordi 800m radius + minRating 3.5 naturlig filtrerer dette. Bolig-prosjekter (2000-2500m radius, minRating 0) trenger et dedikert kvalitetsfilter.

**Mål:** Neste bolig-demo skal være salgbar uten manuell opprydding.

## Problem Statement

Fra Overvik-demoen (153 POI-er):

| Problem | Eksempel | Rotårsak |
|---------|----------|----------|
| Feilkategori | "Brilliance Cleaning" = Restaurant | Google `types[]` er upresis i suburbia |
| Feilkategori | "MT Byggteknikk" = Park | Google returnerer junk for brede kategorier |
| Feilkategori | "Parkering IKEA" = Kjøpesenter | Google `shopping_mall` matcher parkering |
| Duplikat | H2 Frisør + H2 Grilstad Marina | Samme kjede, to Google-oppføringer < 200m |
| Hjemmekontor | Oasen Yoga — privat adresse, 0 reviews | Ingen kvalitetssignaler |
| For langt | Crispy Fried Chicken — 22 min gange | Utenfor relevant hverdagsradius |
| Stengt | (potensielt) Permanentent stengte POI-er | `business_status` ikke sjekket |

## Proposed Solution

**Hybrid: grovfilter ved import + finfilter etter.**

```
Google Places API / Entur / Bysykkel / NSR / etc.
    ↓
┌─ GROVFILTER (import-tid, blokkerer) ─────────────────┐
│  1. business_status-sjekk (CLOSED_PERMANENTLY → avvis)│
│  2. Avstandstak per kategori (billigste sjekk først)  │
│  3. Minimum kvalitetssignaler (reviews ≥ 1 ELLER      │
│     rating finnes, unntatt offentlige kategorier)      │
│  4. Regelbasert navn-kategori-mismatch (word-boundary)│
│  ──────── logging av alle avvisninger ────────        │
│  ──────── safety valve: min 2 per kategori ──────    │
└───────────────────────────────────────────────────────┘
    ↓
  Database (kun pre-filtrerte POI-er)
    ↓
┌─ FINFILTER (post-import, Claude Code command-steg) ──┐
│  5. Claude kategori-validering (batch, med confidence) │
│  6. Claude duplikat-clustering (nærliggende grupper)  │
│  7. Trust score-beregning (eksisterende system)       │
│  ──────── fallback: skip 5+6 ved feil ──────────    │
└───────────────────────────────────────────────────────┘
    ↓
  Ren POI-pool klar for Explorer/Report
```

**Viktige arkitekturbeslutninger fra tech audit:**
- Grovfiltre er pure TypeScript-funksjoner i `poi-quality.ts`, importert av `poi-discovery.ts`
- Finfiltre (LLM) er **Claude Code command-steg** i generate-kommandoen — IKKE programmatiske SDK-kall. Prosjektet har ingen `@anthropic-ai/sdk`-dependency, og all LLM-reasoning følger mønsteret fra editorial hooks (steg 10 i generate-hotel)
- Avstandstak gjelder ALLE kilder (Google, Entur, Bysykkel), men kvalitetssignaler og navn-mismatch gjelder kun Google (andre kilder har autoritativ data)
- Grovfiltre er ekstrahert som standalone pure functions slik at de kan kalles fra alle discovery-funksjoner

### Research Insight: Filter-rekkefølge

Edge case-review avdekket at **billigste filtre bør kjøre først** (avstandstak og business_status er gratis metadata-sjekker). Navn-mismatch-sjekken er dyrere (string-matching) og bør kjøre sist av grovfiltrene.

## Technical Approach

### Phase 1: Grovfilter — Regelbasert (import-tid)

Nye filtreringssteg integrert via `evaluateGooglePlaceQuality()` — en samlet predicate-funksjon som kalles fra `discoverGooglePlaces()`. Alle filter-definisjoner lever i `poi-quality.ts` som pure functions.

**OBS:** `GooglePlaceResult`-interfacet i `poi-discovery.ts` (linje 99-107) må utvides med `business_status?: string` — feltet returneres av Google Nearby Search API men er ikke i nåværende interface.

#### 1.0 business_status-sjekk (NY — fra edge case review)

**Kritisk gap i original plan:** Permanently closed POI-er passerte alle eksisterende filtre.

```typescript
function isBusinessClosed(place: { business_status?: string }): boolean {
  return place.business_status === "CLOSED_PERMANENTLY";
  // CLOSED_TEMPORARILY lar vi gjennom — trust-systemet håndterer det (poi-trust.ts:110-111)
}
```

Google returnerer `business_status` som string: `"OPERATIONAL"`, `"CLOSED_TEMPORARILY"`, `"CLOSED_PERMANENTLY"`. Feltet kan også mangle (= ukjent status, la passere). **Kun `CLOSED_PERMANENTLY` hard-rejects** — `CLOSED_TEMPORARILY` (renovering, sesongstengning) håndteres av trust score (gir lav score, men ikke 0).

- [ ] Legg til `isBusinessClosed()` i `poi-quality.ts`
- [ ] Legg til `business_status?: string` i `GooglePlaceResult` interface (poi-discovery.ts:107)
- [ ] Integrer som FØRSTE sjekk i pipeline (billigst, hardest avvisning)

#### 1.1 Avstandstak per kategori

POI-er som er "teknisk innenfor radius" men for langt til å være relevante for hverdagen.

```typescript
const WALK_METERS_PER_MINUTE = 80;

// Maks gangavstand i minutter per kategori
const MAX_WALK_MINUTES_BY_CATEGORY: Record<string, number> = {
  // Daglige behov — kort avstand
  restaurant: 15,
  cafe: 15,
  bakery: 15,
  supermarket: 15,
  pharmacy: 20,
  haircare: 20,
  lekeplass: 15,
  bus: 10,

  // Ukentlige behov — middels avstand
  bar: 20,
  gym: 20,
  bank: 25,
  post: 25,
  library: 25,
  spa: 25,
  park: 20,
  tram: 20,
  skole: 20,
  barnehage: 20,
  idrett: 25,

  // Bil-destinasjoner — høy avstand (folk kjører dit)
  shopping: 30,    // Kjøpesenter = bil-destinasjon
  cinema: 30,
  museum: 30,
  hospital: 45,    // Alltid relevant
  doctor: 30,
  dentist: 30,
  train: 35,       // Togstasjon = viktig infrastruktur
  badeplass: 30,
};

function isWithinCategoryDistance(
  distanceMeters: number,
  categoryId: string
): boolean {
  const maxMinutes = MAX_WALK_MINUTES_BY_CATEGORY[categoryId] ?? 25;
  const walkMinutes = distanceMeters / WALK_METERS_PER_MINUTE;
  return walkMinutes <= maxMinutes;
}
```

**Research insight:** Shopping, sykehus, og togstasjon er bil-destinasjoner. Avstandstakene er hevet for disse fordi folk kjører dit — 25 min gange = 5 min bil.

- [ ] Legg til `MAX_WALK_MINUTES_BY_CATEGORY` og `isWithinCategoryDistance()` i `poi-quality.ts`
- [ ] Integrer i `discoverGooglePlaces()` som steg 2 (etter business_status, før quality signals)

#### 1.2 Minimum kvalitetssignaler

POI-er uten noen kvalitetssignaler er sannsynligvis hjemmekontorer eller spøkelsesoppføringer.

```typescript
// Kategorier unntatt fra kvalitetssjekk (offentlige tjenester mangler ofte Google-data)
const QUALITY_EXEMPT_CATEGORIES = new Set([
  "park", "library", "museum",  // Offentlige
  "bus", "train", "tram",       // Transport (dekkes av Entur)
  "skole", "barnehage", "idrett", "lekeplass", "badeplass",  // Bolig-spesifikke (dekkes av NSR/Barnehagefakta/Overpass)
]);

function hasMinimumQualitySignals(
  place: GooglePlaceResult,
  categoryId: string
): boolean {
  if (QUALITY_EXEMPT_CATEGORIES.has(categoryId)) return true;

  // Må ha minst ÉN av:
  return (place.user_ratings_total ?? 0) >= 1
      || place.rating !== undefined;
}
```

**Edge case håndtert:** Nye restauranter med 0 reviews blokkeres, men dette er akseptabelt. En nyåpnet restaurant uten en eneste anmeldelse har ikke nok data til å vise i en salgsdemo. LLM-filteret (steg 5) er fallback for edge cases.

- [ ] Legg til `hasMinimumQualitySignals()` i `poi-quality.ts`
- [ ] Utvid `QUALITY_EXEMPT_CATEGORIES` med bolig-kategorier
- [ ] Integrer i `discoverGooglePlaces()` som steg 3

#### 1.3 Navn-kategori mismatch-deteksjon

```typescript
// Ord som ALDRI matcher gitte kategorier
// Dekker norsk (bokmål), engelsk, og vanlige foretaksnavn
const CATEGORY_NAME_BLOCKLIST: Record<string, string[]> = {
  restaurant: [
    "cleaning", "renhold", "vask", "transport", "bygg", "teknikk",
    "regnskap", "advokat", "parkering", "bilverksted", "elektro",
    "rørlegger", "maling", "flyttebyrå", "eiendom",
  ],
  park: [
    "bygg", "teknikk", "auto", "bil", "verksted", "kontor", "regnskap",
    "eiendom", "invest", "holding", "finans",
  ],
  shopping: ["parkering", "parking", "p-hus"],
  cafe: ["cleaning", "renhold", "bygg", "teknikk", "transport"],
  gym: ["kiropraktor", "fysioterapi", "lege", "tannlege", "optiker"],
};

function isNameCategoryMismatch(name: string, categoryId: string): boolean {
  const blocklist = CATEGORY_NAME_BLOCKLIST[categoryId];
  if (!blocklist) return false;

  // Word-boundary matching — splitter på whitespace og sjekker hele ord
  // Unngår false positives: "Transport" (restaurant i Oslo) matcher IKKE "transport" i blocklist
  // Fanger fortsatt: "Brilliance Cleaning AS" der "cleaning" er et helt ord
  const words = name.toLowerCase().split(/\s+/);
  return blocklist.some((term) => words.some((word) => word === term || word.startsWith(term)));
}
```

**Research insight + tech audit korreksjon: Word-boundary matching.**

Substring-matching (`includes`) ga false positives:
- "Transport" (kjent Oslo-restaurant) ville blitt avvist fordi "transport" er i restaurant-blocklisten
- "Park Inn" (hotell) ville matche "park"-termer

Word-boundary matching løser dette: splitter navnet på whitespace og sjekker om noen ORD starter med blocklist-termen. `startsWith` fanger "bygg" i "byggteknikk" (sammensetning) men ikke "transport" i "Transportørene" (fordi det er et helt annet ord).

**Gjenværende blindsoner er OK.** LLM-filteret (steg 5) fanger resten. Multi-layer er hele poenget.

- [ ] Opprett `lib/generators/poi-quality.ts` med `isNameCategoryMismatch()`
- [ ] Legg til blocklist med norske + engelske termer
- [ ] Skriv tester for kjente feiltilfeller fra Overvik

#### 1.4 Rejection logging

**Ny fra edge case review.** Uten logging kan vi ikke debugge hvorfor POI-er forsvinner.

```typescript
// Følger eksisterende stats-mønster fra MergeResult.stats og ImportResponse.stats
export interface QualityRejection {
  name: string;
  categoryId: string;
  reason: string;
  filter: "business_status" | "distance" | "quality" | "name_mismatch" | "llm_category" | "llm_duplicate";
}

export interface QualityFilterStats {
  total: number;
  passed: number;
  rejected: number;
  byReason: Record<string, number>;  // følger byCategory-mønsteret
  rejections: QualityRejection[];
}
```

**Accumulator-pattern (bryter ikke return-type):**

```typescript
// discoverGooglePlaces() beholder return type DiscoveredPOI[]
// Rejections samles via optional accumulator — backward-compatible
export async function discoverGooglePlaces(
  config: DiscoveryConfig,
  apiKey: string,
  rejections?: QualityRejection[]  // Optional — kaliere som ikke bryr seg passerer ingenting
): Promise<DiscoveredPOI[]>
```

Logging følger eksisterende emoji-mønster:
```typescript
console.log(`    ⊘ Avvist "${place.name}": ${reason}`);
// Oppsummering etter discovery:
console.log(`\n📊 Kvalitetsfilter: ${total} vurdert, ${passed} bestod, ${rejected} avvist`);
console.log(`   → ${byReason.business_status ?? 0} stengt, ${byReason.distance ?? 0} for langt, ...`);
```

- [ ] Legg til `QualityRejection` og `QualityFilterStats` i `poi-quality.ts`
- [ ] Bruk accumulator-parameter i `discoverGooglePlaces()` (ikke endre return-type)
- [ ] Vis oppsummering i generate-kommando med eksisterende emoji-mønster

#### 1.5 Integrasjon i discovery-pipeline

**Composable filter-funksjon** — holder discovery-loopen ren:

```typescript
// I poi-quality.ts — én funksjon som kjører hele grovfilter-kjeden
export function evaluateGooglePlaceQuality(
  place: { name: string; business_status?: string; user_ratings_total?: number; rating?: number },
  categoryId: string,
  distanceMeters: number,
  rejections?: QualityRejection[]
): { pass: boolean; rejection?: QualityRejection } {
  // 1. business_status (billigst, hardest)
  if (isBusinessClosed(place)) return reject("business_status", ...);
  // 2. Avstandstak per kategori
  if (!isWithinCategoryDistance(distanceMeters, categoryId)) return reject("distance", ...);
  // 3. Minimum kvalitetssignaler
  if (!hasMinimumQualitySignals(place, categoryId)) return reject("quality", ...);
  // 4. Navn-kategori mismatch (dyrest av grovfiltrene)
  if (isNameCategoryMismatch(place.name, categoryId)) return reject("name_mismatch", ...);
  return { pass: true };
}
```

Kalles fra `discoverGooglePlaces()` etter eksisterende filtre:

```typescript
// Eksisterende filtre (behold):
// 1. Distance > config.radius → skip
// 2. Type match (VALID_TYPES_FOR_CATEGORY) → skip
// 3. Rating < minRating → skip

// NY composable sjekk:
const quality = evaluateGooglePlaceQuality(place, category, distance, rejections);
if (!quality.pass) continue;
```

**Avstandstak for ALLE kilder** — ikke bare Google:

`isWithinCategoryDistance()` kalles også fra `discoverEnturStops()` og `discoverBysykkelStations()` for å filtrere transport-POI-er på avstand. Kvalitetssignaler og navn-mismatch gjelder KUN Google (Entur/Bysykkel har autoritativ data).

```typescript
// I discoverEnturStops() — legg til etter distance > config.radius sjekk:
if (!isWithinCategoryDistance(edge.node.distance, category.id)) continue;
```

Reuse `calculateDistance` fra `@/lib/utils/geo` — ikke reimplementer.

- [ ] Opprett `evaluateGooglePlaceQuality()` composable i `poi-quality.ts`
- [ ] Integrer i `discoverGooglePlaces()` som én kall (erstatter 4 inline if/continue)
- [ ] Legg til `isWithinCategoryDistance()` i `discoverEnturStops()` og `discoverBysykkelStations()`
- [ ] Import `calculateDistance` fra `@/lib/utils/geo`

#### 1.6 Per-kategori minimum safety valve (NY — fra tech audit)

**Kritisk gap:** Hvis alle POI-er i en kategori filtreres bort (f.eks. alle 4 suburban restauranter har 0 reviews), rendrer Report en tom "Mat & Drikke"-seksjon. Det er verre enn tvilsomme POI-er.

```typescript
// Etter at grovfiltrene har kjørt: sjekk per-kategori minimum
// Hvis noen kategori har < 2 POI-er, relakser filtre for den kategorien
// (skip kvalitetssignaler, behold kun business_status + distance)
function ensureMinimumPerCategory(
  passed: DiscoveredPOI[],
  rejected: QualityRejection[],
  allPlaces: GooglePlaceResult[],
  minPerCategory: number = 2
): DiscoveredPOI[]
```

- [ ] Implementer `ensureMinimumPerCategory()` i `poi-quality.ts`
- [ ] Kjør etter grovfiltre — redder kategorier som ble for aggressive filtrert
- [ ] Logg advarsel: "⚠️ Relakserte filtre for {kategori} — kun {n} POI-er bestod"

### Phase 2: Finfilter — Claude Code command-steg (post-import)

**Arkitekturbeslutning fra tech audit:** LLM-filtre implementeres som **steg i generate-kommandoen** som Claude Code utfører — IKKE som programmatiske Anthropic SDK-kall. Dette følger det etablerte mønsteret fra editorial hooks (steg 10 i generate-hotel) og krever null nye dependencies.

Etter at POI-er er importert til databasen, utfører Claude Code LLM-validering som pipeline-steg.

#### 2.1 Claude kategori-validering (command-steg)

**Steg i generate-kommandoen** (ikke TypeScript-funksjon):

Claude Code henter alle importerte POI-er fra databasen, vurderer hver batch på 25, og oppdaterer/fjerner de som feiler:

```markdown
### Steg 5a: Kategori-validering (LLM)

Hent alle POI-er som nettopp ble importert:
GET /rest/v1/product_pois?product_id=eq.{explorer_product_id}&select=poi_id,pois(id,name,category_id)

For hver batch på 25 POI-er, vurder:
- Er dette navnet forenlig med kategorien?
- Confidence threshold: 0.85 — kun fjern når du er sikker
- Norske merkenavn: "Peppes" = pizzakjede, "Dromedar" = kafé, "Coop" = dagligvare
- Hvis usikker: BEHOLD

Fjern feilkategoriserte fra product_pois:
DELETE /rest/v1/product_pois?poi_id=eq.{id}&product_id=eq.{product_id}

Logg: "Steg 5a: Fjernet X feilkategoriserte POI-er: [liste]"
```

**Prompt-kontekst for Claude Code:**

```
Regler for kategori-validering:
- Et renholdsfirma er IKKE en restaurant
- Et byggefirma er IKKE en park
- Tvetydige navn: vær forsiktig. "Park" KAN være et restaurantnavn
- Norske merkenavn: "Peppes" = pizzakjede, "Dromedar" = kafé, "Coop" = dagligvare
- Hvis du er usikker, BEHOLD POI-en

Eksempler:
"Brilliance Cleaning" + restaurant → FJERN (renholdsfirma)
"Park Café" + restaurant → BEHOLD (café er spisested)
"MT Byggteknikk" + park → FJERN (byggebransje)
```

- [ ] Legg til steg 5a i generate-hotel.md og generate-bolig.md
- [ ] Batch på 25 POI-er per vurdering
- [ ] Confidence threshold: 0.85 — kun fjern når sikker
- [ ] Few-shot med norske eksempler
- [ ] Logg alle fjerninger

#### 2.2 Claude duplikat-clustering (command-steg)

**To deler: TypeScript pre-filter + Claude Code vurdering.**

**Del 1: `findNearbyGroups()` i `poi-quality.ts`** (pure TypeScript):

```typescript
// Brute force O(n²) med Haversine — ~4ms for 200 POI-er, R-tree er overkill
export function findNearbyGroups(
  pois: Array<{ id: string; name: string; categoryId: string; lat: number; lng: number }>,
  maxDistanceMeters: number = 300
): Array<Array<typeof pois[number]>> {
  // Grupper POI-er som er < maxDistance OG har SAMME categoryId
  // Returner kun grupper med 2+ POI-er
  // Bruker calculateDistance fra @/lib/utils/geo
}
```

**Del 2: Steg 5b i generate-kommandoen** (Claude Code vurderer gruppene):

```markdown
### Steg 5b: Duplikat-clustering (LLM)

Kall findNearbyGroups() for alle importerte POI-er.
For hver gruppe med 2+ nærliggende POI-er, vurder:

- Er noen av disse SAMME virksomhet med ulike Google-oppføringer?
- Behold den med best data (høyest rating × flest reviews)
- Kjeder med flere lokasjoner er IKKE duplikater
- Butikker i kjøpesenter er separate
- Hvis usikker: IKKE marker som duplikat

Fjern duplikater fra DENNE prosjektets product_pois:
DELETE /rest/v1/product_pois?poi_id=eq.{id}&product_id=in.({project_product_ids})

VIKTIG: Slett ALDRI fra pois-tabellen — kun fjern koblingen.
Scope: KUN dette prosjektets product_ids, ikke andre prosjekter.
```

- [ ] Implementer `findNearbyGroups()` i `poi-quality.ts` med brute force Haversine
- [ ] Bruk `calculateDistance` fra `@/lib/utils/geo`
- [ ] Legg til steg 5b i generate-kommandoen
- [ ] Scoped deletion: `product_id IN (current project's products)` — aldri slett fra pois
- [ ] Logg alle dedupliseringer

#### 2.3 Trust score-oppdatering

Eksisterende trust-system (`lib/utils/poi-trust.ts`) kjøres etter LLM-validering. POI-er med `trust_score < 0.5` skjules automatisk av explorer caps.

**Ingen kodeendring nødvendig** — bare sikre at trust-validering kjøres som steg i pipeline.

- [ ] Kjør `calculateHeuristicTrust()` for alle nye POI-er etter import
- [ ] Verifiser at `MIN_TRUST_SCORE = 0.5` filter i `apply-explorer-caps.ts` fungerer

#### 2.4 LLM fallback ved feil (NY — fra edge case review)

Siden LLM-filtrene er Claude Code command-steg (ikke SDK-kall), er "fallback" annerledes: Hvis Claude Code feiler på steg 5a, skal steg 5b fortsatt kjøres (og vice versa). Stegene er uavhengige.

```markdown
### I generate-kommandoen:

Steg 5a og 5b er uavhengige. Hvis ett feiler (f.eks. timeout, API-feil):
- Logg feilen: "⚠️ Steg 5a feilet: [grunn]. Fortsetter med steg 5b."
- Fortsett med neste steg
- Rapporter i QA (steg 5d): "LLM kategori-validering: [kjørt/feilet], LLM dedup: [kjørt/feilet]"
```

- [ ] Steg 5a og 5b er uavhengige — feil i ett blokkerer ikke det andre
- [ ] Logg advarsel ved feil
- [ ] Rapporter i QA-oppsummering: "LLM-validering: [kjørt/feilet]"

### Phase 3: Pipeline-integrasjon i generate-kommando

Legg til kvalitetsstegene i generate-hotel.md (og fremtidig generate-bolig.md) som nye pipeline-steg.

#### Ny pipeline-rekkefølge:

```
Steg 5:  POI Discovery (eksisterende — med nye grovfiltre innebygd)
         → Avviser: closed, for langt, ingen signaler, navn-mismatch
         → Logger alle avvisninger
Steg 5a: LLM kategori-validering (NY) — med fallback
Steg 5b: LLM duplikat-clustering (NY) — med fallback
Steg 5c: Trust score-beregning (eksisterende, men flyttes hit)
Steg 5d: QA-rapport av filtrering (NY)
         → "Import: X POI-er → Grovfilter: -Y → LLM: -Z → Trust: -W → Resultat: N"
Steg 6:  Link POIs to products (eksisterende)
... resten som før
```

- [ ] Oppdater generate-hotel.md med steg 5a-5d
- [ ] Dokumenter at kvalitetsfiltre kjøres MELLOM discovery og linking
- [ ] Legg til QA-rapport som viser filtreringsresultat

### Phase 4: Tester

#### Unit-tester (`lib/generators/poi-quality.test.ts` — co-lokalisert med source)

```typescript
describe("isBusinessClosed", () => {
  it("avviser permanently closed", () => {
    expect(isBusinessClosed({ business_status: "CLOSED_PERMANENTLY" })).toBe(true);
  });
  it("godtar temporarily closed (trust-systemet håndterer)", () => {
    expect(isBusinessClosed({ business_status: "CLOSED_TEMPORARILY" })).toBe(false);
  });
  it("godtar operational", () => {
    expect(isBusinessClosed({ business_status: "OPERATIONAL" })).toBe(false);
  });
  it("godtar missing status (ukjent)", () => {
    expect(isBusinessClosed({})).toBe(false);
  });
});

describe("isNameCategoryMismatch", () => {
  // Positive cases (should match = mismatch detected)
  it("avviser renholdsfirma som restaurant", () => {
    expect(isNameCategoryMismatch("Brilliance Cleaning", "restaurant")).toBe(true);
  });
  it("avviser byggefirma som park", () => {
    expect(isNameCategoryMismatch("MT Byggteknikk", "park")).toBe(true);
  });
  it("avviser parkeringsplass som kjøpesenter", () => {
    expect(isNameCategoryMismatch("Parkering IKEA Leangen", "shopping")).toBe(true);
  });
  it("avviser norsk renholdsfirma", () => {
    expect(isNameCategoryMismatch("Renholdsservice AS", "restaurant")).toBe(true);
  });

  // Negative cases (should NOT match = legitimate POI)
  it("godtar ekte restaurant", () => {
    expect(isNameCategoryMismatch("Pizzapizza", "restaurant")).toBe(false);
  });
  it("godtar ekte park", () => {
    expect(isNameCategoryMismatch("Estenstadmarka", "park")).toBe(false);
  });
  it("godtar norsk kafé", () => {
    expect(isNameCategoryMismatch("Dromedar Kaffebar", "cafe")).toBe(false);
  });
  it("ignorerer kategorier uten blocklist", () => {
    expect(isNameCategoryMismatch("Whatever Corp", "bus")).toBe(false);
  });
});

describe("hasMinimumQualitySignals", () => {
  it("avviser POI uten rating og reviews", () => {
    expect(hasMinimumQualitySignals({}, "restaurant")).toBe(false);
  });
  it("godtar POI med rating", () => {
    expect(hasMinimumQualitySignals({ rating: 4.0, user_ratings_total: 5 }, "restaurant")).toBe(true);
  });
  it("godtar POI med kun reviews", () => {
    expect(hasMinimumQualitySignals({ user_ratings_total: 3 }, "restaurant")).toBe(true);
  });
  it("unntar park fra kvalitetssjekk", () => {
    expect(hasMinimumQualitySignals({}, "park")).toBe(true);
  });
  it("unntar skole fra kvalitetssjekk", () => {
    expect(hasMinimumQualitySignals({}, "skole")).toBe(true);
  });
});

describe("isWithinCategoryDistance", () => {
  it("avviser restaurant 22 min unna", () => {
    expect(isWithinCategoryDistance(1760, "restaurant")).toBe(false);
  });
  it("godtar sykehus 30 min unna", () => {
    expect(isWithinCategoryDistance(2400, "hospital")).toBe(true);
  });
  it("godtar kjøpesenter 25 min unna (bil-destinasjon)", () => {
    expect(isWithinCategoryDistance(2000, "shopping")).toBe(true);
  });
  it("avviser busstopp 12 min unna", () => {
    expect(isWithinCategoryDistance(960, "bus")).toBe(false);
  });
  it("bruker default 25 min for ukjent kategori", () => {
    expect(isWithinCategoryDistance(1900, "unknown")).toBe(true);
  });
});

describe("findNearbyGroups", () => {
  it("grupperer POI-er innen 300m med samme kategori", () => {
    // H2 Frisør og H2 Grilstad Marina — begge haircare, < 200m
  });
  it("grupperer IKKE POI-er med ulik kategori", () => {
    // Restaurant og frisør på samme adresse — ulik kategori
  });
  it("grupperer IKKE POI-er > 300m fra hverandre", () => {
    // To restauranter 500m fra hverandre
  });
});
```

- [ ] Skriv unit-tester for alle 5 filterfunksjoner (business_status + 4 fra original plan)
- [ ] Skriv tester for kjente Overvik-problemer (regresjonstester)
- [ ] Kjør `npm test` — alle tester passerer

## Acceptance Criteria

### Grovfiltre
- [ ] `isBusinessClosed()` avviser `CLOSED_PERMANENTLY` (ikke `CLOSED_TEMPORARILY`)
- [ ] `isWithinCategoryDistance()` filtrerer Crispy Fried Chicken (22 min restaurant)
- [ ] `isWithinCategoryDistance()` beholder shopping/sykehus med høyere avstandstak
- [ ] `isWithinCategoryDistance()` gjelder ALLE kilder (Google, Entur, Bysykkel)
- [ ] `hasMinimumQualitySignals()` filtrerer Oasen Yoga (0 reviews)
- [ ] `hasMinimumQualitySignals()` unntar offentlige kategorier (park, skole, etc.)
- [ ] `isNameCategoryMismatch()` fanger Brilliance Cleaning, MT Byggteknikk, Parkering IKEA
- [ ] `isNameCategoryMismatch()` bruker word-boundary matching (ikke substring)
- [ ] `evaluateGooglePlaceQuality()` composable funksjon kaller alle grovfiltre
- [ ] `ensureMinimumPerCategory()` relakserer filtre når kategori < 2 POI-er
- [ ] Alle avvisninger logges via accumulator-parameter (bryter ikke return-type)
- [ ] `GooglePlaceResult` interface oppdatert med `business_status?: string`

### LLM-filtre (Claude Code command-steg)
- [ ] Steg 5a: Kategori-validering fanger edge cases grovfilteret misser
- [ ] Steg 5b: Duplikat-clustering fanger H2 Frisør / H2 Grilstad Marina
- [ ] Steg 5b: Beholder kjeder med flere lokasjoner
- [ ] Steg 5b: Scoped deletion — kun dette prosjektets product_pois
- [ ] Steg 5a og 5b er uavhengige — feil i ett blokkerer ikke det andre

### Integrasjon
- [ ] Grovfiltre integrert via `evaluateGooglePlaceQuality()` i `discoverGooglePlaces()`
- [ ] Avstandstak integrert i `discoverEnturStops()` og `discoverBysykkelStations()`
- [ ] LLM-filtre lagt til som steg 5a-5d i generate-kommandoen
- [ ] QA-rapport viser filtreringsresultat (import → grovfilter → LLM → trust → resultat)
- [ ] Unit-tester for alle filterfunksjoner (co-lokalisert)
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit` passerer

## Filer som berøres

| Fil | Endring |
|-----|---------|
| `lib/generators/poi-quality.ts` | **NY** — grovfiltre, `evaluateGooglePlaceQuality()`, `findNearbyGroups()`, `ensureMinimumPerCategory()`, `QualityRejection`, `QualityFilterStats` |
| `lib/generators/poi-discovery.ts` | Integrer `evaluateGooglePlaceQuality()` i discovery-loop + legg til `business_status?: string` i `GooglePlaceResult` + avstandstak i Entur/Bysykkel |
| `lib/generators/poi-quality.test.ts` | **NY** — co-lokaliserte tester for alle filtre |
| `.claude/commands/generate-hotel.md` | Legg til steg 5a-5d i pipeline |

## Risiko

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Grovfilter for aggressivt — fjerner ekte POI-er | Medium | Mister gode POI-er | Rejection logging + spot-check |
| LLM returnerer feil JSON | Lav | Ingen validering | 2-tier parsing + retry |
| LLM false positive (avviser legitimt) | Lav | Fjerner gyldig POI | Confidence threshold 0.85 |
| Haiku mangler norsk kulturkontekst | Medium | Avviser norske merkenavn | Few-shot med Peppes/Dromedar/Coop |
| LLM API nede | Lav | Ingen LLM-filtrering | Graceful degradation, kun grovfiltre |
| Avstandstak for stramt i noen byer | Medium | For få POI-er | Per-kategori-tak, ikke global |
| Duplikat-deteksjon merger kjeder | Lav | Fjerner legitime lokasjoner | Eksplisitt "kjeder ≠ duplikater" i prompt |

## Estimert kostnad

| Komponent | Kostnad per prosjekt |
|-----------|---------------------|
| Grovfiltre | $0 (lokal kode) |
| LLM kategori-validering (150 POI / 6 batches) | ~$0.03 |
| LLM duplikat-clustering (5-15 grupper / 1 batch) | ~$0.005 |
| **Total** | **~$0.035 per prosjekt** |

## Referanser

- Brainstorm: `docs/brainstorms/2026-02-27-poi-quality-pipeline-bolig-brainstorm.md`
- Eksisterende trust-system: `lib/utils/poi-trust.ts`
- Google Places junk-filtrering: `docs/solutions/api-integration/google-places-junk-results-filtering-20260208.md`
- Multi-pass dataarbeid: `docs/solutions/best-practices/multi-pass-data-reclassification-20260216.md`
- POI trust validation: `docs/solutions/feature-implementations/poi-trust-validation-pipeline-20260208.md`
- Google Places API types reliability: [Google Developer Docs](https://developers.google.com/maps/documentation/places/web-service/place-types)
- LLM batch classification: Haiku 4.5 pricing $1/$5 per 1M tokens
- Geo-dedup: Brute force Haversine + Jaro-Winkler (100-200 POI-er, <10ms)
