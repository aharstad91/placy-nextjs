---
title: "feat: Reisemåte som enhet over minutt-kolonnen, og sheeten helt fluid"
type: feat
status: active
date: 2026-08-26
origin: docs/brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md
deepened: 2026-08-26
---

# feat: Reisemåte som enhet over minutt-kolonnen, og sheeten helt fluid

## Overview

To forbedringer fra prototype-arbeidet 2026-08-25/26 inn i det ekte boardet.

Lista i nabolagsflaten sier «3 min» uten å si 3 min *med hva*. Reisemåte finnes som kontroll, men bare på kartet og på chipen ved ruta — mens tallene leses i sheeten. Første leveranse setter velgeren der tallene står, som en enhet på kolonnen.

Sheet-gesten snapper de siste 44 pikslene mot hvert ytterpunkt. Andreas testet på telefon og avviste det: *«når jeg slipper scrollen, så snapper den litt, som om den finner tilbake til et punkt den vil være på. det er ikke ønsket oppførsel, sheeten bør være 100 % fluid.»* Andre leveranse tar magneten ut.

Begge skal verifiseres på **Strindfjordvegen 10** (Grilstad-demoen) — samme board prototypen kjører på, så de to flatene kan sammenlignes direkte.

## Problem Frame

Prototypen ble portet FRA produksjon (`prototypes/README.md` navngir kildefilene, og CSS-kommentarene navngir Tailwind-klassen hver regel kom fra). Kartet går derfor begge veier: vi porter ikke prototypen, vi porter diffen.

Av gårsdagens arbeid er dette de to endringene som kan gå uten at noen først tar et produktvalg. Alt som bare finnes inne i fortellingsmodusen venter på en dom over `prototypes/04-fortelling-i-boardet/` (se origin: `docs/brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md`).

## Requirements Trace

### Reisemåte-kontroll (R1–R3)

- **R1.** Leseren skal kunne se hvilken reisemåte tallene i lista gjelder, uten å lete på kartet.
- **R2.** Leseren skal kunne bytte reisemåte fra der tallene står, og se tallene endre seg uten at hun mister plassen sin: sheeten skal ikke flytte seg, ingen kategori skal lukkes, og ingen ny flate skal åpne seg. *Selve lista reordner seg — se Key Technical Decisions.*
- **R3.** Kontrollen skal bruke `TravelModeSelector` som delt komponent, så inngangene til samme tilstand ikke kan drifte fra hverandre. Endringer i den komponenten skal gjelde alle kallstedene likt.

### Sheet-gest (R4–R5)

- **R4.** Etter et slipp skal sheeten stå der utrullingen dør — ingen korreksjon mot et ytterpunkt.
- **R5.** Tappet på handlen skal fortsatt være en ikke-gestuell vei mellom ytterpunktene (`prototypes/README.md`: «Ingen gesture skal være eneste vei til noe»).

### Verifisering (R6)

- **R6.** Begge endringene skal være verifisert på `/eiendom/megler-harstad/strindfjordvegen-10-7053-ranheim-norge` — maskinelt i Unit 5, og på fysisk telefon av Andreas i Unit 6.

## Scope Boundaries

- **Fortellingsmodusen** — kategori-navbaren i dekket, spørsmålet som overskrift, faneraden, det kuraterte utvalget per stopp. Venter på en dom over `04`, som er et produktvalg og ikke et teknisk et.
- **Handlen uten strek og bakgrunn** — i produksjon bærer handlen tittelen («I nærheten»), og den kan ikke tømmes uten at noe annet overtar jobben med å si hvor du er.
- **Spørsmålet som fastlimt header** — dette er ikke en produksjonsforbedring. Produksjonens grab-knapp ligger `shrink-0` UTENFOR scroll-containeren, så tittelen kan aldri scrolle bort. Buggen oppsto av prototypens ene-scroller og hører til den.
- **Tappets logikk på handlen** — den hopper i dag til ytterpunktet man IKKE står nærmest. Om den heller burde hoppe dit bevegelsen pekte er et produktvalg. Se Open Questions.
- **Kart-veksleren i prototypen** — `sat` og `3d` kjører på Googles motor (`gmp-map-3d`), ikke Mapbox. En falsk 3D ville testet en flate som ikke finnes.
- **Prototype-stillaset** — board-velgeren, Tett/Fortelling, Megler/Nærmest, galleri-lenka. Merket `AVVIK`, hører kun hjemme i prototypen.

### Deferred to Separate Tasks

