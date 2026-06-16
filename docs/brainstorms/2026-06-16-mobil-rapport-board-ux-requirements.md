---
date: 2026-06-16
topic: mobil-rapport-board-ux
---

# Mobil rapport-board — rebygd interaksjonsmodell

## Problem Frame

Mobil-versjonen av rapport-boardet (nabolagsrapport / report-produktet) blander **narrativ avspilling** og **kart-utforskning** i én bottom-sheet med fire snap-states (peek 10 % / quarter 40 % / half 65 % / full 100 %), uten klart skille mellom de to. Desktop løser det med to flater (sidebar + permanent kart); mobil presser begge inn i samme sheet, med kart-kontroller som alltid henger på og en fase-maskin som ikke er gjennomtenkt for ikke-kategori-kort.

Konsekvensen er 7 UX-funn fra reell iPhone-gjennomgang, hvorav det skarpeste er en **lock-bug**: på oppsummerings-steget blir brukeren fanget i fullskjerm-kart uten synlig vei ut. Rot-årsaken er gjennomgående: affordanser (exit, kontroller, teaser) er koblet til *beat-type* i stedet for *flate*, og den muddy mellomtingen mellom historie og kart skaper både visuell støy og tilstands-feller.

Makro-beslutning (tatt av Andreas før brainstorm): **rebygg modellen** — ikke punktvis polish. Scope er ratifisert.

## Requirements

**Interaksjonsmodell (to flater)**
- R1. Mobil rapport-board har to fullskjerm-flater: **historie-flate** og **kart-flate**. Disse erstatter dagens 4-snap fase-enum (`peek/quarter/half/full`).
- R2. Aktiv flate avledes per beat: kategori / summary / megler → historie-flate; welcome / home / outro → kart-flate. Bruker kan veksle eksplisitt (Kart ↔ Tilbake). **Flate-valget nullstilles ved kapittel-bytte** — ingen tilstand henger over til neste kort.
- R3. Historie-flaten viser ren narrativ (video/foto + karaoke-tekst) uten kart **mens VO spiller** (kart-glimt introduseres først etter VO-slutt — R8).

**Vedvarende transport (avspiller)**
- R4. En slank transport-bar er til stede i bunn på **begge** flater (kontinuitet). Innhold: play/pause, sammenhengende segmentert progress (gjenbruk av `StoryProgressBar`-logikk), og posisjon (`n/total`).
- R5. Progress-segmentene er **tappbare**: tapp et segment → hopp til det kapittelet.
- R6. Transportens flate-veksler er **kontekstuell**: på en kategori-beats historie-flate viser den `Kart →`; på kart-flaten (nådd fra en kategori) viser den `← Tilbake`. På map-forward beats (welcome/home/outro) er kartet allerede flaten — der beholdes `Fortsett →` (eksisterende skip-til-neste), ikke `← Tilbake`. På summary/megler skjules veksleren helt (ingen POI-er å utforske). Dette er den eneste «åpne kart»-CTA-en (den kosmetiske pillen i R16 fjernes).

**Progress-gated kart-teaser (hybrid)**
- R7. Mens VO spiller på en kategori-beat: ingen kart på historie-flaten (kun den visuelt underordnede Kart-knappen i transporten). Kartet «vises ikke for mye».
- R8. Når kapittelets VO er ferdig: et **ikke-interaktivt kart-glimt** animeres opp fra bunn med «Utforsk på kart»-invitasjon. Glimtet er den **samme persistente `gmp-map-3d`-instansen** visuelt avslørt/animert (ikke en ny kart-instans — én-WebGL-invariant), gjort ikke-interaktiv via et gjennomsiktig pointer-events-skjold. Teaser-vinduet er et **definert, tidsstyrt vindu** ved kapittel-slutt — ikke et eksisterende «pust» (dagens mobil-kategori-beat parkerer åpent uten auto-advance). Teaserens livssyklus (vis → varighet → forkast ved advance/tap) designes i plan-fasen.
- R9. Ignorerer bruker teaseren: etter teaser-vinduet **auto-advancer** touren til neste kapittel (passiv lean-back). **NB — dette er NY oppførsel på kategori-beats:** i dag parkerer mobil på `map-quarter` og venter på manuell swipe (kun welcome/home auto-advancer i dag). Den manuelle swipe-gatingen erstattes bevisst som del av rebygget. Tapper bruker glimtet — **eller åpner kart manuelt via R6** — → kart-flate, og **enhver kart-entry setter auto-advance på vent OG kansellerer en eventuell planlagt advance-timer** (ikke bare et flagg — unngår race i teaser-vinduet). Retur til historie-flate gjenopptar.
- R10. Teaseren gjelder **kun kategori-beats** (ikke welcome/home/outro, ikke summary/megler). Map-forward beats er kart-primære som før — kartet er innholdet der, ikke en invitasjon.

