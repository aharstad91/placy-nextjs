# Lyttetest: stabil norsk stemme i Nyhavna-demoen

Formål: avgjøre med ører om stemmen holder samme dialekt og uttale gjennom en
kort omvisning – med talte spørsmål, kategoritrykk, verktøykall, avbrudd og
retur fra fordypning – og om merkenavnet «Placy» i hilsenen påvirker uttalen.
En tekst­transkripsjon eller grønn test kan ikke bevise dette. Testen er laget
for at Andreas kan kjøre den på under 15 minutter; agenten har ikke lyttet.

## Faste innstillinger (endres ikke mellom variantene)

| Felt | Verdi | Hvor |
|---|---|---|
| Modell | `gpt-realtime-2.1-mini` (`OPENAI_BOARD_REALTIME_MODEL` i `.env.local`) | GET `/api/prototype/realtime` viser `model` |
| Stemme | `marin` | `lib/realtime/session-config.ts` |
| Trimming | `truncation: "disabled"` | samme fil |
| Inputtranskripsjon | `gpt-4o-mini-transcribe`, `language: "no"` | samme fil |
| Turdeteksjon | `semantic_vad`, `eagerness: medium` | samme fil |
| Sesjonsgrenser | én aktiv samtale, 12 min, 2 min inaktivitet | `route.ts`, `sideband.ts` |

Kontrollér før start: `curl -s http://127.0.0.1:3101/api/prototype/realtime` skal svare `"model":"gpt-realtime-2.1-mini"`. Serveren må være startet etter `npm run build` (se runbook.md).

## Variantene

Én variabel endres om gangen. Hver variant starter i en NY samtale (Stopp → Start).

| Variant | Hilsen | Instruksjon | Formål |
|---|---|---|---|
| A | Standard (uten «Placy»): «Hei! Jeg kan vise deg rundt på Nyhavna. Hva er viktigst for deg …» | Full (SPRÅK + UTTALE OG STEMME + katalog) | Grunnlinje slik demoen kjøres |
| B | Med «Placy»: «Hei! Jeg er Placy og kan vise deg rundt på Nyhavna. Hva er viktigst …» | Full | Merkenavn-hypotesen |
| C | Standard (uten «Placy») | Bare språk/uttale-linjene, uten katalog og verktøyregler | Om Placy-instruksjonene og katalogen påvirker uttalen |

Variant B og C krever en midlertidig lokal endring (ikke commit):
- B: i `lib/realtime/nyhavna-greeting.ts`, sett `NYHAVNA_GREETING_TEXT` til varianten med «Jeg er Placy».
- C: i `lib/realtime/nyhavna-knowledge.ts`, la `nyhavnaInstructions` returnere bare de to første linjene av `NYHAVNA_INSTRUCTIONS` (SPRÅK og UTTALE OG STEMME) og temalista.
Bygg og restart mellom variantene (`npm run build` med 3101 stoppet, så `npm run demo:nyhavna`). Tilbakestill til A etterpå og bekreft med `git diff` at ingenting står igjen.

## De samme replikkene i hver variant (7 svar)

Si replikkene med vanlig stemme, normal romlyd. Vent til guiden er ferdig før neste, unntatt replikk 5 som er et avbrudd.

| # | Handling | Forventet |
|---|---|---|
| 0 | Start samtalen | Hilsen, ett spørsmål, ingen verktøy |
| 1 | «Jeg er mest opptatt av kaféer og kunst.» | `set_interests` → «Da begynner vi med …», 2–3 steder fremhevet i kartet, ingen detaljkort |
| 2 | «Fortell mer om det andre stedet.» | Riktig sted fra rekkefølgen; `show_place` eller fakta uten kartflytting |
| 3 | Trykk på temaet **Oppvekst** i raden (ikke snakk) | Guiden kommenterer kort og går videre der (`open_theme`) |
| 4 | «Hvilken skolekrets sogner boligen til?» | Katalogsvar (samme navn/tall/forbehold), stedet fremhevet |
| 5 | Avbryt midt i svaret: «Vent – hva med bussen til byen?» | Svaret stopper, `note_detour`, katalogsvar om buss, kartet flytter seg ikke etter det gamle svaret |
| 6 | «Ok, tilbake til det vi snakket om.» | `return_to_tour` → kort oppsummering av Oppvekst og neste tema |
| 7 | «Hva koster leilighetene?» | Kort: ikke grunnlag i kildene, ingen gjetting |
| – | Stopp | Serverloggen skriver `nyhavna_realtime_usage …` |

## Registrering per svar

Fyll én rad per svar (0–7) per variant. «Overgang» = hva som skjedde rett før svaret (tale, trykk, verktøy, avbrudd, retur).

| Variant | Svar # | Overgang | Dialekt/uttale stabil? (ja/nei) | Hvor avviket begynte (ord/setning) | Type avvik (aksent, dialekt, tempo, ord) | Notat |
|---|---|---|---|---|---|---|
| A | 0 | start | | | | |
| A | 1 | tale + verktøy | | | | |
| A | 2 | tale | | | | |
| A | 3 | trykk | | | | |
| A | 4 | tale + katalog | | | | |
| A | 5 | avbrudd | | | | |
| A | 6 | retur | | | | |
| A | 7 | tale | | | | |
| B | 0–7 | … | | | | |
| C | 0–7 | … | | | | |

Etter hver variant: noter målt kostnad fra serverloggen (`estimatedUsd`, `responses`) og antall svar med avvik.

## Tolkning – nøkternt

- Én god prøve beviser ikke at problemet er løst; sammenlign minst A og B med samme replikker.
- Skiller B seg fra A bare i svar 0, gjelder effekten navnet selv. Skiller B seg også i svar 1–7, påvirker navnet resten av samtalen.
- Er A og C like, bidrar ikke Placy-instruksjonene/katalogen til drift; er C bedre enn A, er det instruksjonsmengden som bør trimmes, ikke modellen som bør byttes.
- Vedvarer drift i alle varianter: dokumentér det som åpen begrensning. Neste avgrensede sammenligning er én variabel til – for eksempel stemmen `cedar` med identiske innstillinger – før dyrere endringer (fullmodell, annen leverandør). Ikke bytt automatisk.
- Kommentaren om at historikktrimming forårsaker drift er en hypotese. Trimming er avslått i alle variantene her, så testen sier ingenting om den.

## Status

| Dato | Hvem lyttet | Variant(er) | Resultat |
|---|---|---|---|
| 2026-09-13 | ingen – protokoll levert av agenten, ingen lydvurdering gjort | – | **Utestet.** Stemmekravet står åpent til Andreas har lyttet. |
| 2026-09-13 (kl. 10:40) | ingen – agenten tok opp lyden, men kan ikke vurdere den | A (standard) | **Lytteprøve klar, ikke vurdert.** 7 min opptak av én hel simulert samtale (hilsen, «kaféer og kunst», «det andre stedet», temaklikk Oppvekst, skolekrets, avbrudd om bussen, retur, pris) med mini + marin, tekstinput via `?voicedev=1` (replikkene er skrevet, ikke sagt – så opptaket viser guidens stemme, ikke gjenkjenning): `.context/nyhavna-lytteprove-2026-09-13.m4a` (ikke i git). Effektiv konfigurasjon i ny sesjon bekreftet: modell mini, stemme marin, `truncation: "disabled"`, semantic_vad medium. Variant B og C er ikke kjørt. Transkripsjonen viser slang («Konge», «Kjempegrei») og ett engelsk ord i tidligere kjøring («ready»); om dialekten holder kan bare ører avgjøre. |
