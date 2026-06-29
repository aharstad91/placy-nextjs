# Placy Rebuild — Carry-Over Manifest

> **Kilde-dokument for sommer-rebuilden 2026.** Synker 8 subsystem-audits (159 filer undersøkt) til én verdict-per-modul-liste. Dette er kontrakten alt rebuild-arbeid henger på: hva som bæres over (og hvordan), hva som skrives om, hva som er referanse, og hva som forlates. Skrevet til `docs/rebuild/CARRY-OVER-MANIFEST.md`.

## Lederparagraf

Det runtime-verifiserte produktet er **ÉN board-opplevelse** (`ReportReelsPage` rendret av `/rapport-board`), drevet av en liten, ren 3D-motor (Google `gmp-map-3d` + Google Earth tile-streaming, **0 Mapbox i hot path**), server-rendret board-data (RSC, ingen klient-XHR), og en deterministisk provisjonerings-pipeline (adresse → offentlige API-er → trust → hydrer → editorial-arv). Tier er **ikke** separate kodeløyper — det er capability-gating på data: nivå-1 = autonomt nabolags-board, nivå-2 = nivå-1 + branding + kuratert hero + reels-video + editorial-arv. Arkitektur-mantraet **"del nedover stacken, diverger oppover i UX"** er allerede empirisk bevist av event-board-ruten (`eventToBoardData` → samme skall). Den største enkelt-cruften som **ikke** skal med: Mapbox-2D-stacken (drar `react-map-gl` inn i 3D-bundlen), Trip/Guide-universet, scroll-artikkel-rapporten, place_knowledge-systemet (subsumert av areas/report_editorial), de 13 event-CMS-skraperne, og 69 inkrementelle migrasjoner som skal kollapses til ett rent baseline-skjema. Det kritiske **hullet**: ingen engasjements-instrumentering finnes noe sted — data-moaten (tracking + lokalkunnskap-DB) må bygges inn fra linje 1.

## Headline-stats

**31 keeper-core · 30 port-with-rewrite · 24 reference-only · 17 dead — av 102 distinkte moduler** (etter dedup på tvers av 8 subsystem-audits, 159 filer undersøkt).

---

# KEEPER-CORE — port logikken, bygg rent

## 3D-motor + board-render

### `components/variants/report/board/board-intro-flythrough.ts` — `delt`
- **Why:** Runtime-bekreftet oval-spiral-intro (heading-sveip, range-spiral, center=target hele filmen). Ren `introPoseAt` + parametrisert `IntroPathConfig` gjør den prosjekt-skalerbar. Samme kilde som capture-scriptet. Dette ER 3D-følelsen Placy selger.
- **Deps:** `CameraDrivableMap3D`-interface (cast fra `Map3DElement`).
- **Gotchas:** `center=target` HELE filmen (posisjonen spiraler). `isPaused` leses hver frame → fryser i stedet for restart. `WELCOME_INTRO_SETTLE_MS=1200` (ikke 3500). `WELCOME_CALM_SWEEP_DEG` demper sweep så blobs ikke svinger rundt skjermen.

### `components/variants/report/board/board-establishing-flythrough.ts` — `delt`
- **Why:** Mest matematisk sofistikerte modulen: multi-waypoint helikopter-rute med centripetal Catmull-Rom + buelengde-resampling (konstant fart, ingen hjørne-rykk). Rene `buildDensePath`/`poseAt`, enhetstestbare.
- **Deps:** `CameraDrivableMap3D` fra `board-intro-flythrough`.
- **Gotchas:** Catmull-Rom MÅ være centripetal (alpha=0.5). Naiv farts-parametrisering ga rykk i hjørner (opprinnelig feedback-feil). `SAMPLES_PER_SEGMENT=48`. Kun aktiv via `?establishing=1` + konfigurert rute.

### `components/variants/report/board/board-3d-camera-director.ts` — `delt`
- **Why:** Capability-manifest-mønsteret i praksis: ren, synkron `decideCameraIntent` → free/poi/cinematic/orbit + cut-flagg, enhetstestbar uten kart. INPUT diverger per tier; motoren felles. Prioritets-kjeden (intro>free>poi>cinematic>orbit) er den deklarative kjernen.
- **Deps:** `lib/types` (CameraPose, CategoryCameraConfig).
- **Gotchas:** Cut-deteksjon avhenger av `prevIntent` (feil → cream-flash). `DERIVE_RANGE_MIN=810` bevisst HØYT. `autoOrbit=false` (basic) → kameraet HOLDER der introen landet.

### `components/variants/report/board/use-board-3d-camera.ts` — `delt`
- **Why:** Riktig HVA(ren)/HVORDAN(imperativ)-separasjon med token-kansellering (siste-vinner) — den dokumenterte fiksen på StrictMode-timer-racet. Hardt-vunnet.
- **Deps:** `board-3d-camera-director`, `lib/types`.
- **Gotchas:** `stopCameraAnimation` IKKE pålitelig på rå `Map3DElement` — token er garden. `CUT_FADE_MS` eneste sannhetskilde (CameraCutOverlay leser samme).

### `components/variants/report/board/blob-pois.ts` — `delt`
- **Why:** Rene selektorer (`selectBlobPOIs`, `selectFlyoverBlobs`), ingen React/DOM, enhetstestet. Segment-projeksjon + korridor-filter korrekt. Velger nærhet (ikke score) bevisst — formidler nabolags-bredde.
- **Deps:** `lib/map-utils`, `lib/types`, board-data.
- **Gotchas:** Lokalt meter-rom forankret i start. Dedup på POI-id. `excludeIds` unngår blob OPPÅ legend-pin.

### `components/map/RevealLayer3D.tsx` — `delt`
- **Why:** Sekvensiell inntegning med WebGL-churn-disiplin: kvantisert scale → memo stopper re-raster → re-raster opphører når markør settler. Eneste måten å animere mange gmp-3d-markører uten å sprenge konteksten.
- **Deps:** `@vis.gl/react-google-maps`, `BlobMarker3D`, `Marker3DPin`, `map-icons-filled`, `marker-color`.
- **Gotchas:** ALDRI animer opacity (eksploderte WebGL-kontekster). Scale-bounce + kvantisering. positional-modus krever `at` på alle items.

### `components/map/Marker3DPin.tsx` — `delt`
- **Why:** Korrekt respons på at gmp-3d kun rasteriserer SVG/img. Visuelt 1:1 med 2D (ikon-ratio 0.50). Liten, gjenbrukt av MapView3D + RevealLayer3D.
- **Deps:** `@phosphor-icons/react`.
- **Gotchas:** `scale=1` utelater transform (memo-vennlig). Ratio 0.50 tunet.

### `components/map/BlobMarker3D.tsx` — `delt`
- **Why:** Billigste mulige SVG så re-rasterisering per bounce er lett. Skalerer radius (ikke ramme) → konstant ring-bredde.
- **Deps:** ingen.
- **Gotchas:** scale klampes til 1.3 i radius. scale 0 → usynlig.

### `components/variants/report/board/{use-board-3d-camera,board-3d-camera-director,board-intro-flythrough,board-establishing-flythrough,blob-pois}.test.*` — `delt`
- **Why:** Spec for ATFERDEN keeper-modulene skal ha (cut-deteksjon, ease-grenser, fly-over-sortering, churn-kvantisering). Port-mål: disse skal fortsatt passere. Akseptansekriterie-kilde.
- **Deps:** vitest + respektive moduler.
- **Gotchas:** Testbarhet uten kart er hele poenget med HVA/HVORDAN-splittet — behold den.

## Nivå-1 autonom board-gen

### `scripts/provision-rapport.ts` — `nivå-1`
- **Why:** Eneste bane som produserer det runtime-bekreftede board-et (6 tema, RSC, gmp-map-3d, voiceover på Hans Collins veg 1B). 9 sekvensielle steg adresse→verifisert board + nivå-deklarasjon. Steg-rekkefølgen + fail-soft/kast-høylytt er ratifisert arkitektur.
- **Deps:** `lib/pipeline/*`, `lib/validation/report-tier`, `scripts/load-env`.
- **Gotchas:** `import "./load-env"` MÅ være første import (tsx hoister statiske imports → anon-klient permanent null ellers). Akseptansesjekk ikke bestått før stillNull QA-klarert.

### `lib/pipeline/create-report-project.ts` — `delt`
- **Why:** Hvor tier-as-capability-manifest fødes (`buildReportConfig` skriver reportTier + has_3d_addon). Container-ID `{customer}_{slug}`, merge-semantikk. Datamodell-grunnmuren. Idempotent.
- **Deps:** `lib/supabase/client`, `report-defaults`, `report-tier-schema`, `slugify`.
- **Gotchas:** `as any`-cast forbi typegen — regenerer typer. `has_3d_addon` hardkodes true for ALLE board — verifiser mot tier-manifest.

### `lib/pipeline/import-public-pois.ts` — `nivå-1`
- **Why:** Data-moat-kilden: offentlige rights-clean (NLOD) datasett (NSR nærmeste-per-type, Barnehagefakta, Overpass-idrett, natur-POI). Nivå-1-substans uten kuratering. Deterministisk, dedup via partial unique index.
- **Deps:** `lib/supabase/client`, `slugify`, mig 068/018.
- **Gotchas:** Pre-lookup remapper kilde-ID→eksisterende DB-id. Overpass retry 429/500/406. `linkNaturPois` sletter gamle først (MAX_NATUR=20). NaceKode→skoletype sprø.

