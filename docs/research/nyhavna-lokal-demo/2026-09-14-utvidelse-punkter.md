# Flere samtalepunkter i Nyhavna-demoen

Dato: 14. september 2026. Aktivert lokalt på `http://localhost:3103/demo/nyhavna-lokal`.

Andreas ønsket flere steder i kategoriene med lite innhold, med utgangspunkt i tidligere serverings- og oppvekstresearch. Denne runden omfatter 15 navngitte kandidater. Alle 15 er gjennomgått og lagt inn med til sammen 44 kildekoblede fakta. Dette er ikke en fullstendig kartlegging av alle tilbud i nabolaget.

| Kategori | Før | Nå | Nye steder |
|---|---:|---:|---|
| Servering | 4 | 9 | E.C. Dahls, Ramp, Una Solsiden, Godt Brød Solsiden, Sabrura Solsiden |
| Oppvekst | 4 | 9 | Lademoen barnehage, Svartlamon kunst- og kulturbarnehage, Lade fritidsklubb, Strandveiparken, Buranbanen |
| Opplevelser | 1 | 5 | HAVET Arena, Rosendal Teater og Kafé, Monkey Brew, Strandveikaia badeplass |
| Hverdag | 2 | 3 | BUA Lademoen |
| Alle kategorier | 48 | 63 | 15 tillegg; øvrige kategorier beholder sine steder |

## Hvordan det brukes i samtalen

Hvert sted har kort beskrivelse, to eller tre konkrete fakta og relevante forbehold. Kartet og stemmens stedskunnskap leser de samme oppføringene. Det er ikke lagt til flere FAQ-er, tematekster eller avsnitt i introduksjonen. De fire serveringsnotatene fra den lille prøven beholdes.

Prøv for eksempel:

- «Hvilke andre steder kan vi spise på?» og deretter spørsmål om et navngitt sted.
- «Hva kan barna gjøre ute i nærheten?» – Strandveiparken og Buranbanen gir konkrete alternativer.
- «Hva kan vi gjøre på Nyhavna allerede nå?» – badstue, teater, servering, bryggeriutsalg og offentlig badeplass.
- «Kan vi låne utstyr til en tur?» – BUA Lademoen.

Last siden på nytt og start en ny samtale for å få hele innholdet inn i sesjonen. Den faktiske formuleringen og samtaleflyten må fortsatt lyttetestes.

## Kilder og avgrensninger

Tidligere research er utgangspunkt; tilbud og besøksadresser er kontrollert mot virksomhetene, kommunen og andre primærkilder. Ramp har svakere aktualitetsbelegg: Svartlamons egen virksomhetsomtale og registeradresse støtter stedet, mens egen hjemmeside ikke ga lesbart innhold. Menyomtalen er derfor merket som udatert.

BUA ble korrigert til BUA Lademoen på Innherredsveien 91. HAVET inkluderer BarbeintQ i samme stedspost. Rosendal Teater og kafé er ett sted. Monkey Brew beskrives som bryggeri og utsalg med avtalte omvisninger. Offentlig Strandveikaia badeplass er et eksisterende tilbud, adskilt fra det planlagte delområdet med samme navn.

Tolv adressepunkter kommer fra Kartverket. Strandveiparken og Buranbanen bruker kommunens representative parksentre. Kommunens WFS returnerte EPSG:25832 selv med forespurt EPSG:4326; koordinatene er eksplisitt transformert ut fra feltet `srid`. Badeplassen bruker et omtrentlig punkt fra det lagrede Nyhavna-snapshotet, med dokumentert begrensning. Ingen av punktene omtales som en kontrollert inngang.

Tretti Mapbox-ruter er beregnet, én for gange og én for sykkel per sted, fra demoens faste utgangspunkt. Alle rutesvar er lagret. Største avvik mellom forespurt punkt og rutens endepunkt er 57,3 meter. Tidene er beregninger til representative kartpunkter; de er ikke målt fra en bestemt framtidig leilighet, og ingen framtidige broer er lagt inn manuelt.

## Filer og kontroll

- `2026-09-14-utvidelse-punkter.json`: nøyaktige additive steder og kilder, samt koordinatspor.
- `2026-09-14-utvidelse-servering-research.json` og `2026-09-14-utvidelse-familie-research.json`: vurdering av alle 15 kandidater, kilde-URL-er og forbehold.
- `2026-09-14-utvidelse-adresseoppslag.json`, `2026-09-14-utvidelse-parkkart.json` og `2026-09-14-utvidelse-ruter.json`: rå oppslag og rutegrunnlag.
- `2026-09-14-utvidelse-testjustering.patch`: testens forventning om flere kaféer er utvidet med Godt Brød. Før testen stopper, forventer den nå Dora → Snurr → Godt Brød. Dette retter en gammel forventning om at serveringsutvalget var uttømt etter Snurr.

To fakta fikk presisert kildekobling etter en uavhengig gjennomgang av 15 av 15 steder. Skjema og referanser ble kontrollert før aktivering. Alle 15 steder finnes i kartadapter, stemmens kunnskapsbase og kuratert stedsgrunnlag med minst to fakta. Demosiden returnerte HTTP 200 med alle 15 nye steds-ID-er. Visuell nettlesertest og ekte talesamtale er ikke gjennomført i denne økten.

## Fjerne hele prøven eller enkeltsteder

Bruk ID-ene i punktfilens `places` som fjerneliste. Fjern bare disse radene fra aktiv `places.json`, og eventuelle kilder fra punktfilens `sources` som deretter ikke brukes av noen steder, fakta, temaer, FAQ-er eller manus. Ikke gjenopprett hele filer: parallelløkten har andre endringer. Ved fjerning av Godt Brød må også den tilsvarende nye testforventningen fjernes.

Aktive JSON-filer forblir ukommittert sammen med parallelløktens øvrige arbeid. Denne innholdsleveransen og testjusteringen lagres separat i innholdsarbeidskopien. Ingen push.

## Endelig testresultat

Alle 73 tester under `lib/demo/nyhavna-lokal` passerte i den brede kjøringen etter testjusteringen. `npm run lint` ga 0 feil og 53 advarsler; `npx tsc --noEmit` passerte. `npm test`: 4312 passerte, fire feilet. Ny kjøring av de tre berørte filene ga grønn pipeline-test og tre gjenværende feil: stemmeinstruksens lengde (319 ord mot forventet under 300), synkron forventning til nå asynkront `executeTool`, og manglende statusrolle i `BoardVoiceControl`. Disse testene bruker andre instruksjoner eller egne fixture-data, ikke de nye stedene. De gjelder det pågående tekniske arbeidet og er ikke endret av innholdsøkten. Ingen produksjonsbygg eller PR.
