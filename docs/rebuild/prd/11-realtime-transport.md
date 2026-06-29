# PRD 11 — Sanntids-transport (board-feature)

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling. **Kontroll-runde 2026-06-27 ratifiserte begge grå­sone-eierskaps-spørsmålene** (§10 Q1 directions/use-route-data + Q2 travel-times) og lukket Q5 (mikromobilitet-posisjoner) — ingen åpne blokkerende spørsmål gjenstår (Q3 dashboard-gjenoppbygging + Q4 useOpeningHours forblir ikke-blokkerende). PRD 11 eier DATALAGET (`/api/directions`-proxy + `use-route-data`-hook), PRD 6 eier render (`BoardPathLayer` + `RouteLayer3D`); `/api/travel-times` er Explorer-spor-proxy uten board-konsument; mikromobilitet rendres ikke som kart-prikker på board (per-POI tekst-status holder).
> **Lag (byggrekkefølge):** Lag 3 (board-flate) — `00-INDEX:56` (`11 realtime (←01,09)`). Bygges etter PRD 1 (datamodell) og PRD 9 (board-skall). Blokkerer ingen nedstrøms-PRD.
> **PRD-nr:** 11 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-realtime-transport`
> **Kontekst:** Lag-3-PRD. Eier sanntids-transport-LAGET som board-feature: API-PROXY-RUTENE for runtime transport (Entur kollektiv, Trondheim Bysykkel GBFS, Hyre car-share, fri-flytende mikromobilitet), realtime-HOOKENE som poller dem, og transport-BLOCKENE som rendres i board-skallet (PRD 9). Inkluderer disiplinert error-/loading-/abort-håndtering, nøkkel-i-header-kontrakten, og caching-mønster per rute. Realtime via klient-hooks (`useEffect`-polling) mot egne `/api`-proxy-ruter er det ETABLERTE, TILLATTE mønsteret (CARRY-OVER `7`/`344-347`) — IKKE den forbudte «`useEffect` for data-fetching» (som gjelder server/Supabase-data). Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md`, `docs/rebuild/prod-schema-snapshot.txt` og faktisk kode (`app/api/{entur,bysykkel,hyre,mobility,directions,travel-times}/route.ts`, `lib/hooks/useRealtimeData.ts`, `lib/map/use-route-data.ts`, `POIRealtimeSection.tsx`, board-popup-flatene).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **sanntids-transport-laget** på boardet: de eksterne data-kildene som ikke kan pre-renderes (avganger, sykkel-/bil-tilgjengelighet, gå-rute) og som derfor polles fra klienten mot Placy-eide proxy-ruter. Det er den ene eksplisitte arkitektur-unntaks-flaten i en ellers RSC-først datastack: CARRY-OVER linje 7 slår fast «RSC board-data, ingen klient-XHR» — og linje 344-347 navngir realtime som det eksplisitte unntaket fordi sanntidsdata per definisjon ikke kan forhåndsrendres.

Tre strukturelle grep definerer denne PRD-en:

1. **Proxy-ruten er kontrakten, ikke den eksterne API-en.** Hver kilde (Entur JourneyPlanner v3, Trondheim Bysykkel GBFS, Entur Mobility v2 for Hyre + mikromobilitet, Mapbox Directions) ligger bak en Placy-eid `/api`-rute som normaliserer respons-formen, holder API-nøkkelen server-side (header, ikke URL — med ÉN dokumentert Mapbox-avvik), og setter caching-kontrakten. Klienten kjenner kun Placy-formen, aldri leverandøren.

2. **Den LIVE board-transporten er per-POI, ikke et dashboard.** Den faktisk mountede transport-overflaten på rebuild-boardet er `useRealtimeData` + `POIRealtimeSection` i POI-popupene (`BoardPOI3DMiniPopup:144-146`, `BoardPOIMiniPopup:91`) og desktop-sidebaren (`DesktopStorySidebar:425`). Den større `useTransportDashboard` + `TransitDashboardCard`-dashboarden er DØD i rebuild-boardet (eneste konsumenter er den droppede scroll-rapporten) og behandles som reference-only for en eventuell board-dashboard-gjenoppbygging — ikke som live MVP-overflate (jf. §10 Q3).

3. **Transport gater ALDRI på `reportTier`.** Transport-blockene vises når POI-en har en kobling-ID (`isTransportPOI`, `BoardPOI3DMiniPopup:40-44`), ikke når et nivå er deklarert — verifisert 0 `reportTier`-ref i `BoardMap3D`/`ReportReelsPage` (`00-INDEX:85`). Transport er en delt/nivå-1-capability rendret ved tilstedeværelse av kobling-IDer, ikke en tier-låst modul.

PRD 11 eier DATA-laget (proxyer + hooks) og transport-BLOCKENE; den eier IKKE board-SKALLET (popup/sidebar-komposisjonen) — det er PRD 9 (`PRD9:69`/`97`/`183`). Skallet leverer flatene blockene tegnes i; PRD 11 leverer hooken + blocken som mountes i dem.

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Port de fire kjerne-transport-proxy-rutene (Entur, bysykkel, hyre, mobility) verbatim med bevart nøkkel-i-header-kontrakt, error-håndtering og per-rute-caching. | Proxy-rute-port (Unit 1, 2). |
| **G2** | Port `useRealtimeData`-hooken som den LIVE per-POI realtime-kilden med bevart `Promise.allSettled`-partial-error + `AbortController` + 60s-poll. | Realtime-hook-port (Unit 3). |
| **G3** | Port `POIRealtimeSection`-blocken (+ `formatRelativeDepartureTime`) med bevart skeleton/empty-state, koblet til skall-flatene fra PRD 9 uten å eie skallet. | Transport-block-port (Unit 4). |
| **G4** | Avklar og port grå­sone-rute-paret `/api/directions` + `use-route-data` (gå-rute-data-kilden) med eierskaps-grense mot PRD 5/6 ratifisert. | Directions-proxy + rute-hook-port (Unit 5). |
| **G5** | Avklar `/api/travel-times`-rutens status (proxy beholdt, ingen live board-konsument) og klassifiser `useTravelTimes`/`useTransportDashboard`/`TransitDashboardCard`/`useOpeningHours` korrekt (reference-only) uten å dra død kode inn i boardet. | Rute-status + klassifisering (Unit 6). |
| **G6** | Bevis at sanntids-transport FUNGERER på boardet (live avganger/sykkel/bil i popup + sidebar, mobil + 3D-overlay) og at det respekterer arkitekturreglene; alle mekaniske porter grønne. | Verifikasjon + mekaniske porter (Unit 7). |

---

## 3. Arkitektur-/migrasjons-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *data-/feature-laget*: transport-data-kilden er DELT (samme proxyer/hooks på alle nivåer), og rendres betinget på POI-INNHOLD (kobling-IDer), aldri per tier. Det er en ren kode-port uten skjema-migrasjon — kobling-feltene leveres av PRD 1.

| Lag | Eierskap | Divergerer per tier? | Divergerer per profil? |
|-----|----------|----------------------|------------------------|
| Datamodell (`pois.entur_stopplace_id` m.fl.) | PRD 1 | Nei | Nei |
| Board-data (surfacer kobling-IDer på `BoardPOI.raw`) | PRD 5 | Nei | Nei |
| **Transport-proxy-ruter + realtime-hooks (DATA)** | **Denne PRD-en** | **Nei** — identisk kilde, render ved POI-innhold | Nei |
| **Transport-blocks (`POIRealtimeSection`)** | **Denne PRD-en** | **Nei** — vises ved `isTransportPOI`, ikke tier | Nei |
| Board-skall (popup/sidebar som blocken mountes i) | PRD 9 | Nei | Nei |
| 3D-motor (popup mountes OVER persistent 3D-kart) | PRD 6 | Nei | Nei |

