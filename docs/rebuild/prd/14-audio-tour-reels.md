# PRD 14 — Audio-tour + reels-pipeline

> **Dato:** 2026-06-26
> **Status:** Brainstormet og besluttet. Klar for utvikling. (Fase 1 har ingen blokkerende åpne spørsmål — override-akse-grensen mot tour-sporet er RATIFISERT som Beslutning 1, og runtime-playback-grensen 09↔14 er RESOLVERT, ikke åpen, jf. §3 + Beslutning 8.)
> **Lag (byggrekkefølge):** Lag 4 (admin + media + overflate) — `00-INDEX:59`. Bygges etter PRD 5 (board-data/state) og PRD 9 (board-skall + reels-VIDEO-UX). Blokkerer ikke MVP (`00-INDEX:64`).
> **PRD-nr:** 14 av 15 (sommer-rebuild 2026)
> **Slug:** `prd-audio-tour-reels`
> **Kontekst:** Lag-4-PRD. Eier hele AUDIO-domenet: build-time TTS-pipelinen (ElevenLabs Erik/turbo_v2_5/no/stability 0.75), reels(SOME-video)-genererings-pipelinen, **reels-audio-override-aksen** (`reelsAudio ?? audio` = nivå-2-differensiator, override ikke replacement), og **runtime audio-playback-orkestreringen** (audio-tour-store + reels-audio-orchestration + karaoke-sync). PRD 14 PRODUSERER sporene; PRD 5 VELGER dem (`pickPlayableAudio`); PRD 9 RENDRER video-UX synkront mot audioen PRD 14 leverer. Forankret i `docs/rebuild/CARRY-OVER-MANIFEST.md` (audio-tour+reels keeper-blokk 198–243, port-with-rewrite 488–518, reference-only 650–655, DEAD 703–707), `docs/rebuild/prod-schema-snapshot.txt` (ingen audio-kolonne på `pois` — alt audio i `products.config` jsonb), og faktisk kode (`elevenlabs-client.ts`, `pronunciation.ts`, `storage-paths.ts`, `manus.ts`, `reels-voiceover-build-local.ts`, `audio-tour-build.ts`, `use-reels-audio-orchestration.ts`, `audio-tour-store.ts`, `reels-data.ts`, `KaraokeTeleprompter.tsx`, `animate-scene-veo.ts`, `compose-reels-bg.ts`).

---

## 1. Produktvisjon / Formål

Denne PRD-en eier **AUDIO-domenet** i rebuilden: alt som lager, lagrer og spiller av tale, og pipelinen som lager reels-videoer. Den deler seg i tre tett koblede sub-domener:

1. **Build-time TTS-pipeline (audio-tour + reels-VO).** Genererer Erik-stemte mp3-spor med character-level karaoke-timings, med en kirurgisk tunet norsk uttale-alias-spak. Produserer `url + manus + timings` som lagres i `products.config` jsonb (reportConfig). ALDRI runtime-TTS — build-time script-pipeline, lagret output (CLAUDE.md).

2. **Reels(SOME-video)-pipeline.** API-fri Ken Burns-bakgrunn (cut-på-setningsende mot ElevenLabs-timings) + Google Veo image-to-video (vann/sky-motion) + crossfade-kjeding + poster-generering. Output er mp4+poster-assets PRD 9 rendrer i reels-feeden.

3. **Reels-audio-override-akse + runtime playback-orkestrering.** `reelsAudio` overstyrer tour-`audio` i reels-feeden (`reelsAudio ?? audio`), men skrives til EGEN filnøkkel (`{themeId}-reels.mp3`) så den ALDRI kolliderer med tour-sporet — ellers ødelegges tour-karaoke. Runtime orkestreringen (audio-tour-store + reels-audio-orchestration + AudioElementProvider + KaraokeTeleprompter) binder spor til swipe, karaoke til `currentTime`.

To strukturelle grep definerer hele PRD-en:

> **Override, ikke replacement.** Reels-spor er en additiv akse: `reelsAudio ?? c.audio` (`reels-data.ts:277`), bygget til en separat fil (`{themeId}-reels.mp3`, `reels-voiceover-build-local.ts:86`) med en defensiv abort hvis trackKey mangler `-reels`-suffiks (`:130-132`). Tour-bygget (`audio-tour-build-local.ts`) rører ALDRI `reelsAudio`. Dette er nivå-2-differensiatoren — det aktiverer en RIKERE feed-stemme, og forker ikke kode.

> **Gating = spillbar-lyd-tilstedeværelse, ALDRI `reportTier` eller `audioTourEnabled`.** `audioTourEnabled` er DØDT SOM gating-mekanisme for audio-AVSPILLING — gate ALDRI playback/render på det (manifest 247–250; `report-tier.ts` validerer det bevisst ikke, PRD 2 §5.3). Om audio spiller bestemmes av om et spillbart spor finnes (PRD 5 `pickPlayableAudio` / `reels-data.ts isAudioBearing:105`), ikke av en tier-/flagg-bryter. PRD 14 produserer sporene; seleksjonen er PRD 5. **NB:** flaggets EGEN levende rolle er en separat akse — `audioTourEnabled` styrer fortsatt synligheten av «Start tour»-CTA-knappen (`types.ts:463`-kommentar), ikke om sporet kan spilles. Den CTA-bruken er UTENFOR PRD 14-scope og skal IKKE slettes; det «døde» gjelder kun playback/render-gating.

> **VO-posisjonering (eier-presisering 2026-06-28):** Voiceover er noe vi **AKTIVERER** — et ortogonalt data-presence-flagg (`pickPlayableAudio`, PRD 5), ikke et nivå-krav. Operasjonelt er VO **for nå en nivå-2-berikelse** (produseres/aktiveres ved kuratering, ikke på autonome nivå-1-board), MEN **ikke et required element for nivå 2 heller** — et nivå-2-board kan stå helt uten VO. Kravet til denne PRD-en er derfor at audio-pipelinen må være **klar til å legges til** (ready-to-activate), uten at noe REQUIRE-r VO på noe nivå. Bekrefter at PRD 2s lette nivå-2-readiness-sjekk IKKE inkluderer VO (kun `editorial`@nivå2); ingen tier-gating introduseres.

---

## 2. Mål (Goals)

Hvert mål kobler til ≥1 konkret requirement/unit (pekerne `(→ Gx)` i §7 refererer hit).

| Mål | Beskrivelse | Konkret requirement (leveres i) |
|-----|-------------|---------------------------------|
| **G1** | Build-time TTS-kjernen portet verbatim med låst ElevenLabs-oppskrift (Erik/turbo_v2_5/no/0.75), nøkkel i header (aldri URL), norsk uttale-alias + karaoke-timing-remap bevart. | TTS-kjerne-port (Unit 1). |
| **G2** | Manus-domenelogikk (ord-grense, banned-words, `buildTrackInputs`) portet med ord-grensen synket mot manus-curator. | Manus-domene-port (Unit 2). |
| **G3** | Tour-byggerne (DB + lokal-JSON) portet med to-fase valider→write+PATCH + optimistisk lås + `audioVersion`-semantikk avklart; tour-bygget rører ALDRI `reelsAudio`. | Tour-bygger-port (Unit 3). |
| **G4** | Reels-audio-override-aksen portet: egen filnøkkel, defensiv suffiks-abort, identisk ElevenLabs-kvalitet; karaoke-vernet bevist. | Reels-VO-override-port (Unit 4). |
| **G5** | Reels-video-pipelinen portet (Veo + API-fri Ken Burns + crossfade + poster) med Veo-nøkkel flyttet til header for førsteparts-API-kall + media-nedlastings-URI håndtert per endepunktets krav (CLAUDE.md-regelbrudd fikset differensiert); 6 av 7 døde voiceover-reels slettet, 1 beholdt som referanse. | Reels-video-pipeline-port (Unit 5). |
| **G6** | Runtime audio-playback-orkestreringen portet (audio-tour-store + reels-audio-orchestration), avhengighet snudd (board-data oppover-import); dead-export-hooks verifisert FØR port. | Playback-orkestrering-port (Unit 6). |
| **G7** | Karaoke-sync-clusteret portet (AudioElementProvider + KaraokeTeleprompter + karaoke-tokens + KaraokePitchText), timing-remap-avhengighet bevart. | Karaoke-sync-port (Unit 7). |
| **G8** | Alle keeper-tester grønne; full-pipeline-validering (ikke snippet) bevist; mekaniske porter grønne. | Verifikasjon + mekaniske porter (Unit 8). |

---

## 3. Arkitektur-/migrasjons-kontekst

I mantraet **«del nedover stacken, diverger oppover i UX»** sitter denne PRD-en på *media-/overflate-laget*. Audio-pipelinen og playback-orkestreringen er DELT infrastruktur (ALLTID lik på alle nivåer); reels-audio-override-aksen er en av de bevisste **divergens-overflatene** (nivå-2-differensiator), men den AKTIVERES av data-tilstedeværelse (`reelsAudio` finnes eller ikke), ikke av en tier-bryter.

