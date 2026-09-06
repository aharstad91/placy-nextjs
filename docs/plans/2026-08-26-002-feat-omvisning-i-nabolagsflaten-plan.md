---
title: "feat: Omvisningen i nabolagsflaten — meglerens utvalg som guidet rekkefølge"
type: feat
status: active
date: 2026-08-26
origin: docs/brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md
deepened: 2026-08-26
---

# feat: Omvisningen i nabolagsflaten — meglerens utvalg som guidet rekkefølge

## Overview

Kartet med flere hundre punkter sier «her er det mye» — det er dekningen megleren betaler for. Men den som ikke selv zoomer og trykker, får ingenting ut av den. Omvisningen presenterer boardets eget innhold som en guidet rekkefølge: ett stopp per kategori, spørsmålet som overskrift, og de stedene et menneske har plukket ut.

Inngangen er ett kort øverst i nabolags-sheeten: **«La nabolaget presentere seg»**, med undertekst «N stopp · meglerens utvalg» (eller «· nærmeste steder» når utvalget ikke er kuratert).

Den avgjørende egenskapen er at omvisningen **ikke koster noe å produsere**. Den kjører på data hvert board allerede har. Derfor kan den finnes på alle boards, hver gang — og skillet mellom en åpen løsning og en ferdig kuratert er ikke OM du får omvisningen, bare HVEM som plukket stedene.

Forbildet er `prototypes/04-fortelling-i-boardet/index.html`, ferdig iterert og validert på fysisk telefon 2026-08-25/26. Denne planen porter oppførselen, ikke koden.

**Denne planen dekker mobil-omvisningen på boards uten voice-over.** Rekkevidden til de tre VO-boardene er skilt ut i `docs/plans/2026-08-26-003-feat-omvisning-paa-vo-boards-plan.md` — ikke fordi den er valgfri, men fordi gjennomgangen viste at den er en reconciliation av fire koblede render-grener i en annen fil, ikke et monteringsvalg. Se Scope Boundaries.

## Problem Frame

Origin-dokumentet delte gårsdagens prototypearbeid i to. Fase 1 — reisemåte som enhet over minutt-kolonnen, og magneten ut av sheet-gesten — er bygd og ligger på `feat/reisemate-enhet-fluid-sheet`. Omvisningen ble den gang holdt utenfor med begrunnelsen at den «venter på en dom over `04`, og den dommen er et produktvalg, ikke et teknisk et» (se origin).

Dommen er nå felt: omvisningen skal inn, på alle boards, hver gang.

Denne planen bygger derfor **direkte på fase 1** og forgrenes fra `feat/reisemate-enhet-fluid-sheet`, ikke fra `main`. Omvisningen konsumerer sheeten, og den fluide gesten er en forutsetning for hvilestillingen omvisningen måler seg til.

## Requirements Trace

### Inngangen (R1–R3)

- **R1.** Hvert board skal vise inngangen til omvisningen øverst i nabolagsflaten, uten at noen har kuratert noe. Et board med magrest mulig datagrunnlag skal produsere en fullverdig omvisning.
- **R2.** Inngangen skal navngi hvor mange stopp omvisningen har, og hvem som plukket stedene — «meglerens utvalg» når utvalget er kuratert, «nærmeste steder» når maskinen plukket.
- **R3.** Omvisningen skal kunne forlates når som helst, og boardet skal da stå slik det sto før den ble startet — kartet rammet ut igjen, indeksen tilbake.

### Stoppet (R4–R8)

- **R4.** Ett stopp = én kategori. Stoppet skal bære kategoriens spørsmål som overskrift («Er det bra for barna?»), ikke kategorilabelen — labelen er arkivarens ord, spørsmålet er kjøperens. Mangler spørsmålet, brukes labelen.
- **R5.** Stoppet skal ha tre faner: ord om området, stedene, og spørsmål og svar. Fanen for spørsmål skal forsvinne helt når kategorien ikke har noen — ingen tom flate.
- **R6.** Stedene i et stopp skal komme fra kategoriens ferdigresolvede utvalg når det finnes — kuratert eller generert — og ellers fra kategoriens nærmeste **målte** steder. Aldri et sted uten målt reisetid, og aldri et tomt stopp når kategorien har målte steder.
- **R7.** Rekkefølgen på stedene sorteres på tid uansett kilde. Kuratoren eier hvilke steder, omvisningen eier rekkefølgen de nevnes i.
- **R8.** Innenfor ett stopp lukkes et felt brukeren har åpnet ALDRI av seg selv: fanebytte og retur til fanen bevarer det som er åpent. **«Åpen» er scoped til stoppet og overlever stoppbytte** — hopper brukeren fram og tilbake, står feltene hun åpnet der hun forlot dem.

### Transporten (R9–R10)

- **R9.** Et stopp lenger fram skal kunne nås direkte, uten å gå gjennom alle stoppene foran. Ingen gest skal være eneste vei til noe.
- **R10.** Dekket skal beholde sin egen sideveis scroll-posisjon når stoppet skifter — det skal ikke bygges på nytt.

### Kartet (R11–R13)

- **R11.** Kartet skal ramme inn stoppets steder sammen med boligen, ikke hele kategorien — i BEGGE kartmotorer. I steds-fanen strammes rammen til stedene alene.
- **R12.** Stoppets kategori skal stå fram mens de øvrige dempes, i begge motorer.
- **R13.** Kartet skal følge det brukeren åpner, ikke det hun lukker. Å fly tilbake på en lukking er en bevegelse ingen ba om.

### Sheeten (R14–R15)

- **R14.** Sheeten skal ha ÉN hvilestilling gjennom omvisningen. Et trykk som åpner en setning skal ikke flytte (a) flaten, (b) kartutsnittet over den, eller (c) avstanden ned til dekket. Alle tre skal verifiseres hver for seg.
- **R15.** Hvilestillingen er en hvilestilling, ikke en låst høyde. Brukeren skal fortsatt kunne dra sheeten dit hun vil, innenfor de grensene fase 1 satte.

### Tilgjengelighet og utganger (R16–R17)

- **R16.** Omvisningen skal kunne betjenes uten peker: faneraden med piltaster, dekket med tastatur, og et stoppbytte skal flytte fokus til stoppets overskrift og annonseres for skjermleser. Et stoppbytte er en innholdsutskifting uten navigasjon, og uten dette skjer det i stillhet.
- **R17.** Telefonens egen tilbake-gest skal lukke omvisningen, ikke navigere bort fra boardet.

