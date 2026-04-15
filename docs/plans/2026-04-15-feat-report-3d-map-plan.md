---
title: "feat: Report3DMap — Google Maps 3D for rapportens 'Alt rundt'-seksjon"
type: feat
date: 2026-04-15
brainstorm: docs/brainstorms/2026-04-15-report-3d-map-brainstorm.md
branch: feat/report-3d-map
worktree: /Users/andreasharstad/Documents/placy-ralph-report-3d-map
---

# Plan: Report3DMap — Google Maps 3D for rapport

## Overview

Bygg ny `Report3DMap`-blokk som erstatter den planlagte akvarell-baserte `TabbedAerialMap` med ekte Google Photorealistic 3D Tiles. Brukeren roterer 360° rundt et fast punkt, pins plantes med lat/lng. Klikk på pin åpner eksisterende `ReportMapDrawer`.

Scope: rapportens "Alt rundt [område]"-seksjon. Pilot: Wesselsløkka.

## Problem Statement / Motivation

1. **Juridisk risiko:** Akvarell-pipelinen bryter Google Map Tiles API Policies (derivative work + offline caching > 30 dager)
2. **Ikke skalerbart:** Manuell Gemini-pipeline per område, 4 retninger, markør-posisjoner må gjenberegnes per retning
3. **Begrenset opplevelse:** 4 diskrete retninger vs. kontinuerlig 360°, oppløsning begrenset til ~1344x768

## Proposed Solution

Bruk `@vis.gl/react-google-maps` som wrapper rundt `Map3DElement`. Lås `center`, `tilt`, `range` — la kun `heading` være fritt. Pins plantes som `Marker3DInteractiveElement` med lat/lng. WebGL-fallback til eksisterende Mapbox-komponent.

### Key Technical Decisions (OPPDATERT ETTER DEEPEN)

| Decision | Choice | Rationale |
|---|---|---|
| React-wrapper | `@vis.gl/react-google-maps@^1.8.3` | **v1.8.0 (mars 2026) la til deklarativ `<Map3D>` + `<Marker3D>`** — ingen imperative DOM-kode trengs |
| Map-rendering | Deklarativ `<Map3D>` + `<Marker3D>` | Offisielle React-wrappere, håndterer lifecycle selv |
| Låst kamera | Controlled props + event-snap-back + `defaultUIDisabled` | Ingen native `minRange`/`maxRange` → må snap-back. Defense-in-depth med tight bounds + min/maxAltitude + min/maxTilt |
| Markør-type | `<Marker3D>` med inline SVG children | **Google 3D rasteriserer KUN Pin/SVG/img — ikke HTML/div**. Eksisterende `poi-marker-3d.tsx` fra feb 2026 er brokket for 3D (bruker HTML-portal) |
| Pin-styling | Inline SVG: sirkel + Lucide-path + number-badge | Full kontroll over utseende, matcher feb 2026-designspec |
| Drawer | Eksisterende `ReportMapDrawer` | Konsistent med rest av rapport |
| Fallback | Mapbox 2D satellitt | I stacken, ingen ekstra kost |
| State | Block-local useState | Ingen zustand-store for rapport-blokker |

### Viktig omvurdering fra deepen-fasen

**`poi-marker-3d.tsx` fra feb 2026 KAN IKKE GJENBRUKES.** Den bruker `createPortal` til å rendre React HTML i en `<div>` som appendes til `Marker3DInteractiveElement`. Google 3D-rendereren rasteriserer kun SVG/Pin/img — ikke arbitrær HTML. Så selv om koden kompilerer, vil pins enten vises tomme eller feile stille i 3D-modus.

**Løsning:** Lag ny `Marker3DPin`-komponent som bygger en inline SVG med sirkel-bakgrunn + Lucide-ikon-path + optional number-badge. SVG-en sendes som children til `<Marker3D>`.

### Gjenbrukbare filer (verifisert)

- ✅ `components/map/Map3DFallback.tsx` — WebGL-detection (gjenbrukes direkte)
- ✅ `types/google-maps-3d.d.ts` — kan trenge updates, v1.8 kan ha nye typer
- ✅ `components/variants/report/ReportMapDrawer.tsx` — drawer med POI-detaljer (gjenbrukes direkte)
- ⚠️ `components/map/poi-marker-3d.tsx` — **brokket for 3D, skal slettes/erstattes**
- ⚠️ `components/map/Map3DActionButtons.tsx` — ikke aktuell for MVP, utsett

