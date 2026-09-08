# Wesselsløkka: felles plangrunnlag for 2D og 3D

Omfang: hele Brøset-områdeplanen. A1, A2 og B — de tre byggene salgsmaterialet
merker i rosa — er håndavtegnet og tegnes som salgsbygg. De 52 øvrige
volumene er trukket ut maskinelt av den store situasjonsplanen og tegnes som
kontekst: nabolaget som reises rundt boligen.

## Grunnlag og innpassing

Brukerens 1600 × 1000 situasjonsplan med Wesselsløkka-logo og rosa A1/A2/B
er kilde for avtegningen. Den større Brøset-planen viser et annet utsnitt og
brukes som kontekst; pikselkoordinater fra de to planene blandes ikke.

Tre visuelt avleste holdepunkter gir én affin transformasjon:

| Holdepunkt | Piksel x/y i planen | Lengdegrad / breddegrad |
| --- | --- | --- |
| Brøsetvegen / Sigurd Munns veg | 111 / 768 | 10.4496894971 / 63.4218342068 |
| Brøsetvegen ved nordspissen av feltet | 858 / 54 | 10.4567706734 / 63.4244368447 |
| Rundkjøring Tungasletta | 1350 / 770 | 10.4607323086 / 63.4215660552 |

Kartgrunnlag: Mapbox satellite-streets-v12, nord opp, senter 10.455 / 63.4229,
zoom 15.5, 1200 × 1000 logiske piksler. Holdepunktene ble avlest ved
henholdsvis (250, 657), (716.7, 273.6), (977.8, 696.5).

## Stadfesting mot uavhengige kilder (2026-09-07)

Innpassingen var i utgangspunktet kontrollert mot samme satellittbilde som den
ble avlest fra, altså mot seg selv. Den er nå kontrollert mot to kilder som
ikke er bildet:

1. **Brøsetjordet.** Planens søndre kollektivgate faller sammen med veien slik
   OpenStreetMap tegner den (way 1502590316). Tre punkter langs den ligger
   4–11 m fra OSMs senterlinje. Det er innenfor det en bildeinnpassing kan
   love, og det binder både skala og rotasjon.
2. **OSMs egen plassholder for prosjektet** (way 1502590318,
   `building=construction` + `construction=apartments`, merket
   «very approximate position / size»). A1/A2/B lander oppå den, ~10 m fra
   dens tyngdepunkt. En helt annen kartlegger har altså plassert prosjektet
   samme sted.

Begge er kodet som `WESSELSLOKKA_REGISTRATION_CHECKS` og testet. De inngår
ikke i tilpasningen, så de faller hvis noen flytter et holdepunkt.

**Adressepunktet er ikke fasit.** Prosjektets registrerte senter
(10.450617 / 63.422074) ligger på Brøsetvegen, ~100 m nordvest for byggene.
At volumene tegnes et stykke fra pinnen er riktig, ikke en feil: pinnen er
adressen, byggene står inne på jordet. Rosa logo-pin i situasjonsplanen er
dekor i logobåndet og har ingen posisjonsbetydning.

Dette er fortsatt bildebasert innpassing, ikke en oppmåling. Nordspissen er et
svakere holdepunkt enn veikrysset og rundkjøringen. Antall desimaler bevarer
beregningen, men sier ikke noe om nøyaktigheten. Høydene står på anslåtte
14 meter.

## Kollektivgata er tatt ut

Den avtegnede veien lå innenfor ~10 m av Brøsetjordet, altså oppå en vei
begge kartmotorene allerede tegner selv. Resultatet var en dobbel vei: et
beige belte forskjøvet fra den ekte streken. Veipolygonet er slettet fra både
data og de to lagene. Planens «Kollektivgata» er i praksis en oppgradering av
Brøsetjordet, og den forteller ikke leseren noe nytt.

## Hele områdeplanen (2026-09-07, andre runde)

Kilden er `docs/kilder/wesselslokka/broset-situasjonsplan.png` — samme tegning
som den registrerte planen, i et større utsnitt og uten logobånd.