> **NB — det LEGITIME `useEffect`-mønsteret.** Arkitekturregelen «ALDRI `useEffect` for data-fetching» retter seg mot server/Supabase-data som MÅ være RSC. Realtime-polling mot egne `/api`-proxy-ruter er det etablerte, eksplisitt tillatte unntaket (CARRY-OVER `7`/`344-347`; `useRealtimeData.ts:106-158` `setInterval`-poller; `PRD9:183`). Sanntids-avganger/-tilgjengelighet kan ikke pre-renderes — de poller. Board-DATA forblir RSC (PRD 5/9). PRD 11s akseptansekriterier BEKREFTER dette skillet; de flagger IKKE pollerne som regelbrudd. Ingen Supabase-kall finnes i dette laget — pollerne treffer kun Placy-eide proxy-ruter.

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument | Hva den konsumerer fra transport-laget |
|-----------|----------------------------------------|
| Board-flaten (PRD 9-skall) | `POIRealtimeSection` mountes i `BoardPOI3DMiniPopup`/`BoardPOIMiniPopup`/`DesktopStorySidebar`; `useRealtimeData` drives av `poi.raw`-kobling-IDer. PRD 9 eier skallet, konsumerer transport-blocken. (`PRD9:69`/`97`/`183`.) |
| Board-rute-rendring (PRD 6 rute-primitiv) | `RouteData` fra `use-route-data` mater rute-linje-primitivet (`BoardMap3D:138`, `BoardPathLayer:26`, `BoardPathMidpointMarker:35`). PRD 11 produserer rute-DATA; PRD 6 rendrer polylinjen (grå­sone, §10 Q1). |
| (ingen nedstrøms-PRD blokkeres) | Lag-3 board-feature; `00-INDEX:64` lister 11 i MVP-stien fordi transport er runtime-bekreftet levende, men ingen PRD venter på 11. |

### Migrasjons-kontekst (port-with-rewrite, ingen DB)

Denne PRD-en rører IKKE skjema. Kobling-feltene `pois.entur_stopplace_id`/`bysykkel_station_id`/`hyre_station_id` (text, alle YES/nullable) leveres av PRD 1 (`prod-schema-snapshot.txt:91-93`, `PRD1:55`/`125-126`). Proxy-rutene (`entur`/`bysykkel`/`hyre`/`mobility`) + `useRealtimeData` + `POIRealtimeSection` + `formatRelativeDepartureTime` portes nær-verbatim (keeper-core). `use-route-data` portes med eierskaps-avklaring mot PRD 5/6. De døde dashboard-/explorer-konsumentene portes IKKE.

---

## 4. Eksisterende kodebase

### Bæres over — keeper-core (port nær-verbatim)

| Fil (@/-sti) | Rolle | Verifisert linje-ref |
|--------------|-------|----------------------|
| `app/api/entur/route.ts` | Entur JourneyPlanner v3 GraphQL-proxy. GET=avganger per quay (`stopPlaceId`), POST=reiseplanlegging (from/to coords). Nøkkel via `ET-Client-Name`-header (ikke URL). Caching `next:{revalidate:30}`. Error-håndtert (400/404/500). | `ENTUR_API_URL:6`, GET-avganger `:93`, `ET-Client-Name`-header (ingen nøkkel-i-URL) `:108-110`, `revalidate:30` `:119`, quays+flat departures-form `:144-152`, POST trip `:172`, error 500 `:162-167` |
| `app/api/bysykkel/route.ts` | Trondheim Bysykkel GBFS-proxy. GET-modi: radius-aggregat (`lat/lng/radius`), enkelt-stasjon (`stationId`), alle stasjoner. Nøkkel via `Client-Identifier`-header. In-process station-info-cache (1t TTL) + status `next:{revalidate:60}`. Error-håndtert. | GBFS-URLer `:4-7`, `isStationOpen` (`Boolean()` håndterer bool\|int-feed) `:27`, `stationInfoCache 1t` `:41-72`, `revalidate:60` `:99`, radius-aggregat-modus `:113-165`, error 500 `:214-220` |
| `app/api/hyre/route.ts` | Hyre car-share-proxy via Entur Mobility v2 GraphQL (`systems:["hyrenorge"]`, `CAR`). GET via `stationId` — spør Trondheim-vidt (lat 63.43/lon 10.4/range 15000) og filtrerer på id. `STATION_ID_PATTERN`-input-guard. Nøkkel via `ET-Client-Name`-header. `revalidate:30`. Error-håndtert. | `ENTUR_MOBILITY_URL:6`, `STATION_ID_PATTERN`-guard `:29`, ugyldig format 400 `:38-40`, `ET-Client-Name`-header `:48-51`, hardkodet Trondheim-senter+range `:55-58`, error 500 `:84-89` |
| `app/api/mobility/route.ts` | Fri-flytende mikromobilitet-proxy via Entur Mobility v2 GraphQL (`vehicles`-query). GET aggregerer SCOOTER/CAR/etc per operatør + returnerer posisjoner. VERIFISERT mikromobilitet/scooter+fri-flytende-bil-endepunkt (IKKE GBFS-bysykkel). Koordinat-bounds + `formFactor`-whitelist-guard, `MAX_RADIUS=2000`. Nøkkel `ET-Client-Name`-header. `revalidate:30`. | `ENTUR_MOBILITY_URL:10`, `VALID_FORM_FACTORS`-whitelist `:37-46`, koordinat+radius-guard `:55-61`, `ET-Client-Name`-header `:71-73`, `byOperator`-aggregat + positions `:100-119`, error 500 `:128-133` |
| `lib/hooks/useRealtimeData.ts` | Klient realtime-hook — per-POI poller (60s) som henter `/api/entur`+`/api/bysykkel`+`/api/hyre` via `Promise.allSettled`. `AbortController` + clear-on-switch. LEGITIM `useEffect`-polling (det etablerte mønsteret, IKKE forbudt server-data-fetch). LIVE via popup-/sidebar-flatene. | `RealtimePOI` (id+3 kobling-IDer) `:9-14`, `POLLING_INTERVAL 60s` `:50`, `useEffect`-poller + `AbortController` + `setInterval` `:106-158`, `Promise.allSettled` 3 kilder `:127-131`, partial-error-melding `:146` |
| `components/variants/report/blocks/POIRealtimeSection.tsx` | Presentasjons-transport-block — rendrer `useRealtimeData`-output (entur-avganger + bysykkel + hyre) med skeleton/empty-states. Props = `ReturnType<useRealtimeData>`. LIVE mountet av popup-/sidebar-flatene. `next/image`-fri (kun lucide-ikoner + tekst). `@/`-prefiks-imports (bevares). | `POIRealtimeSection:11`, props `:7-9`, entur/bysykkel/hyre-render `:43-88` |
| `lib/utils/format-time.ts` | Liten util `formatRelativeDepartureTime(isoTime)` — brukt av `POIRealtimeSection` for avgangs-visning («2 min»/«Nå»). Port med blocken. | `formatRelativeDepartureTime:4`, import i `POIRealtimeSection.tsx:5` |

### Bæres over — port-with-rewrite (omstrukturer / avklar ved port)