| Lag | Eierskap | Divergerer per tier? | Divergerer per profil? |
|-----|----------|----------------------|------------------------|
| Datamodell (`ReportThemeAudio` i `products.config` jsonb) | PRD 1 | Nei — felt finnes alltid, fylles betinget | Nei |
| Tier-manifest + lett nivå-2-readiness-sjekk (VO IKKE inkludert) | PRD 2 | Nei — beskriver, gater ikke | Nei |
| Board-data + VO-SELEKSJON (`pickPlayableAudio`) | PRD 5 | Nei — velger spillbart uavhengig av nivå | Nei |
| **Build-time TTS-pipeline + manus-domene** | **Denne PRD-en** | **Nei** — identisk oppskrift alle nivåer | Nei |
| **Reels-audio-override-akse (`reelsAudio ?? audio`)** | **Denne PRD-en** | **Ja** — additiv differensiator, AKTIVERT av data-tilstedeværelse, ikke forket | Nei |
| **Reels-video-pipeline (Veo/Ken Burns)** | **Denne PRD-en** | **Ja** — nivå-2-media, produserer assets | Nei |
| **Runtime audio-playback-orkestrering + karaoke** | **Denne PRD-en** | **Nei** — identisk maskineri; spiller det som finnes | Nei |
| Reels-VIDEO-UX-rendring (`videoBgSrc`/splash) | PRD 9 | Ja (overflate) | Nei |

> **NB — runtime-playback-grensen 09↔14 er RESOLVERT, ikke åpen.** PRD 9 §6 deferred-tabell (`09:184`) + §10 Q6 + §5.4 eier reels-VIDEO-UX (`videoSrc`/`videoBgSrc`/`posterForVideo`, `reels-data.ts:13`/`25`/`145`); PRD 9 NEVNER IKKE audio-tour-store, `use-reels-audio-orchestration` eller karaoke i sitt scope (verifisert: 0 ref i PRD 9 §5.4 «eies av»-tabell). → PRD 14 EIER hele runtime audio-playback-orkestreringen. Grensen er ren: PRD 14 leverer audio + spiller den av; PRD 9 tegner video synkront mot `AudioElementContext.currentTime`. (Beslutning 8.)

> **NB — `reels-data.ts` er en DELT GRENSE 09↔14, ikke fil-konflikt.** Fila eies fysisk av PRD 9 (reels-feed-transform + VIDEO-UX), men PRD 14 EIER AUDIO-aksen i den (`reelsAudio ?? audio:277`, `isAudioBearing:105`, `buildCategoryTracks:339`, `audioDurationSec:224`). Override-linjen er PRD 14s kontrakt; resten er PRD 9. (Beslutning 9.)

### Nedstrøms-kontrakt-kart (hvem konsumerer denne PRD-en)

| Konsument-PRD | Hva den konsumerer fra audio-domenet |
|---------------|--------------------------------------|
| `prd-board-data-state` (5) | Audio-sporene PRD 14 produserer (`ReportThemeAudio` = `url`/`manus`/`timings` i reportConfig + `reelsAudio`); PRD 5s `pickPlayableAudio` VELGER spillbart av disse. PRD 14 produserer, PRD 5 selekterer. `00-INDEX:59` (PRD 14 ←05). |
| `prd-board-skall-ui` (9) | Reels-VIDEO-assets (mp4+poster fra Unit 5) som UX-overflaten rendrer; AudioElementContext-/karaoke-grensen video synkroniseres mot. `09:71`: PRD 9 eier UX-rendringen, PRD 14 eier pipelinen + playbacken. |
| `prd-3d-camera-tours` (10) | **Beat-signalet** `useCurrentTrack`/`useAudioTourPhase` (+ `categoryId`) fra `audio-tour-store` — PRD 10s audio-drevne welcome/home/outro-beat-choreografi konsumerer det som type/signatur-KONTRAKT, ikke runtime-instans (`BoardMap3D.tsx:45`-import). Lag-back-edge (PRD 10 = Lag 3 ← PRD 14 = Lag 4): kontrakt-noden hoistes til delt Lag-2-plassering og MÅ materialiseres FØR både 10 og 14 i beads-serialiseringen. `00-INDEX:68`; PRD 10 §10 Q7 + §5.3b. |
| `prd-nivaa-2-kuratering` (15-prov) | Hele pipelinen + override-aksen som nivå-2-kurerings-arbeidsflyten kjører for å fylle den rikere feed-stemmen. `00-INDEX:61` (PRD 15 ←14). |

### Migrasjons-kontekst (kode-port, INGEN DB-migrasjon)

Denne PRD-en rører IKKE skjema. Verifisert mot `prod-schema-snapshot.txt`: `pois`-tabellen har `editorial_hook`/`local_insight`/`editorial_sources`/`story_priority` men INGEN audio/voiceover/mp3-kolonner; alt audio (`url`/`manus`/`timings`/`reelsAudio`) lever i `products.config` jsonb (reportConfig), eid skjema-messig av PRD 1. Pipelinen skriver mp3/mp4 til `public/audio/{slug}/` + `public/reels/`, og audio-META til reportConfig via PATCH. Build-scriptene bruker raw fetch mot Supabase REST med service-role i header (CLI/server-kontekst — IKKE forbudt klient-Supabase). Runtime audio-stores er ren klient-state (ingen Supabase-kall).

---

## 4. Eksisterende kodebase

### Bæres over — keeper-core (port nær-verbatim)

| Fil (@/-sti) | Rolle | Verifisert linje-ref |
|--------------|-------|----------------------|
| `lib/audio-tour/elevenlabs-client.ts` | BUILD-TIME TTS-kjerne. Erik + turbo_v2_5 + `language_code "no"` + stability 0.75. Nøkkel i `xi-api-key`-header (compliant). Påfører alias KUN på TTS-input, remapper timings til original (karaoke). | `generateAudio:63`, `ELEVENLABS_VOICE EpYEY8MWJrUGskHBoNMA:18`, `ELEVENLABS_MODEL eleven_turbo_v2_5:20`, `ELEVENLABS_LANGUAGE_CODE "no":21`, `stability 0.75:24-29`, `xi-api-key header:79-80`, `applyPronunciation-kall:74`, `remap-fallback + warn:132-148`, `kaster ved manglende alignment:108-117` |
| `lib/audio-tour/pronunciation.ts` | BUILD-TIME norsk-uttale-spak: alias-omstaving + timing-remap til original. Manifest 205–208. | `applyPronunciation:67`, `remapTimingsToOriginal:130`, `loadPronunciationAliases:185`, `CharTimings:43`, `PronunciationSegment:23`, `remap→null hvis alignment ikke 1:1:138-146`, `leser pronunciation-no.json via process.cwd():188` |
| `lib/audio-tour/storage-paths.ts` | BUILD-TIME path-helpers. KRITISK for override: tour `{trackKey}.mp3`, reels `{themeId}-reels.mp3` via SAMME funksjon → kolliderer ALDRI. Manifest 210–213. | `audioFilename "home"→hjem.mp3:11-13`, `audioRelPath:19`, `audioAbsPath mot process.cwd():28-36` |
| `scripts/tts/pronunciation-no.json` | DATA-aktivum: norsk alias-ordliste. Kirurgisk tunet — ikke utvid uten empirisk A/B (manifest 220–223). | `lest av pronunciation.ts:188` |
| `lib/audio-tour/manus.ts` | REN domene-logikk: ord-telling, banned-words (35–90 ord), `buildTrackInputs`. Manifest 215–218. Test-dekket. | `MIN_WORDS=35:15`, `MAX_WORDS=90:16`, `buildTrackInputs:57`, `countWords:117`, `validateManus:137` |
| `scripts/generate-reels-posters.mjs` | BUILD-TIME poster-generering (.mp4→.jpg første frame). Konvensjon matcher `posterForVideo()`. Idempotent. | `npm generate:reels-posters:package.json:16`, `konvensjon .mp4→.jpg:header` |
| `lib/stores/audio-tour-store.ts` | RUNTIME audio-playback-orkestrering: ephemeral Zustand state-maskin (IKKE persistert) + selector-hooks. Manifest 301–304. | `useAudioTourStore:81`, `useCurrentTrack:192`, `useAudioTourActions:207`, `useAudioTourSyncTargets:260`, `AudioTourState:39`, `AudioTrack:23`, `markCurrentAsPlayed sticky:86`, `close=INITIAL:171` |
| `components/variants/report/reels/use-reels-audio-orchestration.ts` | RUNTIME orkestrering: binder store mot ReelsContext, start+goToTrack på swipe, pause/close/Page-Visibility, `startedRef`-guard. | `useReelsAudioOrchestration:17`, `buildCategoryTracks-memo:22`, `start+goToTrack:35-46`, `startedRef-guard:20+35`, `pause på ikke-audio:30`, `close på unmount:62-66`, `Page-Visibility-pause:70-83`, `onTrackEnded-kommentar (ikke store auto-next):57-59` |
| `components/variants/report/board/audio-tour/use-audio-element.tsx` | RUNTIME audio-element-provider: `<audio>` + `currentTime`/`duration` via context (~4Hz), unlock, muted-toggle, `onTrackEnded` (autoAdvance-modus). Karaoke leser `currentTime` herfra. Manifest 257–261. | `AudioElementContext:50`, `AudioElementProvider:65`, `currentTime-eksponering:34/121`, `onTrackEnded:62/129`, `autoAdvance:59/125`, `unlock:158` |
| `components/variants/report/reels/KaraokeTeleprompter.tsx` | RUNTIME karaoke-sync: sentence-vindu på remappede timings, leser `currentTime` fra AudioElementContext. Manifest 230–233. | `KaraokeTeleprompter:28`, `currentMs fra AudioElementContext:36-37`, `mapCharTimingsToWords/Sentences:39-40`, `fallback uten timings:42+` |
| `components/variants/report/board/audio-tour/KaraokePitchText.tsx` | RUNTIME karaoke pitch-render (audio-tour-cluster). Manifest 257–261. Test-dekket. | `audio-tour-cluster manifest:257-261`, `KaraokePitchText.test.tsx` |
| `components/variants/report/board/audio-tour/karaoke-tokens.ts` | RUNTIME karaoke token-splitting: `mapCharTimingsToWords` + `mapTokensToSentences`. Test-dekket. | `brukt av KaraokeTeleprompter:6-9`, `audio-tour-cluster:257-261` |
| `components/variants/report/board/audio-tour/tour-mode.css` | RUNTIME tour-modus-styling (audio-tour-cluster). Manifest 257–261. | `audio-tour-cluster:257-261` |
| `components/variants/report/reels/reels-data.ts` (AUDIO-aksen) | DELT GRENSE 09↔14: PRD 14 eier AUDIO-aksen (`reelsAudio ?? audio` override + audio-bearing-navigasjon). PRD 9 eier VIDEO-UX. | `reelsAudio ?? audio override:277`, `isAudioBearing:105`, `buildCategoryTracks:339`, `audioDurationSec:224`, `cardIndexToAudioIndex:352`, `filter reelsAudio\|\|audio:273-274` |

