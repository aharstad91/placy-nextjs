---
title: "Fra arkitekturrender til byggmodell: arbeidsmåte for neste bygg og agent"
date: 2026-09-09
category: workflow-issues
module: Lillebytunet 3D
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - "Et bygg rekonstrueres fra arkitekturrenders for Google Maps 3D."
  - "Modellarbeidet overføres til en annen agent eller språkmodell."
  - "En fungerende eksport mangler dokumentert visuell kvalitet."
tags: [3d-modeling, architectural-renders, google-maps, visual-validation, agent-handoff, colmap, gltf, workflow]
updated: 2026-09-09
---

# Fra arkitekturrender til byggmodell

## Bakgrunn

Hus B-kvalitetsrunden viste hvordan en fungerende, men visuelt svak modell kunne
forbedres gjennom systematisk kildegransking og gjentatte kontroller i Google.
Den første tolkningen hadde ett takinntrekk; kildene viste to. Plane balkongbilder
måtte erstattes med faktisk geometri. Disse feilene kunne ikke avgjøres av eksport,
typekontroll eller trekanttall.

[Hus Bs kvalitetsrapport](../../research/lillebytunet-3d/04-kvalitetsrunde.md) og
[Hus C-pilotens rapport](../../research/lillebytunet-3d/05-hus-c.md) er de to
gjennomførte eksemplene med kommandoer, bilder og målinger. Denne læringen beskriver
arbeidskravene når metoden overføres til neste bygg. Uten dem kan en ny agent gjenbruke
kode som virker, men samtidig arve feil mål, kameraretninger og stoppkriterier.

## Pilotresultat: Hus C er gjennomført

Metoden er kjørt én gang etter denne beskrivelsen, på Hus C. Piloten besto, og Hus B kom
ut byte-identisk fra sin uendrede konfigurasjon etter at den delte koden ble gjort
byggagnostisk. En etterfølgende revisjon av dokumentene mot faktisk kode ga 27 bekreftede
funn; det som er verdt å bære videre står under.

### Målerekkefølge og estimatorer

1. **Mål etasjehøyden først, av dekkepunktene, med kommando.** `massing.py --slab-beyond
   <a>` histogrammerer punktene utenfor det oppgitte veggplanet — balkongfronter og
   dekkeforkanter, som ligger nøyaktig i etasjenivå — og rapporterer toppene og
   modalavstanden mellom dem. For Hus C: seks skarpe topper, alle fem gap 0,240 enheter,
   spredning 0. Samme kommando på Hus B gir 0,240 med spredning 0,02, altså et ærligere
   bilde av hvor regelmessig kilden faktisk er.
   Skriptets andre estimator, autokorrelasjon over hele punktskyen, svarte 0,2368 og er
   **kvantisert til histogram-bin**. Den er en fornuftskontroll, ikke svaret. Ett tall skal
   gjelde nedstrøms, og det er `storey_slabs.units`.
2. **Veggplanene kan ikke leses av punkthistogrammet.** For Hus C lå gavlveggen 0,05
   enheter (64 cm) fra histogrammets sterkeste topp — omtrent én bin-bredde, altså ikke
   uflaks. `massing.py` gir høydeflanker, ikke veggplan. Det som avgjorde, var
   `facade_grid.py`: rektifiser fasaden fra flere `--plane`-verdier og velg den der
   vindusrytmen i rutenettet blir lik den målte etasjehøyden.
3. **Kjør okklusjonsporten før du sampler noe.** `occlusion.py --config <bygg>.json`
   regner ut `skjult dybde = oppkantens høyde / tan(blikkvinkelen)` per flate og gir en
   dom. For Hus C: taket 7,5°, parapet 1,17 m, 8,94 m skjult av 14,30 m — **37,5 %
   synlig**, altså mål farge. Terrassene er 0–7 % synlige. Fasaden bak balkongene er
   36 % synlig per etasje. Alt dette er tilgjengelig før første utsnitt hentes.
   Første forsøk på Hus C hoppet over regnestykket, valgte det jevneste av 56
   kandidatutsnitt og fikk et lyst tak der kilden viser mørk membran. **Et «reint»
   utsnitt av en skrapet flate er et anti-signal:** et mål som belønner jevnhet velger
   nettopp den prøven som traff noe annet. Samme kommando på Hus B forklarer hvorfor
   feilen der ble subtil og ikke åpenbar: Hus Bs tak er 55,8 % synlig, altså rett over
   terskelen — samplet, men fortsatt på det gale.