### `lib/pipeline/hydrate-report.ts` — `nivå-1`
- **Why:** Produserer det board-et faktisk rendrer: linker project_pois→product_pois, scorer+markerer featured (topp 3/kategori <1500m), bygger product_categories. Featured-scoring kalibrert. product_categories tom = board viser 0 av 0.
- **Deps:** `lib/supabase/client`, `report-defaults`.
- **Gotchas:** Featured SETTES SIST. Sletter+re-inserter ved hver kjøring (featured-flagg går tapt → settes på nytt). N UPDATE-kall i løkke → batch i rebuild. `FEATURED_MAX_DISTANCE=1500`/`TOP_N=3` magiske.

### `lib/pipeline/inherit-area-editorial.ts` — `nivå-2`
- **Why:** Bærebjelken i lokalkunnskap-DB-moaten: kuratert tekst per skolekrets arves automatisk til board i polygonet. Atomisk read-modify-write + optimistisk lås + board-sett-via-render-kodesti = mønstrene rebuild skal bevare. Gating (body ELLER ≥1 highlight = nivå-2) er tier-logikk.
- **Deps:** `find-area-for-point`, `area-staging`, `poi-trust`, queries (dyn), report-data (dyn).
- **Gotchas:** Dynamisk import MÅ bevares (queries leser modul-anon-klient; report-data drar use-client-kjede). config jsonb ELLER streng — bevar formen. PATCH 0 rader = kast. Per-tema-PATCH i løkke FORBUDT. Board-sett via samme transformToReportData.

### `lib/pipeline/find-area-for-point.ts` — `nivå-2`
- **Why:** Gate-keeperen for editorial-arv og nivå-1↔nivå-2-overgangen på data-nivå: ingen kuratert område = rent nivå-1. Ren, fail-soft.
- **Deps:** `lib/supabase/client`, `lib/utils/geo`.
- **Gotchas:** GeoJSON `[lng, lat]`. areas ikke i typer (cast). Overlappende områder → første + warning (sorter deterministisk i rebuild).

### `lib/pipeline/validate-report-trust.ts` — `nivå-1`
- **Why:** Kvalitetsporten mot junk-POI. Read-time-filter (null=vis) biter kun hvis steget kjørte. Bevisst skille kommersielle(score)/offentlige(behold). Filtrering ikke sletting.
- **Deps:** `lib/supabase/client`, `trust-enrichment`, `poi-trust`, `mutations`.
- **Gotchas:** Steg-4 nuller google_website → re-enrichment FØR scoring (to-fase, rekkefølge load-bearing). Mangler nøkkel → stillNull (ikke degradert score).

### `lib/pipeline/report-defaults.ts` — `delt`
- **Why:** Single source of truth for tema→kategori-mapping. 6 runtime-bekreftede temaer + per-by radius. Ren data. Port verbatim. Hele pipelinen + boundary-uttrekkere + hydrering leser dette.
- **Deps:** `report-tier-schema` (type).
- **Gotchas:** Tema-IDene må synkes med `extract-skolekrets-boundary.py` THEME_IDS + `area-staging` VALID_THEME_IDS (drift brekker arv stille). Rebuild: generér Python fra TS. Kategori-slugene verifisert mot GOOGLE_CATEGORY_MAP.

### `lib/pipeline/area-staging.ts` — `nivå-2`
- **Why:** Kontrakt-håndhever for moaten: fanger ugyldig editorial/geometri FØR DB-skriving. Ren, IO-fri, testbar.
- **Deps:** zod, `report-defaults`.
- **Gotchas:** Heterogene POI-IDer (google-/bus-/entur-) — ALDRI valider som UUID. Bind til REPORT_THEME_DEFAULTS.

### `lib/generators/poi-quality.ts` — `nivå-1`
- **Why:** Ren, testet domenelogikk (stengt/avstand/hjemmekontor/navn-mismatch). Build-time grovfilter komplementært til read-time trust. Deterministisk. Port direkte.
- **Deps:** `lib/utils/geo`.
- **Gotchas:** Tett koblet til poi-discovery — flytt sammen til pipeline. Terskler kalibrerte.

### `scripts/extract-skolekrets-boundary.py` — `nivå-2`
- **Why:** Produserer den geografiske enheten moaten er bygget på (skolekrets, runtime-bekreftet boundary-kilde). Rights-clean NLOD. UTM32→WGS84, union→MultiPolygon.
- **Deps:** `data/geo/trondheim/barneskolekrets.json`, pyproj.
- **Gotchas:** Eneste Python i TS-stack. THEME_IDS hardkodet (synk med report-defaults). Trondheim-only. Vurder port til TS med proj4.

## Data-pipeline + Supabase

### `lib/supabase/client.ts` — `delt`
- **Why:** Riktig server/klient-separasjon (CLAUDE.md-compliant). anon (no-store) + createServerClient (service-role). Port.
- **Deps:** `types.ts`.
- **Gotchas:** Modul-anon-klient bygges ved import-tid — scripts MÅ laste env FØRST.

### `lib/supabase/public-client.ts` — `delt`
- **Why:** Løser Vercel Data Cache-problem (persisterer over deploys). RSC-render-arkitekturen avhenger av denne. Port.
- **Deps:** ingen.
- **Gotchas:** `SUPABASE_CACHE_TAG` + 24h koblet til ISR — hold synk.

### `lib/google-places/trust-enrichment.ts` — `nivå-1`
- **Why:** Delt admin-route/pipeline (DRY). Concurrency-pool med deadlock-vern (synkron-throw teller alltid ned) = hardt opptjent.
- **Deps:** `fetch-place-details`, `poi-trust`, `lib/types`.
- **Gotchas:** Manuell running/idx-pool — lett deadlock ved refaktor. Behold vern-kommentaren.

### `lib/google-places/fetch-place-details.ts` — `nivå-1`
- **Why:** Field-mask-økonomi (kun trust-felt). Port.
- **Deps:** `GOOGLE_PLACES_API_KEY`.
- **Gotchas:** Nøkkel i header (CLAUDE.md).

### `lib/google-places/photo-api.ts` — `nivå-1`
- **Why:** Foto til POI-kort (media-tetthet = nivå-skille). Port.
- **Deps:** `GOOGLE_PLACES_API_KEY`.
- **Gotchas:** Cache/proxy, ikke hot-link (Google ToS + next/image).

### `supabase/migrations/038_place_knowledge.sql + 041_knowledge_taxonomy_v02.sql` — `nivå-2`
- **Why:** Lokalkunnskap-DB-moaten i skjema-form. confidence/verified_at/source + display_ready + topic-taksonomi = gjennomtenkt IP. Behold skjemaet nesten verbatim. (Skjema-IP keeper; det gamle systemet rundt er dead.)
- **Deps:** pois, areas (mig 018).
- **Gotchas:** Mangler engasjements-instrumentering — MÅ bygges inn.

### `supabase/migrations/050_areas_hierarchy_strok.sql + 018 + 069` — `nivå-2`
- **Why:** Moat-fundamentet: city→bydel→strøk-hierarki med boundary + report_editorial; seed ~25 Trondheim-strøk. Strøk-granulariteten runtime-bekreftet. Behold skjema + seed.
- **Deps:** 001, pois.
- **Gotchas:** Hardkodede koordinater/postnumre sprø ved grenseendringer. Knowledge-cascade = designintensjon.

## Editorial / grounding

### `lib/gemini/grounding.ts` — `delt`
- **Why:** Eksakt CLAUDE.md-compliant: build-time-only, x-goog-api-key-header, kast-ved-tomt. Feeden bak grounding-disclosure. Ren, liten.
- **Deps:** `gemini/types`, `gemini/sanitize`, zod.
- **Gotchas:** `gemini-2.5-flash` hardkodet. Krever searchEntryPoint ellers kaster (ToS). splitLongParagraphs nødvendig.

### `lib/gemini/sanitize.ts` — `delt`
- **Why:** ToS krever verbatim chip-carousel HTML; DOMPurify-sanering ufravikelig (CLAUDE.md). Test-dekket, https-only.
- **Deps:** isomorphic-dompurify.
- **Gotchas:** Server-side. `ADD_TAGS:['style']` + FORCE_BODY nødvendig ellers kollapser carousellen.

### `lib/gemini/url-resolver.ts` — `delt`
- **Why:** CLAUDE.md-mandert SSRF-guard (DNS pre-resolve + ipaddr unicast). Test-dekket. MÅ bæres uendret.
- **Deps:** `node:dns/promises`, ipaddr.js, p-limit.
- **Gotchas:** Per-hop DNS+range-sjekk bevisst. https-sjekk ETTER redirect-loop.

### `lib/gemini/types.ts + index.ts` — `delt`
- **Why:** Zod-validering av API-shape + barrel-export. Trivielt å porte.
- **Deps:** zod / gemini-submoduler.

### `lib/curation/poi-linker.ts` — `delt`
- **Why:** Gjør curatert narrative til klikkbare POI-chips. UUID-whitelist = cross-tenant-sikkerhet. Test-dekket, deterministisk.
- **Deps:** ingen.
- **Gotchas:** Kun første forekomst/POI/tema. Lengst-navn-først. Verifiser æøå.