**Kart-flate — kontroller & gester**
- R11. Kart-kontrollene (Visning 2D/3D, Kamera Auto/Fri) kollapses til **ett ⚙ FAB** som åpner en kompakt popover. Default skjult. Vises kun på kart-flaten.
- R12. Drag på kartet bytter Auto→Fri automatisk (eksisterende `onDragTakeover` beholdes), så manuell kamera-overtakelse krever ikke at popoveren åpnes.
- R13. Kartet er **kun pan/zoom-interaktivt på kart-flaten**. På historie-flate/teaser-glimt gjøres den persistente 3D-instansen ikke-interaktiv via et **gjennomsiktig pointer-events-skjold** over kart-laget — *ikke* via `GestureHandling` (`@vis.gl/react-google-maps` har bare AUTO/COOPERATIVE/GREEDY, ingen NONE; AUTO tillater fortsatt pan/zoom). 2D-fallback (Mapbox, ingen-3D-addon) bruker `interactive={false}`. `BoardMap` får et surface-bevisst flagg som gater både skjoldet og ⚙ FAB-en (R11).

**Exit & navigasjon**
- R14. Kart-flaten har **alltid minst to veier ut**: topp-venstre chevron (beholdes) + `← Tilbake` i transporten. Exit-affordanser er **flate-koblet, ikke beat-koblet** — gjelder også summary/outro. Dette fjerner lock-bugen by design.
- R15. «Swipe opp for neste»-hinten **fjernes** (den var død — `ReelsStack` er `pointer-events-none` i fullskjerm-kart). Kapittel-navigasjon skjer via transport-segmenter (R5) + auto-advance.
- R16. Den kosmetiske «Klikk for å åpne kart»-pillen (`pointer-events-none`-overlay) **fjernes**.

**Edge-cases & tilstander (landet i review-runde 1)**
- R17. **No-audio-rapporter**: to-flate + transport + teaser-modellen gjelder **kun når det finnes spillbar lyd**. Uten lyd faller mobil tilbake til eksisterende no-audio-flate (kategori-grid/preview) — transporten rendres ikke (unngår tom-`tracks`/NaN i `StoryProgressBar`).
- R18. **iOS lyd-unlock**: transporten rendres først **etter** at lyden er låst opp («Start opplevelsen»-splash). Før unlock = eksisterende splash, ingen transport.
- R19. **Summary/megler**: historie-flate-kort uten kart-relevans. Veksleren skjules (R6), teaseren fyrer ikke (R10), historie-flaten rendrer kortets eget innhold (summary-headline / megler-kontakt). Ingen fullskjerm-kart → ingen lock-risiko.
- R20. **Ingen-3D-addon / ingen-VO**: ⚙ FAB-innholdet er betinget — uten 3D-addon: ingen 2D/3D-toggle; uten VO: ingen Auto/Fri. Er ingen kontroller relevante, skjules FAB-en helt.
- R21. **Kart-flate-tilstander**: lett laste-tilstand (3D varmes opp bak splash, normalt varm), enkel feilmelding ved tile-feil med exits intakt, tomt POI-sett = kart vises likevel (nabolags-kontekst). Ikke over-spesifiser.
- R22. **Robusthet — alltid en vei ut**: ved backgrounding beholdes eksisterende `visibilitychange`-pause + ingen-auto-resume; gjenopptaks-vei = transport-play (nå alltid synlig), og teaseren re-fyrer hvis VO alt var ferdig. Ved audio-error (`onended` fyrer ikke → ingen teaser): transport + `Kart`-knapp er veien ut. SC1 dekker error-fasen.

### De 7 funnene → hvilke krav som løser dem

| # | Funn | Løses av |
|---|------|----------|
| 1 | Kart-kontroller alltid utbrettet | R11, R12 |
| 2 | Mobil mangler avspillings/posisjons-GUI | R4, R5, R6 |
| 3 | Dobbel åpne-kart-CTA | R6, R16 |
| 4 | Uklart hvor mye kart i 50 %-state | R1, R2, R3, R7 |
| 5 | «Swipe opp for neste» er død; mangler bunn-lukke | R14, R15 |
| 6 | Mini-kart-preview er pan/zoom-bar | R8, R13 |
| 7 | Lock-bug på oppsummering | R2, R14 |

