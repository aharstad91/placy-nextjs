---
title: "feat: Markørklikk slutter å kapre kategorien + desktop-sidebar får viewport-liste og highlights-seksjon"
type: feat
status: complete
date: 2026-08-13
origin: docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md
---

# feat: Markørklikk slutter å kapre kategorien + desktop-sidebar får viewport-liste og highlights-seksjon

## Overview

Tre endringer på rapport-boardets nabolagsflate, utløst av Andreas' gjennomgang 2026-08-13:

1. **Markørklikk skal bare åpne punktet.** I dag setter `OPEN_POI` også `activeCategoryId`, som filtrerer kartet til POI-ens kategori og driller desktop-sidebaren inn i kategori-panelet. Én klikk gir tre konsekvenser, og veien tilbake er en tilbake-pil øverst til venstre som ingen leter etter.
2. **Desktop-sidebarens kategori-panel får mobilsheetens dynamikk.** «Verdt å merke seg» blir en egen, kollapsbar seksjon øverst, og under den kategoriens punkter som faktisk ligger i kartutsnittet — samme modell mobilsheeten bruker.
3. **Bug: listerader viser feil ikon og farge.** Radene hardkoder et nål-ikon i tema-fargen, mens kartmarkøren viser POI-ens egen sub-kategori-identitet (knivgaffel, studenthue) i dempet farge.

Endring 1 er en tilstandsmaskin-endring med bred berøringsflate og krever en forberedende avkobling; 2 og 3 er flate-arbeid som hviler på den.

## Problem Frame

Nabolagsflaten ble bygget mobil-først (origin: `docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md`). Origin-dokumentets **R20** identifiserte kategori-låsingen som feil oppførsel, men løste den kun for mobilflaten og skrev eksplisitt: *«Ingen ny board-action bygges for dette — desktop og VO-flatene beholder dagens oppførsel uendret.»*

Andreas' observasjon 2026-08-13 er at unntaket ikke holder. På desktop kaprer markørklikket fortsatt kategorien, og fordi `SidebarContentPreview` velger drill-in-visning ut fra `boardState.activeCategoryId`, bytter hele sidebaren innhold av et klikk brukeren mente som «hva er dette stedet?». **Denne planen opphever R20s carve-out og flytter fiksen ned i reduceren**, der den gjelder alle flater.

Blast-radius-sveipet avdekket at det finnes en **eksisterende bug samme endring rydder opp i**: `BACK_TO_DEFAULT` beholder `activeCategoryId` (`board-state.tsx:114-122`), så i dag gir «klikk markør i overblikk → lukk popup» et kart som står låst til den POI-ens kategori uten at noe i UI-et sier hvorfor.

Samtidig er desktop blitt den svakeste flaten på informasjon: mobilsheeten forteller «26 av 52 synlig · 1–3 min» og lister stedene i utsnittet, mens desktop — som har mest plass — viser statisk prosa og noen få chips.

## Requirements Trace

- **R1.** Klikk på en kartmarkør åpner POI-en (popup som i dag) og endrer verken `activeCategoryId` eller markørsettet.
- **R2.** Kategoribytte skjer kun ved eksplisitt kategori-handling (kategorikort, «Hele nabolaget», audio-tour-fremdrift, event-filter).
- **R3.** Desktop-sidebarens kategori-panel viser «Verdt å merke seg» som egen seksjon øverst i listeområdet.
- **R4.** Ved 2 eller flere highlights er seksjonen kollapset som default, ser tydelig klikkbar ut, og fungerer som toggle.
- **R5.** Under highlights står kategoriens punkter i kartutsnittet, med gangtid, oppdatert når brukeren panorerer — bygget på `buildNeighbourhoodList`.
- **R6.** Dekningen kommuniseres ærlig («9 av 17 synlig»), og brukeren har en vei tilbake til hele kategorien når utsnittet skjuler punkter.
- **R7.** Ikon og farge på en POI-rad er identisk med POI-ens kartmarkør, avledet på ett sted.
- **R8.** Ingen kamera-løkke: listas scope endres kun av brukerinitierte kart-gester (R12-invarianten utvidet til desktop).
- **R9.** POI-detaljer (popup, rutelinje, 3D-kamerafly, label) fungerer uavhengig av om en kategori er aktiv.

## Scope Boundaries

- Mobilflatens `CategoryPage` beholder R16 (hele kategorien, ingen utsnitts-scoping) i denne runden — desktop og mobil får bevisst ulik oppførsel, begrunnet under Key Technical Decisions.
- Ingen endring i hvilke POI-er som finnes på boardet, i seeding, kategorisering eller editorial.
- Ingen endring i «Utforsk»-CTA-ens destinasjon eller innhold.
- Ingen ny audio-/VO-oppførsel; audio-tourens kategori-fremdrift er uendret.
- Ingen visuell redesign av sidebarens hero, prosa eller megler-footer.
- Ingen endring i 2D-kartets bevisste valg om å IKKE flytte kameraet ved markørklikk.

### Deferred to Separate Tasks

