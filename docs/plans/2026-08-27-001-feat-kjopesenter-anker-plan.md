---
title: "feat: kjøpesenter-anker — samlokaliserte POI-er som én destinasjon"
type: feat
status: draft
date: 2026-08-27
---

# feat: kjøpesenter-anker — samlokaliserte POI-er som én destinasjon

## Overview

Et kjøpesenter er én destinasjon, ikke 40 butikker. I dag behandler boardet hver leietaker som et
selvstendig sted med egen pin, egen rad og egen reisetid. Konsekvensen er målt: **142 av 533 POI-er
(27 %) på Strindfjordvegen 10-boardet ligger i to kjøpesenter-adresser** — 73 på Falkenborgvegen
(Sirkus Shopping) og 69 på Haakon VIIs gt. (Lade). De stables på kartet, de drukner kategorilistene,
og de sier det samme førti ganger.

Denne planen gjeninnfører **ankeret**: senteret er en egen POI med egen markør, butikkene inni peker
på den via `parent_poi_id`, og ankeret behandles etter fem regler som ikke gjelder for vanlige POI-er
— egen reisetid som barna arver, overlevelse av avstandsfiltre, kategori-oppfyllelse på vegne av
barna, telling som én, og fritak fra markør-utglisningen.

Datamodellen finnes allerede og ble ratifisert 2026-04-10. Det som mangler er **forfatterskapet**
(ingenting fyller `parent_poi_id` automatisk), **anker-reglene** (som aldri ble formulert), og
**flaten** (som ble slettet i rebuilden). Innholdsteksten `anchor_summary` er dessuten tapt data —
den er `NULL` på alle 62 kjøpesenter-POI-er i v2, også Valentinlyst Senter der den ble skrevet for
hånd i migrasjon 057/058.

Planen løser ikke markør-tetthet generelt. Den løser samlokalisering i navngitte bygg. Tett
bebyggelse uten container er et annet problem og hører ikke her.

## Hva er et kjøpesenter?

Definisjonen er **ikke størrelse**. Vikhammer senteret har fem virksomheter, Sirkus Shopping har
rundt hundre, og de er samme slags ting: et bygg der flere selvstendige virksomheter deler ett tak
og ett navn, slik at folk sier «jeg skal på senteret», ikke «jeg skal på Extra». Et lite nærsenter
er ikke en svakere versjon av et stort — det er den samme destinasjonen for et mindre nedslagsfelt,
og for den som bor der er det det viktigste stedet i nabolaget.

Operativt er ankeret definert av tre betingelser, alle tre nødvendige:

1. **Google kaller stedet `shopping_mall`.** Dette er navne-gaten, og den er strengere enn den ser
   ut. Målt mot Places API 2026-08-27: Google sier `shopping_mall` om Vikhammer senteret (5
   virksomheter), Grilstad mall, Lade Arena, Hangaren Lade og City Lade — men **ikke** om Haakon
   VIIs gt. 8 (fem virksomheter, ingen senter innen 700 m av det bygget) og **ikke** om
   Vennalivegen 5 på Inderøy (fire virksomheter, null `shopping_mall` innen 3 000 m). Google skiller
   altså allerede senter fra «bygg med flere leietakere», og det skillet er det vi vil ha.
2. **Minst fire virksomheter oppløses inn i det.** Realitets-gaten. Den luker ut «Tem Im thaimat» og
   «Parkering ikea leangen», som bærer typen `shopping_mall` uten å samle noe.
3. **Medlemmene ligger innenfor gangavstand av ankeret.** Ytre skranke, ikke gate — se
   medlemskaps-regelen i Key Technical Decisions.

Betingelse 1 gjør at et anker alltid HAR et navn. Det er derfor planen ikke trenger å konstruere
navnløse samlepunkt: **måling over hele poolen viser at klynger uten `shopping_mall`-anker enten er
søppel-adresser, manglende recall, eller ikke sentre i det hele tatt.** Se Verifiserte fakta.

Størrelse hører derimot hjemme i *presentasjonen*: registeret for Sirkus lister kategorier med
antall, mens registeret for Vikhammer senteret lister fem navn direkte. Samme mekanisme, ulik
tetthet.

## Problem Frame

### Symptomet

Tre observerte tilfeller, samme rot:

1. **Sirkus Shopping.** 73 POI-er deler Falkenborgvegen-adresse. 28 av 83 POI-er i området har
   byte-identiske koordinater — den største enkeltklyngen er 7 forretninger på nøyaktig
   `(63.4357634, 10.4571473)`: Gullfunn, Select Beauty, JACK & JONES, VERO MODA, Urology Clinic,
   Flying Tiger, Big Bite.
2. **Lade.** 69 POI-er på Haakon VIIs gt., fordelt over 500 meter — ikke ett bygg, men et
   handelsområde med flere ankre (Lade Arena, Hangaren Lade, City Lade).
3. **Hverdagsliv drukner.** Notert som åpent punkt 2026-08-24: etter re-provisjonering ga temaet 136
   steder, der 66 av 68 butikker lå på Lade/Sirkus.

### Hvorfor dagens grep ikke rekker

To mekanismer er bygget mot symptomet, begge visuelle, begge med tak:

- **`lib/board/spread-co-located.ts` (2026-08-12)** vifter punkter innen 12 m ut på en 12 m sirkel.
  Bygget for AKSET-caset (to skoler på identisk punkt). Ved 7 medlemmer er sirkelen full; ved 24
  er den meningsløs.
- **`lib/board/pin-declutter.ts` (2026-08-23)** demoterer taperen i en tett klynge til en 14 px
  prikk. Prioritet er `poi.googleRating ?? 0` (`use-3d-marker-declutter.ts:401-402`). Ved en
  kjøpesenter-klynge gir det «2 pins + 5 prikker» — bedre enn stabling, men fortsatt syv markører
  der brukeren skulle sett ett sted.

Ingen av dem berører listene, kategoritellingene eller reisetidene. Kartet er halve problemet.

### Hvorfor ikke clustering

Pikselbasert clustering (supercluster e.l.) feiler spesifikt på dette tilfellet, av fire grunner:

- **Klyngen åpner seg aldri.** Punkter med identisk koordinat forblir én klynge også over `maxZoom`.
  `getClusterExpansionZoom` peker på en zoom som ikke løser noe opp.
- **Posisjonen lyver.** Klyngesenteret er et vektet snitt av barna og ligger et sted ingen POI er.
  For en leser som skal vurdere avstand fra boligen er det direkte villedende.
- **Tallet betyr ingenting.** «7» forteller en boligkjøper ingenting. «Rema, apotek og Vinmonopol i
  Sirkus Shopping» gjør det.
- **Fargekodingen dør.** Placy fargekoder på kategori; en klynge på tvers av kategorier må ha én
  farge og ødelegger dermed nettopp kodingen leseren har lært.

Containment er stabilt der geometri ikke er: gruppen endrer seg ikke med zoom, rotasjon eller
render-rekkefølge, og kan derfor beregnes én gang i pipelinen i stedet for i nettleseren hver gang
kameraet stopper.

### Hvorfor ikke FINN-mønsteret

FINNs «+»-badge med «1 av 6 annonser» og piler i toppen fungerer fordi de seks er likeverdige,
sammenlignbare kjøpsvalg. Butikkene i et senter er et *utvalg*, ikke et sammenligningssett — leseren
vil vite hva som finnes, ikke bla gjennom førti kort. Karusellen koster N klikk for N butikker der
registeret koster ett.

Den bryter dessuten mot to ratifiserte beslutninger: kategori-navbaren er eneste transport i boardet
(2026-08-25), og en horisontal bla-mekanikk mellom stopp ble allerede prøvd og forkastet. `+`-badgen
i seg selv er verdt å beholde — den er kvalitativ («her er mer»), ikke et tall.

## Requirements Trace

- **R1.** Et kjøpesenter med minst fire samlokaliserte POI-er vises som ÉN markør med senterets navn,
  ikke som N markører. Verifisert på Sirkus Shopping (Strindfjordvegen 10-boardet).
- **R2.** Ankeret faller aldri på avstands- eller tidsbudsjett-filtre som gjelder enkeltsteder. Et
  nærsenter 6 km unna skal vises; en enkeltbutikk 6 km unna skal ikke.
- **R3.** Pipelinen finner nærsenteret også når det ligger utenfor prosjektets discovery-radius (3 000 m,
  hardt tak), uten at noen tegner en ekstra sirkel manuelt. Verifisert på Sundsøya, der nærmeste
  `shopping_mall` ligger 12,1 km unna.
- **R4.** Ligger en POI som oppfyller en kategori inne i et anker, er kategorien oppfylt, og treffet
  vises som ankeret med stedet navngitt — ikke som en anonym pin på et tak.
