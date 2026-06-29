# 3D-motor — verifikasjons-runbook (PRD 6 Unit 8 / r06.8)

> **✅ UTFØRT 2026-06-30.** Kjørt mot fersk produksjonsbygg (`npm run build` → `npm run start`
> på `:3009`) i nystartet Chrome (eget user-data-dir, remote-debugging). Board:
> `bane-nor-eiendom/stasjonskvartalet` (`has_3d_addon=true`, voice-over-tier). Alle AC grønne.
> WebGL-context-invarianten holder over 11 toggle-sykluser; ingen «Too many active WebGL
> contexts», ingen `gmp-map-3d`-unmount, ingen removeChild-crash. Mekaniske porter grønne.

> **Formål:** Bevise at 3D-motoren FUNGERER mot prod — ikke bare kompilerer («Output-fokus»-
> regelen). Verifikasjonen er **middels autonomi**: den krever en live `has3dAddon`-board-flate
> + Chrome DevTools-observasjon, fordi den bærende invarianten (`gmp-map-3d` kan ikke
> `loseContext()` → må ALDRI unmountes) bare kan bevises i en kjørende WebGL-kontekst, ikke i
> en unit-test. Se memory `project_3d_default_map_engine` + `docs/solutions/architecture-
> patterns/unified-map-modal-2d-3d-toggle-20260415.md`.

## Hva som verifiseres (AC, PRD 6 Unit 8)

1. **Persistent-mount-invarianten.** ≥10 sykluser av (a) 3D↔2D-toggle, (b) kategori-navigasjon,
   (c) intro→outro. Console viser INGEN «Too many active WebGL contexts» og INGEN
   `gmp-map-3d`-unmount (samme Map3D-element-node overlever — verifisert via DOM-node-identitet).
2. **`?film=1`** gir rent kart uten kategori-pins (`markerPOIs → []` på render-nivå,
   `use-board-marker-set.ts:146`), ingen DOM-removeChild-crash; `projectSite`-labelen vises fortsatt.
3. **Reveal-kaskaden** kjører uten WebGL-churn-crash; markører på full opacity, sprett er en
   **scale**-animasjon (`RevealLayer3D.tsx:54 bounceScale`), ikke opacity-reveal.
4. **Mekaniske porter:** `npm run lint` (0 errors), `npm test` (alle motor/blob/camera grønne),
   `npx tsc --noEmit` (0 errors), `npm run build` (bygger; **react-map-gl IKKE i motor-bundlen** +
   `MapboxFallback`-import borte).

## Forutsetninger

- `.env.local` med `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Photorealistic 3D Tiles aktivert) +
  `NEXT_PUBLIC_MAPBOX_TOKEN`.
- Et `has_3d_addon=true`-board i DB. Kanon: `bane-nor-eiendom/stasjonskvartalet`.
  (Finn flere: `… /rest/v1/projects?select=customer_id,url_slug&has_3d_addon=eq.true`.)
- Google Chrome. Verifiser i **nystartet** Chrome (memory `project_3d_default_map_engine`) — egen
  `--user-data-dir` så ingen utvidelser/cache forurenser WebGL-tellingen.

## Steg 0 — Fersk prod-flate (ikke dev-cache)

Dev-serverens `.next`-cache kan korrumperes (`Cannot find module './vendor-chunks/@supabase.js'`).
Verifiser mot et **rent produksjonsbygg** — det er også selve `npm run build`-porten (AC4):

```bash
npm run build          # AC4: skal bygge uten feil; rapport-board-ruten kompilerer
PORT=3009 npm run start &
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:3009/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board"   # 200
```

## Steg 1 — Mekaniske porter (AC4)

```bash
npx tsc --noEmit       # 0 errors
npm run lint           # 0 errors (warnings ok)
npx vitest run         # alle grønne (RevealLayer3D, board-data, blob-pois, camera-director, …)
npm run build          # exit 0
```

**react-map-gl IKKE i motor-bundlen** — bevis via import-closure fra motor-roten
(`components/map/map-view-3d.tsx` + `components/variants/report/board/BoardMap3D.tsx`):
ingen fil i closuren importerer `react-map-gl`. 2D-`react-map-gl` er isolert til skall-laget
(`BoardMap.tsx`, PRD 9-eid) + de rene 2D-komponentene. **`MapboxFallback`-import borte:**
`grep -rln MapboxFallback components/ lib/ app/` → ingen treff.

## Steg 2 — Nystartet Chrome med remote-debugging

```bash
rm -rf /tmp/chrome-r068-verify
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-r068-verify \
  --no-first-run --no-default-browser-check \
  "http://localhost:3009/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board" &
curl -s http://127.0.0.1:9222/json/version    # bekreft DevTools-endepunktet
```

Bekreft at motoren er live (kjør i DevTools-konsollet / via MCP `evaluate_script`):

```js
const m = document.querySelector('gmp-map-3d');
({ defined: !!customElements.get('gmp-map-3d'),
   map3dElement: !!google?.maps?.maps3d?.Map3DElement,
   center: m?.getAttribute('center'),        // endrer seg = kamera orbiterer
   count: document.querySelectorAll('gmp-map-3d').length })   // 1
