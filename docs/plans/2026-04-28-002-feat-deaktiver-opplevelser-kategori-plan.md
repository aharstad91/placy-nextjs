---
title: Deaktiver opplevelser-kategori i rapport-pipelinen
type: feat
status: active
date: 2026-04-28
---

# Deaktiver opplevelser-kategori i rapport-pipelinen

## Overview

Deaktiver "Opplevelser" som aktiv tema-kategori i Placy-rapporten — både i `/generate-bolig`-pipelinen som genererer nye rapporter, og i rendringen av eksisterende rapporter (markus_bones, obos_nostebukten-brygge, m.fl.). Bakgrunn: innholdskvaliteten i kategorien (kultur/museum/bibliotek/kino/teater) holder ikke standarden vi ønsker — Gemini-grounding produserer for tynt eller for generisk innhold. Skal være triviellt å re-aktivere når vi har løst innholdsproblemet, derfor implementeres dette som et flagg i `BransjeprofilFeatures` og ikke ved sletting.

## Problem Frame

Opplevelser-kategorien rendres i dag som ett av syv faste tematiske oppslag i bolig-rapporten. Markus (forretningsutvikler, klient-fasade) har gitt tilbakemelding om at innholdet under Opplevelser-fanen ofte er for tynt eller upresist sammenlignet med de seks andre kategoriene. Vi vil ikke kompromittere helheten av rapporten ved å vise svak content for én kategori, men vi vil heller ikke kaste arbeidet bak Opplevelser-genereringen — målet er en clean toggle.

Tre overflater må koordineres:
1. `/generate-bolig` slutter å skrive opplevelser-tema inn i `products.config.reportConfig.themes` for nye prosjekter
2. Eksisterende rapporter (data ligger i Supabase, opplevelser-temaet er allerede skrevet inn) må skjule kategorien ved render-tid
3. Re-aktivering i fremtiden skal være ett enkelt flagg-flip — ingen migrasjon, ingen data-endring

## Requirements Trace

- **R1.** `/generate-bolig`-pipelinen genererer ikke lenger opplevelser-tema for nye bolig-prosjekter
- **R2.** Eksisterende rapporter (markus_bones, obos_nostebukten-brygge, og alle andre `bransjeprofil = "Eiendom - Bolig"`-prosjekter) skjuler opplevelser-kategorien på alle synlige overflater: tema-chips på rapport-forsiden, sidebar-nav, og selve seksjonen
- **R3.** Re-aktivering skal kreve én linje-endring i `lib/themes/bransjeprofiler.ts` (fjerne `"opplevelser"` fra `disabledThemes`-array) — ingen migrasjon, ingen rebuild av eksisterende prosjekter
- **R4.** Eksisterende opplevelser-data i Supabase (`reportConfig.themes[].grounding`, leadText, bridgeText) skal bevares uendret — kun rendring/generering deaktiveres
- **R5.** POI-er som ligger i opplevelser-kategoriene (museum, library, cinema, bowling, amusement, theatre) skal fortsatt eksistere i databasen — kun seksjonen som rendrer dem skjules
- **R6.** Endringen skal ikke kreve runtime LLM-kall eller endre cache-strategier (per `CLAUDE.md`-arkitekturregler)

## Scope Boundaries

- **Ikke i scope:** Slette opplevelser-data fra Supabase eller fra den genererte JSON-i-DB
- **Ikke i scope:** Fjerne POI-er fra opplevelser-kategoriene (museum, library, cinema, etc.) — de kan fortsatt brukes på Explorer-flaten og i andre kontekster
- **Ikke i scope:** Forbedre innholdskvaliteten i opplevelser-kategorien — det er en separat oppgave som kommer etter re-aktivering
- **Ikke i scope:** Endre kategorien for andre bransjeprofiler (Næring, Hotell, Event) — kun "Eiendom - Bolig" deaktiveres nå

### Deferred to Separate Tasks