- **Hvilke 3–10 punkter megleren løfter fram som «Verdt å merke seg», og sorteringen bak dem:** Andreas 2026-08-13 — «funksjon bak dette og sorteringa må vi komme tilbake til». Denne planen bruker eksisterende `editorial.highlights` uendret.
- **Highlights-seksjon på mobilens `CategoryPage`:** Andreas — «må vi nok få til på mobil også etterhvert». Egen runde, etter at desktop-mønsteret er validert.
- **Manglende `poi_clicked`-emit i 2D-kartet:** sveipet avdekket at `BoardMap3D` emitter `poi_clicked` med `category_id` ved markørklikk, mens 2D-kartet ikke emitter noe. 2D er hovedflaten på prosjekter uten 3D-addon, så Moat 2 mangler POI-signalet der. Ekte hull, men egen oppgave med egen verifisering — ikke smuglet inn i en UX-runde.
- **Utforsk-modalen** (`docs/plans/2026-08-12-001-feat-utforsk-modal-grounded-poi-plan.md`, `status: active`, 0 av 7 units gjort): planlagt, ikke bygget. Den endrer hva POI-åpning fører til på mobil; denne planen endrer hva som utløser kategori-bytte. Seamen er beskrevet under System-Wide Impact.

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/board/board-state.tsx` — reducer + Context (ikke Zustand). `OPEN_POI`-casen, `useActivePOI()`-derivasjonen, og sub-filter-effekten er alle endringspunkter.
- `components/variants/report/board/BoardMap.tsx` — `markerStates` avgjør synlighet; `publishViewport` styrer utsnitts-publisering, rotasjonslås og om `map.setPadding` kjøres; `handleMoveEnd` bærer R12-gaten; `intersectVisible(baseVisible, visiblePoiIds)` er stedet viewport-settet faktisk konsumeres.
- `components/variants/report/board/use-board-marker-set.ts` — `selectMarkerPOIs` er 3D-motstykket med samme kategori-antakelse.
- `components/variants/report/board/BoardPathLayer.tsx` — krever `activeCategory` både for å rendre og for linjefargen.
- `components/variants/report/board/board-3d-camera-director.ts` — `decideCameraIntent` gir POI forrang over kategori og fungerer allerede med `activeCategoryId: null`, forutsatt at `activePOI` faktisk leveres.
- `lib/board/neighbourhood-list.ts` — ren, testet listemodell (`buildNeighbourhoodList`): dekningsbrøk, tidsspenn, sub-kategori-diversifisering, `scoped`-degradering.
- `components/variants/report/board/neighbourhood/use-neighbourhood-list.ts` — mobilens binding: bygger lista OG skriver `setViewportPoiIds` tilbake.
- `components/variants/report/board/neighbourhood/NeighbourhoodCategoryCard.tsx` — `categorySubline()` og rad-formen desktop speiler.
- `components/variants/report/reels/DesktopStorySidebar.tsx` — `SidebarContentPreview` (header + scroll-område + sticky megler-footer), `CategoryDetailView`, `POIHighlightRow`.
- `components/variants/report/board/BoardPOIMiniPopup.tsx` — den etablerte POI-identiteten: `getFilledIcon` + `markerCircleStyle`.

### Institutional Learnings

- `docs/solutions/ux-improvements/active-poi-card-pinned-sidebar-20260208.md` — **Explorer shippet en viewport-scopet sidebar-liste og fikk en high-severity bug**: den valgte raden flyttet seg, ble skjøvet under fold, eller forsvant når POI-en falt ut av utsnittet mens brukeren leste. To-delt regel: (a) hold den aktive POI-en i settet selv når den er utenfor utsnittet, (b) rendre den aktive raden i en `flex-shrink-0`-container OVER scroll-området og filtrer den ut av den scrollede lista. Dokumentert blindspor: å prepende POI-en i data-arrayet alene løser det ikke.
- `docs/solutions/feature-implementations/placy-basic-tier-drill-in-20260608.md` — `SidebarContentPreview` er `header (fast) + scroll-område + sticky megler-footer`, og drill-in bytter **kun** scroll-området. Highlights resolves mot det FILTRERTE board-settet; ukjente IDer droppes stille. **Verifiseringsfelle:** 2D-markører beholder DOM-identitet og fader via `isVisible` — mål derfor `opacity`, ikke antall noder, når du sjekker at synligheten endret seg.
- `docs/solutions/ux-improvements/poi-click-no-camera-move-20260207.md` — settled prinsipp: **skill på klikk-KILDE, ikke fjern oppførselen.** Et klikk på kartet er i-kontekst; et klikk fra sidebar/chip kan legitimt sette kontekst. Bær intensjonen eksplisitt på actionen i stedet for å la reduceren gjette.
- `docs/solutions/ui-bugs/useeffect-object-dependency-infinite-loop-20260410.md` — aldri en memo-derivert samling i dep-arrayet til en effekt som setter state; hold primitiver i deps. (Dokumentets forklaring av mekanismen er upresis — årsaken er identitets-churn oppstrøms, ikke at `useMemo` re-kjører — men regelen står.)
- `docs/solutions/ui-patterns/transit-dashboard-card-accordion-tabs-20260416.md` — accordion-state i et `Set` må **erstattes**, aldri muteres (`new Set(prev)`); aldri initialisere åpen-state fra `array[0]`; foretrekk data-derivert boolean (`highlights.length >= 2`) over en `showX`-prop.
- `docs/solutions/ui-patterns/trip-desktop-accordion-sidebar-20260209.md` — husets expand/collapse-oppskrift: rendre begge tilstander og toggle med CSS (`opacity-0 h-0 overflow-hidden` ↔ synlig, `transition-all duration-300`); hold interaktive elementer UTENFOR den ytre `<button>`. Nyere preferanse overstyrer auto-scroll-delen: ingen auto-scroll ved ekspandering.
- `docs/solutions/feature-implementations/3d-map-real-pois-distance-opacity-20260415.md` — `React.memo` på markør-komponenten er det som holder 103 markører fra å re-rendre ved hvert klikk; en delt derivasjon må returnere referanse-stabile primitiver, ellers er memoen tapt.
- `docs/solutions/ui-bugs/report-subsection-markers-layout-overlap-20260210.md` — når du innfører et nytt scope for POI-oppslag, verifiser at ALLE konsumenter leser samme kilde (markør-render, synlighet, kamera-fit).

## Key Technical Decisions

- **`useActivePOI()` avkobles fra kategorien FØR reduceren endres.** Hooken finner i dag POI-en ved å søke i den aktive kategorien; uten kategori returnerer den null og popup, rutelinje, 3D-kamerafly og label faller stille bort. Oppslaget må gå på tvers av `data.categories`. Dette er planens eneste ekte fallgruve og får derfor egen enhet først.
- **`OPEN_POI` slutter å eie kategorien, men beholder det valgfrie `categoryId`-feltet.** Kallesteder som legitimt ETABLERER kategori-kontekst (event-panelet, «Verdt å merke seg»-chips) sender det fortsatt; kartmarkørene slutter å sende det. Dette er «skill på klikk-kilde»-prinsippet fra februar-læringen, uttrykt i action-formen. Reduceren slutter å bryte ut når feltet mangler, og skal verken sette ELLER nullstille `activeCategoryId` — nullstilling ville lukket nivå-2-panelet under brukeren når hen klikker en highlight-chip.
- **Markørsynlighet betinges av «ingen aktiv kategori», ikke av fasen.** `markerStates` viser i dag alt kun i `phase === "default"`; med R1 finnes `phase === "poi"` uten kategori, og dagens kode gir da tomt markørsett. Betingelsen må hvile på `activeCategory` alene.
- **Rutelinjen tar kategorien fra POI-en, ikke fra state.** `BoardPathLayer` bruker `activeCategory` til farge og som render-gate; begge byttes til POI-ens egen kategori, som alltid finnes.
- **Desktop scoper lista på utsnittet, mobilens kategoriside gjør det ikke.** R16s begrunnelse («se alle 17» blir en løgn) gjelder en fullskjerms push på telefon der lista ER flaten. På desktop står lista ved siden av kartet og leses samtidig med det — da er «det du ser på kartet» det ærlige svaret. Innvendingen adresseres med dekningsbrøk + en «ramm inn kategorien»-handling, ikke ved å skjule at noe er utenfor.
- **Highlights er ALDRI utsnitts-filtrert.** Seksjonen er meglerens redaksjonelle utvalg for strøket; at brukeren har panorert vestover skal ikke fjerne den. Bare den dynamiske lista følger utsnittet — derfor to visuelt skilte seksjoner, ikke én sortert liste.
- **Den åpne POI-ens rad pinnes utenfor scroll-området.** Direkte konsekvens av Explorer-buggen fra februar: uten dette mister brukeren raden hen leser ved å panorere.
- **Desktop-lista skriver ikke markør-state.** Mobilens hook skriver `setViewportPoiIds`, som både begrenser markører (via `intersectVisible`) og gater kamera-fit. På desktop ville det gitt løkken utsnitt → liste → markørsett → `fitVisible` → nytt utsnitt. Desktop får en ren LESE-hook over samme modell.
- **`publishViewport` splittes.** Flagget bærer i dag tre ting: publiser rektangelet, lås kart-rotasjonen, og hopp over `map.setPadding`. De to siste er mobilsheet-spesifikke. Desktop trenger det første og må beholde `mapPaddingLeft` og default-rotasjon.
- **Én delt derivasjon av POI-identitet, plassert i en eksisterende seam.** `lib/utils/map-icons.ts` ble opprettet nettopp som «shared icon resolution», og `marker-style.ts`/`muted-palette.ts` er de etablerte hjemmene for farge. Derivasjonen legges i en av dem framfor å åpne en tredje sti, og returnerer primitiver (ikon-navn + hex) så `React.memo` på markøren fortsatt biter.

## Open Questions

### Resolved During Planning

- *Skal highlights-accordionen være åpen eller lukket som default?* Lukket ved 2+; ved presis 1 highlight rendres raden direkte uten accordion — en toggle med ett element leser som en feil.
- *Trenger vi en ny board-action for POI-åpning uten kategori?* Nei. Reducer-endringen dekker det; en ny action ville gitt to veier til samme tilstand.
- *Hvordan unngå at desktop-lista og kamera-fitten jager hverandre?* Lese-hook uten `setViewportPoiIds`, kombinert med at publiseringen allerede er gatet på brukergest.
- *Skal `OPEN_POI` nullstille kategorien for å «rydde»?* Nei — highlight-chips inne i kategori-panelet ville da lukket panelet de ble klikket fra.
- *Er `BACK_TO_DEFAULT`s bevaring av kategorien et problem vi må løse her?* Den er en reell bug i dag, men blir uskadelig når markørklikk ikke lenger setter kategorien. Ingen egen fiks; dekkes av testen for «lukk popup i overblikk».

### Deferred to Implementation

- Om `BoardMap3D`s markørsett trenger en eksplisitt union-garanti for den åpne POI-en: på VO-boards er overblikks-settet et ankersett, og et POI-klikk kan i teorien falle utenfor det. I praksis kan brukeren bare klikke det som er tegnet. Avgjøres når 3D-testen skrives.
- Presis plassering av den delte derivasjonen (`marker-style.ts` kontra `lib/themes/muted-palette.ts` kontra ny fil i `lib/board/`) — velges når begge kallestedene er sett samtidig.
- Om sub-filter-effekten i `board-state.tsx` trenger mer enn å tåle `activeCategoryId: null`, eller om guarden kan stå som den er.
- Om desktop-lista trenger virtualisering: `ferjemannsveien-10` har 284 POI-er. Måles i browser-verifiseringen før noe bygges.

## High-Level Technical Design

> *Dette illustrerer intensjonen og er retningsgivende for review, ikke en implementasjonsspesifikasjon. Den implementerende agenten skal lese det som kontekst, ikke som kode å reprodusere.*

Dagens kobling — én klikk, fire effekter, og en skjult avhengighet:

```
markørklikk ──> OPEN_POI{categoryId} ──> activeCategoryId satt
                                    ├──> markerStates: kun kategoriens pins
                                    ├──> SidebarContentPreview: drill-in-panel
                                    ├──> phase "poi": popup åpnes
                                    └──> useActivePOI() finner POI-en
                                         KUN fordi kategorien er satt  ◀── fellen
