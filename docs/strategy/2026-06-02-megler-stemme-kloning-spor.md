# Megler-stemme-kloning — personalisering & dialekt som avtale-spak

**Dato:** 2026-06-02
**Tema:** Bruke ElevenLabs voice cloning til å (a) personalisere voice-over med en megler sin egen stemme, og (b) tilby en lokal dialekt-stemme (f.eks. trønder) som del av en kjede-avtale.
**Status:** Hypotese — ikke validert. Ingen pilot kjørt. Teknisk feasibility bekreftet, produkt-/forretnings-effekt udokumentert.
**Relatert:**
- `docs/strategy/2026-05-24-placy-reels-cross-vertical.md` — voice-over er allerede kjernen i Reels-asset'en; kloning er en personaliserings-akse på toppen
- `lib/audio-tour/elevenlabs-client.ts` — TTS-pipelinen som tar `voiceId` som parameter
- Memory: `project_audio_tour_status` (PVC notert som deferred strategisk grep), `reference_audio_tour_pipeline`, `feedback_norsk_tts_stedsnavn`

---

## Kjernepåstand

ElevenLabs voice cloning gjør stemmen til en **konfig-akse, ikke en ombygging**. Pipelinen vår tar allerede `voiceId` som parameter (`generateAudio(params)` i `lib/audio-tour/elevenlabs-client.ts`), så en klonet stemme er bare en ny ID — `language_code: "no"`-oppskriften, karaoke-timings og uttale-aliasene (`pronunciation-no.json`) er uendret. Klonen fanger *identiteten* (timbre, tonefall); modellen (`eleven_turbo_v2_5`) håndterer fortsatt norsken.

Det åpner to distinkte produkt-grep:

1. **Per-megler personalisering** — gjenskap meglerens egen stemme, slik at Rapport/Reels/audio-tour høres ut som *deres* megler guider gjennom nabolaget. Personlig tillit som differensiator.
2. **Dialekt-stemme som kjede-avtale-spak** — hvis en hel meglerkjede blir med, kan en del av avtalen være en dedikert lokal dialekt-stemme (f.eks. **trønder** for et Trondheim-basert kjede). Det blir kjedens "husstemme" — lokal autentisitet ingen nasjonal konkurrent matcher med en generisk bokmåls-TTS.

## Teknisk: de to veiene i ElevenLabs

| | **Instant Voice Cloning (IVC)** | **Professional Voice Cloning (PVC)** |
|---|---|---|
| Opptak som kreves | 1–2 min ren tale | 30 min minimum, ~3 t optimalt |
| Trening | sekunder (few-shot ved inferens) | timer (fine-tuner modellvekter) |
| Kvalitet | god, "preg" kan glippe på lange spor | tett på ekte, holder over lengde |
| Plan-tier | Starter+ | Creator+ |
| Samtykke | bekreftelses-checkbox | **Voice-captcha** (personen leser verifiseringssetning) |

**Anbefalt rekkefølge:** IVC-spike først (validér konsept + emosjonell effekt på en ettermiddag), PVC når det blir en faktisk produkt-leveranse.

Opptakskvalitet er avgjørende uansett vei: ett menneske, ingen romklang/bakgrunnsstøy, konsekvent mikrofon, lest **på norsk** — ideelt i samme sjanger som rapportene, så klonen fanger riktig prosodi. Bygg-tid, ikke runtime (klone lages én gang via dashboard/script, generering skjer i pipelinen) — i tråd med CLAUDE.md-regelen om ingen runtime LLM/TTS-kall.

## De to grepene utdypet

### 1. Per-megler personalisering

**Verdi:** Boligkjøper-segmentet (25–45) reagerer på personlig tillit. "Din megler forteller deg om nabolaget" slår en anonym AI-stemme. Forsterker megler-spor / bolig-spor (Propr-pilot) som differensiator mot statiske områdesider.