| Fil (@/-sti) | Rewrite-handling | Verifisert linje-ref |
|--------------|------------------|----------------------|
| `app/api/directions/route.ts` | Port Mapbox Directions v5-proxy. GET origin/destination eller waypoints, profil-mapping (walk/bike/car). LIVE på board: driver home→POI-rutelinjen via `use-route-data`. **GRÅSONE-EIERSKAP** (transport vs rute-render PRD 6 vs board-data PRD 5) — §10 Q1. **MAPBOX-TOKEN-NOTAT: `access_token` i URL-querystring** — IKKE et hemmelig-nøkkel-brudd: `NEXT_PUBLIC_MAPBOX_TOKEN` er offentlig/klient-eksponert, og Mapbox støtter kun query-param-auth (ingen `Authorization`-header). Behold i URL + no-log-full-URL-garanti (Unit 5 AC2). | token `NEXT_PUBLIC_MAPBOX_TOKEN:39`, `access_token` i URL `:50`, routes-form min→duration `:61-73`, error 500 `:80-86` |
| `lib/map/use-route-data.ts` | Port gå-rute-hook (debounce 200ms + `AbortController` + Zod-validert respons, max 500 coords DoS-guard). LIVE-konsumenter (3 verifisert): `BoardMap3D:138` (3D-rute), `BoardPathLayer:26` (2D-overlay), `BoardPathMidpointMarker:35` (dokumentert prototype-duplikat-fetch). **GRÅSONE**: hooken+proxyen er runtime transport-data-kilden; polylinje-RENDER er PRD 6-primitiv. Flagg eierskap (§10 Q1). **Manifest-default overstyrt:** CARRY-OVER `753` satte `use-route-data` til reference-only «pending serial clarification» — PRD 11 ratifiserer den til keeper basert på de 3 verifiserte live board-konsumentene. Docstring nevner død `UnifiedMapModal` — re-pek/oppdater ved port. | `useRouteData:39`, Zod-skjema max 500 `:19-28`, debounce 200ms + `AbortController`-fetch `/api/directions` `:59-98`, `useEffect` `:46` |

### Slettes / forlates (reference-only / dead)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `app/api/travel-times/route.ts` | reference-only (proxy beholdt, ingen live board-konsument) | Mapbox Matrix v1-proxy (POST origin+destinations[] ≤24, GET). Eneste runtime-konsument er `useTravelTimes` → død `ExplorerPage`; build-time-precompute er `lib/generators/travel-times.ts` (PRD 3). Ingen LIVE board-konsument funnet. **MAPBOX-TOKEN-NOTAT: `access_token` i URL** (POST `:66`, GET `:171`) — offentlig `NEXT_PUBLIC_`-token, Mapbox kun query-param-auth; ikke et nøkkel-brudd (Unit 5 AC2). Beholdes som proxy under PRD 11, men markeres uten live-konsument (§10 Q2). |
| `lib/hooks/useTravelTimes.ts` | reference-only | Klient travel-times-hook, batcher `/api/travel-times` (24/req), localStorage-cache 24t per `(projectId,travelMode)`. Eneste konsument = `ExplorerPage` (droppet produkt) → død runtime. CARRY-OVER `572-574` flagger den som CLAUDE.md-brytende (klient-`useEffect`-fetch) og sier flytt server-side; build-time-precompute finnes alt (PRD 3). Cache-strategi = referanse. Ikke portet som aktiv hook. |
| `lib/hooks/useTransportDashboard.ts` | reference-only | Klient transport-dashboard-hook (90s poll), aggregerer Entur+bysykkel-radius+hyre+scooter+fri-bil for POIer `walkMin≤5`. DØD i rebuild-board: eneste konsumenter (`ReportThemeSection`/`ReportHeroInsight`) nås kun via død scroll-rapport `ReportPage`. Ingen live board/reels-mount. Aggregerings-logikken = referanse for en eventuell board-dashboard-gjenoppbygging (§10 Q3). |
| `components/variants/report/blocks/TransitDashboardCard.tsx` | reference-only | Faner Tog/T-bane/Trikk/Buss/Taxi over `StopDepartures`. DØD i rebuild-board: eneste konsument `ReportHeroInsight:133` nås kun via død scroll-rapport. Bruker `next/image` (CLAUDE.md-konform) — bevares som referanse hvis board-dashboard gjenoppbygges. Manifest-patch listet den som keeper, men live-stien er død scroll-rapport. |
| `lib/hooks/useOpeningHours.ts` | reference-only (åpningstider, ikke transport — flagg) | CARRY-OVER `745`-patch listet den blant PRD 11-keepers, men VERIFISERT: ingen live board/reels-konsument (kun explorer/trip = døde produkter + `ReportMapDrawer:226`/`:349` via død `UnifiedMapModal`). Ikke realtime-transport; sannsynlig feilplassert (PRD 5 POI-detalj?). §10 Q4. |
| `components/variants/report/reels/ReelsTransport.tsx` | utenfor scope (navne-kollisjon) | IKKE en transport-DATA-komponent — det er audio-spiller-bunnlinjen (media-«transport»-kontroller: `NowPlayingCard`+`ReelsMenu`+`ChapterProgressBar`), mountet `ReportReelsPage:1001` ved `audioUnlocked`. Hører til PRD 14 (audio/reels) + PRD 9 (skall). Flagget for å hindre at ordet «transport» feilklassifiserer den inn i PRD 11. |
| `lib/generators/travel-times.ts` | reference-only (PRD 3-grense) | BUILD-TIME Mapbox Matrix-precompute (`calculateTravelTimes`/`applyTravelTimesToPOIs`), brukt kun av død `scripts/generate-story.ts`. PRD 3 (provisjon) build-time-scope, IKKE PRD 11 runtime. Grense-markør: bekrefter runtime travel-times (grå­sone) vs build-time-precompute (PRD 3)-splittet. |
| `ExplorerPOICard.tsx` / `StoryPOIDialog.tsx` / `event/EventDetailPanel.tsx` | dead / reference-only | `ExplorerPOICard` + `StoryPOIDialog` konsumerer `useRealtimeData` i droppede Explorer/Story-produkter → død transport-bruk, ikke portet. `EventDetailPanel` bruker `useRealtimeData`+`POIRealtimeSection` i PARKERT event-spor (CARRY-OVER: `eventToBoardData` reference-only) → ikke aktiv rebuild-scope. |
| `components/poi/poi-card-expanded.tsx` (`:67`) + `components/modal/theme-story-modal.tsx` (`:327`) | dead | `poi-card-expanded` konsumerer `useRealtimeData` (`:67`), men mountes KUN av `theme-story-modal` (`POICardExpanded` `:327`), som har NULL importere utenom barrel-fila `components/modal/index.ts` (verifisert: `ThemeStoryModal` har ingen live importør) → død transport-konsument, ikke portet. |
| `components/variants/report/ReportMapDrawer.tsx` (`:226`/`:349`) | dead | Mounter `POIRealtimeSection` to steder (`:226`/`:349`), men nås kun via `UnifiedMapModal` — som ingen live board-flate mounter (`BoardMap3D:47` importerer kun `type PendingCamera` derfra, ikke komponenten) → død block-konsument. Ikke portet; transport-blocken leveres til de LIVE skall-flatene (popup/sidebar), ikke hit. |

### Grense-referanse (eid av PRD 9, ikke PRD 11 — tas med for grense)

| Fil (@/-sti) | Eier | Grense |
|--------------|------|--------|
| `BoardPOI3DMiniPopup.tsx` | PRD 9 (skall) / PRD 6 (3D-overlay-mount) | 3D-board-POI-popup (mountet `BoardMap3D:774`). Eier `isTransportPOI`-deteksjon + `useRealtimeData(poi.raw)` + `POIRealtimeSection`-mount (`:40-45`/`144-146`). PRD 9 eier popup-SKALLET; PRD 11 eier realtime-hooken+blocken den embedder. Popupen mountes OVER persistent 3D-kart → blocken må ikke tvinge remounts/opacity-churn (PRD 6-gotcha). |
| `BoardPOIMiniPopup.tsx` | PRD 9 (skall) | 2D-overlay-board-POI-popup (mountet `BoardMap.tsx:514`) — samme `isTransportPOI`+`useRealtimeData`+`POIRealtimeSection`-mønster (`:22-27`/`:91`). Skjebne-bundet til Mapbox-2D-flaten (PRD 6 §10 Q2 / PRD 9 Unit 4). PRD 11 eier embedded realtime; skallet eier mounten. |
| `DesktopStorySidebar.tsx` | PRD 9 (skall) | Desktop board-sidebar (mountet `ReportReelsPage:737`) — embedder `useRealtimeData` (`:399`) + `POIRealtimeSection` (`:425`) for aktiv transport-highlight. PRD 9 eier sidebar-dekomponeringen; realtime-seksjonen er PRD 11-grensen den konsumerer (`PRD9:97`). |