- **R5.** Ankeret teller som én rad i kategorilister og statistikk; barna teller ikke i tillegg.
- **R6.** Ankeret demoteres aldri til prikk av markør-utglisningen.
- **R7.** Klikk på ankeret åpner et innholdsregister gruppert på Placy-kategorier, i den eksisterende
  POI-flaten — ingen ny navigasjonsmekanikk, ingen piler, ingen «1 av N».
- **R8.** `anchor_summary` genereres deterministisk fra barnas kategorier, så nivå 1-boards får den
  uten kuratering (minimum-garantien 2026-07-07).
- **R9.** Kriteriet er deterministisk og reproduserbart: samme datagrunnlag gir samme anker-oppløsning
  uavhengig av kjøre-rekkefølge.
- **R10.** Testpakken er grønn, og ingen regresjon i markørklikk, kameramodus, viewport-publisering,
  omvisning, capture eller 2D/3D-veksling.

## Scope Boundaries

**Innenfor:**

- Kjøpesenter som anker-type (`shopping_mall` → Placy-kategori `shopping`).
- Automatisk medlemskaps-oppløsning i pipelinen, skrevet til `v2.pois.parent_poi_id`.
- Deterministisk `anchor_summary`.
- Utvidet søk etter ankre utenfor prosjektets discovery-radius.
- Anker-reglene i `report-data.ts` og board-laget.
- Innholdsregister-flaten i den eksisterende POI-modalen/sheeten.
- Sirkus Shopping og Lade som første verifiserte tilfeller.

**Utenfor:**

- Markør-tetthet der det ikke finnes en container (skjermbilde 2s spredte klynger utenfor
  kjøpesenter-adressene). Dagens `spread-co-located` + `pin-declutter` blir stående for de tilfellene.
- Innendørskart, etasjevelger, plantegninger.
- Pikselclustering av noe slag.
- Redaksjonell tekst om senteret utover det deterministiske registeret.
- 2D-motorens markørlag utover det som følger gratis av at datasettet er mindre.

### Deferred to Separate Tasks

- **Andre anker-typer.** Stasjon/terminal (Leangen), samlokaliserte offentlige bygg (AKSET-caset:
  vgs + ungdomsskole + bibliotek + kulturhus under ett tak), næringsbygg med flere tjenester. Samme
  mekanisme, andre kandidat-kriterier. Tas opp når kjøpesenter-tilfellet er verifisert i prod.
- **Handelsområde som eget begrep.** Lade viser at én gateadresse kan spenne 500 m og romme flere
  ankre. Denne planen lar det bli 2–3 ankre i stedet for å innføre et grovere nivå. Om det viser seg
  utilstrekkelig, tas «handelsområde» opp som eget spor.
- **`containingPlaces` fra Google Places (New)** som autoritativ medlemskaps-nøkkel. Feltet er ikke
  verifisert mot norske kjøpesentre, og det utløser Place Details Pro-SKU. Se Open Questions.
- **Megler-kuratert innhold i ankeret.** Hører på `highlightPoiIds`-aksen (per strøk, per megler),
  ikke her.

## Context & Research

### Relevant Code and Patterns

| Fil | Rolle |
|---|---|
| `supabase/migrations/070_baseline.sql:220-221` | `parent_poi_id text` + `anchor_summary text` på `v2.pois`. Kolonnene finnes. |
| `lib/types.ts:99-101` | `parentPoiId`, `anchorSummary`, `childPOIs` på `POI`. Typen finnes. |
| `lib/supabase/v2-queries.ts:157-158` | Leses fra DB til `POI`. Lesestien finnes. |
| `components/variants/report/report-data.ts:531-540` | `childByParent`-oppslag + `topLevelPOIs` (barn ekskludert fra hero-metrikker). |
| `components/variants/report/report-data.ts:605-608` | Barn filtreres bort når forelderen er i samme tema; `childPOIs` festes på forelderen. |
| `components/variants/report/report-data.ts:675` | `allPOIs: filtered` — **det filtrerte settet er det boardet leser.** |
| `components/variants/report/board/board-data.ts:243` | `adaptBoardData(report)` konsumerer `report.themes`, altså det allerede filtrerte settet. |
| `components/variants/report/board/board-data.ts:552-567` | `adaptPOI` — bygger `BoardPOI`. `raw` bærer hele `POI`-en, inkludert `childPOIs`. |
| `components/variants/report/board/board-data.ts:253` | `computeSpreadCoordinates` på alle board-POI-er. |
| `lib/board/spread-co-located.ts:50` | Terskel 12 m, radius 12 m, transitiv gruppering. |
| `lib/board/pin-declutter.ts:60,75` | `DEFAULT_PIN_SEPARATION_PX = 34`, greedy demotering i prioritetsrekkefølge. |
| `components/variants/report/board/use-3d-marker-declutter.ts:401-402` | Prioritet = `googleRating ?? 0`; aktiv POI = `Infinity` (demoteres aldri). |
| `lib/pipeline/provision.ts:5-19` | Stegrekkefølgen. Load-bearing; nytt steg må plasseres bevisst. |
| `lib/pipeline/hydrate-report.ts:86` | Hydreringen — der visnings-beslutninger hører, ratifisert 2026-08-24. |
| `lib/pipeline/poi-discovery.ts:68` | `shopping_mall: { id: "shopping", name: "Kjøpesenter" }`. |
| `lib/pipeline/poi-discovery.ts:207` | Type-whitelist: `shopping_mall: new Set(["shopping_mall"])`. |
| `lib/pipeline/report-defaults.ts:178` | `BOLIG_DISCOVERY_RADIUS_M = 3000`. |
| `app/api/admin/import/route.ts:69` | `radiusMeters: z.number().min(300).max(3000)` — **hardt tak.** |
| `lib/pipeline/dedupe-colocated-pins.ts` | Duplikat-dedup (samme sted, to kilder). **Ikke** relevant for anker — men nabo i samme steg. |

### Verifiserte fakta

Målt mot produksjonsdatabasen 2026-08-27.

**Ankeret finnes.** Sirkus Shopping er POI `google-ChIJVZdRQJoxbUYRTcToJ4smjeM`, `category_id`
`shopping`, adresse «Falkenborgvegen 1, Trondheim», `(63.4356484, 10.4566579)`. Den har allerede
`editorial_hook`: «Trøndelags største kjøpesenter med rundt 100 butikker — åpnet i 2012 på
Strindheim, bare 330 meter fra Leangen stasjon.» Bekymringen om å kollapse leietakere bak en tom pin
er altså ubegrunnet.

**Ankerets koordinat er ikke byggets sentrum.** Sirkus Shopping har byte-identisk koordinat med
Levi's Store og ligger i sørøstre hjørne. En ren radius rundt ankeret bommer skjevt — medlemmer i
nordvest ligger ~150 m unna. Medlemskap må derfor bruke adresse-nøkkelen som primærgate og radius
kun som ytre skranke.

**`anchor_summary` er NULL på alle 62 kjøpesenter-POI-er i v2**, også Valentinlyst Senter der de fire
`parent_poi_id`-radene fra migrasjon 057/058 overlevde. Årsaken er
`supabase/migrations/074_poi_pool_migrering_til_v2.sql:104`: insert-en har `WHERE NOT m.already_in_v2`,
så rader som allerede lå i v2 fikk aldri kopiert kolonnen fra `public`, som siden er droppet. Teksten
er tapt data, ikke bare en manglende flate.

**`category_id = shopping` er IKKE i seg selv et anker-kriterium.** De 62 radene inneholder «Tem Im
thaimat», «Parkering ikea leangen», «Go'Bento», «Allshop.no», «Sport1», «Stovner sko &
nøkkelservice» og «Falkenborgvegen 3» — altså en restaurant, en parkeringsplass, nettbutikker,
enkeltbutikker og en ren adresse. Google-typen `shopping_mall` er upålitelig alene, nøyaktig slik
`docs/solutions/`-læringen om søketyper forutsier. Kandidaten må bestå en andre gate.

**Adresse-gate over-grupperer.** Falkenborgvegen-klyngen (73 POI-er) inneholder husnummer 1/9/5
(Sirkus, 59 POI-er) *og* 35/38/36/31 (11 POI-er, opptil 419 m unna). Haakon VIIs gt. er verre: 69
POI-er med median 253 m og maks 503 m fra tyngdepunktet — et handelsområde, ikke ett bygg.
Normalisering må derfor være **gate + husnummer-sett**, med avstand som skranke.

**Adressen er Google-fritekst.** Faktiske verdier: «Nye lokaler, Falkenborgvegen 5, i 1 etg,
Trondheim», «Peder Falcks veg 3, 8, Trondheim», «Falkenborgvegen 4-6», «Falkenborgvegen 5, 9»,
«SIRKUS SHOPPING, Falkenborgvegen 1, Trondheim». Normaliseringen må skrives selv og testes mot disse.

