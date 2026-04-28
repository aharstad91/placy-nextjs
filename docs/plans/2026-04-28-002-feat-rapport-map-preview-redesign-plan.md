---
title: Redesign rapport-map-previews — løft boligobjektet, forenkle POI-er, info-stripe under
type: feat
status: active
date: 2026-04-28
---

# Redesign rapport-map-previews — løft boligobjektet, forenkle POI-er, info-stripe under

## Overview

Redesigner alle map-previews i rapport-produktet (samlekart + per-tema-kart) til en mer innbydende, fokusert visuell presentasjon. Boligobjektet blir hovedpunktet i hver preview, POI-er reduseres til små farge-/grå prikker uten labels, og en info-stripe under kartet introduserer tema-tittel, antall, watercolor-illustrasjon og pil-i-sirkel-CTA. Eksisterende modal-tilstand (klikk på preview) endres ikke.

Bruker har skissert designet på `board (1).jpg` og pekt på dagens "Transport & Mobilitet"-kart med sparkesykkel-prikker som inspirasjon for hvordan POI-er bør rendres i preview.

## Problem Frame

Dagens previews lider av tre problemer:

1. **Visuell støy.** Mapbox-tile m/ gatenavn + 50–250 fargede kategori-pins gjør at øyet ikke får et fokuspunkt. POI-tetthet og posisjon kommuniseres svakt.
2. **Boligobjektet drukner.** Prosjekt-pinen (orange Building2 m/ pulse-ring) er bare ett av mange ikoner i klyngen. Det er rapportens hovedkarakter, men det fremstår ikke slik.
3. **Innbydelsen mangler.** Dagens "Utforsk kartet"-pille midt på kartet er funksjonell, ikke inviterende. Den dupliserer informasjon som allerede står i seksjons-headerne ("47 steder på kartet" gjentas både i kart-overlay og som meta-tekst over).

Skissen løser alle tre samtidig: avfarger POI-er til prikker (kontekst, ikke individuell info), løfter boligen til visuell hovedrolle, og flytter CTA + meta til en hvit info-stripe under kartet med varm watercolor-illustrasjon i Wesselsløkka-stil — samme visuelle språk som chips-row-ikonene.

## Requirements Trace

- **R1.** Alle map-previews i rapporten (samlekart + per-tema) bruker den nye preview-presentasjonen
- **R2.** Boligobjektet er åpenbart fokuspunkt i hver preview — visuelt kraftigst element
- **R3.** POI-er rendres som små prikker uten kategori-ikoner, labels eller tooltips i preview-modus
- **R4.** Fast view (samme zoom + center på prosjekt) — ingen auto-fitBounds-justering
- **R5.** Info-stripe under kartet med tema-tittel, antall, watercolor-illustrasjon og pil-i-sirkel-CTA
- **R6.** Hover på preview-kortet trigger subtile animasjoner som signaliserer klikkbarhet
- **R7.** Klikk på preview åpner eksisterende modal med UENDRET full POI-rendering
- **R8.** Behold Mapbox som rendering-motor for å bevare geografisk identitet (kanaler, vann, byform)
- **R9.** Lint, typecheck og build passerer; visuell QA i browser bekrefter samtlige preview-overflater

## Scope Boundaries

- Kun preview-tilstanden av rapport-kart endres — ikke modal-/aktivert tilstand
- Kun rapport-produktet — Explorer og Guide berøres ikke
- Ingen DB-/migrasjonsendringer
- Ingen endringer i hvordan POI-data hentes eller filtreres

### Deferred to Separate Tasks

