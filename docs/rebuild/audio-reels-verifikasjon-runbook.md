# Audio/Reels-verifikasjon — runbook (PRD 14 Unit 8)

**Bead:** `placy-ralph-r14.8` · **Kjørt:** 2026-07-05 · **Resultat: ALLE 6 AC PASS**

Beviser at audio-domenet FUNGERER (ikke bare kompilerer): full-pipeline TTS-validering
på ekte produksjonsmanus, override-akse-vern (reels-VO rører aldri tour-spor),
karaoke-sync i nystartet Chrome, Veo-nøkkel-fiks, keeper-tester og mekaniske porter.

---

## AC1 — Full-pipeline TTS-validering (IKKE snippet) ✓

**Metode:** Scratch-script (tmp/, ikke committet) som importerer den ekte
`generateAudio` fra `lib/audio-tour/elevenlabs-client.ts` og kjører et fullt
produksjonsmanus gjennom hele pipelinen (Erik / `eleven_turbo_v2_5` /
`language_code: "no"` / pronunciation-aliaser / karaoke-timings).
Referanse for HVORDAN: `scripts/elevenlabs-norsk-validation.ts`.

**Manus:** `.audio-staging/banenor-eiendom_stasjonskvartalet/natur-friluftsliv.manus.md`
— 59 ord / 424 tegn, valgt fordi det inneholder frittstående **«Nidelva»** som
trigger alias-remappen (`pronunciation-no.json`: `Nidelva → Nid-elva`).
Modellen er stokastisk per request — derfor fullt manus, aldri kort snippet
(memory: `feedback_tts_validation`).

**Bevis (kjørt 2026-07-05):**

| Sjekk | Resultat |
|---|---|
| `applyPronunciation.changed` | `true` — TTS-input inneholder alias «Nid-elva» |
| mp3 ≥ `MIN_BYTES` (5000) | PASS — 401 702 bytes |
| Alignment-felt til stede | PASS — characters/starts/ends = 424/424/424 |
| Timings remappet til original | PASS — `timings.characters.join("") === manus` |
| Original staving i timings | PASS — inneholder «Nidelva», IKKE «Nid-elva» |
| Monotone tider | PASS — varighet 25.0s, API-tid 2.5s |

**Re-kjøring:** lag script som over (assert de 5 sjekkene), `npx tsx <script>`.
Krever `ELEVENLABS_API_KEY` i `.env.local`.

## AC2 — Override-akse-vern bevist ✓

**Metode:** Temp-kopi av `data/projects/grilstad-marina/byggetrinn-4.json` med
`reelsAudio` KUN på natur-friluftsliv (unngår 7 TTS-kall), deretter:

```bash
shasum -a 256 public/audio/byggetrinn-4/*.mp3 > before.sha
npx tsx scripts/reels-voiceover-build-local.ts <temp-json> --force
shasum -a 256 public/audio/byggetrinn-4/*.mp3 > after.sha
diff before.sha after.sha
```

**Bevis (filsjekk før/etter, 17 filer):**
- ENESTE endrede fil: `natur-friluftsliv-reels.mp3` (ny hash — regenerert, 247 KB)
- Tour-sporet `natur-friluftsliv.mp3` **byte-identisk** (hash uendret)
- Alle 15 andre filer (welcome/hjem/outro + 6 tour + 6 reels) byte-identiske
- Temp-JSON fikk `url`/`voice`/`model`/`generatedAt`/`timings` (250/250/250,
  `characters.join === manus`)

**Feed-seleksjon:** `reels-data.test.ts` «bruker reelsAudio fremfor
audio-tour-sporet når begge finnes» (+2 søster-tester) grønn, OG live-bekreftet i
AC3: feeden spilte `natur-friluftsliv-reels.mp3` (override), ikke
`natur-friluftsliv.mp3` (tour).

**⚠️ Opprydding er PÅKREVD ved re-kjøring:** `git restore public/audio/byggetrinn-4/<tema>-reels.mp3`
etterpå. TTS er stokastisk — en regenerert mp3 matcher IKKE de sporede
JSON-timingene, og å beholde den desynker karaoke i demoen. mp3 + timings må
alltid committes som par (bygget skriver begge; her kastet vi begge).

## AC3 — Karaoke-sync verifisert i nystartet Chrome ✓

**Metode:** Prod-build servert på port 3010 (`npm run build && PORT=3010 npm run start`),
NYSTARTET Chrome-instans med ren profil:

```bash
open -na "Google Chrome" --args --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-r14-8 --no-first-run --no-default-browser-check
```

chrome-devtools MCP mot `http://localhost:3010/eiendom/grilstad-marina/byggetrinn-4/rapport-reels`,
viewport 390×844. Datakilde: lokal JSON-fallback (`getProjectAsync`) — byggetrinn-4
har alle 7 temaer med både tour- og reels-spor.