---

## 5. Datakontrakt (felt PRD-en eier / konsumerer)

### 5.1 Konsumeres fra PRD 1 (datamodell) + PRD 5 (board-data)

| Symbol / felt | Rolle i transport-laget | Kilde |
|---------------|-------------------------|-------|
| `pois.entur_stopplace_id`, `pois.bysykkel_station_id`, `pois.hyre_station_id` (text, nullable) | De tre kobling-IDene som driver `isTransportPOI` + per-kilde-fetch. | `prod-schema-snapshot.txt:91-93`, `PRD1:55`/`125-126` |
| `POI.enturStopplaceId` / `bysykkelStationId` / `hyreStationId` | Surfacet på POI fra kobling-kolonnene (`lib/types.ts:89-91`, verifisert «Transport-integrasjoner»-blokk); `useRealtimeData` leser disse via `RealtimePOI`-formen (`useRealtimeData.ts:9-14`). | PRD 1 (type) / PRD 5 (board-data) |
| `BoardPOI.raw` (POI) + `poi.coordinates` (lat/lng) | `useRealtimeData(poi.raw)` får kobling-IDene; `use-route-data(activePOI, projectCenter)` (signatur `:39-42`) bruker `activePOI.coordinates` + `projectCenter` for `/api/directions` origin/dest. **På boardet leveres `projectCenter`-argumentet som `data.home.coordinates`** (alle live call sites: `BoardMap3D:138`, `BoardPathLayer:26`, `BoardPathMidpointMarker:35`) — board-prosjektsenteret ER home-koordinaten (PRD 5 board-data). Mobility/bysykkel radius-modus bruker coords. | PRD 5 board-data (`BoardPOI.raw`) |

### 5.2 Eies av denne PRD-en

| Symbol | Eierskap | Note |
|--------|----------|------|
| `GET`/`POST` i `app/api/entur/route.ts` | PRD 11 | Avgangs- + reiseplanleggings-proxy. Returnerer BÅDE `quays[]` (per retning) OG flat `departures[]` (første per quay, for kart-tooltips) — to konsum-former fra én rute (Beslutning 6). |
| `GET` i `app/api/bysykkel/route.ts` | PRD 11 | GBFS-proxy, tre modi (radius/stasjon/alle). In-process 1t station-info-cache + 60s status-revalidate. |
| `GET` i `app/api/hyre/route.ts` | PRD 11 | Car-share-proxy, station-basert (filtrerer Trondheim-vid query på id). |
| `GET` i `app/api/mobility/route.ts` | PRD 11 | Fri-flytende mikromobilitet-proxy (scooter default; støtter `CAR` for fri-bil). Distinkt fra hyre (Beslutning 7). Produserer `positions[]` for kart (rendres av PRD 6 hvis aktivert; §10 Q5). |
| `GET` i `app/api/directions/route.ts` | PRD 11 (grå­sone, §10 Q1) | Mapbox Directions-proxy — gå-rute-DATA-kilden. PRD 6 rendrer polylinjen. |
| `GET`/`POST` i `app/api/travel-times/route.ts` | PRD 11 (proxy beholdt, ingen live konsument, §10 Q2) | Mapbox Matrix-proxy. Runtime-konsument er død; build-time-precompute = PRD 3. |
| `useRealtimeData` + `RealtimePOI`/`EnturDeparture`/`BysykkelStatus`/`HyreStatus`/`RealtimeData` (`lib/hooks/useRealtimeData.ts`) | PRD 11 | LIVE per-POI realtime-hook + dens typer. |
| `useRouteData` + `RouteData` (`lib/map/use-route-data.ts`) | PRD 11 (DATA-hook; PRD 6 rendrer) | Gå-rute-DATA-hook. |
| `POIRealtimeSection` (`blocks/POIRealtimeSection.tsx`) + `formatRelativeDepartureTime` (`lib/utils/format-time.ts`) | PRD 11 | Transport-block + format-util. |

### 5.3 Caching-/revalidering-kontrakt per rute (dokumenteres)

| Rute | Cache-mekanisme | Verdi |
|------|-----------------|-------|
| `/api/entur` (GET) | Next `fetch` `next:{revalidate}` | 30s (`:119`) |
| `/api/bysykkel` (status) | Next `revalidate` + in-process info-cache | status 60s (`:99`), station-info 1t (`:43`) |
| `/api/hyre` | Next `revalidate` | 30s (`:60`) |
| `/api/mobility` | Next `revalidate` | 30s (`:84`) |
| `useRealtimeData` (klient) | `setInterval` poll | 60s (`:50`) |
| `use-route-data` (klient) | debounce, ingen cache (single-slot `useState`) | 200ms debounce (`:37`) |
| `useTravelTimes` (reference-only) | localStorage | 24t (`:13`) |

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. De fire kjerne-transport-proxy-rutene (`entur`, `bysykkel`, `hyre`, `mobility`) portet verbatim med nøkkel-i-header + error-håndtering + per-rute-caching.
2. `useRealtimeData`-hooken (LIVE per-POI realtime) + dens typer.
3. `POIRealtimeSection`-blocken + `formatRelativeDepartureTime`-utilen.
4. `/api/directions`-proxyen + `use-route-data`-hooken (gå-rute-DATA; render = PRD 6), med eierskaps-grense ratifisert.
5. `/api/travel-times`-rutens status + klassifisering av de reference-only dashboard-/explorer-/åpningstids-symbolene (ingen død kode dratt inn i boardet).
6. Verifikasjon at transport FUNGERER på board-flaten (popup + sidebar, mobil + 3D-overlay) + mekaniske porter.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| Board-SKALL-komposisjon/layout (popup-/sidebar-SKALLET blocken mountes i; `isTransportPOI`-plassering) | **PRD 9 (prd-board-skall-ui)** |
| Board-data-transform (surfacing av kobling-IDer på `BoardPOI.raw`) | **PRD 5 (prd-board-data-state)** |
| Image-proxy (POI-bilder) | **PRD 4 (prd-trust-google-places)** (`00-INDEX:77`) |
| Build-time reisetids-precompute (`lib/generators/travel-times.ts`) | **PRD 3 (prd-provisjon)** |
| 3D-motor / rute-layer-RENDER-primitivene (polylinje som konsumerer `RouteData`; mikromobilitet-posisjons-markører) | **PRD 6 (prd-3d-motor)** |
| Reels-AUDIO-«transport»-bunnlinje (`ReelsTransport.tsx` = audio-spiller, navne-kollisjon) | **PRD 14 (prd-audio-tour-reels)** + **PRD 9 (skall)** |
| Eventuell board-transit-DASHBOARD-gjenoppbygging (`useTransportDashboard`/`TransitDashboardCard` reference-only) — krever en navngitt live board-mount-flate | Egen task / koordineres med **PRD 9** hvis en dashboard-flate bestilles (§10 Q3) |
| `useOpeningHours`-reklassifisering (åpningstider, ikke transport) | **PRD 5 (board-data POI-detalj)** hvis den aktiveres på boardet (§10 Q4) |

**Eksplisitt ikke-scope:** render-gating på `reportTier`. Transport-blocken vises ved `isTransportPOI` (kobling-ID-tilstedeværelse), aldri en tier-render-bryter (verifisert 0 `reportTier`-ref i `BoardMap3D`/`ReportReelsPage`; `00-INDEX:85`). Ingen unit bygger en tier-render-bryter.

---

## 7. Implementation Units (7 av 7 dekket)

