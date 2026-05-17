---
date: 2026-05-16
topic: megler-pitch-audio-tour
---

# Megler-pitch — Audio-tour på rapport-board

## Problem Frame

Rapport-board har god strukturell UX for å presentere nabolaget (2D/3D-kart, 6 kategorier med rikt redaksjonelt innhold, kuratert grounding fra Gemini/Claude). Men én verdi mangler: **megler-pitchen på en visning**. På fysisk visning står megleren ved kjøkkenvinduet og forteller om Solsiden, skolene, kafé-livet — kjøperens spørsmål "hva med nærområdet?" får et personlig, sammenhengende svar. I dag må kjøper selv klikke seg gjennom Placy-rapporten for å få samme bilde, og mange (særlig de som ikke er sterke på kart/navigasjon) får ikke utbytte av innholdet.

Audio-tour-modusen skal gjenskape denne pitchen som et 3-minutters audio-spor med visuell synkronisering, levert build-time per prosjekt og gratis for kjøperen. Pilot-kontekst er Propr-distribusjon (1700 listinger/år) der avtalen er signert og første prosjekt (Spro Havn) skal sendes ut.

## Requirements

**Tour-opplevelse (kjøper)**
- R1. Rapport-board må vise en "▶ Start tour"-CTA i Hjem-panel (default state) som starter audio-touren med ett klikk.
- R2. Touren spiller én "track" per aktive kategori inkludert Hjem, i fast rekkefølge (Hjem → tema 1 → tema 2 …). Antall tracks = antall aktive kategorier per prosjekt.
- R3. Audio må starte umiddelbart når play trykkes — ingen "velkommen til tour"-buffer eller stillhet. For å unngå iOS Safari autoplay-blokk på track 2+ må enten (a) ett delt `<audio>`-element brukes på tvers av tracks med sekvensiell `src`-bytte (samme element forblir unlocked etter første play), eller (b) alle audio-elementer pre-instansieres og `.load()`-kalles under første play-event. Valg av strategi tas i plan-fasen.
- R4. Ved track-skifte må UI automatisk bytte til den nye kategorien som om bruker klikket i venstre rail (active kategori, illustrasjon, body-tekst, kart-bounds/markører).
- R5. Mens touren er aktiv må rapport-board være visuelt i "tour-modus": en distinkt player-banner overtar panel-toppen, body-tekst dempes til provisional `opacity: 0.5` (tuning-parameter i plan-fasen), og active kategori i rail (desktop) eller `BoardCategoryTabBar`-knapp (mobile) får en pulsering som indikerer "her er pitchen nå".
- R6. Player-banner må vise: track-teller (3/6), kategori-navn, segmentert progressbar (én segment per track, aktiv segment fyller), tids-indikator (mm:ss / mm:ss), pause/play-knapp, forrige/neste-track-knapper, lukk-tour-knapp.
- R7. Hvis bruker klikker en annen kategori i rail (desktop) eller `BoardCategoryTabBar` (mobile) mens touren spiller, må touren pauses og bruker navigeres til den valgte kategorien (manuell utforskning prioriteres over tour-flyt). En "Fortsett tour"-knapp må gjøres tilgjengelig så bruker kan resume.
- R8. Når siste track er ferdig må en "Hva vil du gjøre nå?"-skjerm vises med shortcuts: "Spill av igjen", "Utforsk Mat & Drikke" (eller annen kategori basert på data), og "Kontakt megler".

**Manus og audio (build-pipeline)**
- R9. Pitch-manus per track må genereres build-time via et nytt LLM-steg i `/generate-bolig`-pipelinen (nytt **Steg 8c**, kjøres etter 8b grounding). Manus-input varierer per track-type: (a) for Hjem-track: `reportConfig.heroIntro` + prosjektets areaSlug/strøk-kontekst (Hjem er ikke en `BoardCategory` og har ingen grounding-objekt); (b) for kategori-tracks: eksisterende grounding-tekst (lead + body + Gemini-grounding) for den kategorien.
- R10. Manus-promptet må produsere muntlig, varm, kuratorisk tone (matchet til Placy editorial voice / Curator-skill) med naturlig overgang fra forrige kategori ("Så til familielivet — …"). Cap ~70 norske ord per kategori.
- R11. Audio per kategori må genereres build-time via ElevenLabs API. **Pilot-stemme: Daniel (premade, voice_id `onwK4e9ZLuTAKqWW03F9`), modell `eleven_multilingual_v2`, voice_settings stability=0.5/similarity_boost=0.75.** Lagres som MP3 og lenkes til prosjektet.
- R12. Pilot-versjonen leverer kun norsk. Pipeline og UI-lag skal være språk-agnostisk (lang-param i build-pipeline, default `no`) men kun `no`-audio genereres.
- R13. På mobil må `BoardMobileSheet` pinnes til peek-snap (320px) når tour starter, slik at både player-banner og kart-bounds er synlige samtidig. Bruker kan dra sheet opp til full eller ned til 96px; ved drag til 96px regnes det som "lukk tour"-gest og touren pauser (følger samme regel som R7).