- **Innholdskvalitet for opplevelser:** Når vi re-aktiverer, må Gemini-grounding-prompts og curated-narrative-pipelinen styrkes. Dette tas i en egen plan når vi er klare for re-aktivering.
- **Museum/library/cinema-POIs i `/generate-bolig` Step 3a:** Per nå lar vi `/generate-bolig` fortsette å hente disse POI-ene fra Google Places — de blir bare ikke rendret. Dette gjør re-aktivering null-friksjon (POI-ene er allerede der). Hvis vi senere vil spare API-kall, kan vi fjerne dem fra Step 3a — men det betyr re-aktivering også må re-lege til POI-discovery-steget.

## Context & Research

### Relevant Code and Patterns

**Tema-systemet har tre lag av sannhetskilder med eksplisitt presedens** (avdekket av repo-research):

1. **Per-prosjekt override** — `products.config.reportConfig.themes` (Supabase JSONB), skrevet av `/generate-bolig` Step 2c
2. **Bransjeprofil-temaer** — `BOLIG_THEMES`, `NAERING_THEMES`, `EVENT_THEMES` i `lib/themes/bransjeprofiler.ts`
3. **`DEFAULT_THEMES`** — fallback i `lib/themes/default-themes.ts`

Alle tre flettes i `getReportThemes()` (`components/variants/report/report-themes.ts:29-45`). All rendring av tema-chips, sidebar-nav, og seksjoner ruter gjennom denne funksjonens output via `transformToReportData()` i `components/variants/report/report-data.ts:429-603`. **Single funnel-point** — filter der, og alle synlige overflater følger med automatisk.

**Eksisterende `BransjeprofilFeatures`-mønster** (`lib/themes/bransjeprofiler.ts:19-25`): Har allerede et `features`-objekt på hver profil med flagg som `dayFilter`, `agendaView`, `eventUrl`, `kompass`, `profilFilter`. Et nytt `disabledThemes?: string[]`-felt passer rent inn i denne strukturen.

**Filer med hard-coded `"opplevelser"`-referanser** (lookups som gracefully håndterer manglende keys, så filter-på-getReportThemes-tilnærming er trygg):

- `lib/themes/bransjeprofiler.ts:79-84` — `BOLIG_THEMES[3]` definisjon
- `lib/themes/bransjeprofiler.ts:251` — `explorerCaps["opplevelser"]: 15`
- `lib/themes/default-themes.ts:18-23` — legacy `"kultur-opplevelser"`-id (alias-mapped)
- `lib/i18n/strings.ts:69` — tema-spørsmål
- `lib/generators/bridge-text-generator.ts:270, 402` — generator-funksjon (kalles ikke hvis tema er filtrert ut)
- `components/variants/report/ReportHeroInsight.tsx:154, 207` — `OpplevelserInsight` (rendres ikke hvis seksjonen ikke rendres)
- `components/variants/report/ReportThemeChipsRow.tsx:19` — icon-map (lookup feiler stille hvis nøkkel mangler)
- `components/variants/report/ReportThemeSidebar.tsx:16` — icon-map (samme)
- `components/variants/report/report-data.ts:149` — Stasjonskvartalet illustration override (no-op hvis tema er filtrert)
- `components/variants/report/report-data.ts:480-487` — 15-min walk-filter for opplevelser (kvalitetsgate, blir aktiv igjen ved re-aktivering — confirmed wanted)
- `.claude/commands/generate-bolig.md:84-89, 114-115` — pipeline-spec (markdown, må redigeres for R1)

**Paraform-variant:** `components/variants/report/paraform/ReportPageParaform.tsx` (uncommitted i git status) itererer også `reportData.themes`. Filter på `getReportThemes()` dekker den automatisk.

### Institutional Learnings

