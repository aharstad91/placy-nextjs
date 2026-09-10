---
title: "Lillebytunet Hus B — bedre modellkvalitet og overlevering etter omstart"
type: feat
status: completed
date: 2026-09-09
---

# Lillebytunet Hus B — kvalitetsrunde og sesjonsoverlevering

**Gjennomført 2026-09-09.** `husB-v2.glb` er eksportert, gjenbygd byte-identisk og
kontrollert i faktisk Google Maps 3D. Alle seks gjennomføringssteg er utført.
Se [resultat, før/etter og gjenværende kildebegrensninger](../research/lillebytunet-3d/04-kvalitetsrunde.md).
Beskrivelsen av starttilstand og omstart nedenfor er bevart som historikk.

## Oppdraget og beslutningen

Forbedre utseendet på Hus B i den eksisterende Google Maps 3D-demoen. Vi skal lære hvor
langt arkitekturrenders kan ta oss med kontrollerbar geometri og bildebaserte teksturer.
Resultatet skal være en faktisk 3D-modell som tåler vilkårlige kameravinkler.

Andreas er enig i at utseendet må forbedres før vi går videre til flere bygg. Anbefalt
reasoning effort for gjennomføringen er **Extra High / xhigh**; dette er en vurdering for
denne oppgaven, ikke en garanti for visuell kvalitet. Bildesammenligninger styrer valgene.

**Status ved overlevering:** Den første prototypen er bygd. Denne sesjonen har gjennomgått
kode, modell og eksisterende kontrollbilder og skrevet denne planen. Ingen forbedringer
av modellen eller demo-koden er implementert i denne sesjonen. Ingen ny interaktiv
nettleserverifisering er utført; tidligere kartbilder er vurdert. Gjennomføringsstegene
nedenfor står åpne.

Compound-pluginen er installert av Andreas, men krever omstart før den blir tilgjengelig.
Planen er skrevet uten å kjøre Compound. Etter omstart: les tilgjengelige skills og bruk
relevant plan-/gjennomføringsflyt på dette dokumentet. Følg Placy-reglene i `CLAUDE.md`,
inkludert «Scope is Sacred». Bevar avtalt scope når planen gjennomgås.

## Startpunkt etter omstart

| Hva | Hvor / status |
|---|---|
| Hovedrepo | `/Users/andreasharstad/Documents/placy`, branch `main` |
| Arbeidsmappe | `/Users/andreasharstad/Documents/placy-lillebytunet` |
| Arbeidsbranch | `feat/lillebytunet-3d-model` |
| Eksisterende prototype | Commit `94ccf12`, én commit foran main ved kontroll før denne planen ble lagret; ikke pushet |
| Arbeidsstatus | Worktreen var ren før planen. Hovedrepoet har andre, urelaterte lokale endringer. Kontroller status på nytt. |
| Lokal demo | Port `3002`, startet fra worktreen ifølge tidligere sesjon; kontroller at prosessen fortsatt kjører |
| Rådata og modellkilde | `/Users/andreasharstad/klienter/placy/lillebytunet/` |
| Denne planen | `docs/plans/2026-09-09-feat-lillebytunet-hus-b-kvalitet-plan.md` i worktreen |

Bruk worktreen videre. Ikke flytt modellarbeidet til main, og ikke endre andre sesjoners
filer. **Commit lokalt, ikke push.** I sesjonen som skrev planen lå worktreen og
klientmappen utenfor sandboxens writable roots; skriving der krevde eskalering. Åpne
gjerne neste sesjon direkte i worktreen. Kontroller tilganger til klientmappen også.

Brukerens visning:

```text
http://localhost:3002/demo/lillebytunet-3d?model=/models/lillebytunet/husB.glb&heading=115&v=3
```

Koden bruker `heading=110` som standard; brukerens URL overstyrer til `115`. Hold
orientering, posisjon, skala og kamera identisk ved før/etter-test. Ikke tolk fem graders
forskjell som en modellforbedring. `v=3` leses ikke av demoen og endrer ikke GLB-URL-en;
bruk egne GLB-filnavn når varianter sammenlignes.

Les først:

1. `AGENTS.md`, `CLAUDE.md` og siste Lillebytunet-oppføring i `PROJECT-LOG.md` (2026-09-08).
2. `docs/research/lillebytunet-3d/01-datainnhenting.md`.
3. `docs/research/lillebytunet-3d/02-kartintegrasjon.md`.
4. `docs/research/lillebytunet-3d/03-modellering.md`, med forbeholdene i denne planen.
5. Eksisterende `compare/`, `screens/` og `model-check/` under samme research-mappe.