- **Sheeten som ÉN scroller** (origin-dokumentets Fase 2): bytter mekanisme i `NeighbourhoodSheet.tsx` fra animert `height` til `scrollTop`. Egen plan når denne er verifisert i produksjon. Enheten som fjerner magneten her arves av den.
- **Per-modus forhåndsvisning av tider i panelet**: se Key Technical Decisions. Tas opp igjen når radene blir utvidbare (`NeighbourhoodCategoryCard.tsx` sin doc-kommentar viser til en «Unit 6» med utvidbar rad), for da finnes det et åpent sted å vise tider for.
- **Notatet til `docs/solutions/`** om gest-følelse på telefon vs. desktop: egen commit etter Unit 6, utenfor de seks enhetene her. Se Documentation / Operational Notes.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/TravelModeSelector.tsx` — delt komponent med to varianter: `segment` (ikon-rad, kart-kontrollen) og `panel` (alle modusene med tid). Doc-blokken sier eksplisitt hvorfor det er én komponent og ikke to: «rekkefølgen, etikettene, ikonene, aria-tekstene og regelen for utilgjengelig data må være identiske på de to flatene».
- `components/variants/report/board/BoardPathMidpointMarker.tsx` — **mønsteret for kollapset trigger + panel.** Har `pointerdown`-lytter i capture som lukker ved klikk utenfor, OG en `useEffect` som nullstiller `open` ved navigasjon (`state.activePOIId`, `state.phase`). Begge deler skal speiles.
- `components/variants/report/board/BoardTravelChip3D.tsx` — **eget dispatch-sted** for `SET_TRAVEL_MODE` (linje ~137), parallelt med 2D-chipen. Deler innhold via `use-travel-chip.ts`.
- `components/variants/report/board/board-state.tsx` — `SET_TRAVEL_MODE` (linje ~232), `useAvailableTravelModes()` (linje ~451). Modus bæres videre og nullstilles aldri ved navigasjon (linje ~164).
- `lib/board/neighbourhood-list.ts` — `NeighbourhoodRow` har `{ poi, minutes? }`. `minutes` regnes for AKTIV modus av `buildNeighbourhoodList`. **`minMinutes` er modus-avledet, og kategori-sorteringen leser den** — et modusbytte reordner altså kategoriene, og `diversifyBySubCategory` kan bytte ut hvilke steder som vises i topp-3.
- `components/variants/report/board/neighbourhood/use-neighbourhood-list.ts` (linje ~22–44) — **mønsteret for å koble travelMode til lista**: `state.travelMode` sendes inn og står i `useMemo`-dependencies. Sheet-lista gjør dette riktig i dag; kategorisiden gjør det ikke.
- `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx` — `NeighbourhoodList` stabler kategorikortene inne i `NeighbourhoodSheet`.
- `components/variants/report/board/neighbourhood/CategoryPage.tsx` — `header` (linje ~153) gjenbrukes i to grener, montert på linje ~203 og ~207.

### Institutional Learnings

- `unified-poi-carousel-report-20260420` — `touch-action: none` skal ALDRI settes på scroll-containeren, kun på gripeflaten. Refereres allerede i `NeighbourhoodSheet.tsx` og gjelder uendret.
- `apple-style-slide-up-modal-with-backdrop-blur-20260415` — kilden til `SNAP_EASING`. Easingen beholdes; det er magnetismen som fjernes, ikke bevegelseskurven.
- `report-poi-sorting-clustered-first-load-20260304` — hvorfor `diversifyBySubCategory` finnes. Relevant fordi et modusbytte kjører den på nytt.

### Planning-time corrections to the origin document

Origin-dokumentet pekte 1.1 mot `NeighbourhoodCategoryCard.tsx`. Lesing av fila viser at det er feil monteringspunkt: kortet har ingen overskriftsrad over minutt-kolonnen, og sheeten stabler ett kort PER KATEGORI. En kontroll i kortet ville gitt seks kontroller på skjermen samtidig.

Riktige monteringspunkter er derfor:
- **Sheeten:** én kontroll over hele lista, i `NeighbourhoodSurface.tsx`.
- **Kategorisiden:** i sidens egen overskriftsrad, i `CategoryPage.tsx`.

`NeighbourhoodCategoryCard.tsx` endres ikke.

## Key Technical Decisions

- **Den nye kontrollen er den FJERDE inngangen til `SET_TRAVEL_MODE`, ikke den tredje.** Produksjonen har allerede tre: kart-kontrollen (`BoardMapControls`), 2D-chipen (`BoardPathMidpointMarker`) og 3D-chipen (`BoardTravelChip3D`). «Chipen på ruta» er i realiteten to komponenter, én per kart-motor. Alle fire beholdes. *Antakelse tatt på Andreas' vegne — han hadde lagt seg da spørsmålet oppsto, og alternativet (å fjerne en eksisterende inngang) ville vært en større endring enn den bestilte.*
- **3D er default kart-motor i rapport-boardet**, så 3D-chipen er sannsynligvis den som faktisk vises på Strindfjordvegen-demoen. Drift-verifiseringen må derfor teste mot chipen, ikke bare mot kart-pillen.
- **Panelet viser modusnavn uten tider i denne omgangen.** Prototypens panel viser tre tider fordi fortellingsmodusen har et ÅPENT sted — ett A→B-par. Produksjonens liste har ikke det: radene i `NeighbourhoodCategoryCard` og `CategoryPage` er **helt ikke-interaktive i Fase 1** (filas egen doc-kommentar: «Radene er ikke-interaktive i Fase 1; utvidbar rad kommer i Unit 6»). Det finnes altså ikke noe sted å hente et A→B-par fra. Å finne på et tall er ny produktatferd som ikke er ratifisert i brainstormen.
- **Panelets fottekst gjøres betinget.** `TravelModeSelector variant="panel"` rendrer i dag alltid «Alle tider er omtrentlige». Uten `minutesByMode` ville panelet vist «–» tre ganger og deretter påstått at tidene er omtrentlige — hver eneste gang det åpnes. Fotteksten gjøres derfor betinget på at `minutesByMode` faktisk er satt. Dette rører den delte komponenten med vilje: R3 krever delt oppførsel, ikke en frossen fil, og endringen forbedrer alle kallsteder likt.
- **Et modusbytte reordner lista, og det er tilsiktet eksisterende oppførsel.** `minMinutes` er modus-avledet og styrer kategori-sorteringen, så bytte til bil kan flytte kategorikort og bytte ut hvilke steder som står i topp-3. Nytt her er at utløseren nå ligger INNE i lista den reordner, mens de tre eksisterende inngangene ligger utenfor. R2 er formulert deretter: sheeten skal ikke flytte seg og ingen kategori skal lukkes — men innholdet reordner seg, og det skal det.
- **Kontrollen er én delt komponent, ikke to monteringer av samme JSX.** Samme begrunnelse som `TravelModeSelector` selv bærer: to kopier drifter.
- **`MOMENTUM_PROJECTION_MS` beholdes.** Det er utrullingen — at flaten lander der bevegelsen pekte og ikke der fingeren tilfeldigvis slapp. Magneten er noe annet: at flaten flytter seg EN GANG TIL etter at utrullingen er over.
- **Kontrollen skjules når lista er tom.** `neighbourhood-empty` rendres i stedet for kortene, og en enhet uten tall å merke er en død kontroll. *Antakelse tatt på Andreas' vegne.*

## Open Questions

### Resolved During Planning

- **Hvor hører kontrollen hjemme i sheeten?** Over hele lista, ikke i hvert kategorikort — se planning-time corrections.
- **Skal panelet vise tider?** Nei i denne omgangen, og fotteksten gjøres betinget så panelet ikke motsier seg selv.
- **Skal en av de eksisterende inngangene vike?** Nei, alle fire beholdes.
- **Skal kontrollen vises når lista er tom?** Nei, den skjules.

### Deferred to Implementation

- **Nøyaktig innrykk over minutt-kolonnen.** Prototypens 22 px er avledet av dens egen radgeometri. Produksjonens rader har annen geometri (`gap-3`, ingen chevron i sheet-lista) og må måles der.

### Deferred to a Later Decision

- **Bør tappet på handlen hoppe dit bevegelsen pekte, i stedet for til ytterpunktet man ikke står nærmest?** I dag er tappet en ren toggle om midtpunktet. Står du i en fri posisjon som allerede er under midtpunktet og vil helt ned, sender ett tapp deg til motsatt ytterpunkt. Det er akseptabelt i dag, men tappet blir en viktigere vei når draget er helt fluid. Produktvalg, ikke et teknisk et — tas opp med Andreas, ikke avgjort her.

## Implementation Units

- [x] **Unit 1: Betinget fottekst i `TravelModeSelector`**

**Goal:** Panelet påstår ikke at tider er omtrentlige når det ikke viser tider.

**Requirements:** R3

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/TravelModeSelector.tsx`
- Test: `components/variants/report/board/TravelModeSelector.test.tsx`