- **`docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`** — Grounding cache bustes via `groundingVersion`-bump eller `revalidateTag("product:${customer}_${slug}")`. Vi trenger ikke buste cachen for denne endringen siden den ikke endrer hvordan grounding *genereres* — kun om temaet rendres. Eksisterende grounding-data forblir intakt i Supabase.
- **Bestemmelsesmønster i `applyCategoryFilter` (`report-data.ts:271-308`)** — eksisterende per-tema POI-filter (school-zone, maxCount). Vi gjenbruker ikke dette her; vi filtrerer på tema-nivå, ikke POI-nivå.

### External References

Ikke nødvendig — endringen er internt mønster-arbeid som følger eksisterende `BransjeprofilFeatures`-konvensjon i kodebasen.

## Key Technical Decisions

- **Hvor flagget bor:** I `BransjeprofilFeatures` som `disabledThemes?: string[]` — ikke som global konstant, ikke som per-prosjekt-felt. Begrunnelse: Følger eksisterende mønster (features-objekt på hver bransjeprofil), tillater at andre bransjeprofiler kan deaktivere ulike temaer i fremtiden, og krever ingen data-migrasjon.
- **Hvor filteret kjøres:** I bunnen av `getReportThemes()` i `components/variants/report/report-themes.ts`. Begrunnelse: Single funnel-point — alle UI-overflater (chips, sidebar, seksjoner, paraform-variant) konsumerer output her.
- **Beholder data i Supabase:** Eksisterende `reportConfig.themes[]`-arrays inneholder fortsatt opplevelser-blokken med grounding/leadText. Vi sletter ikke. Begrunnelse: Re-aktivering blir 0-friksjon — bare flipp flagget, og innholdet er der.
- **`/generate-bolig`-spec endres for R1:** Fjerner opplevelser-blokken fra `themes`-array i Step 2c. Lar Step 3a (Google Places-discovery for `museum, library, movie_theater`) stå urørt — POI-er hentes fortsatt, men bare ikke rendres. Begrunnelse: Re-aktivering trenger ikke re-discovery.
- **Ingen tester for `.claude/commands/generate-bolig.md`:** Det er en markdown-prompt for Claude, ikke kjørbar kode. Verifikasjon skjer ved å kjøre pipelinen mot et testprosjekt (manuell verifikasjon).
- **15-min walk-filter forblir:** `report-data.ts:480-487` har en hard-kodet 15-min-regel som filtrerer opplevelser-POIs basert på avstand. Den blir aktiv igjen ved re-aktivering. Confirmed wanted — det er en kvalitetsgate som forhindrer single-distant-museum-rendering i suburban-prosjekter.

## Open Questions

### Resolved During Planning

- **Skal Step 3a (Google Places-discovery) også fjernes?** Nei — la POI-ene fortsette å hentes. Re-aktivering skal være null-friksjon. Hvis API-kostnad blir et problem, tas det som separat optimaliseringsoppgave.
- **Skal vi støtte per-prosjekt override?** Nei — for komplisert for use-casen. Hvis vi senere trenger per-prosjekt deaktivering, kan vi legge til det uten å brekke det globale flagget.
- **Skal Næring/Event-profiler også deaktiveres?** Ikke i denne oppgaven. Bare "Eiendom - Bolig" har innholdsproblemet i opplevelser-kategorien per nå.
- **Hvordan håndterer vi Paraform-varianten?** Den itererer samme `reportData.themes`, så filter i `getReportThemes` dekker den automatisk. Ingen separat endring trengs.

### Deferred to Implementation

- **Skal vi logge en advarsel når et tema er disabled men finnes i `reportConfig.themes`?** Nice-to-have for debugging, men ikke kritisk. Implementer i pass én hvis det er trivielt; ellers utelat.

## Implementation Units

- [ ] **Unit 1: Legg til `disabledThemes`-felt i `BransjeprofilFeatures` og filter i `getReportThemes`**

**Goal:** Etabler flagg-mekanismen som lar enhver bransjeprofil deaktivere ett eller flere tema-id-er fra rendering, uten å endre data i Supabase.

