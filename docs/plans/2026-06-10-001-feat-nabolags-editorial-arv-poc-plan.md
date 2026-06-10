---
title: "feat: Nabolags-editorial-arv PoC — slice 1 (Ranheim)"
type: feat
status: completed
date: 2026-06-10
origin: docs/brainstorms/2026-06-10-nabolags-editorial-arv-requirements.md
---

# feat: Nabolags-editorial-arv PoC — slice 1 (Ranheim)

## Overview

Bevis tesen «kuratér nivå 2-innhold én gang per nabolag, arv det per adresse» ved å:
(1) lagre kuratert `ReportThemeEditorial` per område i den eksisterende `areas`-tabellen
(med håndtegnet Ranheim-polygon i `areas.boundary`), (2) la `create-report`-pipelinen slå
opp nabolag via point-in-polygon og arve editorial inn i prosjektets
`products.config.reportConfig.themes[].editorial` med highlight-fallback mot det faktiske
board-settet, (3) kjøre trust-scoring som automatisk pipeline-steg slik at read-time-filteret
som allerede finnes faktisk biter, og (4) evaluere mot pre-registrert falsifiseringsrubrikk
på 3 varians-maksimerende Ranheim-adresser.

## Problem Frame

Nivå 2 (kuratert drill-in per kategori) krever i dag manuell `editorial`-fylling per
prosjekt — det skalerer ikke per adresse. Strategien er kjede-først i Trondheim-regionen
der Andreas har reell QA-evne. Holder arv-tesen, er «nivå 2 på alle adresser» et bounded
kurateringsarbeid (~30–50 nabolag), ikke uendelig per-adresse-arbeid. Full kontekst:
origin-dokumentet (`docs/brainstorms/2026-06-10-nabolags-editorial-arv-requirements.md`).

PoC-ens formål er **internt tese-bevis** — ingen demo-polish, latens-krav eller
selvbetjening (se origin: Scope Boundaries).

*Begrepsnote: «provisjonering» og «generering» brukes synonymt i dette dokumentet — begge
betyr én kjøring av `create-report`-pipelinen for én adresse.*

## Requirements Trace

Fra origin-dokumentet:

- R1. Nabolag = navngitt område med polygon-grense (kun Ranheim i slice 1)
- R2. Koordinater → nabolag via point-in-polygon; utenfor → nivå 1-fallback
- R3. Editorial lagres per nabolag × kategori (body + highlight-kandidater + valgfritt bilde)
- R4. Generering arver nabolagets editorial for kuraterte kategorier
- R5. Ranheim kurateres for alle relevante kategorier (LLM-draft, Andreas godkjenner)
- R6. Highlights utenfor adressens board skal aldri gi tomme/døde chips
- R7. Erstatning kun fra kuratert kandidatliste (prioritert rekkefølge), ellers dropp
- R8. Trust-validering som automatisk genererings-steg
- R9. Årsaks-logging per droppet/erstattet highlight
- Suksesskriterier: 3 varians-maksimerende adresser, falsifiseringsrubrikk pre-registrert,
  kurateringstidsbruk logges, ingen død POI synlig

## Scope Boundaries

- Kun Ranheim, ett polygon — resten av nabolagene er slice 2/3
- Ingen regional POI-base / spatial-oppslag — dagens per-adresse-import beholdes
- Ingen demo-flate, selvbetjening eller latens-arbeid
- Ingen crawl/innsiktskart — Ranheim kurateres fra egen kunnskap + åpne kilder
- Ingen endring i `adaptCategory`/render-stien — runtime silent-drop forblir som safety net;
  all fallback-logikk skjer ved provisjonering

### Deferred to Separate Tasks

- Regional trust-validert POI-base + spatial-oppslag → slice 2
- Crawl av megler-annonser → bydels-innsiktskart → eget arbeidsløp
- `/generer`-flate mot rapport-board → slice 3
- Trainee-/megler-vedlikeholdt kurateringslag → produkt-/avtale-spor
- Klassifiseringssjekk i trust-pipelinen (feilkategoriserte POIer) → slice 2-kandidat,
  mates av manuell QA-funn fra denne PoC-en
- Late-binding av highlights via `google_place_id` → vurderes i slice 2 hvis
  ID-bootstrap-modellen (provisjoner først, kuratér etterpå) viser seg upraktisk

## Context & Research

### Relevant Code and Patterns

- `scripts/provision-rapport.ts` — orkestrator for `npm run create-report` (7 steg);
  nye pipeline-steg følger konvensjonen: eget `lib/pipeline/`-modul, options-objekt inn,
  `{ ...counts, warnings: string[] }` ut
- `lib/pipeline/create-report-project.ts` — `createReportProject()` + `buildReportConfig()`;
  skriver i dag kun `{id, name, icon, categories, color, leadText}` per tema (ingen editorial)
