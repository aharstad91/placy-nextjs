# Lokal Nyhavna-demo: drift og kontroll

Arbeidsflate etter sammenslåing: `/Users/andreasharstad/Documents/placy`, gren `main`. Demo-URL: <http://127.0.0.1:3101/eiendom/nyhavna-utvikling/nyhavna/leve>. Samtaleprototype B er bevart på `/prototype/conversation`; dens opprinnelige tale-API krever lokal dev-server. Ingen offentlig utrulling eller delt databaseendring inngår.

## Start den fryste demoversjonen

Avslutt samtalen med **Stopp** før serveren stoppes. Kjør fra arbeidsmappen:

```sh
npm run build
npm run demo:nyhavna
```

`demo:nyhavna` starter ett lokalt produksjonsbygg på 127.0.0.1:3101 med `PLACY_LOCAL_REALTIME_DEMO=1`. Ikke kjør to Node-prosesser mot denne arbeidsmappen. Hovedrepoets eksisterende `.env.local` brukes; ikke kopier nøkkel til klientkode eller dokumenter.

Åpne URL-en, kontroller kart og kildekort. Samtalen er én mikrofon/stopp-knapp under fanene i omvisningen (og på mobilens nabolagsliste). Demoen kjører på **GPT-Live** (`/v1/live/sessions`), ikke Realtime: stemmen er `gpt-live-1` med stemmevalg **marin** (`OPENAI_BOARD_LIVE_MODEL`), og resonneringen ligger hos en egen Responses-backend (`OPENAI_BOARD_BACKEND_MODEL`, standard `gpt-5.6-terra`). Kontroller begge med `curl -s http://127.0.0.1:3101/api/prototype/live`; svaret skal ha `"protocol":"live"` og et `voiceModel` som begynner på `gpt-live`. Det finnes ingen tekstmodus i boardet, og ingen fallback til Realtime – nekter Live å starte, stopper samtalen der. **Stopp** legger på hos serveren og fjerner fremhevingen i kartet; neste start er en ny samtale med tom brukerprofil. Se [generalprøven](rehearsal.md) for fysisk Mac-test og møteopplegg, og [lyttetesten](lyttetest.md) for stemmestabilitet.

## Samtalens gang (2026-09-13)

Lyden går kontinuerlig: mikrofonsporet står på fra første sekund, også mens guiden hilser, og guiden bestemmer selv når den snakker. Den kan gi små lyttesignaler («mhm», «ja») mens brukeren tenker høyt, og stopper når brukeren avbryter. Trenger den fakta, deleger den til backenden og kan si kort at den sjekker – den skal aldri gjette resultatet mens den venter.

Hilsenen er kort, uten merkenavn, og stiller ETT åpent spørsmål («Hva er viktigst for deg når du vurderer et nytt sted å bo?»). Den sendes som `session.instructions.append` rett etter at sesjonen er startet, og når instruksen er kvittert, følger et kort «begynn nå» som `session.commentary.append` – uten det ventet modellen på brukeren (målt 2026-09-13). Hilsenen kom ordrett ca. 1,4 s etter `session.started` i tre av tre samtaler. Det finnes ingen «hilsen ferdig»-event. Svaret går til `set_interests` på serveren, som lager en personlig temarekkefølge (Nyhavnas egne temaer fra nyhavna.no først når de treffer interessen) og åpner første kapittel.

Kartet styres av SERVEREN, ikke av modellens datakanal. Ved temainngang fremhever serveren selv kapittelets tre første steder og sender kartdirektivene til nettleseren over en SSE-strøm; nettleseren svarer med ren kartstatus, og backenden får beskjed om rekkefølgen den skal omtale dem i. Katalogspørsmål besvares fra spørsmålskatalogen i backend-instruksjonen og vises i samme runde. Trykk på et tema eller sted i kartet er ikke lenger en simulert brukermelding: serveren åpner kapittelet eller slår opp stedets fakta og sender guiden en kort replikk (`session.commentary.append`) som den parafraserer. Avstikker (`note_detour`) og retur (`return_to_tour`) holder hovedtråden. Prosjektinnhold fra nyhavna.no hentes per spørsmål (`find_project_info`, se `site-coverage.md`).

Instruksjonene er delt i to. Stemmen får en kort tekst om rolle, språk, uttale og når den skal delegere (`lib/live/voice-instructions.ts`). Backenden får den lange: fakta, verktøyregler, kapitler og hele spørsmålskatalogen (`nyhavnaInstructions`), med samtalenotatet lagt SIST så cache-prefikset står.

Tilstanden (interesser, tema nå/neste, gjennomgått, fremhevet i rekkefølge, returpunkt, åpne spørsmål) ligger på serveren per samtale (`lib/realtime/tour-state.ts`) og legges inn i backendens instruksjon som et kompakt samtalenotat når den endres. Stemmen får i tillegg én til to linjer om hva kartet viser, som stille kontekst. Ingen av delene avhenger av modellenes egen hukommelse.

### Simulert samtale uten mikrofon

