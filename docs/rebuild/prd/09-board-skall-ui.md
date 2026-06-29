# PRD 9 — Board-skall + UI + nivå-2-overflate

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling. (Fase 1 har ingen blokkerende åpne spørsmål — `BoardMap.tsx`-fil-eierskapet er nå RATIFISERT som Beslutning 3, ikke et åpent spørsmål.) **NB — Fase 2 Unit 4-blokkeren er OPPHEVET (kontroll-runde 2026-06-27):** klassifiseringen av Mapbox-2D-overlay-komponentene (Unit 4 AC3) er LØST — de er LIVE mountet (`BoardMap.tsx:478-514` inne i `{showMapbox && <Map>}`, `showMapbox` def `:203`) og BEHOLDES (Andreas-beslutning, Beslutning 14). Skjebnen henger ikke lenger på PRD 6 §10 Q2; den tidligere hard-gaten i §10 Q4 er opphevet.
> **Lag (byggrekkefølge):** Lag 3 (board-flate) — `00-INDEX:55`. Bygges etter PRD 2 (nivå-modell + kondisjonell-render-kontrakt), PRD 5 (board-data/state), PRD 6 (3D-motor).
> **PRD-nr:** 09 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-board-skall-ui`
> **Kontekst:** Lag-3-PRD. Eier det FELLES board-SKALLET (tier-/produkt-agnostisk komposisjon) som mounter 3D-motoren (PRD 6) og leser board-data/state (PRD 5): RSC board-side med SEO-metadata + tema→CSS-injeksjon, `ReportReelsPage`-komposisjonen (mobil/desktop-adaptiv), `BoardMap`-skall-wrapperen rundt motoren, `dynamic()`-lazy-load-grensene, board-UI-komponentene, `camera-tours`-DATAEN, `project-brand`-modellen, og nivå-2-UX-overflaten (branding + kuratert hero + reels-video) AKTIVERT av capability/assets-flagg — IKKE forket per tier (patch #4). Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md`, `docs/rebuild/prod-schema-snapshot.txt` og faktisk kode (`rapport-board/page.tsx`, `ReportReelsPage.tsx`, `BoardMap.tsx`, `BoardMapControls.tsx`, `camera-tours.ts`, `project-brand.ts`, splash-cluster, `reels-data.ts`, `DesktopStorySidebar.tsx`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **board-SKALLET**: den nivå-/produkt-agnostiske komposisjonen som binder sammen de tre lagene under den — board-DATA (PRD 5), 3D-motoren (PRD 6) og nivå-modellen (PRD 2) — til ÉN board-opplevelse. Skallet er rebuildens **komposisjons-lag**: det mounter, orkestrerer layout, og aktiverer betinget — men det **gater ALDRI på `reportTier`** (verifisert: `grep -c reportTier` = 0 i `ReportReelsPage.tsx`, `BoardMap.tsx`, `BoardMap3D.tsx`, `camera-tours.ts`, `project-brand.ts`; patch #4 / `00-INDEX` note #4).

CARRY-OVER linje 7 slår fast: «ÉN board-opplevelse = `ReportReelsPage` rendret av `/rapport-board`; nivå-2 = nivå-1 + branding + kuratert hero + reels-video + editorial-arv». Denne PRD-en operasjonaliserer dette: nivå-2-overflaten er ikke en kodegren, men en **betinget fylt overflate på samme skall**, aktivert av `assets`-flagg (`project-brand.ts:25`/`36`/`51`/`85` — alle gated på `assets?.brand`/`assets?.splashVideo`/`assets?.pinThumbnail`, ALDRI `if (reportTier)`).

Fire strukturelle grep definerer denne PRD-en:

1. **Skallet er en KOMPOSISJON, ikke en forking-maskin.** «Del nedover stacken, diverger oppover i UX» (CARRY-OVER lederparagraf, PRD 2 §1) materialiserer divergensen HER — men som betinget komposisjon (samme skall, betinget fylte slots), ikke som tier-grener. Den eneste divergens-aksen i skallet er overflate-aktivering via `assets`-flagg + mobil/desktop-adaptiv layout.

2. **RSC board-siden er allerede arkitektur-konform — bevar det.** `rapport-board/page.tsx` er en server-component (`async`, ingen `"use client"`) som henter board-DATA via `getProductAsync`/`getProjectAsync` (`page.tsx:3`/`41`/`44`) + `getProjectTranslations` server-side (`page.tsx:56`), eksporterer `generateMetadata` (SEO, `page.tsx:98-117`), injiserer tema→CSS-variabler på server (`page.tsx:58-84`), og cacher via `unstable_cache` + `revalidateTag`-taggen `product:${customer}_${slug}` (`page.tsx:8-16`). INGEN klient-XHR, INGEN `useEffect`-fetching. Porten MÅ bevare dette.

3. **Tunge moduler ligger bak `dynamic()`-grenser.** `ResponsiveLayout = dynamic(ResponsiveLayoutInner, {ssr:false, loading})` (`ReportReelsPage.tsx:1040-1044`) er skall-nivå lazy-load-grensen — BEVISST `ssr:false` (unngår SSR/client-mismatch på `useMediaQuery`-treet, kommentar `:1036-1039`), IKKE bare lazy-load. Denne PRD-en implementerer lazy-load-grense-SPEC-en PRD 2 Unit 6 deklarerte (nivå-1 betaler ikke for nivå-2-only moduler), og eier bundle-beviset.

4. **Nivå-2-overflate AKTIVERES, forkes ikke.** Splash-clusteret (`DesktopReportSplash`/`MobileReportSplash`/`EmbedArrivalLoader`) mottar `heroImage`/`heroVideo` fra `project-brand` (`ReportReelsPage.tsx:679-682` → `715-716`/`770-771`/`1013-1026`). Disse er `undefined` når `assets`-flagget mangler → skallet faller tilbake til nivå-1 (tekst-wordmark + `home.heroImage`), uten en eneste tier-sjekk. PRD 9 eier denne overflaten og RENDRER den betinget på `assets`-flaggene (ortogonale render-flagg); PRD 2 leverer kondisjonell-render-kontrakten (reglene for hva som vises når). brand/brokers er ortogonale render-flagg, IKKE noe PRD 2s lette nivå-2-readiness-sjekk validerer (den sjekker kun `invalid-tier` + `highlight-poi` + editorial@nivå2).

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | RSC board-siden portet arkitektur-konform: server-data-henting bevart, SEO-`generateMetadata` bevart, tema→CSS-injeksjon på server bevart, `unstable_cache`/`revalidateTag`-kontrakten bevart, embed-modus bevart. | Board-side-port (Unit 1). |
| **G2** | `ReportReelsPage`-komposisjonen portet og dekomponert (5+ ansvar → skall + uttrukket lib-logikk), mobil/desktop-adaptiv split bevart, død `mapbox-gl.css`-import slettet. | Skall-komposisjon-port + dekomponering (Unit 2). |
| **G3** | `BoardMap`-skall-wrapperen portet: mount-ORKESTRERINGEN rundt motoren (view-/cameraMode-state, controls-mount, pointer-events-skjold) eid her; persistent-mount-INVARIANTEN konsumeres fra PRD 6, eies ikke; død `PendingCamera`-import re-pekt mot motor-laget. | BoardMap-skall-wrapper-port (Unit 3). |
| **G4** | `BoardMapControls` + board-UI-komponentene portet med korrekt eierskaps-klassifisering (Mapbox-2D-overlay-komponentene er LIVE og BEHOLDES — kontroll-runde 2026-06-27 / Beslutning 14; `SubCategoryFilter`-komponenten = reference-only). | Board-UI-komponent-port (Unit 4). |
| **G5** | `camera-tours`-DATAEN + `getCameraTour`-accessoren eid her (mekanismen `getCategoryCamera` konsumeres fra PRD 6); data forberedt for DB/JSON-flytting. | Camera-tours-data-port (Unit 5). |
| **G6** | `project-brand`-modellen + nivå-2-UX-overflaten (splash-cluster, EmbedArrivalLoader, reels-video-rendring) portet og AKTIVERT av `assets`-flagg — ingen `reportTier`-render-bryter; demo-data flagget for Supabase-flytting. | Nivå-2-overflate-port (Unit 6). |
| **G7** | `dynamic()`-lazy-load-grensene implementert per PRD 2 Unit 6-spec; nivå-1-board laster ikke nivå-2-only moduler (bevist via bundle/chunk-output). | Lazy-load-implementasjon + bundle-bevis (Unit 7). |
| **G8** | Skallet bevist å fungere mot prod (mobil + desktop, nivå-1 + nivå-2-board), SEO-metadata verifisert, embed-flyt verifisert; alle mekaniske porter grønne. | Verifikasjon + mekaniske porter (Unit 8). |

---

## 3. Arkitektur-/migrasjons-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *komposisjons-/overflate-laget* — øverst i render-stacken, over motoren (PRD 6) og state/data (PRD 5). Skallet er der den bevisste UX-divergensen materialiserer seg, men den materialiserer seg som **betinget komposisjon på ÉT skall**, aldri som forket kode eller en tier-render-bryter (verifisert: 0 `reportTier`-ref i skall-filene; patch #4).

| Lag | Eierskap | Divergerer per tier? | Divergerer per profil? |
|-----|----------|----------------------|------------------------|
| Datamodell (`products.config`, `projects.has_3d_addon`) | PRD 1 | Nei | Nei |
| Nivå-modell + kondisjonell-render-kontrakt + lett nivå-2-readiness-sjekk | PRD 2 | Nei (beskriver render-reglene, gater ikke) | Nei |
| Board-data-transform + state (`BoardData`, reducer) | PRD 5 | Nei | Nei |
| 3D-motor (`MapView3D`, overlay, reveal, kamera-primitiver) | PRD 6 | Nei — identisk render | Nei |
| **Board-skall (RSC-side, `ReportReelsPage`, `BoardMap`-wrapper, controls, board-UI)** | **Denne PRD-en** | **Nei** — ÉT skall | Nei |
| **Nivå-2-UX-overflate (branding, hero, reels-video)** | **Denne PRD-en** | **Ja** — bevisst divergens, AKTIVERT av `assets`-flagg (capability), ikke forket | Nei |

> **NB — delt FOUNDATION, men UI/UX kan divergere på nivå (eier-presisering, walkthrough 2026-06-27).** Det BINDENDE prinsippet er at nivå 1 og nivå 2 deler **tech og oppsett** — RSC-side, data-laget, 3D-motoren, state, lazy-grenser, plumbing. ÉN foundation, ikke to parallelle apper. Det er IKKE et forbud mot at nivå 1 og nivå 2 får **egne UI/UX-uttrykk som kan skille seg mye over tid**. «Aldri forket / 0 `reportTier`-ref» beskriver dagens kode (der divergensen tilfeldigvis er asset-drevet) og verner mot en rigid capability-matrise — det er IKKE en sperre mot bevisst nivå-divergent UX. **Patch #4 presiseres (walkthrough 2026-06-27):** den forbyr capability-MATRISE-gating av enkeltfeatures (de vises på egne ortogonale data-/asset-flagg), IKKE nivå-bevisst UX-DESIGN. Note #8 sanksjonerer eksplisitt «kondisjonell render på nivå». Skillet: feature-capability-gating = nei; layout/flyt/presentasjon som skiller nivå 1 fra nivå 2 = ja, på den delte foundationen. (Full propagering av denne presiseringen til de andre patch-#4-PRD-ene tas i den helhetlige auditten.)

> **NB — `has3dAddon` er IKKE en tier-bryter.** `has3dAddon = project.has3dAddon ?? false` (`ReportReelsPage.tsx:187`) gater 2D/3D-toggle-flaten + `BoardMap3D`-mount (`BoardMap.tsx:437`), IKKE render per tier. Det er en Project-nivå-kolonne (`projects.has_3d_addon` boolean NOT NULL, snapshot:184), injisert separat fra `reportConfig` (PRD 2 §5.1). Skallet leser den som en addon-tilstedeværelse, ikke som et nivå.

> **NB — `hasVoiceOver` er datadrevet, ikke tier.** `BoardMap.tsx:129-136` utleder `hasVoiceOver` fra om board-dataen har spillbart VO (`c.audio || c.reelsAudio || welcome || home.audio || outro`), og dette styrer `cameraMode`-default (`:146-152`) + `showCameraMode`-prop på `BoardMapControls` (`:545`). Dette er lesning av board-data-INNHOLD (speiler `pickPlayableAudio`-seleksjon, PRD 5 §5.4), ikke `reportTier`.

> **NB — camera-tours er et ORTOGONALT render-flagg, ikke et nivå-krav (to-nivå-modell 2026-06-27, INDEX note #8).** Kamera-turer er et ortogonalt flagg uavhengig av nivå. To adskilte relasjoner gjelder for `getCameraTour`, og de må ikke blandes: **(1)** `getCameraTour`-SIGNATUREN + `camera-tours`-DATAEN er en live konsumert kontrakt mot PROVISJON (`provision-rapport.ts:270` under `create-report`, samt `validate-report-tier.ts:58` under `validate:tier`). Denne kontrakten er begrunnet av PROVISJON og skal bevares verbatim — den er IKKE et nivå-3-krav. **(2)** brokers/brand-modellen (`project-brand.ts`) er en ortogonal data-presence-akse PRD 9 RENDRER på (Unit 6); den injiseres IKKE til noen validator. PRD 2s nivå-2-readiness-sjekk sjekker kun `invalid-tier` + `highlight-poi` + editorial@nivå2 — ikke camera/VO/brokers/brand. (Tidligere «injisert til validatoren for nivå-3-sjekken»-formuleringer var den gamle 3-nivå-validatorens ordlyd og er fjernet her.)

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer fra board-skallet |
|---------------|--------------------------------------|
| `prd-kamera-flythrough` (10) | `camera-tours`-DATAEN + `getCameraTour`-accessoren (Unit 5) som den autorerte oval-spiral-touren bygger på, sammen med PRD 6s pose-primitiver. `00-INDEX:56`: PRD 10 ←06,09. |
| `prd-realtime-transport` (11) | Skall-flatene realtime-blocks rendres i (`DesktopStorySidebar` realtime-seksjon + 3D-overlay-popup via motoren). `00-INDEX:56`: PRD 11 ←01,09. |
| `prd-instrumentering` (13) | Emit-site-flatene på board-interaksjon (markør-klikk, kategori-bytte, splash-«Spill»-trykk) som wires inn i skall-komponentene. `00-INDEX:57`: emit-sites wires med board-PRD-ene. |
| `prd-audio-tour-reels` (14) | Reels-video-overflaten (`videoBgSrc`/`splashVideo`) som pipeline-output mater. `00-INDEX:59`: PRD 14 ←05,09. PRD 9 eier UX-rendringen; PRD 14 eier pipelinen som produserer filene. |
| `prd-nivaa-2-kuratering` (15-prov) | Nivå-2-overflaten skallet aktiverer; PRD 15 (hvis den materialiseres) fyller den via kurerings-arbeidsflyt. `00-INDEX:95`: åpent om PRD 15 lever vs. dekkes av PRD 9. |

### Migrasjons-kontekst (port-with-rewrite, ingen DB)

Denne PRD-en rører IKKE skjema (ingen migrasjon). Den er en kode-port: RSC-siden + `BoardMapControls` + `project-brand` + `reels-data` portes nær-verbatim; `ReportReelsPage` (1078 LOC), `BoardMap` (552 LOC) og `DesktopStorySidebar` (788 LOC) er port-with-rewrite (dekomponer, trekk forretningslogikk til `lib/`). `camera-tours`-DATAEN flyttes på sikt til DB/JSON (mekanismen bor i PRD 6). Demo-data i `project-brand` (`PROJECT_BROKERS`, `PIN_THUMBNAILS`) flagges for Supabase-flytting men beholdes verbatim i denne porten (prototype-stadium).

---

## 4. Eksisterende kodebase

### Bæres over — keeper-core (port nær-verbatim)

| Fil (@/-sti) | Rolle | Verifisert linje-ref |
|--------------|-------|----------------------|
| `components/variants/report/board/BoardMapControls.tsx` | Board-skall-kontroll-cluster (Auto/Fri + Kart/3D, mobil ⚙-FAB). Eksporterer `CameraMode`-typen. | `BoardMapControls:78`, `CameraMode='auto'\|'free':7`, `view/onViewChange:11-12`, `showCameraMode:20`/`83`, `collapsed:36`/`87`, `showCamera = view==='3d' && showCameraMode:90`, mobil-FAB `fabOpen:95` |
| `lib/themes/project-brand.ts` | Project-brand-MODELLEN = nivå-2-overflate-kilde. Asset-flagg→fil-sti-oppslag, alle gated på `assets`-flagg (ikke tier). | `getProjectLogoSrc:21` (`assets?.brand:25`), `getProjectSplashImage:32` (`:36`), `getProjectSplashVideo:47` (`assets?.splashVideo \|\| assets?.brand:51` = reels-video-gate), `getProjectBrokers:74` (in-memory `PROJECT_BROKERS:60`), `getProjectPinThumbnail:81` (`assets?.pinThumbnail:85`) |
| `components/variants/report/reels/reels-data.ts` | Reels-feed-transform (BoardData→reels-cards) + reels-VIDEO-felt. PRD 9 konsumerer video-UX; AUDIO-aksen (`reelsAudio ?? audio`) eies av PRD 14. | `buildReelsCards:231`, `videoSrc:13`/`videoBgSrc:25`/`37`/`50`/`63` (video-overflate-felt), `posterForVideo:145` (.mp4→.jpg), `cardIndexToAudioIndex:352`, `firstAudioBearingIndex:365`, `nextAudioBearingIndex:394`, `deriveSplashPrimaryLabel:378` |
| `components/variants/report/board/board-intros.ts` (DATA-delen) | **`BOARD_INTROS`-DATA-record** (per-slug intro-path-konfig) eies av PRD 9 — samme klasse som `camera-tours`-DATAEN. MEKANISMEN `getBoardIntro` (accessor) bor i PRD 6. (Kontroll-runde 2026-06-27 — DATA-hjemling.) | `BOARD_INTROS-record:20`, `getBoardIntro:47` (mekanisme → PRD 6) |
| `components/variants/report/board/board-establishing-shots.ts` (DATA-delen) | **`ESTABLISHING_SHOTS`-DATA-record** (per-slug establishing-path-konfig) eies av PRD 9 — samme klasse som `camera-tours`-DATAEN (PRD 9 eier allerede). MEKANISMEN `getEstablishingShot` (accessor) bor i PRD 6. (Kontroll-runde 2026-06-27 — DATA-hjemling, lukker foreldreløs keeper.) | `ESTABLISHING_SHOTS-record:13`, `getEstablishingShot:42` (mekanisme → PRD 6) |

### Bæres over — port-with-rewrite (omstrukturer ved port)

| Fil (@/-sti) | Rewrite-handling | Verifisert linje-ref |
|--------------|------------------|----------------------|
| `app/eiendom/[customer]/[project]/rapport-board/page.tsx` | Port arkitektur-konform RSC-side. Bevar server-data-henting (`getProductAsync`/`getProjectAsync`), `getProjectTranslations` server-side, `generateMetadata` (SEO), tema→CSS-injeksjon på server, `unstable_cache`+`revalidateTag`-tagg, embed/`?from=embed`-håndtering. Re-typ mot PRD 1-typer; bevar legacy-fallback-grenen så lenge `getProductAsync` kan returnere null. | RSC default async page `:28`, server-data `:3`/`41`/`44`/`56`, tema→CSS-injeksjon `:58-84`, mount `ReportReelsPage` `:86-95`, `generateMetadata` `:98-117`, `unstable_cache`+`tags product:{customer}_{slug}` `:8-16`+`revalidate:18`, embed-håndtering `:35-39` |
| `components/variants/report/reels/ReportReelsPage.tsx` | **Dekomponer (1078 LOC, 5+ ansvar).** Trekk forretningslogikk til `lib/` (CLAUDE.md: ingen forretningslogikk i komponenter). Bevar `BoardProvider`/transform-komposisjon, mobil/desktop-adaptiv split, `ResponsiveLayout = dynamic(ssr:false)`-grensen. **Slett DØD `mapbox-gl.css`-import (`:3`).** Bevar `has3dAddon`-injeksjon (ikke tier). | default export `:136`, `has3dAddon = project.has3dAddon ?? false:187`, `useMediaQuery(1024px):348`/`564`, `ResponsiveLayout dynamic ssr:false:1040-1044` (kommentar `:1036-1039`), `getProjectLogoSrc/Splash:63-65`/`679-682`, `Splash = isDesktop ? Desktop : Mobile:707`, `DesktopStorySidebar-mount:737`, `BoardMap-mount:760`/`905`, `EmbedArrivalLoader:1005`, `REELS_MONTAGE_PROJECTS:84`, DØD `mapbox-gl.css`-import `:3` |
| `components/variants/report/board/BoardMap.tsx` | Port skall-WRAPPER. Eier mount-ORKESTRERINGEN: view-/cameraMode-state, `BoardMapControls`-mount, pointer-events-skjold, layout. **Persistent-mount-INVARIANTEN (`:26-41` docstring + `:437`) EIES av PRD 6** — bevares, men eierskaps-grensen er §10 Q1. **Re-pek `PendingCamera`-import** (`:22`, fra død `UnifiedMapModal`) mot PRD 6s re-hjemlede motor-plassering. Mapbox-2D-flaten (`:451`-grenen med overlayet `:478-514`) er LIVE og BEHOLDES (kontroll-runde 2026-06-27 / Beslutning 14). | `BoardMap fn:94`, persistent-mount-docstring `:26-41`, `useBoard:104` (leser PRD 5-state), `view 2d/3d:118`, `hasVoiceOver:129-136`, `cameraMode + ?fly=1:146-152`, `BoardMap3D-mount betinget has3dAddon:437-447`, `Map react-map-gl-mount:456`, pointer-events-skjold `:525-531`, `BoardMapControls-mount:537-549`, `import PendingCamera fra UnifiedMapModal:22` |
| `components/variants/report/reels/DesktopStorySidebar.tsx` | **Dekomponer (788 LOC).** Desktop-divergert skall-UX (sidekolonne vs mobil bottom-sheet = mobile-native UX). Blander preview/aktiv-kort/megler/event-filter/sanntid — trekk ut. Realtime-delene (`POIRealtimeSection`/`useRealtimeData`) er PRD 11-grense → konsumeres, eies ikke. | `DesktopStorySidebar` (mount `ReportReelsPage.tsx:737`), 788 LOC (wc -l verifisert), CARRY-OVER `537-540` |
| `components/variants/report/reels/DesktopReportSplash.tsx` + `MobileReportSplash.tsx` + `EmbedArrivalLoader.tsx` | Port nivå-2-UX-overflaten (branding + kuratert hero + reels-video). Adaptiv (`Splash = isDesktop ? Desktop : Mobile`). Mottar `heroImage`/`heroVideo` fra `project-brand`. `EmbedArrivalLoader` = megler-iframe-innslagspunkt (`?from=embed`). Stillbilder via `next/image` (ESLint); `<video>` for reels-video OK. | import-cluster `ReportReelsPage.tsx:38-40`, `Splash adaptiv:707`, `heroImage/heroVideo mates:715-716`/`770-771`/`1013-1026`, `EmbedArrivalLoader ?from=embed:1005-1019`, CARRY-OVER `553-555` (nivå-2) |
| `components/variants/report/board/camera-tours.ts` | Port `camera-tours`-DATAEN + `getCameraTour`-accessoren + `clampPose`. PRD 9 eier DATAEN; PRD 6 eier MEKANISMEN (`getCategoryCamera` konsumeres av `BoardMap3D:510`). Rebuild flytter DATAEN til DB/JSON. | `CAMERA_TOURS-record:16-59` (stasjonskvartalet/byggetrinn-4), `getCameraTour:75` (DATA-accessor — LIVE konsumert av provisjon/validator, se §4), `getCategoryCamera:85` (mekanisme PRD 6), `clampPose:64` |

### Slettes / forlates (reference-only / dead)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `components/variants/report/board/SubCategoryFilter.tsx` | reference-only (0-konsument) | KOMPONENTEN (`SubCategoryFilter:33`) har INGEN live JSX-mount: `grep <SubCategoryFilter` finner 19 treff, ALLE i `SubCategoryFilter.test.tsx` (verifisert); 0 non-test imports (verifisert). HOOKEN `use-sub-category-filter.ts` (`deriveSubCategories`/`useSubCategoryFilter`) er det som lever, wired i `board-state.tsx:13-14`/`168` — eid av **PRD 5**. Komponenten er reference-only (analog med PRD 6s `Map3DActionButtons`). Hvis en live mount senere oppstår: re-vurder. (§10 Q1.) |
| `getCameraTour`-accessoren (i `camera-tours.ts`) | keeper, LIVE konsumert av provisjon/validator (0 RENDER-mount) | `getCameraTour:75` er LIVE konsumert i produksjons-pipelinen: `provision-rapport.ts:270` (`cameraTour: getCameraTour(slug)`, under npm `create-report`) + `validate-report-tier.ts:58` (under npm `validate:tier`) + validator-testen `report-tier.test.ts:389` (alle grep-verifisert). PROVISJON ER PRODUKSJON. Påstanden om «0 konsument» gjelder KUN render/board-MOUNT: ingen skall-/render-komponent kaller accessoren (kun `getCategoryCamera` mountes, `BoardMap3D:510`; `report-tier.ts:54` er en JSDoc-kommentar, ikke et kall). PRD 9 eier DATAEN + accessoren; PRD 3 (provisjon) + PRD 2 (validator) er LIVE konsumenter i dag, PRD 10 (autorert flythrough) er forventet render-konsument. Signaturen er en bærende kontrakt mot PRD 2/3 — endres den, knekker provisjons-pipelinen (`create-report` + `validate:tier`). (§10 Q2.) |
| DØD `mapbox-gl.css`-import (`ReportReelsPage.tsx:3`) | dead (slettes) | `import "mapbox-gl/dist/mapbox-gl.css"` på toppen av `ReportReelsPage` (verifisert `:3`). CARRY-OVER `523` markerer den død. Slettes ved port (CLAUDE.md «ALDRI la dead code ligge»). |
| `PendingCamera`-import fra `UnifiedMapModal` (`BoardMap.tsx:22`) | re-pekes (ikke slettes) | `UnifiedMapModal` er død scroll-modal (PRD 6 §4 dead-tabell). PRD 6 Unit 7 re-hjemler `PendingCamera` til motor-laget; BoardMap-porten oppdaterer importen til motor-plasseringen, ellers drar skallet inn død scroll-modal. |

### Grense-referanse (eid av PRD 6, ikke PRD 9 — tas med for grense)

| Fil (@/-sti) | Eier | Grense |
|--------------|------|--------|
| `components/variants/report/board/BoardMap3D.tsx` | PRD 6 | 3D-motor-orkestrator (785 LOC). Skallet KONSUMERER den via `BoardMap`-wrapperen (`BoardMap.tsx:437`). PRD 9 eier IKKE motoren — grensen 09↔06. |
| `components/variants/report/board/CameraCutOverlay.tsx` | **PRD 6 (RATIFISERT)** | Cream-flash cut-overlay; mountet KUN i `BoardMap3D.tsx:759` (motor-fila, import `:12`), driftet av `useBoard3DCamera` + `CUT_FADE_MS` (PRD 6 Unit 5). Briefen lister den som board-UI, men koblingen er motor-intern. **RATIFISERT: PRD 6 eier komponenten** (§10 Q3 / Beslutning 15, kontroll-runde 2026-06-27). WebGL-context-håndhevelsen (mount-orkestreringen `BoardMap.tsx:437`/`:203`/`:451`) eies av PRD 9 (Unit 3). |
| `BoardMarker/HomeMarker/BoardPOILabel/BoardPathLayer/BoardPathMidpointMarker/BoardPOIMiniPopup` | **LIVE — beholdt (PRD 9)** | **KORRIGERT (kontroll-runde 2026-06-27): IKKE dead/0-mount.** Disse seks er LIVE mountet i `BoardMap.tsx:478-514` inne i `{showMapbox && <Map>}`-grenen (`<HomeMarker>:478`, `<BoardMarker>:490`, `<BoardPathLayer>:511`, `<BoardPathMidpointMarker>:512`, `<BoardPOILabel>:513`, `<BoardPOIMiniPopup>:514`). `showMapbox = !has3dAddon \|\| view === "2d"` (`BoardMap.tsx:203`) → Mapbox-2D er ENESTE kart-motor for prosjekter UTEN 3D-addon, OG en live 2D-toggle-flate for addon-prosjekter. Live på rutene rapport-board/rapport-reels/event-board. 3D-flaten bruker i tillegg `BoardPOI3DMiniPopup` (PRD 6 Unit 2). **BESLUTNING (Andreas): BEHOLD dem — port-with-rewrite, IKKE slett.** Skjebnen henger ikke lenger på PRD 6 §10 Q2. (Kontroll-runde 2026-06-27; tidligere «skjebne-bundet/dead-if-dropped»-klassifisering var falsifisert.) |

---

## 5. Datakontrakt (felt PRD-en eier / konsumerer)

### 5.1 Konsumeres fra PRD 2 (kondisjonell-render-kontrakt + taksonomi)

| Symbol | Rolle i skallet | Kilde |
|--------|-----------------|-------|
| Kondisjonell-render-kontrakten (nivå 2 + de fem ortogonale render-flaggene: 3D/VO/camera/brokers/brand) | Reglene for hva som vises når. Skallet IMPLEMENTERER renderingen mot denne kontrakten: hver akse driver rendering uavhengig (data-presence/`assets`-flagg), ALDRI `if (reportTier)`. Det finnes ingen `TIER_CAPABILITIES`-matrise og ingen `requires*`/`recommends*`-feltliste å lese — nivå 2 legger kun til kuratert editorial, resten er ortogonale flagg. | PRD 2 §5.2 (kondisjonell-render-kontrakt) |
| `getProjectBrokers`/`project-brand`-tilstedeværelse (brokers/brand = ortogonale render-flagg) | brokers/brand-modellen (`project-brand.ts`) er en data-presence-akse PRD 9 RENDRER på (Unit 6) — ortogonalt render-flagg, uavhengig av nivå. Den injiseres IKKE til en validator (PRD 2s lette nivå-2-readiness-sjekk sjekker kun `invalid-tier` + `highlight-poi` + editorial@nivå2, ikke brokers/brand/camera/VO). | PRD 2 §5.2, PRD 9 Unit 6 |
| Lazy-load-grense-SPEC (PRD 2 Unit 6) | Skallet IMPLEMENTERER `dynamic()`-grensene + bundle-beviset (PRD 2 Beslutning 14). | PRD 2 Unit 6, `188-189` |

### 5.2 Konsumeres fra PRD 5 (board-data + state)

| Symbol | Rolle i skallet | Kilde |
|--------|-----------------|-------|
| `BoardData` (`home`/`categories`/`welcome`/`outro`/`brokers`/`summary`/`cta`/`poisById`/`assets`/`venueType`) | Komponeres av `ReportReelsPage` via `transformToReportData`→`adaptBoardData`. Skallet leser, eier ikke. `assets` (`ProjectAssetFlags`) driver nivå-2-overflate-aktivering. | `board-data.ts:127` (PRD 5 §5.1) |
| `BoardProvider`/`useBoard`/`useActiveCategory`/`useActivePOI`/`useFilteredActiveCategory` | Skallet wrapper i `BoardProvider` og konsumerer selector-hooks (`BoardMap.tsx:104` `useBoard`). board-versjon `useActivePOI` (ikke `lib/store`). | `board-state.tsx:154`/`194`/`202`/`208`/`215` (PRD 5 §5.5) |
| `visiblePoiIds`/`collectionPoiIds` | Skallet INJISERER disse container-nivå-feltene til `BoardProvider` (`board-state.tsx:140`/`149`); reducer-shapen uendret. | PRD 5 §5.1, Deferred-tabell |
| i18n: `t`/`getThemeQuestion` + `applyTranslations`-output | UI-strings + EN-overlay (server-hentet `enTranslations`, `page.tsx:56`). | PRD 5 Unit 4 |
| `pickPlayableAudio`-SELEKSJON (`hasVoiceOver`-signal) | `BoardMap.tsx:129-136` utleder `hasVoiceOver` fra board-data (speiler seleksjon, ikke tier). | PRD 5 §5.4 |

### 5.3 Konsumeres fra PRD 6 (3D-motor)

| Symbol | Rolle i skallet | Kilde |
|--------|-----------------|-------|
| `MapView3D` / `BoardMap3D` | `BoardMap`-wrapperen MOUNTER `BoardMap3D` betinget på `has3dAddon` (`BoardMap.tsx:437`); komponeres, eies ikke. | PRD 6 Unit 1/7 |
| Persistent-mount-INVARIANT + WebGL-context-vern | EIES av PRD 6 (06 Unit 1 AC7, 06 §10 Q1); PRD 9 eier mount-ORKESTRERINGEN rundt (state/layout/controls). Eierskaps-grense §10 Q1. | `BoardMap.tsx:26-41`/`437` |
| `getCategoryCamera`/`deriveCategoryCamera`-MEKANISME | PRD 9 eier `camera-tours`-DATAEN + `getCameraTour`-accessoren; PRD 6 eier mekanismen som leser dataen (`BoardMap3D:510`). | PRD 6 §10 Q3, 06 Beslutning 6 |
| `PendingCamera`-typen (re-hjemlet i motor-laget) | BoardMap-porten importerer fra ny motor-plassering, ikke `UnifiedMapModal`. | PRD 6 Unit 7 |

### 5.4 Eies av denne PRD-en

| Symbol | Eierskap | Note |
|--------|----------|------|
| `CameraMode` (`'auto'\|'free'`) | PRD 9 | `BoardMapControls.tsx:7` — skall-kontroll-typen |
| `CAMERA_TOURS` + `getCameraTour` + `clampPose` | PRD 9 | `camera-tours.ts:16`/`75`/`64` — DATAEN + accessoren (mekanismen `getCategoryCamera` er PRD 6) |
| `BOARD_INTROS`-DATA-record | PRD 9 (DATA) | `board-intros.ts:20` — per-slug intro-path-DATA, samme klasse som `CAMERA_TOURS`. MEKANISMEN `getBoardIntro` (`:47`) er PRD 6. (Kontroll-runde 2026-06-27.) |
| `ESTABLISHING_SHOTS`-DATA-record | PRD 9 (DATA) | `board-establishing-shots.ts:13` — per-slug establishing-path-DATA, samme klasse som `CAMERA_TOURS`. MEKANISMEN `getEstablishingShot` (`:42`) er PRD 6. (Kontroll-runde 2026-06-27 — lukker foreldreløs keeper.) |
| `getProjectLogoSrc`/`getProjectSplashImage`/`getProjectSplashVideo`/`getProjectBrokers`/`getProjectPinThumbnail` + `PROJECT_BROKERS`/`PIN_THUMBNAILS` | PRD 9 | `project-brand.ts` — nivå-2-overflate-modell, `assets`-flagg-gated. Demo-data flagges for Supabase-flytting (`PROJECT_BROKERS:60`, `PIN_THUMBNAILS:16`). |
| Reels-VIDEO-UX-felt (`videoSrc`/`videoBgSrc`/`posterForVideo`) + reels-feed-render | PRD 9 | `reels-data.ts:13`/`25`/`145` — video-overflate-rendring. AUDIO-aksen (`reelsAudio ?? audio`) eies av PRD 14. |
| `REELS_MONTAGE_PROJECTS`-allowlist | PRD 9 (DATA-flagg) | `ReportReelsPage.tsx:84` — video-gating-DATA (CARRY-OVER `243`: «data/asset-flagg i rebuild», ikke PRD 14-pipeline). (§10 Q6.) |
| Splash-cluster + `EmbedArrivalLoader` (nivå-2-overflate) | PRD 9 | branding + hero + reels-video + embed-innslagspunkt |
| RSC board-side-komposisjon + tema→CSS-injeksjon | PRD 9 | `page.tsx` — mount + SEO + tema; board-DATA-henting (`getProductAsync`) er PRD 3/5-grense |

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. RSC board-siden (`rapport-board/page.tsx`): server-data-mount + `generateMetadata` (SEO) + tema→CSS-injeksjon + `unstable_cache`/`revalidateTag` + embed-modus.
2. `ReportReelsPage`-komposisjonen (mobil/desktop-adaptiv) + dekomponering (forretningslogikk → `lib/`).
3. `BoardMap`-skall-wrapperen: mount-ORKESTRERING rundt motoren (view/cameraMode-state, controls-mount, pointer-events-skjold) — IKKE persistent-mount-invarianten (PRD 6).
4. `BoardMapControls` + board-UI-komponentene (med korrekt eierskaps-klassifisering).
5. `camera-tours`-DATAEN + `getCameraTour`-accessoren (mekanismen er PRD 6).
6. `project-brand`-modellen + nivå-2-UX-overflaten (splash-cluster, `EmbedArrivalLoader`, reels-video-rendring) AKTIVERT av `assets`-flagg.
7. `dynamic()`-lazy-load-grensene (implementasjon av PRD 2 Unit 6-spec) + bundle-bevis.
8. `DesktopStorySidebar` desktop-divergert skall-UX (dekomponert; realtime-delene er PRD 11-grense).

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| 3D-motor-interne + persistent-mount-INVARIANT + WebGL-context-vern (skallet konsumerer, eier ikke) | **PRD 6 (prd-3d-motor)** |
| Board-data-transform + state-reducer (`adaptBoardData`, `boardReducer`) | **PRD 5 (prd-board-data-state)** |
| Autorert oval-spiral-flythrough-OPPLEVELSE + `?film=1`-produkt (skallet leverer `camera-tours`-DATAEN; opplevelsen bygges der) | **PRD 10 (prd-kamera-flythrough)** |
| Realtime-transport-DATA/hooks (`useRealtimeData`, Entur/bysykkel/hyre); skallet leverer flatene de tegnes i | **PRD 11 (prd-realtime-transport)** |
| Reels-AUDIO/TTS-pipeline + `reelsAudio`-override (skallet eier reels-VIDEO-UX-rendringen) | **PRD 14 (prd-audio-tour-reels)** |
| Nivå-2 menneskelig kurerings-arbeidsflyt som FYLLER overflaten skallet aktiverer | **PRD 15-prov (prd-nivaa-2-kuratering)** — hvis den materialiseres (`00-INDEX:95`) |
| Instrumentering-emit-IMPLEMENTASJON (skallet eksponerer emit-site-flatene) | **PRD 13 (prd-instrumentering)** |
| `camera-tours`-DATA flyttet fra hardkodet TS-record til DB/JSON | Egen oppryddings-task etter at skallet er verifisert (prototype-stadium beholder TS-record) |
| `PROJECT_BROKERS`/`PIN_THUMBNAILS` demo-data flyttet til Supabase | Egen task / **PRD 3 (provisjon)** når ekte broker-data skrives ved oppsett |

**Eksplisitt ikke-scope (patch #4):** render-gating på `reportTier`. Skallet AKTIVERER nivå-2-overflaten via `assets`-flagg (capability), aldri en tier-render-bryter (verifisert: 0 `reportTier`-ref i skall-filene). Ingen unit bygger en tier-render-bryter.

---

## 7. Implementation Units (8 av 8 dekket)

### Unit 1 — RSC board-side-port (server-data + SEO + tema-injeksjon + cache)
- **Mål (→ G1):** Port `rapport-board/page.tsx` arkitektur-konform: server-data-henting, SEO-metadata, tema→CSS-injeksjon på server, cache-/revalidering-kontrakt, embed-modus.
- **Filer:** `@/app/eiendom/[customer]/[project]/rapport-board/page.tsx` (port).
- **Avhengigheter:** PRD 5 (`getProjectTranslations` + `BoardData`-form), PRD 3 (`getProductAsync`/`getProjectAsync` data-server — KONSUMERES, eies ikke).
- **Akseptansekriterier:**
  1. Siden forblir server-component (`async`, INGEN `"use client"`); board-DATA hentes server-side via `getProductAsync`/`getProjectAsync` (`page.tsx:41`/`44`) + `getProjectTranslations` (`page.tsx:56`) — INGEN `useEffect`-fetching, INGEN `@supabase/supabase-js`-direkte fra klient (arkitekturregel bevart).
  2. `generateMetadata` eksporteres med `title`/`description`/`alternates.canonical` (`page.tsx:98-117`) — SEO-metadata-eksport-regel oppfylt.
  3. Tema→CSS-variabel-injeksjonen (`hexToHslChannels`, `page.tsx:58-84`) bevart og kjøres på server — nivå-2-branding gated på server, ikke klient.
  4. `unstable_cache` med `tags: [product:${customer}_${slug}]` + `revalidate: 3600` bevart (`page.tsx:8-16`/`18`); cache-bust via `revalidateTag` (eid av PRD 7-grensen) fungerer fortsatt.
  5. Embed-modus bevart: `?embed`/`?embed=1`/`?embed=true` → embed-flagg (`page.tsx:35-36`); `?from=embed` → `fromEmbed`-flagg (`page.tsx:37-39`); begge mates til `ReportReelsPage` (`page.tsx:88-93`).
  6. Re-typet mot PRD 1-typer; `npx tsc --noEmit` 0 feil. INGEN `reportTier`-render-bryter introdusert.
- **Avhengigheter (graf):** PRD 5, PRD 3.

### Unit 2 — `ReportReelsPage`-komposisjon-port + dekomponering
- **Mål (→ G2):** Port skall-komposisjonen (mobil/desktop-adaptiv) og dekomponer 1078-LOC-fila; trekk forretningslogikk til `lib/`; slett død import.
- **Filer:** `@/components/variants/report/reels/ReportReelsPage.tsx` (port + dekomponer), nye `lib/`-moduler for uttrukket logikk (f.eks. splash-/hero-derivasjon).
- **Avhengigheter:** Unit 1 (siden mounter denne), PRD 5 (`BoardProvider`/transform), PRD 6 (`BoardMap`-barn-kontrakt — `BoardMap` MÅ være direkte barn, CARRY-OVER `523`).
- **Akseptansekriterier:**
  1. **DØD `mapbox-gl.css`-import (`:3`) SLETTET** (CARRY-OVER `523`); `grep "mapbox-gl.css"` på fila returnerer tomt.
  2. Mobil/desktop-adaptiv split bevart: `useMediaQuery("(min-width: 1024px)")` (`:348`/`564`), `Splash = isDesktop ? DesktopReportSplash : MobileReportSplash` (`:707`), desktop-gren mounter `DesktopStorySidebar` (`:737`).
  3. `ResponsiveLayout = dynamic(ResponsiveLayoutInner, {ssr:false, loading})` (`:1040-1044`) BEVART som skall-nivå adaptiv lazy-load-grense — `ssr:false` er bevisst (SSR/client-mismatch på `useMediaQuery`, `:1036-1039`), ikke bare lazy.
  4. `has3dAddon = project.has3dAddon ?? false` (`:187`) bevart og mates til `BoardMap` (`:760`/`905`) — IKKE en tier-sjekk.
  5. Forretningslogikk (splash/hero/label-derivasjon, audio-bearing-navigasjon-orkestrering) trukket til `lib/` (CLAUDE.md: ingen forretningslogikk i komponenter). `BoardMap` forblir direkte barn (CARRY-OVER `523`).
  6. `next/image` for splash/hero stillbilder (ESLint); `<video>` for reels-video OK. ALLTID Zustand-selectors for audio-tour-store (ikke hele store).
  7. **No-photo-fallback i `DesktopStorySidebar`-POI-listen (foto DEFERRED, INDEX note #9 / PRD 4):** sidebar-listens preview-/aktiv-kort rendrer **kategorifarge + ikon-fallback** når POI-ens `featured_image` er `null` (PRD 5s transform leverer feltet nullable / foto-agnostisk) — IKKE broken image, ikke crash. Når foto-tasken lander byttes fallback-en ut mot faktisk bilde uten skall-endring.
  8. `npx tsc --noEmit` 0 feil; ingen `reportTier`-ref introdusert.

### Unit 3 — `BoardMap`-skall-wrapper-port (mount-orkestrering rundt motoren)
- **Mål (→ G3):** Port skall-wrapperen: view-/cameraMode-state, controls-mount, pointer-events-skjold, layout. Persistent-mount-INVARIANTEN konsumeres fra PRD 6 (eies ikke). Re-pek `PendingCamera`.
- **Filer:** `@/components/variants/report/board/BoardMap.tsx` (port).
- **Avhengigheter:** PRD 5 (`useBoard`-state), PRD 6 (`BoardMap3D`-mount-kontrakt + persistent-mount-invariant + re-hjemlet `PendingCamera`). Eierskaps-grense §10 Q1.
- **Akseptansekriterier:**
  1. Wrapperen MONTERER `BoardMap3D` betinget på `has3dAddon` (`:437-447`) og river det ALDRI ned — persistent-mount-INVARIANTEN (`:26-41` docstring) bevart. **Eierskap (RATIFISERT, Beslutning 3):** PRD 9 eier HELE FILA + mount-ORKESTRERINGEN (state/layout/controls) og er beads-single-owner; INVARIANT-LINJENE (`:26-41`/`:437`, 06 Unit 1 AC7) er en gjennomgått kontrakt fra PRD 6 som PRD 9 ikke bryter. Grensen er LUKKET (§10 Q5 peker til Beslutning 3), ikke et åpent spørsmål.
  2. `view` 2d/3d-state (`:118`) + `cameraMode` auto/free-state (`:146-152`, inkl. `?fly=1`-default) eid av skallet; `hasVoiceOver` (`:129-136`) utledes datadrevet fra board-data (speiler `pickPlayableAudio`-seleksjon, IKKE tier).
  3. `BoardMapControls` mountes betinget `has3dAddon && interactive` (`:537-549`) med `showCameraMode={hasVoiceOver}` (`:545`) — datadrevet, ikke tier.
  4. Pointer-events-skjold ved `!interactive` (`:525-531`) bevart (deaktiverer kart-interaksjon under intro-flythrough).
  5. **`PendingCamera`-importen (`:22`) RE-PEKT** mot PRD 6s re-hjemlede motor-plassering; `grep "UnifiedMapModal"` på fila returnerer tomt (skallet drar ikke inn død scroll-modal).
  6. `useBoard` (`:104`) leser PRD 5-state (board-versjon, ikke `lib/store`); audio-tour-store via selectors (`useAudioTourPhase`/`useCurrentTrack`, `:19`). Mapbox-2D-flaten (`:451`-grenen, `<Map>` `:456`, overlay `:478-514`) er LIVE og BEHOLDES (kontroll-runde 2026-06-27 / Beslutning 14); `showMapbox`-orkestreringen (`:203`) eies av denne unit som del av mount-orkestreringen.
  7. `npx tsc --noEmit` 0 feil; ingen `reportTier`-ref.

### Unit 4 — Board-UI-komponent-port (controls + markører + filter-klassifisering)
- **Mål (→ G4):** Port `BoardMapControls` + klassifiser board-UI-komponentene korrekt (Mapbox-2D-overlay er LIVE og BEHOLDES — kontroll-runde 2026-06-27 / Beslutning 14; `SubCategoryFilter` = reference-only).
- **Filer:** `@/components/variants/report/board/BoardMapControls.tsx` (port verbatim), `@/components/variants/report/board/SubCategoryFilter.tsx` (klassifiser reference-only), Mapbox-2D-overlay-komponentene (LIVE — port-with-rewrite; kontroll-runde 2026-06-27).
- **Avhengigheter:** Unit 3 (`BoardMap` mounter controls). (Mapbox-2D-skjebnen er IKKE lenger gatet på PRD 6 §10 Q2 — opphevet kontroll-runde 2026-06-27.)
- **Akseptansekriterier:**
  1. `BoardMapControls` portet verbatim: `CameraMode`-typen eksportert (`:7`), `view/onViewChange` (`:11-12`), `showCameraMode` (`:20`/`83`), `collapsed` mobil ⚙-FAB (`:36`/`87`/`95`), `showCamera = view==='3d' && showCameraMode` (`:90`). Eksisterende `BoardMapControls.test.tsx` passerer.
  2. **`SubCategoryFilter.tsx`-KOMPONENTEN klassifisert reference-only:** verifisert 0 live JSX-mount (alle 19 `<SubCategoryFilter`-treff er i `.test.tsx`; 0 non-test imports). HOOKEN `use-sub-category-filter` (PRD 5) er det som lever. Komponenten porteres IKKE som aktiv skall-UI; behold kun hvis reviewer bekrefter fremtidig bruk (§10 Q1).
  3. **Mapbox-2D-overlay-komponentene** (`BoardMarker`/`HomeMarker`/`BoardPOILabel`/`BoardPathLayer`/`BoardPathMidpointMarker`/`BoardPOIMiniPopup`) er **LIVE og BEHOLDES** (kontroll-runde 2026-06-27): de er mountet i `BoardMap.tsx:478-514` inne i `{showMapbox && <Map>}`-grenen, og `showMapbox = !has3dAddon || view === "2d"` (`:203`) gjør Mapbox-2D til ENESTE kart-motor for ikke-addon-prosjekter + live 2D-toggle for addon-prosjekter. De porteres som port-with-rewrite (race-plaster), IKKE som dead/slettes. Skjebnen henger IKKE lenger på PRD 6 §10 Q2 — den tidligere hard-gaten er OPPHEVET. Eksisterende `blob-pois.test.ts`/board-UI-tester for overlayet skal fortsatt passere.
  4. Stillbilder i alle board-UI via `next/image` (ESLint); ingen `<img>`.
  5. **No-photo-fallback (foto DEFERRED, INDEX note #9 / PRD 4):** POI-kort/popup-board-UI (`BoardPOIMiniPopup` + 3D-overlay-popup-flaten) rendrer en **kategorifarge + ikon/pin-fallback** når POI-ens `featured_image` er `null` — IKKE et broken image, ikke en crash. PRD 5s transform leverer `featured_image` nullable (foto-agnostisk), så board-UI MÅ ikke anta at feltet finnes. Når foto-tasken lander byttes fallback-en ut mot faktisk bilde uten skall-endring. 3D-markørene er allerede kategorifarge-baserte (PRD 6) → pin-laget upåvirket.
  6. `npx tsc --noEmit` 0 feil; `npm run lint` 0 errors.

### Unit 5 — `camera-tours`-data-port (DATA + accessor, mekanisme er PRD 6)
- **Mål (→ G5):** Port `camera-tours`-DATAEN + `getCameraTour`-accessoren + `clampPose`; forbered for DB/JSON-flytting. Mekanismen (`getCategoryCamera`) konsumeres fra PRD 6.
- **Filer:** `@/components/variants/report/board/camera-tours.ts` (port), `camera-tours.test.ts` (port).
- **Avhengigheter:** PRD 6 (`getCategoryCamera`-mekanismen konsumerer DATAEN; `BoardMap3D:510`), PRD 3 (provisjon injiserer `getCameraTour(slug)`-DATAEN i pipelinen, `provision-rapport.ts:270`), PRD 2 (validatoren mottar `cameraTour`-argumentet via provisjon, `validate-report-tier.ts:58`).
- **Akseptansekriterier:**
  1. `CAMERA_TOURS`-record (`:16-59`, stasjonskvartalet/byggetrinn-4) + `clampPose` (`:64`) + `getCameraTour` (`:75`) + `getCategoryCamera` (`:85`) portet. `clampPose` klamper tilt 0–90, heading [0,360), range ≥1 (`:64-72`).
  2. **DATA vs MEKANISME-grense dokumentert:** PRD 9 eier `CAMERA_TOURS`-DATAEN + `getCameraTour`-accessoren; PRD 6 eier `getCategoryCamera`/`deriveCategoryCamera`-MEKANISMEN som leser dataen (`BoardMap3D:510`). Filen kan fysisk bo i board-mappa, men eierskaps-aksene er adskilte (jf. PRD 6 §10 Q3, 06 Beslutning 6).
  3. **`getCameraTour`-accessor-status notert:** verifisert LIVE konsumert i produksjons-pipelinen i dag — `provision-rapport.ts:270` (npm `create-report`) + `validate-report-tier.ts:58` (npm `validate:tier`) + validator-test `report-tier.test.ts:389` (alle grep-verifisert). 0 RENDER/board-mount (kun `getCategoryCamera` mountes; `report-tier.ts:54` er JSDoc-kommentar, ikke kall). Accessoren beholdes (test-dekket); PRD 10 (autorert flythrough) er forventet render-konsument. Ikke slettet (§10 Q2).
  4. **Signaturen bevares som bærende kontrakt for PRD 2/PRD 3 — begrunnet av PROVISJON, ikke av nivå-validering.** `getCameraTour(slug)`-DATAEN injiseres LIVE i provisjons-pipelinen (`provision-rapport.ts:270`), og videreføres til validatoren som `cameraTour`-argument (`validateReportTier({ ..., cameraTour: getCameraTour(slug) })`, `validate-report-tier.ts:58`). Porten MÅ bevare accessor-signaturen verbatim — en port-agent skal IKKE behandle den som spekulativ og endre den, ellers knekker provisjons-pipelinen (`create-report` + `validate:tier`). Eksport-grensen leveres her; PRD 2/3-konsumet selv er deferred til de respektive PRD-ene.
  5. `camera-tours.test.ts` (dekker `clampPose`/`getCameraTour`/`getCategoryCamera`) passerer.

### Unit 6 — `project-brand`-modell + nivå-2-UX-overflate-port
- **Mål (→ G6):** Port `project-brand`-modellen + nivå-2-overflaten (splash-cluster, `EmbedArrivalLoader`, reels-video) AKTIVERT av `assets`-flagg; flagg demo-data for Supabase.
- **Filer:** `@/lib/themes/project-brand.ts` (port verbatim), `@/components/variants/report/reels/DesktopReportSplash.tsx` + `MobileReportSplash.tsx` + `EmbedArrivalLoader.tsx` (port), `@/components/variants/report/reels/reels-data.ts` (port video-UX-delen).
- **Avhengigheter:** PRD 5 (`BoardData.assets`/`ProjectAssetFlags`), PRD 2 (kondisjonell-render-kontrakten — brokers/brand er ortogonale render-flagg PRD 9 RENDRER på; de injiseres IKKE til en validator).
- **Akseptansekriterier:**
  1. `project-brand`-modellen portet verbatim: `getProjectLogoSrc` (`:21`, gated `assets?.brand:25`), `getProjectSplashImage` (`:32`/`36`), `getProjectSplashVideo` (`:47`, gated `assets?.splashVideo || assets?.brand:51` = reels-video-gate), `getProjectBrokers` (`:74`), `getProjectPinThumbnail` (`:81`/`85`). **ALLE gated på `assets`-flagg, ALDRI `if (reportTier)`** (verifisert 0 `reportTier`-ref) — nivå-2-overflate AKTIVERES av capability, forkes ikke.
  2. Splash-clusteret portet adaptivt (`Splash = isDesktop ? Desktop : Mobile`, `ReportReelsPage.tsx:707`); mottar `heroImage`/`heroVideo` fra `project-brand` (`:679-682` → `:715-716`/`:770-771`/`:1013-1026`). `undefined`-asset → fall tilbake til nivå-1 (tekst-wordmark + `home.heroImage`) UTEN tier-sjekk.
  3. `EmbedArrivalLoader` portet som megler-iframe-innslagspunkt (`?from=embed`, `:1005-1019`); mottar samme hero/video-overflate.
  4. Reels-VIDEO-UX portet: `videoBgSrc`-render + `posterForVideo` (.mp4→.jpg, `reels-data.ts:145`). AUDIO-aksen (`reelsAudio ?? audio`) IKKE eid her — PRD 14-grense bevart. `REELS_MONTAGE_PROJECTS`-allowlist (`ReportReelsPage.tsx:84`) behandles som DATA-flagg (§10 Q6).
  5. **Demo-data flagget for Supabase:** `PROJECT_BROKERS` (`:60`) + `PIN_THUMBNAILS` (`:16`) markeres med TODO som peker til provisjon/Supabase-flytting; beholdes verbatim i denne porten (prototype).
  6. Stillbilder via `next/image` (ESLint); `<video>` for reels/splash-video OK; `npx tsc --noEmit` 0 feil.

### Unit 7 — Lazy-load-grense-implementasjon + bundle-bevis
- **Mål (→ G7):** Implementer `dynamic()`-grensene per PRD 2 Unit 6-spec; bevis at nivå-1-board ikke laster nivå-2-only moduler.
- **Filer:** `@/components/variants/report/reels/ReportReelsPage.tsx` (`dynamic()`-wrapping), `@/components/variants/report/board/BoardMap.tsx` (motor-/rute-lazy-grense), `@/docs/rebuild/board-skall-bundle-bevis.md` (bundle-analyse-runbook).
- **Avhengigheter:** Unit 2, 3, 6 (komponentene som wrappes), PRD 2 Unit 6 (grense-SPEC-en), PRD 6 (motor/rute eksponeres lazy-bare).
- **Akseptansekriterier:**
  1. De tre PRD 2-verifiserte nivå-2-only modulene lazy-lastes: reels/splash-`<video>`-pipeline, voiceover-orchestration, kuratert hero-asset-lasting (PRD 2 Unit 6 AC). `ResponsiveLayout`-`dynamic(ssr:false)` (`:1040-1044`) + motor/rute via `dynamic()` (PRD 6 eksponerer komponentene lazy-bare).
  2. **Bundle-bevis (eid av PRD 9, PRD 2 Beslutning 14) — FALSIFISERBAR presence/absence-assertion:** `dynamic(ssr:false)` splitter chunken strukturelt, så «modul ikke i hoved-chunken» er garantert by construction — beviset må derfor være en NAVNGITT modul-/chunk-tilstedeværelses-sjekk, ikke relativ størrelse. Pass-betingelse: i `npm run build`-chunk-output (eller `.next`-manifest) skal entry-/hoved-chunken for et nivå-1-board (uten `reportConfig.assets.brand`/reels) IKKE inneholde de tre PRD 2-verifiserte modulene — konkret: reels/splash-`<video>`-pipelinen (`EmbedArrivalLoader` + `MobileReportSplash`/`DesktopReportSplash`-video-grenen), voiceover-orchestration (`use-reels-audio-orchestration`), og kuratert hero-asset-lasting. Hver av disse tre MÅ opptre i en SEPARAT lazy-chunk (ikke entry-chunken). Runbooken dokumenterer: (a) navnet/identifikatoren på lazy-chunken hver modul havner i, (b) en eksplisitt assert om at modul-identifikatorene er FRAVÆRENDE fra entry-chunkens modulliste for et nivå-1-board, og (c) før/etter-chunk-kart (baseline = static-import-tilstand før Unit 7, etter = dynamic-splittet) for å vise at splittingen faktisk skjedde. Et build-agent kan kjøre denne som en binær pass/fail mot navngitte identifikatorer.
  3. Grensen abstraherer IKKE for innbilte fremtider — KUN de tre verifiserte modulene lazy-lastes (PRD 2 Unit 6 AC, second-system-vakt).
  4. `npm run build` bygger uten feil.

### Unit 8 — Verifikasjon (mobil + desktop, nivå-1 + nivå-2) + mekaniske porter
- **Mål (→ G8):** Bevis at skallet FUNGERER (ikke bare kompilerer): mobil + desktop, nivå-1 + nivå-2-board, SEO-metadata, embed-flyt; alle porter grønne.
- **Filer:** `@/docs/rebuild/board-skall-verifikasjon-runbook.md` (verifikasjons-runbook).
- **Avhengigheter:** Unit 1–7.
- **Akseptansekriterier:**
  1. **Desktop + mobil (mobile-native UX):** Åpne et board på desktop (sidekolonne `DesktopStorySidebar`) og mobil-emulering (bottom-sheet) — adaptiv split fungerer, ingen SSR/client-hydration-mismatch (`ResponsiveLayout ssr:false` bevart).
  2. **Nivå-1 vs nivå-2-board:** Et board UTEN `assets.brand` viser nivå-1-overflate (tekst-wordmark + `home.heroImage`); et board MED `assets.brand`/`splashVideo` viser nivå-2-overflate (logo + kuratert hero + reels-video) — UTEN at en eneste `reportTier`-sjekk finnes i koden (verifiser `grep -c reportTier` = 0 i skall-filene).
  3. **SEO:** `generateMetadata` gir korrekt `title`/`description`/canonical for et board (verifiser i view-source / Lighthouse-meta).
  4. **Embed-flyt:** `?embed` → splash-teaser; `?from=embed` → `EmbedArrivalLoader`-«Klar»-gate (verifiser begge grener).
  5. **No-photo-fallback (foto DEFERRED, INDEX note #9 / PRD 4):** et live board uten POI-foto (`featured_image` = `null`) viser kategorifarge + ikon/pin-fallback i POI-kort/popup + `DesktopStorySidebar`-listen — IKKE broken image, IKKE crash — verifisert i live board (Chrome-emulering, mobil + desktop). Prosjekt-/brand-bilder (`home.heroImage`/splash-hero/`pinThumbnail`) er en separat asset-akse og berøres ikke av denne sjekken.
  6. `npm run lint` (0 errors), `npm test` (board-UI-/camera-tours-/reels-tester grønne), `npx tsc --noEmit` (0 feil), `npm run build` (bygger; bundle-bevis fra Unit 7 grønt).

> **Fullstendighet:** 8 av 8 units dekket. Hver keeper/port-with-rewrite-fil fra evidens-pakken er eksplisitt tildelt en unit; hver reference-only/dead-klassifisering er verifisert (SubCategoryFilter 0 mount, getCameraTour LIVE konsumert av provisjon/validator (0 render-mount), mapbox-gl.css død import — alle grep-bekreftet). Ingen sampling.

---

## 8. Utviklingsløp (faser)

### Fase 1 — RSC-side + skall-komposisjon
- **Mål:** RSC board-siden + `ReportReelsPage`-komposisjonen + `BoardMap`-wrapperen står; mobil/desktop-adaptiv split + server-data + SEO + tema-injeksjon bevart.
- **Leveranse:** Unit 1, 2, 3.
- **Autonomi-nivå:** Middels. RSC-siden er allerede arkitektur-konform (lav risiko); `ReportReelsPage`-dekomponering (1078 LOC, 5+ ansvar) + `BoardMap`-port (persistent-mount-grense mot PRD 6) er substansiell port-with-rewrite. `BoardMap.tsx`-fil-eierskapet er RATIFISERT (Beslutning 3 — PRD 9 single owner), så ingen serialiserings-blokker for Unit 3.

### Fase 2 — Board-UI + camera-tours-data + nivå-2-overflate
- **Mål:** `BoardMapControls` + board-UI-klassifisering + `camera-tours`-DATA + `project-brand`-modell + nivå-2-overflate portet og aktivert av `assets`-flagg.
- **Leveranse:** Unit 4, 5, 6.
- **Autonomi-nivå:** Middels. `BoardMapControls`/`project-brand`/`camera-tours` er nær-verbatim; Mapbox-2D-overlay-komponentenes skjebne (Unit 4 AC3) er LØST (kontroll-runde 2026-06-27 — LIVE, beholdt; ingen hard gate lenger). `DesktopStorySidebar`-dekomponering (788 LOC) er substansiell.

### Fase 3 — Lazy-load + verifikasjon
- **Mål:** `dynamic()`-grensene implementert med bundle-bevis; skallet bevist mot prod (mobil + desktop, nivå-1 + nivå-2, SEO, embed).
- **Leveranse:** Unit 7, 8.
- **Autonomi-nivå:** Middels. Lazy-load krever koordinering med PRD 2-spec + PRD 6 (lazy-bare motor-eksport). Verifikasjon krever live board-flate + Chrome-emulering («Output-fokus»-regelen: features må FUNGERE).

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | Skallet AKTIVERER nivå-2-overflate via `assets`-flagg, ALDRI `if (reportTier)` | Patch #4, verifisert 0 `reportTier`-ref i skall-filene; nivå-2 = nivå-1 + branding/hero/reels-video aktivert (CARRY-OVER 7); overflate forkes ikke |
| 2 | RSC board-siden bevares arkitektur-konform (server-data, SEO, tema-injeksjon, cache) | `page.tsx` er allerede konform (server-component, ingen klient-XHR, `generateMetadata`); porten endrer ikke arkitektur, kun re-typer |
| 3 | **RATIFISERT (fil-eierskap for `BoardMap.tsx`):** PRD 9 eier HELE `BoardMap.tsx`-FILA + mount-ORKESTRERINGEN; PRD 6 bidrar persistent-mount-INVARIANT-LINJENE (`:26-41`/`:437`) som en gjennomgått kontrakt PRD 9 IKKE bryter. Beads serialiserer ÉN eier (PRD 9) for fila. | Én fil, to PRD-er rører den → Agent-Teams-regel (hver teammate eier sine filer) krever ÉN serialiserings-eier. Invarianten ER motorens bærende WebGL-AC (06 Unit 1 AC7); skallet eier state/layout/controls. Gaten er LUKKET her — §10 Q5 er ikke lenger et åpent spørsmål, kun et kontrakt-grensesnitt PRD 6 reviderer |
| 4 | `has3dAddon` gater 2D/3D-toggle + `BoardMap3D`-mount, IKKE render per tier | Project-nivå-kolonne (snapshot:184), injisert separat fra `reportConfig` (PRD 2 §5.1); ikke en nivå-bryter |
| 5 | `SubCategoryFilter.tsx`-KOMPONENTEN = reference-only (0-konsument) | Verifisert 0 live JSX-mount (alle 19 i `.test.tsx`), 0 non-test import; HOOKEN `use-sub-category-filter` (PRD 5) er det som lever. Analog med PRD 6 `Map3DActionButtons` |
| 6 | `getCameraTour`-accessoren beholdes med VERBATIM signatur — LIVE konsumert av provisjon/validator, 0 RENDER-mount | Verifisert LIVE konsumert i pipelinen: `provision-rapport.ts:270` (`create-report`) + `validate-report-tier.ts:58` (`validate:tier`) + `report-tier.test.ts:389`. 0 render-mount (kun `getCategoryCamera` mountes, `BoardMap3D:510`; `report-tier.ts:54` er JSDoc, ikke kall). Signaturen er bærende kontrakt for PRD 2/3 — begrunnet av PROVISJON; endres den, knekker provisjons-pipelinen (`create-report` + `validate:tier`). PRD 10 er forventet render-konsument. DATAEN + accessoren eies av PRD 9 |
| 7 | `camera-tours`-DATAEN eies av PRD 9; MEKANISMEN (`getCategoryCamera`) eies av PRD 6 | Kanonisk indeks (`00-INDEX:33`/`:95`) + PRD 6 §10 Q3 + 06 Beslutning 6 — DATA→PRD 9, mekanisme→PRD 6 |
| 8 | Død `mapbox-gl.css`-import (`ReportReelsPage.tsx:3`) slettes ved port | CARRY-OVER `523`; CLAUDE.md «ALDRI la dead code ligge» |
| 9 | `PendingCamera`-import re-pekes mot PRD 6s motor-plassering (ikke `UnifiedMapModal`) | `UnifiedMapModal` er død scroll-modal; PRD 6 Unit 7 re-hjemler typen; skallet skal ikke dra inn død modal |
| 10 | `ResponsiveLayout = dynamic(ssr:false)` bevares som adaptiv lazy-grense (ikke bare lazy) | Bevisst SSR/client-mismatch-vakt på `useMediaQuery`-treet (`:1036-1039`); fjernes den får man hydration-mismatch |
| 11 | `REELS_MONTAGE_PROJECTS`-allowlist er DATA-flagg (PRD 9/provisjon), ikke PRD 14-pipeline-output | CARRY-OVER `243`: «data/asset-flagg i rebuild»; video-gating er data, ikke pipeline (§10 Q6) |
| 12 | Demo-data (`PROJECT_BROKERS`/`PIN_THUMBNAILS`) flagges for Supabase men beholdes verbatim i porten | Prototype-stadium; ekte data skrives ved provisjon (PRD 3); ikke over-engineer flyttingen nå |
| 13 | INGEN render-gating på `reportTier` bygges | Patch #4, verifisert 0 ref i skall-filene; tier-krav fanges av PRD 2s validator |
| 14 | **Mapbox-2D-overlay-komponentene (`BoardMarker`/`HomeMarker`/`BoardPOILabel`/`BoardPathLayer`/`BoardPathMidpointMarker`/`BoardPOIMiniPopup`) er LIVE og BEHOLDES (port-with-rewrite)** | Kontroll-runde 2026-06-27 falsifiserte dead/0-mount-premisset: LIVE mountet `BoardMap.tsx:478-514` inne i `{showMapbox && <Map>}`; `showMapbox = !has3dAddon \|\| view === "2d"` (`:203`) → eneste kart-motor for ikke-addon-prosjekter + live 2D-toggle for addon. Andreas-beslutning: BEHOLD. Skjebnen henger ikke på PRD 6 §10 Q2; §10 Q4-gaten opphevet |
| 15 | **`CameraCutOverlay`-KOMPONENTEN eies av PRD 6; WebGL-context-HÅNDHEVELSEN (mount-orkestrering) eies av PRD 9** | Kontroll-runde 2026-06-27 ratifiserte §10 Q3: komponenten mountes motor-internt (`BoardMap3D.tsx:759`, import `:12`), driftet av `useBoard3DCamera`+`CUT_FADE_MS` → PRD 6. Mount-koden `BoardMap.tsx:437`/`:439` + `showMapbox`-orkestreringen `:203`/`:451` (når Mapbox-overlayet legger seg oppå persistent 3D-motor) er PRD 9s Unit 3-mount-orkestrering |
| 16 | **`BOARD_INTROS`- og `ESTABLISHING_SHOTS`-DATA-records eies av PRD 9; MEKANISMENE `getBoardIntro`/`getEstablishingShot` eies av PRD 6** | Kontroll-runde 2026-06-27 (DATA-hjemling, lukker foreldreløse keepere): `BOARD_INTROS` (`board-intros.ts:20`) + `ESTABLISHING_SHOTS` (`board-establishing-shots.ts:13`) er samme klasse som `camera-tours`-DATAEN PRD 9 allerede eier (Beslutning 7). Accessorene (`getBoardIntro:47`/`getEstablishingShot:42`) er mekanisme → PRD 6 |

### Kontroll-runde 2026-06-27

| Funn | Dom | Forankring |
|------|-----|------------|
| Mapbox-2D-overlay (6 komponenter) feilklassifisert som dead/0-mount | **LØST — LIVE, BEHOLDES** (Andreas-beslutning). §10 Q4-hard-gate opphevet; Unit 4 AC3 omskrevet | `BoardMap.tsx:478-514` (mount) + `:203` (`showMapbox`-def) + `:451` (grenen). Live på rapport-board/rapport-reels/event-board → Beslutning 14 |
| `CameraCutOverlay`-eierskap uavklart (§10 Q3) | **RATIFISERT — PRD 6 eier komponenten; PRD 9 eier WebGL-context-håndhevelsen (mount-orkestrering)** | `BoardMap3D.tsx:759`/`:12` (komponent-mount → PRD 6); `BoardMap.tsx:437`/`:203`/`:451` (mount-orkestrering → PRD 9) → Beslutning 15 |
| Foreldreløse DATA-keepere (`BOARD_INTROS`/`ESTABLISHING_SHOTS`) uten PRD-hjem | **LØST — DATA-records hjemlet til PRD 9; mekanismer til PRD 6** | `board-intros.ts:20`/`:47`, `board-establishing-shots.ts:13`/`:42`. Samme klasse som `camera-tours`-DATA → Beslutning 16 |

---

## 10. Åpne spørsmål

*Følgende er ikke-blokkerende for Phase 1 med mindre annet er notert.*

1. **`SubCategoryFilter.tsx`-komponentens skjebne (ikke-blokkerende):** Verifisert 0-konsument (alle JSX-mount i `.test.tsx`; 0 non-test import); HOOKEN lever (PRD 5). **Anbefaling (landet):** klassifiser KOMPONENTEN som reference-only/dead (analog med PRD 6 `Map3DActionButtons`); ikke port som aktiv skall-UI. Re-vurder kun hvis en live mount oppstår. Påvirker ikke Phase 1.
2. **`getCameraTour`-accessor-status (ikke-blokkerende):** LIVE konsumert i produksjons-pipelinen i dag — `provision-rapport.ts:270` (`create-report`) + `validate-report-tier.ts:58` (`validate:tier`) + `report-tier.test.ts:389` (grep-verifisert); 0 RENDER/board-mount (kun `getCategoryCamera` mountes; `report-tier.ts:54` er JSDoc). **Anbefaling (landet):** behold accessoren med verbatim signatur — den er bærende kontrakt for PRD 2/3, begrunnet av PROVISJON; endres den knekker provisjons-pipelinen (`create-report` + `validate:tier`). PRD 10 er forventet render-konsument. PRD 9 eier DATAEN + accessoren. Ikke slett, ikke endre signatur.
3. **`CameraCutOverlay`-eierskap (06↔09) — RATIFISERT (kontroll-runde 2026-06-27, dom: PRD 6 eier KOMPONENTEN):** Briefen lister den som board-UI (PRD 9), men den mountes inne i `BoardMap3D.tsx:759` (motor-fila, import `:12`) og driftes av `useBoard3DCamera` + `CUT_FADE_MS` (PRD 6 Unit 5). **RATIFISERT: PRD 6 eier `CameraCutOverlay`-KOMPONENTEN** (motor-intern cut-feedback, bundet til kamera-fasaden) — se Beslutning 15. WebGL-context-HÅNDHEVELSEN (mount-koden `BoardMap.tsx:437`/`:439` + `showMapbox`-orkestreringen `:203`/`:451` som styrer når Mapbox-overlayet legger seg oppå den persistente 3D-motoren) eies derimot av PRD 9 som del av mount-orkestreringen (Unit 3). Ingen PRD 9-unit rører `CameraCutOverlay`-komponenten. Beholdt her kun som peker til Beslutning 15.
4. **Mapbox-2D-overlay-komponentenes skjebne (06↔09) — LØST (kontroll-runde 2026-06-27, dom: BEHOLD):** ~~RATIFIKASJONS-GATE — hard blokker på Unit 4 AC3~~ OPPHEVET. Kontroll-runden falsifiserte premisset om at `BoardMarker`/`HomeMarker`/`BoardPOILabel`/`BoardPathLayer`/`BoardPathMidpointMarker`/`BoardPOIMiniPopup` er dead/0-mount: de er LIVE mountet i `BoardMap.tsx:478-514` inne i `{showMapbox && <Map>}`, og `showMapbox = !has3dAddon || view === "2d"` (`:203`) gjør Mapbox-2D til ENESTE kart-motor for ikke-addon-prosjekter + live 2D-toggle for addon-prosjekter (live på rapport-board/rapport-reels/event-board). **Andreas-BESLUTNING: BEHOLD dem** — port-with-rewrite, ikke slett. Skjebnen henger IKKE lenger på PRD 6 §10 Q2; det er ingen hard gate på Unit 4 AC3 lenger. Beholdt her kun som peker til Beslutning 14.
5. **06↔09 fil-eierskap for `BoardMap.tsx` (RATIFISERT — se Beslutning 3):** ~~Må avklares~~ LØST. Beslutning 3 ratifiserer: PRD 9 eier HELE FILA + mount-orkestreringen og serialiserer som ÉN beads-eier; PRD 6 bidrar persistent-mount-invariant-LINJENE (`:26-41`/`:437`, 06 Unit 1) som en gjennomgått kontrakt PRD 9 ikke bryter. Dette er ikke lenger et åpent spørsmål — beads kan serialisere fil-eierskap med PRD 9 som single owner (Agent-Teams-regel oppfylt). Beholdt her kun som peker til Beslutning 3.
6. **Reels-VIDEO vs reels-AUDIO-grensen (09↔14, ikke-blokkerende):** PRD 9 eier reels-VIDEO-UX (`videoBgSrc`/`splashVideo`); PRD 14 eier reels-AUDIO/TTS-pipeline (`reelsAudio ?? audio`). `REELS_MONTAGE_PROJECTS`-allowlist (`ReportReelsPage.tsx:84`) gater video. **Anbefaling (landet):** video-gating er DATA-flagg (PRD 9/provisjon), per CARRY-OVER `243` («data/asset-flagg i rebuild»), ikke PRD 14-pipeline-output. Bekreft ved PRD 14-skriving.

---

## 11. Avhengigheter (PRD-graf)

```
   PRD 2 — nivå-modell + render     PRD 5 — board-data-state    PRD 6 — 3d-motor
   (kondisjonell-render-kontrakt;     (BoardData + BoardProvider/  (MapView3D/BoardMap3D;
    nivå 2 + ortogonale flagg          hooks; assets-flagg driver   persistent-mount-INVARIANT;
    3D/VO/camera/brokers/brand;        overflate-aktivering;        getCategoryCamera-MEKANISME;
    lazy-load-grense-SPEC)             pickPlayableAudio-seleksjon)  re-hjemlet PendingCamera)
              │                                │                            │
              └────────────────┬───────────────┴────────────────────────────┘
                               ▼
            ┌──────── PRD 9 — prd-board-skall-ui (DENNE) ────────┐
            │  RSC-side (SEO/tema/cache) + ReportReelsPage-       │
            │  komposisjon + BoardMap-wrapper + controls +        │
            │  board-UI + camera-tours-DATA + project-brand +     │
            │  nivå-2-overflate + dynamic()-lazy-grenser        │
            │         │            │            │            │     │
            ▼         ▼            ▼            ▼            ▼
        PRD 10     PRD 11       PRD 13       PRD 14       PRD 15-prov
        kamera-    realtime-    instrument-  audio/reels  nivå-2-
        flythrough blocks i     ering        -pipeline    kuratering
        (camera-   skallet      (emit-sites  (mater       (fyller
         tours-                  i skallet)   reels-video) overflaten)
         DATA)
```

**Blokkeres av:** PRD 2, PRD 5, PRD 6.
**Blokkerer:** PRD 10 (camera-tours-DATA + pose-primitiver), PRD 11 (realtime-blocks i skallet), PRD 13 (emit-sites i skallet), PRD 14 (reels-video-overflaten), PRD 15-prov (overflaten den fyller).
**Leverer til (eier ikke konsumet):** `camera-tours`-DATA (`getCameraTour`) → PROVISJON (PRD 3, `provision-rapport.ts:270`; videreført til validatoren som `cameraTour`-argument, load-bearing signatur); brokers/brand-modellen (`project-brand.ts`) → PRD 9s eget RENDER-lag (ortogonalt flagg, Unit 6 — IKKE injisert til en validator); lazy-load-implementasjon + bundle-bevis (oppfyller PRD 2 Unit 6-spec).
**Koordineringspunkter (06↔09):** persistent-mount-invariant-eierskap (§10 Q1/Q5 — RATIFISERT, Beslutning 3), `CameraCutOverlay`-eierskap (§10 Q3 — RATIFISERT til PRD 6, Beslutning 15). Mapbox-2D-overlay-komponentenes skjebne er LØST (kontroll-runde 2026-06-27 — LIVE, beholdt av PRD 9; ikke lenger et 06↔09-koordineringspunkt).
**Koordineringspunkt (09↔14 — audio-tour-store beat-signal):** PRD 9 KONSUMERER PRD 14-eid `audio-tour-store` (`lib/stores/audio-tour-store.ts`) i skall-flatene — `DesktopStorySidebar`/`StoryProgressBar`/`ChapterProgressBar` leser `useAudioTourActions`/`useAudioTourStore`, og beat-signalet `useCurrentTrack`/`useAudioTourPhase` driver sidebar/progress-UX (board-versjon-selectors, ikke `lib/store`; alltid via selectors, aldri hele store). **To koordinerings-krav:** (1) beat-signal-selektor-kontrakten (`useCurrentTrack`/`useAudioTourPhase` + `categoryId`-shape) er en kontrakt-node som MÅ materialiseres til en delt Lag-2-plassering FØR beads-bygging av PRD 9 (note #5; jf. PRD 5s `BoardCategoryId`-type-hjem); (2) PRD 14s store-reshape (Lag 4) muterer en store PRD 9 (Lag 3) allerede har portet mot — PRD 14 MÅ holde PRD 9-konsumentene kompilerbare etter omformingen (note #5 / PRD 14 Unit 6 AC6 (beat-signal-kontrakt-node) + AC8 (PRD-9-konsument-kompilering) + §10 Q5: koordiner store-eksport-kontrakten med PRD 9 FØR dens komponenter fryses).

---

**Fullstendighet:** 8 av 8 implementation units spesifisert med avhengigheter + akseptansekriterier; 8 av 8 mål (G1–G8) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i faktisk kode (verifisert: `page.tsx:8-16`/`28`/`35-39`/`41`/`44`/`56`/`58-84`/`86-95`/`98-117`, `ReportReelsPage.tsx:3`/`84`/`136`/`187`/`348`/`564`/`679-682`/`707`/`737`/`760`/`905`/`1005-1019`/`1040-1044`, `BoardMap.tsx:22`/`26-41`/`94`/`104`/`118`/`129-136`/`146-152`/`437-447`/`456`/`525-531`/`537-549`, `BoardMapControls.tsx:7`/`78`/`90`, `camera-tours.ts:16-59`/`64`/`75`/`85`, `project-brand.ts:21`/`32`/`47`/`60`/`74`/`81` (alle assets-gated), `reels-data.ts:13`/`25`/`145`/`231`, grep: 0 `reportTier` i skall-filene, 0 live `<SubCategoryFilter`-mount utenfor test, `getCameraTour` LIVE konsumert av provisjon/validator (`provision-rapport.ts:270`/`validate-report-tier.ts:58`/`report-tier.test.ts:389`), 0 render-mount), prod-schema (`projects.has_3d_addon` snapshot:184), CARRY-OVER-MANIFEST-linjer (7/240-243/262-265/282-285/520-555) og `00-INDEX` (33/55/85/95). Ingen P0/P1/P2-tiers; ingen «Future Work»-seksjon (deferred under §6 med PRD-pekere); ingen render-gating spesifisert (patch #4).

---

### Walkthrough-revisjon 2026-06-27

- **Delt foundation, divergerbar UI/UX (eier-presisering, viktig):** nivå 1 og nivå 2 deler tech og oppsett (foundation), men UI/UX-overflaten KAN divergere mellom dem — potensielt mye over tid. Den delte arkitekturen skal ALDRI blokkere dette. «ÉT skall / aldri forket» = én foundation (ikke to apper), ikke en tvang om identisk overflate. Patch #4 presisert: forbyr capability-matrise-gating, ikke nivå-bevisst UX-design (se §3 NB-note + note #8 «kondisjonell render på nivå»). Full propagering til øvrige patch-#4-PRD-er → helhetlig audit.
- **To-nivå-modell (INDEX note #8):** alle «nivå-2/3»-formuleringer i overflate-konteksten er rettet til «nivå-2». Nivå 3 finnes ikke; 3D/VO/camera/brokers/brand er ortogonale render-flagg aktivert av data-/asset-tilstedeværelse, ikke nivå-krav. Camera-tours-flagget er presisert som ortogonalt (§3 NB-note). **Helhetlig audit anvendt (2026-06-28):** alle «nivå-3»-formuleringer og `getCameraTour`-«injisert til validatoren for nivå-3-sjekken»-formuleringene er fjernet. `TIER_CAPABILITIES`-symbolet + `requires*`/`recommends*`-feltlista er slettet fra §5.1 + graf-boksen og erstattet med PRD 2s kondisjonell-render-kontrakt + de ortogonale render-flaggene. To relasjoner er skilt: `getCameraTour`-signaturen + camera-tours-DATA → PROVISJON (PRD 3, load-bearing, står verbatim); brokers/brand-modellen → PRD 9s RENDER-lag (ortogonalt flagg), IKKE validatoren.
- **⏸ Foto DEFERRED — no-photo-fallback (eier-beslutning 2026-06-27, INDEX note #9 / PRD 4):** Google-POI-foto (`featured_image`/`gallery_images` per POI) er utsatt til en egen senere task. **Konsekvens for board-skallet:** all board-UI som ville vist et POI-foto (POI-kort/popup/sidebar-liste i `DesktopStorySidebar` + 3D-overlay-popup) MÅ rendre en **no-photo-fallback** — kategorifarge + ikon/pin — og IKKE anta at `featured_image` finnes (den er `null` til foto lander). 3D-markørene er allerede kategorifarge-baserte (PRD 6), så pin-laget er upåvirket. Prosjekt-/brand-bilder (`home.heroImage`, splash-hero, `pinThumbnail`) er en SEPARAT asset-akse (ikke Google-POI-foto) og berøres IKKE av foto-deferralen. Når foto-tasken lander, byttes fallback-en ut mot faktisk bilde uten skall-endring. **Operasjonalisert (audit 2026-06-28):** dette kravet er nå konkrete akseptansekriterier — Unit 4 AC5 (POI-kort/popup), Unit 2 AC7 (`DesktopStorySidebar`-listen) og Unit 8 AC5 (live-verifikasjon), koblet til PRD 5s nullable `featured_image`-transform.
