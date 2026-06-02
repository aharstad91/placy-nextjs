# Stasjonskvartalet i Google 3D-kartet — kan en marketing-render bli en 3D-modell i tiles?

**Dato:** 2026-06-02
**Kontekst:** Rapport-board 3D-kart (`/eiendom/[customer]/[project]/rapport-board`) bruker Google Photorealistic 3D Tiles. Google sine tiles for Gryta/Trondheim er utdaterte — de viser fortsatt den gamle parkeringsplassen der Stasjonskvartalet (Bane NOR Eiendom, ferdig ~2028) nå bygges. Spørsmålet: kan vi få byggene inn i 3D-scenen?
**Metode:** Multi-agent research-workflow (8 research-spor + adversariell verifisering av 14 bærende påstander + syntese). 23 agenter, ~787k tokens.
**Stack-funn forankret i kode:** `components/map/route-layer-3d.tsx`, `components/map/map-view-3d.tsx`, `components/variants/report/board/BoardMap3D.tsx`. Bibliotek: `@vis.gl/react-google-maps@^1.8.3`.
**Companion:** `2026-06-02-stasjonskvartalet-3d-modell-fra-bilder-kvalitet-arbeid.md` — dybde på "vi har bare bilder, ingen GLB": hvilke image-only-veier finnes, hvor bra blir det, hvor mye arbeid (kvalitet+kostnad per vei). Inkl. ellipsoid-gotcha (~40–45 m i Norge) som hører hjemme i spike-planen under.

---

## Sammendrag

**Ja — og plattformen er ikke flaskehalsen.** Google Maps JavaScript API har `Model3DElement` (native, dokumentert, stabilt) som plasserer en GLB-bygningsmodell på eksakte koordinater i den fotorealistiske scenen. Repoet mestrer allerede det imperative `importLibrary("maps3d") + map3d.append()`-mønsteret dette krever — `route-layer-3d.tsx` er en ferdig mal.

Det vanskelige er **kvaliteten på 3D-modellen**, ikke kartet. Anbefalt vei: en enkel **massing-GLB** (blokkvolum med fasade-tekstur fra renderen) plassert via `Model3DElement`, med demo-kameraet i fugleperspektiv som skjuler kollisjonen med den gamle parkeringsplassen. **Ikke** stol på AI image-to-3D for selve bygget. **Ikke** gjør deg avhengig av Googles nye `gmp-flattener` (for fersk/uprøvd per 2026).

---

## Beslutningsmatrise

| Vei | Kvalitetstak | Innsats | Kostnad | Tid-til-demo | Risiko | Demo-egnet |
|-----|-----------|------|------|----------|------|-----------|
| **A. Manuell massing-GLB + Model3DElement** | Høy-for-demo | Middels | 0–2 000 kr | 1–3 dager | Lav | ✅ **Primær** |
| **B. BIM-kildemodell (Sweco/Bane NOR) → GLB** | Høyest (gull) | Høy | Gratis hvis JA | 1 dag *etter* fil (uker å skaffe) | Middels | ✅ Parallelt langspor |
| **C. AI image-to-3D (Tripo/Hunyuan/Meshy) → GLB** | Lav–middels | Lav | ~5–50 kr/iter | 1 dag | Høy (blob-geometri) | ⚠️ Kun råstoff |
| **D. Cinematisk `flyCameraTo` + crossfade til render** | Middels | Lav | Gratis | ~4 t | Lav | ✅ **Fallback/komplement** |
| **E. `gmp-flattener` + Model3DElement** | Høyest native | Middels | Gratis (preview) | Usikker | Høy (uprøvd, ingen wrapper) | ❌ Ikke ennå |
| **F. Billboard / teksturert plan** | Svært lav | Lav | Gratis | ~1 t | Høy (brytes ved rotasjon) | ❌ |
| **G. CesiumJS-rewrite + Gaussian Splats** | Høyest mulig | Høy | $0–500/mnd | 1–2 uker | Høy (stack-bytte + depth-bug) | ❌ Over-engineering |
| **H. Vente på at Google oppdaterer tiles** | – | Ingen | Gratis | 3–5 år | – | ❌ |

---

## Anbefaling: A (primær) + D (fallback/komplement)

**A** løser det faktiske problemet — byggene blir synlige der parkeringsplassen var, roterbart 360°, med Nidelva/stasjonen/havna intakt rundt. En massing-modell (2–4 t Blender eller billig freelance) gir korrekt silhuett og proporsjoner — nettopp det AI-verktøyene konsekvent bommer på for flerblokks-bygg fra ett fugleperspektiv.

**D** er trygg fallback hvis GLB-en ser klumpete ut, og et godt *komplement*: bygget i kartet + en «se ferdig bygg»-knapp som crossfader til høyoppløst render.

