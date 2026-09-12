# Kilderevisjon av kuratert Nyhavna-innhold

Kontrollert 12. september 2026 mot Nyhavna Utviklings fire publiserte
«Leve»-sider. Revisjonen gjelder bare de sju kuraterte kartstedene, de åtte
ikke-plasserte omtalene og områdekonteksten i
`lib/demo/nyhavna-leve/knowledge.ts`. Den sier ikke at prosjektets øvrige POI-
database eller hele det sammenslåtte boardet er kontrollert.

## Resultat

| Omfang | Gjennomgått | Bekreftet post | Post med uavklart forhold | Kartmarkør |
|---|---:|---:|---:|---:|
| Kuraterte steder i kartet | 7 | 6 | 1 | 7 |
| Omtaler uten sikker plassering | 8 | 6 | 2 | 0 |
| Områdekontekst | 1 | 1 | 0 | 0 |
| **Totalt** | **16** | **13** | **3** | **7** |

«Post med uavklart forhold» betyr at minst ett felt ikke kan avgjøres fra den
publiserte primærkilden. Bekreftede fakta på samme post kan fortsatt brukes.
Manifestet inneholder 50 atomiske faktaposter: 39 bekreftet og 11 uavklart.
Alle har kilde-ID og kontrolldato.

## Kilder

| Kilde-ID | Side | Brukt for |
|---|---|---|
| `nyhavna-leve` | [Opplev Nyhavna](https://nyhavna.no/leve/) | Områdegrenser, nærhet og overordnet nåsituasjon |
| `nyhavna-servering` | [Café og restauranter](https://nyhavna.no/leve/cafe-og-restauranter/) | Dora Kaffebar, Monkey Brew og serveringskontekst |
| `nyhavna-park-promenade` | [Park og promenade](https://nyhavna.no/leve/park-og-promenade/) | Elvepromenaden og de fem ikke-plasserte grøntområdene |
| `nyhavna-kunst-kultur` | [Kunst og kultur](https://nyhavna.no/leve/kunst-og-kultur/) | Kulturaksen, kulturstedene og tre ikke-plasserte kulturområder |

Dette er kilder eieren av demoen selv publiserer om området. Teksten i
manifestet er korte parafraser. Hver påstand peker på den ene siden som faktisk
bærer påstanden.

## Kontroll per kuratert post

| Post | Beslutning | Kontrollnotat |
|---|---|---|
| Dora Kaffebar | Bekreftet | Type, Kobbes gate 2 og tilbud er uttrykkelig omtalt. Konkrete åpningstider mangler og er registrert som uavklart. |
| Monkey Brew | Bekreftet | Mikrobryggeri, Kobbes gate 10 og produkttype er omtalt. Ukentlig utsalg står på siden, men er tidsfølsomt og mangler egen åpningstidskilde; demoens brødtekst oppgir derfor ikke dagene. |
| Elvepromenaden | Bekreftet | Dagens gang- og sykkelbruk skilles fra planlagt parkutvikling. |
| Kulturaksen i Skippergata | Bekreftet | Navn, prioritering og fire omtalte steder er bekreftet. Kilden avgrenser ikke aksen; kartlinjen er derfor fortsatt merket omtrentlig. |
| Fyringsbunkeren | Bekreftet | Omtalen i kulturaksen og relasjonen til Bunkerparken er bekreftet. Tidligere adresse og kobling til tallet på vernede bygg er fjernet fra teksten fordi siden ikke knytter disse påstandene særskilt til bygget. |
| Dora 2 | Bekreftet | Omtalen i kulturaksen er bekreftet. Tidligere adresse og betegnelsen «ubåtbunker» er fjernet fra teksten fordi denne siden ikke oppgir dem. |
| Bunkerparken | Uavklart | Relasjonen «foran Fyringsbunkeren» og kulturplanen er bekreftet. Siden bruker både nåtidsform og framtidsform; dagens opparbeidelsesstatus er derfor uavklart. Kartpunktet er fortsatt uttrykkelig omtrentlig. |
| Kullkranparken | Bekreftet plan | Grønt nettverk, planlagt aktivitet og naboskap til Kullkranpiren er omtalt. Ingen sikker markørplassering. |
| Jernbaneparken | Bekreftet plan | Omtalt som framtidig grønn lunge. Ingen sikker markørplassering. |
| Transittparken | Bekreftet plan | Omtalt som framtidig grønn lunge. Ingen sikker markørplassering. |
| Elveparken langs Transittkaia | Bekreftet plan | Omtalt som framtidig grønn lunge. Ingen sikker markørplassering. |
| Allmenningene ved Ladehammerkaia | Bekreftet plan | Omtalt som del av framtidig grønt nettverk. Ingen sikker markørplassering. |
| Doratorget | Uavklart | Navnet og mulig kulturbruk er bekreftet, men siden bruker både nåtids- og framtidsform og oppgir ingen presis plassering. |
| Kullkranpiren | Bekreftet plan | Ett prioritert kulturområde med mål om bygg for akustisk musikk. Ingen sikker markørplassering. |
| Strandveikaia | Uavklart | Siden har overskriften «Strandveikaka». Beskrivelsen av vernede bygg og mulig kulturbruk er bekreftet, mens kanonisk navn og avgrensning er uavklart. Begge navneformer ligger som søkbare alias. |
| Nyhavna | Bekreftet | Områdegrensene, gangnærheten og temakonteksten er kildebelagt. Planer er formulert som planer. |

## Rettinger etter kontrollen

Alle 16 poster ble lest i første pass, restlisten ble gjennomgått i et eget
andre pass, og påstander om status, plassering og åpningstid ble kontrollert en
gang til. Følgende innhold ble rettet:

- kontrolldatoen ble oppdatert til 12. september 2026;
- den konkrete ukentlige utsalgstiden for Monkey Brew ble tatt ut av synlig
  brødtekst og beholdt som uavklart faktum;
- kulturtekstene ble skrevet om til korte parafraser med én påstand av gangen;
- adresser for Fyringsbunkeren og Dora 2 og betegnelsen «ubåtbunker» ble fjernet
  fordi de fire reviderte Nyhavna-sidene ikke belegger dem;
- Kulturaksens kartplassering ble eksplisitt merket omtrentlig;
- Bunkerparkens og Doratorgets motstridende tidsform ble registrert som
  uavklart;
- «Strandveikaka» ble bevart som kildealias og navneavvik, uten å late som
  skriveformen er avklart.

Ingen ferdigdato er lagt inn. Ingen av de åtte ikke-plasserte omtalene har fått
kartmarkør. Koordinater og geometri for de sju eksisterende demo-POI-ene kommer
fra den tidligere OSM-baserte kartleveransen og er ikke resertifisert av denne
primærkilderevisjonen.
