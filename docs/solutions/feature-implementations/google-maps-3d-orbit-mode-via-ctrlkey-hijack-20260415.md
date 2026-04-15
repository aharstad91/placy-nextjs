---
title: Google Maps 3D — orbit-som-default via ctrlKey event-hijack
date: 2026-04-15
category: feature-implementations
tags: [google-maps-3d, gesture-handling, orbit-mode, ctrl-drag, pointer-events, capture-phase, webgl]
module: components/map
symptoms:
  - "Drag i 3D-kart flytter kamera fritt (pan) — ønsket rotate/orbit rundt property"
  - "Custom orbit-implementasjon via rAF + flyCameraTo er hakkete"
  - "Ctrl+drag gir smørbløt orbit men krever modifier-tast"
  - "Scroll-wheel zoomer brukeren ut av orbit-radien"
related_files:
  - components/map/map-view-3d.tsx
  - components/map/Map3DControls.tsx
  - components/variants/report/blocks/report-3d-config.ts
---

# Orbit-som-default i Google Maps 3D

## Problem

Google Maps 3D Photorealistic bruker native gesture-handling som defaulter
til pan-drag — brukere kan dra seg langt unna property og miste ankeret i
en eiendomsrapport. Ctrl+drag gir ønsket orbit-effekt (rotate rundt target,
zoom via scroll, tilt via shift+drag), men:

- Ctrl+drag krever modifier-tast (dårlig UX uten hint)
- Custom JS-implementasjon av orbit (via `flyCameraTo` i `requestAnimationFrame`)
  ble rapportert som hakkete — fighter Google's interne gesture-interpretasjon
- `bounds`-clamp under drag stopper pan men produserer stutter ("hakking")
- `GestureHandling.NONE` deaktiverer ALT, ikke bare pan

## Løsning: Event-hijack — fake `ctrlKey=true` på mus-drags

Google's interne gesture-interpretasjon leser `e.ctrlKey` på pointer/mouse-
events for å velge mellom PAN (ingen modifier) og ROTATE (ctrl). Vi fanger
eventene i **capture-phase** før de når Google's shadow-DOM, og overstyrer
`ctrlKey` via `Object.defineProperty`.

Dette gir native, WebGL-drevet smoothness gratis — ingen custom math.

### Implementasjon

```tsx
useEffect(() => {
  if (!activated) return;
  const container = containerRef.current;
  if (!container) return;

  const forceOrbitGesture = (e: PointerEvent | MouseEvent) => {
    // Kun venstre musetast, kun når Ctrl ikke allerede holdes.
    // Touch (pointerType === 'touch') skipper — har ikke ctrlKey.
    if ((e as PointerEvent).pointerType === "touch") return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.ctrlKey) return;
    try {
      Object.defineProperty(e, "ctrlKey", {
        get: () => true,
        configurable: true,
      });
    } catch {
      // Noen eventer er non-configurable — ignorér.
    }
  };

  const captureOpts = { capture: true, passive: true } as AddEventListenerOptions;
  container.addEventListener("pointerdown", forceOrbitGesture, captureOpts);
  container.addEventListener("pointermove", forceOrbitGesture, captureOpts);
  container.addEventListener("mousedown", forceOrbitGesture, captureOpts);
  container.addEventListener("mousemove", forceOrbitGesture, captureOpts);

  return () => {
    container.removeEventListener("pointerdown", forceOrbitGesture, captureOpts);
    container.removeEventListener("pointermove", forceOrbitGesture, captureOpts);
    container.removeEventListener("mousedown", forceOrbitGesture, captureOpts);
    container.removeEventListener("mousemove", forceOrbitGesture, captureOpts);
  };
}, [activated]);
```

### Hvorfor capture-phase er viktig

Google Maps 3D er et custom element (`<gmp-map-3d>`) med shadow DOM.
Event-listenere inne i shadow DOM ser event-objektet slik det passerer
gjennom. Med `capture: true` på wrapper-div'en kjører vår handler **før**
eventen når shadow-DOM-listenere — så `Object.defineProperty`-endringen
er synlig for Google's handler.

