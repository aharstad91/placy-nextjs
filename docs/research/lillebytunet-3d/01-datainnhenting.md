# Lillebytunet — datainnhenting fra Skanskas boligvelger

Dato: 2026-09-08. Agent 1 (datainnhenting).

Alle arkitekturrender-serier i Skanskas Lillebytunet-boligvelger er hentet ned:
**6 serier × 96 bilder = 576 bilder**, alle 1920×1080 WebP, ingen duplikater, ingen
manglende vinkler.

---

## 1. Hvor dataene ligger

| Innhold | Sti |
|---|---|
| Rå API-responser (8 JSON-filer) | `~/klienter/placy/lillebytunet/api/` |
| Originalbilder, 576 stk, 330 MB | `~/klienter/placy/lillebytunet/renders/<serie>/<index>_<scene-uuid>.webp` |
| Manifest, maskinlesbart | `~/klienter/placy/lillebytunet/manifest.json` |
| Manifest, lesbart | `~/klienter/placy/lillebytunet/manifest.md` |
| Variant-måling (url vs. optimized vs. original) | `~/klienter/placy/lillebytunet/variant-probe.json` |
| Kontaktark, full størrelse (3885×1473) | `~/klienter/placy/lillebytunet/contact-sheets/<serie>.jpg` |
| Kontaktark, repo-kopi (2718×1030, <1 MB) | `docs/research/lillebytunet-3d/contact-sheets/<serie>.jpg` |
| Nedlastingsscript | `scripts/lillebytunet/fetch-scenes.mjs` |
| Kontaktark-script | `scripts/lillebytunet/make-contact-sheets.sh` |

Serie-slugger: `oversikt`, `bygg-a`, `bygg-b`, `bygg-c`, `bygg-d`, `rekkehus`.

### Hvordan hente på nytt

```bash
node scripts/lillebytunet/fetch-scenes.mjs                  # alt, hopper over det som finnes
node scripts/lillebytunet/fetch-scenes.mjs --probe-only     # bare variant-måling
node scripts/lillebytunet/fetch-scenes.mjs --variant url    # annen bildevariant
scripts/lillebytunet/make-contact-sheets.sh                 # kontaktark på nytt
```

Scriptet er idempotent: bilder som alt ligger på disk leses fra disk (`status: "cached"`)
i stedet for å lastes ned igjen. Ingen nye avhengigheter, Node 20+ (global `fetch`).

---

## 2. API-struktur

Boligvelgeren er en Newbuilds "property explorer", innebygd på
`https://bolig.skanska.no/prosjekter/lillebytunet#kart` via iframe fra
`nb-frontend-bundles-production.newbuilds-assets.com`. Selve dataene kommer fra et
annet domene:

```
Base:            https://storefront.newbuilds.com/api/v1
property_picker: f16ffe9e-1bb7-451e-b9e3-fb9781d10e8f
company:         f0f13804-d3a0-4982-ba7b-8e128360ffa4
```

### Autentisering

API-et krever `Authorization: Bearer <jwt>`. Uten header svarer alle endepunkter `401`.
Tokenet hentes **anonymt** fra et offentlig endepunkt:

```
GET /clients/<company>/credentials   ->   ["<jwt>"]
```

Ingen innlogging, ingen cookie, ingen nøkkel. Tokenet er et kortlevd JWT (`exp` ~24 timer)
med scope `storefrontapi:property_picker`. Scriptet henter det ved hver kjøring og holder
det i minne — det skrives aldri til disk, og ingen av de lagrede filene inneholder
token, cookie eller Authorization-header (verifisert med grep).

### Endepunkter

| Endepunkt | Innhold |
|---|---|
| `/property_pickers/<id>/data` | Prosjekt, lokasjon, 5 bygg, 96 nivåer-metadata, innstillinger |
| `/property_pickers/<id>/scenes_per_level` | Oversiktsserien: 96 scener |
| `/property_pickers/<id>/scenes_per_level?scene_uuid=<view-id>` | Én bygningsserie: 96 scener |
| `/property_pickers/<id>/units_assets` | 101 enheter med plantegninger (ikke render-serier) |
| `/property_pickers/<id>/splash_screen` | Splash-konfig |
| `/property_pickers/<id>/unit_floorplan_thumbnails?units[]=…` | Plantegning-thumbnails |

