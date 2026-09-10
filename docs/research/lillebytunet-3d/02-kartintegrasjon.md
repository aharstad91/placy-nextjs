---
module: components/map
tags: [google-maps-3d, model3delement, glb, gltf, lillebytunet]
problem_type: integration
---

# Kartintegrasjon: GLB-modell i Google Maps 3D

Målt 2026-09-08 på branch `feat/lillebytunet-3d-model` i worktree
`/Users/andreasharstad/Documents/placy-lillebytunet`.

Demoen ligger på `/demo/lillebytunet-3d` (kjør `PORT=3002 npm run dev`).

## Hovedfunnet først

**Google leser GLB-en som Z-opp, ikke Y-opp.** Modellens `+X` blir øst, `+Y`
blir nord og `+Z` blir opp. Det er stikk i strid med glTF 2.0s egen konvensjon
(+Y opp, +Z mot betrakteren), og det er ikke dokumentert noe sted hos Google.

Konsekvensen er konkret. Modellens Z-utstrekning blir den vertikale, så et
Y-opp-bygg legges på siden. Er det i tillegg sentrert om `z = 0`, slik en
Y-opp-modell normalt er, havner halve høyden under bakken. Målt på probe-boksen:
`z` fra −10 til +10 ga 10 m synlig bygg av 20. Hus B må eksporteres med **+Z opp
og bunnen i z = 0**.

## Verifisert empirisk

Placeholder-boksen bærer sitt eget aksenavn i egen farge på hver side, så
orienteringen kan leses rett av et skjermbilde:

| Side | Farge | Målt retning i kartet ved `heading = 0` |
|------|-------|------------------------------------------|
| `+X` | rød | øst (`screens/03-h0-fra-ost.jpg`) |
| `-X` | blå | vest |
| `+Y` | offwhite | nord (`screens/02-h0-fra-nord.jpg`) |
| `-Y` | mørkegrå | sør (`screens/04-h0-fra-sor.jpg`) |
| `+Z` | grønn | opp (synlig som tak i alle skjermbilder) |
| `-Z` | gul | ned (aldri synlig) |

`orientation.heading` roterer med klokka sett ovenfra, altså vanlig
kompasslogikk: `heading = H` setter modellens `+Y` på bearing `H` og `+X` på
`H + 90`. Målt ved å sette `heading = 90` og se `-X` snu fra vest til nord
(`screens/05-h90-fra-nord.jpg`).

Y-opp-varianten er beholdt som måleinstrument i
`public/models/lillebytunet/placeholder-box-yup-probe.glb`. Legg den inn med
`?model=/models/lillebytunet/placeholder-box-yup-probe.glb` og se boksen ligge
på siden med halve høyden under bakken (`screens/02-h0-fra-nord.jpg`).

## Googles krav til modellen

Alt under er hentet fra Googles egen dokumentasjon og fra typene i
`node_modules/@types/google.maps` (v3.64.0).

**Format: bare `.glb`.** «At this time, only models in the `.glb` format are
supported.»
Kilde: <https://developers.google.com/maps/documentation/javascript/reference/3d-map-draw>