### Modell — flyt og flater

```
                    KAPITTEL-BYTTE  (R2: flate nullstilles per beat)
                            │
        ┌───────────────────┴────────────────────┐
        │                                         │
  kategori / summary / megler              welcome / home / outro
        │                                         │
        ▼                                         ▼
┌─────────────────────┐                 ┌─────────────────────┐
│   HISTORIE-FLATE     │   Kart →        │     KART-FLATE       │
│  video/foto+karaoke  │ ──────────────► │  fullskjerm 3D-kart  │
│  (R3: ingen kart     │                 │  + pins              │
│   under narrasjon)   │ ◄────────────── │  [✕] + ← Tilbake     │
│                      │   ← Tilbake     │  (R14: 2 veier ut)   │
│  ── VO ferdig ──┐    │                 │  ⚙ FAB → popover     │
│  R8: kart-glimt │    │                 │  (R11)               │
│  glir opp ──────┘    │                 │  kart interaktivt    │
│   ├ ignorer → auto-  │                 │  (R13)               │
│   │  advance (R9)    │                 └──────────┬──────────┘
│   └ tapp → kart-flate│                            │
└──────────┬───────────┘                            │
           │                                         │
           └──────────  TRANSPORT (R4–R6)  ──────────┘
              ⏸  ▕▓▓▓│▓▓░│░░░│░░▏  2/6   [Kart→ / ←Tilbake]
              persistent på begge flater; segmenter tappbare (R5)
```

## Success Criteria

- SC1. Ingen tilstand uten synlig vei ut — lock-bugen borte, **oppsummering inkludert** (R14).
- SC2. Kart-glimt/teaser er ikke pan/zoom-bar; kun «trykk for å åpne» (R8, R13).
- SC3. Én åpne-kart-CTA — ingen dobbel pill (R6, R16).
- SC4. Mobil har en alltid-tilgjengelig avspillings-/posisjons-indikator: pause + hvor-er-jeg + hopp (R4, R5).
- SC5. Kart-mode-kontrollene er progressivt avslørt, ikke alltid utbrettet (R11).
- SC6. «Swipe opp for neste» funker som lovet eller er fjernet — ingen løgn-affordanse (R15).
- SC7. Verifisert på faktisk mobil-emulering (Chrome devtools iPhone), ikke bare kode-lesing.

## Scope Boundaries

- Desktop-layouten (`DesktopStorySidebar` + permanent kart, ≥1024 px) **endres ikke** — kun mobil (<1024 px).
- Event-board sin `EventMobileSheet` (event-modus) er en **separat flate** og berøres ikke i denne runden.
- Ingen re-opptak eller re-generering av audio, manus eller editorial-innhold.
- Ingen endring i map-engine-arkitekturen — persistent 3D (`gmp-map-3d`) + 2D-overlay-mønsteret beholdes (3D unmountes aldri).
- `audioTourEnabled` forblir et dødt flagg; gating er fortsatt spillbar-lyd-tilstedeværelse.

### Deferred to Separate Tasks

- Eventuell tilsvarende rebygging av event-board sin mobil-sheet vurderes separat hvis/ når event-sporet reaktiveres (peker: event-board-foundation-arbeidet).

## Key Decisions