### Verifisering (R18)

- **R18.** Omvisningen skal være verifisert på `/eiendom/placy-demo/strindfjordvegen-10/rapport-board` — magrest datagrunnlag, 3D-tillegg, ingen voice-over. Gest- og lesefølelse på fysisk telefon er Andreas' gate.

## Scope Boundaries

- **Ordet «story» i kode.** Begrepet er okkupert av Reels-produktet (`components/variants/report/reels/DesktopStorySidebar.tsx`, `StoryProgressBar.tsx`, `reels-data.ts`) — der betyr «story» den lyd- og videodrevne opplevelsen med egen fase-maskin. To tidligere planer (`docs/plans/2026-08-06-001-feat-story-flate-separasjon-plan-A.md`, `-002-feat-story-frame-plan-B.md`) bruker ordet i den betydningen. Kodenavnet her er **`Walkthrough`** (verifisert fritt i repoet); ordet brukeren ser er «omvisning».
- **Ny kurering, nytt innhold, ny datamodell.** Omvisningen er en ny REKKEFØLGE på det boardet allerede har. Ingen migrasjon, ingen pipeline-endring, ingen nye felt i `products.config`.
- **Lyd i stoppene.** Se antakelsen under Open Questions.
- **Modal for et sted.** Trykk på et sted åpner teksten i raden, aldri en modal. Det er nettopp kompleksiteten omvisningen fjerner.
- **Prototype-stillaset.** Board-velgeren, Tett/Fortelling-veksleren og Megler/Nærmest-veksleren er merket `AVVIK` og hører kun hjemme i prototypen. I produksjon avgjøres kilden av data, ikke av en bryter.

### Deferred to Separate Tasks

