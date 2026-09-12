# Bruktbolig-prototype: mobil talesamtale som bygger grensesnittet

Dato: 2026-09-12. Brief: `docs/plans/2026-09-12-mobile-voice-bruktbolig-claude-brief.md`.
Status: lokal prototype, ikke publisert, ikke pushet.

## Prøv den

```bash
npm run dev -- -p 3103
```

| URL | Hva |
|---|---|
| `http://localhost:3103/prototype/bolig` | Ekte norsk tale (OpenAI Realtime, krever `OPENAI_API_KEY` i `.env.local`). Mikrofon og betalt samtale starter først når du trykker «Snakk om nabolaget». |
| `http://localhost:3103/prototype/bolig?sim=1` | Lokal simulering med forhåndsskrevne svar. Gult «Simulering»-merke. Beviser layout og flyt, ikke samtalekvalitet. |

Nyhavna-demoen på port 3101 er uendret.

## Demoverdenen

- **Boligen er fiktiv**: «Enebolig på Ranheim», Eksempelvegen 12 (finnes ikke). Punktet 63.4318, 10.5165 ligger i et reelt boligfelt på Ranheim. Bildet er en Placy-illustrasjon (Gemini) og merkes «Illustrasjon».
- **Stedene er ekte**: hentet fra Placys stedsdatabase (`v2.pois`, Google Places / Nasjonalt skoleregister / Barnehagefakta / Entur / OpenStreetMap / kuratert strøkstekst), med kilde og kontrolldato per sted. Gangtider er målt med Mapbox Directions fra boligens punkt.
- **Selgerens erfaring er fiktiv** og merkes «Selgerens erfaring · Eksempeldata» både i verktøyresultatet og på skjermen.
- **Ukjent er ukjent**: skolekrets, barnehageopptak, rutetider, åpningstider nå og badevannskvalitet svares ærlig med peker til faktisk kilde der vi har en.

## Arkitektur i én setning

Tale eller trykk → én brukermelding i samtalen → serveren kjører kunnskapsverktøyet mot fixturen → resultatet leses av modellen (kort talesvar) OG av nettleseren (kort, kart, kilder) → samme sted i tale og på skjerm.

| Del | Fil |
|---|---|
| Felles kontrakt (typer, blokker, sesjon) | `lib/prototype/bolig/contract.ts` |
| Fixture (bolig, steder, kilder, selger, ukjente) | `lib/prototype/bolig/fixture.ts`, `travel-times.ts` |
| Kunnskapsverktøy + instruksjoner | `lib/prototype/bolig/knowledge.ts` |
| Verktøyresultat → blokker | `lib/prototype/bolig/blocks.ts` |
| Simulering | `lib/prototype/bolig/simulated-session.ts` |
| Ekte tale (WebRTC-hook) | `lib/prototype/bolig/use-voice-session.ts` |
| Server (session-fabrikk, serverstyrt samtale) | `app/api/prototype/bolig/realtime/route.ts`, `lib/realtime/sideband.ts` (nå med `scope`) |
| UI | `components/prototype/bolig/` |
| Side | `app/prototype/bolig/` |

Serveren eier kunnskap, videreføring, 12-minutters tak, 2 minutters inaktivitet og opprydding (hangup). Nettleseren eier mikrofon, lyd, transkript og kartmarkering (`show_place`). Kategoritrykk og stedsvalg sendes som brukermeldinger; siste handling avbryter forrige svar. Agentens eget temaskifte (via `get_topic`) oppdaterer aktiv kategori uten ny svarsløyfe.

## Verifisering (2026-09-12)

**Simulering, Chrome 390×844 (iPhone-bredde), nystartet Chrome med eget profil:**
- Forside → «Snakk om nabolaget» → hilsen → trykk «Barn og oppvekst» avbryter hilsen (markør slukker) → 5 stedskort med gangtid og «Dokumentert», minikart med bolig og steder, «Dette sier selgeren» merket «Selgerens erfaring · Eksempeldata», to «Ukjent»-blokker (skolekrets, barnehageplass) med kildelenke, «Kilder»-rad med kontrolldato.
- Minikart → fullskjermskart med fem markører + lukkeknapp → markørtrykk lukker kartet, body-overflow gjenopprettes, og stedet får eget svar med kilder.
- Ingen horisontal scroll, 0 konsollfeil.

**Ekte tale (OpenAI Realtime, `gpt-realtime-2.1-mini`, stemme ash), to korte sesjoner fra Mac-en. Mikrofon var Mac-ens egen med bare romlyd; ingen naturlig norsk taleinput ble gitt.**

