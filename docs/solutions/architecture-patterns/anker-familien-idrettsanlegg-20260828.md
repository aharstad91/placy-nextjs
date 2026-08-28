---
name: Anker-familien — når ett sted er registrert som mange
description: Kjøpesenter-ankeret generalisert til en familie-modell. Idrettsanlegg har samme feil (8-13 pinner per anlegg) men trenger egne regler, fordi medlemmene deler kategori med ankeret og anlegget er større enn bygget. Navne-gate + containment-gate som alternativer, kategori-begrenset medlemskap, kandidat-kollaps, realitets-gate som teller steder.
type: architecture-pattern
module: pipeline
date: 2026-08-28
tags: [anker, poi, hierarchy, parent-child, idrettsanlegg, kjøpesenter, containment, dedupe, hydrering, google-places, osm]
---

# Anker-familien — når ett sted er registrert som mange

## Kontekst

Kjøpesenter-ankeret (2026-08-27, se [parent-child-poi-hierarchy](parent-child-poi-hierarchy-20260410.md))
løste ett problem: Sirkus Shopping har ~100 leietakere på tilnærmet samme
koordinat, og uten anker stables de som 60 pinner. Mekanismen var bundet til
kjøpesenteret gjennom én konstant — `ANCHOR_CATEGORY = "shopping"`.

Fire skjermbilder fra Trondheims-boards viste at feilen ikke er
kjøpesenter-spesifikk:

| Sted | Pinner for ett anlegg |
|------|----------------------|
| Ranheim idrettspark | 8 |
| Charlottenlund | 7 |
| Leangen idrettsanlegg | 13 |
| Lade idrettspark | 13 |

**Ingen annen kategori gjør dette.** Dagligvare, bakeri, tannlege og legesenter
sto 1:1 med virkeligheten på de samme boardene. Grunnen er strukturell: en
butikk er én virksomhet med én oppføring, mens et idrettsanlegg er et OMRÅDE
der hver bane, hall og løpebane er registrert som sitt eget objekt hos både
Google og OSM.

## Hvorfor familiene ikke kunne dele ett regelsett

Den fristende fiksen — utvide `ANCHOR_CATEGORY` fra `shopping` til
`{shopping, idrett}` — er feil av tre målte grunner.

**1. Medlemmene deler kategori med ankeret.** Sirkus er `shopping`, medlemmene
er dagligvare, apotek og frisør. «Ranheim Idrettspark» er `idrett`, og det er
hvert eneste medlem også. Den gamle regelen (`p.categoryId !== ANCHOR_CATEGORY`)
ville utelukket ALLE medlemmene.

**2. Anlegget er større enn bygget.** Sirkus' fjerneste medlem ligger ~150 m
unna og adressen bærer resten. Idrettsanlegg har ingen felles adresse —
OSM-radene har ingen adresse i det hele tatt, og på Ranheim står anlegget på
Ranheimsvegen 166, stadion på 172 og kunstgresset på 174. Nærheten må gjøre hele
jobben, og målte spenn er 197–477 m.

**3. Derfor MÅ medlemskapet være kategori-begrenset.** En 500 m-radius som
slipper til alt ville slukt REMA 1000 Ranheimsfjæra, Ranheim tannklinikk og
folkebiblioteket — alle ligger innenfor. Et kjøpesenter er blandet bruk per
definisjon og skal sluke alt; et idrettsanlegg er idrett per definisjon.
`memberCategoryIds` er den ene regelen som gjør den store radiusen trygg.

Familiene bor i `lib/board/anchor-families.ts` og kjøres etter hverandre i
`resolve-anchors-step` — kjøpesenter først, så anlegg. Et medlem som er tatt
tilbys ikke til neste familie, og ingen families kandidat kan bli medlem i en
annen families anker.

## Gaten: navn ELLER containment, aldri bare én

For kjøpesenteret ER kategorien gaten: Google-typen `shopping_mall` peker ut
bygget. Idretten har ingen tilsvarende type. Målt mot Places API:

```
«Ranheim Idrettspark»    bare sports_activity_location   ← ER anlegget
«Lade idrettspark»       bare sports_activity_location   ← ER anlegget
«Ranheim Extra Arena»    sports_complex                  ← er stadion
«Charlottenlundhallen»   sports_complex                  ← er hallen
«Leangen Curlinghall»    sports_complex                  ← er hallen
```

`sports_complex` bommer på begge anleggene og treffer fire enkelthaller. OSM er
ikke bedre: `leisure=sports_centre` brukes om enkelthaller (Ranheimshallen
r≈66 m, Charlottenlundhallen r≈31 m), mens «Ranheim idrettsanlegg» er tagget
`leisure=pitch`. Bare Lade har en ekte anleggs-polygon (r≈339 m).

### Navne-gaten

En LUKKET ordliste med de norske ordene for anlegget — `idrettsanlegg`,
`idrettspark`, `idrettsplass`, `idrettssenter`, `sportsanlegg`, `sportsplass`,
`sportssenter`, `aktivitetspark`, `stadion`. Dette er ikke fuzzy navne-matching
(som `dedupe-colocated-pins` med rette avviser) — det er klassifisering på samme
form som `OSM_GATE_RULES`.

