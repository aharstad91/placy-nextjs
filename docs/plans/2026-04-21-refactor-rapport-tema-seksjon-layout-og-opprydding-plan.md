---
title: refactor: Rapport-tema-seksjon — layout og opprydding
type: refactor
status: active
date: 2026-04-21
---

# refactor: Rapport-tema-seksjon — layout og opprydding

## Overview

Rydde opp og restrukturere `ReportThemeSection` per kategori etter brukertesting på Wesselsløkka-rapporten. Fire sammenhengende problemer: (1) gradient-fade ligger på narrativ-tekst istedenfor å tease skjult innhold under, (2) POI-slider i tekst-seksjon skaper mer støy enn verdi når inline-POI-chips allerede gir samme info, (3) POI-popover (`POIInlineLink` vs `PoiChipRenderer`) er duplisert på to steder, (4) kartet er presset nederst under "juridisk" Google-stoff når det egentlig er hoved-CTA per kategori. I tillegg: utføre backlog-kort `WugZYeNg` (grounding UX-opprydding) som del av samme runde.

## Problem Frame

Tema-seksjonen per kategori har progressiv disclosure i to nivåer:
- **Default**: narrativ-tekst (faded) + "Les mer om X"-knapp
- **Expanded**: POI-slider + Gemini-utdyping + kart-preview

Brukertesting avdekket:
1. **Fade-posisjon misaligned** — gradient ligger på selve narrativen, viser bare "tekst blir kuttet", ikke at "her ligger mer innhold". Tidligere versjoner tease'et del-2-innhold bak fade. Vi har mistet den signaleringen.
2. **POI-slider er redundant** — kortene er gjenbruk fra kart-carousel, men uten kart-konteksten skaper expand-adferden (aktivt kort vokser) layout-brudd. Inline-POI-chips i narrativen gir samme verdi (kontekstuelle lenker) uten problemene. POI-slider var opprinnelig for (a) kart-CTA og (b) luft i tung tekst, men skaper mer problemer enn verdi.
3. **POI-popover duplisert** — `POIInlineLink` i `ReportThemeSection.tsx:666` og `PoiChipRenderer` i `ReportCuratedGrounded.tsx:260` er nær-identiske implementasjoner av samme Popover-mønster.
4. **Kart nederst er feil prioritet** — kart er en vesentlig innholds-komponent, ikke et tillegg etter "juridisk" Google-stoff. Må komme rett under ferdig narrativ, med kilder/chips/attribution på bunnen.
5. **Grounding-UX** har kjent backlog: fjerne "VI STILTE SPØRSMÅLET", ekstern `target="_blank"` på Google-chips, favicon + HoverCard for kilder (Trello `WugZYeNg`, verifisert mot Google ToS i PROJECT-LOG).

## Requirements Trace

- R1. Default-state: narrativ i full lengde + fade som tease'er del-2-innhold (ikke fade på narrativen)
- R2. "Les mer om X" reveal'er POI-inline + kart + grounding-narrativ uten layout-bråk
- R3. Ingen POI-slider i tekst-seksjon (men eksisterende kart-carousel i `UnifiedMapModal` forblir)
- R4. POI-popover konsolidert til én delt komponent brukt av både inline-narrativ og curated grounded markdown
- R5. Layout-rekkefølge per kategori (expanded): narrativ → Gemini curated narrative → kart-preview → kilder/legal
- R6. `WugZYeNg`: fjerne "VI STILTE SPØRSMÅLET"-blokk, favicon-kilder med HoverCard, `target="_blank"` på eksterne Google-chips
- R7. Klikk på "Les mer" eller kart-preview → åpner `UnifiedMapModal` direkte (ett-klikk, ikke dormant preview → klikk → modal)

## Scope Boundaries