- `lib/pipeline/report-defaults.ts` — `REPORT_THEME_DEFAULTS` (6 bolig-temaer:
  hverdagsliv, barn-oppvekst, mat-drikke, natur-friluftsliv, transport, trening-aktivitet)
- `lib/pipeline/hydrate-report.ts` — Steg 5; highlight-resolusjon må skje ETTER denne
- `lib/utils/poi-trust.ts` — `calculateHeuristicTrust()`, `batchValidateTrust()`,
  `MIN_TRUST_SCORE = 0.5`; `lib/supabase/mutations.ts` — `updatePOITrustScore()`
- `lib/supabase/queries.ts` — `filterTrustedPOIs()` (read-time-filter, «null = vis») er
  allerede i rapport-stien via `getProjectContainerFromSupabase()`
- `lib/utils/school-zones.ts` — `pointInPolygon()`/`pointInGeometry()` (ray-cast,
  Polygon/MultiPolygon) — modul-private, ekstraheres til delt util
- `lib/utils/geo.ts` — `calculateDistance()` (haversine), `isValidCoordinates()`
- `supabase/migrations/050_areas_hierarchy_strok.sql` — `areas` med `parent_id`,
  `level (city/bydel/strok)`, `boundary JSONB`, `postal_codes TEXT[]`; Trondheim seedet
  med 31 strøk
- `scripts/apply-curation-staging.ts` — gullmønsteret for JSONB read-modify-write:
  GET config → spread-merge per tema → PATCH med `updated_at`-optimistisk lås
- `components/variants/report/board/board-data.ts` — `adaptCategory` resolver
  `highlightPoiIds` mot `theme.allPOIs` (filtrert sett), ukjente IDer droppes stille;
  tester i `board-data.test.ts` pinner oppførselen — skal IKKE endres
- `components/variants/report/report-data.ts` — `transformToReportData()` bygger det
  filtrerte board-settet (kategori-caps, child-merging, skolekrets-filter)
- Migrasjonsnummerering: siste er `068`; duplikater finnes på 044/048 — bruk 069+;
  kjøres via psql direkte (CLAUDE.md), aldri `supabase db push`

### Institutional Learnings

- `docs/solutions/feature-implementations/placy-basic-tier-drill-in-20260608.md` —
  gating-kontrakten (body ELLER ≥1 resolverbar highlight; ellers nivå 1), tier-konsistens
  (får én kategori editorial bør alle ha det), og highlight-gotchaen: IDer må overleve det
  FILTRERTE board-settet (kategori-caps, child-merge, skolekrets) — dette bet på Teknostallen
- `docs/solutions/logic-errors/trust-filter-missing-report-data-layer-20260208.md` —
  trust-filtrering hører i delt data-lag; ALDRI løs ved å slette/unlinke fra `project_pois`;
  «null = vis» er bevisst bakoverkompatibilitet
- `docs/solutions/architecture-patterns/area-hierarki-strok-eiendom-20260409.md` —
  beslutning: utvid `areas`, ikke ny tabell; `boundary` er reservert nettopp for
  polygon-matching
- `docs/solutions/database-issues/jsonb-merge-vs-overwrite-seed-scripts-20260413.md` —
  aldri overskriv config-JSONB; read-modify-write med spread-merge; `config` kan være
  lagret som jsonb ELLER JSON-streng — skriveren må detektere og bevare formen
- `docs/solutions/ui-bugs/poi-ids-heterogeneous-not-uuid-20260428.md` — POI-IDer er
  heterogene strenger (`google-ChIJ…`, `bus-…`, `entur-NSR-…`); aldri UUID-validering;
  resolusjonsfeil må være HØYLYTTE i pipeline (to lag med silent-fail finnes allerede)
- `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md` —
  ingen forgjengelige fakta i kuratert tekst; forsterkes når én tekst serverer mange adresser
- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — build-time
  LLM → lagret output → eksplisitt cache-bust er det etablerte mønsteret

## Key Technical Decisions

- **Gjenbruk `areas`, ikke ny tabell** (løser R1-spørsmålet): Ranheim-polygonet lagres i
  `areas.boundary` (WGS84 GeoJSON — ingen UTM-konvertering nødvendig for håndtegnet
  polygon), kuratert editorial i ny kolonne `areas.report_editorial JSONB` keyet per
  tema-id. Følger dokumentert arkitektur-beslutning fra migrasjon 050. Slice 1 bruker én
  rad (Ranheim, `level='strok'` — eksisterende rad hvis seedet, ellers ny).
- **Kopiér-ved-generering, ikke dynamisk resolve** (løser R3/R4-spørsmålet): arvet
  editorial merges inn i prosjektets `products.config` ved provisjonering. Holder
  render-stien urørt og gjør hvert board til et evaluerbart snapshot. Re-sync = re-kjør
  arve-steget med `--update`. Ranheim-kurateringen FRYSES før de tre test-genereringene
  (FYI fra doc-review) så sammenligningen er eple-mot-eple.
