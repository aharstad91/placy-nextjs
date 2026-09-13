# Lokal Nyhavna-demo: drift og kontroll

Arbeidsflate etter sammenslåing: `/Users/andreasharstad/Documents/placy`, gren `main`. Demo-URL: <http://127.0.0.1:3101/eiendom/nyhavna-utvikling/nyhavna/leve>. Samtaleprototype B er bevart på `/prototype/conversation`; dens opprinnelige tale-API krever lokal dev-server. Ingen offentlig utrulling eller delt databaseendring inngår.

## Start den fryste demoversjonen

Avslutt samtalen med **Stopp** før serveren stoppes. Kjør fra arbeidsmappen:

```sh
npm run build
npm run demo:nyhavna
```

`demo:nyhavna` starter ett lokalt produksjonsbygg på 127.0.0.1:3101 med `PLACY_LOCAL_REALTIME_DEMO=1`. Ikke kjør to Node-prosesser mot denne arbeidsmappen. Hovedrepoets eksisterende `.env.local` brukes; ikke kopier nøkkel til klientkode eller dokumenter.

Åpne URL-en, kontroller kart og kildekort. Samtalen er én mikrofon/stopp-knapp under fanene i omvisningen (og på mobilens nabolagsliste). Stemmen er **marin**, modellen leses fra `OPENAI_BOARD_REALTIME_MODEL` (mini under bygging; kontroller med `curl -s http://127.0.0.1:3101/api/prototype/realtime`). Det finnes ingen tekstmodus i boardet. **Stopp** legger på hos serveren og fjerner fremhevingen i kartet; neste start er en ny samtale med tom brukerprofil. Se [generalprøven](rehearsal.md) for fysisk Mac-test og møteopplegg, og [lyttetesten](lyttetest.md) for stemmestabilitet.

## Samtalens gang (2026-09-13)

Hilsenen er kort, uten merkenavn, og stiller ETT åpent spørsmål («Hva er viktigst for deg når du vurderer et nytt sted å bo?»). Svaret går til `set_interests` på serveren, som lager en personlig temarekkefølge (Nyhavnas egne temaer fra nyhavna.no først når de treffer interessen) og åpner første kapittel; guiden sier hva dere begynner med og fremhever 2–3 steder samtidig (`highlight_places`, nummererte markører, ingen detaljkort). Katalogspørsmål besvares fra spørsmålskatalogen i instruksjonen og vises i samme svar. Trykk på et tema eller sted i kartet meldes til guiden som en kort brukermelding med ID; serveren åpner kapittelet eller slår opp stedets fakta FØR modellen svarer, så trykket koster én modellrunde, ikke to. Når kartet har åpnet et sted (`show_place`), følger stedets fakta med kartsvaret, og når modellen bare innledet («Klart, la oss se …») før et kartkall, får den ordet igjen med rekkefølgen den skal svare i – mini-modellen gjør begge deler ofte, og uten dette ble brukeren stående uten svar. Avstikker (`note_detour`) og retur (`return_to_tour`) holder hovedtråden. Prosjektinnhold fra nyhavna.no hentes per spørsmål (`find_project_info`, se `site-coverage.md`).

Tilstanden (interesser, tema nå/neste, gjennomgått, fremhevet i rekkefølge, returpunkt, åpne spørsmål) ligger på serveren per samtale (`lib/realtime/tour-state.ts`) og sendes til modellen som et kompakt samtalenotat når den endres. Den avhenger ikke av modellens historikk.

### Simulert samtale uten mikrofon

Åpne demoen med `?voicedev=1`. Da ligger `window.placyVoice` på siden: `start()`, `say("Jeg er opptatt av kaféer")` (sender teksten som brukertur – modellen svarer med tale), `tool("highlight_places", { poi_ids: ["leve-dora-kaffebar", "leve-monkey-brew"] })` (kjører kartkommandoen lokalt uten modell), `messages()`, `status()`, `stop()`. Bare på den lokale demoen; `say` koster som en vanlig tur. Les `window.placyVoice` på nytt for hver avlesning (objektet byttes ved hver render). Chromes falske mikrofon (`--use-fake-device-for-media-stream`) sender en tone som taledeteksjonen tolker som tale; overstyr `navigator.mediaDevices.getUserMedia` med en stille strøm før `start()` når du simulerer.

### Tidsmåling per tur

Serveren skriver én logglinje `nyhavna_realtime_turn {...}` når en brukertur er avgjort: millisekunder fra brukerens input var ferdig til første lyd (`first_audio_ms`), de første ordene og når de kom (`first_words`, `first_words_ms` – en innledning som «la meg se» er ikke et svar), første kartkall med argumenter og når kartet bekreftet (`first_map_call*`, `map_ok_ms`), og hver modellrunde med innhold, status/feil og tokens (`rounds`). `end` sier om turen ble ferdig, avbrutt, kansellert eller feilet. Målt 2026-09-13 på mini uten takgrense: første ord 0,6–2,5 s, kartendring 1,4–4,8 s, siste runde ferdig 4,7–9,6 s; se worklogen for tallene.

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

