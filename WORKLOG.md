# Worklog

<!-- Each entry is a YAML block. Most recent first. -->

---
date: 2026-04-15
action: google-maps-3d-touch-fixes
files:
  - components/variants/report/blocks/Report3DMap.tsx (to fix-er)
  - components/map/Map3DFallback.tsx (revert iOS-fallback)
branch: main
summary: To touch-fixes for Google Maps 3D — (1) unmount preview ved modal-åpning for å unngå WebGL-krasj på iOS, (2) pointer-events-none på preview-wrapper for pålitelig tap-to-open på alle touch devices.
detail: |
  PROBLEM: Chrome på iOS krasjet ved åpning av 3D-modal.
  ROTÅRSAK: To samtidige WebGL-kontekster (preview + modal). iOS WebKit
  tåler kun én aktiv WebGL-kontekst per side — krasjer stille ved to.

  FIX 1 — Én WebGL-kontekst:
  - {!sheetOpen && <MapView3D preview />} — preview fjernes fra DOM
    i det modal åpner, slik at kun modal-konteksten lever.
  - Gjelder alle touch devices, ikke bare iOS.

  FIX 2 — pointer-events-none på preview-wrapper:
  - Google Maps 3D (WebGL custom element) kan fange touch-events og
    blokkere knappens click-handler på touch devices.
  - pointer-events-none på wrapper-div → alle taps rutes til <button>,
    ikke til WebGL-elementet.

  REVERT: iOS-fallback til Mapbox (forrige commit) fjernet —
  problemet var kontekst-krasj, ikke iOS-inkompatibilitet.
  Google Maps 3D støtter iOS WebKit (iOS 15+) fint med én kontekst.

---
date: 2026-04-15
action: report-3d-map-modal-sheet-migrering
files:
  - components/variants/report/blocks/Report3DMap.tsx (Dialog→Sheet)
branch: main
summary: Migrerte Report3DMap fra shadcn Dialog til Sheet (side=bottom) — 3D-kartet bruker nå identisk Apple-style slide-up modal som Mapbox-kartet i ReportThemeSection.
detail: |
  - Byttet Dialog/DialogContent/DialogTitle → Sheet/SheetContent/SheetTitle
  - Same klasser som ReportThemeSection: !inset-x-0 !bottom-0 !top-[8vh],
    md:!inset-x-[4vw] md:!top-[5vh], rounded-t-2xl
  - Same slide-up animasjon: map-modal-slide-up (400ms) / map-modal-slide-down (300ms)
  - Visuell paritet verifisert i browser — begge modaler identiske i opplevelse

---
date: 2026-04-15
action: google-maps-3d-pan-firkant-og-prosjektmarkør
files:
  - components/map/ProjectSitePin.tsx (NY)
  - components/map/map-view-3d.tsx (panRadiusKm→panHalfSideKm, projectSite-prop)
  - components/variants/report/blocks/Report3DMap.tsx (sender projectSite)
  - components/variants/report/blocks/wesselslokka-3d-config.ts (panHalfSideKm: 1.5)
