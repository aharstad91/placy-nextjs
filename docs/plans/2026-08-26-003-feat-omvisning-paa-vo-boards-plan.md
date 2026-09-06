---
title: "feat: Omvisningen på boards med voice-over"
type: feat
status: active
date: 2026-08-26
origin: docs/brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md
---

# feat: Omvisningen på boards med voice-over

## Overview

Andreas' krav er at omvisningen finnes på **alle** boards, hver gang. `docs/plans/2026-08-26-002-feat-omvisning-i-nabolagsflaten-plan.md` bygger den for boards uten voice-over. Denne planen gir den rekkevidde til de tre som har lyd: `broset-utvikling-as_wesselslokka`, `grilstad-marina_byggetrinn-4` og `bane-nor-eiendom_stasjonskvartalet`. Alle tre har også 3D-tillegg.

Det er skilt ut som egen plan fordi gjennomgangen av 002 falsifiserte beskrivelsen «et avgrenset monteringsvalg». Nabolagsflaten monteres i dag bak `neighbourhoodSurface = !hasAudioMobile && boardRevealed`, og `hasAudioMobile` bærer minst fire andre avledninger i samme fil. Filens egen kommentar sier at koden er skrevet på premisset at de to grenene aldri er sanne samtidig. Å utvide rekkevidden bryter det premisset, og det er sitt eget arbeid — ikke en åttende enhet i en annen plan.

## Problem Frame

På et VO-board er reels-opplevelsen i dag hele mobilflaten: `ReelSwipeStack` fyller skjermen, kartet er ikke-interaktivt med mindre brukeren åpner det, og en «peek»-tilstand viser kartet delvis under et kategori-beat. Nabolagsflaten finnes ikke der i det hele tatt.

Omvisningen skal inn ved siden av dette uten å ødelegge reels-opplevelsen, som er det disse tre kundene faktisk har betalt for.

Antakelsen bak arbeidet, tatt på Andreas' vegne og ikke bekreftet i ord: **omvisningen er standard-inngang også på VO-boards, og lyden blir senere et lag INNI stoppene, ikke en parallell knapp.** Snus antakelsen, faller hele denne planen bort uten at 002 må skrives om. Det er hele grunnen til at den er skilt ut.

## Requirements Trace

- **R1.** Inngangen til omvisningen skal finnes på mobil på boards med voice-over.
- **R2.** Reels-opplevelsen på de tre boardene skal være uendret når omvisningen ikke er startet.
- **R3.** Reels-flaten og omvisningen skal aldri kreve skjermen samtidig. Én av dem eier mobilflaten om gangen.
- **R4.** Kartet under omvisningen skal være interaktivt — det er en del av omvisningen at brukeren kan dra i det.
- **R5.** Å starte omvisningen skal verken starte eller stoppe lyd.
- **R6.** Omvisningens kamera-ramming skal vinne over den automatiske tour-rammingen mens omvisningen står, og tour-rammingen skal gjelde igjen etterpå.
- **R7.** Verifisert på `grilstad-marina_byggetrinn-4` — voice-over OG 3D-tillegg, altså den mest sammensatte kombinasjonen vi har.

## Scope Boundaries