### Navigasjon mellom serier

Sub-visningene oppdages i oversiktsseriens egne data. Hver oversiktsscene har
`references[]` der fem av dem har `target: {type: "view", id: <uuid>}`. De fem
`view`-id-ene er nøyaktig de fem bygningsseriene:

| view_uuid | parent_path | Bygg |
|---|---|---|
| `64b7c30d-f468-43fe-80fc-d62780f0b8ed` | `Bygg-A` | Hus A |
| `b833b7aa-922a-4ed9-9724-a8ca389d0728` | `Bygg-B` | Hus B |
| `1c1d220f-9f87-49a1-b7db-0c0e13af9256` | `Bygg-C` | Hus C |
| `11aab84c-ddef-495b-b710-01d15027a938` | `Bygg-D` | Hus D |
| `94009fcb-ad1d-4ba7-8e61-ed59960ed97e` | `Rekkehus` | Rekkehus |

Frontend-en henter alle fem forhåndsvis ved sideåpning — klikk på et bygg gjør ikke
noe nytt nettverkskall. Rotasjon er heller ikke nettverksdrevet: alle 96 scener i en
serie legges i DOM som `<g id="scene-<uuid>">` med et `<image width=1920 height=1080>`,
og rotasjon bytter bare hvilken `<g>` som er synlig. Nettleseren bruker
`optimized_url`; vi laster ned `original_url`.

---

## 3. Opptelling per serie

Fullstendig, ikke et utvalg. `scene_count` fra API-et stemmer med antall scener i
responsen, og alle `direction`-verdier 0–95 finnes i hver serie.

| Serie | Bygg | API sier | Oppdaget | Lastet ned | Validert | Duplikater | Feilet | Manglende vinkler | Enheter med `favorable_angle` |
|---|---|---|---|---|---|---|---|---|---|
| `oversikt` | hele tomta | 96 | 96 | 96 | 96 | 0 | 0 | ingen | 0 |
| `bygg-a` | Hus A | 96 | 96 | 96 | 96 | 0 | 0 | ingen | 27 |
| `bygg-b` | Hus B | 96 | 96 | 96 | 96 | 0 | 0 | ingen | 24 |
| `bygg-c` | Hus C | 96 | 96 | 96 | 96 | 0 | 0 | ingen | 25 |
| `bygg-d` | Hus D | 96 | 96 | 96 | 96 | 0 | 0 | ingen | 41 |
| `rekkehus` | Rekkehus | 96 | 96 | 96 | 96 | 0 | 0 | ingen | 7 |
| **Sum** | | **576** | **576** | **576** | **576** | **0** | **0** | | **124** |

Alle 576 sha256-summer er unike, så ingen serie gjenbruker bilder fra en annen og
ingen vinkel er en kopi av nabovinkelen.

**Alle fem bygg har egen serie.** Ingen mangler. Oversiktsvisningen viser Hus A, B, C, D
og Rekkehus, og alle fem er klikkbare og har sin egen 96-bilders serie. Bygg-navnene i
`data.project.buildings` er «Hus A/B/C/D» og «Rekkehus», mens `parent_path` og
filnavnene bruker «Bygg-A» osv. — samme bygg, to navnekonvensjoner.

---

## 4. Oppløsning og valg av bildevariant

Hvert `asset` har tre URL-er. Alle tre ble lastet ned og målt for alle seks serier
(18 målinger, ikke tre):

| Variant | Oppløsning | Filstørrelse (`oversikt`) | Filstørrelse (`rekkehus`) |
|---|---|---|---|
| `optimized_url` | 1920×1080 | 273 356 B | 325 078 B |
| `url` | 1920×1080 | 505 612 B | 585 072 B |
| `original_url` | 1920×1080 | 693 960 B | 792 692 B |

**Alle tre variantene er 1920×1080.** De skiller seg bare på komprimering.
`original_url` er konsekvent størst i alle seks serier, altså minst komprimert, og
det er den vi laster ned. `asset.file_size`-feltet i API-et beskriver `original_url`.