Den registreres mot den stadfestede planen med SIFT + RANSAC:
1 024 av 1 779 treff, skala 0,8832, rotasjon 0,021°, median avvik 0,56 px.
Dermed arves hele innpassingen over — vi lager ingen ny som måtte stadfestes
på nytt. Skriptet stopper hvis registreringen blir svakere enn 200 treff eller
1,5 px median.

Byggene er hvite flater med tynn mørk kontur. Problemet er at gangstiene og
bekkedraget også er hvite. De skilles i to trinn:

1. **Avstandstransformasjon.** Bare flater med en innskrevet sirkel på ≥ 3,4 px
   får en kjerne, og kjernene vokses ut igjen i den hvite masken (morfologisk
   rekonstruksjon). Stiene er for smale til å ha kjerner og forsvinner helt.
2. **Formtest.** Det som blir igjen og fyller under 40 % av sitt omskrevne
   rektangel uten å ha mørk kontur rundt seg, er buet og langt — altså sti.
   Unntaket for mørk kontur er det som redder L- og T-formene i sentrum.

Rekkehusrekkene er tegnet med delestreker mellom hver enhet. En lukking på
5 px binder dem til ett volum. Det er riktig kartografi her: åtte enheter à
5 meter sier ingenting mer på et kart i denne målestokken enn én rekke gjør.

Resultatet er 52 volumer. Omrissene forenkles til ~1,6 m (median fire hjørner)
og lagres som heltalls-piksler i den registrerte planens koordinatrom, ikke som
grader — så er det ett sted registreringen bor.

**Kontrollen:** i satellittvisning ligger alle 52 innenfor Brøset-jordet, mellom
Brøsetvegen i nordvest og Tungasletta i sørøst, uten å treffe et eneste
eksisterende hus. Det er en sjekk over hele kilometeren, ikke bare i hjørnet
der holdepunktene ligger.

A1/A2/B kastes ut av uttrekket ved at et volum med tyngdepunkt nærmere enn
26 px fra et av salgsbyggene hoppes over. En test holder de to settene fra
hverandre: ingen kontekstvolum har tyngdepunkt nærmere enn 10 m fra et
salgsbygg. Dubletter er usynlige i 2D og doble vegger i 3D.

Skriptet er `scripts/extract-broset-massing.py` og kjøres bare når det kommer
en ny plantegning. Det krever `opencv-python-headless`.

## Etasjetall (2026-09-07, tredje runde)

Volumene sto først på anslåtte 12 og 14 m — flatt og likt, så feltet leste som
én kake i 3D. Etasjetallene er nå hentet fra en kilde i stedet.

**Feilspor først:** reguleringen for *Søndre del av Brøset* (2025) har en fin
aksonometri med etasjetall på hvert bygg. Den er feil plan. Kartverkets
terrengmodell avgjorde det: planområdet der beskrives som kote +79 i nord
stigende til +98 i sør, mens våre omriss ligger på 70,7–84,8 m. Brøsetjordet er
plangrensa mellom dem — vår markedsplan ligger nord for gata, den planen sør
for. OSM bekrefter det samme: utviklingen vår er way 1502590317
(«Brøsetporten / Bo Brøset / Wesselsløka»), og Brøsetjordet (way 1502590316)
er sørkanten av den.

**Kilden vi endte på** er takplanen i `Del av Brøset med tilliggende veger,
detaljregulering (r20210042)`, Dyrvik arkitekter / ATSITE 07.04.2022, lagt inn
som `docs/kilder/wesselslokka/broset-takplan-2022.pdf`. Den er en
målestokkriktig karttegning, nord opp, med «N etg» og maks kotehøyde påskrevet
hvert bygg.

To ting gjorde den enkel å bruke:

1. **Teksten ligger i PDF-en, med posisjon.** Fonten er innebygd med egen
   koding der hver bokstav ligger 29 kodepunkt for lavt («HWJ» er «etg»); vi
   flytter den tilbake i stedet for å OCR-e. 101 etasjepåskrifter kommer ut med
   nøyaktig koordinat.
