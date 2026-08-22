---
title: "feat: FAQ-seksjon per kategori i nivå 1-boardet (Lokalkunnskap i tekst)"
type: feat
status: completed
date: 2026-08-22
origin: docs/brainstorms/2026-08-22-faq-lokalkunnskap-niva1-requirements.md
---

# feat: FAQ-seksjon per kategori i nivå 1-boardet

## Overview

Nivå 1-boardet får en FAQ-seksjon per kategori-drill-in og en slank global nabolags-FAQ — spørsmål/svar slik en megler ville svart på visning for akkurat denne adressen. Svarene produseres i to lag: en deterministisk kjerne fra data vi eier (Udir-register, skolekretspolygoner, POI-pool, reisetider, ny build-time Entur-transitt), og et kuratert lag per strøk som overstyrer per spørsmål der strøket er kuratert. Konseptet bevises i en worktree-demo på Strindfjordveien 10 (ranheim-strøket).

## Problem Frame

Nivå 2-boardets verdi er «megleren forteller». Nivå 1 (automatisk default) klarer i dag ikke å svare på visnings-spørsmålene: *hvilken skolekrets sogner boligen til, hvor er nærmeste holdeplass, hvilke barnehager finnes*. Spørsmålsbanken finnes allerede (`lib/editorial/category-specs.ts`, med kilde per spørsmål og `tekst`/`board`-lag-skille), men board-laget — adresseavhengige svar — har ingen render-flate. FAQ-en er den flaten. (Se origin-dokumentet for full ramme og review-historikk.)

## Requirements Trace

Fra origin (R-nummer = origin-dokumentets):

- R1/R2: FAQ per kategori i drill-in; spørsmålsbank = category-specs, utvidet med transport-spec + tema↔kategori-mapping.
- R3: To-lags svar; spørsmål uten kildesvar utelates — aldri dikting.
- R4: Kategoritekst krympes til kort intro der FAQ-en bærer substansen — med degradasjonsregel (se Key Technical Decisions).
- R5/R6: Slank global FAQ med lenker inn i kategoriene.
- R7/R8: Klikkbare POI-referanser som flyr kartet; ikke-koblbare elementer omtales i ren tekst.
- R9: Desktop-panel + mobil-sheet, adaptive mønstre.
- R10: Build-time only — ingen runtime-LLM.
- R11: Worktree-demo på Strindfjordveien 10, ranheim, uten reels-lyd.
- Suksesskriterier: skolekrets-svaret (Ranheim 1.–7. / Charlottenlund u-skole / Charlottenlund vgs. + bussavstand), holdeplass/linje-svar, klikkbar POI-referanse, global FAQ med kategorilenke, sporbarhet, to-lags synlig for evaluering, ukuratert-adresse-inspeksjon, mobil-verifisering.

## Scope Boundaries

- Ingen linjer/områder i kartet (turstier, grøntdrag) — kun punkt-POI-er kobles.
- Ingen runtime-LLM, ingen «still et spørsmål»-felt.
- Kun Report-boardet.
- «Verdt å merke seg»-presentasjonen (`HighlightsDisclosure`) endres ikke.
- Engelsk oversettelse av FAQ-innhold er utenfor demo-scope (norsk først; TranslationMap-mønsteret finnes for senere).

### Deferred to Separate Tasks

