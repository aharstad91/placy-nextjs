---
title: "feat: Placy nivå-modell (reportTier) med validering + Grilstad nivå 3-løft"
type: feat
status: active
date: 2026-06-10
origin: docs/brainstorms/2026-06-10-placy-tier-modell-requirements.md
---

# feat: Placy nivå-modell (reportTier) med validering + Grilstad nivå 3-løft

## Overview

Innfører et eksplisitt `reportTier: 1 | 2 | 3`-felt i `ReportConfig` som deklarerer tiltenkt leveransenivå per rapport-board, med en validering som sjekker at deklarert nivå er fullt dekket — over begge datakilder (lokal JSON og Supabase `products.config`) og kode-side per-slug-registre (`camera-tours.ts`). Deklarasjonen settes interaktivt i provisjonerings-pipelinen. Grilstad Marina løftes samtidig til komplett nivå 3 (camera-tours, `has3dAddon`, reels-VO) som referanse nr. 2 ved siden av StasjonsKvartalet.

## Problem Frame

Boardets «nivå» styres i dag av minst seks uavhengige signaler uten noe som håndhever at de henger sammen — Grilstad ble en «halv nivå 3» uten at noen merket det (se origin: docs/brainstorms/2026-06-10-placy-tier-modell-requirements.md). Tier-modellen finnes allerede implisitt i koden (dokumentert i docs/solutions/feature-implementations/placy-basic-tier-drill-in-20260608.md) og kommersielt (basic/maks per docs/strategy/LOG.md) — den mangler bare deklarasjon og vakthund.

## Requirements Trace

Fra origin-dokumentet:
- R1. Eksplisitt nivå-deklarasjon (1/2/3) per rapport-board-prosjekt → Unit 1
- R2. Deklarasjonen er sannhetskilde for tiltenkt leveransenivå (kjøpt eller demo-intensjon) → Unit 1 (felt-doc), Unit 5 (klassifisering)
- R3. Validering: nivå 2 = editorial på ALLE kategorier; nivå 3 = + audio-tur (alle temaer), reels-VO (alle temaer), camera-tours-entry, 3D-addon, brand-assets. Begge datakilder fra start. Sjekkliste speiler nivå-tabellen 1:1 → Unit 2, 3
- R3b. Interaktiv deklarasjon i pipeline; ved avvik: fullfør eller re-deklarer ned; ingen waiver → Unit 4
- R4. Feiler høylytt med navngitte mangler; bevises mot pre-løft Grilstad-tilstand (fixture) → Unit 2
- R5. Klassifisering ved innføring: Teknostallen = 1, StasjonsKvartalet = 3, Grilstad = 3 (etter løft) → Unit 5, 8
- R6. Grilstad-løft: camera-tours, `has3dAddon`, reels-VO med egne filnøkler → Unit 6, 7
- R7. Grilstad består valideringen og er referanse-implementasjon nr. 2 → Unit 8

## Scope Boundaries

Fra origin-dokumentet, uendret:
- Render-laget gater IKKE på `reportTier` — eksisterende feature-flagg styrer rendering
- Ingen prising-endringer; Explorer/Guide berøres ikke
- Ingen Supabase-migrasjon: `reportTier` ligger i `ReportConfig` (JSONB `products.config.reportConfig`) — null skjemaendring

### Deferred to Separate Tasks

- Auto-utledning av «observert nivå» som admin-diff — tas hvis/når admin-flate bygges (origin: Scope Boundaries)
- Promotering av camera-tours til Supabase (`ReportThemeConfig.camera`) — allerede deferert i kodekommentar
- `/ce-compound`-dokumentasjon av reels-VO-filnøkkel-mønsteret etter at Unit 7 lander (anbefalt av learnings-research)

## Context & Research

### Relevant Code and Patterns