4. **Velg estimator etter flatetype.** Solid flate: median av et bånd på et plan kameraet
   ser nesten rett på. Gjennomskinnelig flate — rekkverk, netting, sprosser: **de mørkeste
   10–15 prosentene**, ellers måler du det som ligger bak. Hus Cs rekkverk målte median
   (0,47, 0,42, 0,37), som er møblene bak; de mørkeste 15 % ga (0,30, 0,26, 0,22), som
   treffer Hus Bs manuelle anslag. Skrapet flate: ikke sampl, mål farge etter punkt 3.
5. **Retningsforskyvningen mot oversiktsserien er per serie, ikke per prosjekt.** Hus B
   er −10 steg, Hus C er +2. Mål den med SIFT-treff mot alle 96 oversiktsbilder før
   registreringen; ellers feiler den eller blir dårlig. Det finnes ikke noe skript for
   det ennå — se den åpne listen nederst.

### Kontroller som fanget noe

6. **Byte-identisk gjenbygging av forrige bygg er kontrollpunkt 0.** Denne runden endret
   ni delte filer. Hus B ble bygd om fra sin uendrede konfigurasjon etter hver endring og
   SHA-256-sammenlignet på alle tre GLB-varianter. Det er den billigste garantien som
   finnes, og den er grunnen til at refaktoreringen kunne gjøres uten frykt.
7. **Stedfestingen har en fortegnstvetydighet som bare et kjent svar avslører.**
   `georef_building.py` utleder modellens +Y av hvilken ende toppetasjene står mot.
   Første versjon hadde fortegnet motsatt og ga 289,4° i stedet for 109,4° — eksakt 180°,
   altså bygget speilvendt i kartet, og ingenting i utdataene så galt ut. Kjør skriptet
   på forrige bygg først og sammenlign med dets publiserte lat/lng/heading.
   Et avvik på 180° er en fortegnsfeil, ikke en unøyaktighet.
8. **Også kontrollverktøyet må kontrolleres.** Den nye rasterizeren speilet teksturene
   vertikalt (glTF-ens UV-origo er øverst til venstre), og «feilen» dukket opp som et
   mørkt nabotak øverst på en vegg. Sammenlign den genererte teksturfilen med hvordan
   den kommer ut i renderen før du tror på et funn.
9. **Den samme takmålingen avdekket at Hus Bs eget tak er for lyst** — (0,55, 0,53, 0,58)
   levert mot (0,34, 0,34, 0,38) målt. Når en ny kontroll finner en feil i det bygget
   den ble validert mot, er det kontrollen som er bedre, ikke funnet som er feil. Rett
   det som et eget valg, ikke stille i samme runde: baselinen er beviset på at
   refaktoreringen var trygg.

### Konfigurasjonen er ikke en mal

10. **En glemt nøkkel er ikke en feil, den er stille Hus B.** `build_quality.py` faller
    tilbake til `DEFAULT_*`-konstantene ved manglende nøkkel (`build_quality.py:19-38`).
    `hus_b_quality.json` mangler 13 av nøklene Hus C-konfigurasjonen har, så den er
    **ikke** en mal å kopiere. Verst: uten `roof_sample` arves Hus Bs kjent gale takfarge,
    og uten `level_ends` velges `repair='end_balconies'`, som krever en `balconies.end`-gren
    Hus C ikke har. Kopiér `hus_c_quality.json`, ikke Hus Bs, og sett `colmap`, `series`,
    `name` og `model_name` eksplisitt — `--config` defaulter også til Hus B
    (`build_quality.py:417`).

11. **Naboforholdet er en egen påstand.** Hvert bygg var kontrollert alene, og demoen viste
    én modell av gangen, så «Hus B og Hus C står riktig i forhold til hverandre» var aldri
    prøvd. Nå gjør den det: `?buildings=husB,husC` setter begge i kartet fra registeret i
    `lib/map/lillebytunet-buildings.ts`, og kontrollen bekreftet tre ting ingen
    enkeltbygg-kontroll kunne avvise — byggene skjærer ikke i hverandre, balkongsidene
    vender samme vei slik situasjonsplanen krever, og høydeforholdet stemmer. Den avslørte
    også hvor grov Hus Bs lyse tak er: ved siden av Hus Cs målte, mørke membran er det
    ikke lenger et subtilt avvik. Se
    [flere bygg i kartet](../../research/lillebytunet-3d/07-flere-bygg-i-kartet.md).