**Approach:**
- Fotteksten «Alle tider er omtrentlige» rendres kun når `minutesByMode` er satt.
- Eksisterende kallsteder (`BoardPathMidpointMarker`, `BoardTravelChip3D`) sender alltid `minutesByMode`, så de er uendret i praksis. Verifiser det før endringen — hvis et av dem IKKE sender den, er dagens fottekst allerede feil der, og det er en bug denne enheten også fikser.

**Execution note:** Skriv testen for det nye tilfellet (ingen `minutesByMode` → ingen fottekst) først.

**Test scenarios:**
- Happy path: `minutesByMode` satt → fotteksten rendres som før
- Happy path: `minutesByMode` utelatt → ingen fottekst, og ingen tom `<p>` eller overflødig skillelinje står igjen
- Edge case: `minutesByMode` satt, men tom for alle moduser → fotteksten rendres (kallstedet har lovet tider, selv om ingen finnes)
- Integration: `variant="segment"` er uberørt av endringen

**Verification:**
- Chipen på ruta og 3D-chipen ser identiske ut som før

---

- [x] **Unit 2: Delt kontroll for reisemåte i en listeoverskrift**

**Goal:** Én komponent som viser aktiv reisemåte kollapset og folder ut `TravelModeSelector variant="panel"` nedover.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1