- **Fletting av lyd inn i stoppene.** Denne planen gir omvisningen plass på VO-boards. Å la stoppene spille kategoriens lyd er et eget produktvalg som ikke er tatt.
- **Å fjerne `hasAudioMobile`-forken helt.** `docs/plans/2026-08-06-001-feat-story-flate-separasjon-plan-A.md` ville gjort nabolagsflaten til universell mobilstandard med reels som frivillig overlegg. Den planen ble aldri gjennomført. Den er fortsatt riktig retning, men er en større omskriving enn dette.
- **Desktop.** Se 002.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/reels/ReportReelsPage.tsx` (~linje 896–979, 1082, 1090) — de koblede avledningene:
  - `hasAudioMobile` — finnes det et lyd-beat i det hele tatt
  - `mapIsSurface = state.mapOpen || !hasAudioMobile` — styrer kartets `interactive`-prop
  - `peekActive` / `peekExpanded` — kartet delvis synlig under et kategori-beat
  - `mapStyle` — en stor beregnet stil-gren nøklet på `mapIsSurface`/`peekActive`
  - `neighbourhoodSurface = !hasAudioMobile && boardRevealed` — monteringen av nabolagsflaten
  - render-gaten `{!mapIsSurface && <ReelSwipeStack …/>}`
  Kommentaren rundt linje 901 sier eksplisitt at betingelsen er additiv fordi de to grenene aldri er sanne samtidig.
- `components/variants/report/board/BoardMap.tsx` (~linje 569–572) — `useEffect` som fitter kameraet til HELE den aktive kategorien hver gang `activeCategoryId` endres mens `tourActive` er sann. Omvisningens egen `SELECT_CATEGORY`-dispatch vil trigge denne, samtidig med omvisningens egen ramming. To konkurrerende kamerabevegelser på samme dispatch.
- `lib/stores/audio-tour-store.ts` — `tourActive` avledes herfra.

## Key Technical Decisions

- **Én eier av mobilflaten om gangen.** Omvisningen og reels-stacken skal ikke stables. Den enkleste tilstanden som uttrykker det er den samme som allerede finnes: mens omvisningen står, oppfører flaten seg som om kartet er åpnet.
- **Tour-fitten må vike, ikke slås av.** `tourActive`-effekten er riktig når lyden guider. Den skal undertrykkes mens omvisningen eier kameraet, og gjelde igjen etterpå — ikke fjernes.
- **Ingen endring i lydtilstand.** Omvisningen rører hverken avspilling eller `audioUnlocked`. Starter brukeren omvisningen mens lyd spiller, er det et produktvalg vi ikke tar her; R5 sier bare at koden ikke skal gjøre det av seg selv.

## Open Questions

### Deferred to Implementation

- **Hva som skjer med et pågående lyd-beat når omvisningen startes.** R5 sier at koden ikke skal starte eller stoppe lyd. Om brukeren bør kunne ha begge i gang samtidig er et produktspørsmål Andreas må svare på når han har kjent på det.

## Implementation Units

- [ ] **Unit 1: Kartleggingen av de koblede grenene**

**Goal:** Vite nøyaktig hva som henger på `hasAudioMobile` før noe endres.

**Requirements:** R2, R3, R4

**Dependencies:** 002 Unit 2 (inngangskortet finnes)

**Files:**
- Test: `components/variants/report/reels/__tests__/` (karakteriserings-tester)

**Approach:**
- Fest dagens oppførsel på et VO-board i tester FØR forken røres: hva rendres, hva er kartet, hvilke stil-grener er aktive, i hver kombinasjon av `mapOpen`, `peekActive` og `boardRevealed`.
- Dette er nettet under Unit 2. Uten det er «reels-opplevelsen er uendret» (R2) en påstand og ikke en måling.

**Execution note:** Karakteriser først. Dette er hele enhetens formål.

**Test scenarios:**
- Happy path: VO-board, lyd ikke låst opp → dagens flate, festet.
- Happy path: VO-board, kategori-beat, kart lukket → `peekActive`, festet.
- Happy path: VO-board, kart åpnet → `mapIsSurface`, reels-stacken skjult, festet.
- Edge case: board uten lyd → nabolagsflaten, uendret av alt dette.

**Verification:**
- Testene passerer mot dagens kode, uten at noen produksjonsfil er endret.

---

- [ ] **Unit 2: Omvisningen som eier av mobilflaten**

**Goal:** Inngangen finnes på VO-boards, og de to flatene krever aldri skjermen samtidig.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `components/variants/report/reels/ReportReelsPage.tsx`
- Test: `components/variants/report/reels/__tests__/`

**Approach:**
- Monter nabolagsflaten også når `hasAudioMobile` er sann, og reconcilier de fire koblede avledningene: kartets `interactive`-prop, `mapStyle`-grenen, `peekActive`, og render-gaten for `ReelSwipeStack`.
- Mens omvisningen står, skal reels-stacken ikke rendres og kartet skal være interaktivt.
- Ingen endring i lydtilstand (R5).
- Oppdater kommentaren rundt linje 901: premisset den beskriver — at grenene aldri er sanne samtidig — slutter å gjelde her, og en kommentar som lyver er verre enn ingen.

**Test scenarios:**
- Happy path: VO-board → inngangen til omvisningen finnes på mobil (R1).
- Happy path: VO-board, omvisning ikke startet → karakteriserings-testene fra Unit 1 passerer uendret (R2).
- Happy path: omvisning startet → reels-stacken rendres ikke, og kartet er interaktivt (R3, R4).
- Edge case: omvisningen avsluttes → reels-flaten er tilbake slik den var.
- Edge case: board uten lyd → uendret oppførsel.
- Integration: å starte omvisningen verken starter eller stopper lyd (R5).

**Verification:**
- Inngangen finnes på Grilstad Marina byggetrinn 4, og reels-opplevelsen der er uendret så lenge omvisningen ikke er startet.

---

- [ ] **Unit 3: Kameraet når to guider konkurrerer**

**Goal:** Omvisningens ramming vinner mens den står, og tour-rammingen gjelder igjen etterpå.

**Requirements:** R6

**Dependencies:** Unit 2

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx`
- Test: `components/variants/report/board/BoardMap.test.tsx`