- `scripts/provision-rapport.ts` — Supabase-pipelinen (npm `create-report`): readline-prompt-mønster (koordinat-bekreftelse, linje ~233) + `acceptanceCheck()` (linje ~125) som leser config tilbake og feiler på mangler. Nivå-prompt og valideringsintegrasjon hører hjemme her.
- `scripts/generate-story.ts` — legacy lokal-JSON-pipeline; får samme prompt/flagg.
- `lib/validation/trip-schema.ts` — husmønsteret for Zod-validering med egne feiltyper.
- `lib/types.ts` — `ReportConfig` (~:430). NB: `poiTier?: 1|2|3` finnes allerede på POI-nivå (:70) — derfor heter feltet `reportTier`, ikke `tier`.
- `scripts/audio-tour-build.ts` — kanonisk config-PATCH: read-modify-write med optimistisk samtidighet (`updated_at=eq.`-filter), `SUPABASE_SERVICE_ROLE_KEY` fra `.env.local`.
- `scripts/audio-tour-build-local.ts` (KUN på `feat/grilstad-marina-board`) — lokal TTS-driver som gjenbrukes som mal for reels-VO-scriptet. Skipper `reelsAudio` by design.
- `components/variants/report/board/camera-tours.ts` — `CAMERA_TOURS` keyed på slug; `getCameraTour(slug)`; test-presedens i `camera-tours.test.ts`.
- `components/variants/report/reels/reels-data.ts` (~:206) — `c.reelsAudio ?? c.audio`-fallback; reels-VO trenger url + timings for karaoke.
- Signal-konsumenter: `report-data.ts` (:208 audioTourEnabled, :181 assets), `BoardMap3D.tsx` (:436 camera-tour), `lib/types.ts` (:540/:608 has3dAddon).

### Institutional Learnings

- `docs/solutions/feature-implementations/placy-basic-tier-drill-in-20260608.md` — tier skal være konsistent over ALLE kategorier (bekrefter kvantoren); gating-signaler må være eksplisitte presence-markers; `highlightPoiIds` som ikke resolver mot filtrert board-sett droppes stille — valideringen skal flagge disse; dev `unstable_cache`-gotcha: `revalidateTag("product:{customer}_{slug}")` etter config-PATCH.
- `docs/solutions/database-issues/jsonb-merge-vs-overwrite-seed-scripts-20260413.md` — ALDRI PATCH med partial object; alltid read-modify-write. Config kan være lagret som jsonb ELLER json-string — bevar formen.
- `docs/solutions/feature-implementations/google-maps-3d-intro-flythrough-20260603.md` — camera-arbeid: rAF over `flyCameraTo`-kjeding; `?film=1` og `?author=1`-flyt; per-slug-registre (`board-intros.ts`, `board-models.ts`, `camera-tours.ts`) er kode-side config valideringen må sjekke.
- `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md` — Supabase JS kaster aldri; sjekk `{ error }` eksplisitt. Manglende `reportTier` behandles som nivå 1-default, ikke krasj.
- Auto-memory: reels-audio er override-akse — reels-mp3 må aldri overskrive audio-tur-filene (karaoke ryker); TTS-validering gjøres på full pipeline, ikke snippet; norske stedsnavn via pronunciation-alias.

## Key Technical Decisions

- **Felt: `ReportConfig.reportTier?: 1 | 2 | 3`** — ReportConfig-plassering flyter gjennom begge datakilder uten migrasjon (presedens: `audioTourEnabled`, `assets`); `reportTier`-navnet unngår kollisjon med `poiTier` og Guide-pristiers. `undefined` = nivå 1 (graceful default).
- **Validator som ren funksjon + tynne drivere** — `lib/validation/report-tier.ts` tar (reportConfig, slug, registry-oppslag) og returnerer strukturerte mangler. Drivere: CLI-script (begge kilder, exit ≠ 0), Vitest (fixtures, offline), `acceptanceCheck()` (pipeline). Én sannhet, tre kjørepunkter.
- **Kjørepunkter (avklarer origin-spørsmålet):** (1) `npm run validate:tier` — manuelt + før kunde-sending; (2) Vitest-test over lokale JSON-prosjekter + fixtures — kjører i `npm test`; (3) `acceptanceCheck()` i provision-pipelinen. Deploy gates ikke (kjent restrisiko per origin Success Criteria) — pre-commit kjører ikke tester i dag, og det endres ikke.
- **Supabase-lesing i CLI-scriptet, ikke i Vitest** — testene skal være offline/deterministiske; nettverkssjekken bor i scriptet (env-mønster fra `audio-tour-build.ts`).
- **Branch-rekkefølge: `feat/grilstad-marina-board` merges til main FØRST** — Grilstad-data og `audio-tour-build-local.ts` finnes kun der (verifisert: fraværende fra main); tier-arbeidet starter fra merged main. Pre-løft-fixturen (Unit 2) fanges fra branchen FØR merge og før Unit 6–7 endrer den; worktreen ryddes med `git worktree remove` etter merge.
- **Reels-VO på egen filnøkkel `{theme-id}-reels.mp3`** — audio-turen eier `/audio/{slug}/{theme-id}.mp3`; kollisjon ødelegger karaoke (auto-memory + reels-data-fallback).