### `lib/curation/validator.ts` — `delt`
- **Why:** Anti-hallusinerings-garde (proper nouns må matche grounding ∪ poi_set, fuzzy edit-1). Kritisk for fakta-tillit. Deterministisk.
- **Deps:** ingen.
- **Gotchas:** `DANGEROUS_CHARS_RE` uten `/g` (persistent lastIndex → falske negativer). `LEADING_CAP_STOPWORDS` norsk.

### `lib/curation/sanitize-input.ts` — `delt`
- **Why:** Prompt-injection-forsvar mellom LLM-ledd. Test-dekket.
- **Deps:** ingen.

### `scripts/curate-area.ts` — `delt`
- **Why:** Moatens skrive-verktøy: staging-JSON (polygon + report_editorial) → areas-rad; highlightCandidates arves ned. Konsept+datamodell bæres uendret; bygg som førsteklasses areas-data-layer fra linje 1.
- **Deps:** `area-staging`, `report-defaults`, `geo`, `client`.
- **Gotchas:** areas mangler updated_at → ingen optimistisk lås. createServerClient krever load-env FØRST.

## Audio-tour + reels

### `lib/audio-tour/elevenlabs-client.ts` — `delt`
- **Why:** Runtime-bekreftet (hjem.mp3 spiller). Eneste oppsett (Erik/turbo_v2_5/no/stability 0.75) som ikke faller til svensk/dansk. Build-time-only.
- **Deps:** `pronunciation`.
- **Gotchas:** `language_code 'no'` MÅ settes (kun turbo/flash). Voice/model-endring → audioVersion-bump. /with-timestamps verifisert kun turbo_v2_5.

### `lib/audio-tour/pronunciation.ts` — `delt`
- **Why:** Løser TTS-eksplosiver + karaoke-original-staving. `remapTimingsToOriginal` ikke-triviell, port ~1:1.
- **Deps:** `scripts/tts/pronunciation-no.json`.
- **Gotchas:** Remap → null hvis alignment ikke matcher 1:1. Sti-avhengig i worktrees (process.cwd).

### `lib/audio-tour/storage-paths.ts` — `delt`
- **Why:** Reels-override-mp3 må ALDRI overskrive tour-mp3 (ellers ødelagt karaoke). hjem.mp3 runtime-bekreftet.
- **Deps:** ingen.
- **Gotchas:** special-caser KUN 'home'→hjem.mp3. '-reels'-suffiks-konvensjon.

### `lib/audio-tour/manus.ts` — `delt`
- **Why:** Rene, testede pure functions (ord-telling, banned-words 35-90). Curator-voice.
- **Deps:** `lib/types`, `manus-prompt`.
- **Gotchas:** 35-90 avviker fra manus-curator v3 (~65-75) — synk grensene.

### `scripts/tts/pronunciation-no.json` — `delt`
- **Why:** Data-aktivumet bak pronunciation.ts. Kirurgisk tunet. Gjenbrukbar.
- **Deps:** ingen.
- **Gotchas:** Ikke utvid uten empirisk A/B.

### `components/variants/report/reels/use-reels-audio-orchestration.ts` — `delt`
- **Why:** Hjertet i voiceover-på-board + guidet steg. Bygg tracks ÉN gang, goToTrack på swipe. Ren hook. Port ~1:1.
- **Deps:** `audio-tour-store`, `reels-state`, `reels-data`.
- **Gotchas:** `startedRef`-guard. track-ended via AudioElementProvider.onTrackEnded (ikke store-phase → dobbelt-advance-bug).

### `components/variants/report/reels/KaraokeTeleprompter.tsx` — `delt`
- **Why:** Karaoke-sync = kjerne-opplevelse. Sentence-vindu på pronunciation-remappede timings.
- **Deps:** `KaraokePitchText`, `karaoke-tokens`, `use-audio-element`.
- **Gotchas:** Krever remappede timings ellers vises alias. currentTime fra AudioElementContext.

### `components/variants/report/reels/reels-state.tsx` — `delt`
- **Why:** Definerer runtime-bekreftet app-aktig steg-modell (ikke scroll). To-flate-modell bevisst bort fra buggy snap-stige. Testet.
- **Deps:** `reels-data`.
- **Gotchas:** mapOpen nullstilles per beat. teaserArmed progress-gated, overlever bakgrunn. Subtile invarianter.

### `components/variants/report/reels/reels-data.ts` — `delt`
- **Why:** Transform board-data→reels-feed. Kort-taksonomi + audio-rekkefølge. `reelsAudio ?? audio` = nivå-2-differensiatoren. Testet.
- **Deps:** `board-data`, `category-illustrations`, `audio-tour-store`.
- **Gotchas:** REELS_MONTAGE_PROJECTS hardkodet slug-allowlist — data/asset-flagg i rebuild. reelsAudio override, audio fallback.

## Report board + UI-skall

### `components/variants/report/board/board-data.ts` — `delt`
- **Why:** Den rene tier-gating-grensen: `pickPlayableAudio` (url+manus) + editorial-resolve. Branded BoardPOI/BoardCategory. 'tier = capability-manifest' i praksis.
- **Deps:** `report-data`, `lib/types`, `project-brand`.
- **Gotchas:** `audioTourEnabled` DØDT flagg. topRankedPois score-sortert vs pois distanse-sortert (bevisst).

### `components/variants/report/board/board-state.tsx` — `delt`
- **Why:** Liten, ren, testet navigasjons-reducer (phase, branded IDer). Delt navigasjons-kjerne begge tier bruker.
- **Deps:** `board-data`, `use-sub-category-filter`.
- **Gotchas:** SelectCategorySource-discriminator bærer scroll-arven (kan forenkles). visiblePoiIds = event-søm (inert for bolig).

### `components/variants/report/board/audio-tour/` (KaraokePitchText, karaoke-tokens, use-audio-element, tour-mode.css) — `delt`
- **Why:** Voiceover runtime-bekreftet. use-audio-element = delt provider; token-splitting testet. Brukt av 6 reels-komponenter + layout.
- **Deps:** `audio-tour-store`.
- **Gotchas:** Reels-audio override-akse — ikke overskriv tour-fila. timings optional (pre-v5 → klartekst).

### `app/eiendom/[customer]/[project]/rapport-board/page.tsx` — `delt`
- **Why:** Runtime-bekreftet RSC-server-render (ingen klient-XHR) — håndhever 'ingen useEffect-fetching'. Produksjonsruten. Tema→CSS-injeksjon = nivå-2-branding-gating på server.
- **Deps:** `data-server`, `translations`, `ReportReelsPage`, `theme-utils`.
- **Gotchas:** Tagget cache (`product:{customer}_{slug}`) bustes via revalidateTag (ikke auto-TTL). Legacy-fallback kan droppes.

## Kjerne-domene

### `lib/validation/report-tier.ts` — `delt`
- **Why:** DEN beste eksisterende kilden for "tier = runtime capability-manifest". Ren I/O-fri funksjon som speiler render-gating 1:1 og koder nivå-1/2/3-deltaen empirisk bekreftet. Funn er data, ingen throws. Port nesten verbatim.
- **Deps:** `lib/types`, `report-tier-schema`, `project-brand`.
- **Gotchas:** `audioTourEnabled` valideres bevisst ikke (DØDT). brand/brokers = WARNING ikke ERROR. `has3dAddon` bor utenfor reportConfig.

### `lib/validation/report-tier-schema.ts` — `delt`
- **Why:** Korrekt literal-union (1|2|3) — fanger string/out-of-range fra JSONB. Grunnmur for manifest-parsing.
- **Deps:** zod.

### `lib/themes/theme-definitions.ts` — `delt`
- **Why:** Minimal delt kontrakt for taksonomien. Ren type.
- **Deps:** ingen.

### `lib/themes/project-brand.ts` — `nivå-2`
- **Why:** Asset-flag→fil-sti-oppslag = 'flipp flagg i Supabase'-mønsteret. Branding = nivå-2-differensiator. Port konvensjonen.
- **Deps:** `lib/types`, `stasjonskvartalet-pin-thumb`.
- **Gotchas:** PROJECT_BROKERS + PIN_THUMBNAILS hardkodet demo-data — flytt til Supabase.

### `lib/themes/category-illustrations.ts` — `delt`
- **Why:** 6 tema-illustrasjoner runtime-bekreftet. Ren fallback, riktig asset-flag-mønster.
- **Deps:** `theme-icons`, `lib/types`.
- **Gotchas:** Importerer fra components/ — snu avhengigheten i rebuild.

### `lib/themes/rating-categories.ts` — `delt`
- **Why:** Liten ren domene-regel (ikke rating på transport/natur). Gjenbrukbar.
- **Deps:** ingen.

### `lib/store.ts` — `delt`
- **Why:** Liten, levende (15 konsumenter). Persisterer KUN reiseinnstillinger (sensitiv-data-sjekk PASSERT). useShallow per-felt.
- **Deps:** zustand, `lib/types`.
- **Gotchas:** Trim `activeThemeStory` ved port (Story dør).

### `lib/stores/audio-tour-store.ts` — `nivå-2`
- **Why:** Runtime-BEKREFTET (hjem.mp3, guidet steg, karaoke-progress). Ren state-maskin, IKKE persistert. Voiceover = nivå-2.
- **Deps:** zustand, board-data (BoardCategoryId).
- **Gotchas:** Avhenger OPPOVER på board-data — snu avhengigheten (definer BoardCategoryId i kjerne-domenet).