- Berører **kun** `ReportThemeSection` og dens direkte barn (grounding-komponenter, POI-popover)
- Berører ikke `UnifiedMapModal`, `ReportMapBottomCarousel`, `ReportHeroInsight`, `ReportSummarySection`
- Berører ikke per-kategori-blocks (`BentoShowcase`, `FeatureCarousel`, `StatRow`, `TimelineRow`, `SplitFeature`, `AnnotatedMap`)
- Ingen endringer i grounding-data-pipeline (`lib/gemini/`, `scripts/curate-narrative.ts`) eller Zod-schema
- `curatedSliderPOIs` fjernes fra `ReportTheme`, `getCuratedPOIs` kan beholdes hvis andre forbrukere finnes (ingen per grep — kan fjernes)

### Deferred to Separate Tasks

- Eventuell redesign av inline-POI-chip-stil (beholder nåværende visuelle språk)
- Fullstendig opprydding av `POIInlineLink`-mønster i andre seksjoner (ReportHeroInsight, map-popup) — kun duplikatet mellom ThemeSection og CuratedGrounded adresseres her

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/ReportThemeSection.tsx` — hoved-komponenten. Inneholder inline `POIInlineLink` (linje ~666), `ExternalInlineLink` (~749), og hele layout-logikken for tema-seksjon
- `components/variants/report/ReportCuratedGrounded.tsx` — v2-grounding-render. Inneholder duplisert `PoiChipRenderer` (~260) og sources/legal-blokker (linje 167-223)
- `components/variants/report/ReportGroundingInline.tsx` — v1-grounding (fallback for pre-curated data). Må endres parallelt
- `components/variants/report/blocks/ReportThemePOICarousel.tsx` — POI-slider som fjernes (og testfilen)
- `components/variants/report/report-data.ts` — `ReportTheme.curatedSliderPOIs` (linje 112), populert via `getCuratedPOIs` (~linje 581)
- `components/variants/report/top-ranked-pois.ts` — `getCuratedPOIs` + `AnchorSlot` + `THEME_ANCHOR_SLOTS` (legacy etter fjerning)
- `components/ui/hover-card.tsx` — eksisterende HoverCard-primitive (shadcn/ui) for kilde-HoverCard-mønsteret
- `lib/utils/story-text-linker.ts` — `linkPOIsInText` parser som produserer POI-segmenter for inline-rendering

### Institutional Learnings

- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — Google ToS krever `searchEntryPointHtml` verbatim (DOMPurify-sanert). "Google foreslår også"-seksjonen må beholdes verbatim; kun "Vi stilte spørsmålet" fjernes
- `docs/solutions/ui-patterns/progressive-disclosure-kuratert-poi-slots-20260420.md` — nylig doc som beskriver nåværende mønster; må oppdateres eller erstattes
- Worklog 2026-04-19 (Trello `WugZYeNg`): grounding UX-opprydding er ToS-verifisert — kun search-chips må være verbatim, `target="_blank"` på eksterne lenker er OK

### Related Prior Work

- PR #68 (`c3f55f1`): unified POI-carousel i tekstseksjon — alle 7 kategorier. Den leverte POI-slider vi nå fjerner
- Merge `0843697` (2026-04-21): innførte `forceExpanded`-prop på grounding-komponentene — gjenbrukes for del-2-disclosure

## Key Technical Decisions

- **Fade som tease-signal (R1)**: Kollapse ikke narrativen; render alltid full narrativ, deretter "del-2-wrapper" (POI-chip-dense oppsummering eller første linjer av curated grounded) med fade-overlay når `!expanded`. "Les mer om X" under fade avslører resten. Beholder kontinuerlig lese-flow uten å skjule tekst som allerede er lest.
  - *Rationale*: Nåværende `line-clamp-[6]` skjuler slutten av en allerede kort narrativ — gir ingen verdi. Fade skal signalere "mer under", ikke "tekst fortsetter".

- **Splitte grounding-komponent (R5)**: `ReportCuratedGrounded` deles i `ReportCuratedGrounded` (kun narrativ-body) og `ReportGroundingSources` (kilder + "Google foreslår også" + attribution). Samme splitt for `ReportGroundingInline`. `ReportThemeSection` rendrer dem med kart-preview mellom.
  - *Rationale*: Layout-rekkefølge krever fysisk separasjon; en flat split er enklere enn slots/render-props.

- **Delt POI-popover-komponent (R4)**: Ekstraher til `components/variants/report/POIPopover.tsx`. Begge eksisterende implementasjoner erstattes. Komponenten tar `poi: POI` + valgfri `label?: string` (default `poi.name`).
  - *Rationale*: To identiske Popover-implementasjoner er støy. En delt komponent er ren gevinst.

- **Fjern POI-slider helt (R3)**: `ReportThemePOICarousel.tsx` + test + `curatedSliderPOIs`-felt + `getCuratedPOIs`-helper fjernes. Ingen andre forbrukere per grep.
  - *Rationale*: Redaktør-vurdering. Inline-POI-chips gir samme kontekst uten layout-problemer. Slette fremfor kommentere (CLAUDE.md: "SLETT det gamle umiddelbart").

- **Kart åpner modal direkte (R7)**: `!expanded && preview` + klikk → åpne modal. Ingen mellomtrinn. (Delvis levert i forrige økt — verifiseres her.)
  - *Rationale*: Dormant preview + klikk → modal var tre klikk totalt. For mange.

- **HoverCard for kilder (R6)**: Behold favicon-chip som trigger, HoverCard viser `source.title` + full URL. Bruk eksisterende shadcn/ui-primitive.
  - *Rationale*: Nåværende `title`-attributt er lite oppdagbar. HoverCard er konsekvent med andre popover-mønstre i rapporten.

## Open Questions

### Resolved During Planning

- **Skal `getCuratedPOIs`-helperen beholdes?** → Nei. Ingen andre forbrukere. Slettes inkludert tester. (Kan gjenopprettes fra git hvis behov oppstår.)
- **Skal "Google foreslår også"-chips ha `target="_blank"`?** → Ja. Google ToS krever verbatim HTML, men `target`-attr endrer ikke innhold. Verifisert i PROJECT-LOG 2026-04-19.

### Deferred to Implementation

- **Hvor mye av del-2 skal peek-e bak fade?** → Finjusteres visuelt under implementering. Start med første ~80-100px av grounding-narrativen.
- **Skal `ReportThemePOICarousel.test.tsx` slettes eller migreres?** → Slettes (testene dekker kun komponenten vi fjerner).

## Implementation Units

- [ ] **Unit 1: Delt POI-popover-komponent**

**Goal:** Én felles `POIPopover` som erstatter `POIInlineLink` og `PoiChipRenderer`.

**Requirements:** R4

**Dependencies:** Ingen.

**Files:**
- Create: `components/variants/report/POIPopover.tsx`
- Modify: `components/variants/report/ReportThemeSection.tsx` (fjern inline `POIInlineLink`, importer fra ny fil)
- Modify: `components/variants/report/ReportCuratedGrounded.tsx` (fjern `PoiChipRenderer`, importer fra ny fil)
- Test: `components/variants/report/POIPopover.test.tsx`

**Approach:**
- Prop-signatur: `{ poi: POI; label?: string }` — label default til `poi.name`
- Behold nåværende visuelle stil (inline icon-chip + Popover med image + editorial hook)
- `PoiChipRenderer` brukes fra markdown-linker-callback i `ReportCuratedGrounded` — ny komponent må signal-kompatibel

**Patterns to follow:**
- Eksisterende `POIInlineLink` (`ReportThemeSection.tsx:666`) — authoritativ stil-kilde
- `Popover` fra `@/components/ui/popover` (shadcn/ui)

**Test scenarios:**
- Happy path: rendrer label + icon-chip med POI.category.color når ingen `featuredImage`
- Happy path: bruker `image-proxy` URL når `featuredImage` kommer fra `mymaps.usercontent.google.com`
- Happy path: viser `poi.name` som default når `label` er utelatt
- Edge case: rendrer uten `googleRating` når den mangler
- Edge case: rendrer uten `walkMin` når `poi.travelTime?.walk` mangler

**Verification:**
- Ingen visuell regresjon på inline-POI-chips i narrativen
- Ingen visuell regresjon på POI-chips i curated grounded markdown
- `npm run lint` + `npx tsc --noEmit` rene

---

- [ ] **Unit 2: Splitte grounding-komponentene (narrativ vs kilder)**

**Goal:** Separer curated/raw narrativ fra sources/legal-blokker slik at kart kan rendres mellom dem.

**Requirements:** R5

**Dependencies:** Unit 1.

**Files:**
- Modify: `components/variants/report/ReportCuratedGrounded.tsx` (fjern sources-seksjonen, eksporter kun narrativ)
- Modify: `components/variants/report/ReportGroundingInline.tsx` (samme splitt)
- Create: `components/variants/report/ReportGroundingSources.tsx` (kilder + "Google foreslår også" + attribution, v1/v2-agnostisk)

**Approach:**
- `ReportGroundingSources` tar en union av v1/v2-grounding-typer (diskriminert på `groundingVersion`) og rendrer samme kilde/chip/attribution-UI som i dag
- Fjern `forceExpanded`-prop fra `ReportCuratedGrounded`/`ReportGroundingInline`: begge rendrer alltid full narrativ (parent styrer disclosure via DOM-wrapper, ikke via prop)
- `FavIcon` og `formatFetchedAt` flyttes til felles util eller til `ReportGroundingSources` (ikke dupliseres)

**Patterns to follow:**
- Eksisterende sources-blokk i `ReportCuratedGrounded.tsx:167-223` — authoritativ UI-kilde
- Zod-disc-union-pattern fra `lib/types.ts` (`ReportThemeGroundingView` v1/v2)

**Test scenarios:**
- Happy path: v2-grounding → rendrer narrativ med POI-chips
- Happy path: v1-grounding → rendrer narrativ med inline POI (`linkPOIsInText`)
- Integration: `ReportGroundingSources` rendrer samme kilder uavhengig av v1/v2
- Edge case: `grounding.sources.length === 0` → ingen "Kilder"-h4
- Edge case: ingen `query`-prop → ingen "Vi stilte spørsmålet"-blokk (allerede fjernet i Unit 5)

**Verification:**
- Grounding-narrativ rendres identisk som i dag (minus sources-blokk)
- `ReportGroundingSources` alene produserer korrekt bunn-seksjon

---

- [ ] **Unit 3: Fjern POI-slider fra tekst-seksjon**

**Goal:** Fjern `ReportThemePOICarousel` og relatert data-pipeline.

**Requirements:** R3

**Dependencies:** Ingen.

**Files:**
- Modify: `components/variants/report/ReportThemeSection.tsx` (fjern import + bruk av `ReportThemePOICarousel`)
- Modify: `components/variants/report/report-data.ts` (fjern `curatedSliderPOIs`-felt og populering)
- Delete: `components/variants/report/blocks/ReportThemePOICarousel.tsx`
- Delete: `components/variants/report/blocks/ReportThemePOICarousel.test.tsx`
- Modify: `components/variants/report/top-ranked-pois.ts` (fjern `getCuratedPOIs`, `AnchorSlot`, `THEME_ANCHOR_SLOTS`)
- Modify: `components/variants/report/top-ranked-pois.test.ts` (fjern tester for `getCuratedPOIs`)

**Approach:**
- Fjern `ReportTheme.curatedSliderPOIs`-feltet fra interface
- Behold `getTopRankedPOIs` (brukes av `theme.topRanked` i kart-bunn-carousel)
- Verifiser ingen andre forbrukere av `getCuratedPOIs` med grep før sletting

**Patterns to follow:**
- CLAUDE.md Arkitekturregel "Kodebase-hygiene": SLETT gammelt umiddelbart, ingen dead code

**Test scenarios:**
- Test expectation: none — ren sletting. Eksisterende `top-ranked-pois.test.ts`-tester for `getTopRankedPOIs` må fortsatt passere.

**Verification:**
- Ingen import-feil (`npx tsc --noEmit`)
- `npm test` grønt
- Tema-seksjon rendrer uten POI-slider mellom narrativ og grounding

---

- [ ] **Unit 4: Restrukturere ReportThemeSection — ny rekkefølge + fade-tease**

**Goal:** Implementer ny layout: narrativ (alltid full) → tease-fade + "Les mer" → grounding-narrativ → kart-preview → grounding-sources. Løs fade-misalignment.

**Requirements:** R1, R2, R5, R7

**Dependencies:** Unit 1, Unit 2, Unit 3.

**Files:**
- Modify: `components/variants/report/ReportThemeSection.tsx`

**Approach:**
- Fjern `line-clamp-[6]` og fade fra selve narrativ-teksten — narrativen er alltid full
- Ny struktur:
  1. `ReportHeroInsight` (uendret)
  2. Narrativ (full, både `upperSegments` + `segments`) — ingen clamp
  3. **Tease-wrapper**: container med `max-h-[80px]`-clamp + gradient-fade når `!expanded`. Inneholder første del av grounding-narrativen. Klikk-område på "Les mer om X"-knappen.
  4. "Les mer om X" / "Vis mindre"-knapp (gjeldende plassering; ikke dupliseres)
  5. Når `expanded`:
     - (a) Transport: `ReportAddressInput`
     - (b) `ReportCuratedGrounded` eller `ReportGroundingInline` (kun narrativ, full høyde)
     - (c) Kart-preview (klikk → `setMapDialogOpen(true)`)
     - (d) `ReportGroundingSources` (kilder + "Google foreslår også" + attribution)
- Fjern `forceExpanded`-prop fra grounding-kallene (parent styrer disclosure via render-gate)
- Fjern `mapPreviewVisible` helt — ikke eksisterer per nå

**Patterns to follow:**
- `expanded`-state-mønsteret som allerede finnes
- Nåværende `!mapDialogOpen`-guard for dual-WebGL-beskyttelse (beholdes på kart-preview)
- Tailwind fade-mønster: `bg-gradient-to-b from-transparent to-[#f5f1ec]`

**Test scenarios:**
- Happy path: `!expanded` → narrativ full, tease-wrapper viser del av grounding-narrativ bak fade, "Les mer om X" synlig
- Happy path: `expanded=true` → grounding-narrativ full, kart-preview synlig, sources-blokk nederst
- Happy path: klikk på kart-preview → åpner `UnifiedMapModal`
- Integration: `expanded` toggler både grounding-narrativ, kart og sources samtidig (én state)
- Edge case: `variant="secondary"` → skjul "Les mer", POI-slider, kart (beholdes fra nåværende oppførsel)
- Edge case: ingen grounding-data → tease-wrapper viser fallback-intro (eller skjules helt hvis ingen innhold å tease)

**Verification:**
- Chrome DevTools: Wesselsløkka-rapporten rendrer per `context/` i Wesselsløkka-seksjon
- Ingen `line-clamp`-rester på narrativ-tekst
- Layout-rekkefølge matcher R5

---

- [ ] **Unit 5: WugZYeNg grounding UX-opprydding**

**Goal:** Fjern "VI STILTE SPØRSMÅLET"-blokk, legg HoverCard på kilde-favicons, sikre `target="_blank"` på Google-chips.

**Requirements:** R6

**Dependencies:** Unit 2 (bruker `ReportGroundingSources`).

**Files:**
- Modify: `components/variants/report/ReportGroundingSources.tsx`

**Approach:**
- Fjern blokken `{query && (...)}` som rendrer "Vi stilte spørsmålet"
- Fjern `query`-prop fra `ReportGroundingSources` og fra grounding-komponentene hvis ubrukt etter dette (se også `ReportThemeSection` som sender `theme.readMoreQuery`)
- Erstatt `title`-attributt på kilde-chip med `HoverCard` som viser `source.title` + domene
- For "Google foreslår også" (`dangerouslySetInnerHTML`): etter-behandle HTML for å legge til `target="_blank" rel="noopener noreferrer nofollow"` på `<a>`-tags. Verifiser at sanitized HTML ikke allerede har dem.
  - Alternativ: client-side DOM-mutation med `useEffect` + ref — `document.querySelectorAll` på container
  - ToS-avklaring: search-chips må være verbatim på innhold, men `target`-endring er tillatt (verifisert worklog 2026-04-19)

**Patterns to follow:**
- `@/components/ui/hover-card` — eksisterende shadcn/ui-primitive
- DOMPurify-sanitation-mønster fra `lib/security/sanitize-*`

**Test scenarios:**
- Happy path: kilde-chips rendrer HoverCard med source.title ved hover
- Happy path: Google-chip `<a>`-tags har `target="_blank"` etter mount
- Edge case: tom sources-array → ingen Kilder-h4
- Edge case: `searchEntryPointHtml` uten `<a>`-tags → ingen krash på DOM-mutation

**Verification:**
- "VI STILTE SPØRSMÅLET" ikke synlig i noen kategori
- HoverCard trigger på kilde-chip hover
- Klikk på Google-chip åpner i ny fane

---

- [ ] **Unit 6: Oppdater compound-doc + Trello-kort**

**Goal:** Reflekter endringene i `docs/solutions/` og lukk `WugZYeNg`.

**Requirements:** R6

**Dependencies:** Unit 1-5.

**Files:**
- Modify: `docs/solutions/ui-patterns/progressive-disclosure-kuratert-poi-slots-20260420.md` (oppdater eller erstatt)
- Modify: `WORKLOG.md` (ny entry)

**Approach:**
- Oppdater compound-doc: fjern POI-slider-seksjonen, beskriv ny layout (narrativ → grounding-narrativ → kart → kilder)
- Worklog-entry dekker alle 5 units
- Trello `WugZYeNg`: flytt til Done via mcp__trello

**Test scenarios:**
- Test expectation: none — dokumentasjon

**Verification:**
- Compound-doc matcher faktisk implementasjon
- Worklog dekker alle filer fra Unit 1-5

## System-Wide Impact

- **Interaction graph:** `expanded`-state styrer nå tre ting (grounding-narrativ, kart, sources) via én render-gate. Ingen nye globale state-effekter.
- **API surface parity:** `ReportCuratedGrounded` og `ReportGroundingInline` får begge samme shape-splitt. Hvis en annen page-variant (admin, debug) bruker dem direkte, må den oppdateres.
- **Integration coverage:** Kart-preview-klikk → `UnifiedMapModal` er allerede dekket; endret layout-kontekst krever verifisering.
- **Unchanged invariants:** `UnifiedMapModal`, `ReportMapBottomCarousel` (inne i modal), `ReportHeroInsight`, Gemini-grounding-data-pipeline (schema, Zod, `curate-narrative.ts`) berøres ikke.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Splitt av `ReportCuratedGrounded` brekker andre forbrukere | Grep bekrefter: kun `ReportThemeSection` bruker dem. Verifiser før merge. |
| DOM-mutation på `dangerouslySetInnerHTML` for Google-chips race'er med SSR | Kun client-side (useEffect); SSR rendrer rå HTML uten target-attr — graceful degradering. |
| Tease-fade-peek viser "rart" innhold når grounding mangler | Conditional render: fade-wrapper kun når grounding-narrativ finnes. Fallback til "Les mer"-knapp uten tease. |
| Fjerning av `getCuratedPOIs` brekker legacy page | Grep: ingen andre importers funnet. |

## Documentation / Operational Notes

- Compound-doc `progressive-disclosure-kuratert-poi-slots-20260420.md` blir delvis utdatert — oppdater eller erstatt med ny doc som reflekterer nåværende mønster (narrativ → grounding → kart → kilder, uten slider)
- Worklog-entry dekker alle endringer
- Ingen migrasjoner eller database-endringer

## Sources & References

- Worklog 2026-04-19 entries om grounding-UX (`WugZYeNg`)
- Trello-kort `WugZYeNg` (grounding UX-opprydding)
- PR #68 (`c3f55f1`) — POI-carousel introduksjon (nå reversed)
- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`
- `docs/solutions/ui-patterns/progressive-disclosure-kuratert-poi-slots-20260420.md`