### Må bygges

- `components/map/map-view-3d.tsx` — **forenklet** til en tynn wrapper rundt `<Map3D>` + `<Marker3D>` (ikke lenger rebuild fra scratch)
- `components/map/Marker3DPin.tsx` — **NY** SVG-basert pin-komponent (erstatter brokken poi-marker-3d.tsx)
- `components/variants/report/blocks/Report3DMap.tsx` — blokk-container
- `components/variants/report/blocks/wesselslokka-3d-config.ts` — POI + kamera-config

## Technical Approach

### Architecture

```
ReportPage
  └─ Report3DMap (block)
       ├─ MapView3D (core)                    ← NY, rebuild fra feb 2026
       │    ├─ <gmp-map-3d>                    ← @vis.gl wrapper
       │    ├─ POIMarker3D × n                 ← eksisterende, gjenbruk
       │    └─ Map3DFallback (if !webgl)       ← eksisterende
       ├─ Tabs (kategori-filter)               ← ny UI, state-filter
       └─ ReportMapDrawer (venstre)            ← eksisterende, gjenbruk
```

### Kameraprofil — "museum-modus" (OPPDATERT)

Kombinerer DEKLARATIV låsing (Map3D-props) med IMPERATIV snap-back på `gmp-rangechange` fordi Google IKKE har `minRange`/`maxRange`:

```tsx
const LOCKED = {
  center: { lat: 63.420, lng: 10.463, altitude: 0 },
  range: 1200,
  tilt: 67.5,
};

// Declarative props på <Map3D>
<Map3D
  mode="SATELLITE"
  center={LOCKED.center}
  range={LOCKED.range}
  tilt={LOCKED.tilt}
  heading={heading}          // controlled — kun heading oppdateres
  minTilt={LOCKED.tilt}
  maxTilt={LOCKED.tilt}
  minAltitude={0}
  maxAltitude={0}
  bounds={{
    south: 63.419, north: 63.421,
    west: 10.462,  east: 10.464,
  }}                          // tight box rundt center
  defaultUIDisabled={true}    // skjul default zoom/pan/tilt-controls
  gestureHandling="GREEDY"    // ingen ctrl-kravn for rotasjon
  onCameraChanged={handleCameraChange}
/>
```

**Snap-back listener (imperativt, via ref):**
```ts
// Range har ingen native lock — snap-back er eneste vei
map3d.addEventListener('gmp-rangechange', () => {
  map3d.range = LOCKED.range;
});
// Defense-in-depth: re-låse hvis deklarative props drifter
map3d.addEventListener('gmp-centerchange', () => {
  map3d.center = LOCKED.center;
});
```

**Kjent risiko:** Snap-back kan gi visuell jitter hvis brukeren drar aggressivt. Testes i Wave 3 UI-verifikasjon. Hvis jitter er stygg, fallback til CSS overlay som intercepterer alle events unntatt horisontal mouse-drag mappet til heading via requestAnimationFrame.

**Heading:** IKKE sett `minHeading`/`maxHeading` — de wraps ved 360 og kan gi udefinert adferd når min===max. La stå → fri 360°.

### Files to Change

| Fil | Type | Endring |
|---|---|---|
| `package.json` | mod | Add `@vis.gl/react-google-maps@^1.8.3` (var ^1.5.0 — oppgradert etter deepen) |
| `components/map/map-view-3d.tsx` | **NY** | Tynn wrapper rundt `<Map3D>` med locked kamera + snap-back listeners |
| `components/map/Marker3DPin.tsx` | **NY** | SVG-basert pin-komponent (erstatter HTML-basert poi-marker-3d) |
| `components/variants/report/blocks/Report3DMap.tsx` | **NY** | Blokk-container med tabs + drawer-state |
| `components/variants/report/blocks/wesselslokka-3d-config.ts` | **NY** | POI-data + kamera-config for Wesselsløkka |
| `components/variants/report/ReportPage.tsx` | mod | Integrer Report3DMap i "Alt rundt"-seksjonen |
| `components/variants/report/ReportThemeSection.tsx` | mod | Condition for å suppresse banner-illustrasjon i 3D-kart-seksjon |
| `components/map/poi-marker-3d.tsx` | **DELETE** | Brokket for 3D-rendering (HTML/portal fungerer ikke) |
| `types/google-maps-3d.d.ts` | mod | Oppdater til v1.8-kompatible typer (eller fjern hvis @vis.gl gir dem) |