### `lib/utils/geo.ts` — `delt`
- **Why:** Rene, testede geo-primitiver. Universell grunnmur. Port som-er.
- **Deps:** ingen.
- **Gotchas:** `createCircleCoordinates` er Mapbox-visualisering — lett å droppe.

### `lib/utils/camera-map.ts` — `delt`
- **Why:** Broen Mapbox-zoom ↔ Google-3D-range. Direkte relevant for persistent-3D + oval-spiral. Ren matte, testet.
- **Deps:** ingen.
- **Gotchas:** `range` = avstand-til-senter, IKKE footprint. fov_v 35°.

### `lib/utils/school-zones.ts` — `delt`
- **Why:** Skolekrets = barn-oppvekst-tema + nabolag-DNA. Ren, testet, offline. Del av moaten. Port.
- **Deps:** `geo`, `data/geo/trondheim/*.json`.
- **Gotchas:** Trondheim-only (UTM32 9°E hardkodet). Eneste tillatte POI-navn-unntak i manus-curator.

### `lib/utils/poi-trust.ts` — `delt`
- **Why:** Data-kvalitets-gate i moaten. Ren scoring + batch-pool + deadlock-vern. SSRF-guard matcher CLAUDE.md. Port.
- **Deps:** `lib/types`.
- **Gotchas:** `PRIVATE_IP_PATTERNS`-regex ikke ipaddr.js-grade — harmoniser SSRF-strategi med Gemini.

### `lib/utils/poi-score.ts` — `delt`
- **Why:** Rene, testede scoring-formler. `NULL_TIER_VALUE=2.5` (ikke straff uevaluerte). Port.
- **Deps:** `venue-profiles` (type).

### `lib/utils/marker-color.ts` — `delt`
- **Why:** Delt 2D/3D/kort — riktig 'del nedover'-primitiv. Ren. Port.
- **Deps:** ingen.

### `lib/utils/map-icons-filled.ts` — `delt`
- **Why:** Boardets fylte markør-ikoner. Testet. Phosphor (Lucide mangler fill). Port.
- **Deps:** `@phosphor-icons/react`.
- **Gotchas:** Synk med map-icons.ts — vurder ett kilde-sett.

### `lib/utils/story-text-linker.ts` — `nivå-2`
- **Why:** POI-inline-lenking i editorial/grounding-narrativ. To-pass, lengste-navn-først. Ren. Port. (Overlapper med curation/poi-linker — konsolider til ÉN.)
- **Deps:** `lib/types`.
- **Gotchas:** Matcher hvert POI én gang. AS/SA-strip.

### `lib/hooks/useRealtimeData.ts` — `delt`
- **Why:** Live transport = nivå-1-capability via egne /api-ruter (CLAUDE.md-compliant). useEffect LEGITIMT (polling, ikke initial-fetch). Port.
- **Deps:** `/api/entur`, `/api/bysykkel`, `/api/hyre`.
- **Gotchas:** Polling-sanntid er unntaket fra 'ingen useEffect data-fetch'. Board-data fortsatt RSC.

### `lib/hooks/useIsDesktop.ts + useMediaQuery.ts` — `delt`
- **Why:** Mobile-native UX trenger disse. SSR-trygge. Port.
- **Deps:** ingen.
- **Gotchas:** SSR defaulter false (mobil-først).

## Admin + øvrige varianter

### `components/admin/{icon-picker,color-picker,confirm-dialog,index}.tsx` — `delt`
- **Why:** Rene, små UI-primitiver uten produkt-kobling. ICON_MAP nyttig for kategori-redigering. Lavest risiko.
- **Deps:** lucide-react.
- **Gotchas:** Samkjør ICON_MAP med 6 board-tema.

### `app/event/[customer]/[project]/board/ + lib/event-board/event-board-data (eventToBoardData)` — `delt`
- **Why:** Prototypen på ÉN Placy: samme board-skall/motor foret med event-data via adapter. Har test. Adapter-mønsteret (domene-data → felles BoardData → ett skall) er PRESIS rebuild-arkitekturen.
- **Deps:** `ReportReelsPage`, `event-board-data`, `data-server`, `lib/themes`, `getCollectionBySlug`.
- **Gotchas:** Forveksles med død Event-variant. force-dynamic + collection-rehydrering gode mønstre. Bekreft event-spor før porting.

---

# PORT-WITH-REWRITE — funksjonen trengs, koden skrives om

## 3D-motor + board-render

### `components/map/map-view-3d.tsx` — `delt`
- **Why:** Runtime-bekreftet keeper-motor, men bærer TO motorer: freeMode (boardet, ren Google) + orbit-hijack (~150 LOC, brukes IKKE) + MapboxFallback (drar react-map-gl i bundlen). Port ren freeMode + Marker3DItem/MapReadyBridge; dropp orbit-hijack; lazy/dropp Mapbox. Største enkelt-cruften i motoren.
- **Deps:** `@vis.gl/react-google-maps`, `Marker3DPin`, `BlobMarker3D`, `RevealLayer3D`, `ProjectSitePin`, `Map3DFallback`, `map-icons-filled`, `marker-color`.
- **Gotchas:** `touch-action:none` MÅ settes (mobil). Marker3D re-raster-hopp ved størrelse-endring under bevegelse. Markører altitude>0 ellers okkludert.

### `components/variants/report/board/board-establishing-shots.ts` — `delt`
- **Why:** Per-prosjekt kamera-bane-data trengs, men hardkodet TS-record = prototype. Rebuild: data (DB/JSON), del av prosjekt-DB.
- **Deps:** `board-establishing-flythrough`.
- **Gotchas:** rangeStart===rangeEnd = konstant høyde (lav-kognitiv-last). bloomAtProgress=0.02. Slug uten rute = no-op.

### `components/map/route-layer-3d.tsx` — `delt`
- **Why:** Home→POI-rute i 3D keeper, men StrictMode-race-plaster (3 cleanup-effekter). 'Én langlevet polyline, muter path' er riktig; rewrite til renere livssyklus.
- **Deps:** `map-view-3d`, `use-route-data`, `path-midpoint`, `importLibrary(maps3d)`.
- **Gotchas:** Polyline én langlevet instans (mount/unmount lekker GPU-buffer). path FØR append. Marker3D position read-only.

### `components/map/Map3DFallback.tsx` — `delt`
- **Why:** `useWebGLCheck` (modul-cachet probe + loseContext) er keeper — løste 'Too many active WebGL contexts'. Komponenten er @ts-nocheck + 0 importers. Port hooken, slett komponenten.
- **Deps:** lucide-react (kun død komponent).
- **Gotchas:** KRITISK: hver probe = en kontekst (~16 maks). UTEN cache kjørte den ~8/sek → kaskade-crash.

### `components/variants/report/board/BoardMap3D.tsx` — `delt`
- **Why:** Sentral orkestrator som binder all keeper-logikk — funksjonen er kjernen. Men 786 LOC (6+ effekter, 4 URL-flagg-moduser, sammenflettet markersett). Trekk markersett + flythrough-orkestrering ut i hooks/ren-logikk, hold tynn. *(Dedup: 3D-audit port-with-rewrite vs Board-UI keeper-core → port-with-rewrite vinner.)*
- **Deps:** `map-view-3d`, `use-board-3d-camera`, `board-3d-camera-director`, intro/establishing-flythrough, `board-establishing-shots`, `blob-pois`, `camera-tours`, `route-layer-3d`, `board-state`, `audio-tour-store`, `use-route-data`.
- **Gotchas:** `?film=1` dropper pins på RENDER-nivå (DOM-fjerning krasjer React). Tre intro-eiere AND-et mot establishingMode. Markører full opacity (opacity-reveal eksploderte WebGL). hasVoiceOver styrer autoOrbit OG markersett.

## Nivå-1 autonom board-gen

### `lib/pipeline/enrich-report-pois.ts` — `nivå-1`
- **Why:** Kommersielle POI + foto kjerne, men svelger revalidatePath-exception via string-match og re-teller fra DB — skjør. Skill ren data-henting fra cache-invalidering.
- **Deps:** `import-pois`, `fetch-poi-photos`, `client`.
- **Gotchas:** revalidatePath kaster i CLI → fanges via msg.includes — landmine. Isoler cache fra data-skriving.

### `lib/pipeline/import-pois.ts` — `nivå-1`
- **Why:** POI-import-motoren, men henter fra LEGACY poi-discovery + kaller revalidatePath. Port discovery inn i ren pipeline-modul uten cache-kobling. ("kopiert fra route.ts" — konsolider.)
- **Deps:** `poi-discovery`, `mutations`, `client`, `next/cache`.
- **Gotchas:** Kobler moderne pipeline til legacy generators. Flytt discovery til pipeline, slett generators-avhengigheten.

### `lib/generators/poi-discovery.ts` — `nivå-1`
- **Why:** discoverGooglePlaces/Entur/Bysykkel FORTSATT live (import-pois bruker dem). Bor i legacy-mappe, story-spesifikk map, legacy Places API. Port til pipeline på nye Places API; dropp story-koblingen.
- **Deps:** `lib/types`, `geo`, `slugify`, `poi-quality`.
- **Gotchas:** ALDRI legg-igjen i generators/. Migrer til Places API New. `VALID_TYPES_FOR_CATEGORY` bevar. Stabil ID = source-prefiks.

