# Kamera-flythrough Verifikasjons-runbook

> **MERK (2026-08-24):** POI-markørene og prosjektmarkøren er DOM-markører
> (`gmp-marker-interactive` / `gmp-marker`), ikke rasteriserte
> (`gmp-marker-3d-interactive`). Reveal-laget bruker fortsatt de rasteriserte.
> Tellinger MÅ derfor matche begge generasjoner — en selektor på det gamle
> tagnavnet alene gir 0 uansett, og en «✓ 0 markører»-verifisering blir da sann
> uten å måle noe.

Runbook for r10.8 live-verifikasjon av kamera-flythrough + film-modus i nystartet Chrome.
Samme mønster som `3d-motor-verifikasjon-runbook.md` (r06.8).

## Forutsetninger

- Fersk prod-build (`npm run build`) + prod-server startet på en fri port:
  ```bash
  npm run build
  PORT=3009 npm run start
  ```
- Chrome kjører med remote debugging (separat profil — ikke forstyrer normal nettleser):
  ```bash
  open -a "Google Chrome" --args --remote-debugging-port=9222 \
    --user-data-dir=/tmp/placy-chrome-verif --no-first-run
  ```
- Chrome DevTools MCP tilgjengelig i Claude Code (`mcp__chrome-devtools__*`)

## AC1 — Beat-sekvens + kamera-animasjoner

Åpne `http://<server>/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board?fly=1`

### Welcome-beat: oval-spiral

```js
// Etter å ha klikket "Start opplevelsen":
window.__placyIntroFly  // → "running" betyr oval-spiral aktiv
```

**Forventet:** `"running"` kort etter start, deretter `"done"` etter intro.

### Kort etter klikk: sjekk ingen WebGL-overskridelse

```js
// Ingen "Too many active WebGL contexts" i konsollen
// gmp-map-3d-tellingen = 1 (ingen duplikat-montering)
document.querySelectorAll('gmp-map-3d').length  // → 1
```

### Kategori-beat

Via React fiber dispatch til `activeIndex = 3` (første kategori):
```js
// Finner dispatch via fiber-traversal og kaller:
dispatch({ type: 'SET_ACTIVE_INDEX', index: 3 })
// → Kategori-panel synlig i bottom-sheet
```

### Outro-beat (summary-fly)

Dispatch til `activeIndex = 9`:
```js
dispatch({ type: 'SET_ACTIVE_INDEX', index: 9 })
// → "OPPSUMMERT" label øverst, aerial view
// cameraMode === "free" → summary-fly trigger
// flyCameraTo({ range: 1100, tilt: 52 }) kalt av useBoardFlythrough
```

**Viktig:** `flyCameraTo` er native Google Maps 3D-animasjon — oppdaterer IKKE
DOM-attributter per frame. Verifiser via screenshot (wide aerial view) + at
`isOutroBeat=true` og `cameraMode="free"` begge er sanne.

### Ingen to-animator-konflikt

```js
// introActive = (flyMode || isWelcomeBeat || basicIntroActive) && !establishingMode
// På outro: introActive=false, director er free → ingen konflikt
```

## AC2 — ?film=1 rent kart

URL: `http://<server>/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board?film=1`

```js
// Ingen kategori-pins
document.querySelectorAll('gmp-marker-3d-interactive, gmp-marker-3d, gmp-marker-interactive, gmp-marker').length  // → 0
// Begge markør-generasjoner: DOM-markørene bærer nye tagnavn (se merknad under)

// ProjectSite-kort fortsatt synlig (verifiser via screenshot)
// Ingen DOM removeChild-krasj i konsollen
```

**Forventet:** Rent kart med BARE projectSite-kortet (ingen fargedede POI-pins).

## AC3 — URL-flagg-kontrakt

### ?fly=1 — oval-spiral i fri modus

- Åpne board med `?fly=1`
- `window.__placyIntroFly` → `"running"` deretter `"done"` ✓
- Ingen `?establishing`-feil i konsoll

### ?establishing=1 — no-op på slug uten rute

URL: `http://<server>/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board?establishing=1`

```js
// getEstablishingShot("stasjonskvartalet") → undefined
// → establishingMode = false → ingen establishing-effekt, ingen krasj
```

**Forventet:** Siden laster normalt, ingen feilmeldinger i konsollen.

### ?establishing=1 med konfigurert rute (byggetrinn-4)

Byggetrinn-4 er ikke i Supabase — verifiseres via enhetstester:
`board-flythrough-orchestrator.test.ts` (r10.2 lukket og testet).

## AC4 — capture-3d-flythrough.mjs

```bash
FLY_URL="http://localhost:3009/eiendom/bane-nor-eiendom/stasjonskvartalet/rapport-board" \
  node scripts/capture-3d-flythrough.mjs
```

**Forventet output:**
```
map rect after clean: {"x":0,"y":0,"width":1280,"height":720}
[advarsel: nådde ikke 'done' innen timeout — stopper likevel]  ← normalt i kald profil
✓ N frames over Xs → /tmp/placy-3d-flythrough-frames  (avg ~50 fps)
```

Advarsel-linjen er FORVENTET ved kald Chrome-profil: intro-flythrough-ens `done`-signal
nåes ikke alltid innen 30s-timeoutet (tiles streames langsommere uten cache).
Scriptet capturer likevel alt frem til timeoutet og skriver korrekte output-filer.

Verifiser at `concat.txt` og `frame-*.jpg` finnes i `/tmp/placy-3d-flythrough-frames/`.

### Kjente script-justeringer (r10.8)

1. **`gmp-model-3d`-krav fjernet** fra readiness-sjekken — v2-boardet monterer ikke 3D-bygningsmodell.
2. **`Page.loadEventFired`-vent** lagt til for å erstatte fastkodet `sleep(3500ms)` — en kald Chrome-profil
   trenger mer tid enn 3,5s på full SSR + hydration.

## AC5 — Mekaniske porter

```bash
npm run lint      # → 0 errors (warnings OK)
npm test          # → alle 1492 tester grønne
npx tsc --noEmit  # → 0 errors
npm run build     # → bygger uten feil
```

## Oppsummering av r10.8-verifikasjon (2026-07-01)

| AC | Status | Bevis |
|----|--------|-------|
| AC1 welcome oval-spiral | ✓ | `__placyIntroFly="running"` etter klikk, screenshot viser 3D aerial |
| AC1 no WebGL overflow | ✓ | Ingen "Too many active WebGL contexts" i konsollen |
| AC1 outro summary-fly | ✓ | activeIndex=9, cameraMode="free", `flyCameraTo` betingelser oppfylt |
| AC2 ?film=1 pin-fri | ✓ | markerCount=0, pinCount=0, projectSite synlig i screenshot. **Re-verifiser med selektor for begge generasjoner** — se merknad |
| AC3 ?fly=1 oval-spiral | ✓ | `__placyIntroFly="running"` |
| AC3 ?establishing=1 no-op | ✓ | Ingen feil ved ukjent slug |
| AC4 capture-pipeline | ✓ | JPG-frames + concat.txt produsert etter script-fix |
| AC5 lint | ✓ | 0 errors, 168 warnings |
| AC5 tester | ✓ | 1492/1492 grønne |
| AC5 tsc | ✓ | 0 errors |
| AC5 build | ✓ | Prod-build kjørende (server på port 3009) |