```

## Steg 3 — ≥10 sykluser, node-identitet bevares (AC1)

Stem motorens node FØR syklusene, kjør (a)+(b)+(c) per syklus, og bekreft at SAMME node overlever:

```js
const orig = document.querySelector('gmp-map-3d');
orig.dataset.r068stamp = 'TRACKED';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const click = t => { const b=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').trim()===t); b&&b.click(); };
const cats = ['Hverdagsliv','Mat & Drikke','Natur & Friluftsliv','Transport & Mobilitet','Barn & Oppvekst','Trening & Aktivitet'];
let broken=false, multi=false;
for (let c=0;c<10;c++){
  click('Kart'); await sleep(650); click('3D'); await sleep(650);            // (a) 3D↔2D
  click(cats[c%cats.length]); await sleep(650); click('Nabolaget'); await sleep(650);  // (b) kategori-nav + tilbake
  click('Velkommen'); await sleep(650); click('Oppsummert'); await sleep(650);         // (c) intro→outro
  if (document.querySelector('gmp-map-3d')!==orig) broken=true;
  if (document.querySelectorAll('gmp-map-3d').length!==1) multi=true;
}
({ identityBroken:broken, multiNode:multi, stampSurvives: document.querySelector('gmp-map-3d')?.dataset.r068stamp==='TRACKED' });
// Forvent: { identityBroken:false, multiNode:false, stampSurvives:true }
```

Deretter — console MÅ være fri for context-feilen:

```js
// I DevTools: ingen "Too many active WebGL contexts", ingen deleteVertexArray-kaskade.
```

Toggle-mekanikken (bekreftet): i 2D mountes Mapbox-overlayet (`.mapboxgl-map` finnes); i 3D
unmountes det (`map.remove()` frigjør Mapbox-konteksten) mens `gmp-map-3d`-basen ligger urørt under.

## Steg 4 — `?film=1` rent kart (AC2)

Naviger til `…/rapport-board?film=1`:

```js
const m = document.querySelector('gmp-map-3d');
({ categoryPins: document.querySelectorAll('gmp-marker-3d-interactive').length,   // 0
   projectSitePin: [...m.children].some(c => c.getAttribute('title')==='Stasjonskvartalet'), // true
   count: document.querySelectorAll('gmp-map-3d').length });                       // 1
// Console: rent (ingen removeChild-crash).
```

## Steg 5 — Reveal-kaskade (AC3)

Naviger rent, trykk «Start opplevelsen» (→ welcome-beat → `showReveal=true`), sample marker-antallet:

```js
click('Start opplevelsen');
// mapChildren stiger progressivt (kaskaden tegner markørene inn én etter én),
// gmp-map-3d-count holder 1 hele veien. Ingen crash i console.
```

Markørene mountes på full opacity (ingen opacity-reveal — den churnet Google 3D's SVG-rasterisering
og eksploderte WebGL-kontekster); spretten er scale-bounce (`RevealLayer3D.tsx`). rAF-loopen stopper
når siste markør er ferdig — ingen kontinuerlig churn.

## Resultat (kjøring 2026-06-30)

| AC | Resultat |
|----|----------|
| **1 — ≥10 sykluser, ingen WebGL-context-feil / unmount** | ✅ 11 toggle-sykluser (1 enkelt + 10 fulle med (a)+(b)+(c)). `gmp-map-3d`-node-identitet bevart hver syklus (`TRACKED`-stempel overlevde), count alltid 1. INGEN «Too many active WebGL contexts». Mapbox-overlay mountet i 2D, fjernet i 3D. |
| **2 — `?film=1` rent kart** | ✅ 0 `gmp-marker-3d-interactive` (kategori-pins droppet på render-nivå), eneste markør = `projectSite`-pinnen «Stasjonskvartalet». Console helt ren (ingen removeChild). |
| **3 — reveal-kaskade** | ✅ Markører tegnes inn progressivt (1→9→20→33→46→58 barn), count holder 1, ingen crash. Full opacity + scale-bounce bekreftet i kode + unit-test. |
| **4 — mekaniske porter** | ✅ `tsc` 0, `lint` 0 errors (166 warnings), `vitest` alle grønne, `build` exit 0. react-map-gl IKKE i motor-closure (63 filer, 0 treff). `MapboxFallback` borte. |

**Kjent uvedkommende støy (ikke AC-blokkere):**
- Google Maps 3D-interne modell-/teksturfeil under tile-streaming: `Could not load models … oak2-lod3 /
  maple2-lod3`, `Cutoff is currently disabled on terrain`, og `getImage … reading 'get'` (stack i Google
  API-bundlen `c36f3faa.*.js`, IKKE vår motor-kode). Tre-/LOD-rendering i Photorealistic 3D Tiles — opptrer
  uavhengig av hvordan host-appen mounter elementet.
- Ett asset-`404` per last (statisk ressurs, ikke kart-relatert).
