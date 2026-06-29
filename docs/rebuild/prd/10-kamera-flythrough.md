# PRD 10 — Kamera + autorert flythrough (oval-spiral + film-modus)

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling. (Fase 1 har ingen blokkerende åpne spørsmål. **NB — fil-eierskap mot deps er RESOLVERT:** `board-flythrough-orchestrator.ts`-eierskapet er LUKKET som §9 Beslutning 9 (PRD 6 eier fila + ekstraksjonen; PRD 10 komponerer choreografien oppå; AND-invarianten = gjennomgått kontrakt — 09 Beslutning 3-presedenten anvendt verbatim). `CameraCutOverlay`-eierskapet er ratifisert som §9 Beslutning 6 (PRD 6 eier komponenten; PRD 10 eier choreografi-bruken). **NB — netto-ny dep mot PRD 14:** beat-signalet (`useCurrentTrack`/`useAudioTourPhase`/`categoryId`) som driver hele choreografien kommer fra PRD 14s `audio-tour-store`, ikke PRD 5 — konsumeres som KONTRAKT (lag-ordning løst §10 Q7; flagg for 00-INDEX dep-oppdatering 06,09→06,09,14).)
> **Lag (byggrekkefølge):** Lag 3 (board-flate) — `00-INDEX:56`. Bygges etter PRD 6 (3D-motor: pose-/intent-primitiver) og PRD 9 (board-skall: `camera-tours`-DATA + skallet touren spilles i).
> **PRD-nr:** 10 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-kamera-flythrough`
> **Kontekst:** Lag-3-PRD. Eier den AUTORERTE flythrough-OPPLEVELSEN som produkt: oval-spiral-tour-choreografien (hvilken pose-tour spilles på hvilken board-beat — welcome→nabolag→kategori→oppsummering→outro), `?film=1`/`?fly=1`/`?establishing=1` capture-/film-modus-produktet (URL-flagg-orkestrering + cinematisk ren-kart-modus), `CameraCutOverlay`-BRUKEN under autorert tour, og `capture-3d-flythrough.mjs`-pipelinen. Bygger PÅ PRD 6s pose-/intent-primitiver + PRD 9s `camera-tours`-DATA + board-skall. Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md`, `docs/rebuild/prod-schema-snapshot.txt` og faktisk kode (`BoardMap3D.tsx`, `board-intro-flythrough.ts`, `board-establishing-flythrough.ts`, `board-establishing-shots.ts`, `board-3d-camera-director.ts`, `use-board-3d-camera.ts`, `camera-tours.ts`, `CameraCutOverlay.tsx`, `board-intros.ts`, `BoardMap.tsx`, `ReportReelsPage.tsx`, `capture-3d-flythrough.mjs`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **den autorerte kamera-OPPLEVELSEN** — laget OVER 3D-motorens rene primitiver der pose-matematikk blir til en regissert film. Mens PRD 6 eier «hvordan kameraet beveger seg» (pose-/intent-primitivene: `runIntroFlythrough`, `runEstablishingFlythrough`, `decideCameraIntent`, `useBoard3DCamera`) og PRD 9 eier «hvor touren spilles» (`camera-tours`-DATA + board-skallet), eier PRD 10 **«hvilken tour spilles når, og hvordan den fanges som film»** — choreografi-beslutningene og film-modus-produktet.

Tre strukturelle grep definerer denne PRD-en:

1. **Choreografi = beat→tour-mapping, ikke ny kamera-matte.** Selve poseberegningen er PRD 6s (verifisert: `introPoseAt` holder center=target hele filmen, `board-intro-flythrough.ts:148-161`; `establishingPoseAt` (`:243-248`) bygger på `buildDensePath`/`centripetalPoint` — centripetal Catmull-Rom (alpha=0.5), `board-establishing-flythrough.ts:116-173`). PRD 10 eier beslutningene om HVILKEN av disse som spilles på hvilken board-beat: `isWelcomeBeat` (`BoardMap3D.tsx:205`) + `basicIntroActive` (`:212`) + `?fly=1` (`:165-169`) → oval-spiral-intro; `?establishing=1` (`:177-181`) → multi-waypoint helikopter-flyover; `isOutroBeat` (`:244`) → summary-fly (`:684-696`). Disse beslutningene er i dag spredt gjennom `BoardMap3D` (785 LOC); PRD 6 Unit 7 ekstraherer plumbingen, PRD 10 hjemler choreografi-logikken (eierskap LUKKET — §9 Beslutning 9). Beat-deteksjonen (`isWelcomeBeat`/`isHomeBeat`/`isOutroBeat`) leser PRD 14s `audio-tour-store`-selektorer (`BoardMap3D:45`, §5.3b), ikke PRD 5.

2. **Tre intro-eiere AND-es bort av establishing-mode så to animatorer aldri kjemper om posituren.** `introActive = (flyMode || isWelcomeBeat || basicIntroActive) && !establishingMode` (`BoardMap3D.tsx:216-217`). Dette er en bærende choreografi-invariant: bryter man den, kjemper to rAF-løkker om samme `gmp-map-3d`-camera-positur. Den må bevares verbatim når orkestreringen ekstraheres.

3. **Film-modus er URL-flagg-drevet + board-drevet, ikke script-drevet kamera.** `?film=1`/`?fly=1`/`?establishing=1` dropper kategori-pins på RENDER-nivå (`markerPOIs → []`, `BoardMap3D.tsx:337`) — IKKE via DOM-fjerning utenfra (det krasjer React: removeChild-race på en node React eier, dokumentert `:151-155`). `capture-3d-flythrough.mjs` DRIVER ikke kameraet — det åpner `?fly=1` og venter på `window.__placyIntroFly`-fasen (`settling→running→done`, `capture-3d-flythrough.mjs:124-133`/`220-221`) mens BOARDET driver flyturen, og tar opp via CDP-screencast. PRD 10 eier URL-flagg-KONTRAKTEN + capture-pipelinen.

Denne PRD-en bygger ALDRI en `reportTier`-render-bryter (verifisert: 0 `reportTier`-ref i `BoardMap3D.tsx`, `CameraCutOverlay.tsx`, `capture-3d-flythrough.mjs` — grep bekreftet tomt). Den cinematiske opplevelsen er nivå-uavhengig; `hasVoiceOver` (`BoardMap3D.tsx:261`) er datadrevet choreografi-seleksjon (VO finnes → welcome-beat-drevet oval-spiral; ingen VO → basic-intro-flythrough som lander på hvile-range), ikke tier (jf. PRD 6 Beslutning 5).

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Beat→tour-choreografien for den AUTORERTE intro-opplevelsen (welcome-beat + basic-intro + `?fly=1`) hjemlet som ren orkestrerings-logikk på PRD 6s `runIntroFlythrough`-primitiv; tre intro-eiere AND-et bort av establishing-mode bevart; VO-skalering/calm-sweep/pause-frys bevart. | Intro-choreografi-orkestrering (Unit 1). |
| **G2** | `?establishing=1` multi-waypoint helikopter-flyover-choreografien hjemlet på PRD 6s `runEstablishingFlythrough` + `getEstablishingShot`-mekanisme; bloom→reveal-kaskade-koblingen bevart; cross-file splash-skip-kontrakten dokumentert. | Establishing-choreografi-orkestrering (Unit 2). |
| **G3** | Outro summary-fly-choreografien (`isOutroBeat` → `flyCameraTo SUMMARY_*`) + free-yield-koblingen mot board-skallet hjemlet; rekkefølge-invariant (director-stopp før summary-fly) bevart. | Outro summary-fly-choreografi (Unit 3). |
| **G4** | Den autorerte kategori-touren: `getCategoryCamera`-mekanismen (PRD 6) komponert med `camera-tours`-DATA (PRD 9) + `deriveCategoryCamera`-fallback til kategori-config touren mater inn i `useBoard3DCamera`. | Autorert kategori-tour-komposisjon (Unit 4). |
| **G5** | `?film=1`/`?fly=1`/`?establishing=1` URL-flagg-KONTRAKTEN (semantikk + render-nivå-pin-drop) hjemlet som film-modus-produkt; `CameraWaypointAuthor` (`?author=1`) konsumert for waypoint-autoring. | URL-flagg-kontrakt + film-modus-produkt (Unit 5). |
| **G6** | `CameraCutOverlay`-BRUKEN under autorert tour (label/farge per beat, drevet av `cutVisible`) hjemlet; eierskaps-grensen mot PRD 6 (komponenten) respektert. | Cut-overlay-choreografi-bruk (Unit 6). |
| **G7** | `capture-3d-flythrough.mjs` capture-pipelinen portet: `?fly=1`-drevet, `__placyIntroFly`-fase-synk, ren-kart-capture (søsken-skjuling), screencast→frames→concat. | Capture-pipeline-port (Unit 7). |
| **G8** | Hele den autorerte opplevelsen bevist å FUNGERE mot prod (nystartet Chrome: welcome→outro-choreografi + `?film=1` rent kart + capture-kjøring) + alle mekaniske porter grønne. | Verifikasjon + mekaniske porter (Unit 8). |

---

## 3. Arkitektur-/migrasjons-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *opplevelses-laget* — over motoren (PRD 6, pose-primitiver) og over skallet (PRD 9, `camera-tours`-DATA + board-komposisjon). Den cinematiske opplevelsen forker ALDRI per tier eller profil (verifisert: 0 `reportTier`-ref i `BoardMap3D`/`CameraCutOverlay`/`capture-3d-flythrough.mjs`). Choreografi-divergensen er datadrevet (`hasVoiceOver`-seleksjon, `BoardMap3D.tsx:261`), ikke en tier-render-bryter.

> **NB — kamera-flythrough-orkestrering er presentasjons-effekter, IKKE forbudt data-fetch.** Alle flythrough-effekter i `BoardMap3D` er klient-side rAF-løkker (`runIntroFlythrough`-effekt `:567-646`, `runEstablishingFlythrough`-effekt `:655-674`, outro `flyCameraTo`-effekt `:684-696`). Arkitekturregelen «ALDRI useEffect for data-fetching → server components» gjelder DATA-henting; disse effektene driver per-frame kamera-props på `gmp-map-3d` og er nødvendige klient-effekter (jf. PRD 6 §3 NB-note). PRD 10s orkestrerings-lag arver «use client»-kravet fra `BoardMap3D.tsx:1`.

> **NB — `hasVoiceOver` er IKKE tier-gating.** Choreografien velger intro-variant fra board-data-INNHOLD (spillbart VO finnes): med VO drives oval-spiralen av welcome-beaten og skaleres til VO-lengden (`BoardMap3D.tsx:596-603`); uten VO kjører basic-intro-flythrough som lander på hvile-range (`:577-590`). Dette speiler `pickPlayableAudio`-seleksjonen (PRD 5), ikke `reportTier` (jf. PRD 6 Beslutning 5).

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer fra kamera-flythrough-laget |
|---------------|------------------------------------------------|
| board-flaten (PRD 9-skallet) | Den autorerte touren + film-modus er den cinematiske nivå-1-opplevelsen som spilles i skallet. Skallet MOUNTER orkestreringen via `BoardMap3D` (`BoardMap.tsx:437`), men eier den ikke. |
| `prd-instrumentering` (13) | Emit-site-flatene på kamera-choreografi-overganger (intro→done, beat→tour-bytte, cut-overgang) som payload inn i `events`-tabellen. `00-INDEX:57`: emit-sites wires med board-PRD-ene. |

**Ingen nedstrøms-PRD blokkeres av PRD 10** (Lag 3 — `00-INDEX:56`). Den er en konsument av PRD 6 + PRD 9 + (for den audio-drevne beaten) PRD 14s beat-signal-KONTRAKT. PRD 10 er ikke en ren blad-node oppstrøms: dens audio-drevne welcome-beat-gren konsumerer PRD 14s `audio-tour-store`-selektorer (§5.3b) — koblet som type/signatur-kontrakt, ikke runtime, så lag-ordningen holder (§10 Q7). PRD 10s ikke-audio-stier (`?fly=1`/`?establishing=1`/`basicIntroActive`) er PRD-14-uavhengige.

### Migrasjons-kontekst (port-with-rewrite, ingen DB)

Denne PRD-en rører IKKE skjema (ingen migrasjon). Den er en kode-port av choreografi-laget: orkestrerings-effektene trekkes ut av `BoardMap3D` (dekomponering eid mekanisk av PRD 6 Unit 7; choreografi-logikken hjemlet her — §10 Q1) til ren hook/logikk, og film-modus-produktet (`capture-3d-flythrough.mjs`) portes nær-verbatim. De UNTRACKED keeper-filene PRD 10 konsumerer (`board-establishing-flythrough.ts`/`.test.ts`, `board-establishing-shots.ts`) er ekte working-tree-kode men ikke committet (git status) — behandles som keeper, noteres ikke-i-historikk (jf. PRD 6 Beslutning 9). De EIES av PRD 6; PRD 10 konsumerer dem.

---

## 4. Eksisterende kodebase

### Konsumeres (eid av deps — tas med for grense, IKKE re-hjemlet av PRD 10)

| Fil (@/-sti) | Eier | Hva PRD 10 konsumerer |
|--------------|------|-----------------------|
| `components/variants/report/board/board-intro-flythrough.ts` | PRD 6 (keeper-core, 06:86) | `runIntroFlythrough` (`:174`), `introPoseAt` center=target (`:148-161`), `buildBasicIntroPath` (`:103-114`), `MIN_INTRO_FLY_MS=8000` (`:73`), `WELCOME_INTRO_SETTLE_MS=1200` (`:81`), `WELCOME_CALM_SWEEP_DEG=90` (`:89`), `DEFAULT_INTRO_PATH` (`:56-68`), `CameraDrivableMap3D` (`:21-26`). Oval-spiral-choreografien komponeres på disse. |
| `components/variants/report/board/board-establishing-flythrough.ts` | PRD 6 (keeper-core, 06:87; UNTRACKED) | `runEstablishingFlythrough` (`:256-312`) + `onProgress`-bloom-driver (`:260-305`), `EstablishingPhase` (type `:25`), `EstablishingPathConfig` (interface `:32-55`). Establishing-choreografien spilles via disse. |
| `components/variants/report/board/board-establishing-shots.ts` | MEKANISME→PRD 6 (`getEstablishingShot`, 06:110) / DATA→PRD 9 (`ESTABLISHING_SHOTS`-record, LUKKET kontroll-runde 2026-06-27, PRD 9 Beslutning 16); UNTRACKED | `getEstablishingShot` (`:42-46`) — slug→rute-oppslag for `?establishing=1`. `waypoints`/`durationMs`/`bloomAtProgress=0.02` (`:23`/`:32`/`:34`). |
| `components/variants/report/board/board-3d-camera-director.ts` | PRD 6 (keeper-core, 06:84) | `decideCameraIntent` (`:274-342`, intro>free>poi>cinematic>orbit), `SUMMARY_RANGE`/`SUMMARY_TILT`/`SUMMARY_FLY_MS` (`:47-49`), `CUT_FADE_MS=550` (`:56`), `deriveCategoryCamera` (`:154-184`), `FlyCapableMap`, `computeSpreadRadiusM`/`orbitRangeForSpread`. Outro-fly + kategori-fallback bygger på disse. |
| `components/variants/report/board/use-board-3d-camera.ts` | PRD 6 (keeper-core, 06:85) | `useBoard3DCamera`-fasaden (`:62`) + `cutVisible` (`:43-46`). Den autorerte touren spilles GJENNOM fasaden; cut-overlay driftes av `cutVisible`. |
| `components/variants/report/board/camera-tours.ts` | PRD 9 EIER DATAEN + `getCameraTour` (09:99); PRD 6 EIER `getCategoryCamera`-MEKANISMEN (06:111) | `getCategoryCamera(slug, categoryId)` (`:85-96`) for autorert kategori-tour (konsumert `BoardMap3D:510`); `getCameraTour` (`:75-79`) er PRD 10s forventede render-konsument (09 Beslutning 6) — i dag kun provisjon/validator. |
| `components/variants/report/board/CameraWaypointAuthor.tsx` | PRD 6 (port som primitiv, 06:93) | Dev-only `?author=1`-autoring (`:61`); `readPose` (`:35-49`) kopierer waypoints til `camera-tours`-DATA. PRD 10 KONSUMERER for waypoint-autoring; eier den IKKE. |
| `components/variants/report/board/board-intros.ts` | MEKANISME→PRD 6 / DATA→PRD 9 (LUKKET kontroll-runde 2026-06-27, §10 Q3) | `getBoardIntro(slug)` (`:47-49`) per-prosjekt innflyvnings-retning, konsumert `BoardMap3D:27/560`. PRD 10s intro-choreografi avhenger av den (konsumeres kun). |

### Bæres over — port-with-rewrite (PRD 10 eier; choreografi-laget)

| Fil (@/-sti) | Rewrite-handling | Verifisert linje-ref |
|--------------|------------------|----------------------|
| `components/variants/report/board/BoardMap3D.tsx` | **GRENSE-DELT med PRD 6 Unit 7.** PRD 6 ekstraherer plumbingen (markersett + flythrough-effekter til hooks — `board-flythrough-orchestrator.ts`, 06:267); PRD 10 EIER choreografi-LOGIKKEN inni: beat→tour-mappingen (intro/establishing/outro-valg), URL-flagg-orkestreringen, VO-skalering/calm-sweep/pause-frys. Begge rører fila → ÉN beads-serialiserings-eier (PRD 6) — LUKKET som §9 Beslutning 9 (09 Beslutning 3-presedenten anvendt verbatim). | `filmMode:156-160`, `flyMode:165-169`, `establishingFlag:177-181`, `establishingMode:187`, `isWelcomeBeat:205`, `basicIntroActive:212`, `introActive AND-et:216-217`, `markerPOIs→[]:334-337`, intro-effekt:567-646, establishing-effekt:655-674, outro-fly:684-696, `__placyIntroFly`:583/630, `useBoard3DCamera`-kall:525-541, `getCategoryCamera`+`deriveCategoryCamera`:508-518, `CameraCutOverlay`-mount:759-769, `CameraWaypointAuthor`-mount:776-782 |
| `scripts/capture-3d-flythrough.mjs` | Port capture-/film-modus-PRODUKTET. CDP-driver: `?fly=1`-åpning, `__placyIntroFly`-fase-vent, ren-kart søsken-skjuling, screencast→JPG-frames→`concat.txt`. Build-time/dev-script. | `?fly=1`-payload:144, `waitForFlyPhase`:124-133, vent `settling`:220-221, ren-kart søsken-skjul:228-244, start opplevelsen:200-216, screencast:252-265 |

### PRD 10s netto-nye filer (ekstraheres ved port)

| Fil (@/-sti) | Innhold | Begrunnelse |
|--------------|---------|-------------|
| `components/variants/report/board/board-flythrough-orchestrator.ts` (eller hook) | Choreografi-orkestreringen trukket ut av `BoardMap3D`: beat→tour-mapping + URL-flagg-state + VO-skalering. **Eierskap LUKKET — §9 Beslutning 9:** PRD 6 (Unit 7) EIER fila + ekstraksjonen (06:267 navngir den); PRD 10 hjemler hva effektene orkestrerer (choreografi-logikken) og bidrar AND-invarianten som gjennomgått kontrakt. Beads serialiserer ÉN eier (PRD 6). | CLAUDE.md «ingen forretningslogikk i komponenter → flytt til lib/»-aktig ren logikk; ikke JSX-bundet |

### Slettes / forlates (reference-only / dead)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| (ingen PRD 10-eide dead-filer) | — | PRD 10 introduserer ingen død kode. URL-flagg-grenene (`?film=1`/`?fly=1`/`?establishing=1`) er alle live capture-/film-modus-produkter, ikke dødkode. |

---

## 5. Datakontrakt (felt PRD-en eier / konsumerer)

### 5.1 Konsumeres fra PRD 6 (3D-motor — pose-/intent-primitiver)

| Symbol | Rolle i choreografien | Kilde |
|--------|-----------------------|-------|
| `runIntroFlythrough` / `introPoseAt` / `buildBasicIntroPath` / `MIN_INTRO_FLY_MS` / `WELCOME_INTRO_SETTLE_MS` / `WELCOME_CALM_SWEEP_DEG` / `DEFAULT_INTRO_PATH` / `CameraDrivableMap3D` | Oval-spiral-intro-touren spilles via disse (Unit 1) | `board-intro-flythrough.ts` (PRD 6 §5.3) |
| `runEstablishingFlythrough` / `EstablishingPhase` | Multi-waypoint helikopter-flyover (Unit 2) | `board-establishing-flythrough.ts` (PRD 6) |
| `getEstablishingShot` | Slug→rute-oppslag for `?establishing=1` (Unit 2) | `board-establishing-shots.ts` (PRD 6 mekanisme) |
| `decideCameraIntent` / `SUMMARY_RANGE` / `SUMMARY_TILT` / `SUMMARY_FLY_MS` / `CUT_FADE_MS` / `deriveCategoryCamera` / `FlyCapableMap` | Outro-fly + kategori-fallback + cut-timing (Unit 3/4/6) | `board-3d-camera-director.ts` (PRD 6 §5.3) |
| `useBoard3DCamera` + `cutVisible` | Touren spilles gjennom fasaden; cut-overlay driftes av `cutVisible` (Unit 4/6) | `use-board-3d-camera.ts` (PRD 6 §5.3) |
| `getCategoryCamera` (MEKANISME) | Autorert kategori-kamera-oppslag (Unit 4) | `camera-tours.ts` (PRD 6 mekanisme, 06 Beslutning 6) |
| `CameraWaypointAuthor` | Dev-only waypoint-autoring (`?author=1`) (Unit 5) | `CameraWaypointAuthor.tsx` (PRD 6) |
| `CameraCutOverlay` (KOMPONENT) | Cream-flash cut-feedback — PRD 6 eier komponenten; PRD 10 eier bruken (Unit 6, §10 Q2) | `CameraCutOverlay.tsx` (PRD 6 anbefalt, 09 §10 Q3) |
| render-nivå-pin-drop-mekanikk (`markerPOIs → []`) | Film-modus dropper pins på render-nivå (Unit 5); PRD 6 eier mekanikken, PRD 10 eier URL-flagg-produktet | `BoardMap3D.tsx:337` (PRD 6 Unit 7 AC1) |

### 5.2 Konsumeres fra PRD 9 (board-skall)

| Symbol | Rolle i choreografien | Kilde |
|--------|-----------------------|-------|
| `camera-tours`-DATA + `getCameraTour`-accessor | Per-prosjekt autorerte kategori-waypoints den autorerte touren bygger på (Unit 4) | `camera-tours.ts` (PRD 9 §5.4) |
| `cameraMode` 'free'-default når `!hasVoiceOver` ELLER `?fly=1` | Director yield-er til den frame-drevne flyturen; `?fly=1` er ÉN av to free-triggere (no-VO-board er også free uten `?fly=1`); film-modus AVHENGER av at director yield-er | `BoardMap.tsx:146-152` (PRD 9 Unit 3) |
| outro-beat → fri + hint | Free-modus så summary-fly (Unit 3) er uforstyrret av director | `BoardMap.tsx:189-200` (PRD 9 Unit 3) |
| `?establishing=1` splash-skip | Skall-siden av establishing-URL-flagget (avdekker kart uten audio) — cross-file koordineringspunkt (Unit 2, §10 Q4) | `ReportReelsPage.tsx:594-600` (PRD 9 Unit 2) |
| board-skallet touren spilles i (`BoardMap`-wrapper + `ReportReelsPage`) | Mount-konteksten for hele opplevelsen | PRD 9 Unit 2/3 |

### 5.3 Konsumeres fra PRD 5 (board-data + state)

| Felt | Rolle i choreografien | Kilde |
|------|-----------------------|-------|
| `projectSlug` | Oppslag i `getCameraTour`/`getEstablishingShot`/`getBoardIntro` | `BoardMap3D.tsx:184/510/560` (PRD 5 §5.2) |
| `home.coordinates` | Kamera-senter/look-at for alle tours | `BoardMap3D.tsx:438-441` (PRD 5) |
| `categories[].topRankedPois`/`pois` | Kategori-framing-kilde for `deriveCategoryCamera`-fallback (`BoardMap3D:512-517`) | PRD 5 |

### 5.3b Konsumeres fra PRD 14 (audio-tour-store — beat-signal)

| Symbol | Rolle i choreografien | Kilde |
|--------|-----------------------|-------|
| `useCurrentTrack` / `useAudioTourPhase` (selector-hooks) | Beat-deteksjon (`isWelcomeBeat`/`isHomeBeat`/`isOutroBeat`) driver hele beat→tour-choreografien | `BoardMap3D.tsx:45` imports fra `@/lib/stores/audio-tour-store` — **PRD 14-eid** (`audio-tour-store.ts` `useCurrentTrack:192`/`useAudioTourPhase:188`, PRD 14:92; PRD 14 Beslutning 8 eier HELE runtime audio-playback-orkestreringen) |
| `currentTrack.categoryId` (welcome/home/outro) | Konkrete beat-verdiene choreografi-grenene matcher mot (`:205/240/244`) | Produsert av `buildCategoryTracks` (`reels-data.ts:339`, PRD 14-eid AUDIO-akse) orkestrert av `use-reels-audio-orchestration` (PRD 14) |

> **NB — beat-signalet kommer fra PRD 14, ikke PRD 5.** PRD 5 eier KUN VO-SELEKSJONEN (`pickPlayableAudio`, `05:22`) + `projectSlug`/`home`/`categories`. Runtime-spor-tilstanden (`currentTrack`/`phase`) eies av PRD 14s `audio-tour-store` (PRD 14 Beslutning 8, `14:62`). PRD 10s AUDIO-drevne welcome-beat-gren er den eneste PRD-14-koblede stien — se §10 Q7 (lag-ordning) for hvordan den serialiseres mot PRD 10s ikke-audio-stier.

### 5.4 Eies av denne PRD-en (choreografi-interne)

| Symbol | Eierskap | Note |
|--------|----------|------|
| Beat→tour-choreografi-mappingen (intro/establishing/outro-valg + `introActive` AND-invariant) | PRD 10 | Trukket ut av `BoardMap3D` til `board-flythrough-orchestrator` (§10 Q1) |
| URL-flagg-KONTRAKTEN (`?film=1`/`?fly=1`/`?establishing=1`/`?author=1` semantikk) | PRD 10 | Hvilke flagg finnes + hva de gjør; mount-effektene bor i PRD 6/9-eide filer (§10 Q4) |
| `window.__placyIntroFly` / `window.__placyEstablishing` fase-eksponering | PRD 10 | Capture-synk-kontrakt mellom board og capture-script (`BoardMap3D:583/630/667`, `capture-3d-flythrough.mjs:128`) |
| `capture-3d-flythrough.mjs`-pipelinen (capture-config: `HOLD_END_MS`/`CLEAN_SETTLE_MS`/`MAX_GAP`) | PRD 10 | `capture-3d-flythrough.mjs:56-58` |
| `CameraCutOverlay`-BRUKEN (label/farge per beat) | PRD 10 (komponenten = PRD 6, §10 Q2) | `BoardMap3D.tsx:759-769` |

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. Beat→tour-choreografien for den autorerte intro-opplevelsen (welcome-beat + basic-intro + `?fly=1`): VO-skalering, calm-sweep, pause-frys, tre intro-eiere AND-et av establishing-mode.
2. `?establishing=1` multi-waypoint helikopter-flyover-choreografien + bloom→reveal-kobling + cross-file splash-skip-kontrakt.
3. Outro summary-fly-choreografien + free-yield-kobling mot board-skallet + rekkefølge-invariant.
4. Den autorerte kategori-touren: `getCategoryCamera`(PRD 6-mekanisme) ∘ `camera-tours`-DATA (PRD 9) ∘ `deriveCategoryCamera`-fallback → kategori-config inn i `useBoard3DCamera`.
5. URL-flagg-KONTRAKTEN (`?film=1`/`?fly=1`/`?establishing=1`/`?author=1`) som film-modus-produkt + render-nivå-pin-drop-bruk + `CameraWaypointAuthor`-konsum.
6. `CameraCutOverlay`-BRUKEN under autorert tour (label/farge per beat, drevet av `cutVisible`).
7. `capture-3d-flythrough.mjs` capture-pipelinen (URL-flagg-drevet, `__placyIntroFly`-synk, ren-kart-capture, screencast→frames).

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Pose-/intent-PRIMITIVENE (`runIntroFlythrough`/`runEstablishingFlythrough`/`introPoseAt`/`establishingPoseAt`/`poseAt`/`buildDensePath`/`decideCameraIntent`) + `useBoard3DCamera`-fasaden + `getCategoryCamera`-MEKANISMEN + `CameraWaypointAuthor` + render-nivå-pin-drop-mekanikken + 3D-motoren | **PRD 6 (prd-3d-motor)** |
| Den MEKANISKE ekstraksjonen av flythrough-effektene + markersett ut av `BoardMap3D` (plumbingen — `board-flythrough-orchestrator.ts`-skjelettet); PRD 10 komponerer choreografien PÅ den | **PRD 6 (prd-3d-motor) Unit 7** (06:266-270) — eierskaps-grense §10 Q1 |
| `CameraCutOverlay`-KOMPONENTEN (motor-intern cut-feedback bundet til `useBoard3DCamera` + `CUT_FADE_MS`) | **PRD 6 (prd-3d-motor)** (09 §10 Q3-anbefaling) — PRD 10 eier kun BRUKEN |
| `camera-tours`-DATAEN (per-prosjekt autorerte waypoints) + `getCameraTour`-accessoren + board-skall-komposisjonen | **PRD 9 (prd-board-skall-ui)** |
| `?establishing=1` splash-skip-effekten (skall-siden, `ReportReelsPage.tsx:594-600`) | **PRD 9 (prd-board-skall-ui) Unit 2** — PRD 10 eier URL-flagg-kontrakten, PRD 9 monterer skall-effekten (§10 Q4) |
| `board-establishing-shots`-DATA (`ESTABLISHING_SHOTS`-record) | **DATA→PRD 9 (prd-board-skall-ui)** (LUKKET kontroll-runde 2026-06-27, PRD 9 Beslutning 16) — samme klasse som `camera-tours`-DATAEN PRD 9 allerede eier; MEKANISMEN `getEstablishingShot` → PRD 6. PRD 10 konsumerer KUN mekanismen (`getEstablishingShot`) for `?establishing=1` og er ublokkert (§10 Q5). |
| `board-intros.ts`-MEKANISME + DATA (per-prosjekt innflyvnings-retning) | **MEKANISME→PRD 6, DATA→PRD 9** (LUKKET kontroll-runde 2026-06-27, §10 Q3) |
| Server-action emit-logging mot `events` på kamera-choreografi-overganger (PRD 10 eksponerer kun emit-site-flatene) | **PRD 13 (prd-instrumentering)** |

**Eksplisitt ikke-scope:** render-gating på `reportTier`. Ingen unit bygger en tier-render-bryter (verifisert: 0 `reportTier`-ref i `BoardMap3D`/`CameraCutOverlay`/`capture-3d-flythrough.mjs`). Choreografi-divergens er datadrevet (`hasVoiceOver`); tier-krav fanges av PRD 2s validator.

---

## 7. Implementation Units (8 av 8 dekket)

### Unit 1 — Intro-choreografi-orkestrering (welcome-beat + basic-intro + `?fly=1`)
- **Mål (→ G1):** Hjemle beat→tour-mappingen for den autorerte oval-spiral-introen som ren orkestrerings-logikk på PRD 6s `runIntroFlythrough`-primitiv; bevar tre intro-eiere AND-et av establishing-mode + VO-skalering/calm-sweep/pause-frys.
- **Filer:** `@/components/variants/report/board/board-flythrough-orchestrator.ts` (choreografi-logikken, ekstrahert sammen med PRD 6 Unit 7-plumbingen), `@/components/variants/report/board/BoardMap3D.tsx` (intro-effekt-koblingen, grense-delt §10 Q1).
- **Akseptansekriterier:**
  1. `introActive = (flyMode || isWelcomeBeat || basicIntroActive) && !establishingMode` (`BoardMap3D.tsx:216-217`) bevart VERBATIM — to animatorer kjemper aldri om posituren (gotcha).
  2. **Basic-tier (uten VO):** `basicIntroActive && !isWelcomeBeat && !flyMode` → `runIntroFlythrough` med `buildBasicIntroPath(orbitRange)` (`:577-590`); lander på hvile-range; `onPhase("done")` → `dispatch END_INTRO`; `staticOnly: reducedMotion`.
  3. **Produkt-welcome (med VO):** settle = `WELCOME_INTRO_SETTLE_MS` (`:597-599`); fly-varighet skaleres `Math.max(MIN_INTRO_FLY_MS, audioDurationMs - settleMs)` (`:600-603`); calm-sweep-override (`WELCOME_CALM_SWEEP_DEG`, `ovalEccentricity: 0`, `:608-617`); `isPaused: () => audioPausedRef.current` fryser uten restart (`:628`).
  4. **Capture (`?fly=1`):** beholder banens fulle sweep + default settle (cinematisk opptak, `:596`/`:607`); `staticOnly` gjelder KUN produkt-beaten, ikke capture (`:626-627`).
  5. center=target-invarianten bevart (introPoseAt, PRD 6) — bryter man den blir oval-spiralen en vanlig orbit (gotcha).
  6. `window.__placyIntroFly` settes per fase (`:583/630`) — capture-synk-kontrakten (Unit 7) bevart.
  7. `getBoardIntro(projectSlug)` (`:559-562`) konsumert for per-prosjekt innflyvnings-retning; ukjent slug → `{}` → standard-intro.
  8. Choreografi-logikken er ren/hook (ikke JSX-bundet); `npx tsc --noEmit` 0 feil.
- **Avhengigheter:** PRD 6 (intro-primitiver + Unit 7-ekstraksjon), PRD 9 (`?fly=1` cameraMode-free-default, board-skall), PRD 5 (`projectSlug`/`home`), PRD 14 (`useCurrentTrack`-beat-signal-KONTRAKT — kun produkt-welcome-grenen AC3; basic/capture-grenene AC2/AC4 er PRD-14-uavhengige, §10 Q7).

### Unit 2 — Establishing-choreografi-orkestrering (`?establishing=1` helikopter-flyover)
- **Mål (→ G2):** Hjemle multi-waypoint helikopter-flyover-choreografien på PRD 6s `runEstablishingFlythrough` + `getEstablishingShot`; bevar bloom→reveal-kaskade-koblingen; dokumenter cross-file splash-skip-kontrakten.
- **Filer:** `@/components/variants/report/board/board-flythrough-orchestrator.ts` (establishing-choreografi), `@/components/variants/report/board/BoardMap3D.tsx` (establishing-effekt-koblingen, grense-delt §10 Q1).
- **Akseptansekriterier:**
  1. `establishingFlag` leser `?establishing=1` (`:177-181`); `establishingShot = getEstablishingShot(projectSlug)` (`:182-186`); `establishingMode = !!establishingShot` (`:187`) — slug uten konfigurert rute → `undefined` → `?establishing=1` no-op (gotcha, `board-establishing-shots.ts:42-46`).
  2. `runEstablishingFlythrough` kjøres med `path: establishingShot`, `staticOnly: reducedMotion`, `onProgress(s)` → `setBloomStarted(true)` når `s >= bloomAtProgress` (`:655-674`); reduced-motion → vis reveal statisk ved `done` (`:671`).
  3. `bloomAtProgress=0.02` → reveal-kaskaden fyrer straks flyturen starter (`board-establishing-shots.ts:34`); `showReveal` gated på `establishingMode && bloomStarted` (`BoardMap3D:424-429`).
  4. `establishingMode` AND-er bort intro-eierne (`:216-217`) OG mates som `introActive || establishingMode` til `useBoard3DCamera` (`:528`) så director yield-er.
  5. `window.__placyEstablishing` settes per fase (`:667`).
  6. **Cross-file splash-skip-kontrakt BEKREFTET (§10 Q4, kontroll-runde 2026-06-27):** skall-siden (`ReportReelsPage.tsx:594-600` hopper splash + avdekker kart uten audio) eies av PRD 9 Unit 2; establishing-choreografien (`BoardMap3D.tsx:177-187` flagg-state + `:655-674` flythrough-effekt) eies av PRD 10. De DELER kun URL-strengen `'establishing'` — flagg-navnet er den ENE koblingen som må holdes synkront. Ingen redigering av PRD 9-eid fil fra PRD 10 uten serialiserings-koordinering (§10 Q4).
  7. `npx tsc --noEmit` 0 feil; `board-establishing-flythrough.test.ts` (PRD 6-eid) forblir grønn.
- **Avhengigheter:** PRD 6 (`runEstablishingFlythrough`/`getEstablishingShot`-mekanisme), PRD 9 (splash-skip skall-side), PRD 5 (`projectSlug`).

### Unit 3 — Outro summary-fly-choreografi
- **Mål (→ G3):** Hjemle outro summary-fly-choreografien (`isOutroBeat` → `flyCameraTo SUMMARY_*`) + free-yield-koblingen mot board-skallet; bevar rekkefølge-invarianten (director-stopp før summary-fly).
- **Filer:** `@/components/variants/report/board/board-flythrough-orchestrator.ts` (outro-choreografi) / `@/components/variants/report/board/BoardMap3D.tsx` (outro-effekt-koblingen).
- **Akseptansekriterier:**
  1. Outro-effekten fyrer KUN når `isOutroBeat && cameraMode === "free" && map3dInstance` (`:684-696`); `flyCameraTo` med `SUMMARY_RANGE/SUMMARY_TILT/SUMMARY_FLY_MS` (PRD 6-konstanter, `:687-694`).
  2. **Rekkefølge-invariant bevart:** outro-effekten er registrert ETTER `useBoard3DCamera`-kallet (`:525` vs `:684`) så director-ens stopp kjører FØR summary-fly-en i commit-en der modus blir 'free' (dokumentert `:676-683`) — bryter man rekkefølgen kjemper director og summary-fly.
  3. **Free-yield-kobling:** board-skallet setter `cameraMode='free'` på outro-beat (`BoardMap.tsx:189-200`, PRD 9-eid) så director er no-op (`decideCameraIntent` free-gren, PRD 6); PRD 10 konsumerer atferden, eier den ikke.
  4. `npx tsc --noEmit` 0 feil.
- **Avhengigheter:** PRD 6 (`FlyCapableMap`/`SUMMARY_*`-konstanter + `decideCameraIntent` free-gren), PRD 9 (outro-beat → fri, `BoardMap.tsx:189-200`), PRD 14 (`isOutroBeat` via `useCurrentTrack`/`categoryId`-beat-signal — kontrakt, §10 Q7).

### Unit 4 — Autorert kategori-tour-komposisjon
- **Mål (→ G4):** Komponer `getCategoryCamera`-mekanismen (PRD 6) med `camera-tours`-DATA (PRD 9) + `deriveCategoryCamera`-fallback til kategori-config touren mater inn i `useBoard3DCamera`.
- **Filer:** `@/components/variants/report/board/BoardMap3D.tsx` (`categoryConfig`-komposisjonen, `:508-518`).
- **Akseptansekriterier:**
  1. `categoryConfig`: eksplisitt `getCategoryCamera(projectSlug, activeCategory.id)` har forrang (`:510-511`); ellers `deriveCategoryCamera(home, coords)` fra `topRankedPois`/`pois` (`:512-517`) — graceful fallback til orbit hvis ingen (gotcha, `camera-tours.ts:14`).
  2. `categoryConfig` mates til `useBoard3DCamera` (`:532`); kategori-skifte uten waypoints rører IKKE kameraet (orbit går uavbrutt — dokumentert `:521-524`).
  3. PRD 10 KONSUMERER `getCategoryCamera`-mekanismen (PRD 6) + `camera-tours`-DATA (PRD 9); re-hjemler INGEN av dem (grense respektert).
  4. `getCameraTour` (PRD 9-accessor) bekreftet som PRD 10s forventede render-konsument (09 Beslutning 6) — signatur konsumeres verbatim, endres ikke.
  5. `npx tsc --noEmit` 0 feil.
- **Avhengigheter:** PRD 6 (`getCategoryCamera`/`deriveCategoryCamera`-mekanisme + `useBoard3DCamera`), PRD 9 (`camera-tours`-DATA), PRD 5 (`activeCategory`/`home`).

### Unit 5 — URL-flagg-kontrakt + film-modus-produkt
- **Mål (→ G5):** Hjemle `?film=1`/`?fly=1`/`?establishing=1`/`?author=1` URL-flagg-KONTRAKTEN (semantikk + render-nivå-pin-drop-bruk) som film-modus-produkt; konsumer `CameraWaypointAuthor`.
- **Filer:** `@/components/variants/report/board/BoardMap3D.tsx` (URL-flagg-state + `markerPOIs`-pin-drop-bruk + `CameraWaypointAuthor`-mount).
- **Akseptansekriterier:**
  1. URL-flagg-state lest ÉN gang ved mount: `filmMode` (`:156-160`), `flyMode` (`:165-169`), `establishingFlag` (`:177-181`), `authorMode` (`:145-149`).
  2. **Render-nivå-pin-drop:** `markerPOIs → []` når `filmMode || flyMode || establishingMode` (`:334-337`) — pins MÅ droppes på render-nivå, ALDRI via DOM-fjerning utenfra (removeChild-race, gotcha `:151-155`). PRD 6 eier mekanikken; PRD 10 eier URL-flagg-PRODUKTET som aktiverer den.
  3. `projectSite`-labelen (`:751-756`) påvirkes IKKE av film-modus (egen prop) — rent kart beholder prosjekt-label (ToS + produktverdi).
  4. `?fly=1` impliserer film-modus (pins skjult) + 'free' cameraMode (PRD 9, `BoardMap.tsx:146-152`) — film-modus AVHENGER av free-yield (gotcha). Merk: `cameraMode` defaulter til 'free' når `!hasVoiceOver` ELLER `?fly=1` — `?fly=1` er ÉN av to free-triggere (konversen `free ⇒ ?fly=1` er FALSK; no-VO-board er også free uten flagget).
  5. `CameraWaypointAuthor` (PRD 6) mountet KUN bak `?author=1` (`:776-782`); konsumert for waypoint-autoring til `camera-tours`-DATA, ikke eid.
  6. URL-flagg-KONTRAKTEN dokumentert: hvilke flagg finnes + semantikk; mount-effektene bor i PRD 6/9-eide filer (§10 Q4) — PRD 10 krever ikke redigering av dem uten koordinering.
  7. `npx tsc --noEmit` 0 feil.
- **Avhengigheter:** PRD 6 (render-nivå-pin-drop-mekanikk + `CameraWaypointAuthor`), PRD 9 (`?fly=1` free-default + `?establishing=1` splash-skip skall-side), Unit 1/2 (flagg-koblet choreografi).

### Unit 6 — Cut-overlay-choreografi-bruk
- **Mål (→ G6):** Hjemle `CameraCutOverlay`-BRUKEN under autorert tour (label/farge per beat, drevet av `cutVisible`); respekter eierskaps-grensen mot PRD 6 (komponenten).
- **Filer:** `@/components/variants/report/board/BoardMap3D.tsx` (`CameraCutOverlay`-mount + label/farge-choreografi, `:759-769`).
- **Akseptansekriterier:**
  1. `CameraCutOverlay` mountet med `visible={cutVisible}` (fra `useBoard3DCamera`, PRD 6); `label` = `activeCategory?.label ?? (isHomeBeat ? "Nabolaget" : isOutroBeat ? "Oppsummert" : undefined)` (`:764-767`); `color = activeCategory?.color` (`:768`).
  2. **Eierskaps-grense (§10 Q2 — RATIFISERT, §9 Beslutning 6):** PRD 6 eier KOMPONENTEN (`CameraCutOverlay.tsx`, motor-intern cut-feedback bundet til `useBoard3DCamera` + `CUT_FADE_MS`, 09 §10 Q3); PRD 10 eier choreografi-BRUKEN (label/farge per beat, `BoardMap3D.tsx:764-768`). Ratifisert i kontroll-runde 2026-06-27 — beads serialiserer ÉN fil-eier (PRD 6).
  3. `CUT_FADE_MS` (PRD 6-konstant) er eneste sannhetskilde — CameraCutOverlay leser samme, fade og kamera-hopp desynker aldri (gotcha).
  4. `npx tsc --noEmit` 0 feil.
- **Avhengigheter:** PRD 6 (`CameraCutOverlay`-komponent + `cutVisible` + `CUT_FADE_MS`), PRD 5 (`activeCategory`), PRD 14 (`isHomeBeat`/`isOutroBeat` via `useCurrentTrack`-beat-signal, §10 Q7).

### Unit 7 — Capture-pipeline-port (`capture-3d-flythrough.mjs`)
- **Mål (→ G7):** Port capture-/film-modus-PRODUKTET: `?fly=1`-drevet CDP-screencast, `__placyIntroFly`-fase-synk, ren-kart-capture, frames→concat.
- **Filer:** `@/scripts/capture-3d-flythrough.mjs` (port).
- **Akseptansekriterier:**
  1. Scriptet legger på `?fly=1` (`:144`) og DRIVER IKKE kameraet — boardet gjør det via `?fly=1` (gotcha); scriptet venter på `__placyIntroFly`-fase (`settling`→`running`→`done`, `:124-133`/`:220-221`/`:261`).
  2. Ren-kart-capture: søsken til `gmp-map-3d` skjules oppover ancestor-kjeden (`:228-244`); Google-attribusjon + prosjekt-label (inni `gmp-map-3d`) beholdes (ToS).
  3. «Start opplevelsen»-knapp trykkes for å avdekke board + starte flythrough (`:200-216`); venter map+modell-ready (`:210-215`).
  4. Screencast (CDP `Page.startScreencast`) starter i settle-fasen (`:252-258`); frames skrives til `concat.txt` med per-frame-varighet fra timestamps + `MAX_GAP`-klamping (`:268-298`).
  5. **Build-time/dev-pipeline, ikke runtime-LLM** (konformt med arkitekturregel — lagret video-output). Avklar npm-script-inngang vs. direkte `node`-invokasjon (§10 Q6).
  6. Scriptet kjører uten feil mot en live dev-server (verifiseres i Unit 8).
- **Avhengigheter:** Unit 1 (intro-choreografi + `__placyIntroFly`-fase-eksponering), Unit 5 (URL-flagg-kontrakt), PRD 9 (`?fly=1` board-atferd).

### Unit 8 — Verifikasjon (nystartet Chrome) + mekaniske porter
- **Mål (→ G8):** Bevis at den autorerte opplevelsen FUNGERER (ikke bare kompilerer): welcome→outro-choreografi, `?film=1` rent kart, capture-kjøring; alle porter grønne.
- **Filer:** `@/docs/rebuild/kamera-flythrough-verifikasjon-runbook.md` (verifikasjons-runbook).
- **Akseptansekriterier:**
  1. **Nystartet Chrome (memory `project_3d_default_map_engine`):** Åpne et `has3dAddon`-board med VO; kjør hele beat-sekvensen welcome→nabolag→kategori→oppsummering→outro. Verifiser: oval-spiral-intro spiller på welcome-beat, kategori-tour på kategori-beat, summary-fly på outro; ingen «Too many active WebGL contexts»; ingen to-animator-konflikt (kameraet rykker ikke).
  2. **`?film=1`** gir rent kart uten pins (verifiser `markerPOIs`-tomt på render-nivå, ingen DOM-removeChild-crash); `projectSite`-label vises fortsatt.
  3. **`?fly=1`** spiller oval-spiral live i fri-modus (director kjemper ikke); **`?establishing=1`** spiller multi-waypoint-flyover + reveal-bloom på board med konfigurert rute (byggetrinn-4); slug uten rute → no-op (kein crash).
  4. **`capture-3d-flythrough.mjs`** kjørt mot live dev-server → produserer JPG-frames + `concat.txt` (Output-fokus: film-modus FUNGERER, ikke bare kompilerer).
  5. `npm run lint` (0 errors), `npm test` (intro-/establishing-/director-tester grønne — PRD 6-eide, arvet), `npx tsc --noEmit` (0 feil), `npm run build` (bygger).
- **Avhengigheter:** Unit 1–7.

> **Fullstendighet:** 8 av 8 units dekket. Hver konsumert dep-fil + hver PRD 10-eid choreografi-flate er eksplisitt tildelt en unit; ingen sampling. Ingen render-gating bygges (verifisert 0 `reportTier`-ref).

---

## 8. Utviklingsløp (faser)

### Fase 1 — Beat→tour-choreografi (intro + establishing + outro + kategori)
- **Mål:** De fire autorerte tourene (intro oval-spiral, establishing flyover, outro summary-fly, kategori-tour) hjemlet som ren choreografi-logikk på PRD 6s primitiver + PRD 9s data.
- **Leveranse:** Unit 1, 2, 3, 4.
- **Autonomi-nivå:** Middels. Choreografi-logikken er godt avgrenset; ekstraksjonen er grense-delt med PRD 6 Unit 7, men eierskapet er LUKKET (§9 Beslutning 9 — PRD 6 eier fila, PRD 10 komponerer oppå) så det er ingen blokkerende gate før Unit 1 lukkes. AND-invarianten + VO-skalering + rekkefølge-invariant er subtile; bevares verbatim. NB: beat-signalet kommer fra PRD 14s `audio-tour-store` som KONTRAKT (§10 Q7) — kun produkt-welcome-grenen er PRD-14-koblet.

### Fase 2 — Film-modus-produkt + cut-overlay + capture
- **Mål:** URL-flagg-kontrakten + render-nivå-pin-drop-bruk + cut-overlay-choreografi + capture-pipelinen står.
- **Leveranse:** Unit 5, 6, 7.
- **Autonomi-nivå:** Middels. `CameraCutOverlay`-eierskap (§10 Q2) er RATIFISERT (§9 Beslutning 6, kontroll-runde 2026-06-27) — ingen gate før Unit 6. Capture-pipelinen er nær-verbatim port; cross-file splash-skip-kontrakten (§10 Q4) er BEKREFTET (deler kun `'establishing'`-strengen) og berører PRD 9-eid fil kun via flagg-navnet, ikke delt kode.

### Fase 3 — Verifikasjon mot prod (nystartet Chrome)
- **Mål:** Hele den autorerte opplevelsen bevist i nystartet Chrome (welcome→outro + film-modus + capture-kjøring); alle mekaniske porter grønne.
- **Leveranse:** Unit 8.
- **Autonomi-nivå:** Middels. Krever live `has3dAddon`-board + Chrome DevTools-observasjon + faktisk capture-kjøring («Output-fokus»: features må FUNGERE).

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | PRD 10 eier choreografi-LOGIKKEN (beat→tour-mapping); PRD 6 Unit 7 eier den mekaniske ekstraksjonen (plumbingen) | 06:266-270 tar ekstraksjons-eierskapet eksplisitt (`board-flythrough-orchestrator.ts`, 06:267); todeling = mekanisme (PRD 6) vs. produkt (PRD 10). **Fil-eierskapet er LUKKET — se Beslutning 9** (09 Beslutning 3-presedenten anvendt; ÉN beads-eier = PRD 6) |
| 2 | `introActive` AND-et av `establishingMode` bevares verbatim | Tre intro-eiere AND-et bort så to animatorer aldri kjemper om posituren (`BoardMap3D:216-217`); bryter man det → kamera-rykk |
| 3 | Film-modus dropper pins på RENDER-nivå (`markerPOIs → []`), aldri via DOM utenfra | removeChild-race på node React eier krasjer (`BoardMap3D:151-155`); PRD 6 eier mekanikken, PRD 10 URL-flagg-produktet |
| 4 | `capture-3d-flythrough.mjs` DRIVER ikke kameraet — boardet gjør det via `?fly=1` | Scriptet venter på `__placyIntroFly`-fase + tar opp; film-modus er URL-flagg + board-drevet (gotcha), ikke script-drevet kamera |
| 5 | `hasVoiceOver` er datadrevet choreografi-seleksjon, IKKE tier-gating | Leser board-data-innhold (VO finnes → welcome-drevet intro; ellers basic-intro); speiler `pickPlayableAudio`, ikke `reportTier` (PRD 6 Beslutning 5) |
| 6 | **RATIFISERT (kontroll-runde 2026-06-27):** `CameraCutOverlay`-KOMPONENTEN eies av PRD 6; PRD 10 eier BRUKEN (label/farge per beat, `BoardMap3D.tsx:764-768`) | Komponenten er motor-intern (bundet til `useBoard3DCamera` + `CUT_FADE_MS`, mountet `BoardMap3D:759`); 09 §10 Q3-anbefaling. Todelingen er nå formelt ratifisert — PRD 6 eier fila (`CameraCutOverlay.tsx`), PRD 10 hjemler choreografi-bruken (label/farge per beat) gjennom `cutVisible`-kontrakten. Ingen utestående gate (§10 Q2 LUKKET) |
| 7 | PRD 10 konsumerer `getCategoryCamera`-mekanisme (PRD 6) + `camera-tours`-DATA (PRD 9); re-hjemler ingen | Grensene i 06 Beslutning 6 + 09 Beslutning 7 respektert; PRD 10 er ren komponist |
| 8 | INGEN render-gating på `reportTier` bygges | Verifisert 0 ref i `BoardMap3D`/`CameraCutOverlay`/`capture-3d-flythrough.mjs`; tier-krav fanges av PRD 2s validator |
| 9 | **RATIFISERT (fil-eierskap for `board-flythrough-orchestrator.ts`) — GATEN ER LUKKET:** PRD 6 (Unit 7) eier den MEKANISKE ekstraksjonen + fila (06:267 navngir den i sin egen Filer-liste). PRD 10 bidrar AND-invariant-linjene (`introActive = ... && !establishingMode`, `BoardMap3D:216-217`) som en **gjennomgått kontrakt PRD 10 KONSUMERER og IKKE bryter** — IKKE en konkurrerende eier av samme AC. Beads serialiserer ÉN eier (PRD 6) for fila; PRD 10 hjemler choreografi-LOGIKKEN som komponeres oppå den ekstraherte plumbingen. | **Anvender 09 Beslutning 3-presedenten verbatim** (09:319, `BoardMap.tsx`-konflikten ble LUKKET likt: ÉN eier + invariant-linjer som gjennomgått kontrakt). PRD 6 Unit 7 AC2 (06:270) og PRD 10 Unit 1 AC1 bærer SAMME AND-invariant på SAMME linjer — todelingen er mekanisme (PRD 6 eier fila + flytter effektene) vs. produkt (PRD 10 komponerer choreografien). Gaten var §10 Q1; den er nå LUKKET her så beads serialiserer Fase 1 uten blokkering. |

### Kontroll-runde 2026-06-27

| Funn | Dom | Konsekvens |
|------|-----|------------|
| `CameraCutOverlay`-eierskap (§10 Q2 / Besl. 6) | **RATIFISERT** — PRD 10 eier BRUKEN (label/farge per beat, `BoardMap3D.tsx:764-768`); PRD 6 eier KOMPONENTEN (`CameraCutOverlay.tsx`). | Besl. 6 oppgradert fra «må ratifiseres» → ratifisert; §10 Q2 LUKKET. Beads serialiserer ÉN fil-eier (PRD 6) for komponenten, PRD 10 hjemler bruken via `cutVisible`-kontrakten. |
| `?establishing=1` cross-file URL-kontrakt (§10 Q4) | **BEKREFTET** — splash-skip-skallet bor i `ReportReelsPage.tsx:594-600` (PRD 9); establishing-choreografien bor i `BoardMap3D.tsx:177-187` (flagg-state) + `:655-674` (flythrough-effekt) (PRD 10). De DELER kun URL-strengen `'establishing'`. | §10 Q4 bekreftet: flagg-navnet (`establishing`) er den ENE koblingen som må holdes synkront mellom de to filene. PRD 10 redigerer ikke PRD 9-eid fil; kontrakten er strengen, ikke delt kode. |
| `board-intros.ts` (`getBoardIntro`) uassignert keeper (§10 Q3) | **LUKKET** — MEKANISMEN (`getBoardIntro`-oppslag) følger PRD 6 (`board-intro-flythrough`-klassen); DATAEN (`BOARD_INTROS`-record) følger PRD 9 (samme klasse som `camera-tours`-DATA). Konsumeres i `BoardMap3D.tsx:560`. | §10 Q3 LUKKET: ingen uassignert keeper igjen. PRD 10 konsumerer kun (Unit 1 AC7); MEKANISME→PRD 6, DATA→PRD 9 hjemler den. |

---

## 10. Åpne spørsmål

*Følgende er ikke-blokkerende for Fase 1 med mindre annet er notert.*

1. **`board-flythrough-orchestrator.ts`-EIERSKAP — LUKKET (se §9 Beslutning 9).** Spørsmålet (06 Unit 7 vs PRD 10 om samme fil) er RESOLVERT, ikke lenger en blokkerende gate: PRD 6 (Unit 7) eier fila + den MEKANISKE ekstraksjonen (06:267 navngir den); PRD 10 hjemler choreografi-LOGIKKEN oppå den, og bidrar AND-invariant-linjene (`BoardMap3D:216-217`) som en gjennomgått kontrakt PRD 10 ikke bryter. Dette anvender 09 Beslutning 3-presedenten verbatim (09:319) — ÉN beads-serialiserings-eier (PRD 6), invariant som kontrakt. Beads kan serialisere Fase 1 uten gate. (Beholdt her som peker; ingen utestående beslutning.)
2. **`CameraCutOverlay`-EIERSKAP — LUKKET (kontroll-runde 2026-06-27, se §9 Beslutning 6).** Spørsmålet (PRD 6 vs PRD 10 om samme fil) er RATIFISERT: PRD 6 eier KOMPONENTEN (`CameraCutOverlay.tsx`, motor-intern cut-feedback bundet til `useBoard3DCamera` + `CUT_FADE_MS`, mountet `BoardMap3D:759`); PRD 10 eier choreografi-BRUKEN (label/farge per beat, `BoardMap3D.tsx:764-768`) gjennom `cutVisible`-kontrakten. Ingen utestående gate; beads serialiserer ÉN fil-eier (PRD 6). (Beholdt her som peker; ingen utestående beslutning.)
3. **`board-intros.ts` (`getBoardIntro:47`) — LUKKET (kontroll-runde 2026-06-27).** Den tidligere uassignerte keeperen er nå hjemlet: MEKANISMEN (`getBoardIntro`-oppslag) følger `board-intro-flythrough`-klassen → **PRD 6**; DATAEN (`BOARD_INTROS`-record) samme klasse som `camera-tours`-DATA → **PRD 9**. `getBoardIntro` konsumeres i `BoardMap3D.tsx:560` (per-prosjekt innflyvnings-retning, Unit 1 AC7) + testet (`board-intro-flythrough.test.ts:63-77`). PRD 10 KONSUMERER kun; MEKANISME→PRD 6, DATA→PRD 9 eier den. Ingen uassignert keeper igjen. (Beholdt her som peker; ingen utestående beslutning.)
4. **`?establishing=1`-orkestrering er CROSS-FILE — BEKREFTET (kontroll-runde 2026-06-27).** Splash-skip-skallet lever i `ReportReelsPage.tsx:594-600` (PRD 9-fil); establishing-choreografien lever i `BoardMap3D.tsx:177-187` (flagg-state) + `:655-674` (flythrough-effekt) (PRD 10-orkestrert, dekomponert av PRD 6). De to filene DELER kun URL-strengen `'establishing'` — flagg-navnet er den ENE koblingen som må holdes synkront. PRD 10 eier URL-flagg-KONTRAKTEN (hvilke flagg + semantikk); PRD 9 monterer `?establishing=1`s skall-side i sin egen fil. PRD 10 redigerer ikke PRD 9-eid fil: kontrakten er strengen, ikke delt kode. Koordineres ved serialisering så ingen av PRD-ene endrer flagg-navnet uensidig. (Beholdt her som peker; ingen utestående beslutning.)
5. **`board-establishing-shots`-DATA-mottaker — LUKKET (kontroll-runde 2026-06-27, PRD 9 Beslutning 16).** Den tidligere uverifiserte deferral-pekeren er nå hjemlet: MEKANISMEN (`getEstablishingShot`) følger `board-establishing-flythrough`-klassen → **PRD 6**; DATAEN (`ESTABLISHING_SHOTS`-record) samme klasse som `camera-tours`-DATA → **PRD 9** (PRD 9 Beslutning 16 hjemler `ESTABLISHING_SHOTS` eksplisitt, lukker foreldreløs keeper). PRD 10 KONSUMERER kun mekanismen for `?establishing=1`; MEKANISME→PRD 6, DATA→PRD 9 eier den. Ingen uassignert keeper igjen. (Beholdt her som peker; ingen utestående beslutning.)
6. **`capture-3d-flythrough.mjs` har INGEN package.json-script-entry** (verifisert: `grep "capture" package.json` tomt; kjøres via `node scripts/capture-3d-flythrough.mjs`, `capture-3d-flythrough.mjs:27`). PRD 10 eier scriptet som film-modus-produkt. **Avklar:** legge til en npm-script-inngang (`capture:flythrough`) for oppdagbarhet, eller beholde direkte `node`-invokasjon? Ikke-blokkerende; default = behold direkte invokasjon (prototype-stadium).
7. **LAG-ORDNING 10↔14 (audio-tour-store beat-signal — KONTRAKT vs RUNTIME):** PRD 10s beat→tour-choreografi trigges av `useCurrentTrack`/`useAudioTourPhase`/`categoryId` (welcome/home/outro) som kommer fra PRD 14s `audio-tour-store` (`BoardMap3D.tsx:45`-import, PRD 14:92 + Beslutning 8 eier hele runtime audio-playback). Men PRD 10 = Lag 3, PRD 14 = Lag 4 (`00-INDEX:34/38`) — bygges ETTER PRD 10. **Spenning:** beads kan ikke topologisk ordne PRD 10 før sin trigger-kilde hvis PRD 10 trenger PRD 14s LIVE runtime-store. **Anbefaling (verifisert mot PRD 14 §10 Q5 / `14:159`):** PRD 10 avhenger KUN av selector-/type-KONTRAKTEN (`useCurrentTrack`/`useAudioTourPhase`-signatur + `categoryId`-shape), ikke runtime-instansen — samme grep PRD 14 selv bruker for `BoardCategoryId`-hoist (avhengighet snudd OPPOVER til kjerne-domene). Kontrakten kan derfor hoistes til en delt Lag-2-plassering så PRD 10 bygger mot en stub. **Split som beads serialiserer på:** PRD 10s IKKE-audio-stier (`?fly=1`-capture, `?establishing=1`, `basicIntroActive` via `state.introPlaying`) trenger IKKE storen i det hele tatt — kun den AUDIO-drevne produkt-welcome-beaten er PRD-14-koblet. Gjør splitten eksplisitt: Unit 1s basic-/capture-grener (AC2/AC4) er PRD-14-uavhengige; kun produkt-welcome-grenen (AC3) + Unit 8 AC1 (live `has3dAddon`-board med VO) krever PRD 14s kjørende store. Avklar hoist-plasseringen med PRD 14-forfatter før beads serialiserer lag-rekkefølgen; ikke-blokkerende for PRD 10s ikke-audio-design.

---

## 11. Avhengigheter (PRD-graf)

```
   PRD 6 — prd-3d-motor                  PRD 9 — prd-board-skall-ui
   (pose-/intent-PRIMITIVER:             (camera-tours-DATA + getCameraTour;
    runIntro/runEstablishing/             board-skall touren spilles i;
    decideCameraIntent/useBoard3DCamera;  ?fly=1→free-default;
    getCategoryCamera-MEKANISME;          outro→fri+hint;
    getEstablishingShot-MEKANISME;        ?establishing=1 splash-skip skall-side;
    CameraWaypointAuthor;                 BoardMap-wrapper + ReportReelsPage)
    CameraCutOverlay-KOMPONENT;
    render-nivå-pin-drop-mekanikk;
    board-flythrough-orchestrator-
    ekstraksjon (Unit 7))
              │                                      │
              └──────────────────┬───────────────────┘
                                 │   ┌─ PRD 14 — audio-tour-store
                                 │   │  beat-signal (KONTRAKT, §10 Q7):
                                 │   │  useCurrentTrack/useAudioTourPhase
                                 │◄──┤  /categoryId — driver welcome/
                                 │   │  home/outro-beat-grenene
                                 ▼   └─ (Lag 4 — bygg mot type/signatur)
            ┌──── PRD 10 — prd-kamera-flythrough (DENNE) ────┐
            │  Beat→tour-choreografi (intro oval-spiral /     │
            │  establishing flyover / outro summary-fly /     │
            │  autorert kategori-tour); URL-flagg-KONTRAKT    │
            │  (?film/?fly/?establishing/?author); film-modus │
            │  -produkt + render-pin-drop-bruk; CameraCut-    │
            │  Overlay-BRUK; capture-3d-flythrough-pipeline   │
            └──────────────────────┬──────────────────────────┘
                                   ▼
                          board-flaten (cinematisk nivå-1-opplevelse)
                          + PRD 13 (emit-sites på kamera-choreografi)
```

**Blokkeres av:** PRD 6 (pose-/intent-primitiver + Unit 7-ekstraksjon), PRD 9 (`camera-tours`-DATA + board-skall + `?fly=1`/outro/`?establishing=1`-skall-atferd). **PRD 14 (audio-tour-store beat-signal — KONTRAKT, se §10 Q7):** PRD 10s audio-drevne welcome-beat-gren konsumerer `useCurrentTrack`/`useAudioTourPhase`/`categoryId` fra PRD 14s runtime-store. Lag-ordnings-spenning (PRD 10 = Lag 3, PRD 14 = Lag 4) løses ved at PRD 10 bygger mot selector-KONTRAKTEN (type + signatur), ikke en live store — §10 Q7. **Flagg for 00-INDEX:** PRD 10s dep-liste oppdateres fra `06, 09` til `06, 09, 14`.
**Blokkerer:** ingen (Lag 3, blad-node — `00-INDEX:56`). PRD 13 wires emit-sites inn, men blokkeres ikke.
**Konsumerer (eier ikke):** pose-/intent-primitiver + `getCategoryCamera`/`getEstablishingShot`-mekanismer + `useBoard3DCamera` + `CameraCutOverlay`-komponent + `CameraWaypointAuthor` + render-pin-drop-mekanikk → PRD 6; `camera-tours`-DATA + `getCameraTour` + board-skall + `?fly=1`/outro/`?establishing=1`-skall-side → PRD 9; **`audio-tour-store` beat-signal (`useCurrentTrack`/`useAudioTourPhase`/`categoryId`) → PRD 14 (§5.3b, §10 Q7)**; `projectSlug`/`home`/`categories` + `pickPlayableAudio`-SELEKSJON → PRD 5; `board-establishing-shots`-MEKANISME (`getEstablishingShot`) → PRD 6 / DATA (`ESTABLISHING_SHOTS`) → PRD 9 (LUKKET, PRD 9 Beslutning 16, §10 Q5); `board-intros`-MEKANISME → PRD 6 / DATA → PRD 9 (LUKKET, §10 Q3).
**Koordineringspunkter (06↔10, 09↔10, 14↔10):** `board-flythrough-orchestrator.ts`-serialiserings-eierskap (§9 Beslutning 9 — LUKKET), `CameraCutOverlay`-eierskap (§9 Beslutning 6 / §10 Q2 — RATIFISERT kontroll-runde 2026-06-27), `?establishing=1` cross-file splash-skip (§10 Q4 — BEKREFTET kontroll-runde 2026-06-27, deler kun `'establishing'`-strengen), `audio-tour-store` beat-signal-kontrakt + lag-ordning (§10 Q7).

---

**Fullstendighet:** 8 av 8 implementation units spesifisert med avhengigheter + akseptansekriterier; 8 av 8 mål (G1–G8) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i faktisk kode (verifisert: `BoardMap3D.tsx:145-149`/`156-160`/`165-169`/`177-187`/`205`/`212`/`216-217`/`240`/`244`/`334-337`/`508-518`/`525-541`/`559-562`/`567-646`/`655-674`/`684-696`/`751-756`/`759-769`/`776-782`, `board-intro-flythrough.ts:56-68`/`73`/`81`/`89`/`103-114`/`148-161`/`174`, `board-establishing-flythrough.ts:25` (`EstablishingPhase`)/`32-55` (`EstablishingPathConfig`)/`116-173` (centripetal Catmull-Rom)/`256-312`, `board-establishing-shots.ts:34`/`42-46`, `board-3d-camera-director.ts:47-49`/`56`/`154-184`/`274-342`, `camera-tours.ts:75-79`/`85-96`, `use-board-3d-camera.ts:43-46`/`62`, `board-intros.ts:47`, `BoardMap.tsx:146-152`/`189-200`, `ReportReelsPage.tsx:594-600`, `capture-3d-flythrough.mjs:27`/`124-133`/`144`/`200-216`/`220-221`/`228-244`/`252-265`/`261`, beat-signal-kilde verifisert PRD 14-eid: `BoardMap3D.tsx:45`-import fra `@/lib/stores/audio-tour-store` (`useCurrentTrack:192`/`useAudioTourPhase:188`, `reels-data.ts:339 buildCategoryTracks`), grep: 0 `reportTier` i `BoardMap3D`/`CameraCutOverlay`/`capture-3d-flythrough.mjs`, 0 `capture`-script i package.json), CARRY-OVER-MANIFEST-linjene (19-22/24-27/29-32/34-37/377-380/392-395) og `00-INDEX` (34/38/56/93 — PRD 10-dep-oppdatering 06,09→06,09,14 flagget). Ingen P0/P1/P2-tiers; ingen «Future Work»-seksjon (deferred under §6 med PRD-pekere); ingen render-gating spesifisert.
