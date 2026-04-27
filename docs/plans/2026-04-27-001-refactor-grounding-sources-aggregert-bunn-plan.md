---
title: "Refactor: Aggreger Kilder til bunn av rapport, behold Google-chips inline"
type: refactor
status: active
date: 2026-04-27
---

# Refactor: Aggreger Kilder til bunn av rapport, behold Google-chips inline

## Overview

Hver rapport-tema-seksjon viser i dag tre grounding-elementer i bunn: "Kilder (N)"-pill-listen, "Google foreslår også"-chips, og "Generert med Google AI..."-attribution. Med 7 temaer blir dette tung visuell støy.

Dette refaktor flytter kilde-pillene (`groundingChunks`) til en konsolidert seksjon i bunnen av rapporten — gruppert/dedupliserert per domene med kategori-badges, i liten tekst. "Google foreslår også"-chipsene (`searchEntryPointHtml`) forblir inline per tema fordi Google ToS krever at de står adjacent til den grounded responsen.

## Problem Frame

På `/eiendom/[customer]/[project]/rapport` rendres `ReportGroundingSources` per tema med både kilder, Google-chips og attribution. Dette gjentas 7 ganger og spiser visuell oppmerksomhet på en side som ellers skal lede leseren gjennom narrativen.

Google ToS er klar:
- `searchEntryPointHtml` ("Google foreslår også") MÅ vises adjacent til sin grounded response — *"Whenever a grounded response is shown, its corresponding Search Suggestion should remain visible"* og *"will not modify, or intersperse any other content with, the Grounded Results or Search Suggestions"*. Kan ikke aggregeres.
- `groundingChunks` (kilde-URLer) krever "direct, single-click path" til kildesiden — formatet/plasseringen er fleksibelt. Aggregering nederst er tillatt.

Dette gir oss handlingsrom: ryd opp i kildelisten, behold chipsene som de er.

## Requirements Trace

- R1. Kilder vises kun én gang i rapporten — i bunn, før `ReportSummarySection`
- R2. Kilder grupperes/deduplisères per domene; samme domene brukt i flere temaer vises én gang med badge-liste over hvilke temaer
- R3. Liten tekst (proporsjonelt mindre enn dagens pills) — typografisk dempet
- R4. Hvert tema viser fortsatt sin egen "Google foreslår også"-chip-rad inline (ingen endring i ToS-compliance)
- R5. Hver tema-seksjon viser ikke lenger sin egen "Kilder (N)"-pill-liste
- R6. "Generert med Google AI…"-attribution flyttes til bunn-seksjonen sammen med kildene (én gang, ikke 7)
- R7. Klikk på en kilde åpner kildesiden direkte (`target="_blank" rel="noopener noreferrer nofollow" referrerpolicy="no-referrer"` — bevares fra dagens implementasjon)

## Scope Boundaries

- Endrer ikke datamodell (`ReportThemeGrounding`, `groundingVersion`, Zod-skjema, JSONB-shape)
- Endrer ikke `searchEntryPointHtml`-rendering (DOMPurify-sanering, verbatim render, target-attr-injeksjon ved mount)
- Endrer ikke `ReportCuratedGrounded.tsx` (v2-narrative-renderer) — kun kilder-blokken refaktoreres
- Endrer ikke Gemini grounding-script eller seed-mønster
- Endrer ikke `ReportSummarySection.tsx`-layout — den nye aggregerte seksjonen plasseres mellom secondary themes og summary-seksjonen

## Context & Research

### Relevant Code and Patterns

- `components/variants/report/ReportGroundingSources.tsx` — dagens monolitt, rendrer alle tre blokker
- `components/variants/report/ReportGroundingInline.tsx` — v1 narrative-renderer (uendret)
- `components/variants/report/ReportThemeSection.tsx:408-410` — der `ReportGroundingSources` brukes inline per tema (dynamic import linje 45)
- `components/variants/report/ReportPage.tsx:115-194` — sentral layout, har `max-w-[800px]`-container hvor ny seksjon kan legges inn
- `lib/types.ts:174-181` — `ReportThemeGroundingSource` (`{title, url, redirectUrl, domain}`)
- `lib/types.ts:257-263` — `ReportThemeGroundingViewSchema` (discriminated union v1/v2, begge har `sources[]` og `fetchedAt`)
- `components/ui/hover-card.tsx` — eksisterende HoverCard-mønster (brukes i dagens kilde-pills, kan gjenbrukes eller forenkles bort i mindre tekst)