### Files to Delete (kodebase-hygiene)

Uncommitted i `feat/report-blocks`-worktree — blir ignorert når den PR-en merges:
- `components/variants/report/blocks/TabbedAerialMap.tsx` (uncommitted)
- `public/illustrations/wesselslokka-{nord,ost,vest,sor}.png` (uncommitted)

På vår branch: slett disse hvis de dukker opp. Ikke push til feat/report-blocks.

---

## Implementation Phases (OPPDATERT ETTER DEEPEN)

### Wave 1: Foundation

**Bead 1.1: Install dependency + slett brokken marker**
- `npm install @vis.gl/react-google-maps@^1.8.3`
- Slett `components/map/poi-marker-3d.tsx` (virker ikke for 3D — bruker HTML/portal)
- `npx tsc --noEmit` — null feil etter sletting (kan kreve imports rydding andre steder hvis refereret)
- → TC-01

**Bead 1.2: Marker3DPin SVG-komponent**
- Opprett `components/map/Marker3DPin.tsx`
- Input: `{ color: string, icon: LucideIcon, number?: number, size?: number }`
- Output: inline SVG element — circle-bakgrunn + Lucide path + optional number badge
- Lucide-ikoner er allerede SVG → kopier deres `<path>` direkte inn
- Eksporter som React-komponent som kan være children til `<Marker3D>`
- → TC-04

### Wave 2: Core map component (avhenger av Wave 1)

**Bead 2.1: MapView3D deklarativ wrapper**
- Bygg `components/map/map-view-3d.tsx`:
  - Props: `center, cameraLock, pois, activePOIId, onPOIClick, fallbackRender`
  - Wrap med `<APIProvider apiKey={...}>`
  - Render `<Map3D>` med låste props (fra "Kameraprofil"-seksjonen over)
  - WebGL-check via eksisterende `Map3DFallback` — ved ingen WebGL: render `fallbackRender()`
  - Map ref via `useMap3D()`-hook for snap-back listeners (gmp-rangechange, gmp-centerchange)
  - Controlled heading-state — kun heading oppdateres via `onCameraChanged`
  - Render `<Marker3D>` for hver POI med `<Marker3DPin>` som children
- → TC-02, TC-03, TC-09

### Wave 3: Block + data (avhenger av Wave 2)

**Bead 3.1: wesselslokka-3d-config.ts**
- Opprett config med:
  - `center: { lat: 63.420, lng: 10.463 }` + `cameraLock` (range, tilt, bounds)
  - `pois: POI[]` — 15 dummy-pins distribuert over Wesselsløkka (nøyaktige lat/lng)
  - Kategori-mapping til fargekoder + Lucide-ikon
- → TC-05

**Bead 3.2: Report3DMap block**
- Bygg `components/variants/report/blocks/Report3DMap.tsx`:
  - State: `activeTab`, `selectedPOI` (lokal, ikke global)
  - Tabs-UI (Alle, Oppvekst, Mat&Drikke, Natur, Transport, Trening)
  - Filter POIer per tab (memoiser med useMemo for å unngå re-render)
  - Render `MapView3D` med filtrerte POIer
  - Ved POI-klikk: sett `selectedPOI`, vis `ReportMapDrawer` venstre
  - Ved tab-bytte: lukk drawer (setSelectedPOI(null))
  - Ved `activePOIId === selectedPOI.id`: klikk igjen lukker drawer (toggle)
- → TC-06, TC-07, TC-08

### Wave 4: Integration + verification (avhenger av Wave 3)

**Bead 4.1: Integrer i ReportPage**
- Legg til Report3DMap i "Alt rundt Wesselsløkka"-seksjonen av `ReportPage.tsx`
- Sjekk at `ReportThemeSection` ikke viser banner-illustrasjon for denne seksjonen (condition)
- Verifiser at siden fortsatt bygges og rendrer korrekt via `npm run build`
- → TC-10, TC-11