**Ingen utvidelser.** «Core properties of the [glTF PBR](https://www.khronos.org/gltf/pbr)
should be supported. No extensions or extension properties are currently
supported.» Samme kilde, gjentatt på
<https://developers.google.com/maps/documentation/javascript/3d/models>.

Praktisk betyr det at eksporten må slås av for **Draco**
(`KHR_draco_mesh_compression`), **Meshopt** (`EXT_meshopt_compression`),
**KTX2/Basis-teksturer** (`KHR_texture_basisu`), `KHR_materials_unlit`,
`KHR_materials_emissive_strength`, `KHR_texture_transform` og resten av
`KHR_*`-familien. Ukomprimerte buffere og PNG/JPEG-teksturer i BIN-chunken
virker — placeholderen bruker nettopp det.

**Ingen dokumenterte størrelses- eller trekantgrenser.** Google oppgir ingen
tak for filstørrelse eller antall trekanter noe sted i 3D-dokumentasjonen. Det
er ikke det samme som at det ikke finnes en praktisk grense; den må måles på
den ekte Hus B-modellen.

**CORS.** «If you're hosting your model files on a different website or server
than your main application, you must ensure that your application sets the
correct CORS HTTP headers.» Vi hoster fra `public/`, samme origin, så det er
ikke et tema nå.

**`altitudeMode`** tar fire verdier, default `CLAMP_TO_GROUND`:

- `ABSOLUTE` — meter over havet, uavhengig av terrengets detaljnivå.
- `CLAMP_TO_GROUND` — legges på bakken, oppgitt altitude ignoreres.
- `RELATIVE_TO_GROUND` — meter over bakken.
- `RELATIVE_TO_MESH` — meter over det høyeste av bakke, bygning og vann.

**`orientation`** er `{ heading, tilt, roll }` i grader, hver i `[0, 360)`.
Rotasjonene påføres i rekkefølgen **roll, tilt, heading**.

**`scale`** er `1` som default og tar enten ett tall eller en `Vector3D` for
ulik skalering per akse.

**`position` og `src` er obligatoriske** — mangler én av dem, tegnes ingenting
og det kommer ingen feilmelding.

## Motor og kanal

Demoen laster Maps JS uten `v=`-parameter, altså Googles default (weekly).
Målt i nettleseren: `google.maps.version === "3.66.3d"`, og skriptene kommer
fra `maps-api-v3/api/js/66/3d/*`. `Model3DElement` **og**
`Model3DInteractiveElement` finnes på denne kanalen — de er ikke låst til
`v=alpha`/`v=beta`. `FlattenerElement` finnes også, som prosjektvolumene
allerede utnytter.

Lastingen går gjennom `@vis.gl/react-google-maps` v1.8.3 (`APIProvider` +
`Map3D` + `useMap3D`), samme vei som `components/map/map-view-3d.tsx`. Nøkkelen
kommer fra `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

## Lyssetting

Motoren skyggelegger flatene etter retning, men mildt og uten kastede skygger:
den mørke `-Y`-flaten rendres med et blått himmelskjær og den offwhite
`+Y`-flaten kommer ut lysegrå framfor helt hvit. Modellen kaster ingen skygge
ned på fotoflisene. Det stemmer med hvordan prosjektvolumene oppfører seg, og
det er grunnen til at de er nesten tette framfor gjennomskinnelige.

Dybdesorteringen mot fotoflisene virker: i `screens/11-default-naervisning.jpg`
skjuler nabobygget i Leksvikgata delvis boksen.

### Emissive materialer er utveien for en modell som skal leses, ikke lyssettes

Googles sol slår hardt ut på flater som vender fra den. På placeholder-boksen
kom det ut som nesten svarte sider, og samme sak traff første eksport av
`husB.glb` — se `screens/husB-first-render-fra-sor-svart-kortside.jpg`.

`KHR_materials_unlit` ville vært det opplagte grepet, men motoren støtter ingen
utvidelser. Utveien som virker er å bygge det samme av kjerne-glTF:
`baseColorFactor` settes svart og teksturen legges på `emissiveTexture` med
`emissiveFactor` `[1, 1, 1]`. Da bærer materialet sin egen lysstyrke og
retningen mot sola slutter å bety noe. Alle 11 materialene i `husB.glb` er satt
opp slik, og skyggesidene leses nå like godt som solsidene.

## Koordinater for Hus B

| Størrelse | Verdi |
|-----------|-------|
| Fotavtrykk-senter | 63.441359, 10.440215 |
| Langakse (modellens +Y) | bearing 110,0° |
| Balkongside (modellens +X) | bearing 200,0° |
| Fotavtrykk | 27,7 × 16,3 m |
| Høyde | 19,5 m |
| Terreng | 16,2 m over havet |

Dette er `DEFAULTS` i `app/demo/lillebytunet-3d/page.tsx`, og `husB.glb` står
riktig med `orientation.heading = 110`.

**Kilde:** `~/klienter/placy/lillebytunet/colmap-ov/georef.json`, COLMAP-raden
under. Posisjonen er regnet ut to ganger med ulike metoder som skiller 18,6 m
nord–sør; se neste avsnitt.

### To metoder, 20 m avvik nord–sør

Posisjonen er regnet ut to ganger, uavhengig, og de er ikke helt enige.

| | COLMAP | Polygon-sinus |
|---|---|---|
| Breddegrad | 63.441359 | 63.441192 |
| Lengdegrad | 10.440215 | 10.440220 |
| Langside-asimut | 110,0° | 109,8° |
| Balkongside | 200° | 200° |

**Retning og øst–vest er de enige om.** Asimuten skiller 0,2°, og
lengdegraden skiller 0,3 m. Avviket ligger i nord–sør: 18,6 m.

**Polygon-sinus** bruker property-picker-API-ets pikselpolygoner alene. Hvert
byggs polygontyngdepunkt svinger sinusformet i bildets x-akse når kameraet går
i bane, og minste kvadrat over de 96 scenene gir posisjon i bakkeplanet opp til
én ukjent skala. Skalaen ble låst mot tomtepolygonen i OSM (way `1308461524`,
`landuse=construction`, `name=Lillebytunet`, `operator=Nordr`) og mot at bygget
er 27 × 16 m.

**COLMAP** rekonstruerer kamerarigen fra bildene og legger rekonstruksjonen
over i kartkoordinater med en likhetstransform mot OSM-fotavtrykkene til
Ståltaugen 1 og 2. Restfeilen på det andre kvartalets senter er 1,0 m, og begge
kvartalene måler 39 × 17 m i rekonstruksjonen mot 39 × 17 m i OSM.

**COLMAP-posisjonen er brukt som default**, av to grunner. Skalaen kommer ut av
rekonstruksjonen som kontroll istedenfor å gå inn som antakelse, og
gateavstanden nordover stemmer bedre med rendringene.

Gate-kontrollen, målt mot OSM-polygonene med Hus Bs dybde 16,3 m og
fasadenormal 20°:

| Nabo | Gate til COLMAP | Gate til polygon-sinus |
|------|-----------------|------------------------|
| Ståltaugen 1 | 19,1 m | 36,6 m |
| Ståltaugen 2 | 20,7 m | 38,2 m |

I `renders/oversikt/048` ligger Hus B rett bak den gule blokka, over én gate.
19–21 m er gate med fortau; 37–38 m er et åpent rom som ikke er der i
rendringen. Samme kontroll gjort i georef-arbeidet ga 11,7 mot 31 m — altså
7 m lavere enn mine tall, antakelig fordi vi måler fra ulike kanter. Forskjellen
mellom de to kandidatene er den samme uansett, rundt 18 m, så kontrollen skiller
dem tydelig selv om nivået spriker.

**Fortsatt åpent.** Ingen av metodene er kontrollert mot bygget slik det faktisk
står, for tomten er byggegrop i alt tilgjengelig bildemateriale. Spørsmålet
avgjøres når Hus B synes i flyfoto eller i Googles fliser. Til da er
nord–sør-plasseringen den svakeste verdien i tabellen over, og
`?lat=`-parameteren finnes nettopp for å kunne prøve det andre svaret.

### Adressen, for ordens skyld

`63.441325, 10.440862` er adressepunktet for Stjørdalsveien 29 (gnr 415 /
bnr 20), oppgitt for «Hus A og B» i FINN-annonsen `331567668` og hentet fra
Kartverkets adresse-API. Det er tomtens punkt, ikke byggets, og dekker begge
byggene. Det brukes ikke lenger til noe her.

## Kamera som matcher boligvelgeren

`?cam=render&dir=<0–95>` setter kameraet slik boligvelgerens Hus B-serie står,
så en scene kan legges side om side med kartet.

Rigen er oppgitt som fysiske mål i `lib/map/lillebytunet-render-rig.ts`:
kameraet står 46,6 m fra byggsenteret vannrett og 25 m over bakken, sikter mot
byggsenteret 8 m over bakken, og hvert scenesteg dreier −3,75° fra bearing 222°
ved scene 0. Googles kamera oppgis i stedet som `range` og `tilt` om
siktepunktet, så de to regnes ut av målene istedenfor å skrives inn ferdige:
`range` = 49,6 m og `tilt` = 70,0°. Da forplanter en korrigert måling seg av seg
selv.

Kontroll: `dir=0` gir heading 42,0°, `dir=24` gir 312,0°, `dir=48` gir 222,0° og
`dir=72` gir 132,0° — som riggen sier.

### `center.altitude` er meter over havet, ikke over bakken

Det står i typene, men er lett å gå på: «The center of the map given as a
LatLngAltitude, where altitude is in meters above the mean sea level.» Et
siktepunkt «8 m over bakken» må altså legges til terrenghøyden.

Terrenget ved Hus B er **16,2 m over havet**, målt to steder som er enige:
Googles egen ElevationService svarer 16,17 m i punktet (oppløsning 19 m), og
Kartverkets DTM1 svarer 16,53 m (`ws.geonorge.no/hoydedata/v1/punkt`). Googles
tall er valgt, siden det er samme kilde som terrenget kameraet står på.
`?calt=<meter over havet>` overstyrer siktepunktet direkte.

Kameraforsettene i demoen siktet opprinnelig på altitude 0 — havnivå, 16 m under
bakken. De fire himmelretningene så riktige ut likevel, fordi tilt 45 og range
150 løfter kameraet uansett, men nærvisningen dykket under fotoflisene. Alle
forsettene sikter nå på terreng pluss en oppgitt høyde over bakken.

## Hvordan bytte modell

1. Eksporter Hus B som `.glb`, **Z-opp, bunn i z = 0**, uten glTF-utvidelser.
   I Blender betyr det `Format: glTF Binary (.glb)`, `Transform → +Y Up`
   avslått, og `Compression` avslått. Legg origo i bunnen av modellen før
   eksport, ikke i senter.
2. Legg fila i `public/models/lillebytunet/`.
3. Åpne
   `http://localhost:3002/demo/lillebytunet-3d?model=/models/lillebytunet/<fil>.glb`.
4. Juster inn med `?lat=`, `?lng=`, `?heading=`, `?alt=`, `?altmode=`, `?scale=`
   og `?calt=`. Verdiene vises i panelet oppe til høyre, så et skjermbilde
   dokumenterer seg selv. `?cam=render&dir=<0–95>` gir kameraet fra
   boligvelgeren.
5. Når verdiene stemmer, flytt dem inn i `DEFAULTS` i
   `app/demo/lillebytunet-3d/page.tsx`.

Alle seks parameterne er verifisert i nettleseren i ett kall:
`?lat=63.44120&lng=10.44120&heading=30&alt=25&altmode=relative_to_ground&scale=0.6`
flyttet, løftet og krympet boksen som forventet
(`screens/12-query-overstyring.jpg`).

`?model=` godtar bare lokale stier som starter med `/` og ender på `.glb` —
uten den sjekken kunne en URL-parameter pekt `Model3DElement` mot en vilkårlig
ekstern vert.

Placeholderne regenereres med
`node scripts/lillebytunet/make-placeholder-glb.mjs`. Skriptet skriver GLB-en
for hånd (`node:zlib` til PNG-en, ingen nye avhengigheter — `three` finnes ikke
i `package.json`), så det er også en lesbar referanse på hva Google faktisk
godtar.

## Kjente begrensninger

- **`range` er avstand til kameraets målpunkt, ikke til modellen**, og
  målpunktets altitude er meter over havet. Ligger målpunktet i havnivå
  samtidig som tilt er høy og range kort, havner kameraet under fotoflisene og
  modellen forsvinner helt. Første forsøk med tilt 74 / range 55 / altitude 0
  ga et helt brunt bilde.
- **En konstant importert fra en `"use client"`-modul er ikke en verdi på
  serveren.** `?dir=` låste seg til 0 for alle verdier fordi grensesjekken
  sammenlignet mot `RENDER_SCENE_COUNT` importert fra klientkomponenten;
  serveren fikk en klientreferanse, sammenligningen ble usann, og alt falt til
  default. Riggen ligger nå i `lib/map/lillebytunet-render-rig.ts`, som er en
  vanlig modul begge sider kan lese. Feilen gir ingen advarsel og ingen typefeil
  — den ser ut som en logikkfeil.
- **Kameraet snapper, det flyr ikke.** Presetsene settes som props på
  `gmp-map-3d`. Målt over 14 animasjonsrammer etter et presetbytte står heading
  og range på målverdien allerede i første ramme — det er et hardt kutt, ingen
  interpolasjon. Det er bevisst her, siden snapping gir reproduserbare
  skjermbilder, men skal dette inn i boardet må det gå via `flyCameraTo`.
  `gmp-map-3d` tar heller ikke imot kamera satt imperativt så lenge vis.gl-en
  eier de samme propene: både direkte tilordning og `flyCameraTo` fra konsollen
  ble overkjørt.
- **Ingen klikk på modellen.** Demoen bruker `Model3DElement`. Skal modellen
  kunne klikkes, må den byttes til `Model3DInteractiveElement`, som sender
  `gmp-click`.
- **Ingen test.** Demoen er verifisert med skjermbilder og konsoll, ikke med
  Vitest. Kartlagene rundt (`project-massing-layer-3d`, `route-layer-3d`) har
  tester; denne siden er en engangsflate og har ingen.

## Åpne tråder

- **Nord–sør-plasseringen av Hus B er ikke avgjort.** To metoder skiller 18,6 m,
  og ingen av dem er kontrollert mot bygget slik det står. Avgjøres når Hus B
  synes i flyfoto eller i Googles fliser.
- Rekkehusene er ikke stedfestet, og Hus A, C og D har svakere tall enn Hus B.
  Skal hele prosjektet inn i kartet, trengs bygglengdene fra Nordr eller en
  fotogrammetrisk rekonstruksjon.
- Filstørrelsen er greit håndterbar for ett bygg: `husB.glb` er 1,09 MiB
  ukomprimert (1 145 312 bytes) og hentes på 28–46 ms over localhost, målt med
  cache-bypass. Det sier ingenting om produksjon, og fire bygg pluss rekkehus i
  samme scene er ikke målt.
- Hvordan ser modellen ut mot prosjektvolumene i
  `components/map/project-massing-layer-3d.tsx`? En ekte modell og et hvitt
  ekstrudert volum i samme scene kan lese som to ulike språk.

## Filer

| Fil | Rolle |
|-----|-------|
| `app/demo/lillebytunet-3d/page.tsx` | Server-komponent, parser query, eier koordinat-defaultene |
| `components/map/lillebytunet-model-demo.tsx` | Klientflate: `Map3D`, `Model3DElement`-laget, kamera-presets, målepanel |
| `lib/map/lillebytunet-render-rig.ts` | Kamerarigen, terrenghøyden og `?dir=`-parsingen. Vanlig modul, lest av både server og klient |
| `scripts/lillebytunet/make-placeholder-glb.mjs` | Genererer begge placeholder-GLB-ene |
| `public/models/lillebytunet/husB.glb` | Default. 27,7 × 16,3 × 19,5 m, Z-opp, bunn i z = 0, 11 emissive materialer, ingen utvidelser |
| `public/models/lillebytunet/placeholder-box.glb` | Google-rammen: 30 m øst–vest, 20 m nord–sør, 15 m høy, bunn i z = 0 |
| `public/models/lillebytunet/placeholder-box-yup-probe.glb` | Måleinstrument. glTF-rammen: +Y opp, bunn i y = 0 |
| `docs/research/lillebytunet-3d/screens/` | `01`–`13` er aksemålingen; `husB-*.jpg` er Hus B i de seks himmelretningene og i render-match for dir 0, 24, 36, 48 og 72 |
