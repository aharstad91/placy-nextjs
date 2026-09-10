# Hus B — faste Google-kameraer

Før-serien bruker uendret `husB.glb` fra `94ccf12`, SHA-256
`753c512e96b75f64617395788355033e180ac87a8e1c3de829426d72c6952e55`,
1 145 312 byte. Git-versjonen er JPEG kvalitet 90; tapsfrie PNG-er ligger lokalt i
`~/klienter/placy/lillebytunet/quality-v2/google-before-png/`. `before/capture.json` er maskinlesbart kamera- og lastebevis
for alle 11 bilder. Bildene er tatt på faktisk Google Maps 3D i Chrome.

Alle serier bruker viewport **1920 × 1080**, device scale factor **1**, modell-heading
**115°**, skala **1**, posisjon **63.441359, 10.440215**, altitude **0** og
`CLAMP_TO_GROUND`. Modellens filnavn er den eneste parameteren som skal endres mellom
før og etter. Kameraets heading er siktretning; kameraet står på motsatt side.

| ID / URL `cam=` | Heading | Tilt | Range, m | Siktehøyde, m o.h. | Formål |
|---|---:|---:|---:|---:|---|
| n | 180 | 45 | 150 | 24,2 | Nord, tak og bakside |
| e | 270 | 45 | 150 | 24,2 | Øst, tak og kortside |
| s | 0 | 45 | 150 | 24,2 | Sør, tak og balkonger |
| w | 90 | 45 | 150 | 24,2 | Vest, tak og kortside |
| mid | 70 | 58 | 100 | 24,2 | Mellomvinkel mot balkonghjørnet |
| near | 25 | 60 | 65 | 28,2 | Balkonger og takterrasse |
| render, dir=0 | 42 | 69,9576832551 | 49,6040320942 | 24,2 | Originalrender 000 |
| render, dir=24 | 312 | 69,9576832551 | 49,6040320942 | 24,2 | Originalrender 024 |
| render, dir=36 | 267 | 69,9576832551 | 49,6040320942 | 24,2 | Originalrender 036 |
| render, dir=48 | 222 | 69,9576832551 | 49,6040320942 | 24,2 | Originalrender 048 |
| render, dir=72 | 132 | 69,9576832551 | 49,6040320942 | 24,2 | Originalrender 072 |

De fire luftkameraene er bevart fra prototypen. Mellomvinkelen er flyttet fra
320 til 100 m for å kunne vurdere bygget. Nærkameraet er snudd fra heading 200
til 25 og løftet mot takterrassen: den gamle nærvinkelen så mot bakfasaden.
Disse endringene er gjort **før** før-serien; etter-serien bruker identiske verdier.
Definisjonene ligger i `lib/map/lillebytunet-render-rig.ts`.

## Gjenta opptaket

Med prosjektets dev-server startet på 3002:

```bash
node scripts/lillebytunet/capture-quality.mjs \
  --base-url http://localhost:3002 \
  --model /models/lillebytunet/husB-v2.glb \
  --output docs/research/lillebytunet-3d/quality-v2/after \
  --playwright /absolute/path/to/node_modules/playwright/index.mjs \
  --settle-ms 8000
```

`--playwright` kan utelates hvis pakken kan importeres fra prosjektet. Chrome må
være installert. Denne maskinens fungerende pakke ved opptak var
`/Users/andreasharstad/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`;
skriptet bruker `channel: 'chrome'`, og krever dermed ikke nedlasting av en ekstra
Chromium-versjon. Ingen ekstra dev-server eller avhengighetsinstallasjon er nødvendig.

`--views near,mid` begrenser opptaket under iterasjon. `--views near --orbit`
roterer kontinuerlig gjennom 360° på 18 sekunder og bevarer en WebM-video og tolv
bilder fra rotasjonen. Video krever Playwrights FFmpeg-runtime, som kan installeres med
`node /absolute/path/to/node_modules/playwright/cli.js install ffmpeg`. Rotasjonskameraet
bruker range 80 m, tilt 60°, siktehøyde 26,2 m o.h.; dette er tilleggsdekning og
skal ikke erstatte de elleve faste kamerabildene.