```

Etter endringen:

```
markørklikk ──> OPEN_POI{}          ──> phase "poi" + activePOIId
                                    └──> popup/rute/label via kategori-uavhengig oppslag
                                         (kategori urørt, alle pins står)

kategoriklikk ─> SELECT_CATEGORY    ──> activeCategoryId satt
                                    ├──> markerStates: kategoriens pins
                                    └──> sidebar: kategori-panel
```

Desktop kategori-panel, ovenfra og ned:

```
[hero]  [Kategorinavn]  [9 av 17 synlig · 4–21 min]
[prosa]
┌─ VERDT Å MERKE SEG ───────────── (3) ─ ▾ ┐   ← kollapset default ved 2+, toggle
│  (ikon-klynge som antyder innholdet)     │
└──────────────────────────────────────────┘
[åpen POI-rad — pinnet, utenfor scroll]        ← overlever panorering
I UTSNITTET  (scroll-område)
  Rødbrygga Inderøy                  6 min
  Marens Bakeri                      7 min
  …
  8 steder ligger utenfor utsnittet · [Ramm inn kategorien]
```

## Implementation Units

- [x] **Unit 1: Kategori-uavhengig oppslag av aktiv POI**

**Goal:** POI-detaljer (popup, rutelinje, label, 3D-kamerafly) fungerer uten at en kategori er aktiv. Ren forberedelse — ingen synlig atferdsendring ennå.

**Requirements:** R9

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/board-state.tsx` (`useActivePOI`, sub-filter-effekten)
- Modify: `components/variants/report/board/BoardPathLayer.tsx` (render-gate + linjefarge fra POI-ens egen kategori)
- Test: `components/variants/report/board/board-state.test.ts`
- Test: `components/variants/report/board/__tests__/` *(BoardPathLayer-dekning legges der board-testene bor)*

