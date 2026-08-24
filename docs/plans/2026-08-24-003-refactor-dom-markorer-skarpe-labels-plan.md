---
title: "refactor: DOM-markører i 3D-kartet — skarpe og raskere POI-labels"
type: refactor
status: active
date: 2026-08-24
---

# refactor: DOM-markører i 3D-kartet — skarpe og raskere POI-labels

## Overview

POI-labelene i 3D-kartet er synlig uskarpe på telefon, og de kommer ~0,4 sekunder etter at
kameraet har stoppet. Begge skyldes samme valg: labelen er tegnet som `<text>` inne i markørens
SVG, som Google rasteriserer til en 3D-tekstur.

Vi bytter POI-markørene og prosjektmarkøren fra `Marker3DElement` (rasterisert SVG) til
`MarkerElement` / `MarkerInteractiveElement` — Googles HTML-markør, som er ekte DOM. Da blir
label-teksten rendret av nettleserens tekst-motor på skjermens egen oppløsning, og en
label-endring blir en tekst-node-oppdatering i stedet for en tekstur-opplasting.

Kollisjonsreglene (hvem får plass, hvem demoteres til prikk) endres ikke: `label-collision.ts` og
`pin-declutter.ts` blir stående som de er, og 2D-stien røres ikke. Men **posisjonskilden** bytter, og
det er en bonus vi ikke gikk etter: dagens `projectLatLngToScreen` antar flat bakke, mens markørene
monteres med `RELATIVE_TO_GROUND`. Google legger altså terrenghøyden til, vi gjør ikke — verifisert
ved å plassere to markører på samme koordinat med samme tall-altitude, én `ABSOLUTE` og én
`RELATIVE_TO_GROUND`: 7,8 px forskjell i skjerm-y ved fjorden på Strindfjordvegen, og ~1,04 px per
meter relieff. På et kupert board (30–80 m innenfor kartet) blir det 30–80 px feil, altså flere
markørdiametre. Declutter regner i dag mot posisjoner som er flere pinner unna der Google faktisk
tegner markøren. Googles egne transformer er terreng-korrekte.

## Problem Frame

To symptomer, én rot.

**Uskarphet.** Google rasteriserer marker-SVG-en med omtrent én teksel per CSS-piksel og skalerer
teksturen opp med skjermens pikselforhold. På en iPhone (DPR 3) blir 10 px label-tekst en 1×-bitmap
blåst 3× opp. Målt i denne sesjonen mot rapport-boardet i mobil-emulering 393×852 @ DPR 3:

- `sizePreserved = true` på alle label-bærende markører ga **0 endrede piksler** i en
  skjermbilde-diff → Googles avstands- og tilt-skalering er ikke årsaken.
- Samme SVG med `width`/`height` ganget med 3 og **uendret** `viewBox` ble tegnet 3× større **og
  skarp** → teksturens oppløsning følger SVG-ens deklarerte px-størrelse, ikke skjermens.

Konsekvensen er at det ikke finnes noen innstilling som gjør 10 px-tekst skarp så lenge teksten
ligger i teksturen. Å blåse opp SVG-en gjør pinnen større, ikke teksten skarpere.

**Treghet.** Målt **426 ms** fra siste `gmp-camerapositionchange` til første markør-DOM-mutasjon.
Det er `CAMERA_SETTLE_MS = 400` i `components/variants/report/board/use-3d-marker-declutter.ts`.
Doc-blokken der begrunner de 400 ms med at hver label-endring er en re-rasterisering, og siterer
`docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`. Den doc-en
bærer ikke slutningen: den beviser at alle de 180 lekkede WebGL-kontekstene kom fra
`isWebGLAvailable()` som kjørte per render i `useWebGLCheck`, og at **ingen** kom fra markører eller
Googles tile-renderer. Debouncen står altså på et sitat som sier det motsatte.

Måling av hva en label-endring faktisk koster, 30 markører:

| Metode | Hovedtråd-tid | Tekstur-opplasting |
|---|---|---|
| Raster (bytt `<template>`) | 2,9 ms | ja |
| DOM (`textContent = …`) | 0,6 ms | nei |

## Requirements Trace

- R1. Label-tekst på POI-markører er skarp på DPR 2–3, verifisert på ekte telefon.
- R2. Labels oppdateres merkbart raskere etter at kameraet stopper enn dagens ~426 ms.
- R3. Ingen regresjon i markørklikk, kameramodus-flipping, viewport-publisering, prosjektmarkørens
  lagdeling over POI-ene, film/fly-capture, eller 2D/Satelitt-veksling.
- R4. Testpakken er grønn før og etter — inkludert den røde testen som ligger på main nå.
- R5. Terreng-avviket i kollisjonsgeometrien er målt og tallfestet på et kupert board, så beslutningen
  om å fikse det tas på tall. (Selve fiksen er et eget spor — se Scope Boundaries.)
- R6. To overlappende POI-markører velger vinner etter kamera-avstand, ikke etter mount-rekkefølge.
- R7. Prosjektmarkørens hindringsgeometri demoterer ikke POI-er der det ikke står noe.

## Scope Boundaries

- **Reveal-laget (`RevealLayer3D`) blir rasterisert.** Blobs og legend-pins bærer ingen tekst, så de
  har ikke uskarphets-problemet. rAF-bouncen der er dessuten bygget som raster-økonomi (kvantisert
  scale + `memo` + stagger) og ville måtte skrives om for ingen brukergevinst. Ekstra grunn til å la
  den ligge: reveal-laget er en **film-leveranse**. `?fly=1` impliserer ikke `filmMode`
  (`board-url-flags.ts:72` leser bare `film=1`), og `showReveal`-garden er `!filmMode` — så
  reveal-kaskaden tegnes med hensikt inn parallelt med innflyvningen og er med i fanget video. Å
  skrive om bouncen ville endret video-output, ikke bare live-opplevelsen. Reveal-laget og
  POI-markørene sameksisterer aldri (`use-board-marker-set.ts` setter `markerPOIs` til tom liste i
  alle tre reveal-grenene), så blandet modus der er kun et estetisk sprang mellom intro og board.
- **Rute-laget, travel-chipen og mini-popupen bytter ikke mekanisme.** Ruta er en
  `Polyline3DElement` (ikke en markør). Chipen og popupen er allerede HTML-overlays.