## Success Criteria

Pilot er vellykket når disse er sanne for Spro Havn-rapporten:

- Pitch-manus + audio er bygget for alle aktive kategorier (estimert 6 tracks).
- Andreas har lyttet til alle tracks og signert kvaliteten (manus + uttale + tempo).
- Play-knapp + player fungerer på iPhone Safari, iPhone Chrome, og desktop Chrome.
- Sync ved track-skifte fungerer: bytte til track 3 → Hverdagsliv blir aktiv i rail + detail-panel oppdateres + kart-markører byttes.
- "Click to first audio" er under 5 sekunder fra play-knapp til hørbar lyd.
- Pause/play/skip-fremover/skip-bakover fungerer.
- Manuell kategori-klikk mid-tour pauser tour og navigerer til valgt kategori (per R7).
- Tour-end-skjerm vises ved siste track ferdig (per R8).
- Pitchen er sendt til Kjetil/Karoline (Propr) sammen med Spro Havn-rapporten.
- **Outcome-validering:** Propr-kontakt (Kjetil/Karoline) gir eksplisitt positiv tilbakemelding på audio-tour som differensiator innen 14 dager etter sending. Hvis tilbakemelding er nøytral/negativ, evaluer om Retning A (mini-player) eller Story Mode skal hentes fram igjen før neste prosjekt.

## Scope Boundaries

- **Kun rapport-board (eiendom).** Ikke Explorer, ikke Guide, ikke Hotel/Næring/Adresse-produkter. Kan utvides senere hvis pilot validerer.
- **Kun auto-pitch (Placy-stemmen).** Megler-egen-innspilling (voice clone / record-en-egen-pitch) er ute av scope. Defer til premium-segment hvis Propr-pilot lykkes.
- **Kun norsk i pilot.** Engelsk og andre språk legges til hvis spesifikt segment (relocation, Hurtigruten/Havila) etterspør.
- **Ingen POI-pulse-synkronisering mid-track.** Markører reagerer bare ved kategori-bytte, ikke når enkelt-POIer nevnes innen en track. Deferred enhancement etter pilot.
- **Ingen runtime LLM eller TTS.** Alt manus og audio genereres build-time per CLAUDE.md regel (LLM build-time only). Cache busts via re-bygg.
- **Ingen admin-UI for å redigere manus eller velge stemme.** Manus er read-only output av build. Stemme-valg er konfigurasjon i `/generate-bolig`-skill, ikke per-prosjekt-UI.
- **Ingen deling av "min reise"** (i motsetning til Story Mode-brainstormen 2026-04-07). Tour er én lineær opplevelse uten brukervalg eller branching.
- **Ingen URL-state for play-progress.** Refresh starter alltid på Hjem. Delelink er ikke pilot-mål.

## Key Decisions