Et nytt kontrollverktøy erstatter et forbehold fra Hus B-runden:
`model_overlay.py` rendrer den eksporterte GLB-en gjennom det eksakte kildekameraet, så
kilde og modell kan sammenlignes uten synsfeltavvik. Det er hovedbeviset for silhuett og
dybde, og gjør Google unødvendig på de tidlige stegene.

## Arbeidsmåte

### Avklar hva som kan gjenbrukes

Hus B-kjeden er byggspesifikk. **En ny JSON-fil er ikke tilstrekkelig for Hus A eller D.**
Lag egne kilde-/utmapper og parametere, og kartlegg tilpasningene før bygging.
Bevar forrige bygg som regresjonsgrunnlag når felles funksjoner endres.

| Del | Gjenbruk | Må undersøkes eller tilpasses per bygg |
|---|---|---|
| Kameralesing og projeksjon | `source_geometry.py` | PINHOLE, tre innledende sifre i bildenavn, egne kameraer og `frame.npy`/`rect.npy`. Kilde: `source_geometry.py:16`. |
| Rammeverk og fotavtrykk | `frame_fit.py --data --colmap --scenes --report [--checks] [--write]` | Høydebåndet (`--band`), og at fotavtrykket inkluderer balkongfronter. Returnerer **ett** rotert rektangel; se L-form under. På et **levert** bygg: bruk `--write-points`, ikke `--write` — sistnevnte tilpasser `frame.npy`/`rect.npy` på nytt og flytter modellen. `points.npy` er det `massing.py` og `facade_grid.py` trenger, og Hus B manglet den til 2026-09-09. |
| Okklusjonsbudsjett | `occlusion.py --data --config --output` | Ingenting; den leser konfigurasjonen. Kjør den **før** kamera- og utsnittsvalg, og legg tabellen i rapporten. |
| Etasjehøyde, trinn, høydeflanker | `massing.py --data --colmap --scale --output --slab-beyond <a>` | `--slab-beyond` må settes til byggets eget veggplan. Les `gaps_units` og `spread_units`, ikke bare `units`: én dekkeflate lyser ofte opp to nabo-bins, og uten `--slab-min-gap` blir 2 cm rapportert som etasjehøyde. `a_wall_units`/`b_wall_units` er flanker, **ikke** veggplan. |
| Veggplan | `facade_grid.py --data --colmap --output --plane a=<v> --horizontal lo,hi --vertical lo,hi --direction N` (`--overview --registration` for oversiktsserien) | Kandidatverdiene for `--plane`, og `--step` i byggets lokale enheter. Dette er verktøyet punkt 2 handler om. Oversiktsserien leses fra fast `colmap-ov` (`facade_grid.py:55`). |
| Registrering mellom serier | `register_sources.py --colmap --pairs` | **Kamerapar-forskyvningen er per serie** (Hus B −10, Hus C +2) og må måles først. |
| Geometri og teksturering | `build_quality.py`; takoppbygg, pergola, flisstørrelse, gavlåpninger, materialfarger, flate-reparasjoner og per-nivå fasadevalg er konfigurasjon | Alle mål. Manglende nøkkel = stille Hus B (punkt 10). To strengverdier er **ikke** generelle: `repair: "end_balconies"` og `openings: "end_balconies"` ruter til Hus Bs absolutte koordinater i `repair_end()`. Åpningsmål er i COLMAP-enheter mens tykkelser er i meter. Nye former trenger nye primitiver, ikke bare nye tall. |
| GLB og redigerbar kilde | `glb_mesh.py` med `name`/flisstørrelse, `check_glb.py --height/--width/--depth`, `blender_quality.py --name/--radius/--camera-height/--aim-height` | Målgrensene og kameraavstanden. `check_glb` sjekker bare bounding box — den fanger ikke feil form. |
| Google-bilder og rotasjon | `capture-quality.mjs --lat/--lng/--heading/--dir0bearing/--orbit-altitude`, `renderRigCamera(dir, bearing)` | Plassering, riggens nullpunkt og orbit-høyde. Riggens **avstand** (46,6 m) og siktehøyde (8 m) er fortsatt hardkodet i `RIG` (`lib/map/lillebytunet-render-rig.ts:21`), så et høyere bygg beskjæres i render-visningene. `--expect-near-altitude` er en påstand om reset-verdien, ikke en kamerainnstilling. |
| Stedfesting | `georef_building.py --data --building A\|B\|C\|D\|R --output` | Ingen parametere, men fortegnet må kontrolleres mot forrige bygg (punkt 7). Krever `pts.npy`, `bpts.npy` og `frame.npy` i `colmap-ov`, som bare `georef1.py` lager — de finnes fra Hus B-runden. |
| Kilde mot modell | `model_overlay.py --data --config --glb --output --directions --scale` | Retningsutvalget. |
| Før/etter-ark | `compare_quality.py` | Forventer Hus B-kilder og bestemte visnings-ID-er (`compare_quality.py:14`). Ubrukelig for et bygg uten førmodell. |

