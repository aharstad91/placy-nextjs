---
title: "Norsk språkdrift i ElevenLabs TTS — seed-låsing gjør lotteriet deterministisk"
category: api-integration
tags: [elevenlabs, tts, audio-tour, sprakdrift, seed, previous_text, determinisme, eleven_v3, voice-verification, gemini-eval]
module: audio-tour
date: 2026-08-03
symptom: "Audio-tour-spor uttales med dansk eller svensk fonetikk i tilfeldige regenereringer, uten at parametere er endret"
root_cause: "TTS-samplingen er stokastisk per request; i tillegg mangler alle norske stemmer i kontoen språkverifisering for eleven_v3"
status: eksperiment-validert-ikke-implementert
---

# Norsk språkdrift i ElevenLabs TTS — seed-låsing gjør lotteriet deterministisk

## Problem

Audio-tour-spor (Erik / `eleven_turbo_v2_5` / `language_code: "no"`) uttales
periodisk med dansk eller svensk fonetikk. Samme manus, samme parametere,
tilfeldig utfall per regenerering. På kundeleveranser er dette diskvalifiserende:
du kan ikke garantere at en regenerering ikke bytter språk bak ryggen din.

Målt på Grilstad Marina-manuset: baseline traff drift i **1 av 3 kjøringer** på
det verste sporet.

## Environment

- Module: `lib/audio-tour/elevenlabs-client.ts`
- Voice: Erik `EpYEY8MWJrUGskHBoNMA` (professional voice clone, no-NO, oslo)
- Modell: `eleven_turbo_v2_5`, `language_code: "no"`, stability 0.75
- Testkorpus: 10 produksjonsmanus fra Grilstad Marina byggetrinn 4 (194–344 tegn)
- Date: 2026-08-03

## Root Cause

To uavhengige årsaker, som tidligere ble blandet sammen:

**1. Samplingen er stokastisk per request.** Uten `seed` sampler modellen fritt.
Den skandinaviske språk-prioren ligger tett nok på norsk at enkelte samples
lander i dansk/svensk fonetikk. Dette er ikke en feilkonfigurasjon — det er
default-oppførsel.

**2. `eleven_v3` mangler norsk stemmestøtte i vår konto.** Alle seks norske
stemmer (Erik, Emma, Mia, Sebastian, Øyvind, Olaf) har `verified_languages` for
norsk **kun** på `eleven_turbo_v2_5`, `eleven_flash_v2_5` og `eleven_v2_5_flash`.
Ingen er verifisert for `eleven_v3` eller `eleven_multilingual_v2`.
Sjekk selv:

```bash
curl -s "https://api.elevenlabs.io/v2/voices?page_size=100" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" | \
  jq '.voices[] | select(.labels.language=="no") |
      {name, high_quality_base_model_ids,
       no_models: [.verified_languages[] | select(.language=="no") | .model_id]}'
```

Kjører du v3 på en stemme den ikke er tilpasset, faller den tilbake på egen
prior — derav dansken. Det var dette som ble feiltolket som «v3 er dårlig på
norsk» i mai-valideringen.

## What Didn't Work

- **`voice_settings.speed: 0.95`** — community-rådet om 0,9–1,0 mot aksentdrift
  gjelder ikke norsk. **Forverret kraftig**: drift i 2/3 kjøringer (mot 1/3 på
  baseline), norskhet-score ned fra 8,0 til 5,7. Ikke rør denne.
- **`eleven_flash_v2_5` som drop-in** — rå (uten primer) var den *verre* enn
  turbo: drift i 2/3, norskhet 5,3 mot turbos 8,0. Med primer ble den derimot
  best på naturlighet (7,0 mot turbos 5,0). Ingen entydig vinner.
- **`previous_text` på `eleven_v3`** — API-et avviser det:
  `400 unsupported_model: "Providing previous_text or next_text is not yet
  supported with the 'eleven_v3' model"`. v3 kan altså ikke bruke det eneste
  virkemidlet som demper drift.
- **ElevenLabs Scribe (`/v1/speech-to-text`) som drift-detektor** — vår API-nøkkel
  mangler STT-scope (`401 unauthorized`). Bruk Gemini på lyd i stedet.

## Solution

Tre grep, i rekkefølge etter hvor mye de bidrar:

**1. `seed` — den strukturelle løsningen.** `seed` gir **byte-identisk**
determinisme, ikke bare «best effort» som dokumentasjonen antyder. Verifisert med
sha256: samme seed × 3 kjøringer ga identisk hash, og reproduksjon etter et
seed-sweep ga identisk hash på både turbo og flash.

Det gjør drift om fra *et lotteri ved hver regenerering* til *et engangsvalg per
spor*: søk seeds én gang, behold den som gir rein norsk, lagre seed sammen med
lyden.

