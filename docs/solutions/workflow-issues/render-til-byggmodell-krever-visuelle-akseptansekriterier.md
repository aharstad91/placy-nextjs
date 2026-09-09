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
---

# Fra arkitekturrender til byggmodell

## Bakgrunn

Hus B-kvalitetsrunden viste hvordan en fungerende, men visuelt svak modell kunne
forbedres gjennom systematisk kildegransking og gjentatte kontroller i Google.
Den første tolkningen hadde ett takinntrekk; kildene viste to. Plane balkongbilder
måtte erstattes med faktisk geometri. Disse feilene kunne ikke avgjøres av eksport,
typekontroll eller trekanttall.

[Hus Bs kvalitetsrapport](../../research/lillebytunet-3d/04-kvalitetsrunde.md) er
det gjennomførte eksemplet med kommandoer, bilder og målinger. Denne læringen beskriver
arbeidskravene når metoden overføres til neste bygg. Uten dem kan en ny agent gjenbruke
kode som virker, men samtidig arve feil mål, kameraretninger og stoppkriterier.

## Arbeidsmåte

### Avklar hva som kan gjenbrukes

Hus B-kjeden er byggspesifikk. **En ny JSON-fil er ikke tilstrekkelig for Hus A, C eller D.**
Lag egne kilde-/utmapper og parametere for piloten, og kartlegg tilpasningene før bygging.
Bevar Hus B som regresjonsgrunnlag når felles funksjoner endres.

| Del | Gjenbruk | Må undersøkes eller tilpasses per bygg |
|---|---|---|
| Kameralesing og projeksjon | `source_geometry.py` | PINHOLE, tre innledende sifre i bildenavn, egne kameraer og `frame.npy`/`rect.npy`. Kilde: `scripts/lillebytunet/model/source_geometry.py:16`. |
| Registrering mellom serier | SIFT, triangulerte trekk, likhetstransform, utelatte kamerapar | `colmap-b`, kamerapar, skala og terskler er byggspesifikke. Kilde: `scripts/lillebytunet/model/register_sources.py:31`. |
| Geometri og teksturering | Flater, bokser, projeksjon og materialeksport | Fotavtrykk, etasjer, inntrekk, balkonger og vinduer. Materialutsnitt, reparasjonsstripe, endevinduer, pergolaer og takoppbygg ligger delvis i Python. Kilde: `scripts/lillebytunet/model/build_quality.py:100`. |
| GLB og redigerbar kilde | `glb_mesh.py`, binærkontroll og Blender-import | Kontrollens målgrenser og output-navn er Hus B-spesifikke; akser og bakkenivå må fortsatt verifiseres. Kilder: `scripts/lillebytunet/model/check_glb.py:55`, `scripts/lillebytunet/model/blender_quality.py:21`. |
| Google-bilder og rotasjon | Faktisk kamera, HTTP-hash, stillbilder, kontinuerlig omløp og reset | Plassering, heading, siktepunkt, avstand og resetverdier. Kilder: `scripts/lillebytunet/capture-quality.mjs:33`, `lib/map/lillebytunet-render-rig.ts:21`. |
| Før/etter-ark | Likhetskontroll av kamera og plassering | Sammenligneren forventer Hus B-kilder og bestemte visnings-ID-er. Kilde: `scripts/lillebytunet/model/compare_quality.py:14`. |

Hus A har tidligere vært beskrevet som L-formet i punktskyen, mens D er beskrevet som
høyere enn B i [prototype-rapporten](../../research/lillebytunet-3d/03-modellering.md).
Dette er forhold neste agent må undersøke i bildene, ikke ferdige parametere.
En rektangulær volumbygger skal ikke tvinges over et L-formet fotavtrykk.

### Gjennomfør sju kontrollpunkter

Kontrollpunktene er agentens egne arbeidskrav. De krever lagret bevis og en begrunnet
vurdering før neste steg; de er ikke nye tillatelsesspørsmål til brukeren.

| Steg | Arbeid | Bevis før neste steg |
|---|---|---|
| 1. Kilder og førtilstand | Tell og gjennomgå hele bygningsserien og relevant oversikt. Lag inventar over tak, inntrekk, utstikk og skjulte felt. Bevar eventuell eksisterende modell. | Kontaktark, fullstendig dekningsoversikt, kildehenvisninger og hash av førmodellen. Mangler førmodell, merkes første volum som ny baseline. |
| 2. Koordinater og volum | Beregn egne kameraer, lokal ramme, skala og plassering. Registrer separate bildeserier. Bygg enkel geometri før detaljteksturer. | Transformrest og kontroll på utelatte kameraer. Silhuett, etasjeantall og alle inntrekk sammenholdt med kilder fra flere sider. |
| 3. Tak og terrasser | Skill tak/dekker fra parapeter, oppbygg, rekkverk og tomrom. | Faktiske Google-bilder som viser hvert nivå og inntrekk. Rett silhuettavvik før teksturen videreutvikles. |
| 4. Balkonger og utstikk | Bygg dekktykkelse, underside, bakvegg, rekkverk og nødvendige skjermer. | Antall og rytme kontrollert mot kildene; skrå og lave vinkler viser korrekt dybde. Skjulte deler er angitt som anslag. |
| 5. Teksturer og materialer | Velg kamera og utsnitt per flate. Håndter skjulte områder. Sammenlign materialvarianter i Google. | Alle flater/materialer gjennomgått; kilde, gjentakelse og anslag oppgitt. Ingen avbildede balkonger bak ny balkonggeometri. |
| 6. Hele bygget i Google | Kontroller fire sider, mellomvinkel, nærvisning og relevante kilderetninger, samt kontinuerlig rotasjon. | Samme faktiske kamera og modellplassering i før/etter, korrekt filhash, synlig modell og tilstrekkelig vinkeldekning. Tabell over funn per visning. |
| 7. Gjenbygging og sluttkontroll | Kjør kjeden i en tom utmappe fra de bevarte inputene. Gjennomfør en egen avsluttende vurdering av krav mot bilder. | Fungerende GLB og redigerbar kilde, kjøreoppskrift, målinger, bildebevis og konkrete restavvik. Mekaniske prosjektsjekker ved kodeendringer. |

