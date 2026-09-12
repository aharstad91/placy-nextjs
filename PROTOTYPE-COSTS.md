# Kostnadstiltak i Nyhavna Board — 2026-09-12

> Samlet i `main` 12. september 2026. Bruk `/Users/andreasharstad/Documents/placy`; de tidligere worktree-mappene er fjernet etter bevaring i Git. Gjeldende startinstruksjon er `docs/research/nyhavna-leve-demo/runbook.md`. Konsept B er bevart på `/prototype/conversation` med sitt opprinnelige, separate API for lokalt utviklingsmiljø.


Gjelder prototype/nyhavna-voice-board på http://127.0.0.1:3101/eiendom/nyhavna-utvikling/nyhavna/leve.

Målet er samme inngang, stemme og kartstyring med mindre modellforbruk. Akseptanse: fungerende samtale og kartkommandoer, synlig estimat per sesjon, bevart kildegrunnlag og testet avslutning av inaktive forbindelser. Samtaleprototypen på 3102 er ikke endret.

| Tiltak | Før | Nå | Forventet virkning |
|---|---|---|---|
| Modell | gpt-realtime-2.1 | gpt-realtime-2.1-mini | Lavere pris per token. Norsk og verktøypresisjon må fortsatt vurderes gjennom bruk. |
| Kartkontekst | Omskriver session instructions ved kartendring | Legger ny karttilstand bakerst i samtalen; ingen melding når tilstanden er lik | Bevarer stabilt instruksjonsprefiks for cache. Cache er ikke garantert. |
| Stedssøk | Opptil 12 fulle stedsbeskrivelser | 6 kompakte treff med paginering | Mindre data inn i neste modellrunde. Alle treff kan fortsatt hentes. |
| Kategorivalg | Opptil 8 fulle steder | 6 kompakte steder | Mindre repetisjon; detaljverktøyet beholder full tekst. |
| Finn og vis | Separate verktøyrunder | Valgfritt show_if_unique åpner et entydig treff direkte | Mulighet for én færre modellrunde; modellen kan fortsatt velge separate kall. |
| Svarstil | 1–3 setninger | Ber om 1–2 setninger, detaljer ved behov og færre forhåndsbekreftelser | Mindre tale og tekst. Dette er prompting, ikke en hard lengdegaranti. |
| Verktøysløyfer | Ingen rundebegrensning | Etter 6 verktøyrunder må neste svar avsluttes uten verktøy | Hindrer lange autonome kjeder. Nytt spørsmål nullstiller telleren. |
| Inaktivitet | Kun 10 minutters maksimal sesjon | Avslutter også etter ca. 2 minutter uten samtaleaktivitet | Kobler fra glemt mikrofon/forbindelse. Pågående svar får fullføre. |
| Måling | Ingen sesjonsvis oversikt | «Forbruk denne samtalen» viser estimat, modellrunder og tokens | Skiller brukerens egen sesjon fra andre tester på samme nøkkel. |

Stemme `marin`, WebRTC, avbrytelser, mikrofon og visuell samtalehistorikk beholdes. Planlagt/eksisterende, stedsusikkerhet, kilder og reisetidenes origo følger også de kompakte treffene. Full stedsbeskrivelse hentes ved behov; søket søker fortsatt i hele teksten.

## Prisgrunnlag

USD per million tokens, kontrollert i OpenAI Docs 2026-09-12:

| | Full modell | Mini |
|---|---:|---:|
| Tekst inn / cache / ut | 4 / 0,40 / 24 | 0,60 / 0,06 / 2,40 |
| Lyd inn / cache / ut | 32 / 0,40 / 64 | 10 / 0,30 / 20 |

Kilder: https://developers.openai.com/api/docs/models/gpt-realtime-2.1 og https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini.
Cache og bruksrapportering: https://developers.openai.com/api/docs/guides/voice-latency-cost.

Estimatet bruker response.done.usage, trekker cache fra ordinære inputtokens og teller reasoning som tekstoutput. Duplikate response-ID-er telles én gang, også bruk fra feilede/avbrutte svar hvis API-et rapporterer dette. Ukjent modell eller ufullstendig prisgrunnlag gir ikke et påstått totalbeløp.