### Institutional Learnings

- `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` — punkt 3: "searchEntryPointHtml er Google ToS-påkrevd … må rendres verbatim med styling. DOMPurify server-side før lagring." Definerer rammen vi opererer innenfor.
- `docs/solutions/best-practices/gemini-reference-background-override-20260413.md` — relatert grunnleggings-pattern (uendret av dette arbeidet)

### External References

- Vertex AI grounding docs: *"Whenever a grounded response is shown, its corresponding Search Suggestion should remain visible"* — bekrefter chips MÅ stå inline
- Gemini API Additional Terms: *"will only display the Grounded Results with the associated Search Suggestion(s)"* — bekrefter at Search Suggestions ikke kan aggregeres
- Samme docs: source URL display krever "direct, single-click path" men formatet er fleksibelt — bekrefter at aggregert kildeliste i bunn er tillatt

## Key Technical Decisions

- **Splitt `ReportGroundingSources` i to komponenter** (i stedet for å la én komponent gjøre begge): én ny `ReportGroundingChips` (kun searchEntryPointHtml-blokk, brukes inline per tema), én ny `ReportSourcesAggregated` (kun aggregert kildeliste + global attribution, brukes én gang i bunn). Ren separasjon på ToS-grenser gjør refaktoren leselig og fjerner risikoen for at en framtidig endring blander de to igjen.

- **Slett `ReportGroundingSources.tsx` etter migrering** (ikke behold som wrapper). Følger CLAUDE.md-regelen "når du bygger noe nytt som erstatter noe gammelt: SLETT det gamle umiddelbart". Ingen back-compat-shim, ingen "for sikkerhets skyld"-kommentarer.

- **Dedup på domene-nivå**: Kilder grupperes per domene (`source.domain`). Første URL/title for et gitt domene vinner. Theme-badges viser hvilke temaer som brukte domenet. Begrunnelse: brukerens intensjon er compact ("liten tekst"), og samme domene brukt i flere temaer er det dominerende mønsteret (`valentinlyst.no` opptrer 3x i Wesselsløkka-eksempelet).

- **Sortering**: Alfabetisk på `domain` for forutsigbar lesing. Ikke på frekvens — det er ingen verdi i å rangere kilder mot hverandre.

- **Attribution-tekst sentralisert**: "Generert med Google AI basert på offentlige kilder. Sist oppdatert {dato}." vises én gang, hvor `{dato}` = `max(themes.grounding.fetchedAt)` (latest). Per-tema-timestamp blir ikke synlig — fetchedAt-spread per tema er typisk innen sekunder fordi alle 7 kall kjører parallelt i samme script-run.

- **Plassering i `ReportPage`**: Mellom secondary themes-seksjonen og `ReportSummarySection`. Innenfor `max-w-[800px]`-containeren slik at den følger samme breddegrid som narrativen over. Egen liten separator over.

- **Render-skjul-regel**: `ReportSourcesAggregated` rendrer ingenting hvis ingen tema har sources (alle grounding er omitted eller alle sources-arrays er tomme). Matcher samme nullable-kontrakt som dagens komponent.

- **HoverCard fjernes** i bunn-aggregeringen. Med liten-tekst-design er domain + title kompakt nok til å vises sammen i én linje, eller som tooltip via `title=""`-attr. HoverCard er overkill for footer-nivå disclosure.

- **Komponent-navngiving**: `ReportSourcesAggregated.tsx` (bunn-aggregat) og `ReportGroundingChips.tsx` (inline chips). Klare navn som signaliserer rolle.

## Open Questions

### Resolved During Planning

- **Skal kategori-grupperingen være "per kategori med sub-overskrift" eller "dedup på domene med badges"?** → Dedup på domene med badges. Mer kompakt og matcher brukerens "liten tekst"-intensjon. Bekreftet i forrige melding.
- **Skal vi beholde HoverCard-pattern fra dagens kilde-pills?** → Nei. For mye visuell vekt for en footer-seksjon i liten tekst. Domain + title vises direkte (eller title via `title`-attr).
- **Skal "Generert med Google AI..." ligge inline per tema også?** → Nei, bare i den aggregerte bunn-blokken. Ett globalt attribution-statement er nok.
- **Skal v2-temaer (curated narrative) håndteres annerledes?** → Nei. `groundingVersion` 1 og 2 har begge `sources[]` med samme shape. Aggregeringen er version-agnostisk.

### Deferred to Implementation