### Bæres over — port-with-rewrite (omstrukturer ved port)

| Fil (@/-sti) | Rewrite-handling | Verifisert linje-ref |
|--------------|------------------|----------------------|
| `scripts/audio-tour-build.ts` | Port DB-tour-byggeren. Bevar to-fase (parallell in-memory valider → batch disk-write+PATCH) + optimistisk lås på `updated_at` + `revalidateTag`. `audioVersion` settes konsistent til 5 (verifiser; Unit 3). ~90% overlapp med build-local + reels-build-local → INSPISER serielt (patch 763), ikke tving merge i denne porten. | `collectTracks:146`, `to-fase Phase1 TTS:319-357`, `Phase2 disk-write+PATCH:365`, `optimistic lock updated_at:462`, `audioVersion=5:455`, `PARALLEL_LIMIT=2:53`, `MIN_BYTES=5000:54`, `revalidate:252` |
| `scripts/audio-tour-build-local.ts` | Port lokal-JSON-tour-byggeren. Bygger KUN tour-spor — `reelsAudio` røres ALDRI (override-akse-disiplin). Source-adapter-kandidat (ikke merge nå). | `header "reelsAudio røres ikke":12-14`, `Genererer KUN tour-spor:11` |
| `scripts/reels-voiceover-build-local.ts` | Port reels-VO-byggeren (KJERNE for override-aksen). Bygger KUN `themes[].reelsAudio` til EGEN fil `{themeId}-reels.mp3`; defensiv abort hvis trackKey mangler `-reels`. Gjenbruker ekte ElevenLabs-klient. | `bygger KUN reelsAudio:82-92`, `trackKey={themeId}-reels:86`, `defensiv -reels-suffiks-abort:130-132`, `skriver til egen fil:133`, `npm build:reels-vo-local:package.json:15` |
| `scripts/animate-scene-veo.ts` | Port Veo image-to-video (nivå-2). **GOTCHA/REGELBRUDD:** `GEMINI_API_KEY` i URL-querystring. To klasser: `:152`/`:186` er førsteparts-API-kall → flytt til `x-goog-api-key`-header (trygt; POST `:173-176` bruker allerede headers). `:216` (`downloadVideo`) appenderer nøkkel til Google-RETURNERT media-URI → verifiser om endepunktet aksepterer header før den kreves; ellers behold i URL med notat (transient signert URI). Bevar slow-motion-prompt-disiplin + fallback. | `API_KEY=process.env.GEMINI_API_KEY:32`, `førsteparts-API key i URL:152`/`186`, `media-URI key (op.response.video.uri):216`, `extractVideoUri:204-213`, `slow-motion negative-prompt:16-21` |
| `scripts/compose-reels-bg.ts` | Port API-fri reels-bakgrunn (kun ffmpeg). Ken Burns + hard-cut per beat, cut-punkter aligneres med setningsende i ElevenLabs-timings (Level B = default). «Antall bilder = antall beats ellers abort». 720×1280 9:16. | `Level B cut-på-setningsende:header`, `ingen API-kall (kun ffmpeg):header`, `720x1280 9:16:header` |
| `scripts/compose-video-crossfade.ts` | Port crossfade-kjeding av Veo-klipp (bevarer motion), cropdetect fjerner pillarbox, web-variant + poster. | `krysstoner ferdige videoer:header`, `reel.mp4/reel-web.mp4/reel-poster.jpg:header` |

### Reference-only (bevares som læring, ikke aktiv pipeline)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `scripts/audio-manus-write.ts` | reference-only | Superseded av `manus-curator`-skill. Behold DB-PATCH/optimistic-lock-mønsteret + prepare→skill→apply-dansen som læring. Ingen Anthropic-key (skill-drevet, build-time). Audio/reels-MANUS er PRD 14s pipeline-INPUT (egne scripts), IKKE PRD 7 (story-text). Manifest 652. |
| `lib/audio-tour/manus-prompt.ts` | reference-only | Flyttet til `manus-curator`-skill. Referanse for stemme/register. Manifest 651. |
| `scripts/tts/tune-pronunciation.mjs` | reference-only | Tuning av nye problemord. Manifest 655. |
| `scripts/tts/confirm-pronunciation.mjs` | reference-only | A/B-bekreft av problemord. Manifest 655. |
| `scripts/elevenlabs-norsk-validation.ts` | reference-only | Erik valgt. Referanse for HVORDAN re-validere stemme på FULL pipeline (memory: TTS-validering på full pipeline, ikke snippet). Manifest 654. |

### Slettes / forlates (dead)

| Fil (@/-sti) | Verdict | Begrunnelse |
|--------------|---------|-------------|
| `scripts/voiceover-reels-{barn-oppvekst,hverdagsliv,mat-drikke,natur,opplevelser,transport,trening}.ts` (7 filer, ~2600 LOC) | dead — slett 6, behold 1 | SOME-spike, hardkodet manus per kategori, Desktop-output. `opplevelser` = utgått 7-tema. **Behold ÉN (f.eks. `voiceover-reels-natur.ts`) som referanse for timings→`compose-reels-bg`-flyten; slett 6.** Hver bruker `generateAudio` via header (`voiceover-reels-natur generateAudio:45-46`). Manifest 704. |
| `scripts/compose-slideshow.ts` | dead | Erstattet av `compose-reels-bg` + crossfade. VO-fri kryss-fade-rotasjon. Manifest 706. |
| `scripts/compose-some-video.ts` | dead | Overhalt single-pass SOME-video; single-pass-mønsteret eneste læring (i behaltt voiceover-reels). Manifest 653/705. |
| `scripts/voiceover-some.ts` | dead | Engangs SOME-VO, hardkodet Stasjonskvartalet-manus. Superseded. Manifest 705. |

### Verifiser-FØR-port (dead-export-mistanke)

| Symbol (@/-sti) | Mistanke | Verifikasjonskrav |
|-----------------|----------|-------------------|
| `useAudioTourSyncTargets` (`audio-tour-store.ts:260`) + `useAudioTourSectionProgress` (`:236`) + `useAudioTourMeta` (`:196`) | **Bekreftet DØD: 0 konsumenter repo-vidt** (grep finner kun definisjonen for alle tre); `use-audio-tour-sync.ts` (referert i `:263`-kommentar) er SLETTET. Faktisk karaoke-sync går via `AudioElementContext.currentTime` → `KaraokeTeleprompter`, IKKE via sync-targets. De live konsumentene av store-fila (`DesktopStorySidebar:21-23`/`447-448`, `StoryProgressBar:5`/`48-50`, `ChapterProgressBar:5`/`20-22`) leser KUN `useAudioTourActions`/`useAudioTourStore` — IKKE noen av de tre mistenkte hookene. | Unit 6 AC: slett de tre bekreftet døde hookene; behold KUN hooks med live konsumenter (`useAudioTourActions`/`useAudioTourStore`/`useCurrentTrack`/`useAudioTourPhase`). (§10 Q1.) |

---

## 5. Datakontrakt (felt PRD-en eier / konsumerer)

### 5.1 Konsumeres fra PRD 1 (datamodell)

| Symbol | Rolle | Kilde |
|--------|-------|-------|
| `ReportThemeAudio` (`url?`/`voice?`/`model?`/`generatedAt?`/`manus` (required)/`timings?`) | Spor-shapen pipelinen produserer og PATCH-er til reportConfig. | `lib/types.ts:295` |
| `ReportThemeAudioTimings` (`characters`/`characterStartTimesSeconds`/`characterEndTimesSeconds`) | Karaoke-alignment. `timings?` mangler på spor før `audioVersion 5` (`types.ts:306-kommentar`) → karaoke faller tilbake til klartekst. | `lib/types.ts:289` |
| `reelsAudio?: ReportThemeAudio` på `ReportThemeConfig` | Override-akse-bæreren. | PRD 1 (reportConfig-type) |
| `welcomeAudio`/`heroAudio`/`outroAudio` på `ReportConfig` | Tour-spor-bærere (welcome/hjem/outro). | PRD 1 (reportConfig-type) |
| `audioTourEnabled?: boolean` | **DØDT SOM playback/render-gate — gate ALDRI audio-AVSPILLING på det.** Audio-gating = spillbar-lyd-tilstedeværelse (PRD 5 `pickPlayableAudio`). Flaggets levende CTA-rolle («Start tour»-knapp-synlighet, `types.ts:463`-kommentar) er UTENFOR PRD 14-scope og skal IKKE slettes. | PRD 1; manifest 247–250; `types.ts:463` |
| LAGRING: `products.config` jsonb (NOT NULL) | Alt audio lever her — INGEN audio-kolonne på `pois`. | `prod-schema-snapshot.txt` |