**Bead 4.2: UI-verifikasjon med Chrome DevTools MCP**
- Start dev server på port 3001 (worktree), naviger til Wesselsløkka-rapport
- Screenshots av:
  - Desktop: startstate (heading=0)
  - Desktop: drag-rotert ~90°
  - Desktop: drag-rotert ~180°
  - Forsøk å panorere med mus → verifiser at center ikke endres (snap-back fungerer)
  - Forsøk å zoome med scroll → verifiser at range ikke endres (snap-back fungerer)
  - Klikk på pin → drawer åpnes venstre
  - Klikk på ny pin → drawer bytter innhold
  - Klikk tab → drawer lukker, pins filtreres
- Verifiser mot alle acceptance criteria
- → TC-02, TC-03, TC-06, TC-07, TC-08

### Wave 5: Polish (avhenger av Wave 4)

**Bead 5.1: Attribusjon + styling**
- Sørg for at "Map data ©2025 Google" vises synlig (Google håndterer automatisk, men verifiser)
- Style tabs-UI etter rapportens editoriale språk
- Justér SVG-pin-styling for å matche feb 2026-designspec (sirkel 32px, kategorifarge, hvit border, shadow)
- → TC-12

**Bead 5.2: Fallback-testing**
- Test WebGL-fallback ved å midlertidig returnere `false` fra WebGL-check
- Verifiser at Mapbox 2D satellitt vises med samme pins
- → TC-13

**Bead 5.3: Jitter-sjekk ved snap-back**
- Dra aggressivt på kartet for å teste at range-snap-back ikke gir stygg jitter
- Hvis jitter er synlig: vurder CSS overlay-fallback (separate bead)
- → TC-03

---

## Acceptance Criteria

### Functional Requirements

- [ ] Report3DMap vises i "Alt rundt Wesselsløkka"-seksjonen
- [ ] Brukeren kan rotere 360° rundt fast punkt (mus + touch)
- [ ] Brukeren kan IKKE panorere (center holder seg)
- [ ] Brukeren kan IKKE tilte (vinkelen holder seg)
- [ ] Brukeren kan IKKE zoome (range holder seg)
- [ ] Klikk på pin åpner ReportMapDrawer venstre
- [ ] Tabs filtrerer pins per kategori
- [ ] Tab-bytte lukker drawer
- [ ] WebGL-fallback viser Mapbox 2D satellitt med samme pins
- [ ] Attribusjon "Map data ©2025 Google" synlig

### Non-Functional Requirements

- [ ] Første tile-lasting < 3 sekunder på 4G
- [ ] Rotasjon med 30+ FPS på desktop
- [ ] Ingen console errors ved normal bruk
- [ ] Type-check passerer: `npx tsc --noEmit`
- [ ] Build passerer: `npm run build`

### Juridiske krav

- [ ] Ingen lh3-URLer i `public/`
- [ ] Ingen eksport/caching av tiles
- [ ] Akvarell-JPG-er (feb 2026 og 2026-04-15) ikke brukt i Report3DMap

## Risk Analysis & Mitigation (OPPDATERT)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Snap-back listeners gir synlig jitter ved drag | **Høy** | Medium | Wave 5.3: test aggressivt drag. Fallback: CSS overlay med rAF-basert rotation-only event handling |
| Ingen `minRange`/`maxRange` native API → range-snap-back er eneste lås | **Høy** | Medium | Dokumentert i kameraprofil. Snap-back listener på `gmp-rangechange` |
| Google 3D rasteriserer ikke HTML/div — må bruke SVG | **Bekreftet** | N/A | Oppdaget i deepen. Løst via ny `Marker3DPin.tsx` med inline SVG |
| `@vis.gl/react-google-maps` API-changes mellom v1.5 og v1.8 | Medium | Medium | Oppgradert target til v1.8.3, som har deklarative `<Map3D>`/`<Marker3D>` — faktisk enklere enn v1.5 |
| Touch-gestures kan ikke låses per-gest (intet setTiltInteractionEnabled etc.) | Medium | Medium | Snap-back listeners fungerer også under touch. Testes i Wave 4.2 |
| Map Tiles API-kvote ikke aktivert på API-nøkkelen | Lav | Høy | Brukeren har allerede aktivert (verifisert via screenshot) |
| Tabs+rotasjon ødelegger markør-reactivity | Lav | Lav | Deklarativ `<Marker3D>` lar Google håndtere perspektiv automatisk. React-reconciliation med `key` for filter-bytte |
| Kostnadseksplosjon i prod | Lav nå | Høy | Deferred per bruker: prototype-fase, fikses etter validert salg. Worst-case: $10 budget alert |
| `defaultUIDisabled` skjuler ikke gestures — kun default controls | **Bekreftet** | Lav | Snap-back listeners håndterer faktisk gesture-input. UI-skjuling er kun kosmetikk |