## Justering 2026-06-10 (etter live-verifisering)

Origin-dokumentets premiss om `audioTourEnabled`-gating var feil for boardet (dødt flagg, ingen UI-konsument); boardet spiller `pickPlayable(reelsAudio) ?? pickPlayable(audio)`. Ratifisert forenkling (se origin-addendum):

- **Validatorens nivå 3-sjekk:** spillbart VO-spor (manus+url på reelsAudio ELLER audio) per tema + welcome/hjem/outro. `audioTourEnabled`- og separate tour/reels-sjekker er fjernet.
- **Unit 5 forenkles:** StasjonsKvartalet trenger INGEN audio-re-seed (reels-VO-ene i prod ER VO-dekningen — live verifisert). Det reelle gapet for nivå 3-deklarasjon er **editorial på alle 7 temaer (aldri skrevet i prod)** — kurateringsarbeid, ikke config-fiks. Produkteier avgjør: skriv editorial, eller vent med 3-deklarasjonen.
- **Unit 7 (Grilstad reels-VO) står som planlagt build-arbeid** (manusene er ferdigskrevet; kortere bilde-alignede spor er den bedre reels-opplevelsen), men er ikke lenger en tier-gate — Grilstad har spillbar VO via tour-sporene allerede.

## Open Questions

### Resolved During Planning

- Hvor valideringen kjører: script + Vitest + acceptanceCheck (se Key Technical Decisions)
- Feltplassering: `ReportConfig.reportTier` (se Key Technical Decisions)
- Merge-rekkefølge: Grilstad-branch først (se Key Technical Decisions)

### Deferred to Implementation

- Hvilke Grilstad-kategorier som får A→B-kino vs. orbit: autoreres mot 3D-tiles i browser (`?author=1`) — StasjonsKvartalet har kun `transport` som A→B; start med 1–2 signatur-kategorier (natur-friluftsliv, marina-batliv) og vurder visuelt. Full kino på alle 7 er trolig over-regi.
- Eksakt struktur på valideringsfunn (warning vs. error-kategorier for highlightPoiIds-drops) — avgjøres når validatoren skrives.
- Om `broset-utvikling-as/wesselslokka.json` har editorial nok til nivå 2 eller defaulter til 1 — avgjøres ved kjøring av validatoren i Unit 5. (scandic er Guide, utenfor scope.)
- ~~StasjonsKvartalet audio-tilstand~~ **Besvart 2026-06-10:** ingenting er tapt — boardet spiller reels-VO-ene som ligger i prod; tour-sporene var aldri seedet og trengs ikke. Se «Justering 2026-06-10».
- **Teknostallens products-rad:** identifiseres entydig via project-id-mapping før PATCH (ingen åpenbar slug-match i prod-dump).

## Implementation Units

> Fase 1 = fundament (Unit 1–3), Fase 2 = pipeline + klassifisering (Unit 4–5), Fase 3 = Grilstad-løft (Unit 6–8).
>
> **Forutsetning før Fase 1 (rekkefølge):** (1) fang pre-løft-fixturen (Unit 2) fra Grilstad-worktreen/branchen mens den fortsatt er pre-løft; (2) merge `feat/grilstad-marina-board` til main fra main-checkouten (branchen er checked out i worktree `../placy-ralph-grilstad` — kan ikke merges «inn i seg selv»); (3) `git worktree remove ../placy-ralph-grilstad` per worktree-policy. `feat/event-board-foundation` (nåværende checkout) er 0 commits foran main og blokkerer ikke.

- [x] **Unit 1: `reportTier`-felt + Zod-skjema**

**Goal:** Deklarasjonsfeltet finnes i typene med dokumentert semantikk.

**Requirements:** R1, R2

**Dependencies:** Grilstad-branch merget.

**Files:**
- Modify: `lib/types.ts` (ReportConfig)
- Create: `lib/validation/report-tier-schema.ts`
- Test: `lib/validation/report-tier-schema.test.ts`

**Approach:**
- `reportTier?: 1 | 2 | 3` på `ReportConfig` med doc-kommentar: tiltenkt leveransenivå (kjøpt eller demo-intensjon); `undefined` → nivå 1; render-laget gater ikke på feltet.
- Zod-skjema etter `trip-schema.ts`-mønsteret: `z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()`-stil for feltet, gjenbrukbart fra validatoren.

