# Prototype A — samtale i dagens Nyhavna-board

Dato: 2026-09-12. Isolert gren: `prototype/nyhavna-voice-board`.

## Spørsmålet vi tester

Kan en tilgjengelig samtalepartner under kategoriraden gjøre dagens board enklere å utforske, mens kart, kategorier og redaksjonelt innhold fortsetter å være hovedflaten?

## Leveranse

1. En kompakt «Snakk med Placy»-flate under kategoriraden, synlig ved ankomst til Nyhavna. Stemmen starter bare etter brukerens klikk.
2. Ekte Realtime-samtale med mikrofonkontroll, avslutt, transkripsjon, tekstinngang og synlige feiltilstander.
3. Modellen kan hente stedskunnskap, velge kategori, vise et konkret sted, bytte reisemåte og gå tilbake til oversikt. Verktøyene validerer sted og kategori mot boardets faktiske data.
4. Den eksisterende lydomvisningen pauses når samtalen starter. Kartet følger de samme koordinatene og visningshandlingene som dagens produkt.

Brukerens eksplisitte bestilling av to Realtime-prototyper autoriserer et avgrenset unntak fra CLAUDE.md sin «ALDRI runtime LLM-kall»-regel i denne isolerte prototypen. Ingen produksjonsdeploy eller push inngår.

## Akseptanse og testscenarier

- Åpne `/prototype`: Nyhavna-board og stemmeflate vises uten å starte mikrofonen.
- «Vis meg kulturminnene på Nyhavna»: relevant kategori synlig, kartet fremhever faktisk registrerte steder.
- «Fortell mer om det stedet»: modellen får valgt sted i kontekst, viser det på kartet og svarer fra registrert innhold.
- «Hvor lang tid tar det å gå dit?»: kun lagret reisetid fra boardets origo; manglende tid oppgis som ukjent.
- «Hva er planlagt her?»: planlagte steder omtales som planlagte, med omtrentlig plassering oppgitt der det gjelder.
- «Tilbake til oversikten»: kategori og valgt sted nullstilles og kartet rammer området inn.
- Avvis mikrofontilgang / manglende API-nøkkel: forklarende feil, tekst kan fortsatt forsøkes, vanlig board virker.
- Avslutt: mikrofon og forbindelse stenges. Pågående gammel lydomvisning pauses før stemmestart.
- Desktop og smal skjerm: panelet er lesbart og kartet kan fremdeles brukes.

## Hva Andreas skal bedømme

- Er assistenten tydelig nok ved ankomst, og rolig nok når den er av?
- Passer muntlige svar og kartets bevegelse sammen uten å konkurrere?
- Kjennes kategorivalg gjennom samtale som en naturlig utvidelse av boardet?
- Norsk uttale, avbrytelser og faktisk samtaleresponstid må prøves med mikrofon.

Dette er en konsepttest med ekte tjeneste. Ingen innlogging, permanent samtalehistorikk eller produksjonsdrift inngår; samtalen lever i nettleserøkten.

## Verifisering 12. september

- TypeScript og målrettet ESLint passerte. Overordnet agent kjører også prosjektets samlede sjekker.
- 62 tester passerte: seks nye verktøy-/faktakontrakter og 56 eksisterende reducer-tester. Testene dekker ukjente ID-er, planlagt/omtrentlig status, tidsenheter, valgt sted i oppfølgingskontekst, utilgjengelig reisemåte og modalundertrykking ved stemmenavigasjon.
- Chrome/Playwright: faktisk `/prototype` → `/leve` åpnet, én assistent synlig ved ankomst; kategorivalg beholdt samme assistent, feilmelding og tekstfelt. Ingen nettleserfeil i denne runden.
- Mobil: kompakt assistent over kartet kan foldes ut for samtale og tekst. Samtaleflaten ligger over den eksisterende sheeten, og kan foldes sammen igjen for å se kartet.
- Bilder: `/tmp/placy-voice-qa/a-desktop.png`, `a-category.png`, `a-error.png`, `a-mobile.png` og `a-mobile-expanded.png`.
- `OPENAI_API_KEY` mangler i miljøet ved denne verifiseringen. Ekte oppkoblingsforsøk gir forklarende feil; ingen simulerte svar. Norsk talekvalitet, faktiske modellstyrte kartbevegelser, avbrytelser og latency er derfor fortsatt uprøvd mot tjenesten.