### 5.2 Konsumeres fra PRD 5 (board-data + state)

| Symbol | Rolle | Kilde |
|--------|-------|-------|
| `pickPlayableAudio`-SELEKSJON | PRD 5 VELGER spillbart spor av det PRD 14 PRODUSERER. PRD 14 eier IKKE seleksjonen. | PRD 5 §5.4, `board-data.ts:220` (modul-privat → PRD 5 Unit 2 eksporterer) |
| `BoardCategory.audio` + `.reelsAudio` | Board-data-feltene `reels-data.ts buildCategoryTracks` + override-linjen leser. | PRD 5 (`board-data.ts:108`/`298-299`) |
| `BoardAudioTrack` (`url`/`manus`/`timings?`) | Spor-shapen `buildCategoryTracks` mapper til `AudioTrack`. | PRD 5 (`board-data.ts:23`) |
| `BoardCategoryId` (+ søster `BoardPOIId`, `BoardAudioTrack`) | **Type-hjem EID av PRD 5 — BEKREFTET (Kontroll 2026-06-27).** Typene defineres i dag i `board-data.ts:31`/`:32`/`:23`, men importeres OPPOVER (uønsket lib→components) av `audio-tour-store.ts:5`, `lib/event-board/event-board-data.ts:24`/`:28` og `reels-data.ts:4`/`:2`. PRD 5 (Unit 1) DEFINERER type-hjemmet kanonisk i `lib/board/board-types.ts` + re-eksporterer fra `board-data.ts` for bakoverkompat; PRD 14 KONSUMERER (importerer NEDOVER fra kjernen, flytter ikke). (§10 Q4 — LØST.) | `board-data.ts:31`/`:32`/`:23`; `audio-tour-store.ts:5`; `event-board-data.ts:24`/`:28`; `reels-data.ts:4`/`:2`; manifest 304; PRD 5 Unit 1 |

### 5.3 Konsumeres fra PRD 9 (board-skall + reels-VIDEO-UX)

| Symbol | Rolle | Kilde |
|--------|-------|-------|
| `ReelsProvider`/`useReels` (`audioUnlocked`/`activeIndex`/`cards`) | `use-reels-audio-orchestration` LESER nav-state for å binde spor til swipe. Reducer-state eies av PRD 9 (`reels-state.tsx`). | PRD 9 (`reels-state.tsx:38`/`20`/`19`/`63`) |
| `reels-data.ts` (fil) | DELT fil; PRD 14 eier AUDIO-aksen, PRD 9 eier VIDEO-UX + render. | PRD 9 §5.4, §3 NB |
| Reels-VIDEO-UX-render (`videoBgSrc`/`posterForVideo`) | PRD 9 rendrer video synkront mot audioen + `AudioElementContext.currentTime`. PRD 14 eier IKKE rendringen. | PRD 9 §5.4 |

### 5.4 Eies av denne PRD-en

| Symbol | Eierskap | Note |
|--------|----------|------|
| `generateAudio` + ElevenLabs-konstantene (`ELEVENLABS_VOICE`/`_MODEL`/`_LANGUAGE_CODE`/`_VOICE_SETTINGS`/`_OUTPUT_FORMAT`) | PRD 14 | `elevenlabs-client.ts` — låst oppskrift; endring → `audioVersion`-bump + full-pipeline re-validering |
| `applyPronunciation`/`remapTimingsToOriginal`/`loadPronunciationAliases` + `pronunciation-no.json` | PRD 14 | `pronunciation.ts` — norsk uttale-spak (build-time only) |
| `audioFilename`/`audioRelPath`/`audioAbsPath` | PRD 14 | `storage-paths.ts` — override-akse-vernet (`{themeId}-reels.mp3` ≠ `{themeId}.mp3`) |
| `MIN_WORDS`/`MAX_WORDS`/`BANNED_WORDS_RX`/`buildTrackInputs`/`validateManus` | PRD 14 | `manus.ts` — ren domene-logikk |
| `audio-tour-build(-local).ts` + `reels-voiceover-build-local.ts` | PRD 14 | build-time TTS-byggere (tour + reels-override) |
| `animate-scene-veo.ts`/`compose-reels-bg.ts`/`compose-video-crossfade.ts`/`generate-reels-posters.mjs` | PRD 14 | reels-video-pipeline (produserer mp4+poster for PRD 9) |
| `reelsAudio ?? audio`-override-linje + `isAudioBearing`/`buildCategoryTracks`/`audioDurationSec` | PRD 14 (i delt `reels-data.ts`) | AUDIO-aksen i den PRD 9-eide fila |
| `useAudioTourStore` + selector-hooks + `AudioTrack`/`AudioTourPhase`/`PauseReason` | PRD 14 | runtime playback-state-maskin |
| `useReelsAudioOrchestration` | PRD 14 | binder store mot swipe |
| `AudioElementProvider`/`useAudioElement` + `KaraokeTeleprompter`/`KaraokePitchText`/`karaoke-tokens` + `tour-mode.css` | PRD 14 | runtime karaoke-sync-cluster |

---

## 6. Scope Boundaries

**Denne PRD-en dekker:**

1. Build-time TTS-kjernen (`elevenlabs-client` + `pronunciation` + `storage-paths` + `pronunciation-no.json`).
2. Manus-domenelogikk (`manus.ts` ord-grense/banned-words/`buildTrackInputs`).
3. Tour-byggerne (DB `audio-tour-build` + lokal `audio-tour-build-local`) med to-fase + optimistisk lås.
4. Reels-audio-override-aksen (`reels-voiceover-build-local` + override-linjen i `reels-data.ts`).
5. Reels-video-pipelinen (Veo + Ken Burns + crossfade + poster) med Veo-nøkkel-fiks.
6. Runtime audio-playback-orkestrering (`audio-tour-store` + `use-reels-audio-orchestration` + `use-audio-element`).
7. Karaoke-sync-clusteret (`KaraokeTeleprompter`/`KaraokePitchText`/`karaoke-tokens`/`tour-mode.css`).
8. Sletting av 6 av 7 døde `voiceover-reels-*` + `compose-slideshow`/`compose-some-video`/`voiceover-some`.

### Deferred to Separate Tasks

| Deferred | Tas opp i |
|----------|-----------|
| `pickPlayableAudio`-SELEKSJON + board-data-transform + `bridge-text` (PRD 14 produserer sporene, PRD 5 velger) | **PRD 5 (prd-board-data-state)** |
| Reels-VISUELL-UX-overflate + reel-feed-render + `videoBgSrc`/`posterForVideo`-rendring (PRD 14 produserer assets, PRD 9 rendrer) | **PRD 9 (prd-board-skall-ui)** |
| Gemini-grounding + story-text-linker + editorial story-tekst (audio/reels-MANUS er PRD 14s pipeline-INPUT, IKKE story-text) | **PRD 7 (prd-grounding-curation)** |
| Nivå-2 menneskelig kurerings-arbeidsflyt som KJØRER pipelinen + override-aksen for å fylle den rikere feed-stemmen | **PRD 15-prov (prd-nivaa-2-kuratering)** |
| `BoardCategoryId` (+ `BoardPOIId`, `BoardAudioTrack`) type-hjem (avhengighet OPPOVER i dag, manifest 304). **BEKREFTET Kontroll 2026-06-27: type-hjemmet EIES av PRD 5 (definerer dem kanonisk i `lib/board/board-types.ts` + re-eksporterer fra `board-data.ts`); PRD 14 KONSUMERER (importerer derfra, flytter ikke).** | Type-hjem (definer + re-eksport) = **PRD 5 (Unit 1)**; PRD 14s consume-edge (import NEDOVER fra kjernen) = **Unit 6 (denne PRD-en)** |
| Audio-bygger-konsolidering til tier-aware source-adapter (manifest 491; patch 763 RISIKO) | Egen oppryddings-task ETTER serielt inspisert port — IKKE tving merge nå (Beslutning 5) |
| `REELS_MONTAGE_PROJECTS`-allowlist + intro/welcome-video-gating (DATA-flagg, ikke pipeline) | **PRD 9** (§10 Q6 / Beslutning 11) — PRD 14 produserer mp4-FILENE, PRD 9 gater hvilke prosjekter som viser dem |

**Eksplisitt ikke-scope:** render-gating på `reportTier` og gating på `audioTourEnabled` (dødt flagg). Audio spiller når et spillbart spor finnes (PRD 5-seleksjon), aldri via tier-/flagg-bryter. Ingen unit bygger en slik bryter.

---

## 7. Implementation Units (8 av 8 dekket)

