# Prototype B — Samtalen former Nyhavna

Spørsmålet: Gir en samtale som setter sammen kart og stedskort en bedre inngang til området enn å velge kategorier selv? Dette er en faktisk Realtime-integrasjon i en isolert worktree, autorisert som unntak fra runtime-LLM-regelen for prototypen. Ingen produktbeslutning er tatt før Andreas har prøvd den.

## Det vi bygger

1. En rolig samtaleflate med norsk tale, tekst, avbrytelser, mikrofon av/på og tydelig avslutning.
2. Et selvstendig kart som følger validerte verktøykall: søk, kategori, personlig utvalg og fokus på ett sted. Stedskort beholder kilder, reisetider og skillet mellom planlagt og eksisterende.
3. Nyhavnas eksisterende board-data og Leve-innhold gjenbrukes. Modellen får lese data gjennom avgrensede verktøy; den kan ikke opprette fiktive steder eller beregne reisekjeder.
4. Brukeren kan peke manuelt og lagre steder under besøket. Det aktive stedet blir samtalekontekst.

## Ferdig for utprøving

- `/prototype` laster ekte Nyhavna-data og et ekte Mapbox-kart.
- Tale og tekst kobles til OpenAI Realtime via kortlivet serverutstedt tilgang. Manglende nøkkel/avvist mikrofon gir en synlig feil, aldri en simulert samtale.
- Kategori-, sted- og utvalgshandlinger endrer kartet og viser kort fra samme datasett.
- Ukjente IDs avvises før visningen muteres. Manglende reisetid presenteres som ukjent.
- Desktop og mobil kan brukes uten horisontal overflyt; meldinger, kilder og kontroller kan nås med tastatur.

## Prøv dette

1. Start med «En kaffe og noe godt». Følg opp «Vis meg den første» og pek deretter manuelt på et annet sted. Spør «Hva med dette stedet?».
2. Start stemme, spør om kunst og kultur, avbryt midt i svaret og be om promenade i stedet. Følger kart og samtale samme endring?
3. Spør hva som finnes i dag og hva som er planlagt. Åpne kildene på kortene.
4. Spør om sykkeltid, og deretter om en reisekjede som ikke er beregnet. Modellen skal skille lagrede tider fra det den ikke vet.
5. Slå av mikrofonen, skriv videre, avslutt og kontroller at nettleserens mikrofonindikator slukker.

## Det Andreas må vurdere

- Oppleves samtalen som hovedinngangen, og er kartresponsene nyttige uten å være urolige?
- Er det best å få 2–4 steder samlet, eller å gå til ett sted mens stemmen forteller?
- Er en egen samtaleflate riktig retning, og hva fra den bør eventuelt inn i demoens eksisterende board?

Ingen varig hukommelse eller publisering. «Mine steder» gjelder bare denne sidelastingen. Åpen begrensning: reell lydkvalitet, avbrytelser og modellens kartvalg krever en aktiv OpenAI-nøkkel og menneskelig utprøving.

## Samlet lokal kontroll og videre oppstart

- `npm run lint`: 0 feil, 54 advarsler i eksisterende kode. Målrettet lint av prototypefilene er ren.
- `npx tsc --noEmit`: bestått etter siste endringer.
- Hele testsuiten kjørt: 4001 tester. Tre tester traff standardgrensen på 5 sekunder under parallell belastning; berørte testfiler passerte ved ny kjøring med færre arbeidere og opptil 20 sekunders testgrense. De 11 delte Realtime-testene passerer også separat etter siste rettelser.
- Nettleser: ekte data og faktisk kart/UI. Syntetiske Realtime-verktøyhendelser testet hele veien til kategorivalg, stedsvalg, avvisning av ukjent ID og lukking av transport. WebRTC var mocket bare i denne automatiserte testen; produktet inneholder ingen simulerte AI-svar.
- Skjermbilder og sjekklogger er bevart i `.context/realtime-qa/` (gitignorert).
- Produksjonsbygg/deploy inngår ikke i denne lokale konsepttesten. Ingen kode er pushet.

Begge worktrees bruker en symlink til `/Users/andreasharstad/Documents/placy/.env.local`. Legg `OPENAI_API_KEY` der for å prøve ekte samtale. Ikke bruk `NEXT_PUBLIC_` på nøkkelen. Standardmodellen er `gpt-realtime-2.1`; `OPENAI_REALTIME_MODEL` kan settes dersom kontoen krever en annen Realtime-modell.

`GET /api/prototype/realtime` viser om nøkkelen er konfigurert, uten å vise den. Oppkoblingen er begrenset til lokal utvikling, maksimalt 60 starter per time per serverprosess og ti minutter per samtale. Ekte tale, norsk uttale, latenstid, modelltilgang og faktiske kostnader er ikke verifisert uten nøkkelen.

Grunnlag: main `a8a0a96` pluss en isolert kopi av Nyhavna Leve-demoens lokale app-/kart-/innholdsarbeid 12.09. Den opprinnelige Nyhavna-worktreen er ikke endret av denne sesjonen. Prototypevalget er fortsatt åpent; Andreas har ikke vurdert eller valgt vinner ennå.

## Oppkoblingskontroll 12. september, ettermiddag

Nøkkel konfigurert lokalt (ingen hemmeligheter i dette dokumentet). Begge servere startet på nytt og rapporterer konfigurert. OpenAI autentiserer kontoen og viser tilgang til gpt-realtime-2.1. Reelle WebRTC-oppkoblingsforsøk er gjennomført fra begge prototypene, men API-et avviser oppstart med HTTP 429, type insufficient_quota, code credit_balance_exhausted: ingen API-kreditt igjen. Ekte samtale/kartstyring er derfor fortsatt ikke bekreftet. Neste steg: brukeren fyller på API-kreditt, deretter ny ende-til-ende-test.

Rettet en lokal origin-feil: Next dev normaliserer URL til localhost selv ved 127.0.0.1. Kontrollen bruker nå faktisk loopback-Host og krever fortsatt samme origin. Ny regresjonstest dekker forskjellen. Kvotefeilmeldingen skiller nå manglende kreditt fra midlertidig hastighetsbegrensning.