**Approach:**
- `useActivePOI` slår opp `activePOIId` på tvers av `data.categories` i stedet for i den aktive kategorien. `data.poisById` finnes, men gir rå `POI` med lowercased nøkkel — POI-detaljene trenger `BoardPOI` (som bærer `categoryId`, `name`, `address`, `coordinates`), så oppslaget må gå over kategoriene.
- Samme oppslag brukes av rutelinjen til å finne fargen, slik at `activeCategory` ikke lenger er en render-gate der.
- Sub-filter-effekten (som sender `BACK_TO_ACTIVE` når aktiv POI-s sub-kategori skjules) må tåle at `activeCategoryId` er null — den early-returnerer på det i dag.

**Execution note:** Karakteriseringsdekning først: skriv testene som beviser at popup/rute finner POI-en MED kategori aktiv, før oppslaget byttes. Da fanges en regresjon i eksisterende oppførsel før den nye grenen legges til.

**Patterns to follow:**
- `components/variants/report/board/BoardPOIMiniPopup.test.tsx` mocker `useActivePOI` direkte — bevis på at popup-skallet allerede er kategori-agnostisk.

**Test scenarios:**
- Happy path: `activePOIId` satt + kategori aktiv → POI-en returneres (uendret oppførsel).
- Happy path: `activePOIId` satt + `activeCategoryId: null` → POI-en returneres (i dag: null).
- Edge case: POI-en finnes i to kategorier → første forekomst returneres deterministisk.
- Edge case: `activePOIId` peker på en id som ikke finnes på boardet → null, ingen kast.
- Edge case: `activePOIId: null` → null uansett kategori-tilstand.
- Integration: rutelinjen rendrer og får farge når POI er åpen uten aktiv kategori.
- Error path: sub-filter-effekten kaster ikke og sender ikke `BACK_TO_ACTIVE` når `activeCategoryId` er null.

**Verification:**
- Popup, rutelinje og label oppfører seg identisk som før for alle dagens flyter (kategori aktiv), og finner POI-en også uten kategori.

---

- [x] **Unit 2: `OPEN_POI` slutter å kapre kategorien**

**Goal:** Et markørklikk setter kun `phase: "poi"` + `activePOIId`. Kategorien endres bare av eksplisitte kategori-handlinger, og alle markører står.

**Requirements:** R1, R2