- **Retning B (tour-modus) over Retning A (sticky mini-player):** Tour-modus med distinkt visuell state matcher det mentale bildet av "megleren pitcher på visning". Mini-player-mønsteret er kjent (Spotify) men oppleves som "lytt mens du surfer" — ikke som en kuratert opplevelse. Wow-faktor er hele poenget med dette laget.
- **Auto-pitch, ikke megler-innspilling:** Skalerbarhet til Propr-volum (1700/år) er ikke-forhandlerbart. Megler-innspilling er enhancement for premium-segment, ikke pilot.
- **Build-time generering for både manus og audio:** Predikerbar kvalitet (Andreas kan QA før release), null runtime-kost, ingen tredjeparts-avhengighet mens kjøper bruker rapporten, og matcher CLAUDE.md regel.
- **30 sek per track, ~3 min total:** Highlight reel-tempo. Kjøper kan høre gjennom hele uten å droppe av. Lengre formater (90s+ podcast-feel) er hypotetisk verdifulle men ikke validert.
- **Klikk på kategori under tour pauser:** Manuell utforskning prioriteres over tour-flyt. Alternativene (hopp-til-track, ignorer-klikk) skaper friksjon: "jeg trykket på Mat & Drikke fordi jeg ville se det, ikke fordi jeg ville lytte til det". Pausen er respektfull.
- **Ingen intro-buffer ("velkommen til tour"):** Hjem-track 1 har allerede oversiktstekst om området ("Stasjonskvartalet ligger på kaifronten…"). Meta-narrasjon ("her kommer en pitch") er støy.
- **Tour-end gir aktiv neste-handling:** "Hva vil du gjøre nå?"-skjerm gir kjøperen et naturlig neste steg. Bare-stå-stille-på-siste-kategori er en dead end; auto-tilbake-til-Hjem skjuler at tour er ferdig.
- **Stemme: Daniel (ElevenLabs premade, britisk "Steady Broadcaster"-stil), modell `eleven_multilingual_v2`** — validert mot Spro Havn-stedsnavn 2026-05-17 via `scripts/elevenlabs-validation.ts`. Premade brukes for pilot fordi free plan blokkerer library voices (Charlotte, Aria, Laura). Britisk aksent er minst påtrengende på norsk tekst (mindre rhotacism enn american). Hvis Propr-skalering går videre, må vi uansett oppgradere til Creator-plan ($22/mnd) for å klare 1700 prosjekter/år — på det tidspunkt re-validerer vi om en library voice gir bedre norsk-kvalitet.
- **Storage: committed til `public/audio/{slug}/{categoryId}.mp3` i prototype-fasen.** URL er bare en statisk path (`/audio/spro-havn/hjem.mp3`). Spro Havn ~3 MB er ubetydelig for git. Refactor til Vercel Blob (eller annen ekstern store) hvis pilot validerer og Propr-skala blir reelt — det er en endring av build-script + URL-resolver, ikke arkitektur. Matcher [memory:project_stage_prototype.md] "null-downtime-patterns er over-engineering".
- **Empty-state: ingen partial-tour-logikk.** Play-CTA rendres kun hvis alle aktive kategorier har tilhørende audio-fil. Hvis bygg feiler på en kategori, fixer Andreas det manuelt før release. Matcher Propr-pilotens manuell-QA-policy. Når automatisert flyt blir reelt (10+ ukentlige rapporter), revurder.

## Dependencies / Assumptions

- ElevenLabs-konto er etablert (bekreftet av bruker).
- Eksisterende grounding-pipeline (Gemini build-time) er på plass og produserer lead + body + grounding-tekst per kategori per prosjekt — bekreftet i kodebasen (`components/variants/report/board/BoardCategoryInfoTab.tsx`).
- Eksisterende `BoardContext`-reducer (`lib/board/board-state.ts`) håndterer kategori-bytte via dispatch. Tour-modus utvider denne med ny state.
- Rapport-board renderer er stabil og merget til main (verifisert mot PROJECT-LOG.md 2026-04-30-sesjonene).
- Propr-pilot-avtale eksisterer (`docs/strategy/`-spor). Spro Havn er valgt som første prosjekt.
- iOS Safari/Chrome har autoplay-restriksjoner (krever brukerinteraksjon for å starte audio). Tour starter via eksplisitt play-klikk — track 1 er dermed unlocked, men track 2+ krever spesifikk håndtering (jf. R3).
- **Lytte-kontekst-antagelse:** Kjøperen åpner rapporten i kontekst der audio er passende (hjemme, ikke pendling i offentlig setting uten hodetelefoner). Fallback for ikke-audio-kontekst (transcript-modus, "les manus i stedet") er ute av pilot-scope. Hvis lytte-rate er <30% i pilot, må fallback vurderes før utrulling.

## Outstanding Questions

### Resolve Before Planning

(alle blokkere løst 2026-05-17 — se Key Decisions nedenfor)

