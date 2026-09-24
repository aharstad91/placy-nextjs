# Placy-chatboksen — gjenbrukbar for flere kunder

Chatboksen (tekst og tale i samme panel, temarad, sidetilpassede forslag, kilder, forbehold og én samtale på tvers av skriving og tale) er et produkt som kan aktiveres per kunde. Leangenbukta var første kunde ([leangenbukta-nettside.md](leangenbukta-nettside.md)), Nyhavna den andre ([nyhavna-nettside.md](nyhavna-nettside.md)). Status 2026-09-24: Nyhavna er publisert på `placy.no/demo/nyhavna-nettside` med tekst og tale; Leangenbukta er fortsatt en lokal/kodegated demo.

## Hva som er felles, og hva som er kundens

| Felles (ingen kundenavn i koden) | Kundens egen profil |
|---|---|
| `lib/demo/site-chat/route-handlers.ts` — tekstendepunktet: tilgang, kvote, verktøybevis, årstallsvakt, kilder, lenker | `lib/demo/<kunde>-chat/profile.ts` — `SiteChatProfile` |
| `backend.ts` — Responses-løkka, `store: false` | datasett (`loadLiveDemo`), sider og forslag |
| `transcript.ts` — signert samtaletoken, bundet til kunde, datasett, besøkende og innholdsversjon | tilgang og besøks-ID, nøkkel (`transcriptSecretEnv`) |
| `voice-handoff.ts` — tale → tekst, husker kunden talen startet for | kvotemålere for tekst og tale (`DemoMeterConfig`) |
| `usage.ts` — døgnkvoter, måler per kunde | instruks, åpning, faste svar og forbehold |
| `sources.ts`, `categories.ts`, `notices.ts`, `sanitize.ts`, `text-tools.ts` | kilderegister, temaforslag, lenkealfabet |
| `customers.ts` — det lukkede registeret stemme- og overføringsrutene slår opp i | stemme: stedsnavn, kontaktperson, hilsen, hvilke flater som er åpne utenfor loopback |
| `lib/live/chat-surface.ts`, `lib/live/demo-voice-access.ts`, `/api/prototype/live*`, `lib/live/hosted-chat.ts`, `lib/live/hosted-control.ts` (delt stemme) | `voice.hosted`: prosjektslug i `v2.voice_projects` og kundens tilgang |
| `public/embed/placy-chat.js` (farger som data-attributter), `components/demo/site-chat-voice-bridge.tsx` | layoutens script-tag og bro |

Registeret er kode, ikke en database eller et admin-valg. En kunde aktiveres først når datagrunnlaget er kontrollert og deploy-konfigurasjonen er satt eksplisitt. `customers.ts` stopper oppstart ved dobbel kunde-ID, datasett eller måler. `customers.test.ts` sjekker kontrakten for hver kunde.

## Sjekkliste for kunde nummer tre

1. **Datagrunnlag.** Et kontrollert lokalt datasett i `data/demo/<kunde>-lokal/` registrert i `lib/demo/local-board/registry.ts` (samme format som Nyhavna og Leangenbukta: board, temaer, steder, kilder med `checkedAt`). Uten kontrollert datagrunnlag: ingen chat.
2. **Nettsidekopi.** Sidene chatten kan stå på, med `data-placy-page-id` på hver side.
3. **Kundemappe** `lib/demo/<kunde>-chat/`:
   - `pages.ts`: sideregister med `id`, `title`, `kind` og tre `chatStarters` som datasettet faktisk dekker.
   - `instructions.ts`: tekstregler som speiler datasettets `board.json`-stemmeregler (status, i dag eller planlagt, kontaktperson), sideåpning og `SiteChatReplies`.
   - `categories.ts`: tre forslag per kategori-ID i boardet.
   - `sources.ts`: `parseSourceRegistry(<datasettets sources.json>)`.
   - `links.ts`: `board`, `contact` og `page:<id>`, bare interne stier.
   - `access.ts`: tilgang som feiler lukket i et ukonfigurert produksjonsbygg. Enten en kode som hos Leangenbukta, eller en anonym, signert besøkscookie som hos Nyhavna.
   - `profile.ts`: egen kunde-ID, egne miljøvariabler (`env`, `transcriptSecretEnv`), egne målernavn (mønster `^[a-z][a-z0-9_]{2,39}$`), og `voice` med `placeName` lik boardets navn, `salesContact`, `greeting`, `remoteVisitor` (lokal rute) og `hosted` (slug i `v2.voice_projects` med binding til nøyaktig kundens datasett, pluss kundens tilgang), eller `hosted: null`. En ny binding i `v2.voice_*` skrives av operatør etter `docs/architecture/shared-platform.md`, ikke av koden.