- **Highlight-fallback resolver mot det EKTE board-settet** (løser R7-spørsmålet):
  arve-steget kjører ETTER hydrering og bruker samme query+transform-kodesti som boardet
  (`getProductFromSupabase(customerSlug, projectSlug, "report")` →
  `transformToReportData(project)` — merk: transformen tar et ferdig montert `Project`,
  ikke containeren; `getProductFromSupabase` er mellomleddet som gjør product-filtrering)
  til å beregne hvilke POIer som faktisk overlever filtrene — aldri en replikert
  filter-kopi som kan drifte. Per tema:
  gå gjennom kurator-prioritert kandidatliste, ta de første (inntil 3) som overlever, logg
  årsak per droppet kandidat (R9: utenfor radius / ikke importert / under trust /
  filtrert bort). Ingen kandidat overlever → ingen highlights for temaet (body kan fortsatt
  bære drill-in per gating-kontrakten).
- **R8 = scoring ved provisjonering, ikke nytt filter**: read-time `filterTrustedPOIs()`
  finnes allerede; gapet er at POI-ene aldri scores (`trust_score = null` → vis). Nytt
  pipeline-steg kaller `batchValidateTrust()` + `updatePOITrustScore()` in-process (ikke
  HTTP-løkke — scriptet har service-role-tilgang). **Scoring avgrenses til POIer med
  `google_place_id`** — heuristikken er designet for kommersielle Google-POIer; offentlige
  kilde-POIer (NSR-skoler, barnehager, Overpass-idrett, Entur/bysykkel) har ingen website
  og ville scoret 0.45 (< `MIN_TRUST_SCORE` 0.5) og blitt masse-skjult. De beholder `null`
  («null = vis», dokumentert bakoverkompatibilitet). Steget må inkludere routens Place
  Details-enrichment-fase (`fetchPlaceDetails` med `TRUST_ENRICHMENT_FIELDS`) for
  Google-POIer som mangler trust-signaler — Steg 4-importen nuller `google_website`/
  `business_status` eksplisitt (`lib/pipeline/import-pois.ts`), så uten enrichment scorer
  alt `no_website`. Avhengighet: `GOOGLE_PLACES_API_KEY`. Ingen unlinking fra
  `project_pois` (dokumentert beslutning). Google-POIer som forblir null etter
  scoring-feil rapporteres HØYLYTT med liste — **presedens mot suksesskriteriet «ingen
  synlig død POI»: et board telles ikke som evaluert før stillNull-listen er QA-klarert**
  (hver listet POI manuelt verifisert levende). Gate-garantien gjelder scorede POIer;
  QA dekker resten.
- **Alle 6 bolig-temaer kurateres for Ranheim** (løser R5-spørsmålet): tier-konsistens-
  regelen fra drill-in-dokumentet sier at delvis editorial gir inkonsistent
  chevron-affordans. Kilde-miks: egen kunnskap (primær) + Gemini-grounding + Wikipedia;
  ingen forgjengelige fakta; body skrives highlight-agnostisk (navngir ikke konkrete
  highlight-POIer, siden chips varierer per adresse — residual-funn fra doc-review).
- **Kurateringsformat = staging-JSON i repo + apply-script**: følger
  `apply-curation-staging.ts`-mønsteret. LLM-draft skjer build-time i Claude Code-sesjon
  (i tråd med LLM-reglene), Andreas redigerer staging-fila, script laster opp til `areas`.

## Open Questions

### Resolved During Planning

- Hvor lagres nabolaget? → Eksisterende `areas`-tabell + ny `report_editorial`-kolonne
  (se Key Technical Decisions; dokumentert prior beslutning om å utvide `areas`)
- Arv-mekanisme? → Kopiér-ved-generering med JSONB-merge og optimistisk lås
- Eksakt R7-fallback-regel og plassering? → Provisjoneringstid, mot ekte board-sett via
  delt transform-kodesti; kandidatliste i kurator-rekkefølge; inntil 3 survivors
- R8-kobling og terskel? → In-process scoring-steg mellom enrich og hydrate;
  `MIN_TRUST_SCORE = 0.5` (eksisterende konstant); nulls etter feil rapporteres høylytt,
  vises (bevisst bakoverkompatibilitet), fanges av manuell QA
- Kategorier for Ranheim? → Alle 6 bolig-temaer. NB: dette er en planleggings-beslutning
  som oppgraderer R5s «alle relevante kategorier» til «alle 6», begrunnet i
  tier-konsistens-regelen (delvis editorial gir inkonsistent chevron-affordans). Viser
  kurateringen at et tema er genuint irrelevant for Ranheim, tas beslutningen opp igjen
  eksplisitt — ikke stille delvis kuratering. Kilde-miks avgjort

- Ranheim-raden? → Finnes allerede: `areas.id = 'ranheim'` (`level='strok'`, parent
  `ostbyen`, postnumre 7053–7056) seedet i `050_areas_hierarchy_strok.sql` linje 66, uten
  boundary. `boundary`-kolonnen har ingen konsumenter i koden i dag, så håndtegnet polygon
  på denne raden er trygt. Unit 5 oppdaterer eksisterende rad; «ellers ny rad»-grenen utgår