**Dependencies:** Unit 1

**Files:**
- Modify: `components/variants/report/board/board-state.tsx` (`OPEN_POI`-casen)
- Modify: `components/variants/report/board/BoardMap.tsx` (markør-`onClick`, `markerStates`-betingelsen)
- Modify: `components/variants/report/board/BoardMap3D.tsx` (markør-`onClick`; behold kategori-oppslaget for `engagement.emit`)
- Modify: `components/variants/report/board/use-board-marker-set.ts` (`selectMarkerPOIs`)
- Test: `components/variants/report/board/board-state.test.ts`
- Test: `components/variants/report/board/BoardMap.test.tsx`
- Test: `components/variants/report/board/use-board-marker-set.test.ts`

**Approach:**
- Reduceren beholder valgfritt `categoryId`, fjerner no-op-grenen når det mangler, og lar `activeCategoryId` stå urørt.
- `markerStates`: «vis alt når ingen kategori er aktiv» erstatter «vis alt når fasen er default og ingen kategori».
- 3D: samme dispatch-endring; kategori-oppslaget i klikk-handleren beholdes fordi analytics-emiten trenger `category_id`.
- Foreldede kommentarer ryddes der de nå lyver — særlig kommentaren i `BoardMap` om at `default→poi` gir ny `visiblePOIs`-identitet, og `shouldFitToProgram`-kommentaren om at ro-tilstand alltid betyr «phase default».

**Execution note:** Reducer-testene først. Fem eksisterende tester pinner dagens kategori-kapring som ønsket oppførsel (`board-state.test.ts`, `OPEN_POI`-blokken) og må rives bevisst, med begrunnelse i commit-meldingen — ikke ved uhell.

**Patterns to follow:**
- `components/variants/report/board/neighbourhood/NeighbourhoodSurface.test.tsx` (R20-testene) — samme invariant, god mal for de nye assertions.

**Test scenarios:**
- Happy path: `OPEN_POI` uten `categoryId` og med `activeCategoryId: null` → `phase: "poi"`, `activePOIId` satt, kategori fortsatt null (i dag: uendret state).
- Happy path: `OPEN_POI` uten `categoryId` mens en kategori ER aktiv → kategorien beholdes.
- Happy path: `OPEN_POI` MED `categoryId` (event/chip-stien) → kategorien settes som før.
- Edge case: markørklikk uten aktiv kategori → POI-er i ANDRE kategorier har fortsatt `isVisible: true` (mål opacity/flagg, ikke nodeantall — markørene beholder DOM-identitet).
- Edge case: markørklikk mens en kategori er aktiv → markørsettet er fortsatt kategoriens, ikke utvidet.
- Edge case (3D): `selectMarkerPOIs` med `statePhase: "poi"` + `activeCategory: null` → overblikks-settet, ikke tomt.
- Integration: lukk popup (`BACK_TO_DEFAULT`) etter markørklikk i overblikk → alle markører står fortsatt (dagens skjulte kategori-lås er borte).
- Integration: sidebarens drill-in-betingelse forblir usatt ved markørklikk → sidebaren bytter ikke visning.

**Verification:**
- Klikk markør i browser: popup åpnes, alle pins står, sidebaren står stille. Klikk kategorikort: filtrering som før.

---

- [x] **Unit 3: Delt POI-visuell identitet (bug-fiksen)**

**Goal:** Ikon og farge for en POI avledes på ett sted og brukes av både kartmarkør og listerader.

**Requirements:** R7

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/marker-style.ts` *(eller `lib/themes/muted-palette.ts` — velges ved implementering, ingen tredje sti)*
- Modify: `components/variants/report/board/BoardMap.tsx` (`markerStates` bruker derivasjonen)
- Modify: `components/variants/report/reels/DesktopStorySidebar.tsx` (`POIHighlightRow`)
- Test: `components/variants/report/board/marker-style.test.ts` *(opprettes hvis den ikke finnes)*
- Test: `components/variants/report/reels/DesktopStorySidebar.test.tsx`

**Approach:**
- Derivasjonen tar POI-ens sub-kategori-ikon/farge med kategoriens som fallback og returnerer ikon-navn + hex — primitiver, så `React.memo` på `BoardMarker` fortsatt biter.
- Radene rendrer identiteten som kart-popupen gjør (fylt ikon i sirkel-stilen), slik at raden og pinnen leses som samme sted.
- `editorial.highlights` bærer bare `id`/navn/sanntids-IDer, så raden må finne POI-ens sub-kategori. Sidebaren mottar allerede `categories: BoardCategory[]`; oppslaget bruker den framfor å duplisere data inn i `previewCategories`.

**Patterns to follow:**
- `components/variants/report/board/BoardPOIMiniPopup.tsx` for identitets-presentasjonen.
- `components/variants/report/board/BoardMap.tsx` `markerStates` for dagens korrekte derivasjon.

**Test scenarios:**
- Happy path: POI med egen sub-kategori-farge og -ikon → dempet sub-kategori-farge + sub-kategoriens ikon.
- Edge case: POI uten sub-kategori-farge → kategoriens farge.
- Edge case: POI uten sub-kategori-ikon → kategoriens ikon.
- Edge case: hex som ikke finnes i `MUTED_BY_HEX` → returneres uendret (ingen `undefined` inn i `backgroundColor`).
- Edge case: highlight-POI som ikke finnes i `categories`-propen → raden rendrer med kategoriens identitet, ikke krasj (ukjente IDer droppes stille oppstrøms).
- Integration: highlight-rad for et restaurant-POI gir samme ikon-navn som markøren for samme POI.

**Verification:**
- Screenshot av «Mat & Drikke»-panelet: radene viser knivgaffel/kaffe som matcher pinnene, ikke tre identiske nåler.

---

- [x] **Unit 4: Skill utsnitts-publisering fra sheet-oppførsel**

**Goal:** `BoardMap` kan publisere kartutsnittet uten å låse rotasjonen og droppe `map.setPadding`, slik at desktop kan lese utsnittet uten å arve mobilsheetens kompromisser.

**Requirements:** R5, R8

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx`
- Modify: `components/variants/report/reels/ReportReelsPage.tsx` (desktop-grenen skrur på publisering)
- Test: `components/variants/report/board/BoardMap.test.tsx`

