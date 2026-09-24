# Nyhavna-nettside for Lene-demo

Lokal inngang: <http://localhost:3107/demo/nyhavna-nettside>. Planlagt Vercel-inngang: `https://placy.no/demo/nyhavna-nettside` (ikke deployet).

Flyt: forsiden → **Beliggenhet** → **Utforsk Nyhavna med Placy** → eksisterende `/demo/nyhavna-lokal` i ny fane. Fra 24.09 har begge sidene også chatboksen «Spør om Nyhavna» (tekst og tale), se [Chat med tekst og tale](#chat-med-tekst-og-tale-2026-09-24). Kun forsiden og Beliggenhet er bygd. Andre menypunkter peker til originalsidene på nyhavna.no. Nyhetsbrev/backend og øvrige undersider er ikke gjenskapt.

## Filer og drift

- `app/demo/nyhavna-nettside/`: egne React-sider, header og medieavspilling. `original.css` er originalens CSS med selektorer avgrenset til `.nyhavna-site`; `demo.css` inneholder demoens tillegg. Ingen global Placy-CSS er redigert.
- `public/demo/nyhavna-nettside/`: lokale bilder, logo, animasjon, film og fonter.
- Arbeidskopi/branch: `../placy-lb-kundedemo`, `feat/leangenbukta-kundedemo`. Nettsidekopien og den gjenbrukbare chatten ligger nå i samme gren.
- Lenken til Placy bruker samme origin, slik at port/domenebytte ikke krever endring i lenken. På den delte plattformen sender `/demo/nyhavna-lokal` videre til `/nyhavna`.
- Slett de to nye mappene for å fjerne demoinngangen. Ikke gjenopprett andre filer eller fjern eksisterende `/demo/nyhavna-lokal`.

## Kilder og ressurser

Snapshot av <https://nyhavna.no/> og <https://nyhavna.no/dist/css/main.css>, hentet 2026-09-14. Tekst, design, logo, bilder og film tilhører respektive rettighetshavere og brukes i den bestilte lokale replikaen. Originalens CMS-, cookie-, sporing- og nyhetsbrevskript er ikke importert.

- Logoanimasjon: <https://nyhavna.no/media/ssepufz4/nyhavna-lottie.json>.
- Film: Nyhavnas egen forsidefilm (Vimeo 1094958438). `harbour-poster.jpg` og `nyhavna-aerial.jpg` er stillbilder ved 3 og 4,5 sekunder.
- Nyhetsbilder: originalforsidens fire artikkelbilder, lagret som `news-0.webp` til `news-3.webp`.
- Unbounded: Google Fonts, vekter 400, 600 og 700. Figtree gjenbrukes fra Placy-layouten.
- Avspiller: `lottie-web` 5.13.0, lokal kopi fra npm/unpkg. MIT-lisens i `LOTTIE-LICENSE.md`.

## Kontroll

Safari: original og replika visuelt sammenlignet på desktop; begge nye sider kontrollert ved 390 × 844. Menyen åpner/lukker, Beliggenhet er tilgjengelig i toppmeny og snarveier, og CTA åpnet faktisk `/demo/nyhavna-lokal` i egen fane på 3103. Den eksisterende demos velkomstside ble observert lastet. Ingen ny talesamtale startet.

En feil funnet under mobiltesten ble rettet: Placy-layoutens capture-handler tok interne lenker før headerens `onClick`. Menylenkene bruker nå den eksisterende `data-no-transition`-reservasjonen, og ny nettlesertest bekreftet lukket meny etter valg.

Ingen nye enhetstester for den reversible visuelle demosiden; nettlesertesten er funksjonsbeviset. Redusert bevegelse er håndtert i kode, men ikke prøvd ved endring av brukerens OS-innstillinger. Full sjekkstatus og review-referanse loggføres i `PROJECT-LOG.md`.

## Chat med tekst og tale (2026-09-24)

Nyhavna er andre kunde for den gjenbrukbare chatboksen; felles arkitektur og sjekkliste for neste kunde: [`site-chat.md`](site-chat.md).

Kopien har samme chatboks som [Leangenbukta-kopien](leangenbukta-nettside.md#chat-med-tekst-og-tale): knappen «Spør om Nyhavna» nederst til høyre, sidepanel på desktop og bottom sheet på mobil, prototypemerke, temarad med boardets åtte kategorier, sidetilpasset åpning og forslag, «Kilder i oppslaget», forbehold ved behov, og «Skriv» / «Snakk» i samme felt med én felles samtale. Beliggenhet har i tillegg knappen «Spør om nabolaget», som åpner chatten med et første spørsmål. Widgeten er den samme fila (`public/embed/placy-chat.js`) med Nyhavnas endepunkt og farger som data-attributter; talebroen er den samme komponenten (`components/demo/site-chat-voice-bridge.tsx`) med Nyhavnas datasett og hilsen.

**Datagrunnlag.** `loadLiveDemo("nyhavna-lokal")` — det samme datasettet som boardet «Utforsk Nyhavna med Placy» åpner, med kildekontrollerte temaer, steder og status-ord (eksisterende, planlagt, vedtatt plan, visjon, uavklart). Kildene som kan vises kommer bare fra `data/demo/nyhavna-lokal/sources.json`. Tekstinstruksen (`lib/demo/nyhavna-chat/instructions.ts`) speiler `board.json`s stemmeregler: hold dagens tilbud og planene adskilt, «planlegges/ønsker/utbygger beskriver» om bydelen, fem *delområder* og ikke byggetrinn, Transittkaia-opplysninger gjelder bare Transittkaia, tidspunkter avhenger av plangodkjenning, pris/salg/innflytting henvises til Nyhavna Utvikling. Tidsplanen for et delområde ligger i stedets fakta, så instruksen ber om `find_places` + `get_place_facts` for slike spørsmål (uten dette svarte modellen «finner ikke» på Transittkaias byggestart i første prøve).

**Samme vakter som Leangenbukta.** Endepunktet (`app/api/demo/nyhavna-chat/route.ts`) er den felles logikken i `lib/demo/site-chat/route-handlers.ts` med Nyhavnas profil (`lib/demo/nyhavna-chat/profile.ts`): verktøybevis kreves for faktasvar, årstall uten støtte i verktøysvarene gir fast svar, kilder må være både sitert og returnert, lenker bare fra et lukket alfabet (`board` → `/demo/nyhavna-lokal`, `contact` → bunnfeltet `#kontakt`, `page:forside`, `page:beliggenhet`), `store: false`, ingen meldingstekst i logger. Historikken er det samme signerte, besøksbundne tokenet, men signert med Nyhavnas egen nøkkel (`PLACY_NH_CHAT_COOKIE_SECRET`) og bundet til kunden `nyhavna` og datasettet `nyhavna-lokal`. Et Leangenbukta-token blir derfor aldri Nyhavna-historikk, heller ikke når begge nøklene er satt (tekst: ny samtale uten historikk; tale: «rejected»).

**Tilgang og kostnad.** Kopien er en åpen side, så chatten har ikke Leangenbuktas kodeinnlogging, men en egen anonym besøks-ID i en signert httpOnly-cookie (`placy_nh_chat`, 14 dager, `lib/demo/nyhavna-chat/access.ts`):

| Miljø | Atferd |
|---|---|
| Dev-server uten konfigurasjon | Bare loopback, besøkende `local`; tekst og tale |
| `PLACY_NH_CHAT_ENABLED=true` + `PLACY_NH_CHAT_COOKIE_SECRET` (≥ 32 tegn) | Cookie utstedes ved første kall; tekstchat. Tale i et produksjonsbygg bare gjennom den delte stemmen: `PLACY_HOSTED_VOICE=true` og `PLACY_NH_CHAT_VOICE=true` (se under). Den lokale stemmeruta er aldri åpen for Nyhavna-besøkende i produksjon |
| Produksjonsbygg uten dette | Ingen widget i HTML-en, endepunktet 404, stemmeruta 404 for Nyhavna-chat (feiler lukket) |

Egne døgnmålere `nh_chat_message` (standard 40 per besøkende / 300 samlet) og `nh_voice_session` (5 / 30), styrt av `PLACY_NH_CHAT_MESSAGE_{VISITOR,GLOBAL}_DAILY` og `PLACY_NH_CHAT_VOICE_SESSION_{VISITOR,GLOBAL}_DAILY`. Et produksjonsbygg krever sentralt lager: `PLACY_NH_CHAT_USAGE_STORE=supabase` og migrasjonene `098_demo_usage.sql` + `099_demo_usage_meters.sql` (ingen av dem er kjørt). Uten lager svarer chatten 503. Fordi siden er åpen, kan den per-besøkende grensen omgås ved å slette cookien; den samlede døgnkvoten og et hardt spendtak i OpenAI-prosjektet er de reelle grensene. Valgfritt: `PLACY_NH_CHAT_MODEL`, `PLACY_NH_CHAT_ALLOWED_ORIGINS`.

**Kontrollert lokalt 24.09** (Chrome, utviklingsserver på 3107, ekte modellkall): Beliggenhet viste temaraden, sidens tre forslag og «Skriv»/«Snakk»; «Spør om nabolaget» ga et kildebelagt svar (MENY, KIWI, barnehager, Dora 1, Ladestien med gangtider) med tre kilder og lenken til Placy-kartet. «Kan jeg flytte inn på Transittkaia i 2027?» ga årstallsvaktens faste svar. Etter instruksrettingen ga «Når er byggestart og innflytting på Transittkaia?» byggestart 2027 og mulig innflytting 2029 som utbyggers anslag avhengig av plangodkjenning, med kilde. Tale: oppkobling, «Anja er klar … fortsetter fra samtalen over», hilsen som knyttet an til tekstsamtalen, et forslag sendt under talen ble besvart muntlig (MENY, KIWI, Bunnpris Buran), og etter «Avslutt tale» svarte tekstchatten riktig på «Har Bunnpris-butikken du nevnte post i butikk?». Mobil 390 × 844 viste bottom sheet i Nyhavnas farger. Hørbar lyd og ekte mikrofoninput ble ikke kontrollert (forslaget ble sendt som tekst i talesesjonen). Produksjonsbygget uten flagg har ingen widget i HTML-en.

### Hva som gjenstår før dette kan virke på placy.no

Andreas valgte 24.09 å legge kopien på den delte plattformen sammen med stemmen. Denne grenen lar nå `placy.no/demo/nyhavna-nettside` og `/beliggenhet` passere proxyen på `placy.no` med `noindex`; andre nettsideruter går fortsatt til www. Den allerede publiserte kopien på `www.placy.no/demo/nyhavna-nettside` er uendret. Endringen er foreløpig bare lokal.

1. **Databasen og kostnadsgrensen:** Kjør `098_demo_usage.sql` og `099_demo_usage_meters.sql` mot produksjonsdatabasen etter Andreas' godkjenning. Bruk et OpenAI-prosjekt med hardt spendtak. Ingen migrasjoner er kjørt i denne leveransen.
2. **Konfigurer `placy-nyhavna`:** `OPENAI_API_KEY`, `PLACY_NH_CHAT_ENABLED=true`, `PLACY_NH_CHAT_COOKIE_SECRET` (minst 32 tegn), `PLACY_NH_CHAT_USAGE_STORE=supabase` og `PLACY_NH_CHAT_VOICE=true`, i tillegg til eksisterende `PLACY_HOSTED_VOICE=true`, boardmodellene og Supabase-tilgangen. Bygg på nytt etter at flaggene er satt: nettsidelayouten er statisk og velger om widgeten vises ved bygging. Kontroller produksjonsoppsettet uten å eksponere hemmeligheter.
3. **Publiser og prøv:** Deploy denne grenen til Vercel-prosjektet `placy-nyhavna` når Andreas ber om det. Sjekk at siden, undersiden, tekstendepunktet og `/api/live/control` er på `placy.no`, at tekstsvaret viser kilder og at tale kan overta og levere historikk tilbake. Den betalte ende-til-ende-prøven av den delte chatstemmen er ikke kjørt; den skriver i produksjonsregnskapet.
4. **Kundegodkjenning:** Innhold og svar er ennå ikke godkjent av Nyhavna Utvikling.