### Deferred to Implementation

- Eksakt feltform i `report_editorial`-JSONB (navnevalg, om `note` per kandidat trengs) —
  avgjøres når staging-formatet skrives, Zod-skjema låser formen
- Polygon-koordinatene selv (tegnes av Andreas, f.eks. via geojson.io, under Unit 5)
- Hvor mange highlights per tema som er riktig (start: 3; juster på QA-funn)

## Implementation Units

Faseinndeling: Fase 1 = fundament (Unit 1–3), Fase 2 = arv (Unit 4–5),
Fase 3 = innhold + bevis (Unit 6–7). Rekkefølge = avhengighetsrekkefølge.

### Fase 1 — Fundament

- [x] **Unit 1: Migrasjon — `areas.report_editorial` + delt point-in-polygon-util**

**Goal:** Datamodellen og geo-verktøyet som alt annet bygger på.

**Requirements:** R1, R3 (lagringssiden)

**Dependencies:** Ingen

**Files:**
- Create: `supabase/migrations/069_areas_report_editorial.sql`
- Modify: `lib/utils/geo.ts` (ekstraher `pointInPolygon`/`pointInGeometry` fra
  `lib/utils/school-zones.ts` som delte, eksporterte funksjoner — WGS84-variant uten
  UTM-konvertering)
- Modify: `lib/utils/school-zones.ts` (importer fra geo.ts, slett duplikat — ingen dead code)
- Test: `lib/utils/geo.test.ts`

**Approach:**
- Migrasjon: `ALTER TABLE areas ADD COLUMN report_editorial JSONB` — ingen ny tabell,
  ingen nye RLS-policyer (arver `areas` sine). Kjøres via psql direkte og verifiseres
  med REST-curl per CLAUDE.md-rutinen.
- JSONB-form (retningsgivende): `{ "<theme-id>": { "body": string,
  "highlightCandidates": string[] /* POI-IDer, kurator-prioritert */, "image"?: string } }`
- POI-IDer valideres som ikke-tomme strenger — ALDRI UUID-regex (heterogene IDer)

**Patterns to follow:** `046_generation_requests.sql` (migrasjonsform),
`lib/utils/school-zones.ts` (ray-cast-implementasjon + eksisterende tester)

**Test scenarios:**
- Happy path: punkt innenfor enkel Polygon → true; utenfor → false
- Edge case: punkt på/nær grense; MultiPolygon med hull; polygon som krysser ingen meridianer (WGS84 lng/lat rett inn)
- Edge case: eksisterende `school-zones.test.ts` passerer uendret etter ekstraksjon

**Verification:** Migrasjon kjørt og verifisert mot prod-DB (kolonnen synlig via REST);
`npm test` grønn inkl. uendrede school-zones-tester.

- [x] **Unit 2: Område-oppslag — `findAreaForPoint`**

**Goal:** Gitt lat/lng, finn `areas`-raden med polygon som inneholder punktet (R2).

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Create: `lib/pipeline/find-area-for-point.ts`
- Test: `lib/pipeline/find-area-for-point.test.ts`

**Approach:**
- Query `areas` der `boundary IS NOT NULL AND report_editorial IS NOT NULL` (kun
  kuraterte områder er relevante for arv), kjør point-in-polygon i TypeScript per rad
- Returner `null` når ingen treffer → kalleren faller til nivå 1 (R2) uten feil
- Flere treff (overlappende polygoner) → velg første og logg advarsel (slice 1 har én rad;
  determinisme holder)
- **Fase 1-spike (gjøres her, FØR Unit 4 startes):** 10-linjers tsx-script som kjører
  `getProductFromSupabase` → `transformToReportData` headless mot et eksisterende prosjekt
  og asserter på POI-settet. `report-data.ts` importerer en `"use client"`-kjede
  (`ReportHeroInsight` → `next/image`/Radix) som aldri er kjørt fra tsx; repoet har
  presedens for Next-runtime-brudd i CLI (`revalidatePath` kaster — dokumentert workaround
  i `enrich-report-pois.ts`). Feiler spiken: ta ekstraksjons-beslutningen (filter-delen til
  delt ren funksjon) EKSPLISITT før Unit 4, og oppdater Scope Boundaries — ekstraksjon er
  en render-sti-endring som må pinnes av eksisterende tester

**Patterns to follow:** `lib/pipeline/create-report-project.test.ts`
(`buildMockSupabase`-mønsteret), `lib/supabase/client` `createServerClient()`

**Test scenarios:**
- Happy path: punkt i Ranheim-polygon → riktig area-rad
- Happy path: punkt utenfor alle polygoner → null (ingen exception)
- Edge case: rad med boundary men uten report_editorial → ekskludert fra oppslaget
- Error path: Supabase-feil → `{ data, error }`-håndtering (kaster aldri), warning returneres