**Patterns to follow:** `lib/validation/trip-schema.ts`; `poiTier`-literal-union i `lib/types.ts:70`.

**Test scenarios:**
- Happy path: reportTier 1/2/3 parses gyldig
- Edge case: `undefined`/manglende felt → gyldig (default nivå 1-semantikk)
- Error path: `reportTier: 4`, `"3"` (string), `0` → avvises

**Verification:** `npx tsc --noEmit` rent; skjema-testene passerer.

- [x] **Unit 2: Validator-kjerne + fixtures (inkl. pre-løft Grilstad)**

**Goal:** Ren funksjon som gitt prosjektdata + slug returnerer strukturerte mangler mot deklarert nivå — bevist mot pre-løft Grilstad-tilstanden.

**Requirements:** R3, R4

**Dependencies:** Unit 1.

**Files:**
- Create: `lib/validation/report-tier.ts`
- Create: `lib/validation/__fixtures__/grilstad-pre-lift.json` (snapshot av reportConfig-relevante felter fra `data/projects/grilstad-marina/byggetrinn-4.json` FØR Unit 6–7, + has3dAddon/camera-tours-status)
- Test: `lib/validation/report-tier.test.ts` (kjerne-scenarier + lokal-prosjekt-sveipet i kjørepunkt 2)

**Approach:**
- Sjekkliste speiler nivå-tabellen 1:1: nivå 2 → `editorial` (ikke-tom body eller ≥1 highlight) på ALLE temaer; nivå 3 → i tillegg `audioTourEnabled === true`, `audio` (manus + url) på alle temaer + welcome/hero/outro (url-presence), `reelsAudio` (manus + url) på alle temaer, `getCameraTour(slug)` ≠ undefined, `has3dAddon === true`, `assets.brand === true`.
- **`audioTourEnabled` er obligatorisk i nivå 3-sjekken** — render-gatingen er `rc.audioTourEnabled` (`report-data.ts:641`); uten denne sjekken kan et board passere nivå 3 mens audio-turen er avslått/usynlig (nøyaktig «halv nivå 3»-feilmoden modellen skal fange).
- **welcome/hero/outro** sjekkes for url-presence. NB: pre-løft Grilstad HAR disse + `themes[].audio` + `audioTourEnabled: true` allerede — derfor dukker de IKKE opp i falsifikasjonstestens forventede mangelliste under. Kun det Grilstad faktisk mangler listes der.
- Camera-tours/registre sjekkes via import av `getCameraTour` fra `components/variants/report/board/camera-tours.ts` (kode-side config — Supabase-config alene er ikke nok, jf. learnings).
- Tilleggssjekk fra learnings: `editorial.highlightPoiIds` som ikke resolver mot prosjektets POI-er flagges (warning-kategori).
- Funn-format: `{ level: "error"|"warning", check: string, detail: string }[]` — «deklarert nivå 3, mangler: camera-tours, has3dAddon»-stil.

**Execution note:** Test-først mot pre-løft-fixturen: skriv testen «Grilstad deklarert 3 → feiler med camera-tours + has3dAddon + reels-VO-url-mangler + brand-assets» før validatoren implementeres — det er R4s falsifikasjonsbevis.

**Patterns to follow:** `lib/curation/validator.test.ts`; `camera-tours.test.ts`.

**Test scenarios:**
- Happy path: komplett nivå 3-config (StasjonsKvartalet-formet fixture) → ingen errors
- Happy path: nivå 1-config uten editorial/audio → ingen errors
- Integration/falsifikasjon: pre-løft Grilstad-fixture deklarert nivå 3 → errors navngir nøyaktig camera-tours, has3dAddon, manglende reels-VO-urler og brand-assets (welcome/hero/outro + `themes[].audio` + `audioTourEnabled` er ALLEREDE til stede pre-løft, derfor IKKE i listen)
- Edge case: nivå 2 med editorial på 6 av 7 temaer → error som navngir temaet som mangler
- Edge case: `reportTier` undefined → valideres som nivå 1 (ingen krav)
- Edge case: nivå 3 med `audio.manus` men uten `audio.url` (manus-only) → error (url kreves)
- Edge case: nivå 3 med komplett audio men `audioTourEnabled` mangler/false → error
- Error path: highlightPoiIds med ukjent POI-id → warning med id-en navngitt
- Integration (kjørepunkt 2, eies av denne uniten): sveip over alle `data/projects/*/*.json` med reportConfig → null errors. Premiss: prosjekter uten `reportTier` valideres som nivå 1 (ingen krav) → grønn i hele sekvensen frem til Unit 5/8. Dette oppfyller «Vitest-test over lokale JSON-prosjekter» i Key Technical Decisions.