Dimensjoner ble lest både av scriptets egen WebP-header-parser og krysssjekket med
`sips -g pixelWidth -g pixelHeight` på stikkprøver fra fem serier — samme svar.

**1920×1080 er taket.** Det finnes ingen høyere oppløsning i API-et. Alle filer er
WebP i simpel `VP8 ` (lossy) container — **ingen alfakanal**, så byggene kan ikke
maskeres ut av bakgrunnen med gjennomsiktighet. Kontaktarkene er den eneste JPEG-en
vi lager selv.

---

## 5. Hva `direction` er

`direction` er en heltalls-indeks 0–95 og gir rekkefølgen i rotasjonen. 96 steg over en
full runde gir **3,75° per steg**.

`compass_direction` er en float, men den er **ikke** en kompasskurs. Målt på alle 576
scener er den eksakt `direction / 12` (0,0 → 7,9167). Den bærer altså ingen informasjon
utover `direction`, og skal ikke tolkes som grader. Den er en lineær omskalering, ikke
en orientering.

Selve orienteringen ligger i `data.levels`:

```
levels["."].north_scene       = 0
levels["Bygg-A"].north_scene  = 0     (samme for alle fem bygg)
levels[…].scene_count         = 96
```

`north_scene: 0` er nord-referansen: scene med `direction: 0` er nordvisningen. Det
stemmer med bildene — i `oversikt/000` fyller Trondheimsfjorden horisonten, og fjorden
ligger nord for Lilleby.

**Åpen tråd:** dataene sier ikke om `direction 0` betyr «kamera står i nord» eller
«kamera ser mot nord», og heller ikke om indeksen øker med eller mot klokka. Begge må
pinnes ved å sammenligne to–tre kjente bilder mot kart før vinklene brukes til noe
geometrisk. Det er billig å avgjøre, men det er ikke avgjort her.

`label` er `null` på alle 576 scener. `main: true` på nøyaktig én scene per serie —
alltid `direction: 0`.

`favorable_angles` i `data.levels[<bygg>]` er et kart fra enhets-uuid til én
`direction`-indeks, altså den vinkelen boligvelgeren mener viser den leiligheten best.
Det er 124 oppføringer fordelt på de fem byggene, og settet er identisk med de 124
enhetene som har polygoner i scenedataene. Prosjektet har altså 124 enheter, hvorav
101 har plantegninger i `units_assets` — de 23 uten er en delmengde-forskjell, ikke
en inkonsistens.

---

## 6. Kameradata: finnes ikke

Dette er et eksplisitt negativt funn. Alle åtte API-responser ble søkt gjennom for
nøkler som matcher `camera|fov|focal|lens|scale|zoom|elevation|altitude|tilt|pitch|
bearing|azimuth|matrix|transform|projection|meter|model|glb|gltf|ifc|obj`.

**Det finnes ingen:**

- kameraposisjon, -høyde eller -avstand
- synsfelt (FOV), brennvidde eller sensorstørrelse
- projeksjonsmatrise eller view-matrise
- tilt/pitch per scene
- målestokk, meter-per-piksel eller noe som knytter piksler til virkelige mål
- 3D-modell i noen form — ingen glb, gltf, ifc, obj eller mesh-referanse

`renderer_type` er strengen `"3d"`, men det beskriver bare at bakomliggende
produksjonspipeline var 3D. Det som leveres er ferdig-rendrede raster-bilder.

**Det som faktisk finnes av geometri:**

1. **Tomtens koordinat.** `data.project.location`: 63.4412384, 10.4406095,
   Stjørdalsveien 29, 7066 Trondheim. Ett punkt for hele prosjektet, ingen
   bygningsfotavtrykk.
2. **Nord-referansen** (`north_scene: 0`) og 3,75° per steg.
3. **Polygoner per enhet, i alle 96 vinkler.** Hver scene har `references[]` der hvert
   element har `points[]` med `x`/`y` i bildets 1920×1080-koordinatsystem, og
   `target: {type: "unit", id}`. Det er per-leilighet-omriss i hver eneste vinkel:
   1 585 polygoner over 24 enheter for Hus B, 2 648 over 41 enheter for Hus D,
   til sammen 8 568 unit-polygoner. I oversiktsserien peker polygonene på `view`
   i stedet, altså bygningsomriss for alle fem bygg i 96 vinkler.