- ~~[Affects R11] **ElevenLabs norsk-stemme-validering**~~ — **Løst.** Validert via `scripts/elevenlabs-validation.ts`. Daniel (britisk premade) bekreftet akseptabel.
- ~~[Affects R11] **Storage-lokasjon**~~ — **Løst.** Committed til `public/audio/{slug}/{categoryId}.mp3` i prototype-fasen. Refactor til Vercel Blob hvis pilot validerer og Propr-skala blir reelt.
- ~~[Affects R1, R2] **Empty-state policy**~~ — **Løst.** Ingen partial-tour-logikk. Play-CTA rendres kun hvis alle tracks for aktive kategorier finnes. Hvis bygg feiler, fix manuelt før release (matcher Propr-pilotens manuell-QA-policy).

### Deferred to Planning

- [Affects R9, R11][Technical] Hvordan håndteres cache-busting når grounding endres? (Re-gen av manus → re-gen av audio. Hash-basert filnavn, eller eksplisitt `audioVersion` i `reportConfig` à la `groundingVersion`?)
- [Affects R6][Technical] Hvor lever tour-state i Zustand? (Utvide `BoardContext`-reducer med tour-fase, eller egen `TourContext`?) Bør respektere eksisterende state-machine fra mobile multi-snap-sheet-arbeidet.
- [Affects R6][Technical] Bruker `MediaSession` API for iOS/Android lock-screen-kontroller (forrige/neste, play/pause på iOS Control Center)? Lav-friksjon hvis vi bruker en eksisterende audio-bibliotek.
- [Affects R3][Needs research] iOS Safari første-audio-latency: hvordan oppnår vi <5 sek "click to first audio" når MP3 må fetches? Preload på Hjem-mount? Service worker? Edge-CDN-cache? Avhenger av storage-valg (Resolve-Before-Planning).
- [Affects R5][Needs research] Visuell signatur for "tour-modus" — provisional `opacity: 0.5` for body-text er startverdi. Player-banner-høyde og collapsed-state krever screenshot-iterasjon med dev-server.
- [Affects R4][Technical] Skal kart-pan/bounds-endring ved track-skifte være animert (smooth fly) eller instant? Eksisterende `BoardMap` har fitBounds-logikk vi bør bruke.

## Forhold til eksisterende arbeid

- **Story Mode-brainstorm (`docs/brainstorms/2026-04-07-interaktiv-storytelling-brainstorm.md`):** Beslektet idé — guide kjøperen gjennom kategoriene som en sammenhengende narrativ. Men: visuell scrollytelling med mikro-valg, ikke audio. Audio-tour er sannsynligvis den vinnende versjonen av samme problem ("led brukeren gjennom området"). Story Mode parkeres til vi vet om audio-tour fungerer. Hvis ja, kan Story Mode arkiveres som ikke-pursued.
- **Curator-skill (`.claude/skills/curator/`):** Definerer Placy editorial voice. Manus-promptet skal eksplisitt referere/bygge på denne for tone-konsistens.
- **Propr-pilot (`docs/strategy/2026-04-30-propr-distribusjons-pilot-brainstorm.md`):** Audio-tour er en kandidatfeature for Spro Havn-rapport. Pitchen kan demonstreres til Kjetil/Karoline som "se hva vi kan gjøre — Propr har ikke dette".
- **PROJECT-LOG 2026-04-30-sesjonene:** Rapport-board state-machine (BoardContext) er nylig refaktorert (multi-snap-sheet-arbeidet). Tour-state må respektere denne arkitekturen og ikke gjenintrodusere den ryddet-vekk "reading"-fasen.

## Deferred / Open Questions

### From 2026-05-16 review

13 findings deferred for plan-fase eller senere validering. 11 finn ble allerede applisert i requirements/decisions ovenfor (Hjem-grounding, mobile rail-mapping, iOS autoplay R3, ElevenLabs/Storage/Empty-state promotert til Resolve-Before-Planning, success outcome-metric, lytte-kontekst-antagelse, mobile sheet-snap R13, pipeline Steg 8c, dim-level provisional). FYI-funn (5) er ikke ført opp her — de er observasjoner uten påvist skade hvis ikke handlet på.

**Design-detaljer (plan-fase med visuell iterasjon i dev-server)**