**Verification:** Enhetstester grønne; manuell kjøring med kjent Ranheim-koordinat
returnerer riktig rad.

- [x] **Unit 3: Trust-scoring som pipeline-steg**

**Goal:** Ingen **Google-POI** på et nytt rapport-board har `trust_score = null` ved normal
kjøring — read-time-filteret biter (R8). Offentlige kilde-POIer (NSR/Barnehagefakta/
Overpass/Entur/bysykkel) beholder bevisst `null` og forblir synlige — heuristikken er
designet for kommersielle Google-POIer og ville masse-skjult skoler/barnehager (0.45 < 0.5).

**Requirements:** R8

**Dependencies:** Ingen (parallellt med Unit 1–2 mulig)

**Files:**
- Create: `lib/pipeline/validate-report-trust.ts`
- Modify: `scripts/provision-rapport.ts` (nytt steg mellom Steg 4 enrich og Steg 5 hydrate)
- Test: `lib/pipeline/validate-report-trust.test.ts`

**Approach:**
- Hent prosjektets POIer (`project_pois` → `pois`), **avgrens til POIer med
  `google_place_id`** — offentlige kilde-POIer skippes bevisst og beholder `null`; skip
  også `manual_override` og allerede scorede (samme semantikk som
  `app/api/admin/trust-validate/route.ts`)
- **Enrichment-fase før scoring** (samme som routens): for Google-POIer som mangler
  trust-signaler, hent `fetchPlaceDetails(placeId, key, TRUST_ENRICHMENT_FIELDS)` og
  oppdater pois-raden — Steg 4-importen nuller `google_website`/`business_status`
  eksplisitt, så uten denne fasen scorer alle legitime POIer `no_website` (0.45) og
  filtreres feilaktig. Krever `GOOGLE_PLACES_API_KEY`
- Deretter `batchValidateTrust()` in-process, persistér via `updatePOITrustScore()`
- INGEN unlinking fra `project_pois`/`product_pois` (dokumentert beslutning — filtrering,
  ikke sletting)
- Resultatobjekt: `{ scored, skipped, skippedPublic, stillNull: string[], warnings }` —
  Google-POIer som forblir null (scoring-feil) listes HØYLYTT i orkestrator-output med
  navn; stillNull-listen må QA-klareres før et board telles som evaluert (Unit 7)

**Execution note:** Gjenbruk scoring-logikken fra route-handleren — ikke dupliser
heuristikken; om nødvendig ekstraher delt funksjon slik at route og pipeline-steg
deler kode.

**Patterns to follow:** `app/api/admin/trust-validate/route.ts` (skip-semantikk, batching),
`lib/pipeline/enrich-report-pois.ts` (stage-konvensjon)

**Test scenarios:**
- Happy path: 10 Google-POIer uten score → enrichment + scoring, alle persisteres
- Edge case: **NSR-skole uten website → skippes (ikke scoret), forblir synlig etter
  trust-steget** — masse-skjulings-regresjonen
- Edge case: POI med `manual_override` → aldri re-scoret
- Edge case: allerede scoret POI → skippes (ikke `force` i pipelinen)
- Error path: HEAD-sjekk/enrichment feiler for én POI → den forblir null, listes i
  `stillNull`, steget feiler IKKE hele provisjoneringen
- Integration: etter steget viser `filterTrustedPOIs()`-stien færre POIer når en
  Google-POI scores under 0.5

**Verification:** Provisjonér testprosjekt → ingen Google-null-scores ved normal kjøring;
en kunstig lav-trust-POI vises ikke på boardet; barn-oppvekst-temaet viser fortsatt
skoler/barnehager etter steget.

### Fase 2 — Arv

- [x] **Unit 4: Editorial-arv med highlight-fallback — `inheritAreaEditorial`**

**Goal:** Kjernen i PoC-en: arv nabolagets editorial inn i prosjekt-config med
board-validerte highlights og årsaks-logging (R4, R6, R7, R9).

**Requirements:** R4, R6, R7, R9

**Dependencies:** Unit 1, 2, 3 (trust må være scoret før board-settet beregnes)

**Files:**
- Create: `lib/pipeline/inherit-area-editorial.ts`
- Modify: `scripts/provision-rapport.ts` (nytt steg ETTER Steg 5 hydrate, FØR revalidering)
- Test: `lib/pipeline/inherit-area-editorial.test.ts`

**Approach:**
- `findAreaForPoint(lat, lng)` → ingen treff: logg «nivå 1 — ingen kuratert område»,
  returner uten endring (R2)
- Treff: beregn det EKTE board-settet via samme kodesti som rendering
  (`getProductFromSupabase(customerSlug, projectSlug, "report")` →
  `transformToReportData(project)`) — aldri replikerte filtre. Stegets input må derfor
  inkludere `{ projectId, customerSlug, projectSlug, lat, lng }`
