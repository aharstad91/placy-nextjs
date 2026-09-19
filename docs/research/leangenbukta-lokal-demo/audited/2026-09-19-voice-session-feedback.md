# Leangenbukta — gjennomgang av stemmesesjon 19.09.2026

## Formål

Denne gjennomgangen bruker den omtrent tretten minutter lange testdialogen som et ende-til-ende-avvik mot kvalitetsnivået i Nyhavna-demoen. Målet er at rettingene skal gjelde alle ordinære Placy-boards med aktiv Anja, mens prosjektinnholdet fortsatt kommer fra hvert boards reviderte kilder.

## Observerte avvik

| Område | Evidens fra sesjonen | Rotårsak | Retting |
|---|---|---|---|
| Oppstart | Omtrent 17 sekunder fra trykk til hilsen | Boardet med over 800 steder ble lastet og transformert flere ganger i Next-gatewayen og sidecaren | Anja-tjenesten er autoritativ for versjonskontroll og cacher den eksakte boardversjonen i prosessen. Next videresender uten en ekstra full boardlesing |
| Hilsen | Åpent spørsmål ga ikke det ønskede valget mellom prosjekt og område | Generisk hilsen | Produksjonskonfigurasjonen spør nå eksplisitt om boligprosjektet eller området rundt |
| Uttale og stemme | «Leangenbukta» var ustabilt uttalt, og stemmen ble opplevd robotisk | For svak stemmeinstruksjon | Rolig norsk tempo, korte setninger, menneskelige pauser og eksplisitt uttale «Leangen-bukta» er del av boardets stemmekontrakt |
| Prosjektfortelling | Introduksjonen startet med regulering og skolekapasitet | Regulerte enkeltfakta ble prioritert før utbyggers dokumenterte prosjektfortelling | Fire kildebelagte prosjektpåstander er importert. Brede spørsmål prioriterer identitet, beliggenhet, bokvaliteter, kollektivtilgang og fellesfunksjoner |
| Beliggenhet | Anja hevdet at hun manglet en kildebelagt beskrivelse | Søk krevde treff på alle ordene, og grunnfortellingen manglet i publisert kunnskap | Delvis, poengbasert søk og prosjektets egne kildebelagte beskrivelser gir dekning |
| Nærliggende steder | Mat viste Krem og senere fjerne redaksjonelle steder; Fyr på Lade og Burger King manglet. Trening viste steder opptil 23 minutter unna før Impulse | Samtalekapitlet brukte redaksjonelle høydepunkter, ikke faktisk reisetid | Ordinære boards bruker kategoriens POI-er sortert på lagret reisetid. Mat starter nå med Baan, Franske Nytelser og Fyr; trening med Impulse, Hangaren og Speed |
| Kartfokus | Kartet zoomet ut og flyttet Leangenbukta mot kanten | Kartverktøyet tilpasset utsnittet bare til treffene | Prosjektpunktet inngår alltid i utsnittet når Anja viser en gruppe på et ordinært assistentboard |
| Ufullførte svar | Anja stoppet etter «jeg sjekker» eller «jeg har åpnet kartet» | Instruksjonen skilte ikke framdriftsmelding fra ferdig svar | Én kort framdriftssetning er tillatt; Anja skal vente på backendresultatet og deretter fullføre svaret med 2–4 konkrete steder |
| Arbeidsstatus | UI vekslet mellom lytting og søk, med flere sekunder uten tydelig signal | Klienten kjente ikke backendens arbeidslivssyklus | Sideband sender `working`, `answering` og `idle`. UI blir stående i arbeidsmodus til svarlyden faktisk begynner |
| Kollektiv | Sanntidsavgang ble lest opp, men linjene som betjener holdeplassen var lite synlige | Panelet viste bare de første avgangene | Holdeplasspanelet viser unike «Linjer her» før sanntidsavgangene. Anja skal oppsummere linjer og retninger før neste avgang |
| Adresser | Gateadresser ble lest høyt og var vanskelige å uttale | Ingen tydelig muntlig begrensning | Adresser leses bare når brukeren spør om adresse eller trenger veibeskrivelse |
| Rapportering | Ingen varig kostnads- eller tidsrapport for testsesjonen | Sidecaren kjørte med stille logging uten bruksmottaker | Nye samtaler skriver aggregert varighet, bruk og backendtiming til `.context/anja-sessions.jsonl`, uten dialogtekst, svarinnhold, verktøyargumenter, leverandør-ID-er eller hemmeligheter |