- **Eksakt typografisk størrelse**: starter med `text-xs text-muted-foreground` for header og kilde-linjer; justeres etter visuell sjekk i browser. Refereres ikke i kode på forhånd.
- **Skal hver tema-badge være klikkbar (scroll-til-tema-anchor)?** Hyggelig polish, men hvis tema-seksjonene allerede har `id`-anker bruker vi dem; ellers skipper vi i denne runden. Avgjøres når implementeringen ser hvilke ankere som finnes.

## Implementation Units

- [ ] **Unit 1: Opprett `ReportGroundingChips`-komponent**

**Goal:** Ekstrahér "Google foreslår også"-blokken til egen komponent med samme verbatim-render-pattern som i dag.

**Requirements:** R4

**Dependencies:** Ingen

**Files:**
- Create: `components/variants/report/ReportGroundingChips.tsx`
- Test: `components/variants/report/ReportGroundingChips.test.tsx`

**Approach:**
- Komponenten tar `grounding: ReportThemeGroundingView` som prop
- Rendrer kun `searchEntryPointHtml` via `dangerouslySetInnerHTML` med "Google foreslår også"-heading over
- Bevarer `useEffect`-mount-step som setter `target="_blank"` + `rel`/`referrerpolicy` på `<a>`-tags i renderedContent (dagens pattern fra `ReportGroundingSources.tsx:27-37`)
- Verbatim-render-disclaimer-kommentar i toppen (Google ToS)

**Patterns to follow:**
- `components/variants/report/ReportGroundingSources.tsx:82-92` — eksisterende searchEntry-blokk, kopiér struktur

**Test scenarios:**
- Happy path: gyldig `searchEntryPointHtml` → element rendres med riktig innerHTML
- Happy path: heading "Google foreslår også" vises over chips-blokken
- Integration: etter mount → alle `<a>` i chips-blokken har `target="_blank"` og `rel="noopener noreferrer nofollow"`
- Edge case: tom `searchEntryPointHtml` → skipper hele blokken (returner null) — matcher Zod min(1) men defensiv guard
- Edge case: v1- og v2-grounding-shape begge støttes (discriminated union)

**Verification:**
- Komponenten rendrer identisk DOM-struktur for chips-delen som dagens `ReportGroundingSources` (sammenlikn manuelt i browser før neste unit)

---

- [ ] **Unit 2: Opprett `ReportSourcesAggregated`-komponent med dedup-logikk**

**Goal:** Ny bunn-seksjon som aggregerer kilder fra alle temaer, dedupliserer per domene, viser theme-badges.

**Requirements:** R1, R2, R3, R6, R7

**Dependencies:** Ingen (parallell med Unit 1)

**Files:**
- Create: `components/variants/report/ReportSourcesAggregated.tsx`
- Create: `components/variants/report/aggregate-sources.ts` (ren funksjon for dedup-logikk, lett å teste)
- Test: `components/variants/report/aggregate-sources.test.ts`
- Test: `components/variants/report/ReportSourcesAggregated.test.tsx`

**Approach:**
- `aggregate-sources.ts` eksporterer `aggregateSources(themes: ReportTheme[]): AggregatedSource[]` der `AggregatedSource = { domain, url, title, themeNames: string[] }`
- Iterer over `themes[].grounding?.sources[]` (skip themes uten grounding)
- Map keyed by `domain.toLowerCase()` — første URL/title vinner, theme-name akkumuleres som unik liste
- Sortér resultatet alfabetisk på `domain`
- Beregn også `latestFetchedAt = max(themes[].grounding?.fetchedAt)` — eksporter som separat helper eller inkluder i return-objekt
- `ReportSourcesAggregated.tsx` tar `themes: ReportTheme[]` (eller eksisterende `ReportData["themes"]`-type), kaller helper, rendrer:
  - `text-xs uppercase tracking-wide text-muted-foreground` heading "Kilder"
  - Liste i `text-xs text-muted-foreground` med domain som lenke + title som secondary tekst eller `title`-attr + theme-badges
  - Liten separator
  - "Generert med Google AI basert på offentlige kilder. Sist oppdatert {dato}." i `text-xs text-muted-foreground`
- Returnér `null` hvis aggregert liste er tom (ingen tema har sources)
- Bevar `target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer"` på alle kilde-lenker

**Patterns to follow:**
- `components/variants/report/ReportGroundingSources.tsx:46-79` — dagens kilde-pill-rendering, simplifiseres til text-only
- `components/variants/report/ReportGroundingSources.tsx:103-114` — `formatFetchedAt` (no-NO date format) — flytt eller dupliser

