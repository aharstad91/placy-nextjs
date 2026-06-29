# PRD 5 — Board-data-transform + state

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Nivå:** delt (transform + state er ALLTID delt — nivå-uavhengig; nivå-deltaet fanges av PRD 2s lette nivå-2-readiness-sjekk, ikke av denne PRD-en)
> **PRD-nr:** 5 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-board-data-state`
> **Kontekst:** Lag-2-PRD (data-transform + lokal navigasjons-state). Eier broen mellom innholds-produksjon (PRD 3 → `ReportData`) og render-laget (PRD 6/9): `adaptBoardData` transformerer `ReportData`/`POI` → render-klar `BoardData`, og `boardReducer`+`BoardProvider` driver lokal board-navigasjon. Folder i tillegg inn i18n-overlay (EN/NO), `bridge-text-generator`, `category-score` og `pickPlayableAudio`-SELEKSJONEN (jf. `00-INDEX` linje 73–74). Blokkeres av PRD 1 (typer + `translations`-tabell), PRD 2 (taksonomi tema-id-er — PRD 2 sjekker IKKE VO) og PRD 3 (provisjon-output). Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md`, `docs/rebuild/prod-schema-snapshot.txt` og faktisk kode (`board-data.ts`, `board-state.tsx`, `lib/i18n/*`, `lib/supabase/translations.ts`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **transform-laget og navigasjons-state** for rapport-boardet: den deterministiske, rene funksjonen som mapper innholds-modellen (`ReportData`, bygget av PRD 3) til render-klar `BoardData` (`board-data.ts:171`), og den lokale `useReducer`+`Context`-state-en som driver hvilken kategori/POI/fase som er aktiv (`board-state.tsx:58`/`154`). Den er det eneste fasade-laget mellom `@/lib/types` og board-komponentene — komponenter importerer board-typer fra `board-data.ts`, ikke fra `@/lib/types` direkte (bevisst flat import-graf, dokumentert `board-data.ts:14-16`).

Tre strukturelle grep definerer denne PRD-en:

1. **`board-data.ts` er fasaden, ikke en passthrough.** Transformen filtrerer bort tema uten POI-er (board kan ikke vise tom kategori — `board-data.ts:172-173`), normaliserer feltnavn (lead/body-konkat, `board-data.ts:233-250`), resolver nivå-2-editorial-highlights mot kategoriens POI-er (`board-data.ts:262-281`), bygger en kryss-kategori POI-lookup (`poisById`, lowercase-nøkler, `board-data.ts:178-183`), og velger spillbare VO-spor (`pickPlayableAudio`, `board-data.ts:220`). Render-laget (PRD 6/9) konsumerer KUN `BoardData` — det rører aldri `ReportData` eller `@/lib/types` direkte.

2. **Board-state er lokal `useReducer`+`Context`, IKKE Zustand.** `00-INDEX` linje 29 kaller dette upresist «Zustand board-state». Verifisert FEIL: `board-state.tsx` bruker `createContext`+`useReducer` (`board-state.tsx:152`/`167`), har INGEN `zustand`-import (grep tomt), og er bevisst lokal navigasjons-state — ikke global. Zustand brukes kun i `lib/store.ts` for Explorer/travel-settings (et ANNET produkt, `lib/store.ts:7`). Denne PRD-en beholder reducer+context og retter terminologien (jf. Åpent spørsmål #1).

3. **VO-SELEKSJON som ortogonalt render-flagg, ikke nivå-krav.** `pickPlayableAudio` velger spillbart spor (`url && manus`) NIVÅ-UAVHENGIG — den vet ingenting om `reportTier`. Render-laget (PRD 9) bruker seleksjonen til å vise VO **betinget** (ortogonalt data-presence-flagg, uavhengig av nivå — to-nivå-modell, walkthrough 2026-06-27). Render-laget gater ALDRI på nivå (verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`). NB (to-nivå): PRD 2 sjekker IKKE lenger VO — den gamle VO-koordineringen (`requiresPlayableVO`/`TIER_CAPABILITIES`) FINNES IKKE. VO er nå et rent ortogonalt flagg eid av denne PRD-en og drevet av render-laget. Eksporten begrunnes KUN av render-laget (PRD 9) + PRD 14 audio-store, som trenger én sannhetskilde for VO-seleksjon; PRD 2 importerer den ikke lenger.

i18n-laget (EN/NO) er foldet inn her (`00-INDEX` linje 73): `applyTranslations` legger et EN-overlay over et `Project` (`apply-translations.ts:13`), `getProjectTranslations` henter overlay-mappet server-side fra `translations`-tabellen (PRD 1-eid, `translations.ts:22`), og `strings.ts`/`themeQuestions` leverer UI-string-dictionary (`strings.ts:8`/`65`). `bridge-text-generator` (template-basert, build-time, `bridge-text-generator.ts:32`) og `category-score` (ren utils, `category-score.ts`) er begge transform-input som kalles i `report-data.ts` — de eies her men kjøres i PRD 3s produksjonssti.

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | `adaptBoardData` portet som ren, deterministisk transform `ReportData` → `BoardData` med uendret semantikk (filtrering, lead/body-konkat, editorial-resolusjon, `poisById`). | Transform-port (Unit 1) + board-typer-port (Unit 1) + test-port (Unit 7). |
| **G2** | `pickPlayableAudio` EKSPORTERES som single-source VO-seleksjon, konsumert av render-laget (PRD 9) + PRD 14 audio-store som ortogonalt data-presence-flagg (PRD 2 sjekker IKKE VO). | `pickPlayableAudio`-eksport (Unit 2) + kontrakt-note i §5.4 + render/PRD 14-konsum-peker. |
| **G3** | Board-state portet som `useReducer`+`Context` (IKKE Zustand), med branded ID-typer, selector-hooks, `use-sub-category-filter`-dep og container-nivå-søm bevart. | State-port + sub-kategori-filter-port (Unit 3) + reducer-test-port (Unit 7). |
| **G4** | i18n-overlay (EN/NO) portet: `applyTranslations` + `getProjectTranslations` (server-side fetch fra `translations`-tabell) + `strings`/`themeQuestions`, med arkitektur-konform datahenting. | i18n-port (Unit 4). |
| **G5** | `bridge-text-generator` portet verbatim som template-basert, build-time generator (ingen LLM). | Bridge-text-port (Unit 5). |
| **G6** | `category-score` portet som ren utils (scoring + sitat-generering), konsumert kun av transform-laget. | Category-score-port (Unit 6). |
| **G7** | Semantikk bevist bevart; alle mekaniske porter grønne; navnekollisjon + dødt flagg + signatur-avvik dokumentert. | Test-port + mekaniske porter (Unit 7). |

---

## 3. Arkitektur-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *transform-/state-laget* — mellom data-produksjon (PRD 3) og render (PRD 6/9). Den forker ALDRI per tier eller profil: `adaptBoardData` produserer samme `BoardData`-form uansett nivå, og reduseren holder kun navigasjons-IDer. Tier-divergensen er deklarert i data (`reportTier` i `products.config`, PRD 1/2) og validert av PRD 2 — den materialiserer seg aldri som en bryter i transformen eller reduseren.

| Lag | Eierskap | Divergerer per tier? | Divergerer per profil? |
|-----|----------|----------------------|------------------------|
| Innholdsmodell (`ReportData`/`ReportTheme`) | PRD 3 (def. i `report-data.ts`) | Nei — felt finnes alltid, fylles betinget | Ja (taksonomi via PRD 2) |
| **Transform (`adaptBoardData` → `BoardData`)** | **Denne PRD-en** | **Nei** — samme form på alle nivåer; `editorial`/`audio` utelates når innhold mangler | Nei |
| **Navigasjons-state (`boardReducer`+`Context`)** | **Denne PRD-en** | Nei — kun IDer/fase | Nei |
| **VO-seleksjon (`pickPlayableAudio`)** | **Denne PRD-en** | **Nei** — velger spillbart spor nivå-uavhengig; render-laget (PRD 9) + PRD 14 konsumerer den som ortogonalt flagg (PRD 2 sjekker IKKE VO) | Nei |
| **i18n-overlay (EN/NO)** | **Denne PRD-en** | Nei | Nei |
| Render (3D-motor, board-skall) | PRD 6 / 9 | Nei (skall) / Ja (overflate, PRD 9) | Nei |

> **NB — terminologi-korreksjon (forankret).** `00-INDEX` linje 29 sier «Zustand board-state». Verifisert mot kode: `board-state.tsx` er `createContext`+`useReducer` (`board-state.tsx:152`/`167`), ingen `zustand`-import. Denne PRD-en beskriver board-state som reducer+context og anbefaler å rette `00-INDEX`-teksten (jf. §10 Q1). Zustand i Placy lever kun i `lib/store.ts` (Explorer-produkt, reference-only her).

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer fra board-data-state |
|---------------|------------------------------------------|
| `prd-3d-motor` (6) | `BoardData` (kategorier + `topRankedPois` for kuratert anker-sett, `home.coordinates`, `poisById`). `00-INDEX` linje 52: PRD 6 leser BoardData. `topRankedPois` (`board-data.ts:101-104`) er SCORE-rangert, bevisst forskjellig fra `pois` (distanse-sortert) — må ikke kollapses. |
| `prd-board-skall-ui` (9) | `BoardData` + reducer/hooks (`useBoard`/`useActiveCategory`/`useActivePOI`/`useFilteredActiveCategory`, `board-state.tsx:194-224`) + `BoardProvider`-injeksjon av `visiblePoiIds`/`collectionPoiIds`. i18n-strings (`t`/`getThemeQuestion`). |
| `prd-instrumentering` (13) | KUN emit-site-wiringen (ikke PRD 13-kjernen, som bygges tidlig/uavhengig per `00-INDEX:37`): emit-sites bruker board-data POI-kontekst (`poisById`, `BoardPOI.id`/`categoryId`) som payload inn i `events`-tabellen. PRD 13 wirer emit-sites med board-PRD-ene (`00-INDEX:57`). |
| `prd-board-skall-ui` (9) + `prd-audio-tour-reels` (14) | KONSUMERER EKSPORTERT `isPlayableAudio`/`pickPlayableAudio` (Unit 2) som single-source VO-seleksjon — ortogonalt data-presence-flagg som driver render (PRD 9 viser VO betinget) + audio-playback (PRD 14 audio-store). **PRD 2 er IKKE en konsument:** nivå-2-readiness-sjekken sjekker IKKE VO (`requiresPlayableVO`/`TIER_CAPABILITIES` finnes ikke). VO-seleksjonen konsolideres til trim-varianten — `pickPlayableAudio` slutter å regne whitespace-only manus som spillbart (jf. §5.4 verifiserte divergens). |

---

## 4. Eksisterende kodebase

### Bæres over (keeper-core / port-with-rewrite)

| Fil (@/-sti eller relativ intra-feature) | Verdict | Rolle | Verifisert linje-ref |
|------------------------------------------|---------|-------|----------------------|
| `lib/board/board-types.ts` | keeper-core (NY kanonisk type-hjem) | Kanonisk DEFINISJONS-hjem for de delte branded/track-typene `BoardCategoryId`/`BoardPOIId`/`BoardAudioTrack` (i dag definert inline i `board-data.ts:23`/`31-32`). PRD 5 EIER hjemmet; `board-data.ts` re-eksporterer for bakoverkompatibel import-flate. PRD 14 KONSUMERER (importerer), flytter ikke. | `BoardCategoryId`, `BoardPOIId`, `BoardAudioTrack` (flyttet fra `board-data.ts:23`/`31-32`) |
| `components/variants/report/board/board-data.ts` | keeper-core (port; rewrites: eksporter `pickPlayableAudio`; re-eksporter de delte typene fra `lib/board/board-types.ts`) | Fasade-transform `ReportData`→`BoardData` + board-typer + VO-seleksjon | `adaptBoardData:171`, `BoardData:127`, `BoardPOI:34`, `BoardCategory:80`, `BoardCategoryEditorial:62`, `BoardHome:111`, `BoardAudioTrack:23` (re-eksport fra type-hjem), `BoardCategoryId:31`/`BoardPOIId:32` (re-eksport fra type-hjem), `pickPlayableAudio:220` (modul-privat i dag), `adaptCategory:229`, `adaptPOI:303` |
| `components/variants/report/board/board-state.tsx` | keeper-core (port; SelectCategorySource-discriminator = spike-arv, se Unit 3) | `useReducer`+`Context` navigasjons-state + selector-hooks | `boardReducer:58`, `BoardAction:42-49`, `BoardPhase:17`, `BoardState:19`, `SelectCategorySource:40`, `initialBoardState:51`, `BoardProvider:154`, `useBoard:194`, `useActiveCategory:202`, `useActivePOI:208`, `useFilteredActiveCategory:215` |
| `components/variants/report/board/use-sub-category-filter.ts` | keeper-core (port verbatim) | Sub-kategori-derivasjon + lokal show/hide-filter-hook konsumert av `BoardProvider` (`board-state.tsx:13-15`/`168`) | `deriveSubCategories:22` (ren funksjon), `useSubCategoryFilter:66` (client-hook), `SubCategoryInfo:6`, `SubCategoryFilterApi:42`, reset-`useEffect:72` (reset-på-kategori-bytte, IKKE data-fetch) |
| `lib/i18n/strings.ts` | keeper-core (port verbatim) | UI-string-dictionary (NO kanonisk, EN target) + `themeQuestions` per tema-id | `Locale:6`, `t:57`, `themeQuestions:65`, `getThemeQuestion:83`, `interpolate:90` |
| `lib/i18n/apply-translations.ts` | keeper-core (port verbatim) | EN-overlay over `Project` (POI editorial + report hero_intro + theme bridge_text) | `applyTranslations(project, locale, translations):13`, overlay-nøkler `:27`/`:29`/`:35`/`:40-42` |
| `lib/supabase/translations.ts` | keeper-core (port; fjern `any`-cast når PRD 1-typer regenerert) | `TranslationMap` + server-fetch fra `translations`-tabell via supabase-wrapper | `TranslationMap:16`, `getProjectTranslations:22`, `from('translations'):39`, `isSupabaseConfigured`-guard `:28`, error→`{}` `:45-48` |
| `lib/generators/bridge-text-generator.ts` | keeper-core (port verbatim) | Template-basert build-time bridge-tekst (INGEN LLM) | `generateBridgeText:32`, «Template-based, no LLM» `:5`, `GENERATORS`-map (modul-privat) |
| `lib/utils/category-score.ts` | keeper-core (port verbatim) | Kategori-scoring (count/rating/proximity/variety) + sitat | `normalizeCount:21`, `normalizeRating:25`, `normalizeProximity:29`, `normalizeVariety:34`, `calculateCategoryScore:59`, `generateCategoryQuote:256`, `CategoryScoreInput/Breakdown/Score` |
| `components/variants/report/board/board-data.test.ts` | port-with-rewrite | Test for `adaptBoardData`/`pickPlayableAudio` (11 890 bytes) | (filstørrelse verifisert) |
| `components/variants/report/board/board-state.test.ts` | port-with-rewrite (+ utvid: dekker 6/7 i dag, legg til `BACK_TO_DEFAULT`) | Test for `boardReducer`-transisjoner (4 702 bytes) | (filstørrelse verifisert) |
| `components/variants/report/board/use-sub-category-filter.test.ts` | port-with-rewrite | Test for `deriveSubCategories` + `useSubCategoryFilter` (6 409 bytes) | (filstørrelse verifisert) |

### Konsumert (ikke eid av denne PRD-en)

| Fil (@/-sti) | Eier | Rolle ift. denne PRD-en |
|--------------|------|--------------------------|
| `components/variants/report/report-data.ts` | PRD 3 | INPUT-kilden: definerer `ReportData`/`ReportTheme` som `board-data.ts` importerer (`board-data.ts:11`); kaller `generateBridgeText` (`report-data.ts:584`) + `calculateCategoryScore`/`generateCategoryQuote` (`report-data.ts:422`/`560`). Server/build-kontekst (ingen `'use client'`). |
| `lib/validation/report-tier.ts` | PRD 2 | Nivå-2-readiness-sjekken (lett: invalid-tier + highlight-poi + editorial@nivå2). Den sjekker IKKE VO — `requiresPlayableVO`/`TIER_CAPABILITIES` finnes ikke. PRD 2 importerer ikke `pickPlayableAudio`; VO er et ortogonalt render-flagg eid her. (Dagens `report-tier.ts:67`-whitespace-divergens elimineres ved at board-laget konsolideres til trim-varianten, jf. §5.4.) |
| `lib/themes/project-brand.ts` | delt Lag-2 (type-kontrakt) / PRD 9 (verdier) | `getProjectBrokers(slug)` synkront in-memory-oppslag (I/O-fri); kalt i `adaptBoardData` (`board-data.ts:12`/`205`) for demo-fallback-meglere. **Unit 1 bygger mot project-brand TYPE-KONTRAKTEN** (hoistbar til delt Lag-2, som beat-signal-noden — `00-INDEX` note #5); en per-unit consume-edge, IKKE en hard board-blokker. |

### Reference-only / dead

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `lib/store.ts` | reference-only | Zustand GLOBAL state (`usePlacyStore`) for Explorer/travel-settings — IKKE board-state. **Navnekollisjon:** `useActivePOI` eksporteres her (`lib/store.ts:46`) OG fra `board-state.tsx:208` — forskjellige produkter, forskjellig retur-type (jf. §5.5). |
| `lib/i18n/explorer-strings.ts` | reference-only | Explorer-spesifikke locale-strings (`ExplorerStrings`). Board er Report-only; Explorer-i18n hører til en Explorer-PRD (jf. §10 Q4). `00-INDEX` linje 73 sier «lib/i18n/*» men board-scopet er Report. |
| `audioTourEnabled`-feltet | reference-only (BEHOLD felt, ikke gating) | DØDT flagg på boardet (`board-data.ts:153` def., `:209` sett). Ingen UI-konsument (`report-tier.ts:33`). Behold i datakontrakt (PRD 6/9 leser `BoardData`-shapen), men gjeninnfør ALDRI gating-bruk. |

---

## 5. Datakontrakt / Skjema

### 5.1 `BoardData` (eid av denne PRD-en, def. `board-data.ts:127-158`)

`adaptBoardData(report: ReportData): BoardData` (`board-data.ts:171`) produserer:

| Felt | Type | Kilde / merknad |
|------|------|-----------------|
| `projectSlug?` | `string` | `report.projectSlug` (= `project.urlSlug`, `report-data.ts:631`) — illustrasjons-/asset-oppslag |
| `home` | `BoardHome` | navn/koord/adresse + `heroImage`/`heroIntro`/`district`/`city` + `audio` (fra `pickPlayableAudio(report.heroAudio)`) |
| `categories` | `BoardCategory[]` | `report.themes.filter(allPOIs.length > 0).map(adaptCategory)` (`board-data.ts:172-173`) — tom kategori faller ut |
| `welcome?` / `outro?` | `BoardAudioTrack` | `pickPlayableAudio(report.welcomeAudio/outroAudio)` |
| `brokers?` | `BrokerInfo[]` | `report.brokers` ELLER `getProjectBrokers(slug)`-fallback (`board-data.ts:203-205`) |
| `summary?` / `cta?` | `ReportSummary` / `ReportCTA` | passthrough |
| `poisById` | `Map<string, POI>` | LOWERCASE-nøkler (`board-data.ts:181`); bygges fra UFILTRERTE `report.themes` (`board-data.ts:178-183`), IKKE det tom-filtrerte `categories`-settet — så grounding-lenker kan resolve POIs i tema som er filtrert bort fra navigasjonen; kryss-kategori grounding-link-resolusjon; IKKE navigasjon |
| `audioTourEnabled` | `boolean` | DØDT flagg (`board-data.ts:209`) — behold felt, ikke gating |
| `assets?` / `venueType?` | `ProjectAssetFlags` / `"hotel"\|"residential"\|"commercial"\|null` | passthrough |

`BoardCategory` (`board-data.ts:80-109`) bærer to bevisst FORSKJELLIGE POI-lister: `pois` (DISTANSE-sortert, `board-data.ts:294`) og `topRankedPois` (SCORE-rangert via `theme.topRanked`, `board-data.ts:101-104`/`297`). PRD 6 bruker `topRankedPois` for kuratert anker-sett — listene må ikke kollapses.

> **Foto-agnostisk transform (note #9).** `heroImage` på `BoardHome` og POI-foto-felt slippes gjennom som nullable/optional. Transformen ANTAR ALDRI foto-tilstedeværelse — manglende bilde gir ingen feil, og no-photo-fallback-rendring (kategorifarge/ikon) eies av PRD 9. Foto-henting (`fetchAndCachePOIPhotos`) er DEFERRED (PRD 4 Unit 4/5), så transform-laget er bevisst foto-agnostisk her.

`BoardAudioTimings` (`board-data.ts:17`) er IKKE en egen type — den er en re-eksport av `ReportThemeAudioTimings` fra `@/lib/types`, slik at komponenter importerer fra `board-data`, ikke `@/lib/types` direkte (bevisst flat import-graf, `board-data.ts:14-16`).

### 5.2 Branded ID-typer + delt track-type (kanonisk type-hjem)

`BoardCategoryId`/`BoardPOIId` (i dag `board-data.ts:31-32`) er branded string-typer som forhindrer ID-blanding mellom tema-IDer og POI-IDer i `dispatch`/reducer. Bevares som invariant gjennom porten.

**Kanonisk type-hjem (denne PRD-en EIER det).** PRD 5 er definisjons-hjemmet for de tre delte typene `BoardCategoryId`/`BoardPOIId`/`BoardAudioTrack`. De flyttes til `lib/board/board-types.ts` (kanonisk hjem) og re-eksporteres fra `board-data.ts` slik at eksisterende import-flate (`from '@/components/variants/report/board/board-data'`) er bakoverkompatibel. PRD 14 (`prd-audio-tour-reels`) KONSUMERER disse typene (importerer fra type-hjemmet/re-eksporten) — den flytter dem ikke. Eierskaps-grensen: PRD 5 definerer, PRD 14 konsumerer.

### 5.3 i18n-datakontrakt (`translations`-tabell — PRD 1-eid)

Konsumerer `translations`-tabellen (verifisert `prod-schema-snapshot.txt:234-241` + PRD 1:113): 8 kolonner `id`/`locale`/`entity_type`/`entity_id`/`field`/`value`/`created_at`/`updated_at`, alle NOT NULL, alle rader NO i dag. `getProjectTranslations` (`translations.ts:22`) leser via supabase-wrapper og returnerer `TranslationMap = Record<string,string>` keyed `"entity_type:entity_id:field"` (`translations.ts:16`/`50-53`).

Overlay-nøkkel-konvensjon (verifisert `apply-translations.ts`):

| Entitet | Nøkkel | Linje |
|---------|--------|-------|
| POI editorial hook | `poi:<id>:editorial_hook` | `:27` |
| POI local insight | `poi:<id>:local_insight` | `:29` |
| Report hero intro | `report:<projectId>:hero_intro` | `:35` |
| Theme bridge text (produkt-spesifikk → generisk fallback) | `theme:<projectId>_<themeId>:bridge_text` → `theme:<themeId>:bridge_text` | `:40-42` |

`getProjectTranslations` legger også produkt-spesifikke tema-nøkler (`productId_themeId`, `translations.ts:33`). Anon read-policy på `translations` kreves (PRD 1:209). Graceful empty-map-fallback ved manglende tabell/feil (`translations.ts:45-48`).

### 5.4 VO-seleksjon-kontrakt (`pickPlayableAudio` — eierskaps-grense)

`pickPlayableAudio(audio: ReportThemeAudio | undefined): BoardAudioTrack | undefined` (`board-data.ts:220`) returnerer `{ url, manus, timings? }` KUN når `url && manus` begge er definert (`board-data.ts:223`). Dette er VO-SELEKSJONS-grensen.

**Verifisert divergens (må håndteres — IKKE en ren kopi).** De to call-sites er IKKE semantisk identiske i dag. `pickPlayableAudio` bruker rå truthiness: `if (!audio?.url || !audio.manus) return undefined;` (`board-data.ts:223`) — et manus som er kun whitespace (`"   "`) er truthy → returnerer et track (regnes som spillbart). PRD 2s validator trimmer: `isPlayable = Boolean(a?.url && a?.manus?.trim())` (`report-tier.ts:67`) — samme `"   "` er falsy → ikke spillbart. Å «konsolidere» til ett predikat endrer derfor oppførselen til minst ett call-site; premisset om en trygg kollaps er falskt for whitespace-only manus.

`report-tier.ts` har i dag en EGEN duplikat av VO-logikken: `isPlayable = Boolean(a?.url && a?.manus?.trim())` (`report-tier.ts:67`) og `hasPlayableVO = isPlayable(reelsAudio) || isPlayable(audio)` (`report-tier.ts:74-79`). Den duplikaten er en RELIKT fra den gamle nivå-3-VO-gatingen. I to-nivå-modellen sjekker den lette nivå-2-readiness-sjekken IKKE VO — `hasPlayableVO`/duplikaten FJERNES fra PRD 2 (selve slettingen lever i PRD 2). VO er nå et ortogonalt data-presence-flagg eid her og drevet av render-laget (PRD 9) + PRD 14 audio-store.

**Beslutning (jf. §9 #2 — kanonisk semantikk = trim-varianten).** Whitespace-only manus skal IKKE regnes som spillbart (et VO-spor uten reell tekst er ikke et brukbart spor). Unit 2 EKSPORTERER `pickPlayableAudio` (og en avledet `isPlayableAudio`-predikat), OG oppdaterer BÅDE `pickPlayableAudio` sin guard OG predikaten til å trimme manus (`Boolean(a?.url && a?.manus?.trim())`). Dette flytter board-laget til trim-varianten — board-laget slutter å regne whitespace-manus som spillbart — slik at render-laget (PRD 9) + PRD 14 audio-store får én konsistent VO-seleksjon. Konsolideringen begrunnes av render/audio-konsumentene, IKKE av noen PRD 2-speiling (PRD 2 sjekker ikke VO lenger).

### 5.5 Navnekollisjon (`useActivePOI`)

`useActivePOI` eksporteres BÅDE fra `board-state.tsx:208` (Report board; retur: `BoardPOI | null`) OG fra `lib/store.ts:46` (Explorer/Zustand; annen retur-type). Forskjellige produkter. PRD-en holder board-versjonen i `board-state.tsx` og dokumenterer at konsumenter (PRD 9) importerer board-`useActivePOI` fra `@/components/variants/report/board/board-state`, aldri fra `@/lib/store`.

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. `adaptBoardData`-transformen + board-lagets typer (`BoardData`/`BoardPOI`/`BoardCategory`/`BoardCategoryEditorial`/`BoardHome`/`BoardAudioTrack`/branded IDer).
2. `pickPlayableAudio`-SELEKSJONEN (eksportert som single-source) — IKKE VO-generering.
3. Board-navigasjons-state (`boardReducer` + `BoardProvider` + selector-hooks + `use-sub-category-filter` som `BoardProvider` har compile-time-dep til), `useReducer`+`Context`.
4. i18n-overlay EN/NO (`applyTranslations` + `getProjectTranslations` + `strings`/`themeQuestions`).
5. `bridge-text-generator` (template-basert build-time) + `category-score` (ren utils) — eid her, kalt i PRD 3s transform-input.
6. Test-port for transform + reducer.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Board-rendering / UI-komponenter (BoardScrollPanel, DesktopStorySidebar, marker-rendering, `BoardProvider`-konsum) | `prd-board-skall-ui` (PRD 9) |
| 3D-motor som leser `BoardData` (kamera, anker-sett fra `topRankedPois`) | `prd-3d-motor` (PRD 6) |
| Audio-tour TTS-GENERERING + reels-generering (denne PRD eier kun `pickPlayableAudio`-SELEKSJON) | `prd-audio-tour-reels` (PRD 14) |
| Realtime-transport-blocks (Entur/bysykkel/hyre live-data i highlight-chips) | `prd-realtime-transport` (PRD 11) |
| Grounding/editorial-GENERERING (`ReportThemeGroundingView`-innhold, area-editorial-arv) | `prd-grounding-curation` (PRD 7) + `prd-lokalkunnskap-moat` (PRD 8) |
| Nivå-validering / lett nivå-2-readiness-sjekk (invalid-tier + highlight-poi + editorial@nivå2). NB: sjekken sjekker IKKE VO — `pickPlayableAudio`-seleksjonen er et ortogonalt render-flagg eid her, ikke noe nivå-readiness speiler. | `prd-tier-capability-manifest` (PRD 2) |
| `ReportData`/`ReportTheme`-bygging fra Project/reportConfig (INPUT-kilden) | `prd-provisjon` (PRD 3) |
| `translations`-tabell-skjema + regenererte Supabase-typer (fjerner `any`-cast i `translations.ts:39`) | `prd-datamodell-supabase` (PRD 1) |
| `visiblePoiIds`/`collectionPoiIds` container-derivasjon (Zustand-kompass / collection-store) | `prd-board-skall-ui` (PRD 9) — injiseres til `BoardProvider`, reducer uendret |
| Explorer-i18n (`explorer-strings.ts`) | Explorer-PRD (utenfor board-scope) |

**Eksplisitt ikke-scope:** render-gating på `reportTier`. Verifisert: ingen `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`. Transformen og reduseren ser aldri tier. Ingen unit bygger tier-gating.

---

## 7. Implementation Units (7 av 7 dekket)

### Unit 1 — `adaptBoardData`-transform + board-typer (port, semantikk uendret)
- **Mål (→ G1):** Port `adaptBoardData` + alle board-lagets typer som ren, deterministisk transform med uendret verifisert semantikk. EIE det kanoniske type-hjemmet for de delte typene (`BoardCategoryId`/`BoardPOIId`/`BoardAudioTrack`) i `lib/board/board-types.ts`, re-eksportert fra `board-data.ts`.
- **Filer:** `components/variants/report/board/board-data.ts` (port), `lib/board/board-types.ts` (NY — kanonisk type-hjem for `BoardCategoryId`/`BoardPOIId`/`BoardAudioTrack`).
- **Avhengigheter:** PRD 1 (`POI`/`BrokerInfo`/`ReportThemeAudio`/`ReportThemeAudioTimings`/`ProjectAssetFlags` re-derives fra baseline), PRD 3 (`ReportData`/`ReportTheme`/`ThemeIllustration` fra `report-data.ts`). **`getProjectBrokers`/project-brand:** Unit 1 bygger mot project-brand TYPE-KONTRAKTEN (I/O-fri in-memory-oppslag, hoistbar til delt Lag-2 — som beat-signal-noden, `00-INDEX` note #5). Dette er en per-unit consume-edge, IKKE en hard board-blokker; PRD 9 leverer verdiene, men typen kan stubbes/hoistes. INDEX-deps (PRD 5 ← 01, 02, 03) står — PRD 9 er ingen board-blokker.
- **Akseptansekriterier:**
  - `adaptBoardData(report)` filtrerer bort tema med `allPOIs.length === 0` (`board-data.ts:172-173`); rekkefølge bevart.
  - lead/body-konkat dedupert mot lead, rekkefølge `upperNarrative → intro → bridgeText` (`board-data.ts:233-250`); `editorial` resolver highlight-POI-IDer mot kategoriens POIs og utelates når verken body eller resolvede highlights finnes (`board-data.ts:262-281`).
  - `poisById` bygges med LOWERCASE-nøkler på tvers av ALLE (ufiltrerte) `report.themes` (`board-data.ts:178-183`) — bevisst IKKE det tom-filtrerte `categories`-settet (`:172-173`), fordi grounding-lenker kan peke på POIs i tema som er filtrert bort fra navigasjonen. Invariant: tom-kategori-filteret (`allPOIs.length > 0`) gjelder navigasjons-`categories`, mens `poisById` dekker alle POIs (jf. §10 Q6).
  - `topRankedPois` (score-rangert, `theme.topRanked`) holdes ATSKILT fra `pois` (distanse-sortert) (`board-data.ts:294`/`297`).
  - `BoardAudioTimings` re-eksporteres fra `@/lib/types` (`board-data.ts:17`); komponenter importerer board-typer fra `board-data`, ikke `@/lib/types`.
  - `audioTourEnabled` settes (`board-data.ts:209`) men brukes IKKE som gating noensteds (dødt flagg bevart som felt).
  - Branded IDer (`BoardCategoryId`/`BoardPOIId`) bevart som arkitektur-invariant.
  - **Type-hjem:** `BoardCategoryId`/`BoardPOIId`/`BoardAudioTrack` DEFINERES i `lib/board/board-types.ts` (kanonisk hjem eid av denne PRD-en) og RE-EKSPORTERES fra `board-data.ts` (bakoverkompatibel import-flate). PRD 14 importerer dem fra type-hjemmet/re-eksporten — denne PRD-en flytter dem ikke til PRD 14.
  - **Foto-agnostisk (note #9):** transformen slipper `image`/`heroImage` (og POI-foto-felt) gjennom som nullable/optional og ANTAR ALDRI foto-tilstedeværelse — ingen kodesti krever et bilde, ingen krasj/feil ved manglende foto. No-photo-fallback-RENDRING (kategorifarge/ikon) eies av PRD 9, ikke her. (Foto-henting er DEFERRED, PRD 4 Unit 4/5.)
  - **v2-banking:** transform-laget leser fra v2-targetede kilder via PRD 1/3 (`ReportData` bygges fra v2 i PRD 3-stien). `prod-schema-snapshot.txt` er kolonne-REFERANSE, ikke live-prod-mål; referanse-board re-provisjoneres i v2.
  - `@/`-prefix for `@/lib/types`/`@/lib/board/board-types`/`@/lib/themes/project-brand`; intra-feature `../report-data` bevart (samme feature-mappe).

### Unit 2 — Eksporter `pickPlayableAudio` som single-source VO-seleksjon
- **Mål (→ G2):** Gjør `pickPlayableAudio` til eksportert single source for VO-seleksjon, konsumert av render-laget (PRD 9) + PRD 14 audio-store som ortogonalt data-presence-flagg.
- **Filer:** `components/variants/report/board/board-data.ts` (eksporter funksjon + avledet predikat).
- **Avhengigheter:** Unit 1.
- **Akseptansekriterier:**
  - `pickPlayableAudio(audio): BoardAudioTrack | undefined` EKSPORTERES; returnerer `{url, manus, timings?}` KUN når `url && manus.trim()` begge er sanne — semantikk KONSOLIDERT til trim-varianten: whitespace-only manus (`"   "`) regnes IKKE lenger som spillbart (i dag returnerer `board-data.ts:223` et track for whitespace; guarden oppdateres til å trimme, jf. §5.4 verifiserte divergens).
  - En avledet predikat `isPlayableAudio(a) = Boolean(a?.url && a?.manus?.trim())` eksporteres som ren boolesk seleksjons-test (uten å bygge et `BoardAudioTrack`); predikaten og `pickPlayableAudio`-guarden deler nøyaktig samme trim-betingelse (én sannhetskilde, ingen ny drift).
  - Kontrakt-note dokumenterer konsumentene: render-laget (PRD 9, viser VO betinget) + PRD 14 audio-store. **PRD 2 er IKKE en konsument** — nivå-2-readiness-sjekken sjekker IKKE VO, og den gamle `report-tier.ts`-duplikaten (`isPlayable:67`/`hasPlayableVO:74`) FJERNES i PRD 2 (selve slettingen lever i PRD 2). Eksport-grensen leveres her uavhengig.
  - VO-seleksjon er NIVÅ-UAVHENGIG; ingen `reportTier`-referanse introduseres.

### Unit 3 — Board-state-port (`useReducer`+`Context`, IKKE Zustand) + sub-kategori-filter
- **Mål (→ G3):** Port `boardReducer` + `BoardProvider` + selector-hooks + `use-sub-category-filter` (hard compile-time-dep til `BoardProvider`), med korrekt terminologi (reducer+context, ikke Zustand).
- **Filer:** `components/variants/report/board/board-state.tsx` (port), `components/variants/report/board/use-sub-category-filter.ts` (port verbatim — `BoardProvider` importerer den, `board-state.tsx:13-15`/`168`; uten den kompilerer ikke board-state-porten).
- **Avhengigheter:** Unit 1 (`BoardData`/`BoardCategoryId`/`BoardPOIId`/`BoardCategory` — `deriveSubCategories` tar `BoardCategory`).
- **Akseptansekriterier:**
  - `boardReducer` håndterer alle 7 actions (`SELECT_CATEGORY`/`OPEN_POI`/`BACK_TO_ACTIVE`/`BACK_TO_DEFAULT`/`RESET_TO_DEFAULT`/`START_INTRO`/`END_INTRO`, `board-state.tsx:42-49`) med uendrede transisjoner; `SELECT_CATEGORY` med `source` scroll/rail/index/audio holder `phase:"default"` (`board-state.tsx:65-69`); `BACK_TO_DEFAULT` beholder `activeCategoryId`, nullstiller `activePOIId`, setter `phase:"default"` (`board-state.tsx:100-108`).
  - **Spike-arv flagget (jf. §10 Q7):** `SelectCategorySource`-discriminatoren er selverklært spike (`board-state.tsx:33-34` «Unit 0 spike, full version in Unit 2»; `:61` «Spike: scroll-tracking... stay in default phase»); CARRY-OVER-MANIFEST.md:254-noten «kan forenkles». **Beslutning:** port verbatim i denne rebuilden (scroll-arven beholdes — den bærer en faktisk feedback-loop-vakt som board-skall-UI (PRD 9) avhenger av), men noter forenklings-muligheten som åpent spørsmål Q7 så «verbatim»-rammingen ikke skjuler at kilden erklærer seg ufullstendig.
  - `use-sub-category-filter.ts` portes verbatim: `deriveSubCategories` (ren) + `useSubCategoryFilter` (client-hook). Hookens `useEffect` (`use-sub-category-filter.ts:72`) er reset-på-kategori-bytte (`setHiddenIds(new Set())` på `[activeCategoryId]`), IKKE data-fetch — bryter IKKE CLAUDE.md-regelen (dokumenteres så reviewer ikke flagger feilaktig).
  - `BoardProvider` bruker `useReducer(boardReducer, initialBoardState)` (`board-state.tsx:167`) og `useSubCategoryFilter(state.activeCategoryId)` (`board-state.tsx:168`); INGEN `zustand`-import.
  - `visiblePoiIds`/`collectionPoiIds` forblir CONTAINER-NIVÅ context-felt injisert utenfra (`board-state.tsx:140`/`149`), IKKE reducer-actions; reducer-shapen er uendret.
  - Selector-hooks `useBoard`/`useActiveCategory`/`useActivePOI`/`useFilteredActiveCategory` eksporteres; `useActivePOI` (`board-state.tsx:208`) dokumenteres som board-versjon (kollisjon med `lib/store.ts:46`).

### Unit 4 — i18n-overlay-port (EN/NO + server-fetch)
- **Mål (→ G4):** Port `applyTranslations` + `getProjectTranslations` + `strings`/`themeQuestions` med arkitektur-konform datahenting.
- **Filer:** `lib/i18n/strings.ts` (port verbatim), `lib/i18n/apply-translations.ts` (port verbatim), `lib/supabase/translations.ts` (port; legg til `import 'server-only'`-vakt + `server-only`-dep; fjern `any`-cast når PRD 1-typer klare).
- **Avhengigheter:** PRD 1 (`translations`-tabell + `Project`-type + regenererte Supabase-typer), PRD 2 (tema-id-er — `themeQuestions`-nøkler matcher de samme tema-id-ene `adaptCategory` mapper på).
- **Akseptansekriterier:**
  - `applyTranslations(project, locale, translations)` — FAKTISK signatur (`project` FØRST, `apply-translations.ts:13`), IKKE `(locale, project, translations)`. NO eller tom map → uendret prosjekt (`apply-translations.ts:18-20`).
  - Overlay-nøkler matcher §5.3-tabellen verbatim, inkl. produkt-spesifikk→generisk bridge_text-fallback (`apply-translations.ts:40-42`).
  - `getProjectTranslations` kjøres SERVER-SIDE (RSC/server-action), ALDRI i klient-`useEffect`; bruker `@/lib/supabase`-wrapper (`isSupabaseConfigured`/`supabase`), ALDRI `@supabase/supabase-js` direkte; har eksplisitt error-håndtering (returnerer `{}` ved feil, `translations.ts:45-48`).
  - **Server-grensen HÅNDHEVES, ikke antas:** `lib/supabase/translations.ts` importerer `'server-only'` (Next.js-pakken — verifisert IKKE installert i dag, kun JSDoc-kommentar «SERVER ONLY» på `translations.ts:7`) slik at en klient-komponent som importerer modulen feiler ved build-time. Legg til `server-only` i `package.json` som del av denne porten. Dette gjør «server-side»-kontrakten til en build-time-vakt i stedet for en udokumentert antakelse om kalleren (PRD 9s kallekontrakt er ikke skrevet ennå).
  - `any`-cast (`translations.ts:39`) fjernes når PRD 1 leverer regenererte typer med `translations`-tabellen; til da beholdes `eslint-disable` med TODO som peker til PRD 1.
  - `t`/`getThemeQuestion`/`interpolate` portet; `themeQuestions` dekker bolig- + nærings-tema-id-er (`strings.ts:65-81`).

### Unit 5 — `bridge-text-generator`-port (template-basert, build-time)
- **Mål (→ G5):** Port generatoren verbatim som template-basert, build-time-modul.
- **Filer:** `lib/generators/bridge-text-generator.ts` (port verbatim).
- **Avhengigheter:** PRD 1 (`POI`/`Coordinates`-typer).
- **Akseptansekriterier:**
  - `generateBridgeText(themeId, pois, center, excludePOIIds?)` (`bridge-text-generator.ts:32`); returnerer `undefined` ved manglende generator eller tom POI-liste.
  - INGEN LLM / ingen `fetch`/`anthropic`/`gemini`/`process.env` (verifisert; CLAUDE.md: ALDRI runtime-LLM, build-time only).
  - `GENERATORS`-map forblir modul-privat; deterministisk per tema-id.
  - Kalt av PRD 3 i `report-data.ts:584` (`themeDef.bridgeText || generateBridgeText(...)`) — kontrakten bevares.

### Unit 6 — `category-score`-port (ren utils)
- **Mål (→ G6):** Port scoring + sitat-generering som ren utils uten I/O.
- **Filer:** `lib/utils/category-score.ts` (port verbatim).
- **Avhengigheter:** ingen (ren utils).
- **Akseptansekriterier:**
  - `normalizeCount`/`normalizeRating`/`normalizeProximity`/`normalizeVariety` + `calculateCategoryScore` (vektet, `category-score.ts:59`) + `generateCategoryQuote` (`category-score.ts:256`) eksportert; ingen I/O.
  - `CategoryScoreInput`/`CategoryScoreBreakdown`/`CategoryScore`-typer bevart.
  - Eneste konsument er `report-data.ts` (PRD 3, kall `:422`/`429`/`560`/`567`) — ingen ny konsument introduseres her.

### Unit 7 — Test-port + mekaniske porter
- **Mål (→ G7):** Bevis bevart semantikk for transform + reducer; alle porter grønne; dokumenter gotchas.
- **Filer:** `components/variants/report/board/board-data.test.ts` (port-with-rewrite), `components/variants/report/board/board-state.test.ts` (port-with-rewrite).
- **Avhengigheter:** Unit 1–6.
- **Akseptansekriterier:**
  - `board-data.test.ts` dekker: tom-kategori-filtrering, lead/body-konkat-dedup, editorial highlight-resolusjon + gating, `poisById` lowercase, `pickPlayableAudio` (url+manus krav), `topRankedPois`≠`pois`.
  - `board-state.test.ts` PORTERES + UTVIDES: eksisterende test dekker 6/7 transisjoner (`SELECT_CATEGORY`/`OPEN_POI`/`BACK_TO_ACTIVE`/`RESET_TO_DEFAULT`/`START_INTRO`/`END_INTRO` — verifisert: ingen `BACK_TO_DEFAULT`-describe i dag). Porten LEGGER TIL en `BACK_TO_DEFAULT`-transisjonstest (behold `activeCategoryId`, nullstill `activePOIId`, `phase→default`, `board-state.tsx:100-108`) for å nå full 7/7-dekning, og dekker `source`-discriminator (`stayInDefault`).
  - `use-sub-category-filter.test.ts` portes (dekker `deriveSubCategories` + `useSubCategoryFilter`-reset-på-kategori-bytte).
  - Ny test bekrefter at `isPlayableAudio` og `pickPlayableAudio` deler trim-betingelsen, og dekker EKSPLISITT det avvikende tilfellet: whitespace-only manus (`{url, manus: "   "}`) → `pickPlayableAudio` returnerer `undefined` og `isPlayableAudio` → `false` (regresjonsvern for §5.4-konsolidering — beviser at board-laget endrer seleksjon fra dagens whitespace-truthy til trim-varianten, og at de to predikatene matcher PRD 2s gamle `isPlayable`).
  - Dokumenter i test-/kode-kommentar: navnekollisjon `useActivePOI` (§5.5), dødt `audioTourEnabled`-flagg, faktisk `applyTranslations`-signatur (§10 Q3).
  - `npm run lint` (0 errors), `npm test`, `npx tsc --noEmit`, `npm run build` grønne.

> **Fullstendighet:** 7 av 7 units dekket. Hver keeper-fil i §4 har en navngitt port-unit (inkl. `use-sub-category-filter.ts` + test under Unit 3 — hard compile-time-dep til `BoardProvider`); hver eksportert symbol-gruppe (transform, VO-seleksjon, state, sub-kategori-filter, i18n, bridge-text, category-score) er eksplisitt portet og testet. Ingen sampling.

---

## 8. Utviklingsløp (faser)

### Fase 1 — Transform-kjerne + VO-seleksjon
- **Mål:** `adaptBoardData` + board-typer portet; `pickPlayableAudio` eksportert som single-source.
- **Leveranse:** Unit 1, 2, + transform-delen av Unit 7.
- **Autonomi-nivå:** Høy — ren funksjon, godt dekket av eksisterende `board-data.test.ts`. Avhenger av at PRD 1/3-typer er re-derived (`ReportData`/`POI`).

### Fase 2 — State + i18n + transform-input
- **Mål:** Reducer+context portet (korrekt terminologi); i18n-overlay + bridge-text + category-score portet med arkitektur-konform datahenting.
- **Leveranse:** Unit 3, 4, 5, 6 + reducer-delen av Unit 7.
- **Autonomi-nivå:** Middels — `getProjectTranslations` må forbli server-side (RSC), og `any`-cast-fjerningen koordineres med PRD 1s type-regenerering. Reducer-port er mekanisk.

### Fase 3 — Konsolidering + mekaniske porter
- **Mål:** `pickPlayableAudio` eksportert som single-source VO-seleksjon for render-laget (PRD 9) + PRD 14 audio-store; board-laget konsolidert til trim-varianten; alle mekaniske porter grønne. (PRD 2s gamle VO-duplikat fjernes der, men PRD 2 importerer ikke denne seleksjonen — den sjekker ikke VO.)
- **Leveranse:** Resten av Unit 7; eksport-grensen verifisert mot render/PRD 14-konsum.
- **Autonomi-nivå:** Høy — eksport-grensen er selvstendig her; ingen import-koordinering med PRD 2 kreves (PRD 2 er ikke en VO-konsument).

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | `board-data.ts` er fasade-laget mellom `@/lib/types` og komponenter; `BoardAudioTimings` re-eksporteres | Holder import-grafen flat (`board-data.ts:14-17`); komponenter rører ikke `@/lib/types` direkte |
| 2 | EKSPORTER `pickPlayableAudio` (+ avledet predikat) som single-source VO-seleksjon, OG konsolider semantikken til trim-varianten (whitespace-only manus = ikke spillbart) | De to call-sitene diverger i dag: `board-data.ts:223` rå truthiness (whitespace = spillbart) vs `report-tier.ts:67` `manus?.trim()` (whitespace = ikke spillbart). Trim-varianten er kanonisk (tomt manus er ikke et brukbart VO-spor); board-guarden oppdateres til trim slik at single-source ikke smitter et avvik. |
| 3 | Board-state forblir `useReducer`+`Context`, IKKE migreres til Zustand | Bevisst lokal navigasjons-state, ikke global; `00-INDEX`-«Zustand»-teksten er upresis (verifisert ingen zustand-import) |
| 4 | Behold `audioTourEnabled`-feltet i `BoardData`, men gjeninnfør ALDRI gating-bruk | Dødt flagg (`report-tier.ts:33`); gating = spillbar-VO-tilstedeværelse; å droppe feltet bryter `BoardData`-shapen PRD 6/9 leser |
| 5 | `applyTranslations`-signatur er `(project, locale, translations)` — FAKTISK kode, ikke brief-rekkefølge | Verifisert `apply-translations.ts:13`; brief oppga `(locale, project, translations)` — feil |
| 6 | `topRankedPois` (score) holdes ATSKILT fra `pois` (distanse) | PRD 6 bruker score-rangert anker-sett; kollaps ville degradere 3D-kuratering (`board-data.ts:101-104`) |
| 7 | `getProjectTranslations` kjøres server-side, supabase-wrapper, eksplisitt error-håndtering; server-grensen HÅNDHEVES via `import 'server-only'` (ikke bare JSDoc) | CLAUDE.md: ALDRI klient-fetch / ALDRI `@supabase/supabase-js` direkte / ALLTID error-håndtering; dagens `translations.ts:7` har kun kommentar, ingen build-time-vakt — klient-import ville ikke feile |
| 8 | `visiblePoiIds`/`collectionPoiIds` er container-nivå context-felt (injisert), ikke reducer-actions | Event-board-/collection-søm derivert utenfra; reducer-shapen forblir uendret (`board-state.tsx:140`/`149`) |
| 9 | `bridge-text-generator` forblir template-basert build-time (ingen LLM) | CLAUDE.md: ALDRI runtime-LLM; verifisert ingen fetch/LLM-kall |
| 10 | Explorer-i18n (`explorer-strings.ts`) er reference-only, ikke i board-scope | Board er Report-only; Explorer-strings hører til en Explorer-PRD (jf. Q4) |

### Kontroll-runde 2026-06-27

- **`pickPlayableAudio` finnes allerede, mangler kun `export` (NYANSERT, bekreftet).** Verifisert: funksjonen lever på `board-data.ts:220` og konsumeres modul-internt (`:196`/`:199`/`:200`/`:298`/`:299`); Unit 2-jobben er KUN å gjøre den til `export function` (+ eksportere avledet `isPlayableAudio`). PRD 5 eier eksporten. Konsumentene er render-laget (PRD 9) + PRD 14 audio-store — VO er et ortogonalt data-presence-flagg. **PRD 2 er IKKE en konsument:** den gamle `report-tier.ts`-VO-duplikaten (`isPlayable:67`/`hasPlayableVO:74`) er en relikt fra nivå-3-gatingen og FJERNES i PRD 2 (nivå-2-readiness sjekker ikke VO). Presisert i §10 Q2 + nedstrøms-kontrakt-kart (§3).
- **`board-establishing-shots` har INGEN mottaker i PRD 5 (AVKREFTET).** Verifisert: `board-data.ts` konsumerer IKKE establishing-shots (0 referanser). En tidligere foreslått «PRD 5 = mottaker for establishing-shots»-peker var dangling og er ikke en del av denne PRD-en. DATAEN hjemles i PRD 9 (sammen med camera-tours/board-intros-DATA), MEKANISMEN (`getEstablishingShot`) i PRD 6 — ingen av delene berører PRD 5s scope. Ingen brødtekst i denne fila påstod dette, så ingen kirurgisk retting var nødvendig her (jf. issues).

---

## 10. Åpne spørsmål

1. **`00-INDEX` linje 29 «Zustand board-state».** VERIFISERT FEIL: `board-state.tsx` er `useReducer`+`Context` (`:152`/`167`), ingen zustand-import. **Anbefaling (landet):** behold reducer+context (bevisst lokal nav-state); rett `00-INDEX`-teksten til «reducer+context board-state». Ikke-blokkerende for Fase 1.
2. **`pickPlayableAudio`-eksport + VO-konsumenter.** Default landet: EKSPORTER her (Unit 2). **LØST (kontroll-runde 2026-06-27, oppdatert audit 2026-06-28):** Verifisert at `pickPlayableAudio` finnes i dag (`board-data.ts:220`) men mangler `export` (konsumeres modul-internt på `:196`/`:199`/`:200`/`:298`/`:299`); Unit 2 legger til `export`. **Konsumenter:** render-laget (PRD 9, viser VO betinget) + PRD 14 audio-store — VO er et ortogonalt data-presence-flagg, NIVÅ-UAVHENGIG. **PRD 2 er IKKE en konsument:** i to-nivå-modellen sjekker den lette nivå-2-readiness-sjekken IKKE VO. Den gamle `report-tier.ts`-VO-duplikaten (`isPlayable:67`/`hasPlayableVO:74`) er en relikt fra nivå-3-gatingen og FJERNES i PRD 2. Status: eksport-grensen lukket her; PRD 2 importerer den ikke.
3. **`applyTranslations`-signatur.** Bekreftet: bruk faktisk kode-signatur `(project, locale, translations)` (`apply-translations.ts:13`). Lukket.
4. **`explorer-strings.ts`-scope.** `00-INDEX` linje 73 sier «lib/i18n/*» foldes inn her, men board er Report-only. **Default landet:** Explorer-strings er reference-only i denne PRD-en; tas i en Explorer-PRD. Bekreft at ingen board-konsument leser `ExplorerStrings`.
5. **`any`-cast i `translations.ts:39`.** Avhenger av at PRD 1 leverer regenererte Supabase-typer inkl. `translations`-tabellen. Bekreft at type-regenerering er i PRD 1-scope (PRD 1 Unit 6 re-genererer DB-typer) — da fjernes castet i Unit 4.
6. **Tom-kategori-filter for alle profiler.** `categories` filtreres på `t.allPOIs.length > 0` (`board-data.ts:172`). Bekreft at filter-regelen holder for bolig/næring/event — en event-/nivå-2-kategori som er tom etter filter faller ut av boardet (bevisst i dag; bekreft at det er ønsket for alle profiler). **Knyttet invariant (§5.1):** `poisById` respekterer bevisst IKKE dette filteret — det bygges fra ufiltrerte `report.themes` (`board-data.ts:178-183`) så grounding-lenker kan resolve POIs i bortfiltrerte tema. Filter-beslutningen og `poisById`-dekningen må vurderes sammen: endrer man filteret må man bekrefte at kryss-kategori-grounding fortsatt resolver korrekt.
7. **`SelectCategorySource`-discriminator = spike-arv.** Kilden erklærer seg ufullstendig: `board-state.tsx:33-34` «Unit 0 spike, full version in Unit 2» og `:61` «Spike: scroll-tracking... stay in default phase»; CARRY-OVER-MANIFEST.md:254 «kan forenkles». **Default landet:** port verbatim (scroll-arven er en aktiv feedback-loop-vakt PRD 9 lener seg på), men flagg som mulig forenklings-unit/PRD når PRD 9s board-skall-konsum er kjent. Bekreft at ingen PRD 9-konsument trenger en utvidet source-taksonomi før forenkling vurderes.

---

## 11. Avhengigheter (PRD-graf)

```
        PRD 1 — datamodell-supabase        PRD 2 — nivå-readiness                   PRD 3 — provisjon
        (POI/ReportThemeAudio/             (taksonomi tema-id-er;                   (ReportData/ReportTheme
         translations-tabell/Project;       lett nivå-2-readiness-sjekk;            = INPUT til adaptBoardData;
         regenererte DB-typer)              sjekker IKKE VO)                        kaller bridge-text + category-score)
              │                                   │                                        │
              └─────────────────┬─────────────────┴────────────────────┬──────────────────┘
                                ▼                                        ▼
                    ┌──────── PRD 5 — prd-board-data-state (DENNE) ────────┐
                    │  adaptBoardData + BoardData-typer + pickPlayableAudio │
                    │  + boardReducer/Context + i18n + bridge-text + score  │
                    └───────────────┬───────────────────┬─────────────────┘
                                    ▼                    ▼                    ▼
                          PRD 6 — 3d-motor      PRD 9 — board-skall-ui   PRD 13 — instrumentering
                          (leser BoardData;     (BoardProvider-konsum;   (emit-sites; poisById/
                           topRankedPois-anker)  hooks; injiserer        BoardPOI som event-payload)
                                                  visible/collection;
                                                  konsumerer VO-seleksjon)
```

> **project-brand/getProjectBrokers er IKKE en board-blokker.** PRD 9 leverer project-brand-VERDIENE, men Unit 1 bygger mot project-brand TYPE-KONTRAKTEN (I/O-fri in-memory, hoistbar til delt Lag-2 — som beat-signal-noden, `00-INDEX` note #5). Dette er en per-unit consume-edge som kan stubbes/hoistes — det bryter IKKE PRD-grafen, og PRD 9 står IKKE blant board-blokkererne under.

**Blokkeres av:** PRD 1, PRD 2, PRD 3. (PRD 9 er IKKE en board-blokker — project-brand er en hoistbar type-kontrakt, se NB over.)
**Blokkerer:** PRD 6 (3d-motor), PRD 9 (board-skall-ui), PRD 13s emit-site-wiring (IKKE PRD 13-kjernen — den bygges tidlig/uavhengig per `00-INDEX:37` «Kjerne TIDLIG+serielt; emit-sites wires inn med board-PRD-ene», deps `01 (→05, 09)`; kun emit-site-wiringen avhenger av PRD 5, jf. `00-INDEX:57`). Beads-grafen skal IKKE serialisere hele PRD 13 etter PRD 5.
**Eksporterer til (eier ikke konsumet):** `pickPlayableAudio` → PRD 9 (render) + PRD 14 (audio-store) som single-source VO-seleksjon (ortogonalt data-presence-flagg). PRD 2 konsumerer den IKKE.

---

**Fullstendighet:** 7 av 7 implementation units spesifisert med avhengigheter + akseptansekriterier; 7 av 7 mål (G1–G7) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i faktisk kode (`board-data.ts`, `board-state.tsx`, `apply-translations.ts`, `translations.ts`, `strings.ts`, `bridge-text-generator.ts`, `category-score.ts`, `report-tier.ts`, `report-data.ts`, `lib/store.ts`), prod-schema (`prod-schema-snapshot.txt:234-241`) eller manifest/INDEX-linjer. Ingen P0/P1/P2-tiers; deferred work under Scope Boundaries med PRD-pekere; ingen render-gating spesifisert.