### Unit 1 — TTS-kjerne-port (ElevenLabs + pronunciation + storage-paths)
- **Mål (→ G1):** Port build-time TTS-kjernen verbatim med låst oppskrift, nøkkel i header, norsk uttale-alias + karaoke-timing-remap bevart.
- **Filer:** `@/lib/audio-tour/elevenlabs-client.ts` (port verbatim), `@/lib/audio-tour/pronunciation.ts` (port verbatim), `@/lib/audio-tour/storage-paths.ts` (port verbatim), `@/scripts/tts/pronunciation-no.json` (port verbatim), `@/lib/audio-tour/pronunciation.test.ts` + `storage-paths.test.ts` (port).
- **Avhengigheter:** PRD 1 (`AudioTimings`-shape kompatibel med `ReportThemeAudioTimings`).
- **Akseptansekriterier:**
  1. ElevenLabs-oppskriften bevart EKSAKT: `ELEVENLABS_VOICE = "EpYEY8MWJrUGskHBoNMA"` (`:18`), `ELEVENLABS_MODEL = "eleven_turbo_v2_5"` (`:20`), `ELEVENLABS_LANGUAGE_CODE = "no"` (`:21`), `stability: 0.75` (`:24-29`). Endring her krever `audioVersion`-bump (header-dokumentert).
  2. **Nøkkel i header, ALDRI URL:** kallet bruker `xi-api-key`-header (`:79-80`); ingen nøkkel i URL-querystring (CLAUDE.md). `grep "key=" elevenlabs-client.ts` returnerer tomt.
  3. `generateAudio` påfører alias KUN på TTS-input (`applyPronunciation:74`) og remapper timings til original-teksten når ord ble byttet (`:132-148`); faller tilbake til rå-alignment + `console.warn` hvis remap returnerer null (alignment ikke 1:1, `pronunciation.ts:138-146`).
  4. `generateAudio` KASTER med HTTP-status + body-snippet ved feil (`:91-93`) og ved manglende alignment-felt (`:108-117`) — error-handling bevart (CLAUDE.md: ALLTID error-håndtering på fetch).
  5. `audioFilename` special-caser `"home"→"hjem.mp3"` og returnerer ellers `{trackKey}.mp3` (`:11-13`); `audioAbsPath` beregnes mot `process.cwd()` (worktree-trygg, `:28-36`).
  6. `pronunciation.test.ts` + `storage-paths.test.ts` passerer; `npx tsc --noEmit` 0 feil.

### Unit 2 — Manus-domene-port (ord-grense + banned-words)
- **Mål (→ G2):** Port ren manus-domenelogikk; synk ord-grensen mot manus-curator.
- **Filer:** `@/lib/audio-tour/manus.ts` (port), `@/lib/audio-tour/manus.test.ts` (port), `@/lib/audio-tour/manus-prompt.ts` (reference-only, behold for stemme/register).
- **Avhengigheter:** ingen (ren logikk).
- **Akseptansekriterier:**
  1. `MIN_WORDS`/`MAX_WORDS`/`BANNED_WORDS_RX`/`buildTrackInputs`/`countWords`/`findBannedWords`/`validateManus`/`stripWrappingQuotes` portet (`manus.ts:15`/`16`/`57`/`117`/`137`).
  2. **Ord-grensen synket:** dagens harde grenser `MIN_WORDS=35`/`MAX_WORDS=90` (`:15-16`) avviker fra manus-curator-målet på ~70 ord (`manus-prompt.ts:3` «én pitch på ~70 ord», `:10` «70-ord-cap», `:36-37` «Default 70», `:42` «~70 ord, ~30 sekunder»). Avklar kanonisk grense ved port (35/90 harde grenser vs ~70-mål) og dokumenter valget i header; behold test-dekning for valgt grense.
  3. `manus.test.ts` passerer (akseptansekriterie-kilde for ord-grense/banned-words).
  4. `manus-prompt.ts` beholdt reference-only; importeres bare av `audio-manus-write` (reference) + `manus.ts`. Ingen runtime-LLM-kall.
  5. `npx tsc --noEmit` 0 feil.

### Unit 3 — Tour-bygger-port (DB + lokal-JSON, to-fase + optimistisk lås)
- **Mål (→ G3):** Port begge tour-byggerne med to-fase valider→write+PATCH + optimistisk lås; verifiser `audioVersion`-konsistens; tour-bygget rører ALDRI `reelsAudio`.
- **Filer:** `@/scripts/audio-tour-build.ts` (DB, port-with-rewrite), `@/scripts/audio-tour-build-local.ts` (lokal-JSON, port-with-rewrite — setter også `audioVersion = 5` på `:157`), `@/scripts/audio-manus-write.ts` (reference-only — behold DB-PATCH/optimistic-lock-mønster).
- **Avhengigheter:** Unit 1 (`generateAudio` + `storage-paths`), Unit 2 (`buildTrackInputs`/`validateManus`), PRD 1 (reportConfig-PATCH-shape + `products.config` jsonb).
- **Akseptansekriterier:**
  1. **To-fase bevart (load-bearing):** Phase 1 TTS alle spor parallelt in-memory + valider `MIN_BYTES` (`:54`); hvis NOEN feiler → exit non-zero, INGEN disk-write, INGEN PATCH (`:351-357`). Phase 2 batch disk-write + single PATCH (`:365`). `PARALLEL_LIMIT=2` (ElevenLabs free-plan, `:53`).
  2. Optimistisk lås på `updated_at` bevart (`:462`): concurrent skriv = 0 rader patched mens mp3 på disk → re-kjør (dokumentert).
  3. **`audioVersion` er én konsistent cache-bust/re-gen-trigger satt til 5 over ALLE tre byggerne:** `audio-tour-build.ts:455`, `audio-tour-build-local.ts:157` og `audio-manus-write.ts:468` skriver alle `audioVersion: 5`. Det finnes INGEN «1-vs-5-drift» — den eneste `= 1`-forekomsten er en utdatert prosa-doc-kommentar i `audio-manus-write.ts:18`. Verifiser de tre skrivene under porten og **fiks den utdaterte `= 1`-doc-kommentaren** i `audio-manus-write.ts:18` (reference-only-port). Dokumenter at `audioVersion` er én akse (TypeScript-literal `audioVersion?: 5`, `types.ts:461`), ikke to. (§10 Q2.)
  4. `audio-tour-build-local` bygger KUN tour-spor (welcome/hjem/themes[].audio/outro) — `reelsAudio` røres ALDRI (`header:12-14`). `grep "reelsAudio" audio-tour-build-local.ts` finner kun en eksplisitt «rører ikke»-kommentar, ikke et skriv.
  5. Supabase-PATCH via raw fetch med service-role i header (`audio-tour-build.ts:107-108`) — CLI/server-kontekst, ikke forbudt klient-Supabase. Error-håndtering bevart (Promise.allSettled + abort ved feil).
  6. `revalidateTag(product:{customer}_{slug})` kalt etter PATCH (`:252`). `npx tsc --noEmit` 0 feil.

### Unit 4 — Reels-VO-override-port (egen filnøkkel + karaoke-vern)
- **Mål (→ G4):** Port reels-VO-byggeren med egen filnøkkel + defensiv suffiks-abort; bevis karaoke-vernet (reels-mp3 kolliderer ALDRI med tour-mp3).
- **Filer:** `@/scripts/reels-voiceover-build-local.ts` (port-with-rewrite), AUDIO-aksen i `@/components/variants/report/reels/reels-data.ts` (port override-linjen), `@/components/variants/report/reels/__tests__/reels-data.test.ts` (port override-tester).
- **Avhengigheter:** Unit 1 (`generateAudio` + `storage-paths`), PRD 5 (`BoardCategory.reelsAudio`/`.audio` + `BoardAudioTrack`), PRD 9 (`reels-data.ts`-fila — DELT, koordineres på AUDIO-aksen).
- **Akseptansekriterier:**
  1. Reels-VO bygger KUN `themes[].reelsAudio` (`:82-92`) til EGEN filnøkkel `{themeId}-reels` (`:86`); `reelsAudio` skrives til `{themeId}-reels.mp3` (via `storage-paths` uendret).
  2. **Defensiv abort bevart (karaoke-vern):** kaster hvis trackKey mangler `-reels`-suffiks (`:130-132`) — overskriver ALDRI tour-`{themeId}.mp3`. Dette er KJERNEN i override-akse-disiplinen.
  3. Override-linjen `const audio = c.reelsAudio ?? c.audio` (`reels-data.ts:277`) portet: reels-spor overstyrer tour-spor i feed, fallback til tour. `filter (c) => !!c.reelsAudio || !!c.audio` (`:273-274`) bevart.
  4. Gjenbruker ekte `generateAudio` (Erik/turbo_v2_5/no, pronunciation, karaoke-timings) → identisk kvalitet med tour-spor; `MIN_BYTES`-validering bevart.
  5. `reels-data.test.ts` override-tester passerer: `reelsAudio` fremfor `audio` (`:82`), kun-`reelsAudio` (`:97`), filter uten audio/reelsAudio (`:67`).
  6. `npx tsc --noEmit` 0 feil; ingen `reportTier`-/`audioTourEnabled`-gate introdusert.