Ord som IKKE står der: `hall`, `arena`, `bane`, `kunstgress`, `senter`. Alle fem
navngir enheten INNE i anlegget. Tar vi dem inn, blir stadion ankeret og
anlegget medlem — feil vei.

Gaten er raus med vilje, fordi realitets-gaten rydder etter den: 22 av 240
idretts-POI-er slipper gjennom ordlista, tre blir ankre.

### Containment-gaten — og hullet den avdekket

Navne-gaten alene har et målt hull. **Charlottenlund er samme sak som Ranheim
sett fra kartet, men det finnes ingen «Charlottenlund idrettsanlegg».** Google
mener stedet ER hallen: ULF-AN bokseklubb og Chappa fritidsklubb ligger begge
inne i «Charlottenlundhallen» (`containingPlaces`), og et tekstsøk på
«Charlottenlund idrettsanlegg» gir hallen som øverste treff.

Gaten er derfor et ELLER: anleggs-ord **eller** minst to andre steder som peker
på stedet som sin container. To pekere, ikke én — målt over alle 18
idrettsklyngene i poolen er én peker et enkeltsted som gjør krav («Nidaros
Petanque klubbhus» → Lade idrettspark, «Bergens Tennisklubb» → Bergen
Racketsenter), mens to betyr at uavhengige steder er enige.

Begge gatene trengs: **Ranheim har anleggs-navnet og NULL containment,
Charlottenlund har containment og ikke navnet.**

> **Det største funnet:** gate 1 i hele anker-designet var tom. `containingPlaces`
> er dokumentert som den autoritative gaten, men **4 av 1 908 Google-rader** i
> poolen bar `contained_in_ids`. Feltet kom inn i `NEARBY_FIELD_MASK`
> 2026-08-27, og nesten hele poolen er eldre. Kjøpesenter-ankrene har altså
> kjørt på adresse og nærhet alene siden de ble bygd.

`lib/pipeline/enrich-containment.ts` fyller hullet uten å re-importere: ett
`searchNearby` per POI-klynge i stedet for ett oppslag per rad — **22 kall mot
1 908** for hele poolen, fordi containment per definisjon er et nærhets-fenomen.
Steget oppretter aldri en rad (recall er discoveryens jobb) og nuller aldri et
felt (fravær betyr «Google sa ingenting», ikke «ligger ikke i noe bygg»).

## Tre regler som måtte legges til i `resolveAnchors`

### Pass 0 — to kandidater på samme sted er ÉN kandidat

Anlegget er registrert flere ganger under nesten samme navn: Ranheim har både
«Ranheim Idrettspark» (Google + kuratert seed) og «Ranheim idrettsanlegg» (OSM,
130 m unna); Leangen har «Leangen Idrettsanlegg» (Google, 341 anmeldelser) og
«Leangen idrettspark» (OSM-node, 50 m unna). Uten kollaps deler de medlemmene
mellom seg, begge passerer firetallet, og boardet viser to anlegg der det er
ett.

Rangeringen i pass 0 er selvstendig — den kan ikke bruke medlemstall, for det er
nettopp medlemstallet som blir feil. `curated` først, så antall
Google-anmeldelser, så id.

**Anmeldelser teller BARE når raden har `google_place_id`.** 24 OSM-rader bærer
`google_review_count = 10` uten å ha en Google-id i det hele tatt — en
plassholder fra en tidligere backfill. Uten den gaten vinner OSM-veien «Ranheim
idrettsanlegg» (falske 10) over Google-oppføringen «Ranheim Idrettspark» (ekte 1).

### Realitets-gaten teller STEDER, ikke rader

60 av 816 OSM-rader i poolen er samme objekt under flere id-former
(`way/84078489`, `osm-way84078489`, `osm-w84078489`). De skjules på boardet av
`dedupe-colocated-pins`, men i oppløsningen ville de talt som tre bevis for at
anlegget finnes. «Øya stadion» samler fire rader som er tre steder, og ble et
anker på et falskt firetall før regelen kom.

En degradert rival fra pass 0 teller heller ikke — den er SAMME sted som
ankeret, og kan ikke være bevis for at fire ANDRE steder ligger der.

### Radiene er målt fram, ikke gjettet

Kjørt over hele poolen (5 889 POI-er) med tre innstillinger:

| tight / max | Resultat |
|-------------|----------|
| 150 / 300 m | Lade blir TO ankre, 180 m fra hverandre i samme område |
| 200 / 400 m | Lade er fortsatt to |
| **250 / 500 m** | Fire ankre, ett per anlegg. Ingen sluker et nabo-anlegg |

`tightRadiusM` er også kandidat-kollapsens terskel, og det er den som gjør 250 m
til riktig tall: «Lade idrettspark» og «Lade idrettsanlegg» er to navn på ett
sted og skal kollapse, mens Charlottenlund og Brundalen ligger 520 m fra
hverandre og skal ikke.

