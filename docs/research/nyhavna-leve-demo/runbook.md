# Lokal Nyhavna-demo: drift og kontroll

Arbeidsflate: `/Users/andreasharstad/Documents/placy-voice-board`, gren `prototype/nyhavna-voice-board`. Demo-URL: <http://127.0.0.1:3101/eiendom/nyhavna-utvikling/nyhavna/leve>. Den separate samtaleprototypen på 3102 er ikke denne leveransen. Ingen offentlig utrulling eller delt databaseendring inngår.

## Start den fryste demoversjonen

Avslutt samtalen med **Avslutt** før serveren stoppes. Kjør fra arbeidsmappen:

```sh
npm run build
npm run demo:nyhavna
```

`demo:nyhavna` starter ett lokalt produksjonsbygg på 127.0.0.1:3101 med `PLACY_LOCAL_REALTIME_DEMO=1`. Ikke kjør to Node-prosesser mot denne arbeidsmappen. Hovedrepoets env-fil deles via den eksisterende lokale symlinken; ikke kopier nøkkel til klientkode eller dokumenter.

Åpne URL-en, kontroller kart, startforslag og kildekort. Velg Skriv eller Snakk. Ash beholdes; tekst og tale bruker samme Realtime-samtale, med mikrofon først ved talevalg. Bytt med Skriv/Snakk. **Ny samtale** starter uten forrige samtales historikk og tilbakestiller kartet. Se [generalprøven](rehearsal.md) for fysisk Mac-test og møteopplegg.

## Dataversjon og kilder

Board og server leser `data/demo/nyhavna-snapshot.json`. Identiteten inkluderer både prosjekt og kildekontrollert kunnskap. Ulik ID/hash stopper oppstart; en åpen fane med gammel dataversjon må lastes på nytt. JSON leses fra originalfilen for å unngå ulik avrunding av koordinater i byggverktøyet.

`data/demo/nyhavna-review-ledger.json` dekker 1 324 tilgjengelige POI-er og den eksplisitte sammenslåingen av én dobbel Dora Kaffebar-identitet (1 325 opprinnelige poster). 7 kartsteder, 8 omtaler uten kartplassering og områdekontekst har en egen faktakontroll med 50 vurderte fakta: 39 bekreftede og 11 uavklarte. De 1 317 øvrige kartstedene er ikke faktasertifisert og brukes ikke som autoritet i assistentens faktasvar. Kildedekningskontroll er ikke det samme som verifisering av alle beskrivelser, koordinater eller åpningstider.

Etter autoriserte endringer i kuratert innhold kan snapshotet oppdateres uten databasekall:

```sh
NODE_OPTIONS=--conditions=react-server npx tsx scripts/nyhavna-refresh-curated.ts
```

`nyhavna-demo-inventory.ts` er en separat, skrivebeskyttet ny innlesing av prosjektgrunnlaget. En slik oppdatering krever ny datakontroll og ny generalprøve; ikke kjør den rett før møtet.

## Grenser og kostnad

Serveren tillater én aktiv samtale, høyst 60 starter per rullerende time og maksimalt 12 minutter per samtale. To minutter uten aktivitet avslutter samtalen, med vern mens et svar genereres eller spilles. Serveren eier kunnskapsverktøyene og videreføring etter verktøykall; klienten utfører kun reversible kartkommandoer. Maksimalt svar er 700 output-tokens, og verktøyrunder begrenses.

Modellens eldre samtalekontekst kuttes ved 2 500 tokens etter instruksjonene, med 70 prosent beholdt ved kutt. Synlig historikk beholdes, men modellen husker ikke nødvendigvis eldre preferanser. Gjeldende kartvalg og seks nylige stedsreferanser sendes på nytt. Ved midlertidig API-bruksgrense vises ventestatus og serveren prøver høyst to ganger; nytt spørsmål eller avbrudd avbryter ventingen.

Dette er tekniske bruksgrenser, ikke et garantert dollarbudsjett. UI viser et etterskuddsvis estimat. Separat transkripsjon inngår ikke fullt ut. Serveren logger `nyhavna_realtime_usage` med aggregerte tokens og estimert kostnad når samtalen avsluttes; ingen samtaletekst eller nøkkel inngår i denne logglinjen. Sammenlign faktisk OpenAI-bruk med samme oppgave og modalitet. Tekstprøver kan ikke brukes som prisanslag for tale.

## Avbrudd og gjenoppretting

- Avvist mikrofon: fortsett med tekst. Kartet er tilgjengelig selv om samtalen ikke kan starte.
- Nettbrudd: samtalen viser feil; bruk kartet mens forbindelsen gjenopprettes. Avslutt/ny samtale rydder lokalt og ber serveren henge opp.
- Stale dataversjon: last siden på nytt. Ikke fjern versjonskontrollen.
- Aktiv samtale i annen fane: avslutt den først. En slik avvisning skal ikke opprette et nytt betalt kall.
- Feil ved kontrollforbindelsen: den opprettede samtalen henges opp før nye starter tillates.

Aktiv upstream-call-ID skrives atomisk til `.context/nyhavna-realtime-call.json`, som ikke skal committes. Ved serveromstart forsøker serveren å avslutte registrert kall før en ny samtale tas inn. Hangup-feil beholder sperren og forsøkes igjen etter 1, 2, 4, 8 og 16 sekunder. Etter uttømte forsøk kreves kontrollert ny opprydding/serveromstart. En gyldig 404 fra hangup regnes som allerede avsluttet.

Hvis opprettelsen ga timeout eller manglet call-ID, lagres `unknown` og nye starter blokkeres. Ikke slett registeret for å få demoen i gang før upstream-situasjonen er avklart: en ukjent samtale kan ha blitt opprettet. Stopp lokal server, kontroller OpenAI-prosjektets bruk/aktive kall og få avslutningen bekreftet. Hvis identiteten ikke kan gjenfinnes, behold sperren og bruk kartet. Manuell registerfjerning er bare riktig etter bekreftet opprydding; ikke bare fordi tiden har gått.

## Før møtet

Tirsdag 15. september: fysisk Mac, ekte mikrofon/høyttaler, norsk tale, avbrytelser, vanlig romlyd og en uinnvidd prøvebruker. Dette kan ikke bevises av automatiske tester med simulert mikrofon. Onsdag 16. september: åpne den samme testede versjonen, én fane, kontroller lyd og nett, og start en tom samtale. Registrer observasjoner i generalprøvedokumentet. Andreas eier møtets go/no-go.