- Pipeline-integrasjon for alle nye boards + backfill — etter demo-evaluering (origin). Må inkludere **refresh-policy for transitt-fakta** (re-kjøring av transitt-steget ved AtB-ruteendring / halvårlig, og en maks-alder-vurdering): fakta hentes én gang ved provisjonering og forvitrer ellers stille — `fetchedAt`-stempelet (Unit 2) er forutsetningen for stale-vurderingen.
- VO-board-gapet (drill-in unåbar med reels-lyd) — må løses før FAQ blir minimum-garanti (origin).
- Tursti-/grøntdrag-geometri — etter validering (origin).
- Moat 2-måling av hvilke FAQ-spørsmål som åpnes — tas inn ved pipeline-integrasjon (review-FYI).

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/reels/DesktopStorySidebar.tsx` — `CategoryDetailView` (desktop drill-in, empty-state uten reels-lyd). FAQ-slot: mellom prosa-blokken og `HighlightsDisclosure`.
- `components/variants/report/board/neighbourhood/CategoryPage.tsx` — mobil drill-in (push-panel, `PANEL_FRACTION` 58 %). Samme editorial-datakilde.
- `components/variants/report/board/board-state.tsx` — board-reducer; `{ type: "OPEN_POI", id, categoryId? }` er kart-fly-mekanismen (mønster: `HighlightsDisclosure.tsx`), `SELECT_CATEGORY` for kategorilenker.
- `components/variants/report/board/board-data.ts` — `adaptCategory` (`editorial ?? generated`, lead-avledning linje ~427); FAQ-data rir samme adapterkjede.
- `lib/generators/bridge-text-generator.ts` — presedens for deterministisk render-tids tekstgenerering per tema.
- `lib/editorial/category-specs.ts` — spørsmålsbanken (`SpecQuestion.lag: "tekst" | "board"`); `lib/editorial/udir-register.ts` (`fetchKommuneEnheter`, `videregaaende`, `KOMMUNENR_TRONDHEIM`).
- `lib/pipeline/provision.ts` — 10 serielle steg; nytt transitt-steg hører hjemme etter steg 7 (travel-times). `lib/pipeline/patch-product-config.ts` (`patchProductConfigWithLock`) for atomiske config-skriv.
- `app/api/entur/route.ts` — ferdige GraphQL-queries (`DEPARTURES_QUERY` per quay med linje-publicCode, `TRIP_QUERY` fra→til) mot `api.entur.io/journey-planner/v3` — kopieres inn i build-time-modul.
- `lib/utils/school-zones.ts` — `getSchoolZone(lat,lng)` server-side; resultatet ligger som `project.schoolZone`.
- Tema↔kategori-mapping finnes: `ReportThemeConfig.categories` + `lib/themes/bransjeprofiler.ts` + `resolveThemeId`.
- Lagring: `products.config.reportConfig.themes[]` JSONB (grounding-mønsteret, Zod ved render, versjons-bump + `revalidateTag`); kuratert per strøk i `v2.areas.report_editorial` arvet via `lib/pipeline/inherit-area-editorial.ts`.
- POI-lenke-markup: konvensjonen `[tekst](poi:id)` finnes (skrives av `lib/curation/poi-linker.ts`) og lookup-mappen `BoardData.poisById` finnes — men **render-side parser finnes IKKE** (`NarrativeBody` i `POIExploreModal.tsx` rendrer kun tekstnoder). Parseren er nybygg og eies av Unit 5. OBS: `poisById`-nøkler er lowercased (`board-data.ts:249`) — oppslag må skje med `id.toLowerCase()`.

### Institutional Learnings

- `docs/solutions/integration-issues/entur-quay-direction-grouping-Report-20260410.md` — `estimatedCalls` blander retninger; grupper på quay. Obligatorisk for troverdige linjesvar.
- `docs/solutions/ui-bugs/poi-ids-heterogeneous-not-uuid-20260428.md` — POI-id-er er frie strenger (`google-ChIJ…`, `entur-NSR-…`); UUID-antakelse blanket 6/7 temaer stille. Gjelder poi:-href-parsing.
- `docs/solutions/ux-improvements/poi-click-no-camera-move-20260207.md` — tekstklikk → kamerafly er riktig; markerklikk skal ikke flytte kamera.
- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — lagrings-/versjonerings-/lenkemønsteret FAQ-en gjenbruker.
- `docs/solutions/best-practices/editorial-hooks-no-perishable-info-20260208.md` — ferskvare (linjer, frekvenser, tider) hører i det deterministiske laget, aldri i det kuraterte.
- `docs/solutions/ui-patterns/transit-dashboard-card-accordion-tabs-20260416.md` — urban vs. forstad krever adaptiv transport-layout.
- `docs/solutions/feature-implementations/curator-text-types-bridge-extended-hero-20260303.md` + `best-practices/ai-text-quality-4-layers-20260303.md` — kuratert tekst går gjennom curator-skillen som formalisert teksttype.
- `docs/solutions/workflow-issues/parallel-sessions-require-worktrees-20260208.md` — worktree-hygiene for demoen (setup-script, egen port).
- `docs/solutions/ui-patterns/spoersmaalskort-report-hero-redesign-20260303.md` — spørsmålskort-mønsteret («Er det bra for barna?») finnes; global FAQ skal harmonere, ikke konkurrere.

## Key Technical Decisions

- **Fakta lagres, tekst monteres ved render** (deterministisk lag): pipelinen henter og lagrer *fakta* (transitt, vgs-reisetider) i `themes[]`-config; selve FAQ-svarteksten genereres deterministisk ved render fra fakta + schoolZone + POI-pool — samme modell som `bridgeText`. Rasjonale: maler kan itereres uten re-provisjonering, og «boardet regner ut selv»-prinsippet fra category-specs holdes.
- **Kuratert lag = ferdige svar per spørsmåls-id, overstyrer per spørsmål, usynlig skille** (Andreas 2026-08-22): kuratert svar vinner over deterministisk på samme id og kan legge til egne id-er; sluttbrukeren ser én sømløs stemme. Ferskvare-regelen: linjer/tider/frekvenser kun i deterministisk lag.
- **Degradasjonsregel** (Andreas 2026-08-22): kategoriteksten krympes til kort intro **bare** når FAQ-en har ≥3 svar for kategorien; ellers beholdes dagens fulle tekst. Konstant, lett justerbar.
- **Accordion med husets disclosure-mønster** (avledet fra etablert prinsipp): default lukket, flere kan være åpne, max-height-animasjon, ingen auto-scroll ved expand.
- **Mobil: peek + kartfly, modal på nytt trykk** (Andreas 2026-08-22): klikk på POI-referanse i FAQ-svar kollapser panelet til peek og flyr kartet; utforsk-modalen (`POIExploreModalHost` — mobilens ordinære POI-flate, som ellers åpner direkte på POI-tap) åpnes IKKE av FAQ-klikket, men først ved påfølgende trykk på selve POI-en. OBS: peek-tilstanden er **nybygg** — `CategoryPage` har i dag fast `PANEL_FRACTION` uten collapse/peek, og modal-unntaket for FAQ-kilden må bygges eksplisitt.
- **POI-referanser**: gjenbruk `[tekst](poi:id)`-markupen fra grounding; id-er valideres som frie strenger, aldri UUID. Referanser til POI-er utenfor boardets sett rendres som ren tekst (degrader, aldri sensurer).
- **Transitt-oppslag med representativt avreisetidspunkt**: tidspunktet beregnes som *neste hverdag kl. 08:00* ved kjøring (skolevei-realisme) og lagres som metadata sammen med `fetchedAt` — for sporbarhet, ikke for identisk re-query: et lagret absolutt tidspunkt havner i fortiden/utenfor Enturs ruteplan-vindu, så re-generering velger nytt tidspunkt og kan gi legitimt nye svar (AtB-ruteomlegging). Queryene i `app/api/entur/route.ts` er sanntids-orienterte og må **tilpasses med tidsparametre** (`TRIP_QUERY` + `$dateTime`, `DEPARTURES_QUERY` + `startTime`/`timeRange`) — de kan ikke kopieres som de står.
- **Global FAQ**: bygges på board-nivå fra to kilder — (1) kuratert karakteristikk-svar («hva kjennetegner området?») som lever i den NYE faq-strukturen under en reservert `global`-nøkkel i `report_editorial` (samme skjema-utvidelse som Unit 3; `superRefine`-valideringen får carve-out for nøkkelen; forfattes i Unit 7 — feltet finnes ikke i dag), og (2) transitt-fakta («hvordan kommer jeg meg til byen?», deterministisk). Svar lenker til kategorier via `SELECT_CATEGORY`.
- **Norsk først**: ingen oversettelse i demo; TranslationMap-nøkkelmønsteret er dokumentert vei senere. Boardets språk styrer, aldri nettleserens (commit 61b56e9).

## Open Questions

### Resolved During Planning

- Accordion vs. flat liste → accordion, husets disclosure-prinsipp (se Key Technical Decisions).
- Sheet-tilstand ved POI-klikk på mobil → panelet viker (peek), kartflyet synlig.
- Degradasjonsregel → full tekst som fallback ved <3 svar (Andreas).
- Kuratert lag → overstyrer per spørsmåls-id, usynlig skille (Andreas).
- Lagringsformat → fakta i `themes[]`-config (grounding-mønsteret), kuraterte svar i `areas.report_editorial`, tekstmontering ved render.
- POI-referanse-markup → `[tekst](poi:id)` (finnes).
- Tema↔kategori-mapping → `ReportThemeConfig.categories`/bransjeprofiler (finnes).
- Setningsmal-fella → én svarform PER kategori-spec (aldri felles mal på tvers); build-time LLM-språkvask er lovlig opsjon hvis malene likevel klinger maskinelt, men prøves ikke først.

### Deferred to Implementation

- Eksakte svar-maler per spørsmål — formuleres mot ekte Ranheim-data under bygging, ikke på forhånd.
- Om transitt-fakta trenger egen Zod-versjon (`transitFactsVersion`) eller rir på eksisterende config-validering — avgjøres når felt-formen er konkret.
- Nøyaktig peek-høyde/gest på mobil-panelet — justeres mot faktisk kart-utsnitt.
- Hvilket av de overlappende strøkene (ranheim/charlottenlund) geofencen velger for adressen — verifiseres med faktisk geokoding før provisjonering.

## Implementation Units

### Fase 1 — Datagrunnlag

- [x] **Unit 1: Transport-spec + FAQ-utvalg i spørsmålsbanken**

**Goal:** Spørsmålsbanken dekker transport og eksponerer hvilke spørsmål som hører i board-FAQ-en, med tema-mapping.

**Requirements:** R1, R2.

**Dependencies:** Ingen. (Forutsetning: `lib/editorial/` committes på feat/scout-ranheim først — se Risks.)

**Files:**
- Modify: `lib/editorial/category-specs.ts`
- Test: `lib/editorial/category-specs.test.ts`

**Approach:**
- Ny `TRANSPORT_SPEC` med board-lag-spørsmål (nærmeste holdeplass, hvilke linjer/retninger, reisetid til sentrum) og register/eget-kilder; utvid eksisterende specs (skole, barnehage, dagligvare, restaurant) med de board-lag-spørsmålene som gir mening (f.eks. «hvor lang gange til nærmeste?» fra travel_times).
- Helper `faqQuestionsForTheme(themeId, categoryIds)` som slår opp specs via temaets kategoriliste (`ReportThemeConfig.categories`) og returnerer board-lag-spørsmål i definert rekkefølge.
- Én svarform per kategori-spec (setningsmal-fella) — spec-en bærer formen, ikke en felles mal.

**Patterns to follow:** eksisterende `CategorySpec`-struktur og kommentarkonvensjonen (datert «hvorfor»-prosa); `scripts/verify-category-ids.ts` skal fortsatt passere.

**Test scenarios:**
- Happy path: `faqQuestionsForTheme("transport", [...])` returnerer transport-spec-spørsmålene i rekkefølge.
- Happy path: tema med flere kategorier (barn-oppvekst → skole+barnehage) flettes uten duplikater.
- Edge case: tema uten spec-dekning (opplevelser) → tom liste, ikke feil.
- Edge case: theme-id-alias (via `resolveThemeId`) treffer riktig spec.

**Verification:** `verify-category-ids` og eksisterende spec-tester grønne; nye spørsmål har `lag: "board"` og kilde satt.

- [x] **Unit 2: Build-time transitt-fakta fra Entur**

**Goal:** Deterministiske transitt-fakta per board: nærmeste holdeplasser med linjer gruppert per quay/retning, og buss-reisetider fra adressen til sentrum og til vgs.-listen for kommunen.

**Requirements:** R3, R10; skole- og transport-suksesskriteriene.

**Dependencies:** Ingen (parallell med Unit 1).

**Files:**
- Create: `lib/pipeline/transit-facts.ts`
- Test: `lib/pipeline/transit-facts.test.ts`

**Approach:**
- Ren kjerne + IO-skall (som `udir-register.ts`): GraphQL-queries kopieres/tilpasses fra `app/api/entur/route.ts` (`DEPARTURES_QUERY` for linjer per quay, `TRIP_QUERY` for reisetider), `ET-Client-Name`-headeren beholdes.
- Quay-retningsgruppering er obligatorisk (learning 20260410).
- Nærmeste holdeplasser hentes med `GetNearbyStopPlaces`-queryen fra `lib/pipeline/poi-discovery.ts` (deles/kopieres) — den returnerer rå NSR-id-er med kolon, klare for `DEPARTURES_QUERY`. Aldri reverser id fra pool-POI-id-er (kolon→bindestrek-transformasjonen i `generatePoiId` er ikke en kontrakt).
- Vgs.-liste via `fetchKommuneEnheter("skole", kommunenr)` filtrert på `videregaaende: true`; trip-oppslag **per vgs i listen** (origin-kriteriet krever flertall: «byens øvrige vgs.-tilbud») med det beregnede avreisetidspunktet.
- Alle fakta stemples med `fetchedAt` + valgt avreisetidspunkt — stale-vurdering skal være mulig senere (se Deferred: refresh-policy).
- Fail-soft: `{ facts, warnings }`, aldri throw; delvise fakta er gyldige.

**Test scenarios:**
- Happy path: parse av ekte lagret journey-planner-respons → linjer gruppert per quay/retning.
- Happy path: trip-respons → reisetid i minutter (`Math.ceil`, samme konvensjon som travel-times).
- Edge case: stoppested med én quay/én retning → flat struktur uten tom gruppering.
- Error path: nettverksfeil/timeout → tomme fakta + warning, ikke exception.
- Edge case: kommune uten vgs.-treff i registeret → vgs.-delen utelates, resten består.

**Verification:** modulen kan kjøres isolert mot Strindfjordveien 10-koordinater og gir holdeplass+linjer+vgs-tider som stemmer med manuelt Entur-oppslag.

- [x] **Unit 3: Pipeline-steg + lagring av fakta og kuratert FAQ-arv**

**Goal:** Provisjoneringen beriker boardet med transitt-fakta, og kuraterte FAQ-svar per strøk arves inn i board-config.

**Requirements:** R3, R10, R11.

**Dependencies:** Unit 2.

**Files:**
- Modify: `lib/pipeline/provision.ts`
- Modify: `lib/pipeline/inherit-area-editorial.ts`
- Modify: `lib/pipeline/area-staging.ts` (utvid `ThemeEditorialStagingSchema` med valgfritt `faq`-felt + Zod-form for FAQ-entry; carve-out i `superRefine` for reservert `global`-nøkkel; strict beholdes for øvrige nøkler)
- Modify: `lib/pipeline/apply-area-staging.ts` (/curate-area-skriveveien må godta feltet)
- Modify: `lib/types.ts` (nye felt på `ReportThemeConfig`: transitt-fakta + FAQ-overlays; type for kuratert FAQ-entry i `report_editorial`)
- Test: `lib/pipeline/area-staging.test.ts`
- Test: nytt steg-kolokalisert testfil for transitt-steget

**Approach:**
- **Skjema-utvidelsen skjer FØR noe skrives til ranheim-raden**: `ThemeEditorialStagingSchema` er `.strict()`, og et ukjent `faq`-felt gjør i dag at HELE tema-entryen (inkl. body og highlights) hoppes over med warning ved arv — en stille regresjon på eksisterende kuratert innhold.
- Nytt fail-soft steg etter travel-times (steg 7): hent transitt-fakta, skriv atomisk via `patchProductConfigWithLock` (aldri delvis skriv — mønster fra editorial-arven).
- `inherit-area-editorial` utvides til å kopiere `report_editorial[themeId].faq` (kuraterte svar per spørsmåls-id — merk: `report_editorial` er en Record per tema-id, ingen themes-array) og den reserverte `global`-nøkkelen når strøket har dem.
- Cache-busting: eksisterende `revalidateTag("product:${customer}_${slug}")`-mønster.

**Test scenarios:**
- Happy path: provisjonering med mocket Entur → fakta ligger i `themes[]`-config etter kjøring.
- Error path: Entur-steget feiler → provisjonering fullfører med warning, board uten transitt-fakta.
- Integration: strøk med kuratert FAQ i `report_editorial` → svarene ligger i config etter arv-steget; strøk uten → feltet utelatt.
- Integration: tema-entry MED `faq`-felt passerer staging-validering, og body/highlights arves fortsatt (regresjonsvern mot strict-skjemaet).
- Edge case: re-kjøring av steget overskriver gamle fakta (idempotent), låsemønsteret hindrer tapte skriv.

**Verification:** provisjonering av testboard viser fakta + ev. kuratert FAQ i config; ingen steg-rekkefølge endret for eksisterende steg.

### Fase 2 — Montering og render

- [x] **Unit 4: Deterministisk FAQ-generator + to-lags montering**

**Goal:** Render-tids generering av FAQ-svar fra lagrede fakta, flettet med kuraterte overstyringer, levert render-klart gjennom adapterkjeden — inkl. lead-krymping med degradasjonsregel og global FAQ.

**Requirements:** R3, R4, R5, R6.

**Dependencies:** Unit 1, Unit 3.

**Files:**
- Create: `lib/generators/faq-generator.ts`
- Test: `lib/generators/faq-generator.test.ts`
- Modify: `components/variants/report/report-data.ts` (montering i `transformToReportData`)
- Modify: `components/variants/report/board/board-data.ts` (`BoardCategoryEditorial` får `faq`; `adaptCategory`-lead-regel; board-nivå `globalFaq`)

**Approach:**
- Generatoren speiler `bridge-text-generator.ts`: input = spec-spørsmål (Unit 1) + schoolZone + travel_times + POI-pool + transitt-fakta; output = svar per spørsmåls-id med `[tekst](poi:id)`-referanser. Mangler faktum → spørsmålet utelates (aldri dikt).
- Fletting: kuratert svar (fra config, Unit 3) vinner per id; kuraterte ekstra-id-er legges til. Kilde-merking (`deterministic`/`curated`) beholdes internt for demo-evaluering, rendres ikke.
- Lead-krymping: ≥3 FAQ-svar → kort intro (1–2 setninger); ellers dagens fulle body (degradasjonsregelen).
- Global FAQ: «hva kjennetegner området?» fra den reserverte `global`-nøkkelen i strøkets `report_editorial`-faq (kun der den finnes — kuratert innhold, jf. Key Technical Decisions), «hvordan kommer jeg meg til byen?» fra transitt-fakta; svar kan bære kategorilenke-referanser.
- Vgs.-svaret formuleres som nærhet/reisetid («nærmeste videregående er X, Y min med buss») — **aldri** som kretstilhørighet: `schoolZone` dekker kun barne- og ungdomsskole, og vgs.-inntak er ikke kretsbasert. Kun grunnskole kan få «sogner til»-formulering.

**Test scenarios:**
- Happy path: full faktapakke → skolekrets-svar navngir riktig barne-/ungdomsskole fra schoolZone + vgs-tid.
- Happy path: kuratert svar på samme id overstyrer deterministisk; kuratert ekstra-id appendes.
- Edge case: <3 svar i en kategori → `lead`/body uendret fra dagens oppførsel (regresjonsvern).
- Edge case: POI-referanse til id utenfor boardets sett → ren tekst uten lenke.
- Edge case: board uten transitt-fakta (Entur feilet) → transport-FAQ utelatt, ingen crash.
- Edge case: adresse utenfor kretsdekning (schoolZone null) → krets-spørsmål utelatt stille.
- Integration: `adaptBoardData` leverer `faq` på kategorier og `globalFaq` på boardet for et realistisk config-fixture.
- Edge case: svarform varierer mellom kategorier (ingen felles åpningsmal på tvers — setningsmal-vern, asserted på malnivå).

**Verification:** generatoren produserer sporbare svar (hvert svar kan pekes til register/beregning/kuratert kilde) for ranheim-fixture.

- [x] **Unit 5: Desktop-UI — FAQ i CategoryDetailView + global FAQ i sidebar**

**Goal:** FAQ-accordion i desktop-drill-in med klikkbare POI-referanser som flyr kartet, og slank global FAQ på sidebar-forsiden.

**Requirements:** R1, R5, R6, R7, R8, R9.

**Dependencies:** Unit 4.

**Files:**
- Create: `components/variants/report/board/FAQSection.tsx` (delt komponent, flate-agnostisk innhold)
- Create: `lib/board/poi-link-text.ts` (parser for `[tekst](poi:id)` i svartekst — nybygg, se Context-notatet)
- Test: `components/variants/report/board/FAQSection.test.tsx`
- Test: `lib/board/poi-link-text.test.ts`
- Modify: `components/variants/report/reels/DesktopStorySidebar.tsx` (slot mellom prosa og `HighlightsDisclosure`; global FAQ i `SidebarContentPreview`)

**Approach:**
- Accordion: default lukket, flere åpne samtidig, max-height-animasjon, ingen auto-scroll ved expand (husets prinsipp).
- POI-lenke-parseren bygges som ren modul: parse `[tekst](poi:id)` fra svartekst, resolve mot `poisById` med `id.toLowerCase()` (nøklene er lowercased), render klikkbart element → `onOpenPoi`-prop (samme prop-mønster som `HighlightsDisclosure`, ikke egen dispatch); miss → ren tekst.
- POI-referanser i svartekst → `boardDispatch({ type: "OPEN_POI", id, categoryId })` via `onOpenPoi`; kategorilenker i global FAQ → `SELECT_CATEGORY`.
- Kategori uten svar → seksjonen utelates helt (ingen tom overskrift). Samme regel på board-nivå: global FAQ-seksjonen utelates helt når verken kuratert karakteristikk-svar eller transitt-fakta finnes.
- Inline POI-lenker i løpende svartekst skal ha minimum treffflate (økt padding/line-height rundt lenketeksten) og være tastaturnåbare/aktiverbare i naturlig lesrekkefølge — de er ikke frittstående rader som Highlights-chipsene.

**Test scenarios:**
- Happy path: FAQ-seksjon rendres med spørsmål; klikk ekspanderer svaret.
- Happy path: klikk på POI-lenke dispatcher `OPEN_POI` med riktig heterogen id (`entur-NSR-…`).
- Happy path (parser isolert): blandet tekst med to poi:-lenker → riktige segmenter; ukjent id → ren tekst (degrader, aldri sensurer).
- Integration: mixed-case id (`entur-NSR-StopPlace-…`) resolver til klikkbar lenke gjennom ekte `adaptBoardData`-fixture — ikke håndbygd map (lowercase-fella).
- Edge case: kategori med 0 svar → ingen FAQ-overskrift i DOM.
- Edge case: global FAQ uten både karakteristikk og transitt-fakta → ingen global FAQ-seksjon i DOM.
- Edge case: flere åpne samtidig; expand trigget ingen scroll-kall.
- Integration: global FAQ-svar med kategorilenke dispatcher `SELECT_CATEGORY`.

**Verification:** i kjørende board (uten reels-lyd) viser drill-in FAQ under prosaen; POI-klikk flyr kartet.

- [x] **Unit 6: Mobil-UI — FAQ i CategoryPage + panel-vik ved POI-klikk**

**Goal:** Samme FAQ-innhold i mobil-drill-in, med panel som viker (peek) ved POI-referanse-klikk så kartflyet er synlig; global FAQ på nabolagsflaten.

**Requirements:** R7, R9; mobil-suksesskriteriet.

**Dependencies:** Unit 5 (deler `FAQSection`).

**Files:**
- Modify: `components/variants/report/board/neighbourhood/CategoryPage.tsx`
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx` (global FAQ)
- Test: `components/variants/report/board/neighbourhood/CategoryPage.test.tsx`

