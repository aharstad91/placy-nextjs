---
created: 2026-05-21
status: active
origin: docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md
worklog: PROJECT-LOG.md (2026-05-21-entries)
---

# Plan — Featured POI-chips per kategori + map-marker labels

## Problem & goals

Kategori-seksjonene i scroll-panelet ble nettopp utvidet til min-h 65vh for å gi 1.5-visible-rytmen. Resultatet er at hver seksjon nå har ~200–300px tomt rom etter manus-tekst og spill-av-knapp. Vi trenger strukturelt content som:

- Fyller seksjonene visuelt uten å øke tekst-vekt
- Skaper eksplisitt synergi mellom sidebar-content og kart (i dag kommuniserer de ikke konkret)
- Inviterer til interaksjon med kartet
- Gir megler/kunde et konkret håndtak i framtidig curator-flyt: "topp N punkter du vil fremheve per kategori"

## Origin & context

- **Brainstorm:** `docs/brainstorms/2026-05-18-rapport-board-helhetlig-narrativ-brainstorm.md` — R11–R14 fastsetter at POI-detalj nås primært via kart-markør-klikk (overlay), ingen inline Punkter-tab. Denne planen utvider R11 prinsippet: chips er en *ekstra* inngang til samme overlay, ikke et nytt POI-detalj-felt i seksjonen.
- **Session-sparring 2026-05-21:** Bruker landet på chip-cloud-format (navn + kategori-ikon, klikkbart) + map-marker-labels på samme topp-N. Random POI-utvalg i prototype; produksjon vil ha curator-driven valg av megler/kunde.
- **Brainstorm 2026-04-09:** `kategori-hero-insight` introduserte allerede konseptet "POI-tiering i 3 roller" (kort/tekst/kart). Denne planen er en lettere variant av den ideen, tilpasset slank-pitch-arkitekturen fra 2026-05-18.
- **Data-form:** `BoardCategory.pois: BoardPOI[]` med name, address, coordinates, raw (Google data). Helper-funksjonen tar `pois + count + seed` og returnerer deterministisk slice.

## Approach

3–5 POI-navn-chips i en horisontal cloud under manus-teksten i hver kategori-seksjon. Hver chip viser POI-navnet + kategoriens ikon. Klikk → eksisterende `OPEN_POI`-dispatch åpner POI-overlay med klikket POI på topp. Map-marker-laget legger til synlig navnelabel for de samme top-N POI-ene som default (uten å aktivere POI-state). Ikke-featured POIs viser kun ikon, som i dag.

Random-utvalg er en *prototype-shim*: deterministisk shuffle med `category.id` som seed, slik at samme POI-er vises ved hver reload. Helper-funksjonen får en TODO som peker mot fremtidig curator-input på `BoardCategory` (f.eks. `featuredPoiIds?: BoardPOIId[]`).

## Scope boundaries

### In scope
- Helper `pickFeaturedPOIs(pois, count, seed)` — deterministisk random
- `CategoryFeaturedChips`-komponent
- Integrasjon i `CategorySection` (desktop scroll-panel)
- Integrasjon i mobile-equivalent (`BoardCategoryInfoTab`)
- Map-marker-laget viser navnelabel for featured POIs
- Tomt-state håndtering (få eller ingen POIs)

### Out of scope
- Curator-UI for megler/kunde til å plukke top-N per kategori — produksjons-arbeid, separat oppgave
- Walk-time per chip — krever travel-times-API-pipeline
- Hover-state på chip → midlertidig kart-highlight uten å åpne overlay
- Persistering av featured-POI-valg i database/config

### Deferred to separate tasks
- **Curator-flyt:** en admin må kunne velge top-N per kategori per prosjekt. Når den UI-en finnes, erstatter den random-shim'en i Unit 1.
- **Walk-time-pipeline integrasjon:** hvis chips senere skal vise "Lily · 4 min", krever det at `pois[].walkTime` er hydrert ved board-data-bygging.

## Implementation units

### Unit 1 — Helper: pickFeaturedPOIs

**Goal:** Deterministisk slice av N POIs fra en kategori.