**Seks skript i samme mappe er Hus B-prototyper som ikke kan kjøres for et annet bygg.**
De leser fra arbeidsmappa og bærer Hus Bs egne arrays og kameramatrise: `analyze.py`,
`fit2.py`, `facades.py`, `georef1.py`, `georef2.py`, `georef3.py`. `analyze.py`/`fit2.py`
er erstattet av `frame_fit.py`, `georef1-3.py` av `georef_building.py`, og `facades.py`
av `facade_grid.py` — den siste erstatningen står ikke i koden, og `facades.py` krasjer
på `husB_pts.npy` (`facades.py:2`). Kommandolistene i
[prototype-rapporten](../../research/lillebytunet-3d/03-modellering.md), både den
historiske arbeidsflyten og georef-avsnittet, gjelder bare Hus B.

### Kildevurdering: tre tall, ikke et øyekast

Velg pilotbygg etter tre målinger, ikke etter neste bokstav:

1. **Antall enheter med polygon** i `api/scenes_per_level_<serie>.json`. Polygon-isoleringen
   er hele grunnlaget for å skille byggets punkter fra nabolagets. Rekkehuset har 7 mot
   blokkenes 24–41 og skal derfor tas sist.
2. **Byggets medianandel av bildet** (sum polygonareal / 1920×1080). 12–20 % for blokkene,
   5,6 % for rekkehuset.
3. **Formklassifisering** fra fire utsnitt ved `direction` 0/24/48/72, beskåret til
   polygonenes omsluttende boks.

Målingen for Lillebytunet er gjort: **Hus A har balkonger skåret inn i volumet og en
sidefløy, Hus D har balkonger rundt flere fasader og et fasettert hjørne.** Hus C ble
valgt fordi det testet én ny akse (åtte etasjer, hjørneinntrekk) uten samtidig å teste ny
balkongtopologi.

### Hva som brekker på Hus A og D, og hvor

Dette er ikke «undersøk i bildene» — det er målt mot koden, og det er tre ulike
inngrepsnivåer:

- **L-form (Hus A): datamodellen, ikke bare byggeren.** Fotavtrykket er ett rotert
  rektangel gjennom hele kjeden — `frame_fit.py:76` gir ett rektangel, `rect.npy` er fem
  tall (`source_geometry.py:55`), `build_quality.py:233` leser fire veggplan, og
  sokkelplata dekker hele rektangelet (`build_quality.py:306`). `massing.py` rapporterer
  ett intervall per akse per høydeskive. **Ingen mekanisk sjekk fanger det**, fordi en
  L har samme bounding box som rektangelet den forveksles med (`check_glb.py:55-59`).
  Feilen dukker først opp i Google. Veien er å utvide fotavtrykket til en liste av
  rektangler før noe annet, ikke å tvinge ett rektangel over formen.
- **Innskårne balkonger (Hus A): ny primitiv.** Dekket bygges alltid utover fra
  veggplanet (`build_quality.py:364,371`), så `front_a` innenfor `a_front` gir
  `ValueError: Box dimensions must be positive` (`glb_mesh.py:37`) — som leser som en
  skrivefeil i konfigurasjonen, ikke som «primitiven finnes ikke». Og fasaden kan ikke få
  hull: fronten er én ubrutt quad per nivå (`build_quality.py:247-251`) og `opening()`
  legger en flate 1 mm foran veggen (`build_quality.py:127-137`). Ikke prøv flere
  `front_a`-verdier, og ikke legg en nisjeboks bak en hel fasadequad.
- **Fasettert hjørne (Hus D): akse-antakelsen.** Alle flater bygges akse-justert i det
  lokale rammeverket, og `massing.py` måler bare langs a og b. Et skrått plan må måles
  før det kan bygges.