- **Ingen oppgradering av `@vis.gl/react-google-maps`.** Wrapperen vi trenger er merget i deres main
  (PR #1009, nytt `/3d`-subpath) men ikke publisert — release-PR #1027 står åpen. Vi skriver vår egen
  på ~80 linjer i stedet for å vente på deres kadens.
- **2D-stien (Mapbox) røres ikke.** `label-collision.ts` er delt, og kontrakten der holdes uendret.

### Deferred to Separate Tasks

- **Terreng-korrekt posisjonskilde** (lese Googles egen transform i stedet for flat-bakke-projeksjonen).
  Avviket er reelt og målt, men å bytte posisjonskilde i samme runde som tegningen endrer to variabler
  samtidig: går declutter feil etterpå, vet vi ikke hvilken av dem som gjorde det. Måles i Unit 8, og
  tallet avgjør om det blir eget spor eller kan ventes med.
- Å ankre mini-popupen inne i markørens egen DOM (fjerner drift mellom vår flat-jord-projeksjon og
  Googles eksakte matrise): tas når DOM-markørene er landet og popupen kan feste seg til et element
  som finnes.
- Å pinne Maps-JS-versjonen i `APIProvider`: egen vurdering, se risikotabellen.
- Migrering av reveal-kaskaden til DOM, og overgang til vis.gls `/3d`-subpath når deres `Marker3D`
  deprecates i 1.10.0.

## Context & Research

### Relevant Code and Patterns

- `components/map/map-view-3d.tsx` — monteringspunktet for hele markør-stacken: prosjektmarkøren,
  `Marker3DItem` (POI-ene) og reveal-laget.
- `components/map/Marker3DPin.tsx` — POI-pinnen som SVG. Filen som produserer den uskarpe labelen.
- `components/map/ProjectSitePin.tsx` — prosjektmarkøren som SVG (52 px disc etter redesignet som
  ligger ucommittet i arbeidstreet i dag).
- `components/map/route-layer-3d.tsx` — mønsteret for å opprette et Google-3D-element imperativt via
  `importLibrary("maps3d")`. En egen markør-wrapper følger samme disiplin.
- `components/variants/report/board/BoardTravelChip3D.tsx` og `BoardPOI3DMiniPopup.tsx` — dagens
  HTML-overlays. Popupen bruker alt `translate3d(...) translate(-50%,-100%)`, som er **samme
  anker-konvensjon** som `MarkerElement`s default.
- `types/google-maps-3d.d.ts` — deklarerer i dag kun `Marker3DElement` og
  `Marker3DInteractiveElement`.

### Verifiserte fakta om `MarkerElement`

Målt i Chrome mot rapport-boardet, Maps JS 3.66.1a, og krysssjekket mot Googles referanse:

- **GA i vanlig kanal.** Ingen `v=alpha` eller `v=beta`. Introdusert i beta 3.64.2b (feb 2026),
  promotert til weekly 3.64.5d (mars 2026). Kun `autofitsCamera` er alpha, og den bruker vi ikke.
  `@types/google.maps` 3.64.0 ligger allerede i `node_modules` og typer både klassene og
  JSX-tag-mappingen for `gmp-marker` / `gmp-marker-interactive`.
- **Google posisjonerer markøren selv.** Inline style:
  `transform: translate(-50%, -100%) translate(400.198px, 420.431px); will-change: transform;`
  Første `translate` er ankeret (bunn-midt = default `anchorLeft: -50%`, `anchorTop: -100%`), siste
  er skjermposisjonen. `will-change` er alt satt av Google. Sporing verifisert: kameraet panorert
  nordover i fem steg ga markør-y 374 → 446 → 532 → 633 → 756.
- **CSS `z-index` er dokumentert og virker.** «Overlapping markers with a larger z-index cover those
  with a smaller one. By default, markers are displayed according to their DOM position.» Verifisert
  settbar på vertselementet. Dette er en bedre lagspak enn Googles numeriske `zIndex`.
- **DOM maler alltid over den rasteriserte scenen.** En DOM-markør med `z-index: 1` plassert i samme
  punkt som prosjektmarkøren (Googles `zIndex: 1000000`) dekket den. Dette er grunnen til at
  prosjektmarkøren **må** følge med i samme runde.
- **Innholdet er paint-contained.** `gmp-map-3d` har `contain: content` + `overflow: hidden`, og
  markøren får `z-index: auto`. En label som stikker forbi kartkanten klippes i kartboksen: målt
  `scrollWidth` 393 = `innerWidth` 393, ingen sidescroll, og markørene kan ikke sikle over
  Mapbox-overlayet på `z-[5]` eller ut over bottom-sheeten.
- **Interaksjon virker.** `MarkerInteractiveElement` fyrer `gmp-click`, og `elementFromPoint` treffer
  markørens egen DOM.
- **Ytelse: ingen gevinst å love.** Googles egen guide oppgir «reliable interaction performance up to
  around 1,000 markers»; boardet monterer ~470. Egen måling ved 310 markører under kamerabevegelse
  ga raster 37,7 fps → DOM 33,3 → ingen markører 49,8 → raster igjen 45,5. Variasjonen innen samme
  tilstand er større enn mellom tilstandene. Gevinsten i denne planen er skarphet og responstid,
  ikke bildefrekvens.

### Institutional Learnings

- `docs/solutions/ui-bugs/google-maps-3d-marker-template-swap-spokelser-20260823.md` — et
  komponent-**typebytte** for samme POI får React til å unmounte elementet, og Google fortsetter å
  tegne den fjernede markørens tekstur: en klynge som skulle bli 2 pins + 6 prikker rendret som 8
  fulle pins. Regelen er «bytt barnet, aldri elementet». **Konsekvens for denne planen: ingen
  feature-flagg som flipper markørtype per POI.** Byttet skjer i én retning, for hele laget.
- `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md` — se
  Problem Frame. Doc-en avkrefter begrunnelsen for 400 ms-debouncen, og gir samtidig metoden for å
  bevise at DOM-markører ikke lekker: tell unike canvas med `WeakSet`, i nystartet Chrome.

### External References

- https://developers.google.com/maps/documentation/javascript/reference/3d-map-draw — `MarkerElement`,
  `MarkerInteractiveElement`, `MarkerElementOptions`.
- https://developers.google.com/maps/documentation/javascript/3d/marker-html-css — offisiell HTML/CSS-guide
  for `<gmp-marker>`.
- https://developers.google.com/maps/documentation/javascript/3d/marker-overview — sammenligningstabell
  `MarkerElement` mot `Marker3DElement`, og ~1 000-markør-grensen.
- https://github.com/visgl/react-google-maps/blob/main/src/components/3d/marker.tsx — vis.gls egen
  (uutgitte) wrapper; mønsteret vår egen følger.
- Merk: Googles `3d/best-practices`-side er ikke oppdatert for `MarkerElement` og hevder fortsatt at
  «Adding plain HTML or CSS is not available for now». Ytelsestallene der (300 markører / 41 SVG-glyfer
  = 150–300 ms) gjelder `Marker3DElement`.

## Key Technical Decisions

- **Posisjonskilden blir IKKE byttet i denne runden.** `projectLatLngToScreen` beholdes som geometri-
  kilde, og konsumentlisten forblir eksakt tre (fil-scan-vakten i `BoardPOI3DMiniPopup.test.tsx` bryter
  i **begge** retninger — også om declutter fjerner importen). Terreng-avviket er reelt, men å bytte
  posisjonskilde samtidig med tegningen endrer to variabler på én gang. Måles i Unit 8; tallet avgjør.
  Til gjengjeld er det verifisert at avlesningen *kan* gjøres layout-fritt når vi vil: tre markører med
  bokser på 40, 132 og 40 px fikk **identisk** `translate(623.5px, 497.005px)`, altså er px-translaten
  geo-ankeret og ikke boksens topp-venstre hjørne. Skal det leses, leses `style.transform` som string —
  aldri `getComputedStyle` (den komponerer inn anker-prosentene) og aldri `getBoundingClientRect`
  (tvungen layout, målt 3,2 ms for 30 markører).
- **Halvstørrelser forblir konstanter.** `PIN_HALF`/`DOT_HALF` skal aldri erstattes av målte bokser.
  `label-collision.ts` forutsetter at hindringer er disc-sirkler, og invarianten «egen markør kolliderer
  aldri med egen label» holder bare fordi hindringen er 20 px disc mens labelen starter 28 px ute. Mates
  label-inklusive bokser inn, blokkerer hver markør sin egen label og plasseringen oscillerer mellom
  høyre og venstre. Samme grunn til at `LABEL_CHAR_W`/`LABEL_MAX_W`-anslaget beholdes: i jsdom
  returnerer `getBoundingClientRect` på et transformert element bare nuller, så en DOM-målt bredde ville
  gitt grønne tester og tull-geometri. Regelen for alle markør-avlesninger: **les alt, regn, skriv alt**
  — aldri lesing og skriving om hverandre i samme løkke.
- **Gaten filtrerer på et eget attributt, ikke på Googles tagnavn.** Kritisk detalj:
  `closest("gmp-marker")` matcher **ikke** `<gmp-marker-interactive>` — det er to ulike tagnavn, ikke et
  prefiks. Et `data-placy-marker`-attributt på alle markør-verter er derfor den robuste gaten, med
  tagnavnene som fallback.
- **Labelen ligger absolutt plassert utenfor flyten, i en 40×40 boks.** `anchorLeft: -50%` er prosent
  av elementets **egen** boks. Verifisert: disc + label i flex-flyt gjorde verts-boksen 132 px bred, og
  `-50%` av den skyver disc-en ut av punktet — mens en 40×40 boks med `position: absolute`-label ga
  samme anker som en naken disc. Bonus: da er ankeret uendret bunn-midt, så
  `anchorToDiscCenterY(y, PIN_HALF)` og mini-popupens −28 px trenger **ingen** re-utledning. Verifisert
  at Google ikke klipper innholdet: markør-verten har `overflow: visible`, `contain: none`,
  `clip-path: none`, og en label som stikker 91 px ut var fullt synlig.
- **Vi må dybdesortere selv.** Google depth-sorterer ikke DOM-markører: alle får `z-index: auto`, og
  DOM-rekkefølgen endres ikke når kameraet snus. Paint-rekkefølge blir React-render-rekkefølge, altså
  mount-orden, mens rasteriserte markører sorteres i scenen i dag. To overlappende POI-pins ville
  derfor valgt vinner tilfeldig. `z-index` settes fra kamera-avstand, som declutter alt regner.
- **Tag-navn-gaten sikres før markørene bytter navn.** Tre kjørende steder matcher
  `closest("gmp-marker-3d-interactive")`: `BoardMap3D.tsx:361` (bakgrunnsklikk lukker POI-popup),
  `BoardMap3D.tsx:504` (drag-takeover auto→fri) og `use-3d-viewport-publish.ts:179` (marker-tapp skal
  ikke regnes som brukergrep). Slutter én av dem å matche, leses hvert POI-trykk som et kamera-grep:
  popupen lukkes idet den åpnes, kameramodus hopper til fri, og nabolagslista re-scopes under
  fingeren. Gaten flyttes til én delt selektor-konstant som dekker begge generasjoner.
- **Prosjektmarkøren bytter i samme runde som POI-ene. Dette er en hard betingelse, ikke en
  preferanse.** To uavhengige verifikasjoner: (1) en DOM-markør plassert på prosjektpinnens eksakte
  koordinat tegnet over «Strindfjordvegen 10 / Nybygg 2028»-skiva i både Satelitt og 3D — den
  rasteriserte markøren har `getBoundingClientRect` 0×0 og tom `getComputedStyle`, den er ren
  dataholder mens det visuelle bor i WebGL-canvaset, så et DOM-element med ekte boks komposittes
  uunngåelig over hele canvaset. (2) Verre: `pin-declutter`s hele hensikt inverteres. POI-er demoteres
  til 14 px prikk **nettopp fordi** de ligger bak prosjektmarkøren, og prikken fjernes ikke — den
  rendres fortsatt. Rasterisert lå den bak (`zIndex 1`); som DOM legger den seg på prosjektpinnens
  ansikt. Resultatet av demoteringen ville blitt fargeflekker oppå prosjektnavnet.
- **Ankeret endres ikke.** `MarkerElement`s default `anchorLeft: -50%` / `anchorTop: -100%` gir eksakt
  samme bunn-midt-forankring som `Marker3DElement` — verifisert som inline
  `transform: translate(-50%, -100%) translate(623.5px, 510px)`. Så lenge markørboksen holdes 40×40
  (se labelen over), står `anchorToDiscCenterY` og mini-popupens −28 px uendret riktig. Dette var en
  fryktet lockstep-endring som viste seg å ikke finnes.
- **Markørene må være barn av `gmp-map-3d`, aldri en søsken-overlay.** `FLY_CLEAN`-steget i
  `scripts/capture-3d-flythrough.mjs` setter `display: none !important` på alle **søsken** av
  kartelementet oppover hele ancestor-kjeden. Det etablerte overlay-mønsteret i denne kodebasen
  (`BoardTravelChip3D`, `BoardPOI3DMiniPopup` — søsken som posisjonerer seg selv) ville derfor blitt
  usynlig i capture. `<gmp-marker>` appendet som lys-DOM-barn overlever, fordi løkken bare rører søsken.
- **Egen wrapper, ikke ny avhengighet.** ~80 linjer etter vis.gls mønster (`usePropBinding`,
  `useDomEventListener`, ref-callback). JSX-typingen finnes alt lokalt. Migrering til vis.gls
  `/3d`-subpath senere blir en ren import-bytte — og siden deres `Marker3D` blir deprecated i 1.10.0,
  må den import-runden uansett tas en gang.

## Open Questions

### Resolved During Planning

- Blir DOM-markører med i film/video-capture? **Ja.** `scripts/capture-3d-flythrough.mjs` bruker CDP
  `Page.startScreencast`, som komponerer hele sidens compositor-flate — ikke canvas-readback. Ingen
  Puppeteer eller Playwright i repoet. Scriptets `FLY_CLEAN`-steg skjuler DOM-**søsken** oppover
  ancestor-kjeden, aldri barn av `gmp-map-3d`. Og film/fly/establishing setter uansett `markerPOIs`
  til tom liste i `use-board-marker-set.ts`, så de eneste markørene i et opptak er prosjektpinnen og
  eventuelle reveal-blobs.
- Krever `MarkerElement` alpha-kanalen? **Nei**, den er GA i vanlig kanal.
- Kan DOM-markører sikle ut over bottom-sheeten eller over 2D-overlayet? **Nei.** `gmp-map-3d` har
  `contain: content` → paint containment → egen stablingskontekst, og ingen forelder mellom kartet og
  `body` har `transform`/`isolation`/`filter`. Testet med `z-index: 2147483647` på både markøren og
  dens inner-div, med en 1600×1200 boks som geometrisk dekket bunn-kontrollen: `elementFromPoint`
  returnerte fortsatt «3D»-knappen. Mini-popupen (z-30), tids-chipen, kontroll-pillen,
  `CameraCutOverlay`, ikke-interaktiv-skjoldet (z-10) og Mapbox-overlayet (z-[5]) blir liggende over.
- Trenger vi Googles `Label3DElement` for uavhengig label-kollisjon? **Nei** — den er alpha-only,
  dokumentert kun for `Marker3DElement`, og ville gitt rasterisert tekst igjen.
- Skalerer `MarkerElement` med kamera-avstand? **Nei.** Matrisens `a` og `d` er konstant 1 målt over
  range 300 → 600 → 1200 → 2400 → 4000 m. De skjerm-forankrede konstantene (`PIN_HALF` 20,
  `DOT_HALF` 7, `DEFAULT_PIN_SEPARATION_PX` 34, `LABEL_OFFSET_3D` 28) er derfor trygge, og
  `label-collision`s px-anslag trenger ingen skala-faktor.
- Blir DOM-markører okkludert av 3D-bygg? **Nei, aldri.** Verifisert med tvillingprober på samme
  koordinat 80 m **under** bakken: den rasteriserte var usynlig, DOM-markøren fullt synlig. Altitude
  18/30 finnes utelukkende for å heve markørene over taknivå så de ikke okkluderes og blinker — den
  begrunnelsen faller bort. Konsekvens som må håndteres: markører bak bygg og koller flyter nå oppå
  dem uten dybdehint.

### Deferred to Implementation

- Hvor lavt kan ro-vinduet settes? Raster-kostnaden forsvinner, men recompute projiserer fortsatt i JS
  og kjører to greedy O(n²)-aktige passeringer over ~470 kandidater. Den delte geometrien er målt til
  0,16 ms ved 261 markører, så hovedtråden er ikke det som beskyttes av 400 ms — men tallet settes
  etter måling ved ~470, ikke etter gjetning.
- Bør `altitude` 18/30 justeres nå som okklusjon ikke lenger finnes? Tallene er ikke lenger et vern,
  men de påvirker fortsatt hvor markøren projiseres. Endres de, endres bildet — så la dem stå med
  mindre en måling gir grunn.
- Skal `?fly=1` implisere `filmMode`? I dag gjør den det ikke, så reveal-kaskaden er med i capture.
  Det kan være tilsiktet (kaskaden er en del av filmen) — endres bare hvis Andreas vil det. Ikke en
  del av denne planen.

## High-Level Technical Design

> *Dette illustrerer den tenkte tilnærmingen og er retningsgivende for gjennomlesing, ikke en
> implementasjons-spesifikasjon. Den implementerende agenten skal lese det som kontekst, ikke som kode
> å reprodusere.*

```
FØR                                         ETTER
───                                         ─────
POSISJON                                    POSISJON  (UENDRET denne runden)
 projectLatLngToScreen                       projectLatLngToScreen
  (flat bakke — bommer                        samme flat-bakke-avvik, nå MÅLT
   ~1,04 px per meter relieff)                og satt som eget spor
        │                                            │
        ▼                                            ▼
KOLLISJON  (uendret, delt med 2D)           KOLLISJON  (uendret, delt med 2D)
 label-collision + pin-declutter             label-collision + pin-declutter
 halfSize = PIN_HALF 20 / DOT_HALF 7         halfSize = PIN_HALF 20 / DOT_HALF 7
        │                                            │
        │ labels{text,side}                          │ labels{text,side} + z fra avstand
        ▼                                            ▼
TEGNING                                     TEGNING
 <gmp-marker-3d-interactive>                 <gmp-marker-interactive>
  └ <template>                                └ <div> 40×40 relative   ← boksen MÅ bli 40×40
     └ <svg> (symmetrisk ramme                   ├ disc (CSS, absolute inset-0)
        for å nøytralisere ankeret)              └ label (CSS, ABSOLUTE — utenfor flyten,
        ├ circle                                    pointer-events: none)
        ├ icon
        └ <text> label  ← uskarp
              │                                            │
      Google rasteriserer til tekstur            Nettleseren rendrer tekst på
      (~1 teksel per CSS-px, blåses              skjermens egen oppløsning.
       opp med DPR)                              Google skriver bare transform.
```

To ting skifter mekanisme:

- **Lagdeling:** fra Googles numeriske `zIndex` (POI 1, prosjekt 1 000 000) til CSS `z-index`. Google
  depth-sorterer ikke DOM-markører — alle får `z-index: auto` og rekkefølgen endres ikke når kameraet
  snus — så avstands-sorteringen blir vår jobb.
- **Ankeret:** uendret bunn-midt (`-50% / -100%` er Googles default på begge markørtyper). Det er
  derfor labelen **må** ut av flyten: `-50%` er prosent av elementets egen boks, så en label i flyten
  ville flyttet disc-en bort fra punktet. Holdes boksen 40×40, står `anchorToDiscCenterY` og
  mini-popupens −28 px uendret riktig.

## Implementation Units

- [ ] **Unit 1: Grønn grunnlinje og prosjektpinnens hindringsgeometri**

**Goal:** Arbeidstreet er grønt, og de to feilene i prosjektpinnens hindring er rettet før migrasjonen
arver dem.

**Requirements:** R4, R7

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/use-3d-marker-declutter.ts`
- Modify: `components/variants/report/board/use-3d-marker-declutter.test.tsx`
- Modify: `components/map/map-view-3d.tsx`
- Create: `components/map/project-site-pin.test.tsx`

**Approach:**
- **Inngangsbilletten:** testen «POI bak chipen blir prikk» feiler nå (3071 passert / 1 feilet), og
  pre-commit kjører `npm test` — så ingen commit i markørstacken går gjennom før dette er landet.
  Årsaken er prosjektpinne-redesignet som ligger ucommittet: pinnen gikk fra et ~300×105 px kort til en
  52 px disc, så blockeren er bare ~25,7 px halv-høyde og POI-en 44 px unna dekkes ikke lenger. Testens
  egen kommentar beskriver fortsatt den gamle geometrien («y ≈ 700–800, x ≈ 790–1010»).
- **Feil A — hindringen er symmetrisk, men teksten er bare på høyre side.** `projectSitePinSize` gir en
  bredde som dekker disc + luft + tekst, og declutter sentrerer den boksen på disc-en. For
  «Strindfjordvegen 10» blir det en ~347 px bred boks der ~174 px stikker inn i tomrommet til
  **venstre** for disc-en — 88 % av mobilbredden — og hver POI i det båndet demoteres til prikk uten at
  det står noe der. Fiks: forskyv hindringens senter til `homePt.x + textW / 2` og sett `halfWidth` til
  `(DISC / 2 + GAP_X + textW) / 2`.
- **Feil B — undertittel-defaulten treffer utilsiktet.** `projectSitePinSize(navn, undefined, scale)`
  faller på JS-defaulten «Nybygg 2028» og reserverer plass til en undertittel kallet ser ut som det ikke
  har. Prop-drill den faktiske `subtitle` inn.
- `ProjectSitePin` har **ingen** testfil i dag, samtidig som den har 291 linjer ucommittet redesign.
  Skriv den første.
- `opacities`-propen på `MapView3D` (linje 81 / 300 / 399) har null konsumenter i hele repoet. Slettes
  i sin helhet per kodebase-hygiene-regelen.

**Patterns to follow:** Eksisterende fikstur-hjelpere i samme testfil (`makeMap`, `poi`, `settle`).

**Test scenarios:**
- Happy path: en POI som ligger bak den nye 52 px-disc-en demoteres til prikk.
- Edge case: en POI rett utenfor disc-ens nye halv-høyde demoteres **ikke** — grensen testes fra begge
  sider, så fiksturen ikke bare flyttes til «alt passerer».
- Edge case: en POI til **venstre** for disc-en, i båndet der teksten ikke står, demoteres ikke. Dette
  er testen for Feil A.
- Edge case: hindringen er bredere når prosjektnavnet er langt, og smalere når det er kort.
- Edge case: uten `subtitle` reserveres ikke plass til en undertittel. Dette er testen for Feil B.
- Happy path (`project-site-pin.test.tsx`): pinnen rendrer navn og undertittel, og `projectSitePinSize`
  returnerer mål som stemmer med det som faktisk tegnes.
- Happy path: `npx tsc --noEmit` er ren etter at `opacities` er fjernet.

**Verification:** `npx vitest run` er grønn i sin helhet. `grep` for `opacities` gir 0 treff.

---

- [ ] **Unit 2: Delt markør-selektor + typedeklarasjoner for HTML-markøren**

**Goal:** Tag-navn-gaten dekker begge markør-generasjoner, og de nye Google-typene er deklarert — alt
før noen markør faktisk bytter element.

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Create: `components/map/marker-3d-selectors.ts`
- Modify: `types/google-maps-3d.d.ts`
- Modify: `components/variants/report/board/BoardMap3D.tsx`
- Modify: `components/variants/report/board/use-3d-viewport-publish.ts`
- Test: `components/map/marker-3d-selectors.test.ts`
- Test: `components/variants/report/board/use-3d-viewport-publish.test.tsx`

**Approach:**
- Én eksportert konstant og én liten hjelper som svarer på «ligger dette event-målet inne i en markør?».
  Erstatter de tre hardkodede `closest(...)`-kallene. Gaten filtrerer primært på et eget
  `data-placy-marker`-attributt som alle markør-verter bærer, med tagnavnene som fallback — fordi
  `closest("gmp-marker")` **ikke** matcher `<gmp-marker-interactive>` (to ulike tagnavn, ikke et
  prefiks). En selektor bygget på tagnavn alene ville derfor sluppet gjennom halvparten.
- `use-3d-viewport-publish.test.tsx:282` bygger i dag et literalt
  `document.createElement("gmp-marker-3d-interactive")`. Den utvides til å dekke det nye tag-navnet,
  slik at gaten er bevist for begge generasjoner før byttet.
- **Typene finnes allerede — slett skyggen i stedet.** `@types/google.maps` 3.64.0 (alt i `node_modules`)
  har `MarkerElement`, `MarkerInteractiveElement`, `MarkerElementOptions` og både `gmp-marker` og
  `gmp-marker-interactive` i `HTMLElementTagNameMap`. `types/google-maps-3d.d.ts` har en lokal
  `Marker3DElement`-klasse og `Maps3DLibrary`-blokk som skygger for dem, og som bare er usynlig fordi
  `skipLibCheck` står på — slett den lokale duplikaten. Det som faktisk må legges til er
  JSX-deklarasjonen: vis.gl deklarerer bare `gmp-marker-3d*` i `JSX.IntrinsicElements`.
  Merk at `extruded`, `sizePreserved` og `zIndex` **ikke** finnes på den nye typen.

**Execution note:** Utvid testen for tag-gaten før selektoren tas i bruk — den er hele poenget med
enheten, og en grønn test her er det som gjør Unit 4 og 5 trygge.

**Patterns to follow:** Eksisterende deklarasjoner for `Marker3DElement` i samme `.d.ts`-fil.

**Test scenarios:**
- Happy path: et event-mål inne i `<gmp-marker-3d-interactive>` gjenkjennes som markør (dagens
  oppførsel bevart).
- Happy path: et event-mål inne i `<gmp-marker-interactive>` gjenkjennes som markør.
- Edge case: et event-mål inne i `<gmp-map-3d>` men utenfor enhver markør gjenkjennes **ikke** som
  markør — ellers slutter bakgrunnsklikk å lukke POI-popupen.
- Edge case: et dypt nøstet barn (label-span inne i markørens div) gjenkjennes som markør, siden
  klikket vil treffe barnet og ikke verten.
- Integration: viewport-publiseringen behandler ikke et markør-tapp som brukergrep for det nye
  tag-navnet.

**Verification:** Testene dekker begge tag-generasjoner. `grep` for
`closest("gmp-marker-3d-interactive")` gir 0 treff i kjørende kode.

---

- [ ] **Unit 3: `DomMarker3D` — egen React-wrapper for HTML-markøren**

**Goal:** Én liten, testbar komponent som monterer `<gmp-marker>` / `<gmp-marker-interactive>` og
binder Googles properties, uten ny npm-avhengighet.

**Requirements:** R1, R3

**Dependencies:** Unit 2

**Files:**
- Create: `components/map/DomMarker3D.tsx`
- Test: `components/map/DomMarker3D.test.tsx`

**Approach:**
- Speiler vis.gls mønster: ref-callback til state, `usePropBinding`-ekvivalent for `position`,
  `altitudeMode`, `anchorLeft`, `anchorTop`, `collisionBehavior`, `collisionPriority` og `title`, og
  `gmp-click` via en DOM-lytter. Velger `<gmp-marker-interactive>` når `onClick` er satt, ellers
  `<gmp-marker>` — samme regel som `Marker3D`.
- Markøren appendes som barn av `gmp-map-3d`, aldri som søsken-overlay (capture-skranken over).
- Barn sendes rett inn som light DOM. Ingen `<template>`, ingen `cloneNode`. Det betyr at React-events
  faktisk virker inne i markøren for første gang, så begge klikk-stier blir mulige samtidig. Wrapperen
  eksponerer derfor **bare** `gmp-click` (via `addEventListener`), og Unit 4 legger ingen React
  `onClick` på innholdet — se valget som er begrunnet der.
- `position` kopieres felt for felt (`lat`, `lng`, `altitude`). `LatLngAltitude` har gettere, så spread
  gir `InvalidValueError`.
- Runtime capability-sjekk: Maps JS er upinnet (3.66.1a servert, typer 3.64.0). Mangler `MarkerElement`,
  skal laget **bail'e stille** — aldri falle tilbake til `Marker3D`. To markørgenerasjoner samtidig er
  både spøkelses-risiko og ukjent z-orden.
- Hent kart-instansen via det eksisterende `MapReadyBridge`-prop-drillet, ikke `useMap3D` (upålitelig
  utenfor `Map3D`-treet).
- Elementet skal aldri bytte tag-navn for samme markør i levetiden. Ghost-markør-læringen gjelder
  migrasjonen selv.
- Eksponer `zIndex` som en CSS-`z-index` på vertselementet (ikke en Google-prop — den finnes ikke).
  Unit 6 mater den fra kamera-avstand.
- Ingen ny `dynamic()`-grense i `ReportReelsPage.tsx`: den filen har en `count === 5`-assertion på
  antall lazy-grenser (`ReportReelsPage.lazy-boundaries.test.ts`). Hele 3D-treet ligger allerede under
  et `ssr: false`-skall, som er det eneste som hindrer krasj — vis.gls `Marker3D` kaller
  `document.createElement` under render. Trenger laget en lazy-grense, hører den i `BoardMap3D.tsx`
  der `RouteLayer3D`-grensen alt lever.

**Patterns to follow:** `components/map/route-layer-3d.tsx` for imperativ `importLibrary`-disiplin, og
vis.gls `Marker3D` i `node_modules/@vis.gl/react-google-maps` for prop-bindingen.

**Test scenarios (jsdom-forbehold):** jsdom har **ikke** `elementFromPoint`, og
`getBoundingClientRect` på et transformert element returnerer nuller — hit-testing og posisjon kan
derfor ikke regresjonstestes her, bare i browser. Fake-mønsteret fra `route-layer-3d.test.tsx` (POJO
`class FakeMarker { append() {} }`) kan **ikke** gjenbrukes: et DOM-markørlag trenger ekte
`Element`-er for `closest()` og `appendChild`, og i jsdom kaster
`new (class extends HTMLElement {})()` med «Invalid constructor» med mindre klassen er registrert.
Skriv én delt test-helper som gjør `customElements.define(...)` bak en
`if (!customElements.get(...))`-guard — dobbel `define` av samme navn kaster `NotSupportedError`.

**Test scenarios:**
- Happy path: uten `onClick` monteres `<gmp-marker>`; med `onClick` monteres
  `<gmp-marker-interactive>`.
- Happy path: `position` og `altitudeMode` bindes til elementet, og en endring i `position` oppdaterer
  elementet uten å remounte det.
- Happy path: barn havner i light DOM (ikke i et `<template>`), så tekst er lesbar i DOM-en.
- Edge case: `onClick` som blir `undefined` etter mount fører ikke til at tag-navnet byttes —
  elementet skal bevares (ghost-markør-regelen).
- Edge case: unmount fjerner elementet og lytteren, uten forlatte referanser.
- Error path: monteres komponenten før `maps3d`-biblioteket er lastet, kaster den ikke — den venter.

**Verification:** Testene passerer i jsdom. En manuell montering på boardet viser markøren med
`transform` skrevet av Google.

---

- [ ] **Unit 4: POI-pinnen og labelen som DOM**

**Goal:** POI-markørene tegnes som HTML med CSS, og labelen er ekte tekst. Dette er enheten som gjør
teksten skarp.

**Requirements:** R1, R3

**Dependencies:** Unit 3

**Files:**
- Create: `components/map/PoiMarkerContent.tsx`
- Modify: `components/map/map-view-3d.tsx`
- Modify: `components/variants/report/board/BoardMap3D.tsx`
- Test: `components/map/poi-marker-content.test.tsx`

**Korrigert under implementering:** `Marker3DPin.tsx` skal **ikke** slettes.
`RevealLayer3D` bruker den fortsatt for legend-pinsene, og reveal-laget er bevisst
utenfor scope (se Scope Boundaries). Verifisert at reveal ikke sender `label`, så
bare label-halvdelen av filen blir død — den ryddes i Unit 8, som planlagt.
`BlobMarker3D` beholdes av samme grunn: reveal-kaskaden tegner blobs med den.

**Approach:**
- **Boksen må holdes 40×40.** Disc-en er en `position: relative` 40×40 boks, og labelen ligger
  `position: absolute` utenfor flyten (venstre eller høyre av disc-en). Dette er ikke en stilpreferanse:
  `anchorLeft: -50%` er prosent av elementets egen boks, så en label i flyten gjorde boksen 132 px bred
  og skjøv disc-en ut av punktet. Med 40×40 er ankeret uendret bunn-midt, og både
  `anchorToDiscCenterY` og mini-popupens −28 px står riktig uten endring.
- Ikonet kan gjerne bli SVG inni — det er **teksten** som trenger DOM. Kategori-farget ring og lys
  tint beholdes, så uttrykket er uendret.
- Den hvite konturen bak teksten er i dag to `<text>`-noder fordi SVG mangler `text-shadow`. I DOM blir
  den `text-shadow` eller `paint-order`. Merk at `text-shadow` på flere hundre elementer er en kjent
  compositor-kostnad — måles i Unit 8, og er grunnen til at Satelitt-modus (tilt 0, flest synlige
  labels) er et eget verifikasjonspunkt.
- Labelens side (`left`/`right`) kommer fortsatt fra declutter-hooken.
- **Klikk går via `gmp-click`, ikke via React `onClick`.** Dette er valget Unit 3 lar stå åpent, og det
  må være entydig: light DOM gjør at React-handlere inne i markøren virker for første gang, så begge
  stier er plutselig mulige og et klikk kunne utløst POI-valget to ganger. Vi holder `gmp-click`, fordi
  det er den stien de tre `closest(...)`-gatene og bakgrunns-lukkingen i `BoardMap3D` alt er bygget
  rundt — den bubler til kartelementet slik i dag. Legg derfor **ingen** React `onClick` på
  markør-innholdet.
- **Pointer-events:** labelen skal ikke stjele kart-gester. DOM-markøren tar over hit-testingen fra
  canvaset (verifisert: `elementFromPoint` på markørsenteret returnerer markørens egen inner-div, og
  `pointerEvents` er `auto`), så et drag som starter på en markør treffer ikke lenger Googles
  gesture-håndtering direkte. Gi labelen `pointer-events: none` og hold treffflaten på disc-en.
- `Marker3DPin.tsx` slettes, ikke kommenteres ut. Blir `wrapLabelLines` og
  `LABEL_HALO`/`LABEL_HALO_W` uten konsumenter, ryddes de i Unit 8 sammen med testene sine.
- Prikk-tilstanden (demotert) fortsetter å bytte **barnet**, aldri elementet.

**Execution note:** `marker-primitives.test.tsx` er kontrakts-tester, ikke støy. De skal
re-uttrykkes mot DOM-markøren (disc-diameter, ikon-ratio, label-side, anker), ikke slettes.

**Patterns to follow:** Fargelogikken i `lib/utils/marker-color.ts` (`hexLightTint`) og
`lib/utils/map-icons-filled.ts` beholdes uendret. 2D-markøren i `BoardMarker.tsx` viser hvordan samme
uttrykk gjøres i HTML/CSS — 3D konvergerer nå mot den.

**Test scenarios:**
- Happy path: markøren rendrer disc på 40 px og et ikon med ratio 0,50 (20 px), som i dag.
- Happy path: med `label` finnes teksten som lesbar tekst-node i DOM-en; uten `label` finnes ingen
  tekst-node.
- Happy path: `labelSide: "left"` plasserer labelen til venstre for disc-en, `"right"` til høyre.
- Edge case: **verts-boksen er 40×40 uansett om labelen finnes, hvor lang den er, og hvilken side den
  står på.** Dette er testen som beskytter ankeret — den skal feile hvis noen legger labelen i flyten.
- Edge case: et svært langt POI-navn brer seg ikke ubegrenset (maksbredde og linjeklipp holder), og
  markøren forskyves ikke.
- Edge case: `compact: true` tegner prikken uten å bytte vertselementets tag-navn.
- Edge case: labelen har `pointer-events: none`, så den ikke stjeler kart-gester.
- Integration: et klikk på markøren utløser POI-valget én gang — ikke to (én fra `gmp-click`, én fra
  React `onClick`).

**Verification:** Boardet viser POI-pins med skarp tekst i mobil-emulering DPR 3. Klikk åpner POI-en
og lukker den ikke igjen.

---

- [ ] **Unit 5: Prosjektmarkøren som DOM + lagdeling via CSS**

**Goal:** Prosjektmarkøren tegnes som DOM, og ligger over POI-ene igjen.

**Requirements:** R3

**Dependencies:** Unit 4

**Files:**
- Modify: `components/map/ProjectSitePin.tsx`
- Modify: `components/map/map-view-3d.tsx`
- Modify: `components/map/project-pin-scale.ts`
- Test: `components/map/project-site-pin.test.tsx`

**Approach:**
- Må skje i samme runde som Unit 4: DOM maler over den rasteriserte scenen uansett `zIndex`, så en
  rasterisert prosjektpinne ville havnet under POI-pinsene. Verifisert med en DOM-markør på `z-index: 1`
  som dekket prosjektpinnens `zIndex: 1000000`.
- Lagdelingen erstattes med CSS `z-index` på vertselementene: prosjektmarkøren høyt, POI-ene lavt.
- Den symmetriske SVG-rammen i `ProjectSitePin` finnes **bare** for å nøytralisere bunn-midt-ankeret.
  Med eksplisitt `anchorLeft`/`anchorTop` faller den bort. Thumbnailen klippes sirkulært med CSS
  (`border-radius` + `object-fit`) i stedet for SVG-`<clipPath>`, og trenger da ikke lenger være en
  data-URI — men bytt ikke bildekilde-strategi i denne enheten; behold data-URI-en og noter at kravet
  er borte.
- `scaleForRange`-rampen beholdes inntil vi vet om `MarkerElement` skalerer med kamera-avstand. Matrisens
  `a`/`d` er målt konstant 1 over range 300 → 4000 m, så rampen er sannsynligvis dødt maskineri — men
  bekreft mot den faktiske prosjektpinnen før den og `PIN_SETTLE_MS`-pollen slettes i Unit 8.
- **Mål gjennomsyn FØR du committer denne enheten.** Prosjektpinnen er flythrough-ens hero, og
  DOM-markører har ingen dybdetest: den vil kunne bli synlig gjennom bygget kameraet orbiterer rundt.
  Orbiter 360° på et tett bebygd board og se. Er gjennomsyn uakseptabelt for filmen, er det et
  produktvalg for Andreas — og fallback er ikke å beholde pinnen rasterisert (de to blockerne over
  gjelder fortsatt), men å dempe pinnen når den er okkludert, eller å akseptere det.
- Prosjektmarkøren er non-interaktiv i dag (ingen `onClick` → `gmp-marker-3d`), og et tapp på den leses
  derfor som kart-bakgrunn og lukker POI-popupen. Behold non-interaktiv (`<gmp-marker>`) så den
  atferden ikke endres stille.

**Test scenarios:**
- Happy path: prosjektnavn og undertittel finnes som lesbare tekst-noder.
- Happy path: har prosjektet en thumbnail, rendres bildet; ellers vises bygnings-glyphen.
- Edge case: prosjektmarkørens `z-index` er høyere enn POI-markørenes, så den ikke dekkes.
- Edge case: disc-en ligger på ankerpunktet uavhengig av navnelengde.
- Integration: `use-3d-marker-declutter` bruker fortsatt prosjektmarkøren som hindring med riktige
  dimensjoner (samme kilde til pinnens størrelse som før — `projectSitePinSize`).

**Verification:** Prosjektmarkøren ligger visuelt over POI-pins som overlapper den, og tekst er skarp.

---

- [ ] **Unit 6: Dybdesortering og kortere ro-vindu**

**Goal:** Overlapp avgjøres av kamera-avstand, og labels kommer raskere.

**Requirements:** R2, R6

**Dependencies:** Unit 4

**Files:**
- Modify: `components/variants/report/board/use-3d-marker-declutter.ts`
- Modify: `components/map/map-view-3d.tsx`
- Modify: `components/map/project-latlng-to-screen.ts`
- Test: `components/variants/report/board/use-3d-marker-declutter.test.tsx`

**Approach:**
- **Posisjonskilden er uendret.** `projectLatLngToScreen` blir stående, og konsumentlisten forblir
  eksakt tre — fil-scan-vakten i `BoardPOI3DMiniPopup.test.tsx` bryter i begge retninger. Terreng-
  avviket måles i Unit 8 og fikses i eget spor (se Scope Boundaries).
- `anchorToDiscCenterY` står **uendret** (ankeret er fortsatt bunn-midt). Rett doc-blokken der den
  forklares, og rett sitatet som begrunner 400 ms med WebGL-kontekster — den doc-en sier det motsatte.
- **Dybdesortering:** sett `z-index` per markør fra kamera-avstand, som hooken alt regner for
  prioritet. Uten dette avgjøres overlapp av mount-rekkefølge (verifisert: alle DOM-markører får
  `z-index: auto`, og rekkefølgen endres ikke når kameraet snus). Aktiv POI får eksplisitt z-index.
- Senk `CAMERA_SETTLE_MS` til ~100 ms, og `DATA_SETTLE_MS` tilsvarende. Begrunnelsen for de 400 ms var
  re-rasteriseringen, som er borte. Geometrien er dessuten målt gratis: `computePinDemotions` +
  `computeLabelPlacements` = 0,152 ms ved 261 markører, og 261 projeksjoner = 0,011 ms, av et
  16,7 ms frame-budsjett. **Ikke sett den til 0** — React-passet over ~470 memoiserte markører er umålt
  og er det eneste som kan spise frames. `DATA_SETTLE`-timerens egen begrunnelse (en drone-orbit faller
  aldri til ro, så et nytt markørsett ville sultet) består, bare kortere.
- **Løft `getBoundingClientRect` ut av per-POI-løkken.** `projectLatLngToScreen` leser rect'en internt og
  kalles én gang per markør per omregning — legg til et valgfritt rect-parameter, uten atferdsendring
  når det utelates.
- Fasedisiplin: les alt, regn, skriv alt. Aldri lesing og skriving om hverandre i samme løkke.

**Execution note:** Mål recompute-tiden ved ~470 kandidater før du bekrefter tallet, og skriv tallet du
målte inn i doc-blokken. Neste person skal ikke måtte gjenoppdage det.

**Test scenarios:**
- Happy path: en label kommer etter det nye ro-vinduet, og ikke før.
- Edge case: hindringene har alltid `halfSize` 20 (pin) eller 7 (prikk), aldri en målt boks. Testen
  skal feile hvis en label-inklusiv boks brukes.
- Edge case: to overlappende markører sorteres etter avstand, og rekkefølgen snur når kameraet snur.
- Edge case: aktiv POI ligger over naboene uansett avstand.
- Edge case: plasseringen fryses fortsatt mens kameraet er i bevegelse (ingen churn per frame).
- Edge case: et nytt markørsett får plassering selv mens kameraet beveger seg (datasett-timeren
  overlever den kortere kamera-timeren).
- Edge case: uendret scene gir fortsatt samme objekt-identitet, så React ikke re-rendrer unødig.
- Edge case: `projectLatLngToScreen` gir samme resultat med og uten det nye rect-parameteret.

**Verification:** Målt tid fra siste kamera-hendelse til label-oppdatering er vesentlig under dagens
426 ms, med tallet notert i doc-blokken.

---

- [x] **Unit 7: Ikke la markørene churne usynlig i 2D og Satelitt** — **IKKE NØDVENDIG, premisset
  falsifisert ved måling**

Målt i browser: **0** style-skriv på de 465 DOM-markørene gjennom hele 2D-visningen, inkludert åtte
pan-gester på Mapbox-overlayet. Google skriver `transform` bare når 3D-kameraet faktisk beveger seg,
og i 2D-visning står det stille — Mapbox ligger oppå og eier gestene. Det finnes altså ingen churn å
gate bort.

En gate ville i tillegg kostet et unmount og remount av 465 markører ved hver veksling, og er nøyaktig
den formen for betinget montering doc-en om spøkelses-markører advarer mot. Enheten er droppet på
grunnlag av målingen, ikke utsatt.

**Opprinnelig mål (for historikken):** ~470 DOM-noder får ikke transform-skriv mens de er skjult under
2D-overlayet.

**Requirements:** R3

**Dependencies:** Unit 4

**Files:**
- Modify: `components/variants/report/board/BoardMap3D.tsx`
- Modify: `components/map/map-view-3d.tsx`
- Test: `components/variants/report/board/BoardMap3D.test.tsx`

**Approach:**
- 3D-instansen rives aldri ned (WebGL-context-lekk), så i 2D-visning ligger den montert med alle
  markørene under Mapbox-overlayet på `z-[5]`. I rasterverdenen koster det maks et WebGL-draw; med
  DOM er det ~470 elementer Google skriver transform på for ingenting. Det finnes ingen
  `view === "2d"`-gate i dag.
- Legg en gate som slutter å montere POI-markørene når 3D ikke er den fremste flaten. Kartet selv
  blir stående — gaten gjelder markørene, ikke instansen.
- Samme poeng gjelder `?from=embed`-oppvarmingen, der kartet er montert bak et opakt lag.
- Vær varsom: gaten må ikke bli en ny variant av ghost-markør-fellen. Å unmounte hele laget når
  visningen bytter er greit; å flippe markørtype per POI er det ikke.

**Test scenarios:**
- Happy path: i 3D-visning er POI-markørene montert.
- Happy path: i 2D-visning er de ikke montert.
- Edge case: å veksle 2D → 3D → 2D gjentatte ganger etterlater ingen markører og ingen spøkelser.
- Edge case: Satelitt (tilt 0) regnes som 3D-visning og beholder markørene.
- Integration: kartinstansen rives aldri ned under vekslingen (WebGL-kontekst bevares).

**Verification:** Markør-antallet i DOM er 0 i 2D-visning og tilbake til fullt sett i 3D, og
kart-instansen er den samme gjennom vekslingen.

---

- [ ] **Unit 8: Rydd dødt raster-maskineri, mål terreng-avviket, og verifiser på ekte telefon**

**Goal:** Ingen etterlatt kode som bare fantes for rasterisering, terreng-avviket er tallfestet, og
gevinsten er bevist der problemet faktisk er — på telefonen.

**Requirements:** R1, R2, R4, R5

**Dependencies:** Unit 5, Unit 6, Unit 7

**Files:**
- Modify: `lib/board/label-collision.ts` (slett `wrapLabelLines`; behold estimatet)
- Modify: `lib/board/label-collision.test.ts` (erstatt de seks `wrapLabelLines`-testene)
- Modify: `components/map/marker-primitives.test.tsx` (slett de utdaterte label-testene)
- Modify: `components/map/project-pin-scale.ts` (slett rampen hvis den er uten virkning)
- Modify: `components/map/map-view-3d.tsx` (slett `PIN_SETTLE_MS`-rAF-pollen hvis rampen går)
- Modify: `docs/rebuild/kamera-flythrough-verifikasjon-runbook.md`
- Modify: `PROJECT-LOG.md`

**Approach:**
- `wrapLabelLines` finnes bare fordi SVG-`<text>` ikke bryter linjer selv. Med CSS `line-clamp` er den
  død og **slettes** — men ikke før erstatningen står: de seks testene for den er den eneste dekningen
  som kobler `LABEL_CHAR_W` til faktisk tegnede linjebredder, og 2D-markøren er fortsatt avhengig av
  `estimateLabelBox`. Erstatt med en test som asserter at estimatet er et **over**estimat mot den
  browser-målte tegnbredden fra Unit 4. `LABEL_CHAR_W`/`LABEL_MAX_W` beholdes; det er bare
  linjebrytingen som blir CSS-ens jobb, og 2D-kontrakten står urørt.
- `LABEL_HALO`/`LABEL_HALO_W` og dobbelttegningen forsvant med `Marker3DPin` i Unit 4 — verifiser at
  ingen referanser står igjen.
- Er `scaleForRange` uten virkning fordi `MarkerElement` ikke skalerer med avstand (målt i Unit 5),
  slettes både rampen og `PIN_SETTLE_MS`-rAF-pollen i `map-view-3d.tsx` — men da må declutterens
  hindringsskala følge i samme endring. Virker rampen fortsatt, dokumenter hvorfor den beholdes.
- **Runbooken teller markører på DOM-selektor.** `docs/rebuild/kamera-flythrough-verifikasjon-runbook.md`
  dokumenterer AC2 som bevist med `markerCount = 0` og `pinCount = 0`. De tellingene blir vakuøst grønne
  når markørene bærer nye tagnavn. Oppdater dem til å matche begge generasjoner, ellers arver vi en
  verifisering som ikke måler det den påstår.
**Fem målinger, alle i nystartet Chrome** (suiten kan ikke bevise noe av dette — `BoardMap3D` har ingen
render-test, og skarphet er per definisjon usynlig i jsdom og på DPR 1):

1. **Mobil-emulering 393×852×3** mot rapport-boardet: skarpe labels, ingen spøkelses-pins etter
   kategoribytter og flyvninger, POI-tapp åpner popupen uten å lukke den igjen, drag-takeover auto→fri
   virker, og viewport-publiseringen trigges ikke av markør-tapp.
2. **WebGL-kontekst-teller:** unike canvas med `WeakSet` (metoden fra den dokumenterte lærdommen, som
   krever nystartet Chrome fordi GPU-prosessen cacher kontekster på tvers av tab-lukking). Mount og
   unmount 150 markører i løkke for å bekrefte at spøkelses-klassen faktisk er kurert av at det ikke
   finnes noen tekstur å etterlate.
3. **Tett bebygd board** (StasjonsKvartalet): okklusjon, og om `altitude` 18/30 fortsatt er de riktige
   tallene når begrunnelsen «hev over taknivå» er borte.
4. **Kupert board** (Ranheim/Grilstad): sammenlign vår projiserte y mot Googles egen transform-y per
   markør. Dette er tallet som avgjør terreng-sporet (R5) — skriv det i worklogen.
5. **`node scripts/capture-3d-flythrough.mjs`** og inspiser tre frames fra den raskeste delen av
   spiralen: prosjektpinnen er med i framene, står fastspikret til bakken (Google skriver transformen
   fra JS hvert 8.–11. ms mens tiles rendres i WebGL — compositor-desync er aldri fanget før, fordi
   `FLY_CLEAN` har skjult de eksisterende per-frame-overlayene), haloen er lesbar mot satellittfoto, og
   gjennomsyn er akseptabelt. Merk at fangsten kjører `deviceScaleFactor` 1 — **filmen kan aldri brukes
   som skarphets-bevis.**

Til slutt ekte iPhone via `scripts/mobile-url.sh`. HTTP 200 over LAN-IP garanterer ingenting — blank
side betyr avvist HMR-websocket fordi `allowedDevOrigins` har gårsdagens IP.

**Test scenarios:**
- Happy path: 2D-stiens label-kollisjon er uendret (samme tester passerer urørt) etter at
  linjebrytingen er flyttet.
- Edge case: `estimateLabelBox` er et **over**estimat mot den browser-målte tegnbredden — testen som
  erstatter `wrapLabelLines`-dekningen.
- Test expectation: de fem målingene over er manuelle sjekker, ikke automatiserte tester — de
  dokumenteres i worklogen med tall.

**Verification:**
- `npm run lint`, `npm test`, `npx tsc --noEmit` og `npm run build` er alle rene.
- Skarp tekst bekreftet på ekte iPhone, ikke bare i emulering.
- Klikk, kameramodus, nabolagsliste-scoping, film-capture og 2D/Satelitt-veksling fungerer som før.
- Terreng-avviket er tallfestet på et kupert board.
- `grep` finner ingen forlatte referanser til slettet kode.

## System-Wide Impact

- **Interaction graph:** Tre `closest(...)`-gater avgjør om et trykk er markør eller kart
  (`BoardMap3D` ×2, `use-3d-viewport-publish`). To kommentarer refererer dem også
  (`BoardMap.tsx:892`, `BoardPathMidpointMarker.tsx:106`). Klikk-stien endrer karakter: i dag klones
  barna inn i et `<template>`, så ingen React-handler inne i markøren har noen gang fyrt, og all
  interaksjon går via `gmp-click` som bubler opp til kartelementet. Med ekte DOM blir React-events
  mulige, og `stopPropagation`-disiplinen fra 2D-siden blir plutselig relevant i 3D.
- **Error propagation:** `MarkerElement` finnes bare etter `importLibrary("maps3d")`. Wrapperen må tåle
  å bli montert før biblioteket er lastet, og `APIProvider` sender ingen `version` — vi kjører hva
  Google enn serverer.
- **State lifecycle risks:** Ghost-markør-fellen. Et typebytte på samme element etterlater Googles
  tekstur i scenen. Migrasjonen skjer i én retning per lag, uten flagg som flipper type per POI.
- **API surface parity:** `label-collision.ts` og `pin-declutter.ts` deles med Mapbox-stien.
  Kontraktene der holdes uendret, ellers drifter 2D-kollisjonen i stillhet.
- **Integration coverage:** Enhetstester beviser ikke dette. Skarphet er per definisjon usynlig i jsdom
  og på DPR 1; ghost-markører er usynlige i tester fordi DOM-en er korrekt. Både telefon-verifisering
  og en manuell klynge-sjekk må gjøres.
- **Unchanged invariants:** Kart-instansen rives aldri ned. `projectLatLngToScreen` beholder sine tre
  konsumenter (låst av en fil-scan-test i `BoardPOI3DMiniPopup.test.tsx` med eksplisitt begrunnelse om
  at hver ekstra per-frame-projeksjon koster frames) — den bytter rolle fra posisjonskilde til
  gyldighets-gate inne i declutter-hooken, ikke fil. Ankeret er uendret bunn-midt, så mini-popupens
  −28 px og `anchorToDiscCenterY` står. `label-collision.ts` beholder sitt px-anslag som sannhet.
  Film/fly-pin-dropet skjer på datanivå i `use-board-marker-set.ts` og arves gratis.
  Reels-videogenereringen (`compose-reels-bg.ts`, `animate-scene-veo.ts`, `voiceover-reels-*`) rører
  aldri kartet. Alle overlay-lag (mini-popup z-30, chip, kontroller, Mapbox z-[5]) blir liggende over
  markørene fordi `contain: content` på kartet er en paint-container ingen `z-index` bryter ut av.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tag-navn-gaten glipper → hvert POI-trykk leses som kamera-grep (popup lukkes idet den åpnes, kameramodus hopper til fri, nabolagsliste re-scopes). Målt brutt: `pointerdown` bobler med target `GMP-MARKER-INTERACTIVE`, der dagens `closest("gmp-marker-3d-interactive")` er `false` | Unit 2 sikrer gaten og tester begge tag-generasjoner **før** noen markør bytter element. Gatene har i dag til sammen ÉN test, og `BoardMap3D` har ingen render-test — så popup-tapp og drag-takeover må i tillegg browser-verifiseres manuelt |
| Prosjektmarkøren havner under POI-ene, og demoterte prikker legger seg på prosjektnavnet | Unit 5 er ikke valgfri og lander i samme runde; lagdeling via CSS `z-index`, verifisert visuelt |
| Label i flyten skyver disc-en ut av punktet (verifisert: boks 132 px → `-50%` flytter ankeret) | Labelen er `position: absolute` utenfor flyten; boksen holdes 40×40, med en test som feiler hvis den vokser |
| Overlapp avgjøres av mount-rekkefølge i stedet for avstand | Unit 6 setter `z-index` fra kamera-avstand; test på at rekkefølgen snur når kameraet snur |
| Markører bak bygg og koller flyter oppå dem uten dybdehint (DOM har ingen dybdetest — verifisert med prober 80 m under bakken) | Aksepteres, og er nærmere en forbedring enn en regresjon: `altitude` 18/30 finnes nettopp for å heve markørene over taknivå «så de ikke okkluderes av 3D-byggene og blinker inn/ut». DOM gir gratis det hacket forsøkte å tilnærme. Verifiseres mot et tett bebygd board i Unit 8 |
| Ghost-markører fra typebytte | Ingen flagg som flipper markørtype per POI; bytt barnet, aldri elementet; re-verifiser klynge-oppførsel manuelt |
| Ro-vinduet settes for kort → kostnaden flytter seg fra GPU til hovedtråd | Mål recompute-tiden ved ~470 kandidater før tallet velges; gjenbruk det adaptive mønsteret fra `use-3d-viewport-publish.ts` |
| ~470 DOM-noder churner usynlig i 2D/Satelitt | Unit 7 legger en mount-gate for markørene (ikke for instansen) |
| `text-shadow` på flere hundre elementer koster compositor-tid, særlig i Satelitt der flest labels er synlige | Måles i Unit 8; halo kan falle tilbake til `paint-order` eller reduseres |
| Maps-JS-versjonen er upinnet — `MarkerElement` kan endre seg uten at noe i repoet varsler | Vurderes i Unit 8. Merk at en fallback til `Marker3D` betyr to markørtyper, altså ghost-risiko: pinning er det trygge valget, ikke fallback |
| Okklusjon for DOM-markører er udokumentert; `altitude` 18/30 ble valgt for å unngå okklusjon | Måles på et tett bebygd board (Strindfjordvegen) før tallene bæres over |
| Skarphets-gevinsten gjelder ikke film-capture | `Emulation.setDeviceMetricsOverride` tvinger `deviceScaleFactor` 1 i `capture-3d-flythrough.mjs`. Ikke en regresjon (film/fly dropper POI-pins uansett), men ikke lov mer enn planen holder |
| Markør-DOM som søsken-overlay ville forsvunnet fra film | `FLY_CLEAN` skjuler alle søsken av `gmp-map-3d` oppover ancestor-kjeden. Markørene appendes som **barn**; kjør `node scripts/capture-3d-flythrough.mjs` og sjekk at prosjektpinnen er i framene før merge |
| jsdom kan ikke bevise dette: `elementFromPoint` finnes ikke, og `getBoundingClientRect` på et transformert element gir nuller | Behold px-anslaget i `label-collision.ts` som sannhet; mål aldri DOM for kollisjon. Kalibrer `LABEL_CHAR_W` én gang i browser mot den faktiske CSS-fonten og hardkod tallet, slik 2D alt gjør |
| Ny `dynamic()`-grense i `ReportReelsPage.tsx` brekker lazy-boundary-vakten (`count === 5`) | Hold laget under det eksisterende `ssr: false`-skallet; hjem en eventuell lazy-grense i `BoardMap3D.tsx` |
| Arbeidstreet har stor ucommittet flate (291 linjer i `ProjectSitePin.tsx`, pipeline-arbeid) | Unit 1 lander en grønn grunnlinje først; HEAD er ikke sannheten |

## Documentation / Operational Notes

- Loggfør i `PROJECT-LOG.md`: hvorfor labelen måtte ut av teksturen (med sizePreserved- og
  3×-SVG-målingene), at 400 ms-debouncen sto på et feilattribuert sitat, og hvilket ro-vindu som ble
  målt fram.
- Vurder en `docs/solutions/`-oppføring for anker-semantikken (`anchorLeft`/`anchorTop` mot
  bunn-midt-rammen) — den har alt kostet tre kompensasjoner på tre steder, og neste person vil møte
  den igjen.

## Sources & References

- Egne målinger i denne sesjonen: `sizePreserved`-diff, 3×-SVG-skarphet, 426 ms settle,
  label-bytte-kostnad (2,9 ms raster mot 0,6 ms DOM), z-order over prosjektpinnen, kant-klipping,
  transform-sporing, off-screen-frys, fps-serien som ikke viste forskjell.
- `docs/solutions/ui-bugs/google-maps-3d-marker-template-swap-spokelser-20260823.md`
- `docs/solutions/performance-issues/webgl-context-leak-per-render-probe-20260603.md`
- https://developers.google.com/maps/documentation/javascript/reference/3d-map-draw
- https://developers.google.com/maps/documentation/javascript/3d/marker-html-css
- https://developers.google.com/maps/documentation/javascript/3d/marker-overview
- https://github.com/visgl/react-google-maps/pull/1009 og
  https://github.com/visgl/react-google-maps/pull/1027