**Approach:**
- `FAQSection` gjenbrukes; adaptiv plassering etter prosa, før POI-listen (rekkefølge relativt til Highlights matcher desktop: prosa → FAQ → Highlights → liste).
- POI-klikk fra FAQ: panelet kollapser til **ny peek-tilstand** (nybygg — `CategoryPage` har i dag fast `PANEL_FRACTION` uten collapse; eksakt høyde justeres mot kartutsnitt), kart flyr, og utforsk-modalen åpnes IKKE av FAQ-klikket (`POIExploreModalHost` gater på POI-tap; FAQ-kilden må unntas eksplisitt). Modal åpnes ved påfølgende trykk på POI-en. Gjenåpning av panelet er ett trykk. Affordans koblet til flate, ikke innholdstype (two-surface-learning).

**Test scenarios:**
- Happy path: FAQ rendres i CategoryPage med samme innhold som desktop for samme kategori.
- Integration: POI-lenke-klikk → `OPEN_POI` dispatchet OG panel-tilstand endret til peek.
- Integration: FAQ-klikk åpner IKKE `POIExploreModal`; påfølgende trykk på POI-en åpner den (modal-unntaket).
- Edge case: tilbake fra peek gjenoppretter scroll-posisjon i panelet.
- Edge case: kategori uten svar → ingen seksjon (paritet med desktop).
- Edge case: inline-lenke i FAQ-svar er tastaturnåbar og har tilstrekkelig treffflate (delt scenario med Unit 5-komponenten).