**Verification:** Alle scenarier passerer i `npm test`; falsifikasjonstesten beviser at validatoren hadde fanget dagens Grilstad.

- [x] **Unit 3: CLI-script over begge datakilder**

**Goal:** `npm run validate:tier` validerer alle prosjekter — lokal JSON + Supabase — og feiler høylytt.

**Requirements:** R3 (begge kilder), R4

**Dependencies:** Unit 2.

**Files:**
- Create: `scripts/validate-report-tier.ts`
- Modify: `package.json` (script-entry)

**Approach:**
- Lokal kilde: glob `data/projects/*/*.json` (skip `*.input.json`), filtrér `productType === "report"` eller prosjekter med `reportConfig`.
- Supabase-kilde: hent `products?select=...` med service-role-headers (mønster: `audio-tour-build.ts`); håndter `{ error }` eksplisitt og degradér med tydelig melding hvis env mangler (`--local-only`-modus for offline bruk).
- Output: tabell per prosjekt (kilde, slug, deklarert nivå, status, mangler); exit 1 ved errors, 0 ved kun warnings.

**Patterns to follow:** `scripts/audio-tour-build.ts` (env + REST-headers); `supabase-graceful-column-fallback`-learning.

**Test scenarios:**
- Test expectation: none — tynn driver rundt Unit 2-kjernen (I/O + formatting); kjernen er fullt testet. Manuell verifisering under.

**Verification:** Kjørt mot reell tilstand: rapporterer alle lokale prosjekter + Supabase-prosjektene; Teknostallen/StasjonsKvartalet dukker opp; exit-koder korrekte (test med bevisst feil-deklarasjon lokalt).

- [x] **Unit 4: Interaktiv nivå-deklarasjon i pipelinene + acceptanceCheck**

**Goal:** Provisjonering spør «hvilket nivå?» og skriver `reportTier`; acceptance-fasen validerer mot det.

**Requirements:** R3b

**Dependencies:** Unit 2 (validator), Unit 1.

**Files:**
- Modify: `scripts/provision-rapport.ts` (readline-prompt + `--tier <1|2|3>`-flagg; thread inn i `createReportProject`-options; utvid `acceptanceCheck()` med validator-kall)
- Modify: `lib/pipeline/create-report-project.ts` (skriv `reportTier` i initial config)
- Modify: `scripts/generate-story.ts` (samme prompt/flagg for lokal-JSON-løpet; skriv feltet i output)
- Test: `lib/pipeline/create-report-project.test.ts` (utvid)

**Approach:**
- Prompt-mønster kopieres fra koordinat-bekreftelsen i `provision-rapport.ts` (~linje 233); `--tier`-flagg som non-interaktiv escape hatch (samme som `--confirm-coords`).
- `acceptanceCheck()` kjører validatoren mot nettopp-skrevet config; nivå-mangler rapporteres i samme stil som dagens leadText/POI-sjekker. Ny provisjonering på nivå 1 skal passere uten manuell etterfylling.
- Re-deklarering = kjør validator-scriptet, få mangellisten, oppdater `reportTier` via read-modify-write (dokumenteres i script-output, ingen egen kommando).

**Patterns to follow:** Eksisterende readline-bruk og `acceptanceCheck()`-struktur i `provision-rapport.ts`.

**Test scenarios:**
- Happy path: `createReportProject` med tier-option → `reportTier` i config-objektet
- Edge case: uten tier-option → feltet utelates (nivå 1-default)
- Integration (manuell): `create-report --tier 1` ende-til-ende → acceptanceCheck grønn

**Verification:** Dry-run av provisjonering setter feltet; acceptanceCheck feiler når man bevisst deklarerer 3 på et basic-oppsett.

- [ ] **Unit 5: Klassifiser eksisterende prosjekter**

**Goal:** Navngitte referanse-/kundeprosjekter (Teknostallen, StasjonsKvartalet, lokale prosjekter med reportConfig) får eksplisitt `reportTier`; øvrige prod-report-rader (~24 totalt i `products`) hviler på `undefined`→nivå 1-defaulten og dokumenteres av `validate:tier`-output — IKKE 24 individuelle PATCH-er. (Origin R5/scope uendret.)