**Requirements:** R1 (delvis — flagg-mekanisme), R2, R3, R4, R6

**Dependencies:** Ingen

**Files:**
- Modify: `lib/themes/bransjeprofiler.ts` (utvid `BransjeprofilFeatures`-type med `disabledThemes?: string[]`)
- Modify: `components/variants/report/report-themes.ts` (filtrer ut disabled themes i bunnen av `getReportThemes()`)
- Test: `components/variants/report/report-themes.test.ts` (opprett hvis ikke eksisterer; ellers utvid)

**Approach:**
- Utvid `BransjeprofilFeatures`-typen med valgfritt felt `disabledThemes?: string[]`. Dokumenter med JSDoc-kommentar at array-entry er en tema-id (f.eks. `"opplevelser"`) som skjules fra rendering.
- I `getReportThemes()`, etter at den ferdig-fletta theme-arrayen er bygget, slå opp `bransjeprofil.features.disabledThemes` og filtrer ut entries hvis `theme.id` er i den lista.
- Filtreringen må kjøre *etter* alias-resolusjon (`resolveThemeId`) slik at både `"opplevelser"` og legacy `"kultur-opplevelser"` filtreres når flagget er satt på `"opplevelser"`.

**Patterns to follow:**
- Eksisterende `features`-objekt-mønster i `BRANSJEPROFILER`-konstanten (`bransjeprofiler.ts:257-259`)
- `resolveThemeId()` for alias-håndtering (`bransjeprofiler.ts:312-324`)

**Test scenarios:**
- Happy path: `bransjeprofil.features.disabledThemes = ["opplevelser"]` resulterer i at `getReportThemes(project)` ikke inkluderer en theme med id `"opplevelser"` i output
- Happy path: `disabledThemes` er undefined eller tom array — alle temaer returneres uendret
- Edge case: Flere disabled themes (`["opplevelser", "trening-aktivitet"]`) — begge filtreres ut
- Edge case: Disabled theme-id matcher legacy alias (`disabledThemes = ["opplevelser"]` filtrerer også et tema med raw-id `"kultur-opplevelser"`)
- Edge case: Disabled theme-id som ikke eksisterer i tema-listen (f.eks. `["nonexistent"]`) — output er upåvirket, ingen feil
- Integration: Filtrering skjer på det sammenflettede temaet, ikke på rå `reportConfig.themes` — slik at både per-prosjekt-override og bransjeprofil-default begge respekterer flagget

**Verification:**
- TypeScript-kompilering rent
- Vitest-tester for `getReportThemes` passerer
- Manuell sjekk: midlertidig sett `disabledThemes = ["opplevelser"]` i Bolig-profilen, last `/eiendom/obos/nostebukten-brygge/rapport`, verifiser at chips-row, sidebar, og seksjon for opplevelser er borte

---

- [ ] **Unit 2: Aktiver `disabledThemes: ["opplevelser"]` på "Eiendom - Bolig"-profilen**

**Goal:** Slå på det nye flagget for bolig-profilen, slik at Opplevelser skjules på alle eksisterende og nye bolig-rapporter umiddelbart.

**Requirements:** R1, R2, R3

**Dependencies:** Unit 1

**Files:**
- Modify: `lib/themes/bransjeprofiler.ts` (legg til `disabledThemes: ["opplevelser"]` i `features`-objektet på `BRANSJEPROFILER["Eiendom - Bolig"]`)

**Approach:**
- Lokaliser `BRANSJEPROFILER["Eiendom - Bolig"]`-blokken i `bransjeprofiler.ts`. Utvid `features`-objektet med `disabledThemes: ["opplevelser"]`.
- Inkluder en kommentar over feltet med kort begrunnelse og en peker til denne planen, slik at neste utvikler vet hvorfor det er satt og hvordan å re-aktivere:
  ```ts
  // Opplevelser deaktivert pga. utilstrekkelig innholdskvalitet.
  // Re-aktiver ved å fjerne fra denne arrayen. Se docs/plans/2026-04-28-002-feat-deaktiver-opplevelser-kategori-plan.md
  disabledThemes: ["opplevelser"],
  ```