## Hva vi har, og hva gjennomgangen faktisk viste

**Datagrunnlaget er godt.** Seks serier: oversikt, Hus A, Hus B, Hus C, Hus D og rekkehus.
Hver har 96 bilder: totalt **576 originale WebP-filer, 1920 × 1080**. Review-agenten
kontrollerte at alle 576 lokale filer finnes og samsvarer med manifestets filstørrelser
og SHA-256; alle er unike. Ny full nedlasting er ikke nødvendig.

Hus B og oversikten har separate COLMAP-løsninger. Dokumentasjonen rapporterer 96/96
registrerte kameraer for begge og reprojeksjonsfeil rundt 0,4–0,45 px. Kameraene er
beregnet fra bildene; API-et leverte ikke ferdige kameraposisjoner eller metrisk skala.

**Kartintegrasjonen virker i den tidligere leveransen.** GLB-en er 1 145 312 byte med
11 materialer, 11 teksturer, **22 trekanter** og ingen deklarerte glTF-utvidelser. Modellen
består i praksis av hovedvolum og inntrukket toppetasje med bilder på plane flater.

**Den visuelle begrensningen er først og fremst geometri og projeksjon.**

- Taket har strukne detaljer fordi bildet er tatt lavt, og objekter med ulik høyde
  projiseres på én takflate. Mer teksturoppløsning alene løser ikke dette.
- Balkongfasaden er ett plan ved balkongfronten. Dekk, bakvegg, skillevegger og rekkverk
  mangler romlig dybde; perspektivet bryter sammen fra skrå vinkler og på nært hold.
- Terrasser, gesimser og takkanter mangler viktige volumer og avgrensninger.
- Naboelementer og slagskygger er bakt inn i enkelte fasader.
- Alle materialer er selvlysende. Dette unngikk svarte flater i tidligere karttest, men
  gir flat lysrespons og kan gjøre at modellen ser løsrevet fra omgivelsene ut.

Gjennomgangen omfattet brukerens skjermbilde, kontaktark for Hus B, Blender-kontrollark og
**alle fem** eksisterende sammenligningsark: `compare-dir-000.jpg`, `024`, `036`, `048` og
`072`. Eksisterende rapport er for positiv om korrekt silhuett og fravær av strekk; dette
må presiseres når den nye modellen dokumenteres. Sammenligningsarkene har ulik bildeskala
og synsfelt mellom originalrender og Google og er ikke pikselpresise referanser.

## Krav og avgrensning

| Krav | Hva som skal leveres |
|---|---|
| R1 | Tak, terrasser og toppetasje har kildebasert silhuett og lesbare, riktig projiserte flater. |
| R2 | Balkongsonen har faktisk dybde og virker fra skrå vinkler og nærvisning. |
| R3 | Fasader og materialer har færre synlige projeksjonsfeil, naboelementer og lyssømmer. |
| R4 | En vanlig GLB fungerer i vår faktiske Google Maps 3D-visning, med dokumentert størrelse og lasting. |
| R5 | Før/etter-bilder fra faste kameraer viser forbedringen, og resterende avvik er eksplisitte. |
| R6 | Redigerbar kilde, teksturer, parametre og eksportkommandoer gjør leveransen reproduserbar. |

Hybridmetoden videreføres: eksisterende kameraer og punktsky som underlag, modellerte
flater og volumer, deretter teksturprojeksjon. Full tett fotogrammetri er ikke en
forutsetning. Vi trenger ikke interiør eller BIM-presisjon. Ikke bruk genererte detaljer
som dokumentasjon på hvordan bygget faktisk ser ut. Supplerte flater merkes som anslått.

### Deferred to Separate Tasks

- Rekonstruksjon av Hus A, C, D og rekkehus: tas opp etter evalueringen av denne Hus B-runden.
- Generalisering til andre prosjekter og boligvelgere: vurderes ut fra dokumentert manuelt
  arbeid på Hus B. Denne runden skal gi læringsgrunnlaget.
- Endelig FKB-/oppmålingskontroll av plassering: tas når egnet underlag finnes. Nåværende
  estimerte plassering beholdes som utgangspunkt for kvalitetssammenligningen.

## Gjennomføring — seks avhengige faser