## Gjennomfør kontrollpunktene

Kontrollpunktene er agentens egne arbeidskrav. De krever lagret bevis og en begrunnet
vurdering før neste steg; de er ikke nye tillatelsesspørsmål til brukeren.
**Bevis som skal kunne leses av neste agent, må ligge i repoet, ikke i sesjonens
scratchpad.**

| Steg | Arbeid | Bevis før neste steg |
|---|---|---|
| 0. Regresjonsgrunnlag | Endrer du delt kode: bygg forrige bygg om fra dets uendrede konfigurasjon. | SHA-256 på alle tre GLB-varianter, identisk med de leverte. Gjenta etter hver endring, ikke bare til slutt. |
| 1. Kilder og førtilstand | Tell og gjennomgå hele bygningsserien og relevant oversikt. Lag inventar over tak, inntrekk, utstikk og skjulte felt. Bevar eventuell eksisterende modell. | Kontaktark, fullstendig dekningsoversikt, kildehenvisninger og hash av førmodellen. Mangler førmodell, merkes første volum som ny baseline, og steg 6 leverer kilde-mot-modell i stedet for før/etter. |
| 2. Koordinater, etasjehøyde og volum | Beregn egne kameraer og lokal ramme. Mål etasjehøyden med `--slab-beyond`. Fest veggplanene med `facade_grid.py` mot den høyden. Mål retningsforskyvningen, registrer mot oversikten, kontrollér stedfestingen på forrige bygg. Bygg enkel geometri før detaljteksturer. | Ett etasjehøyde-tall, oppgitt med kilde og gjentatt i konfigurasjonen. Transformrest og kontroll på utelatte kamerapar. Stedfestingen gjenskaper forrige byggs publiserte verdier. Fotavtrykket reprojisert i minst fire retninger. |
| 3. Okklusjonsbudsjett | `occlusion.py` per vannrett flate og per fasade bak utstikk, før teksturarbeid. | `occlusion.json` i repoet: flate, blikkvinkel, oppkanthøyde, skjult dybde, synlig andel og dom. Under 50 % synlig skal ikke samples. |
| 4. Tak, terrasser, balkonger og utstikk | Skill tak/dekker fra parapeter, oppbygg, rekkverk og tomrom. Bygg dekktykkelse, underside, bakvegg, rekkverk og nødvendige skjermer. | `model_overlay.py` i det eksakte kildekameraet for minst fire retninger — dette er hovedbeviset, ikke Google: silhuett, etasjeantall og alle inntrekk sammenholdt med kilden, og `overlay.json` med `covered_fraction` per retning i repoet. Antall og rytme kontrollert. Skjulte deler angitt som anslag. Rett silhuettavvik før teksturen videreutvikles. |
| 5. Teksturer og materialer | Velg kamera og utsnitt per flate. Håndter skjulte områder etter steg 3. Sammenlign materialvarianter i Google. | Alle flater/materialer gjennomgått; kilde, gjentakelse, estimator og anslag oppgitt per flate. Ingen avbildede rekkverk bak ny balkonggeometri. |
| 6. Hele bygget i Google | Kontroller fire sider, mellomvinkel, nærvisning og relevante kilderetninger, samt kontinuerlig rotasjon. Legg bygget inn i `LILLEBYTUNET_BUILDINGS` og kontroller det sammen med de andre leverte byggene. | Synlig modell, korrekt filhash, null console-feil, jevn vinkeldekning i rotasjonen, tabell over funn per visning. Har bygget en førmodell: identisk kamera og plassering i før/etter. Ellers: kilde, modell i samme kamera og Google side om side. Med naboer: `capture-quality.mjs --buildings <id-er>` — én tilknyttet modell og ett 200-svar per bygg i hver visning, og bilder som viser at byggene ikke skjærer i hverandre, at balkong- og inntrekkssidene vender som situasjonsplanen krever, og at høydeforholdet mellom dem stemmer. |
| 7. Gjenbygging og sluttkontroll | Kjør kjeden i en tom utmappe fra de bevarte inputene. Gjennomfør en egen avsluttende vurdering av krav mot bilder. | Fungerende GLB og redigerbar kilde, kjøreoppskrift, målinger, bildebevis og konkrete restavvik. Oppgi hvilke steg gjenbyggingen faktisk dekker. Mekaniske prosjektsjekker ved kodeendringer. |