**B** kjøres som parallelt langspor: hvis Bane NOR/Sweco kan levere en forenklet GLB med verdensplassering bakt inn, er det gullstandard og erstatter massing-modellen uten kodeendring.

---

## Konkret spike-plan (1–1,5 dag til validert pipeline)

Mål: bevis pipelinen med en placeholder før noen modellerer en pen modell.

- **Steg 0 — Placeholder-GLB (30 min):** enkel ekstrudert boks i Blender → `public/buildings/stasjonskvartalet-test.glb` (<5 MB). Same-origin fra `public/` = ingen CORS.
- **Steg 1 — Ankerkoordinater (30 min):** `data.home.coordinates` i `board-data.ts` holder allerede prosjektsenteret. Bruk det som base; finjuster footprint/heading mot satellitt i `geojson.io`.
- **Steg 2 — Ny `components/map/building-layer-3d.tsx` (halv dag):** kopier `route-layer-3d.tsx` som mal, bytt Polyline mot Model3DElement:

```ts
const lib = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;
const model = new lib.Model3DElement({
  src: "/buildings/stasjonskvartalet-test.glb",
  position: { lat, lng, altitude: 0 },
  altitudeMode: lib.AltitudeMode.RELATIVE_TO_GROUND, // flat tomt → følger terreng
  orientation: { heading: 320, tilt: 0, roll: 0 },   // iterer i 5°-steg
  scale: 1,
});
map3d.append(model);
```

Behold `cancelled`-flag-cleanup fra malen (StrictMode-race). Hent `map3d` via `onMapReady` (allerede tilgjengelig i `BoardMap3D.tsx` som `map3dInstance`).

- **Steg 3 — Monter i `BoardMap3D.tsx` (15 min):** `<BuildingLayer3D map3d={map3dInstance} />` ved siden av `<RouteLayer3D>`, bak en prop/flag så det er trivielt å skru av.
- **Steg 4 — Iterer posisjon/skala/heading (1–2 t):** **gotcha — rotasjonsrekkefølge er roll → tilt → heading.** Heading lander trolig ~315–340°. Verifiser med `flyCameraTo()` til ~60° tilt, ~200 m.
- **Steg 5 — GO/NO-GO:** ser placeholder-boksen riktig plassert ut? GO → bestill pen massing-GLB med look-matching (bake AO, metning ~0,65–0,70, roughness 0,75–0,85, mild blur så den ikke ser «limt på» tiles ut). NO-GO → fall til vei D.

---

## Verifiserte korreksjoner — ikke bygg på sand

Adversariell verifisering avkreftet 4 antakelser og markerte 7 som usikre. De viktigste:

**AVKREFTET:**

- **`@vis.gl/react-google-maps` 1.8.x har `<Model3D>` / `<Flattener>` som React-komponenter.** Biblioteket eksporterer kun `<Map3D>`, `<Marker3D>`, `<Popover>` (bekreftet mot `src/index.ts`). Model3DElement *finnes* i Googles API, men må brukes imperativt via `importLibrary("maps3d")` + `append()` — akkurat som Placy allerede gjør med Polyline.
- **Du kan bake en ENU/transformasjonsmatrise i GLB-roten.** Det er et Cesium-mønster. Googles `Model3DElement` tar kun `src/position/altitudeMode/orientation/scale` — *ingen* matriser, *ingen* glTF-extensions.
- **IFC georefereres via IfcSite-koordinater.** Nei — mekanismen er `IfcMapConversion` + `IfcProjectedCRS`, som norsk Revit-eksport ofte *mangler*. Hvis BIM-veien forfølges: be Sweco om GLB med lat/lng-plassering allerede bakt inn, ikke rå IFC.
- **ROOV.space er eneste prior art.** BNP Paribas (WIRED) og Geopogo finnes også. Riktigere differensiering: *«ingen har løst look-matching for web og publisert det»* — ikke «ingen har prøvd».

**USIKKERT:**

