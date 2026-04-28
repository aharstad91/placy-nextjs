---
title: "refactor: Rolig markør-stil i rapporten + fjern POI-inline-ikon"
type: refactor
status: active
date: 2026-04-28
---

# refactor: Rolig markør-stil i rapporten + fjern POI-inline-ikon

## Overview

To koblede UI-justeringer i rapport-produktet:

1. **Markører på rapport-kart** — fra fyltsirkel-med-hvitt-outline-ikon til lys/hvit sirkel med kategorifarget *fylt* ikon. Resultatet: roligere kart der kategorifargen bæres av selve ikonet, ikke en mettet bg-disc.
2. **Inline POI-ikoner** — fjernes fra POI-mentions i rapport-tekst. Begrunnelse: alle POI-er i en tema-seksjon deler kategori, så ikonet er ren støy. Lenken beholder underline + popover-trigger.

Begge er rene frontend-justeringer. Ingen migrasjoner. Ingen data-endringer.

## Problem Frame

Rapporten har for høyt visuelt trykk:

- Kartet (se [Image #2] i samtale) viser 35+ POI-er som mettede fargesirkler. Stor overlapp, kraftig farge-trykk, ikoner forsvinner i støy ved tett klynging.
- Inline POI-mentions (se [Image #3]) gjentar samme kategori-ikon foran hver POI i samme avsnitt — `🎓 Bispehaugen skole`, `🎓 Rosenborg skole`, `🎓 Trondheim katedralskole` — informasjonsverdien er null når kategorien allerede er gitt av tema-overskriften.

Begge bidrar til at rapportens narrativ må konkurrere mot UI-element-støy.

## Requirements Trace

- **R1.** Markørene i rapport-kartet (både preview-kart per tema og full kart-modal) skal vise kategorifargen som *fyll i ikonet*, ikke som bakgrunnsfarge på sirkelen.
- **R2.** Sirkel-bakgrunn skal være lys (hvit eller off-white). Border holdes lys/dempet.
- **R3.** Ikon-stilen skal være *fylt* (solid), ikke outline — for å beholde lesbarhet i kartet når ikonet bærer fargen alene.
- **R4.** Aktiv/highlight/featured-states forblir tydelig synlige, men tilpasset den nye visuelle språkbasen (ingen mettet bg-disc).
- **R5.** Inline POI-mentions i rapport-seksjoner viser ikke kategori-ikon. Lenke-styling (underline + hover) og popover-funksjonalitet beholdes uendret.
- **R6.** Endringen er rapport-eksklusiv. Explorer/Trip/Story-produktene rører vi ikke.

## Scope Boundaries

- **Ikke i scope:** Endringer på `components/map/adaptive-marker.tsx` (delt komponent — Explorer/Trip/Story bruker den uendret).
- **Ikke i scope:** Mapbox symbol-layer fallback for >15 POI-er. `ReportThemeMap` bruker DOM-markører hele veien, så symbol-sprite-arbeid er ikke nødvendig.
- **Ikke i scope:** `POIPopover` brukes også av Story (`StoryThemeChapter.tsx`). Vi fjerner ikon-spannet helt — Story får samme oppførsel automatisk. Hvis Story-teamet ønsker ikon tilbake, kan de senere legge til en `showIcon`-prop. Dokumenteres som scope-beslutning under.
- **Ikke i scope:** `ReportInteractiveMap.tsx` — orphaned/unused (kun consumer er den selv-importerende `ReportInteractiveMapSection.tsx`). Ingen jobb her.

### Deferred to Separate Tasks

- Dersom Story-produktet vil ha inline-ikon tilbake: separat oppgave med `showIcon`-prop på `POIPopover`.
- Mapbox symbol-layer-stil-tilpasning hvis et fremtidig kart introduserer den fallbacken igjen.

## Context & Research

### Relevant Code and Patterns

- **`components/variants/report/ReportThemeMap.tsx`** (rapport-eksklusiv) — eneste markør-komponent som rendres på rapport-siden, både i preview-kort per tema og i `UnifiedMapModal`. Linjer ~218–296 inneholder marker-rendering (icon-sirkel, glow-ring, pulsing-ring).
- **`components/variants/report/POIPopover.tsx`** — inline POI-mention. Linjer ~40–50 har ikon-spannet som skal fjernes. Trigger er `<span>` inne i `<PopoverTrigger asChild>`.
- **`lib/utils/map-icons.ts`** — Lucide-mapping. Vi *utvider ikke* denne; vi lager parallell `map-icons-filled.ts` for Phosphor-fyll-varianter for å unngå å forstyrre konsumenter som forventer Lucide.
- **Eksisterende mønster:** `components/map/adaptive-marker.tsx` viser samme kategorifarge + ikon-mønster (linjer 80–97). Vi *kopierer ikke* den — beholder den som referanse for hvordan delt komponent ser ut, og lager rapport-spesifikk styling i `ReportThemeMap` som før.

### Institutional Learnings

- Watercolor-ikoner under `public/illustrations/icons/` er tema-nivå (Mat & Drikke, Hverdagsliv, etc.) — ikke kategori-nivå. De passer ikke som POI-markør-ikoner. (Bekreftet via `components/variants/report/ReportThemeChipsRow.tsx`.)
- Rapport-produktet har egen markør-styling (`ReportThemeMap`) atskilt fra delt `AdaptiveMarker`. Det er bevisst designvalg fra layout-refactor 2026-04-27 (se WORKLOG.md). Endringer her smitter ikke til andre produkter.

### External References

- **Lucide-react** — outline-only icon set; har ikke `weight="fill"` eller solid-varianter. Brukes av shadcn som standard.
- **`@phosphor-icons/react`** — har `weight="fill"` for alle ikoner. Tree-shakeable. Drop-in for fylte ikon-varianter uten å fjerne lucide andre steder.
- **Heroicons solid** — alternativ; mindre ikon-katalog, mismatcher mot eksisterende Lucide-navngivning.

## Key Technical Decisions

- **Bruk Phosphor for fylte ikoner**, ikke Lucide-med-thicker-stroke. Begrunnelse: Lucide stroke=2.5 ser fortsatt outline-aktig ut; bruker har eksplisitt bedt om "fille ikoner". Phosphor `weight="fill"` gir ekte solid-varianter uten å erstatte lucide for andre formål.
- **Parallell helper, ikke utvidelse av eksisterende.** Lag `lib/utils/map-icons-filled.ts` som mapper category-icon-navn (samme nøkler som `map-icons.ts`) til Phosphor-`weight="fill"`-komponenter. Behold `map-icons.ts` urørt så Explorer/Trip/Story og admin-paneler ikke påvirkes.
- **Endringen er rapport-eksklusiv via fil-isolasjon, ikke via prop.** `ReportThemeMap.tsx` er allerede en rapport-spesifikk komponent. Vi endrer den direkte uten å ta omveien om en variant-prop på en delt komponent.
- **Border-fargen forblir lys.** Bruker `border-stone-200` eller `border-[#e9e2d6]` (matcher rapport-bg `#f5f1ec` familie) for at sirkel-borderen er synlig på lys karttegning men ikke konkurrerer med ikon-fargen. Konkret hex velges av implementer ved visuell QA.
- **Active/highlighted-state beholder dramatikk via skala + ring**, ikke via mettet bg. Pulsing-ring (allerede i koden, linje 242–247) flyttes til border-color + ring-shadow med kategorifargen, slik at aktiv POI fortsatt skiller seg ut.
- **Featured POI / tier 1 glow-ring** beholdes — ringen rundt sirkelen kan fortsatt bruke kategorifargen som lavmettet glow (opacity 0.2). Dette er den ene plassen kategorifargen brukes som *bakgrunn*, og det fungerer fordi det er en perimeter-effekt, ikke en disc.
- **POI-inline: fjern ikonet helt**, ikke skjul med flagg. Begrunnelse: codebase-rule "ALDRI la dead code ligge". Hvis Story trenger det tilbake, gjøres det som ny oppgave.

## Open Questions

### Resolved During Planning

- **Q:** Trenger vi ny ikon-bibliotek? **A:** Ja — `@phosphor-icons/react` for `weight="fill"`. Lucide er stroke-only.
- **Q:** Skal endringen gjelde alle produkter? **A:** Nei — kun rapport. `ReportThemeMap.tsx` er rapport-spesifikk, så fil-isolasjon er nok.
- **Q:** Hva med inline-ikon i Story? **A:** `POIPopover` er felles. Vi fjerner ikonet — Story får samme oppførsel. Story kan be om opt-in senere.
- **Q:** Mapbox symbol-layer-stil ved >15 POI-er? **A:** Gjelder ikke — `ReportThemeMap` bruker alltid DOM-markører.

### Deferred to Implementation

- Eksakt hex for `border` og `background` på den lyse sirkelen — bestemmes ved visuell QA mot karttegningen. Forventet rundt `#ffffff` bg + `#e9e2d6` eller `stone-200` border, men implementer justerer etter det ser bra ut sammen med Mapbox-stilen.
- Eksakt størrelse på Phosphor-fyll-ikon innenfor sirkelen (sannsynligvis samme `tierIconSize` som i dag, ~`w-4 h-4` for tier 2). Kan trenge bump til `w-[18px]` for at fylt ikon skal lese like tydelig som dagens outline-ikon på hvit bg.
- Om featured/tier-1 sin glow-ring skal ha justert opacity etter at sirkelen blir lys (mulig at 0.2 blir for svak).

## High-Level Technical Design

> *Dette skisserer den intenderte tilnærmingen og er retningsgivende for review, ikke implementasjons-spesifikasjon.*

**Markør-komposisjon før vs. etter:**

| Lag | Før | Etter |
|-----|-----|-------|
| Sirkel-bakgrunn | `category.color` (mettet) | `#ffffff` eller off-white |
| Sirkel-border | `border-2 border-white` | `border-2 border-stone-200` (eller justert hex) |
| Ikon | Lucide outline, `text-white` | Phosphor `weight="fill"`, `style={{ color: category.color }}` |
| Aktiv-state | Pulsing ring m/ category color bg | Pulsing ring m/ category color border + scale-110 |
| Tier-1 glow | `bg category.color opacity-0.2` (perimeter) | Beholdes — fortsatt perimeter-effekt, fungerer på lys disc |

**POI-inline før vs. etter:**

```
FØR:  [🎓·sirkel·m·tinted-bg] Bispehaugen skole  (underlined)
ETTER:                        Bispehaugen skole  (underlined)
```

Popover-trigger og innhold (`PopoverContent` med kategori-ikon i header, Star, MapPin osv.) **forblir uendret** — kun det inline-spannet før POI-navnet i `PopoverTrigger` fjernes.

## Implementation Units

- [ ] **Unit 1: Legg til Phosphor og lag fylt ikon-helper**

**Goal:** Etablere fylt ikon-mapping uten å påvirke eksisterende Lucide-bruk.

**Requirements:** R3, R6

**Dependencies:** Ingen.

**Files:**
- Modify: `package.json` (legg til `@phosphor-icons/react`)
- Create: `lib/utils/map-icons-filled.ts`

**Approach:**
- Ny helper eksporterer `getFilledIcon(iconName: string)` som returnerer Phosphor-komponent for samme nøkkelsett som `map-icons.ts` (Award, Baby, Bike, BookOpen, …, Zap).
- For hvert lucide-navn map til nærmeste Phosphor-ekvivalent. Eksempler: `UtensilsCrossed` → `ForkKnife`, `GraduationCap` → `GraduationCap` (Phosphor har det), `MapPin` → `MapPin`, `Coffee` → `Coffee`, `ShoppingCart` → `ShoppingCart`, `TreePine` → `Tree`, `Bus` → `Bus`, `Bike` → `Bicycle`, `TramFront` → `Train` (eller `TrainSimple`).
- Phosphor-komponenter brukes med prop `weight="fill"`. Helper kan returnere wrappet komponent som hardkoder `weight="fill"`, eller returnere komponenten + dokumentere at caller setter weight.
- Fallback: ukjent navn → Phosphor `MapPin` `weight="fill"`.

**Patterns to follow:**
- Samme API-form som `lib/utils/map-icons.ts` (én funksjon, ICON_MAP-record, fallback).

**Test scenarios:**
- *Happy path:* `getFilledIcon("UtensilsCrossed")` returnerer ikke-null Phosphor-komponent; rendring av komponenten i en test produserer SVG med `fill`-attributt.
- *Edge case:* `getFilledIcon("UkjentNavn")` returnerer fallback (MapPin), ikke `undefined`.
- *Integration:* Mounting en POI med vanlig kategori-ikon i en test-tabell og bekrefte at ingen ikon-mapping returnerer `undefined`.

**Verification:**
- Phosphor finnes i `node_modules`.
- Helper-fil eksporterer `getFilledIcon` med riktig signatur.
- Vitest grønn for nye tester.

---

- [ ] **Unit 2: Endre `ReportThemeMap` markør-stil til lys disc + fylt ikon**

**Goal:** Implementere ny visuell språkbase for markørene i rapport-kartet.

**Requirements:** R1, R2, R3, R4, R6

**Dependencies:** Unit 1.

**Files:**
- Modify: `components/variants/report/ReportThemeMap.tsx`

**Approach:**
- Bytt `getIcon` import (fra `lib/utils/map-icons`) til `getFilledIcon` (fra `lib/utils/map-icons-filled`) på markør-rendring (linje ~220).
- Linje ~258–268 (icon-sirkel `<div>`): bytt `style={{ backgroundColor: poi.category.color }}` til lys bg (hvit/off-white). Beholde border, men justere fra `border-white` til lysere stone-tone.
- Linje ~272–276 (ikon): bytt `className="text-white …"` til `style={{ color: poi.category.color }}`. Phosphor `weight="fill"` settes inline når komponenten brukes.
- Linje ~242–247 (pulsing-ring for highlighted): juster fra `backgroundColor: poi.category.color` (full disc) til ring-utseende — f.eks. `border-2 border-[color] animate-ping`. Pulse-effekten må fortsatt være tydelig.
- Linje ~250–255 (glow-ring for tier 1): kan beholdes nesten som-er — perimeter-glow funker visuelt på lys disc. Vurder opacity 0.25 i stedet for 0.2 ved QA.
- Tier-størrelser (linje ~226–228): `tierBorder`-strenger må oppdateres for å reflektere ny border-farge i alle tre tiers.

**Patterns to follow:**
- `tier`-system og `isHighlighted/isHovered/isFeatured`-states beholdes 1:1 — endringen er kun visuell på sirkelen og ikonet.
- Hvis det viser seg at lys-disc + dark-icon trenger en subtil shadow for å lese på fargerike kart-bakgrunner, behold `shadow-md`/`shadow-lg` som er der i dag.

**Test scenarios:**
- *Happy path (visual):* Rapport-side åpnes på prosjekt med 30+ POI-er; markørene viser hvit sirkel m/ farget fylt ikon, ingen mettet bg-disc.
- *Happy path:* Click på markør trigger `onMarkerClick` som før — funksjonell oppførsel uendret.
- *Edge case:* Tier-1 POI vises med glow-ring; tier-3 vises mindre uten kraftig border.
- *Edge case:* `isHighlighted=true` produserer pulse-ring synlig over kategorifarge-border, ikke bg-disc.
- *Integration:* Åpne `UnifiedMapModal` (Utforsk kartet); markørene har ny stil også der (samme komponent).
- *Visual QA:* Manuell sjekk av minst tre prosjekter med ulik POI-tetthet.

**Verification:**
- Ingen mettet bg-disc på markører i preview-kart eller modal.
- Aktiv-state synlig (pulse + scale).
- Featured/tier-1-state synlig (glow-ring).
- Eksisterende `MarkerTooltip` og click-handling uendret.
- Vitest passerer for komponenter som tester `ReportThemeMap`-snapshots eller props.

---

- [ ] **Unit 3: Fjern inline-ikon fra `POIPopover` trigger**

**Goal:** Renere POI-mentions i rapport-tekst.

**Requirements:** R5

**Dependencies:** Ingen (kan kjøres parallelt med Unit 1–2).

**Files:**
- Modify: `components/variants/report/POIPopover.tsx`

**Approach:**
- Slett `<span>`-blokken på linje ~40–50 som rendrer ikon-disc inni `<PopoverTrigger asChild>`. Behold `<span role="button"…>` med `displayLabel`.
- Behold link-styling: `underline decoration-[#d4cfc8] decoration-2 underline-offset-2 hover:decoration-[#8a8a8a] cursor-pointer`. Dette er det eneste visuelle som signaliserer at teksten er klikkbar.
- Slett `getIcon`-import hvis det ikke lenger brukes i komponenten. (Sjekk linje ~5 og ~63 — `<Icon>` i `PopoverContent`-headeren beholdes.)
- `getIcon` brukes fortsatt i `PopoverContent` (linje ~63 — kategori-ikon i popover-header). Den blir værende. Importen forblir.
- Slett ubrukte styling-grener (`!imageUrl ? { backgroundColor: poi.category.color + "20" } : undefined`) sammen med ikon-spannet — den hører til den slettede strukturen.

**Patterns to follow:**
- Samme link-mønster som vanlige `<a>`-tags i rapport-tekst: underline + hover-skift. Ingen ekstra kosmetikk.

**Test scenarios:**
- *Happy path:* Rapport-side med tema-seksjoner viser POI-mentions som underlined tekst uten ikon-prefix.
- *Happy path:* Click/keypress på POI-link åpner popover som før — popover-content uendret.
- *Edge case:* POI med `featuredImage` viser fortsatt bilde i popover-header (siden `imageUrl`-håndtering i `PopoverContent` er urørt).
- *Integration:* Story-produkt som bruker samme `POIPopover` viser også uten inline-ikon (forventet — dokumentert som scope-beslutning).
- *A11y:* Popover-trigger har fortsatt `role="button"` + `tabIndex={0}` + meningsfull tekst som label.

**Verification:**
- Inline POI-mentions i rapport-tekst har ingen ikon-disc.
- Popover åpner fortsatt på click/keyboard.
- Popover-content (med kategori-ikon i header, rating, walk-tid, editorialHook) uendret.
- Lint/type-check grønt; ingen ubrukte imports.

---

- [ ] **Unit 4: Visuell QA + worklog**

**Goal:** Verifisere at ny stil fungerer på flere prosjekter og dokumentere endringen.

**Requirements:** Alle.

**Dependencies:** Unit 1–3.

**Files:**
- Modify: `WORKLOG.md` (ny entry på toppen)

**Approach:**
- Kjør `npm run dev` og åpne minst tre prosjekter (Stasjonskvartalet, Wesselsløkka, Langenga-h7) i nettleser.
- Bekreft markør-stil i preview-kart og i Utforsk-kartet-modal for hver prosjekt.
- Bekreft POI-inline-stil i tema-seksjoner uten ikon.
- Skriv WORKLOG-entry i samme format som eksisterende entries (yaml-block med date, action, scope, files, problem, fix, result, learnings).

**Test scenarios:**
- *Test expectation: none* — kun visuell QA og dokumentasjon.

**Verification:**
- `WORKLOG.md` har ny entry datert 2026-04-28.
- Visuell sjekk passert på 3 prosjekter.
- Ingen TypeScript- eller ESLint-feil.
- `npm run build` fullfører.

## System-Wide Impact

- **Interaction graph:** `ReportThemeMap` rendres både inline i `ReportThemeSection` og inne i `UnifiedMapModal` — begge får ny stil samtidig (samme komponent). Ingen andre konsumenter av denne komponenten.
- **API surface parity:** `POIPopover` brukes også av `StoryThemeChapter` og `ReportCuratedGrounded`. Begge får samme oppførsel (uten inline-ikon). Bekreftet ønskelig av Placy-prinsippet "alle POI-er i samme tema deler kategori".
- **Unchanged invariants:**
  - `components/map/adaptive-marker.tsx` urørt → Explorer/Trip/Story-markører uendret.
  - `lib/utils/map-icons.ts` urørt → admin-paneler, kategori-ikoner i listevisninger urørt.
  - `POIPopover` `PopoverContent`-innhold (header, rating, walk-tid) urørt — kun trigger-spannet endres.
  - Click-handlere, keyboard-handling, a11y-attributter urørt.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Phosphor-ikon ser ulikt ut fra Lucide-mapping (f.eks. `ForkKnife` vs `UtensilsCrossed`) | Visuell QA i Unit 4. Dokumentere mapping i `map-icons-filled.ts` med kommentar når valg ikke er åpenbart. |
| Lys disc + lys karttegning gir lav kontrast på off-white kart-bakgrunner | Behold `shadow-md`/`shadow-lg`. Vurder mørkere border-tone under QA. |
| Aktiv/featured-state mister synlighet uten mettet bg | Beholdt scale-110 + pulse-ring + glow-ring; verifiser i QA. Hvis utilstrekkelig, juster ring-intensitet. |
| Story-produktet ønsker inline-ikon tilbake | Dokumentert som "Deferred to Separate Tasks". Lett å rulle tilbake selektivt med en `showIcon`-prop senere. |
| Bundle-size øker med Phosphor | Tree-shake fungerer per-icon-import. Forventet < 5kb gz for ~30 ikoner. |

## Documentation / Operational Notes

- WORKLOG.md-entry i Unit 4 dokumenterer hva som endret seg og hvorfor.
- Trello-kort i "Utvikling"-board (board id `onb3nsLD`) opprettes i parallell med planen, lenker til denne plan-filen.
- Ingen migrasjoner. Ingen rollback-runbook nødvendig.

## Sources & References

- Trigger-samtale: bruker delte to skjermbilder (kart med mettede markører, POI-inline-tekst med gjentatte ikoner).
- Relevant kode:
  - `components/variants/report/ReportThemeMap.tsx`
  - `components/variants/report/POIPopover.tsx`
  - `lib/utils/map-icons.ts`
  - `components/map/adaptive-marker.tsx` (referanse, ikke endret)
- Eksterne referanser:
  - Phosphor Icons: https://phosphoricons.com (weight="fill")
  - Lucide-react package (eksisterende dep)
- Worklog 2026-04-27: Rapport-layout refactor (kontekst for hvorfor `ReportThemeMap` er rapport-spesifikk).