### `lib/pipeline/geocode.ts` — `nivå-1`
- **Why:** Adresse→koordinat+kommune trengs, men Mapbox v5 (deprecating) + `as any`. Port til v6/Search Box med typede responser; vurder ÉN geo-provider. *(Begge audits enige.)*
- **Deps:** `MAPBOX_TOKEN`.
- **Gotchas:** Kartverket koordsys=4258 (ETRS89). getKommunenummer fail-soft → NSR-skoler mangler stille.

### `lib/generators/trail-fetcher.ts` — `nivå-1`
- **Why:** Turstier legitim board-substans, men kun i LEGACY generate-story. provision-rapport henter ikke trails. Hvis nivå-1-feature: eksplisitt pipeline-steg. Ellers defer.
- **Deps:** `lib/types`, Overpass.
- **Gotchas:** Ikke koblet til moderne fabrikk. Avklar før porting.

### `app/api/generation-requests/route.ts` — `nivå-1`
- **Why:** DEN autonome adresse→board-banen, men lager EXPLORER-produkt UTEN tema/trust/editorial (svakere enn CLI). Re-wire til ÉN komplett report-pipeline; async job-kø.
- **Deps:** `create-project`, `import-pois`, `housing-categories`, `client`.
- **Gotchas:** Self-serve vs CLI produserer ULIKE artefakter. Synkron 5-10 min blokkering. housingType = TREDJE kategorimodell.

### `app/(public)/generer/generer-client.tsx + page.tsx` — `nivå-1`
- **Why:** Self-serve-inngangen rebuild-relevant, ren form, men nær-duplikat av tools-varianten. Konsolider til ÉN adaptiv form.
- **Deps:** `AddressAutocomplete`, `slugify`, `/api/generation-requests`.
- **Gotchas:** Duplikat. boligtype → TREDJE kategorimodell.

### `app/eiendom/(tools)/generer/generer-client.tsx + page.tsx` — `nivå-1`
- **Why:** Nesten identisk med (public); brokerage→getOrCreateCustomer eneste reelle forskjell (verdifull). Kollaps til én komponent med valgfritt brokerage-felt.
- **Deps:** `AddressAutocomplete`, `slugify`, `/api/generation-requests`.
- **Gotchas:** Kopi-lim-divergens — to steder i dag.

## Data-pipeline + Supabase

### `lib/supabase/queries.ts` — `delt`
- **Why:** Oppblåst (1618 LOC), tre generasjoner. Behold ~30% (container/product/radius); dropp legacy story + Guide-trips (~470 LOC); skriv rent.
- **Deps:** `client`, `types`, report-data.
- **Gotchas:** `hasNewSchema()` = teknisk gjeld (dropp fallback). getProductFromSupabase leser reportConfig (load-bearing).

### `lib/supabase/mutations.ts` — `delt`
- **Why:** Keeper: upsertPOIsWithEditorialPreservation, updatePOITrustScore/Tier, upsertCategories. Dødt: writeStoryStructure (scroll-modellen). Port de første.
- **Deps:** `client`, `types`.
- **Gotchas:** writeStoryStructureWithRollback = manuell rollback (Supabase mangler transaksjoner over REST) — vurder RPC/Postgres-funksjon.

### `lib/supabase/types.ts` — `delt`
- **Why:** Domenetypene trengs, men blander keeper + dødt (Trip, story-section). 33k LOC. Re-derive fra nytt skjema.
- **Deps:** ingen.
- **Gotchas:** Avviker fra database.types.ts (any-casts) — to typesannheter, én kilde i rebuild.

### `lib/types.ts` — `delt`
- **Why:** Spinen, tre epoker (1043 LOC). Behold: POI, Coordinates, Category, ReportConfig-grenen, ProjectTheme, PlaceKnowledge. Dropp: legacy Project, Trip/Reward (~300 LOC), Story/ThemeStory/StorySection.
- **Deps:** zod.
- **Gotchas:** groundingVersion discriminated union + .passthrough() — IKKE stram til. POI-IDer heterogene — whitelist ikke UUID. reportTier gater IKKE render (deklarasjon).

### `supabase/migrations/001_initial_schema.sql` — `delt`
- **Why:** pois/categories/projects/customers/project_pois keeper-kjerne. story_sections/theme_stories dødt. Skriv ETT rent baseline-skjema i stedet for 69 migrasjoner.
- **Deps:** ingen.
- **Gotchas:** `pois.id` TEXT (heterogen), ikke UUID — bevisst.

### `supabase/migrations/{014,017,032,033,040,041,056,065,066,067}` (trust/tier/hours/fb/gallery/photo/parent_poi/3d_addon/venue/lead) — `delt`
- **Why:** Reell datamodell-evolusjon (trust_score, poi_tier, opening_hours, gallery, parent_poi_id, has_3d_addon, venue_context). Kollaps inn i ÉT baseline-skjema.
- **Deps:** 001.
- **Gotchas:** has_3d_addon (065) gater 3D-toggle (load-bearing). parent_poi_id (056) = kjøpesenter-hierarki.

### `supabase/migrations/046_generation_requests.sql + 047/048-customer` — `nivå-1`
- **Why:** Self-service megler-flyt aktivt spor (Markus). Status-maskin + consent riktig. Port skjemaet, koble til instrumentering.
- **Deps:** projects, customers.
- **Gotchas:** Public read-by-slug RLS eksponerer email — sjekk PII.

## Editorial / grounding

### `scripts/gemini-grounding.ts` — `delt`
- **Why:** Orkestreringen solid (backup+optimistisk-lås+post-write-verifikasjon = gullstandard), men hardkodet ALLOWED_REPORTCONFIG_KEYS-whitelist. Port orkestreringen, erstatt whitelist med typet config-modell.
- **Deps:** `lib/gemini`, `lib/types`.
- **Gotchas:** TOTAL_FAILURE_THRESHOLD=5/7. revalidateTag `product:${projectId}` må matche page-side. Whitelist hard-failer på ukjent nøkkel.

### `scripts/curate-narrative.ts` — `delt`
- **Why:** grounding-fakta → curatert narrative → groundingVersion 2 keeper, men prepare→fil→skill→apply-dans er omvei. Reorkestrer renere (samme curation-primitiver). Validator+linker bevares.
- **Deps:** `poi-linker`, `sanitize-input`, `validator`, `lib/types`.
- **Gotchas:** Idempotens: skip hvis curatedAt >= fetchedAt. Audit-jsonl per tema — behold for sporbarhet/moat.

## Audio-tour + reels

### `scripts/audio-tour-build.ts` — `delt`
- **Why:** To-fase-mønster (parallell TTS → valider alle → batch write+PATCH) solid, men ~90% overlapp med build-local + reels-build-local. Konsolider til ÉN tier-aware bygger.
- **Deps:** `elevenlabs-client`, `storage-paths`, `lib/types`.
- **Gotchas:** PARALLEL_LIMIT=2 (free-plan). Optimistic lock — concurrent gir 0 rader patched mens MP3 på disk. audioVersion=5 hardkodet.

### `scripts/audio-tour-build-local.ts` — `delt`
- **Why:** Lokal JSON-prototyper, men dupliserer build.ts. Rebuild: DB-vs-lokal = source-adapter. Konsolideres.
- **Deps:** `elevenlabs-client`, `storage-paths`.
- **Gotchas:** Kun tour-spor, ikke reelsAudio.

### `scripts/reels-voiceover-build-local.ts` — `nivå-2`
- **Why:** reelsAudio runtime-relevant (nivå-2 override), men tredje kopi av bygge-loop. Konsolideres. Defensiv -reels-sjekk keeper-læring.
- **Deps:** `elevenlabs-client`, `storage-paths`.
- **Gotchas:** OVERRIDE-akse — aldri overskriv tour-{theme}.mp3.

### `scripts/animate-scene-veo.ts` — `nivå-2`
- **Why:** Reels/splash-video nivå-2 runtime-bekreftet. Veo gir motion for vann/skyer. Solid fallback-kjede. Port til parametrisert funksjon.
- **Deps:** ffmpeg, GEMINI_API_KEY.
- **Gotchas:** Krever slow-motion-prompt. generateAudio IKKE støttet (400) — strip lyd (VO lager all lyd). Pre-crop FØR Veo.

### `scripts/compose-reels-bg.ts` — `nivå-2`
- **Why:** API-fri motpart til Veo. Sentence-boundary-sync (Level B) er kjernemønsteret. Port som funksjon.
- **Deps:** ffmpeg.
- **Gotchas:** Antall bilder = antall beats ellers abort. concat-demuxer bevisst. Ett tema per setning forutsetning.

### `scripts/compose-video-crossfade.ts` — `nivå-2`
- **Why:** Syr Veo-klipp til én reel, fjerner pillarbox via cropdetect, lager web-variant + poster. Port som funksjon.
- **Deps:** ffmpeg, ffprobe.
- **Gotchas:** cropdetect på 60 frames. xfade-offset = sum(varigheter) - i*xfade.

### `components/variants/report/reels/ReportReelsPage.tsx` — `delt`
- **Why:** DET runtime-bekreftede boardet (begge ruter rendrer det), delte nivå-1+2-skallet. 1078 LOC med 5+ ansvar. Tier-divergens er data-gating, ikke kodegrener. Bryt opp; trekk logikk til lib/. *(Enstemmig på tvers av 3 audits.)*
- **Deps:** `reels-state`, `board-state`, `board-data`, `reels-data`, `BoardMap`, `use-reels-audio-orchestration`, `audio-tour-store`.
- **Gotchas:** mapbox-gl.css-import (linje 3) DØDT. BoardMap MÅ være direkte barn (wrapper remounter WebGL). Auto-advance race-rede — port testene. INGEN instrumentering — legg inn.

