# Handel, transport og aktiviteter i lokal demo — 14. september 2026

Integrert i `placy` sin aktive demo på port 3103. Ingen push; parallelle tekniske endringer er bevart. Kodeendringene er avgrenset i `2026-09-14-kjopesentre-kode.patch`, innhold i tre additive payloads.

## Innhold og dekning

- Fire kjøpesentre: Solsiden senter, City Lade, Trondheim Torg og Sirkus Shopping. Seks bekreftede virksomheter per senter; dette er et kuratert utvalg, ikke en komplett butikkoversikt.
- Seks nye dagligvarer: Obs City Lade, Coop Mega Sirkus Shopping, REMA 1000 Torvet, Bunnpris Buran, Bunnpris Lade og Extra Lilleby. Ni dagligvarer søkbare totalt.
- Lademoen og Lilleby stasjon samt de seks nærmeste bysykkelstativene: Dora I, Møllenberg, Bassengbakken, Lademoparken, TMV-odden og Strandveikaia. Databaseproveniens bevart; sykkelkoordinater kontrollert mot offisiell GBFS.
- Flex Gym, Buld.no, Trikkestallen skatepark og Ladesletta. Leo’s og Pirbadet var allerede inne, og er kontrollert som synlige/søkbare uten dubletter.
- Buld.no bruker dagens adresse i Ormen Langes vei 15. Eldre databasepunkter for Trondheim Buldresenter ble forkastet.
- Ladesletta beskriver NEON og Trondheim Rocks fra 2026. Sandvolleyball omtales i idrettsparken ved siden av. Kartpunktet er tydelig merket som omtrentlig orientering; verken festivalinngang, avgrensning eller senere års program er lovet.

39 nye stedsrader, 72 nye fakta og 7 oppdaterte eksisterende rader. Alle 39 nye steder, 7 oppdateringer og 24 sentermedlemskap kontrollert. 118 stedsrader / 178 kilder totalt. 94 unike kartdestinasjoner, hvorav 75 fra start og 19 i reserve. UI summerer temarader og viser 79 fordi fire sentre finnes både under Hverdag og Servering; disse fire er samme kartdestinasjon. Ikke presenter 118 som antall synlige kartpunkter.

## Visning og samtale

Eksisterende sentermerke og «I senteret»-register brukes. Hverdag viser hele det kuraterte senterutvalget, Servering bare senterets kafé-/bakerimedlemmer. MENY, Apotek 1, Vinmonopolet, Godt Brød og Dromedar på Solsiden er samlet under senteret. REMA Solsiden og REMA Torvet har egne kartpunkter fordi de ligger utenfor.

Butikkenes egne fakta og kunnskaps-ID-er består. Kart-ID peker til senteret i stedssøk, fakta, kuratert utvalg, instruksjonsdata, lignende-sted-resultat, FAQ og manus. Eksakt kunnskaps-ID prioriteres foran felles kart-ID. Kartverktøy beholder valgt tema ved senteråpning. Generell handel grupperes under «Butikker», slik at sport/leker ikke feilmerkes som klær.

Stasjons-ID-er føres videre til eksisterende transportkomponenter. Flex Gym og Buld.no er føyd til det korte treningsmanuset, og dermed synlige fra start. Øvrig manus er bevart.

## Verifikasjon

Alle 18 eksplisitt etterspurte/eksisterende referansesteder kontrollert gjennom kart- og stemmeadapter. Alle 24 butikkbarn gir egne fakta og riktig senter-ID. Søket «dagligvare» gir 9 treff. Alle nye stasjons-ID-er beholdes. 40 gang-/sykkelruter beregnet og råsvar lagret. Fire av fire senterregistre og samtlige tog-/bysykkelpunkter kontrollert i Chrome. Ny ekte talesamtale er ikke gjennomført.

Kodesimplifisering: gjenbruk av isAnchorPOI, kanoniske underkategorier, indeks for foreldre og temagruppering anvendt. Bred refaktor av report-pipelinen og ekstra abstraksjon for tre enkle foreldreoppslag forkastet fordi lokal temavisning har andre behov. Dobbel lineær kunnskapsoppslag beholdt for tydelig prioritet til eksakt ID. Åtte egne sentertester dekker sentermedlemskap, tema, kildefakta, kart-ID-er, ugyldige relasjoner og stemmens navigasjon.

## Tilbakeføring

Bruk de tre payloadenes eksakte nye sted-ID-er for fjerning. Gjenopprett bare feltene i `existingPlacePatches` som fortsatt matcher denne leveransens `after`; aldri erstatt hele aktive filer over andre endringer. Kilder fjernes bare når ubrukte. Treningsmanusets før/etter er i `2026-09-14-trening-manus-patch.json`. Reverser kodepatchen bare etter kontroll mot nye tekniske endringer. Behold kodestrukturen hvis sentermedlemmer fortsatt brukes.

## Åpne tråder

Lyttetest med ekte stemme gjenstår. Ladeslettas presise festivalinngang kan forbedres når arrangøren publiserer kart. Mekaniske sjekker: Lint 0 feil / 53 advarsler, TypeScript grønn. De 91 målrettede testene er dekket grønne gjennom siste kjøring (90/91) og rettet reserveforventning (5/5 i ny kjøring). Full suite: 4310 passerte / 14 feilet under tung parallell belastning. Av dette var én reserveforventning nå rettet, ti testtidsavbrudd (alle avklart grønne med mindre samtidighet, siste taxi-importtest med 15 sekunders grense; faktisk tid 4,5 sekunder), og tre tidligere kjente feil utenfor leveransen: nyhavna-knowledge ordgrense samt to BoardVoiceControl-forventninger. Ingen nye uavklarte feil fra denne leveransen. Ikke påstå at full suite er grønn.

ce-code-review fullført med seks lokale perspektiver og en uavhengig Claude-gjennomgang. Tre funn fra den fryste før-fiks-versjonen rettet: valgt tema ved senteråpning, eksplisitt map_poi_id i modellens stedslister, og testdekning for begge direktiver ved lignende butikk. Reviewkvittering og etterkontroll følger denne mappen.
