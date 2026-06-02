---
title: "feat: 3D-bygningsmodell på Google Photorealistic 3D Tiles — demo-spike"
type: feat
status: planned
date: 2026-06-02
---

# feat: 3D-bygningsmodell på Google Photorealistic 3D Tiles — demo-spike

## Overview

Bevise at Placy kan **plassere en 3D-bygningsmodell (glTF) inn i Google Photorealistic 3D Tiles** via `Model3DElement` og **fly en regissert waypoint-kamerabane** som lander på modellen — interaktivt i rapport-boardet, og eksporterbart til video. Dette matcher (og over-skalerer) Marketers pre-bakte flythrough: vi leier hele verdens fotorealistiske by-kontekst fra Google som tjeneste, og trenger kun prosjektets modell plassert inn.

Vi har allerede ~80 % av brikkene: `gmp-map-3d` (Google 3D Tiles), kamera-director-en (`flyCameraTo`/`flyCameraAround`), og `Marker3DElement`. Eneste manglende komponent er `Model3DElement` (verifisert typet i `@types/google.maps` + vis.gl `maps3d.d.ts`). Denne spiken legger den brikken og verifiserer den i browser.

**R&D-rammeverk:** spiken kjøres på placeholder-/testassets (inkl. turntable-renders brukt internt til trening, ikke publisert). I produksjon byttes inn klientens egne renders/modell (som de eier). IP-grensa er eksplisitt: ingenting rekonstruert fra andres renders shippes.

## Problem Frame

Stasjonskvartalet er ubygget — det finnes ikke i Google sine tiles. Rapport-boardets live-flythrough viser derfor dagens tomt, ikke det fremtidige bygget. Marketers fortrinn er at de fikk inn bygg-modellen i en kontrollert bymodell. Vi vil oppnå det samme på **ekte fotogrammetri** ved å forankre prosjektets glTF på riktig koordinat oppå Google-tiles, og fly en kuratert bane inn på den.

Spiken er bevisst frakoblet rekonstruksjons-spørsmålet (hvordan lage selve modellen): her brukes en placeholder-glTF, slik at *plasserings- og kamera-pipelinen* bevises uavhengig av modell-kilden.

## Requirements Trace

- **R1** — En glTF/glb-modell rendres på Google 3D Tiles på gitt `position {lat,lng,altitude}`, `orientation {heading,tilt,roll}` og `scale`, via `Model3DElement` i `map-view-3d.tsx`.
- **R2** — En kuratert waypoint-kamerabane flyr inn og rammer modellen (gjenbruk av eksisterende director `flyCameraTo`/`flyCameraAround` + `camera-tours`-config).
- **R3** — Verifiserbart i browser: modellen rir stabilt på tiles, ingen per-frame WebGL-churn, akseptabel ytelse, og en **eksplisitt tomt-kollisjon-vurdering** med valgt mitigering.
- **R4** — Scenen er eksporterbar til video (gjenbruk eksisterende ffmpeg-/canvas-capture-vei), så samme motor gir både interaktiv board-bruk og den bakte hero-videoen utbyggere kjenner fra Marketer.
- **R5** — Asset-grensesnittet er stubbet slik at en ekte modell (arkitekt-glTF eller rekonstruert fra klient-renders) kan droppes inn uten kodeendring — peker til rekonstruksjons-tasken.

## Scope Boundaries

- **Desktop-only.** 3D-boardet vises kun på desktop (mobil bruker 2D). Modell-på-tiles er dermed desktop-scope, konsistent med kamera-kinoens eksisterende scope.
- **Placeholder-modell, ikke ekte prosjektmodell.** Spiken beviser plassering + kamera med en enkel massing-boks eller en gratis CC0-bygg-glTF. Ekte modell-kilde er ute av scope her (se Deferred).
- Endrer **ikke** kamera-director-ens beslutningslogikk (`board-3d-camera-director.ts`) — vi legger til en modell-rettet waypoint-config og en `models[]`-prop, ikke ny director-oppførsel.
- Endrer **ikke** marker-rendering eller audio/reels-pipelinen.
- Ingen Supabase-persistering av modell-config (lokal config nå, som waypoints).