## Dependencies

- Google Cloud prosjekt med Map Tiles API aktivert ✅
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` i `.env.local` ✅
- Node 18+, Next.js 14.2+
- `@vis.gl/react-google-maps` må installeres

## Success Metrics

- [ ] Demo viser 3D-kart som snur 360° uten lagging
- [ ] Klikk-interaksjon fungerer som forventet
- [ ] Ingen brudd på eksisterende rapport-funksjonalitet
- [ ] Bruker kan demonstrere til meglere uten å forklare tekniske begrensninger

## Out of Scope (bevisst parkert)

- AnnotatedMap-seksjons-kart (Natur & Friluftsliv) — behold akvarell, for tungt med 7 x 3D
- Explorer/Guide 3D-bytte — revertert feb 2026, ikke på bordet
- Mobile-first optimalisering — desktop først, mobile test sekundært
- Gjenbruk på andre områder enn Wesselsløkka — kopier config-fil når nytt område trengs
- Budget alert + daglig quota-cap — deferred per bruker (prototype-fase)
- Slette uncommitted TabbedAerialMap-filer i annen worktree — ikke vårt worktree's problem

## Audit Fixes (2026-04-15, YELLOW verdict)

Tech audit identifiserte 4 items som må fixes i implementasjonen. Alle innarbeidet under:

### Fix 1 (HIGH): SSR-guard
Report3DMap MÅ importes med `dynamic(() => import(...), { ssr: false })` i ReportPage.tsx. Google Maps 3D krever WebGL/browser APIs og crasher under SSR. Mønstret er allerede etablert for `ReportThemeMap` i `ReportThemeSection.tsx` (linje 43-46) — følg samme pattern.

### Fix 2 (MEDIUM): Mapbox-fallback er ikke klar
Eksisterende `Map3DFallback.tsx` er en tekst-liste med POI-navn, IKKE et Mapbox satellitt-kart. MapView3D må bygge selve satellitt-fallback-render-pathen inline (eller gjenbruke eksisterende Mapbox-komponenter). `Map3DFallback` brukes KUN for WebGL-detection-utilities (hvis de finnes der), ikke for selve fallback-UI.

### Fix 3 (MEDIUM): Ingen "Alt rundt"-seksjon eksisterer
`ReportPage.tsx` loopeer themes via `ReportThemeSection`. Det finnes INGEN "Alt rundt"-seksjon — strengen finnes kun i brainstorm/plan-docs. Report3DMap må innsetteres som en ny, standalone blokk i `ReportPage.tsx`, utenfor theme-loopen. **Innsettingspunkt:** Mellom siste primær-theme og eventuell secondary-themes-divider. Følg samme `md:max-w-4xl` pattern som andre blokker. Aspect-ratio: `aspect-[4/3]` (ca 672x504 ved md-breakpoint).

### Fix 4 (LOW): TypeScript-deklarasjons-konflikt
Etter `npm install @vis.gl/react-google-maps@1.8.3`, kjør `npx tsc --noEmit` umiddelbart. Hvis konflikter dukker opp i `types/google-maps-3d.d.ts` (spesielt rundt `google.maps.MapMode`), stripp ned til kun typer som IKKE er levert av @vis.gl (f.eks. `flyCameraTo`, `flyCameraAround` hvis de brukes av Map3DActionButtons).

---

## Test Cases

### Funksjonelle

**TC-01 | Build | P1**
Requirement: Dependency installert uten type-feil
Given: Clean npm install
When: `npx tsc --noEmit`
Then: 0 errors, 0 warnings relatert til 3D-komponenter

**TC-02 | Functional | P1**
Requirement: 3D-kart rendrer Wesselsløkka i fugleperspektiv
Given: Rapport-side åpnet med Report3DMap-blokk
When: Siden lastes i Chrome med WebGL
Then: Google 3D-tiles vises, Wesselsløkka synlig i tilt=67.5°, range=1200m

**TC-03 | Functional | P1**
Requirement: Kun heading kan endres, alle andre aksjoner blokkert
Given: 3D-kart rendret, bruker fokusert
When: Bruker drar/scroller/tilter
Then: heading endres 0-360°, center/tilt/range endrer seg IKKE (eller snapper tilbake innen 1 frame)

**TC-04 | Functional | P1**
Requirement: Marker3DPin renderer som SVG på kartet
Given: 15 POIer i config
When: Kart rendrer
Then: 15 sirkulære pins vises med kategorifarge + Lucide-ikon, lat/lng-plassert

**TC-05 | Data | P1**
Requirement: wesselslokka-3d-config leverer gyldig POI-data
Given: Import av config
When: Evaluering
Then: Array med 15 POIer, hver med {id, lat, lng, category, name, iconName}

**TC-06 | Functional | P1**
Requirement: Pin-klikk åpner venstre drawer
Given: 3D-kart rendret med pins
When: Bruker klikker pin #3
Then: ReportMapDrawer åpner fra venstre, viser POI #3-innhold

**TC-07 | Functional | P1**
Requirement: Tabs filtrerer pins per kategori
Given: 3D-kart med "Alle" aktiv (15 pins)
When: Bruker klikker "Transport"-tab
Then: Bare Transport-pins vises, andre fjernes fra DOM

**TC-08 | Functional | P1**
Requirement: Tab-bytte lukker åpen drawer
Given: Drawer åpen med POI #3 (Mat&Drikke)
When: Bruker klikker "Natur"-tab
Then: Drawer lukkes, pins byttes til Natur

**TC-09 | Functional | P1**
Requirement: WebGL-fallback viser Mapbox satellitt
Given: Browser uten WebGL-support
When: Report3DMap rendrer
Then: Map3DFallback detekterer, Mapbox 2D satellitt vises med samme pins

### Integrasjon

**TC-10 | Integration | P1**
Requirement: Report3DMap integrert i Wesselsløkka-rapport
Given: `/rapport/wesselsloekka` (eller tilsvarende rute)
When: Siden rendrer
Then: Report3DMap vises i "Alt rundt"-seksjonen, andre seksjoner uendret

**TC-11 | Build | P1**
Requirement: Full app-build passerer med ny blokk
Given: Ferdig implementasjon
When: `npm run build`
Then: 0 feil, sideutput genereres korrekt for rapport-ruten

### Non-functional

**TC-12 | UX | P2**
Requirement: Attribusjon synlig
Given: 3D-kart rendrer
When: Visuell inspeksjon
Then: "Map data ©2025 Google" vises nederst på kartet

**TC-13 | Fallback | P2**
Requirement: Fallback-rendering like funksjonell
Given: WebGL-fallback aktiv
When: Bruker klikker pin
Then: Samme drawer-adferd som i 3D-modus

### Performance

**TC-14 | Performance | P2**
Requirement: Første tile-lasting < 3 sekunder
Given: Vanlig 4G-nettverk simulert
When: Rapport-side åpnes
Then: 3D-kart lastbart og interaktivt innen 3 sekunder

**TC-15 | Performance | P2**
Requirement: Rotasjon lagfri på desktop
Given: 3D-kart rendret
When: Bruker drar for å rotere
Then: 30+ FPS målt, ingen synlig lagging eller jitter

### Juridiske

**TC-16 | Legal | P1**
Requirement: Ingen akvarell-JPG-er brukt i 3D-kartseksjonen
Given: Report3DMap deployed
When: Network tab inspected
Then: Ingen `wesselslokka-{nord,ost,vest,sor}.png` i requests

---

## References

### Internal
- Brainstorm: `docs/brainstorms/2026-04-15-report-3d-map-brainstorm.md`
- Forrige migrasjon: `docs/plans/2026-02-03-feat-google-maps-3d-migration-plan.md`
- Kamera-constraints: `docs/plans/2026-02-03-feat-3d-map-camera-constraints-plan.md`
- Revertering: `docs/brainstorms/2026-02-04-kartmotor-valg-brainstorm.md`

### External
- [Map3DElement API](https://developers.google.com/maps/documentation/javascript/reference/3d-map)
- [Camera Interaction](https://developers.google.com/maps/documentation/javascript/3d/interaction)
- [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/)
- [Map Tiles API Policies](https://developers.google.com/maps/documentation/tile/policies)
