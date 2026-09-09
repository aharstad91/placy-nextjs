# Lillebytunet Hus B — rekonstruksjon fra boligvelger-renders

**Oppdatert 2026-09-09:** Gjeldende modell er `husB-v2.glb`. Se
[kvalitetsrapporten](04-kvalitetsrunde.md) for reproduserbar eksport, faktisk Google-kontroll
og gjenstående begrensninger. Teksten under beskriver prototypen i `94ccf12`, ikke v2.
Gjennomgangen av alle 192 relevante kildebilder viste to inntrekk (4/5/6 etasjer),
og balkongfronten trenger egen geometri. Tidligere positive konklusjoner om silhuett,
teksturstrekking og fullstendig rekonstruksjon var for sterke.

Dato: 2026-09-08. Hovedagent (Fable). Datagrunnlag: `01-datainnhenting.md` (Agent 1).
Kartintegrasjon: `02-kartintegrasjon.md` (Agent 2).

## Resultat i én setning

Hus B er rekonstruert som **ryddig bokse-geometri (22 trekanter) med ortorektifiserte
fasadeteksturer fra fire render-kameraer**, eksportert som ren GLB (1,1 MB, ingen
glTF-utvidelser). Kameraene ble beregnet med COLMAP; alle 96 bilder registrerte.

## Historisk arbeidsflyt (prototype `94ccf12`)

De fire gamle modell-/eksportskriptene nedenfor er erstattet av kvalitetsrundens
eksplisitte CLI-er. Historisk kode finnes i commit `94ccf12` og lokalt under
`quality-v2/baseline-94ccf12/scripts/`. Bruk kommandoene i rapport 04 for ny eksport.

Alle stier under `~/klienter/placy/lillebytunet/`. Python-venv: `.venv/` (numpy, scipy,
opencv-python-headless, matplotlib, pillow). Verktøy: COLMAP 4.1.1 (`brew install colmap`),
Blender 5.2 LTS (`brew install --cask blender`). Skriptene ligger i repoet under
`scripts/lillebytunet/model/` og kjøres fra `colmap-b/`.

```bash
cd ~/klienter/placy/lillebytunet && python3 -m venv .venv && .venv/bin/pip install numpy scipy opencv-python-headless matplotlib pillow
mkdir -p colmap-b && ln -sfn ../renders/bygg-b colmap-b/images && cd colmap-b
colmap feature_extractor --database_path db.db --image_path images \
  --ImageReader.camera_model PINHOLE --ImageReader.single_camera 1 --FeatureExtraction.use_gpu 0
colmap sequential_matcher --database_path db.db --FeatureMatching.use_gpu 0 --SequentialMatching.overlap 12
mkdir -p sparse && colmap mapper --database_path db.db --image_path images --output_path sparse
colmap model_converter --input_path sparse/0 --output_path sparse/0 --output_type TXT
S=/path/to/repo/scripts/lillebytunet/model
../.venv/bin/python $S/analyze.py      # kamerabane, opp-vektor, Hus B-punkter via enhetspolygoner
../.venv/bin/python $S/fit2.py         # rektangel-fit + reprojeksjonssjekk (check_*.jpg)
../.venv/bin/python $S/facades.py      # kandidat-teksturer per fasade (facade_candidates.jpg)
../.venv/bin/python $S/build_model.py  # -> ../model/husB.obj + teksturer
/Applications/Blender.app/Contents/MacOS/Blender -b --python $S/export_glb.py    # -> ../model/husB.glb + husB.blend
/Applications/Blender.app/Contents/MacOS/Blender -b --python $S/render_check.py  # 4 testrender
```

Korrigering: de gamle eksportskriptene brukte skriptets egen plassering ved filoppslag;
å bare bytte arbeidsmappe var ikke tilstrekkelig. Den historiske kommandolisten var
derfor ikke komplett. V2 bruker eksplisitte inn- og utstier uten slik kopiering.

## Hva COLMAP fant (beregnet, ikke antatt)

| Størrelse | Verdi |
|---|---|
| Registrerte bilder | 96 av 96 |
| Reprojeksjonsfeil | 0,45 px |
| Kameramodell | PINHOLE, f ≈ 1213/1221 px → horisontalt synsfelt ≈ 76,6° |
| Kamerabane | perfekt sirkel, radius 3,76 enheter, planresidual 0,0004 |
| Pitch | 19,9° nedover, identisk i alle 96 bilder |
| Vinkelsteg | 3,75° per `direction`-steg, **mot klokka sett ovenfra** |
| Kamerahøyde over bakken | ≈ 2,0 enheter ≈ 25 m (anslått skala) |