**Files:**
- Create: `components/variants/report/board/neighbourhood/TravelModeHeaderControl.tsx`
- Test: `components/variants/report/board/neighbourhood/TravelModeHeaderControl.test.tsx`

**Approach:**
- Kollapset: aktiv modus' ikon (`TRAVEL_MODE_ICONS`, eksportert fra `TravelModeSelector.tsx`), etiketten, og en chevron som roterer ved åpning.
- Utvidet: `TravelModeSelector variant="panel"` uten `minutesByMode`, absolutt posisjonert under triggeren, høyrestilt.
- Foldretningen er FAST nedover. `BoardPathMidpointMarker` måler retning ved åpning fordi chipen kan ligge hvor som helst i viewporten; denne står i en overskriftsrad øverst i flaten sin.
- Rendrer `null` når `useAvailableTravelModes()` gir færre enn to modus. Én modus er ikke et valg — samme null-modus-regel som `TravelModeSelector` selv håndhever.
- Bytte dispatcher `SET_TRAVEL_MODE` og lukker panelet. Ingen annen tilstand røres.
- **To lukkeveier, begge speilet fra `BoardPathMidpointMarker`:** `pointerdown`-lytter i capture-fasen for klikk utenfor, OG en `useEffect` som setter `open: false` ved navigasjon (`state.activePOIId`, `state.phase`). Uten den andre blir panelet stående over innhold det ikke lenger hører til.

**Patterns to follow:**
- `components/variants/report/board/BoardPathMidpointMarker.tsx` — trigger, panel, klikk-utenfor, navigasjons-reset, chevron-rotasjon
- `components/variants/report/board/TravelModeSelector.tsx` — «én komponent, ikke to»-prinsippet

**Test scenarios:**
- Happy path: to eller flere tilgjengelige modus → triggeren viser aktiv modus' etikett og ikon
- Happy path: trykk på triggeren → panelet vises med alle tilgjengelige modus, aktiv markert med `aria-pressed="true"`
- Happy path: trykk på en annen modus → `SET_TRAVEL_MODE` dispatches med den modusen, og panelet lukkes
- Edge case: kun én tilgjengelig modus → komponenten rendrer ingenting
- Edge case: trykk på ALLEREDE aktiv modus → panelet lukkes, ingen tilstandsendring lekker ut
- Error path: `pointerdown` utenfor komponenten mens panelet er åpent → panelet lukkes og modus er uendret
- Error path: navigasjon (endret `activePOIId` eller `phase`) mens panelet er åpent → panelet lukkes
- Integration: panelet får ingen `minutesByMode`, så hver rad viser «–» og ingen fottekst rendres (avhenger av Unit 1)

**Verification:**
- Komponenten kan monteres uten kart og uten rutedata
- Ingen ny tilstand i `board-state.tsx`

---

- [x] **Unit 3: Monter kontrollen over lista i sheeten, og rett hintet**

**Goal:** Kontrollen står én gang over kategorikortene, og hint-teksten slutter å påstå gangtid uansett modus.

**Requirements:** R1, R2

**Dependencies:** Unit 2

**Files:**
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx`
- Test: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.test.tsx`