**Files:**
- Create: `lib/board/featured-pois.ts`
- Test: `lib/board/featured-pois.test.ts`

**Approach:**
Funksjon med signatur `pickFeaturedPOIs(pois: BoardPOI[], count: number, seed: string): BoardPOI[]`. Bruker en enkel seeded PRNG (f.eks. cyrb53-hashing av seed + Mulberry32 for shuffle, eller direkte Fisher-Yates med seed-basert tilfeldighet) — inline-implementasjon, ingen ny avhengighet. Returner første `count` etter shuffle. Hvis pois.length < count → returner alle. Ikke-mutere input. TODO-kommentar i toppen: *"Prototype-shim — erstattes med curator-valg fra BoardCategory.featuredPoiIds når UI finnes."*

**Verification:**
- Test: samme seed → samme output (determinisme)
- Test: count > pois.length → returner alle uten å throw
- Test: ikke-mutere input-array
- Test: tomt input → tom output

**Patterns to follow:** `lib/utils/`-mappa har småhjelpere; bygg lignende ren-funksjon, ingen sideeffekter.

### Unit 2 — Komponent: CategoryFeaturedChips

**Goal:** Horisontal chip-cloud med POI-navn + kategori-ikon, klikkbar.

**Files:**
- Create: `components/variants/report/board/CategoryFeaturedChips.tsx`

**Approach:**
Props: `{ pois: BoardPOI[]; category: BoardCategory; onChipClick: (poi: BoardPOI) => void }`. Layout: `flex flex-wrap gap-2`. Hver chip er en `<button>` med rounded-full bg-stone-100, kategori-ikon (16px) + POI-navn, ring-1 ring-stone-200, hover/active-states. Bruker `getFilledIcon(category.icon)` fra `lib/utils/map-icons-filled` (samme som rail). aria-label per knapp: "Åpne {POI.name}". Empty pois → returner null.

**Verification:**
- Render N chips for N POIs
- onChipClick fires med riktig POI
- Empty array → ingen render
- aria-label er satt
- Visual: chips wrapper naturlig på smale viewports

**Patterns to follow:**
- Eksisterende chip-aktige knapper i `BoardRail.tsx` (rounded styling, hover/active)
- `getFilledIcon` for ikon-resolusjon

### Unit 3 — Integrasjon i CategorySection (desktop)

**Goal:** Chips vises under manus/karaoke-tekst i hver kategori-seksjon.

**Files:**
- Modify: `components/variants/report/board/desktop/BoardScrollPanel.tsx`

**Approach:**
I `CategorySection`: kall `pickFeaturedPOIs(category.pois, 5, category.id)` (kan memoizes via useMemo med category.id som dep). Render `<CategoryFeaturedChips>` med `onChipClick={(poi) => dispatch({ type: "OPEN_POI", id: poi.id, categoryId: category.id })}` under karaoke/manus-tekst-blokken. Vertikal gap (mt-6 eller lignende) for å la chips puste fra brødtekst.

**Verification:**
- Hver kategori viser opp til 5 chips
- Klikk på chip åpner POI-overlay med riktig POI på toppen (manuell sjekk)
- Karaoke-state og chip-rendering interfererer ikke (chips er statiske, karaoke driver bare tekst-spans)
- `tsc --noEmit` clean, `npm run lint` 0 errors

**Patterns to follow:**
- `CategoryAudioButton` viser hvordan en sub-komponent integreres i CategorySection med dispatch
- `OPEN_POI`-action shape i `board-state.tsx` linje 37

### Unit 4 — Integrasjon i mobile-equivalent

**Goal:** Mobil-paritet — chips vises i mobil-versjonen av kategori-seksjonen.

**Files:**
- Modify: `components/variants/report/board/BoardCategoryInfoTab.tsx` (eller hvor karaoke-text rendres i mobil-flow — verifiseres ved start av unit)

**Approach:**
Speil av Unit 3 i mobil-komponenten. Samme `pickFeaturedPOIs` + `CategoryFeaturedChips` med `OPEN_POI`-dispatch. Verifiser at chip-cloud wrapper greit i smal viewport (~360px).