- Per tema i `report_editorial`: gå gjennom `highlightCandidates` i rekkefølge, behold de
  første inntil 3 som finnes i temaets filtrerte POI-sett; logg hver droppet kandidat med
  årsak (R9): `ikke-i-db` / `utenfor-board` (radius/kategori/filtrert) / `under-trust`.
  (Kandidatlistene kurateres med 4–6 per tema — Unit 6 — nettopp som slack for denne
  filtreringen; 3 er visningstaket, ikke kurateringsantallet)
- **Atomisk skriving (alt-eller-ingenting):** beregn survivors for ALLE temaer først,
  deretter ÉN read-modify-write: GET config → spread-merge KUN `editorial`-nøkkelen inn i
  alle aktuelle tema-objekter (grounding/leadText overlever) → én PATCH med
  `updated_at`-optimistisk lås; bevar jsonb-vs-streng-lagringsform. Per-tema-PATCH i løkke
  er forbudt — midt-løkke-feil ville etterlate delvis editorial og bryte tier-konsistensen
- Resultat: `{ areaName, themesInherited, highlights: {kept, dropped: [{id, reason}]},
  warnings }` — printes i orkestrator-oppsummeringen (suksesskriterium 4 avhenger av denne
  loggen)
- `--update`-rekjøring er idempotent: arver på nytt fra gjeldende area-innhold

**Technical design** *(retningsgivende, ikke implementasjonsspesifikasjon)*:
```
inheritAreaEditorial({ projectId, customerSlug, projectSlug, lat, lng }) →
  area = findAreaForPoint(lat, lng)                  // null → return {skipped: true}
  project = getProductFromSupabase(customerSlug, projectSlug, "report")
  board = transformToReportData(project)             // samme sti som rendering
  patches = {}
  for (themeId, curated) in area.report_editorial:   // beregn ALT først
    survivors = curated.highlightCandidates
                  .map(id → board.theme(themeId).allPOIs.has(id) ? keep : drop(reason))
                  .filter(kept).slice(0, 3)
    patches[themeId] = { body, highlightPoiIds: survivors, image? }
  mergeIntoProductConfig(patches)                    // ÉN atomisk read-modify-write
```

**Patterns to follow:** `scripts/apply-curation-staging.ts` (JSONB-merge-gullmønsteret),
`lib/pipeline/hydrate-report.ts` (stage-form), drill-in-dokumentets gating-kontrakt

**Test scenarios:**
- Happy path: område funnet, 3 kandidater overlever → editorial skrevet med 3 highlights
- Happy path: punkt utenfor polygon → config urørt, `skipped: true` (R2)
- Edge case: kandidat finnes i DB men ikke i filtrert board-sett → droppet med årsak
  `utenfor-board` (R9) — dette er Teknostallen-gotchaen
- Edge case: 0 kandidater overlever, body finnes → editorial skrives med tom
  highlight-liste (gating-kontrakten: body alene bærer drill-in)
- Edge case: tema i area-editorial som ikke finnes i prosjektets config → logg advarsel, skip
- Error path: PATCH treffer 0 rader (optimistisk lås) → høylytt feil, ingen stille retry
- Error path: skrivefeil → INGEN temaer skrevet (alt-eller-ingenting) — aldri delvis
  editorial i config
- Integration: etter arv viser `adaptCategory` (uendret) chips for nøyaktig survivors —
  verifisert via eksisterende board-data-tester + ett nytt integrasjonsscenario på config-form

**Verification:** Provisjonér Ranheim-adresse → drill-in synlig på boardet med riktige
chips; orkestrator-loggen viser kept/dropped med årsaker; `board-data.test.ts` uendret grønn.

- [x] **Unit 5: Kurateringsverktøy — staging-format + `curate-area`-script**

**Goal:** Operatør-flyt for å få polygon + kuratert editorial inn i `areas`-raden.

**Requirements:** R1, R3, R5 (verktøysiden)

**Dependencies:** Unit 1

**Files:**
- Create: `scripts/curate-area.ts`
- Create: `data/areas/ranheim.staging.json` (polygon + editorial-staging; starter som mal)
- Modify: `COMMANDS.md` (dokumentér scriptet)
- Test: `lib/pipeline/area-staging.test.ts` (valideringslogikk ekstrahert til lib hvis
  den vokser; ellers scriptnær test av parse/valider)

**Approach:**
- Staging-JSON: `{ name, level: "strok", boundary: <GeoJSON Polygon (WGS84)>,
  report_editorial: { <theme-id>: { body, highlightCandidates, image? } } }`
- Script-flyt: parse + Zod-valider (tema-IDer mot `REPORT_THEME_DEFAULTS`, POI-IDer som
  ikke-tomme strenger, polygon ringer lukket) → `--dry-run` printer plan →
  oppdater eksisterende rad `areas.id = 'ranheim'` (seedet i migrasjon 050, uten boundary)
  med read-modify-write-merge så re-kjøring aldri klobber
