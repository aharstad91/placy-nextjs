# Nyhavna: port før overgang til standardisert board

Dato: 2026-09-19

Nyhavna-demoen er referansen for boardinteraksjon og Anjas samtaleatferd. Den
skal ikke erstattes av det ordinære boardet fordi den nye flaten ser riktig ut.
Overgangen kan først skje når den standardiserte varianten er minst like god på
innhold, kartstyring, samtaleflyt og stemme.

## Automatisk baseline

`data/demo/nyhavna-lokal/conversations.json` inneholder 43 scenarioer i åtte
grupper. De dekker:

- hilsen, rolle og de to inngangene «planene» / «slik området er i dag»
- fem delområder og skillet mellom eksisterende, planlagt, ønsket og vedtatt
- samtlige 19 kuraterte FAQ-spørsmål
- søk i hele POI-poolen og midlertidig visning av punkt utenfor utsnittet
- `highlight_places`, `show_place`, ukjent ID og kartklikk under samtale
- avbrudd med kollektivspørsmål og retur til forrige tema
- adresse utelatt i vanlig tale og hentet bare ved eksplisitt behov
- live Entur for avganger og reise, destinasjonsavklaring og ærlig feilmodus
- `contentVersion`, samtykke, mikrofonnekt, rate-/kostnadsgrense og personvern
- reell norsk stemmekvalitet på telefon

Scenarioene er testgrunnlag og lastes aldri inn i modellens kunnskap. Testen
`lib/demo/local-board/nyhavna-parity.test.ts` låser antall, FAQ-dekning,
isolasjon fra runtime og dagens delområde-/fortsettelsesatferd.

## Krav til standardboardet

Før cutover skal de samme 43 scenarioene kjøres mot produksjonskilden for det
ordinære Nyhavna-boardet, bundet til den `contentVersion` nettleseren viser.
Resultatet skal lagres som en versjonert kvittering. Følgende er harde sperrer:

1. Alle automatiske scenarioer består uten Nyhavna-spesifikk runtimekode.
2. Ingen vanlig modelldata eller vanlig svarpayload inneholder gateadresse.
3. Live Entur bruker servervaliderte boardpunkter og tidsstempler resultatet.
4. Kartkommandoer blir først omtalt som utført etter klientkvittering.
5. Avbrudd og kartklikk bevarer én samtale og riktig returtema.
6. Gammel `contentVersion`, manglende samtykke og rategrense stopper før en
   betalt sesjon starter.
7. Desktop og mobil består browserkontroll med samme interaksjonsmodell som
   dagens Nyhavna-demo.
8. En fysisk lyttetest på telefon består hilsen, FAQ, delområde, kartverktøy,
   kollektivavbrudd og retur uten ustabil aksent eller teknisk narrasjon.

## Cutover og tilbakeføring

Den eksisterende Nyhavna-demoen beholdes uendret som orakel mens testene kjøres.
CTA eller offentlig rute flyttes først etter en godkjent kvittering og lyttetest.
Ved regresjon peker ruten fortsatt til demoen; standardboardet kan rettes uten at
kundens testflate forsvinner. Lokal runtime slettes først etter at Nyhavna,
Leangenbukta og Lillebytunet har passert sine migreringsporter.