For Lillebytunet finnes allerede seks bildeserier. Ikke last ned på nytt for å kompensere
for at et eksisterende bilde ikke er undersøkt. Hus B og oversikten har kamera­rekonstruksjoner
fra den dokumenterte runden; kontroller hva som faktisk finnes for neste bygg før planlegging.
Se [datagrunnlaget](../../research/lillebytunet-3d/01-datainnhenting.md).

### La kontrollen kunne avvise resultatet

En modell med feil taklinje går tilbake til geometriarbeidet. Doble rekkverk i en
fasadetekstur går tilbake til kildevalg eller overflatebehandling. Vellykket eksport,
HTTP 200 og «Model3DElement lagt til» er hver for seg begrensede observasjoner.
Opptaksskriptet skiller disse fra det lagrede skjermbildet
(`scripts/lillebytunet/capture-quality.mjs:49`). Bildet må fortsatt vurderes.

Før/etter krever lik modellposisjon, orientering, skala, viewport og avlest kamera.
Originalrender mot Google skal merkes med kamera-/FOV-avvik når de ikke er kalibrert.
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
Start med **ett nytt bygg som pilot**. Velg bygget etter en kort kildevurdering av form
og tildekking; ikke anta at neste bokstav er det enkleste bygget.

Opus med et høyt effort-nivå er et rimelig valg å prøve med dette oppdraget. Vi har
ikke testet den kombinasjonen på resten av byggene. Registrer faktisk modell og
effort-innstilling når verktøyet oppgir dem; navn og tilgjengelige nivåer kan variere
mellom miljøer. Piloten er bestått når sju kontrollpunkter er oppfylt og avvik er ærlig
beskrevet. Modellnavnet og brukt tenketid er ikke egne akseptansekriterier.

Agenten må ha tilgang til kildemappen, verktøyene i kjøreoppskriften, bildevurdering
og en fungerende Google-demo i nettleseren. Manglende verktøytilgang må løses eller
rapporteres som uavklart kontroll. Dokumentasjon kan ikke erstatte denne tilgangen.

Et godt pilotresultat gir grunnlag for flere bygg. Fordel deretter eventuelt ett bygg
per agent med egne worktrees og utmapper. Endringer i felles eksport-/kamerakode skal
ha én eier; andre agenter skal ikke samtidig redigere samme filer. Bygningsformer og
kildedekning kan kreve ulike løsninger selv om kontrollkravene er felles.

## Oppdrag som kan gis til neste agent

Fyll inn bygg, kildemappe og utmappe før oppdraget gis. Henvis til denne filen med dens
faktiske sti, slik at en ny samtale finner arbeidskravene.

> Gjennomfør modellering av det valgte bygget fra de angitte arkitekturrenderne til
> Google Maps 3D. Lever GLB, redigerbar modellkilde og en reproduserbar kjede i byggets
> egen utmappe. Les CLAUDE.md, denne læringen og Hus Bs kvalitetsrapport.
>
> Utled byggets geometri, kameraer, skala og plassering fra egne kilder. Kartlegg og
> tilpass alle Hus B-spesifikke forutsetninger i skriptene. Bevar Hus B og eksisterende
> originaldata. Gjennomgå alle relevante kildevinkler og rapporter faktisk dekning.
>
> Utfør de sju kontrollpunktene og lagre bevis underveis. Rett feil silhuett, doble
> avbildede utstikk, synlige hull og teksturstrekk før du går videre. Dokumenter skjulte,
> gjentatte, estimerte og utelatte flater. Kontroller hele modellen i faktisk Google
> med faste kameraer og kontinuerlig rotasjon. Visuelle vurderinger skal bygge på
> bildene, ikke bare eksport- eller testresultater.
>
> Kjør kjeden i en ny tom utmappe. Lever parametere, kilde-/flateoversikt, kontrollbilder,
> målinger, restavvik og kjøreoppskrift. Gjennomfør en egen sluttvurdering av alle krav
> mot kilder og Google-bilder. Følg prosjektets mekaniske sjekker og loggregler.
> Commit lokalt; ikke push uten forespørsel. Kontroller som ikke kunne gjennomføres
> skal oppgis som uavklarte.

## Relatert

- [Hus B: kildevalg, kommandokjede, før/etter og begrensninger](../../research/lillebytunet-3d/04-kvalitetsrunde.md).
- [Plandokument til kartdata: uavhengige holdepunkter og transformrest](../data-import/plandokument-til-kartdata-20260907.md).
- [Google-kamera: eierskap og faktisk bevegelse](../feature-implementations/google-maps-3d-intro-flythrough-20260603.md).