### Unit 5 — Reels-video-pipeline-port (Veo + Ken Burns + crossfade + poster) + dead-sletting
- **Mål (→ G5):** Port reels-video-pipelinen med Veo-nøkkel flyttet til header; slett 6 av 7 døde `voiceover-reels` + de tre andre døde compose/voiceover-scriptene; behold 1 referanse.
- **Filer:** `@/scripts/animate-scene-veo.ts` (port + nøkkel-fiks), `@/scripts/compose-reels-bg.ts` (port), `@/scripts/compose-video-crossfade.ts` (port), `@/scripts/generate-reels-posters.mjs` (port), `@/scripts/voiceover-reels-natur.ts` (behold 1 referanse) + slett 6, slett `compose-slideshow.ts`/`compose-some-video.ts`/`voiceover-some.ts`.
- **Avhengigheter:** Unit 1 (timings fra `generateAudio` mater `compose-reels-bg` cut-punkter), Unit 4 (reels-VO produserer timings video aligneres mot). PRD 9 konsumerer mp4+poster-output.
- **Akseptansekriterier:**
  1. **Veo-nøkkel-REGELBRUDD fikset — DIFFERENSIERT per endepunkt (de tre `?key=`-stedene er IKKE ekvivalente):**
     - **(a) Førsteparts-API-kall `:152` (`predictLongRunning`) + `:186` (operation-poll):** dette er `generativelanguage.googleapis.com`-endepunkter der `x-goog-api-key`-header er dokumentert; POST-en på `:172-176` bruker allerede `headers`. Flytt `GEMINI_API_KEY` fra URL til `x-goog-api-key`-header — trygt fikserbart. Etter port: **ingen API-nøkkel i noen førsteparts-API-kall-URL.**
     - **(b) Media-nedlasting `:216` (`downloadVideo`):** her appenderes nøkkelen til en Google-RETURNERT video-URI (`op.response...video.uri` via `extractVideoUri:204-213`) — et fil/media-nedlastings-endepunkt som KAN kreve query-param og kanskje ikke honorerer `x-goog-api-key`. Verifiser empirisk om endepunktet aksepterer header FØR du krever det. Aksepterer det header → flytt dit. Krever det query-param → behold nøkkelen i URL med eksplisitt notat (lekkasje-flaten er en transient signert/intern URI), IKKE feil AC-en.
     - Slow-motion-prompt + fallback bevart (`:16-21`).
  2. `compose-reels-bg.ts` portet API-fritt (kun ffmpeg; `grep`-bekreftet ingen API-kall): Ken Burns + hard-cut per beat, cut-punkter aligneres med setningsende i ElevenLabs-timings (Level B = default), «antall bilder = antall beats ellers abort», 720×1280 9:16.
  3. `compose-video-crossfade.ts` kjeder Veo-klipp med crossfade (bevarer motion), cropdetect fjerner pillarbox, produserer `reel.mp4`/`reel-web.mp4`/`reel-poster.jpg`. `generate-reels-posters.mjs` (.mp4→.jpg, `package.json:16`) idempotent; konvensjon matcher `posterForVideo()` (PRD 9 §5.4).
  4. **Dead-sletting:** 6 av 7 `voiceover-reels-*.ts` slettet (behold `voiceover-reels-natur.ts` som timings→compose-referanse); `compose-slideshow.ts`/`compose-some-video.ts`/`voiceover-some.ts` slettet (CLAUDE.md «ALDRI la dead code ligge»). `grep "voiceover-reels-opplevelser"` returnerer tomt (utgått 7-tema).
  5. `npx tsc --noEmit` 0 feil; berørte npm-scripts (`build:reels-vo-local`, `generate:reels-posters`) peker ikke til slettede filer.

### Unit 6 — Runtime playback-orkestrering-port (store + orchestration)
- **Mål (→ G6):** Port runtime audio-playback-state-maskinen + swipe-orkestreringen; snu board-data-avhengigheten; verifiser dead-export-hooks FØR port.
- **Filer:** `@/lib/stores/audio-tour-store.ts` (port + avhengighet snudd), `@/lib/stores/audio-tour-store.test.ts` (port), `@/components/variants/report/reels/use-reels-audio-orchestration.ts` (port).
- **Avhengigheter:** PRD 5 (`BoardCategoryId`/`BoardPOIId`/`BoardAudioTrack` type-hjem — KONSUMERES herfra), PRD 9 (`useReels`/`ReelsProvider`-nav-state), Unit 7 (`AudioElementProvider.onTrackEnded`-grensen).
- **Akseptansekriterier:**
  1. `useAudioTourStore` portet som ephemeral state-maskin (IKKE persistert): `phase`/`trackIndex`/`tracks` + `start`/`pause`/`resume`/`goToTrack`/`next`/`prev`/`close`/`setError`/`retryTrack`, `playedCategoryIds` sticky (`markCurrentAsPlayed:86`), `close=INITIAL` (`:171`).
  2. **ALLTID Zustand-selectors:** eksporter + bruk selector-hooks (`useAudioTourPhase`/`useCurrentTrack`/`useAudioTourActions` via `useShallow`), aldri hele store (CLAUDE.md). Konsumenten (`use-reels-audio-orchestration`) bruker `useAudioTourActions` (`:19`).
  3. **`useEffect` er PLAYBACK-orkestrering, IKKE data-fetch:** `use-reels-audio-orchestration` start/goToTrack/pause/Page-Visibility er legitim (analog med realtime-hooks-unntaket); dokumenter så reviewer ikke flagger feilaktig. `startedRef`-guard bygger tracks ÉN gang (`:20+35`); track-ended via `AudioElementProvider.onTrackEnded` (autoAdvance=false), IKKE store auto-next (`:57-59`, dobbelt-advance-vern); Page-Visibility pause uten auto-resume (`:70-83`); close på unmount (`:62-66`).
  4. **Type-hjem EID av PRD 5 — PRD 14 KONSUMERER (BEKREFTET — Kontroll 2026-06-27):** `BoardCategoryId` (+ søster `BoardPOIId`, `BoardAudioTrack`) DEFINERES kanonisk av PRD 5 (Unit 1) i `lib/board/board-types.ts` + re-eksporteres fra `board-data.ts` for bakoverkompat. Denne PRD-en KONSUMERER dem: `audio-tour-store.ts:5` (+ de andre konsumentene `event-board-data.ts:24`/`:28`, `reels-data.ts:4`/`:2`) importerer `@/`-prefix NEDOVER fra kjernen, ikke OPPOVER fra components. PRD 14 flytter IKKE type-hjemmet selv — det er en per-unit consume-edge mot PRD 5s kontrakt, ikke en flytte-eier-jobb. Snur den uønskede lib→components-importen riktig vei. (§10 Q4 — LØST.)
  5. **Dead-export-sletting (verifisert):** `useAudioTourSyncTargets` (`:260`), `useAudioTourSectionProgress` (`:236`) og `useAudioTourMeta` (`:196`) har 0 konsumenter repo-vidt (grep-bekreftet kun definisjon; `use-audio-tour-sync.ts` allerede slettet) → SLETT alle tre. Behold KUN selector-hooks med live konsumenter: `useAudioTourActions`/`useAudioTourStore` (lest av `DesktopStorySidebar`/`StoryProgressBar`/`ChapterProgressBar`) + `useCurrentTrack`/`useAudioTourPhase`. (§10 Q1.)
  6. **`useCurrentTrack`/`useAudioTourPhase` = beat-signal-KONTRAKT-node (lag-back-edge mot PRD 10):** disse to selector-hookene er kontrakten PRD 10 (Lag 3) konsumerer for sin audio-drevne welcome/home/outro-beat-choreografi (`BoardMap3D.tsx:45`-import; PRD 10 §5.3b/§10 Q7). Fordi PRD 10 (Lag 3) bygges FØR PRD 14 (Lag 4), MÅ type/signatur-kontrakten (hooks + `categoryId`-shape) materialiseres til en delt Lag-2-plassering FØR både 10 og 14 i beads-serialiseringen (`00-INDEX:68`). Bevar nøyaktig signatur (`useCurrentTrack:192`/`useAudioTourPhase:188`) gjennom porten så PRD 10 bygger mot uendret stub.
  7. INGEN sensitiv data i store (kun `phase`/`trackIndex`/`tracks` (url+manus) — ingen nøkler/tokens). `audio-tour-store.test.ts` passerer (transisjoner + `playedCategoryIds` sticky). `npx tsc --noEmit` 0 feil.
  8. **PRD-9-konsument-kompilering bevart (kryss-PRD-koordinering):** Etter store-API-omformingen (`BoardCategoryId` konsumert fra PRD 5s kjerne-domene-hjem, selector-hook-overflaten finalisert + døde hooks slettet), grep alle live konsumenter av `audio-tour-store` (`DesktopStorySidebar`, `StoryProgressBar`, `ChapterProgressBar`, `use-reels-audio-orchestration`) og bekreft `npx tsc --noEmit` passerer på tvers av de PRD-9-eide konsumentene. **Koordiner store-eksport-kontrakten med PRD 9 FØR dens komponenter fryses** — PRD 14 (Lag 4) muterer en store PRD 9 (Lag 3) allerede har portet mot den gamle formen. (§10 Q5.)