- **To flater i stedet for fire snap-states**: separerer historie fra kart. Den muddy mellomtingen (quarter/half) var rot til funn #1/#4/#5.
- **Flate-koblede (ikke beat-koblede) exit-affordanser**: oppløser lock-bugen (#7) by design i stedet for å lappe symptomet.
- **Progress-gated teaser (hybrid)** valgt fremfor alltid-på peek ELLER ren knapp: kartet inviterer seg selv inn ved kapittel-slutt → ikke «for mye kart» under narrasjon, men bevarer teaser→ignorer/åpne-flyten som funket i dag.
- **Auto-advance fortsetter ved ignorering**: passiv lean-back, samme ånd som dagens opplevelse («la det spille ferdig»).
- **Kart-glimt (ikke bare fremhevet knapp)**: sterkere invitasjon. Akseptabelt mot «kartet vises for mye»-bekymringen *fordi* glimtet er timet (kun ved kapittel-slutt) og ikke-interaktivt.
- **⚙ FAB → popover** for kart-kontroller: maksimal «hide behind UI» per funn #1.
- **Tappbare progress-segmenter** (ikke dots/thumbnails): slankest mulig posisjons/hopp-affordanse, gjenbruker desktop sin notch-logikk 1:1.

## Dependencies / Assumptions

- `StoryProgressBar` (`components/variants/report/reels/DesktopStorySidebar.tsx:477-577`) er gjenbrukbar på mobil — **verifisert**: henter alt fra `useAudioElement()` + `useAudioTourStore`, har rAF-ekstrapolering + kapittel-notches innebygd, og har ingen desktop-spesifikke avhengigheter.
- Det finnes allerede et kapittel-slutt-«pust» (audio pauset, `currentTime=0` før `trackIndex` avanserer) — **verifisert** i `StoryProgressBar`-komponentdoc. Teaseren (R8) bor naturlig i dette vinduet.
- `onDragTakeover` (`components/variants/report/board/BoardMap3D.tsx`) finnes for Auto→Fri — **verifisert**.
- Hoved-implementasjonsflate: `components/variants/report/reels/ReportReelsPage.tsx` (`MapLayer` linje 630-802, `ResponsiveLayoutInner` linje 419-616) og `reels-state.tsx` (fase-enum).

**Korreksjoner fra review-runde 1 (verifisert mot kode):**
- `StoryProgressBar` er i dag **ikke eksportert** (module-private i `DesktopStorySidebar.tsx`) — må ekstraheres til delt modul. Fyll/notch-**renderingen** gjenbrukes; notchene er dekorative `<span aria-hidden>` uten klikk-soner, så **tappbare hit-zones + `goToTrack`-wiring (R5) er nytt arbeid**, ikke 1:1-gjenbruk.
- Kapittel-advance på mobil drives i dag av `ReelsStack` sin `IntersectionObserver` (scroll-snap → `setActiveIndex`). Når swipe-modellen fjernes (R15) **må noe annet eie `setActiveIndex`** — transport-segment-tap + auto-advance-timer. (Plan-fasen avgjør om `ReelsStack` beholdes skjult eller erstattes.)
- `cardIndex ↔ audioIndex`-mapping finnes (`cardIndexToAudioIndex` / `audioIndexToCardIndex`) og brukes alt av desktop-thumbnail-flyten → segment-tap (R5) gjenbruker den ruten.
- **Ingen `GestureHandling.NONE`** i `@vis.gl/react-google-maps` (kun AUTO/COOPERATIVE/GREEDY) → ikke-interaktiv 3D krever pointer-events-skjold (R13).
- Persistent `gmp-map-3d`: **kun én instans** (unmountes aldri, kan ikke ha to) → teaser-glimt (R8) = samme instans avslørt.
- `n/total`-teller er fjernet fra desktop-footer; nytt (men trivielt) på mobil via `trackIndex`/`tracks.length`.

## Outstanding Questions

### Resolve Before Planning
*(ingen — alle produkt-beslutninger er landet)*

### Deferred to Planning
- [Affects R1/R2/R15][Technical] Hva eier `setActiveIndex` når `ReelsStack` sin scroll-snap-`IntersectionObserver` fjernes/repurposes? Behold `ReelsStack` (skjult) eller erstatt? Transport-segment-tap + auto-advance-timer blir eneste drivere.
- [Affects R1/R2][Technical] Kollapse/erstatte `ReelsPhase`-enumet til avledet surface-tilstand; integrasjon med `defaultPhaseForCard` + `setActiveIndex`-reducer (forvent å skrive om `MapLayer` i sin helhet, ikke patche).
- [Affects R4/R8][Technical] Hvor bor transport- + teaser-state? Egen delt komponent over begge flater. `StoryProgressBar` ekstraheres til delt modul.
- [Affects R8/R9][Technical] Eksakt teaser-vindu-varighet + advance-timer-design (ny timet advance på kategori-beats; hvordan kanselleres ved kart-entry).
- [Affects R11][Needs research] ⚙ FAB-popover-plassering må klare Google-attribusjon (bunn-venstre) + Mapbox-attribusjon (bunn-høyre); `BoardMapControls` dokumenterer bunn-midt som trygg sone.

### Resolved in review-runde 1
- Teaser-mekanisme (R8/R13): **avgjort** — samme persistente `gmp-map-3d` avslørt + pointer-events-skjold for ikke-interaktivitet (ikke nr. 2-instans, ikke `GestureHandling.NONE`).
- Segment-hopp-plumbing (R5): **bekreftet finnes** (`cardIndex ↔ audioIndex`).
- Edge-cases (no-audio, iOS-unlock, summary/megler, ingen-3D-addon, kart-tilstander, backgrounding/error): **landet** som R17–R22.

## Next Steps
-> /ce-plan for strukturert implementasjonsplanlegging