| Prøve | Resultat |
|---|---|
| Start → hilsen | Tilkoblet på 3,5–4,5 s. Norsk hilsen spilt og transkribert. |
| Trykk «Dagligvare» mens den snakker | Hilsen avbrutt umiddelbart. `get_topic` kjørt på serveren → 5 kort, selgerblokk, «Ukjent» (åpningstider), kilder. Talesvar nevnte Extra Grilstad 9 min, Rema/Bakeri 10 min, og «Selgeren forteller …». |
| Kortvalg (Rosenborg Bakeri), første forsøk | Modellen gjenga den lange Google-ID-en feil → «Ukjent sted». Rettet: `resolvePlace` godtar navn og unik ID-del; kontekstmeldingen gir `place_id` eksplisitt. |
| Trykk «Selgeren forteller» | Selgerblokk + «Ukjent» (støy/trafikk). Talen tilskrev selgeren og sa at det er én persons opplevelse. |
| Stopp | Status «Avsluttet», mikrofon og lyd av, `DELETE` → server-hangup, tilstandsfil fjernet. |
| Andre sesjon: «Mat og kafé» → kortvalg Restaurant Romantica → Stopp | Stedsvalget fungerte etter rettingen (kort, selger, kilder, 6 min å gå). Statusflyt Tenker → Snakker → Lytter korrekt. |

Rapportert forbruk fra serverloggen (eksklusive inputtranskripsjon): sesjon 1: 9 svar, 16 983 inn / 3 277 ut tokens, ≈ $0,042. Sesjon 2: 5 svar, 8 117 inn / 2 079 ut, ≈ $0,033. Ingen 429/rate-limit.

**Repo-sjekker:** `npx tsc --noEmit` 0 feil. `npm run lint` 0 feil (eksisterende advarsler). Modultester `lib/prototype/bolig` + `components/prototype/bolig`: 33 tester grønne (fixture-validering, kunnskapsverktøy, blokker, route-sikkerhet, UI-render). Realtime-tester for sideband/supervisor/Nyhavna-route grønne etter `scope`-parametriseringen. Se PROJECT-LOG for fullsuite og build.

## Kjente begrensninger

- **Ikke prøvd med ekte norsk taleinput, på telefon eller med uinnvidd bruker.** Det som er verifisert er kjeden trykk → verktøy → kort/kart/kilder → talesvar, og at avbrudd og stopp virker. Samtalekvalitet med mikrofon er åpen.
- **Latens:** 20–30 s fra trykk til ferdig talesvar på mini-modellen når et verktøykall inngår (verktøyrunde + nytt svar). Merkbart for en «samtale».
- **Modellen narrerer** («La meg se nærmere …», «Ett øyeblikk») før verktøykall til tross for instruks. Mini-modellen følger denne regelen dårlig.
- **Stedskort uten bilde** viser en tom fargeflate (bare 6 av 34 steder har Google-bilde).
- **Telefonprøve krever HTTPS**: mikrofon og WebRTC trenger sikker origin. Sett `PLACY_REALTIME_EXTRA_HOST=<din-ngrok-vert>` i `.env.local` og åpne via ngrok; ellers svarer endepunktet 404 for alt annet enn localhost.
- **Inaktivitet/12-minutterstak** er arvet fra Nyhavna-sidebandet og enhetstestet der, ikke prøvd live i denne runden.
- Åpningstider fra Google ligger i fixturen men leses ikke opp som fakta; kjede-tilhørighet og antall anmeldelser brukes som fyllfakta der stedet mangler redaksjonell tekst.

## Læringsnotat

1. **Ett verktøyresultat, to lesere.** Å la nettleseren lese de samme `function_call_output`-elementene som modellen fjernet en hel rundtur («vis kort»-verktøy) og garanterer at tale og skjerm handler om samme sted. Kontrakten `ToolResult → Block[]` er den viktigste fila.
2. **Opphav må være et datafelt, ikke en tekstkonvensjon.** `provenance` følger hvert sted, sitat og faktum fra fixture via verktøyresultat til badge. Modellen tilskrev selgeren riktig i alle prøvene fordi feltet stod i resultatet.
3. **Lange ID-er er en feilkilde for tale-modeller.** Google-place-ID-er ble gjengitt feil ved første stedsvalg. Løsningen er fuzzy oppslag på serversiden, ikke strengere instruks.
4. **Lydbufferen er én strøm.** Etter et verktøykall kommer ingen ny «output_audio_buffer.started»; status må avledes av transkript-deltaer også.
5. **Kuratert strøkstekst + registerdata** var nok til en troverdig demoverden på under en time, uten nettsøk. Det som manglet var bilder og sanntid (åpningstider, ruter), som er nettopp det som må merkes «Ukjent».