- [Design F1] **Tour-end-skjerm innhold/layout** — R8 nevner tre shortcuts ("Spill av igjen", "Utforsk Mat & Drikke", "Kontakt megler") men ikke visuell hierarki, hvilken handling som er primær, hvordan kategori-shortcut velges/labels, eller hva "Kontakt megler"-CTA-en resolver til (telefon, e-post, skjema, lenke). Implementer må velge dette i plan/kode.
- [Design F2] **"Fortsett tour"-affordance plassering og persistens** — R7 spesifiserer ikke om knappen lever i player-banner, som flytende pill, eller i panel-footer, og om den disappear etter timeout eller bare ved eksplisitt dismiss. Naïv impl ("banner som alltid står") gir permanent UI-rot.
- [Design F3] **Mobile bottom-sheet plassering for player-banner** — Apply på R5/R7 dekker pulsering/klikk på tab-bar, men hvor selve player-banneret bor på mobil (sheet-top, fast inline OVER tab-bar, eller integrert i tab-bar) er ikke fastsatt. R13 pinner sheet til 320px; nå må banner-flate avgjøres.
- [Design F4] **Player-banner dimensjoner og collapsed state** — R6 lister 7 elementer uten å spesifisere høyde, prioritering, eller collapse-til-mini-state. Påvirker hvor mye plass kategori-illustrasjon + body får under banner.
- [Design F5] **"Start tour"-CTA plassering og visuell vekt** — R1 sier "i Hjem-panel" men ikke om over/under header, over/under body-tekst, hvor prominent, eller om den scroller ut av view. Avgjørende for feature-discovery.
- [Design F6] **Segmented progressbar ved ekstreme track-tall** — 1-N segmenter. Hva med smalle segmenter når N=10? Min/max behaviour? Visuell forskjell på allerede-spilt vs upcoming?
- [Design F7] **Mid-tour audio-feil håndtering** — hva hvis MP3 404s eller staller etter at touren har startet? R3's "umiddelbart"-krav setter ingen loading-toleranse. En tour som henger stille uten feedback fremstår som ødelagt.
- [Design F8] **Rail-pulsering animasjons-style** — CSS keyframe? opacity-oscillation? ring-animasjon? Hvordan forholder den seg til eksisterende active-state i rail?
- [Design F10] **Keyboard/screen reader access til player** — fokus-rekkefølge, spacebar=play/pause, ARIA-labels. Ikke en lov-pålagt blokker for pilot, men degraderer Propr-demo på desktop og er en kjent lavbar.

**Premise-challenges (verdt å huske ved post-pilot retro)**

- [Adversarial F1] **30 sek/track rationale er asserted, ikke validert** — `Cap ~70 norske ord per kategori` kan tvinge LLM til generisk prose i stedet for varm-kuratorisk innhold R10 krever. Reverserbart (re-gen scripts + audio) men kan kollidere med "wow"-løftet hvis kjøperne synes pitchen er "rushed".
- [Adversarial F2] **"Wow-faktor" er ikke falsifiable success-kriterium** — Retning B vs Retning A-valget kan ikke valideres post-pilot fordi suksess-kriteriene er teknisk-funksjonelle (ikke wow-måling). Outcome-validering (Propr-feedback) er tilført men er kvalitativ. Risiko: vi vet ikke om mini-player ville prestert bedre.
- [Adversarial F4] **Problem-solution framing mismatch** — premissen "kjøpere som ikke er sterke på kart får ikke utbytte → audio løser det" er uvalidert. Audio løser potensielt et annet problem ("lean-back konsum") for et annet segment ("de som DO engage men vil ha passiv variant"). Kan informere fremtidig segmentering.
- [Adversarial F7] **iOS Safari <5s "click to first audio" asserted uten evidens** — kald CDN-cache + 3G-throttling kan overskride 5 sek. Bør valideres med Spro Havn-prototype før commit til måltall. Kan kreve preload/edge-cache/service worker-løsning vi ikke har scope for.

## Next Steps

-> `/ce-plan` for structured implementation planning

Alle tre pre-plan-blokkere (ElevenLabs stemme, storage, empty-state) løst 2026-05-17 med prototype-førstevalg: Daniel + committed audio + ingen partial-tour-logikk. Re-evalueres hvis pilot validerer og Propr-skala blir reelt.