## Report board + UI-skall

### `components/variants/report/board/BoardMap.tsx` — `delt`
- **Why:** Persistent-3D + 2D-overlay runtime-bekreftet, men halve fila er Mapbox-2D som nesten aldri trigges. Behold persistent-3D-regelen, vurder å droppe Mapbox-2D helt.
- **Deps:** `BoardMap3D`, `BoardMapControls`, `BoardMarker`, `board-state`, `board-camera-fit`, `react-map-gl/mapbox`.
- **Gotchas:** gmp-map-3d kan IKKE loseContext → ALDRI unmount. `!interactive` bruker pointer-events-skjold (Google 3D mangler GestureHandling.NONE).

### `components/variants/report/board/board-camera-fit.ts + camera-tours.ts` — `delt`
- **Why:** Støttemoduler under BoardMap3D (kategori-buer, fit-bounds) med enhetstester. Port med testene (lett rewrite for race-plaster).
- **Deps:** `board-data`, `map-utils`.
- **Gotchas:** To animatorer AND-es fra hverandre.

### `components/variants/report/reels/DesktopStorySidebar.tsx` — `delt`
- **Why:** Desktop-divergert UX (sidekolonne vs mobil bottom-sheet) = mobile-native UX. 788 LOC blander preview/aktiv-kort/megler/event-filter/sanntid. Dekomponer. Diverger oppover, del nedover.
- **Deps:** `reels-state`, `board-state`, `StoryProgressBar`, `reels-data`, `POIRealtimeSection`, `EventFilterPanel`, `useRealtimeData`.
- **Gotchas:** Gjenbruker mobil-maskineri via renderActiveCard (god delt-kjerne). noBrokers/eventFilter = event-produkt.

### `components/variants/report/reels/{IntroReel,CategoryReel,MeglerReel,SummaryReel,ReelSwipeStack,NowPlayingCard,ChapterProgressBar,StoryProgressBar,ReelsTransport,ReelsMenu,use-reels-beat-nav,use-reels-toggle-play}.tsx` — `delt`
- **Why:** Blad-komponenter som realiserer delt opplevelse + mobil-native UX (ReelSwipeStack vertikal swipe). Mostly rene/små, men 16 filer med overlappende ansvar. Konsolider; port UX-mønsteret rent.
- **Deps:** `reels-state`, `reels-data`, `use-audio-element`, `use-reels-beat-nav`, `use-reels-toggle-play`.
- **Gotchas:** introVideoSrc/welcomeVideoSrc hardkodet allowlist (stasjonskvartalet) — bygg som data-felt.

### `components/variants/report/reels/{DesktopReportSplash,MobileReportSplash,EmbedArrivalLoader}.tsx` — `nivå-2`
- **Why:** Branding + kuratert hero + reels-video = nivå-1→nivå-2-delta. Adaptive mobil/desktop. Port; diverger oppover for nivå-2.
- **Deps:** `reels-state`, `reels-data`, `project-brand`, `lib/i18n`.
- **Gotchas:** project-brand slug-konvensjon. EmbedArrivalLoader = megler-iframe-innslagspunkt.

### `components/variants/report/report-data.ts` — `delt`
- **Why:** Felles data-transform 18+ moduler avhenger av (board-data bygger oppå). 654 LOC, halvparten av forbrukerne er død scroll-artikkel. Destiller board-relevante felt.
- **Deps:** `lib/types`, `report-themes`, `theme-icons`, `ReportHeroInsight`.
- **Gotchas:** Bærer scroll-only-felt (upperNarrative/bridgeText). Koordiner datakontrakt med manus-curator/generate-rapport-skillene.

## Kjerne-domene

### `lib/themes/bransjeprofiler.ts` — `delt`
- **Why:** BOLIG_THEMES = 6 runtime-bekreftede temaer (keeper-data). resolveThemeId/THEME_ID_ALIASES/buildCategoryToTheme nyttig render-logikk. Skill ut taksonomien fra cap-logikken (explorerCaps/NAERING/EVENT = baggasje).
- **Deps:** `theme-definitions`, `default-themes`.
- **Gotchas:** opplevelser GLOBAL_DISABLED → 6 ikke 7. Farger som 450-nivå hex.

### `lib/themes/index.ts` — `delt`
- **Why:** Re-eksporterer keeper + reference-only. Barrelen bør kun eksponere kjerne-taksonomien.
- **Deps:** `lib/themes/*`.

### `lib/stores/queue-overlay-store.ts` — `nivå-2`
- **Why:** Triviell UI-toggle koblet til audio-player (nivå-2). Port hvis kø-overlay beholdes.
- **Deps:** zustand.

### `lib/hooks/useTravelTimes.ts` — `delt`
- **Why:** Reisetider nivå-1-capability, men klient-fetch i useEffect — bryter CLAUDE.md. Flytt til server (pipelinen har --skip-travel-times). Behold cache-strategien.
- **Deps:** `lib/store`, `/api/travel-times`.
- **Gotchas:** Direkte regelbrudd. localStorage-cache per (projectId,travelMode).

### `lib/hooks/useTransportDashboard.ts` — `delt`
- **Why:** Transport-dashboard reell board-feature, men 300-LOC klient-hook med useEffect-fetch. Flytt henting server-side, behold aggregerings-logikken (quay-merge, kategori-tabs).
- **Deps:** `useRealtimeData`, `lib/types`.

### `lib/i18n/locale-context.tsx` — `delt`
- **Why:** Locale-state trengs hvis bilingual, men useEffect+localStorage etter mount = hydrerings-risiko. Sett locale server-side (cookie/header/rute).
- **Deps:** `lib/i18n/strings`.
- **Gotchas:** Starter 'no' for SSR-match, detekterer klient etter mount.

## Admin + øvrige varianter

### `app/admin/projects/[id]/project-detail-client.tsx` — `delt`
- **Why:** Prosjekt-CRUD trengs, men 2129-LOC klient-monolitt + dødkode + react-map-gl. Splitt per-fane, ikke 1:1.
- **Deps:** `page.tsx`, `components/admin/*`, `react-map-gl/mapbox`, `./import-tab`, `./trips-tab`.
- **Gotchas:** Kategorier-fanen død. Server-action-props-eksplosjon anti-mønster.

### `app/admin/projects/[id]/page.tsx` — `delt`
- **Why:** Provisjonerings-/mutasjons-ryggraden (server actions + revalidatePath). Logikken keeper, men legacy produktType-modell. Port mutasjons-PATTERNET, ikke skjemaet (→ ÉN tier-modell).
- **Deps:** `client`, `types`, `next/cache`.

### `app/admin/pois/poi-admin-client.tsx + page.tsx` — `delt`
- **Why:** POI-admin essensielt (delt kjerne, moat-relevant). Server-action følger regler. Bind POI-skjemaet til ny moat-datamodell + instrumentering.
- **Deps:** `/api/geocode`, `/api/places`, `client`, `poi-trust`.
- **Gotchas:** useEffect+fetch for geocoding-søk er interaktivt admin-søk — legitimt.

### `app/admin/import/import-client.tsx` — `delt`
- **Why:** POI-bulk-import (Places i radius) fyller nivå-1-boards. En av TRE near-duplicate Mapbox-import-UIer. Konsolider til ÉN POI-discovery-modul (klareste admin-gevinst).
- **Deps:** `react-map-gl/mapbox`, `geo`, `/api/places`.
- **Gotchas:** DUPLIKAT-TRIPPEL (import-client + import-tab + generate-client).

### `app/admin/generate/generate-client.tsx` — `delt`
- **Why:** Auto-provisjonering lagde ~22 demo-boards. Tredje Mapbox-radius-UI, legacy story-writer. Avklar kanonisk vei: skill for kuratert nivå-2, admin for bulk nivå-1.
- **Deps:** `react-map-gl/mapbox`, `/api/story-writer`, `geo`.

### `app/admin/{customers,categories,requests,knowledge,public}/` — `delt`
- **Why:** Kunde/kategori-admin = infra som overlever. Behold data-modellene, bygg nytt admin (requests/editorial/stories krymper). (NB: knowledge-admin-KOMPONENTEN er dead — se dead-seksjon; konseptet gjenoppbygges mot areas.)
- **Deps:** `client`, `curated-lists`, `types`.
- **Gotchas:** requests-admin avhenger av kanonisk provisjonerings-vei.

### `app/admin/page.tsx + layout.tsx + admin-sidebar.tsx + admin-secondary-nav.tsx` — `delt`
- **Why:** Admin trenger skall, men CRUD-chrome bundet til legacy 3-produkt-IA. Bygg nytt minimalt skall rundt tier-modellen. ADMIN_ENABLED-gate fornuftig.
- **Deps:** `client`, `curated-lists`, lucide-react.
- **Gotchas:** Sidebar lenker til seksjoner som dør — ikke port nav.

### `app/api/story-writer/route.ts` — `delt`
- **Why:** Provisjonerings-API (admin/generate + (public)/generer). Deterministisk, INGEN runtime-LLM. Re-mapp output-skjemaet til board-data/tier-manifest.
- **Deps:** `queries`, `mutations`, `story-writer`, `story-structure`.
- **Gotchas:** Verifisert ingen runtime-LLM. ADMIN_ENABLED-gate korrekt.