Åpne demoen med `?voicedev=1`. Da ligger `window.placyVoice` på siden: `start()`, `say("Jeg er opptatt av kaféer")` (sender teksten rett til BACKENDEN som en brukertur – stemmen sier svaret; merket som simulert i serverloggen), `play("/dev/nyhavna-tts/03-skolevei.wav")` (spiller en lydfil inn på mikrofonsporet, så ekte tale går gjennom hele Live-banen – transkripsjon, delegering, kart – og byttes tilbake til det vanlige sporet etterpå), `tool("highlight_places", { poi_ids: ["leve-dora-kaffebar", "leve-monkey-brew"] })` (kjører kartkommandoen lokalt uten modell), `messages()`, `status()`, `stop()`. Bare på den lokale demoen; `say` og `play` koster som en vanlig tur. Les `window.placyVoice` på nytt for hver avlesning (objektet byttes ved hver render). `play` er den eneste av disse som prøver selve lyd- og taledeteksjonsbanen; `say` hopper over stemmens lytting. Chromes falske mikrofon (`--use-fake-device-for-media-stream`) sender en tone som taledeteksjonen tolker som tale; overstyr `navigator.mediaDevices.getUserMedia` med en stille strøm før `start()` når du simulerer – og lag en NY strøm per kall, for `stop()` stopper sporet.

Testreplikkene ligger i `public/dev/nyhavna-tts/*.wav` (ikke i git; `public/dev/` er ignorert). De er norsk TTS (`gpt-4o-mini-tts`, stemme `ash`, 24 kHz wav) av lyttetestens replikker: `01-interesse`, `02-bo-barn`, `03-skolevei`, `04-ungdomsskole`, `05-sykle`, `06-andre-stedet`, `07-kilder`, `08-pause-a/-b`, `09-avbrudd`, `10-korrigering`, `11-stopp`, `12-kafeer`, `13-barnehager`. Mangler de, lag dem slik (nøkkelen fra `.env.local`):

```sh
curl -s https://api.openai.com/v1/audio/speech -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini-tts","voice":"ash","input":"Hvordan er skoleveien?","response_format":"wav"}' -o public/dev/nyhavna-tts/03-skolevei.wav
```

`next start` tar øyeblikksbilde av `public/` ved bygg: nye klipp krever nytt bygg.

### Tidsmåling per delegering

Serveren skriver én logglinje `nyhavna_live_turn {...}` når en delegering er avgjort – altså per forespørsel backenden jobbet med, ikke per lydtur. Feltene er `DelegationTiming` (`lib/live/types.ts`), alle i millisekunder fra delegeringen ble opprettet på Live-tidslinjen (`offset_ms`): siste brukertranskript før den (`user_end_ms`), de første ordene stemmen sa etterpå og når (`ack_words`, `ack_ms` – typisk «jeg sjekker»), første kartdirektiv med argumenter og når kartet bekreftet (`first_map_call*`, `map_ok_ms`), hver backend-runde med innhold, status/feil og tokens (`rounds`), når backenden var ferdig (`backend_done_ms`), og de første ordene ETTER det – selve svaret (`answer_words`, `answer_ms`). `end` sier om delegeringen ble ferdig, erstattet av en ny forespørsel (`superseded`), feilet eller ble avsluttet. Loggen skrives både til serverens stdout og til `.context/nyhavna-live.log` (ikke i git), så tallene kan hentes etter møtet uten terminalvinduet.

Målt 2026-09-13 (Live-1 + terra, effort low, syntetisk mikrofon med TTS-replikker, 15 delegeringer i to samtaler), millisekunder fra delegeringen ble opprettet:

| Mål | Målt |
|---|---|
| Delegering etter siste ord fra brukeren | 0,2–1,8 s |
| Første hørbare bekreftelse («Mhm», «Jeg sjekker») | 78–540 ms (typisk ~120 ms) |
| Kartendring bekreftet av nettleseren | 1,2–3,3 s |
| Backenden ferdig | 1,3–5,3 s (1 runde ≈ 2,3–3 s, 2 runder ≈ 3–4,3 s, 3 runder 5,3 s) |
| Selve svaret begynner | 2,9–5,7 s |

Bufringen virker: fra andre delegering er 85–95 % av backendens inndata-tokens bufret (≈ 9–11 k av 10–12 k). Tallene fra Realtime-mini (første ord 0,6–2,5 s, siste runde 4,7–9,6 s) er ikke sammenlignbare: de målte én modell, ikke stemme pluss backend.

## Dataversjon og kilder

Board og server leser `data/demo/nyhavna-snapshot.json`. Identiteten inkluderer både prosjekt og kildekontrollert kunnskap. Ulik ID/hash stopper oppstart; en åpen fane med gammel dataversjon må lastes på nytt. JSON leses fra originalfilen for å unngå ulik avrunding av koordinater i byggverktøyet.