- **Omvisningen på boards med voice-over** → `docs/plans/2026-08-26-003-feat-omvisning-paa-vo-boards-plan.md`. Skilt ut etter gjennomgangen, som falsifiserte beskrivelsen «et avgrenset monteringsvalg»: `hasAudioMobile` i `components/variants/report/reels/ReportReelsPage.tsx` bærer minst fire koblede avledninger (`mapIsSurface`, kartets `interactive`-prop, `peekActive`, og render-gaten for `ReelSwipeStack`), og filens egen kommentar sier eksplisitt at koden er skrevet på premisset at nabolagsflaten og VO-grenen aldri er sanne samtidig. Å utvide rekkevidden bryter det premisset og er sitt eget arbeid.
- **Omvisningen på desktop.** Desktop bruker ikke nabolagsflaten — den har `components/variants/report/reels/DesktopStorySidebar.tsx`, en «player-modell» med ÉN aktiv kategori og en thumbnail-rad for å hoppe (`SELECT_CATEGORY source: "rail"`). Desktop har altså **allerede** en guidet rekkefølge, i en annen form. Å slå de to sammen er et eget designproblem, ikke en mindre utgave av dette.
- **`HighlightsDisclosure` som delt komponent.** Ligger i dag under `reels/` og importeres kun av desktop-sidebaren; mobil `CategoryPage.tsx` viser ikke `editorial.highlights` i det hele tatt. Omvisningen bygger sin egen presentasjon (Unit 3); konsolidering hører til desktop-runden.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/board-state.tsx` — `BoardPhase` er `"default" | "active" | "poi"`. **`stayInDefault` (~linje 152–156) er en eksplisitt OR-kjede over `action.source`**, ikke en uttømmende switch. `SelectCategorySource`-unionen (~linje 100) og OR-kjeden må oppdateres SAMMEN. `travelMode` overlever all navigasjon (`resetNavigation`).
- `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx` (~linje 107–122) — rendrer `CategoryPage` eller `NeighbourhoodList` som **gjensidig utelukkende grener**. `NeighbourhoodSheet` er derfor ikke en persistent instans: en tredje gren for omvisningen får fersk `restHeight` ved mount, og R3 er gratis for sheetens egen hviletilstand. `handleOpen`/`handleBack` er mønsteret for kamera-snapshot og retur.
- `components/variants/report/board/neighbourhood/NeighbourhoodSheet.tsx` — eier ÉN scroll-container (`data-testid="neighbourhood-scroll"`). `restHeight` settes i dag KUN via `settleAt()` fra pointer-håndterere; det finnes **ingen** vei inn utenfra. Rapporterer alltid `bounds.min` oppover, aldri gjeldende høyde — doc-blokken forklarer okklusjons-løkken det bryter.
- `components/variants/report/board/neighbourhood/CategoryPage.tsx` — bruker et HELT annet høydesystem (faste andeler `PANEL_FRACTION`/`PEEK_FRACTION`). Omvisningen gjenbruker det frie drag-systemet i `NeighbourhoodSheet`, ikke dette.
- `components/variants/report/board/FAQSection.tsx` — delt, flate-agnostisk. Disclosure via `useState<ReadonlySet<string>>`: flere åpne samtidig, ingen accordion-eksklusivitet, ingen auto-scroll ved åpning (eksplisitt dokumentert valg).
- `components/variants/report/board/board-data.ts` (~linje 384–521) — `editorial.highlights` er **allerede render-klar i begge tilfeller**: kuratert fra `highlightPoiIds`, eller generert av `pickGeneratedHighlights` som bruker tier-1-ekstraktorene (`getHeroInsightPOIIds`) og derfor plukker en tematisk MIKS, ikke tre av samme underkategori. `generated: true` skiller de to. Se Key Technical Decisions — dette endrer fallback-kjeden i forhold til første utkast.
- `lib/i18n/strings.ts` — `themeQuestions`, statisk tabell nøklet på tema-id. Alle standard-temaene har spørsmål. Kilden til R4.
- `components/variants/report/board/BoardMap.tsx` — `markerStates` (~linje 300–335) rendrer ALLE POI-er med stabil DOM-identitet og fader `opacity`/`scale` via et `isVisible`-flagg. `fitVisible()` (~linje 619) rammer synlige markører + boligen, og bruker `mapPaddingBottom` (= hvileminimumet). `tourActive`-effekten (~linje 569–572) fitter automatisk til HELE kategorien — relevant for VO-planen, ikke for denne.
- `components/variants/report/board/board-camera-fit.ts` (~linje 27–43) — `computeFitBounds(poiCoords, home)`. Signaturen bærer allerede et eksplisitt punktsett.
- `components/variants/report/board/board-category-camera.ts` + `use-board-3d-camera.ts` + `camera-tours.ts` — 3D-kameraets presedenskjede: håndautorert tur → utledet A→B-bue fra `topRankedPois`/`pois` (**hele kategorien**) → orbit-fallback. Ingen av de tre rammer stoppets utvalg. Se Key Technical Decisions.
- `components/variants/report/board/use-board-marker-set.ts` (~linje 129–175) — `selectMarkerPOIs()` returnerer et eksplisitt sett som mountes i 3D, uten opacity-reveal (WebGL-kontekst-churn).

### Institutional Learnings

- `docs/solutions/ui-patterns/mobil-sheet-en-scroller-tre-stopp-20260825.md` — handlen publiserer `--grab-h` som CSS-variabel så fastlimt innhold under bruker `top: var(--grab-h)` i stedet for å slåss om z-index. `touch-action` hører på selve scrolleren, aldri på en forelder.
- `docs/solutions/feature-implementations/3d-map-real-pois-distance-opacity-20260415.md` — `React.memo` på markør-elementet er nødvendig ved 100+ pins; uten den re-rendrer ETT klikk alle markørene. Omvisningen bytter markør-tilstand ved hvert stopp, hver fane og hvert stedstrykk.
- `docs/solutions/architecture-patterns/report-kart-per-kategori-modal-20260409.md` — mønsteret for å fremheve nevnte steder via et `Set` av POI-ID-er.
- `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md` — et fire-tilstands snap-enum ble forkastet fordi affordanser var bundet til beat-type i stedet for flate. **Bind affordanser til flate, ikke til stopp-type.**
- `docs/plans/2026-08-22-001-feat-faq-lokalkunnskap-niva1-plan.md` (fullført) — FAQ per kategori er allerede bygd for nivå 1. Fane 3 gjenbruker modellen og lager ikke en ny.

### Planning-time corrections

Fire påstander fra første planutkast og fra lærdoms-søket ble falsifisert mot koden og er rettet:

1. **Det finnes ingen `MapAdapter`.** `flyTo` kalles fra ett sted, `BoardMap.tsx`. Kamera-abstraksjonen er `MapCameraApi` med nøyaktig tre metoder.
2. **Rapport-boardet bruker ikke Radix.** Pakken finnes i `package.json`, men ingen komponent under `components/variants/report/` importerer den. Faneraden — og dermed piltast-navigasjonen i R16 — bygges for hånd.
3. **«Ingen reducer-endring utover unionen» var feil.** `stayInDefault` er en OR-kjede; uten at `"walkthrough"` legges til DER, går fasen til `"active"` og UI-en kapres.
4. **«3D flyr av seg selv» dekker ikke R11.** Kameraet flyr, men til kategoriens utledede bue eller til en håndautorert tur — ikke til stoppets tre steder.

## Key Technical Decisions

- **Kodenavn `Walkthrough`, brukerord «omvisning».** Verifisert fritt i repoet. «Story» og «tour» er begge opptatt av levende produkter, og en plan som skriver `StoryMode` vil lese som en fortsettelse av to forlatte planer.
- **Omvisningen er en flate i `NeighbourhoodSurface`, ikke en ny `BoardPhase`.** Fase-maskinen har tre verdier, og alle tre beskriver hva kartet og markørene gjør. Omvisningen endrer hvilken kategori som står fram — noe `SELECT_CATEGORY` allerede uttrykker. En fjerde fase ville duplisert kanalen og tvunget hvert `phase`-oppslag til å ta stilling til en tilstand det ikke bryr seg om. Omvisningens egen tilstand bor i surface-subtreet, som en tredje gjensidig utelukkende gren ved siden av lista og kategorisiden.
- **`"walkthrough"` legges til BÅDE i `SelectCategorySource` og i `stayInDefault`.** Det er to redigeringer i samme fil, ikke én. Vurder samtidig å bytte OR-kjeden mot et `Set`, så neste kilde ikke kan glemmes.
- **Stoppets steder leses fra `editorial.highlights` uansett om de er kuratert eller generert.** Første utkast ville regnet «nærmeste tre målte» på nytt for genererte kategorier. Det er både dyrere og dårligere: `pickGeneratedHighlights` har allerede kjørt tier-1-ekstraktorene og plukket en tematisk miks, mens en naiv nærmeste-tre gir tre bussholdeplasser 200 m fra hverandre — nøyaktig på det magre boardet vi verifiserer på. Fallback-kjeden er derfor **to trinn, ikke tre**: har kategorien highlights, brukes de; er lista tom — også når `generated` er usatt fordi alle `highlightPoiIds` er foreldet — brukes kategoriens nærmeste målte. `generated`-flagget styrer BARE etiketten, aldri hvilken kilde som velges. Dette er det som gjør R6 sant i alle tilfeller.
- **Åpne felt nøkles per stopp.** Ett globalt `Set` ville tømt seg ved stoppbytte, og siden dekket lar brukeren hoppe fram og tilbake ville felt hun åpnet på stopp 1 være lukket når hun kom tilbake — det R8 forbyr. Nøkkelen er stoppets indeks.
- **Sheetens faktiske høyde leses imperativt, aldri reaktivt.** Kamera-rammingen (R11) trenger høyden flaten STÅR i, mens `onHeightChange` med vilje rapporterer hvileminimumet for å bryte okklusjons-løkken. Løsningen er en ref-basert lesefunksjon som kameraet kaller i det øyeblikket det rammer — den kan ikke utløse en render og kan derfor ikke mate løkken. Kontrakten `onHeightChange` er uendret.
- **2D må rammes eksplisitt; 3D må få en ny, høyest prioriterte vei.** Utenfor audio-tour skjer ingen automatisk fit i Mapbox. I 3D skjer det en bevegelse, men `deriveCategoryCameraConfig` velger håndautorert tur, ellers en bue over hele kategorien — aldri stoppets tre steder. Omvisningen må derfor kortslutte presedenskjeden med stoppets koordinater. De to motorene får hver sin enhet, fordi de løser to forskjellige problemer.
- **Inn- og utgangen er et kutt i sheeten og en bevegelse på kartet.** Innholdet byttes hardt — et krysstoningskort som skalerer og fader ville konkurrert med kamerabevegelsen om oppmerksomheten i det samme sekundet. Kartet animerer, fordi det er der orienteringen skjer.
- **To setninger, ikke hele strøksteksten.** Seks linjer prosa ganger seks stopp er en nettside igjen, ikke en omvisning. Kuttet skjer på setningsslutt, aldri midt i et ord, og uten ellipse. Den fulle teksten finnes fortsatt bak «Avslutt», i drill-in.

## Open Questions

### Resolved During Planning

- **Har hvert board spørsmål til stoppene?** Ja. `themeQuestions` dekker alle standard-tema-id-er, inkludert alle seks på verifiseringsboardet. Ukjente id-er faller tilbake til labelen.
- **Finnes POI-en i to former?** Bekreftet. `POI.travelTime` ligger direkte på det rå objektet i `board.poisById`; `BoardPOI` i `category.pois` bærer det rå objektet under `raw`. Leser man feil, blir raden stille tom.
- **Er `editorial.generated` en pålitelig diskriminator?** Ja, som ETIKETT — den er `true` eller `undefined`, aldri eksplisitt `false`. Men den er **ikke** en pålitelig kildevelger: en kuratert kategori der alle `highlightPoiIds` er foreldet gir tomme highlights uten `generated`. Derfor velger vi kilde på om lista har innhold, ikke på flagget.
- **Kan omvisningen gjenbruke FAQ-modellen?** Ja, uendret.
- **Nullstilles sheetens hvilestilling ved inn- og utgang?** Ja, gratis: `NeighbourhoodSheet` mountes per navigasjonsgren og er ikke persistent.

### Assumption taken on Andreas' behalf

- **Voice-over-boards.** Tre boards har lyd (`broset-utvikling-as_wesselslokka`, `grilstad-marina_byggetrinn-4`, `bane-nor-eiendom_stasjonskvartalet` — alle tre har også 3D-tillegg). Antakelsen er at omvisningen er standard-inngang også der, og at lyden senere blir et lag INNI stoppene, ikke en parallell knapp. Andreas gikk videre uten å innvende, men bekreftet den ikke i ord. Arbeidet ligger i egen plan, så snus antakelsen, faller den planen bort uten at denne må skrives om.

### Needs a decision from Andreas (not blocking Unit 1–7)

- **Skal omvisningen starte av seg selv første gang et board åpnes?** Hele begrunnelsen for funksjonen er at den som ikke zoomer og trykker ikke får noe ut av kartet. Da er autostart direkte koblet til om funksjonen treffer formålet — men det er også det mest påtrengende en flate kan gjøre. Planen bygger inngangskortet som eneste vei inn. Svares det ja, er tillegget lite; svares det nei, er det en beslutning og ikke et hull.

### Deferred to Implementation

- **Om stoppets overskrift bør være fastlimt.** Prototypens fastlimte overskrift løste en bug som ikke finnes her (produksjonens grab-knapp ligger `shrink-0` utenfor scrolleren). Avgjøres av hvordan stoppet faktisk faller ut i sheeten.
- **Terskel for når dekket må kunne rulles sideveis.** Arbeidshypotese: verifiser mot boardet med flest kategorier i dagens datasett, og tåle labels opp til kategorinavnenes faktiske lengde uten trunkering. Måles i Unit 4.

## High-Level Technical Design

> *Dette illustrerer den tenkte tilnærmingen og er retningsgivende for gjennomlesing, ikke en implementasjonsspesifikasjon. Den som bygger skal lese det som kontekst, ikke som kode å gjengi.*

Omvisningens tilstand og hva den oversettes til per flate:

```
WalkthroughState = {
  active, stopIndex, pane,
  openPlaceIds: Map<stopIndex, Set>,   // per stopp — se R8
  openFaqIds:   Map<stopIndex, Set>,
}