### Unit 7 — Karaoke-sync-port (audio-element + teleprompter + tokens)
- **Mål (→ G7):** Port karaoke-sync-clusteret; bevar timing-remap-avhengigheten (karaoke krever remappede timings ellers vises alias).
- **Filer:** `@/components/variants/report/board/audio-tour/use-audio-element.tsx` (port), `@/components/variants/report/reels/KaraokeTeleprompter.tsx` (port), `@/components/variants/report/board/audio-tour/KaraokePitchText.tsx` (port), `@/components/variants/report/board/audio-tour/karaoke-tokens.ts` (port), `@/components/variants/report/board/audio-tour/tour-mode.css` (port), tilhørende `.test`-filer (port).
- **Avhengigheter:** Unit 1 (timings-remap fra `generateAudio`), Unit 6 (store driver `onTrackEnded`/`autoAdvance`).
- **Akseptansekriterier:**
  1. `AudioElementProvider` eksponerer `<audio>` + `currentTime`/`duration` via context (~4Hz, `:34`/`121`), `unlock` (`:158`), muted-toggle, `onTrackEnded`-callback (autoAdvance-modus, `:62`/`129`/`59`/`125`).
  2. `KaraokeTeleprompter` leser `currentMs` fra `AudioElementContext` (`:36-37`), bygger sentence-vindu på remappede timings (`mapCharTimingsToWords/Sentences:39-40`); fallback til klartekst uten timings (`:42+`).
  3. **Timing-remap-avhengighet bevart:** karaoke krever pronunciation-remappede timings (fra `remapTimingsToOriginal`, Unit 1) ellers vises alias-staving — verifisert at `KaraokeTeleprompter` leser original-tekst-timings, ikke alias-timings.
  4. `karaoke-tokens` (`mapCharTimingsToWords` + `mapTokensToSentences`) + `KaraokePitchText` portet; `karaoke-tokens.test.ts` + `KaraokePitchText.test.tsx` passerer.
  5. Stillbilder via `next/image` der relevant (ESLint); ingen `<img>`. `npx tsc --noEmit` 0 feil.

### Unit 8 — Verifikasjon (full pipeline, ikke snippet) + mekaniske porter
- **Mål (→ G8):** Bevis at audio-domenet FUNGERER (ikke bare kompilerer): full-pipeline TTS-validering + override-akse-vern + karaoke-sync; alle porter grønne.
- **Filer:** `@/docs/rebuild/audio-reels-verifikasjon-runbook.md` (verifikasjons-runbook).
- **Avhengigheter:** Unit 1–7.
- **Akseptansekriterier:**
  1. **Full-pipeline TTS-validering (IKKE snippet):** kjør et ekte produksjons-manus gjennom `generateAudio` (modellen er stokastisk per request — memory: test produksjons-manus, ikke kort snippet); bekreft mp3 ≥ `MIN_BYTES`, alignment-felt til stede, karaoke-timings remappet. `scripts/elevenlabs-norsk-validation.ts` er referanse for HVORDAN.
  2. **Override-akse-vern bevist:** kjør reels-VO-bygg for et prosjekt med `reelsAudio` på ≥1 tema; bekreft at `{themeId}-reels.mp3` skrives OG at `{themeId}.mp3` (tour) er uberørt (filsjekk før/etter). Bekreft `reels-data` velger `reelsAudio` over `audio` i feed.
  3. **Karaoke-sync verifisert i nettleser:** start reels-feed i nystartet Chrome (memory: verifiser 3D/board i nystartet Chrome); swipe gjennom audio-bærende cards; bekreft at karaoke-teksten følger `currentTime` og viser RIKTIG (original) staving, ikke alias.
  4. **Veo-nøkkel-fiks verifisert (differensiert):** ingen API-nøkkel i noen førsteparts-API-kall-URL (`:152`/`:186` bruker `x-goog-api-key`-header); media-nedlastings-URI-nøkkelen (`:216`) håndtert per endepunktets krav (header hvis akseptert, ellers behold i URL med dokumentert notat — transient signert URI).
  5. Alle keeper-tester grønne: `pronunciation.test.ts`, `storage-paths.test.ts`, `manus.test.ts`, `audio-tour-store.test.ts`, `reels-data.test.ts` (override), `karaoke-tokens.test.ts`, `KaraokePitchText.test.tsx`, `pronunciation.test.ts`.
  6. Mekaniske porter grønne: `npm run lint` (0 errors), `npm test`, `npx tsc --noEmit`, `npm run build`.

> **Fullstendighet:** 8 av 8 units dekket. Hver keeper/port/dead/reference-fil fra evidens-pakken er eksplisitt klassifisert og tildelt en unit. Ingen sampling — alle 7 `voiceover-reels-*`-filene er adressert (6 slettet, 1 beholdt), alle 3 dead compose/voiceover-scripts slettet, alle 5 reference-only bevart med begrunnelse.

---

## 8. Utviklingsløp (faser)

### Fase 1 — Build-time TTS-kjerne + manus
- **Mål:** TTS-kjernen + uttale-spaken + manus-domenelogikken portet, testet, full-pipeline-validert. Ingen blokkerende åpne spørsmål (override-grensen ratifisert, playback-grensen resolvert).
- **Leveranse:** Unit 1, 2.
- **Autonomi-nivå:** Høy — ren build-time logikk, godt test-dekket, oppskrift låst.

### Fase 2 — Byggere + override-akse + video-pipeline
- **Mål:** Tour-byggere + reels-VO-override + video-pipeline portet; Veo-nøkkel-fiks + dead-sletting; `audioVersion`-semantikk avklart.
- **Leveranse:** Unit 3, 4, 5.
- **Autonomi-nivå:** Medium — `audioVersion`-avklaring + Veo-nøkkel-fiks + dead-sletting krever vurdering; bygger-konsolidering BEVISST ikke gjort (patch 763 RISIKO — inspiser serielt, ikke merge).

### Fase 3 — Runtime playback + karaoke + verifikasjon
- **Mål:** Playback-orkestrering + karaoke-sync portet med dead-export-verifikasjon + avhengighet snudd; full verifikasjon (nettleser + full pipeline) + mekaniske porter.
- **Leveranse:** Unit 6, 7, 8.
- **Autonomi-nivå:** Medium — dead-export-verifikasjon FØR port + board-data-avhengighet snudd krever koordinering med PRD 1/5/9; nettleser-verifikasjon i nystartet Chrome.

---

## 9. Beslutninger

| # | Beslutning | Begrunnelse |
|---|------------|-------------|
| 1 | **Override, ikke replacement:** reels-mp3 til EGEN filnøkkel `{themeId}-reels.mp3`, defensiv suffiks-abort, tour-bygg rører aldri `reelsAudio` | Kollisjon ville ødelagt tour-karaoke (tour-karaoke leser tour-timings); `reels-data.ts:277` `reelsAudio ?? audio`; `reels-voiceover-build-local.ts:130-132` |
| 2 | Gating = spillbar-lyd-tilstedeværelse, ALDRI `reportTier`/`audioTourEnabled` | `audioTourEnabled` dødt flagg (manifest 247–250); PRD 5 `pickPlayableAudio` selekterer; patch #2 (`00-INDEX:85`) |
| 3 | ElevenLabs-oppskrift LÅST (Erik/turbo_v2_5/no/0.75); endring → `audioVersion`-bump + full-pipeline re-validering | `multilingual_v2`/`eleven_v3` → svensk/dansk-fallback; `/with-timestamps` verifisert KUN turbo_v2_5; modellen stokastisk per request |
| 4 | Veo-nøkkel flyttes til header for førsteparts-API-kall (`:152`/`:186`); media-nedlastings-URI (`:216`) håndteres per endepunktets krav (header hvis akseptert, ellers behold i URL med notat) | CLAUDE.md: nøkkel i header (`x-goog-api-key`), ALDRI URL (lekker i logs). `:152`/`:186` er førsteparts-`generativelanguage.googleapis.com`-kall (POST `:172-176` bruker allerede headers) → trygt fikserbart. `:216` appenderer nøkkel til Google-RETURNERT video-URI (`extractVideoUri:204-213`) — media-endepunkt som kan kreve query-param; verifiser empirisk før header kreves |
| 5 | Audio-byggere IKKE konsolidert i denne porten — behold 3 scripts, port hver, dokumenter override-vern | patch 763 RISIKO (konsolidering kan klobbe karaoke per `reference_reels_audio_override`); ~90% overlapp INSPISER serielt, ikke tving merge |
| 6 | Behold 1 av 7 `voiceover-reels-*` som timings→compose-referanse; slett 6 + de 3 andre døde | CLAUDE.md «ALDRI la dead code ligge»; men single-pass/timings-flyten er læring verdt å bevare i ÉN fil |
| 7 | Audio/reels-MANUS er PRD 14s pipeline-INPUT, IKKE PRD 7 story-text | Skill bekreftet (contractFromFoundation PRD 7): editorial story-text er PRD 7, audio-manus-write + voiceover-reels hardkodet manus er PRD 14; ingen delt fil |
| 8 | **Runtime audio-playback-orkestrering EID av PRD 14** (store + orchestration + karaoke) | PRD 9 §6 deferred + §10 Q6 eier reels-VIDEO-UX; PRD 9 nevner IKKE store/orchestration/karaoke i scope → grensen ren, ingen openQuestion |
| 9 | `reels-data.ts` er DELT GRENSE: PRD 14 eier AUDIO-aksen, PRD 9 eier VIDEO-UX + render | `reelsAudio ?? audio:277`/`isAudioBearing:105`/`buildCategoryTracks:339` = PRD 14; `videoBgSrc`/`posterForVideo` = PRD 9 §5.4 |
| 10 | Dead-export-hooks (`useAudioTourSyncTargets`/`SectionProgress`/`Meta`) verifiseres FØR port, ikke portet verbatim | `use-audio-tour-sync.ts` slettet; grep finner kun definisjon; faktisk sync via `AudioElementContext.currentTime` |
| 11 | **`BoardCategoryId`/`BoardPOIId`/`BoardAudioTrack` type-hjem EIES av PRD 5 (definerer dem i `lib/board/board-types.ts` + re-eksporterer fra `board-data.ts`); PRD 14 KONSUMERER (importerer derfra, flytter ikke).** | Typene bor i dag i `board-data.ts:31`/`:32`/`:23` men importeres OPPOVER (uønsket lib→components) av `audio-tour-store.ts:5`, `event-board-data.ts:24`/`:28`, `reels-data.ts:4`/`:2`. PRD 5 (board-data-eieren, Unit 1) hoister kanonisk-hjemmet til `lib/board/board-types.ts` og re-eksporterer fra `board-data.ts` for bakoverkompat; PRD 14 importerer NEDOVER fra kjernen via `@/`-prefix. manifest 304 anbefaler snu i rebuild; lib skal ikke avhenge av components |