Det er altså et rent turntable-oppsett: kameraet går i sirkel rundt et fast punkt med fast
høyde og pitch. `direction 0` er kameraets posisjon, ikke et fritt valgt bilde.

## Hus B-geometri

Hus B-punkter ble isolert ved å kreve at ≥ 50 % av et 3D-punkts observasjoner ligger inne i
enhetspolygonene fra boligvelger-API-et (7 713 av 58 170 punkter). Fotavtrykk = rotert
rektangel med minst areal over p3–p97 av punktene i etasje 1–5.

| Størrelse | COLMAP-enheter | Meter (skala 12,4 m/enhet) | Kilde |
|---|---|---|---|
| Etasjehøyde | 0,25 (topper i z-histogram) | 3,1 | **anslag**: 3,1 m/etasje er antatt |
| Fotavtrykk (balkongfront inkl.) | 1,296 × 2,237 | 16,1 × 27,7 | beregnet |
| Høyde etasje 1–5 | 1,25 | 15,5 | beregnet |
| Total høyde (6 etasjer) | 1,50 | 18,6 | beregnet |
| Toppetasje inntrukket, kortside B− | 0,48 | 5,9 | beregnet fra punkter z > −0,72 |
| Toppetasje inntrukket, balkongside A+ | 0,12 | 1,5 | beregnet |

**Skala verifisert uavhengig (oversiktsserien):** COLMAP gir ingen absolutt skala, og
3,1 m/etasje var det første ankeret. Deretter ble oversiktsserien (96 bilder, 0,41 px)
rekonstruert separat og georeferert mot OpenStreetMap-fotavtrykkene til de to eksisterende
naboblokkene Ståltaugen 1 og 2 (se «Georeferering» under). Der måler Hus B **16,3 × 27,7 m**
mot modellens 16,1 × 27,7 m — skalaen 12,4 m/enhet holder innen 1 %. Høyden måles til 19,5 m
i oversikten mot 18,6 m i modellen (p99 av punkter inkluderer trolig gesims/rekkverk);
usikkerhet ±1 m. Kryss-sjekk mot salgsdata: BRA-i per normaletasje 265–282 m², brutto
fotavtrykk minus 2 m balkongsone ≈ 14 × 27,7 ≈ 390 m² → BRA-i/BTA ≈ 0,70, plausibelt.

Reprojeksjon av den tilpassede boksen i fire bilder: `model-check/colmap-box-reprojection.jpg`.
Boksen følger balkongfrontene på A+-siden, veggen på de tre andre.

## Georeferering (kildebasert, ikke adressepunkt)

Skript: `georef1.py` (ramme + bygg-punkter via polygoner i oversiktsscenene, `parent` =
bygg-uuid), `georef3.py` (rektangel-fit + likhetstransform). Metode: Ståltaugen 1 (OSM way
1206556797) og Ståltaugen 2 (1206556798) isoleres i punktskyen (4-etasjers høydebånd, punkter
nær nybyggene ekskludert), rektangel-fit, og en 2D-likhetstransform (skala, rotasjon,
translasjon) løses mot OSM-omrissene.

| Kontroll | Verdi |
|---|---|
| Blokk-mål i render × skala | 39,1 × 17,2 m (begge) |
| Blokk-mål i OSM | 38,8 × 17,1 og 39,4 × 16,4 m |
| Rotasjon fra langakser / fra sentre | 6,5° og 7,5° / 5,4° |
| Restfeil, senter Ståltaugen 2 | 1,0 m |
| Skala oversiktsramme | 35,1 m/enhet |
| `direction 0` i oversikten | kamera i sør, ser mot bearing 6,5° (≈ nord) — bekrefter Agent 1 |

**Hus B:** senter **63.441359, 10.440215**, langakse (modellens +Y, flush-enden) mot
**bearing 110°**, balkongside (+X) mot **200°** (sør-sørvest), 16,3 × 27,7 m, 19,5 m høy.
Usikkerhet: ±1,5 m i posisjon (OSM-omriss + fit), ±2° i retning. Kontrollplott:
`model-check/georef-check.jpg` (OSM-omriss i svart over transformert punktsky) og
`model-check/oversikt-topdown.jpg`. Alle fire blokker + rekkehus fikk samtidig posisjon
(`husB_georef.json` har bare Hus B; A/C/D skrives ut av `georef2.py`).