- Hjelpe-modus `--list-pois <projectId>[,<projectId>…] --theme <id>`: lister POIer fra
  ett eller flere provisjonerte Ranheim-prosjekter per tema (navn + id + trust + avstand)
  som kandidat-meny for kuratering. Tar FLERE prosjekt-IDer og viser unionen — kandidat-
  universet skal ikke begrenses til én adresses radius (se Unit 6-bootstrap)
- Norsk konsoll-output, `--dry-run`, env-sjekk, readline-bekreftelse — script-konvensjonene

**Patterns to follow:** `scripts/provision-rapport.ts` (CLI-konvensjoner),
`scripts/apply-curation-staging.ts` (merge + optimistisk lås)

**Test scenarios:**
- Happy path: gyldig staging-fil → validering passerer, dry-run printer korrekt plan
- Error path: ukjent tema-id → høylytt valideringsfeil med temanavn
- Error path: tom/UUID-formatert POI-id-antakelse → strengvalidering aksepterer
  `google-ChIJ…`/`bus-…`-former, avviser tom streng
- Edge case: re-kjøring mot eksisterende rad → merge, ikke overskriv (boundary beholdes
  når staging kun endrer editorial)

**Verification:** `npx tsx scripts/curate-area.ts --dry-run` viser plan; etter kjøring har
`areas`-raden boundary + report_editorial (verifisert via REST-curl).

### Fase 3 — Innhold og bevis

- [x] **Unit 6: Ranheim-kuratering (innholdsarbeid)**

**Goal:** Alle 6 bolig-temaer kuratert for Ranheim, godkjent av Andreas, med tidslogging.

**Requirements:** R5 + suksesskriteriet om kurateringskostnad

**Dependencies:** Unit 4, 5 (og 2–3 provisjonerte, spredte Ranheim-adresser for
POI-ID-bootstrap — se Approach)

**Files:**
- Modify: `data/areas/ranheim.staging.json` (det faktiske innholdet)

**Approach:**
- Bootstrap: provisjonér **2–3 spredte punkter** i polygonet (gammel kjerne + fjæra-
  utbyggingen + nær kanten) FØR kuratering — kandidat-menyen er UNIONEN av deres boards
  (`--list-pois` med flere prosjekt-IDer). Én enkelt bootstrap-adresse ville begrense
  kandidatuniverset til hennes radius og strukturelt konfundere evalueringen (kandidater
  nær kant-adressen ville aldri vært tilgjengelige). POI-ene deles i DB, så merkostnaden
  er kun kjøretid
- Polygon: Andreas tegner Ranheim-grensen (f.eks. geojson.io), lim inn i staging
- Draft: Claude drafter body per tema i curator-stemme fra egen-kunnskap-notater +
  grounding/Wikipedia-fakta — build-time i sesjon, aldri runtime-LLM
- Regler: ingen forgjengelige fakta; body highlight-agnostisk (navngir ikke chips-POIer);
  3–5 setninger per tema; kandidatlister i kurator-prioritert rekkefølge med 4–6 kandidater
  per tema (slack for per-adresse-filtrering)
- Tidslogging per tema: draft / redigering / highlight-valg + polygon-tegning — føres i
  PoC-notatet (Unit 7)
- KURATERING FRYSES etter godkjenning, før test-genereringene

**Test scenarios:** Test expectation: none — innholdsarbeid; kvalitetsgaten er Andreas'
godkjenning per tema + Unit 5-valideringen.

**Verification:** `areas`-raden har godkjent editorial for alle 6 temaer; tidslogg finnes;
staging-fila committet.

- [x] **Unit 7: PoC-evaluering — falsifiseringsrubrikk + 3 adresser**

**Goal:** Tese-dommen: generér 3 varians-maksimerende adresser og evaluer mot
pre-registrert rubrikk.

**Requirements:** Alle suksesskriterier i origin-dokumentet

**Dependencies:** Unit 1–6

**Files:**
- Create: `docs/brainstorms/2026-06-10-nabolags-editorial-arv-poc-funn.md`
  (rubrikk FØRST, deretter funn — samme dokument viser at rubrikken kom før genereringene)

**Approach:**
- Pre-registrer rubrikken FØR genereringene (fra origin-dokumentets suksesskriterier):
  (i) body nevner sted/kvalitet som er irrelevant/misvisende for ≥1 adresse,
  (ii) ≥1 kategori per board krever per-adresse-omskriving, (iii) fallback-rate over
  terskel (sett konkret tall i rubrikken, f.eks. >50% droppede kandidater per board) —
  der drop-årsaken «kandidat utenfor bootstrap-dekning» skilles fra tese-relevante drops,
  og proximity-drevne temaer (transport: nærmeste-5-holdeplasser) vurderes separat,
  (iv) død/feilklassifisert POI synlig (skill gate-funn fra manuell QA-funn — R8-splitten;
  stillNull-listen fra trust-steget må være QA-klarert før boardet telles som evaluert)
