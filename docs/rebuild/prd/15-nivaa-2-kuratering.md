# PRD 15 — Nivå-2-kuratering (kurerings-arbeidsflyt)

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling. (Fase 1 har ingen blokkerende åpne spørsmål — operatør-overflate-formen er RATIFISERT som Beslutning 1 (build-time skills/scripts, ingen ny web-flate), og `apply-area-staging`-konsumet er en RESOLVERT oppstrøms-avhengighet, ikke et åpent spørsmål. Hard beads-ordering-avhengighet: PRD 8 Unit 4 må materialisere `lib/pipeline/apply-area-staging.ts` FØR denne PRD-ens arbeidsflyt kan konsumere den — se Åpne spørsmål #2.)
> **Lag (byggrekkefølge):** Lag 5 (divergerende segment-overflate) — `00-INDEX` Lag-5-raden (`00-INDEX:65`). Bygges etter PRD 2 (capability-manifest), PRD 8 (apply-area-staging-kjernen), PRD 9 (nivå-2-overflate + project-brand), PRD 14 (audio/reels-pipeline + override-akse). Blad-node — ingen nedstrøms-PRD konsumerer denne. Blokkerer ikke MVP (`00-INDEX` Kritisk-sti-merknad, `00-INDEX:70`: 10/14/15 er nivå-2-/media-lag).
> **PRD-nr:** 15 av 15 (sommer-rebuild 2026) — SISTE PRD i den kanoniske 15-PRD-kontrakten.
> **Slug:** `prd-nivaa-2-kuratering`
> **Kontekst:** Lag-5-PRD. Eier den TYNNE, RETNINGS-AGNOSTISKE menneskelige nivå-2-KURERINGS-ARBEIDSFLYTEN (operatør-vendt) som ORKESTRERER fire underliggende systemer — PRD 8s `apply-area-staging`-kjerne, PRD 9s nivå-2-overflate + `project-brand`-modell, PRD 14s reels/audio-pipeline + override-akse, og PRD 7s grounding-output — til nivå-2-innhold. Den eier ARBEIDSFLYTEN/verktøyet (build-time skills/scripts + den menneskelige prepare→skill→apply-dansen), IKKE de underliggende systemene. Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (linje 7 nivå-2-definisjon + linje 681 SEO-microsite n/a + linje 701 dead editorial-admin), `docs/rebuild/prd/00-INDEX.md` (PRD-15-raden `00-INDEX:43` + Lag-5-raden `00-INDEX:65` — slot-identitet + deps 02/08/09/14; samlekart-ut-av-scope bekreftet i PRD-15-raden + finaliserings-noten `00-INDEX:113`), de skrevne grensene i PRD 02/07/08/09/12/14, og faktisk kode (`.claude/skills/curator/SKILL.md`, `.claude/skills/manus-curator/SKILL.md`, `scripts/curate-area.ts`, `scripts/curate-narrative.ts`, `.curation-staging/`, `lib/themes/project-brand.ts`, `lib/types.ts`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **den menneskelige nivå-2-KURERINGS-ARBEIDSFLYTEN**: verktøyet en operatør bruker for å løfte et nivå-1-board til nivå 2 ved å *fylle* overflaten resten av stacken aktiverer. Et nivå-1-board er autonomt generert (PRD 3); det viser prikker på kart. Nivå-2-substansen — kuratert nabolags-editorial, prosjekt-branding, en rikere reels-stemme, redaksjonelt QA-et grounding — er **menneskelig skjønn lagret som data**. Denne PRD-en er arbeidsflyten som produserer den dataen.

CARRY-OVER linje 7 slår fast: «nivå-2 = nivå-1 + branding + kuratert hero + reels-video + editorial-arv». Fire andre PRD-er bygger MASKINERIET som gjør dette mulig; ingen av dem bygger den menneskelige arbeidsflyten som *driver* maskineriet. Det er residualen denne PRD-en eier (verifisert: fire skrevne PRD-er deferrer eksplisitt hit — `08:198`, `09:185`, `14:206`, `07:191`).

Tre strukturelle grep definerer hele PRD-en:

> **Arbeidsflyt, ikke system.** PRD 15 eier ARBEIDSFLYTEN (skill/script + menneskelig beslutnings-dans), ikke systemene den orkestrerer. `apply-area-staging`-kjernen eies av PRD 8; overflate-rendringen + `project-brand`-modellen av PRD 9; reels/audio-pipelinen + override-aksen av PRD 14; grounding-genereringen av PRD 7. PRD 15 KJØRER/REGISSERER/QA-er disse — den re-hjemler ingen av dem.

> **Tynn + retnings-agnostisk + swappbar (RATIFISERT scope-grense).** Segment-retningen (bruktmegler-først vs utbygger-først) er AKTIVT OMSTRIDT og avgjøres av august-markedsinput (memory `project_markus_bruktmegler_spor` / `project_aleksander_utbygger_spor`). Arbeidsflyten er DERFOR identisk uansett segment — kun INNHOLDET som kureres varierer. Ingen segment-spesifikke templates, ingen segment-betinget logikk. Å holde arbeidsflyten tynn og direksjons-agnostisk er å implementere scopet RIKTIG, ikke å kutte det (memory `project_summer_rebuild`: «foundation 100 %, segment-overflate tynn/swappbar»).

> **Build-time, lagret output — ALDRI runtime-LLM.** Kurering produserer lagret output: `areas.report_editorial`-rader (via PRD 8s kjerne), `ProjectAssetFlags`-verdier + `project-brand`-data, reels-mp3-er (via PRD 14), QA-godkjent `curatedNarrative` (via PRD 7). Arbeidsflyten kjører via den eksisterende prepare→skill→apply-dansen (`.curation-staging/<prosjekt>/<spor>.md`, `manus-curator SKILL.md:115-116`; `.curation-staging/<pid>/<theme>.context.json`, `curate-narrative.ts:11-16`) — menneskets beslutning før Supabase-patch. INGEN Gemini/Claude/LLM-kall fra `app/`-runtime eller klientkomponent (CLAUDE.md; `07:54`).

Operatør-overflaten er de EKSISTERENDE build-time Claude Code-skillsene (`curator` + `manus-curator`) + CLI-scriptene (`curate-area` + `curate-narrative`), formalisert og koblet til rebuild-kjernene. Den er IKKE en ny web-flate, og IKKE en port av den døde web-editorial-adminen (`app/admin/editorial/page.tsx` = «Kommer snart»-stub, slettet av PRD 12 Unit 7, `12:250-257`). Dette er den tynne formen guardrailen krever (Beslutning 1).

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Formaliser den retnings-agnostiske stemme-/redaksjonelle kontrakten (curator + manus-curator) som arbeidsflytens delte kvalitets-port, uten segment-spesifikke templates. | Stemme-/kvalitets-kontrakt-formalisering (Unit 1). |
| **G2** | Formaliser area-editorial-kurerings-arbeidsflyten som KONSUMERER PRD 8s `apply-area-staging`-kjerne (produser staging-JSON → menneskelig beslutning → kjerne skriver), uten å re-hjemle staging-infra. | Area-editorial-kurerings-arbeidsflyt (Unit 2). |
| **G3** | Formaliser den menneskelige godkjennings-/QA-dansen over PRD 7s grounding-output (les `.curated.md`, godkjenn, trigg `apply`) + manus-curatering utover grounding — uten å bygge ny QA-infrastruktur. | Grounding-QA + manus-curerings-arbeidsflyt (Unit 3). |
| **G4** | Formaliser fyllingen av PRD 9s nivå-2-overflate per prosjekt: sett `ProjectAssetFlags`-verdier + erstatt demo-`PROJECT_BROKERS`/`PIN_THUMBNAILS` med ekte per-prosjekt-data — uten å eie modellen eller rendringen. | Overflate-fyllings-arbeidsflyt (Unit 4). |
| **G5** | Formaliser regien av PRD 14s reels/audio-pipeline: beslutt HVILKE reels og HVILKEN stemme (override-akse), KJØR pipelinen — uten å re-hjemle override-mekanismen eller bryte karaoke-vernet. | Reels/audio-regi-arbeidsflyt (Unit 5). |
| **G6** | Klassifiser samlekart/multi-board eksplisitt som UT-AV-SCOPE (dødt Explorer/Guide-spor), så segment-overflaten holdes tynn og ikke drar inn død katalog-kode. | Samlekart-klassifisering + scope-grense (Unit 6). |
| **G7** | Bind arbeidsflyten til PRD 2-validatoren: kurert innhold tilfredsstiller validatorens nivå-2-tilstedeværelses-sjekker, og operatøren kjører validatoren som arbeidsflytens fullføringskriterium — uten render-gating. | Validator-binding + verifikasjons-runbook (Unit 7). |

---

## 3. Arkitektur-/migrasjons-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *den divergerende segment-overflaten* — øverst i stacken, etter at alle fire underliggende systemer er bygget. Den materialiserer ikke ny infrastruktur; den er den menneskelige PROSESSEN som fyller de betinget-aktiverte slotene de andre PRD-ene leverer. Divergensen den representerer (nivå 1 → nivå 2) er en INNHOLDS-divergens (mer kuratert data), ALDRI en kode-gren eller en `reportTier`-render-bryter.

| Lag | Eierskap | Divergerer per tier? | Divergerer per profil/segment? |
|-----|----------|----------------------|--------------------------------|
| Datamodell (`areas.report_editorial`, `products.config.reportConfig`) | PRD 1 | Nei — felt finnes alltid, fylles betinget | Nei |
| Tier-modell + lett nivå-2-readiness-sjekk (`validateReportTier`; ingen `TIER_CAPABILITIES`-matrise — to-nivå 2026-06-27) | PRD 2 | Nei — beskriver, gater ikke | Nei |
| Apply-area-staging-kjerne (`lib/pipeline/apply-area-staging.ts`) | PRD 8 | Nei — delt infra | Nei |
| Nivå-2-overflate-render + `project-brand`-modell | PRD 9 | Ja (overflate) — AKTIVERT av `assets`-flagg | Nei |
| Reels/audio-pipeline + override-akse | PRD 14 | Ja (override) — AKTIVERT av data-tilstedeværelse | Nei |
| Grounding-generering + `curate-narrative`-orkestrator | PRD 7 | Nei — identisk generering alle nivåer | Nei |
| **Menneskelig nivå-2-kurerings-ARBEIDSFLYT (denne PRD-en)** | **Denne PRD-en** | **Ja** — produserer nivå-2-INNHOLD; ALDRI kode-gren eller tier-bryter | **Nei** — arbeidsflyten er segment-agnostisk; kun innholdet varierer |

> **NB — retnings-agnostisk er en SCOPE-INVARIANT, ikke en kode-detalj.** Segment-valget (bruktmegler vs utbygger) er omstridt og avgjøres av august-marked (memory). Arbeidsflyten MÅ være identisk uansett: ingen segment-spesifikke skills/scripts/templates, ingen `if (segment === ...)`-grener. Segment-spesifikk innholds-strategi er IKKE kode — den er en redaksjonell beslutning operatøren tar PER prosjekt, innenfor den samme arbeidsflyten.

> **NB — ingen render-gating på `reportTier` (render-gating-noten `00-INDEX:91`; patch-#4-presiseringen `00-INDEX:107`).** Nivå-2-overflaten AKTIVERES av `ProjectAssetFlags` (capability), aldri en `if (reportTier)`-bryter (verifisert 0 `reportTier`-ref i `project-brand.ts`/`ReportReelsPage`/`BoardMap3D`). PRD 15 FYLLER overflaten med data; PRD 2-validatoren (ikke en render-bryter) håndhever nivå-kravene. Operatøren kjører validatoren som arbeidsflytens fullføringskriterium (Unit 7), aldri som en runtime-gate.

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer |
|---------------|--------------------|
| **(ingen)** | Blad-node — `00-INDEX` Lag-5-raden (`00-INDEX:65`) plasserer PRD 15 som siste node i Lag 5. Ingen nedstrøms-PRD konsumerer denne arbeidsflyten. Output (kurert data) konsumeres RUNTIME av allerede-bygde systemer (PRD 9 rendrer overflaten, PRD 2-validatoren sjekker tilstedeværelse), men ingen PRD avhenger av PRD 15 som byggblokk. |

### Migrasjons-kontekst (ingen kode-port av eget system, ingen DB-migrasjon)

Denne PRD-en innfører INGEN ny migrasjon og porterer INGEN egen ny pipeline-fil. Den FORMALISERER eksisterende build-time arbeidsflyt-artefakter (skills + CLI-scripts) og KOBLER dem til de rebuild-kjernene de andre PRD-ene leverer. De konkrete kode-artefaktene denne PRD-en eier er: (a) de oppdaterte/dokumenterte skill-filene (`curator`/`manus-curator`), (b) arbeidsflyt-runbooks som dokumenterer prepare→skill→apply-dansen mot rebuild-kjernene, og (c) den eksplisitte scope-klassifiseringen av samlekart. All skriving til Supabase går gjennom de allerede-eide kjernene (PRD 8 `apply-area-staging`, PRD 14 build-scripts, PRD 7 `curate-narrative apply`) som bruker raw fetch med service-role i header (CLI/server-kontekst). PRD 15 shell-er ikke ut til script der en kjerne-modul finnes; den deler PRD 8s ekstraherte `lib/pipeline`-modul (`08:40`).

---

## 4. Eksisterende kodebase

### Bæres over — keeper-core (arbeidsflyt-artefakter denne PRD-en formaliserer/eier)

| Fil (@/-sti) | Rolle | Verifisert linje-ref |
|--------------|-------|----------------------|
| `.claude/skills/curator/SKILL.md` | Den kanoniske, retnings-agnostiske Placy-kurerings-STEMMEN: 6 prinsipper, register-skala, banned-ord, tidsregel, 9-punkts kvalitetssjekkliste. Arbeidsflytens delte kvalitets-port — ikke kode, men byggrekke-input. | `SKILL.md:29-40` (6 prinsipper), `:42-52` (register-skala), `:85-95` (tidsregel: historisk trygt / nåværende skjørt), `:97-109` (9-punkts sjekkliste) |
| `.claude/skills/manus-curator/SKILL.md` | V3 per-kategori manus-arbeidsflyt (0 POI-navn, 5 setn, 60-75 ord, 20-25s TTS). Arver stemme fra curator, konsumerer grounding som fact-feed, produserer manus som driver skjerm-overlay + VO + karaoke. Steg 7 skriver `.curation-staging/<prosjekt>/<spor>.md` for menneskets beslutning før patch. | `SKILL.md:20-24` (V3-premiss), `:26-41` (hard rules), `:81-116` (pipeline grounding→manus), `:115-116` (Steg 7 staging + frontmatter) |

### Bæres over — port-with-rewrite (KONSUMERES via PRD-8-ekstrahert kjerne, eies IKKE her)

| Fil (@/-sti) | Rewrite-handling | Verifisert linje-ref |
|--------------|------------------|----------------------|
| `scripts/curate-area.ts` | Operatør-INNGANGEN til `apply-area-staging`-kjernen. PRD 8 Unit 4 ekstraherer write-logikken (i dag inline `:135-353`) til `lib/pipeline/apply-area-staging.ts` og rewire-r dette scriptet til å kalle kjernen (`08:249-255`). PRD 15s arbeidsflyt KONSUMERER det (fremtidige) kjerne-modulet + dette CLI-skallet — den eier IKKE staging-infra. Denne PRD-en porterer IKKE fila; PRD 8 gjør det. | `curate-area.ts:135-353` (`applyStaging` — inline i dag), `:355-461` (`--list-pois` kandidat-meny), `08:249-255` (PRD 8 Unit 4 ekstraherer) |
| `scripts/curate-narrative.ts` | Kuratering-orkestrator (Fable=skriver via build-time skill-dans; Gemini=fact-feed): grounding.narrative → `curatedNarrative` med POI-inline-lenker via prepare→skill→apply, ingen runtime-LLM. OWNED BY PRD 7 (Unit 7, `07:90`). PRD 15 er den menneskelige REGI/QA-dansen som KJØRER den (`07:191`) — den eier IKKE orkestrator-implementasjonen. | `curate-narrative.ts:1-16` (header: prepare+apply, skill-mellomsteg, ingen Claude-key), `07:191` (deferred til PRD 15: redaksjonell QA/godkjenning/manus-curatering utover grounding) |

### Reference-only (eid av andre PRD-er; arbeidsflyten FYLLER/REGISSERER, eier IKKE)

| Fil (@/-sti) | Eier | Grense |
|--------------|------|--------|
| `lib/pipeline/apply-area-staging.ts` | PRD 8 (Unit 4) | **EKSISTERER IKKE ENNÅ** (verifisert: `ls` returnerer No such file). PRD 8 Unit 4 EKSTRAHERER den fra `curate-area.ts:135-353` (`08:40`/`:63`/`:249-255`). Hard oppstrøms-avhengighet: PRD 15s «del kjernen uten å shelle til script»-premiss avhenger av at PRD 8 Unit 4 fullfører FØRST (Åpne spørsmål #2). PRD 15 KONSUMERER; den bygger den ALDRI. |
| `lib/pipeline/area-staging.ts` | PRD 8 (Unit 2) | Zod-staging-kontrakten (`parseAreaStaging`/`AreaStagingSchema`/`ThemeEditorialStagingSchema`). PRD 15 produserer `data/areas/*.staging.json` som tilfredsstiller denne; den eier ikke valideringen. `area-staging.ts:21` (VALID_THEME_IDS fra REPORT_THEME_DEFAULTS — bolig-6-tema-skopet). |
| `lib/pipeline/inherit-area-editorial.ts` | PRD 8 (Unit 3) | Arve-kjernen (`areas.report_editorial` → `products.config`). PRD 15 rører den IKKE — den er staging-infra PRD 8 eier; PRD 15 er det menneskelige QA/godkjennings-laget OVER `apply-area-staging`-kjernen (`08:198`). |
| `lib/themes/project-brand.ts` | PRD 9 (Unit 6) | Project-brand-MODELLEN (asset-flagg→fil-sti). ALT gated på `assets?.brand`/`splashVideo`/`pinThumbnail`, ALDRI `reportTier`. PRD 15 FYLLER overflaten (setter `ProjectAssetFlags`-verdier + erstatter demo-`PROJECT_BROKERS`/`PIN_THUMBNAILS` med ekte per-prosjekt-data); den eier IKKE modellen eller rendringen. | `project-brand.ts:21-29` (`getProjectLogoSrc`, gated `:25`), `:47-55` (`getProjectSplashVideo`, gated `:51` = reels-video-gate), `:60-71` (`PROJECT_BROKERS` demo-data — flagget for Supabase-flytting), `:81-89` (`getProjectPinThumbnail`), `09:257-264` (PRD 9 porterer modellen) |
| `scripts/reels-voiceover-build-local.ts` | PRD 14 (Unit 4) | Reels-VO-bygg (override-akse): bygger KUN `themes[].reelsAudio` til egen fil `{themeId}-reels.mp3`, defensiv abort hvis trackKey mangler `-reels`-suffiks (karaoke-vern). PRD 15 = den menneskelige beslutningen HVILKE reels / HVILKEN stemme — den KJØRER/regisserer pipelinen, eier IKKE override-mekanismen (`14:206`/`:252-258`). |
| `scripts/curate-narrative.ts` | PRD 7 (Unit 7) | (Se port-with-rewrite-tabellen over — listet der fordi PRD 15 KJØRER den, men eierskapet er PRD 7.) |

### Slettes / forlates (dead — bekreftet IKKE PRD 15-leveranse)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `app/admin/editorial/page.tsx` | dead — IKKE porteres av PRD 15 | «Kommer snart»-stub (`redirect("/")` ved `!ADMIN_ENABLED`, verifisert `:6-22`). Slettet av PRD 12 Unit 7 (`12:250-257`). Den nye kurerings-arbeidsflyten er skill/script-basert (build-time), IKKE en web-admin. PRD 15 porterer IKKE web-stuben — bekrefter at operatør-overflaten er build-time skills/scripts (Beslutning 1, Åpne spørsmål #1). |
| `lib/curated-lists.ts` | dead (dødt Explorer/Guide-spor) — UT-AV-SCOPE | SAMLEKART-FELLE RESOLVERT: `CuratedList` mater `/[area]/guide/[slug]` SEO-microsite (manifest `:681` = Explorer/Guide-katalog, n/a/dead). IKKE konsumert av rebuild-board (`ReportReelsPage`/`BoardMap3D`). PRD 15 klassifiserer samlekart UT-AV-SCOPE (Unit 6), ikke som nivå-2-kurering. |
| `components/variants/report/ReportCuratedGrounded.tsx` | dead (gammel scroll-rapport, n/a per manifest `:659`) — UT-AV-SCOPE | RENDERER (V2 grounding-narrative med POI-inline-lenker), men en DØD én: eneste konsument er `ReportThemeSection.tsx:367` (gammel scroll-artikkel), ALDRI rebuild-boardet (`ReportReelsPage`/`BoardMap3D`). PRD 9 porterer/eier den IKKE (grep `ReportCuratedGrounded` i PRD 09 = 0 treff); manifest `:659` lister den blant aktive scroll-komponenter merket n/a (ikke bæret inn i rebuild). PRD 15 produserer/QA-er grounding-DATAEN, ikke denne render-komponenten — den er ut-av-scope fordi den er død, ikke fordi PRD 9 eier den. |

---

## 5. Datakontrakt (felt PRD-en produserer / konsumerer)

### 5.1 Konsumeres fra PRD 8 (apply-area-staging-kjernen)

| Symbol | Rolle i arbeidsflyten | Kilde |
|--------|------------------------|-------|
| `lib/pipeline/apply-area-staging.ts` (PRD-8-ekstrahert kjerne) | Arbeidsflyten produserer `data/areas/*.staging.json` → menneskelig beslutning → kjernen skriver til `areas.report_editorial` (GET→branch: INSERT m/ meta ELLER spread-merge PATCH; ingen optimistisk lås — `areas` mangler `updated_at`). PRD 15 deler kjernen uten å shelle til script. | `08:249-255` (Unit 4 spec), `08:63` (nedstrøms-kontrakt: PRD 15 konsumerer kjernen) |
| `parseAreaStaging`/`ThemeEditorialStagingSchema` (Zod-kontrakt) | Validerer staging-JSON arbeidsflyten produserer (body/highlightCandidates/image, tema bundet til `VALID_THEME_IDS` = bolig-6-tema). Heterogene POI-IDer ALDRI UUID. | `08` Unit 2, `area-staging.ts:84-98`/`:100-112`/`:21` |

### 5.2 Konsumeres fra PRD 9 (nivå-2-overflate + project-brand)

| Symbol | Rolle i arbeidsflyten | Kilde |
|--------|------------------------|-------|
| `ProjectAssetFlags` (`brand`/`splashVideo`/`customIllustrations`/`pinThumbnail`) | Flaggene arbeidsflyten SETTER per prosjekt for å aktivere overflaten. PRD 15 fyller VERDIENE; PRD 1 eier typen, PRD 9 eier modellen som leser dem. | `lib/types.ts:417-428`, `09:262` |
| `getProjectBrokers`/`PROJECT_BROKERS` + `getProjectPinThumbnail`/`PIN_THUMBNAILS` | Demo-data arbeidsflyten erstatter med ekte per-prosjekt-verdier (lagret output). **MERK to ulike aktiverings-akser:** `getProjectBrokers(slug)` (`:74`) tar KUN slug, er IKKE flagg-gated — brokers aktiveres av `reportConfig.brokers`-data-tilstedeværelse (`lib/types.ts:445`); `getProjectPinThumbnail` (`:85`) ER flagg-gated på `assets?.pinThumbnail`. PRD 9 porterer modellen verbatim med demo-data flagget for Supabase-flytting (`09:266`); PRD 15 fyller de ekte verdiene. | `project-brand.ts:60-71`/`:74`/`:81-89`, `lib/types.ts:445`, `09:266` |
| `BrokerInfo` / `ReportConfig.assets` | Typene de utfylte verdiene skrives mot. PRD 1 eier skjema; PRD 15 populerer verdier. | `lib/types.ts` (`BrokerInfo`, `ReportConfig.assets:438`) |

### 5.3 Konsumeres fra PRD 14 (reels/audio-pipeline + override-akse)

| Symbol | Rolle i arbeidsflyten | Kilde |
|--------|------------------------|-------|
| `reels-voiceover-build-local.ts` + override-aksen (`reelsAudio ?? audio`) | Pipelinen arbeidsflyten KJØRER for å fylle den rikere feed-stemmen. PRD 15 beslutter HVILKE reels / HVILKEN stemme; PRD 14 eier mekanismen + karaoke-vernet (egen fil `{themeId}-reels.mp3`, defensiv `-reels`-suffiks-abort). | `14:252-258`, `14:206` (deferred til PRD 15: human workflow som KJØRER pipelinen) |
| `ReportThemeConfig.reelsAudio` (`ReportThemeAudio`) | Override-akse-bæreren arbeidsflyten fyller (manus-valg → TTS-bygg → `{themeId}-reels.mp3`). PRD 1 eier typen; PRD 14 eier pipelinen. | `lib/types.ts:380` (`reelsAudio?`) |

### 5.4 Konsumeres fra PRD 7 (grounding-output)

| Symbol | Rolle i arbeidsflyten | Kilde |
|--------|------------------------|-------|
| `themes[].grounding` (Gemini fact-feed) + `curate-narrative.ts` (prepare/apply) | Grounding-outputen arbeidsflyten QA-er/godkjenner + manus-curaterer utover. PRD 7 GENERERER; PRD 15 gjør redaksjonell QA/godkjenning + manus-curatering (`07:191`). Den menneskelige dansen: `prepare` skriver `.context.json` → skill/operatør skriver `.curated.md` → operatør godkjenner → `apply` validerer+linker+PATCH. | `curate-narrative.ts:1-16`, `07:191` |

### 5.5 Konsumeres fra PRD 2 (capability-manifest + validator)

| Symbol | Rolle i arbeidsflyten | Kilde |
|--------|------------------------|-------|
| `scripts/validate-report-tier.ts` (CLI-driver) wrapper `validateReportTier` (ren funksjon, lett nivå-2-readiness — ingen `TIER_CAPABILITIES`-matrise) | Deklarerer hva nivå 2 krever: kuratert `editorial` (PRD 2 §5.3). Brokers/brand/reels/VO er ortogonale render-flagg, IKKE nivå-krav (to-nivå 2026-06-27). Arbeidsflyten produserer innhold som tilfredsstiller readiness-sjekken; operatøren KJØRER den kjørbare CLI-driveren (PRD 2 Unit 4) som fullføringskriterium (Unit 7). `validateReportTier` selv er en ren I/O-fri funksjon (funn er data, ingen throws, §5.3); driveren oversetter til exit-koder og er det operatøren faktisk invokerer. Validatoren (PRD 2), ikke en render-bryter, håndhever nivå-krav (patch #4). | `02` §5.2/§5.3/§5.4, Unit 4 (`scripts/validate-report-tier.ts`) |

### 5.6 Produseres av denne PRD-en (lagret output, ALDRI runtime)

| Output | Eierskap | Note |
|--------|----------|------|
| `data/areas/*.staging.json` (staging-input for `apply-area-staging`) | PRD 15 (arbeidsflyt-output) | Produsert build-time; konsumert av PRD 8s kjerne. Bolig-6-tema-skopet (arvet grense fra `area-staging.ts:21`). |
| `.curation-staging/<prosjekt>/<spor>.md` + `.curation-staging/<pid>/<theme>.curated.md` | PRD 15 (menneskelig beslutnings-artefakt) | Den staged build-time prepare→skill→apply-dansen (`manus-curator:115-116`, `curate-narrative.ts:11-16`). Menneskets beslutning før Supabase-patch. 4 reelle prosjekter eksisterer allerede i `.curation-staging/`. |
| `ProjectAssetFlags`-verdier + ekte `PROJECT_BROKERS`/`PIN_THUMBNAILS` per prosjekt | PRD 15 (fyller PRD-9-overflaten) | Lagret i reportConfig (Supabase) — overstyrer demo-data. PRD 9 eier modellen; PRD 15 fyller verdiene. |
| Arbeidsflyt-runbooks (`docs/rebuild/nivaa-2-kurerings-runbook.md`) | PRD 15 | Dokumenterer dansen mot hver kjerne; segment-agnostisk. |

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. Formalisering av den retnings-agnostiske stemme-/kvalitets-kontrakten (`curator` + `manus-curator`) som arbeidsflytens delte port (Unit 1).
2. Area-editorial-kurerings-arbeidsflyten som KONSUMERER PRD 8s `apply-area-staging`-kjerne (Unit 2).
3. Den menneskelige grounding-QA/godkjennings-dansen over PRD 7s output + manus-curatering utover grounding (Unit 3).
4. Fyllingen av PRD 9s nivå-2-overflate per prosjekt (`ProjectAssetFlags` + ekte broker/pin-data) (Unit 4).
5. Regien av PRD 14s reels/audio-pipeline (HVILKE reels / HVILKEN stemme via override-akse; KJØR pipelinen) (Unit 5).
6. Eksplisitt klassifisering av samlekart/multi-board som UT-AV-SCOPE (dødt Explorer/Guide-spor) (Unit 6).
7. Binding til PRD 2-validatoren som arbeidsflytens fullføringskriterium + verifikasjons-runbook (Unit 7).

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| `apply-area-staging`-INFRA-ekstraksjon + arve-/lese-system (`inherit-area-editorial`/`find-area-for-point`/lese-sti) | **PRD 8 (prd-lokalkunnskap-moat)** — PRD 15 konsumerer den ekstraherte kjernen, bygger den ikke |
| Nivå-2-overflate-RENDERING + `project-brand`-MODELL (splash-cluster/EmbedArrivalLoader/reels-video-render) | **PRD 9 (prd-board-skall-ui)** — PRD 15 fyller overflaten, rendrer den ikke |
| Audio/reels-GENERERINGS-pipeline + override-akse-MEKANISME (TTS-bygg, karaoke-vern, Veo/Ken Burns) | **PRD 14 (prd-audio-tour-reels)** — PRD 15 kjører pipelinen, eier den ikke |
| Gemini-grounding-GENERERING + story-text-linker + `curate-narrative`-orkestrator-implementasjon | **PRD 7 (prd-grounding-curation)** — PRD 15 QA-er output, genererer den ikke |
| Operatør provisjon-admin + tier-modell + `requireAdmin()`-gate (DISTINKT fra kurerings-arbeidsflyt) | **PRD 12 (prd-self-serve-admin)** — `12:174` (PRD-15-distinkt-fra-operatør-admin-raden) markerer PRD 15-arbeidsflyten eksplisitt DISTINKT |
| Datamodell/skjema (`areas.report_editorial`, `products.config`, `ProjectAssetFlags`/`ReportThemeAudio`-typer) | **PRD 1 (prd-datamodell-supabase)** — PRD 15 populerer verdier, definerer ikke skjema |
| Samlekart/multi-board som AKTIV funksjonalitet (curated-lists guide-katalog, SEO-microsite) | **Separat Explorer/Guide-resume-task** — dødt spor (manifest `:681`); PRD 15 klassifiserer kun UT-AV-SCOPE (Unit 6) |
| `naering`-profil area-editorial-kurering (bolig-6-tema-skopet er arvet grense fra `area-staging.ts:21`) | **PRD 8 deferred** (`08:202`) — krever profil-bevisst `VALID_THEME_IDS` FØR PRD 15-arbeidsflyt kan kurere naering-area-editorial |
| Segment-spesifikk innholds-strategi (megler vs utbygger tekst-vinkling) | **Ikke kode** — redaksjonell beslutning per prosjekt, avgjøres av august-marked (memory); arbeidsflyten forblir segment-agnostisk |
| Ny web-flate for kurering (vs build-time skills/scripts) | **Eksplisitt IKKE bygget** (Beslutning 1) — over-bygging av segment-overflaten; den døde web-editorial-adminen er slettet av PRD 12 |
| **Megler-VENDT selvbetjent berikelses-flate** (megler bekrefter/korrigerer auto-fylt kart, legger til perler/bilder/innsikt → Placys delte DB) — moat-1-flywheelen | **Eierskap UAVKLART (PRD 15 vs egen PRD), post-MVP** — forretningsutvikling 2026-06-28, `docs/rebuild/moat-1-lokalkunnskap-build-input.md` Gap 1. Kandidat: utvid DENNE arbeidsflyten med en megler-vendt modus (bygger på samme `apply-area-staging`-kjerne). Fremtidig RETNING, ikke build-nå; eierskap låses når flaten faktisk bygges |

**Eksplisitt ikke-scope (patch #4):** render-gating på `reportTier`. Arbeidsflyten produserer nivå-2-INNHOLD; overflaten aktiveres av `assets`-flagg (capability), aldri en tier-render-bryter (verifisert: 0 `reportTier`-ref i overflate-/render-filene). PRD 2-validatoren håndhever nivå-krav. Ingen unit bygger en tier-render-bryter eller et nytt kurerings-system.

---

## 7. Implementation Units (7 av maks 8)

### Unit 1 — Stemme-/kvalitets-kontrakt-formalisering (retnings-agnostisk delt port)
- **Mål (→ G1):** Formaliser `curator` + `manus-curator` som arbeidsflytens delte, segment-agnostiske kvalitets-port; bekreft at ingen segment-spesifikke templates eksisterer.
- **Filer:** `@/.claude/skills/curator/SKILL.md` (bekreft/dokumenter), `@/.claude/skills/manus-curator/SKILL.md` (bekreft/dokumenter), `@/docs/rebuild/nivaa-2-kurerings-runbook.md` (ny — arbeidsflyt-runbook, kvalitets-port-seksjon).
- **Avhengigheter:** ingen (formalisering av eksisterende skills + dokumentasjon).
- **Akseptansekriterier:**
  1. Stemme-kontrakten dokumentert som arbeidsflytens delte port: 6 prinsipper (`curator:29-40`), register-skala (`:42-52`), tidsregel (`:85-95`), 9-punkts sjekkliste (`:97-109`). Manus-format-tilleggsregler (`manus-curator:26-41`) bekreftet.
  2. **Retnings-agnostisk bekreftet:** grep-verifisert at hverken `curator` eller `manus-curator` inneholder segment-betinget logikk (ingen «bruktmegler»/«utbygger»-spesifikke templates eller grener). Begge er identiske uansett segment; kun innholdet operatøren produserer varierer. Dokumenter dette som en RATIFISERT scope-invariant.
  3. **Innholds-kvalitetsregler bevart (innhold, ikke kode):** nabolags-editorial i PRESENS, ikke byggeår/historikk (memory `feedback_editorial_no_years_history`, overstyrer curator-skillens historisk-form-default for nabolag); manus = 0 POI-navn (unntak skolekrets), 5 setn, ord-tall per manus-curator-skillens ord-mål (`manus-curator:34`) med den KANONISKE harde grensen i PRD 14 Unit 2 AC2 (som avklarer `manus.ts`-grensene 35/90 vs ~70-målet — se PRD 14 Unit 2 AC2 for kanonisk grense; AC4 under), 20-25s TTS, ett tema per setning (memory `feedback_reels_manus_struktur`), fakta-orientert ikke poetisk (memory `feedback_manus_fakta_orientert`), beboer-perspektiv ikke turist (memory `feedback_reels_beboer_perspektiv`). Disse er forfatter-arbeidsflyt-kvalitets-porter, ikke kode-regler.
  4. **Ord-grense-kontrakt-merknad (ikke re-hjemling):** PRD 14 Unit 2 AC2 eier avklaringen av `manus.ts`-grensene (35/90 harde) vs manus-curator-målet (~70). PRD 15 KONSUMERER den avklarte grensen; den re-hjemler den ikke. Runbooken peker til PRD 14 for kanonisk ord-grense.
  5. Runbook dokumenterer at arbeidsflyten er build-time (skill/script), ALDRI runtime-LLM.

### Unit 2 — Area-editorial-kurerings-arbeidsflyt (konsumerer PRD 8s kjerne)
- **Mål (→ G2):** Formaliser arbeidsflyten som produserer `data/areas/*.staging.json` og kjører dem gjennom PRD 8s `apply-area-staging`-kjerne — uten å re-hjemle staging-infra.
- **Filer:** `@/docs/rebuild/nivaa-2-kurerings-runbook.md` (area-editorial-seksjon), `@/data/areas/*.staging.json` (arbeidsflyt-output — produseres, ikke kode).
- **Avhengigheter:** **PRD 8 Unit 4 (hard oppstrøms — `lib/pipeline/apply-area-staging.ts` MÅ eksistere FØR denne unit, Åpne spørsmål #2)**, PRD 8 Unit 2 (`parseAreaStaging`/`ThemeEditorialStagingSchema`), PRD 2 (`VALID_THEME_IDS` taksonomi).
- **Akseptansekriterier:**
  1. Arbeidsflyten dokumentert som: kurator skriver staging-JSON (body/highlightCandidates/image per bolig-tema) → menneskelig beslutning → `apply-area-staging`-kjernen (PRD 8) skriver til `areas.report_editorial`. PRD 15 KONSUMERER kjernen; den re-implementerer den ALDRI (`08:63`).
  2. **Staging-JSON tilfredsstiller PRD 8s Zod-kontrakt:** body/highlightCandidates (heterogene POI-IDer, ALDRI UUID-format), tema-nøkler bundet til `VALID_THEME_IDS` (bolig-6-tema). Et `naering`-tema avvises av staging som «ukjent tema» — dokumentert no-op (`08:53`), ikke en PRD-15-bug.
  3. **Ingen optimistisk lås på `areas` (arvet grense):** `areas` mangler `updated_at` (`08:51`/`:160`); kjernen bruker GET→branch klient-merge. Arbeidsflyten dokumenterer at én-operatør-PoC godtar dette (PRD 8 Beslutning 4); PRD 15 endrer det ikke.
  4. **Kjerne-konsum, ikke shell:** arbeidsflyten kaller PRD 8s `lib/pipeline`-kjerne (delt modul), shell-er IKKE ut til `curate-area`-scriptet der kjernen er tilgjengelig — som var hele poenget med PRD 8 Unit 4-ekstraksjonen (`08:40`).
  5. Innhold build-time/manuelt, ALDRI runtime-generert; nabolags-editorial i PRESENS.

### Unit 3 — Grounding-QA + manus-curerings-arbeidsflyt (regi over PRD 7-output)
- **Mål (→ G3):** Formaliser den menneskelige godkjennings-/QA-dansen over PRD 7s grounding-output + manus-curatering utover grounding — uten å bygge ny QA-infrastruktur.
- **Filer:** `@/docs/rebuild/nivaa-2-kurerings-runbook.md` (grounding-QA-seksjon), `@/.curation-staging/<pid>/<theme>.curated.md` (arbeidsflyt-artefakt — produseres).
- **Avhengigheter:** PRD 7 (`curate-narrative.ts` orkestrator — KJØRES, eies ikke), PRD 14 (manus-domene-grensen via manus-curator-skillen), Unit 1 (stemme-kontrakten).
- **Akseptansekriterier:**
  1. Den menneskelige dansen dokumentert: `curate-narrative prepare <pid>` skriver `.context.json` per tema → skill/operatør leser context + skriver `.curated.md` → operatør GODKJENNER → `curate-narrative apply <pid>` validerer + POI-linker + PATCH (`curate-narrative.ts:11-16`). PRD 15 formaliserer den MENNESKELIGE review-stegen (les `.curated.md`, godkjenn, trigg `apply`).
  2. **Ingen ny QA-infrastruktur (tynn):** PRD 15 bygger IKKE nytt QA-verktøy — den formaliserer den eksisterende menneskelige review-stegen i prepare→skill→apply-dansen (Åpne spørsmål #5). Manus-curatering utover grounding bruker `manus-curator`-skillen (eksisterende), ikke en ny pipeline.
  3. **PRD-7-grense respektert:** PRD 7 eier orkestrator-implementasjonen (`07:90`) + grounding-genereringen; PRD 15 QA-er/godkjenner OUTPUTEN (`07:191`). Ingen unit re-hjemler grounding-generering eller story-text-linkeren.
  4. **Ingen runtime-LLM:** dansen er build-time (Claude kan ikke kalles som API her — skill-utført mellomsteg, `curate-narrative.ts:7-8`). Verifisert ingen LLM-kall fra `app/`-runtime.
  5. Manus-QA bruker stemme-kontrakten (Unit 1) som godkjennings-port: 9-punkts sjekkliste + tidsregel + grounding-troskap (`manus-curator:48-49`).

### Unit 4 — Overflate-fyllings-arbeidsflyt (fyller PRD 9s nivå-2-overflate)
- **Mål (→ G4):** Formaliser fyllingen av PRD 9s overflate per prosjekt: sett `ProjectAssetFlags`-verdier + erstatt demo-broker/pin-data med ekte — uten å eie modellen eller rendringen.
- **Filer:** `@/docs/rebuild/nivaa-2-kurerings-runbook.md` (overflate-fyllings-seksjon), reportConfig-verdier (produseres via Supabase, ikke kode i denne PRD-en).
- **Avhengigheter:** PRD 9 (Unit 6 — `project-brand`-modell + `ProjectAssetFlags`-grenser), PRD 1 (`ProjectAssetFlags`/`BrokerInfo`-typer), PRD 3 (provisjon-skrive-path når ekte broker-data skrives ved oppsett, `09:188`).
- **Akseptansekriterier:**
  1. Arbeidsflyten dokumentert via TO distinkte aktiverings-mekanismer (begge capability-data-drevet, men ulike felter): **(a) asset-flagg-gatede assets** — operatør setter `ProjectAssetFlags` (`brand`/`splashVideo`/`pinThumbnail`) per prosjekt + leverer hero/splash/pin-assets; modellen gater på disse flaggene (`getProjectLogoSrc:25` på `assets?.brand`, `getProjectSplashVideo:51` på `assets?.splashVideo`/`brand`, `getProjectPinThumbnail:85` på `assets?.pinThumbnail`). **(b) broker-data-tilstedeværelse** — operatør erstatter demo-`PROJECT_BROKERS` (`project-brand.ts:60-71`) med ekte per-prosjekt-broker-data; `getProjectBrokers(slug)` (`:74`) tar KUN `slug` og er IKKE flagg-gated, og boardet leser brokers via `reportConfig.brokers`-data-tilstedeværelse (`lib/types.ts:445`), ikke et `ProjectAssetFlags`-flagg (konsistent med PRD 2 §5.4 brokers-tilstedeværelses-sjekk). `PIN_THUMBNAILS`-oppslaget (`:81-89`) hører til (a) — gated på `assets?.pinThumbnail`.
  2. **Aktivering via capability, ALDRI tier:** assets aktiveres av `ProjectAssetFlags`-flagg (`project-brand.ts:25`/`:51`/`:85`); brokers aktiveres av data-tilstedeværelse (`reportConfig.brokers`, ingen flagg). Begge er capability-data-drevet — ALDRI en `if (reportTier)`-bryter (patch #4). Arbeidsflyten setter VERDIER/data; `undefined`-asset eller tomme brokers → board faller tilbake til nivå 1 uten tier-sjekk.
  3. **Modell/render eid av PRD 9:** PRD 15 fyller DATAEN PRD 9 rendrer (`09:185`); den porterer/endrer IKKE `project-brand.ts` eller splash-clusteret. Ekte broker-data-skriving koordineres med PRD 3-provisjon der relevant (`09:188`).
  4. **Reels-video-asset-valg:** arbeidsflyten beslutter om et prosjekt får `splashVideo` (reels-video i splash, `getProjectSplashVideo:47-55`); selve video-FILENE produseres av PRD 14-pipelinen (Unit 5). PRD 9 gater hvilke prosjekter via `REELS_MONTAGE_PROJECTS` (DATA-flagg, `09` §10 Q6) — PRD 15 fyller allowlisten, eier ikke gating-mekanismen.
  5. Stillbilder via `next/image` der overflaten rendrer (PRD 9-grense); PRD 15 leverer asset-filer, ikke render-kode.

### Unit 5 — Reels/audio-regi-arbeidsflyt (kjører PRD 14s pipeline + override-akse)
- **Mål (→ G5):** Formaliser regien av PRD 14s pipeline: beslutt HVILKE reels og HVILKEN stemme (override-akse), KJØR pipelinen — uten å re-hjemle override-mekanismen eller bryte karaoke-vernet.
- **Filer:** `@/docs/rebuild/nivaa-2-kurerings-runbook.md` (reels/audio-regi-seksjon).
- **Avhengigheter:** PRD 14 (Unit 4 reels-VO-override-bygger + Unit 1 TTS-kjerne — KJØRES, eies ikke), Unit 1 (manus-stemme-kontrakt), Unit 3 (manus-QA før TTS-bygg).
- **Akseptansekriterier:**
  1. Arbeidsflyten dokumentert: operatør velger manus per tema (via manus-curator-skill + Unit 3-QA) → kjører `reels-voiceover-build-local.ts` (PRD 14) → `themes[].reelsAudio` skrives til egen fil `{themeId}-reels.mp3`. PRD 15 beslutter HVILKE reels / HVILKEN stemme; PRD 14 eier byggeren.
  2. **Override-disiplin respektert (karaoke-vern):** `reelsAudio` er en OVERRIDE-akse, ikke replacement (memory `reference_reels_audio_override`). Arbeidsflyten skriver ALDRI over tour-fila `{themeId}.mp3` — reels-mp3 har egen filnøkkel + defensiv `-reels`-suffiks-abort (`14:252-258`). PRD 15 regisserer innenfor denne disiplinen; den endrer ikke override-mekanismen.
  3. **Pipeline eid av PRD 14:** PRD 15 KJØRER byggerne (`14:206`); den re-hjemler ikke TTS-kjernen, override-mekanismen eller reels-video-pipelinen. Manus = pipeline-INPUT (PRD 14), ikke story-text (PRD 7).
  4. **TTS-validering på full pipeline:** når et nytt manus regisseres, dokumenterer runbooken at validering kjøres på full produksjons-pipeline, ikke kort snippet (memory `feedback_tts_validation` — modellen er stokastisk per request). Norske stedsnavn håndteres via PRD 14s alias-ordliste (`pronunciation-no.json`), ikke ad-hoc.
  5. Build-time, lagret output (mp3-er); ingen runtime-TTS.

### Unit 6 — Samlekart-klassifisering + scope-grense (hold overflaten tynn)
- **Mål (→ G6):** Klassifiser samlekart/multi-board eksplisitt som UT-AV-SCOPE (dødt Explorer/Guide-spor) så segment-overflaten holdes tynn.
- **Filer:** `@/docs/rebuild/nivaa-2-kurerings-runbook.md` (scope-grense-seksjon).
- **Avhengigheter:** ingen (klassifiserings-/dokumentasjons-beslutning).
- **Akseptansekriterier:**
  1. **Samlekart klassifisert UT-AV-SCOPE (begge dødt-spor-varianter):** TO distinkte samlekart-artefakter, begge ut-av-scope: (a) `lib/curated-lists.ts` (`CuratedList`/`CURATED_LISTS`) mater `/[area]/guide/[slug]` SEO-microsite = dødt Explorer/Guide-spor (manifest `:681`, n/a); (b) rapport-produktets eget «Samlekart» (overview-map i den gamle scroll-rapporten, `ReportPage.tsx:140` / `ReportOverviewMap` via `ReportMapPreviewCard.tsx:25`, manifest `:659` n/a — IKKE rebuild-boardet). Ingen av dem konsumeres av rebuild-board (`ReportReelsPage`/`BoardMap3D`). Dokumentert som deferred til separat Explorer/Guide-resume-task, IKKE nivå-2-kurering.
  2. **`ReportCuratedGrounded.tsx` klassifisert ut-av-scope (DØD renderer, ikke PRD-9-eid):** den er en grounding-narrative-RENDERER hvis eneste konsument er den gamle scroll-artikkelen (`ReportThemeSection.tsx:367`), ALDRI rebuild-boardet; manifest `:659` merker den n/a (ikke bæret inn). PRD 9 verken porterer eller eier den (grep i PRD 09 = 0 treff). PRD 15 produserer/QA-er grounding-DATAEN, ikke denne døde render-komponenten.
  3. **`ReportConfig.motiver` (samlekart intro-kort, `lib/types.ts:442-443`) klassifisert board-data:** det er et board-data-felt (PRD 5/9-concern), ikke kurerings-arbeidsflyt. PRD 15 rører det ikke.
  4. Klassifiseringen holder segment-overflaten tynn: ingen død katalog-kode trekkes inn i kurerings-arbeidsflyten (memory `project_summer_rebuild`: segment-overflate tynn/swappbar).

### Unit 7 — Validator-binding + verifikasjons-runbook (fullføringskriterium)
- **Mål (→ G7):** Bind arbeidsflyten til PRD 2-validatoren: kurert innhold tilfredsstiller validatorens nivå-2-tilstedeværelses-sjekker, og operatøren kjører validatoren som fullføringskriterium — uten render-gating.
- **Filer:** `@/docs/rebuild/nivaa-2-kurerings-verifikasjon-runbook.md` (ny — verifikasjons-runbook).
- **Avhengigheter:** Unit 1-6, PRD 2 (`validateReportTier` — KJØRES, eies ikke).
- **Akseptansekriterier:**
  1. **Validator som fullføringskriterium:** runbooken dokumenterer at operatøren kjører den kjørbare CLI-driveren `scripts/validate-report-tier.ts` (PRD 2 Unit 4 — henter board fra Supabase, injiserer board-dataen den lette readiness-sjekken trenger (`editorial` + `highlight-poi`), oversetter funn til exit-koder) etter kurering for å bekrefte at boardet oppfyller nivå 2 (kuratert `editorial`-tilstedeværelse, PRD 2 §5.3). Driveren wrapper den rene I/O-frie funksjonen `validateReportTier(...): ReportTierFinding[]` (PRD 2 §5.3 — funn er data, ingen throws); operatøren kjører driveren, ikke den rene funksjonen direkte. Dette er arbeidsflytens «ferdig betyr ferdig»-port (CLAUDE.md kvalitetsstandard).
  2. **Ingen render-gating introdusert:** validatoren sjekker TILSTEDEVÆRELSE (deklarasjon+validering, PRD 2), ALDRI en runtime-render-bryter (patch #4). Verifisert at ingen unit introduserer `if (reportTier)` i overflate-/render-kode.
  3. **Output FUNGERER, ikke bare «ser riktig ut» (CLAUDE.md output-fokus):** runbooken verifiserer i nystartet Chrome (memory `project_3d_default_map_engine`) at et kurert nivå-2-board faktisk viser kuratert editorial + branding + spillbar reels-audio med korrekt karaoke (memory `reference_reels_audio_override` — override-fila brukes, tour-karaoke uberørt).
  4. **Retnings-agnostisk verifisert:** runbooken bekrefter at arbeidsflyten kan kjøres for et vilkårlig prosjekt uavhengig av segment (samme steg for bruktmegler- og utbygger-prosjekt; kun innholdet varierer).
  5. **Full-dekning-rapportering:** runbooken krever at operatøren rapporterer fullstendighet per kurerings-akse (X av Y temaer kurert, Z av N assets fylt) — ikke sampling (CLAUDE.md kvalitetsstandard punkt 4).

---

## 8. Utviklingsløp (faser, ikke prioritets-tiers)

Rekkefølge styres av avhengigheter, ikke prioritet. Hele PRD-en er Lag 5 (blad-node) — den bygges etter at PRD 2/8/9/14/7 er ferdige.

**Fase 1 — Retnings-agnostisk grunnlag (ingen oppstrøms-kjerne-avhengighet).**
- Unit 1 (stemme-/kvalitets-kontrakt-formalisering) — formaliserer eksisterende skills; ingen kjerne-avhengighet.
- Unit 6 (samlekart-klassifisering) — ren klassifiserings-beslutning; ingen avhengighet.

**Fase 2 — Kjerne-konsumerende arbeidsflyter (krever oppstrøms-systemene ferdige).**
- Unit 2 (area-editorial-arbeidsflyt) — HARD avhengighet av PRD 8 Unit 4 (`apply-area-staging.ts` må eksistere).
- Unit 3 (grounding-QA + manus-curering) — konsumerer PRD 7 `curate-narrative` + PRD 14 manus-domene.
- Unit 4 (overflate-fylling) — konsumerer PRD 9 `project-brand`-modell.
- Unit 5 (reels/audio-regi) — konsumerer PRD 14-pipeline; krever Unit 3 (manus-QA) først.

**Fase 3 — Verifikasjon (krever alt over).**
- Unit 7 (validator-binding + verifikasjons-runbook) — binder alt til PRD 2-validatoren; verifiserer i nettleser.

---

## 9. Beslutninger

1. **Operatør-overflaten er build-time skills/scripts, IKKE en ny web-flate (RATIFISERT).** Den døde web-editorial-adminen (`app/admin/editorial/page.tsx`) er slettet av PRD 12 (`12:250-257`); PRD 12 er eksplisitt DISTINKT fra kurerings-arbeidsflyten (`12:174`, PRD-15-distinkt-fra-operatør-admin-raden); guardrailen krever tynn/swappbar. Derfor er operatør-overflaten de eksisterende Claude Code-skillsene (`curator`/`manus-curator`) + CLI-scriptene (`curate-area`/`curate-narrative`). **Merk:** oppstrøms-PRD-ene bruker ordet «UI»/«UI-OVERFLATE» i sine deferrals (`08:198` «kurerings-UI-OVERFLATE», `12:174` «kurerings-arbeidsflyt-UI») — det refererte til operatør-OVERFLATEN generisk, ikke en spesifikk web-flate. PRD 15 ratifiserer denne overflaten som build-time skills/scripts (ikke en grafisk web-UI) per tynn/swappbar-guardrailen; dette er en bevisst tolkning av den generiske «UI»-formuleringen, ikke et avvik fra oppstrøms-intensjonen. En ny web-flate ville vært over-bygging av den omstridte segment-overflaten (Åpne spørsmål #1).
2. **`apply-area-staging`-kjernen er en oppstrøms-AVHENGIGHET, ikke en PRD-15-leveranse (RATIFISERT).** PRD 8 Unit 4 ekstraherer den (`08:249-255`); PRD 15 konsumerer den. PRD 15 shell-er ikke ut til script der kjernen finnes. Hard beads-ordering: PRD 8 Unit 4 serialiseres FØR PRD 15 Unit 2 (Åpne spørsmål #2).
3. **Arbeidsflyten er segment-AGNOSTISK (RATIFISERT scope-invariant).** Segment-retningen er omstridt (memory); arbeidsflyten er identisk uansett, kun innholdet varierer. Ingen segment-spesifikke skills/templates/grener. Dette er å implementere scopet RIKTIG (tynn/swappbar), ikke å kutte det.
4. **Samlekart/multi-board er UT-AV-SCOPE (RATIFISERT).** To distinkte samlekart-artefakter, begge døde: (a) `curated-lists` guide-katalog → `/[area]/guide/[slug]` SEO-microsite, dødt Explorer/Guide-spor (manifest `:681`); (b) rapport-produktets overview-`Samlekart` i den gamle scroll-rapporten (`ReportPage.tsx:140` / `ReportOverviewMap`, manifest `:659` n/a — distinkt fra (a), ikke rebuild-boardet). `ReportCuratedGrounded` er en DØD scroll-rapport-renderer (manifest `:659` n/a; PRD 9 verken porterer eller eier den — grep i PRD 09 = 0 treff), ikke en rebuild-renderer; `ReportConfig.motiver` er board-data (PRD 5/9). Ingen er PRD-15-leveranse (Åpne spørsmål #3).
5. **Ingen ny QA-infrastruktur (tynn).** PRD 15 formaliserer den eksisterende menneskelige review-stegen i prepare→skill→apply-dansen; den bygger ikke nytt QA-verktøy (Åpne spørsmål #5).
6. **Bolig-6-tema-skopet er en arvet grense.** Area-editorial-kurering arver `area-staging.ts:21`s bolig-profil-skop (`08:53`); `naering`-area-editorial er deferred til PRD 8s profil-bevisste oppfølging. PRD 15 seeder ikke naering-area-kurering som in-scope.

---

## 10. Åpne spørsmål

1. **OPERATØR-OVERFLATE-FORM (15↔12) — RESOLVERT til Beslutning 1.** Evidens favoriserer sterkt build-time skills/scripts: dead web-editorial-admin slettet (PRD 12), PRD 12 eksplisitt distinkt (`12:174`, PRD-15-distinkt-fra-operatør-admin-raden), guardrail krever tynn. Flagg hvis en web-flate vurderes — det ville være over-bygging. *Status: lukket, men reviewer kan bekrefte.*
2. **BEADS-ORDERING (hard oppstrøms-avhengighet).** `lib/pipeline/apply-area-staging.ts` EKSISTERER IKKE i dag (verifisert `ls`); PRD 8 Unit 4 ekstraherer den. PRD 15 Unit 2s «del kjernen uten å shelle til script»-premiss avhenger av at PRD 8 Unit 4 fullfører FØRST. **Beads-grafen MÅ serialisere PRD 8 Unit 4 før PRD 15 Unit 2.** *Status: deklarert som hard dependency; krever beads-bekreftelse.*
3. **SAMLEKART-SCOPE — RESOLVERT til Beslutning 4.** INDEX bekrefter samlekart UT-AV-SCOPE: PRD-15-raden (`00-INDEX:43`) sier «Samlekart (dødt: curated-lists + scroll-overview) ute av scope», og finaliserings-noten (`00-INDEX:113`) gjentar «Samlekart (dødt Explorer/Guide-spor) eksplisitt ute av scope» — samsvarer med Beslutning 4. Evidens: samlekart-artefaktene tilhører dødt Explorer/Guide-spor; `ReportCuratedGrounded` er en DØD scroll-rapport-renderer (PRD 9 verken porterer eller eier den). Eksplisitt UT-AV-SCOPE, deferred til separat Explorer/Guide-resume (Unit 6). *Status: lukket; reviewer kan bekrefte.*
4. **DIREKSJONS-AGNOSTISK SCOPE.** Arbeidsflyten må være identisk uansett segment (bruktmegler vs utbygger). Bekreft at ingen megler-/utbygger-spesifikke units lekker inn (ingen segment-templates, ingen segment-betinget logikk). *Status: ratifisert som Beslutning 3; Unit 1 AC2 verifiserer.*
5. **GROUNDING-QA-SCOPE (15↔7).** PRD 7 deferrer «redaksjonell QA, godkjenning, manus-curatering utover grounding» hit (`07:191`). Avklaring: eier PRD 15 nytt QA-verktøy eller formaliserer den den eksisterende menneskelige review-stegen (les `.curated.md`, godkjenn, trigg `apply`)? Anbefaling (Beslutning 5): formaliser den eksisterende stegen, bygg ikke ny infrastruktur (tynn). *Status: anbefalt lukket; Unit 3 AC2 implementerer.*

---

## 11. Avhengigheter-graf

```
PRD 15 (nivå-2-kuratering, Lag 5, BLAD-NODE) ← 02, 08, 09, 14  (+ funksjonelt 07)

Oppstrøms (konsumeres, eies ikke):
  PRD 2  (tier-capability-manifest + validator)  → Unit 7 (validator-binding)
  PRD 8  (apply-area-staging-KJERNE, Unit 4)     → Unit 2 (HARD ordering: 8.U4 før 15.U2)
  PRD 9  (project-brand-modell + overflate)      → Unit 4 (overflate-fylling)
  PRD 14 (reels/audio-pipeline + override-akse)  → Unit 5 (reels/audio-regi)
  PRD 7  (grounding-output + curate-narrative)   → Unit 3 (grounding-QA)  [funksjonelt konsum]
  PRD 1  (skjema/typer: ProjectAssetFlags/ReportThemeAudio/areas.report_editorial) [transitivt]
  PRD 12 (operatør-admin — DISTINKT, ikke konsumert; PRD 15 er separat fra det)

Intern unit-graf:
  Fase 1: Unit 1 (stemme-kontrakt) ┐         Unit 6 (samlekart-klassifisering) [uavhengig]
                                   │
  Fase 2: Unit 2 (area-editorial) ←┘ + PRD 8.U4
          Unit 3 (grounding-QA)   ←  Unit 1 + PRD 7/14
          Unit 4 (overflate-fyll) ←  PRD 9
          Unit 5 (reels-regi)     ←  Unit 1 + Unit 3 + PRD 14
                                   │
  Fase 3: Unit 7 (validator + verifikasjon) ← Unit 1-6 + PRD 2

Nedstrøms: INGEN (blad-node, 00-INDEX Lag-5-raden / 00-INDEX:65).
```