**Approach:**
- Kontrollen monteres i `NeighbourhoodList`, over kategorikortene og under hintet, **høyrestilt** så den lander over minutt-kolonnen i radene under.
- Kontrollen skjules når lista er tom (`neighbourhood-empty`-grenen).
- **Hintet er feil i dag.** `neighbourhood-hint` sier «lista viser stedene i utsnittet, med gangtid hjemmefra» — hardkodet «gangtid», mens `travelMode` kan være sykkel eller bil. Samme defekt-klasse som hele denne leveransen handler om: flaten påstår en reisemåte i prosa mens tilstanden kan være en annen. Teksten gjøres modus-avhengig via `travelModeLabels`, eller nøytral hvis det leser bedre.
- Ingen endring i `NeighbourhoodCategoryCard.tsx`.

**Patterns to follow:**
- `lib/utils.ts` — `travelModeLabels` for etikettene
- Eksisterende plassering av `neighbourhood-hint` i samme fil

**Test scenarios:**
- Happy path: sheeten rendrer nøyaktig ÉN reisemåte-kontroll, uansett hvor mange kategorikort lista har
- Happy path: bytte av modus via kontrollen oppdaterer minutt-tallene i kortene under
- Edge case: tom liste (`neighbourhood-empty`) → ingen kontroll rendres, og flaten kaster ikke
- Edge case: board med kun gangtider → ingen kontroll rendres, og hintet leser fortsatt riktig
- Integration: `travelMode` = `car` → hintet sier ikke «gangtid»
- Integration: modusbytte kan reordne kategorikortene (modus-avledet `minMinutes` styrer sorteringen) — sheetens høyde og åpne tilstand skal likevel stå uendret

**Verification:**
- Én kontroll på flaten, ikke én per kategori
- Hintet stemmer med aktiv modus i alle tre tilstander

---

- [x] **Unit 4: Monter kontrollen i kategorisidens overskriftsrad, og koble modus til tallene der**

**Goal:** Samme enhet over minutt-kolonnen når man har drillet inn — og tallene som faktisk endrer seg.

**Requirements:** R1, R2

**Dependencies:** Unit 2

**Files:**
- Modify: `components/variants/report/board/neighbourhood/CategoryPage.tsx`
- Test: `components/variants/report/board/neighbourhood/CategoryPage.test.tsx`

**Approach:**
- **`CategoryPage` leser ikke `state.travelMode` i dag.** Den destrukturerer kun `mapCamera, data, dispatch` fra `useBoard()` (linje ~60), og kaller `buildNeighbourhoodList` uten `travelMode` (linje ~68–74), så funksjonen faller tilbake på sin egen default `"walk"`. `useMemo`-dependencies er `[category]` alene. Uten denne koblingen ville kontrollen dispatche riktig mens `{row.minutes} min` og `categorySubline` sto stille. Legg til `state` i destruktureringen, send `travelMode: state.travelMode` inn, og legg den til i dependency-arrayet — **samme mønster som `use-neighbourhood-list.ts` linje ~22–44 alt bruker for sheet-lista.**
- `header` (linje ~153) gjenbrukes i to grener: kikk-tilstanden (`panel-peek-restore`, en `<button>`) og normal-tilstanden (en `div`). Kontrollen kan IKKE ligge inne i `header`, fordi kikk-grenen gjør hele stripa til én knapp — en knapp inni en knapp er ugyldig markup og ville stjålet gjenåpnings-trykket. Samme fallgruve som prototypen møtte med lukkeknappen i `.grab`.
- Kontrollen monteres derfor kun i normal-grenen (linje ~207), som søsken til `{header}`, **høyrestilt** (f.eks. `ml-auto`) så den lander over minutt-kolonnen — samme plassering som Unit 3.
- I kikk-tilstand er lista skjult, så det finnes ingen tall å merke — ingen kontroll er riktig der.

**Test scenarios:**
- Happy path: normal tilstand → kontrollen rendres høyrestilt i overskriftsraden
- Happy path: bytte av modus oppdaterer `{row.minutes} min` i `category-poi-list` **og** undertittelen fra `categorySubline`
- Edge case: kikk-tilstand (`peeked`) → ingen kontroll rendres, og `panel-peek-restore` er fortsatt ett trykk som gjenåpner
- Error path: modus uten data for denne kategorien → radene viser ingen tall, aldri «undefined min» (R26-regelen)
- Integration: ingen nøstede `<button>`-elementer i overskriftsraden i noen av de to grenene

**Verification:**
- Gjenåpning fra kikk-tilstand virker uendret
- Tallene på kategorisiden følger aktiv modus, ikke `"walk"`

---

- [x] **Unit 5: Ta magneten ut av sheet-gesten**

**Goal:** Etter slipp står sheeten der utrullingen dør.