Agent 2s første punkt (63.441325, 10.440862, heading 30) var tomtens adressepunkt og lå
~33 m for langt øst; heading 30 var nabobyggenes gateretning, ikke Hus Bs. Agent 2 løste
deretter uavhengig (polygon-tyngdepunktenes sinussvingning over 96 scener + OSM-tomtepolygon
som skala) og fikk **samme retning (110°) og samme øst-vest-posisjon**, men 20 m lenger sør
(63.44118, ±6 m oppgitt). Valgt: OSM-fotavtrykk-løsningen, fordi den er forankret i to
oppmålte bygg med 1 m restfeil og gir 11,7 m gate mellom Ståltaugen 1 og Hus B, slik
oversiktsrender 048 viser (Hus B rett bak den gule blokka over én gate); Agent 2s gir 31 m.
Avgjøres endelig når bygget synes i flyfoto/FKB.

## Google Maps 3D-tilpasning av GLB (funnet empirisk)

- **Z-opp:** Google leser GLB med +X øst, +Y nord, +Z opp (målt av Agent 2 med probe-boks).
  `export_glb.py` baker rotasjonen inn i vertices (`transform_apply`) og eksporterer med
  `export_yup=False`; bunnen ligger i z = 0.
- **Ingen utvidelser:** Blender legger på `KHR_materials_specular`; `strip_ext.py` fjerner
  alle `extensions`/`extensionsUsed` etter eksport.
- **Selvlysende materialer:** Første test viste svarte flater (begge kortsidene, se
  `screens/husB-first-render-fra-sor-svart-kortside.jpg`). Løsning i kjerne-glTF:
  `emissiveTexture` = fasadeteksturen, `emissiveFactor` 1, `baseColorFactor` svart. Da vises
  renderens innbakte lys flatt, uavhengig av Googles solretning
  (`screens/husB-first-render-fra-sor-emissive.jpg`). Dette beviser ikke at Google har
  «null ambient», eller hvordan alle skygger behandles. V2 sammenligner tre materialvalg
  i faktisk Google-visning; den opprinnelige årsaksforklaringen trekkes tilbake.

## Teksturer

Per flate: homografi fra flatens fire 3D-hjørner (via COLMAPs P-matrise) til et rektangel på
60 px/m, `cv2.warpPerspective` fra ett originalbilde. Kameravalg = mest frontalt kamera
per fasade:

| Flate | Kamera (`direction`) | Merknad |
|---|---|---|
| A− (langside, vinduer) | 54 | ren, litt bakgrunn øverst ved B−-hjørnet (der toppetasjen er inntrukket) |
| A+ (langside, balkonger) | 5 | balkonger bakt flatt inn i balkongfront-planet |
| B− (kortside, inntrukket topp) | 78 | nabobyggets pergola dekker nederste høyre hjørne; slagskygge fra nabo |
| B+ (kortside, vinduer) | 30 | ren |
| Toppetasje ×4, terrasser ×2, tak | samme kameraer | tak fra 20° pitch = strukket ~3×, uskarpt |

Kandidat-arket (`model-check/facade-candidates.jpg`) viser head-on og ±22,5° per fasade.

## Hva som er kildebasert, anslått og mangelfullt

**Kildebasert:** kameraer, fotavtrykk-proporsjoner og -orientering relativt kamerabanen,
etasjeantall, toppetasjens inntrekk, alle fasadeteksturer.

**Anslått:** absolutt skala (3,1 m/etasje), bakkenivå (p0,5 av punktene; terrenget skrår),
georeferering (se `02-kartintegrasjon.md`).

**Mangelfullt / bevisst forenklet:**
- Balkonger er flate i teksturen, ikke geometri. Den nye gjennomgangen viser at de er
  forskjøvet, og at silhuett og dybde påvirkes vesentlig fra skrå vinkler.
- Taket er uskarpt (bratt projeksjon). Bedre kilde: oversiktsserien (høyere kamera), krever
  felles COLMAP-løsning eller manuell registrering.
- Bakt lys og skygger fra renderen (B−-fasaden ligger i slagskygge fra nabobygg).
- Nabo-pergola nederst på B− og litt nabobalkong ved kanten av A+.
- Ingen inngangsparti-detaljer, ingen underkant/sokkel.

## Åpne tråder

1. Skala og posisjon er verifisert mot OSM-naboblokker (±1,5 m). Kartverket/FKB-fotavtrykk
   for selve Hus B finnes ikke ennå; sjekk igjen når bygget er registrert.
2. `direction` er en kildeindeks med ulike nullretninger i de to seriene. Hus B-riggen
   bruker kamerabearing `222 − 3,75 × direction`; «0 = sør» gjelder ikke begge.
3. Tak-tekstur fra oversiktsserien.
4. Automatisering på tvers av prosjekter: alt over er skript, men kameravalg og
   toppetasje-inntrekk ble vurdert visuelt. Neste bygg (Hus A/C/D) er testen på hvor mye som
   må håndjusteres.