### 1. Sikre utgangspunkt og en rettferdig visuell test — R4, R5, R6

- Kontroller branch, arbeidsstatus, lokale rådata, verktøyversjoner og dev-server.
- Bevar GLB og modellkilde fra `94ccf12` som navngitt lokal før-versjon før overskriving.
  Arkiver også parametre og materialinnstillinger. Originalbildene forblir uendret.
- Etabler faste Google-kameraer: fire godt fordelte retninger, en mellomvinkel og en
  nærvisning av balkonger/takterrasse. Ta nye før-bilder og registrer viewport, kamera,
  modell-heading, skala, høydeplassering og GLB-filnavn.
- Bruk gjerne eksisterende render-rigg for retningene 0, 24, 36, 48 og 72. Ved sammenligning
  med originalrender: match kameraretning og byggets bildestørrelse så godt som mulig,
  og noter resterende FOV-avvik. Før/etter i Google skal bruke nøyaktig samme kamera.
- Gi forbedret eksport et eget filnavn, for eksempel `husB-v2.glb`, for entydig testing.

**Kontrollpunkt:** Den gamle modellen kan åpnes igjen, og samme kameratest kan gjentas.

### 2. Bygg tak, terrasser og toppetasje ordentlig — R1, R5, R6

- Studer alle Hus B-vinklene og oversiktsserien for takkanter, gesimser, rekkverk,
  inntrekk og synlige oppbygg. Registrer kildebilder og sikkerhet for hver detalj.
- Modeller separate høydenivåer og viktige vertikale flater. Lukk relevante undersider
  og unngå hull og overlappende flater. Ikke projiser en oppstikkende vegg på takplanet.
- Prøv oversiktsbilder som takteksturkilde. De to COLMAP-modellene har ulike koordinatrammer
  og skalaer: registrer dem med felles 3D-punkter/bygningshjørner og kontroller reprojeksjon
  i flere bilder før oversiktskameraene brukes på Hus B-geometrien.
- Hvis registreringen blir ustabil: tilpass utvalgte oversiktskameraer fra kjente linjer
  og hjørner. Dokumenter metoden og avvikene. Bruk nøkterne, dokumenterte materialflater
  der ingen ren bildekilde finnes.
- Eksporter og se denne delendringen i Google før balkongarbeidet starter.

**Kontrollpunkt:** Taket har tydelige kanter og terrassen riktig dybde fra både luftvinkel
og mellomvinkel; den brede smøringen i dagens skjermbilde er fjernet eller vesentlig redusert.

### 3. Gi balkongfasaden fysisk dybde — R2, R5, R6

- Skill mellom bygningsvegg og balkongfront. Dagens fotavtrykk inkluderer balkongsonen;
  flytt bakveggen inn i denne sonen, og etabler dybde fra flere kildebilder/punktskyen.
- Modeller balkongdekker med tykkelse, bakvegg, viktige skillevegger, stolper og rekkverk
  som påvirker silhuett og avdekking. Velg detaljnivå etter de faktiske testavstandene.
- Projiser teksturer på riktig flate og høyde. Bakveggen skal ikke beholde et ekstra
  bilde av balkongfronten når rekkverket allerede finnes som geometri.
- Velg bilder separat for bakvegg, underside, skillevegg og front. Dokumenter gjentatte
  eller supplerte skjulte flater. Test rekkverksmaterialer i Google før de brukes overalt.
- Gjenta mellomvinkel og nærvisning underveis; synlig parallakse skal stemme med byggets
  form, og nye flater skal ikke avsløre hull eller teksturer fra nabobygg.

**Kontrollpunkt:** Balkonger leses som romlige deler av bygget også uten å stå i teksturkameraet.

### 4. Rydd teksturer og velg materialgjengivelse — R3, R4, R5

- Vurder samtlige modellflater. Bruk kameravinkel, effektiv kildeoppløsning og synlighet
  til å velge bilder; masker naboer, vegetasjon og detaljer som ligger foran flaten.
- Bruk flere kilder der én ikke dekker en ren fasade. Dokumenter kilde og maske per flate.
  Fjern tydelige lyssømmer uten å viske ut vinduer og fasaderytme.
- Sammenlign dagens emissive-materialer, vanlig PBR og forsiktig emissive-bidrag til PBR
  på representative flater i Google. Velg etter både lesbarhet og samspill med kartet.
