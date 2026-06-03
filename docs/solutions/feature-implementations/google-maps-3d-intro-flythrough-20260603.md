---
title: "Skalerbar intro-flythrough på Google 3D-tiles (oval-spiral låst på objektet)"
category: feature-implementations
tags: [google-maps-3d, flythrough, kamera, requestAnimationFrame, marker3d, react-removechild, cdp-screencast, video-capture, per-prosjekt-config]
module: variants/report
date: 2026-06-03
symptom: "Cinematic kamera-flythrough på 3D-tiles følte seg som diskrete waypoints (synlig stopp/start), POI-pins klottret filmen, og en capturet video kunne ikke gjenspilles live på board-URL-en."
root_cause: "flyCameraTo har innebygd ease-in/out PER kall → chaining gir hopp-stopp. 3D-markører (vis.gl <Marker3D>) er WebGL-baket og re-monteres per zoom-tier → DOM-skjuling er upålitelig/krasjer React. Flythrough-en var capture-lokal kode, ikke spilt av produktet."
---

# Skalerbar intro-flythrough på Google 3D-tiles

Gjenbrukbar "Marketer-stil" intro pr. prosjekt: en oval-spiral LÅST på objektet
(bygget), spilt live i rapport-boardet via `?fly=1` og tatt opp til video av et
capture-script. Tre ikke-åpenbare problemer løst underveis.

## Filer
- `components/variants/report/board/board-intro-flythrough.ts` — motoren (`IntroPathConfig`, `DEFAULT_INTRO_PATH`, `introPoseAt`, `runIntroFlythrough`).
- `components/variants/report/board/board-intros.ts` — per-prosjekt-tuning (`getBoardIntro(slug)`), mønster som `board-models.ts` / `camera-tours.ts`.
- `components/variants/report/board/BoardMap3D.tsx` — `?fly=1`/`?film=1`-flagg + effekt.
- `scripts/capture-3d-flythrough.mjs` — åpner `?fly=1` og TAR OPP (driver ikke kameraet).

## Gotcha 1 — flyCameraTo gir "waypoint"-følelse; driv kameraet frame-for-frame

`map.flyCameraTo({endCamera, durationMillis})` har innebygd ease-in OG ease-out
per kall. Chainer du flere (waypoint A→B→C) bremser kameraet ned mot null i hvert
waypoint → ser ut som diskrete hopp, ikke flyging. Overlap-chaining (fyre neste
ben før forrige er ferdig) demper det, men fjerner det ikke.

**Løsning:** driv kameraet selv, frame-for-frame, via direkte props i en rAF-loop:

```ts
const apply = (s) => {            // s ∈ [0,1] langs banen
  map.center = { lat, lng, altitude: 0 };  // LÅST på objektet → bygget i senter
  map.range = ...; map.tilt = ...; map.heading = ...;
};
const frame = (ts) => { const t = (ts - t0) / durationMs; apply(ease(t)); if (t<1) requestAnimationFrame(frame); };
```

- Direkte prop-set (`map.center/range/tilt/heading`) reflekteres MOMENTANT på
  `Map3DElement` (verifisert ~85–95 fps). Ingen `flyCameraTo` involvert.
- ÉN global TRAPES-easing på `s`: ramp opp [0,0.16], KONSTANT fart [0.16,0.84],
  ramp ned [0.84,1]. Konstant fart i midten = ingen ease per waypoint.
- "Oval"/spenning: behold `center` låst på objektet, sveip `heading` ~250° mens
  `range` spiraler inn, og la `range` bule ut midtveis (`* (1 + ecc*sin(π·s))`).
- For at directoren ikke skal kjempe imot: sett board-kameramodus til `"free"`
  (da returnerer `decideCameraIntent` `{kind:"free"}` og rører ikke kameraet).

## Gotcha 2 — å skjule 3D-POI-pins fra DOM KRASJER React

POI-pins er `gmp-marker-3d-interactive` (vis.gl `<Marker3D>`), rendret inn i WebGL-
scenen og RE-MONTERT av boardet per zoom-tier. To fallgruver:
- `display:none` (CSS) skjuler DOM-boksen, men IKKE den WebGL-bakede markøren
  pålitelig — noen blir igjen i renderet.
- En `MutationObserver` som `.remove()`-er hver markør ved innsetting krasjer
  React: `NotFoundError: Failed to execute 'removeChild' on 'Node'` — React
  prøver senere å fjerne en node den fortsatt "eier", men som alt er detached.
  (Slo ikke ut i korte tester; dukket opp under vedvarende re-mounting.)

**Løsning (race-fri):** dropp pins på RENDER-nivå, ikke fra DOM. Et URL-flagg
leses i `BoardMap3D` og gater markør-settet:

```ts
const markerPOIs = useMemo(() => {
  if (filmMode || flyMode) return [];   // ren film: ingen kategori-pins
  ...
}, [filmMode, flyMode, ...]);
```

Prosjekt-label (`projectSite`/`gmp-marker-3d`) + 3D-modellen er egne props og
påvirkes ikke.

## Gotcha 3 — capture av kontinuerlig-rendrende WebGL + "spill live på URL"

- Enkeltbilde-`Page.captureScreenshot` TIMER UT på gmp-map-3d (tiles streames/
  refines konstant). Bruk CDP `Page.startScreencast` (streamer frames mens scenen
  rendrer) + bygg mp4 med ffmpeg-concat fra timestamps.
- Streaming-fotogrammetri staller av og til mens GPU laster tiles → screencast
  lager en flersekunders gap = synlig FRYS. **Klamp** mid-flight frame-gaps til
  ~0.25 s i concat-en (åpnings-/slutt-hold beholdes bevisst).
- **Én kilde til banen:** ikke dupliser kamera-matten i scriptet. Boardet spiller
  flythrough-en (`?fly=1`); scriptet åpner `?fly=1` og TAR OPP, synket via et
  window-signal boardet setter: `window.__placyIntroFly = "settling"|"running"|"done"`.

## Skalering pr. prosjekt
- Banen er relativ til `target` (prosjektets `home`-koordinat) → ETHVERT prosjekt
  får standard-intro fra `DEFAULT_INTRO_PATH` uten config.
- Site-spesifikk tuning = én linje i `board-intros.ts` (vanligst `startHeading` =
  innflyvnings-retning mot et landemerke, `rangeStart` = hvor langt unna man åpner).
- Capture andre prosjekter: `FLY_URL=<board-url> node scripts/capture-3d-flythrough.mjs`.

## Verifisering
Validér ALLTID mot ekte tiles i frisk Chrome (chrome-devtools MCP): jump til poser
s=0/0.5/1, sjekk at objektet er sentrert (center==target), banen ikke går under
terreng, pins er borte. `?fly=1`-fasene: settling→running→done. Tester:
`board-intro-flythrough.test.ts` (ren `introPoseAt` + config-merge).

## Relatert
- `google-maps-3d-camera-control-iteration-20260415.md` (tidligere kamera-funn)
- `google-maps-3d-webgl-context-crash-touch-devices-20260415.md`
- Worklog `PROJECT-LOG.md` 2026-06-03 (modell-på-tiles + flythrough-iterasjoner)