### Kontroll-runde 2026-06-27

| Funn | Dom | Konsekvens i PRD |
|------|-----|------------------|
| **`BoardCategoryId` type-hjem (§10 Q4, Beslutning 11)** — verifisert mot kode: `BoardCategoryId` (`board-data.ts:31`), søster `BoardPOIId` (`:32`) og `BoardAudioTrack` (`:23`) defineres i components, men importeres OPPOVER (uønsket lib→components) av `audio-tour-store.ts:5`, `lib/event-board/event-board-data.ts:24`/`:28` og `reels-data.ts:4`/`:2`. | **BEKREFTET — type-hjemmet EIES av PRD 5.** PRD 5 (Unit 1, board-data-eieren) definerer typene kanonisk i `lib/board/board-types.ts` + re-eksporterer fra `board-data.ts` for bakoverkompat; PRD 14 KONSUMERER (importerer NEDOVER fra kjernen, flytter ikke). Lav risiko. | §10 Q4 LØST; §5.2-rad oppdatert; Beslutning 11 oppdatert; Deferred-tabell (§6) peker type-plassering til PRD 5; Unit 6 AC4 = consume-edge. |

---

## 10. Åpne spørsmål

*Ingen er blokkerende for Fase 1. Override-akse-grensen er ratifisert (Beslutning 1); runtime-playback-grensen 09↔14 er resolvert (Beslutning 8).*

1. **(ikke-blokkerende, Unit 6 — AVKLART)** Dead-export-hooks: `useAudioTourSyncTargets` (`:260`) + `useAudioTourSectionProgress` (`:236`) + `useAudioTourMeta` (`:196`) har verifisert 0 konsumenter repo-vidt (grep gir kun definisjon; `use-audio-tour-sync.ts` slettet). De er IKKE lest av noen port-target: `DesktopStorySidebar` (`:21-23`/`447-448`), `StoryProgressBar` (`:5`/`48-50`) og `ChapterProgressBar` (`:5`/`20-22`) konsumerer KUN `useAudioTourActions`/`useAudioTourStore`. → De tre er simpelthen døde. SLETT dem under porten; behold kun hooks med live konsumenter.
2. **(ikke-blokkerende, Unit 3 — AVKLART)** `audioVersion`-semantikk: alle tre byggerne skriver `audioVersion: 5` (`audio-tour-build.ts:455`, `audio-tour-build-local.ts:157`, `audio-manus-write.ts:468`). Det er ÉN cache-bust/re-gen-akse, ikke to — den eneste `= 1` er en utdatert doc-kommentar i `audio-manus-write.ts:18` som fikses under porten. Ingen reell drift. Påvirker ikke kjerne-pipelinen.
3. **(ikke-blokkerende, Deferred)** Audio-bygger-konsolidering (3 scripts → tier-aware source-adapter, manifest 491): patch 763 sier RISIKO (override-akse kan klobbe karaoke). **Default: behold 3, port hver, dokumenter override-vernet — ikke tving merge i denne rebuilden** (Beslutning 5). Egen oppryddings-task etter serielt inspisert port.
4. **(ikke-blokkerende, Unit 6 — LØST, Kontroll 2026-06-27)** `BoardCategoryId` type-hjem (manifest 304): **BEKREFTET — type-hjemmet EIES av PRD 5; PRD 14 KONSUMERER.** `BoardCategoryId` (+ søster `BoardPOIId`, `BoardAudioTrack`) bor i dag i `board-data.ts:31`/`:32`/`:23` men importeres OPPOVER (uønsket lib→components) av `audio-tour-store.ts:5`, `event-board-data.ts:24`/`:28` og `reels-data.ts:4`/`:2`. PRD 5 (Unit 1, board-data-eieren) definerer typene kanonisk i `lib/board/board-types.ts` + re-eksporterer fra `board-data.ts` for bakoverkompat; PRD 14 importerer NEDOVER fra kjernen (consume-edge), flytter ikke. Lav risiko. (Beslutning 11.)
5. **(ikke-blokkerende, Unit 6 AC7, kryss-PRD-sekvensering)** PRD 14 (Lag 4) omformer `audio-tour-store` (snur `BoardCategoryId`-importen, finaliserer selector-hook-overflaten, sletter døde hooks) ETTER at PRD 9 (Lag 3) allerede har portet sine live konsumenter (`DesktopStorySidebar`/`StoryProgressBar`/`ChapterProgressBar`) mot den gamle store-formen. Koordiner store-eksport-kontrakten med PRD 9 FØR dens komponenter fryses, og bekreft `npx tsc --noEmit` på tvers av PRD-9-konsumentene etter omformingen (Unit 6 AC7). Ikke-blokkerende fordi kontrakten (hvilke hooks eksporteres) kan ratifiseres tidlig; bare implementasjonen kommer i Lag 4.

---

## 11. Avhengigheter (ASCII-graf)

```
        prd-board-data-state (PRD 5)        prd-board-skall-ui (PRD 9)
        (BoardCategory.audio/.reelsAudio,    (useReels/ReelsProvider nav-state,
         BoardAudioTrack, pickPlayableAudio   reels-data.ts DELT fil [VIDEO-UX],
         SELEKSJON velger sporene)            reels-VIDEO-render synkront mot audio)
                  │                                      │
                  └──────────────────┬───────────────────┘
                                     ▼
              ┌──── prd-audio-tour-reels (PRD 14 — DENNE) ────┐
              │   build-time TTS + manus (Unit 1,2)            │
              │   tour-byggere + reels-override (Unit 3,4)     │
              │   reels-video-pipeline (Unit 5)               │
              │   runtime playback + karaoke (Unit 6,7)       │
              └───────────────────────┬───────────────────────┘
                                      ▼
                       prd-nivaa-2-kuratering (PRD 15-prov)
                       (kjører pipelinen + override-aksen for
                        å fylle den rikere feed-stemmen)
```

**Blokkeres av:** PRD 5 (board-data audio-felt + seleksjon), PRD 9 (reels-feed nav-state + DELT `reels-data.ts`). `00-INDEX:59` (PRD 14 ←05,09).
**Blokkerer:** PRD 15-prov (nivå-2-kuratering konsumerer pipelinen + override-aksen). `00-INDEX:61`.
**Produserer for (eier ikke konsumet):** PRD 5 (sporene seleksjonen velger), PRD 9 (mp4+poster-assets video-UX rendrer + audio playback-grensen video synkroniseres mot), PRD 10 (beat-signalet `useCurrentTrack`/`useAudioTourPhase` som type/signatur-KONTRAKT).
**Konsumeres av (beat-signal-KONTRAKT, lag-back-edge):** PRD 10 (Lag 3) konsumerer PRD 14s (Lag 4) `audio-tour-store`-beat-signal (`useCurrentTrack`/`useAudioTourPhase`/`categoryId`) for sin audio-drevne welcome/home/outro-beat-choreografi. Bundet som type/signatur-kontrakt, ikke runtime-instans (PRD 10 §10 Q7 / §5.3b). Kontrakt-noden hoistes til delt Lag-2-plassering (jf. PRD 5s `BoardCategoryId`-type-hjem) og MÅ materialiseres FØR både 10 og 14 i beads-serialiseringen (`00-INDEX:68`).

---

**Fullstendighet:** 8 av 8 implementation units spesifisert med avhengigheter + akseptansekriterier; 8 av 8 mål (G1–G8) enumerert i §2 og koblet til ≥1 unit; alle units peker tilbake til ≥1 mål. Alle bærende påstander forankret i kode (`elevenlabs-client.ts:18`/`20`/`21`/`24-29`/`79-80`/`74`/`132-148`/`91-93`/`108-117`, `storage-paths.ts:11-13`/`28-36`, `reels-voiceover-build-local.ts:82-92`/`86`/`130-132`, `reels-data.ts:277`/`273-274`, `audio-tour-build.ts:53-54`/`351-357`/`365`/`455`/`462`, `animate-scene-veo.ts:152`/`186`/`216`, `manus.ts:15-16`, `audio-tour-store.ts:81`/`196`/`236`/`260`, `use-reels-audio-orchestration.ts:17`/`57-59`/`70-83`, `lib/types.ts:289`/`295`/`306`), manifest (198–243 keeper, 488–518 port, 650–655 reference, 703–707 dead, 247–250 dødt flagg, 301–304/304, 763) og prod-schema-snapshot (ingen audio-kolonne på `pois`; audio i `products.config` jsonb). Ingen P0/P1/P2-tiers; deferred under §6 med pekere; ingen render-gating eller `audioTourEnabled`-gating spesifisert (patch #2). PRD 5/9-grensene respektert (PRD 14 produserer + spiller; PRD 5 selekterer; PRD 9 rendrer video).