### Deferred to Separate Tasks

- **Rekonstruksjons-pipeline** (turntable-renders → glTF/mesh via fotogrammetri, eller Gaussian splat → novel-view). Krever GPU/cloud-verktøy (COLMAP/RealityCapture/Nerfstudio/Luma) — egen task. Denne spiken konsumerer kun det ferdige asset-grensesnittet (R5).
- **Klient-onboarding-flyt** (motta utbyggers render-pakke/modell, georeferering, skala-kalibrering som rutine).
- **Apartment-picker-overlays** (Marketers boligvelger-feature: klikkbare enheter på modellen) — eget produkt-spor, ikke denne spiken.
- **Supabase-persistering** av modell-config (følg waypoint-promoterings-mønsteret når vi går prototype → prod).
- **Mobil-paritet** (3D er desktop-only i dag).
- **Lys/skygge-match** mellom modell og fotogrammetri som egen finpuss — spiken aksepterer Googles default-lys.

## Context & Research

### Relevant Code and Patterns
- `components/map/map-view-3d.tsx` — 3D-kart-host (`gmp-map-3d` / `Map3DElement`). Her legges `Model3DElement`.
- `components/variants/report/board/use-board-3d-camera.ts` — director-hook (token/last-call-wins-kansellering, `flyCameraTo`/`flyCameraAround`).
- `components/variants/report/board/board-3d-camera-director.ts` — ren intent-beslutning + `deriveCategoryCamera`.
- `components/variants/report/board/camera-tours.ts` — lokal waypoint-config + clamp + `?author=1`-capture.
- `components/variants/report/board/CameraWaypointAuthor.tsx` — fang-fra-live (fly manuelt → JSON til clipboard) — kan gjenbrukes til å autorere modell-framing-banen.

### Institutional Learnings (ufravikelige 3D-invarianter)
- `gmp-map-3d` **unmountes aldri** (kan ikke `loseContext`) — persistent-3D + 2D-overlay-mønster. `Model3DElement` legges/fjernes som barn, ikke ved å re-mounte kartet. (Memory: `project_3d_default_map_engine`.)
- **Aldri animér per-frame props** på 3D-elementer (lærdom fra `Marker3D`-opacity → WebGL-context-lekkasje). Modell-state holdes ute av render-stien som churner.
- **Aldri spread `LatLngAltitude`**; aldri rAF-drevet kamera (`flyCameraTo` er motoren).
- Verifiser alltid i **nystartet Chrome** (3D-context-lekkasjer maskeres i varm fane).

### External References
- Google Maps Platform — `Model3DElement` / `Model3DElementOptions` (glTF/glb, `altitudeMode`, `orientation`, `scale`). Typet i `node_modules/@types/google.maps/index.d.ts` (~linje 5906, 13004) og vis.gl `maps3d.d.ts`.
- Benchmark: Marketer/HomeKey-flythrough — `docs/strategy/2026-06-02-marketer-homekey-konkurrent.md`.

## Key Technical Decisions

- **`Model3DElement` (ikke `Model3DInteractiveElement`)** for et statisk bygg i denne spiken; interaktiv variant defereres med apartment-picker.
- **Placeholder-glTF først** — bevis pipeline før modell-kilde introduseres. Asset bak en enkel `models[]`-prop (R5).
- **Gjenbruk director-en** — modell-framing-banen legges i `camera-tours.ts` som en waypoint-sekvens; ingen ny kamera-motor.
- **`altitudeMode` + skala-kalibrering** avgjøres i impl (sannsynlig `RELATIVE_TO_GROUND`); ground-alignment er en kjent finpuss.
- **Tomt-kollisjon-mitigering:** primært via kamera-framing (modellen okkluderer dagens tomt i landings-shotet); fullstendig skjul av tomt-region defereres.

## Open Questions

### Avklart under planlegging
- Finnes API-et? **Ja** — `Model3DElement` er typet i `@types/google.maps` + vis.gl.
- Har vi kamera-motoren? **Ja** — director + `flyCameraTo`/`flyCameraAround`.