**Senternavnet forekommer i POI-navnet, men med lav recall.** 30 rader matcher `*sirkus*`
(«Vitusapotek Sirkus Shopping», «Skoringen, Sirkus Shopping», «Princess (avd. Sirkus Shopping)»,
«Digg Pizza - Sirkus»), mens Cubus, Glitter, Junkyard, Levi's, Rituals, Jernia og Kitch'n ikke bærer
det. Falske treff finnes også: «Sirkusparken» ligger 1,5 km unna. Brukbart som bekreftende signal,
aldri som eneste gate.

**Google `types` lagres aldri.** Feltet hentes ved discovery (`poi-discovery.ts:317`) og brukes til
filtrering (`:551-565`), men det finnes ingen `types`-kolonne i `v2.pois` og ingen mapping i
`import-pois.ts`. Et kriterium som trenger typen må enten hente på nytt eller klare seg uten.

**Klynge-måling over hele poolen (5 883 POI-er).** Alle adresse-klynger med ≥4 ikke-`shopping`-POI-er:
**46 klynger, hvorav 20 har et `shopping_mall`-anker innen 150 m.** De 26 uten fordeler seg slik:

- **4 er søppel-adresser** — `trondheim` (42 POI-er), `oslo`, `bergen`, `ranheim`. Google har levert
  bare bynavn uten gate. Løses ved å kreve husnummer i adresse-nøkkelen.
- **1 er event-data** — `empire polo club, indio, ca` (Coachella), 8 239 km unna.
- **~8 er genuint ikke sentre** — kontorbygg og næringsadresser (`tempevegen 22`, `klæbuveien 125`,
  `sorgenfriveien 18`, `elgeseter gate 1`). Google gir dem ikke `shopping_mall`. Riktig ekskludert.
- **~6 er separate bygg i et handelsområde** — `haakon viis gt. 8`, `8-10`, `15` på Lade. Verifisert
  mot Places API: seks `shopping_mall` innen 700 m av Lade-tyngdepunktet (Lade Arena 305 m, Hangaren
  490 m, City Lade 520 m), men ingen på nummer 8 eller 15. Det er frittstående storbutikker, ikke
  senter. Riktig ekskludert.
- **Resten er manglende recall** — senteret finnes hos Google, men ikke i basen vår. Se neste avsnitt.

Konklusjonen: **det finnes ikke en reell kategori «klynge uten navn».** Planen trenger derfor ingen
mekanisme for å konstruere navnløse samlepunkt.

**Vikhammer er en recall-bug, ikke et definisjonshull.** `Stasjonsvegen 1, Vikhammer` samler fem
virksomheter (Extra, Apotek 1, Post i Butikk, Pizzabakeren, Vikhamar Hårsenter). Google kjenner
«Vikhammer senteret» med `primaryType: shopping_mall`, og `searchNearby` returnerer det på første
forsøk **473 m fra prosjektsenteret** — godt innenfor 3 000 m. Boardet
`konsulent-harstad_utsikten-6-…` har 44 POI-er totalt (mot 533 på Strindfjordvegen 10) og null i
`shopping`.

> **KORRIGERT i Unit 3 (2026-08-27):** årsaken er ikke at boardet er gammelt. Vikhammer senteret har
> **verken rating eller anmeldelser** hos Google og faller på `hasMinimumQualitySignals`
> (`poi-quality.ts:180`), som `shopping` ikke er unntatt fra. En re-provisjonering med dagens kode
> ville bommet på nytt. Samme gjelder Moholtsenteret og Decades. Se Unit 3 for mottiltaket.

**Ankerets adresse matcher ikke nødvendigvis medlemmenes.** Google plasserer Vikhammer senteret på
«Utsikten 13, Vikhammer», mens de fem medlemmene står på «Stasjonsvegen 1». Ulike gatenavn, men
**5–25 meters faktisk avstand**. Det er motsatt av Sirkus, der ankeret deler adresse med medlemmene
men ligger ~150 m unna dem i byggets hjørne. Adresse-nøkkel og radius må derfor være ALTERNATIVE
gater (OR), ikke begge påkrevd.

**Discovery-radius har hardt tak på 3 000 m.** `BOLIG_DISCOVERY_RADIUS_M = 3000`, og API-skjemaet
avviser høyere verdier. Målt mot Places API — nærmeste faktiske `shopping_mall`, ikke det poolen
tilfeldigvis inneholder:

| Board | Nærmeste kjøpesenter (Google) | Innenfor 3 000 m? |
|---|---|---|
| Strindfjordvegen 10 | Grilstad mall 0,2 km | ja |
| Wesselsløkka | Valentinlyst Senter 0,5 km | ja |
| Oppdal Sentrum | Aunasenteret 0,1 km | ja |
| Utsikten 6, Vikhammer | Vikhammer senteret 0,47 km | ja |
| Sundsøya, Inderøy | **Thon Senter Verdal 12,1 km** | **nei** |

Sundsøya er det ene reelle tilfellet: null `shopping_mall` innen 3 000 m, og de tre nærmeste er Thon
Senter Verdal (12,1 km), Alti Verdal (12,4 km) og Alti Magneten på Levanger (14,8 km). For en beboer
på Inderøy er det nettopp de tre man kjører til. Det tidligere tallet «AMFI Stjørdal 47,7 km» var en
artefakt av at poolen er tom der — ikke virkeligheten.

**Ingen forrige/neste-navigasjon finnes i UI-et.** `board-state.tsx:117-134` har ingen NEXT/PREV.
POI-nivået i omvisningen er en accordion (`StoryCard.tsx:333-350`), ikke en carousel. En historisk
POI-carousel med piler er slettet. Innholdsregisteret må derfor bygges, ikke gjenbrukes — men det er
også en fordel: det finnes ingen konkurrerende mekanikk å kollidere med.

### Institutional Learnings

- **`docs/solutions/ui-bugs/google-maps-3d-marker-template-swap-spokelser-20260823.md`** — et
  `<gmp-marker-interactive>`-element må aldri bytte tagnavn i sin levetid; Google fortsetter å tegne
  den fjernede markørens tekstur. Ankeret skal derfor være en vanlig markør med annet innhold, ikke
  et nytt elementslag.
- **`PoiMarkerContent.tsx:21-33`** — markør-vertsboksen må forbli kvadratisk. Googles anker er
  `-50% / -100%` av elementets egen boks; en label i flyten gjorde boksen 132 px bred og flyttet
  markøren 46 px. Et bredt anker-badge i flyten vil ha samme feil.
- **«Google-søketyper må måles, ikke leses»** — bekreftet på nytt her: `shopping_mall` bærer
  restauranter og parkeringsplasser.
- **«Dedupen hører i hydreringen, ikke i lenkingen» (2026-08-24)** — `project_pois` er poolen som
  bærer precomputede reisetider; en visnings-beslutning skal ikke droppe rader derfra.
- **Nivå-modellen (2026-07-07)** — nivå 1 må virke uten kuratering. Anker-oppløsningen må derfor
  være deterministisk, ikke en manuell SQL-migrasjon per senter slik 057/058 var.
- **«Positive påstander alene» (FAQ-regelen)** — registeret er recall-begrenset og kan aldri påstå
  å være komplett. Dagens `anchor_summary`-formulering «og mer» er allerede den erkjennelsen.

### Terminologi

Ordet **pool** er opptatt: `v2.project_pois` er prosjektets fulle POI-beholdning. Bruk **anker** om
senteret og **medlem** om butikkene inni, gjennomgående i kode, tester og dokumentasjon.

## Key Technical Decisions

### 1. Containment, ikke geometri

Medlemskap avgjøres av at stedene deler bygg — ikke av at markørene deres kolliderer på skjermen.
Gruppen er dermed stabil på tvers av zoom, rotasjon og render, og kan beregnes én gang i pipelinen.

### 2. Ankeret defineres av at det HAR medlemmer

Kandidat-ankre plukkes bredt (`category_id = shopping`), men et anker som ikke samler minst fire
medlemmer er ikke et anker — det er en butikk Google har feilmerket. Regelen er selvkorrigerende og
krever ingen kuratert liste over «ekte» kjøpesentre: «Tem Im thaimat» og «Parkering ikea leangen»
faller ut av seg selv fordi ingenting oppløses inn i dem.

Terskelen er **fire**. Under det håndterer `spread-co-located` allerede saken, og gevinsten ved å
skjule tre pins bak én er mindre enn tapet av tre navn.

Marginen er tynn i den nedre enden og skal måles, ikke antas: Vikhammer senteret har nøyaktig fem
medlemmer i basen. Mister recall ett av dem, står vi på terskelen. Unit 8 rapporterer derfor hvor
mange ankre som lander på 4–5 medlemmer, så tallet kan justeres på data i stedet for på følelse.

### 3. Medlemskap: to alternative gater, felles ytre skranke

De to tilfellene vi har målt feiler på hver sin gate, så begge må finnes — som ALTERNATIVER, ikke
som krav som begge må oppfylles:

- **Sirkus Shopping:** ankeret deler adresse med medlemmene, men ligger ~150 m fra de fjerneste av
  dem (koordinaten sitter i byggets sørøstre hjørne, byte-identisk med Levi's Store). Ren radius
  bommer skjevt. **Adresse-gaten redder den.**
- **Vikhammer senteret:** ankeret står på «Utsikten 13» mens medlemmene står på «Stasjonsvegen 1» —
  ulike gatenavn — men alt ligger innenfor 25 m. Ren adresse-match gir null medlemmer.
  **Radius-gaten redder den.**

```
medlem(p, anker) ⟺
      p.category_id != "shopping"
  AND haversine(p, anker) ≤ MAX_MEMBER_DISTANCE_M           // felles ytre skranke
  AND (
          harHusnummer(p.address)
          AND normalisertGate(p.address) == normalisertGate(anker.address)
          AND husnummer(p.address) ∈ husnummerSett(anker)   // adresse-gaten
        OR
          haversine(p, anker) ≤ TIGHT_RADIUS_M              // nærhets-gaten
      )
```

`husnummerSett` bygges per anker fra husnumrene som faktisk forekommer innenfor `TIGHT_RADIUS_M` av
ankeret — det er slik Sirkus' 1/5/9 fanges uten å dra inn 35/38 (som ligger opptil 419 m unna).

`harHusnummer` er ikke pynt: målingen fant 42 POI-er med adressen «Trondheim» og ingenting mer, pluss
tilsvarende for Oslo, Bergen og Ranheim. Uten husnummer-kravet ville alle POI-er i en by kollapset
til én klynge.

Navne-suffikset («X Sirkus Shopping») brukes som **tie-break** når to ankre konkurrerer om samme
medlem — ikke som selvstendig gate, gitt «Sirkusparken»-treffet 1,5 km unna. Tie-break er nødvendig
på Lade, der Lade Arena, Hangaren og City Lade ligger 305–520 m fra hverandre.

### 4. Anker-oppløsning er global, ikke per prosjekt

`parent_poi_id` ligger på `v2.pois`, som deles av alle prosjekter. Oppløsningen kjøres derfor mot
poolen, ikke mot ett boards utvalg, og amortiseres over alle boards som rører samme bygg. Det er
samme økonomi som Lokalkunnskap-moaten: kurér stedet én gang, høst det på hver bolig.

### 5. `anchor_summary` genereres deterministisk

Ikke LLM, ikke kuratering. Teksten bygges av medlemmenes kategorier, sortert på antall, med
«og mer»-hale når lista kuttes:

> «Dagligvare, apotek, vinmonopol, frisør, 12 klesbutikker og mer»

Det oppfyller minimum-garantien for nivå 1 og gir kuratering en plass å overstyre senere uten at
noe er avhengig av at den finnes.

### 6. Anker-søk er et eget discovery-pass

Prosjektets discovery-radius (3 000 m, hardt tak) styrer vanlige POI-er og skal ikke endres — den er
begrunnet i `report-defaults.ts:154-176` og bærer riktig premiss for enkeltsteder. Ankre får i
stedet et eget søk: `shopping_mall` mot et større område, der **de tre nærmeste ankrene** tas med
uansett avstand, i tillegg til alle innenfor prosjektsirkelen.

«De N nærmeste» framfor en fast radius fordi «nærsenter» er relativt: Wesselsløkkas ligger 500 m
unna, Vikhammers 473 m, og Sundsøyas 12,1 km. En fast radius bommer begge veier; et antall tilpasser
seg selv og treffer rural-tilfellet.

Sundsøya er per i dag det ENESTE målte boardet der nærmeste `shopping_mall` ligger utenfor 3 000 m.
Regelen bæres altså av rural-tilfellet alene — men det er nettopp det tilfellet der inkumbenten
(FINNs Nærområdet-kart) er svakest, så den er verdt å bygge selv om den fyrer sjelden.

Medlemmene til et anker utenfor prosjektsirkelen importeres ikke — bare ankeret. Registeret for
slike ankre bæres av `editorial_hook` og de medlemmene som eventuelt allerede finnes i poolen.

### 7. Ankeret er en vanlig markør med annet innhold

Ikke et nytt elementslag. `PoiMarkerContent` får en tredje modus ved siden av `compact`, i samme
kvadratiske 40×40-boks. Det unngår spøkelses-tekstur-fella og holder ankeret utenfor
markør-livssyklusen som allerede er kjent skjør.

Ankeret får `Infinity`-prioritet i `computePinDemotions` — samme mekanisme som aktiv POI bruker i
dag (`use-3d-marker-declutter.ts:401-402`), altså null ny kode i utglisningen.

### 8. Medlemmer unntas `spread-co-located`

Spredning og anker løser samme problem med motsatt grep. Når et punkt er medlem av et anker, skal
det ikke viftes ut — det skal ikke tegnes i det hele tatt. Medlems-ID-ene filtreres derfor bort før
`computeSpreadCoordinates` kalles (`board-data.ts:253`), ikke etter.

## Open Questions

### Resolved During Planning

- **Clustering eller containment?** Containment. Fire konkrete feilmoduser ved clustering er
  dokumentert i Problem Frame; den avgjørende er at identiske koordinater aldri løser seg opp.
- **FINN-mønsteret eller register?** Register. FINNs karusell forutsetter likeverdige objekter og
  krever N klikk for N steder; den bryter dessuten mot kategori-navbaren som eneste transport.
- **Ny action i `board-state` eller gjenbruk av `OPEN_POI`?** Gjenbruk. Ankeret *er* en POI; det er
  innholdet i flaten som skiller seg. Ingen ny fase, ingen nye lesere av `phase === "poi"`.
- **Skal `category_id = shopping` alene definere ankeret?** Nei — verifisert at typen bærer
  restauranter, parkeringsplasser og nettbutikker. Andre gate er «har ≥4 medlemmer».
- **Skal Lade bli ett anker?** Nei. 69 POI-er over 500 m er et handelsområde. Det blir 2–3 ankre med
  hver sin stramme klynge; «handelsområde» som eget begrep er deferred.
- **Manuell tagging som i 057/058?** Nei — bryter nivå-1-garantien om at ting skal virke uten
  kuratering.
- **Skal `containingPlaces` være primærgate?** JA — målt 2026-08-27 i Unit 1. Rundt Sirkus Shopping
  bar **47 av 52 steder** feltet, alle med samme container-id (`ChIJVZdRQJoxbUYRTcToJ4smjeM`, som er
  vår egen `google-`-id). De fem uten lå faktisk utenfor bygget: EkoMarket, Olivenlunden, Peppes
  Pizza Leangen, Leangen Hårsenter, H2 Frisør — altså naboene over gata. Feltet er både presist og
  har høy recall på store sentre. Rundt Vikhammer senteret bar **0 av 5** det, så heuristikken må
  fortsatt finnes. Verifisert også at Valentinlyst Vinmonopol peker på `ChIJnW_zJ20xbUYRqaLffSVJpgY`
  = Valentinlyst Senter, samme id som 057/058 satte for hånd.
- **Hva vinner når to ankre deler adresse?** Google gir BÅDE «Sirkus Shopping» og «Falkenborgvegen 3»
  typen `shopping_mall`, 62 m fra hverandre, med samme gate og husnummer-sett. Nærmeste-vinner
  splittet Sirkus' 60 medlemmer omtrent i to (målt: 19). Diskriminatoren som virker er **ankerets
  egen registrerte adresse**: 26 kandidater bærer Sirkus' eget husnummer (1), mot 1 for
  Falkenborgvegen 3. Rangering på (containment-treff, egen-nummer-støtte, totalt krav, id) gir Sirkus
  hele klyngen, og Falkenborgvegen 3 faller på ≥4-terskelen med 3 medlemmer.

### Deferred to Implementation

- **Nøyaktig `MAX_MEMBER_DISTANCE_M`.** Startverdi 120 m, kalibreres mot Sirkus (der 419 m-halen
  skal falle ut) og Lade (der de tre ankrene skal skille seg). Tallet er ment å justeres på data.
- **Hvordan barn utenfor forelderens tema skal telle.** `report-data.ts:605` har allerede en
  cross-theme-guard som lar et barn overleve når forelderen ikke er i temaet. Regelen skal
  gjennomgås mot R4 (kategori-oppfyllelse) under implementasjon.
- **Nøyaktig SKU-kostnad for `containingPlaces` i `searchNearby`.** Feltet returneres (målt, se
  Resolved), men hvilken pristier feltmasken havner i er ikke verifisert mot faktisk fakturering.
  Måles på første kjøring i Unit 2.

## High-Level Technical Design

```
PIPELINE (én gang per bygg, delt av alle boards)
  discovery ──┬── vanlige POI-er, radius 3 000 m           (uendret)
              └── anker-pass: shopping_mall, de 3 nærmeste  (Unit 3)
                        │
  anker-oppløsning ─────┴──► v2.pois.parent_poi_id          (Unit 1 + 2)
                             v2.pois.anchor_summary
                        │
  hydrering (uendret — poolen beholder alle rader og reisetidene sine)

LESESTI
  v2-queries ──► POI { parentPoiId, anchorSummary }        (finnes)
       │
  transformToReportData                                     (Unit 4)
       ├── barn filtreres når forelder er i temaet          (finnes, :605-608)
       ├── childPOIs festes på forelder                     (finnes, :607)
       ├── anker overlever avstandsfilter                   (NY)
       ├── anker oppfyller barnas kategorier                (NY)
       └── anker teller som én i stats                      (finnes for hero, :540 — utvides)
       │
  adaptBoardData ──► BoardPOI                               (Unit 5)
       ├── medlemmer unntas computeSpreadCoordinates        (NY)
       └── isAnchor + childPOIs bæres videre                (NY)
       │
  3D-declutter ──► anker får Infinity-prioritet             (Unit 5)
       │
  OPEN_POI ──► POIExploreModal ──► innholdsregister         (Unit 6)
       │
  kategorifilter ──► anker representerer treffene           (Unit 7)
```

## Implementation Units

### Unit 1 — `lib/board/anchor-membership.ts`: adresse-normalisering og medlemskap ✅ FERDIG

Ren funksjon, ingen I/O, ingen nettverk. Samme kontrakt som `pin-declutter.ts`: kalleren skaffer
data, denne bestemmer.

```ts
export interface AnchorCandidate { id: string; name: string; address: string | null; lat: number; lng: number }
export interface MemberCandidate { id: string; name: string; address: string | null; lat: number; lng: number; categoryId: string | null }

export function resolveAnchors(
  candidates: readonly AnchorCandidate[],
  pois: readonly MemberCandidate[],
  options?: { maxMemberDistanceM?: number; minMembers?: number },
): { anchors: Array<{ anchorId: string; memberIds: string[]; houseNumbers: string[] }>; parentByPoiId: Map<string, string> }
```

Tester må dekke de faktiske adresse-formene fra prod: «Nye lokaler, Falkenborgvegen 5, i 1 etg,
Trondheim», «Peder Falcks veg 3, 8, Trondheim», «Falkenborgvegen 4-6», «SIRKUS SHOPPING,
Falkenborgvegen 1, Trondheim», samt de negative tilfellene («Sirkusparken» 1,5 km unna skal ikke
bli medlem; «Tem Im thaimat» skal ikke bli anker).

Fixture: de 533 POI-ene fra Strindfjordvegen 10 PLUSS de 35 fra Vikhammer-bboxen (som dekker
OR-gaten), lagret som testfixture. Akseptanse: Sirkus samler
55–60 medlemmer (husnummer 1/5/9) via adresse-gaten, Falkenborgvegen 35/38-halen faller ut, Lade
blir 2–3 ankre (Lade Arena, Hangaren, City Lade — 305/490/520 m fra hverandre), og Vikhammer
senteret samler sine fem via nærhets-gaten selv om gatenavnet er et annet.

**Resultat (2026-08-27, branch `feat/kjopesenter-anker`).** `lib/board/anchor-membership.ts` +
`anchor-membership.test.ts` + fixture med ekte prod-data. 23 tester grønne; full pakke 3 155 tester,
`tsc` rent, lint 0 errors.

Kjørt mot fixturen:

| Board | Ankre | Medlemmer absorbert | Topp-nivå |
|---|---|---|---|
| Strindfjordvegen 10 | 5 | 98 av 533 (18 %) | 533 → 435 |
| Vikhammer | 1 | 5 av 35 | 35 → 30 |

Ankrene: Sirkus Shopping 60 (husnr. 1/5/9/31), Lade Arena 13, Grilstad mall 9, Hangaren Lade 9,
City Lade 7, Vikhammer senteret 5. De fire på Lade stjeler ikke hverandres medlemmer.

Forkastet på ≥4-terskelen: «Falkenborgvegen 3» (3 medlemmer) og «Parkering ikea leangen» (3), pluss
25 kandidater med null. Realitets-gaten virker som tiltenkt.

**Uavhengig validering av grensen.** Heuristikken tar med INTERSPORT (Falkenborgvegen 31, 39 m —
ligger midt i Sirkus, Google har bare gitt den et annet husnummer) og utelater hele 35/35C/38-gruppa
på 151–409 m: Peppes Pizza Leangen, Leangen Hårsenter, Gildheim Legesenter, Abelgården Tannklinikk,
Feelgood. **Det er nøyaktig samme grense som Googles `containingPlaces` trekker** — de fem stedene
API-et utelater er de samme naboene over gata. To uavhengige metoder er enige om hvor bygget slutter.

Merk at målingen ga 60 medlemmer for Sirkus mot 59 fra ren adresse-telling; differansen er
INTERSPORT, altså en ekte gevinst fra nærhets-gaten.

### Unit 2 — Pipeline-steg: skriv `parent_poi_id` og `anchor_summary` ✅ FERDIG

Nytt steg i `lib/pipeline/provision.ts`, plassert **etter** discovery (4) og trust (5), **før**
hydrering (6) — hydreringen skal se det ferdige hierarkiet.

Steget kjører `resolveAnchors` mot poolen (`v2.pois` innenfor prosjektets bbox, utvidet med
anker-passets treff), skriver `parent_poi_id` på medlemmene og genererer `anchor_summary` på ankeret
fra medlemmenes kategorier.

**Forutsetning:** `places.containingPlaces` må legges i feltmasken i `lib/pipeline/poi-discovery.ts`
(`:317`-området) og lagres. Feltet finnes ikke i `v2.pois` i dag; enten ny kolonne eller nøkkel i
`poi_metadata` (som er tom i prod). Uten det faller alt tilbake på adresse-heuristikken, som er
målt til å gi riktig svar på Sirkus, men som er svakere der ankre deler gate.

Idempotent: et anker som mister medlemmer skal få `parent_poi_id` nullet på dem. Skriv en
angre-tagg i `poi_metadata` (`anchor_resolution: '<dato>'`) etter mønsteret fra
`pool_migration='074'`, så oppløsningen kan rulles tilbake.

Fail-soft som discovery/trust: samler warnings, aborterer ikke provisjoneringen.

Backfill-migrasjon for eksisterende boards kjøres som del av Unit 8.

**Resultat (2026-08-27, branch `feat/kjopesenter-anker`).**

| Leveranse | Fil |
|---|---|
| Migrasjon (KJØRT mot prod) | `supabase/migrations/090_anker_containment_v2.sql` |
| Containment fra Google | `lib/pipeline/poi-discovery.ts` (feltmaske + `containedInIds`) |
| Persistering | `lib/supabase/mutations.ts`, `lib/pipeline/import-pois.ts`, `app/api/admin/import/route.ts` |
| Pipeline-steget | `lib/pipeline/resolve-anchors-step.ts` + test (17 tester) |
| Innkobling | `lib/pipeline/provision.ts` — Steg 5b, mellom trust og hydrering |

Full pakke 3 175 tester grønne, `tsc` rent, lint 0 errors. Migrasjon 090 kjørt og verifisert:
`contained_in_ids` finnes, FK + CHECK + delvis indeks på `parent_poi_id` er på plass (070_baseline
gjenskapte kolonnen bar da `public` ble droppet i 075), 0 foreldreløse pekere å rydde.

**`containingPlaces` er verifisert i produksjons-feltmasken, ikke bare i teorien.** Kjørt mot
`places:searchNearby` med nøyaktig den masken pipelinen sender: 20 av 20 `clothing_store` innen
300 m av Sirkus bar feltet, alle med senterets egen place-id. Feltet ligger i **Pro**-SKU-en (samme
nivå som `displayName`/`businessStatus`), og masken ber alt om `rating`/`userRatingCount`
(Enterprise) — tillegget hever ikke prisnivået.

**Egen kolonne, ikke `poi_metadata`.** Planen åpnet for begge. `poi_metadata` viste seg å være et
BEVART felt i upsert-stien (`upsertPOIsWithEditorialPreservation` skriver alltid
`existing?.poi_metadata`, aldri importdataens), så containment der ville krevd at hele
metadata-bevaringen ble bygd om fra overskriv til flett — for alle kallere. Presedensen for cachet
Google-data per POI er egne kolonner (`opening_hours_json`, `grounding`, `gallery_images`).

**Målt mot den ekte poolen (533 POI-er, Strindfjordvegen 10):**

| Anker | Medlemmer | `anchor_summary` |
|---|---|---|
| Sirkus Shopping | 60 | «Butikk, frisør, restaurant, kafé, legesenter og mer» |
| Lade Arena | 13 | «Butikk, ladestasjon, dagligvare og restaurant» |
| Hangaren Lade | 9 | «Butikk, bakeri, legesenter og treningssenter» |
| Grilstad mall | 9 | «Butikk, treningssenter, apotek, dagligvare, frisør og mer» |

91 medlemmer absorbert, 533 → 442 topp-nivå (−17 %).

**FIRE ankre, ikke fem — og det er et funn, ikke et avvik.** Unit 1 målte fem fordi den fikk hele
den regionale mall-lista som kandidater. Steget kan bare forankre sentre som faktisk ligger i
prosjektets pool, og **City Lade (Haakon VIIs gt. 9) er ikke der** — Google kjenner det som
`shopping_mall` midt mellom Lade Arena (gt. 12) og Hangaren (gt. 27), men discoveryen importerte det
aldri. Det er nøyaktig hullet Unit 3 lukker, nå med et målt eksempel inne i prosjektsirkelen og ikke
bare det rurale Sundsøya-tilfellet.

**Transport er ikke innhold.** Holdeplasser og bysykkelstativ utelates som medlemskandidater —
bussholdeplassen i inngangen ligger godt innenfor nærhets-gaten, men den er veifinning og skal
beholde sin egen pinne. 25 transport-POI-er på Strindfjordvegen holdes utenfor.

**Kryss-prosjekt-vern.** `parent_poi_id` ligger på den DELTE poolen, ikke per prosjekt. En
eksisterende lenke nulles derfor KUN når ankeret den peker på faktisk ble vurdert i denne kjøringen
— ellers ville et prosjekt hvis radius ikke rekker Sirkus rive ned lenkene et annet prosjekt satte.

**Angre:**

```sql
UPDATE v2.pois SET parent_poi_id = NULL
WHERE parent_poi_id IN (
  SELECT id FROM v2.pois WHERE poi_metadata->>'anchor_resolution' IS NOT NULL
);
UPDATE v2.pois SET anchor_summary = NULL,
       poi_metadata = poi_metadata - 'anchor_resolution'
WHERE poi_metadata->>'anchor_resolution' IS NOT NULL;
```

> **MERGE-PORT: Unit 2 må ikke merges til `main` før Unit 5 er ferdig.**
> `components/variants/report/report-data.ts:605` skjuler allerede et barn fra et tema når
> forelderen ligger i samme tema, og hekter det på som `childPOIs` — men **ingenting rendrer
> `childPOIs`** (eneste treff i kodebasen er typen i `lib/types.ts:101` og linja som setter den).
> Skriver vi `parent_poi_id` før registeret finnes, forsvinner 60 butikker fra handels-temaet uten
> å dukke opp noe sted. Derfor er steget ikke kjørt mot noe prod-board ennå; første kjøring er
> Unit 8, etter at board-laget (Unit 5) og registeret (Unit 6) står.

### Unit 3 — Anker-søk utenfor prosjektsirkelen ✅ FERDIG

| Leveranse | Fil |
|---|---|
| Avstandsrangert `shopping_mall`-søk (`rankPreference: DISTANCE`, 20 km) | `lib/pipeline/poi-discovery.ts` — `discoverAnchorCandidates` |
| Utvalgsregelen, ren og testbar | `lib/pipeline/discover-anchors.ts` — `selectAnchorImports` |
| Medlems-probe uten import (realitets-gaten for fjerne ankre) | `lib/pipeline/poi-discovery.ts` — `probeAnchorMembers` |
| Steget, fail-soft | `lib/pipeline/discover-anchors.ts` — `discoverAnchorsForProject` |
| Lagringshalvdelen av importen, løsrevet fra sirkel-søket | `lib/pipeline/import-pois.ts` — `persistDiscoveredPOIs` |
| Innkobling + logging | `lib/pipeline/enrich-report-pois.ts` (steg 2), `lib/pipeline/provision.ts` |

`app/api/admin/import/route.ts:69` (`max(3000)`) er urørt, som planlagt.

**Hvorfor det ikke kunne være «samme søk med større radius».** To gater, ikke én, ville drept de
rurale ankrene uansett hvor stor sirkelen ble: `discoverGooglePlaces` kaster alt utenfor
`config.radius`, OG kvalitetskjeden har sitt eget avstandstak `MAX_POI_DISTANCE_METERS = 4000`
(`poi-quality.ts:78`) som gjelder alle kategorier. Thon Senter Verdal på 12,1 km faller på det taket
selv når sirkelen slipper den gjennom. Det andre taket var ikke kjent da planen ble skrevet.

**Rangering på avstand, ikke popularitet.** `searchNearby` støtter `rankPreference: "DISTANCE"` —
verifisert mot API-et 2026-08-27. Ett kall gir de 20 nærmeste, som trivielt inneholder de tre
nærmeste. Alternativet (metnings-oppdeling over 20 km) ville kostet opptil 21 kall for det samme
svaret. Standardpasset rangerer fortsatt på popularitet; testen pinner at det ikke lekker.

**Målt utvalg, alle sju provisjonerte boards (2026-08-27, lese-only tørrkjøring):**

| Board | Kandidater | Valgt | Utenfor sirkelen |
|---|---|---|---|
| Strindfjordvegen 10 | 19 | 5 | 0 |
| Grilstad Marina bt. 4 | 19 | 5 | 0 |
| Stasjonskvartalet | 19 | 11 | 0 |
| Wesselsløkka | 19 | 17 | 0 |
| Oppdal Sentrum | 3 | 3 | 0 |
| **Utsikten 6 (Vikhammer)** | 19 | 3 | **2** — Grilstad mall 6,3 km, Sveberg Handelspark 6,4 km |
| **Sundsøya (Inderøy)** | 5 | 3 | **3** — Thon Senter Verdal 12,1, Alti Verdal 12,4, Alti Magneten 14,8 |

Sundsøya-akseptansen er innfridd nøyaktig som beskrevet. To avvik fra planteksten, begge målt:

**1. Vikhammer endrer seg likevel — og funnet er større enn steget.** Planen sa at Vikhammer ikke
ville endre seg. Det stemmer ikke: senteret er det ENESTE innenfor sirkelen, så regelen fyller opp
til tre og henter Grilstad mall og Sveberg Handelspark. Men det virkelige funnet ligger under:
**Vikhammer senteret har verken rating eller anmeldelser hos Google, og faller derfor på
`hasMinimumQualitySignals`.** Det er grunnen til at det ikke finnes i basen — ikke at boardet er
gammelt, slik «Verifiserte fakta» sier. En re-provisjonering i dag ville bommet på nytt. Samme
gjelder Moholtsenteret (Wesselsløkka, 1,4 km) og Decades (Stasjonskvartalet, 0,8 km).

Uten mottiltak er passet AKTIVT skadelig på nettopp de boardene det er bygget for: senteret ryker på
rating, og «de tre nærmeste» fyller de tomme plassene med Grilstad (6,3), Sveberg (6,4) og Hangaren
Lade (8,3 km). Boardet mister nærsenteret sitt og får tre feil i stedet.

**Mottiltaket: rating-gaten gjelder bare utenfor sirkelen.** Innenfor har vi en bedre kilde enn
anmeldelser — poolen selv: oppløses fire virksomheter inn i bygget, er det et senter uansett hva
Google mener (Unit 1s realitets-gate). Utenfor sirkelen importeres ingen medlemmer, så den
kontrollen finnes ikke, og da er Googles egen kjennskap det vi har. `AnchorHit.hasQualitySignals`
rapporterer i stedet for å dømme; `selectAnchorImports` bruker den. Navn-blokklista står uendret —
den er det «Parkering ikea leangen» faller på, i alle sju boards.

**2. City Lade er 3 010 meter unna, ikke et recall-hull.** Unit 2 rapporterte at City Lade «aldri
ble importert av discoveryen» og pekte på Unit 3. Målingen viser noe annet: senteret ligger ti meter
utenfor 3 000-meterssirkelen, og de tre nærmeste ankrene (Grilstad 0,17, Hangaren 2,11, Lade Arena
2,20) ligger alle innenfor. Regelen henter det derfor ikke inn — tilsiktet, den garanterer DEKNING
og utvider ikke sirkelen. Strindfjordvegen 10 blir stående med fire ankre, og det er riktig: City
Lades leietakere ligger like utenfor og finnes heller ikke i poolen, så ingen medlemmer blir
foreldreløse.

**Realitets-gaten for fjerne ankre: tell medlemmene, ikke importer dem** (avgjort med Andreas
2026-08-27). Et anker utenfor sirkelen får ingen medlemmer importert (beslutning 6), og Unit 1
forfremmer bare kandidater med ≥4 medlemmer (beslutning 2) — så Thon Senter Verdal ville landet som
et vanlig `shopping`-sted mens akseptansen sier «som ankre». Løsningen er at kravet i beslutning 2
er at fire virksomheter FINNES i bygget, ikke at de ligger i basen. Begge beslutningene står.

`probeAnchorMembers` er ett type-løst `searchNearby` på 120 m rundt ankeret, der treffene filtreres
på `containingPlaces`. Målt mot Thon Senter Verdal: 20 steder innen 120 m, 19 av dem peker på
senteret — Rema 1000, Vitusapotek, Intersport, Nille, Telenor, Helseloftet. Ett kall gir både beviset
og råstoffet til `anchor_summary`, uten at én butikk havner i basen. Et fjernt senter som ikke består
firetallet importeres ikke i det hele tatt, og loggen sier hvem og hvorfor.

Målt på alle fem fjerne ankre passet faktisk ville importert (lese-only, 2026-08-27):

| Anker | Avstand | Virksomheter | `anchor_summary` |
|---|---|---|---|
| Thon Senter Verdal | 12,1 km | minst 19 | «Butikk, apotek, dagligvare og hotell» |
| Alti Verdal | 12,4 km | minst 5 | «Butikk og dagligvare» |
| Alti Magneten Mall | 14,8 km | minst 19 | «Butikk og kafé» |
| Grilstad mall | 6,3 km | minst 19 | «Butikk, apotek, frisør, post, restaurant og mer» |
| Sveberg Handelspark | 6,4 km | minst 17 | «Butikk, dagligvare, apotek, drivstoff, frisør og mer» |

Alle fem består. «Minst» er Googles tak på 20 treff per kall — nok både for firetallet og for
«og mer»-halen. Tynne tekster («Butikk og kafé» for 19 leietakere) skyldes at mange leietakere bærer
typer `GOOGLE_CATEGORY_MAP` ikke kjenner; den blir bedre når kartet vokser, uten at noe her endres.

**`anchor_summary IS NOT NULL` er ankerflagget** — uansett hvilken av de to veiene stedet kom inn:
poolen (`resolve-anchors-step`, Unit 2) eller proben (dette steget). Unit 4 skal lese den, ikke
telle barn. Angre-taggen for proben er `poi_metadata.anchor_probe`:

```sql
UPDATE v2.pois SET anchor_summary = NULL, poi_metadata = poi_metadata - 'anchor_probe'
WHERE poi_metadata->>'anchor_probe' IS NOT NULL;
```

**Kostnad:** ett `searchNearby` per provisjonering, pluss ett per fjernt anker (maks tre, og bare på
boards som mangler sentre i nærheten). Urbane boards betaler ett kall totalt.

**Ikke kjørt mot prod.** Steget er koblet inn i provisjoneringen, men ingen board er re-provisjonert
— samme merge-port som Unit 2 (se der).

### Unit 4 — Anker-reglene i `report-data.ts` ✅ FERDIG

| Leveranse | Sted |
|---|---|
| Ankerpredikat, delt med board-laget | `report-data.ts` — `isAnchorPOI` |
| R4: løft ankeret inn i temaet barnet hører til | `report-data.ts` — `withRepresentingAnchors` |
| R5 + register: ankeret absorberer barna og bærer dem videre | `transformToReportData`, tema-løkka |

**Ankerflagget er `anchorSummary`, ikke antall barn.** Teksten skrives kun av de to stedene som har
bevist at bygget samler minst fire virksomheter — `resolve-anchors-step` (teller i poolen) og
`discover-anchors` (teller hos Google uten å importere). Å telle barn her ville gjort Thon Senter
Verdal usynlig på Sundsøya: det ankeret har null barn i basen og er like fullt et kjøpesenter.
Feiler tekst-skrivingen — begge stegene er fail-soft — oppfører stedet seg som i dag, barna vises
hver for seg. Ingenting forsvinner.

**Absorpsjonen flyttet fra «enhver forelder i temaet» til «ankeret i temaet».** Linja på :605
absorberte tidligere barn under et hvilket som helst toppnivå-sted som lå i temaet. Nå er det
ankeret som absorberer, slik at en pipeline-skrivefeil gir dagens board i stedet for seksti butikker
skjult bak en forelder ingenting rendrer.

**Registeret er TEMA-avgrenset.** `childPOIs` på et Sirkus-kort i «Mat & Drikke» lister de åtte
spisestedene i senteret, ikke de femti butikkene. Det er et annet spørsmål enn registeret i
POI-flaten (Unit 5/6), som skal være komplett — temaet svarer på «hva gir dette senteret meg HER».

**R2 krevde ingen kode, og det er et funn.** Planen forutsatte at ankeret måtte unntas fra
`maxCount`- og avstands-porter. De finnes ikke lenger: `maxCount` ble slettet 2026-08-24 (kommentaren
i `CATEGORY_FILTER_RULES` forklarer hvorfor), gangtids-porten er borte, og `isWithinTimeBudget`
(`lib/utils.ts:23`) har **null kallere**. Eneste gjenværende filter er skolekrets, som et
kjøpesenter aldri treffer. Å legge inn et unntak fra et filter som ikke finnes ville vært dead code.
`splitVisibleHidden` skjuler fortsatt bak «Hent flere», men kaster ingenting.

**Målt effekt på det ekte 533-POI-settet fra Strindfjordvegen 10** (lese-only, temaene som et
faktisk provisjonert board har dem):

| Tema | Før | Etter | Register |
|---|---|---|---|
| **Hverdagsliv** | **194** | **122** | Sirkus (50), Lade Arena (9), Hangaren (7), Grilstad mall (6) |
| Mat & Drikke | 41 | 34 | Sirkus (8), Lade Arena (1), Hangaren (1), Grilstad (1) |
| Transport & Mobilitet | 56 | 54 | Lade Arena (3), Sirkus (1) |
| Trening & Aktivitet | 24 | 23 | Grilstad (2), Hangaren (1), Sirkus (1) |
| Barn & Oppvekst | 161 | 161 | — |
| Natur & Friluftsliv | 52 | 52 | — |

Hero-tallet går 533 → 435. «Hverdagsliv drukner» fra Problem Frame — 136 steder der 66 av 68
butikker lå på Lade/Sirkus — er dermed målt løst: temaet går fra 194 til 122, og de fire sentrene
står som fire kort med hvert sitt register i stedet for 72 løse rader.

Merk at Mat & Drikke, Transport og Trening ikke faller like mye som de absorberer: der løftes
ankeret INN som representant (R4), så nettoen er absorberte minus løftede. Det er hele poenget —
treningssenteret inne i Sirkus står ikke lenger alene på senterets koordinat uten å si hvor det er.

### Unit 5 — Board-laget: anker gjennom til markøren ✅ FERDIG

| Leveranse | Sted |
|---|---|
| Ankerpredikatet, flyttet ut av rapport-laget | `lib/board/anchor-poi.ts` — `isAnchorPOI` |
| `isAnchor` + `childPOIs` eksplisitt på `BoardPOI` | `board-data.ts` — `adaptPOI` |
| Aldri demotert til prikk | `use-3d-marker-declutter.ts` — `priorityOf` |
| Tredje markør-modus: `+`-merket | `PoiMarkerContent.tsx`, `map-view-3d.tsx` |

**Predikatet flyttet til `lib/board/`.** Tre lag spør om det samme — temaene (`report-data`),
markørene (`map-view-3d`) og utglisningen (`use-3d-marker-declutter`) — og ingen av dem skal
importere fra rapport-laget for å få svaret.

**`Infinity`-grenen var aldri kjørt med mer enn én kandidat.** Bare aktiv POI hadde den, så
`computePinDemotions` hadde aldri sortert to uendelige mot hverandre. Nå får hvert anker den, og på
Lade ligger tre av dem 305–520 m fra hverandre. Sorteringen regner `Infinity - Infinity` = `NaN`,
som er falsy, så id-tiebreaken tar over og resultatet er deterministisk — låst med test, ikke antatt.

**`+`-merket er kvalitativt med vilje.** «60» er FINN-mønsteret vi forkastet: det forutsetter
likeverdige objekter, og for en boligkjøper er spørsmålet «har senteret det jeg trenger», ikke «hvor
mange leietakere har det». Et eksplisitt tall vinner fortsatt over `+`, så Guide-turrekkefølgen er
urørt.

**Pin-spredningen trengte ingen medlems-filtrering.** Planen ba om å filtre medlems-ID-er bort før
`computeSpreadCoordinates` (:253). Unit 4 gjør det allerede oppstrøms — `report-data` absorberer
medlemmene inn i ankeret — så spredningen ser aldri de tjueåtte byte-identiske koordinatene på
Falkenborgvegen 1. Et filter her ville vært dead code.

**Verifisert i browser** (Chrome 151, ren profil, Strindfjordvegen 10 på dev):

- 465 markører, 17 labels, `gmp-map-3d` oppe, **null console-feil**
- markør-boksen er 42×42 (40 + kant) og `data-placy-marker` sitter på verten — ankeret arver den
  gratis, siden det går gjennom samme `Marker3DItem` → `DomMarker3D` som alle andre
- markørklikk åpner popupen som før
- badge-sloten (`top: -2 / right: -2`) har **aldri vært rendret i produksjon** — `number` sendes
  ingen steder fra, så `+` blir dens første bruker. Injisert med identisk markup i browser: den
  stikker 2 px ut opp og til høyre, og **markør-boksen forblir 42×42**. Det siste er invarianten alt
  ankeret hviler på (`anchorLeft: -50%` er prosent av elementets EGEN boks); vokste boksen, ville
  hver markør vandret bort fra punktet sitt.

Anker-markørens egne visuelle uttrykk kan ikke ses på et ekte board ennå — ingen prod-board har
`anchor_summary`. Det skjer i Unit 8.

**2D er urørt**, som planlagt: `BoardMarker.tsx` arver gratis at datasettet er mindre, og har ingen
egen anker-modus. Merk konsekvensen: `+`-merket finnes bare i 3D. 3D er default-motoren, så det er
det de fleste ser — men de to flatene divergerer visuelt til noen bestemmer noe annet.

### Unit 6 — Innholdsregisteret i POI-flaten

`POIExploreModal` får en anker-variant: reisetid øverst (uendret), `editorial_hook` (finnes alt på
Sirkus), deretter registeret gruppert på Placy-kategorier med medlemsnavn — Apples Browse
Directory-modell.

Ingen piler, ingen «1 av N», ingen ny navigasjonsmekanikk. En kategori-rad er trykkbar og filtrerer
til de medlemmene; det er samme drill-in-affordans som `DesktopStorySidebar.tsx:320` allerede bruker.

Mobil bruker samme modal (den ER mobilens POI-flate, `POIExploreModalHost.tsx:69`); desktop får
registeret i mini-popupen bak «Utforsk».

### Unit 7 — Filter-oppførsel

Når brukeren har valgt én kategori, skal ankeret representere kun treffene i den kategorien: navn
blir «Vinmonopolet — i Sirkus Shopping», og registeret åpner på den kategorien. Uten dette mister
filteret mening for alt som ligger inne i et senter.

Berører `use-board-marker-set.ts:141` (`selectMarkerPOIs`) og markørens labeltekst.

### Unit 8 — Sirkus og Lade i prod, verifisert

- **Recall-sjekk først.** Anker-oppløsningen kan ikke finne et senter som ikke er importert.
  `konsulent-harstad_utsikten-6-…` har 44 POI-er og null i `shopping` selv om Vikhammer senteret
  ligger 473 m unna. Årsaken er funnet i Unit 3 (senteret har ingen Google-anmeldelser) og
  anker-passet retter den, men bare ved re-provisjonering: **en backfill mot eksisterende data
  finner fortsatt ingenting**, siden radene aldri ble skrevet. Kjør derfor anker-passet per board
  FØR oppløsningen, og rapporter hvilke boards som fikk nye sentre.
- Backfill-migrasjon som kjører anker-oppløsningen mot hele `v2.pois` (5 883 rader), med
  angre-tagg.
- Re-provisjonering eller målrettet re-hydrering av de berørte boardene, med cache-bust på riktig
  flate (`revalidateTag`) — Next-cachen, ikke pipelinen, er det som viser gamle tall.
- Verifisering i browser på både 3D og 2D, mobil og desktop: Sirkus er én markør, registeret lister
  medlemmene, Hverdagsliv-tellingen er nede fra 136, `Vinmonopol`-filteret peker på Sirkus.
- Rapporter fullstendighet: X ankre opprettet av Y kandidater, Z POI-er ble medlemmer, W kandidater
  falt på ≥4-terskelen, og hvor mange ankre som landet på 4–5 medlemmer (terskel-marginen).
  Utgangspunkt: 46 adresse-klynger med ≥4 medlemmer finnes i poolen i dag, 20 av dem med et
  `shopping_mall` innen 150 m.

## System-Wide Impact

| Område | Effekt |
|---|---|
| `v2.pois` | `parent_poi_id` + `anchor_summary` fylles for første gang i skala. Ingen skjemaendring. |
| `v2.project_pois` | Uendret. Poolen beholder alle rader og reisetidene sine — medlemskap er en visnings-egenskap. |
| Hero-metrikker | `totalPOIs` faller på boards med sentre. Strindfjordvegen 10: 533 → ~400 topp-nivå. Forventet og ønsket. |
| Kategori-tellinger | Hverdagsliv på Strindfjordvegen 10 går fra 136 steder til vesentlig færre. Løser det åpne punktet fra 2026-08-24. |
| FAQ-generatoren | `generateCategoryFaq` får `allPois` (hele settet) og `pois` (filtrert). Svar som teller opp steder må telle ankeret som én. Sjekk gap-rapporten etter Unit 4. |
| `components/variants/report/board/blob-pois.ts` | Blob-prikkene tegnes fra board-POI-ene; færre punkter gir tynnere blobs rundt sentre. Verifiser visuelt. |
| Reels / capture | Markørsettet endres; `?film=1` skjuler pins uansett. Verifiser at anker-markøren ikke lekker inn i capture. |
| Omvisning | `storyOnRef`-gaten (`BoardMap3D.tsx:384`) må også gjelde anker-klikk. |
| Reisetider | Uendret i DB. Barna arver ankerets tid kun i visningen. |

## Risks & Dependencies

- **Over-gruppering.** Lade viser at én gateadresse kan spenne 500 m. Mitigering: husnummer-sett +
  `MAX_MEMBER_DISTANCE_M`, kalibrert mot fixture i Unit 1 før noe skrives til DB.
- **Under-gruppering.** Adresse-fritekst fra Google er rotete; noen medlemmer vil ikke matche.
  Konsekvensen er en enkeltpin ved siden av ankeret — synlig, ikke ødeleggende. Aksepteres i første
  runde og måles i Unit 8.
- **Feil anker vinner.** «Falkenborgvegen 3» og «Parkering ikea leangen» er kandidater. ≥4-terskelen
  og tie-break på navne-suffiks skal fange det; Unit 8 rapporterer hvilke kandidater som ble
  forkastet, så feilene er synlige.
- **Tapt synlighet for kjeder.** En megler kan ønske at Vinmonopolet vises som eget punkt. R4
  (kategori-oppfyllelse) og Unit 7 (filter-oppførsel) er svaret; verifiser at det faktisk føles slik
  i Unit 8, ellers er premisset feil.
- **Markør-livssyklus i 3D.** En POI som går fra egen markør til medlem må unmounte rent —
  spøkelses-tekstur-fella. Mitigering: medlemskap avgjøres i pipelinen og er konstant innenfor en
  økt, så overgangen skjer ikke under kjøring.
- **Backfill mot 5 386 rader.** Skrivende migrasjon mot prod. Angre-tagg i `poi_metadata` er
  påkrevd, og steget kjøres på et board om gangen før full sveip.

## Documentation / Operational Notes

- Loggfør i `PROJECT-LOG.md` når Unit 8 er verifisert, med fullstendighetsrapporten.
- Skriv `docs/solutions/`-doc for anker-mønsteret når det står i prod: hvorfor containment slo
  clustering, hvorfor ≥4-terskelen er selvkorrigerende, og hvilke adresse-former normaliseringen må
  tåle.
- `docs/solutions/`-doc-en fra 2026-04-10 om parent-child eksisterer ikke; april-vedtaket lever bare
  i worklogen. Den nye doc-en erstatter det.
- Oppdater `/provision-rapport`-skillet med anker-steget, så agent-native ops kjenner det.

## Sources & References

- `PROJECT-LOG.md`, «2026-04-10 — Kjøpesenter-anker med parent-child POI-hierarki» — det ratifiserte
  vedtaket, inkl. `anchor_summary`-formatet og cross-theme-guarden.
- `PROJECT-LOG.md`, «2026-04-10 … Retning» — Sirkus Shopping navngitt som neste kandidat.
- `PROJECT-LOG.md`, «2026-08-12 — SCOUT STRAUMEN», dag 2 — punkt-vs-innhold-testene
  (destinasjon/hvor/eierskap), komponent-absorpsjon, entity resolution-skissen.
- `PROJECT-LOG.md`, «2026-08-24 — REMA OG KIWI VAR USYNLIGE FOR PIPELINEN», Åpne punkter — 66 av 68
  butikker på Lade/Sirkus dominerer Hverdagsliv.
- `PROJECT-LOG.md`, «2026-08-23 — LABELS OG PIN-UTGLISNING I 3D-KARTET» — demotering til prikk,
  verifisert nettopp på en kjøpesenter-klynge.
- `supabase/migrations/056_parent_poi_id.sql`, `057_wesselslokka_parent_pois.sql`,
  `058_fix_valentinlyst_children.sql` — den manuelle taggingen som ikke skal gjentas.
- `supabase/migrations/074_poi_pool_migrering_til_v2.sql:104` — `WHERE NOT m.already_in_v2`, årsaken
  til at `anchor_summary` er tapt.
- Google Maps Places API (New), `containingPlaces` — «a list of places in which the current place is
  located». Kandidat til primær medlemskaps-nøkkel, ikke verifisert for norske sentre.
- Google Maps Directory-fane og Apple Maps «Browse Directory» — venue-container-modellen
  registeret bygger på.
- FINN.no karthjelp: «Dersom du ser et pluss tegn (+) på ikonet betyr det at stedet har flere
  annonser.» — kvalitativ badge, ikke tall.
- Map UI Patterns, cluster-marker: alle klyngemarkører må ha samme farge — grunnen til at
  pikselclustering ville drept Placys kategorifarger.
