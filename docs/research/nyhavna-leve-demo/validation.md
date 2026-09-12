# Validering av lokal Nyhavna-demo — 12. september 2026

Implementasjonen ligger i `placy-voice-board`, på port 3101. Ingen push eller offentlig utrulling. Snapshot: `nyhavna-b7ed5e938bf23ab5`.

## Datagrunnlag

1 324 tilgjengelige POI-er og én eksplisitt sammenslått Dora-identitet er inventert. Faktakontrollen omfatter 7 kartsteder, 8 omtaler uten markør og områdekontekst: 39 bekreftede og 11 uavklarte fakta. De øvrige 1 317 kartstedene er ikke faktaverifisert og brukes ikke som faktakilder av agenten. Se data-audit.md og curated-source-audit.md.

## Automatiske kontroller

Full testsuite før den siste avgrensede bruksgrenseendringen: 249 filer / 4 062 tester bestått (`npm test -- --maxWorkers=2 --testTimeout=15000`). Timeout ble økt fra 5 til 15 sekunder på grunn av treg modulinnlasting under belastning; testpåstander ble ikke endret. Siste endringer kontrolleres separat med fokuserte Realtime-/UI-tester og produksjonsbygg. Resultatet føres i sesjonsloggen.

Enhetstestene dekker kunnskapsgrensen, kildepakker, snapshot-integritet, kartkommandoer, tekst/tale-modus, mikrofonopprydding, avbrudd, forsinkede hendelser, serverens tidsgrenser og retry ved oppryddingsfeil. De erstatter ikke fri bruk eller fysisk lydprøve.

## Faktisk lokal nettleser/API-prøve

Produksjonsprøven bekreftet kildekort, kartstyring, manglende åpningstider uten gjetting, planstatus og kort avgrensning av oppskriftsspørsmål. Tekst → tale → tekst beholdt samme WebRTC-forbindelse. Konkurrerende samtalestart ble avvist med HTTP 429, ny samtale ga tom historikk, og serverstyrt hangup avsluttet et faktisk API-kall med HTTP 200.

Langtesten gjennomløp 24 spørsmål, men **bestod ikke**: etter de første svarene traff samtalen prosjektets grense på 40 000 tokens/minutt. Senere svar feilet gjentatte ganger. Det registrerte estimatet på omtrent $0,0162 omfatter bare rapportert bruk i denne mislykkede prøven; det er ikke prisen for 24 vellykkede svar og ikke et taleprisestimat. Separat transkripsjon er ikke inkludert fullt ut.

## Siste retting og gjenværende usikkerhet

Modellkonteksten begrenses nå til 2 500 tokens etter instruksjonene, med 70 prosent beholdt ved kutt. Maksimalt svar er 700 tokens. Søkeresultater er komprimert, og det gis inntil to kontrollerte forsøk ved midlertidig API-bruksgrense. Brukeren ser ventestatus; avbrudd eller nytt spørsmål kansellerer ventingen. Generiske kultursøk beholder flere relevante steder.

Kontekstinnstillingen følger [OpenAIs Realtime API-kontrakt](https://platform.openai.com/docs/api-reference/realtime?lang=javascript). Synlig historikk beholdes, men eldre preferanser kan falle ut av modellens hukommelse. Gjeldende kartvalg og nylige stedsreferanser sendes på nytt.

**Ingen ny betalt live-test etter denne rettingen**, etter Andreas' tilbakemelding om sesjonens forbruk. Provider-aksept av siste konfigurasjon, en vellykket lengre samtale og eldre referanser etter kontekstkutt er derfor ikke bekreftet. Ikke presenter demoen som ferdig generalprøvd.

Fysisk Mac med ekte norsk tale, høyttaler, romlyd og en uinnvidd prøvebruker gjenstår. Bruk rehearsal.md tirsdag 15. september; møtet med Lene er onsdag 16. september. Start med en kort sammenhengende prøve på hvert av de fire demotemaene.