**Requirements:** R2, R5

**Dependencies:** Unit 3 (scriptet brukes til å verifisere).

**Files:**
- Modify: Supabase `products.config` for Teknostallen (`reportTier: 1`) og StasjonsKvartalet (`reportTier: 3` — krever betinget audio-re-seed, se Approach) — via engangs read-modify-write (mønster: seeding-oppskriften i placy-basic-tier-drill-in-learningen). NB: Teknostallens products-rad må identifiseres entydig via project-id-mapping (ingen åpenbar slug-match i prod-dump).
- Modify: lokale JSON-prosjekter med reportConfig (`data/projects/broset-utvikling-as/wesselslokka.json` — explorer m/ reportConfig) — `reportTier` etter faktisk innhold (validator-output avgjør, forventet 1). NB: `data/projects/scandic/` er Guide-produkt uten reportConfig → utenfor scope (Guide berøres ikke).

**Approach:**
- **Pre-sjekk (read-only) FØR noen PATCH:** kjør `validate:tier` mot Supabase for å fange faktisk prod-tilstand (prod drifter mellom sesjoner — ikke stol på eldre funn).
- **Verifisert pr. 2026-06-10:** StasjonsKvartalet-raden (bane-nor) mangler `themes[].audio` HELT (0 forekomster), `audioTourEnabled` og `has3dAddon` i reportConfig — kun `reelsAudio`-urls (7/7), welcome/hero/outro og `assets.brand` finnes. Tour-mp3-ene finnes i `public/audio/stasjonskvartalet/`. «Fikses som flagg» holder altså IKKE for nivå 3 her.
- **Betinget re-seed (egen `/effort xhigh`-oppgave, ikke flagg-fyll):** for at StasjonsKvartalet skal passere nivå 3 må `themes[].audio` (manus + url + voice/model + karaoke-timings per tema) + `audioTourEnabled: true` re-seedes inn i prod-JSONB via audio-tour-build-mønsteret. Avklar først (se deferred question): er audio-turen bevisst avslått, eller er tema-audio tapt i en tidligere config-klobring (jf. jsonb-merge-learning)? Svaret avgjør restore vs. re-generering.
- Read-modify-write PATCH med `updated_at`-samtidighetsfilter; bevar jsonb/json-string-form; `revalidateTag("product:{customer}_{slug}")` etter skriv.
- Grilstad deklareres IKKE her — den settes til 3 i Unit 8 etter løftet.

**Test scenarios:**
- Test expectation: none — dataklassifisering, verifiseres med validator-scriptet.

**Verification:** `npm run validate:tier` grønn for alle prosjekter unntatt Grilstad (som ennå ikke er deklarert/løftet). Rapporter fullstendighet: X av Y prosjekter klassifisert.

- [x] **Unit 6: Grilstad camera-tours + 3D-addon**

**Goal:** Grilstad får cinematic kamera-regi og 3D-addon-flagget — kino-delen StasjonsKvartalet har.

**Requirements:** R6

**Dependencies:** Fase 1 merget (validatoren finnes); kjøres i hovedrepo (branchen er merget).

**Files:**
- Modify: `components/variants/report/board/camera-tours.ts` (entry for `byggetrinn-4`)
- Modify: `data/projects/grilstad-marina/byggetrinn-4.json` (`has3dAddon: true`, `assets`-flagg i reportConfig)
- Test: `components/variants/report/board/camera-tours.test.ts` (utvid med ny slug)

**Approach:**
- Autorer A→B-poser mot 3D-tiles i browser (`?author=1`-flyten fra StasjonsKvartalet); start med natur-friluftsliv + marina-batliv (sjø-/marina-poser er signaturen), orbit-fallback for resten. Vurder visuelt om flere trengs.
- Poser verifiseres i nystartet Chrome (WebGL-context-learning).
- **`assets.brand` er en presence-marker for faktiske brand-filer** (learning: gating-signaler må være eksplisitte presence-markers). FØR `assets.brand: true` settes: bekreft at Grilstad-brand-assetene faktisk finnes (logo/splash/pin-thumb per slug-konvensjonen, jf. StasjonsKvartalets `assets`-objekt). Mangler de, er produksjon av dem en del av løftet — ikke flipp flagget på tomme filer (det gjenskaper signal/innhold-spriket modellen skal eliminere).