4. **Registrer** profilen i `CUSTOMERS` i `lib/demo/site-chat/customers.ts`, og utvid forventningen i `customers.test.ts`.
5. **Tekstrute** `app/api/demo/<kunde>-chat/route.ts`: `createSiteChatRoute(<profil>)` (tre linjer, som Nyhavna).
6. **Layout:** `<script src="/embed/placy-chat.js" data-endpoint=… data-label=… data-board-href=… data-accent=…>` og `<SiteChatVoiceBridge dataset greeting continuedGreeting>` fra profilen, begge bare når chatten er slått på.
7. **Tester:** en rutetest etter mønster av `app/api/demo/nyhavna-chat/route.test.ts` (404 i ukonfigurert prod, kvote, kilder, lenker, kunnskapshull, årstall, ingen historikk fra en annen kunde) og en innholdstest mot boardets kategorier.
8. **`CLAUDE.md`:** eget navngitt LLM-unntak for kunden. Runtime-LLM er forbudt uten dette.
9. **Deploy-konfigurasjon:**
   - kundens påslag og nøkkel
   - `OPENAI_API_KEY` i et OpenAI-prosjekt med hardt spendtak
   - kundens `storeEnv=supabase`
   - migrasjonene 098 og 099 kjørt én gang, etter Andreas' godkjenning (ingen ny migrasjon per kunde)
10. **Kontroll før deling:** en ekte samtale lokalt (tekst, tale, overgang begge veier), og en faktagjennomgang av svar mot kildene.

Stemmeruta, overføringsruta, kanalene, `chat-surface.ts`, widgeten og talebroen skal ikke endres for en ny kunde.

## Stemme på den delte stemmetjenesten (2026-09-24)

Chatflaten har samme vei som boardet på `placy.no/nyhavna`: helsesjekk på `/api/prototype/live`, som svarer `transport: websocket`, og deretter kontrollforbindelsen `/api/live/control` (`lib/live/hosted-control.ts`). Talebroen og widgeten er de samme; `useLive` velger WebSocket når helsesjekken sier det.

- **Opptak** (`lib/live/hosted-chat.ts`). Alle vilkårene må stemme:
  - `PLACY_HOSTED_VOICE=true`
  - kunden står i registeret, med `voice.hosted` og `enabled()`
  - kundens `voice.hosted.visitor` godtar forespørselen: samme origin, kundens egen cookie, i produksjon også kundens stemmeflagg

  Besøkende avgjøres fra oppgraderingsforespørselens cookies. Prosjektet kommer fra profilen, aldri fra nettleseren, og bindingens innhold må være nøyaktig kundens datasett. Det finnes ingen vei til en annen kunde eller til boardflaten.
- **Regnskap:**
  - samme `voice_reserve`, budsjett, grenser og sluttregnskap som boardet, for prosjektets offentlige tenant
  - kundens egen stemmekvote (`voice.meter`) trekkes etter reservasjonen og feiler lukket; en avvist kvote lukker reservasjonen som «aldri opprettet»
  - configversjonen er en hash av instrukser og verktøy, ikke av samtalen
- **Samtale.** Kartfrie verktøy, kundens stemmeinstruks og kontaktperson, og ingen nettleserbro.
- **Historikk inn.** Tekstchattens kundebundne token verifiseres mot kundens nøkkel, den besøkende og kildens egen innholdsversjon (`contentSnapshotId`, ikke prosjektets). Turene legges i `session.input`, og `ready` bærer `continuity`: `carried`, `none` eller `rejected`. Avviser Live historikken, startes talen uten den, med `rejected`.
- **Historikk ut.** Forbindelsen eier sitt eget opptak (`createVoiceRecording`) og sender `{type:"handoff"}` med et nytt kundebundet token rett før `ended`, på samme forbindelse. Det er ikke noe minnelager på tvers av funksjonsinstanser. Brytes forbindelsen før det, sier chatten ærlig at talen ikke ble overført.
- **Lokal rute.** På et miljø med delt stemme er den lokale stemmeruta og kanalene stengt for alle eksterne besøkende (`lib/live/demo-voice-access.ts`). Nyhavna-besøkende får den lokale ruta bare på en utviklingsserver.

## Hva som IKKE er løst

- **Innbygging på kundens eget domene.** Widgeten og endepunktet forutsetter samme origin som Placy-appen. `*_ALLOWED_ORIGINS` åpner bare for CORS. Tilgangscookien er `SameSite=Lax`, kvotene er ikke løst på tvers av domener, og stemmens ruter krever samme origin. Kryss-domene krever en egen tokenflyt og er separat integrasjonsarbeid.
- **Kundetest gjenstår.** Nyhavna-demoen og den delte chatstemmen er publisert og prøvd i produksjon. Lene/Nyhavna Utvikling har ennå ikke vurdert svarene eller innholdet. Se [Nyhavna-demoen](nyhavna-nettside.md#publisert-på-placyno-2026-09-24).
- **Board-assistenten** (`services/anja/service.ts`, `/api/board-assistant`) er en annen rute og er ikke endret.
- **Adresse.** Nye prosjekter skal ligge på `placy.no/<slug>` (`CLAUDE.md`). Kopiene ligger i dag under `/demo/…`.
- **Faktagodkjenning.** Ingen svar er godkjent av kundene. Serverens vakter beviser at kilden var i grunnlaget, ikke at hver setning er kontrollert.
- **Samtaletoken v1.** Tokens fra før 2026-09-24 godtas ikke lenger; en fane som sto åpen, fortsetter uten historikk.