**Test scenarios:**
- Happy path (`aggregate-sources.test.ts`): 2 temaer, ulike domener → flat liste med 1 theme-name per entry
- Happy path: 2 temaer som deler ett domene → 1 entry med begge theme-names i `themeNames`
- Happy path: 3 temaer som deler ett domene → 1 entry med alle 3 theme-names i sortert/insertion-orden
- Edge case: tema uten `grounding` → ekskluderes uten feil
- Edge case: tema med `grounding.sources = []` → ekskluderes uten feil
- Edge case: tom themes-array → tom aggregert liste
- Edge case: domain case-mismatch (`Valentinlyst.no` vs `valentinlyst.no`) → behandles som samme domene
- Edge case: blandet v1+v2-grounding → begge bidrar til aggregeringen
- Happy path (`ReportSourcesAggregated.test.tsx`): med 2+ kilder → rendrer header, lenker med korrekte attributter, attribution-tekst med formattert dato
- Edge case: ingen kilder totalt → komponent returnerer null
- Integration: lenker har `target="_blank"`, `rel="noopener noreferrer nofollow"`, `referrerpolicy="no-referrer"`
- Happy path: `latestFetchedAt` velger seneste ISO-streng på tvers av temaer

**Verification:**
- Lokal browser-test mot Wesselsløkka-rapporten viser én kilde-blokk i bunn med ~6-8 unike domener (deduplisert fra 9+ rå-kilder), kategorier som badges, attribution én gang

---

- [ ] **Unit 3: Migrer `ReportThemeSection` til chips-only-komponent**

**Goal:** Erstatt `ReportGroundingSources` med `ReportGroundingChips` i tema-seksjonen. Slett kilder-blokk og attribution-tekst som tidligere rendret per tema.

**Requirements:** R5, R4

**Dependencies:** Unit 1

**Files:**
- Modify: `components/variants/report/ReportThemeSection.tsx`

**Approach:**
- Bytt dynamic import linje 45: `ReportGroundingSources` → `ReportGroundingChips` (samme dynamic-import-mønster)
- Bytt komponent-bruk i linje 408-410 til `<ReportGroundingChips grounding={theme.grounding} />`
- Ingen andre endringer i tema-seksjonen — chips står på samme plass som før

**Patterns to follow:**
- Dagens dynamic-import-mønster i `ReportThemeSection.tsx:38-45`

**Test scenarios:**
- Test expectation: none — ingen ny atferd. Eksisterende theme-section-tester (hvis noen treffer grounding-rendering) skal fortsatt passere etter renaming.

**Verification:**
- Browser-sjekk: hver tema-seksjon viser fortsatt "Google foreslår også"-chips, men ingen "Kilder (N)"-pill-liste og ingen "Generert med..."-tekst per tema lenger
- `npx tsc --noEmit` passerer

---

- [ ] **Unit 4: Mount `ReportSourcesAggregated` i `ReportPage`-bunnen**

**Goal:** Plasser den aggregerte kilder-seksjonen mellom secondary themes og `ReportSummarySection`.

**Requirements:** R1, R3, R6

**Dependencies:** Unit 2

**Files:**
- Modify: `components/variants/report/ReportPage.tsx`

**Approach:**
- Importer `ReportSourcesAggregated` (dynamic import siden den er below-the-fold)
- Plasser i `max-w-[800px]`-containeren etter secondary themes-blokken (linje ~181, før containeren lukkes), eller rett etter containeren — vurder visuelt under implementering
- Pass inn `reportData.themes` (alle temaer, både primary og secondary, siden brukeren sin "kilder"-mental model er hele rapporten)
- Liten visuell separator over for å markere overgang fra innhold → metadata-footer

**Patterns to follow:**
- `components/variants/report/ReportPage.tsx:144-153` — dynamic-rendering med null-guard-mønster (`{effectiveProject.pois.length > 0 && ...}`)
- `components/variants/report/ReportPage.tsx:201-206` — `ThemeSeparator`-komponenten kan gjenbrukes som separator

**Test scenarios:**
- Test expectation: none — ny rendering-bruk; atferd er testet i Unit 2

**Verification:**
- Browser-sjekk på `/eiendom/broset-utvikling-as/wesselslokka/rapport`: én "Kilder"-seksjon mellom siste tema-seksjon og summary-blokken
- Visuell hierarki: liten tekst, dempet farge, ikke konkurrerer med summary-overskriften under
- DOM-inspeksjon: kilde-`<a>`-tags har `target="_blank"`, `rel`, `referrerpolicy`