**Patterns to follow:**
- Eksisterende `features`-objektoppsett i samme fil (f.eks. `BRANSJEPROFILER["Hotell"]`)

**Test scenarios:**
- Test expectation: none -- konfigurasjon-endring uten egen logikk. Verifiseres gjennom Unit 1-tester (som tester filteret) og Unit 4-manuell verifikasjon på faktiske rapporter.

**Verification:**
- Last `/eiendom/markus/bones/rapport` og `/eiendom/obos/nostebukten-brygge/rapport` lokalt — opplevelser-kategorien skal være borte fra:
  - Tema-chips på rapport-forsiden
  - Sidebar-nav (KATEGORIER-listen)
  - Seksjon-rendering (ingen `<section id="opplevelser">`)
- Stats-blokken (`130 steder kartlagt` på Nøstebukten) skal nå vise tilsvarende lavere tall (Opplevelser hadde 17 i Nøstebukten — totalen blir lavere)

---

- [ ] **Unit 3: Fjern opplevelser-blokken fra `/generate-bolig`-pipeline-specen**

**Goal:** Slutt å skrive opplevelser-temaet inn i nye prosjekters `reportConfig.themes` ved generering. Beholder POI-discovery i Step 3a urørt for null-friksjon re-aktivering.

**Requirements:** R1

**Dependencies:** Ingen (kan kjøres parallelt med Unit 1+2, men ferdigstilles før Unit 4-verifikasjon for å teste end-to-end)

**Files:**
- Modify: `.claude/commands/generate-bolig.md` (fjern opplevelser-blokken fra Step 2c-themes-array; vurder om Step 8a-referanser til "7 kategorier" må oppdateres)

**Approach:**
- Lokaliser themes-arrayen i Step 2c (linjer ca. 64-109 i `generate-bolig.md`). Fjern hele opplevelser-blokken (linjer ca. 84-89 — id, name, icon, color, categories, intro).
- Søk gjennom resten av filen etter referanser til "Opplevelser" eller "7 kategorier" — oppdater eventuelle telling-referanser til "6 kategorier" eller fjern den eksplisitte tellingen om det skaper friksjon ved re-aktivering. Gjør valg basert på lesbarhet.
- La Step 3a (Google Places-discovery) stå urørt — `museum, library, movie_theater` blir fortsatt hentet inn som POI-er. Dokumenter beslutningen i en kort kommentar i markdown-filen: "Opplevelser-temaet er midlertidig deaktivert i UI, men POI-discovery beholdes for null-friksjon re-aktivering. Se `lib/themes/bransjeprofiler.ts` `disabledThemes`-feltet."

**Patterns to follow:**
- Eksisterende seksjon-struktur i `.claude/commands/generate-bolig.md`

**Test scenarios:**
- Test expectation: none -- markdown spec for Claude, ikke kjørbar kode. Verifikasjon skjer i Unit 4 ved å kjøre pipelinen mot et testprosjekt eller dry-run mot eksisterende oppsett.

**Verification:**
- Manuell gjennomlesning av `generate-bolig.md` for å bekrefte at:
  - Opplevelser-blokken er fjernet fra Step 2c-themes-arrayen
  - Step 3a-discovery-listen er uendret (museum, library, movie_theater er der)
  - Eventuelle "7 kategorier"-telling-referanser er konsistente med ny oppførsel

---

- [ ] **Unit 4: End-to-end verifikasjon på eksisterende rapporter**

**Goal:** Bekreft at flagget fungerer på faktiske live rapporter i lokal dev, og at både rendring og generering oppfører seg korrekt.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Unit 1, Unit 2, Unit 3

**Files:**
- Ingen kode-endringer — kun verifikasjon