stopIndex ──> SELECT_CATEGORY { id, source: "walkthrough" }  ──> dimming (begge motorer)
          └─> stopPlaces(kategori)                           ──> spotlight-Set (3 steder)
          └─> 2D: mapCamera.fitPoints(bolig + steder, padding = sheetens FAKTISKE høyde)
              3D: ny, høyest prioriterte kamerakonfigurasjon over de samme punktene
                  (kortslutter deriveCategoryCameraConfig)

pane      ──> "steder": rammen strammes til stedene alene, uten boligen
              ellers:   boligen står med

openPlaceIds ─> kartet flyr til stedet som ÅPNES (etter teksten), aldri ved lukking
```

Fallback-kjeden — to trinn, ikke tre:

| Kategorien har | Stoppets steder | Etiketten |
|---|---|---|
| `editorial.highlights` med innhold, `generated` usatt | Highlightene, tidssortert | «meglerens utvalg» |
| `editorial.highlights` med innhold, `generated: true` | Highlightene (tier-1-miks), tidssortert | «nærmeste steder» |
| Tom eller manglende `highlights` | Kategoriens nærmeste **målte** | «nærmeste steder» |

Avhengighetsrekkefølgen er lineær, og sheeten kommer FØR kartet fordi kamera-rammingen leser høyden flaten står i:

```
Unit 1 (modell) → 2 (tilstand + inngang) → 3 (stoppet) → 4 (dekket)
                                                          → 5 (sheetens hvilestilling)
                                                             → 6 (kartet 2D) → 7 (kartet 3D)
                                                                                 → 8 (menneske-gaten)
