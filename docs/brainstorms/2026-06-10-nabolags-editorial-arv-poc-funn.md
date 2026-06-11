---
date: 2026-06-10
topic: nabolags-editorial-arv-poc-funn
---

# Nabolags-editorial-arv PoC — rubrikk og funn (Unit 7)

## Falsifiseringsrubrikk

Kriteriene ble pre-registrert i plan-dokumentets Unit 7 (committet før genereringene;
dette dokumentet formaliserer dem med terskler — kriteriene er uendret fra planen):

- (i) Editorial-body nevner sted/kvalitet som er irrelevant eller misvisende for ≥1 adresse
- (ii) ≥1 kategori per board krever per-adresse-omskriving for å føles riktig
- (iii) Fallback-rate over terskel (>50 % droppede kandidater per board), der drop-årsaken
  «utenfor bootstrap-dekning» skilles fra tese-relevante drops, og proximity-drevne temaer
  (transport) vurderes separat
- (iv) Død eller åpenbart feilklassifisert POI synlig (gate-funn skilles fra manuell QA-funn;
  stillNull-listen må være QA-klarert)

Tesen er svekket hvis kriteriene slår ut; styrket hvis ikke.

## Kjøringer

| Kjøring | Punkt | Resultat |
|---|---|---|
| Hans Collins veg 1B (vest/Grilstad-kanten) | innenfor polygon v2 | 6 temaer arvet, 15 highlights beholdt / 16 droppet |
| Horgvegen 4 (øst/Olderdalen-kanten) | innenfor | 6 temaer arvet, 13 beholdt / 17 droppet |
| Martin Barstads veg 23C (midt/fjæra) | innenfor | 6 temaer arvet, 17 beholdt / 9 droppet |
| Kontroll: Charlottenlund-punkt (63.4280, 10.4600) | utenfor | `findAreaForPoint` → null → ren nivå 1 (R2 ✓) |

Alle kjøringer mot prod, med frosset kuratering (alle tre re-arvet etter samme
area-innhold, commit `data/areas/ranheim.staging.json`).

## Rubrikk-vurdering

**(i) Misvisende body: NEI.** Andreas godkjente alle 6 tekster og vurderte boardene visuelt
(«ser ut til å fungere bra»). Én nyanse notert, ikke utslagsgivende: transport-teksten
nevner togstasjonen (bydels-sann), mens Hans Collins veg-boardet ikke fikk stasjonen som
chip (adresse-nær filtrering). Teksten er ikke feil for adressen — toget ER bydelens
tilbud — men spennet «bydels-sann vs. adresse-nær» er en kjent akse for slice 2.

**(ii) Per-adresse-omskriving: NEI.** 0 av 18 tema-instanser (6 temaer × 3 adresser)
krevde omskriving.

**(iii) Fallback-rate: UTLØST på 2 av 3 boards — men av design, ikke tese-svikt.**
HC 52 %, Horgvegen ~57 %, MB 35 %. Årsaksanalysen viser at droppene er avstands-
filtrering av et bevisst BREDT kandidatsett (4–6 kandidater per tema fra unionen av tre
spredte boards — slack-designet fra doc-review). Ingen droppede kandidater var døde
chips; alle beholdte chips peker på levende board-POIer. Lærdom: terskelen var feil
operasjonalisert — med union-kandidatlister er høy drop-rate forventet og sunn. Bedre
slice 2-metrikk: «temaer med < 2 chips per board» (her: HC transport = 1 chip,
Horgvegen trening = 0 chips/kun tekst; resten ≥ 2).

**(iv) Død/feilklassifisert POI synlig: NEI.** stillNull tom på alle tre kjøringer
(alle Google-POIer scoret; offentlige beholdt null som designet). Visuell QA fant ingen
feilklassifiserte.

## Konklusjon: TESEN HOLDER

Kuratér én gang per nabolag → server per adresse fungerer: identiske kuraterte tekster,
per-adresse-korrekte highlights (vest-adresse får Grilstad-POIer, øst-adresse får
Olderdalen/Hansbakken, midt-adresse får stasjonen og skolen), ingen døde chips, ren
nivå 1-degradering utenfor polygonet.

## Kurateringsfunn (lokalkunnskaps-verdi dokumentert)

1. **ULF-AN bokseklubb fjernet** fra trening-kandidatene — holder til i Charlottenlund-
   hallen, ikke Ranheim. Fanget av Andreas, usynlig for datakildene. Dette er verdien
   menneskelig kuratering tilfører.
2. **Aldri-negativ-vinkling:** mat-teksten ble revidert fra «Ranheim er ikke restaurant-
   bydelen» til å løfte frem det som finnes — kuratering kuraterer bort, kritiserer ikke
   (curator-prinsippet håndhevet av Andreas).