**Bevis:**

1. **Lyd-opplåsing:** klikk «Start opplevelsen» (user gesture) → `welcome.mp3`
   spiller (paused=false, muted=false).
2. **Alle 7 audio-bærende cards:** feeden auto-avanserte gjennom samtlige tema-cards
   (natur-friluftsliv → marina-båtliv → mat-drikke → hverdagsliv → trening-aktivitet
   → barn-oppvekst → transport → OPPSUMMERT-outro), hver med sitt
   `{themeId}-reels.mp3`-spor (override-aksen live).
3. **Karaoke følger currentTime (numerisk krysssjekk mot lagrede timings):**
   - hverdagsliv @ `t=4.99s`: forventet aktivt ord per timings = **«på»** → nettleser
     viste «Apotek, frisør og tannlege ligger tett samlet på» @ opacity 1,
     «Næring.» @ 0.4 (kommende). Match.
   - hverdagsliv @ `t=6.50s`: forventet = **«Grilstad»** (setning 3) → nettleser viste
     «Grilstad» @ 0.93 med gradert fade bak. Match.
4. **Original staving, ikke alias:**
   - Manuelt kapittelhopp (Velg kapittel → Marina & båtliv) + seek til
     kajakklagerplass-vinduet (9.44–10.33s per timings): @ `t=10.05s` viste karaoke
     «Ved Flipper Kafé kan du leie **kajakklagerplass.**» med ordet aktivt @ 0.99 —
     original samskriving (ordgrense-regelen aliaser IKKE «kajakk» inne i sammensatt ord).
   - Alias-staving («kaják»/«Nid-elva») fantes ALDRI i DOM (sjekket på flere cards).
   - Statisk fundament: alle 17 lagrede spor i byggetrinn-4.json (7 tour + 7 reels +
     welcome/hero/outro) har `timings.characters.join("") === manus` (original tekst).
5. **Interaksjon:** tap-to-pause + «Spill av»-resume + manuell kapittelnavigasjon OK.
6. **Konsoll:** kun favicon-404 + én aria-hidden-advarsel (welcome-overlay, utenfor
   audio-domenet). Ingen audio-/data-feil.

**Gotcha (gjenbrukbar):** feeden har ETT persistent `<audio>`-element
(`AudioElementProvider`) og auto-avanserer ved trackslutt — flertrinns
scripting mot «gjeldende spor» må gjøres ATOMISK i én `evaluate_script`
(pause → seek → play → sample), ellers rekker auto-advance å bytte spor mellom
kallene. Syntetiske `TouchEvent`-swipes tolkes som tap (pause), ikke swipe —
bruk kapittelmenyen for manuell navigasjon via CDP.

## AC4 — Veo-nøkkel-fiks verifisert (differensiert) ✓

Statisk verifikasjon av `scripts/animate-scene-veo.ts` (fiksen landet i r14.5,
linjenumre per 2026-07-05 — bead-teksten refererte :152/:186/:216 fra før r14.5):

| Sted | Kall | Auth |
|---|---|---|
| `:174` (`startOperation`) | POST `generativelanguage.googleapis.com/...:predictLongRunning` | `x-goog-api-key`-header ✓ |
| `:188` (`pollOperation`) | GET operation-status | `x-goog-api-key`-header ✓ |
| `:220` (`downloadVideo`) | GET Google-RETURNERT `video.uri` | nøkkel i query-param — DOKUMENTERT notat `:216-219` (transient signert media-URI; header-aksept ikke empirisk verifiserbar uten faktisk Veo-respons) |

`grep "key=" `: eneste treff i førsteparts-scripts er `:220`. Ingen nøkkel-i-URL i
`compose-reels-bg.ts` / `generate-reels-posters.mjs`. Konformt med Beslutning #4
(PRD 14 §9) og CLAUDE.md header-regelen.

## AC5 — Keeper-tester grønne ✓

| Testfil | Tester |
|---|---|
| `lib/audio-tour/pronunciation.test.ts` | 8 ✓ |
| `lib/audio-tour/storage-paths.test.ts` | 5 ✓ |
| `lib/audio-tour/manus.test.ts` | 28 ✓ |
| `lib/stores/audio-tour-store.test.ts` | 24 ✓ |
| `components/variants/report/reels/__tests__/reels-data.test.ts` (override) | 39 ✓ |
| `components/variants/report/board/audio-tour/karaoke-tokens.test.ts` | 13 ✓ |
| `components/variants/report/board/audio-tour/KaraokePitchText.test.tsx` | 6 ✓ |

## AC6 — Mekaniske porter grønne ✓

| Port | Resultat |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors (168 warnings, pre-eksisterende) |
| `npx vitest run` | **1501/1501** tester, 123 filer |
| `npm run build` | exit 0 |