**Verification:** på mobil-viewport er kartflyet synlig etter POI-klikk i FAQ-svar; navigasjonen tilbake er ett trykk.

### Fase 3 — Innhold og demo

- [x] **Unit 7: Kuratert FAQ for ranheim (ny forfatting)**

**Goal:** Kuraterte FAQ-svar for ranheim-strøket — meglerens stemme — lagret i `areas.report_editorial` per tema/spørsmåls-id.

**Requirements:** R3 (kuratert lag); to-lags-suksesskriteriet.

**Dependencies:** Unit 1 (spørsmåls-id-ene), Unit 3 (lagringsformatet — **skjemaendringen i `area-staging.ts` må være verifisert FØR noe skrives til ranheim-raden**: den er delt prod-data, og main-branch-kode med gammelt strict-skjema dropper hele temaets editorial ved arv hvis faq-feltet ligger der).

**Files:**
- Modify: `v2.areas.report_editorial` for ranheim (datamutasjon via staging/skript, ikke håndredigert SQL)
- Create: ev. skriveskript i `scripts/` hvis eksisterende `/curate-area`-flyt ikke dekker FAQ-feltet

**Approach:**
- Ny forfatting gjennom curator-skillen (formalisert teksttype: register, lengde, eksempler) — POI-tekstene er kun sekundært råstoff for stedsdetaljer; `report_editorial`-bodyene er primær tone-kilde.
- Inkluderer det globale karakteristikk-svaret («hva kjennetegner området?») under den reserverte `global`-nøkkelen — kilden til den globale FAQ-ens kuraterte halvdel.
- Ferskvare-regelen håndheves: ingen linjer/tider/priser i kuraterte svar.
- Beboer-perspektiv, presens, ingen poesi, ingen årstall/historikk (etablerte redaksjonelle regler).