branch: feat/report-3d-map
pr: aharstad91/placy-nextjs#65
summary: To forbedringer — (1) tydeliggjør at pan-boksen alltid har vært en firkant (navnebytter til squareBoundsAround/panHalfSideKm), setter halvside til 1.5km; (2) ny prosjektmarkør-chip som flyter 30m over tomten og viser prosjektnavn + "Nybygg 2028".
detail: |
  PAN-FIRKANT:
  - radiusToBounds/panRadiusKm ga sirkel-assosiasjoner men returnerte alltid
    rektangulær south/north/west/east-boks (Googles Map3D bounds IS firkant).
  - Rename til squareBoundsAround/panHalfSideKm + oppdaterte kommentarer.
  - cos(lat)-korreksjonen er beholdt — gjør firkanten kvadratisk i meter
    (viktig på breddegrad 63° der 1° lng ≈ 50km, ikke 111km).
  - Halvside 1.5km → 3×3km totalboks rundt Wesselsløkka.
  - Større boks = kanten treffes sjeldnere i vanlig navigasjon.

  PROSJEKTMARKØR (ProjectSitePin):
  - SVG label-chip: avrundet pill-form, mørk bakgrunn (#1a1a1a).
  - Bygningsikon (manuell Lucide Building2-path), prosjektnavn i hvit bold,
    undertittel "Nybygg 2028" i gull (#e8b86d).
  - Liten pil peker ned mot tomten.
  - Rendres som Marker3D ved projectSite.lat/lng, altitude=30m
    (AltitudeMode.RELATIVE_TO_GROUND) → flyter tydelig over jordet.
  - Alltid synlig — ikke del av tab-filter.
  - projectSite-prop på MapView3DProps; Report3DMap sender mapCenter + projectName.
  - SVG text/rect fungerer i Google 3D fordi browser rasteriserer SVG til
    tekstur FØR Google prosesserer markøren.

---
date: 2026-04-15
action: google-maps-3d-rapportblokk-med-ui-kontroller
files:
  - components/map/Marker3DPin.tsx (NY)
  - components/map/map-view-3d.tsx (NY)
  - components/map/Map3DControls.tsx (NY)
  - components/map/poi-marker-3d.tsx (SLETTET — brokket for 3D)
  - components/variants/report/blocks/Report3DMap.tsx (NY)
  - components/variants/report/blocks/wesselslokka-3d-config.ts (NY)
  - components/variants/report/ReportPage.tsx
  - package.json (+@vis.gl/react-google-maps@^1.8.3)
  - docs/brainstorms/2026-04-15-report-3d-map-brainstorm.md
  - docs/plans/2026-04-15-feat-report-3d-map-plan.md
  - docs/solutions/feature-implementations/google-maps-3d-report-block-20260415.md
branch: feat/report-3d-map
pr: aharstad91/placy-nextjs#65
summary: Erstatter planlagt akvarell-TabbedAerialMap (ToS-brudd) med ekte Google Photorealistic 3D Tiles i rapporten. Pilot for Wesselsløkka. Full UX-iterasjon i én sesjon — fra naiv kamera-lock (hakket) til Google-native UX med bounds + UI-kontroller (smørbløt).
detail: |
  ARKITEKTUR:
  - Dormant preview + modal-mønster (matcher ReportThemeSection)
  - Preview: liten aspect-[4/3] kort med "Utforsk i 3D"-CTA, activated=false
  - Modal: 90vw × 88vh på desktop, bottom sheet mobil
  - Tabs-filter (Alle/Oppvekst/Mat&Drikke/Natur/Transport/Trening) i header
  - ReportMapDrawer fra venstre ved pin-klikk (gjenbruk)
  - 15 dummy-POIer rundt Wesselsløkka (ekte DB-senter 63.422074, 10.450617)
  - SSR-gated via dynamic import, ssr:false

  KAMERA-STRATEGI (iterert i sanntid):
  1. Forsøk 1: kontrollerte center/range/bounds-props + JS-snap-back
     → hakket, kjempet mot Googles interne state. FORKASTET.
  2. Forsøk 2: capture-phase event-interception (stopp Googles gestures)
     → senter-drift 0 men ga jitter ved rask drag. FORKASTET.
  3. Forsøk 3: rAF-throttlet snap-back
     → fortsatt hakking pga konkurrerende render-loops. FORKASTET.
  4. FINAL: bruk Googles native gesture-handling + bounds-props
     → butter smooth, håndheves i WebGL, ingen JS-kamp.

  GRENSER (Googles native, ingen custom logic):
  - bounds: 2km radius rundt senter (håndheves av Google)
  - minAltitude 200m, maxAltitude 3000m (zoom-grenser)
  - minTilt 15°, maxTilt 75°

  UI-KONTROLLER (flytende nederst høyre i modal):
  - Kompass (peker live med heading, klikk = snap til nord)
  - Rotér CCW/CW (45° per klikk)
  - Tilt opp/ned (15° per klikk)
  - Zoom inn/ut (1.5× per klikk)
  - Reset-knapp i header ("↺ Tilbake") fly-animerer til start
  - Alle bruker Googles flyCameraTo (400ms) — samme motor som drag

  FELLESFELLER OPPDAGET (dokumentert i solutions/):
  1. useMap3D() upålitelig utenfor Map3D-treet med flere instanser
     → prop-drill map3d via MapReadyBridge + lokal state
  2. LatLngAltitude har lat/lng som getters — {...map3d.center} sprer
     bare minifiserte interne felt (JB/KB/IB) → må kopiere eksplisitt
  3. Marker3D rasteriserer kun SVG/Pin/img, ikke HTML-portal
     → Marker3DPin bygget som inline SVG (circle + Lucide-path + badge)
  4. Ingen native minRange/maxRange → må bruke altitude-grenser i stedet
  5. minAltitude=maxAltitude=0 gir svart skjerm (kamera under bakken)
  6. Tilt-konvensjon: 0° = rett ned, 90° = horisontal (motsatt intuisjon)
  7. Map3D krever WebGL → SSR-crash uten dynamic({ssr:false})
  8. Kontroller som children i <gmp-map-3d> blir absorbert i shadow DOM
     → må være søsken til Map3D (inne i relative container)

  JURIDISK GEVINST:
  - Erstatter akvarell-pipeline som var ToS-brudd (derivative works +
    offline caching >30 dager i public/)
  - Googles Map Tiles API brukt direkte = 100% compliant
  - Attribusjon automatisk, ingen tiles caches lokalt

  KOSTNADSKONTROLL (deferred til etter validert salg):
  - Ingen quota-cap eller budget alert satt opp ennå
  - Bounds + maxAltitude begrenser tiles-lasting til nær-området
  - Worst-case: $10/mnd før alert
status: done

---
date: 2026-04-15
action: humor-i-kategori-illustrasjoner-eksperiment
files:
  - public/illustrations/hverdagsliv-humor-a.jpg
  - public/illustrations/hverdagsliv-humor-b.jpg
  - public/illustrations/trening-aktivitet-humor-a.jpg
  - public/illustrations/trening-aktivitet-humor-b.jpg
  - public/illustrations/trening-aktivitet-humor-c.jpg
  - /tmp/gen_hverdagsliv_variant_a.py
  - /tmp/gen_hverdagsliv_variant_b.py
  - /tmp/gen_trening_variant_a.py
  - /tmp/gen_trening_variant_b.py
  - /tmp/gen_trening_variant_c.py
summary: >
  Eksperimentert med å legge subtil voksenhumor (Mode C — tørr juxtaposition,
  ikke slapstick) INNE I kategori-illustrasjonene selv, ikke i captions. 5
  varianter generert via Gemini Nano Banana Pro med eksisterende Wesselsløkka-
  stil-lås. Parkert for senere — konseptet fungerer, men trenger fokusert
  sesjon for å konsolidere på tvers av alle 6 kategorier.
detail: |
  UTGANGSPUNKT:
  Brukeren ønsket å makse verdi ut av de allerede genererte kategori-
  illustrasjonene. Ikke "cheesy quotes" under bildene — humor i selve
  motivet, subtilt, "lur voksenhumor". Gemini-generering er gratis, så
  iterasjon er fritt.

  VALGT RETNING: Mode C — tørr juxtaposition
  To elementer i scenen som kommenterer hverandre uten å si det.
  Ikke to separate spøker — én joke med to synlige elementer.
  Maks 2 humor-detaljer per bilde.

  EKSPERIMENTER:
  - hverdagsliv-humor-a: "Barnet ser, forelderen scroller" — forelder med
    telefon opp, barn i vogn peker på spurv på bakken.
  - hverdagsliv-humor-b: "To fartene" — sprinter passer eldre person
    med rolator.
  - trening-aktivitet-humor-a: "De to tempoene" — jogger passer eldre
    par som går hånd-i-hånd.
  - trening-aktivitet-humor-b: "Hunden venter" — yoga-person på matte,
    hund sitter tålmodig ved siden av.
  - trening-aktivitet-humor-c: Konsoliderte iterasjonen — bygget endret
    til realistisk norsk mixed-use bygård (3 etg, gym i 1. etg), burger-
    sjappe ved siden, yoga-person i child's pose med hund i play-bow ved
    siden (hunden IMITERER posituren — visuelt rim), pluss person som
    henger i pull-up-stanga.

  LÆRDOMMER (viktige for videre arbeid):

  1. Foreground vs middle-ground — helt avgjørende.
     Første forsøk (hverdagsliv-a/b) plasserte humor-figurene foran i bildet
     — de dominerte komposisjonen og så ut som "sticker på et bakgrunnsbilde".
     Regelen som fungerte: ALLE figurer i middle-ground, samme skala som de
     andre beboerne i scenen, 8-15% av canvas-høyde. Ingen close-ups.
     Humoren skal oppdages, ikke skrikes.

  2. Bygg-realisme: norsk urban-forstad er mixed-use, ikke standalone trehus.
     Det opprinnelige trening-aktivitet-bygget var et idyllisk standalone
     trehus — ikke realistisk for norsk kontekst. Skifte til 3-etasjes
     bygård med kommersielt i 1. etg og leiligheter over = umiddelbart
     mer troverdig for brokers/kjøpere. Dette gjelder sannsynligvis også
     mat-drikke og hverdagsliv. Kan brukes som compound-læring senere.

  3. Burger-sjappa ved siden av gymmet ER humor i seg selv.
     Visuelt kodet (rødt-gult takskjerm, rundt burger-logo uten tekst).
     Lesbart som "fast food" uten å bryte no-text-regelen. Fungerer på
     miljø-nivå (environmental humor), ikke karakter-nivå.

  4. Hund-imiterer-menneske er den sterkeste enkelt-detaljen.
     Play-bow-posituren er ekte hund-gest som ser yoga-aktig ut.
     Visuelt rim mellom menneske og hund = det varmeste smilet.
     Rewards attention uten å være kryptisk.

  5. Kroppsspråk-nyanser er svakere i Gemini.
     Prompt'et "sliten pull-up person, slumpet kropp, hengende hode" —
     modellen gjorde det mer nøytralt. Subtile emosjonelle detaljer
     krever ofte re-generering eller enklere body-language-cues.

  STIL-LÅS HOLDER:
  Alle 5 varianter bevarte Wesselsløkka-akvarell-stilen, palett, og
  pure-white bakgrunn. Pipeline fra 2026-04-13 fungerer fortsatt.

  STATUS: PARKERT
  Konseptet er bevist. Trening-aktivitet-humor-c er den sterkeste
  variaten. Men dette krever fokusert sesjon for å:
  - Lande stil-konsistens på tvers av alle 6 kategorier
  - Bestemme hvilke humor-elementer som er "Placy-signaturer" vs per-bilde
  - Beslutte om vi faktisk erstatter eksisterende kategori-illustrasjoner,
    eller beholder de nåværende og har disse som "humor-varianter"
  - Eventuelt iterere trening-c for å fikse sliten-pull-up-svakheten

  Tar opp igjen når prioritert. Originale illustrasjoner (uten humor)
  forblir i bruk inntil beslutning.

status: parkert

---
date: 2026-04-15
action: natur-friluftsliv-trail-data-research
files:
  - (ingen kodeendringer — kun research/strategi)
summary: >
  Sparring om hvordan løse det tynne sti-UX-et i Natur & Friluftsliv-
  seksjonen. Konklusjon: vi trenger navngitte, kuraterte ruter —
  ikke et komplett sti-nettverk. Utsatt for nå; dokumentert for senere.
detail: |
  BAKGRUNN:
  Trail-overlay-featuren (committed 2026-04-10, branch feat/report-blocks)
  henter Overpass API-data (OSM route relations med navn), men dekning
  for lokale områder som Estenstadmarka er tynn. Session ble stoppet
  tidligere fordi UX-en føltes mangelfull.

  PROBLEMRAMMING:
  Brukeren korrigerte retningen: vi skal IKKE vise hele sti-grafen —
  vi skal vise "kjente, navngitte ruter mot meningsfulle mål"
  (f.eks. Estenstad P-plass → Estenstadhytta).

  DATAKILDER VURDERT (prioritert):
  1. Kartverket NDTF ("Tur- og friluftsruter") — WFS/WMS/GeoPackage
     via geonorge.no. Statlig kuratert, navngitte ruter, CC-BY 4.0.
     Sannsynligvis beste primærkilde for Norge.
  2. UT.no (DNT) — per-hytte-sider med tilkomstruter, GPX-nedlasting,
     tur-beskrivelser. Ingen offentlig API, men scrapable URL-er.
  3. Naturbase (Miljødirektoratet) — WFS med friluftsområder/turmål,
     koordinater men ikke rute-geometri.
  4. OSM utvidet query — relation["route"~"hiking|foot|bicycle"]["name"]
     = det vi har i dag.
  5. Strava Heatmap — tilleggslag for popularitet, ikke primærkilde.

  FORESLÅTT DATAMODELL (ikke implementert):
  interface NamedRoute {
    id, name, routeType, distanceKm, duration, difficulty,
    startPoint{lat,lng,name}, endPoint{lat,lng,name},
    geometry: GeoJSON.LineString,
    externalUrl?, editorialHook?,
    source: "kartverket" | "ut.no" | "manual"
  }
  Lagres som `reportConfig.namedRoutes[]` — ikke `trails`.

  UX-RETNING (for senere):
  - 3-8 navngitte ruter per prosjekt, ikke tett sti-graf
  - Labels alltid synlige (ikke bare hover)
  - Startpunkt-pin + klikk åpner drawer med tur-beskrivelse
  - "Åpne i ut.no"-knapp hvis rute har ekstern URL

  STATUS:
  Utsatt. For komplisert for å ta nå — trenger dedikert planning-sesjon
  (/brainstorm → /plan) før implementasjon. Denne læringen står i worklog
  så vi har konteksten når vi plukker det opp igjen.

status: parkert

---
date: 2026-04-15
action: tabbed-aerial-map-med-akvarell-pipeline
files:
  - components/variants/report/blocks/TabbedAerialMap.tsx
  - components/variants/report/ReportPage.tsx
  - public/illustrations/wesselslokka-{nord,ost,vest,sor}.png
  - .env.local (la til GEMINI_API_KEY og REPLICATE_API_TOKEN)
summary: >
  Bygd ny TabbedAerialMap-komponent: akvarell-illustrasjon med tabs per
  kategori, 4-retnings kompass (N/Ø/S/V), modal med zoom + sidebar drawer,
  cursor-endrings-hover på kantene for retningsbytte. Testet ulike
  bildegenererings-modeller for style transfer.
detail: |
  KOMPONENT-ARKITEKTUR (TabbedAerialMap):
  - Preview: akvarell + små markører + gradient + CTA "Utforsk illustrasjonen"
  - Modal (90vw/85vh): zoomable canvas, tabs, kompass via kant-hover, drawer
  - Markører: klikkbare, åpner ReportMapDrawer (hvis full POI) eller
    lettvekts MarkerDrawer (for dummy/enkle markører)
  - 7 kategorier som tabs: Alle/Oppvekst/Mat&Drikke/Natur/Transport/Trening
  - Retnings-bytte via hover-soner (60px) på alle 4 kanter med pil + label
    og cursor-change (w-resize, e-resize, etc.) — erstattet diskrete N/Ø/S/V-
    knapper etter UX-feedback
  - Crossfade mellom 4 retningsbilder ved direction-bytte
  - Drawer lukkes automatisk ved tab-bytte
  - Zoom begrenset til 1.5x pga. bildeoppløsningscap

  AKSEPTANSEKRITERIER TESTET (via Chrome DevTools MCP):
  AC1 Preview vises — OK
  AC2 Klikk åpner modal — OK
  AC3 Tabs switcher markører (Alle=15, Oppvekst=4, etc.) — OK
  AC4 Klikk markør → sidebar drawer — OK
  AC5 Klikk samme marker lukker drawer — OK
  AC6 Tab-bytte lukker drawer — OK
  AC7 Kompass/kant-hover bytter retning — OK

  AI-BILDEGENERERING — UNDERSØKELSE:
  Testet pipeline for å gjøre Google Maps 3D-screenshots → akvarell:

  1. Gemini 2.5 Flash Image (gratis) — BEST på layout-bevaring + stil,
     men hard cap på ~1344x768. Varierende konsistens mellom kjøringer.
     Generert 4 retninger (nord/ost/vest/sor) som nå brukes i komponenten.

  2. Gemini 3 Pro Image (standard API) — Same ~1376x768 cap. Ville fått
     4K-output via Vertex AI, men krever gcloud-setup + GCP-prosjekt.

  3. Flux Kontext Pro (Replicate) — Fullstendig mislykket. Laget et helt
     annet landskap, mistet layout-gjenkjenning komplett. Ikke brukbar.

  4. Replicate (fofr/style-transfer, ControlNet) — Krever betalingsmetode
     etter Flux-test (brukte opp gratis-kvote).

  RESEARCH-KONKLUSJON (for fremtiden):
  - #1: Gemini 3 Pro Image via Vertex AI — native 4K, $0.24/bilde
  - #2: Recraft V3 img2img — urban_sketching-stil + Creative Upscale, $0.29
  - #3: FLUX.2 [flex] — multi-referanse, 4MP, $0.12
  - Upscaling-alternativ: Real-ESRGAN ($0.002) eller Recraft Crisp ($0.004)

  UTSATT TIL SENERE:
  - Vertex AI-setup for 4K-output (gcloud install + GCP-prosjekt + billing)
  - Replicate billing + test av Recraft V3 / fofr/style-transfer
  - Ekte POI-kobling for markører (nå er det dummy-data)
  - Markør-posisjoner per retning (perspektiv endres ved rotasjon)

  Alt arbeid på feat/report-blocks-worktree. Gemini API og Replicate token
  lagt til .env.local (billing mangler på Replicate for å kjøre flere tester).

---
date: 2026-04-14
action: rapport-v2-blokk-bibliotek
files:
  - components/variants/report/blocks/BentoShowcase.tsx
  - components/variants/report/blocks/FeatureCarousel.tsx
  - components/variants/report/blocks/StatRow.tsx
  - components/variants/report/blocks/TimelineRow.tsx
  - components/variants/report/blocks/EditorialPull.tsx
  - components/variants/report/blocks/SplitFeature.tsx
  - components/variants/report/blocks/AnnotatedMap.tsx
  - components/variants/report/blocks/hverdagsliv-bento.ts
  - components/variants/report/blocks/matdrikke-carousel.ts
  - components/variants/report/blocks/transport-stats.ts
  - components/variants/report/blocks/barn-timeline.ts
  - components/variants/report/blocks/natur-annotated.ts
  - components/variants/report/ReportThemeSection.tsx
summary: >
  Syv blokk-typer for rikere kategori-presentasjon i rapport v2. Pilotert
  på Wesselsløkka. Alle 7 kategorier har nå dedikert blokk-komposisjon.
  Arbeidet er på feat/report-blocks-branch i worktree.
detail: |
  BLOKK-BIBLIOTEK (7 typer):
  
  Kort-baserte (4):
  1. BentoShowcase — Apple-bento, zoom-in på ETT subjekt (Valentinlyst Senter)
     Rendyrket etter scanability-feedback: alle celler handler om senteret.
     Hero 2×2 med Nettside/Utforsk-knapper + tenant-celler + "og mer"-pills.
  2. FeatureCarousel — Horisontal scroll, uniforme kort. Mat & Drikke (10 POIer).
     Snap-x, piler, bleed ut av 800px-kolonne. Google Places-bilder.
  3. StatRow — Punchy tall-kort. Transport med live Entur/GBFS-data
     (neste buss, bysykkel, sparkesykler, bildeling) + reisetidsberegninger
     til Trondheim-ankere (sentrum, Leangen, Værnes, Trondheim S).
  4. TimelineRow — Sekvensiell progresjon. Barn & Aktivitet skoleløp
     (barneskole → ungdomsskole → VGS) med node-ikoner + forbindelseslinje.
  
  Ikke-kort-baserte (3):
  5. EditorialPull — Magasin-sitat. Serif-typografi, dekorativt åpningsglyph.
     Brukes som "pust" mellom tunge seksjoner.
  6. SplitFeature — 50/50 diptyk. Tekst venstre + illustrasjon høyre.
     Break-out fra 800px-kolonne. Trening & Aktivitet.
  7. AnnotatedMap — Illustrert atlas. Nummererte callouts over akvarell-
     illustrasjon + ordered-list under. Natur & Friluftsliv.
  
  VIKTIG DESIGNPRINSIPP (oppdaget under arbeidet):
  "Én blokk = én narrativ enhet." Bento fungerer fordi alle celler
  handler om Valentinlyst. Da vi blandet 3 subjekter i én bento
  (senter + standalone POIer + horisont) ble det vanskelig å skanne.
  
  NESTE UTFORSKNINGSRETNING — AnnotatedMap med 3D-flyfoto:
  Google Maps 3D-screenshot som komposisjonsreferanse → Gemini
  transformerer til akvarell-illustrasjon → Placy-estetikk bevares,
  geografisk nøyaktighet sikres, opphavsrettproblemer unngås.
  Pipeline: 3D-screenshot → Gemini (stilreferanse: Placy akvarell)
  → illustrert flyfoto → AnnotatedMap med callouts.
  Topografi (bakker, trær, bygninger) bevares i illustrasjonen.
  Skalerbart: kan automatiseres for ethvert prosjekt.
  
  TEKNISKE LØSNINGER:
  - Walk-time: haversine × 1.3 road-factor @ 83m/min (matcher ReportHeroInsight)
  - Live transport-data: transportDashboard hook gjenbrukt
  - Banner-illustrasjon suppresses for themes med custom block
  - Child-POIs flattening for Valentinlyst-tenanter
  - minutesUntil(iso) erstatter formatRelativeDepartureTime for value/unit-split
  - Flybussen-hastighet (50 km/h) vs urban buss (18 km/h) for Værnes
  
  GÅR IKKE VIDERE MED (bevisste valg):
  - Duplikat-rydding: ReportHeroInsight vises fortsatt under blokkene
    → tas i generaliseringspasset
  - Opplevelser: eneste kategori uten dedikert blokk → bruker carousel
  - AnnotatedMap posisjoner: hardkodet per-prosjekt → auto-projeksjon
    fra lat/lng krever mer arbeid
  - Blokk-config-generalisering: conditions er hardkodet i
    ReportThemeSection → flyttes til report-data.ts
status: done

---
date: 2026-04-13
action: kategori-ikoner-og-sentrert-layout
files:
  - components/variants/report/ReportPage.tsx
  - components/variants/report/ReportThemeSection.tsx
  - components/variants/report/ReportHero.tsx
  - components/variants/report/report-data.ts
  - lib/utils/render-emphasized-text.tsx
  - public/illustrations/icons/*.png
  - supabase/migrations/064_wesselslokka_hero_intro_apple_emphasis.sql
summary: Hver kategori fikk egen håndtegnet akvarell-spot-ikon (handlepose, huske, kaffekopp, bok, benk, manual, sykkel) — samme stil som illustrasjonene, unik palett-aksent per kategori. Layout sentreres per seksjon (ikon → tittel → intro → illustrasjon). Sticky sidebar fjernet — rendyrket editorial-lesning. Alt visuelt språk er nå koherent fra hero til siste seksjon.
detail: |
  IKONER (7 stk, Gemini Nano Banana Pro, /tmp/gen_ikoner_batch.py):
  - Hverdagsliv: handlepose m/ brød og blad, salvie-wash
  - Barn & Aktivitet: huske m/ tau, salvie-wash
  - Mat & Drikke: kaffekopp m/ damp, terrakotta-wash
  - Opplevelser: åpen bok m/ bokmerke, oker-wash
  - Natur & Friluftsliv: parkbenk m/ gress, salvie-wash
  - Trening & Aktivitet: manual/dumbbell, grå-blå-wash
  - Transport & Mobilitet: sykkel side-view, salvie-wash

  Prompt-låst stil via STYLE_HEADER:
  - Håndtegnet blekkstrek, varmgrå ikke svart (~#3a3530)
  - ÉN muted watercolor wash per ikon (ikke dominerende)
  - Pure hvit bakgrunn, generøs safe-area
  - 1:1 square, subject 50-60% av canvas
  - Single focal object — ikke scene
  - Ingen tekst, ingen logoer

  KOMPOSISJON:
  - Spot-ikon (w-32 md:w-36, ~128-144px) ABOVE tittel
  - Ikon + tittel + intro sentreres (flex-col items-center text-center)
  - max-w-2xl på intro → naturlig linje-break
  - Banner-illustrasjon full bredde under
  - Apple-rytme bevart gjennom hele komposisjonen

  SIDEBAR FJERNET:
  - ReportSidebarNav-render + useActiveSection-hook fjernet
  - 3-kolonne grid → enkel sentrert max-w-[800px] container
  - registerRef-prop-passing ryddet bort
  - ReportSidebarNav.tsx-fila bevart (ubrukt, men kan gjenbrukes hvis ny nav
    trenger deler av den)

  HERO-SEKSJONEN:
  - Samme Apple-behandling: tracking-tight på h1, tekst-2xl ikke italic på intro
  - renderEmphasizedText delt ut til lib/utils/render-emphasized-text.tsx
  - Migration 064: "byens mest gjennomtenkte nabolag" nå emphasized i DB

  LÆRINGER:
  - Ikoner i denne stilen er generérbare og konsistente — samme pattern skalerer
    til nye kategorier (bare legge til entry i THEME_ICONS + batch-genererer)
  - Kompakt spot-illustrasjon fungerer når sentrert over tittel, ikke inline
  - Sidebar-fjerning forsterket editorial-lesningen merkbart
  - ReportSidebarNav kan trolig slettes — eller gjenbrukes for mobil-nav senere
status: done

---
date: 2026-04-13
action: apple-typografi-og-bildekomposisjon
files:
  - components/variants/report/ReportThemeSection.tsx
  - components/variants/report/report-data.ts
  - public/illustrations/*.jpg
  - supabase/migrations/062_wesselslokka_bridge_text_apple_emphasis.sql
  - supabase/migrations/063_wesselslokka_bridge_text_expanded.sql
summary: Kategori-seksjonene har fått Apple-inspirert typografi + komposisjon. Tittel er nå hero-størrelse med tracking-tight, intro-tekst er større og ikke kursiv. **Markdown-bold** i bridgeText renderer som mørkere/fremhevet span — to-tone rytme som Apple product pages. Illustrasjoner auto-croppet til motiv-bounds for strammere mobilvisning. Layout-flyt: tittel → stor intro med emphasis → illustrasjon → innhold.
detail: |
  ENDRINGER — typografi/komposisjon:
  - Tittel: text-2xl→text-5xl + tracking-tight + ikon oppgradert 24→32px
  - Intro: text-lg→text-2xl, fjernet italic, base-farge #6a6a6a, leading-snug
  - Emphasis-mekanisme: renderEmphasizedText() parser **markdown** og
    renderer som span med text-[#1a1a1a] font-medium
  - Illustrasjon flyttet under tittel+intro (fra over) med mb-12 luft under —
    oppfattes nå som én samlet intro-blokk

  ENDRINGER — illustrasjoner:
  - Alle 6 kategori-JPG auto-croppet via scripts/crop_illustrations.py
    (threshold=250, buffer=4px, quality=95 for idempotens)
  - Gjennomsnitt ~11% whitespace fjernet, Mat & Drikke -17%
  - ThemeIllustration-type med width+height per fil
    → next/image reserverer korrekt plass, ingen layout shift
  - Batch-generatoren (gen_kategori_batch.py) auto-cropper nå etter save
    → fremtidige kategorier er klare uten manuelt steg

  ENDRINGER — innhold (migrations 062 + 063):
  - Migration 062: alle 7 bridgeTexts wrapped med **emphasis** på
    innledende konfident claim
  - Migration 063: hver bridgeText utvidet med én ekstra setning for
    bedre tekst/bilde-balanse og Apple-rytme
  - Pattern overalt: **claim** → detail → extra context
  - Eksempel (transport):
      FØR: "Brøset er godt koblet — hverdagsmobilitet på gangavstand
            og regional tilgjengelighet innen kort rekkevidde."
      ETTER: "**Brøset er godt koblet.** Hverdagsmobilitet på gangavstand
             og regional tilgjengelighet innen kort rekkevidde. Buss,
             bysykkel og bildeling gjør bilen til et valg — ikke en
             nødvendighet."

  LÆRINGER VERDT Å HUSKE:
  - JPG quality=90 introduserer microskopisk off-white støy som gjør
    crop-scriptet non-idempotent (hver ny kjøring trimmer litt mer).
    quality=95 løser dette.
  - next/image cache (.next/cache/images/) må slettes ved iterasjon
    på samme URL — ellers serves gammel optimalisert versjon
  - Apple-rytme = emphasized claim + softer qualification. Italic
    hører IKKE hjemme her. Tracking-tight på heading er signatur.
  - Bridge text som "one-liner" gir for lite tyngde mot illustrasjon.
    3 linjer (claim + detail + context) gir bedre balanse.

  GJELDER FOR FREMTIDIG ARBEID:
  - Alle nye demoer bør bruke **markdown emphasis** i bridgeText
  - /generate-bolig bør oppdateres til å generere bridgeTexts med
    emphasis-struktur når skrevet automatisk
  - ThemeIllustration-mønsteret skalerer til nye kategorier — bare
    legge til entry i THEME_ILLUSTRATIONS
status: done

---
date: 2026-04-13
action: kategori-illustrasjoner-komplett
files:
  - public/illustrations/hverdagsliv.jpg
  - public/illustrations/barn-aktivitet.jpg
  - public/illustrations/mat-drikke.jpg
  - public/illustrations/natur-friluftsliv.jpg
  - public/illustrations/trening-aktivitet.jpg
  - public/illustrations/transport-mobilitet.jpg
  - components/variants/report/report-data.ts
  - components/variants/report/ReportThemeSection.tsx
summary: Alle 6 kategori-illustrasjoner for Wesselsløkka-rapport generert via Gemini Nano Banana Pro (gemini-3-pro-image-preview) med Wesselsløkka-hero som stil-referanse. Pure hvit bakgrunn, sømløs integrasjon i layout. Bildegeneratoren er spot on — fantastisk effekt på design og opplevelse. Visuell identitet koherent på tvers av hele rapporten.
detail: |
  Bildegenerator-vurdering: SPOT ON. Effekten på design og brukeropplevelse er
  fantastisk. Hver kategori har nå sin egen scene — nabolagssenter, lekeplass,
  kafé, skog med bru, treningsbygg, kollektivstopp — men samtlige deler samme
  akvarell-håndtegnede stil, nordiske palett, og atmosfære som hero-
  illustrasjonen. Ingen "AI-feeling", ingen stil-drift mellom kategoriene.
  Illustrasjonene føles kuratert, ikke maskin-generert.

  Pipeline bekreftet fungerer:
  1. Wesselsløkka-illustrasjon-v2.png som stil-referanse
  2. Kategori-spesifikk subject-prompt (nabolagsscene, ikke butikkspesifikt)
  3. CRITICAL BACKGROUND-overstyring av referansens cream-bakgrunn til pure #FFFFFF
  4. 3:2 landscape, generøs hvit margin rundt subjekt
  5. Ingen lesbare skilt, ingen merker, ingen dominant person

  Tekniske gjennombrudd:
  - Prompt-struktur med "CRITICAL BACKGROUND REQUIREMENT — overrides the reference"
    er nøkkelen — referansebildet påvirker ALT inkludert bakgrunn, må eksplisitt
    overstyres
  - Next.js Image cache (.next/cache/images/) må slettes mellom iterasjoner —
    ny fil på samme URL serves som gammel optimalisert versjon
  - Batch-scriptet (/tmp/gen_kategori_batch.py) genererte alle 4 siste på ~2 min

  Integrering i kodebase:
  - THEME_ILLUSTRATIONS-map i report-data.ts — keyed på theme.id
  - Banner-rendring i ReportThemeSection (next/image, aspect-[3/2], fill)
  - Ikke-invasivt: secondary-variant temaer får ingen illustrasjon
  - Skalerer til nye temaer ved å legge én entry i mappen

  Visuell gjennomgang:
  - Hverdagsliv: nabolagssenter med torg, sykkelstativ, folk på vei gjennom ✓
  - Barn & Aktivitet: barneskole + lekeplass, barn på sparkesykkel + balansesykkel ✓
  - Mat & Drikke: kafé med uteservering, treforeldrepar, syklist ✓
  - Natur & Friluftsliv v1→v2: FIRST pass var dyp furuskog — feil tone for nabolagsrapport.
    Regenerert som urban park i boligområde (gressplen, gangsti, benker, trær,
    faint residential skyline i bakgrunnen). Nær-natur, ikke marka. ✓
  - Trening & Aktivitet: svømmehall/gym + utendørs treningspark, løper ✓
  - Transport & Mobilitet: bussholdeplass + bysykkelrack + elsparkesykler ✓

  Læring fra Natur-iterasjonen: "Natur & Friluftsliv" i boligkontekst = urban park/
  nabolagsgrøntområde, ikke villmark. Oppdatert batch-scriptet til å reflektere dette
  som default for fremtidige demoer.

  Salgs-effekt: rapporten ser nå ut som et kuratert redaksjonelt produkt,
  ikke en databaserapport. Dette er visuell bekreftelse av Placy-shell-
  strategien (tokens + shell, ikke full whitelabel).

  Kostnad: ~$0.04 × 6 = ~$0.24 for hele Wesselsløkka-serien.

  Neste vurdering:
  - Lagre batch-scriptet permanent i scripts/generate-category-illustrations.py
  - Dokumentere prompt-strukturen som "style-bible" for fremtidige prosjekter
  - Vurdere automatisering i /generate-bolig når vi har 3-5 demoer som holder
    stil-konsistens
status: done

---
date: 2026-04-13
action: strategi-diskusjon
files: []
summary: Visuell retning for rapport-illustrasjoner landet — arkitektonisk akvarell-stil (a la Wesselsløkka-hero) blir standarden. Ambisjon utvides til serie: én illustrasjon per nabolagstema (7 kategorier × N demoer). Verktøy-valg: Gemini Nano Banana Pro via `compound-engineering:gemini-imagegen`-skillen, ikke Firefly. Automatisering i /generate-bolig er teknisk mulig men utsatt til stil-konsistens er bevist på 5+ demoer.
detail: |
  Kontekst: Wesselsløkka-hero (arkitektonisk akvarell, nordisk palett, tones ut i
  bakgrunnen) har landet som estetikk brukeren liker. Neste steg: utvide til per-
  kategori-illustrasjoner som serie — Hverdagsliv er pilot.

  Prompt-retning for Hverdagsliv landet: nabolagsankeret (lokalt senter i
  bakgrunn, torg foran med benker, sykkelstativ, få mennesker i bevegelse) —
  ikke enkeltbutikker med lesbare skilt. Løfter blikket fra butikk-kategoriene
  til nabolagsfølelsen. Prompt-tekst full-formulert i chat-historikk — bør
  committeres som style-bible-dokument når låst.

  Verktøy-vurdering (Firefly-abonnement oppbrukt):
  - Firefly bruker Gemini Nano Banana 2 under panseret → Gemini direkte er
    samme motor, ingen tap av kreativ kontroll
  - Bruker har `compound-engineering:gemini-imagegen`-skillen installert lokalt
  - Modell: gemini-3-pro-image-preview (Pro), støtter opp til 14 referansebilder,
    multi-turn refinement, 1K-4K oppløsning, aspect-ratio-kontroll
  - Kostnad: ~$0.04/bilde, gratis tier finnes i AI Studio
  - Alternativer vurdert (Recraft med style-reference for serier, Midjourney
    --sref, Krea/fal.ai) — ikke valgt for nå, men Recraft er side-kanal hvis
    Gemini drifter på serie-konsistens

  Strategisk spørsmål: automatisere bildegenerering i /generate-bolig?
  - Teknisk feasible: mate Wesselsløkka-illustrasjon som referanse + prompt →
    ny demo-hero auto-generert, skrevet til Supabase Storage, satt i
    reportConfig.heroImage
  - Per-kategori-serie (7 bilder × N demoer = 35-42 bilder) er mer ambisiøst
    enn per-demo hero
  - Men: Gemini mangler ekte style-lock — drift-risiko på serie-konsistens
  - Beslutning: IKKE automatisere før stilen er bevist konsistent på 5+ demoer.
    "Automatisert middelmådig" er verre enn "manuelt god".

  Neste konkrete steg:
  - [ ] Bruker henter GEMINI_API_KEY fra aistudio.google.com/apikey
  - [ ] Legger til i .env.local
  - [ ] Test-generer én Hverdagsliv-illustrasjon + én StasjonsKvartalet-hero via
    skillen, med wesselslokka-illustrasjon-v2.png som style-referanse
  - [ ] Sammenlign med Firefly-output — er kvaliteten på nivå?
  - [ ] Hvis ja → iterere gjennom 7 kategorier + StasjonsKvartalet manuelt
  - [ ] Hvis stilen holder over 5+ demoer → vurder automatisering i /generate-bolig
  - [ ] Hvis ikke → evaluer Recraft som side-kanal
status: ongoing

---
date: 2026-04-13
action: strategi-research
files: []
summary: Polaris Media / Adressa Studio-research gjennomført. Platform-via-byrå-hypotese styrket via pris-arbitrasje-argument (byrå kan prise høyere enn startup). Møte-rekkefølge avklart: Nanna (Midtbyen Management) først, Adressa Studio etter. Interessekonflikt mellom eiendom (DNB via Adressa) og events (Midtbyen via Adressa) omframet som bevis på Placys bredde.
detail: |
  Research-funn (research-agent, verifiserte kilder):
  - Polaris Media: børsnotert (OSE: POL), omsetning 3,59 mrd NOK (2024),
    78 mediehus i Norge+Sverige etter 100% oppkjøp av Stampen Media (2025)
  - 6 regionale datterselskap: Midt-Norge (Adresseavisen flaggskip),
    Nordvestlandet, Sør, Vest, Nord-Norge, Sverige
  - "PM Produkt" (nov 2025): ny intern produktorganisasjon, mandat:
    utvikle og skalere AI-løsninger og verktøy for redaksjonene på tvers
    av konsernet. CPO: Mari Brænd Hjelmeland.
  - Historisk mønster: adoptert Schibsted CMS, Cxense, SPiD — bevist
    "develop once, deploy many"-kultur

  Adressa Studio:
  - Avdeling i Adresseavisen (ikke separat selskap), fullservice byrå
    på kommersiell side
  - Bekreftede kunder: DNB Nybygg StasjonsKvartalet (sponset innhold
    + skjema), Content Marketing Norge samarbeidspartner
  - Midtbyen Management: mønster bekreftet (Adressa produserer Issuu-
    magasiner), direkte samarbeid ikke offentlig bekreftet
  - OI Matfestival-kobling USIKKER — ikke bekreftet i søk

  Nanna Berntsen: prosjektleder arrangement / kultur- og programansvarlig
  i Trondheim Management AS. IKKE daglig leder (Kirsten Schultz).
  Eier innholdet i Kulturnatt/Julemarkedet/Martnan, ikke strategien.

  Pris-arbitrasje-argument (strukturelt, ikke bare skala):
  - Solo-founder har innebygd "desperat-rabatt" — prospects forhandler
    fordi de kan (1 person, ingen procurement-friksjon, ingen ref-base)
  - Byrå med etablerte rates selger til sluttkunde i sitt vanlige spor
  - Pris Adressa Studio etablerer blir permanent anker i markedet
  - Referansebank-effekten compounds: første kunde dyrest, neste gratis

  Marginstruktur-modeller vurdert:
  - Rev share (anbefalt pilot: 60/40 til Adressa for StasjonsKvartalet)
  - Wholesale lisens
  - Partner-rate (etter 3-5 prosjekter når volum er kjent)

  Brand-visibilitet: whitelabel-risiko hvis Adressa bundler usynlig.
  Mitigert av nylig generalisert Placy-shell (nøytral footer = alltid
  "Placy"-brand synlig) — designet støtter allerede dette kravet.

  KILDEKORRIGERING: Tidligere påstand "PM Produkt ble etablert nettopp
  fordi de leter etter produkter å skalere" var overfortolkning.
  Pressemeldingen (NTB, nov 2025) sier INGENTING om ekstern produktsøk —
  kun intern konsolidering på tvers av Norge+Sverige. Korrigert pitch:
  ikke hevde at Polaris "leter etter deg"; spør dem i stedet hvordan
  deres apparat for tverr-konsern-utrulling fungerer.

  Møte-strategi:
  1. Svar Nanna raskt, book Nordre gate 10 neste uke. Lav innsats,
     bekreft/avkreft Adressa Studio-relasjon, få Kulturnatt-case friskt
  2. Send mail til Adressa Studio samme dag, foreslå møte ETTER Nanna
  3. Gå inn i Adressa Studio med 3 bevis i hånd: StasjonsKvartalet-demo,
     Kulturnatt-case, Midtbyen-samtale — pitch platform-/kanal-modell,
     ikke per-prosjekt-salg

  Anbefalt åpningssetning mot Adressa Studio: "Jeg tror faktisk dere kan
  prise dette høyere enn jeg kan selv. La oss bruke StasjonsKvartalet
  til å bevise både produktet og prisingen."
status: ongoing
related: [memory/project_demo_outreach_strategy.md, memory/reference_trello_demo_pipeline.md]

---
date: 2026-04-13
action: generalized
files: [components/variants/report/ReportPage.tsx, components/variants/report/ReportSummarySection.tsx, components/variants/report/report-data.ts, lib/types.ts, .claude/commands/generate-bolig.md]
summary: Rapport-layout konsolidert som template for alle nye report-produkter. Hero-bildet er nå et konfigurerbart `reportConfig.heroImage`-felt (ikke hardkodet Wesselsløkka-sti). Summary-seksjonen gjenbruker hero-layout (50/50 tekst+bilde) + egen seksjon for megler/CTA. `/generate-bolig` på StasjonsKvartalet vil automatisk bruke dette shellet.
detail: |
  Layout-endringer i sesjon (fra skjermbildene):
  - Fjernet "Utforsk på egenhånd"-CTA (ReportExplorerCTA) — seksjon + komponent slettet
  - Fjernet attribution-footer (ReportClosing) — komponent slettet
  - Summary flyttet ut av 3-kolonne-grid → full-bredde seksjon, sidebar avsluttes naturlig
  - Summary splittet i to: hero-stil topp (headline/insights + illustrasjon 50/50)
    + egen megler/CTA-seksjon under (luft, ikke cramped)

  Generalisering for template-bruk:
  - `heroImage?: string` lagt til i ReportConfig (lib/types.ts) + ReportData
  - ReportPage leser `reportData.heroImage` i stedet for hardkodet sti
  - ReportHero og ReportSummarySection degraderer graciøst (1-kolonne) hvis image mangler

  Wesselsløkka-migrering:
  - JSONB-merge via `||` operator (IKKE overwrite — bevarte heroIntro/summary/brokers/cta/7 themes)
  - Verifisert: heroImage="/wesselslokka-illustrasjon-v2.png" satt, alt annet intakt

  /generate-bolig dokumentert: heroImage er optional, pipeline genererer ikke automatisk,
  legges inn manuelt post-generering ved brand-illustrasjon.

  Neste steg (åpent spørsmål fra forrige entry): /generate-bolig på StasjonsKvartalet
  kan kjøres nå — layout er template-klart. Image-feltet forblir tomt inntil vi har
  en illustrasjon-kilde (AI / fotografi / manuell).
status: done

---
date: 2026-04-13
action: strategi-diskusjon
files: []
summary: Demo-outreach-strategi konkretisert — StasjonsKvartalet valgt som første fase-1-demo, via Adressa Studio som varm kanal. Pipeline-vurdering av /generate-bolig — ~90% autonomt for innhold, men demo-packaging-laget (story mode, megler-CTA, branding) er ikke generalisert.
detail: |
  Fase-1-pipeline (Trondheim-regionen) ligger i Trello "Demo Pipeline"
  (board 69dcb71daff7e8044a29680e). 5 flagskip-prosjekter:
  Gartnersletta, StasjonsKvartalet, TUN32, Ladebyhagen, Leangenbukta.
  17 søsken-prosjekter parkert (team-overlap + fase 2).

  StasjonsKvartalet valgt som første fordi Adressa Studio (bygger
  deres nettside) allerede er kontaktet og var gira på demo. Dobbel
  verdi: (1) varm intro-kanal til DNB Nybygg, (2) markedsinnsikt fra
  byrå som selger tilsvarende produkter.

  Strategisk anbefaling: bygg StasjonsKvartalet-demoen FØRST, så presenter
  ferdig produkt til Adressa Studio (ikke vag "hva synes dere"-samtale).
  3 spørsmål til dem: faglig tilbakemelding, prising/verdi, integrasjon
  vs. standalone.

  Pipeline-vurdering (/generate-bolig, 18 steg, 1145 linjer):
  - Alt. A "Demo = Placy-prosjekt med rapport + explorer": ~90% autonomt
  - Alt. B "Demo = det Wesselsløkka er" (story mode, megler-CTA, custom
    header/footer): ~60-70% autonomt — demo-packaging ikke generalisert

  Manuelle gates i dagens pipeline (6 stk): geocode-bekreft,
  strøk-match, kunde-input, POI-bekreft, visuell QA, bruker-review.
  Gates 1-3 kan besvares i input. Gate 16+17 er den korte manuelle QA-en.

  Åpent spørsmål for neste sesjon:
  - Kjøre /generate-bolig på StasjonsKvartalet nå (innhold på plass)?
  - Eller først generalisere demo-packaging-laget så TUN32/Ladebyhagen/
    Leangenbukta blir nesten helautonome?

  Minnefiler oppdatert:
  - memory/project_demo_outreach_strategy.md (cardinal-regel: én demo
    per team, flagskip-valg, fase-1-fokus Trondheim)
  - memory/reference_trello_demo_pipeline.md (board/liste/label IDer)
status: ongoing
related: [.claude/commands/generate-bolig.md, docs/solutions/feature-implementations/generate-bolig-quality-pipeline-rewrite-20260228.md]

---
date: 2026-04-13
action: shipped
pr: aharstad91/placy-nextjs#64
files: [components/public/PlacyReportHeader.tsx, components/public/PlacyReportFooter.tsx, components/public/ShareButton.tsx, components/public/CookiesModal.tsx, app/eiendom/[customer]/[project]/rapport/page.tsx, lib/theme-utils.ts, lib/types.ts, lib/supabase/queries.ts, components/variants/report/summary/hooks/useCopyShare.ts, supabase/migrations/061_projects_homepage_url.sql, scripts/seed-wesselslokka-shell.ts, next.config.mjs]
summary: Placy-standardisert shell for rapport-ruten. Header (kundens primary-farge, tilbake-link, prosjektnavn, del-knapp) + footer (nøytral Placy-branding). Erstatter ad-hoc whitelabel med skalerbar modell — neste demo ≤30 min branding.
detail: |
  Strategisk pivot fra forrige Wesselsløkka-demo-tilnærming: i stedet for
  per-kunde custom shell (442 CSS-linjer, mimicking av kundens nettside),
  eier Placy shellet og kunden bidrar med noen få design-tokens.

  Full pipeline kjørt: brainstorm → plan → deepen (4 research-agenter) →
  tech-audit (5 agenter, YELLOW→GREEN etter mitigasjoner) → implementering.
  Tech audit fant 2 high-severity risikoer som ble mitigert:
  1) JSONB-overwrite i seed-script (bruker `||`-merge, ikke naive UPDATE)
  2) XSS via homepage_url (DB CHECK + client displayDomain-guard)

  Nye komponenter i components/public/:
  - PlacyReportHeader (server): sticky, kundens --primary som bg,
    tilbake-link, prosjektnavn sentrert (desktop), del-knapp
  - ShareButton (client): Web Share API + clipboard + execCommand-fallback,
    inline ikon-swap, a11y role=status
  - PlacyReportFooter (server): nøytral cream-bg, ALDRI kundens farger
  - CookiesModal (client): shadcn Dialog, localStorage-persistering

  Infrastruktur:
  - Migration 061 m/CHECK-constraint (blokkerer javascript:/data:)
  - computeLuminance + pickContrastForeground med WCAG 2.1 sRGB-
    linearisering (ikke naiv weighted sum — feil-klassifiserer mid-tones)
  - Contrast-ratio-sammenligning mot SOFT_WHITE/SOFT_BLACK (ikke fast
    luminance-terskel) — mer robust for brand-farger i danger zone
  - displayDomain + safeHref for URL-validering (defense in depth)

  Wesselsløkka-migrering:
  - Seed-script med dry-run, backup, JSONB-merge, concurrency lock
  - Kjørt mot prod: homepage_url=wesselslokka.no, primary=#204c4c (teal)
  - Valg av teal over pink: sticky header med full pink blir for intenst

  Opprydding:
  - Slettet /app/demo/wesselslokka/ (custom shell) + /public/ws-demo/
  - 308 redirect fra gammel URL til ny kanonisk

  Verifisert mot Leangen (shadcn-blå fallback) + Wesselsløkka
  (teal 13:1 kontrast WCAG AAA). Typecheck clean, 0 lint errors.
status: done
related: docs/plans/2026-04-13-feat-placy-report-shell-plan.md
---
date: 2026-04-13
action: created
files: [app/demo/wesselslokka/layout.tsx, app/demo/wesselslokka/page.tsx, app/demo/wesselslokka/WesselsloekaHeader.tsx, app/demo/wesselslokka/WesselsloekaFooter.tsx, app/demo/wesselslokka/wesselslokka.css, public/ws-demo/wesselslokka-logo.png, public/ws-demo/wesselslokka-wordmark.png, public/ws-demo/wesselslokka-wordmark-neg.png, public/ws-demo/wesselslokka-script.webp]
summary: Whitelabel-demo for Wesselsløkka — full brand-wrap rundt delte rapport-komponenter. CSS-scoping-strategi (`.ws-theme` overstyrer Tailwind arbitrary-values) unngår kode-fork av ReportPage. Første mønster vi kan gjenbruke for flere kunde-demoer.
detail: |
  Mål: rapport som ser ut som en integrert del av wesselslokka.no,
  ikke som en Placy-side med "Wesselsløkka" skrevet på.

  Arkitektur:
  - /demo/wesselslokka-rute med eget layout som wrapper alt i `.ws-theme`
  - Custom header (wordmark, full nav, Facebook/Instagram, "Meld interesse"-CTA,
    mobil-burger) + custom footer — egne React-komponenter
  - Brand-palett hentet fra wesselslokka.no Squarespace:
    teal ink #204c4c, pink CTA #e32d7a, vårgrønn #a0e885, cream bg #f7f4ec
  - Fraunces variable font (SOFT + opsz axes) for display-følelse
  - Delt ReportPage uendret — wesselslokka.css scoper overrides via
    `.ws-theme [class*="text-[#1a1a1a]"] { color: var(--ws-ink) }` osv.
    Samme komponent, to forskjellige looks uten fork.

  Status: filer ble utviklet i worktree (placy-ralph-wesselslokka-demo,
  branch feat/wesselslokka-demo hadde 0 commits — kun untracked). Flyttet
  inn på main 2026-04-13 som c6397de da worktrees ble konsolidert.

  Implikasjon: dette er malen for ~mange kunde-demoer fremover. Trenger
  å diskuteres som eget spor (token-system? per-kunde theme-tabell?
  whitelabel-pipeline?).
status: done
---
date: 2026-04-13
action: created
files: [supabase/migrations/060_coachella_2026_demo.sql, app/event/[customer]/[project]/page.tsx, app/event/[customer]/[project]/layout.tsx, app/event/layout.tsx, lib/i18n/explorer-strings.ts, lib/themes/bransjeprofiler.ts, lib/hooks/useTravelTimes.ts, components/variants/explorer/ExplorerPage.tsx, components/variants/explorer/ExplorerPOIList.tsx, docs/solutions/ui-bugs/mapbox-markers-invisible-missing-css-EventRoute-20260413.md]
summary: Coachella 2026 demo — full interaktiv festivalkart som proof-of-concept for Placy som event-plattform. Ny /event/-rute, engelsk UI, event-bransjeprofil med 6 tema-grupper, korrekte gangtider via luftlinje-beregning.
detail: |
  Bruker spurte om Placy kunne gjøres for events — analyserte coachella.com
  (statiske JPG-kart, lineup-browser uten kart-kobling) og identifiserte at
  Placy's eksisterende infrastruktur (POI-system, kategorier, Mapbox, event-felter)
  dekker 90% av behovet. Datamangel, ikke kodemangel.

  Bygget demo med 57 POI-er på Empire Polo Club: 9 scener, 14 mat/drikke,
  12 fasiliteter, 8 transport, 8 kunst/opplevelser, 6 camping. Koordinater
  estimert fra satellittbilder + venue map. Hentet komplett 2026-lineup med
  set times fra Wikipedia + Time Out.

  Etter første demo identifiserte 4 dealbreakers for å sende til Coachella admin:
  1) Alt på norsk → bygget `lib/i18n/explorer-strings.ts` med EN/NO strings,
     threaded locale-prop gjennom ExplorerPage + ExplorerPOIList.
  2) URL "/eiendom/" (real estate) → ny `/event/[customer]/[project]`-rute.
  3) 25 flate kategorier → aktiverte Event-bransjeprofil med 6 temaer
     (Scener, Mat & Drikke, Fasiliteter, Transport, Kunst, Camping).
  4) Feil gangtider (Mapbox ruter rundt venue, 29-43 min) → ny `useDirectDistance`
     prop med haversine × 1.2 faktor gir 1-9 min (korrekt for festivaler).

  Bug: Pins usynlige på /event/ — `.mapboxgl-marker` var 937px bred. Mangel på
  `mapbox-gl.css` i parent layout. Fikset med `app/event/layout.tsx`.
  Dokumentert i docs/solutions/ui-bugs/.

  Demo-URL: /event/goldenvoice/coachella-2026
status: done
---
date: 2026-04-13
action: created
files: [components/variants/report/ReportSummarySection.tsx, components/variants/report/summary/*, components/variants/report/ReportClosing.tsx, components/variants/report/ReportPage.tsx, components/variants/report/report-data.ts, lib/types.ts, lib/theme-utils.ts, lib/i18n/apply-translations.ts, types/plausible.d.ts, app/globals.css, app/eiendom/[customer]/[project]/rapport/page.tsx, scripts/seed-wesselslokka-summary.ts, scripts/restore-product-config.ts, data/wesselslokka-summary.ts]
summary: Ny oppsummeringsblokk nederst i rapporten — syntese-headline, 3-5 insights, varm broker-invite, megler-kort med direkte tel/mail, Meld interesse primær-CTA, share-ikon (tertiær)
detail: |
  Erstatter generisk "Oppsummert"-prosa med lead-genererende seksjon.
  Forskning via 4 agenter: norsk meglerkonvensjon (telefon direkte synlig, "Meld interesse" dominerer),
  shadcn CSS-token theming, Placy repo-kartlegging, clipboard+share API.
  Tech-audit avdekket kritisk bug: globals.css hadde dobbel :root-deklarasjon
  (HSL-kanaler + oklch) som gjorde shadcn semantic tokens dead. Fikset først.
  Theming-wrapper refaktorert fra <style dangerouslySetInnerHTML> til inline style-prop
  (SSR-safe, scoped, ingen lekkasje).
  ProjectTheme utvidet med semantiske felter (background/foreground/primary/card/muted/border).
  Plausible custom events lagt inn på CTA-klikk (cta_primary_click, cta_phone_click,
  cta_share_click, broker_phone_click, broker_email_click) — første custom events i repoet.
  Seed-script med full safeguards: dry-run default, pre-write backup, whitelist-sjekk,
  concurrency guard via updated_at, post-write data + HTTP verify.
  16 beads opprettet og lukket i rekkefølge (dependency-graph-drevet).
  Applied til prod-Supabase for Wesselsløkka — broker er DEMO-placeholder til ekte
  Heimdal-megler-data er hentet.
  Branch: feat/summary-megler-cta (worktree placy-ralph-summary-cta), 1 commit.
status: done
related: docs/plans/2026-04-10-feat-summary-megler-cta-plan.md
---
date: 2026-04-10
action: planned
files: [docs/brainstorms/2026-04-10-summary-megler-cta-brainstorm.md, docs/plans/2026-04-10-feat-summary-megler-cta-plan.md]
summary: Full spec-pipeline for oppsummeringsblokk — brainstorm, plan beriket med 4 research-agenter, 2 auditer (arch + data-integrity), 16 beads generert
detail: |
  Diskusjon om rapport-kvalitet før demo mot Heimdal Eiendomsmegling.
  Brukeren pekte på at "Oppsummert"-seksjonen var generisk og måtte bli salgsverktøy.
  Beslutninger: hybrid innhold (manuell først, pipeline senere), meglere som array
  i prosjekt-config, primær-CTA lenker til eksisterende wesselslokka.no/kontakt.
  Audit-verdict YELLOW → GREEN etter mitigasjoner (dobbel :root, Kort 1-scope,
  seed-safeguards).
status: done
---
date: 2026-04-07
action: deployed
files: [app/api/generation-requests/route.ts, scripts/import-olavsfest.ts]
summary: Pushet pipeline til prod, fikset tsc build-feil (Set spread → Array.from), lagt til BREVO_API_KEY i Vercel env vars
status: done
---
date: 2026-04-07
action: created
files: [lib/pipeline/import-pois.ts, lib/pipeline/create-project.ts, lib/pipeline/housing-categories.ts, app/api/generation-requests/route.ts]
summary: Automatisk generer-pipeline — megler fyller ut skjema, POI-er hentes fra Google Places + Entur + Bysykkel, lagres i Supabase, Explorer viser kart
detail: |
  Hele pipelinen kjører synkront i API-ruten (15-30 sek).
  Testet E2E: Innherredsveien 7 → 116 POI-er, alle 6 bransjeprofil-temaer.
  Gotchas: story_title lever på products (ikke projects), short_id er NOT NULL.
status: done
related: docs/plans/2026-04-07-feat-auto-generer-pipeline-plan.md
---
date: 2026-04-07
action: configured
files: [app/api/generation-requests/route.ts, .env.local]
summary: Brevo e-postutsending fra hei@placy.no — domene-autentisering, DKIM/DMARC opprydding, bekreftelsesmail ved generer-skjema
detail: |
  placy.no lagt til i Brevo. Fjernet duplikat DMARC-record i DNS.
  Mail sendes etter pipeline med "kartet er klart" eller fallback-tekst.
status: done
---
date: 2026-04-07
action: fixed
files: [package.json]
summary: Installert manglende @anthropic-ai/sdk dependency (build error på /eiendom/tekst)
status: done
---