For Lillebytunet finnes allerede seks bildeserier. Ikke last ned på nytt for å kompensere
for at et eksisterende bilde ikke er undersøkt. Hus B, Hus C og oversikten har
kamera­rekonstruksjoner fra de dokumenterte rundene; kontroller hva som faktisk finnes for
neste bygg før planlegging. Se
[datagrunnlaget](../../research/lillebytunet-3d/01-datainnhenting.md).

### La kontrollen kunne avvise resultatet

En modell med feil taklinje går tilbake til geometriarbeidet. Doble rekkverk i en
fasadetekstur går tilbake til kildevalg eller overflatebehandling. Vellykket eksport,
HTTP 200 og «Model3DElement lagt til» er hver for seg begrensede observasjoner.
Opptaksskriptet skiller disse fra det lagrede skjermbildet
(`scripts/lillebytunet/capture-quality.mjs:49`). Bildet må fortsatt vurderes.

Før/etter krever lik modellposisjon, orientering, skala, viewport og avlest kamera.
Originalrender mot Google skal merkes med kamera-/FOV-avvik når de ikke er kalibrert;
`model_overlay.py` har ikke det avviket og er derfor det sterkere beviset.
Kontroller faktisk kamerabevegelse: et sett knapper beviser ikke at fri rotasjon virker.

Registreringsrest måler samsvarende trekk. Den beviser ikke at alle skjulte vinduer,
terrassehøyder eller veggtykkelser er riktige. For hver bearbeidet flate skal neste
agent kunne forklare hva bildet viser direkte, hva som er gjentatt, hva som er estimert,
og hva som er utelatt. Hvis kildene ikke dekker et krav, dokumenteres den konkrete flaten,
forsøkene og hvilket bedre underlag som trengs. Kravet skal ikke forsvinne fra rapporten.

