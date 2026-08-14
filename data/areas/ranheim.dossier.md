# Ranheim — romlig dossier

> Scout-materiale for Moat 1-kuratering, samme mal som `straumen.dossier.md`.
> Kilde per observasjon. IKKE publiseringstekst — kurator-input.
> Generert fra Mapbox Static-utsnitt (light + outdoors, lest 2026-08-14), Overpass/OSM-sveip
> (2026-08-14), Google Places-import (2026-08-14), Mapbox Tilequery (vannlag, 2026-08-14),
> og v2-basens egne rader.
>
> **Merk:** Ranheim ble kuratert 2026-06-10 (PoC-en som beviste editorial-arv). Dette dossieret
> er skrevet ETTER at teksten fantes, ikke før — det er derfor en *revisjon*, ikke et førsteutkast.
> Formålet er å gi kurator grunnlag for å vurdere om de seks tekstene fortsatt stemmer med
> det boardet nå faktisk viser (46 → 199 steder).

## Boardet dossieret er målt fra

`grilstad-marina_byggetrinn-4` — Grilstad Marina, 63.43826/10.50872, discovery-radius 2500 m.
Det er **det eneste provisjonerte boardet inne i `areas.ranheim`-polygonet**. De tre
demo-adressene fra juni-PoC-en (Hans Collins veg 1B, Horgvegen 4, Martin Barstads veg 23C)
finnes ikke lenger som prosjekter i v2.

**Konsekvens for kurateringen:** boardets senter ligger ~1,2 km VEST for områdets eget senter
(63.435/10.52). Kuratert høydepunkt-liste er valgt for strøket, men testes bare mot en adresse
i utkanten av det. Se «Høydepunkter som ikke når fram» nedenfor.

## Stedets logikk

Ranheim ligger på nordsiden av Strindfjorden-aksen øst for Trondheim sentrum, klemt mellom
fjorden i nord og E6/Omkjøringsvegen i sør. Bebyggelsen ligger i to tydelige lag:
**sjøkanten** (Grilstad Marina, Grilstadfjæra, Ranheimsfjæra — nyere utbygging på gammel
industri- og strandsone) og **det gamle Ranheim oppe ved fabrikken/stasjonen**, med
Charlottenlund som naboflate vestover. [Mapbox light+outdoors z13–14, 2026-08-14]

Grilstad Marina er selv en utfylt marina-flate: molo, småbåthavn og Fullriggerøya stikker ut
i fjorden, og boardets hjemmepunkt ligger ytterst på denne flaten. Det forklarer hvorfor
tettheten faller bratt nordover (fjord) og hvorfor alt av hverdagsfunksjoner ligger i én
retning — sørover/østover. [Mapbox satellitt/light, 2026-08-14]

**Ranheim er ikke et sentrum med én kjerne.** Handelen fordeler seg på tre punkter som ligger
1–2 km fra hverandre: Grilstad mall-kvartalet (Extra, Vitusapotek, Nille, post-i-butikk,
frisør, Pizzabakeren — alt innenfor 560 m fra boardet), Ranheim sentrum ved stasjonen
(bydelskafé, bibliotek, Kulturtribunen, ~1,4 km) og Lade Arena/Leangen-flaten i vest
(2–2,3 km, bil-destinasjon). [Google Places + OSM, 2026-08-14]

## Inventaret slik det står nå (199 steder)

| Tema | Steder | Tyngdepunkt |
|------|--------|-------------|
| barn-oppvekst | 57 | barnehage 23, idrett 15, skole 11, lekeplass 7 |
| hverdagsliv | 65 | butikk 21, supermarket 10, doctor 8, dentist 5, kirke 4 |
| natur-friluftsliv | 23 | marina 7, park 7, badeplass 5, outdoor 4 |
| transport | 23 | ladepunkt 10, buss 9, tog 3, bensin 1 |
| mat-drikke | 16 | restaurant 10, kafé 5, bakeri 1 |
| trening-aktivitet | 11 | gym 9, spa 1, svømming 1 |
| opplevelser | 4 | bibliotek 2, museum 2 |

66 av 199 har Google-oppføring (åpningstider på 56, telefon på 55, bildegalleri på 61).
De øvrige 133 er OSM-, Entur-, NSR- og Barnehagefakta-rader uten Google-kobling.

## Gap-hypoteser (formulert FØR fasit-passet)

1. **Mat & drikke er tynt og skjevt.** 16 steder, hvorav bare to innenfor 600 m (Flipper Kafe
   og Pizzabakeren). Resten ligger 1,2–2,3 km unna, og halvparten av dem er IKEA Leangen,
   SiT-kantiner på Rotvoll og Lade Arena-kjeder — altså ikke nabolagstilbud. Hypotese: dette
   er ikke et datahull, det er stedets faktiske tilstand, og teksten bør si det.
2. **Ranheim fabrikker / papirfabrikken mangler helt** som punkt. Det er stedets historiske
   og fysiske landemerke og navnegiver for idrettslaget. Klasse B (kategori finnes ikke).