2. **Tegningen lar seg stadfeste mot tre veikryss.** Rundkjøringa på
   Tungasletta, Brøsetvegen × Sigurd Munns veg og Brøsetvegen × Brøsetflata,
   alle med koordinat fra OSM. Similaritetstilpasningen gir 0,7026 m per
   PDF-enhet og −1,98° rotasjon, med avvik på 1,5 / 2,1 / 3,0 m over 800 m.

Hvert omriss arver så etasjetallet som står oppå det. 36 av 52 har en påskrift
inne i seg; resten tar den nærmeste innen 35 m. Et sammenslått rekkehusfelt kan
ha flere påskrifter — da gjelder den høyeste, slik «2-3 etg» også leses som 3.
Fordelingen ble 2 × 2 etasjer, 20 × 3, 15 × 4, 7 × 5, 4 × 6, 2 × 7 og 2 × 8.

**A1/A2/B står ikke i den planen** — den er fra 2022, og Wesselsløkka-oppdelingen
kom etter. De tre får etasjetallet fra salgsmaterialet i stedet: BS3 selges som
to bygg på fem og sju etasjer med 122 leiligheter, der hus B alene er 51. A1 og
A2 er to seksjoner av femetasjeren. Nærmeste-påskrift ville gitt 6/7/4 her, som
er feil vei — hus B er det høye.

**Etasje til meter: 3,5.** Tallet er avledet av planens egne maks kotehøyder
minus dagens terreng (Kartverket DTM1) for byggene på seks til åtte etasjer,
der en meters slingring betyr minst. Volumene settes på dagens terreng i 3D, så
det er nettopp den differansen som skal treffe.

## Implementasjon

`lib/map/wesselslokka-site-plan.ts` bevarer avtegnede hjørner i kildebildets
pikselrom. Adressepunktet flyttes ikke. Byggenes hovedomriss er forenklet;
balkonger og små innhakk er utelatt.

Volumene er lyse med farget kontur: fyll `#f6e7dc` og kontur `#c07f68` på
salgsbyggene, `#fbf4ee` og `#cfa894` på områdeplanen rundt. Rosa fra
salgsmaterialet ble prøvd først og gjorde feltet tungt — nå bærer
høydeforskjellene formen, og fargen holder seg unna. En nøytral grå er
fortsatt feil: Mapbox tegner eksisterende bygg i nettopp den tonen, så de
planlagte byggene så ut som hus som allerede står der. Kontekstvolumene har
stiplet kontur, det kartografiske tegnet for «planlagt», og det er hele poenget
med å ha dem med.

Dekkevnen går motsatt vei i de to motorene. I 2D er kartet under verdt å se
gjennom flatene (0,82–0,88). I 3D må fyllet nesten dekke (0,90–0,94): fotoflisene
er grønne og mørke, og et halvgjennomsiktig lyst fyll blir grumsete brunt.

**Mapbox (2D):** ett GeoJSON-lag, fem paint-lag filtrert på `role`. Volumene
toner inn med zoom — usynlige på boardets åpningszoom (~13,5), fulle fra 15,4,
bokstavene A1/A2/B fra 15,5. Grunnen er at hele feltet er noen få piksler bredt
i oversikten: der er prosjektet pinnen, ikke femti omriss som krangler med den.

**Google (3D):** samme polygoner, ekstruderte, i samme palett omgjort til rgba.
Hvert bygg står så høyt som takplanen tillater der det ligger — fra 7 m på
felleshusene til 28 m mot Tungasletta. Ingen bildefiler eller modeller lastes i
produktet.

Akseptanse: samme grunnriss i begge motorer, 55 volumer, sju ulike høyder
(7–28 m), ingen dupliserte elementer ved motorbytte, ingen tegnet vei oppå en
ekte vei, og ingen planlagt bygg oppå et eksisterende.

Det som fortsatt ikke er hentet fra kilde: takform (volumene er esker, planen
har saltak mot Brøsetvegen) og byggetrinn.