- Etterprøv årsaken til tidligere svarte kortsider. «Ingen ambient i Google» er en
  forklaring fra tidligere arbeid, ikke noe denne review-sesjonen har verifisert.
- Tilpass teksturstørrelse til faktisk kildedetalj. Mål filstørrelse og lasting; ikke
  oppskaler en dårlig projeksjon og kall den skarpere.

**Kontrollpunkt:** Ingen dominerende naboelementer eller strukne detaljer på synlige
hovedflater; dagslysvisningen har lesbare fasader uten at materialene virker selvlysende.

### 5. Gjør bygging og eksport reproduserbar — R4, R6

- Samle dimensjoner, koordinattransformasjoner, kildekameraer og materialvalg i tydelige
  parametre. Skill beregnet, manuelt tilpasset og anslått underlag.
- Gi eksport- og kontrollskript eksplisitte inn-/utstier. I dag bruker `export_glb.py`
  skriptets egen mappe for `husB.obj`; å bare bytte arbeidsmappe er ikke nok, selv om
  dokumentasjonen antyder det. Avklar tilsvarende avhengigheter i øvrige berørte skript.
- Dokumenter én komplett kjede: eksisterende kameraer → geometri/teksturer → Blender/GLB
  → materialbehandling → publisering til lokal `public/` → visuell kontroll.
- Eksporter grunnleggende glTF PBR uten Draco eller andre påkrevde utvidelser; kontroller
  gjeldende Google-dokumentasjon ved implementering. Ikke fjern utvidelser blindt dersom
  eksportens utseende avhenger av dem. Verifiser normaler, akser, skala og bunnpunkt.
- Bevar den empirisk fungerende aksetilpasningen med kontroll i Google. Opprett oppdatert
  `.blend` og teksturkilder lokalt utenfor git; skript og relevant dokumentasjon i git.
- Dersom demoens lastestatus berøres: skill mellom «element lagt til» og faktisk bekreftet
  lasting. Dagens status beviser bare at Model3DElement er lagt til i kartet.

**Kontrollpunkt:** Kjør hele den dokumenterte eksportkjeden i en ny arbeids-/utmappe med
eksisterende rådata. Den skal gi en fungerende modell uten udokumentert kopiering.

### 6. Verifiser hele bygget og lever læringen — R1–R6

- Kontroller alle modellflater gjennom de faste Google-visningene, inkludert fire
  retninger, mellomvinkel, normalt skrått luftperspektiv og nærvisning. Roter kameraet
  kontinuerlig også; forhåndsvalgte stillbilder er ikke tilstrekkelig.
- Lag sammenligninger **originalrender / før / etter** med forklarte kameraavvik. Vis
  både helhet og utsnitt av tak/terrasse og balkonger. Unngå at zoom skjuler regresjoner.
- Før en kontrolltabell per visning: silhuett, dybde, tekstursømmer, strekk, hull,
  feilprojiserte omgivelser, lys, lasting og bevegelse. Beskriv resterende feil konkret.
- Registrer trekanttall, materialer, teksturstørrelser, GLB-størrelse, nettleserfeil og
  observerbar brukbarhet. Flere enn 22 trekanter er forventet; kvalitet styrer detaljnivået.
- Ved kodeendringer: `npm run lint`, `npm test`, `npx tsc --noEmit`. `npm run build` før PR.
  Dokumenter feil og om de fantes før endringen. Mekaniske sjekker erstatter ikke karttesten.
- Oppdater modellrapporten med resultat, faktiske kommandoer, manuelle valg og usikkerhet.
  Følg `CLAUDE.md` for worklog, sjekk `git status`, og commit bare egne endringer lokalt.

**Ferdig:** En forbedret GLB er faktisk åpnet og visuelt kontrollert i Google. Tak og
balkonger er tydelig bedre i de samme kameraene, øvrige sider har ingen vesentlig
regresjon, og en ny agent kan bygge modellen og gjenta kontrollen fra dokumentasjonen.
Hvis kildematerialet hindrer et krav: vis hvilke flater det gjelder, hva som ble forsøkt,
og hva slags bedre underlag som trengs. Ikke kall eksport alene en ferdig leveranse.

## Praktisk arbeidsdeling ved gjennomføring

