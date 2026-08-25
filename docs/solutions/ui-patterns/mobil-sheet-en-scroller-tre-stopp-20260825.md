---
title: "Mobil bottom-sheet som ÉN scroller med tre stopp — dra, scroll og slå sammen er samme bevegelse"
category: ui-patterns
module: prototypes/_shared/baseline (mobil-sheet)
date: 2026-08-25
problem_type: ui_pattern
component: frontend_stimulus
severity: high
applies_when:
  - "En drabar bottom-sheet skal fortsette som scroll i innholdet i SAMME strøk, og tilbake igjen (iOS Safari)"
  - "Scroll-posisjonen er samtidig flatens høyde, i en app som bygger DOM-en på nytt ved render"
  - "Kart eller annen flate under sheeten må kunne treffes av fingeren"
  - "Egen momentum-utrulling kombineres med snap-punkter"
  - "Touch-gester skal verifiseres med verktøy som bare kan sende mus-events"
tags: [bottom-sheet, gesture, ios-safari, touch-action, pointer-events, momentum-snap, scroll-position, prototypes]
related_components: [mapbox-gl, neighbourhood-sheet, prototypes]
---

# Mobil bottom-sheet som ÉN scroller med tre stopp

## Kontekst

Andreas har siden London-turen i august pekt på Citymapper som målestokken for mobil-flaten
(`docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md`). To spørsmål kom i tur:

1. **2026-08-04:** *«se hvordan sheet er helt dynamisk i sin posisjonering, butter smooth opplegg hvor
   bruker selv bestemmer hvor den skal plasseres. hos oss er det fast to steg, thats it. Er dette en
   begrensning pga at vi jobber i web, eller by code?»*
   Svaret var **by code** — draget skrev alt `style.height` per frame og kastet verdien ved slipp.
   Fri posisjonering med momentum og magnetiske ytterpunkter (44 px) ble bygget da, og
   `MOMENTUM_PROJECTION_MS = 190` ble satt som tallet man justerer hvis flaten lander for kort.
   (Den runden fikk brainstorm + plan, men ingen solution-doc. Dette dokumentet lukker det hullet.)
2. **2026-08-25:** *«når det er igjen 10% (ca) av høyden, stopper den selve draget av sheet-kroppen, og
   det blir da en sticky header med inline scroll i selve sheeten. slik går det også på vei tilbake»* —
   og senere: *«jeg får ikke dratt den ned noe mer enn ca 50% av høyden av viewheight. Det er jo som på
   citymapper, at brukeren drar ned sheet for å få mer plass til å bruke kartet.»*

Overgangen dra→scroll (og tilbake) er det som ikke kan bygges med to mekanismer som må gi bevegelsen
videre til hverandre. **På iOS er den overleveringen umulig i samme strøk** — se «Hvorfor» under.

## Mønsteret

Sheeten er **én scroller med en gjennomsiktig spacer over kroppen**. Fingeren flytter ETT tall,
`scrollTop`; under spacerens høyde ER tallet sheetens høyde, over den er det innholdet som går under en
fastlimt header.

```
.sheet-outer   scroller, høy som taket (0.86 av rammen), pointer-events: none, touch-action: none
  .sheet-spacer  gjennomsiktig, høy som veien fra sammenslått til taket
  .sheet         kroppen — min-høyde = TAKET, pointer-events: auto
    .grab          position: sticky, top: 0 — overkanten, og ALT som er synlig sammenslått
    .sheet-body    innholdet (IKKE en scroller)
```

Tre stopp på det samme tallet:

| Stopp | `scrollTop` | Hva som er synlig |
|---|---|---|
| Sammenslått | `0` | Bare handlen (målt høyde). Kartet får nesten hele skjermen. |
| Hvilestilling | `rest - collapsed` | Flatens normale høyde (0.34 av rammen, min 236 px) |
| Taket | `ceiling - collapsed` | 0.86 av rammen. Over dette scroller innholdet under headeren. |

**Sammenslått er handlens egen målte høyde**, ikke et rundt tall — da står tittelen igjen, og flaten
sier hva den er selv når den er borte. Ligger noe fast i rammens underkant (fortellings-prototypen har
et dekk med «Videre», `position: fixed; z-index: 35`), løftes handlen over det med et sømsted:

```js
// 04 setter denne fra paintDeck(), som alt måler dekket
state().sheetFloorInset = deckHeight;
// surfaceBounds: sammenslått = handlens høyde + det som er dekket
const collapsed = Math.min((grabH || COLLAPSED_FALLBACK_PX) + inset, rest);
```

**Magneten trekker bare når bevegelsen faktisk ville stanset nær et stopp**, og landingen regnes ut —
den gjettes ikke (se feil 1). Fri mellomposisjon beholdes; det er oppførselen fra 4. august.

## Hvorfor: iOS gir ikke bevegelsen tilbake