3. **Ranheim IL / Extra Arena** — idrettsanlegget står med `curated-reseed`-rader
   (Ranheim Idrettspark), men Overpass-idrettsimporten feilet med HTTP 406 i denne kjøringen
   og ble kun delvis reddet av OSM-sveipet. Verifiser at anleggsnavnene er de folk bruker.
4. **Ladestien** er et av strøkets viktigste bruksobjekter og ligger som ett punkt med
   koordinat i sjøen (se under). En sti er en linje, ikke et punkt — samme klasse som
   «Den Gyldne Omvei» på Straumen.
5. **Tre skoler i poolen er Charlottenlund-skoler** (Charlottenlund barneskole,
   ungdomsskole, vgs.). De ligger innenfor radius, men i naboområdet — og
   `ranheim`-polygonet overlapper `charlottenlund` med 39 vitnepunkter. Skolekrets-spørsmålet
   er derfor uavklart nettopp der flest boliger ligger.
6. **Ladeområdet drar boardet vestover.** 10 ladepunkter er nesten like mange som bussholde-
   plasser (9). Ladepunkt-tettheten er en artefakt av Google-kategorien, ikke av at Ranheim
   er et ladested.

## Pin-funn som må avgjøres av kurator

**Pins i vann (Mapbox Tilequery, vannlag, 2026-08-14) — 8 av 199:**

| POI | Vurdering |
|-----|-----------|
| Væreholmen badeplass | `source=manual`, koordinat 63.43400/10.54300 — runde tall, hånd-tastet, havner i sjøen. Skal flyttes. |
| Hansbakkfjæra | Google-koordinat på sjøsiden av fjæra. |
| Tømmerstranda | Google-koordinat på sjøsiden av fjæra. |
| Grilstadfjæra badeplass | Google-koordinat på sjøsiden av fjæra. |
| Ladestien | Curated-rad, punkt satt i sjøen. |
| Grilstad molo | **Korrekt** — en molo ligger i vann. |
| Grilstad Marina (OSM) | **Korrekt** — havneflate. |
| Svømmehall (OSM way) | **Falsk positiv** — polygon-centroiden treffer bassengflaten inne i bygget. |

**Dubletter på samme board — 16 par/tripler.** To ID-generasjoner for samme sted lever side om
side i `v2.pois` (legacy `bus-*`/UUID mot cutover-radene `entur-NSR-StopPlace-*`/`bhf-*`, alle
datert 2026-07-06). Se worklog 2026-08-14 for full census: 121 rader deler autoritativ nøkkel,
355 rader deler navn+posisjon innen 150 m på tvers av hele basen.

## Høydepunkter som ikke når fram

Av strøkets 31 kuraterte `highlightCandidates` finnes nå 21 i boardets pool (var 10 før denne
kjøringen). De 10 som fortsatt faller ut ligger alle innenfor discovery-radiusen, men utenfor
per-kategori-gangavstanden fra Grilstad Marina:

| Høydepunkt | Avstand | Tak for kategorien |
|------------|---------|--------------------|
| Ranheim skole | 1160 m | 20 min (1600 m) — **finnes i poolen som en annen rad**, se dublett-funnet |
| Ranheim idrettsplass bussholdeplass | 1366 m | 15 min (1200 m) |
| Rosenborg Bakeri | 1382 m | 15 min (1200 m) |
| Restaurant Romantica | 1236 m | 15 min (1200 m) |
| Ranheim bussholdeplass | 1924 m | 15 min (1200 m) |
| Olderdalen bussholdeplass | 1938 m | 15 min (1200 m) |
| Dromedar Kaffebar Overvik | 1990 m | 15 min (1200 m) |
| Hansbakken skole | 1992 m | 20 min (1600 m) |
| Coop Prix Olderdalen | 2055 m | 15 min (1200 m) |
| 3T-Leangen | 2194 m | 20 min (1600 m) |

Ni av ti er filteret som gjør jobben sin: fra Grilstad Marina er de reelt langt unna. Det er
ikke et argument for å heve takene — det er et argument for at **strøket trenger et board
nærmere sitt eget senter** hvis den kuraterte lista skal kunne testes.

## Åpent til fasit-passet (Andreas' lokalkunnskap)

Samme øvelse som `straumen.fasit.md`: samle punktene du selv ville nevnt for en som flytter
til Ranheim, uavhengig av hva basen inneholder, og mål recall mot poolen. Særlig usikkert her:

- Hva heter idrettsanlegget/arenaen i dagligtale, og hvilke lag bruker den?
- Er Grilstad mall det folk kaller stedet, eller sier de «Extra på Grilstad»?
- Hvilken skolekrets hører Grilstad-boligene faktisk til — Ranheim eller Charlottenlund?
- Er Ladestien det viktigste turdraget herfra, eller går folk motsatt vei (Væreholmen/Vikelva)?