**Approach:**
- Behold `publishViewport` som «publiser rektangelet + tell gester». Flytt rotasjonslåsen og padding-unntaket til en egen, eksplisitt sheet-betingelse som bare mobilflaten setter. Begrunnelses-kommentarene følger med til sitt nye sted.
- Desktop beholder `mapPaddingLeft` og Mapbox' default-rotasjon.
- R12-gaten i `handleMoveEnd` er uendret: kun bevegelser med `originalEvent` publiserer, så `fitVisible()` ved kategorivalg re-scoper ikke lista.
- `cameraApi` registreres i dag kun når `publishViewport` er på — desktop får dermed `fitVisible()` tilgjengelig, som Unit 7 trenger til «ramm inn kategorien».

**Test scenarios:**
- Happy path: publisering på + sheet-oppførsel av → `map.setPadding` kalles og rotasjon forblir aktiv.
- Happy path: sheet-oppførsel på → padding hoppes over og rotasjon deaktiveres (dagens mobil-oppførsel bevart).
- Happy path: brukerinitiert `moveend` publiserer rektangel; programmatisk `moveend` (uten `originalEvent`) publiserer ikke.
- Edge case: okkludert høyde ≥ kartets høyde → rektangelet publiseres som `null` (vis alt), aldri tomt sett.
- Integration: `cameraApi` er registrert på desktop etter endringen.

**Verification:**
- Desktop: panorering oppdaterer utsnittet, kartet hopper ikke ved montering, rotasjon virker.
- Mobil: sheet-drag flytter ikke kartet.

---

- [x] **Unit 5: Lese-hook for utsnitts-scopet kategori**

**Goal:** En hook som gir kategoriens punkter i utsnittet, uten å skrive markør-state.

**Requirements:** R5, R6, R8

**Dependencies:** Unit 4

**Files:**
- Create: `components/variants/report/board/neighbourhood/use-viewport-category-list.ts`
- Create: `components/variants/report/board/neighbourhood/use-viewport-category-list.test.tsx`

**Approach:**
- Gjenbruk `buildNeighbourhoodList` med én kategori og uten rad-tak — som `CategoryPage` gjør, men MED rektangel.
- Hold `west/south/east/north` som primitiver i dep-arrayet og bygg rektangelet inne i memoen.
- Ingen `setViewportPoiIds`, ingen effekt som skriver til provideren.
- Returner radene, dekningstallene og antallet utenfor utsnittet, samt den åpne POI-en når den faller utenfor — data-halvdelen av pinne-regelen fra Explorer-læringen.

**Test scenarios:**
- Happy path: rektangel som dekker to av tre punkter → to rader, `visibleCount` 2, `totalCount` 3.
- Happy path: punkt uten gangtid → rad uten minutt-tall, sortert sist.
- Edge case: ingen punkter i utsnittet → tom radliste og `visibleCount` 0 (ikke degradering til «vis alt»).
- Edge case: `viewportRect` null → alle punkter, `scoped` false.
- Edge case: aktiv POI utenfor utsnittet → rapporteres separat, ikke tapt.
- Edge case: hooken kaller ALDRI `setViewportPoiIds` (spy verifiserer).

**Verification:**
- Begge degraderingsveier dekket; markør-spyen står urørt.

---

- [x] **Unit 6: «Verdt å merke seg» som kollapsbar seksjon**

**Goal:** Highlights samles i en kompakt, tydelig klikkbar gruppe øverst, kollapset ved 2+, med toggle-oppførsel.

**Requirements:** R3, R4

**Dependencies:** Unit 3

**Files:**
- Create: `components/variants/report/reels/HighlightsDisclosure.tsx`
- Create: `components/variants/report/reels/HighlightsDisclosure.test.tsx`
- Modify: `components/variants/report/reels/DesktopStorySidebar.tsx` (`CategoryDetailView` bruker komponenten)

**Approach:**
- Kollapset: seksjonstittel, antall, og en tett klynge av POI-identitets-sirklene — nok til å love innhold uten å spise høyde.
- Ekspandert: dagens `POIHighlightRow`-liste uendret, inkludert sanntidsblokken for transport.
- Toggle med `aria-expanded`; CSS-drevet expand/collapse etter husmønsteret (begge tilstander i DOM, `opacity-0 h-0 overflow-hidden` ↔ synlig). Ingen auto-scroll ved åpning.
- Interaktive rader ligger UTENFOR toggle-knappen (ingen nøstede knapper).
- Vises kun ved ≥1 highlight, og accordion kun ved ≥2 — data-derivert, ingen `showX`-prop.
- Vanlige lister og knapper, ikke `role="listbox"`/`role="option"`.