**Approach:**
- `tourActive`-effekten fitter til HELE den aktive kategorien hver gang `activeCategoryId` endres. Omvisningens `SELECT_CATEGORY source: "walkthrough"` endrer nettopp den — så på et VO-board vil to rammer kjempe om kameraet på samme dispatch.
- Undertrykk tour-fitten mens omvisningen eier kameraet. Ikke fjern den: den er riktig når lyden guider.
- Kilden `"walkthrough"` finnes allerede i `board-state` fra 002 og er den naturlige diskriminatoren.

**Execution note:** Verifiser i en ekte 3D-scene på et VO-board. Alle tre VO-boardene har 3D-tillegg, og `stasjonskvartalet` har i tillegg en håndautorert kameratur — den mest sammensatte kombinasjonen i datasettet.

**Test scenarios:**
- Happy path: omvisning aktiv på VO-board, stoppbytte → én kamerabevegelse, mot stoppets steder.
- Happy path: omvisning ikke aktiv, kategoribytte under tour → tour-fitten oppfører seg som før.
- Edge case: omvisningen avsluttes mens lyd spiller → tour-fitten gjelder igjen.
- Integration: hurtig stoppbytte etterlater ikke to konkurrerende bevegelser.

**Verification:**
- Kameraet flytter seg én gang per stopp på et VO-board, til stoppets steder og ikke til kategoriens senter.

---

- [ ] **Unit 4: Menneske-gaten på et VO-board**

**Goal:** De to opplevelsene lever side om side uten å slåss.

**Requirements:** R7

**Dependencies:** Unit 1–3

**Files:** ingen

**Approach:**

**⚠️ Denne enheten kan IKKE utføres av en agent.** Spørsmålet er ikke om koden rendrer riktig, men om et board med to guidede opplevelser leser som ett produkt eller som to som ble limt sammen.

Det Andreas skal kjenne etter på Grilstad Marina byggetrinn 4:

- Er det tydelig hva de to inngangene tilbyr, eller konkurrerer de om samme løfte?
- Skal omvisningen i det hele tatt være standard-inngang her, eller bør lyden være det på boards som har den?
- Hva forventer du skjer med lyden hvis du starter omvisningen midt i et beat?

Svarene avgjør om antakelsen bak denne planen holder, eller om den skal snus.

**Test expectation:** none — dette er en produktvurdering.

**Verification:**
- Andreas har kjent på begge inngangene på samme board og sagt hvilken som skal være standard.

## System-Wide Impact

- **Interaction graph:** Endringene ligger i én fil for monteringen og én for kameraet, men de påvirker hele mobilflaten på tre produksjons-boards med betalende kunder.
- **State lifecycle risks:** `mapOpen` er i dag reels-logikkens eiendom. Lar omvisningen den bety to ting, må utgangen rydde like nøye som inngangen.
- **Unchanged invariants:** Ingen endring i lydtilstand, i `audioUnlocked`, i reels-datamodellen eller i beat-kontrakten.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Reels-opplevelsen degraderes på boards kunder har betalt for | Unit 1 fester dagens oppførsel i tester før noe røres; R2 er målbar og ikke en påstand |
| Omvisningen og reels-stacken rendres samtidig | R3 har eget testscenario, og Unit 1 dekker kombinasjonene som kan gi det |
| To kamerabevegelser på samme dispatch | Unit 3 er en egen enhet nettopp fordi dette ikke synes i en enhetstest |
| Antakelsen om at omvisningen skal være standard-inngang viser seg feil | Hele planen er isolert fra 002 og kan forkastes i sin helhet. Unit 4 er der for å avgjøre det |

## Sources & References

- **Origin document:** `docs/brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md`
- **Forutsetter:** `docs/plans/2026-08-26-002-feat-omvisning-i-nabolagsflaten-plan.md`
- **Samme fork, større omskriving:** `docs/plans/2026-08-06-001-feat-story-flate-separasjon-plan-A.md`