**Test scenarios:**
- Happy path: `getCameraTour("byggetrinn-4")` returnerer config; poser klampes gyldig (eksisterende clampPose-tester som mal)

**Verification:** Kategori-drill-in i browser flyr A→B for de autorerte kategoriene; reduced-motion-fallback fungerer; visuell sjekk dokumentert med screenshot.

- [x] **Unit 7: Reels-VO-script + generering for Grilstad**

**Goal:** De 7 ferdigskrevne reels-manusene stemmelegges til egne mp3-er med timings — uten å røre audio-tur-filene.

**Requirements:** R6

**Dependencies:** Unit 6 (uavhengig i kode, men samme arbeidsøkt); ElevenLabs API-nøkkel i `.env.local`.

**Files:**
- Create: `scripts/reels-voiceover-build-local.ts` (mal: `scripts/audio-tour-build-local.ts`, men itererer `themes[].reelsAudio` og skriver `public/audio/{slug}/{theme-id}-reels.mp3`)
- Modify: `data/projects/grilstad-marina/byggetrinn-4.json` (reelsAudio.url/voice/model/timings per tema)
- Create: `public/audio/byggetrinn-4/{theme-id}-reels.mp3` (7 filer)

**Approach:**
- Gjenbruk `generateAudio` fra `lib/audio-tour/elevenlabs-client.ts` (Erik/turbo_v2_5/norsk, pronunciation-aliaser, timings-remap) — identisk kvalitet med tour-sporene.
- Filnøkkel `{theme-id}-reels` — INGEN endring i `storage-paths.ts` nødvendig: `audioFilename` special-caser kun trackKey `"home"` og returnerer ellers `${trackKey}.mp3`. Send `${themeId}-reels` som trackKey til eksisterende `audioRelPath`/`audioAbsPath` → `/audio/{slug}/{theme-id}-reels.mp3` uten kollisjon med tour-mp3 (karaoke-kontrakten).
- Skip-eksisterende-url + `--force` som i malen; MIN_BYTES-guard; JSON skrives kun når alle spor lykkes.

**Execution note:** TTS-validering på full produksjons-manus, ikke snippets (modellen er stokastisk per request) — lytt gjennom alle 7 før commit; sjekk norske stedsnavn (Fullriggerøya, Grilstadfjæra, Ladestien).

**Test scenarios:**
- Test expectation: none — engangs TTS-generering med ekstern API; kvalitet verifiseres ved gjennomlytting. Filnøkkel-separasjonen dekkes av Unit 2-validatorens reels-VO-sjekk + git-sjekk under.

**Verification:** 7 reels-mp3-er finnes med timings i JSON; **`git status public/audio/byggetrinn-4/` viser KUN nye `*-reels.mp3`-filer — eksisterende tour-mp3-er urørt (clean)** (git er autoritativ byte-identitetssjekk siden filene er tracked; dropp mtime); reels-feeden i browser spiller reels-sporet (ikke tour-sporet) med karaoke.

- [x] **Unit 8: Deklarer Grilstad nivå 3 + full verifisering**

**Goal:** Grilstad deklareres `reportTier: 3`, består valideringen, og boardet er visuelt verifisert som komplett nivå 3.

**Requirements:** R5, R7

**Dependencies:** Unit 6, 7.

**Files:**
- Modify: `data/projects/grilstad-marina/byggetrinn-4.json` (`reportTier: 3`)

**Approach:**
- Sett feltet, kjør `npm run validate:tier` — skal være grønn for Grilstad. Hvis ikke: fullfør mangelen (ikke re-deklarer ned — løftet ER scopet).

**Test scenarios:**
- Test expectation: none — sluttverifisering; valideringslogikken er testet i Unit 2.

**Verification:**
- `npm run validate:tier` grønn for ALLE prosjekter (rapporter X av Y)
- Browser: Grilstad-boardet har kino-kamera i drill-in, reels-feed med reels-VO, audio-tur intakt (karaoke fungerer — regresjonssjekk mot Unit 7)
- `npm run lint` / `npm test` / `npx tsc --noEmit` / `npm run build` rene

## System-Wide Impact