- **`gmp-flattener` + Model3DElement rendrer rent uten z-fighting.** Flattener er fra mars 2026, hadde umiddelbart en race-bug, er Preview uten SLA, ingen React-wrapper. Depth-buffer-atferd er udokumentert markedsspråk. Løs parkeringsplass-«kollisjonen» med kamera-vinkel, ikke flattener. (En parkeringsplass er flat bakke-tekstur — et bygg plassert oppå dekker den stort sett ovenfra; kun base-kanter ved lav vinkel røper den.)
- **AI image-to-3D-rangeringer (SimInsights, Hunyuan3D «sharp edges», Tripo «best workflow»).** Hviler på vendor-PR eller 9 mnd gammel test på et generisk forstadshus — ikke testet på fugleperspektiv-nybygg-render. Strukturell sannhet som holder: **ett fugleperspektiv-bilde gir AI hallusinerte baksider/sider** (høy konfidens). Derfor: manuell massing > AI for dette caset.
- **CesiumJS + Gaussian Splats over Google-tiles «demonstrert».** Kun Cesiums egen markedspost; åpent depth-buffer-bug-issue (#12472) gjør okklusjon mot Google-mesh upålitelig. Ikke en demo-vei i 2026.

**NY RISIKO:**

- **EEA-restriksjon på Map Tiles API (juli 2025).** `tile.googleapis.com` returnerer HTTP 403 for norske faktureringsadresser. **Men** native `gmp-map-3d` / `Model3DElement` i JS-API-et fungerer (Google henter tiles internt) — og det er nettopp denne veien Placy bruker. Konsekvens: ikke planlegg en rå-tile/Cesium-pipeline (sannsynligvis blokkert for Norge); vær oppmerksom på avhengigheten av at Google holder web-component-veien åpen for EEA.

---

## Åpne spørsmål til Bane NOR Eiendom / megler

1. **Finnes BIM-kildemodellen, og kan vi få en forenklet GLB?** Be Sweco Trondheim (eller Bane NOR som prosjekteier) om *«forenklet LOD 200 GLB-eksport av bygningsskallet, uten interiør, helst med verdensplassering (lat/lng) bakt inn — til interaktiv 3D-kartdemo.»* Gullstandard-snarveien.
2. **Hvilke markedsrenders finnes, og i hvilke vinkler?** Front + side + bak løfter både modellering og crossfade-fallback. Be om høyoppløst.
3. **Korrekt footprint/rotasjon:** reguleringsplan/situasjonsplan med eksakte bygningsgrenser for Gryta 12 A/B/C og Gryta 8 A.
4. **Gesims-/etasjehøyder per bygg** — for korrekt vertikal skala mot nabobyggene i tiles.
5. **IP/konfidensialitet:** kan vi bruke renderen og en avledet 3D-modell i en ekstern salgs-pitch-demo?
6. **As-built vs. design-intent:** greit at demoen viser planlagt utforming (ferdig ~2028), ikke endelig bygg?

---

## Relevante filer (kode-touchpunkter)

| Fil | Rolle |
|-----|-------|
| `components/map/route-layer-3d.tsx` | **Mal** for imperativ `importLibrary("maps3d")` + `append()` + StrictMode-cleanup |
| `components/map/map-view-3d.tsx` | `MapReadyBridge` / `onMapReady` gir `map3dInstance` (`flyCameraTo`, `append`, heading/tilt/range/center) |
| `components/variants/report/board/BoardMap3D.tsx` | Monteringspunkt — `<BuildingLayer3D>` ved siden av `<RouteLayer3D>` |
| `components/variants/report/board/board-data.ts` | `data.home.coordinates` = prosjektsenter (ankerkoordinat) |
| `public/buildings/*.glb` | (ny) modell-filer |

---

## Kilder (utvalg)

**Google Maps 3D / Model3DElement:**
- https://developers.google.com/maps/documentation/javascript/3d/models
- https://developers.google.com/maps/documentation/javascript/3d/mesh-flattening
- https://developers.google.com/maps/documentation/javascript/3d/best-practices
- https://developers.google.com/maps/comms/eea/map-tiles (EEA-restriksjon)
- https://visgl.github.io/react-google-maps/docs/api-reference/components/map-3d
- https://github.com/visgl/react-google-maps/blob/main/src/index.ts (ingen `<Model3D>`-wrapper)

**Prior art (bygg i fotorealistiske 3D-tiles):**
- https://mapsplatform.google.com/resources/blog/helping-buyers-make-more-confident-real-estate-decisions-with-photorealistic-3d-tiles/ (ROOV.space)
- https://www.realestate.bnpparibas.com/ (WIRED)
- https://datadrivenaec.com/tools/geopogo (occlusion-material-teknikk)

**AI image-to-3D (vurdering):**
- https://www.siminsights.com/ai-3d-generators-2025-production-readiness/
- https://arxiv.org/abs/2506.16504 (Hunyuan3D 2.5)
- https://z.tools/blog/meshy-6-vs-tripo-v3-1-3d

**BIM/IFC-georeferering:**
- https://docs.ifcopenshell.org/autoapi/ifcopenshell/util/geolocation/index.html
- https://thinkmoult.com/ifc-coordinate-reference-systems-and-revit.html

**CesiumJS + Gaussian Splats:**
- https://cesium.com/blog/2026/04/27/3d-gaussian-splats-lod/
- https://github.com/CesiumGS/cesium/issues/12472 (depth-buffer-bug)