- Generering av nye watercolor-scene-illustrasjoner per tema (Mat & Drikke, Barn & Oppvekst, etc.) — gjøres "as we go" i senere tasks. For testing brukes eksisterende illustrasjoner fra `public/illustrations/icons/` og evt. eksisterende hero-scenes.
- Finjustering av Mapbox-stil for ekstra demping av kart-bakgrunnen — gjøres iterativt i visuell QA, ikke som blokkerende plan-leveranse. Hvis behovet bekreftes, lages en egen utvidelse av `lib/themes/map-styles.ts` (ny `applyMutedPreviewTheme`).

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/ReportThemeMap.tsx` — Mapbox-komponent brukt BÅDE i preview (`activated=false`) og i modal (`activated=true`). Bounds-beregning bygger viewport så alle POI-er passer (linjer ca. 74-83). Project-marker er inline (orange Building2 m/ pulse-ring + permanent label-chip). POI-markører er tier-aware med farger og ikoner.
- `components/variants/report/blocks/ReportOverviewMap.tsx` — samlekart-blokken. Wrapper `ReportThemeMap` i klikkbar button med gradient-overlay og midt-på-kartet-CTA-pille ("232 steder i 3D" + "Utforsk i 3D").
- `components/variants/report/ReportThemeSection.tsx` (linjer 253-283) — per-tema-seksjonens preview. Identisk button-wrapper-mønster som ReportOverviewMap (gradient + CTA-pille midt på kartet). Bekreftet duplisering — kandidater for å løftes ut til delt komponent.
- `components/map/ProjectSitePin.tsx` — eksisterende Google-3D-pin (SVG chip), IKKE Mapbox-pinen. Mapbox-pinen er inline i ReportThemeMap.
- `lib/themes/map-styles.ts` — `applyIllustratedTheme(map)` brukes ved onLoad. Eventuelle preview-spesifikke justeringer bør legges som ny funksjon her, ikke inline.
- `public/illustrations/icons/*.png` — eksisterende kvadratiske watercolor-ikoner (Wesselsløkka-stil) i Gemini-generert format. Kan brukes som test-illustrasjon i info-stripen.
- `public/illustrations/{langenga-h7-hero,nostebukten-brygge-hero,stovner-torg-hero}.jpg` — eksisterende horisontal-orienterte hero-scenes i samme stil. Kan tjene som plassholder for samlekart inntil ny panoramisk genereres.
- Lucide-ikoner brukt i prosjektet: `Home`, `ArrowUpRight`, `Building2`. Etablert mønster.

### Institutional Learnings

- Placy CLAUDE.md "Kodebase-hygiene": når noe gammelt erstattes, slett det umiddelbart — ikke kommentert-ut kode, ikke flag-gating av deprecated paths
- Placy CLAUDE.md "Output-fokus": verifiser at features fungerer (screenshots/manuell sjekk) — ikke bare at koden ser riktig ut
- Watercolor-illustrasjoner skal genereres via `placy-illustrations`-skill i Wesselsløkka-stil for konsistens

## Key Technical Decisions

- **Bygg én delt preview-card-komponent (`ReportMapPreviewCard`).** Begge eksisterende preview-overflater (samlekart + per-tema) har identisk button-wrapper med gradient-overlay og CTA-pille — duplisert kode. Løft den ut til én gjenbrukbar komponent som tar tema-tittel, antall, illustrasjon-kilde og onClick-callback.
- **Innfør `previewMode`-prop på `ReportThemeMap`, ikke ny komponent.** ReportThemeMap er allerede dual-purpose (preview vs modal). En ekstra prop holder branchingen lokal og unngår å introdusere en parallell Mapbox-wrapper som ville drifte fra modal-versjonen.
- **POI-prikker styles som ensfargede sirkler — ikke per-kategori-farge.** Skissen viser grå prikker; brukeren peker på sparkesykkel-prikker (lilla, single-tone). Vi bruker én tone (lyseblå/grå-blå) for ensartet visuelt uttrykk i preview. Konkret tone bestemmes i visuell QA.
- **Boligobjekt-pin oppgraderes med Lucide `Home`-ikon (skissen) i preview, beholder `Building2` i modal.** Bytter ikon kun i preview-modus — pulse-ring beholdes for å fange øyet, men forsterkes (større, mer kontrast). Permanent label-chip beholdes.
- **Fjern fitBounds-logikken (linjer 74-83 i ReportThemeMap) i preview-modus.** Bruk `{ longitude, latitude, zoom: 13.5 }` som initialViewState. Modal-tilstanden beholder fitBounds. Konkret zoom-verdi tunes i visuell QA — start på 13.5 (passer Trondheim-eksempelet brukeren viste).
- **Hover-states realiseres via Tailwind `group-hover:` på preview-card-button.** Eksisterende mønster i kodebasen (se `cursor-pointer hover:border-[#d4cfc8] transition-colors group` i ReportThemeSection:259). Project-pin og dets bakgrunns-sirkel responderer på `group-hover:scale-105` og `group-hover:bg-[...]/40` etc.
- **Behold gradient-overlay** (eksisterende `bg-gradient-to-t from-[#f5f1ec]/90 via-[#f5f1ec]/10 to-transparent`) — virker som kontrast-enhancer mot info-stripen og demper kart-fokus naturlig.
- **Gjenbruk eksisterende illustrasjoner i Unit 1-4; generer ny panoramisk via Gemini i Unit 5.** Lar oss verifisere kort-layouten med ekte assets uten å blokkere på illustrasjons-pipelinen.

## Open Questions

### Resolved During Planning

- Mapbox vs. helt egen rendering? **Mapbox.** Bruker bekreftet at geografisk identitet (kanaler, byform i Trondheim) må bevares.
- En delt preview-komponent eller dupliser i hver caller? **Delt.** Identisk button-mønster i begge dagens previews — løftes ut.
- Skal `featuredPOIIds`/`vehiclePositions`/`trails` rendres i preview? **Ja.** Disse er allerede del av kart-fortellingen (sparkesykler, turstier) og er allerede dempet/uten labels. De passer skissens prinsipp.
- Hover-fade på sirkel-bakgrunn — hvilken farge? **Justeres i visuell QA.** Start med å lyse opp pulse-ringen (`bg-[#b45309]/40` → `group-hover:bg-[#b45309]/60`) og scale prosjekt-pin (`group-hover:scale-105`).

### Deferred to Implementation

- Konkret zoom-verdi (start 13.5, tunes ved første visuell QA)
- POI-prikkenes eksakte tone (start `#94a3b8` slate, juster mot watercolor-paletten)
- Final padding/border-radius på info-stripen (start `p-6 rounded-2xl`, juster om skissens "24px / xl" trenger annet uttrykk)
- Final aspect ratio på illustrasjonen i info-stripen (avhengig av panoramic-illustrasjonen som genereres i Unit 5)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Komponent-struktur (etter refactor)

```
ReportPage
├── ReportOverviewMap (samlekart-blokk)
│   └── ReportMapPreviewCard      ← NY delt komponent
│       ├── ReportThemeMap (previewMode=true)
│       │   ├── prosjekt-pin (Home, oppgradert)
│       │   └── POI-prikker (single-tone, ingen ikoner)
│       └── info-stripe (tittel, antall, illustrasjon, pil-CTA)
│
└── ReportThemeSection (per-tema-seksjon, ×7)
    └── ReportMapPreviewCard      ← samme komponent
        ├── ReportThemeMap (previewMode=true)
        └── info-stripe
```

### Preview vs modal — rendring-modus

| Aspekt              | preview (`previewMode=true`, `activated=false`) | modal (`previewMode=false`, `activated=true`) |
|---------------------|-------------------------------------------------|------------------------------------------------|
| POI-rendering       | Single-tone prikker, ingen labels/tooltips      | Tier-aware fargede ikon-pins (uendret)         |
| Project pin         | Lucide `Home`, scale-105 ved hover              | Lucide `Building2` med label-chip (uendret)    |
| Viewport            | Fast `{ center, zoom: 13.5 }` — ingen fitBounds | fitBounds rundt POI-klyngen (uendret)          |
| Interaksjon         | Hele kortet er én klikk-target                  | Markers er klikkbare individuelt (uendret)     |
| Tooltip / popover   | Ingen                                           | MarkerTooltip ved hover (uendret)              |

## Implementation Units

- [ ] **Unit 1: Innfør `previewMode` på `ReportThemeMap`**

**Goal:** Forberede ReportThemeMap til å rendre forenklet preview-versjon: single-tone POI-prikker, fixed view, oppgradert prosjekt-pin. Modal-tilstanden påvirkes ikke.

**Requirements:** R3, R4, R8

**Dependencies:** Ingen

**Files:**
- Modify: `components/variants/report/ReportThemeMap.tsx`

**Approach:**
- Legg til `previewMode?: boolean` (default `false`) i props
- Når `previewMode=true`:
  - Hopp over `initialBounds`-beregningen → bruk `{ longitude: center.lng, latitude: center.lat, zoom: 13.5 }` direkte
  - Render POI-er som enkle `<Marker>` med en liten sirkel-div (8-10 px, single-tone f.eks. `#94a3b8`) — ingen ikoner, ingen tooltips, ingen tier-styling
  - Erstatt prosjekt-pin (Building2) med Lucide `Home`-ikon, øk størrelse fra `w-12 h-12` til `w-14 h-14`, behold pulse-ring (forsterk om nødvendig), behold label-chip
  - `cooperativeGestures=true` (allerede default når `!activated`)
  - Hopp over rute-overlay-fetch (`useEffect` på `highlightedPOIId`) — ingen highlight i preview
- Når `previewMode=false` (default): all eksisterende oppførsel uendret

**Patterns to follow:**
- Eksisterende dual-mode-pattern i ReportThemeMap (`activated`-prop styrer cooperativeGestures + onClick-binding)
- Lucide-import-mønster: `import { Home } from "lucide-react"` ved siden av eksisterende `Building2`

**Test scenarios:**
- *Test expectation: none — visuell preview-komponent uten ny forretningslogikk. Verifisering skjer via mekaniske sjekker + visuell QA i Unit 3 og 4.*

**Verification:**
- TypeScript-typer passerer
- ReportThemeMap kompilerer både med og uten `previewMode`-prop
- Eksisterende kall-sites (i modal-slot) er upåvirket fordi `previewMode` defaulter til `false`

---

- [ ] **Unit 2: Bygg `ReportMapPreviewCard` — delt preview-card-komponent**

**Goal:** Ekstraher det dupliserte preview-button-mønsteret (gradient + CTA-pille) fra `ReportOverviewMap` og `ReportThemeSection` til én gjenbrukbar komponent som rommer info-stripen, watercolor-illustrasjon, hover-states og pil-i-sirkel-CTA.

**Requirements:** R5, R6

**Dependencies:** Ingen (kan bygges parallelt med Unit 1)

**Files:**
- Create: `components/variants/report/ReportMapPreviewCard.tsx`

**Approach:**
- Komponent-API:
  - `title: string` — tema-tittel eller samlekart-tittel
  - `count: number` — POI-antall
  - `countLabel?: string` — default "steder på kartet" (samlekart kan f.eks. bruke "steder i nabolaget")
  - `illustrationSrc: string` — path til watercolor-bilde
  - `illustrationAlt: string`
  - `onClick: () => void`
  - `children: ReactNode` — kart-slot (mottar `<ReportThemeMap previewMode />`)
- Layout: ytre `<button>` med `group cursor-pointer`. Inni:
  - Kart-container `h-[320px] md:h-[440px] rounded-2xl overflow-hidden border` (samme høyde som dagens preview)
  - Behold gradient-overlay (`bg-gradient-to-t from-[#f5f1ec]/90 via-[#f5f1ec]/10 to-transparent pointer-events-none z-10`)
  - Info-stripe under kartet: `bg-white p-6 rounded-2xl mt-3 flex items-center gap-4 group-hover:shadow-lg transition`
    - Venstre kolonne (flex-1): `<h3>{title}</h3>` + `<p>{count} {countLabel}</p>`
    - Høyre kolonne: `<Image src={illustrationSrc} alt={illustrationAlt} width={320} height={120} />` (next/image, eksisterende ESLint-regel)
  - Pil-CTA: liten sirkulær div (`w-10 h-10 rounded-full bg-[#1a1a1a]`) m/ Lucide `ArrowUpRight`-ikon, posisjonert under tittel/meta i venstre kolonne
- Hover-states: `group-hover:` på prosjekt-pin (via CSS-variabel eller direkte i ReportThemeMap når `previewMode`), `group-hover:bg-[#1a1a1a]/85` på pil-CTA, subtil shadow-lift på info-stripen

**Patterns to follow:**
- Eksisterende preview-button i `ReportThemeSection.tsx:256-282` — samme høyde, samme rounded-2xl-kant
- Eksisterende next/image-bruk: `import Image from "next/image"`
- Eksisterende Lucide-ikoner i ReportPage-komponenter: `import { ArrowUpRight } from "lucide-react"`

**Test scenarios:**
- *Test expectation: none — presentasjons-komponent uten forretningslogikk. Verifisering skjer via mekaniske sjekker + visuell QA i Unit 3 og 4.*

**Verification:**
- TypeScript-typer passerer
- Komponenten kan importeres og rendres uten runtime-feil
- Forhåndsvisning i en sandboxet rute eller via Storybook-aktig test (om eksisterende), evt. i Unit 3/4 som dekker integrert visuell QA

---

- [ ] **Unit 3: Refaktorer samlekart (`ReportOverviewMap`) til ny preview-card**

**Goal:** Bytt ut samlekartets dormant button-wrapper med `ReportMapPreviewCard`. Fjern den gamle midt-på-kartet-CTA-pillen, "Utforsk i 3D"-pillen, og "232 steder i 3D"-tekst-overlayet. Modal-åpningen og 3D-modus-toggle endres ikke.

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `components/variants/report/blocks/ReportOverviewMap.tsx`

**Approach:**
- Erstatt `<button onClick={handleOpenSheet}>...</button>` (linjer ca. 174-209 i nåværende fil) med:
  - `<ReportMapPreviewCard title={'Alt rundt ' + projectName} count={pois.length} countLabel="steder i nabolaget" illustrationSrc={...} illustrationAlt={...} onClick={handleOpenSheet}>`
  - `<ReportThemeMap previewMode pois={pois} center={mapCenter2D} ... activated={false} projectName={projectName} />`
  - `</ReportMapPreviewCard>`
- Velg illustrasjon: bruk midlertidig en eksisterende hero-scene fra `public/illustrations/` (f.eks. `langenga-h7-hero.jpg`). Erstattes av panoramisk Wesselsløkka i Unit 5.
- UnifiedMapModal-sektionen (linjer 213-300+) holdes uendret — modal-tilstanden bruker fortsatt full POI-rendering

**Patterns to follow:**
- Eksisterende UnifiedMapModal-integrasjon (uendret)
- Eksisterende `handleOpenSheet`-callback

**Test scenarios:**
- Happy path: når preview-kortet klikkes, åpnes UnifiedMapModal — bekreft at sheetOpen-state settes og modal mounter
- Edge case: når `pois.length === 0`, vis preview med antall 0 (eller hopp over hele blokken — eksisterende oppførsel)
- Integration: når modal åpnes, unmounter ReportThemeMap-preview (eksisterende `!sheetOpen`-guard) — bekreft at WebGL-kontekst-grensen ikke brytes på iOS

**Verification:**
- Visuell QA: åpne en rapport (f.eks. lokal dev mot et eksisterende prosjekt), bekreft at samlekartet vises med ny preview-card-layout, info-stripe under, og at klikk åpner UnifiedMapModal som før
- `npm run lint`, `npx tsc --noEmit`, `npm run build` passerer

---

- [ ] **Unit 4: Refaktorer per-tema-kart (`ReportThemeSection`) til ny preview-card**

**Goal:** Bytt ut per-tema-seksjonens dormant button-wrapper (linjer 253-283) med `ReportMapPreviewCard`. Modal-åpningen og UnifiedMapModal-integrasjonen endres ikke.

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `components/variants/report/ReportThemeSection.tsx`

**Approach:**
- Erstatt `mapPreview`-konstantens innhold (linjer 255-283) med `<ReportMapPreviewCard>`-bruk:
  - `title={theme.title}` (eller hva tema-objektet eksponerer som visningstittel)
  - `count={theme.allPOIs.length}`
  - `countLabel="steder på kartet"`
  - `illustrationSrc` — map theme-id til en eksisterende illustrasjon i `public/illustrations/icons/{theme-id}.png` (gjenbruk eksisterende mapping fra `ReportThemeChipsRow.tsx` om mulig — sjekk navnekonvensjon ved implementasjon)
  - `onClick={openMap}`
- Innholdet inni: `<ReportThemeMap previewMode pois={theme.allPOIs} center={center} mapStyle={mapStyle} activated={false} projectName={projectName} trails={theme.trails} vehiclePositions={vehiclePositions} />`
- `vehiclePositions` (sparkesykler/biler) beholdes — er allerede dempet uten labels og passer skissens prinsipp

**Patterns to follow:**
- Eksisterende theme-id → illustrasjon-mapping i `ReportThemeChipsRow.tsx`
- Eksisterende `openMap`-callback

**Test scenarios:**
- Happy path: klikk på preview-kort i en tema-seksjon → UnifiedMapModal åpner med riktig tema-data
- Edge case: tema med `allPOIs.length === 0` → preview-kortet skal ikke rendres (eksisterende guard `theme.allPOIs.length > 0`)
- Integration: hover-state aktiveres på hele kortet — prosjekt-pin scaler subtilt og pil-CTA dempes

**Verification:**
- Visuell QA: scroll gjennom alle 7 tema-seksjoner i en rapport, bekreft at hver bruker ny preview-layout med riktig illustrasjon, antall og tittel
- Klikk minst 3 ulike tema-previews og bekreft at modal åpner med riktig data

---

- [ ] **Unit 5: Generer panoramisk Wesselsløkka-illustrasjon for samlekart-info-stripen**

**Goal:** Generere én bred horisontal watercolor-illustrasjon som passer som "samlekart"-illustrasjon i info-stripen, og bytte den inn som standard `illustrationSrc` i `ReportOverviewMap`. Erstatter den midlertidige hero-scene-plassholderen fra Unit 3.

**Requirements:** R5

**Dependencies:** Unit 3 (kortet er på plass og venter på endelig illustrasjon)

**Files:**
- Create: `public/illustrations/scenes/samlekart-panorama.png` (eller tilsvarende navn)
- Modify: `components/variants/report/blocks/ReportOverviewMap.tsx` (bytt ut midlertidig `illustrationSrc`)

**Approach:**
- Invoker `placy-illustrations`-skill med spesifikasjon:
  - Stil: Wesselsløkka-akvarell (skill-default)
  - Aspect ratio: bred horisontal — start med 16:9 eller 21:9, juster mot info-stripens illustrasjons-slot (default 320×120 i Unit 2 — implementer kan justere)
  - Innhold: helhetlig nabolags-scene som gir varm, redaksjonell tone og fungerer som visittkort for "alt rundt prosjektet". Trondheim-orientert (vann/kanaler/sentrum kan inkluderes generisk uten å låse til ett konkret prosjekt)
  - Referanse-prosjekt: `klienter/placy/.../ferjemannsveien-10` (Trondheim-kontekst)
- Lagre i `public/illustrations/scenes/` (opprett mappe om nødvendig)
- Bytt ut midlertidig `illustrationSrc` i `ReportOverviewMap.tsx`
- Optional: hvis behovet for ulike scenes per prosjekt blir tydelig under generering, dokumenter som follow-up

**Patterns to follow:**
- `placy-illustrations`-skillets innebygde script og kanoniske stil-anchors
- Eksisterende `public/illustrations/`-konvensjon (PNG, descriptive filnavn)

**Test scenarios:**
- *Test expectation: none — illustrasjons-asset uten kode-logikk. Verifisering er visuell.*

**Verification:**
- Generert PNG vises tydelig i samlekart-info-stripen (visuell QA i browser)
- Stilen matcher Wesselsløkka-akvarell-uttrykk (sammenligning mot eksisterende `public/illustrations/icons/`)
- Filstørrelsen er ikke urimelig stor (< 500 KB foretrukket; juster Gemini-output-kvalitet om nødvendig)

## System-Wide Impact

- **Interaction graph:**
  - `ReportOverviewMap` → `ReportMapPreviewCard` → `ReportThemeMap (previewMode)`
  - `ReportThemeSection` → `ReportMapPreviewCard` → `ReportThemeMap (previewMode)`
  - Begge wrappes fortsatt av `UnifiedMapModal` for modal-tilstanden — den koblingen er uendret
- **API surface parity:** `ReportThemeMap`s eksisterende props (uten `previewMode`) er bakoverkompatible — defaulter til `false`. Andre konsumenter av komponenten påvirkes ikke.
- **Unchanged invariants:**
  - Modal-tilstand (klikk → UnifiedMapModal) renderer fortsatt full POI-data med kategori-ikoner, labels, tooltips, ruter, og fitBounds-viewport
  - Explorer- og Guide-produktene bruker IKKE ReportThemeMap — er upåvirket
  - Datamodell, POI-pipeline, theme-config: uendret
- **Integration coverage:** Visuell QA er essensiell — preview-redesignet er en presentasjons-endring og fanges ikke av enhetstester. Krev at minst samlekart + 2 tema-previews verifiseres manuelt før merge.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Fixed-zoom (13.5) er feil for prosjekter utenfor Trondheim — POI-er klumper for langt unna eller for tett | Tunes per visuell QA. Hvis problemet er systemisk (f.eks. veldig sentrum-prosjekt vs. forstad-prosjekt), introduser per-prosjekt `previewZoom` i project-config. Følg opp som separat task hvis det blir et reelt problem. |
| Single-tone POI-prikker mister informasjon brukere allerede har internalisert (kategori-fargene) | Akseptert — preview er ikke ment som detaljert info-flate. Detaljerte kategorier vises i modal og chips-row. Skissen og brukerens eksempel (sparkesykkel-prikker) bekrefter at dette er intendert. |
| Gjenbruk av eksisterende ikoner som illustrasjon (Unit 3-4) ser malplassert ut visuelt | Lever Unit 3-4 først som skiss-versjon. Når Unit 5 (panoramisk illustrasjon) er ferdig, bytt inn riktig kunst. Per-tema-illustrasjoner er deferred til senere task. |
| Hover-state-animasjoner blir for "rastløse" på lange rapport-sider med mange tema | Hold animasjoner subtile (scale-105, ikke -110; opacity-justering, ikke fargetransform). QA på en full rapport, ikke bare én seksjon. |
| `Image`-komponentens layout-shift når illustrasjonen lastes | Bruk eksplisitte `width`/`height` (next/image-default) og `priority={false}`. Reservér plass i info-stripens grid. |

## Documentation / Operational Notes

- Oppdater `WORKLOG.md` med entry når Unit 1-4 er deployert
- Hvis ny `applyMutedPreviewTheme` legges til i map-styles.ts som follow-up, dokumenter forskjellen mellom de tre tema-funksjonene i `lib/themes/map-styles.ts` (kommentar i fil)
- Samlekart-illustrasjonen (Unit 5) bør refereres i `docs/solutions/` om det blir en gjenbrukbar pattern (f.eks. "preview-illustrasjons-konvensjon")

## Sources & References

- Bruker-skissens fil: `board (1).jpg` (delt i samtalen, ikke i repoet)
- Berørte filer:
  - `components/variants/report/ReportThemeMap.tsx`
  - `components/variants/report/blocks/ReportOverviewMap.tsx`
  - `components/variants/report/ReportThemeSection.tsx`
  - `components/variants/report/ReportThemeChipsRow.tsx` (referanse for theme-id → illustrasjon-mapping)
- Relatert kontekst-fil: `lib/themes/map-styles.ts` (eksisterende `applyIllustratedTheme`)
- Relatert plan-fil: `docs/plans/2026-04-28-001-refactor-deaktiver-3d-poi-distanse-opacity-plan.md` (delvis overlappende oppryddings-arbeid på 3D-modal-siden — kan slås sammen i samme PR hvis sekvenseringen passer)
- Relatert skill: `placy-illustrations` (Unit 5)