### Unit 1 — Kollektiv-proxy-port (Entur)
- **Mål (→ G1):** Port `app/api/entur/route.ts` verbatim med bevart nøkkel-i-header, dobbel respons-form og error-håndtering.
- **Filer:** `@/app/api/entur/route.ts` (port).
- **Avhengigheter:** ingen (rot — ekstern API).
- **Akseptansekriterier:**
  1. GET med `stopPlaceId` returnerer BÅDE `quays[]` (per retning) OG flat `departures[]` (første per quay) — begge konsum-formene bevares (`:144-152`; `useRealtimeData` merger quays og re-sorterer `:61-68`, kart-tooltips bruker flat). POST trip-planlegging bevart (`:172`).
  2. API-nøkkel/klient-ID i `ET-Client-Name`-HEADER (`:108-110`), ALDRI i URL-querystring (arkitekturregel).
  3. Error-håndtering bevart: 400 (manglende `stopPlaceId`), 404 (ukjent stopPlace), 500 (ekstern feil + GraphQL-errors) — `:162-167`.
  4. Caching `next:{revalidate:30}` bevart (`:119`).
  5. `npx tsc --noEmit` 0 feil; `npm run lint` 0 errors.

### Unit 2 — Mikromobilitet- + car-share-proxy-port (bysykkel, hyre, mobility)
- **Mål (→ G1):** Port de tre tilgjengelighets-proxyene verbatim med bevarte input-guards, caching og nøkkel-i-header.
- **Filer:** `@/app/api/bysykkel/route.ts`, `@/app/api/hyre/route.ts`, `@/app/api/mobility/route.ts` (port).
- **Avhengigheter:** ingen (eksterne API-er).
- **Akseptansekriterier:**
  1. **bysykkel:** tre modi bevart (radius-aggregat `:113-165`, enkelt-stasjon, alle); `isStationOpen` bruker `Boolean()` (håndterer bool\|int-feed, `:27`); in-process station-info-cache 1t (`:41-72`) + status `revalidate:60` (`:99`); nøkkel via `Client-Identifier`-header (`:54`/`:97`); error 500 (`:214-220`).
  2. **hyre:** `STATION_ID_PATTERN`-input-guard bevart (`:29`, ugyldig→400 `:38-40`); Trondheim-vid query + filtrer på id (`:55-58`); `ET-Client-Name`-header (`:48-51`); `revalidate:30`; error 500 (`:84-89`).
  3. **mobility:** koordinat-bounds + radius-guard (`:55-61`) + `VALID_FORM_FACTORS`-whitelist (`:37-46`) + `MAX_RADIUS=2000` bevart; `ET-Client-Name`-header (`:71-73`); aggregerer `byOperator` + returnerer `positions[]` (`:100-119`); error 500 (`:128-133`).
  4. **Distinkt-rute-bekreftelse:** hyre (station-basert car-share) og mobility (fri-flytende, støtter `CAR`) holdes som SEPARATE ruter — ikke slått sammen (Beslutning 7, §10 Q6).
  5. Trondheim-only-antakelsen (`bysykkel` GBFS-feed `:5`, hyre hardkodet senter `:55-58`) dokumenteres som prototype-scope; ikke generalisert i denne porten.
  6. `npx tsc --noEmit` 0 feil; `npm run lint` 0 errors.

### Unit 3 — Realtime-hook-port (`useRealtimeData`)
- **Mål (→ G2):** Port den LIVE per-POI realtime-hooken med bevart partial-error-tolerant fan-out, abort og poll.
- **Filer:** `@/lib/hooks/useRealtimeData.ts` (port).
- **Avhengigheter:** Unit 1, 2 (rutene den poller), PRD 5 (`BoardPOI.raw`-kobling-IDer den leser).
- **Akseptansekriterier:**
  1. Hooken poller `/api/entur`+`/api/bysykkel`+`/api/hyre` via `Promise.allSettled` (`:127-131`) — én feilende kilde degraderer ikke de andre; `error: "Noe sanntidsdata er utilgjengelig"` settes ved `some(rejected)` (`:146`).
  2. `AbortController` avbryter forrige POIs in-flight fetch ved bytte; `setInterval(60s)` poll + `clearInterval` i cleanup (`:106-158`). Loading-skeleton undertrykkes på poll-oppdateringer (`lastUpdated` allerede satt, `:121-125`).
  3. **Arkitektur-affirmasjon (ikke regelbrudd):** `useEffect`-polleren er det etablerte realtime-mønsteret mot egne proxy-ruter (CARRY-OVER `7`/`344-347`), IKKE den forbudte server-data-`useEffect`-fetchen. Porten BEKREFTER dette i kode-kommentar; ingen Supabase-kall i hooken.
  4. `RealtimePOI` (`:9-14`) + respons-typene (`EnturDeparture`/`BysykkelStatus`/`HyreStatus`/`RealtimeData`) eksportert uendret; `@/`-prefiks bevart.
  5. Hver `fetch` har eksplisitt `!response.ok`-håndtering (`:54`/`:78`/`:90`) — ingen stille svelging (arkitekturregel: ALLTID error-håndter fetch).
  6. `npx tsc --noEmit` 0 feil; eventuelle hook-tester passerer.

### Unit 4 — Transport-block-port (`POIRealtimeSection` + format-util)
- **Mål (→ G3):** Port transport-blocken + format-utilen; koble til skall-flatene fra PRD 9 uten å eie skallet.
- **Filer:** `@/components/variants/report/blocks/POIRealtimeSection.tsx` (port), `@/lib/utils/format-time.ts` (port).
- **Avhengigheter:** Unit 3 (`ReturnType<useRealtimeData>` er prop-formen), PRD 9 (popup-/sidebar-SKALLET blocken mountes i — konsumeres, eies ikke).
- **Akseptansekriterier:**
  1. Blocken rendrer entur-avganger (topp 3, line-color + realtime-prikk), bysykkel (ledige sykler/låser + «Stengt»), hyre (ledige biler) med korrekt skeleton-state ved `loading && !hasAny` (`:20-37`) og `null` ved `!hasAny` (`:39`).
  2. `formatRelativeDepartureTime` portet (`:4`) og brukt for avgangs-visning (`:63`); «Nå»/«1 min»/«N min»-semantikk bevart.
  3. Blocken er presentasjons-ren (prop = `ReturnType<typeof useRealtimeData>`, `:7-9`) — INGEN forretningslogikk/fetch i komponenten (arkitekturregel: ingen forretningslogikk i komponenter; seleksjon/fetch bor i hooken/lib).
  4. **Skall-grense respektert:** blocken mountes av PRD 9-skallet (`BoardPOI3DMiniPopup:144-146`, `BoardPOIMiniPopup:91`, `DesktopStorySidebar:425`); PRD 11 LEVERER blocken + hooken, eier IKKE popup-/sidebar-komposisjonen (`PRD9:69`/`97`/`183`).
  5. **3D-overlay-stabilitet:** når mountet over persistent 3D-kart (`BoardPOI3DMiniPopup`, `BoardMap3D:774`) må blocken ikke tvinge popup-remount/opacity-churn på poll-oppdateringer (PRD 6 WebGL-context-gotcha) — verifiseres i Unit 7.
  6. Lucide-ikoner + tekst (ingen `<img>`); `@/`-prefiks bevart; `npx tsc --noEmit` 0 feil; `npm run lint` 0 errors.