**Test scenarios:**
- Happy path: 3 highlights → kollapset ved montering, antall «3» vist, radene ikke synlige.
- Happy path: klikk → radene synlige, `aria-expanded` true; nytt klikk → skjult, `aria-expanded` false.
- Edge case: 1 highlight → ingen toggle, raden umiddelbart synlig.
- Edge case: 0 highlights → seksjonen rendres ikke.
- Edge case: transport-highlight beholder sanntidsblokken i ekspandert tilstand.
- Integration: klikk på en highlight-rad kaller `onOpenPoi` med POI-ens id og bryter ikke accordion-tilstanden.

**Verification:**
- Panelet er merkbart kortere ved 3 highlights enn i dag, og hele lista er ett klikk unna.

---

- [x] **Unit 7: Kategori-panelet får dynamisk liste og ærlig dekning**

**Goal:** Desktop-sidebarens kategori-panel viser highlights øverst, den åpne POI-en pinnet, og kategoriens punkter i utsnittet under — med dekningstall og vei tilbake til hele kategorien.

**Requirements:** R3, R5, R6

**Dependencies:** Unit 5, Unit 6

**Files:**
- Modify: `components/variants/report/reels/DesktopStorySidebar.tsx` (`CategoryDetailView`)
- Test: `components/variants/report/reels/DesktopStorySidebar.test.tsx`

**Approach:**
- Panelet finner sin `BoardCategory` via `categories`-propen sidebaren allerede mottar, og mater Unit 5-hooken.
- Underoverskriften bruker `categorySubline`-formen («9 av 17 synlig · 4–21 min»).
- Layouten holder seg innenfor drill-in-seamen: kun scroll-området byttes, så den sticky megler-footeren står. Highlights-seksjonen og den pinnede aktive raden ligger i `flex-shrink-0`-containere over scroll-området, og den aktive raden filtreres ut av den scrollede lista for å unngå duplikat.
- Punkter utenfor utsnittet: avsluttende rad med antall + «ramm inn kategorien» (`mapCamera.fitVisible()`, programmatisk → re-scoper ikke lista).
- Ingenting synlig: tom tilstand med samme handling som eneste innhold; highlights står fortsatt.

**Test scenarios:**
- Happy path: kategori med punkter i utsnittet → highlights øverst, deretter rader i gangtidsrekkefølge.
- Happy path: utsnittet skjuler noen punkter → «X av Y synlig» + «utenfor utsnittet»-rad med riktig antall.
- Edge case: alle punkter utenfor utsnittet → tom tilstand med reframe-handling, highlights fortsatt synlig.
- Edge case: kategori uten highlights → ingen seksjon, lista står alene uten tomt hull.
- Edge case: kategori uten `editorial` → panelet vises ikke (dagens drill-in-gating uendret).
- Edge case: åpen POI faller utenfor utsnittet ved panorering → raden står pinnet, forsvinner ikke.
- Integration: nytt `viewportRect` i provideren oppdaterer rader og brøk uten at markørsettet endres.

**Verification:**
- Panorer på desktop: lista følger kartet, markørene står, kameraet står stille, og raden du leste er fortsatt der.

---

- [x] **Unit 8: Browser-verifisering mot akseptansekriteriene**

**Goal:** Bekrefte at endringene virker på begge flater, ikke bare i testene.

**Requirements:** R1–R9

**Dependencies:** Unit 1–7

**Files:**
- Modify: `PROJECT-LOG.md`

**Approach:** Chrome DevTools MCP mot `/eiendom/placy-demo/sundsoya/rapport-board` og `/eiendom/placy-demo/oppdal-sentrum/rapport-board`, desktop 1440×900 og mobil 390×844×3 (touch). Markørsynlighet måles på `opacity`/`isVisible`, ikke på antall DOM-noder.

**Akseptansekriterier:**
1. Desktop: klikk markør → popup åpnes, sidebaren står stille, alle pins synlige.
2. Desktop: klikk kategorikort → panel + kategori-filtrering som før.
3. Desktop: highlights kollapset ved 2+, ekspanderer og kollapser på klikk.
4. Desktop: highlight-radenes ikon/farge matcher pinnene.
5. Desktop: panorering endrer liste og brøk; markørsett og kamera står stille.
6. Desktop: «ramm inn kategorien» henter tilbake hele kategorien uten løkke.
7. Desktop: den åpne POI-ens rad overlever panorering ut av utsnittet.
8. Mobil: sheet-liste, dekningsbrøk og kategoriside uendret; sheet-drag flytter ikke kartet.
9. Mobil: markørtap kaprer ikke kategorien.
10. Rutelinje og (på 3D-board) kamerafly virker ved POI-åpning uten aktiv kategori.
11. Konsollen er fri for feil på begge flater.

**Test scenarios:** Test expectation: none — verifiserings- og loggføringsunit uten egen kodeendring.

**Verification:**
- Alle elleve kriterier bekreftet; `npm run lint`, `npx tsc --noEmit`, `npm test` og `npm run build` grønne.

## System-Wide Impact

