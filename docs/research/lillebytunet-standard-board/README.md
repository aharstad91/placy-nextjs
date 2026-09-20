# Lillebytunet på standardboardet — gjenbrukstesten

Lillebytunet (`skanska/lillebytunet`, rute
`/eiendom/skanska/lillebytunet/rapport-board`) er det tredje prosjektet som
kjøres gjennom den felles standardboard-harnessen, etter Nyhavna og
Leangenbukta. Forskjellen er at Lillebytunet aldri har hatt en egen lokal
demo-runtime: det gikk rett på standardboardet.

## Hva gjenbruken faktisk krevde

**Ingen prosjektspesifikk kode.** Ingen `lillebytunet`-sjekk finnes i
`app/`, `components/` eller `lib/` for boardet. Den innrammede desktop-layouten,
det felles stedspanelet i venstrekolonnen, kategoriraden, mobilflyten og
2D/Satellitt/3D-velgeren kom med `lib/board/report-presentation.ts`-standarden
uten at noe måtte skrus på. Den eldre opplevelsen brukeren så (kartpopup,
«Steder»-fane, accordion) lå bare på `main`.

**Alt som manglet var prosjektkonfigurasjon**, og den ble skrevet gjennom de
eksisterende generiske skriptene — samme kommandoer som for Nyhavna og
Leangenbukta, bare med andre `--customer`/`--project`:

```bash
# 1. Rollback-punkt FØR skriving
npx tsx scripts/snapshot-board-migration.ts \
  --customer skanska --project lillebytunet \
  --output docs/research/lillebytunet-standard-board/audited/2026-09-20-rollback-snapshot.json

# 2. Tørrkjør, så skriv (utelat --write for tørrkjøring)
npx tsx scripts/configure-board-brand.ts   --customer skanska --project lillebytunet \
  --input audited/2026-09-20-production-brand.json   --receipt audited/2026-09-20-brand-receipt.json   --write
npx tsx scripts/configure-board-content.ts --customer skanska --project lillebytunet \
  --input audited/2026-09-20-production-content.json --receipt audited/2026-09-20-content-receipt.json --write
npx tsx scripts/configure-board-assistant.ts --customer skanska --project lillebytunet \
  --name Anja --greeting "<hilsen>" --receipt audited/2026-09-20-assistant-receipt.json --write

# 3. Kvitteringer
npx tsx scripts/inspect-standard-board.ts --customer skanska --project lillebytunet
npx tsx scripts/evaluate-board-assistant.ts --customer skanska --project lillebytunet \
  --receipt audited/2026-09-20-assistant-evaluation.json
```

Alle tre skrivene er idempotente merge-operasjoner med optimistisk lås, og
rulles tilbake med `scripts/restore-product-config.ts` mot
`audited/2026-09-20-rollback-snapshot.json`.

## Hva det tredje prosjektet avdekket i den DELTE koden

Fem ting som lå i felles kode og ikke kunne ses med bare to prosjekter:

1. **Hilsenen falt tilbake til Nyhavnas.** Et board uten egen
   `assistant.greeting` presenterte seg som Nyhavna. Fallbacken navngir nå
   boardets eget sted (`lib/realtime/board-greeting.ts`).
2. **Brand-skjemaet krevde en splash-film.** Lillebytunet har ingen hero-film på
   prosjektsiden sin. `splashVideoUrl` er nå valgfri.
3. **Et brandet prosjekt uten film pekte på en fil som ikke fantes.**
   `getProjectSplashVideo` gjettet `{slug}-splash-video.mp4` ut fra
   `brand`-flagget alene. Stien utledes nå bare når `splashVideo`-flagget sier
   at fila finnes.
4. **Uttalehintet var en slug-sjekk.** `productionVoiceInstructions` hadde en
   hardkodet `if` for Leangenbukta. Hintet er nå `assistant.pronunciation` per
   board, så et nytt prosjekt kan sette sitt eget etter en lyttetest uten
   kodeendring. Leangenbuktas verdi står igjen som midlertidig kompatibilitet
   til den er skrevet til boardets egen konfigurasjon.
5. **Mobilsplashens overskrift var uleselig.** CSS-regelen farget `h1` med
   prosjektets mørke `--foreground` også på mobil, der splashen er et full-bleed
   foto med hvit tekst. Regelen gjaldt Nyhavna like mye; den er nå scopet til
   desktop-splashen. Samme runde byttet logo-selektoren fra `src$="-logo.svg"`
   til `img[data-board-logo]`, så en PNG-logo får riktig størrelse.

## Hva som IKKE er gjort, og hvorfor

| Mangler | Grunn |
|---|---|
| **Eget prosjekttema** (som «Nyhavna som bydel» / «Leangenbukta») | Krever en redaksjonell brødtekst om prosjektet. Lillebytunet har 0 researchpakker og 0 `research_claims`. Et tema uten kildekontrollert tekst ville vært oppdiktet. |
| **Reviderte prosjektfakta og kuraterte FAQ-er** | Samme grunn. Boardet har de 119 genererte nivå-1-kunnskapspostene og den genererte FAQ-katalogen, men ingen auditert researchpakke. Anja svarer korrekt «jeg har ikke grunnlag for det» på brede prosjektspørsmål — det er verifisert maskinelt. |
| **Splash-film** | Finnes ikke på prosjektsiden. Feltet er nå valgfritt; splashen viser stillbildet. |
| **`standalonePoiIds`-kuratering** | Krever at noen ser etter virksomheter som forsvinner under et senteranker. Bør gjøres når noen har sett på kartet med salgsøyne. City Lade har allerede et fungerende «I senteret»-register. |
| **Megler-/kontaktdata** | Ingen `brokers` finnes. Kortet er skjult (`hideBrokerCard`) i stedet for å vise en tom seksjon. |
| **Offentlig rute og voice-binding** | `voice_projects` har ingen rad for prosjektet (`publicRoute: null`). Samme cutover-port som de to andre. |

Åtte researchrunder etter modellen i `docs/demos/boligprosjekt-arbeidsprosess.md`
er neste steg hvis Lillebytunet skal opp på nivå 2.

## Manuelle porter som står igjen

- Fysisk lyttetest på en HTTPS-origin: norsk uttale av «Lillebytunet», tempo,
  avbrudd midt i et svar. Viser testen at navnet trenger et uttalehint, settes
  det i `assistant.pronunciation` — ikke i kode.
- Avvist mikrofon → forståelig gjenopprettingsmelding.
- Visuell klientkvittering for «vis flere steder» (server­kontrakten er testet).