- Generér 3 adresser: én gammel kjerne, én ny bydel (fjæra-utbyggingen), én nær
  polygon-kanten; pluss én kontrollkjøring UTENFOR polygonet (verifiser ren nivå
  1-degradering, R2). Kontrollen er et TILLEGG til suksesskriteriets 3 adresser — den
  evaluerer R2-fallback, ikke tesen
- Per board: QA mot rubrikken, dokumentér kept/dropped-loggene (R9-output), noter alt som
  krevde manuelt inngrep
- Konklusjon: tesen holder / holder med justeringer / falsifisert — med slice 2-input

**Test scenarios:** Test expectation: none — evalueringsarbeid; rubrikken ER testen.

**Verification:** Funn-dokumentet komplett med rubrikk, 3+1 kjøringer, R9-logger,
tidsdata fra Unit 6, og eksplisitt tese-konklusjon.

## System-Wide Impact

- **Interaction graph:** `scripts/provision-rapport.ts` får to nye steg (trust-scoring,
  editorial-arv); rekkefølgen enrich → trust → hydrate → arv → revalidate er bærende.
  Render-stien (`report-data.ts`, `board-data.ts`) endres IKKE.
- **Error propagation:** Begge nye steg er fail-soft (warnings, ikke abort) — UNNTATT
  optimistisk-lås-feil ved config-skriving, som skal feile høylytt. Null-trust etter
  scoring-feil degraderer til dagens oppførsel (vis + manuell QA).
- **State lifecycle risks:** Config-merge må bevare grounding/leadText/eksisterende
  editorial (jsonb-merge-læringen); `areas`-upsert må bevare boundary ved editorial-bare
  oppdateringer. Re-kjøring (`--update`) er idempotent.
- **API surface parity:** `areas.report_editorial` leses kun av pipelinen i slice 1 —
  ingen API-/render-flater eksponerer den direkte. Eksisterende `trust-validate`-route
  beholdes uendret (deler scoring-funksjoner med det nye steget).
- **Integration coverage:** Det kritiske kryss-laget er provisjonerings-skrevet config →
  uendret `adaptCategory`-rendering; dekkes av Unit 4s integrasjonsscenario + manuell
  board-verifisering i Unit 7.
- **Unchanged invariants:** `adaptCategory`-gating og silent-drop (pinnet av
  `board-data.test.ts`); `filterTrustedPOIs()` «null = vis»; `project_pois` som delt
  POI-pool (ingen sletting); Explorer-stien urørt.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Nabolags-kuraterte highlights dør ofte i per-adresse-filtrene (dokumentert Teknostallen-gotcha, forsterket per adresse) | Fallback resolver mot EKTE board-sett via delt kodesti; 4–6 kandidater per tema; R9-logging gjør utfallet målbart i stedet for usynlig |
| `transformToReportData` fra pipeline-kontekst kan ha skjulte runtime-avhengigheter (`"use client"`-importkjede, cache, env) | Eksplisitt Fase 1-spike i Unit 2 (FØR Unit 4); feiler den, tas ekstraksjons-beslutningen åpent med scope-oppdatering — IKKE replikér filtre |
| Config-merge klobber grounding/eksisterende nøkler | Gullmønsteret (én atomisk read-modify-write + spread + optimistisk lås) + test-scenario som pinner at grounding overlever |
| Håndtegnet polygon har annen granularitet enn seedet Ranheim-strøk | Ranheim-raden finnes (050, uten boundary, ingen boundary-konsumenter i dag) — håndtegnet polygon settes på eksisterende rad uten å påvirke andre `areas`-konsumenter |
| Trust-scoring forlenger provisjoneringstiden | PoC-akseptabelt (ingen latens-krav); batching + domene-dedup finnes allerede i `batchValidateTrust` |
| Dev-cache skjuler config-endringer under verifisering | Avslutt alltid med revalidate-steget (finnes); ved lokal verifisering: restart dev-server eller `/api/revalidate?tag=…` (dokumentert gotcha) |

## Documentation / Operational Notes

- `COMMANDS.md` oppdateres med `curate-area`-scriptet (Unit 5)
- Migrasjon 069 kjøres mot prod-DB via psql-rutinen og verifiseres — del av /work-fasen
  per CLAUDE.md
- PoC-funn-dokumentet (Unit 7) er leveransen som avgjør slice 2 — og mater
  business-loggen (kjede-pitch-grunnlag)

## Sources & References

- **Origin document:** docs/brainstorms/2026-06-10-nabolags-editorial-arv-requirements.md
- Related code: `scripts/provision-rapport.ts`, `lib/pipeline/create-report-project.ts`,
  `lib/utils/poi-trust.ts`, `lib/supabase/queries.ts` (`filterTrustedPOIs`),
  `components/variants/report/board/board-data.ts` (`adaptCategory`),
  `lib/utils/school-zones.ts`, `supabase/migrations/050_areas_hierarchy_strok.sql`
- Institutional learnings: se Context & Research-seksjonen (6 dokumenter)