```

## Implementation Units

- [x] **Unit 1: Omvisningens modell**

**Goal:** Ren, testbar modell for hva et stopp er, uten React og uten kart.

**Requirements:** R1, R2, R4, R6, R7

**Dependencies:** Ingen

**Files:**
- Create: `lib/board/walkthrough.ts`
- Test: `lib/board/walkthrough.test.ts`

**Approach:**
- Utled stoppene fra `BoardCategory[]`: id, spørsmål (med label som reserve), farge og ikon.
- `stopPlaces(category)`: bruk `editorial.highlights` når lista har innhold — uansett om den er kuratert eller generert. Er den tom eller fraværende, bruk kategoriens POI-er med målt tid. Sorter alltid på tid, deretter navn. Kapp til 3.
- `sourceLabel(category)`: «meglerens utvalg» når `editorial.generated` er usatt OG highlights ble brukt; ellers «nærmeste steder». Etiketten følger flagget, kilden følger innholdet — se Key Technical Decisions.
- `morePlaces(category)`: kategoriens neste nærmeste målte, med stoppets egne trukket fra, opp til 6 rader totalt.
- `beat(text)`: to setninger, kutt på setningsslutt, ingen ellipse. Hele teksten når den er kortere.
- Reisetid leses ALLTID via `raw.travelTime`.

**Execution note:** Test-først. Modellen er ren, fallback-kjeden er hele poenget, og den er lettere å låse i en test enn å inspisere i en nettleser.

**Patterns to follow:**
- `lib/board/neighbourhood-list.ts` — samme slags ren modell, med `minutesOf` som leser `raw.travelTime`.
- `components/variants/report/board/board-data.ts` (`pickGeneratedHighlights`) — kilden til de genererte highlightene.

**Test scenarios:**
- Happy path: kuratert kategori med tre highlights → stoppet returnerer dem, tidssortert, etikett «meglerens utvalg».
- Happy path: `generated: true` med tre highlights → samme tre, etikett «nærmeste steder».
- Edge case: kategori uten `editorial` i det hele tatt → nærmeste målte, aldri flere enn tre.
- Edge case: **kuratert `editorial` der ALLE `highlightPoiIds` er foreldet** (tom highlights-liste, `generated` usatt) → stoppet faller tilbake til nærmeste målte og står ikke tomt.
- Edge case: kategori der noen POI-er mangler reisetid → de utelates både fra utvalget og fra «flere i nærheten».
- Edge case: kategori med færre enn tre målte steder → returnerer det som finnes, uten å fylle på.
- Edge case: `beat()` på én setning → uendret; på fem → de to første uten ellipse; på tom tekst → tom streng.
- Edge case: kategori uten `question` → stoppet bærer labelen.
- Error path: `stopPlaces` på kategori uten POI-er → tomt utvalg, ingen kast.

**Verification:**
- Modellen produserer et komplett sett stopp for et board uten kuratert innhold, med målte tider på hvert sted, og genererte stopp arver tier-1-miksen i stedet for tre naboer av samme slag.

---

- [x] **Unit 2: Omvisningens tilstand og inngangskortet**

**Goal:** Omvisningen kan startes og avsluttes fra nabolagsflaten, og kortet navngir hva den er.

**Requirements:** R1, R2, R3, R8, R17

**Dependencies:** Unit 1

**Files:**
- Create: `components/variants/report/board/neighbourhood/use-walkthrough.ts`
- Create: `components/variants/report/board/neighbourhood/WalkthroughEntryCard.tsx`
- Create: `components/variants/report/board/neighbourhood/WalkthroughEntryCard.test.tsx`
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx`
- Modify: `components/variants/report/board/board-state.tsx`
- Test: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.test.tsx`
- Test: `components/variants/report/board/board-state.test.ts`

**Approach:**
- `use-walkthrough.ts` holder `{ active, stopIndex, pane, openPlaceIds, openFaqIds }` i surface-subtreet, som en tredje gjensidig utelukkende gren ved siden av lista og kategorisiden. Åpne felt nøkles PER STOPP (R8).
- `board-state.tsx`: legg `"walkthrough"` til i `SelectCategorySource` OG i `stayInDefault`-kjeden. Uten det andre går fasen til `"active"`.
- Kortet monteres øverst i lista, over kategorikortene, og viser antall stopp og kildeetiketten fra Unit 1.
- Å starte omvisningen skal stanse en pågående intro-flythrough (`introPlaying`) i samme handling, så to ting ikke eier kameraet samtidig.
- Boardets globale FAQ-seksjon under kategorikortene skjules mens omvisningen står — den hører til indeksen, ikke til et stopp.
- Å avslutte gjenoppretter kamera-snapshot og dispatcher `RESET_TO_DEFAULT`, samme mønster som `handleBack`. Telefonens tilbake-gest skal treffe samme utgang (R17).
- Innholdsbyttet er et kutt, ikke en krysstoning — se Key Technical Decisions.

**Patterns to follow:**
- `NeighbourhoodSurface.tsx` — `handleOpen`/`handleBack` med `mapCamera.snapshot()`/`restore()`.
- `board-state.tsx` — `SelectCategorySource`-unionen OG `stayInDefault` rett under.

**Test scenarios:**
- Happy path: kortet viser antall stopp lik antall kategorier, og «meglerens utvalg» på et kuratert board.
- Happy path: trykk på kortet skjuler kategorikortene og den globale FAQ-seksjonen, og viser stoppet; «Avslutt» bringer begge tilbake.
- Edge case: board med kun genererte highlights → kortet sier «nærmeste steder».
- Edge case: board med én kategori → «1 stopp», i entall.
- Edge case: tilbake-gest under aktiv omvisning → omvisningen lukkes, boardet består (R17).
- Integration: `SELECT_CATEGORY source: "walkthrough"` holder `phase: "default"` — reducer-testen skal feile hvis `stayInDefault` ikke er oppdatert.
- Integration: å avslutte gjenoppretter nøyaktig det kamera-utsnittet som var lagret ved start.
- Integration: å starte omvisningen mens intro-flythrough-en kjører stanser den.

**Verification:**
- Inngangen finnes på et board uten kuratert innhold, og omvisningen kan startes og forlates uten at boardet står igjen i en annen tilstand enn det begynte i.

---

- [x] **Unit 3: Stoppet med sine tre faner**

**Goal:** Stoppet viser spørsmålet som overskrift og besvarer det på tre måter.

**Requirements:** R4, R5, R6, R8, R13, R16

**Dependencies:** Unit 2

**Files:**
- Create: `components/variants/report/board/neighbourhood/WalkthroughStop.tsx`
- Create: `components/variants/report/board/neighbourhood/WalkthroughStop.test.tsx`
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx`

**Approach:**
- Spørsmålet står OVER faneraden, ikke inni en av dem: stoppet ER spørsmålet, fanene er de tre svarene. Derfor trengs ingen tilbake-pil inne i stoppet.
- Fane 1 «Om området»: to setninger fra `editorial.body`, med de to andre fanene som halve kort under — halve fordi de er likeverdige innganger, ikke ett svar og en fotnote.
- Fane 2 «Steder»: utvalget med kildeetiketten som eyebrow, kategoriens neste nærmeste under. Rader kan utvides til stedets egne ord; rader uten tekst får ingen chevron, men beholder plassen så høyrekanten ikke rykker.
- Fane 3 «Spørsmål»: `FAQSection` med kategoriens FAQ. Rendres ikke i det hele tatt når kategorien mangler spørsmål.
- Reisemåte-kontrollen fra fase 1 hører hjemme i steds-fanens overskriftsrad.
- **Tilgjengelighet (R16):** faneraden bygges for hånd (ingen Radix i denne modulen) og må derfor selv implementere WAI-ARIAs fanemønster: `role="tablist"`/`tab`/`tabpanel`, piltaster mellom faner, og roving tabindex.
- Trykk på et sted åpner teksten og lar kartet følge etter; trykk igjen lukker DET stedet og lar kameraet stå.