### Unit 5 — Gå-rute-proxy + hook-port (`/api/directions` + `use-route-data`) + eierskaps-avklaring
- **Mål (→ G4):** Port directions-proxyen + gå-rute-hooken (DATA-kilden), ratifiser eierskaps-grensen mot PRD 5/6, og fiks/dokumenter Mapbox-token-i-URL-gotchaen.
- **Filer:** `@/app/api/directions/route.ts` (port + token-fix/dokumentasjon), `@/lib/map/use-route-data.ts` (port + re-pek død-modal-docstring).
- **Avhengigheter:** PRD 6 (rute-RENDER-primitivet som konsumerer `RouteData`: `BoardMap3D:138`, `BoardPathLayer`), PRD 5 (`activePOI`/`projectCenter`-data). §10 Q1 (eierskap).
- **Akseptansekriterier:**
  1. `/api/directions` portet: profil-mapping (walk→walking/bike→cycling/car→driving, `:14-22`), origin/destination + waypoints-form, routes-form (`min→duration`, `:61-73`), 400 (manglende coords)/404 (ingen rute)/500 (`:80-86`) bevart.
  2. **Mapbox-token-i-URL — korrekt rammet (ikke et hemmelig-nøkkel-brudd):** `access_token` ligger i URL-querystring (`:50`). Dette er IKKE nøkkel-i-header-regelbruddet den regelen retter seg mot: tokenet er `NEXT_PUBLIC_MAPBOX_TOKEN` (`:39`) — en bevisst KLIENT-eksponert, offentlig token som allerede shippes i browser-bundlet via `mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}` i dusinvis av kart-komponenter (`BoardMap.tsx`, `ExplorerMap`, `ReportInteractiveMap` m.fl.). CLAUDE.md-regelen «nøkkel i header, aldri URL (lekker i logs)» gjelder HEMMELIGE nøkler (Gemini/Google service-keys), ikke en `NEXT_PUBLIC_`-token. **Mapbox Directions/Matrix støtter dessuten KUN `access_token`-query-param — det finnes ingen `Authorization`-header-variant** å flytte til. Derfor: behold token i URL (kontrakt-bevart port), men (a) garanter at proxyen aldri logger full request-URL, og (b) noter at den reelle herdingen om ønskelig er Mapbox URL-restriction/token-scoping på selve tokenet — ikke header-flytting. Dokumenter dette i kode-kommentar.
  3. `use-route-data` portet: debounce 200ms + `AbortController` + Zod-skjema (max 500 coords DoS-guard, `:19-28`); AbortError svelges stille (forventet ved rask switch, `:93`); andre feil settes på `error`-state uten PII-logging (`:72-76`/`:94`).
  4. **Død-modal-referanse re-pekt:** docstringen nevner `UnifiedMapModal` (død scroll-modal, PRD 6 §4) — oppdater til board-kontekst; `grep "UnifiedMapModal"` på fila returnerer tomt etter port.
  5. **Eierskaps-grense ratifisert (§10 Q1):** PRD 11 eier `/api/directions`-PROXYEN + `use-route-data`-HOOKEN (runtime data-laget); PRD 6 eier polylinje-PRIMITIVET som konsumerer `RouteData`. Grensen dokumenteres i porten; ingen blind sammenslåing med render-laget.
  6. `npx tsc --noEmit` 0 feil; `npm run lint` 0 errors.

### Unit 6 — Travel-times-rute-status + reference-only-klassifisering
- **Mål (→ G5):** Bevar `/api/travel-times` som proxy (uten live konsument), og klassifiser de døde/reference-only symbolene eksplisitt så ingen død transport-kode dras inn i rebuild-boardet.
- **Filer:** `@/app/api/travel-times/route.ts` (port som proxy, status-notat), klassifiserings-notat i `@/docs/rebuild/transport-reference-only.md`.
- **Avhengigheter:** ingen (klassifiserings-/grense-arbeid). Koordineres med PRD 3 (build-time travel-times-eierskap).
- **Akseptansekriterier:**
  1. `/api/travel-times` portet som proxy (POST ≤24-dest Matrix-grense `:22-27`, GET-dup-logikk `:111`, error 500 `:101-107`) med samme Mapbox-token-i-URL-håndtering per Unit 5 AC2-mønster: `access_token` i URL på BÅDE POST (`:66`) og GET (`:171`) — `NEXT_PUBLIC_MAPBOX_TOKEN` er offentlig, Mapbox støtter kun query-param-auth, beholdes i URL med no-log-full-URL-garanti (ikke header-flytting). Notat: **ingen live board-konsument** (eneste runtime-konsument `useTravelTimes` → død `ExplorerPage`); build-time-precompute er PRD 3. (§10 Q2.)
  2. **Reference-only-klassifisering dokumentert** (hver med live-konsument-audit): `useTravelTimes` (kun død Explorer, CARRY-OVER `572-574`), `useTransportDashboard` (kun død scroll-rapport), `TransitDashboardCard` (kun død scroll-rapport, men `next/image`-konform — bevares som referanse), `useOpeningHours` (ingen live board-konsument; åpningstider, ikke transport — §10 Q4).
  3. **Navne-kollisjon dokumentert:** `ReelsTransport.tsx` er audio-spiller-bunnlinjen (PRD 14/9), IKKE en transport-DATA-komponent — eksplisitt utenfor PRD 11.
  4. **Ingen død kode dratt inn:** de reference-only symbolene mountes IKKE i rebuild-boardet; `grep` bekrefter at ingen live board-/reels-sti (`ReportReelsPage`, `BoardMap3D`, board-popup/sidebar) importerer dem.
  5. Dashboard-gjenoppbygging (hvis bestilt) krever en navngitt live board-mount-flate (PRD 9-skall) — deferred, ikke bygget her (§10 Q3).

### Unit 7 — Verifikasjon (live transport på board) + mekaniske porter
- **Mål (→ G6):** Bevis at transport FUNGERER (ikke bare kompilerer): live avganger/sykkel/bil i popup + sidebar, mobil + 3D-overlay; alle porter grønne.
- **Filer:** `@/docs/rebuild/transport-verifikasjon-runbook.md` (verifikasjons-runbook).
- **Avhengigheter:** Unit 1–6.
- **Akseptansekriterier:**
  1. **Live-data-verifikasjon:** Mot et board med transport-POIer (kobling-IDer satt): popup viser ekte Entur-avganger + bysykkel + hyre via `useRealtimeData`; verifisert i 3D-overlay-popup (`BoardPOI3DMiniPopup`) + 2D/mobil-popup + desktop-sidebar (`DesktopStorySidebar:425`).
  2. **3D-stabilitet:** under 60s-poll-oppdatering forblir 3D-popupen stabil (ingen remount/opacity-churn, ingen WebGL-context-tap) — verifiseres i nystartet Chrome (jf. project-memory 3D-context).
  3. **Gå-rute:** `use-route-data` tegner home→POI-rute (via PRD 6-primitivet) ved POI-aktivering; rask POI-switch avbryter forrige fetch uten flimmer (AbortController).
  4. **Partial-degradering:** med én kilde nede (simulert) viser blocken de øvrige + degraderings-melding, ikke total feil.
  5. **Arkitektur-konformitet:** alle proxyer holder HEMMELIG nøkkel i header (entur/hyre/mobility `ET-Client-Name`, bysykkel `Client-Identifier`); Mapbox-token-i-URL (directions/travel-times) er bevisst offentlig `NEXT_PUBLIC_`-token med query-param-auth-only — proxyen logger aldri full URL (Unit 5/6); ingen `reportTier`-render-bryter introdusert; ingen Supabase-kall i transport-laget.
  6. `npm run lint` (0 errors), `npm test`, `npx tsc --noEmit`, `npm run build` grønne.

> **Fullstendighet:** 7 av 7 units dekket. Hver av de 8 transport-relaterte rutene/hookene/blockene fra evidens-pakken er eksplisitt klassifisert: 6 keeper-core (entur, bysykkel, hyre, mobility, useRealtimeData, POIRealtimeSection + format-util), 2 port-with-rewrite grå­sone (directions, use-route-data), og reference-only/dead (travel-times-rute, useTravelTimes, useTransportDashboard, TransitDashboardCard, useOpeningHours, ReelsTransport, generators/travel-times, explorer/story/event-konsumenter, poi-card-expanded+theme-story-modal, ReportMapDrawer). De 3 live `use-route-data`-konsumentene (`BoardMap3D:138`, `BoardPathLayer:26`, `BoardPathMidpointMarker:35`) er enumerert. Ingen sampling.