## Innholdsretting

Prosjektets egen nettside er nå brukt som kilde for en kjøpervennlig, men fortsatt kildebundet introduksjon. Fire nye påstander dekker:

1. plasseringen mellom fjorden, Ladestien og Leangen kollektivknutepunkt,
2. skjerming mot vei og trafikk, landskapsåpning mot fjorden og bilfrie uterom,
3. buss/metrobuss, Leangen stasjon og sykkelveier,
4. planlagte fellesfunksjoner for beboerne.

Utbyggers beskrivelser merkes som dette og blandes ikke sammen med ferdigstilte forhold eller bindende reguleringskrav. Prosjektfortellingen kan dermed brukes i en levende introduksjon uten at Anja opptrer som megler eller finner på kvaliteter.

## Verifisert resultat

- Boardet inneholder 817 samtalerelevante steder og sju ordinære områdetemaer i den kontrollerte nettleserlesingen.
- Mat åpnes med Baan (3 min), Franske Nytelser (4 min) og Fyr på Lade (4 min).
- Trening åpnes med Impulse (4 min), Hangaren (6 min) og Speed Treningssenter Lade (8 min).
- Eksakt søk etter Burger King gir den kartlagte filialen Burger King Lade Arena (6 min), ikke et vilkårlig kjedetreff lenger unna.
- Brede prosjektfakta starter med beliggenhet, bokvaliteter og transport, ikke skolekapasitet.
- En ende-til-ende tekstforespørsel om mat gikk fra brukerinput til synlig arbeidsstatus etter 0,62 sekunder og til svarstatus etter 1,03 sekunder. Kart og sidepanel viste de samme tre stedene.
- Oppstart til aktiv samtale ble målt til omtrent 6,7 sekunder på en kald, ny innholdsversjon og omtrent 4,2 sekunder varm. Før rettingen var den lokale målingen 11,1 sekunder kald / 9,3 sekunder varm; opptaket viste omtrent 17 sekunder.

Tidsmålingene er lokale utviklingsmålinger og skal brukes som regresjonsgrunnlag, ikke som produksjons-SLA.

## Kostnad for den opprinnelige sesjonen

Den gamle sesjonen har ingen leverandørnøyaktig bruksrapport. Transkripsjonen dekker omtrent 13 minutter og 2 sekunder fra første trykk til avslutning. Med den daværende interne stemmeantakelsen på 0,05 USD per minutt tilsvarer dette omtrent 0,65 USD i stemmetid, i tillegg til ukjent backendbruk. Beløpet er et estimat, ikke en faktura eller målt kostnad.

For nye sesjoner lagres kun operasjonelle aggregater. Selve samtalen lagres bevisst ikke i rapportfila.

## Gjenbrukbar akseptanseport

Før et nytt standardboard regnes som klart for kundedemo skal testen bekrefte:

1. prosjekt- og områdevalg i hilsenen,
2. prosjektfortelling og beliggenhet fra godkjente kilder,
3. de faktiske nærmeste stedene for minst servering og trening,
4. prosjektpunkt i kartutsnittet gjennom hele visningen,
5. stabil arbeidsstatus fra oppslag starter til svarlyd begynner,
6. linjer og retninger for et kollektivpunkt,
7. ingen oppleste gateadresser uten at de er etterspurt,
8. uttale, avbrudd og stemmekvalitet i en fysisk lyttetest,
9. aggregert varighets- og bruksrapport etter avsluttet samtale.

Punkt 8 krever fortsatt menneskelig lytting. De øvrige punktene er dekket av kode-, data- eller nettleserverifisering i denne runden.