**Approach:**
- **Eksisterende rapporter** (R2, R4): Kjør `npm run dev`, last følgende URL-er, verifiser per checklist:
  - `/eiendom/obos/nostebukten-brygge/rapport`
  - `/eiendom/markus/bones/rapport`

  Sjekkliste per rapport:
  - [ ] Tema-chips-row på toppen viser 6 chips, ikke 7 (Opplevelser borte)
  - [ ] Sidebar-nav (sticky venstre) lister 6 kategorier
  - [ ] Ingen `<section id="opplevelser">` i DOM (sjekk via DevTools)
  - [ ] Kategori-tellingen i sidebar oppdateres (Opplevelser-raden borte fra "KATEGORIER"-statistikken)
  - [ ] Stats-blokken `X steder kartlagt` er fortsatt korrekt (POI-er som tilhører museum/library/cinema er fortsatt i databasen, men teller nå mot total POI-count siden de ikke er knyttet til en synlig theme-seksjon)
  - [ ] Konsoll fri for warnings/errors relatert til manglende theme

- **Database-integritet** (R4, R5): Kjør Supabase-spørring for å bekrefte at opplevelser-data fortsatt finnes:
  ```sql
  SELECT slug, jsonb_array_length(config->'reportConfig'->'themes')
  FROM products WHERE config->'reportConfig'->'themes' @> '[{"id": "opplevelser"}]';
  ```
  Forventet: Begge testrapportene har fortsatt opplevelser-blokken i `reportConfig.themes` med uendret grounding/leadText.

- **Re-aktiverings-test** (R3): Midlertidig fjern `"opplevelser"` fra `disabledThemes` lokalt, last samme URL-er, verifiser at Opplevelser-kategorien dukker opp igjen umiddelbart med samme innhold som før (cached grounding skal fortsatt ligge i Supabase). Sett tilbake til disabled.

**Patterns to follow:**
- Manuell verifikasjons-mønster fra tidligere worklog-entries (f.eks. 2026-04-21 markus_bones-verifikasjon)

**Test scenarios:**
- Integration: De to verifikasjons-rapportene rendres korrekt uten Opplevelser
- Integration: Database-spørringen bekrefter at data er bevart
- Integration: Re-aktiverings-flippen restaurerer Opplevelser uten kode-rebuild eller cache-bust

**Verification:**
- Sjekkliste over fullført for begge rapporter
- Database-spørring returnerer 2+ rader med opplevelser fortsatt i config
- Re-aktiverings-test viser Opplevelser-seksjon med samme bridgeText/leadText som før

## System-Wide Impact

- **Interaction graph:** `getReportThemes()` er det eneste funnel-punktet for tema-resolusjon — alle synlige overflater (`ReportThemeChipsRow`, `ReportThemeSidebar`, `ReportThemeIndex`, `ReportThemeSection`, `ReportPageParaform`) konsumerer output her. Filter ett sted, fanges alle steder.
- **Error propagation:** Icon-maps i chips-row og sidebar bruker `record[id]` uten fallback-assertion — manglende key for "opplevelser" gir ingen feil (icon-blokken er gated på `iconSrc &&`). Generators (`bridge-text-generator.ts`) og renderers (`ReportHeroInsight.tsx`) i RENDERERS-registry kalles aldri hvis temaet ikke er i theme-listen.
- **State lifecycle risks:** Ingen — endringen er ren konfigurasjon + filter. Ingen async-operasjoner, ingen cache-state, ingen midlertidig tilstand.
- **API surface parity:** Ingen public API-endringer. Type-utvidelsen `BransjeprofilFeatures.disabledThemes` er internt og valgfritt.
- **Integration coverage:** Render-tester for `ReportPage` med flagget aktivt; database-spørring som bekrefter at rådata er bevart; manuell URL-test på dev-server.
- **Unchanged invariants:**
  - Eksisterende `reportConfig.themes`-arrays i Supabase forblir uendret (R4)
  - POI-er i opplevelser-kategoriene (museum, library, cinema, etc.) eksisterer fortsatt og kan brukes på Explorer-flate (R5)
  - Cache-strategi (`unstable_cache` + `revalidateTag`) er uendret — flagget endrer ikke cache-keys
  - Andre bransjeprofiler (Næring, Hotell, Event) er uberørte
  - 15-min walk-filteret i `report-data.ts:480-487` blir aktivt igjen ved re-aktivering — bevisst valg, det er en kvalitetsgate