**Patterns to follow:**
- `components/variants/report/board/FAQSection.tsx` — `Set` av åpne id-er, begge tilstander i DOM, ingen auto-scroll.
- `components/variants/report/board/neighbourhood/TravelModeHeaderControl.tsx` — kontrollen fra fase 1.
- `lib/board/poi-link-text.ts` — stedsnavn i FAQ-svar er knapper, ikke rå markup.

**Test scenarios:**
- Happy path: stoppet viser kategoriens spørsmål som overskrift og tre faner.
- Happy path: fane 2 viser utvalget under kildeetiketten, og «flere i nærheten» under.
- Edge case: kategori uten FAQ → fane 3 finnes ikke, og snarveiskortet til den finnes heller ikke i fane 1.
- Edge case: kategori uten `question` → overskriften er labelen.
- Edge case: sted uten egen tekst → ingen chevron, men raden beholder høyrekanten.
- Edge case: kategori uten `editorial.body` → fane 1 viser ingen prosa, men snarveiskortene står.
- Integration: to steder åpnes, fanen byttes og byttes tilbake → begge står åpne.
- Integration: **to steder åpnes på stopp 1, brukeren går til stopp 3 og tilbake → begge står fortsatt åpne** (R8).
- Integration: å lukke et sted flytter ikke kameraet (R13).
- Integration: piltast høyre/venstre i faneraden bytter fane og flytter fokus (R16).

**Verification:**
- Alle tre fanene svarer på det samme spørsmålet, og et board uten kuratert innhold viser fane 1 og 2 med ekte, målte tall.

---

- [x] **Unit 4: Dekket og veien videre**

**Goal:** Et stopp lenger fram kan nås direkte.

**Requirements:** R9, R10, R16

**Dependencies:** Unit 3