**2. `previous_text` — språk-priming.** En rein norsk primer-setning før
teksten fjerner den systematiske drift-tendensen (0/3 drift mot baselines 1/3, og
på flash: norskhet 5,3 → 7,7, naturlighet 4,3 → 7,0).

```ts
const PRIMER =
  "Vi fortsetter turen gjennom nabolaget her i Trondheim. Jeg forteller deg hva som ligger rundt deg.";
// body: { text, model_id, language_code: "no", voice_settings, previous_text: PRIMER, seed }
```

Merk: `previous_text` påvirker ikke `alignment` — karaoke-timings gjelder fortsatt
kun `text`, så remap-logikken i `pronunciation.ts` er urørt.

**3. Gemini som automatisk port.** Generer → evaluer → søk nytt seed ved drift.
Send MP3-en som `inline_data` til `gemini-2.5-flash` med en fonetiker-prompt som
tvinger **numerisk** norskhet-score (kategorisk «norsk/ikke norsk» er for slapp —
den stemplet klipp som norske der Andreas hørte dansk). Be eksplisitt om
nabospråk-markører: dansk bløt d / stød / svelget r / reduserte endevokaler;
svensk syngende melodi / sje-lyd / u-farget vokal.

Port som ble brukt: `drift === "ingen" && norskhet >= 8 && naturlighet >= 6`.

## Verification

Full dekning over alle 10 Grilstad-spor, ikke stikkprøve:

**10 av 10 spor bestod porten, 19 genereringer totalt (snitt 1,9 forsøk/spor).**
Fordeling: 5 spor traff på første seed, 3 spor på andre, `barn-oppvekst` på
tredje, `hverdagsliv` krevde fem.

Låst seed-tabell (turbo + primer, samme voice_settings som prod):

```
welcome            1        hverdagsliv        777
hjem               1        trening-aktivitet  1
outro              99999    barn-oppvekst      42
natur-friluftsliv  99999    transport          1
marina-batliv      99999    mat-drikke         1
```

Seed-hit-rate på det verste sporet: **turbo + primer 5/8 seeds brukbare,
flash + primer 3/8** — men flash sitt beste take var settets absolutte topp
(10/10 norskhet + 10/10 naturlighet, seed 1234).

## Why This Works

Drift er ikke en feil som kan konfigureres bort — den er en region i
sample-rommet. `previous_text` flytter fordelingen bort fra den regionen;
`seed` fjerner tilfeldigheten i hvor du lander. Sammen konverterer de et
sannsynlighetsproblem til et kurateringsproblem, som er den typen problem vi
allerede har verktøy for (jf. alias-ordlista).

## Prevention

- **Gemini-dommeren er støyende — bruk den som grovsil, ikke finmåler.**
  Byte-identisk lyd fikk 10/10 i én evaluering og 9/10 i neste. Terskler skal
  settes med margin, og et menneske må signere av settet.
- **Seed må lagres sammen med lyden**, ellers er determinismen verdiløs.
  Naturlig plass: ved siden av `url`/`voice` i `reportConfig`-audio-objektene.
- **Enhver manus-endring invaliderer sporets seed** — teksten er del av
  sample-input. Endret manus ⇒ nytt seed-søk for det sporet (ikke for de andre).
- **Sjekk `verified_languages` per modell før du vurderer modellbytte.**
  «Modellen støtter norsk» er ikke nok; *stemmen* må være verifisert for norsk
  på *den modellen*. Dette er den sjekken som manglet i mai-valideringen.
- **Ikke gjenta `speed`-eksperimentet.** Det er testet og skader.

## Status og gjenstående

**Eksperiment-validert, IKKE implementert.** Parkert 2026-08-03 etter Andreas'
lytting («mulig det er litt endringer her» — merkbar men ikke avgjørende
forbedring på hans ører). Ingen prod-filer eller DB rørt.

Ved gjenopptakelse:
1. Kalibrer porten mot Andreas' ører først — hører han drift i et sett som
   bestod, skal terskelen strammes før koden endres.
2. Deretter er pipeline-endringen liten og rent additiv: `previous_text` + `seed`
   i `generateAudio`, seed lagret per spor. Ingen modellmigrering, samme stemme,
   samme `voice_settings`.
3. Krever `reportConfig.audioVersion`-bump + regenerering av alle boards.

Eksperiment-scriptene lå i gitignorert `tmp/` (`v3-spike.ts`,
`drift-matrix.ts`, `seed-lock.ts`, `seed-gate-full.ts`) og er ikke bevart —
oppskriften over er tilstrekkelig for å bygge dem opp igjen.

## Related Issues

- `docs/solutions/` → alias-ordliste-sporet er beskrevet i
  `scripts/tts/pronunciation-no.json` + `lib/audio-tour/pronunciation.ts`
- `PROJECT-LOG.md` → 2026-08-03
