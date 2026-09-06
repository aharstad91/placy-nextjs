---
title: Oppfølging etter kodegjennomgang — reisemåte som enhet + fluid sheet
status: ready
created: 2026-08-26
source_plan: docs/plans/2026-08-26-001-feat-reisemate-som-enhet-og-fluid-sheet-plan.md
source_review: .context/compound-engineering/ce-code-review/20260826-lfg-reisemate/
branch: feat/reisemate-enhet-fluid-sheet
---

# Oppfølging — bevisst utsatt fra gjennomgangen 2026-08-26

Sju gjennomgangere kjørte mot branchen. Tre funn ble fikset i `31fd853`. Disse
fem ble bevisst ikke fikset, hver med sin grunn — de er ikke glemt, de er
utsatt.

## p2 — Normaliser `travelMode` ved kilden, ikke i én komponent

**Hvor:** `components/variants/report/board/board-state.tsx`

`TravelModeHeaderControl` klamper visningen sin
(`modes.includes(state.travelMode) ? state.travelMode : modes[0]`), men
`CategoryPage` og `use-neighbourhood-list` leser `state.travelMode` rått. På et
board uten gangtider ville overskriften sagt «Sykkel» mens lista viste ingen
tall. Tre gjennomgangere pekte på samme sted (adversarial P2, maintainability
P3, correctness som residual risk).

**Hvorfor ikke nå:** correctness sporte alle fire dispatch-stedene og bekreftet
at divergensen ikke er nåbar i dag — alle er gatet av samme
`useAvailableTravelModes()`, og `data.categories` bytter bare identitet ved
språkbytte, som ikke rører `travelTime`. Fiksen er en global tilstandsendring i
`BoardProvider`, utenfor planens scope, og skal ikke gjøres autonomt.

**Fiks:** en effekt i `BoardProvider` som dispatcher en korrigerende
`SET_TRAVEL_MODE` når `availableTravelModes(data.categories)` ikke lenger
inneholder `state.travelMode`. Da blir komponentens lokale klamp overflødig i
stedet for å være en maske.

## p2 — Trekk ut `usePopoverDismiss`

**Hvor:** `TravelModeHeaderControl.tsx`, `BoardPathMidpointMarker.tsx`,
`BoardTravelChip3D.tsx`

Dismiss-mekanikken (capture-`pointerdown` utenfor + effekt på
`activePOIId`/`phase`) er nå ordrett kopiert tre steder. Rule of three er
tripped. Divergensen som finnes er reell (foldretning, geografisk forankring,
trigger-innhold) men rører ikke dismiss-delen.

**Hvorfor ikke nå:** berører to filer utenfor planens scope.

## p3 — `settlingRef` i sheetens render-guard

**Hvor:** `components/variants/report/board/neighbourhood/NeighbourhoodSheet.tsx`

Guarden mot at en React-render overskriver `style.height` midt i en gest er
`dragRef.current` alene. Den nullstilles synkront i `handlePointerUp`, FØR
settle-transisjonen på inntil 380 ms er ferdig — så i det vinduet er guarden en
no-op. Den er også per-peker, altså taus ved en andre samtidig touch.

Ingenting knekker i dag, men bare fordi radenes `truncate` og stabile antall
gjør `contentHeight` numerisk identisk over et modusbytte. Det er en egenskap
ved dagens innhold, ikke en garanti guarden gir.

**Fiks:** sett `settlingRef.current = true` i `settleAt`, nullstill etter
transisjonen, og utvid guarden til `dragRef.current || settlingRef.current`.

**Hvorfor ikke nå:** rører gest-kjernen, og Fase 2 (sheeten som én scroller)
skriver om nettopp den mekanismen. Bør gjøres der, ikke to ganger.

## p2 — `docs/solutions`-notatet anbefaler fortsatt magneten

**Hvor:** `docs/solutions/ui-patterns/mobil-sheet-en-scroller-tre-stopp-20260825.md`

Notatet ble skrevet 100 minutter før magneten ble fjernet, og sier fortsatt at
«ytterpunktene er magnetiske ... det er svaret her» for nøyaktig denne flaten.
Neste person som leser det vil gjeninnføre noe teamet alt har testet og avvist
på enhet.

**Hvorfor ikke nå:** fila eies av en parallell sesjon og er ucommittet i
hovedrepoet. De er varslet.

**Fiks:** `/ce-compound-refresh` snevert på magnet-seksjonen. Resten av notatet
(én-scroller-modellen, `touch-action`, capture-lytteren, `sheetAtRest`) er
uberørt og fortsatt riktig.

## p3 — Dokumenter popover-lukkemønsteret

Mønsteret «capture-fase `pointerdown` utenfor + effekt på navigasjon» lever nå
bare i kodekommentarer, brukt to steder. Ved tredje bruk bør det inn i
`docs/solutions/`. Henger sammen med `usePopoverDismiss`-uttrekket over.

## p3 — Tredje modus krever scroll på iPhone SE i ankomsttilstanden

**Hvor:** `components/variants/report/board/neighbourhood/TravelModeHeaderControl.tsx`

Målt i browser 2026-08-26 på 375×667: sheeten står på gulvet (236 px) med
hintet synlig, og panelet får taket sitt på 96 px mot en naturlig høyde på 123.
Ingenting er klippet bort — panelet ligger 2 px innenfor sheetens underkant og
er rullbart — men «Bil» ligger under folden og krever en scroll inni menyen.

**Hvorfor det er akseptabelt nå:** hintet forsvinner ved første kart-gest, og
da er plassen 148 px. Det trange tilfellet er altså kun første ankomst på den
minste skjermen vi støtter, og det er en klar forbedring fra før fiksen, da de
samme radene var usynlig avkuttet.

**Mulig fiks hvis Andreas synes det er for dårlig på enhet:** la panelet falle
tilbake til en kompakt ikon-rad (samme form som `variant="segment"`) når
plassen er under den naturlige høyden, i stedet for en rullbar vertikal liste.
Det er et designvalg, ikke en bug — ta det etter Unit 7.