Punkt 3 er den eneste kilden til noe som ligner flervisnings-geometri, og den er 2D
per bilde. Den er nok til å finne hvor et bygg ligger i hvert bilde, men den er ikke
kalibrert — uten kameraparametere kan omrissene ikke trianguleres til 3D uten at
kameraene først estimeres fra bildene selv.

---

## 7. Hus B-seriens dekning

Kvantifisert fra unit-polygonene i `scenes_per_level_bygg-b.json`, ikke øyemål.
96 vinkler, 3,75° per steg, hele 360°.

| Mål | Min | Median | Maks |
|---|---|---|---|
| Bygget som andel av bildet (sum polygonareal) | 12,3 % | **14,7 %** | 18,0 % |
| Omsluttende boks som andel av bildet | 15,7 % | 23,0 % | 28,5 % |
| Boksens senter, x (0 = venstre, 1 = høyre) | 0,46 | 0,50 | 0,54 |

Bygget er godt sentrert i alle 96 vinkler, men fyller bare rundt en firedel av bildet.
Polygonene dekker kun salgbare leiligheter, så det faktiske silhuettarealet er noe
større — takflate, trapperom og sokkel er ikke med — men størrelsesordenen holder:
tre firedeler av hvert bilde er nabolag, ikke Hus B.

Serien er ikke en ren orbit rundt et frittstående bygg. Kameraet ligger lavt inne på
tomta, omtrent 30–40° over horisonten, og svinger rundt Hus B mens resten av
kvartalet står i veien. Det som skjuler bygget:

- **Naboblokker i for- og bakgrunn.** I flere vinkler dekker nabobygg deler av
  fasaden, og sokkelen/inngangsplanet er skjult i et flertall av vinklene.
- **Nærplan-klipping.** Kameraet passerer gjennom nabobygg i en del av rotasjonen, så
  bygninger blir kuttet opp og viser innsiden eller svarte hulrom. Dette er tydelig i
  omtrent en firedel av vinklene, kraftigst rundt `direction` 30–40 og 70–90.
- **Vegetasjon og terreng.** Trær og skrånende terreng dekker fotpunktet.
- **Faste skygger.** Alle 96 bilder har samme solstand, så skyggene roterer med
  bygget og ligger innbakt i teksturen.

For 3D-formål betyr det at Hus B ikke kan isoleres per bilde uten segmentering, at
sokkelen mangler i mange vinkler, og at det ikke finnes noen vinkel der bygget står
alene mot bakgrunn.

---

## 8. Mangler og åpne tråder

1. **Rotasjonsretning og nord-semantikk er ikke avgjort.** `north_scene: 0` gir
   ankeret, men ikke om indeksen øker med eller mot klokka, eller om 0 er
   kameraposisjon eller siktretning. Må pinnes mot kart.
2. **Ingen kamerakalibrering.** Skal bildene brukes til å utlede geometri, må
   kameraene estimeres fra bildene (structure-from-motion), ikke leses fra API-et.
3. **1920×1080 er taket.** Ingen høyere oppløsning finnes, og ingen alfakanal.
4. **23 av 124 enheter mangler plantegning** i `units_assets`. Ikke relevant for
   render-seriene, men verdt å vite hvis enhetsdata skal brukes.
5. **Ingen 3D-modell noe sted.** Skal en modell inn i kartet, må den komme fra
   utbygger (IFC/GLB), ikke fra denne boligvelgeren.
6. **Kontaktarkene er uten vinkeltall.** Maskinens ffmpeg er bygget uten `drawtext`,
   og ImageMagick og PIL finnes ikke. Arkene er derfor rene rutenett: 12 kolonner ×
   8 rader, radvis, der `index = rad × 12 + kolonne` og vinkel = `index × 3,75°`.
   Øverste venstre rute er `direction 0` (nord-referansen).
7. **Tokenet er kortlevd.** Nye kjøringer henter nytt token selv, men rå-JSON-filene
   i `api/` er et øyeblikksbilde fra 2026-09-08 og speiler salgsstatus den dagen.