Automatisk trimming av samtalen er avslått (`truncation: "disabled"`, 2026-09-13) – en hypotese om at trimming bidrar til dialektdrift, ikke et verifisert funn. Konsekvens: en lang samtale koster mer per svar og kan nå API-ets kontekstgrense; sesjonen er uansett begrenset til 12 minutter. Gjeldende kartvalg sendes på nytt ved hver tur, og samtalenotatet når tilstanden endres. Ved midlertidig API-bruksgrense vises ventestatus og serveren prøver høyst tre ganger med API-ets oppgitte ventetid; nytt spørsmål eller avbrudd avbryter ventingen.

**Takgrensen er den reelle flaskehalsen (målt 2026-09-13).** OpenAI-organisasjonen har 40 000 tokens per minutt for `gpt-realtime-2.1-mini` (feilmeldingen: «Limit 40000»). Én modellrunde koster 8 000–16 000 inndata-tokens (instruksjon med katalog ≈ 6 000, verktøy ≈ 1 500, pluss historikk som vokser ~1 000 per tema), og bufrede tokens teller fullt mot grensen. En tur bruker 1–3 runder, så grensen nås fra tredje–fjerde tur i rask rekkefølge, og da venter brukeren 10–45 s eller får ikke svar. Det er dette som ga «30–40 s per tur», ikke modellen. Tiltak i rekkefølge: (1) høyere bruksnivå/tier på OpenAI-prosjektet før møtet (Andreas – sjekk grensen under Settings → Limits), (2) færre runder og mindre pakker (gjort: trykk forhåndsutføres, kapitlene bærer spørsmåls-ID-er i stedet for hele spørsmål/svar, prosjektinnhold sendes én gang, kortere verktøytekster), (3) korte kart-ID-er i stedet for UUID/Google-ID-er (≈ 18 % av katalogtegnene, mer i tokens – ikke gjort).

Dette er tekniske bruksgrenser, ikke et garantert dollarbudsjett. UI viser et etterskuddsvis estimat. Separat transkripsjon inngår ikke fullt ut. Serveren logger `nyhavna_realtime_usage` med aggregerte tokens og estimert kostnad når samtalen avsluttes; ingen samtaletekst eller nøkkel inngår i denne logglinjen. Sammenlign faktisk OpenAI-bruk med samme oppgave og modalitet. Tekstprøver kan ikke brukes som prisanslag for tale.

## Avbrudd og gjenoppretting

- Avvist mikrofon: samtalen kan ikke starte (boardet har ingen tekstmodus), men kartet og omvisningen er tilgjengelige som før.
- Nettbrudd: samtalen viser feil; bruk kartet mens forbindelsen gjenopprettes. Avslutt/ny samtale rydder lokalt og ber serveren henge opp.
- Stale dataversjon: last siden på nytt. Ikke fjern versjonskontrollen.
- Aktiv samtale i annen fane: avslutt den først. En slik avvisning skal ikke opprette et nytt betalt kall.
- Feil ved kontrollforbindelsen: den opprettede samtalen henges opp før nye starter tillates.

Aktiv upstream-call-ID skrives atomisk til `.context/nyhavna-realtime-call.json`, som ikke skal committes. Ved serveromstart forsøker serveren å avslutte registrert kall før en ny samtale tas inn. Hangup-feil beholder sperren og forsøkes igjen etter 1, 2, 4, 8 og 16 sekunder. Etter uttømte forsøk kreves kontrollert ny opprydding/serveromstart. En gyldig 404 fra hangup regnes som allerede avsluttet.

Hvis opprettelsen ga timeout eller manglet call-ID, lagres `unknown` og nye starter blokkeres. Ikke slett registeret for å få demoen i gang før upstream-situasjonen er avklart: en ukjent samtale kan ha blitt opprettet. Stopp lokal server, kontroller OpenAI-prosjektets bruk/aktive kall og få avslutningen bekreftet. Hvis identiteten ikke kan gjenfinnes, behold sperren og bruk kartet. Manuell registerfjerning er bare riktig etter bekreftet opprydding; ikke bare fordi tiden har gått.

## Før møtet

Tirsdag 15. september: fysisk Mac, ekte mikrofon/høyttaler, norsk tale, avbrytelser, vanlig romlyd og en uinnvidd prøvebruker. Dette kan ikke bevises av automatiske tester med simulert mikrofon. Onsdag 16. september: åpne den samme testede versjonen, én fane, kontroller lyd og nett, og start en tom samtale. Registrer observasjoner i generalprøvedokumentet. Andreas eier møtets go/no-go.