Lokal visning: `http://127.0.0.1:3101/prototype`. Serveren startes med `npx next dev --hostname 127.0.0.1 --port 3101`.

## Samlet lokal kontroll og videre oppstart

- `npm run lint`: 0 feil, 54 advarsler i eksisterende kode. Målrettet lint av prototypefilene er ren.
- `npx tsc --noEmit`: bestått etter siste endringer.
- Hele testsuiten kjørt: 4002 tester. Tre tester traff standardgrensen på 5 sekunder under parallell belastning; berørte testfiler passerte ved ny kjøring med færre arbeidere og opptil 20 sekunders testgrense. De 11 delte Realtime-testene passerer også separat etter siste rettelser.
- Nettleser: ekte data og faktisk kart/UI. Syntetiske Realtime-verktøyhendelser testet hele veien til kategorivalg, stedsvalg, avvisning av ukjent ID og lukking av transport. WebRTC var mocket bare i denne automatiserte testen; produktet inneholder ingen simulerte AI-svar.
- Skjermbilder og sjekklogger er bevart i `.context/realtime-qa/` (gitignorert).
- Produksjonsbygg/deploy inngår ikke i denne lokale konsepttesten. Ingen kode er pushet.

Begge worktrees bruker en symlink til `/Users/andreasharstad/Documents/placy/.env.local`. Legg `OPENAI_API_KEY` der for å prøve ekte samtale. Ikke bruk `NEXT_PUBLIC_` på nøkkelen. Standardmodellen er `gpt-realtime-2.1`; `OPENAI_REALTIME_MODEL` kan settes dersom kontoen krever en annen Realtime-modell.

`GET /api/prototype/realtime` viser om nøkkelen er konfigurert, uten å vise den. Oppkoblingen er begrenset til lokal utvikling, maksimalt 60 starter per time per serverprosess og ti minutter per samtale. Ekte tale, norsk uttale, latenstid, modelltilgang og faktiske kostnader er ikke verifisert uten nøkkelen.

Grunnlag: main `a8a0a96` pluss en isolert kopi av Nyhavna Leve-demoens lokale app-/kart-/innholdsarbeid 12.09. Den opprinnelige Nyhavna-worktreen er ikke endret av denne sesjonen. Prototypevalget er fortsatt åpent; Andreas har ikke vurdert eller valgt vinner ennå.

## Oppkoblingskontroll 12. september, ettermiddag

Nøkkel konfigurert lokalt (ingen hemmeligheter i dette dokumentet). Begge servere startet på nytt og rapporterer konfigurert. OpenAI autentiserer kontoen og viser tilgang til gpt-realtime-2.1. Reelle WebRTC-oppkoblingsforsøk er gjennomført fra begge prototypene, men API-et avviser oppstart med HTTP 429, type insufficient_quota, code credit_balance_exhausted: ingen API-kreditt igjen. Ekte samtale/kartstyring er derfor fortsatt ikke bekreftet. Neste steg: brukeren fyller på API-kreditt, deretter ny ende-til-ende-test.

Rettet en lokal origin-feil: Next dev normaliserer URL til localhost selv ved 127.0.0.1. Kontrollen bruker nå faktisk loopback-Host og krever fortsatt samme origin. Ny regresjonstest dekker forskjellen. Kvotefeilmeldingen skiller nå manglende kreditt fra midlertidig hastighetsbegrensning.

## Kostnadsrunde 2026-09-12

Board-prototypen bruker nå mini som standard, kompakte søketreff, stabilt instruksjonsprefiks, sesjonsvis kostnadsestimat og grenser for inaktivitet/verktøyrunder. Se [PROTOTYPE-COSTS.md](PROTOTYPE-COSTS.md) for hele oversikten, prisgrunnlag, testresultater og begrensninger. API-kreditt er aktiv; reelle tekstsesjoner er verifisert. Tidligere merknad om manglende kreditt gjelder ikke lenger.
