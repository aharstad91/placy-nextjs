# Placy-chatboksen — gjenbrukbar for flere kunder

Chatboksen (tekst og tale i samme panel, temarad, sidetilpassede forslag, kilder, forbehold og én samtale på tvers av skriving og tale) er et produkt som kan aktiveres per kunde. Leangenbukta var første kunde ([leangenbukta-nettside.md](leangenbukta-nettside.md)), Nyhavna den andre ([nyhavna-nettside.md](nyhavna-nettside.md)). Status 2026-09-24: to kunder, begge bare kontrollert lokalt. Ingenting er publisert.

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
| `lib/live/chat-surface.ts`, `lib/live/demo-voice-access.ts`, `/api/prototype/live*` | |
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
   - `profile.ts`: egen kunde-ID, egne miljøvariabler (`env`, `transcriptSecretEnv`), egne målernavn (mønster `^[a-z][a-z0-9_]{2,39}$`), og `voice` med `placeName` lik boardets navn, `salesContact`, `greeting` og `remoteVisitor`.
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

## Hva som IKKE er løst

- **Innbygging på kundens eget domene.** Widgeten og endepunktet forutsetter samme origin som Placy-appen. `*_ALLOWED_ORIGINS` åpner bare for CORS. Tilgangscookien er `SameSite=Lax`, kvotene er ikke løst på tvers av domener, og stemmens ruter krever samme origin. Kryss-domene krever en egen tokenflyt og er separat integrasjonsarbeid.
- **Stemme på den delte Anja-tjenesten.** Chatflatens stemme finnes bare i den lokale Live-ruta (`/api/prototype/live` med sidebandforbindelsen i Node-prosessen, én samtidig sesjon per instans). Den er ikke kontrollert på Vercel. Den delte tjenesten (`PLACY_HOSTED_VOICE=true`) avviser `surface=chat`. Den mangler:
  - kundens kartfrie verktøyliste og instruks
  - verifisering av det kundebundne tekst-tokenet (`session.input`)
  - opptak og nytt token når talen slutter
  - kundens stemmemåler i regnskapet

  Dette er egen integrasjon i Anja-tjenesten, ikke en profil.
- **Adresse.** Nye prosjekter skal ligge på `placy.no/<slug>` (`CLAUDE.md`). Kopiene ligger i dag under `/demo/…`.
- **Faktagodkjenning.** Ingen svar er godkjent av kundene. Serverens vakter beviser at kilden var i grunnlaget, ikke at hver setning er kontrollert.
- **Samtaletoken v1.** Tokens fra før 2026-09-24 godtas ikke lenger; en fane som sto åpen, fortsetter uten historikk.