**Files:**
- Create: `components/variants/report/board/neighbourhood/WalkthroughDeck.tsx`
- Create: `components/variants/report/board/neighbourhood/WalkthroughDeck.test.tsx`
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx`

**Approach:**
- Dekket er den faste flaten nederst; sporet er den rullende raden med segmenter inni det. Ett segment per kategori, med ikon og label. Passerte stopp merkes.
- Sporet ruller inni dekket, ikke omvendt: ruller dekket selv, forsvinner endene ut av syne og flaten slutter å lese som én ting.
- Det aktive stoppet legges mot venstre kant, men ikke helt inntil — litt av det forrige navnet skal synes, så raden viser at den har en bakside.
- Segmentene bygges ÉN gang. Ved stegbytte endres kun tilstands-attributtene (R10).
- Dekket ligger over sheeten; slår brukeren flaten sammen for å se kartet, må handlen legge seg over dekket og ikke bak det.
- **Tilgjengelighet (R16):** segmentene er tastaturnåbare, og et stoppbytte flytter fokus til stoppets overskrift og annonseres i en `aria-live`-region. Uten det skjer utskiftingen i stillhet for en skjermleser.
- Treffflaten på hvert segment skal være minst 44 × 44 px, uansett hvor lite ikonet tegnes.

**Test scenarios:**
- Happy path: sporet viser ett segment per kategori, og det aktive er merket.
- Happy path: trykk på et segment lenger fram hopper rett dit uten å gå gjennom stoppene imellom (R9).
- Edge case: siste stopp aktivt → sporet drar ikke tomrom inn i seg.
- Edge case: board med to kategorier → sporet ruller ikke, men leser fortsatt som én flate.
- Edge case: boardet med flest kategorier i dagens datasett → labels trunkeres ikke, og sporet er fortsatt rullbart.
- Integration: brukeren ruller sporet sideveis, kartet legger seg til ro og stoppet males på nytt → scroll-posisjonen står (R10).
- Integration: stoppbytte flytter fokus til stoppets overskrift (R16).

**Verification:**
- Hvert stopp kan nås direkte, med tommel og med tastatur, og ingenting i omvisningen krever en gest som eneste vei.

---

- [x] **Unit 5: Sheetens hvilestilling i omvisningen**

**Goal:** Flaten står stille mens du leser i den — og kartet kan finne ut hvor høy den faktisk er.

**Requirements:** R14, R15

**Dependencies:** Unit 3, Unit 4

**Files:**
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSheet.tsx`
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx`
- Test: `components/variants/report/board/neighbourhood/NeighbourhoodSheet.test.tsx`

**Approach:**
- Sheeten vokste før: åpnet du et sted, la flaten seg etter teksten. Det ser omtenksomt ut og er det motsatte — flaten du leser i, kartutsnittet over den og avstanden ned til dekket endret seg av et trykk som bare skulle åpne en setning. Følgen var større enn handlingen, og den kunne du ikke styre.
- Høyden måles på første stopp med ord-fanen åpen — det guiden faktisk serverer først. Da fyller den vanlige visningen sheeten uten scroll, mens steds- og svar-fanen får noe å scrolle i.
- **`restHeight` kan i dag bare settes av pointer-håndterere.** Denne enheten leverer en navngitt inngang for å sette hvilestillingen utenfra. Den skal ikke gjøres reaktiv.
- **Denne enheten leverer også den imperative lesekanalen for sheetens FAKTISKE høyde**, som Unit 6 og 7 rammer kameraet mot. En ref-basert lesefunksjon, ikke state og ikke en callback — den må ikke kunne utløse en render, ellers gjenåpnes okklusjons-løkken `onHeightChange` ble skrevet for å bryte.
- Målt høyde blir HVILESTILLING, ikke låst høyde. Grensene er fase 1 sine (R15).
- Dekket males før sheeten måles: sheeten padder for dekket, så måles den.
- `onHeightChange`-kontrakten er uendret — det som rapporteres oppover er fortsatt hvileminimumet.
- Måling skal skje på nytt ved viewport-endring, ikke bare klippes mot nye grenser. Roterer telefonen, brekker prosaen om.

**Execution note:** Karakteriser først. `NeighbourhoodSheet.tsx` ble nettopp endret i fase 1, og de eksisterende testene låser gest-oppførselen som ble validert på enhet. Fest dagens oppførsel før hvilestillingen legges til.

**Test scenarios:**
- Happy path: omvisningen starter → sheeten hviler i en høyde som rommer ord-fanen uten scroll.
- Happy path: et sted åpnes → flaten står stille, innholdet scroller inni (R14a).
- Edge case: hvilestillingen klemmes av gulvet på den korteste skjermen vi støtter.
- Edge case: hvilestillingen klemmes av taket når første stopp har uvanlig lang prosa.
- Edge case: **brukeren roterer skjermen mens et stopp er åpent → høyden måles på nytt, ikke bare klippes mot nye grenser.**
- Edge case: å avslutte omvisningen gir lista tilbake sin egen hvilestilling.
- Integration: det som rapporteres til kartet er fortsatt hvileminimumet — okklusjons-løkken oppstår ikke (R14b).
- Integration: **dekkets avstand til sheetens overkant er uendret når et sted åpnes** (R14c).
- Integration: den imperative lesekanalen returnerer den høyden flaten faktisk står i etter et drag, ikke hvileminimumet.
- Integration: brukeren drar flaten til taket, bytter stopp → flaten blir stående der brukeren satte den.

**Verification:**
- Ingen bevegelse i flaten som brukeren ikke selv ba om, kartet får fortsatt et stabilt tall, og kameraet har en vei til den faktiske høyden som ikke kan svinge.

---

- [x] **Unit 6: Kartet per stopp — Mapbox 2D**

**Goal:** 2D-kartet rammer det stoppet snakker om.

**Requirements:** R11, R12, R13

**Dependencies:** Unit 5

**Files:**
- Modify: `lib/board/board-types.ts`
- Modify: `components/variants/report/board/BoardMap.tsx`
- Modify: `components/variants/report/board/neighbourhood/NeighbourhoodSurface.tsx`
- Test: `components/variants/report/board/BoardMap.test.tsx`

**Approach:**
- Utvid `MapCameraApi` med en ramme som tar et eksplisitt punktsett. `computeFitBounds(poiCoords, home)` i `board-camera-fit.ts` bærer allerede signaturen. `fitVisible()` rammer hele kategorien og er derfor ikke nok for R11.
- Rammen padder for sheetens FAKTISKE høyde, lest gjennom kanalen fra Unit 5.
- I steds-fanen strammes rammen til stedene alene; i ord-fanene står boligen med, fordi teksten handler om området sett fra døra.
- Markør-fremheving: stoppets kategori står fram, resten dempes, via `isVisible`-flagget som allerede fader `opacity` og `scale`. Hard 0↔1 er eksplisitt uønsket i denne fila.
- Kameraet flyr til et sted som ÅPNES, etter at teksten har rukket å komme, aldri på en lukking. En ventende bevegelse avbrytes når en ny starter.

**Execution note:** 2D fitter IKKE automatisk på `SELECT_CATEGORY` utenfor audio-tour. En endring som bare dispatcher og forventer at kartet følger etter, er død her.

**Patterns to follow:**
- `components/variants/report/board/neighbourhood/CategoryPage.tsx` — hvorfor 2D må kalle rammingen selv.
- `components/variants/report/board/BoardMap.tsx` (~linje 300–335) — `isVisible`-flagget og fade-overgangen.

**Test scenarios:**
- Happy path: stoppbytte rammer boligen og stoppets steder, ikke hele kategorien.
- Happy path: bytte til steds-fanen strammer rammen så boligen faller ut.
- Edge case: stopp med ett sted → rammen kollapser ikke til et punkt uten zoom-tak.
- Edge case: sheeten dratt til taket → rammen padder for den faktiske høyden, ikke hvileminimumet.
- Error path: kartet ikke lastet ennå → rammingen utsettes til det er, uten kast.
- Integration: stoppbytte fører til en faktisk kamerabevegelse, ikke bare et dispatch.
- Integration: å lukke et åpnet sted avbryter en ventende kamerabevegelse i stedet for å fly til et sted brukeren har forlatt.

**Verification:**
- Kartet rammer stoppets steder på et `mapbox-2d`-board, og de tre stedene er lesbare mens kategoriens øvrige punkter ligger som dempet tekstur.

---

- [ ] **Unit 7: Kartet per stopp — Google 3D**

**Goal:** 3D-kartet rammer de samme tre stedene som 2D gjør.

**Requirements:** R11, R12

**Dependencies:** Unit 6

**Files:**
- Modify: `components/variants/report/board/board-category-camera.ts`
- Modify: `components/variants/report/board/use-board-3d-camera.ts`
- Modify: `components/variants/report/board/use-board-marker-set.ts`
- Test: `components/variants/report/board/board-category-camera.test.ts`
- Test: `components/variants/report/board/__tests__/` (markør-settet)

**Approach:**
- **Dette er ikke Unit 6 med et annet kartbibliotek.** `deriveCategoryCameraConfig` har en presedenskjede: håndautorert tur → utledet A→B-bue over hele kategorien → orbit-fallback. Ingen av dem rammer stoppets tre steder, og `stasjonskvartalet` har faktisk en håndautorert tur som ville overstyrt alt.
- Omvisningen trenger derfor et nytt, høyest prioriterte nivå i kjeden, som tar stoppets koordinater. Alternativt kortsluttes kjeden når kategorien ble valgt med kilde `"walkthrough"`.
- Markør-fremheving fungerer strukturelt annerledes: 3D mounter et eksplisitt sett uten opacity-reveal, så stoppets POI-er må inn i settet `selectMarkerPOIs()` returnerer — det er ikke et flagg som kan skrus av.
- `React.memo` på markør-elementet: omvisningen bytter markør-tilstand ved hvert stopp, hver fane og hvert stedstrykk.

**Execution note:** Verifiser i en ekte 3D-scene, ikke bare i enhetstest. At stoppets POI-er ligger i det returnerte settet beviser ikke at kameraet flyttet seg dit.

**Patterns to follow:**
- `components/variants/report/board/board-category-camera.ts` — presedenskjeden som må utvides.
- `components/variants/report/board/use-board-marker-set.ts` (~linje 129–175) — `selectMarkerPOIs()`.
- `docs/solutions/feature-implementations/3d-map-real-pois-distance-opacity-20260415.md` — `React.memo` på markør-elementet.

**Test scenarios:**
- Happy path: stoppbytte gir en kamerakonfigurasjon bygget på stoppets koordinater, ikke på kategoriens.
- Edge case: **board med håndautorert kameratur** → omvisningens konfigurasjon vinner over den autorerte mens omvisningen står, og den autorerte gjelder igjen etterpå.
- Edge case: stopp med ett sted → konfigurasjonen kollapser ikke.
- Integration: stoppets POI-er er i det mountede settet, og de øvrige kategoriene er ikke.
- Integration: hurtig stoppbytte fram og tilbake etterlater ikke to konkurrerende kamerabevegelser.

**Verification:**
- Kartet rammer stoppets steder på et board med 3D-tillegg, og verifiseringsboardet (som HAR 3D) viser samme tre steder som 2D-visningen gjør.

---

- [ ] **Unit 8: Menneske-gaten**

**Goal:** Omvisningen leses og kjennes riktig på en fysisk telefon.

**Requirements:** R18

**Dependencies:** Unit 1–7

**Files:** ingen

**Approach:**

**⚠️ Denne enheten kan IKKE utføres av en agent.** En omvisning er en lesefølelse, ikke et tall. Det maskinen kan si er at rammene beregnes, at flaten ikke flytter seg og at fallbackene fyller ut — ikke om stoppet faktisk leser som at nabolaget presenterer seg. En autonom kjøring skal la denne stå åpen og si eksplisitt at R18 er delvis verifisert.

Det Andreas skal kjenne etter på `/eiendom/placy-demo/strindfjordvegen-10/rapport-board`:

- Leser stoppet som ett svar på ett spørsmål, eller som tre lister stablet oppå hverandre?
- Er to setninger nok prosa, eller for lite?
- Er «nærmeste steder» på et ukuratert board godt nok til å sende til en kunde — altså: er forskjellen mot «meglerens utvalg» stor nok til å ta penger for?
- Står flaten stille når du åpner et sted, og lander kartet der du forventer — både i satellitt og i 2D?
- Er sporet til å treffe med tommelen, og finner du tilbake til der du var?
- Skal omvisningen starte av seg selv første gang? Se Open Questions.

**Test expectation:** none — dette er en menneskelig vurdering, ikke en automatiserbar.

**Verification:**
- Andreas har kjent på omvisningen på Strindfjordvegen 10 og sagt hva som skal justeres.

## System-Wide Impact

- **Interaction graph:** Omvisningen dispatcher `SELECT_CATEGORY` med ny kilde. Alt som leser `activeCategoryId` reagerer — markør-filtreringen i 2D, kamera-directoren i 3D, `tourActive`-effekten på VO-boards (dekket av den separate planen). Kilden `"walkthrough"` gjør det mulig for et kallsted å skille omvisningens valg fra brukerens.
- **Error propagation:** Modellen i Unit 1 skal aldri kaste på tynne data. Et board uten kuratert innhold er normaltilfellet, ikke en feiltilstand.
- **State lifecycle risks:** Å avslutte omvisningen må gjenopprette kamera-snapshot OG nullstille `activeCategoryId`. Sheetens egen hvilestilling nullstilles gratis, fordi `NeighbourhoodSheet` mountes per navigasjonsgren.
- **API surface parity:** Desktop har sin egen guidede rekkefølge i `DesktopStorySidebar`, urørt her. Konsekvensen er at mobil og desktop presenterer samme innhold ulikt inntil desktop-runden er tatt.
- **Integration coverage:** De to kartmotorene er den viktigste kryssflaten, og de har hver sin enhet nettopp fordi enhetstester på markør-settet ikke beviser at kameraet flyttet seg.
- **Unchanged invariants:** `BoardPhase` får ingen ny verdi. `onHeightChange` rapporterer fortsatt hvileminimumet. `travelMode` overlever fortsatt all navigasjon. FAQ-modellen er uendret. Ingen endring i `products.config`, pipeline eller database.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Den imperative høyde-kanalen gjøres reaktiv under implementasjon og gjenåpner okklusjons-løkken | Unit 5 spesifiserer eksplisitt ref-basert lesing, og har et integrasjonsscenario som skiller faktisk høyde fra hvileminimum |
| 3D-kameraet ser ut til å virke fordi det beveger seg, men rammer kategorien og ikke stoppet | Unit 7 er en egen enhet med eget testscenario for håndautorerte turer, og en execution note om å verifisere i en ekte scene |
| `stayInDefault` glemmes, og omvisningen kaprer UI-en | Unit 2 har et reducer-testscenario som feiler nøyaktig på dette |
| Markør-tilstand endres ved hvert stopp, fane og stedstrykk → re-render av hele markør-treet | `React.memo` er dokumentert som løsningen; ligger i Unit 7 |
| Omvisningen ser tom ut på et board med tynne data | Fallback-kjeden er Unit 1s hovedansvar, med eget scenario for foreldede highlight-id-er. Verifiseringsboardet er det magreste vi har |
| Fase 1 er ikke merget til `main` | Denne planen forgrenes fra `feat/reisemate-enhet-fluid-sheet`. Merges fase 1 først, rebases denne |
| Ordet «story» smitter inn via prototypens `sty-`-prefiks | Kodenavnet `Walkthrough` er slått fast og verifisert fritt |

## Documentation / Operational Notes

- `prototypes/README.md` bærer statusetiketten «iterasjon uten dom» for `04`. Den etiketten henger etter og bør oppdateres — men filen har ukommitterte endringer fra en parallell sesjon og skal ikke røres som del av denne planen.
- Verdt et notat i `docs/solutions/` etter Unit 8: hva som skiller en guidet rekkefølge fra en indeks når begge kjører på identiske data.
- Ingen migrasjon, ingen re-provisjonering, ingen cache-bust. Omvisningen leser data som allerede ligger på boardet.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-08-26-sheet-fra-prototype-til-produksjon.md`
- **Forbilde:** `prototypes/04-fortelling-i-boardet/index.html`
- **Bygger på:** `docs/plans/2026-08-26-001-feat-reisemate-som-enhet-og-fluid-sheet-plan.md` (fase 1)
- **Fortsetter i:** `docs/plans/2026-08-26-003-feat-omvisning-paa-vo-boards-plan.md`
- **Forlatte planer med samme ord, annet innhold:** `docs/plans/2026-08-06-001-feat-story-flate-separasjon-plan-A.md`, `docs/plans/2026-08-06-002-feat-story-frame-plan-B.md`
- **Gjenbrukt FAQ-modell:** `docs/plans/2026-08-22-001-feat-faq-lokalkunnskap-niva1-plan.md`