Hvert opptak registrerer HTTP-status, GLB-byteantall og SHA-256 separat fra tiden
til modellelementet er lagt til. Deretter venter det eksplisitt valgt `settle-ms` før
bildet lagres. Dette er **ikke** en måling av ferdig rendring. Demoens tekst
«Model3DElement lagt til» er korrekt avgrenset til DOM-innsetting. Synlig modell
må vurderes i bildene; HTTP 200 alene er ikke bevis på vellykket rendering.
Før-serien brukte 8 sekunder, den endelige etter-serien 5 sekunder. Den faktiske
ventetiden står i hvert `capture.json`.

Google-fliser og lys kan forandre seg mellom sesjoner selv med fast kamera.
Originalrender og Google har samme viewport og tilnærmet kameraretning, men
render-riggens FOV og modellens bildestørrelse er ikke pikselkalibrert. Vurder
silhuett og overflatedetaljer med dette forbeholdet; bruk Google før/etter for
sammenligning ved identisk kamera. Skjermbildene bevarer Google-attribusjonen.

## Før-serien: visuell kontroll

Alle 11 bilder viser modellen og faktisk Google-terreng. Nettleseren rapporterte
0 JavaScript-feil og 0 console.error. Ved kontrollen ses:

| Visninger | Før-modellens synlige begrensning |
|---|---|
| n, e, s, w | Stor, utstrakt taktekstur; trinnene følger boksformen. |
| mid, near, render-0 | Balkongrekker er bilder på samme plan. Tak og toppfasade inneholder strukne terrassedetaljer. |
| render-24, render-36 | Kortsiden er flat og lesbar, med lysforskjell mot langfasaden. Taket viser brede uskarpe felt. |
| render-48 | Bakfasaden er lesbar; terrassehøyder og takkant mangler separasjon. |
| render-72 | Terrassefront og vegetasjon er projisert på plane flater; rekkverk mangler dybde. |

FOV-forbeholdet gjelder alle fem render-retningene. Bildene bekrefter ingen
oppmålingspresisjon; modellplasseringen er uendret for å isolere kvalitetsarbeidet.

## Rotasjon og kamerakontroll

En faktisk 18-sekunders rotasjon avdekket at demoens kontrollerte `Map3D`-props
slo kameraet tilbake til valgt heading i 10 av 12 prøver. Kameraet bruker nå
`defaultCenter/Heading/Tilt/Range`, mens `CameraLayer` anvender en valgt vinkel
én gang. Klikk på samme knapp tilbakestiller også et flyttet kamera.

Ny nettleserkjøring bekreftet 12 observerte retninger fra 0 til 342° uten
tilbakeslag; de elleve ordinære før-kameraene beholdt sine innstillinger.
`before-orbit/capture.json` og tilhørende bilder dokumenterer bevegelsen.
Skriptet avviser rotasjoner som dekker mindre enn 270° eller gir færre enn ni
forskjellige retninger. WebM-opptaket er arkivert lokalt sammen med modellkildene.
Kamerapanelet viser valgt preset; faktisk kamerastilling ved hvert opptak står i JSON.

Separat nettlesertest bekreftet også at manuelt satt heading 123° ble beholdt,
og at et klikk på allerede valgt «Nærvisning» tilbakestilte til 25°.
Tak-kontrollmodellens rotasjon bekreftet tilsvarende reset til heading 25°,
tilt 60°, range 65 m og siktehøyde 28,2 m. Ingen nettleserfeil i disse kjøringene.

Endelig modellkontroll og per-visning-vurdering: [rapport 04](../04-kvalitetsrunde.md).
`after/capture.json` dokumenterer 11 identiske før/etter-kameraer, 12 rotasjonsbilder
(10 ulike retninger; siste tre prøver er etter fullført omløp) og vellykket preset-reset.

Etter retting av skjermbildetidens akkumulerte forsinkelse har `after-orbit/capture.json`
12 jevnt fordelte retninger fra ca. 15° til 345° og samme vellykkede reset.