`touch-action: none` på scroll-containeren, og pointer-events driver `scrollTop` selv. Grunnen står i
Apples egen Safari Web Content Guide: **har iOS først klassifisert strøket som en scroll, får JS ingen
flere `pointermove` før fingeren slippes.** Da kan ikke lista gi bevegelsen tilbake til sheet-kroppen i
samme strøk — nettopp veien tilbake Andreas viste i opptaket. `vaul#153` er den samme feilen, iOS-only,
fortsatt åpen. Prisen er at farten etter slipp blir vår (`SHEET_DECAY = 0.998` er iOS' egen
bremsefaktor per millisekund).

Fire detaljer som ser ut som pynt og ikke er det:

- **`touch-action` låses ved gest-start** (Pointer Events 3 §8.2) og kan ikke byttes underveis. Oppslaget
  går fra elementet fingeren treffer opp til nærmeste scroll-container **inklusiv den**, og stopper der —
  så `none` må stå på scrolleren selv, ikke bare på en forelder.
- **`pointer-events: none` på scrolleren er bærende.** Scrolleren dekker hele takområdet; uten den
  treffer et trykk over sheeten scrolleren i stedet for kartet. Events bobler uansett `pointer-events`,
  så lytterne våre hører kroppen likevel. Verifiser med `document.elementFromPoint`, ikke ved å se på det.
- **Trykk-låsen er vår egen.** Har vi hindret nettleserens scroll, kommer `click` likevel når fingeren
  løftes — og fordi touch har implisitt pointer capture (PE3 §9.4) havner det på raden fingeren lå **på**,
  ikke der den slapp. Lytteren må ligge i **capture-fasen** på scrolleren, fordi trykk-håndteringen i
  denne baselinen ligger på `#app`, som er *forelder* til sheeten.
- **`-webkit-user-select: none` + `-webkit-touch-callout: none` på kroppen.** Uten det spiser Safaris
  tekstmarkering trykket når fingeren lander presis på TEKSTEN i en rad (`vaul#652`), og «Kopier / Slå
  opp» popper opp midt i draget. Ikke bak `@media (hover:hover)` — den matcher aldri på iOS.

Ingen `setPointerCapture`: WebKits re-capture er rapportert ødelagt (WebKit 199803). Move/up-lytterne
ligger på `window`, lagt til ÉN gang — ikke per render, ellers lekker de.

**Renders må utsette seg selv mens flaten er i bevegelse.** `render()` bygger DOM-en på nytt, og en
bevegelse som er i gang bor i den gamle noden. Sperren hører i `render()` selv, ikke bare i kartets
`moveend` — iterasjoner kaller `rerender()`, og `resize` rendrer (å snu telefonen midt i et drag er en
ekte hendelse).

## De fire feilene, alle funnet ved å måle

**1. Magneten gjettet landingen med et fast antall millisekunder.**
`MOMENTUM_PROJECTION_MS = 190` var riktig for et drag som bare snappet — det hadde ingen utrulling å
regne med. Med egen momentum varer utrullingen nærmere 500 ms, så flaten rullet forbi magneten og
stanset 47 px over et stopp. En høyde som ser ut som en feil, ikke som et valg.

```js
// FØR: et gjett
const landing = outer.scrollTop + v * MOMENTUM_PROJECTION_MS;

// ETTER: farten faller eksponentielt, så veien som er igjen er analytisk
const glideLanding = (top, v) => top + v / -Math.log(SHEET_DECAY);  // ≈ 500 · v
```

Legg et **nett i enden av utrullingen** i tillegg (`sheetLand`): stanset den likevel nær et stopp — fordi
den ble klippet ved 0, eller fordi den kom NED fra lista der magneten med vilje ikke gjelder — går flaten
det siste stykket selv.

**2. Kroppens min-høyde var «vinduet du står i nå», som er selvbegrensende.**
Da kunne flaten aldri dras høyere enn innholdet rakk: en flate med ett kort har ingenting å scrolle, og
taket ble uoppnåelig. Gulvet skal være **taket**:

```js
outer.querySelector("[data-sheet]").style.minHeight = `${ceiling}px`;
```

Det stenger samtidig et høyde-tyveri: mobil-lista er utsnitts-scopet, så zoomer kartet inn krymper
innholdet, scroll-området forsvinner, nettleseren klipper posisjonen til null og flaten faller ned av seg
selv — og zoomer du ut igjen kommer den ikke tilbake. Med taket som gulv er scroll-området alltid minst
hele reiseveien. Målt: 12 kort → 0 kort med sheeten i taket, `maxScroll` faller til reiseveien og
posisjonen står.

**3. «Står flaten i hvilestillingen?» ble avgjort ved å sammenligne piksler.**
Scroll-hendelser kommer **asynkront**, så den huskede posisjonen kan ligge på forrige tall i det en
render treffer. Symptomet var at flaten flyttet seg av seg selv (til 254 px) mens fanen sto i bakgrunnen,
fordi en utsatt måling traff samtidig med at hvilestillingen endret seg.

