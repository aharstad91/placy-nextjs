---
module: Report Board 3D Map (Google Photorealistic 3D Tiles)
date: 2026-06-03
problem_type: performance_issue
component: map_rendering
symptoms:
  - "'WARNING: Too many active WebGL contexts. Oldest context will be lost.' (gjentatt 40+ ganger)"
  - "Kaskade av 'WebGL: INVALID_OPERATION: deleteVertexArray: object does not belong to this context' (×256)"
  - "3D-kartet fryser/kræsjer visuelt mens den guidede turen spiller av"
  - "~8 nye WebGL2-kontekster opprettes per sekund under avspilling (men IKKE når pauset)"
root_cause: webgl_availability_probe_runs_on_every_render
severity: high
tags: [webgl, google-3d-tiles, vis-gl, react, rendering, context-leak]
---

# WebGL-kontekst-lekkasje: tilgjengelighets-probe kjørte på hver render

## Problem

Etter at 3D-kartet i rapport-board ble eksponert mer (auto-startet guidet tur, 3D
som default), begynte konsollen å fylles med `Too many active WebGL contexts.
Oldest context will be lost.` etterfulgt av hundrevis av `deleteVertexArray:
object does not belong to this context`. 3D-kartet frøs/kræsjet. Reproduserbart
på hard-refresh i ren Chrome (ikke bare et dev-artefakt).

## Hvordan vi fant det (etter to feildiagnoser)

Instrumenterte `HTMLCanvasElement.prototype.getContext` via `navigate_page`
`initScript` for å telle **unike** canvas (faktiske kontekster) over tid, og
hooket `Map3DElement.prototype.flyCameraTo/flyCameraAround` for å telle
kamera-kall:

```js
// initScript — teller unike WebGL-canvas
const seen = new WeakSet();
window.__gl = { unique: 0 };
const orig = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
  if (typeof type === 'string' && type.startsWith('webgl') && !seen.has(this)) {
    seen.add(this); window.__gl.unique++;
  }
  return orig.call(this, type, ...rest);
};
```

Funn:
- Unike canvas vokste **0 → 45 → 83 → 129 → 180** (~8/sek) mens turen spilte,
  men `flyCameraAround` var kalt **1 gang** og `flyCameraTo` **0** → kameraet
  re-firet IKKE. Bevegelse var ikke årsaken.
- **Pauset** tur → veksten stoppet (flatt). Så kilden var knyttet til avspilling,
  ikke kamera/markører/toggling.
- En stack trace på `getContext` pekte rett på synderen:
  `isWebGLAvailable → useWebGLCheck → MapView3D → renderWithHooks`.

## Rotårsak

`useWebGLCheck()` i `components/map/Map3DFallback.tsx` kalte `isWebGLAvailable()`
— som oppretter en WebGL-kontekst (`canvas.getContext('webgl2')`) for å teste
støtte — **på hver render av `MapView3D`**. Under avspilling re-rendrer
MapView3D ~8 ganger/sek (audio-drevet state oppstrøms i BoardMap3D), så ~8
throwaway-kontekster/sek ble opprettet og **aldri frigjort**. Nettleseren
tillater bare ~16 samtidige → den drepte de eldste (inkl. kartets ekte kontekst)
→ `deleteVertexArray`-kaskade.

## Fiks

Sjekk WebGL-tilgjengelighet **én gang**, cache resultatet, og **frigjør
probe-konteksten umiddelbart**:

```ts
let cachedWebGLAvailable: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return true;        // SSR
  if (cachedWebGLAvailable !== null) return cachedWebGLAvailable;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // frigjør probe-konteksten
    cachedWebGLAvailable = !!gl;
  } catch {
    cachedWebGLAvailable = false;
  }
  return cachedWebGLAvailable;
}

export function useWebGLCheck() {
  // Lazy useState-init → kjører sjekken kun ÉN gang per mount, ikke per render.
  const [state] = useState(() =>
    typeof window === 'undefined'
      ? { isAvailable: true, checked: false }
      : { isAvailable: isWebGLAvailable(), checked: true },
  );
  return state;
}
```

## Verifisering

Etter fiks, med full kamera-bevegelse (orbit + A→B-drift) under 23s avspilling:
unike WebGL-kontekster holdt seg på **3, helt flatt** (var 0→180 voksende), og
konsollen var ren — ingen "Too many contexts", ingen `deleteVertexArray`.

## Lærdom / red herrings

- **Kamera-bevegelsen var IKKE årsaken** (selv om sustained motion virket
  mistenkelig). Stack trace beviste at alle lekke kontekster kom fra
  `useWebGLCheck`, ingen fra Google sin tile-renderer. Ikke fjern features før
  målingen peker entydig.
- **Dev-GPU-pollution er ekte:** GPU-prosessen cacher WebGL-kontekster på tvers
  av tab-lukking; kun full nettleser-restart nullstiller. Mål alltid i en frisk
  tab (lukk de gamle først) — ellers forurenser tidligere loads målingen.
- **Tell unike canvas, ikke `getContext`-kall.** `getContext('webgl2')` på samme
  canvas returnerer eksisterende kontekst (polling) og blåser opp call-tellere
  uten å lekke. Bruk en `WeakSet` for å telle faktiske kontekster.
- **Fakturering:** Maps JavaScript API "3D Map loads" faktureres per sidevisning,
  ikke per tile/kontekst. WebGL-churn er klient-GPU og koster ingenting ekstra.

## Relaterte filer

- `components/map/Map3DFallback.tsx` — fiksen (`isWebGLAvailable` + `useWebGLCheck`)
- `components/map/map-view-3d.tsx` — `MapView3D` (konsumenten)
- `components/variants/report/board/BoardMap.tsx` — persistent-3D + 2D-overlay
  (egen, mindre kontekst-fiks: unngår å orphane Google-konteksten ved 2D/3D-toggle)