Hovedagenten eier modellgeometri, teksturprojeksjon, materialvalg og endelig visuell vurdering
(`scripts/lillebytunet/model/` og lokal modellkilde). En avgrenset parallell agent kan eie
Google-demoens kamera-/sammenligningsstøtte og kontrollbilder, med avtalte filer under
`app/demo/lillebytunet-3d/`, `components/map/` og `lib/map/`. Ingen delt filredigering.
Bruk eventuelt en separat lesende review-agent ved sluttkontrollen. Ny datainnhentingsagent
er ikke nødvendig; datasettet er allerede komplett. Ikke paralleliser avhengige modellsteg.

## Tekniske holdepunkter og kjente fallgruver

- Råbilder: `~/klienter/placy/lillebytunet/renders/{oversikt,bygg-a,bygg-b,bygg-c,bygg-d,rekkehus}/`.
  Manifest: `manifest.json` og `manifest.md`; kontaktark: `contact-sheets/`.
- Hus B-kameraer: `colmap-b/sparse/0/`; ramme og fit: `colmap-b/frame.npy`, `rect.npy`.
  Oversikt: `colmap-ov/`. Python-miljø: lokal `.venv/`. Kontroller installert Blender/COLMAP.
- Modellkilde: `~/klienter/placy/lillebytunet/model/husB.blend`, `husB.obj/.mtl` og JPEG-teksturer.
- Modellskript: `scripts/lillebytunet/model/{analyze,fit2,facades,build_model,export_glb,strip_ext,render_check,compare_pairs}.py`.
- Demo: `app/demo/lillebytunet-3d/page.tsx`, `components/map/lillebytunet-model-demo.tsx`,
  `lib/map/lillebytunet-render-rig.ts`. Modeller: `public/models/lillebytunet/`.
- Nåværende fasadekameraer: A− = 54, A+ (balkonger) = 5, B− = 78, B+ = 30. Taket bruker 5.
- Nåværende størrelse ca. 16,1 × 27,7 m inkl. balkonger, totalhøyde 18,6 m. Skala
  12,4 m per COLMAP-enhet; etasjehøyde 3,1 m var opprinnelig anslått og skala senere
  kryssjekket mot oversiktsserien og OSM-nabobygg. Ingen BIM-/oppmålingspresisjon.
- Posisjon 63.441359, 10.440215; standard heading 110°. Rapportert usikkerhet omtrent
  ±1,5 m horisontalt, ±2° retning og ±1 m høyde. Terrenghøyde i render-rigg 16,2 m o.h.
- `direction` er en kildeindeks. Steget er utledet til 3,75°, men nullretningen er ulik
  mellom seriene. Hus B-riggen bruker kamerabearing `222 − 3,75 × direction`; eldre
  tekst sier feilaktig at «0 = sør» gjelder både oversikt og Hus B. Kontroller mot bildene.
- Separat innhentingsfeil funnet ved review: cache i `fetch-scenes.mjs` skiller ikke
  tilstrekkelig mellom `--variant`-valg; en ny variant kan gjenbruke tidligere bildefil
  samtidig som manifestet får ny kilde-URL. Berører eventuell ny variantnedlasting:
  rett/verifiser dette før slik innhenting. Ikke overskriv dagens validerte manifest.
- Eksisterende kilder ved behov: [Skanskas prosjekt](https://bolig.skanska.no/prosjekter/lillebytunet#kart)
  og [direkte boligvelger](https://nb-frontend-bundles-production.newbuilds-assets.com/property-explorer/f16ffe9e-1bb7-451e-b9e3-fb9781d10e8f?company=f0f13804-d3a0-4982-ba7b-8e128360ffa4&lang=no&placement=web&environment=live).

## Oppstartsprompt som kan limes inn etter omstart

> Fortsett Lillebytunet Hus B fra planen i
> `/Users/andreasharstad/Documents/placy-lillebytunet/docs/plans/2026-09-09-feat-lillebytunet-hus-b-kvalitet-plan.md`.
> Les AGENTS.md, CLAUDE.md og de refererte modellrapportene. Bruk den nå tilgjengelige
> Compound-flyten der den passer, og gjennomfør kvalitetsrunden i eksisterende worktree
> på `feat/lillebytunet-3d-model`. Første modellkode ligger i commit `94ccf12`.
> Bevar en før-versjon. Forbedre tak/terrasser, deretter balkongdybde, teksturer og
> materialer, og dokumenter før/etter fra samme kameraer i Google-demoen på port 3002.
> Bildesett og COLMAP-kameraer finnes allerede lokalt. Arbeid til modell og karttest er
> verifisert, følg prosjektets sjekker, og commit lokalt. Ikke push.