## To feil som lå under, begge generelle

Anker-radene ble skrevet riktig til basen, og boardet viste Charlottenlund som
før. Årsakene traff begge familiene:

**Ankeret tapte dedupen.** `contentRank` i `dedupe-colocated-pins` gir seieren
til raden med redaksjonell tekst. Poolen har fire rader for Charlottenlundhallen
— én Google (ankeret) og tre OSM, hvorav én med tekst. Regelen var riktig da en
pin bare representerte seg selv; nå bærer ankeret et helt register. Skjules det,
mister boardet ikke én pin — det mister innholdslista, og medlemmene dukker opp
igjen som løse pinner fordi forelderen deres ikke finnes i produktet.
**Ankre fredes nå via `protectedIds`**, samme seam som `highlightCandidates`.

**Backfillen re-hydrerte ikke.** Oppløsningen skriver til POOLEN (`v2.pois`),
boardet rendrer PRODUKTET (`v2.product_pois`). Uten re-lenking virker backfillen
bare når ankeret tilfeldigvis allerede står på boardet — som Ranheim gjorde og
Charlottenlund ikke. Skriptet re-hydrerer nå, men BARE produktene som mangler et
anker: hydreringen sletter og re-insetter hele `product_pois` og regner
`featured` på nytt. Målt: 1 av 13 produkter trengte det.

## Sammendraget er familie-avhengig

`anchor_summary` bygget av medlemmenes KATEGORIER kollapser på et anlegg — hvert
medlem er `idrett`, så setningen blir «Idrettsanlegg». Anleggs-familien sender
STEDSNAVN i stedet, sortert på antall Google-anmeldelser og ikke alfabetisk:

```
alfabetisk:  «islek, Leangen Bolig Arena, Leangen Bydelshall, …»
etter navn:  «Trondheim Ice Rink, Trondheim Curlingklubb, Leangen Bydelshall, …»
```

Ankerets eget navn holdes ute av sitt eget register — poolen har fire rader for
hallen, og «Charlottenlundhallen: … og Charlottenlundhallen» leses som en feil.

Registerets overskrift følger familien: «I senteret» for kjøpesenter, **«På
anlegget»** for idrettsanlegg. Et anlegg er et område man er PÅ, ikke et bygg
man går INN i, og feil preposisjon leses som en feil.

## Resultat i prod (2026-08-28)

| Sted | Før | Etter |
|------|-----|-------|
| Ranheim idrettspark | 8 pinner | 1 anker, 7 i registeret |
| Leangen idrettsanlegg | 13 | 1 anker |
| Lade idrettspark | 13 | 1 anker |
| Charlottenlund | 7 | 1 anker, 5 i registeret |

REMA 1000 Ranheimsfjæra, Ranheim tannklinikk og Ranheim legesenter står fortsatt
som egne pinner — alle tre ligger innenfor 500 m-radiusen, og kategori-skranken
er det eneste som holder dem ute. Kjøpesentrene er uendret: 12 ankre før, 12
etter.

## Angre

Ankerradene bærer `poi_metadata.anchor_family`, så én familie kan rulles tilbake
alene:

```sql
UPDATE v2.pois SET parent_poi_id = NULL
WHERE parent_poi_id IN (
  SELECT id FROM v2.pois WHERE poi_metadata->>'anchor_family' = 'anlegg'
);
UPDATE v2.pois
   SET anchor_summary = NULL,
       poi_metadata = poi_metadata - 'anchor_resolution' - 'anchor_family'
 WHERE poi_metadata->>'anchor_family' = 'anlegg';
```

## Gjenstår

- **Containment-høstingen bør utvides til butikk-siden.** Den kjører i dag bare
  rundt idretts-klynger. Kjøpesenter-ankrene har aldri hatt gate 1 i praksis, og
  22 kall dekker hele poolen.
- **De 60 overtallige OSM-radene bør slås sammen.** Samme objekt under to-tre
  id-former. Boardet skjuler dem, og firetallet er immunt, men de forurenser
  medlemslister og sammendrag.
- **Verifiser alltid mot en tømt Next-cache.** Etter backfillen viste boardet de
  gamle pinnene selv med restartet dev-server — `rm -rf .next` var det som skilte
  «koden virker ikke» fra «cachen er gammel».

## Filer

| Fil | Rolle |
|-----|-------|
| `lib/board/anchor-families.ts` | Familiene, gatene og registerets overskrift |
| `lib/board/anchor-membership.ts` | Ren oppløsning: pass 0–4, radier, realitets-gate |
| `lib/pipeline/resolve-anchors-step.ts` | I/O rundt oppløsningen, peker-telling, sammendrag |
| `lib/pipeline/enrich-containment.ts` | Klynge-basert høsting av `containingPlaces` |
| `lib/pipeline/hydrate-report.ts` | Freder ankre i dedupen |
| `scripts/anchor-backfill.ts` | Høsting → oppløsning → re-hydrering, med tørrkjøring |