Separat inputtranskripsjon med gpt-4o-mini-transcribe er beholdt for å vise brukerens tale som tekst. Denne kostnaden er IKKE inkludert i estimatet og opplyses i panelet. OpenAI-dashboardet er fasit. Estimatet bevares ved stopp og nullstilles når en ny samtale starter. Dette er lokal observasjon, ikke et håndhevet budsjett eller produksjonsregnskap.

## Verifikasjon og begrensninger

En reell WebRTC-tekstsesjon med tre spørsmål («Vis Dora Kaffebar», «Hva vet du om stedet?», «Vis meg kulturlivet») fullførte med 7 modellrunder, ingen API-feil og $0,0046 i avrundet estimert Realtime-kostnad. Kartet viste stedet og kulturkategorien. Ingen session.update ble sendt. Det er én observasjon, ikke et kontrollert før/etter-eksperiment eller et estimat for talesamtaler. Den tidligere oppgitte kostnaden $0,23 kan inkludere annen bruk på samme nøkkel.

Mini brukte fortsatt enkelte separate oppslag og forhåndsbekreftelser i testen. Tiltakene gir derfor ikke garanti om minst mulig antall runder eller lik språkkvalitet som full modell. Full modell kan velges for nye sesjoner via OPENAI_BOARD_REALTIME_MODEL=gpt-realtime-2.1 i servermiljøet. Denne board-spesifikke variabelen påvirker ikke 3102.

27 fokuserte tester dekker blant annet cachevennlig kartkontekst, paginering, entydig navigasjon, kildeforbehold, prisberegning, duplikate brukshendelser, verktøysløyfer og avslutning av inaktive forbindelser.

Full testsuite: 243 testfiler / 4012 tester bestått. ESLint: 0 feil, 54 eksisterende advarsler. TypeScript: bestått. Ingen PR/push eller produksjonsbuild i dette lokale prototypeløpet.

Lydoutput ble også verifisert mot OpenAI med samme marin-stemme: hilsen og et skrevet kartspørsmål i stemmemodus ga lydsvar, navigasjon til Dora Kaffebar, ingen API-feil og ca. $0,0148 i estimert modellkostnad. Cache ble brukt i de siste rundene. Testen brukte stille simulert mikrofon, og dokumenterer derfor ikke norsk talegjenkjenning eller kostnaden ved brukerens lydinput. Første automatiske lydtest nådde tidsgrensen; ny test med hendelseslogging fullførte med output_audio_buffer.stopped. Alle testforbindelser ble lukket.

## Stemmeprøve: Cedar

Etter kostnadsrunden ba Andreas om Cedar. Boardet på 3101 bruker nå `cedar` for nye samtaler. Tidligere målinger ovenfor ble gjort med Marin. Modellen og kostnadstiltakene er uendret.

## Stemmeprøve: Echo

Andreas ba deretter om Echo. Boardet på 3101 bruker nå `echo` for nye samtaler. Modell og kostnadstiltak er uendret.

### Stemmevalg: Sage

Andreas ba deretter om «shage», tolket som Sage. Boardet på 3101 bruker nå `sage` for nye samtaler.

### Stemmevalg: Marin

Andreas valgte deretter Marin. Boardet på 3101 bruker nå `marin` for nye samtaler.

### Stemmevalg: Ash

Andreas ba deretter om Ash. Boardet på 3101 bruker nå `ash` for nye samtaler.


## 12. september: serverstyrt demoversjon

Den lokale Lene-demoen bruker nå et felles fryst datasett for board og agent, kildekontrollerte faktapakker og ren kartstatus fra klientverktøyene. Serveren eier tekstsvar og videreføring etter verktøykall. Begrensningene er én aktiv samtale, 60 starter/time, 12 minutter per samtale og to minutter uten aktivitet, med vern under tale/svar. Hangup og gjenoppretting skjer uavhengig av nettleseren. Dette er fortsatt ikke et eksakt dollarbudsjett.

Tekst og Ash-tale deler forbindelse og kontekst ved modusbytte. Kunnskap hentes ved behov, og verktøyresultater inneholder kilder og konkrete usikkerheter. UI-estimat og serverens aggregerte forbrukslogg utelater separat inputtranskripsjon. Se [valideringsrapporten](docs/research/nyhavna-leve-demo/validation.md) for siste faktiske målinger og [runbooken](docs/research/nyhavna-leve-demo/runbook.md) for kjøring og gjenoppretting. Tallene fra de tidligere forsøkene over er historiske målinger, ikke en kontrollert før/etter-test av dette oppsettet.