Uten capture-phase (bubble-phase default) ville Google's handler allerede
ha lest `ctrlKey=false` og valgt PAN — vår endring ville vært for sen.

## Sekundær løsning: Deaktiver zoom helt

Scroll-wheel zoomer brukeren ut av orbit-radien. For rapport-kontekst der
"orbit rundt property" er hele verdien, er zoom ikke ønsket.

### Wheel-block (non-passive capture-phase)

```tsx
const blockZoomWheel = (e: WheelEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

// Wheel må være non-passive for at preventDefault skal fungere.
const wheelOpts = { capture: true, passive: false } as AddEventListenerOptions;
container.addEventListener("wheel", blockZoomWheel, wheelOpts);
```

### Skjul `+/−`-knappene

`Map3DControls` fikk en `showZoom`-prop (default `true`). `MapView3D`
sender `showZoom={false}`. Kompass, rotér og tilt-knapper beholdes.

### Strammere altitude-grenser

Selv uten zoom kan Google flytte kameraet vertikalt internt under rotate.
Strammere altitude holder orbit-radien rundt property:

```ts
export const DEFAULT_CAMERA_LOCK = {
  range: 900,
  tilt: 45,
  minTilt: 15,
  maxTilt: 75,
  minAltitude: 150,   // ned fra 200 — kan zoome tettere inn
  maxAltitude: 1200,  // ned fra 3000 — hindrer zoom-out som bryter ankeret
  panHalfSideKm: 1.5,
} as const;
```

## Fallgruver prøvd og avvist

1. **Tight bounds** (`panHalfSideKm: 0.001`): `bounds`-clamp under drag
   produserer visible jitter/hakking — Google's gesture fighter mot clamp-en.

2. **Custom rAF orbit** via `flyCameraTo`: Rapportert som hakkete fra
   tidligere eksperimenter. Google's native ROTATE er allerede optimalisert
   i WebGL — JS-lag i mellom legger bare latency til.

3. **`gmp-centerchange` snap-back under drag**: Setter `map3d.center`
   midt i Google's gesture = bryter gesture-state, rotasjon stopper helt.

4. **`pointerup` snap-back** (snap kun etter release): Viste seg unødvendig
   — center-drift vi så tidligere var kumulativ fra _gamle_ eksperimenter,
   ikke fra den nåværende orbit-hijack.

## Gotchas

### Touch har ikke `ctrlKey`

`PointerEvent.ctrlKey` er alltid `false` på touch-events. Hijack-en treffer
kun mus. For touch bruker Google's default gesture-handling (`GREEDY`) —
1-finger drag = rotate i noen konfigurasjoner, men generelt uforutsigbart.

**Pinch-zoom på mobil er IKKE blokkert** av wheel-guarden vår. Hvis zoom
må deaktiveres på touch også, trengs en `touchstart`-listener med
multi-pointer-count-guard eller manuell pinch-blokker.

### `Object.defineProperty` kan feile

Noen browsere markerer `ctrlKey` som non-configurable på visse event-typer.
Try/catch rundt `defineProperty` er nødvendig — uten vil hele handleren
kaste og hele orbit-modusen gå i stykker.

### Re-render etterpå — cleanup

Hvis `activated` veksler (f.eks. ved mode-toggle i UnifiedMapModal), må
listenerne fjernes og re-legges. Effect-dep'en er `[activated]` kun —
containerRef er stabil gjennom hele MapView3D-lifecycle.

## Når du møter dette igjen

- **Ønsker orbit-som-default uten modifier?** Bruk ctrlKey-hijack via
  capture-phase event-listener. Ikke bygg custom rAF-orbit.
- **Google tar over events dine ikke treffer?** Husk capture-phase — Google
  lytter i shadow DOM, bubble-phase er for sent.
- **Vil deaktivere spesifikk gesture (zoom, pan, tilt)?** Intercept wheel/
  pointer i capture med `preventDefault` + `stopPropagation`. Ikke bruk
  `GestureHandling.NONE` — den dreper alt.
- **Camera drift over tid?** Før du bygger snap-back: verifiser at det
  ikke er kumulativ drift fra tidligere eksperimenter. Hardt refresh.