**Test scenarios:** Test expectation: none — innholdsproduksjon; kvalitet verifiseres redaksjonelt mot curator-reglene og teknisk i Unit 8.

**Verification:** minst barn-oppvekst og transport har kuraterte overstyringer/tillegg for ranheim; svarene passerer curator-reglene (stikkprøve mot `aldri`-listene i spec-ene).

- [x] **Unit 8: Demo-provisjonering og aksept mot suksesskriteriene**

**Goal:** Worktree-demo på Strindfjordveien 10 som beviser samtlige suksesskriterier fra origin.

**Requirements:** R11 + alle suksesskriterier.

**Dependencies:** Unit 1–7.

**Files:**
- Ingen nye kildefiler; worktree + provisjonert board (uten reels-lyd) + verifikasjonsnotat i PROJECT-LOG ved logging.

**Approach:**
- Forutsetning først: `lib/editorial/` + scripts committet på feat/scout-ranheim; worktree branchet derfra; `setup-worktree.sh`; egen port.
- Verifiser med faktisk geokoding hvilket strøk geofencen velger for adressen (ranheim/charlottenlund-overlapp) FØR provisjonering.
- Provisjonér via `provisionReportBoard`; deretter systematisk gjennomgang av suksesskriteriene, inkludert: skolekrets-svaret ord for ord mot forventning (vgs.-delen tolkes som nærhet/reisetid — «nærmeste vgs. + bussminutter», aldri kretstilhørighet, jf. Unit 4), holdeplass/linje-svar mot manuelt Entur-oppslag, klikkbar POI-referanse (desktop + mobil), global FAQ med kategorilenke, ukuratert-adresse-kjøring (deterministisk alene, ren output-inspeksjon), sporbarhets-stikkprøve.