---

## 8. Utviklingsløp (faser)

### Fase 1 — Proxy-laget (eksterne API-er, offline-testbart)
- **Mål:** De fire kjerne-proxyene + directions/travel-times-proxyene portet med bevart nøkkel-i-header, caching og error-håndtering.
- **Leveranse:** Unit 1, 2 ferdig; Unit 5 AC1-2 (directions-proxy + token-fix) + Unit 6 AC1 (travel-times-proxy-status). Proxyene svarer korrekt mot ekte eksterne API-er.
- **Autonomi-nivå:** Høy. Verbatim-port forankret i verifiserte ruter; Mapbox-token-i-URL er avklart (offentlig `NEXT_PUBLIC_`-token, query-param-auth-only → behold i URL + no-log-garanti, Unit 5 AC2) — ingen åpne designvalg.
- **Forankrer:** CARRY-OVER `745` («Fase 1: API-proxyer + travel-times»).

### Fase 2 — Realtime-hooks + board-blocks
- **Mål:** `useRealtimeData` + `POIRealtimeSection` + `use-route-data` portet og koblet til PRD 9-skall-flatene; reference-only klassifisert.
- **Leveranse:** Unit 3, 4 ferdig; Unit 5 AC3-5 (rute-hook + eierskap) + Unit 6 AC2-5 (klassifisering). `npx tsc --noEmit`/`lint` grønne.
- **Autonomi-nivå:** Middels. Hook-/block-porten er ren, men eierskaps-grensene (directions↔PRD 6, dashboard↔PRD 9) krever koordinering; reference-only-audit krever full grep-dekning.
- **Forankrer:** CARRY-OVER `745` («Fase 2: realtime-hooks + board-blocks»).

### Fase 3 — Live-verifikasjon
- **Mål:** Transport bevist å fungere på board-flaten (live data, mobil + 3D-overlay, partial-degradering); alle mekaniske porter grønne.
- **Leveranse:** Unit 7 ferdig; verifikasjons-runbook med live-data-screenshots + 3D-stabilitets-sjekk i nystartet Chrome.
- **Autonomi-nivå:** Middels. Krever live eksterne API-er + et board med transport-POIer; 3D-stabilitet verifiseres manuelt (project-memory: WebGL-context).

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | Realtime via klient-`useEffect`-polling mot egne proxy-ruter er TILLATT (ikke regelbrudd) | CARRY-OVER `7`/`344-347`; sanntidsdata kan ikke pre-renderes. Board-DATA forblir RSC. |
| 2 | Proxy-ruten er kontrakten; klienten kjenner aldri leverandøren | Normaliserer respons-form, holder nøkkel server-side, setter caching per rute |
| 3 | HEMMELIG API-nøkkel/klient-ID i HEADER, ikke URL | `ET-Client-Name`/`Client-Identifier` (entur/hyre/mobility/bysykkel) er konforme. Mapbox-token-i-URL (directions/travel-times) er IKKE et brudd: `NEXT_PUBLIC_MAPBOX_TOKEN` er offentlig/klient-eksponert (allerede i browser-bundlet) og Mapbox støtter kun query-param-auth — beholdes i URL med no-log-full-URL-garanti (Unit 5 AC2) |
| 4 | Disiplinert error-/loading-/abort-håndtering bæres over | Hver proxy returnerer strukturert 4xx/5xx; hooks bruker `Promise.allSettled` + partial-error + `AbortController` (arkitekturregel: ALLTID error-håndter fetch) |
| 5 | LIVE board-transport = per-POI (`useRealtimeData`+`POIRealtimeSection`), IKKE dashboard | Verifisert: dashboard-konsumentene nås kun via død scroll-rapport; per-POI er den faktisk mountede flaten |
| 6 | `/api/entur` GET beholder BÅDE `quays[]` og flat `departures[]` | To konsum-former fra én rute (avgangsliste merger quays; kart-tooltips bruker flat, `:144-152`) |
| 7 | hyre (station-basert car-share) og mobility (fri-flytende) holdes SEPARATE | Distinkte produkter (hyrenorge/CAR-filter vs vehicles-query); ikke slå sammen (§10 Q6) |
| 8 | `/api/travel-times` beholdes som proxy under PRD 11 men uten live konsument | CARRY-OVER `745` impliserer eierskap; men runtime-konsument er død Explorer, build-time = PRD 3 (§10 Q2) |
| 9 | `useTransportDashboard`/`TransitDashboardCard`/`useTravelTimes`/`useOpeningHours` = reference-only | Live-konsument-audit: alle nås kun via døde produkter/scroll-rapport (motsier manifest-keeper-framing for dashboard) |
| 10 | Transport gater ALDRI på `reportTier`; vises ved `isTransportPOI` | Verifisert 0 `reportTier`-ref i `BoardMap3D`/`ReportReelsPage` (`00-INDEX:85`); delt/nivå-1-capability |
| 11 | PRD 11 eier transport-DATA (proxyer+hooks) + blocks; PRD 9 eier skallet de mountes i | `PRD9:69`/`97`/`183`; «del nedover stacken, diverger oppover i UX» |

### Kontroll-runde 2026-06-27

| # | Funn | Dom |
|---|------|-----|
| K1 | **§10 Q1 RATIFISERT** — `/api/directions` + `use-route-data` eierskap | PRD 11 eier DATALAGET (proxy `app/api/directions/route.ts` + hook `lib/map/use-route-data.ts`); PRD 6 eier render (`BoardPathLayer` + `RouteLayer3D`). 3 live board-konsumenter: `BoardMap3D.tsx:138`, `BoardPathLayer.tsx:26`, `BoardPathMidpointMarker.tsx:35`. `UnifiedMapModal.tsx:249` er 4. importør men DØD (kun via scroll-rapport) — telles ikke som live board-konsument. |
| K2 | **§10 Q2 NYANSERT/LØST** — `/api/travel-times`-runtime-proxy | Kun Explorer konsumerer (`ExplorerPage.tsx:246` via `useTravelTimes`), IKKE board. Board-reisetider = build-time-precompute (PRD 3). **Dom: reference-only** — proxyen beholdes under PRD 11, men har ingen live board-konsument (eneste runtime-konsument lever i Explorer-sporet). Board berøres ikke av denne ruten. |
| K3 | **TransitDashboardCard BEKREFTET død i board** | Mountet KUN på legacy 2D-rapport: `TransitDashboardCard` ← `ReportHeroInsight:133` ← `ReportThemeSection:14` ← `ReportPage:164`. IKKE board. `POIRealtimeSection` (per-POI) er LIVE på board: `BoardPOIMiniPopup:91`, `BoardPOI3DMiniPopup:146`, `DesktopStorySidebar:425` (+ `ReportMapDrawer:226`/`:349`). Bekrefter §4 + Beslutning 5/9. |
| K4 | **§10 Q5 LØST (Andreas)** — mikromobilitet kart-prikker | Per-POI tekst-status holder; boardet rendrer IKKE kart-prikker for ledige sykler/scootere. PRD 11 eier DATAEN (`useTransportDashboard.positions[]` / proxy-`positions[]`); ingen board-render-flate bygges. |

---

## 10. Åpne spørsmål