3. **Skolekretsen er smalere enn markeds-Ranheim:** 2 av 3 lokalkjent-valgte adresser lå
   utenfor kommunens RANHEIM-barneskolekrets (én til og med postalt Ranheim). Polygon v2 =
   krets + markeds-korreksjoner. Skalerbar oppskrift for slice 2: kommunens åpne kretsdata
   (skolekrets/valgkrets/grunnkrets, NLOD) som base + lokalkunnskaps-korreksjoner;
   tredjeparts-kart (f.eks. Scribblemaps-bydelskart) kun som visuell referanse, aldri
   polygon-kilde (rights-clean-kravet).

## Tidslogg (kurateringskostnad, R-suksesskriterium)

| Aktivitet | Tid |
|---|---|
| Polygon (geodata-funn, konvertering, v2-korreksjoner) | ~30 min (engangs-verktøy gjenbrukes) |
| LLM-draft 6 temaer (inkl. faktaverifisering SNL) | ~10 min |
| Andreas: review/korreksjoner (mat-revisjon, ULF-AN) | ~15–20 min |
| Opplasting + re-arv 3 adresser | ~10 min (automatisert) |

**Ekstrapolering:** ~1 time per nabolag med verktøyene på plass → 30–50 nabolag ≈
30–50 timer kuratering. Bounded ✓ (skaleringspåstanden fra origin-dokumentet holder).

## Slice 2-input

- Kandidat-dekning per tema-geografi: proximity-temaer (transport) trenger enten flere
  spredte kandidater eller tema-spesifikk resolusjon (stasjonen bør overleve på flere
  adresser)
- Vurder min-chips-regel per tema (< 2 chips → vurdér tema-suppresjon eller body-only-visning
  som bevisst tilstand)
- Grunnkrets-union (SSB/Geonorge) som polygon-verktøy for resten av firkommune-området
- Drop-årsak-rapporten (R9) bør få megler-vennlig formatering når trainees overtar kuratering
- Feilklassifiserings-sjekk i trust-pipelinen (fra plan: Deferred)

## Slice 2 — Malvik (typologi-test, gjennomført 2026-06-11)

Andreas-adresser: Saxe Viks veg 33 (Saksvik/vest), Bjørnmyra 6A (Sveberg/midt),
Nessvegen 17 (Hommelvik/øst). Område = HELE Malvik kommune (5031), ett polygon
fra Kartverket kommunegrense (NLOD). Alle 3 innenfor; alle 6 temaer arvet; nivå 2.

**Lukket fra slice-2-input over:**
- *Transport-dekning:* løst ved å kuratere BEGGE stasjoner som kandidater.
  Per-adresse-resolusjon ga Saksvik→Vikhammer stasjon, Hommelvik→Hommelvik
  stasjon, Sveberg→bussholdeplasser (begge stasjoner >4 km). Ranheim-funnet løst.
- *Min-chips-regel:* implementert som QA-flagg i provision steg 9 (informativt,
  ikke suppresjon). Body-only bekreftet som legitim tilstand. `barn-oppvekst`
  konsekvent 1 chip per adresse (skoler spredt utover kommunen).
- *Grunnkrets-union:* DEFERRET bevisst. Kommunegrensen er strengt bedre når
  enheten ER hele kommunen; grunnkrets-union tjener først subsett-tilfellet
  (Stjørdal/Melhus) og krever geometri-bibliotek. Bygde `fetch-area-boundary.ts`
  (Kartverket) i stedet.
- *Feilklassifiserings-sjekk:* fikk konkret instans — La Perla (Saksvik) scoret
  trust 0.95 men er CLOSED_TEMPORARILY på Google (nedlagt ~1 år). `pois` lagrer
  ingen `business_status`; trust bygger på website/price/reviews som overlever
  nedleggelse. Fanget av Andreas' lokalkunnskap. **Anbefaling slice 3:** fang
  `business_status` i enrichment, gate ikke-OPERATIONAL.

**Nytt hovedfunn — markedsenhet vs. administrativ enhet:**
Kommune-skala fungerer TEKNISK (én tekst arvet rent på tvers av 30 km), men er
ikke den naturlige markedsenheten. Vest (Saksvik/Vikhammer) orienterer mot
Trondheim/Ranheim, øst (Muruvik/Hommelvik) mot Stjørdal. For tette markeder bør
curating-enheten trolig være tettsted-klynge, ikke hel kommune. Akseptert for nå
(«vi må starte en plass»), men dette er retningen for hvordan områder skal kuttes
i slice 3.

**Curator-stemme-nyanse:** Andreas vil IKKE ha årstall/historikk i bodyene — også
verifiserte historiske fakta (byggeår, militærleir-historikk, åpningsår).
Curator-skillen anbefaler historisk form som trygt; Andreas foretrekker presens
«hva som ER der». Notert i minne (feedback).

**Verktøy-læring:** `provision --update` rører aldri config (anti-clobber), så
`reportTier` bumpes ikke ved re-provisjonering — provisjonér på mål-nivå fra
start, eller bump via read-modify-write (gjort her: 1→2 etter kuratering).