Bruk materialer som målrendererens dokumentasjon støtter. Googles modellstøtte beskriver
glTF-kjernens PBR-felter og ingen utvidelser; kontroller dokumentasjonen ved senere
versjonsendringer. [Google: Models](https://developers.google.com/maps/documentation/javascript/3d/models).
Hus Bs sammenligning av emissive, PBR og hybrid er et utgangspunkt for ny kontroll,
ikke en generell fasit for lyssetting eller grunnlag for å legge til `KHR_materials_unlit`.

## Hvorfor dette hjelper

Feil geometri flytter problemet over i teksturene. Da kan mer oppløsning eller utfylling
gjøre en feil antakelse mer detaljert, mens silhuetten fortsatt er feil. Hus Bs forkastede
forsøk med doble rekkverk og striper illustrerer dette i kvalitetsrapporten.

Agenten trenger derfor en tydelig mulighet til å forkaste sin første tolkning.
En egen sluttvurdering bør ta utgangspunkt i kilde- og Google-bildene og undersøke hva
som er feil, uten å bruke tidligere ros av modellen som bevis. En lesende review-agent
kan kontrollere kildehenvisninger og dekning; visuelle vurderinger krever at den faktisk
ser bildene. En tekstreview av rapporten er ikke en uavhengig visuell godkjenning.

## Når metoden skal brukes

Bruk den ved neste Lillebytunet-bygg og når modellarbeid overføres til en ny agent.
Start med **ett nytt bygg**, valgt etter de tre målingene over.

Opus med høyt effort-nivå gjennomførte Hus C-piloten. Vi har ikke testet andre
kombinasjoner. Registrer faktisk modell og effort-innstilling når verktøyet oppgir dem.
Piloten er bestått når kontrollpunktene er oppfylt og avvik er ærlig beskrevet.
Modellnavnet og brukt tenketid er ikke egne akseptansekriterier.

**Kildemappen finnes ikke akkurat nå.** `~/klienter/placy/lillebytunet` ble slettet
2026-09-09; se [gjenoppbyggingsplanen](../../research/lillebytunet-3d/06-gjenoppbygging.md).
Steg 1–3 der må kjøres før noe av dette er mulig.

Agenten må ha tilgang til kildemappen, verktøyene i kjøreoppskriften, bildevurdering
og en fungerende Google-demo i nettleseren. Manglende verktøytilgang må løses eller
rapporteres som uavklart kontroll. Dokumentasjon kan ikke erstatte denne tilgangen.

Et godt resultat gir grunnlag for flere bygg. Fordel deretter eventuelt ett bygg per agent
med egne worktrees og utmapper. Endringer i felles eksport-/kamerakode skal ha én eier;
andre agenter skal ikke samtidig redigere samme filer. Bygningsformer og kildedekning kan
kreve ulike løsninger selv om kontrollkravene er felles.

## Fortsatt åpent

Ting piloten identifiserte men ikke løste. De koster en omkjøring hver om de ikke tas:

- **Retningsforskyvningen har ikke noe skript.** Den ble målt ad hoc med SIFT mot alle 96
  oversiktsbilder. Bør bli en kommando som skriver `--pairs`-strengen.
- **`compare_quality.py` er Hus B-låst** — 11 visnings-ID-er, kildebilder fra
  `renders/bygg-b` og teksten «heading115» — så kontrollpunkt 6s før/etter-ark kan ikke
  lages for et annet bygg. Hus C brukte kilde/modell/Google side om side i stedet.
- **Riggens avstand og siktehøyde er Hus Bs**, så render-visningene beskjærer et høyere
  bygg. Nullpunktet er parameterisert, avstanden ikke.
- **Terrenghøyden er målt ett sted.** `HUS_B_GROUND_MASL = 16.2` brukes for alle bygg;
  Kartverket gir 16,53 m ved Hus B og 16,9 m ved Hus C.
- **Mobilkontrollen fra Hus B-runden er ikke et kontrollpunkt** og forsvant i overføringen.
- **Variant-cache-feilen i innhentingsskriptet** er henvist til som kjent, men ikke
  beskrevet noe sted.

## Oppdrag som kan gis til neste agent

Fyll inn bygg, kildemappe og utmappe før oppdraget gis. Henvis til denne filen med dens
faktiske sti, slik at en ny samtale finner arbeidskravene.

> Gjennomfør modellering av det valgte bygget fra de angitte arkitekturrenderne til
> Google Maps 3D. Lever GLB, redigerbar modellkilde og en reproduserbar kjede i byggets
> egen utmappe. Les CLAUDE.md, denne læringen, Hus C-pilotens rapport (kjøreoppskriften
> og kontrollverktøyene) og Hus Bs kvalitetsrapport.
>
> Utled byggets geometri, kameraer, skala og plassering fra egne kilder. Mål etasjehøyden
> før du fester veggplanene, og regn ut okklusjonsbudsjettet før du sampler teksturer.
> Kopiér `hus_c_quality.json` som utgangspunkt, ikke Hus Bs — en manglende nøkkel gir
> stille Hus B-verdier. Bevar tidligere bygg og eksisterende originaldata, og bygg forrige
> bygg om til byte-identisk GLB hvis du endrer delt kode.
>
> Utfør kontrollpunktene og lagre bevis i repoet underveis. Rett feil silhuett, doble
> avbildede utstikk, synlige hull og teksturstrekk før du går videre. Dokumenter skjulte,
> gjentatte, estimerte og utelatte flater med hvilken estimator som er brukt. Kontroller
> hele modellen i faktisk Google med faste kameraer og kontinuerlig rotasjon. Visuelle
> vurderinger skal bygge på bildene, ikke bare eksport- eller testresultater.
>
> Kjør kjeden i en ny tom utmappe og oppgi hvilke steg gjenbyggingen dekker. Lever
> parametere, kilde-/flateoversikt, kontrollbilder, målinger, restavvik og kjøreoppskrift.
> Gjennomfør en egen sluttvurdering av alle krav mot kilder og Google-bilder. Følg
> prosjektets mekaniske sjekker og loggregler. Commit lokalt; ikke push uten forespørsel.
> Kontroller som ikke kunne gjennomføres skal oppgis som uavklarte.

## Relatert

- [Hus C: pilot, kjøreoppskrift, nye kontrollverktøy og restavvik](../../research/lillebytunet-3d/05-hus-c.md).
- [Flere bygg i samme kart: naboforholdet som eget kontrollpunkt](../../research/lillebytunet-3d/07-flere-bygg-i-kartet.md).
- [Hus B: kildevalg, kommandokjede, før/etter og begrensninger](../../research/lillebytunet-3d/04-kvalitetsrunde.md).
- [Plandokument til kartdata: uavhengige holdepunkter og transformrest](../data-import/plandokument-til-kartdata-20260907.md).
- [Google-kamera: eierskap og faktisk bevegelse](../feature-implementations/google-maps-3d-intro-flythrough-20260603.md).