- **Interaction graph:** `OPEN_POI` konsumeres av kart-popupene (2D + 3D), event-detaljpanelet, reels/audio-syncen og sidebarens drill-in-gating. Actionens signatur er uendret, så kallesteder som bevisst sender `categoryId` er upåvirket. Reels-syncens `phase === "poi"`-guard (`ReportReelsPage`) må BEHOLDES — den hindrer at audio-fremdrift wiper et POI-valg i samme tick, uavhengig av kategori.
- **Skjult avhengighet som endres:** `useActivePOI()` er i dag derivert fra `useActiveCategory()`. Alt POI-relatert UI henger på den. Unit 1 finnes utelukkende for dette.
- **Seam mot Utforsk-modalen:** `docs/plans/2026-08-12-001-feat-utforsk-modal-grounded-poi-plan.md` (aktiv, ubygd) planlegger at POI-tap på mobil åpner en modal direkte og leser `activePOIId`, ikke `activeCategoryId`. Den blir enklere av denne endringen, men rekkefølgen må stå i worklogen så neste sesjon ikke tror de er uavhengige.
- **Error propagation:** Alle degraderinger går mot «vis mer», aldri mot tomt: manglende rektangel → vis alt; manglende gangtid → rad uten minutt-tall; ukjent farge → uendret hex; ukjent POI-id → null uten kast.
- **State lifecycle risks:** `phase: "poi"` uten `activeCategoryId` er en NY gyldig tilstand. `phase === "active"` produseres i dag av `SELECT_CATEGORY` uten `source` og av `BACK_TO_ACTIVE`, men leses ingen steder — fasen fungerer i praksis som «ikke default» og skrur på sub-filteret. Sub-filteret resettes når `activeCategoryId` endres; etter endringen resettes det ikke lenger av markørklikk, som er ønsket.
- **API surface parity:** 2D (`markerStates`) og 3D (`selectMarkerPOIs`) har samme kategori-antakelse og må endres likt, ellers oppstår avviket bare på 3D-boards. 3D flyr inn til POI-en ved klikk; 2D står bevisst stille — asymmetrien er dokumentert og beholdes.
- **Integration coverage:** Panorering → liste → markører er en kryss-lags-løkke enhetstester ikke beviser; kriterium 5, 6 og 7 i Unit 8 finnes for det.
- **Unchanged invariants:** `SELECT_CATEGORY` (alle kilder), audio-tourens kategori-fremdrift, event-boardets filter-/samlings-oppførsel, `CategoryPage`s `fitVisible()`-effekt (går via `SELECT_CATEGORY`, ikke `OPEN_POI`), mobilens R16, «Utforsk»-CTA-ens destinasjon, `shouldFitToFilter`-gaten, og hele seed-/editorial-kjeden.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `useActivePOI` brytes og POI-UI dør stille (ingen feilmelding, bare ingenting) | Unit 1 lander først med karakteriseringstester før oppslaget byttes; kriterium 10 i browser dekker rute + 3D-kamera |
| Eksisterende tester pinner kategori-kapringen som ønsket oppførsel og «beviser» at endringen er feil | Unit 2 skriver reducer-testene først; hver fjernet assertion begrunnes i commit-meldingen |
| Markørsynlighet verifiseres på nodeantall og ser uendret ut selv når fiksen virker | Unit 8 måler `opacity`/`isVisible` — regelen står i tre av læringsdokumentene |
| Desktop-lista mister raden brukeren leser når hen panorerer (Explorer-buggen fra februar, high severity) | Aktiv POI beholdes i datasettet (Unit 5) OG pinnes utenfor scroll-containeren (Unit 7); kriterium 7 verifiserer |
| Desktop-publisering av utsnittet trigger kamera-løkke | Lese-hook uten markør-skriving (Unit 5) + R12-gaten beholdt (Unit 4) + kriterium 5/6 |
| Å skru på publisering brekker desktops kart-padding eller rotasjon | Unit 4 skiller effektene FØR desktop skrus på, med test for begge grener |
| Delt derivasjon bryter `React.memo` på markøren → 100+ markører re-rendrer per klikk | Derivasjonen returnerer primitiver, ikke objekter, inn i `BoardMarker`-propene |

## Documentation / Operational Notes

- Worklog-oppføring i `PROJECT-LOG.md` som del av Unit 8, med tre ting tydelig notert: opphevingen av R20s desktop-carve-out, desktop-avviket fra R16, og at `poi_clicked` fortsatt mangler i 2D-kartet. Ellers leser neste sesjon koden som en inkonsistens.
- Ingen migrasjon, ingen miljøvariabler, ingen deploy-rekkefølge. Rent klientlag.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md` (R10–R26; R16 og R20 direkte berørt)
- Relatert plan: `docs/plans/2026-08-03-001-feat-mobil-nabolagsflate-plan.md`
- Relatert plan (aktiv, ubygd): `docs/plans/2026-08-12-001-feat-utforsk-modal-grounded-poi-plan.md`
- Kode: `components/variants/report/board/board-state.tsx`, `BoardMap.tsx`, `BoardMap3D.tsx`, `BoardPathLayer.tsx`, `use-board-marker-set.ts`, `lib/board/neighbourhood-list.ts`, `components/variants/report/reels/DesktopStorySidebar.tsx`
- Læringer: `active-poi-card-pinned-sidebar-20260208`, `placy-basic-tier-drill-in-20260608`, `poi-click-no-camera-move-20260207`, `useeffect-object-dependency-infinite-loop-20260410`, `transit-dashboard-card-accordion-tabs-20260416`, `trip-desktop-accordion-sidebar-20260209`, `3d-map-real-pois-distance-opacity-20260415`, `report-subsection-markers-layout-overlap-20260210`