---

# REFERENCE-ONLY — oppslag, ikke port

## 3D-motor
- **`components/map/UnifiedMapModal.tsx`** (`n/a`) — 2D/3D-toggle for SCROLL-rapporten, ikke boardet. Oppslag for toggle-mønster. Dokumentert i patterns/unified-map-modal-2d-3d-toggle-20260415.md.
- **`lib/map/map-adapter.ts + use-interaction-controller.ts`** (`n/a`) — Camera-adapter, eneste konsument UnifiedMapModal. Token-pattern = samme som use-board-3d-camera; konsolider til én.
- **`components/map/{map-view,poi-marker,route-layer,marker-tooltip,trail-layer,adaptive-marker,venue-cluster-marker}.tsx + index.ts`** (`n/a`) — Legacy 2D Mapbox-stack (Explorer/Trip/Story/scroll). MapboxFallback-grenen i map-view-3d er ENESTE kobling — kutt den.

## Nivå-1 autonom board-gen
- **`scripts/fetch-area-boundary.ts`** (`nivå-2`) — Kommune-skala TESTET OG FORKASTET (Malvik). Kommune-subsett krever dissolve-bibliotek (mangler).
- **`scripts/generate-story.ts`** (`n/a`) — Superseded av provision-rapport. **VIKTIG: generate:story peker hit; verifiser hvilke skills (generate-bolig/hotel/naering) kjører den FØR sletting, re-pek mot provision-rapport.**

## Data-pipeline + Supabase
- **`lib/pipeline/create-project.ts`** (`n/a`) — Se DEAD (dømt dead vs reference-only; dead vinner).
- **`lib/pipeline/housing-categories.ts`** (`n/a`) — Explorer self-service. report-defaults autoritativ.
- **`lib/supabase/database.types.ts`** (`n/a`) — Auto-generert, regenereres. Referanse for felt/relasjoner. Inneholder projects_legacy.
- **`lib/supabase/translations.ts + index.ts`** (`n/a`) — i18n ikke i board-scope.
- **`supabase/migrations/{020-031,049,053-064}_*editorial*`** (`n/a`) — ~25 engangs data-seeds. DATA ikke skjema. Ekstraher Sem&Johnsen-innholdet inn i nytt place_knowledge/areas.report_editorial — ikke mist det.
- **`scripts/import-{atb-stops,bysykkel,taxi-stands,hyre-stations,kommune-pois,riksantikvaren,kml}.ts`** (`nivå-1`) — Datakildene verdifulle. Bryter @supabase/supabase-js-regelen. KILDE-REFERANSE (endepunkter/parsing), re-implementer via pipeline.

## Editorial / grounding
- **`scripts/poc-gemini-grounding.mjs`** (`n/a`) — Superseded av lib/gemini.

## Audio-tour + reels
- **`lib/audio-tour/manus-prompt.ts`** (`delt`) — Flyttet til manus-curator-skillet. Referanse for stemme/register.
- **`scripts/audio-manus-write.ts`** (`delt`) — Superseded av manus-curator. Behold DB-PATCH/optimistic-lock-mønsteret.
- **`scripts/compose-some-video.ts`** (`n/a`) — Overhalt. Single-pass-mønsteret eneste læring.
- **`scripts/elevenlabs-norsk-validation.ts`** (`n/a`) — Erik valgt. Referanse for HVORDAN re-validere stemme (full pipeline).
- **`scripts/tts/{tune,confirm}-pronunciation.mjs`** (`delt`) — Referanse-verktøy ved nytt problemord.

## Report board + UI-skall
- **`app/.../rapport/page.tsx + ReportPage.tsx`** (`n/a`) — Gammel scroll-artikkel. Oppslag for tema-narrativ/grounding/kilder.
- **`components/variants/report/ (ReportThemeSection, ReportHero, ReportSummarySection, ReportThemeMap, ReportOverviewMap, ReportThemeChipsRow, ReportFloatingNav, ReportCuratedGrounded, blocks/)`** (`n/a`) — Aktive scroll-komponenter (kun /rapport). blocks/ReportOverviewMap deler report-3d-config (DEFAULT_CAMERA_LOCK) med board — den DELTE biten keeper.
- **`app/.../story/page.tsx + visning/page.tsx`** (`n/a`) — Explorer-derivater. Referanse hvis Explorer/Guide gjenopptas.
- **`components/variants/report/board/event/ (BoardCollectionDrawer, EventDetailPanel, EventFilterPanel, EventMobileSheet)`** (`n/a`) — Event-board-modus (Kulturnatt). Bevis på tier-/produkt-agnostisk skall. EventMobileSheet eier egen map-mount (mobil-UX kan divergere på samme motor).

## Kjerne-domene
- **`lib/themes/default-themes.ts`** (`delt`) — Fallback legacy-id-taksonomi. BOLIG_THEMES kanonisk.
- **`lib/themes/muted-palette.ts`** (`delt`) — Migrerings-shim. Lagre 450-fargene direkte.
- **`lib/themes/apply-explorer-caps.ts + venue-profiles.ts + profil-filter-mapping.ts`** (`n/a`) — Explorer-logikk. apply-explorer-caps-algoritmen (nearby-guarantee + tier-then-score) god referanse for server-side POI-utvelgelse.
- **`lib/hooks/useGeolocation.ts`** (`n/a`) — Explorer-origin. Hysterese-mønsteret referanse hvis 'min posisjon' legges til board.
- **`lib/i18n/strings.ts + explorer-strings.ts`** (`delt`) — Bilingual UI-lag. Én i18n-strategi fra start i rebuild.
- **`lib/i18n/apply-translations.ts`** (`delt`) — @deprecated Project-type. Overlay-mønster referanse.
- **`middleware.ts`** (`delt`) — Hardkodet legacy-redirects. Dokumentasjon av gamle URLer hvis SEO-bevaring.

## Admin + øvrige varianter
- **`app/admin/projects/[id]/import-tab.tsx`** (`delt`) — Duplikat av import-client. Behold for edge-cases, slett etter konsolidering.
- **`app/admin/trips/`** (`n/a`) — Trip/Guide-admin (2600 LOC). Referanse for stopp-sekvens-UI. Board Fortsett-steg er IKKE Guide-trips.
- **`app/admin/projects/[id]/story/ + discovery-circles-editor.tsx`** (`n/a`) — Story-editor. discovery-circles mønsterverdi for tema-soner.
- **`components/variants/explorer/ (17 filer)`** (`n/a`) — Explorer (5072 LOC Mapbox). BottomSheet/ThemeChips/POI-kort = interaksjons-ideer for board-mobil. Hent MØNSTERET.
- **`components/variants/trip/ (12 filer)`** (`n/a`) — Trip/Guide (2787 LOC Mapbox). TripIntroOverlay/CompletionScreen UX-referanse.
- **`components/variants/story/ (20 filer)`** (`n/a`) — Story (2456 LOC Mapbox). StoryMapReveal/ThemeBridge ide for tema-til-tema-kamera.
- **`app/event/[customer]/[project]/page.tsx + layout.tsx`** (`n/a`) — Event-Explorer-rute (legacy). Erstattet av event/board.
- **`app/for/ (TripLibraryClient + trips/[tripSlug])`** (`n/a`) — Kunde-trip-bibliotek (dødt Guide).
- **`app/(public)/ (15 filer SEO-microsite)`** (`n/a`) — Explorer/Guide-katalog. JsonLd + getStaticMapUrlMulti gjenbrukbare SEO-byggeklosser hvis offentlig flate trengs.

---

# DEAD — slett ved rebuild-start (0 importers / forlatt spor)

## 3D-motor
- **`components/map/master-map.tsx + MarkerActionButtons.tsx + Map3DControls.tsx`** — 0 importere (grep). Map3DControls erstattet av BoardMapControls.

## Nivå-1 autonom board-gen
- **`lib/pipeline/create-project.ts`** — Lager explorer-produkt uten tema/tier/3d. Roten til self-serve↔CLI-spriket. *(reference-only vs dead → dead vinner.)*

## Data-pipeline + Supabase
- **`scripts/import-{festspillene,kulturnatt,olavsfest,arendalsuka,oslo-kulturnatt,oslo-open}.ts`** (1300 LOC) — PARKERT event-spor. Skjøre CMS-skrapere. Bryter @supabase/supabase-js-regelen.
- **`supabase/migrations/{016,034,035,036,037}_trip* + 042/044/045/052`** — Trip-library-skjema (Guide). Referanse hvis Guide gjenopplives.
- **`supabase/migrations/{006,007}_project_hierarchy + projects_legacy/project_pois_legacy`** — Migreringsartefakter. hasNewSchema()-fallback finnes KUN pga disse — fjern sammen.

## Editorial / grounding
- **`scripts/backfill-knowledge.ts`** (548 LOC) — Forlatt place_knowledge-system (Feb 2026). sha256-dedup-mønsteret verdt å huske.
- **`scripts/reclassify-knowledge-v02.ts + pass2.ts`** (441 LOC) — Engangs hash-id-migrering. Verdiløst.
- **`app/admin/knowledge/knowledge-admin-client.tsx + page.tsx`** (297 LOC) — Forlatt place_knowledge-UI (19-topic). app/admin/editorial er 'Kommer snart'-stub (også dead). Kurator-flate-KONSEPTET er moat-relevant — bygg ny mot areas. *(Admin-audit port-with-rewrite vs editorial-audit dead → dead for komponenten.)*

