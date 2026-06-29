# PRD 6 — 3D-kartmotor (Google `gmp-map-3d`)

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling.
> **Tier:** delt (motoren er ALLTID delt — nivå-uavhengig; render-laget gater ALDRI på `reportTier`. 3D/VO/kamera er ortogonale render-flagg uavhengig av nivå (to-nivå-modell, walkthrough 2026-06-27), ikke nivå-krav.)
> **PRD-nr:** 06 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-3d-motor`
> **Kontekst:** Lag-2-PRD. Eier den persistente 3D-kartmotoren (`gmp-map-3d` via `@vis.gl/react-google-maps`) + det screen-projiserte 2D-overlaget + reveal/blob-rendering + kamera-ADAPTER-grunnlaget (rene pose-/intent-primitiver) + dekomponeringen av `BoardMap3D`. Konsumerer typer fra PRD 1 og `BoardData` fra PRD 5. Konsumeres av PRD 9 (skall-komposisjon), PRD 10 (autorert flythrough), PRD 11 (realtime-blocks i overlay), PRD 13 (emit-sites). Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md`, `docs/rebuild/prod-schema-snapshot.txt` og faktisk kode (`map-view-3d.tsx`, `BoardMap.tsx`, `BoardMap3D.tsx`, `board-3d-camera-director.ts`, `use-board-3d-camera.ts`, `RevealLayer3D.tsx`, `project-latlng-to-screen.ts`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **3D-kartmotoren**: den tynne, persistente wrapperen rundt Google `gmp-map-3d` (`MapView3D`, `map-view-3d.tsx:621`) som rendrer Earth-tiles + SVG-baserte 3D-markører, sammen med det screen-projiserte 2D-overlaget (`projectLatLngToScreen`, `project-latlng-to-screen.ts:29`), reveal-/blob-kaskaden (`RevealLayer3D.tsx:104`), rute-laget (`route-layer-3d.tsx:73`), og de **rene kamera-primitivene** (intent-beslutning, pose-matematikk, fly-/orbit-imperativ) som nedstrøms-PRD-er bygger autorerte opplevelser på.

Motoren er rebuildens **render-bunn**: «del nedover stacken, diverger oppover i UX» betyr at motoren er identisk på alle nivåer (1/2) og alle profiler (bolig/næring). Tier-divergens lever ikke som en render-bryter — verifisert: ingen `reportTier`-referanse i `BoardMap3D`/`ReportReelsPage`/`map-view-3d`/`RevealLayer3D` (grep bekreftet tomt). 3D, VO og kamera er ortogonale render-flagg uavhengig av nivå (to-nivå-modell 2026-06-27), aldri lest av motoren.

Tre strukturelle grep definerer denne PRD-en:

1. **Persistent-mount er motorens bærende WebGL-invariant.** `gmp-map-3d` eksponerer ikke sitt WebGL-canvas → kan ikke `WEBGL_lose_context.loseContext()` slik Mapbox gjør i `map.remove()` (dokumentert `BoardMap.tsx:26-41`). Eneste lekk-frie strategi er å **ALDRI unmounte 3D-kartet** når det først er montert (`BoardMap.tsx:437` monterer `BoardMap3D` betinget på `has3dAddon` og river det aldri ned). Brudd → «Too many active WebGL contexts» og kaskade-crash. Dette er en AC, ikke en optimalisering (memory `project_3d_default_map_engine`).

2. **0 Mapbox i motorens hot path.** `map-view-3d.tsx` har i dag en `MapboxFallback`-gren (`map-view-3d.tsx:562-619`) som er den ENESTE `react-map-gl`-koblingen i selve motor-komponenten (`map-view-3d.tsx:13-14`). Den kuttes (CARRY-OVER linje 7 / 372-375). Den separate Mapbox-2D-toggle-flaten i `BoardMap.tsx` (`react-map-gl`, `BoardMap.tsx:4`/`451`) er et eget, åpent spørsmål (§10 Q2) — det er en ekte 2D-flate, ikke samme ting som det screen-projiserte DOM-overlaget.

3. **`BoardMap3D` dekomponeres (785 LOC → motor + hooks).** `BoardMap3D.tsx` (verifisert 785 linjer) binder i dag MapView3D + kamera-director + 4 URL-flagg-moduser + markersett-utvelgelse + reveal-kaskade + rute + popup i én fil. Port-with-rewrite: markersett-seleksjon og flythrough-orkestrering trekkes ut til rene hooks/funksjoner (de rene primitivene er allerede separate filer — `blob-pois.ts`, `board-3d-camera-director.ts`, `board-intro-flythrough.ts`).

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Persistent `gmp-map-3d`-motor (`MapView3D`) portet med WebGL-context-vern (aldri-unmount-invarianten) + `touch-action:none` + `useWebGLCheck`-probe-caching bevart; `MapboxFallback`-grenen kuttet (0 Mapbox i motor-hot-path). | MapView3D-port + WebGL-vern (Unit 1). |
| **G2** | Det screen-projiserte 2D-overlaget (`projectLatLngToScreen`) konsolidert som ÉN korrekt LIVE projeksjon; `BoardPOI3DMiniPopup` (eneste live konsument) bygger på den. (`Map3DActionButtons` er 0-konsument → reference-only, §10 Q4.) | Overlay-/projeksjons-konsolidering (Unit 2). |
| **G3** | 3D-markør-primitivene (Marker3D-pin, blob, prosjektpin) + `RevealLayer3D` portet med WebGL-churn-disiplin bevart (kvantisert scale, ALDRI opacity-animasjon, full-opacity-mount). | Markør-/reveal-port (Unit 3). |
| **G4** | De rene kamera-primitivene (`decideCameraIntent`, pose-matematikk, spredning→zoom, kategori-framing) portet verbatim med tester grønne. | Kamera-intent + pose-matematikk-port (Unit 4). |
| **G5** | Den imperative kamera-fasaden (`useBoard3DCamera`, token-kansellering, cut-overlay) + adapter-grunnlaget (flyTo/stop-primitiv) portet; `map-adapter`-fila dør med scroll-modalen, men flyTo/stop-mønsteret bevares som motorens cancel-fasade. | Kamera-fasade + adapter-grunnlag (Unit 5). |
| **G6** | Rute-laget (`route-layer-3d`, én langlevet polyline) portet med StrictMode-race-vern og lazy-load-grensen bevart. | Rute-lag-port (Unit 6). |
| **G7** | `BoardMap3D` dekomponert (markersett + flythrough-orkestrering ut i hooks/ren logikk); `PendingCamera`-typen re-hjemlet i motor-laget; `DEFAULT_CAMERA_LOCK` flyttet til motor-laget. | BoardMap3D-dekomponering + type-rehjemling (Unit 7). |
| **G8** | Motoren bevist å fungere mot prod (nystartet Chrome: ingen WebGL-context-feil over toggle/navigasjons-sykluser) + alle mekaniske porter grønne. | Verifikasjon + mekaniske porter (Unit 8). |

---

## 3. Arkitektur-/migrasjons-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *render-bunnen*. Motoren forker ALDRI per tier eller profil — den rendrer det `BoardData` (PRD 5) gir den. Tier-divergensen materialiserer seg aldri som en bryter i motoren (verifisert: 0 `reportTier`-ref i render-laget; CARRY-OVER patch #2 / `00-INDEX:85`).

> **NB — motoren er nødvendigvis klient-side; «RSC» i `00-INDEX:30` gjelder DATA, ikke motoren.** Motor-komponentene MÅ være klient-komponenter (`"use client"` i både `map-view-3d.tsx:1` og `BoardMap3D.tsx:1`, verifisert) fordi de driver WebGL/`gmp-map-3d`-custom-element, rAF-kamera-løkker og per-frame DOM-overlay (`translate3d`). Når `00-INDEX:30` beskriver PRD 6 som «RSC-render», refererer det til board-DATA-leveransen (RSC, ingen klient-XHR — CARRY-OVER linje 7), som eies av PRD 5 — IKKE til 3D-motoren selv. Arkitekturregelen «ALDRI useEffect for data-fetching → server components» gjelder data-henting, ikke motorens nødvendige klient-effekter (WebGL/rAF/overlay-tracking); disse er presentasjons-effekter, ikke data-fetching.

| Lag | Eierskap | Divergerer per tier? | Divergerer per profil? |
|-----|----------|----------------------|------------------------|
| Datamodell (`pois`, `projects.has_3d_addon`) | PRD 1 | Nei | Nei |
| Tier-manifest + validator | PRD 2 | Nei (beskriver, gater ikke) | Nei |
| Board-data-transform (`BoardData`) | PRD 5 | Nei | Nei |
| **3D-motor (`MapView3D`, overlay, reveal, kamera-primitiver)** | **Denne PRD-en** | **Nei** — identisk render på alle nivåer | **Nei** |
| Autorert flythrough-opplevelse (oval-spiral, `?film=1`) | PRD 10 | Nei (mekanisme delt) | Nei |
| Board-skall + nivå-2-overflate | PRD 9 | **Ja** (overflate) | Nei |

> **NB — `hasVoiceOver` er IKKE tier-gating.** `BoardMap3D:261` utleder `hasVoiceOver` fra om board-dataen har spillbar VO, og dette styrer BÅDE `autoOrbit` (true→drone-orbit; false→kameraet holder der introen landet) OG markersett (true→`topRankedPois.slice(0,3)`-ankersett, `BoardMap3D:279`; false→hele nabolaget `allPOIs`, `BoardMap3D:362`). Dette er datadrevet seleksjon på board-data-innhold (en VO finnes / finnes ikke), ikke en lesning av `reportTier`. VO er et ortogonalt render-flagg (to-nivå-modell 2026-06-27): `hasVoiceOver` speiler `pickPlayableAudio`-SELEKSJONEN (PRD 5) på datainnhold, ikke nivå.

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer fra 3D-motoren |
|---------------|-----------------------------------|
| `prd-board-skall-ui` (9) | `MapView3D`-komponenten + persistent-mount-orkestrering (komponerer den i skallet, wrapper i `dynamic()`), `Map3DInstance`-typen, `RevealLayer3D`, markør-primitivene. `00-INDEX:55`: PRD 9 ←06. |
| `prd-kamera-flythrough` (10) | De rene pose-/intent-primitivene (`introPoseAt`, `establishingPoseAt`, `decideCameraIntent`) + `useBoard3DCamera`-fasaden + `CameraWaypointAuthor`. Bygger autorert oval-spiral-tour + `?film=1`-produkt PÅ disse. `00-INDEX:56`: PRD 10 ←06,09,14. |
| `prd-realtime-transport` (11) | Det screen-projiserte 2D-overlaget (`projectLatLngToScreen`) som realtime-blocks tegnes i (`BoardPOI3DMiniPopup` trekker realtime-data i dag). `00-INDEX:56`: PRD 11 ←01,09. |
| `prd-instrumentering` (13) | Emit-site-flatene på kamera-/interaksjons-hendelser (markør-klikk, kamera-intent-bytter) som payload inn i `events`-tabellen. `00-INDEX:57`: emit-sites wires med board-PRD-ene. |

### Migrasjons-kontekst (port-with-rewrite, ingen DB)

Denne PRD-en rører IKKE skjema (ingen migrasjon). Den er en kode-port: keeper-core-filer portes nær-verbatim, port-with-rewrite-filer omstruktureres (kutt `MapboxFallback`, kutt `mapboxAdapter`-død-gren, dekomponer `BoardMap3D`, re-hjemle `PendingCamera`/`DEFAULT_CAMERA_LOCK`). De fire UNTRACKED-filene (`board-establishing-flythrough.ts`/`.test.ts`, `board-establishing-shots.ts`, `blob-pois.test.ts`) er ekte working-tree-kode men ikke committet ennå — de behandles som keeper men noteres som ikke-i-historikk (jf. §9 Beslutning 9).

---

## 4. Eksisterende kodebase

### Bæres over — keeper-core (port nær-verbatim)

| Fil (@/-sti) | Rolle | Verifisert linje-ref |
|--------------|-------|----------------------|
| `components/map/RevealLayer3D.tsx` | Sekvensiell reveal av blob+pin på velkommen/oppsummering; kvantisert scale + memo, rAF stopper ved settling, ALDRI opacity-animasjon | `RevealLayer3D:104`, `RevealItem:31`, `START_DELAY_MS=900:35`, `REVEAL_WINDOW_MS=4200:39`, `PIN_SIZE=40:51`, kvantisering `Math.round(raw*100)/100` (verifisert mønster `:134-135`) |
| `components/variants/report/board/board-3d-camera-director.ts` | Ren synkron camera-intent-beslutning + alle kamera-konstanter + spredning→zoom + kategori-framing | `decideCameraIntent:274`, `ORBIT_RANGE=650:25`, `DERIVE_RANGE_MIN=810:147`, `deriveCategoryCamera:154`, `computeSpreadRadiusM:88`, `orbitRangeForSpread:107`, `autoOrbit===false→free:322` |
| `components/variants/report/board/use-board-3d-camera.ts` | Imperativ kamera-director-hook; token-kansellering (siste-vinner), driver cut-overlay | `useBoard3DCamera:62` (manifest-verifisert), token-pattern (CARRY-OVER 34-37) |
| `components/variants/report/board/board-intro-flythrough.ts` | Oval-spiral intro-primitiv (`runIntroFlythrough`, `introPoseAt` center=target), trapes-easing | `runIntroFlythrough:174`, `introPoseAt:148`, `WELCOME_INTRO_SETTLE_MS=1200` (manifest 19-22) |
| `components/variants/report/board/board-establishing-flythrough.ts` | Multi-waypoint Catmull-Rom-flyover; rene `buildDensePath`/`poseAt` (UNTRACKED) | `runEstablishingFlythrough:256`, `establishingPoseAt:243`, `centripetalPoint(alpha=0.5):119`, `SAMPLES_PER_SEGMENT=48:146` |
| `components/variants/report/board/blob-pois.ts` | Rene selektorer for reveal-markører (`selectBlobPOIs` nærhet-ikke-score, `selectFlyoverBlobs` fly-over-orden) | `selectBlobPOIs:20`, `FlyoverBlob:54`, `selectFlyoverBlobs:73` |
| `components/map/project-latlng-to-screen.ts` | KORREKT perspektiv-projeksjon lat/lng/alt → skjerm (FOV-basert); eneste 2D-DOM-overlay-primitiv | `projectLatLngToScreen:29`, `FOV_Y_RAD=35°:17`, `Map3DCameraLike:21`, return null bak kamera `:64` |
| `components/map/Marker3DPin.tsx` | SVG legend-pin (Google 3D rasteriserer kun SVG/Pin/img); ratio 0.50; gjenbrukt av MapView3D + RevealLayer3D | `Marker3DPinProps:19` |
| `components/map/BlobMarker3D.tsx` | Billigste SVG-blob (skalerer radius, ikke ramme); re-raster-lett bounce | `BlobMarker3DProps:18` |
| `components/map/ProjectSitePin.tsx` | Stor label-chip over prosjekt-tomten (alltid synlig, range-debounced skala) | konsumert av MapView3D `projectSite`-gren `:517` |
| `components/variants/report/board/BoardPathLayer.tsx` | 2D polylinje-render-primitiv (rute tegnet over screen-projisert overlay); render-makker til 3D `RouteLayer3D`. PRD 6 eier polylinje-RENDER-primitivene (2D+3D); PRD 11 eier datalaget (`useRouteData`). (Ratifisert kontroll-runde 2026-06-27, K3.) | `BoardPathLayer:19` (`BoardPathLayer.tsx`, 99 LOC) |
| `components/variants/report/board/CameraWaypointAuthor.tsx` | Dev-only authoring (`?author=1`), `readPose` kopierer lat/lng eksplisitt | `CameraWaypointAuthor:61`, `readPose:35`; rendres bak `?author=1` i BoardMap3D |
| `components/variants/report/board/use-board-3d-camera.test.ts` | Spec for kamera-intent/cut-deteksjon — skal fortsatt passere | (port-mål) |
| `components/variants/report/board/blob-pois.test.ts` | Spec for blob/flyover-seleksjon (UNTRACKED) | (port-mål) |
| `components/variants/report/board/board-establishing-flythrough.test.ts` | Spec for Catmull-Rom/buelengde-pose (UNTRACKED) | (port-mål) |

### Bæres over — port-with-rewrite (omstrukturer ved port)

| Fil (@/-sti) | Rewrite-handling | Verifisert linje-ref |
|--------------|------------------|----------------------|
| `components/map/map-view-3d.tsx` | **Kutt `MapboxFallback`-grenen + `react-map-gl`/`mapbox-gl.css`-import** (eneste Mapbox-kobling i motoren) **+ fjern orbit-hijack-`useEffect`-en** (no-op i board fordi `if (freeMode) return;` `:356`, og boardet kjører alltid `freeMode`; CARRY-OVER «dropp orbit-hijack»). Behold `freeMode`-grenen (boardet bruker den), `touch-action:none`, marker-rendering, `MapReadyBridge`. Behold `useWebGLCheck`-grenen MEN gi `!isAvailable` et ikke-Mapbox-target (§10 Q2, lukket i Unit 1 AC2). | `MapView3D:621`, `MapboxFallback:562-619` (fn slutter `:619`), `import react-map-gl/mapbox+css:13-14`, `freeMode:323`, orbit-hijack-`useEffect:354-471` (no-op via `:356`), `touch-none:480`/`touchAction:none:499`, `gestureHandling:498`, `!isAvailable`-fallback-blokk `:623-633` |
| `components/variants/report/board/BoardMap3D.tsx` | **Dekomponer (785 LOC).** Trekk markersett-seleksjon + flythrough-orkestrering ut til hooks/ren logikk. Re-hjemle `PendingCamera`-import. Behold render-nivå-pin-drop for `?film=1`/`?fly=1`/establishing. | `BoardMap3D:125` (manifest), 785 LOC (wc -l verifisert), `import PendingCamera:47`, `?film/markerPOIs→[]:337`, `hasVoiceOver:261`, `overviewPOIs topRankedPois.slice(0,3):278-279`, `useBoard3DCamera-kall` (manifest 525-541), `RouteLayer3D dynamic:51-54`, `CameraWaypointAuthor import:13` |
| `components/variants/report/board/BoardPOI3DMiniPopup.tsx` | Den FAKTISKE screen-projiserte DOM-popupen over `gmp-map-3d`; per-frame `translate3d` direkte til DOM. `@ts-nocheck` → typ den. Trekker realtime-data (PRD 11-grense beholdes). | eneste konsument av `projectLatLngToScreen` (grep verifisert) |
| `components/map/route-layer-3d.tsx` | Én langlevet `Polyline3DElement` (muter path, ikke remount). Behold StrictMode-cancelled-flagg + lazy-load-grensen. | `RouteLayer3D:73`, én polyline `:86-142`, `importLibrary(maps3d):101` |
| `components/map/Map3DFallback.tsx` | **Port `useWebGLCheck`-hooken** (modul-cachet probe — probe=én WebGL-kontekst, ~16 maks). **Slett `Map3DFallback`-komponenten** (`@ts-nocheck`, 0 importere → død). | `useWebGLCheck:75`, `isWebGLAvailable:54`, `Map3DFallback-komponent:16` (død) |
| `components/variants/report/board/BoardMap.tsx` | **Bærer persistent-mount-invarianten** (`BoardMap3D` montert betinget på `has3dAddon`, aldri unmountet). Eierskaps-grense §10 Q1: PRD 6 eier mount-INVARIANTEN; PRD 9 eier skall-komposisjonen. Mapbox-2D-toggle-flaten (§10 Q2). | `never-unmount-doc:26-41`, `has3dAddon`-mount-gren `:437`, `showMapbox=!has3dAddon\|\|view===2d:203`, `map.remove():416`, `react-map-gl:4`, `pointer-events-skjold:520` |
| `components/variants/report/blocks/report-3d-config.ts` | **Flytt `DEFAULT_CAMERA_LOCK` til motor-laget** (delt av board + scroll-rapportens blocks). `MAP3D_TAB_IDS`/`filterPoisByTab` er scroll-rester → reference-only/dør med scroll-rapporten. | `DEFAULT_CAMERA_LOCK:19` (range=900/tilt=45/minAlt=150/maxAlt=2000/panHalfSideKm=4.5), importert av BoardMap3D (`:7`), ReportOverviewMap (`:10`) OG ReportThemeSection (`:29`, montert via ReportPage) — alle tre grep-verifisert |
| `lib/map/map-adapter.ts` | **Port `google3dAdapter` flyTo/stop-MØNSTERET** som motorens cancel/flyTo-fasade-konsept; **kutt `mapboxAdapter`-død-gren**. Fila selv dør med scroll-modalen (kun konsument `UnifiedMapModal` + egen test, grep verifisert). | `google3dAdapter:65`, `mapboxAdapter:50` (død), `flyTo bevarer tilt/heading/range:73-91`, `stopCameraAnimation feature-detect:67-72` |
| `components/variants/report/board/board-establishing-shots.ts` | Per-strøk rute-data (`ESTABLISHING_SHOTS`, hardkodet TS-record, UNTRACKED). PRD 6 eier `getEstablishingShot`-MEKANISMEN; DATAEN (`ESTABLISHING_SHOTS`) hjemles i **PRD 9** (board-skall, samme eier som `camera-tours`-data; korrigert kontroll-runde 2026-06-27, K6/§10 Q6). | `getEstablishingShot:42`, `ESTABLISHING_SHOTS:13`, `bloomAtProgress=0.02:34` |
| `components/variants/report/board/board-intros.ts` | Per-prosjekt board-intro-flythrough-overrides (`BOARD_INTROS`, hardkodet TS-record). PRD 6 eier `getBoardIntro`-MEKANISMEN + flythrough-typene; DATAEN (`BOARD_INTROS`) hjemles i **PRD 9** (samme eier som establishing/camera-tours-data; kontroll-runde 2026-06-27, K6/§10 Q6). | `getBoardIntro:47`, `BOARD_INTROS:20` (konsumert av `BoardMap3D:27`/`:560`) |
| `components/variants/report/board/camera-tours.ts` | Per-prosjekt autorert kategori-kamera-DATA. PRD 6 eier MEKANISMEN (`getCategoryCamera`/`deriveCategoryCamera`-fallback); DATAEN hjemles i PRD 9 per kanonisk indeks (§10 Q3). | `getCategoryCamera:85` (import BoardMap3D `:25`), konsumert av BoardMap3D `:510` |

### Slettes / forlates (reference-only / dead)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `components/map/UnifiedMapModal.tsx` | reference-only | 2D/3D-toggle for SCROLL-rapporten (ikke boardet). Eneste konsument av `map-adapter` + `use-interaction-controller`. `PendingCamera`-typen MÅ re-hjemles (Unit 7) før denne forlates. |
| `lib/map/use-interaction-controller.ts` | reference-only | Camera-fly-controller for scroll-modalen; boardet bruker `use-board-3d-camera` i stedet (grep: kun importert av UnifiedMapModal). |
| `MapboxFallback`-grenen i `map-view-3d.tsx` | dead (kuttes) | Eneste `react-map-gl`-kobling i motoren; 0 Mapbox i hot path (CARRY-OVER 7). |
| `mapboxAdapter` i `map-adapter.ts` | dead (kuttes) | Dør med Mapbox; ingen board-konsument. |
| `Map3DFallback`-KOMPONENTEN i `Map3DFallback.tsx` | dead (slettes) | `@ts-nocheck`, 0 importere. Kun `useWebGLCheck`-hooken beholdes. |
| `components/map/Map3DActionButtons.tsx` | reference-only (0-konsument) | Headerkommentar `:1` «3D component preserved for future use»; `@ts-nocheck`. Grep finner INGEN JSX-mount i board/reels — kun KOMMENTAR-referanser i `BoardPOI3DMiniPopup.tsx:1`/`:24` («samme tilnærming som Map3DActionButtons»). Travel-time-knapp-overlayet er den unike verdien, men komponenten rendres ikke i dag → projeksjons-konsolidering (Unit 2) gjelder KUN `BoardPOI3DMiniPopup`. Hvis en live mount senere oppstår: re-vurder mot `projectLatLngToScreen`. |

---

## 5. Datakontrakt (felt PRD-en eier / konsumerer)

### 5.1 Konsumeres fra PRD 1 (`@/lib/types`, re-derived fra baseline)

| Symbol | Rolle i motoren | Kilde |
|--------|-----------------|-------|
| `POI` (`coordinates`, `category`, `id`, `name`) | Markør-rendering, projeksjon, blob-seleksjon | `lib/types.ts` (POI-typen, PRD 1 §Datakontrakt) |
| `Coordinates` (`{lat,lng}`) | Kamera-senter + route-origin | PRD 1 |
| `Category` (`{color,icon,id}`) | Marker3D-pin-styling | PRD 1 |
| `CameraPose` + `CategoryCameraConfig` | Kamera-waypoints (`CameraWaypointAuthor`, kategori-kamera) | `lib/types.ts` (PRD 1 §Datakontrakt) |
| `pois.entur_stopplace_id`/`bysykkel_station_id`/`hyre_station_id` | Realtime-popup-kobling (overlay; PRD 11-grense) | PRD 1 / snapshot |
| `projects.has_3d_addon` (boolean NOT NULL) | Gater 2D/3D-toggle i `BoardMap` (`has3dAddon`-prop) — IKKE render-bryter | prod-schema-snapshot (PRD 1, snapshot:184) |

### 5.2 Konsumeres fra PRD 5 (`BoardData`)

| Felt | Rolle i motoren | Kilde |
|------|-----------------|-------|
| `home.coordinates` | Kamera-senter + route-origin | `board-data.ts` (PRD 5) |
| `categories[].topRankedPois` (SCORE-rangert) | `overviewPOIs.slice(0,3)`-ankersett ved VO (`BoardMap3D:278-279`) — MÅ holdes atskilt fra distanse-sortert `pois` | PRD 5 (`board-data.ts:101-104`) |
| `categories[].pois` (distanse-sortert) | Legend/blob/allPOIs | PRD 5 |
| `categories[].audio`/`reelsAudio` + `welcome`/`home.audio`/`outro` | `hasVoiceOver`-signal (`BoardMap3D:261`) → `autoOrbit` + markersett | PRD 5 (`pickPlayableAudio`-seleksjon) |
| `projectSlug` | Oppslag i `board-establishing-shots`/`camera-tours` | PRD 5 |
| `assets` (projectSite-thumbnail) | `ProjectSitePin` | PRD 5 |
| board-state-hooks (`useActiveCategory`/`useActivePOI`, `state.phase`, `introPlaying`, `subFilter.hiddenIds`) | Markersett-seleksjon + popup-styring | PRD 5 (`board-state.tsx`) |

### 5.3 Eies av denne PRD-en (motor-interne typer/konstanter)

| Symbol | Eierskap | Note |
|--------|----------|------|
| `Map3DInstance` (`= google.maps.maps3d.Map3DElement`) | PRD 6 | `map-view-3d.tsx:25` — løftes via `MapReadyBridge` |
| `CameraLock` / `MapView3DProps` | PRD 6 | `map-view-3d.tsx:36`/`56` |
| `DEFAULT_CAMERA_LOCK` | PRD 6 (flyttet fra `report-3d-config.ts`) | range=900/tilt=45/minAlt=150/maxAlt=2000/panHalfSideKm=4.5 (`report-3d-config.ts:19`) |
| `PendingCamera` (re-hjemlet) | PRD 6 (motor-types-fil) | Flyttes fra `UnifiedMapModal` så board-porten ikke drar inn død scroll-modal |
| Alle kamera-konstanter (`ORBIT_*`/`POI_*`/`SUMMARY_*`/`CUT_*`/`DERIVE_*`) | PRD 6 | `board-3d-camera-director.ts:25-58`/`147` |
| Pose-/intent-primitiver (`decideCameraIntent`, `introPoseAt`, `establishingPoseAt`, `poseAt`, `buildDensePath`) | PRD 6 | konsumeres av PRD 10 |

> **VO-«speiling»-kontrakt:** Motoren produserer ingen tier-signaler. `hasVoiceOver` er en lesning av board-data-INNHOLD (spillbart VO finnes), identisk med PRD 5s `pickPlayableAudio`-seleksjon — et ortogonalt render-flagg, ikke en nivå-lesning (to-nivå-modell 2026-06-27). Ingen lag leser `reportTier` i render. (Den fulle opprydningen av de gamle VO-koordineringsreferansene på tvers av PRD 2/5/6 tas i den helhetlige auditen.)

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. `MapView3D` persistent `gmp-map-3d`-motor + WebGL-context-vern (aldri-unmount-invariant) + `touch-action:none` + `useWebGLCheck`-probe-caching; kutt `MapboxFallback`.
2. Screen-projisert 2D-overlay (`projectLatLngToScreen` + `BoardPOI3DMiniPopup` — eneste live konsument). `Map3DActionButtons` er 0-konsument → reference-only (§10 Q4).
3. 3D-markør-primitiver (`Marker3DPin`, `BlobMarker3D`, `ProjectSitePin`) + `RevealLayer3D` reveal/blob-rendering + `blob-pois`-selektorer.
4. Rene kamera-primitiver (`decideCameraIntent`, pose-matematikk i intro-/establishing-flythrough, spredning→zoom, kategori-framing) + `CameraWaypointAuthor`.
5. Imperativ kamera-fasade (`useBoard3DCamera`, token-kansellering, cut-overlay) + adapter-grunnlag (flyTo/stop-mønster fra `google3dAdapter`).
6. Rute-laget (`route-layer-3d`, én langlevet polyline) med StrictMode-vern + lazy-load-grense.
7. Dekomponering av `BoardMap3D` (785 LOC) + re-hjemling av `PendingCamera` + flytting av `DEFAULT_CAMERA_LOCK` til motor-laget.
8. Persistent-mount-INVARIANTEN (det WebGL-vernet som fysisk bor i `BoardMap.tsx`).

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Den AUTORERTE oval-spiral-flythrough-OPPLEVELSEN + `?film=1`-produktet + film-modus-choreografi (motoren eier `runIntroFlythrough`-PRIMITIVET + pose-matematikken; ikke produktet) | **PRD 10 (prd-kamera-flythrough)** |
| `camera-tours.ts`-DATAEN (per-prosjekt autorerte waypoints); motoren eier `getCategoryCamera`-MEKANISMEN + `deriveCategoryCamera`-fallback | **PRD 9 (prd-board-skall-ui)** — kanonisk eier per `00-INDEX:33`/`:95` + PRD 3:138/170. PRD 10 er KONSUMENT av mekanismen (autorert tour bygger på den). |
| Board-skall-KOMPOSISJON + `dynamic()`-wrapping av `MapView3D`/`RouteLayer3D` + `BoardMapControls` (Auto/Fri/Kart/3D) | **PRD 9 (prd-board-skall-ui)** |
| `board-establishing-shots`/`board-intros`-DATA (`ESTABLISHING_SHOTS` + `BOARD_INTROS`) flyttet fra hardkodet TS-record til DB/JSON; motoren eier `getEstablishingShot`/`getBoardIntro`-MEKANISMEN | **PRD 9 (prd-board-skall-ui)** — samme eier som `camera-tours`-DATAEN (autorert kamera-data hører hos board-skallet, kanonisk indeks `00-INDEX:33`/`:95`). Korrigert kontroll-runde 2026-06-27 (tidligere uverifisert PRD 5-peker overstyrt, se §10 Q6). |
| Board-data-transform + state (`adaptBoardData`, reducer) | **PRD 5 (prd-board-data-state)** |
| Realtime-transport-blocks som tegnes i overlaget (Entur/bysykkel/hyre + realtime-hooks) | **PRD 11 (prd-realtime-transport)** |
| Audio-tour/reels-pipeline (VO-spor, reels-video) | **PRD 14 (prd-audio-tour-reels)** |
| Server-action emit-logging mot `events` (motoren eksponerer kun emit-site-flatene) | **PRD 13 (prd-instrumentering)** |

**Eksplisitt ikke-scope (patch #2):** render-gating på `reportTier`. Ingen unit bygger en tier-render-bryter (verifisert: 0 `reportTier`-ref i render-laget). Tier-krav fanges av PRD 2s validator.

**Eksplisitt ikke-scope (mikromobilitet, Andreas-beslutning kontroll-runde 2026-06-27, K5):** PRD 6 bygger IKKE en board-markør-primitiv for ledige sykler/scootere — per-POI tekst-status (`POIRealtimeSection`) holder. Legacy `ReportThemeMap.tsx:343` rendrer prikker, men det er legacy 2D-rapport, ikke board → utenfor denne PRD-ens scope.

---

## 7. Implementation Units (8 av 8 dekket)

### Unit 1 — `MapView3D`-port + WebGL-context-vern (kutt Mapbox)
- **Mål (→ G1):** Port den persistente `gmp-map-3d`-motoren med aldri-unmount-invarianten, `touch-action:none` og probe-cachet `useWebGLCheck`; kutt `MapboxFallback`-grenen (0 Mapbox i hot path).
- **Filer:** `@/components/map/map-view-3d.tsx` (port + kutt Mapbox), `@/components/map/Map3DFallback.tsx` (behold `useWebGLCheck`, slett `Map3DFallback`-komponenten), persistent-mount-vernet i `@/components/variants/report/board/BoardMap.tsx` (invariant-delen).
- **Akseptansekriterier:**
  1. `MapboxFallback`-grenen (`map-view-3d.tsx:562-619`) + `import react-map-gl/mapbox` + `import mapbox-gl/dist/mapbox-gl.css` (`:13-14`) er FJERNET fra motor-fila. `grep "react-map-gl"` på `map-view-3d.tsx` returnerer tomt.
  2. **Ny `!isAvailable`-gren (Q2-avgjørelse, lukkes i denne unit):** Dagens `MapView3D`-funksjon (`:621`) har KUN én no-WebGL-utgang — `if (!isAvailable) return <MapboxFallback .../>` (`map-view-3d.tsx:623-633`, verifisert). Når `MapboxFallback` kuttes (AC1) MÅ `!isAvailable`-grenen få et nytt, ikke-Mapbox-target, ellers returnerer `MapView3D` udefinert/krasjer. Ny gren: en statisk «3D-kart er ikke tilgjengelig i denne nettleseren»-tekst-tilstand (samme klasse som dagens manglende-API-nøkkel-gren `:635-639`), evt. en screen-projisert-DOM-only-modus uten tiles. `react-map-gl` skal IKKE være target. Q2 (§10) er dermed besvart innenfor denne unit, ikke et sidestilt åpent spørsmål.
  3. `freeMode`-grenen (`:323`) bevart (boardet bruker den; den dropper camera-locks `:329-334` og skipper orbit-hijack `:356`).
  4. **Orbit-hijack-blokken FJERNET:** Hele orbit-hijack-`useEffect`-en (`map-view-3d.tsx:354-471` — `forceOrbitGesture`/`ctrlKey`-spoof, `blockZoomWheel`, `blockDblClick*`, `containerRef`-listeners) er no-op i board (`if (freeMode) return;` `:356`, og boardet kjører alltid `freeMode`). Per CARRY-OVER-direktivet (linje ~373: «dropp orbit-hijack») fjernes blokken ved port siden boardet kun bruker `freeMode`. `containerRef` beholdes kun for `touch-action`-containeren (AC5). Ingen ikke-`freeMode`-konsument finnes (verifisert: boardet er eneste konsument) → blokken er udokumentert dødkode og slettes (CLAUDE.md «ALDRI la dead code ligge»).
  5. `touch-action:none` satt på container (`className="...touch-none"` `:480` + `style touchAction:"none"` `:499`) — uten det fanger nettleseren touch som scroll på mobil.
  6. `useWebGLCheck` portet fra `Map3DFallback.tsx:75` med modul-cachet probe (`isWebGLAvailable:54`, probe = én WebGL-kontekst, ~16 maks) — caching MÅ bevares. `Map3DFallback`-komponenten (`:16`, `@ts-nocheck`, 0 importere) slettet.
  7. **Persistent-mount-invariant:** Det dokumenterte never-unmount-vernet (`BoardMap.tsx:26-41`) er bevart — `gmp-map-3d` montert betinget på `has3dAddon` (`:437`) og rives ALDRI ned (verifiseres i Unit 8 i nystartet Chrome).
  8. `npx tsc --noEmit` 0 feil på motor-fila (uten `@ts-nocheck`).
- **Avhengigheter:** PRD 1 (typer), PRD 5 (`BoardData`-form for marker-props).

### Unit 2 — Screen-projisert 2D-overlay + projeksjons-konsolidering
- **Mål (→ G2):** Etabler ÉN korrekt screen-projeksjon (`projectLatLngToScreen`) som DOM-overlay-primitiv og fjern den grovere duplikaten.
- **Filer:** `@/components/map/project-latlng-to-screen.ts` (port verbatim), `@/components/variants/report/board/BoardPOI3DMiniPopup.tsx` (port, typ vekk `@ts-nocheck`). (`Map3DActionButtons.tsx` er 0-konsument → reference-only, ikke i denne unit; se §4 dead-tabell + §10 Q4.)
- **Akseptansekriterier:**
  1. `projectLatLngToScreen` portet verbatim (`:29`, FOV-basert, `FOV_Y_RAD=35°:17`, return null bak kamera `:64`).
  2. `BoardPOI3DMiniPopup` skriver per-frame `translate3d` direkte til DOM (ikke `setState`) for jevn tracking — bevart. Realtime-data-koblingen (PRD 11-grense) beholdes uendret. Den er eneste LIVE konsument av `projectLatLngToScreen` (grep-verifisert mount `BoardMap3D.tsx:774`).
  3. Resultat: ÉN live projeksjons-implementasjon i motoren (`projectLatLngToScreen` via `BoardPOI3DMiniPopup`). `Map3DActionButtons` sin grovere `calculateScreenPosition`-near-top-down-approks (`:27`) konsolideres IKKE her — komponenten er reference-only/0-konsument (§10 Q4); hvis den senere mountes, byttes projeksjonen til `projectLatLngToScreen` da.
  4. `@ts-nocheck` fjernet fra minst `BoardPOI3DMiniPopup` (typet mot `Map3DInstance`).
- **Avhengigheter:** Unit 1 (`Map3DInstance`-typen).

### Unit 3 — Markør-primitiver + `RevealLayer3D` (WebGL-churn-disiplin)
- **Mål (→ G3):** Port SVG-markør-primitivene + reveal-/blob-kaskaden med full-opacity-mount og kvantisert scale (aldri opacity-animasjon).
- **Filer:** `@/components/map/Marker3DPin.tsx`, `@/components/map/BlobMarker3D.tsx`, `@/components/map/ProjectSitePin.tsx`, `@/components/map/RevealLayer3D.tsx`, `@/components/variants/report/board/blob-pois.ts` (alle port verbatim).
- **Akseptansekriterier:**
  1. `RevealLayer3D` (`:104`) animerer KUN scale (kvantisert `Math.round(raw*100)/100`, verifisert `:134-135`-mønster), ALDRI opacity (opacity-reveal eksploderte WebGL — CARRY-OVER 44-47). Markører monteres full opacity.
  2. rAF stoppes når siste markør har settlet (manifest `:148-150`); begge moduser (indeks-stagger + positional via `at`) bevart (`RevealItem:31`, `REVEAL_WINDOW_MS=4200:39`, `START_DELAY_MS=900:35`).
  3. `Marker3DPin` rendrer SVG (Google 3D rasteriserer kun SVG/Pin/img), ratio 0.50; `BlobMarker3D` skalerer radius ikke ramme; `PIN_SIZE=40` matcher `Marker3DItem` (`:51`).
  4. `selectBlobPOIs` (`:20`) sorterer på NÆRHET (ikke score); `selectFlyoverBlobs` (`:73`) gir fly-over-orden via `at`; `excludeIds` unngår blob oppå legend-pin; dedup på POI-id.
  5. `blob-pois.test.ts` passerer.
- **Avhengigheter:** Unit 1.

### Unit 4 — Kamera-intent + pose-matematikk (rene primitiver)
- **Mål (→ G4):** Port den rene, enhetstestbare camera-intent-beslutningen + pose-matematikken (intro oval-spiral + establishing Catmull-Rom) + spredning→zoom + kategori-framing.
- **Filer:** `@/components/variants/report/board/board-3d-camera-director.ts`, `board-intro-flythrough.ts`, `board-establishing-flythrough.ts`, `board-establishing-shots.ts` (alle port; sistnevnte mekanisme port, data deferred), tester `use-board-3d-camera.test.ts` + `board-establishing-flythrough.test.ts`.
- **Akseptansekriterier:**
  1. `decideCameraIntent` (`:274`) bevarer prioritetskjeden intro>free>poi>cinematic>orbit; cut-deteksjon avhenger fortsatt av `prevIntent` (`const prev = input.prevIntent` på `:305` og `:330` — feil prevIntent → cream-flash); `autoOrbit===false → free` (`:322`).
  2. Alle kamera-konstanter portet verbatim: `ORBIT_RANGE=650:25`, `DERIVE_RANGE_MIN=810:147`, `POI_RANGE`/`SUMMARY_RANGE`/`CUT_FADE_MS=550` (manifest 29-37). `CUT_FADE_MS` er eneste sannhetskilde (CameraCutOverlay leser samme).
  3. `introPoseAt` holder center=target hele filmen (`:148`); trapes-ease (konstant midt-fart); `isPaused` fryser uten å akkumulere tid.
  4. `establishingPoseAt`/`poseAt`: centripetal Catmull-Rom `alpha=0.5` (`:119`) + buelengde-resampling `SAMPLES_PER_SEGMENT=48` (`:146`) → konstant bakke-fart.
  5. `deriveCategoryCamera` (`:154`) + `computeSpreadRadiusM` (`:88`) + `orbitRangeForSpread` (`:107`) portet.
  6. `use-board-3d-camera.test.ts` + `board-establishing-flythrough.test.ts` passerer.
- **Avhengigheter:** Unit 1.

### Unit 5 — Imperativ kamera-fasade + adapter-grunnlag
- **Mål (→ G5):** Port den imperative kamera-director-hooken (token-kansellering, cut-overlay) og bevar `google3dAdapter` flyTo/stop-MØNSTERET som motorens cancel-fasade; kutt `mapboxAdapter`.
- **Filer:** `@/components/variants/report/board/use-board-3d-camera.ts` (port), `@/lib/map/map-adapter.ts` (port flyTo/stop-mønster, kutt mapboxAdapter; fila for øvrig reference-only og dør med scroll-modalen).
- **Akseptansekriterier:**
  1. `useBoard3DCamera` (`:62`) bevarer token-kansellering (siste-vinner) som den egentlige cancel-garden — `stopCameraAnimation` er IKKE pålitelig på rå `Map3DElement` (verifisert `map-adapter.ts:67-72` feature-detection + CARRY-OVER 34-37).
  2. `cutVisible`/cut-overlay driftes av `useBoard3DCamera`; `CameraCutOverlay`-KOMPONENTEN (`components/variants/report/board/CameraCutOverlay.tsx`, bundet til `useBoard3DCamera` + `CUT_FADE_MS`, null andre konsumenter) eies av PRD 6; BRUKEN eies av PRD 10 (ratifisert kontroll-runde 2026-06-27, K1). `CUT_FADE_MS` er felles sannhetskilde med Unit 4.
  3. `google3dAdapter.flyTo` bevarer tilt/heading/range (`map-adapter.ts:73-91`); `mapboxAdapter`-grenen (`:50`) er FJERNET.
  4. `map-adapter.ts` har INGEN board-konsument etter porten (boardets cancel/flyTo går via `useBoard3DCamera`); `UnifiedMapModal` + `use-interaction-controller` forblir reference-only og forlates med scroll-modalen.
- **Avhengigheter:** Unit 4 (kamera-intent + konstanter).

### Unit 6 — Rute-lag (én langlevet polyline + lazy-load-grense)
- **Mål (→ G6):** Port `route-layer-3d` med GPU-buffer-lekk-vernet (muter path, ikke remount) + StrictMode-race-plasteret + lazy-load-grensen.
- **Filer:** `@/components/map/route-layer-3d.tsx` (port).
- **Akseptansekriterier:**
  1. Én langlevet `Polyline3DElement`-instans per map3d; path MUTERES (ikke remount) → ingen GPU-buffer-leak (`route-layer-3d.tsx:86-142`).
  2. StrictMode-`cancelled`-flagg + 3 cleanup-effekter bevart (`:89`/`:105`/`:147-152`); `importLibrary(maps3d)` bevart (`:101`).
  3. Gangtid-badge via `Marker3DInteractiveElement` (inline SVG `buildBadgeSVG`) bevart.
  4. Rute-laget forblir bak `dynamic()`-lazy-grense (faktisk wrapping eies av skall-komposisjonen; motoren eksponerer komponenten lazy-bar) — tunge Google Maps-imports holdes ute av 2D-bundlen.
- **Avhengigheter:** Unit 1 (`Map3DInstance`).

### Unit 7 — `BoardMap3D`-dekomponering + type-rehjemling
- **Mål (→ G7):** Dekomponer 785-LOC-orkestratoren; trekk markersett-seleksjon + flythrough-orkestrering ut til hooks/ren logikk; re-hjemle `PendingCamera`; flytt `DEFAULT_CAMERA_LOCK` til motor-laget.
- **Filer:** `@/components/variants/report/board/BoardMap3D.tsx` (dekomponer), nye hook-/logikk-filer (f.eks. `use-board-marker-set.ts`, `board-flythrough-orchestrator.ts`), motor-types-fil for `PendingCamera`, `@/components/variants/report/blocks/report-3d-config.ts` (flytt `DEFAULT_CAMERA_LOCK` ut).
- **Akseptansekriterier:**
  1. Markersett-seleksjonen (`overviewPOIs`/`markerPOIs`/`legendPOIs`, `BoardMap3D:276-403`) trukket ut til ren/hook-logikk; render-nivå-pin-drop for `?film=1`/`?fly=1`/establishing (`markerPOIs→[]`, `:337`) bevart — pins MÅ ikke fjernes via DOM utenfra (removeChild-race).
  2. Flythrough-orkestreringen (`runIntroFlythrough`/`runEstablishingFlythrough`/outro-effektene, manifest `:567-696`) trukket ut; de tre intro-eierne (`flyMode||isWelcomeBeat||basicIntroActive`) AND-et bort av `establishingMode` (`:216-217`) bevart.
  3. `hasVoiceOver` (`:261`) styrer fortsatt BÅDE `autoOrbit` OG markersett — dokumentert som data-drevet (VO finnes), ikke tier.
  4. `PendingCamera`-typen re-hjemlet i motor-laget; `BoardMap3D` (og `BoardMap`) importerer den IKKE lenger fra `UnifiedMapModal` (grep verifiserer ingen import fra død scroll-modal).
  5. `DEFAULT_CAMERA_LOCK` flyttet til motor-laget. ALLE TRE nåværende konsumenter (grep-verifisert) håndteres eksplisitt: (a) `BoardMap3D.tsx:7`/`450-456` → importer fra ny motor-plassering (board-levende); (b) `ReportOverviewMap.tsx:10`/`48` → motor-plassering eller forlates med scroll-rapporten; (c) `ReportThemeSection.tsx:29`/`625` (montert via `ReportPage`) → motor-plassering eller forlates med scroll-rapporten. Avklar per konsument om den er board-levende vs. scroll-rest, slik at flyttingen ikke etterlater en brutt import (`ReportThemeSection` MÅ ikke feil-antas forlatt). `MAP3D_TAB_IDS`/`filterPoisByTab` ikke dratt inn i motor-laget.
  6. `CameraWaypointAuthor` rendres fortsatt kun bak `?author=1`.
  7. `npx tsc --noEmit` 0 feil; ingen `@/`-import fra `UnifiedMapModal` i motor-/board-filene.
- **Avhengigheter:** Unit 1, 4, 5 (motor + kamera-primitiver må stå før orkestratoren dekomponeres).

### Unit 8 — Verifikasjon (nystartet Chrome) + mekaniske porter
- **Mål (→ G8):** Bevis at motoren fungerer (ikke bare kompilerer): ingen WebGL-context-feil over toggle/navigasjons-sykluser, og alle mekaniske porter grønne.
- **Filer:** `@/docs/rebuild/3d-motor-verifikasjon-runbook.md` (verifikasjons-runbook).
- **Akseptansekriterier:**
  1. **Nystartet Chrome (memory `project_3d_default_map_engine`):** Åpne et `has3dAddon`-board, kjør ≥10 sykluser av (a) 3D↔2D-toggle, (b) kategori-navigasjon (OPEN_POI/BACK_TO_DEFAULT), (c) intro→outro. Console viser INGEN «Too many active WebGL contexts» og INGEN `gmp-map-3d`-unmount (verifiser via DevTools at samme Map3D-element-node overlever).
  2. `?film=1` gir rent kart uten pins (verifiser `markerPOIs`-tomt på render-nivå, ingen DOM-removeChild-crash); `projectSite`-labelen vises fortsatt.
  3. Reveal-kaskaden kjører uten WebGL-churn-crash; markører er full opacity, bounce er scale-animasjon.
  4. `npm run lint` (0 errors), `npm test` (alle motor-/blob-/kamera-tester grønne), `npx tsc --noEmit` (0 feil), `npm run build` (bygger; `react-map-gl` ikke i motor-bundlen — verifiser chunk-output / at `MapboxFallback`-import er borte).
- **Avhengigheter:** Unit 1–7.

> **Fullstendighet:** 8 av 8 units dekket. Hver keeper/port-with-rewrite-fil fra evidens-pakken er eksplisitt tildelt en unit; ingen sampling. Render-gating bygges ikke (verifisert 0 `reportTier`-ref).

---

## 8. Utviklingsløp (faser)

### Fase 1 — Motor-kjerne + primitiver (uavhengig av orkestratoren)
- **Mål:** Den persistente motoren + overlay + markører + rene kamera-primitiver står og er testbare isolert.
- **Leveranse:** Unit 1, 2, 3, 4. `MapboxFallback` kuttet, `useWebGLCheck` portet, projeksjon konsolidert, reveal/markører + pose-matematikk + intent grønne mot eksisterende tester.
- **Autonomi-nivå:** Høy. Rene funksjoner + godt testdekkede primitiver; ingen åpne designvalg (§10 Q4 om Map3DActionButtons avgjort: 0-konsument → reference-only; Q2 motor-fallback lukket i Unit 1 AC2).

### Fase 2 — Fasade + rute + dekomponering
- **Mål:** Imperativ kamera-fasade + adapter-grunnlag + rute-lag står; `BoardMap3D` dekomponert og `PendingCamera`/`DEFAULT_CAMERA_LOCK` re-hjemlet.
- **Leveranse:** Unit 5, 6, 7.
- **Autonomi-nivå:** Middels. Dekomponering av 785-LOC-orkestratoren er substansiell port-with-rewrite; type-rehjemling berører flere konsumenter. Eierskaps-grensen mot PRD 9 (§10 Q1) bør være avklart før Unit 7 lukkes.

### Fase 3 — Verifikasjon mot prod (nystartet Chrome)
- **Mål:** WebGL-context-vernet bevist i nystartet Chrome over toggle/navigasjons-sykluser; alle mekaniske porter grønne.
- **Leveranse:** Unit 8.
- **Autonomi-nivå:** Middels. Krever live board-flate (`has3dAddon`) + Chrome DevTools-observasjon — ikke ren mekanikk («Output-fokus»-regelen: features må FUNGERE, ikke bare kompilere).

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | Persistent-mount-invarianten (aldri unmount `gmp-map-3d`) eies av PRD 6 | Det ER motorens bærende WebGL-AC (`gmp-map-3d` kan ikke `loseContext`, `BoardMap.tsx:26-41`); PRD 9 eier kun skall-komposisjonen rundt (§10 Q1 anbefaling) |
| 2 | Kutt `MapboxFallback`-grenen i `map-view-3d.tsx` (0 Mapbox i motor-hot-path); ny `!isAvailable`-gren = statisk ikke-tilgjengelig-tekst (ikke Mapbox) | CARRY-OVER 7 / 372-375; eneste `react-map-gl`-kobling i motoren; `!isAvailable` (`:623-633`) MÅ ha ikke-Mapbox-target ellers krasjer `MapView3D` (Q2 lukket i Unit 1) |
| 2b | Fjern orbit-hijack-`useEffect`-en (`map-view-3d.tsx:354-471`) ved port | No-op i board (`if (freeMode) return;` `:356`; boardet kjører alltid `freeMode`); CARRY-OVER «dropp orbit-hijack»; ingen ikke-`freeMode`-konsument → dødkode (CLAUDE.md) |
| 3 | `useWebGLCheck`-probe-cachingen bevares; `Map3DFallback`-komponenten slettes | Probe = én WebGL-kontekst (~16 maks); uten caching kaskade-crash (CARRY-OVER 387-390); komponenten er `@ts-nocheck` + 0 importere |
| 4 | ALDRI opacity-animasjon på markører; reveal animerer kvantisert scale | Opacity-reveal churnet Google 3D SVG-rasterisering og eksploderte WebGL (CARRY-OVER 44-47) |
| 5 | `hasVoiceOver` (BoardMap3D:261) er data-drevet seleksjon, IKKE tier-gating | Leser board-data-innhold (spillbart VO finnes); speiler `pickPlayableAudio`-seleksjon, ikke `reportTier` (patch #2) |
| 6 | Motoren eier kamera-MEKANISMEN (`getCategoryCamera`/`deriveCategoryCamera`); `camera-tours`-DATAEN deferres til **PRD 9** | Kanonisk indeks tildeler DATA til PRD 9 (`00-INDEX:33`/`:95`), bekreftet av PRD 3:138/170. PRD 6 bringes i samsvar med indeksen (ikke PRD 10); PRD 10 konsumerer mekanismen for autorert tour (§10 Q3) |
| 7 | `map-adapter`-MØNSTERET (flyTo/stop) bevares som fasade-konsept; fila dør med scroll-modalen | Verifisert: kun konsumert av `UnifiedMapModal` (+ egen test); boardet bruker `useBoard3DCamera` (manifest 753, §10 Q5) |
| 8 | `PendingCamera` re-hjemles i motor-laget; `DEFAULT_CAMERA_LOCK` flyttes til motor-laget | Hindrer at board-porten drar inn død `UnifiedMapModal`; `DEFAULT_CAMERA_LOCK` deles board↔scroll-blocks (`report-3d-config.ts:19`) |
| 9 | UNTRACKED-filene (`board-establishing-*`, `blob-pois.test`) behandles som keeper, noteres ikke-i-historikk | Ekte working-tree-kode, ikke committet ennå (git status); ikke et scope-kutt |
| 10 | INGEN render-gating på `reportTier` bygges | Patch #2, verifisert 0 ref i `BoardMap3D`/`ReportReelsPage`/`map-view-3d`/`RevealLayer3D` |

### Kontroll-runde 2026-06-27

| # | Funn | Dom |
|---|------|-----|
| K1 | **CameraCutOverlay-eierskap.** RATIFISERT: PRD 6 eier KOMPONENTEN (`components/variants/report/board/CameraCutOverlay.tsx`, bundet til `useBoard3DCamera` + `CUT_FADE_MS`, null andre konsumenter); PRD 10 eier BRUKEN. Cut-overlay-driften ligger i Unit 5 AC2; `CUT_FADE_MS` er felles sannhetskilde (Unit 4 AC2). |
| K2 | **WebGL-context-vern (06↔09).** RATIFISERT: PRD 6 eier invariant-KONTRAKTEN (gmp-map-3d kan ikke `loseContext` → må aldri unmountes; Mapbox `map.remove()` + fallback `loseContext` = godkjente teardowns). PRD 9 eier HÅNDHEVELSEN (den ubetingede mount-grenen `BoardMap.tsx:437`). PRD 6 eier dette som KONTRAKT, ikke kode-linje — mount-koden bor fysisk i PRD 9-fila. (§10 Q1 LØST.) |
| K3 | **directions-render-eierskap.** RATIFISERT: PRD 6 eier polylinje-RENDER-primitivene `BoardPathLayer` (2D) + `RouteLayer3D` (3D, `route-layer-3d.tsx`); PRD 11 eier datalaget (proxy + `useRouteData`). Render bor i motoren, data-henting hos realtime-transport. |
| K4 | **2D-overlay (Andreas-beslutning).** BEHOLD `react-map-gl`-2D-overlayet. Skall-toggelen (`BoardMapControls` Kart/3D, `BoardMap.tsx:537-549`) er LIVE og separat fra motor-fallbacken (`MapView3D` `useWebGLCheck`→`MapboxFallback`, allerede løst per Unit 1 AC2). (§10 Q2 LØST = behold.) |
| K5 | **Mikromobilitet (Andreas-beslutning).** PRD 6 bygger IKKE en board-markør-primitiv for ledige sykler/scootere — per-POI tekst-status (`POIRealtimeSection`) holder. Legacy `ReportThemeMap.tsx:343` rendrer prikker, men det er legacy 2D-rapport, ikke board → utenfor scope. |
| K6 | **establishing/board-intros mottaker.** KORRIGERT: MEKANISMEN (`getEstablishingShot:42` + `getBoardIntro`-flythrough-typene) → PRD 6; DATAEN (`ESTABLISHING_SHOTS` + `BOARD_INTROS`) → PRD 9 (ikke PRD 5 som tidligere foreslått). (§10 Q6 LØST/korrigert.) |

---

## 10. Åpne spørsmål

1. **06↔09-grense for WebGL-context-vern (eierskap):** ✅ **LØST (kontroll-runde 2026-06-27) — RATIFISERT.** PRD 6 eier WebGL-context-vernet som **KONTRAKT/INVARIANT** (gmp-map-3d kan ikke `loseContext` → må ALDRI unmountes; Mapbox `map.remove()` + fallback `loseContext` er godkjente teardowns). PRD 9 eier **HÅNDHEVELSEN** — den ubetingede mount-grenen (`BoardMap.tsx:437`, betinget på `has3dAddon`, aldri nedrevet) bor fysisk i PRD 9-fila. Presisering: PRD 6 eier dette som KONTRAKT, ikke som kode-linje — mount-koden lever i PRD 9s `BoardMap.tsx`. Avgjort, ikke lenger åpent.
2. **2D-overlay-definisjon — behold ELLER drøpp Mapbox-2D-toggle-flaten i `BoardMap.tsx`?** ✅ **LØST (kontroll-runde 2026-06-27, Andreas-beslutning) = BEHOLD.** `react-map-gl`-2D-overlayet beholdes. Skall-toggelen (`BoardMapControls` Kart/3D, `BoardMap.tsx:537-549`) er LIVE og en SEPARAT akse fra motor-fallbacken (`MapView3D` `useWebGLCheck`→`MapboxFallback`, allerede løst per Unit 1 AC2 med statisk ikke-tilgjengelig-tekst). De to skal ikke konflateres: motorens fallback er ikke-Mapbox; board-skallets 2D-toggle-flate (PRD 9-grense) forblir `react-map-gl` UTENFOR motorens hot path. (Tidligere status: motorens `useWebGLCheck`-fallback ble lukket i Unit 1 AC2; nå er også board-skallets 2D-toggle-flate avgjort = behold.) Ikke-blokkerende for Unit 1.
3. **`camera-tours.ts` (DATA vs MEKANISME) — RESOLVERT mot kanonisk indeks:** Konsumeres av `BoardMap3D` (`:510`). Tre autoritative kilder samstemmer: `00-INDEX:33` («`camera-tours.ts`-data» under PRD 9), `00-INDEX:95` (PRD 9 tildelt camera-tours-data), PRD 3:138/170 («`camera-tours.ts`-data (`getCameraTour`) → PRD 9»). **Avgjort:** PRD 6 eier `getCategoryCamera`/`deriveCategoryCamera`-MEKANISMEN; per-prosjekt-DATAEN hjemles i **PRD 9** (kanonisk eier), med PRD 10 som konsument av mekanismen for den autorerte touren. Ikke-blokkerende for motor-kjernen. (Briefen siterer feilaktig PRD 10 for dataen; indeksen er kanonisk per oppdrags-reglene.)
4. **`Map3DActionButtons` — konsolider eller reference-only? AVGJORT på faktisk live-status.** Verifisert: headerkommentar `:1` «3D component preserved for future use», `@ts-nocheck`, og grep finner INGEN JSX-mount i board/reels — kun KOMMENTAR-referanser i `BoardPOI3DMiniPopup.tsx:1`/`:24`. Komponenten er altså 0-konsument (samme status som den slettede `Map3DFallback`-komponenten). **Avgjort:** reference-only — flyttet til §4 dead-tabell; projeksjons-konsolideringen (Unit 2) gjelder KUN `BoardPOI3DMiniPopup`. Hvis komponenten senere mountes, byttes `calculateScreenPosition` (`:27`) til `projectLatLngToScreen` da. Ikke-blokkerende for Unit 2.
5. **`map-adapter` keeper-vs-dead (manifest 753):** Verifisert KUN konsumert av `UnifiedMapModal` + egen test. **Anbefaling:** `useBoard3DCamera` ER allerede board-fasaden; `map-adapter` dør med scroll-modalen, men flyTo/stop-mønsteret bevares konseptuelt (Unit 5). Avklart som default; bekreft ved port.
6. **establishing/board-intros — mekanisme vs. data, hvilken PRD eier mottaket?** ✅ **LØST (kontroll-runde 2026-06-27) — KORRIGERT.** MEKANISMEN (`getEstablishingShot:42` + `getBoardIntro`-flythrough-typene) bor i **PRD 6**. DATAEN (`ESTABLISHING_SHOTS` + `BOARD_INTROS`, hardkodede TS-records) hjemles i **PRD 9** (board-skall), IKKE PRD 5 som tidligere foreslått. Begrunnelse: establishing/intro-DATA er per-strøk/per-prosjekt autorert kamera-data, samme klasse som `camera-tours`-DATAEN som per kanonisk indeks (`00-INDEX:33`/`:95`) hjemles i PRD 9 — de skal samles hos samme eier. Den tidligere PRD 5-pekeren var uverifisert og er nå overstyrt. Ikke-blokkerende for motor-kjernen (mekanismen står uansett i PRD 6).

---

## 11. Avhengigheter (PRD-graf)

```
        PRD 1 — prd-datamodell-supabase        PRD 5 — prd-board-data-state
        (POI/Coordinates/Category/             (BoardData: home.coordinates,
         CameraPose, has_3d_addon,              topRankedPois vs pois,
         realtime-kobling-felt)                 hasVoiceOver-signal, board-state)
                    │                                      │
                    └──────────────┬───────────────────────┘
                                   ▼
                ┌──── PRD 6 — prd-3d-motor (DENNE) ────┐
                │   (MapView3D persistent-mount,        │
                │    screen-overlay, reveal/blob,       │
                │    kamera-primitiver + fasade)        │
                │            │            │             │
                ▼            ▼            ▼             ▼
          PRD 9          PRD 10        PRD 11        PRD 13
          board-skall    kamera-       realtime-     instrumentering
          (komponerer    flythrough    blocks i      (emit-sites på
           + dynamic())   (pose-prim.   overlaget)    kamera/interaksjon)
                          + ?film=1)
```

**Blokkeres av:** PRD 1, PRD 5.
**Blokkerer:** PRD 9 (skall-komposisjon), PRD 10 (autorert flythrough bygger på pose-primitivene), PRD 11 (realtime tegnes i overlaget), PRD 13 (emit-sites).
**Injiserer/deferrer til (eier ikke):** `camera-tours`-DATA → PRD 9 (kanonisk, `00-INDEX:33`/`:95`; PRD 10 konsumerer mekanismen); `board-establishing-shots`/`board-intros`-DATA (`ESTABLISHING_SHOTS`/`BOARD_INTROS`) → PRD 9 (board-skall, samme eier som `camera-tours`-data; korrigert kontroll-runde 2026-06-27, se §10 Q6); `dynamic()`-wrapping + `BoardMapControls` → PRD 9.

---

**Fullstendighet:** 8 av 8 implementation units spesifisert med avhengigheter + akseptansekriterier; 8 av 8 mål (G1–G8) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i faktisk kode (verifisert: `map-view-3d.tsx:13-14`/`354-471` (orbit-hijack)/`480`/`498-499`/`562-619`/`623-633` (`!isAvailable`-fallback-blokk), `BoardMap3D.tsx` 785 LOC + `:7`/`25`/`47`/`261`/`278-279`/`337`/`510`/`774`, `BoardMap.tsx:26-41`/`203`/`437`, `board-3d-camera-director.ts:25`/`107`/`147`/`154`/`305`/`322`/`330`, `RevealLayer3D.tsx:31`/`35`/`39`/`51`, `project-latlng-to-screen.ts:17`/`29`/`64`, `report-3d-config.ts:19` (konsumenter `BoardMap3D:7`/`ReportOverviewMap:10`/`ReportThemeSection:29`), `Map3DActionButtons.tsx:1` (0-konsument), grep: 0 `reportTier` i render-laget), prod-schema-snapshot (`projects.has_3d_addon` snapshot:184) og CARRY-OVER-MANIFEST-linjene. Ingen P0/P1/P2-tiers; ingen «Future Work»-seksjon (deferred under §6 med PRD-pekere); ingen render-gating spesifisert (patch #2).