## Risks & Dependencies

| Risiko | Mitigering |
|--------|-----------|
| `getReportThemes()` har en alternativ kodesti (f.eks. en cache-lag) som ikke fanger filteret | Unit 1-test sjekker både per-prosjekt-override-stien og default-fallback-stien. Manuell verifikasjon på live rapporter i Unit 4 fanger eventuelle mismatches. |
| Type-utvidelse av `BransjeprofilFeatures` brekker andre bransjeprofiler som ikke setter `disabledThemes` | Feltet er `string[] \| undefined` (valgfritt). Eksisterende profiler som ikke setter det får default `undefined` → filter-no-op. Kun "Eiendom - Bolig" får verdi. |
| Stats-blokken (`130 steder kartlagt`) viser inkonsistent telling fordi POI-er fortsatt eksisterer men theme er borte | Verifiser i Unit 4 at totalen forblir riktig. POI-er teller mot total uavhengig av theme-tilhørighet (sjekk `transformToReportData` for å bekrefte). Hvis det er en bug, lag en separat oppgave — ikke i scope her. |
| Re-aktivering avslører at cached grounding er stale eller utdatert | Per `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md` er cache-bust en kjent operasjon (`revalidateTag` eller `groundingVersion`-bump). Re-aktiverings-planen (separat task) tar ansvar for dette. |
| Paraform-varianten (`ReportPageParaform.tsx`, uncommitted i git status) bruker en annen path | Bekreftet at den itererer `reportData.themes` likt — filter på `getReportThemes` dekker den automatisk. Verifiser i Unit 4 hvis paraform-route blir merget før denne planen er ferdig. |

## Documentation / Operational Notes

- **Worklog-entry:** Oppdater `WORKLOG.md` med entry under dato `2026-04-28` som dokumenterer:
  - Hva som ble deaktivert og hvorfor
  - Hvilke rapporter som er påvirket (alle "Eiendom - Bolig"-prosjekter)
  - Hvordan re-aktivere (én-linje endring i `lib/themes/bransjeprofiler.ts`)
  - Peker til denne planen
- **Trello-kort:** Denne planen knyttes til et Trello-kort på "Utvikling"-boardet (per `CLAUDE.md`-default). Linkes som vedlegg/beskrivelse på kortet.
- **Re-aktiverings-runbook:** Dokumenter prosedyre i `docs/solutions/feature-toggling/disabled-themes-pattern-20260428.md` (eller kort kommentar i `bransjeprofiler.ts` med peker til planen) — slik at framtidig utvikler vet hvordan å fjerne deaktiveringen og hva som må sjekkes (cache-bust, content-quality-validering før re-aktivering).
- **Ingen rollout-/monitoring-bekymringer:** Endringen er deploy-trygg (per `MEMORY.md` er prototypen i prototype-stadium uten live klient-produkter; deploy-nedetid på minutter tolereres).

## Sources & References

- **Origin:** Bruker-tilbakemelding fra forretningsutvikler Markus, sesjon 2026-04-28
- Repo-research: ce-repo-research-analyst summary, sesjon 2026-04-28
- Related files: `lib/themes/bransjeprofiler.ts`, `components/variants/report/report-themes.ts`, `components/variants/report/report-data.ts`, `.claude/commands/generate-bolig.md`
- Relatert mønster-dokumentasjon: `docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`