1. **✅ LØST (Kontroll-runde 2026-06-27 — RATIFISERT).** `/api/directions` + `use-route-data`: LIVE på board med 3 verifiserte board-konsumenter (`BoardMap3D:138`, `BoardPathLayer:26`, `BoardPathMidpointMarker:35`) som tegner home→POI-rutelinjen. **Dom:** PRD 11 eier DATALAGET (proxy `app/api/directions/route.ts` + hook `lib/map/use-route-data.ts`); PRD 6 eier RENDER (`BoardPathLayer` + `RouteLayer3D`). (Manifest-default `753` var reference-only pending avklaring; de live board-konsumentene ratifiserer keeper.) Ingen blind sammenslåing med render-laget — eierskaps-merkelappen er nå ratifisert. *Kontroll-merknad:* kontroll-grep fant en 4. importør, `UnifiedMapModal.tsx:249`, men den er en DØD konsument (UnifiedMapModal mountes kun via `ReportThemeSection`/`ReportOverviewMap` i den droppede scroll-rapporten; board importerer kun `type PendingCamera` derfra) — de 3 enumererte er de live board-konsumentene.
2. **✅ LØST (Kontroll-runde 2026-06-27 — NYANSERT).** `/api/travel-times` + `useTravelTimes`: kontroll bekreftet at runtime-proxyen har KUN Explorer som konsument (`ExplorerPage.tsx:246` via `useTravelTimes`), IKKE board. Board-reisetider = build-time-precompute (`lib/generators/travel-times.ts`, PRD 3). **Dom: reference-only** — `/api/travel-times`-proxyen beholdes under PRD 11, men har ingen live board-konsument; den eneste runtime-konsumenten (`useTravelTimes`) lever i det droppede Explorer-sporet. Board berøres ikke av denne ruten. Bygg ingen ny board-konsument uten bestilling. Klassifiseringen i §4 («reference-only, ingen live board-konsument») og Beslutning 8 står ved lag.
3. **(dashboard-scope)** CARRY-OVER framet `TransitDashboardCard`+`useTransportDashboard` som live MVP-keepers, men de nås kun via død scroll-rapport. Skal PRD 11 (a) porte dashboarden på en NY live board-flate, eller (b) holde den reference-only og kun shippe per-POI `POIRealtimeSection` (som ER live)? **Foreslått (scope-is-sacred-konform):** behold per-POI som live; dashboard-gjenoppbygging deferred til en navngitt PRD 9-skall-mount-flate bestilles — ikke et kutt, en korrekt plassering av mount-ansvaret.
4. **(klassifisering)** `useOpeningHours`: CARRY-OVER `745`-patch la den i PRD 11-keeper-lista, men den har ingen live transport-board-konsument og er åpningstider, ikke realtime-transport. Bekreft om den er PRD 11, PRD 5 (board-data POI-detalj), eller droppet. **Foreslått:** ikke PRD 11; flytt til PRD 5 hvis den aktiveres på boardet.
5. **✅ LØST (Kontroll-runde 2026-06-27 — Andreas-beslutning).** Bysykkel/scooter/fri-bil-`positions[]` (fra `/api/bysykkel`,`/api/mobility`) produseres av data-laget. **Dom:** per-POI tekst-status (ledige sykler/scootere via `POIRealtimeSection`) holder — boardet rendrer IKKE kart-prikker for mikromobilitet. PRD 11 eier DATAEN (`useTransportDashboard.positions[]` / proxy-`positions[]`); ingen board-render-flate for posisjons-markører bygges (verken her eller bestilles av PRD 6). Mikromobilitet-kart-pins er bevisst urealisert på board. Hvis en kart-pin-flate senere bestilles, koordineres den med PRD 6 — men det er ikke i scope nå.
6. **(rute-distinkthet)** Hyre bruker Entur Mobility v2 (samme eksterne API som mobility) men er distinkt rute (CAR/hyrenorge-filter); mobility støtter også `formFactors=CAR` (fri-flytende). Bekreft at begge holdes distinkte (hyre=station-basert car-share, mobility=fri-flytende) og ikke slås sammen. **Foreslått:** distinkte (Beslutning 7) — bekreftet i Unit 2 AC4.

---

## 11. Avhengigheter (PRD-graf)

```
        prd-datamodell-supabase (PRD 1)        prd-board-skall-ui (PRD 9)
        (entur/bysykkel/hyre_station_id          (popup/sidebar-SKALLET +
         kobling-felt på pois)                    isTransportPOI-plassering)
                    │                                    │
                    └──────────────┬─────────────────────┘
                                   ▼
              ┌──── prd-realtime-transport (PRD 11 — DENNE) ────┐
              │            │            │            │           │
              ▼            ▼            ▼            ▼           ▼
        proxy-ruter   useRealtime   POIRealtime  use-route   travel-times
        (entur/bysykkel/  Data       Section      -data       (proxy, ingen
         hyre/mobility)  (Unit 3)    (Unit 4)    (Unit 5)      live konsument,
        (Unit 1,2)                                │            Unit 6)
                                                  ▼
                                          PRD 6 (rute-RENDER-
                                          primitiv konsumerer
                                          RouteData; grå­sone Q1)
```

**Blokkeres av (hard board-blockers, INDEX-grafen `11 realtime (←01,09)`, `00-INDEX:56`):** PRD 1 (kobling-felt), PRD 9 (skall-flatene blockene mountes i).
**Blokkerer:** ingen nedstrøms-PRD (Lag-3 board-feature; `00-INDEX:56`).
**Per-unit consume-edges (consumes/grå­sone — IKKE hard board-blockers i INDEX-grafen, men MÅ materialiseres av beads for at de berørte unitene skal verifisere):**
- **PRD 5** (`BoardPOI.raw`-kobling-IDer) — Unit 3-input til `useRealtimeData`. Ikke-blokkerende for build-start; kreves for Unit 3-verifikasjon.
- **PRD 6** (rute-RENDER-primitivet som konsumerer `RouteData`, `BoardPathLayer`/`RouteLayer3D`) — Unit 5-render-konsument av `use-route-data`. Ikke-blokkerende for build-start; kreves for Unit 5/7-verifikasjon (§10 Q1/Q5).
- **PRD 3** (build-time travel-times-grense, §10 Q2) — koordinerings-edge for Unit 6-klassifisering, ikke en kode-avhengighet.

> **NB — v2-skjema-ripple (00-INDEX note #7) er et no-op for PRD 11.** Transport-laget gjør INGEN DB-kall: proxy-rutene treffer kun eksterne API-er, og kobling-IDene (`entur_stopplace_id`/`bysykkel_station_id`/`hyre_station_id`) konsumeres ferdig-transformert fra PRD 1/5s POI-form (`BoardPOI.raw`), aldri via direkte Supabase-spørring. Verken `.schema('v2')`-tabellkall eller `Accept-Profile`/`Content-Profile:v2`-headere er relevante for dette laget.

---

**Fullstendighet:** 7 av 7 implementation units spesifisert med avhengigheter + akseptansekriterier; 6 av 6 mål (G1–G6) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i prod-schema-snapshot (`:91-93`), CARRY-OVER-MANIFEST (`7`/`344-347`/`572-574`/`745`/`753`), 00-INDEX (`56`/`64`/`77`/`85`), deps-PRD-er (`PRD1:55`/`125-126`, `PRD9:69`/`97`/`183`), og faktisk kode (entur/bysykkel/hyre/mobility/directions/travel-times-routes, `useRealtimeData.ts`, `use-route-data.ts`, `POIRealtimeSection.tsx`, `format-time.ts`, `lib/types.ts:89-91`, board-popup/sidebar-flatene). Ingen P0/P1/P2-tiers; deferred work under Scope Boundaries med PRD-pekere; ingen render-gating på `reportTier` (verifisert). Grå­sone-eierskap RATIFISERT i Kontroll-runde 2026-06-27 (§10 Q1/Q2/Q5 løst — directions/use-route-data = PRD 11 data / PRD 6 render; travel-times = Explorer-spor; mikromobilitet = ingen board-kart-prikker); Q3 (dashboard-gjenoppbygging) + Q4 (useOpeningHours) + Q6 (rute-distinkthet bekreftet) gjenstår som ikke-blokkerende.