**Execution note:** Aksept skjer mot kjørende board i nettleser (screenshots/manuell sjekk), ikke bare grønne tester — output-fokus-regelen.

**Test scenarios:** Test expectation: none — akseptkjøring; kriteriene ER testen (verifiseres manuelt + via eksisterende testsuite grønn).

**Verification:** alle suksesskriterier i origin avkrysset med belegg; `npm run lint`, `npm test`, `npx tsc --noEmit`, `npm run build` grønne i worktree.

## System-Wide Impact

- **Interaction graph:** board-reducer (`OPEN_POI`/`SELECT_CATEGORY`) får nye avsendere (FAQ-lenker); `adaptCategory`-lead-regelen berører ALLE eksisterende boards som deler render-koden — degradasjonsregelen (<3 svar → uendret oppførsel) er regresjonsvernet, og boards uten FAQ-data er per definisjon uendret.
- **Error propagation:** Entur-steget er fail-soft (warnings, aldri abort); render tåler manglende fakta (spørsmål utelates); POI-referanser utenfor board degraderer til ren tekst.
- **State lifecycle risks:** config-skriv via `patchProductConfigWithLock` (aldri delvis); re-provisjonering idempotent; cache bustes via `revalidateTag`.
- **API surface parity:** desktop og mobil deler `FAQSection` og datakilde — innholdsparitet by construction, kun affordanser divergerer.
- **Integration coverage:** adapterkjeden (config → ReportData → BoardData → view) testes med realistisk fixture i Unit 4; UI-dispatch testes i Unit 5/6.
- **Unchanged invariants:** `HighlightsDisclosure`, bridgeText-generering, POI-modal, VO-boards' oppførsel, eksisterende provisjoneringssteg-rekkefølge — alle uendret.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `lib/editorial/` er untracked — worktree mangler fundamentet | Commit på feat/scout-ranheim er eksplisitt forutsetning i Unit 8 (og bør skje før Unit 1 bygges videre) |
| Delt prod-data-vindu: faq-felt skrevet til ranheim mens main har gammelt strict-skjema → main-provisjonering i strøket dropper temaets editorial stille | Unit 7 sekvenseres etter verifisert skjemaendring (Unit 3); vinduets lengde styres av når skjema-utvidelsen merges — hold det kort |
| Entur journey-planner: responsvarians/rate limits | Fail-soft + lagrede fixtures i tester; fast avreisetidspunkt gjør svar deterministiske; Entur er gratis (døgntaket for betalte API-kall berøres ikke) |
| Grilstad-adressen ligger i overlappende strøk-polygoner | Geokod og verifiser strøksvalg FØR provisjonering (Unit 8) |
| Lead-krymping deler render-vei med eksisterende boards | Degradasjonsregelen gjør endringen opt-in (kun ≥3 FAQ-svar); regresjonstest i Unit 4 |
| Deterministiske svar klinger maskinelt på tvers av boards | Én svarform per kategori-spec; build-time LLM-språkvask som dokumentert fallback-opsjon |
| Transitt-tider varierer med tid på døgnet | Fast, lagret avreisetidspunkt + re-genererbarhet via pipeline-steget |

## Documentation / Operational Notes

- `COMMANDS.md` oppdateres hvis nytt skript innføres (Unit 7).
- PROJECT-LOG-føring ved demo-aksept (håndteres av arbeidsflyten).
- Ingen migrasjoner forventet (JSONB-felt i eksisterende kolonner); hvis `report_editorial`-strukturen likevel trenger skjemaendring, følges psql-migrasjonsrutinen i CLAUDE.md.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-22-faq-lokalkunnskap-niva1-requirements.md](../brainstorms/2026-08-22-faq-lokalkunnskap-niva1-requirements.md)
- Related code: `lib/editorial/category-specs.ts`, `lib/generators/bridge-text-generator.ts`, `lib/pipeline/provision.ts`, `app/api/entur/route.ts`, `components/variants/report/reels/DesktopStorySidebar.tsx`, `components/variants/report/board/neighbourhood/CategoryPage.tsx`
- Learnings: se Institutional Learnings-listen over.