### Deferred to Implementation
- Eksakt Stasjonskvartalet-koordinat + modell-orientering/skala (kalibreres mot tiles i browser; ingen prosjekt-JSON funnet i `data/` ennå).
- `altitudeMode`-valg + ground-alignment-finjustering.
- Ytelse med detaljert glTF (desktop-scope; mål i Unit 4).
- ToS/billing-implikasjoner ved å bake video ut av Google Maps Platform (avklares før ekstern distribusjon av eksportert video).

## High-Level Technical Design

1. **`map-view-3d.tsx`** får en `models?: Board3DModel[]`-prop (`{url, lat, lng, altitude, scale, heading, tilt?, roll?, altitudeMode?}`). For hver: instansiér `google.maps.maps3d.Model3DElement`, sett options, append som barn av `gmp-map-3d`. Diff/cleanup ved prop-endring uten å re-mounte kartet.
2. **`camera-tours.ts`** får en modell-demo-waypoint-sekvens (A: vid by-kontekst → B: landing på modellen), keyed for Stasjonskvartalet. Reduced-motion → statisk hold på B.
3. **Director** flyr banen uendret (token-kansellering gjelder).
4. **Video-eksport:** gjenbruk eksisterende canvas-/ffmpeg-capture for å bake flythrough-en til mp4 (samme vei som reels-bakgrunn).

## Implementation Units

### Phase 1 — Modell på tiles
1. **`Model3DElement`-integrasjon** i `map-view-3d.tsx`: ny `models[]`-prop, instansiér/append/diff/cleanup som `gmp-map-3d`-barn, uten re-mount. Respekter single-context + no-per-frame-churn-invariantene. *(R1)*
2. **Placeholder-glTF + modell-config**: legg et CC0/enkelt massing-asset i `public/`, og en config (koordinat/orientering/skala) for Stasjonskvartalet. Stub `Board3DModel`-typen i `lib/types.ts`. *(R1, R5)*
3. **Modell-framing-waypoints** i `camera-tours.ts` (A→B som lander på modellen) + reduced-motion-hold; gjenbruk director. *(R2)*

### Phase 2 — Verifisering + eksport
4. **Browser-verifisering** (dev-server + Chrome DevTools MCP, nystartet Chrome): modell stabil på tiles, ingen WebGL-churn, ytelse, screenshots ved nøkkel-frames (inn-flytur + landing). *(R3)*
5. **Tomt-kollisjon-vurdering**: dokumentér hvor ille overlappet med dagens tomt er, og lås valgt mitigering (framing/okklusjon). *(R3)*
6. **Video-eksport** av modell-flythrough via gjenbrukt capture-vei → mp4. *(R4)*
7. **Asset-interface-verifisering**: bekreft at en annen glTF kan byttes inn via config uten kodeendring (peker til rekonstruksjons-tasken). *(R5)*

## Risks & Dependencies

- **BLOKKER / forutsetning:** den pågående 3D-maps-fiksen (annen agent) må være landet på `main` før denne spiken startes. Bygg fra **fersk worktree off oppdatert `main`**.
- `Model3DElement`-modenhet/ytelse (relativt nytt API) — primær usikkerhet, måles i Unit 4.
- Tomt-kollisjon i tiles ved redevelopment-site — kjent, mitigeres via framing.
- glTF-kilde: placeholder nå; ekte modell (arkitekt eller rekonstruert) er egen task.
- ToS/billing for video-bake fra Maps Platform — avklar før ekstern bruk.

## Forutsetninger & oppstart (for worktree-økten)

1. Vent til 3D-maps-fiksen er merget til `main`.
2. `git worktree add ../placy-ralph-3d-model -b feat/3d-model-on-tiles` → `cd` → `../placy-ralph/scripts/setup-worktree.sh`.
3. `PORT=3001 npm run dev` (worktree-port).
4. Eksekvér Phase 1 → 2. Verifiser i nystartet Chrome.

## Sources & References
- `docs/strategy/2026-06-02-marketer-homekey-konkurrent.md` — benchmark + differensiering
- `PROJECT-LOG.md` 2026-06-02 — Veo image-to-video + kamera-waypoints (kontekst)
- `@types/google.maps` `Model3DElement` (~5906/13004), vis.gl `maps3d.d.ts`