---

- [ ] **Unit 5: Slett `ReportGroundingSources.tsx` og rydde opp**

**Goal:** Fjern dødt kode etter at alle kallsteder er migrert.

**Requirements:** Hygiene (CLAUDE.md "SLETT det gamle umiddelbart")

**Dependencies:** Unit 3, Unit 4

**Files:**
- Delete: `components/variants/report/ReportGroundingSources.tsx`

**Approach:**
- `grep -rln "ReportGroundingSources" components app lib scripts` — verifiser ingen treff utenfor selve filen
- Slett filen
- Hvis `formatFetchedAt`-helper trengs i `ReportSourcesAggregated.tsx`, dupliser den lokalt før sletting (eller flytt til en delt `lib/format-date.ts`-helper hvis det allerede finnes lignende)

**Test scenarios:**
- Test expectation: none — kun sletting

**Verification:**
- `npx tsc --noEmit` passerer
- `npm run lint` passerer
- Build: `npm run build` lykkes

---

## System-Wide Impact

- **Interaction graph:** Kun rapport-siden påvirkes. `ReportGroundingChips` gjenbrukes per tema-seksjon, `ReportSourcesAggregated` mountes én gang i `ReportPage`.
- **Error propagation:** Hvis et tema har korrupt grounding-shape håndteres det allerede av Zod ved schema-parse i `report-data.ts`; aggregeringskomponenten ser kun valid `ReportThemeGroundingView`-typer.
- **State lifecycle risks:** Ingen — alle komponenter er rene og prop-drevne. Ingen Zustand, ingen useEffect-data-fetching.
- **API surface parity:** Ingen API-endring. JSONB-shape, Zod-schema, og grounding-script er uendret.
- **Integration coverage:** Browser-test mot Wesselsløkka-rapporten er kjernen — den er i dag en velprøvd verifikasjons-rapport for grounding-funksjonalitet (jf. POC i `scripts/poc-gemini-grounding.mjs`).
- **Unchanged invariants:**
  - `searchEntryPointHtml` rendres fortsatt verbatim med DOMPurify-sanering ved lagring (ingen endring i `lib/gemini/sanitize.ts`)
  - `target="_blank"`-injeksjon på `<a>`-tags i chips beholdes (mount-time, ToS-kompatibel)
  - `groundingVersion`-discriminator-pattern beholdes
  - Per-tema-grounding kan fortsatt være `undefined` (omit-ved-feil-pattern)

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Aggregert kilder-seksjon vises tom hvis ingen tema har grounding (eller alle sources er tomme) | Komponenten returnerer `null` i den situasjonen — verifisert i Unit 2 test scenarios |
| ToS-violation hvis chips utilsiktet ekskluderes fra et tema | Bevarer dagens nullable-kontrakt: hvis `theme.grounding` er definert, rendrer `ReportGroundingChips` chipsene. Ingen logikk-endring her. |
| Visuell konflikt mellom liten kilde-tekst og `ReportSummarySection`-hero | Verifiser i browser etter Unit 4. Juster separator/spacing om nødvendig — ikke endre summary-section. |
| Theme-name-badges blir for lange (mange temaer pr domene) | Maks 7 temaer totalt → maks 7 badges per kilde. Tolererbar uten truncate. Hvis det blir visuelt rotete, gå tilbake til "n temaer"-tekst. |
| Sletting av `ReportGroundingSources.tsx` med fortsatt referanser | grep-sjekk + tsc-build i Unit 5 fanger dette før commit |

## Documentation / Operational Notes

- Oppdater `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` med en kort tilføyelse: kilder kan aggregeres i bunn av sider med flere grounded responses; chips MÅ stå inline. Dette er konkret ToS-læring som er verdifull å bevare. Legges til i Unit 5 eller egen liten doc-commit.
- Ingen migrasjoner, ingen rollout-flagg, ingen monitoring.

## Sources & References

- Komponent: `components/variants/report/ReportGroundingSources.tsx`
- Komponent: `components/variants/report/ReportThemeSection.tsx`
- Komponent: `components/variants/report/ReportPage.tsx`
- Type: `lib/types.ts` (`ReportThemeGrounding`, `ReportThemeGroundingViewSchema`)
- Læring: `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`
- Google ToS: [Vertex AI Grounding docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search), [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- Visuell referanse: skjermbilde fra `/eiendom/broset-utvikling-as/wesselslokka/rapport` (samtale 2026-04-27)