## Audio-tour + reels
- **`scripts/voiceover-reels-{transport,hverdagsliv,barn-oppvekst,mat-drikke,natur,opplevelser,trening}.ts`** (2600 LOC) — SOME-spike, hardkodet manus, Desktop-output. 'opplevelser' = utgått 7-tema. Behold ÉN som referanse for timings→compose-reels-bg, slett resten.
- **`scripts/voiceover-some.ts`** (114 LOC) — Engangs SOME-VO. Superseded.
- **`scripts/compose-slideshow.ts`** (200 LOC) — Erstattet av compose-reels-bg + crossfade.

## Kjerne-domene
- **`lib/themes/stasjonskvartalet-pin-thumb.ts`** — 28KB inline base64 for én slug. Last fra Supabase storage.
- **`lib/themes/map-styles.ts`** — Mapbox-spesifikk. 0 Mapbox i board.
- **`lib/hooks/useTripCompletion.ts`** — Guide/Trip, frozen.
- **`lib/validation/trip-schema.ts + lib/errors/trip-errors.ts`** — Guide/Trip, frozen.

## Report board + UI-skall
- **`app/.../rapport-reels/page.tsx`** — Duplikat-rute, rendrer samme ReportReelsPage. 0 inbound. RUTEN er død, ikke KOMPONENTEN.
- **`components/variants/report/ (ReportDensityMap, ReportSidebarNav, ReportCompactList, ReportLocaleToggle, ReportThemeIndex, ReportGroundingChips, ReportGroundingInline, ReportInteractiveMapSection)`** (1200 LOC) — 0 importers (grep). ReportGroundingChips-KOMPONENTEN død, DATAFELTET lever via board-data.
- **`components/variants/report/paraform/ (4 filer) + rapport-paraform/page.tsx`** (600 LOC) — '(Paraform-prototype)'. Inspirasjon fra screenshots, ikke kode.

## Admin + øvrige varianter
- **`components/variants/visning/VisningPage.tsx`** (147 LOC) — Eldst, QR-side, ingen board-kobling.
- **`components/variants/portrait/ (7 filer)`** (657 LOC) — NULL route-referanser. Klareste dead-funn.

---

## Dedup-konflikter (notert)

| Modul | Audits | Valgt | Begrunnelse |
|---|---|---|---|
| `BoardMap3D.tsx` | 3D: port-with-rewrite / Board-UI: keeper-core | **port-with-rewrite** | Strengeste; 786 LOC må dekomponeres |
| `ReportReelsPage.tsx` | Audio/Board-UI/Reels: alle port-with-rewrite | **port-with-rewrite** | Enstemmig |
| `lib/pipeline/create-project.ts` | Autonom-gen: dead / Data: reference-only | **dead** | Feil produktmodell, erstattet |
| `lib/pipeline/geocode.ts` | begge: port-with-rewrite | **port-with-rewrite** | Enige |
| `lib/pipeline/hydrate-report.ts` | keeper-core (begge) | **keeper-core/nivå-1** | Featured = nivå-1-substans |
| `app/admin/knowledge` | Admin: port-with-rewrite / Editorial: dead | **dead** (komponent) | Forlatt place_knowledge; konsept→areas |
| place_knowledge (038/041) | Editorial: drop / Data: keeper-core | **keeper-core** (skjema-IP) | Skjemaet er moat-IP |
| POI-link-logikk | story-text-linker + curation/poi-linker | **begge keeper, konsolider** | Én implementasjon i rebuild |

---

# Kritiker-patcher (lukket 2026-06-26)

> **Overstyrer body der de er i konflikt.** Adversarisk completeness-pass fant 4 patch-kategorier før manifestet er trygt for FULL PRD-produksjon. Alle lukket her, forankret i runtime-sjekk (Chrome) + prod-skjema-introspeksjon (Supabase).

### Ny PRD (15.) — `prd-realtime-transport.md` [nivå-1, ~6u, deps: prd-datamodell-supabase, prd-board-skall-ui]
**RUNTIME-BEKREFTET levende på board-MVP-flaten** (25 `transit`-klassede DOM-elementer + «Transport & Mobilitet, 9 steder»-tema på Hans Collins-boardet). Var det STØRSTE hullet — rendret men uten PRD. Keeper: `lib/hooks/{useRealtimeData,useTransportDashboard(11KB),useTravelTimes,useOpeningHours}`, `components/variants/report/blocks/{POIRealtimeSection,TransitDashboardCard}`, API-ruter `app/api/{entur,bysykkel,mobility,hyre,travel-times,directions}`. Prod-`pois`-skjema bekrefter koblings-feltene `entur_stopplace_id`/`bysykkel_station_id`/`hyre_station_id`. Fase 1: API-proxyer + travel-times. Fase 2: realtime-hooks + board-blocks.

### Manglende homes — foldet inn i eksisterende PRD-er (ikke nye PRD-er → holder unit-count ≤8)
- **i18n** (`lib/i18n/{strings,apply-translations,locale-context}` + `supabase/translations` + `translations`-tabell) → **prd-board-data-state** (report-data importerer `getThemeQuestion/t/interpolate`). EN/NO.
- **bridge-text-generator.ts (14KB)** + **category-score.ts** → **prd-board-data-state** (report-data → `generateBridgeText`/poi-score). category-score-bruk avklares serielt.
- **cache-revalidering** (`app/api/{revalidate,revalidate-once,admin/revalidate}`) → **prd-grounding-curation** (revalidateTag-arkitekturregelen bor der grounding-cachen bustes).
- **middleware.ts (5.3KB)** (routing/locale/admin-guard) → **prd-self-serve-admin** som eksplisitt unit.
- **image-proxy** → **prd-trust-google-places** (Google-foto-proxy).
- **lib/map/{map-adapter,use-interaction-controller,use-route-data}** → AVKLAR serielt: keeper (port adapter-grensen) vs dødt 2D-mellomlag som droppes med Mapbox. Tester finnes. Default-antakelse til avklart: **reference-only**.

### Konflikter løst
1. **story-text-linker dobbelteierskap** → eies av **prd-grounding-curation** (konsolideres med `curation/poi-linker` der). prd-lokalkunnskap-moat KONSUMERER, eier ikke.
2. **tier render-gating-akseptansekriterium** → REFORMULERT til «validator fanger manglende required elements per tier (deklarasjon+validering)». Render-laget gater IKKE på reportTier (verifisert: ingen reportTier-ref i BoardMap3D/ReportReelsPage; jf. `project_report_tier_model`). **IKKE bygg render-gating.**
3. **import-pois (Google, 12KB) vs import-public-pois (NSR/Barnehagefakta/Overpass, 16KB)** → DISTINKTE, begge keeper i prd-provisjon. Ikke merge.
4. **report-defaults.ts** (fysisk i `lib/pipeline/`) → eies av prd-tier-capability-manifest (taksonomi-kilde); prd-provisjon konsumerer.

### Uverifiserte keepers — håndtering
- **eventToBoardData** → **reference-only** (event-sporet PARKERT, jf. `project_trondheim_events_spor`). Brukes som adapter-BEVIS for produkt-agnostisk board-data-grense, IKKE portes som aktiv kode. Fjernet som aktiv unit fra prd-board-data-state.
- **audio-bygger-konsolidering** (audio-tour-build + build-local + reels-build-local → én) → RISIKO per `reference_reels_audio_override` (reels-audio = override-akse, ikke replacement; konsolidering kan klobbe karaoke). INSPISER serielt før porting.
- **instrumenterings-PRD = 100% greenfield** (VERIFISERT: ingen analytics-dep i package.json; ingen events-tabell blant 24 prod-tabeller). Prototyp event-skjema + én server-action-logg TIDLIG og serielt, ikke parallelt med avhengige PRD-er.

### Migrasjons-baseline forankret (høyest-risiko irreversibel op de-risket)
Autoritativt prod-skjema introspisert → **`docs/rebuild/prod-schema-snapshot.txt`** (24 tabeller, full kolonne-dump). Erstatter «18 navngitte av 73»-gjettet.
- **KEEPER-tabeller** (baseline SKAL inneholde): areas(17 kol), categories(5), category_slugs(6), customers(3), generation_requests(18), place_knowledge(15), pois(53), product_categories(3), product_pois(5), products(10), project_pois(3), projects(22), translations(8).
- **LEGACY/DROP** (baseline SKAL IKKE inneholde): projects_legacy(16), project_pois_legacy(2), collections(6), trips(25), trip_stops(9), project_trips(14), story_sections(11), theme_stories(8), theme_story_sections(7), theme_section_pois(3), section_pois(3) — Trip/Guide + scroll-artikkel-rapport-stacken.
- `pois`-skjema bekrefter keeper-felt: entur/bysykkel/hyre_station_id (realtime), trust_score/trust_flags (trust), editorial_hook/local_insight/editorial_sources (moat), story_priority.

### Oppdatert byggrekkefølge-tillegg
`prd-realtime-transport` legges inn etter `prd-board-skall-ui` (steg 10.5). Totalt **15 PRD-er**. i18n/bridge-text/cache/middleware/image-proxy er units i eksisterende PRD-er, ikke egne PRD-er.