**Friksjon:** Hver megler må onboardes med et opptak. Det er en kostnad i salgsløpet og en operasjonell oppgave. Egner seg som **premium-oppgradering**, ikke default.

### 2. Dialekt-stemme som kjede-avtale-spak

**Verdi:** En meglerkjede som signerer får noe konkret og eksklusivt: en lokal dialekt-husstemme. For et Trondheim-kjede er trønder-stemme et salgsargument *til kjeden* ("deres rapporter høres lokale ut") og *til deres kunder* (autentisitet). Lav marginalkostnad for oss (én klone gjenbrukes på alle kjedens prosjekter), høy opplevd verdi.

**Variant:** Kan være klone av en konkret person (kjedens talsperson, en kjent lokal stemme) eller en designet regional stemme som blir kjedens faste identitet.

### Husstemme vs. per-megler — mellomledd

"Erik" i dag er en nøytral husstemme (null friksjon). Anbefalt modell: **husstemme som default, klone som oppgradering**. Per-megler = premium-personalisering. Per-kjede dialekt = avtale-komponent. Da slipper vi friksjon i hvert salg, men har oppside-spaker når en kunde vil betale for det.

## Samtykke, jus og opphør (ikke valgfritt)

ElevenLabs krever samtykke (captcha for PVC). Men det reelle spørsmålet er forretnings-/personvern, ikke bare ToS: vi genererer innhold med en persons identitet.

- **Skriftlig samtykke** som dekker *bruk* og *opphør* — hva skjer når megleren bytter jobb eller kjeden sier opp avtalen?
- **Klonen knyttes til oppdrag/avtale**, ikke evig bruk. Stemme-identitet bør kunne trekkes tilbake.
- For dialekt-kjede-stemme: avklar hvem som "eier" stemme-identiteten hvis avtalen avsluttes.

Dette er et åpent punkt som må løses *før* første eksterne pilot med en navngitt persons stemme.

## Risici og åpne spørsmål

- **Emosjonell respons ukjent** — er det tillitsbyggende eller creepy at megleren "snakker" via AI? Må valideres med ekte målgruppe før vi bygger på det.
- **Norsk stedsnavn-TTS** — kjent problem (`feedback_norsk_tts_stedsnavn`). Gjelder uansett stemme; uttale-aliasene løser det, men klone-kvalitet kan endre hvordan aliaser oppfører seg → re-validér på full pipeline (`feedback_tts_validation`).
- **Samtykke-/opphørs-flyt** — uløst, blokkerer ekstern pilot med navngitt stemme.
- **Operasjonell skala** — per-megler-onboarding krever en opptaks-/klone-rutine. Self-serve er et separat utviklings-faseproblem (samme som Reels self-serve-UI).
- **Plan-kost** — PVC krever Creator+; verifiser at antall kloner/tier passer en kjede-avtale-modell.

## Beslutning fra denne noten

1. **Megler-stemme-kloning er et anerkjent fremtidig grep**, ikke et aktivt spor ennå. Det endrer ikke prioriteringen i `2026-05-06-events-spor-trondheim.md` (hotell først).
2. **To bruk dokumentert:** (a) per-megler personalisering som premium-oppgradering, (b) dialekt-husstemme som kjede-avtale-komponent.
3. **Default forblir nøytral husstemme** ("Erik") — kloning er oppside-spak, ikke MVP-krav.
4. **Samtykke-/opphørs-flyt må løses før ekstern pilot** med navngitt stemme.

## Neste konkrete steg

1. **IVC-spike** (lav kostnad): be én villig megler om ~2 min opptak, klon via ElevenLabs-dashboard, swap `voiceId` i ett Reels-spor, lytt — validér kvalitet *og* emosjonell effekt før PVC-investering.
2. Vurder dialekt-stemme konkret når et Trondheim-kjede materialiserer som prospect.
3. Skissér samtykke-/opphørs-mal før første navngitte pilot.