**Requirements:** R4, R5

**Dependencies:** Ingen (uavhengig av Unit 1–4)

**Files:**
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSheet.tsx`
- Test: `components/variants/report/board/neighbourhood/NeighbourhoodSheet.test.tsx`

**Approach:**
- Fjern `SNAP_THRESHOLD_PX` og `toMin`/`toMax`-utregningen i `handlePointerUp`. Resultatet av `MOMENTUM_PROJECTION_MS`, klemt mellom `bounds.min` og `bounds.max`, er sluttposisjonen.
- **Doc-blokken må rettes i samme endring.** Avsnittet «Hvorfor sheeten hviler HVOR SOM HELST» sier i dag «Ytterpunktene er fortsatt magnetiske (`SNAP_THRESHOLD_PX`) — ellers blir "vis meg mest mulig kart" en presisjonsøvelse». Den begrunnelsen er nettopp den Andreas overprøvde på enhet: på telefon leses magneten ikke som at flaten rydder opp etter seg, men som at den overprøver deg. Erstatt med hvorfor den ble tatt ut, og hvor de to ytterpunktene lever videre.
- **Tappet på handlen røres ikke.**

**Execution note:** Snu de to eksisterende magnet-testene til den nye forventningen først, og se dem feile mot dagens kode. De to testene ER spesifikasjonen for denne enheten. **Kjør testen for å bekrefte de nye tallene — ikke stol på planteksten alene.**

**Test scenarios:**
- Happy path: dra 128 px opp til 400 → hviler på 400, `data-rest="free"` (uendret, må fortsatt passere)
- Happy path (invertert fra «går helt inn når slippet lander nær et ytterpunkt»): `drag(grab, 600, 200)` → hviler nå på **672**, ikke 688, og `data-rest` er **`"free"`**, ikke `"high"`
- Happy path (invertert fra «går helt ned når slippet lander nær bunnen»): testen kjeder et nytt drag oppå det forrige («opp til taket først»). Post-fix starter det andre draget fra **672**, ikke 688, så `drag(grab, 200, 590)` lander på `clamp(672 + (200 − 590), 272, 688)` = **282**, `data-rest="free"`. *Tallet 282 — ikke 298 — er konsekvensen av at det første draget ikke lenger snappes til taket. BEKREFTET ved kjøring 2026-08-26: testen feilet med «expected 272 to be 282» mot magnet-koden, og passerte etter fjerningen.*
- Edge case: slipp nøyaktig PÅ et ytterpunkt → `data-rest` er `"high"`/`"low"` som før, uten at magneten er involvert
- Edge case: kast som projiseres FORBI et ytterpunkt → klemmes til ytterpunktet av `clamp`, ikke av magneten
- Integration: tapp på handlen → hopper fortsatt helt til det ytterpunktet man ikke står nærmest (`TAP_SLOP_PX`-grenen er urørt)
- Integration: kastet bærer fortsatt sheeten forbi punktet der fingeren slapp (`MOMENTUM_PROJECTION_MS` beholdt)
- Integration: `onHeightChange` rapporterer fortsatt `bounds.min` og ikke gjeldende høyde, uendret av denne enheten

**Verification:**
- Ingen referanse til `SNAP_THRESHOLD_PX` igjen i fila
- Doc-blokken beskriver den faktiske oppførselen
- Hele `NeighbourhoodSheet.test.tsx` passerer

---

- [x] **Unit 6: Maskinell verifisering på Strindfjordvegen 10**

**Goal:** Alt som kan bekreftes uten en fysisk telefon, er bekreftet på demoen endringene er bestilt for.

**Requirements:** R6

**Dependencies:** Unit 3, Unit 4, Unit 5

**Files:** ingen nye filer — verifisering på ekte board

**Approach:**
- Rute: `/eiendom/megler-harstad/strindfjordvegen-10-7053-ranheim-norge`, mobil-bredde i browser.
- Sammenlign med prototypen på `prototypes/04-fortelling-i-boardet/` (`npm run proto`, port 4400), som kjører samme board-data.

**Test scenarios:**
- Happy path: åpne boardet, bytt til Bil i lista → alle minutt-tall i sheeten endrer seg, sheeten står stille, ingen kategori lukkes
- Happy path: drill inn i en kategori → kontrollen står i overskriftsraden, byttet virker der òg, og tallene følger
- Happy path: dra sheeten til en fri stilling og slipp → flaten blir stående, ingen etterkorreksjon (målt, ikke kjent på)
- Integration: bytt modus på **3D-chipen** (default kart-motor), åpne lista → kontrollen viser samme modus. Gjenta motsatt vei. Dette er drift-sjekken mot den inngangen demoen faktisk viser
- Integration: bytt modus på kart-pillen → samme sjekk
- Integration: konsollen er ren gjennom hele gjennomgangen

**Verification:**
- Alle scenariene over bekreftet i browser på ekte board
- Ingen console-feil eller -advarsler

**Resultat 2026-08-26** (390×844, `localhost:3002`, ekte board-data):
- Én kontroll over seks kategorikort, ikke én per kort. Kollapset «Til fots»
- Hintet sier «reisetid», ikke «gangtid»
- Panelet åpner uten tider OG uten fotteksten «Alle tider er omtrentlige»
- Bytte til Bil: tallene endret seg, kategoriene reordnet seg som modellen
  foreskriver — og **sheetens høyde sto uendret på 287 px gjennom byttet**
- Kategorisiden: kontrollen står i overskriftsraden, ingen nøstede knapper,
  og tallene gikk 1 min (bil) → 3 min (til fots). Før denne endringen sto de
  stille på gangtid uansett modus
- R5 på ekte board: ett tapp på handlen gikk fra 287 til 726 px (`rest: high`)
- Drift: bytte til Sykkel på kart-kontrollen oppdaterte liste-kontrollen til
  «Sykkel» og reordnet lista. Ingen drift
- Konsoll: to Mapbox-interne advarsler (`featureNamespace`, `Cutoff … terrain`),
  ingen feil, ingenting fra vår kode

**Avvik fra planens antakelse:** boardet kjører `mapbox-2d`, ikke Google-3D.
`BoardTravelChip3D` er derfor ikke montert på Strindfjordvegen 10, og
drift-sjekken gikk mot kart-kontrollen — inngangen som faktisk er der. Planens
påstand om at 3D er default gjelder ikke dette nivå-1-boardet.

**Gest-målingen i browser gjenstår:** draget kunne ikke drives fra
`evaluate_script` (React-handleren lytter på `pointerdown`/`pointerup`, og
syntetiske events uten ekte pointer-capture biter ikke). Magnet-fjerningens
målbare oppførsel er dekket av de 24 enhetstestene mot samme komponent og
samme geometri; det browseren ville lagt til er FØLELSEN, som er Unit 7.

---

- [ ] **Unit 7: Menneske-gate — gest-følelsen på fysisk telefon (Andreas)**

**Goal:** Bekrefte at den fjernede magneten kjennes riktig på enhet.

**Requirements:** R6

**Dependencies:** Unit 6

**Files:** ingen

**⚠️ Denne enheten kan IKKE utføres av en agent.** Gest-følelse er ikke et tall, og hele grunnen til at magneten fjernes er en dom Andreas felte med tommelen på en telefon. En autonom kjøring skal la denne stå åpen og si eksplisitt at R6 er delvis verifisert — ikke krysse den av.

**Approach:**
- LAN-URL via `scripts/mobile-url.sh`, åpne boardet på telefon.
- Dra sheeten til flere frie stillinger og slipp. Kjennes det som at flaten står der du slapp, eller som at den fortsatt korrigerer?
- **Kjenn særlig etter om flaten lander DER du siktet, ikke bare at den står stille.** Funn fra kodegjennomgangen 2026-08-26: prototypen målte at den naive fart-projeksjonen (`current + velocity * MOMENTUM_PROJECTION_MS`) bommer med ~47 px, og erstattet den der med en analytisk decay-formel. Produksjonen bruker fortsatt den naive formen. Magneten SKJULTE den upresisheten — den korrigerte alt som landet innenfor 44 px av et stopp. Nå er gjetningen landingsposisjonen, uten sikkerhetsnett. Kjennes kastet upresist, er det denne konstanten som skal justeres, ikke magneten som skal tilbake.
- Test «vis meg mest mulig kart» både med drag og med ett tapp på handlen. Er tappet godt nok som presisjonsvei nå som draget er fritt? Svaret mater det åpne spørsmålet om tappets logikk.

**Verification:**
- Andreas bekrefter følelsen, eller melder tilbake hva som fortsatt er galt

## System-Wide Impact

- **Interaction graph:** `SET_TRAVEL_MODE` dispatches i dag fra tre steder — `BoardMapControls` (kart-pillen), `BoardPathMidpointMarker` (2D-chipen) og `BoardTravelChip3D` (3D-chipen) — og leses av `buildNeighbourhoodList`, `BoardPathLayer` og de samme chipene. Den nye kontrollen er den fjerde utløseren og bruker en kant som finnes. **Men den er den første som ligger INNE i lista den reordner** (modus-avledet `minMinutes` styrer kategori-sorteringen). Det er ikke en ny kant, men det er en ny sløyfe å se etter under verifisering.
- **Error propagation:** Kontrollen har ingen nettverkskall og ingen lastetilstand. Tidene er precomputet (`POI.travelTime`), og manglende data håndteres allerede av regelen «aldri et estimat, aldri en tom '– min'».
- **State lifecycle risks:** `travelMode` bæres bevisst videre og nullstilles aldri ved navigasjon. Panelets `open` er lokal komponent-tilstand og lukkes både ved klikk utenfor og ved navigasjon (Unit 2).
- **API surface parity:** `TravelModeSelector` får én betinget rendring (Unit 1) som gjelder alle kallsteder likt. Ingen props-endring, ingen nye typer i `lib/types.ts`, ingen ny board-action.
- **Integration coverage:** At alle fire inngangene viser samme modus er ikke bevist av enhetstester på hver av dem — Unit 6 dekker det på ekte board, inkludert 3D-chipen.
- **Unchanged invariants:** `onHeightChange` rapporterer fortsatt `bounds.min` og ikke gjeldende høyde. Doc-blokken forklarer hvorfor: rapporteres gjeldende høyde, oppstår en okklusjons-løkke som får sheeten til å pumpe seg opp og ned av seg selv. `bounds.min` avhenger kun av `containerHeight`, aldri av `handlePointerUp` — magnet-fjerningen kan derfor ikke røre kontrakten. **Den må vurderes på nytt i Fase 2**, som bytter mekanismen under den.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Magneten fjernes, og «vis meg mest mulig kart» blir en presisjonsøvelse — bekymringen dagens doc-blokk reiser | Tappet på handlen beholdes og lander alltid PÅ et ytterpunkt. Men det er en toggle om midtpunktet, ikke «gå dit du peker»: fra en fri posisjon under midtpunktet sender ett tapp deg motsatt vei, så det kan kreve to tapp. Akseptert i denne omgangen, og ført opp som et åpent produktvalg |
| To eksisterende tester koder magneten som ønsket oppførsel | De snus eksplisitt i Unit 5, med de nye tallene utledet (672 og 282, begge `data-rest="free"`) og med krav om å kjøre testen framfor å stole på planteksten |
| Unit 4 monterer en kontroll som dispatcher riktig mens tallene står stille | Modus-koblingen i `CategoryPage` er et eksplisitt steg i Unit 4, ikke en antakelse, med `use-neighbourhood-list.ts` som mønster |
| Panelet påstår «Alle tider er omtrentlige» over tre «–» | Unit 1 gjør fotteksten betinget før kontrollen tas i bruk |
| Nøstet `<button>` i kategorisidens kikk-tilstand | Unit 4 monterer kun i normal-grenen, med en integrasjonstest på at ingen knapper er nøstet |
| En autonom kjøring krysser av R6 uten at noen har kjent på gesten | Unit 7 er merket som menneske-gate og skal stå åpen til Andreas har svart |
| Parallell sesjon har ukommitterte endringer i `prototypes/_shared/baseline.js`, `baseline.css`, `prototypes/README.md`, `docs/solutions/ui-patterns/mobil-sheet-*` og `PROJECT-LOG.md` | Denne planen rører kun `components/` og `docs/plans/`. De filene skal verken endres eller committes herfra |

## Documentation / Operational Notes

- Doc-blokken i `NeighbourhoodSheet.tsx` er en del av Unit 5, ikke etterarbeid. Den bærer begrunnelsen for en beslutning som nå er omgjort, og en usann begrunnelse i koden er verre enn ingen.
- **Utenfor de sju enhetene, i egen commit etter Unit 7:** et notat i `docs/solutions/` om at en magnet som leses som «flaten rydder opp» på desktop, leses som «flaten overprøver deg» på telefon. Det er ikke en implementasjonsdetalj, det er en regel om hvor gest-følelse må valideres. Ført opp her som oppfølging, ikke som en leveranse — det holder fil-grensen i risikotabellen intakt.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md](../brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md)
- Prototypen grepene kommer fra: `prototypes/04-fortelling-i-boardet/index.html`, `prototypes/_shared/baseline.js`
- Tidligere plan for samme komponent: `docs/plans/2026-08-14-001-feat-reisemodus-veksler-board-plan.md`
- Demo-flaten: `/eiendom/megler-harstad/strindfjordvegen-10-7053-ranheim-norge`