- **Interaction graph:** Validatoren importerer `getCameraTour` fra komponentlaget inn i `lib/validation/` — ren funksjon uten React-avhengigheter, men sjekk at importen ikke drar med klient-kode i script-kontekst (tsx håndterer det; verifiser i Unit 3).
- **Error propagation:** Validator-funn er data (ingen throws); CLI oversetter til exit-koder; acceptanceCheck til pipeline-warnings/feil. Supabase-feil sjekkes via `{ error }`, aldri try/catch-antakelser.
- **State lifecycle risks:** Supabase config-PATCH (Unit 5) muterer prod-JSONB — read-modify-write + `updated_at`-filter + cache-bust er obligatorisk. **Flagg `/effort xhigh` før Unit 5 kjøres** (prod-datamutasjon, jf. global instruks).
- **API surface parity:** `reportTier` må leses identisk i begge datakilder — queries.ts-casten (~:973) plukker den opp automatisk siden den bor i reportConfig; ingen ny mapping.
- **Integration coverage:** Falsifikasjonstesten (Unit 2) + ende-til-ende validate:tier mot reell Supabase (Unit 3/5) dekker det fixtures alene ikke beviser.
- **Unchanged invariants:** Render-gating er urørt — `report-data.ts`, `reels-data.ts`, `BoardMap3D.tsx` leser samme flagg som før. Event-board (`lib/event-board/`) tvinger fortsatt `audioTourEnabled: false` og berøres ikke. Audio-tur-filene til Grilstad endres ikke (kun nye `-reels`-filer kommer til).

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supabase-PATCH klobber eksisterende config (Unit 5) | Read-modify-write + `updated_at`-samtidighetsfilter + jsonb-form-bevaring (learnings #1/#2); `/effort xhigh`-flagging før kjøring |
| StasjonsKvartalet kan ikke deklareres nivå 3 uten audio-re-seed (KJENT: `themes[].audio` + `audioTourEnabled` mangler helt i prod) | Unit 5 betinget re-seed-delplan under `/effort xhigh` (manus+url+timings per tema); read-only pre-sjekk før PATCH; avklar restore vs. re-generering |
| Reels-mp3 overskriver tour-mp3 → karaoke ryker | Egen filnøkkel `{theme-id}-reels` (ingen `storage-paths.ts`-endring); `git status`-verifisering av at tour-filer er urørt i Unit 7 |
| TTS-uttale på norske stedsnavn (stokastisk) | Full gjennomlytting av alle 7 spor; pronunciation-alias-ordlisten brukes automatisk av `generateAudio` |
| ElevenLabs-kvote/-kost for 7 reels-spor + stokastiske retakes (~1.5–2x forbruk) | Sjekk kvote før Unit 7; `--force`-regenerering per spor; «JSON skrives kun når alle spor lykkes»-guard hindrer delvis config — men rydd evt. delvis genererte mp3-er ved avbrudd |
| Merge av Grilstad-branch kolliderer med event-board-arbeid på main | Branchen berører primært nye filer (data/, public/, ett script); `report-data.ts`-endringen (illustrasjons-map) er additiv — konflikter er små og mekaniske |
| Validator-import av komponentfil i script-kontekst | `camera-tours.ts` importerer kun `import type` fra `@/lib/types` (verifisert React-fri); verifiseres i Unit 3 første kjøring |

## Documentation / Operational Notes

- Etter Unit 5: `revalidateTag` per oppdatert produkt, og restart dev-server lokalt (unstable_cache-gotcha).
- Etter Unit 8: oppdater `PROJECT-LOG.md` (worklog-prompt per CLAUDE.md) og vurder `/ce-compound` på reels-VO-mønsteret.
- `COMMANDS.md`: dokumentér `npm run validate:tier` og `--tier`-flagget.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-10-placy-tier-modell-requirements.md](../brainstorms/2026-06-10-placy-tier-modell-requirements.md)
- Related code: `scripts/provision-rapport.ts`, `lib/validation/trip-schema.ts`, `components/variants/report/board/camera-tours.ts`, `scripts/audio-tour-build.ts`, `scripts/audio-tour-build-local.ts` (Grilstad-branch)
- Learnings: `docs/solutions/feature-implementations/placy-basic-tier-drill-in-20260608.md`, `docs/solutions/database-issues/jsonb-merge-vs-overwrite-seed-scripts-20260413.md`, `docs/solutions/feature-implementations/google-maps-3d-intro-flythrough-20260603.md`, `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`
- Strategi-kontekst: `docs/strategy/LOG.md` (basic-tier/maksversjon, 2026-06-09)