**Verification:**
- Mobil sheet viser chips under tekst
- Klikk åpner POI-overlay (kan kreve sheet-navigasjon — sjekk eksisterende mønster)
- Visual paritet med desktop (samme komponent, samme styling)

### Unit 5 — Map-marker-labels for featured POIs

**Goal:** Featured POIs får synlig navnelabel ved markøren i kartet, alltid på (uavhengig av POI-state).

**Files:**
- Modify: `components/variants/report/board/BoardMap.tsx` og/eller `components/variants/report/board/BoardMap3D.tsx` (kart-marker-rendering — verifiseres ved start)
- Mulig: tilstand-flyt så featured-set er kjent for kart-laget (kan beregnes per render via `pickFeaturedPOIs`, eller løftes til `useMemo` ett sted)

**Approach:**
Identifisere hvor kategori-pins rendres i dag. Hver kategori har sin liste av POIs som rendres med ikon-marker. For hver featured POI (kjent via `pickFeaturedPOIs(category.pois, 5, category.id)`): render en ekstra `<Marker>` med tekst-label over POI-markøren (mønster fra `BoardPOILabel.tsx`). Eller: hvis nåværende marker-komponent er per-POI React, legg til en label-overlay inni samme komponent betinget av `isFeatured`-prop.

Visuell stil: lik label fra `BoardPOILabel.tsx` (rounded-full bg-white/95, px-3 py-1, text-xs font-semibold), men *uten* `pointer-events-none` hvis vi vil at label også skal være klikkbar — beslutning tas ved implementering. Plassering: offset oppover (mindre offset enn POILabel siden den ikke konkurrerer med den aktive POI-en).

**Verification:**
- Featured POIs viser navn ved markør
- Ikke-featured POIs viser kun ikon (uendret)
- Aktiv POI fortsatt får sin egen label via `BoardPOILabel` uten dobbel-rendering
- Manuell sjekk i browser: scroll gjennom kategorier, se at kart-labels samsvarer med chips

**Patterns to follow:**
- `BoardPOILabel.tsx` for label-styling og Marker-bruk
- Eksisterende marker-rendering for ikon-størrelse og z-index-hierarki

### Unit 6 — Visual polish + verification

**Goal:** Sicherstellen at det hele føles balansert.

**Files:** Justering i komponenter fra Unit 2–5 etter behov.

**Approach:**
- Manuell visual-test gjennom alle kategorier
- Juster spacing/typography hvis chips konkurrerer for mye med karaoke-tekst eller play-knapp
- Verifiser at min-h 65vh nå føles fylt, ikke overstuffet
- Screenshot før/etter for worklog-entry

**Verification:**
- Visual sjekk på desktop + mobil-emulering
- Ingen TS-feil, lint-feil, eller broken tester

## Deferred to Implementation (uavklart ved planlegging)

- **Eksakt fil for mobil-rendering av kategori-tekst:** Trolig `BoardCategoryInfoTab.tsx`, men sjekkes ved start av Unit 4. Hvis arkitekturen har endret seg, oppdater Unit 4.
- **Marker-rendering-arkitektur:** Per-POI React-komponent vs. samlet GeoJSON-layer? Vet ikke uten å lese `BoardMap.tsx` først. Unit 5 starter med rask utforsking.
- **Label-klikkbarhet:** Skal map-label være klikkbar (åpner samme overlay som chip) eller dekorativ? Default decision: dekorativ (pointer-events-none), gjør den enklere; revurder hvis visual-test viser at brukere prøver å klikke.

## Verification (helhetlig)

- `tsc --noEmit` → 0 feil
- `npm run lint` → 0 errors
- `npx vitest run lib/board/featured-pois.test.ts` → grønn
- Manuell browser-test: hver kategori har chips → klikk åpner overlay → kart viser labels for samme POIs
- Screenshot før/etter (legges i worklog-entry)

## Open questions (ikke-blokkerende)

Ingen åpne produkt-spørsmål — alle pilot-beslutninger landet i sesjonen (random shim, 5 chips, klikk-åpner-overlay, labels-alltid-på).