## Verifisering i Google Maps 3D (utført, ikke bare eksportert)

Demo: `PORT=3002 npm run dev` → `http://localhost:3002/demo/lillebytunet-3d` (defaults =
Hus B på målt posisjon). `?cam=render&dir=<k>` setter Google-kameraet der boligvelgerens
kamera k står (bearing 222 − 3,75·k, 46,6 m ut, 25 m opp, pitch 19,9°; rigg i
`lib/map/lillebytunet-render-rig.ts`). Terreng 16,2 m o.h. (Google ElevationService).

| Kontroll | Resultat |
|---|---|
| Fire himmelretninger, skrått luftperspektiv | `screens/husB-nord/ost/sor/vest.jpg` — hele bygget, riktig silhuett med inntrukket toppetasje |
| Mellomvinkel (ikke teksturkamera) | `screens/husB-mellom.jpg` + render-match dir 36 (`screens/husB-render-dir36.jpg`) |
| Nærvisning | `screens/husB-naer.jpg` |
| Side-ved-side render vs. kart | `compare/compare-dir-000/024/036/048/072.jpg` |
| Konsoll | 0 errors, 0 warnings gjennom hele økten |
| GLB | 1,09 MiB, 22 trekanter, 11 JPEG-teksturer, lastet på 28–46 ms lokalt |
| Kamerabevegelse | preset-bytte er hardt kutt (ingen fly-to); modellen henger ikke |

Etterkontrollen i rapport 04 korrigerer den første vurderingen: prototypen hadde feil
terrassesilhuett, flate balkonger og strukne detaljer på flere flater. Google-kameraet har
smalere synsfelt enn renderens 76,6°, så bygget fyller mer av bildet i kartet. B−-kortsiden
bærer nabobyggets slagskygge og pergola nederst. Den første påstanden om at alle fasader
og terrasser stemte uten strekk, var ikke dekket av bildene.

## Leveranser (hvor tingene ligger)

| Leveranse | Sti |
|---|---|
| Innhentingsskript + manifest | `scripts/lillebytunet/fetch-scenes.mjs`, `~/klienter/placy/lillebytunet/manifest.{json,md}` |
| Originalbilder (576) + kontaktark | `~/klienter/placy/lillebytunet/renders/<serie>/`, `contact-sheets/` (kopi i `docs/research/lillebytunet-3d/contact-sheets/`) |
| COLMAP-løsninger | `~/klienter/placy/lillebytunet/colmap-b/sparse/0`, `colmap-ov/sparse/0` |
| Redigerbar modellkilde | `~/klienter/placy/lillebytunet/model/husB.blend`, `husB.obj/.mtl` + 11 teksturer |
| GLB | `public/models/lillebytunet/husB.glb` |
| Demo | `app/demo/lillebytunet-3d/`, `components/map/lillebytunet-model-demo.tsx`, `lib/map/lillebytunet-render-rig.ts` |
| Pipeline-skript | `scripts/lillebytunet/model/*.py` |
| Rapporter | `docs/research/lillebytunet-3d/01-datainnhenting.md`, `02-kartintegrasjon.md`, `03-modellering.md` |
| Kontrollbilder | `docs/research/lillebytunet-3d/model-check/`, `screens/`, `compare/` |

Bildesett, COLMAP-databaser og modellkilde ligger utenfor git (~1 GB); re-hentes med
`node scripts/lillebytunet/fetch-scenes.mjs` og kommandoene øverst i dette dokumentet.

## Vurdering: mulig / gjennomførbart / automatiserbart

- **Teknisk mulig:** ja, bevist på Hus B. Renders er ideelt SfM-materiale (0,4 px feil,
  100 % registrering), og turntable-geometrien er så regelmessig at kameraet kan
  parametriseres med fire tall.
- **Praktisk med noe bearbeiding:** ja. Manuelle valg på Hus B: bounding-bokser for
  naboblokkene i georef, tolkning av toppetasjens inntrekk, kameravalg per fasade (alle tre
  var visuelle vurderinger på under ti minutter til sammen). Resten er skript.
- **Pålitelig automatiserbart på tvers av prosjekter:** ikke ennå. Det som må generaliseres:
  (1) leverandør-API-et (dette er Nordr/newbuilds «property-explorer»; andre boligvelgere har
  annen struktur), (2) geometri-tolkning ut over «boks + inntrukket toppetasje» (L-former,
  saltak, flere inntrekk), (3) georef krever kjente nabobygg i bildet, (4) okklusjon fra
  nabobygg må håndteres ved kameravalg. Hus A/C/D er neste test: samme API, samme rigg,
  men andre former (A er L-formet i punktskyen, D er 8 etasjer).