```js
// FØR: gjetter intensjon fra en verdi som kan være foreldet
const atRest = prevRest !== restStop && S.sheetScroll === prevRest;

// ETTER: et flagg som settes der bevegelsen FAKTISK ender
function sheetGoTo(outer, top) { S.sheetAtRest = top === sheetRestStop; /* ... */ }
// og nullstilles i det draget krysser slop-terskelen
```

Regelen generelt: **intensjon skal lagres eksplisitt, ikke rekonstrueres fra en asynkront oppdatert
verdi.**

**4. «Flaten er i bevegelse»-flagget ble satt ved nedtrykk.**
Det utsatte renderen 140 ms for *hvert vanlig trykk* — hele flaten gjort treg for å beskytte et drag som
ikke skjedde. Sett det først når slop-terskelen krysses. Samme sted: et rent trykk skal returnere FØR
magneten, ellers dras flaten opp av et trykk som handlet om noe annet.

## Verifisering: hva verktøyet kan og ikke kan

**Chrome DevTools MCP kan ikke sende ekte touch-gester.** Dens `drag` sender mus-pointer-events selv med
touch-emulering på (probe: `touchstart: 0`, `pointerdown: 1`, `pointermove: 3`). Fordi vi eier gesten,
trener mus-drag *den samme koden* — men bremsefølelsen etter slipp må kjennes på enhet. Dispatch
`PointerEvent`-sekvenser med ekte `setTimeout`-mellomrom for å teste farten (velocity er et glidende
snitt, ikke de to siste punktene).

**Hold aldri en node-referanse over en render.** To ganger ga testene falske feil av nettopp det
(`visible: -420`, senere `afterTap: 0` med «modalen åpnet ikke») — begge var testskriptet, ikke produktet.
Spør DOM-en på nytt inne i hvert måle-punkt.

Målt på 390×844 etter endringen: hvilestilling 287 px, sammenslått 47, taket 726, `maxScroll` 1234. Ett
strøk fra hvilestillingen til bunnen av lista, og ett strøk hele veien ned til sammenslått. Kart-treff
over flaten i alle tre stillinger. Drag over en rad åpner verken modal eller drill-in; rent trykk åpner
modalen og flytter ikke flaten.

## Når mønsteret gjelder — og når det ikke gjelder

Gjelder for **nivå-1-flaten**: en indeks du blar i, over et kart du utforsker, der begge er
førsteklasses. Tre stopp er svaret der fordi brukeren veksler mellom å lese og å se.

Det gjelder **ikke** for reels/nivå-2-flaten. Der ble en bottom-sheet med fire snap-states
(`peek 10 / quarter 40 / half 65 / full 100`) forkastet til fordel for to fullskjerm-flater, fordi
affordansene var koblet til *beat-type* i stedet for til *flate*
(`docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md`). Les ikke det
dokumentet som et forbud mot snap-stopp — det handler om en flate med avspilling og en transport, ikke om
en indeks over et kart.

«Ingen gesture skal være eneste vei til noe» gjelder med tre stopp også: ett trykk på handlen går ett
stopp opp, og fra taket tilbake til sammenslått. Står du i lista, spoler første trykk lista til topps
(iOS' tittelbar-oppførsel), og neste slår sammen. Alle stillinger har en trykk-vei.

## Fortsatt ikke bygget

- **Rubber-banding i endene.** Sto på ønskelista 4. august og finnes ennå ikke; produksjonen klemmer også.
- **Momentum som krysser fra reiseveien inn i innholdet.** Utrullingen stopper ved overgangen.
- **`env(safe-area-inset-bottom)` i den sammenslåtte høyden.** I Safari med bunn-toolbar er den 0; i
  standalone/PWA vil handlen stå i home-indikatoren.

## Related

- `docs/solutions/architecture-patterns/mobile-two-surface-reels-model-20260616.md` — den andre mobile
  flaten, der fire snap-states ble forkastet. Ulik flate, ulikt svar.
- `docs/solutions/ui-bugs/google-maps-3d-webgl-context-crash-touch-devices-20260415.md` — samme klasse
  lærdom: iOS WebKit oppfører seg annerledes, og desktop Chrome avslører det aldri.
- `docs/solutions/architecture-patterns/placy-guide-mobile-prototype.md` — Guide-produktets bottom-sheet.
- `docs/brainstorms/2026-08-03-mobil-nabolagsflate-requirements.md` + `docs/plans/2026-08-03-001-feat-mobil-nabolagsflate-plan.md`
  — opphavet til flaten, og til den frie posisjoneringen.
- `prototypes/README.md` § «Mobil-sheeten: ett tall, én eier» — implementasjonsnær beskrivelse.
- Kilder: Apple Safari Web Content Guide (handling events), Pointer Events 3 §8.2/§9.4, `vaul#153`,
  `vaul#652`, WebKit-bug 199803.