`data/demo/nyhavna-review-ledger.json` dekker 1 324 tilgjengelige POI-er og den eksplisitte sammenslåingen av én dobbel Dora Kaffebar-identitet (1 325 opprinnelige poster). 7 kartsteder, 8 omtaler uten kartplassering og områdekontekst har en egen faktakontroll med 50 vurderte fakta: 39 bekreftede og 11 uavklarte. De 1 317 øvrige kartstedene er ikke faktasertifisert og brukes ikke som autoritet i assistentens faktasvar. Kildedekningskontroll er ikke det samme som verifisering av alle beskrivelser, koordinater eller åpningstider.

Etter autoriserte endringer i kuratert innhold kan snapshotet oppdateres uten databasekall:

```sh
NODE_OPTIONS=--conditions=react-server npx tsx scripts/nyhavna-refresh-curated.ts
```

`nyhavna-demo-inventory.ts` er en separat, skrivebeskyttet ny innlesing av prosjektgrunnlaget. En slik oppdatering krever ny datakontroll og ny generalprøve; ikke kjør den rett før møtet.

## Grenser og kostnad

Serveren tillater én aktiv samtale, høyst 60 starter per rullerende time og maksimalt 12 minutter per samtale. To minutter uten aktivitet avslutter samtalen. Serveren eier kunnskapsverktøyene og alle kartdirektiver; nettleseren utfører kun reversible kartkommandoer og svarer med kartstatus. Backendens svar er begrenset til 700 output-tokens, og verktøyrundene per delegering er begrenset.

Kostnaden har to deler som ikke kan slås sammen. Stemmen koster $0,05 per minutt, fakturert per sekund (WebRTC-oppstart forhåndsfakturerer 15 sekunder som krediteres). Backenden faktureres i tokens etter modell (terra: $2 per million inn, $0,2 bufret, $12 ut). Serveren logger `nyhavna_live_usage` med stemme-sekunder, backend-tokens og et estimat når samtalen avsluttes; grensesnittet viser bare stemme-sekundene. Ingen samtaletekst eller nøkkel inngår i logglinjen.

**Takgrensen er nå antall samtidige sesjoner, ikke tokens per minutt.** Tier 1 gir 25 samtidige Live-sesjoner, og demoen bruker én. Den gamle flaskehalsen – 40 000 tokens per minutt på `gpt-realtime-2.1-mini`, som ga 10–45 sekunders venting fra tredje–fjerde tur (målt 2026-09-13) – gjelder ikke lenger, fordi resonneringen er flyttet til en Responses-backend med egne grenser. Backendens tokenbruk er fortsatt verdt å følge i `rounds`: instruksjonen med katalogen er ~6 000 tokens, og bufrede tokens er billigere, ikke gratis.

Dette er tekniske bruksgrenser, ikke et garantert dollarbudsjett. Sammenlign faktisk OpenAI-bruk med samme oppgave og modalitet. Tekstprøver kan ikke brukes som prisanslag for tale.

## Avbrudd og gjenoppretting

- Avvist mikrofon: samtalen kan ikke starte (boardet har ingen tekstmodus), men kartet og omvisningen er tilgjengelige som før.
- Nettbrudd: samtalen viser feil; bruk kartet mens forbindelsen gjenopprettes. Avslutt/ny samtale rydder lokalt og ber serveren henge opp.
- Stale dataversjon: last siden på nytt. Ikke fjern versjonskontrollen.
- Aktiv samtale i annen fane: avslutt den først. En slik avvisning skal ikke opprette et nytt betalt kall.
- Feil ved kontrollforbindelsen: den opprettede samtalen henges opp før nye starter tillates.

Aktiv sesjons-ID skrives atomisk til `.context/nyhavna-live-session.json`, som ikke skal committes. En normal avslutning sender `session.close` på sideband-et og venter på `session.closed` (som bærer årsak og forbruk). Ved serveromstart, eller hvis `session.closed` uteblir, henger serveren opp registrert sesjon med `POST /v1/live/sessions/{id}/hangup` før en ny samtale tas inn. Hangup-feil beholder sperren og forsøkes igjen etter 1, 2, 4, 8 og 16 sekunder. Etter uttømte forsøk kreves kontrollert ny opprydding/serveromstart. En gyldig 404 fra hangup regnes som allerede avsluttet.

Hvis opprettelsen ga timeout eller manglet sesjons-ID, lagres `unknown` og nye starter blokkeres. Ikke slett registeret for å få demoen i gang før upstream-situasjonen er avklart: en ukjent samtale kan ha blitt opprettet. Stopp lokal server, kontroller OpenAI-prosjektets bruk/aktive kall og få avslutningen bekreftet. Hvis identiteten ikke kan gjenfinnes, behold sperren og bruk kartet. Manuell registerfjerning er bare riktig etter bekreftet opprydding; ikke bare fordi tiden har gått.

## Før møtet

Tirsdag 15. september: fysisk Mac, ekte mikrofon/høyttaler, norsk tale, avbrytelser, vanlig romlyd og en uinnvidd prøvebruker. Dette kan ikke bevises av automatiske tester med simulert mikrofon. Onsdag 16. september: åpne den samme testede versjonen, én fane, kontroller lyd og nett, og start en tom samtale. Registrer observasjoner i generalprøvedokumentet. Andreas eier møtets go/no-go.
