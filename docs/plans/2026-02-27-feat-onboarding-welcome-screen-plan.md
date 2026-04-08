---
title: feat: Onboarding Welcome Screen
type: feat
date: 2026-02-27
brainstorm: docs/brainstorms/2026-02-27-onboarding-welcome-screen-brainstorm.md
deepened: 2026-02-27
tech-audit: 2026-02-27 (YELLOW — 3 blocking fixes applied, 4 high-risk mitigations added)
---

# feat: Onboarding Welcome Screen

## Enhancement Summary

**Deepened on:** 2026-02-27
**Research agents used:** Frontend Design, Next.js searchParams, Accessibility (WCAG 2.2), Institutional Learnings

### Key Improvements
1. **Toggle cards instead of plain checkboxes** — premium feel matching Placy's Nordic editorial aesthetic
2. **Accessibility hardened** — `aria-disabled` (not `disabled`), live region count announcements, WCAG 2.2 compliant
3. **SEO canonical tags** — prevents duplicate content indexing from `?themes=` params
4. **Graceful column fallback** — safe pattern for new DB columns (from institutional learnings)
5. **Staggered entrance animation** — each element animates in sequentially with `prefers-reduced-motion` respect

### New Considerations Discovered
- Use `aria-disabled="true"` instead of native `disabled` on CTA (keeps button focusable for keyboard users)
- CSS animation names must be namespaced (`welcome-*`) to avoid collision with existing `@keyframes` in globals.css
- Canonical URLs on Report/Explorer should point to base URL without `?themes=` params
- Live region (`role="status"`) for theme count must be present in DOM on mount (not injected dynamically)

---

## Overview

Erstatt dagens produktvalg-landingsside (`/for/[customer]/[project]/`) med en velkomstskjerm som gir kontekst om eiendommen og lar besøkende velge hvilke temaer de er interessert i — før de sendes rett inn i default-produktet (Report/Explorer) tilpasset etter valgte temaer.

## Problem Statement

Besøkende fra eiendomsnettsider (f.eks. Overvik.no) lander i dag på en produktvalg-side med tre kort (Explorer, Report, Trip) uten kontekst om eiendommen eller området. De må selv forstå forskjellen mellom produktene og velge — en friksjon som senker konvertering.

## Proposed Solution

En ny landingsside med tre elementer:

1. **Minimal hero:** Prosjektnavn + kort tagline
2. **Tema-velger:** 5 temaer (fra `DEFAULT_THEMES`) som interaktive toggle-kort, alle forhåndsvalgt. Brukeren kan huke av de som ikke er relevante.
3. **CTA-knapp:** Navigerer til default-produkt med `?themes=...` query param

Produktene respekterer `?themes=`-paramen:
- **Report:** Valgte temaer som hovedseksjoner, fravalgte under "Andre kategorier" nederst
- **Explorer:** Valgte tema-kategorier toggled på, fravalgte toggled av (eksisterende oppførsel)

### Brukerflyt

```
Overvik.no → "Se nabolaget" → /for/overvik/overvik-sorgenfri/
                                        ↓
                              ┌──────────────────────────┐
                              │                          │
                              │    OVERVIK SORGENFRI      │
                              │    Bo midt i byens puls   │
                              │                          │
                              │    Hva interesserer deg?  │
                              │                          │
                              │  ┌──────────────────────┐│
                              │  │ ● 🍽 Mat & Drikke   ✓││
                              │  └──────────────────────┘│
                              │  ┌──────────────────────┐│
                              │  │ ● 🎭 Kultur & Oppl. ✓││
                              │  └──────────────────────┘│
                              │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐│
                              │  │ ○  Hverdagsbehov      ││  ← unchecked, dimmed
                              │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘│
                              │  ┌──────────────────────┐│
                              │  │ ● 🚌 Transport      ✓││
                              │  └──────────────────────┘│
                              │  ┌──────────────────────┐│
                              │  │ ● 💪 Trening & Velv. ✓││
                              │  └──────────────────────┘│
                              │                          │
                              │  [ Utforsk nabolaget →  ] │
                              │                          │
                              └──────────────────────────┘
                                        ↓
                              /for/.../report?themes=mat-drikke,kultur-opplevelser,transport,trening-velvare
```

## Design Decisions (fra brainstorm + specflow-analyse)

| # | Beslutning | Valg | Begrunnelse |
|---|-----------|------|-------------|
| 1 | Format | Ny landingsside (ikke overlay) | Renere, kommuniserer starten på opplevelsen |
| 2 | Intro-innhold | Minimal — navn + tagline | Rask, ingen vegg av tekst |
| 3 | Tema-valg-modell | Opt-out (alle forhåndsvalgt) | Lav terskel, ingen friksjon for "vis alt" |
| 4 | Granularitet | Eksisterende 5 temaer | Ingen ny taksonomi nødvendig |
| 5 | Prioritering vs. filtrering | Prioritering | Fravalgte dempes, fjernes ikke |
| 6 | Default-produkt | Per prosjekt (`defaultProduct`) | CTA navigerer rett dit |
| 7 | Persistens | Ingen (vises ved hvert besøk) | Brukeren kan justere hver gang |
| 8 | Zero themes valgt | CTA `aria-disabled` + "Velg minst ett tema" | Unngår tom/ødelagt produkttilstand |
| 9 | Tema-state ved produktbytte | Droppes (ikke videreført) | Enklest, kan iterere senere |
| 10 | Single-product prosjekter | Vis velkomst likevel | Verdien er tema-valg, ikke produktvalg |
| 11 | Direkte URL uten `?themes=` | Normal rekkefølge, ingen "Andre kategorier" | Bakoverkompatibel |
| 12 | `?themes=` vs `?categories=` | Ny `?themes=` param, koeksisterer | Ulik granularitet, ulike bruksområder |
| 13 | Explorer "dimmed" | Bruk eksisterende toggle-off (skjult) | Ingen ny render-mode nødvendig |
| 14 | Tomt tema (0 POIs) | Skjul stille, ikke vis tom seksjon | Rent, ingen "Ingen steder funnet" |
| 15 | Guide som default | Vis velkomst uten tema-velger | Guide har ikke tema-filtrering |

## Technical Approach

### Phase 1: Datamodell (DB + Types)

**Nye felter på `project_containers`-tabellen:**

```sql
-- supabase/migrations/042_add_welcome_fields.sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS welcome_tagline TEXT,
  ADD COLUMN IF NOT EXISTS default_product TEXT NOT NULL DEFAULT 'report'
    CONSTRAINT projects_default_product_valid
    CHECK (default_product IN ('explorer', 'report', 'guide'));
```

**TypeScript-typer** (`lib/types.ts`):

```typescript
// Legg til i ProjectContainer interface (~linje 177)
export interface ProjectContainer {
  // ... eksisterende felter
  welcomeTagline?: string;
  defaultProduct: ProductType;  // "explorer" | "report" | "guide"
}
```

**Data-lag** (`lib/data-server.ts`):
- Oppdater `getProjectContainerFromSupabase()` til å inkludere nye felter i SELECT
- Oppdater JSON-fallback til å støtte `welcomeTagline` og `defaultProduct`

**Filer som endres:**
- `supabase/migrations/042_add_welcome_fields.sql` (ny) — NB: tabellen heter `projects`, ikke `project_containers`
- `lib/types.ts` (~linje 177-195)
- `lib/data-server.ts` (getProjectContainerFromSupabase)

#### Research Insights — Phase 1

**Graceful column fallback (fra `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`):**

Supabase JS client kaster ALDRI på manglende kolonner — den returnerer `{ data: null, error: <PostgresError> }`. Data-laget må håndtere dette:

```typescript
// I getProjectContainerFromSupabase():
// Nye kolonner kan feile i miljøer der migrasjonen ikke er kjørt ennå
const container: ProjectContainer = {
  ...baseFields,
  welcomeTagline: data.welcome_tagline ?? undefined,
  defaultProduct: data.default_product ?? "report", // safe fallback
};
```

**Viktig:** Etter migrasjon, regenerer Supabase-typer hvis vi bruker codegen. Fjern eventuelle `as string`-casts.

---

### Phase 2: Velkomstside (erstatter landingsside)

**Erstatt innholdet i `app/for/[customer]/[project]/page.tsx`:**

Dagens logikk:
- Multi-product → 3 produktkort i grid
- Single-product → `redirect()` til produktet
- Legacy → fallback-rendering

Ny logikk:
- Hent `ProjectContainer` (som i dag)
- Render `WelcomeScreen`-komponent med prosjektnavn, tagline, temaer
- CTA navigerer til `/${defaultProduct}?themes=valgte-temaer`

**Ny komponent: `components/shared/WelcomeScreen.tsx`** (i `shared/` — matcher `ProductNav.tsx` som er tverrprodukt)

```typescript
"use client";

interface WelcomeScreenProps {
  projectName: string;
  tagline?: string;
  defaultProductPath: string; // "report" | "explore" | "trip"
  basePath: string;           // "/for/overvik/overvik-sorgenfri"
  themes: ThemeDefinition[];
  showThemeSelector: boolean; // false når defaultProduct === "guide"
}
```

**Navigasjon:** Bruk `<Link>` med dynamisk `href` (ikke `useRouter`) — matcher codebase-konvensjon. Beregn href i en `useMemo`:

```typescript
const targetHref = useMemo(() => {
  if (selectedThemes.length === allThemes.length || selectedThemes.length === 0) {
    return `${basePath}/${defaultProductPath}`;  // Ren URL når alle valgt
  }
  return `${basePath}/${defaultProductPath}?themes=${selectedThemes.join(",")}`;
}, [selectedThemes, allThemes, basePath, defaultProductPath]);
```

**Legacy-håndtering:**
- Prosjekter uten `ProjectContainer` → behold eksisterende legacy-rendering
- `ProjectContainer` uten `welcomeTagline` → vis kun prosjektnavn (ingen tagline)

**Metadata:**
- Oppdater `generateMetadata()` til å bruke `welcomeTagline` som description
- Legg til canonical URL: `alternates.canonical` peker til base URL uten params

**Filer som endres:**
- `app/for/[customer]/[project]/page.tsx` (refaktorér)
- `components/shared/WelcomeScreen.tsx` (ny)

#### Research Insights — Phase 2: UI Design

**Visuell retning: Toggle-kort, ikke plain checkboxes**

Bruk interaktive kort i stedet for standard checkboxer. Hvert kort har tre tilstander:

| Tilstand | Visuell behandling |
|----------|-------------------|
| Valgt | `bg-white`, full-farge dot, mørk tekst, `shadow-sm`, fylt checkbox |
| Fravalgt | Transparent bg, grå dot, muted tekst, `opacity-50`, tom checkbox-border |
| Hover | `opacity-100`, sterkere border, `shadow-sm` |

**Fargedot:** Bruker eksakt hex-verdier fra `DEFAULT_THEMES` (`#ef4444`, `#0ea5e9`, etc.) som matcher kartmarkører. Desatureres til `#d6d0c8` når fravalgt.

**Native checkbox:** `sr-only` men fullt keyboard-navigerbar. Det visuelle kortet er en `<label>` som wrapper den skjulte `<input>`.

**Layout-struktur:**

```
min-h-[100dvh] bg-[#faf9f7]
└── flex flex-col items-center justify-between (mobil) / justify-center (desktop)
    ├── max-w-lg [scrollbar innhold]
    │   ├── <header> — h1 + tagline
    │   └── <fieldset> — tema-kort
    └── max-w-lg [sticky bottom]
        ├── <div role="status"> — tema-telling (live region)
        ├── <p id="cta-hint"> — validering
        └── <button> — CTA
```

**Staggered animasjon:**

```css
@keyframes welcome-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
```

Delays: Header 0ms → Fieldset 80ms → Kort 1-5 (120-340ms, +55ms each) → CTA 420ms.

`prefers-reduced-motion: reduce` → ingen animasjoner.

**CTA-knapp:**
- Aktiv: `bg-stone-900 text-white hover:bg-stone-800 active:scale-[0.99] shadow-md`
- Disabled: `bg-[#d6d0c8] text-[#a0998f] cursor-not-allowed`
- `→` pilen er `aria-hidden="true"`

**CSS-animasjon gotcha (fra `docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md`):**
Bruk ALLTID namespaced keyframe-navn (`welcome-rise`, `welcome-fade`). Sjekk `globals.css` for eksisterende `@keyframes` med samme navn først. Navnet `fade-in` er allerede tatt.

#### Research Insights — Phase 2: Tilgjengelighet (WCAG 2.2)

**1. Fieldset + Legend:**

```html
<fieldset>
  <legend class="text-lg font-medium">Velg temaer</legend>
  <!-- toggle-kort her -->
</fieldset>
```

Legend-teksten bør være kort og handlingsrettet. "Velg temaer" er bedre enn bare "Temaer" (WCAG 1.3.1, 3.3.2).

**2. CTA-knapp: `aria-disabled` (IKKE native `disabled`):**

Native `disabled` fjerner knappen fra tab-rekkefølgen — brukeren når den aldri og oppdager aldri *hvorfor* den er inaktiv. Bruk `aria-disabled="true"` som beholder fokusbarhet:

```tsx
<button
  aria-disabled={selectedCount === 0}
  aria-describedby="cta-hint"
  onClick={(e) => {
    if (selectedCount === 0) { e.preventDefault(); return; }
    router.push(targetUrl);
  }}
>
  Utforsk nabolaget →
</button>
<p id="cta-hint" className={selectedCount === 0 ? "visible" : "sr-only"}>
  Velg minst ett tema for å fortsette.
</p>
```

**3. Live region for tema-telling:**

```html
<!-- MÅ være i DOM på mount, ikke injisert dynamisk -->
<div id="theme-count" role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
```

Oppdater innholdet ved hver endring:
- 0 valgt: "Ingen temaer valgt. Du må velge minst ett."
- N valgt: "N temaer valgt."

**4. Fargedots er dekorative:**

Siden hvert kort har en tekst-label som unikt identifiserer temaet, er fargedoten ren visuell forsterkning. Merk med `aria-hidden="true"`. Ikoner likeså. (WCAG 1.4.1 — farge er ikke eneste informasjonsbærer).

**5. Fokus ved sidelast:** Ingen spesiell fokushåndtering trengs. Nettleserens default tab-rekkefølge fra toppen er korrekt. (WAI APG keyboard interface guidance).

**6. Synlig fokusring:** Sørg for at custom `:focus-visible` ring på kortene har ≥3:1 kontrast (WCAG 2.4.11).

#### Research Insights — Phase 2: Next.js Patterns

**searchParams-mønster (allerede i kodebasen):**

```typescript
// page.tsx — server component, await searchParams
const resolvedSearchParams = await searchParams;
```

**CTA-navigasjon fra client component:**

Bruk `router.push()` for dynamisk navigasjon der URL beregnes ved klikk:

```typescript
const router = useRouter();
const handleConfirm = () => {
  const themeParam = selectedThemes.join(",");
  router.push(`${basePath}/${productPath}?themes=${themeParam}`);
};
```

**Canonical URL i generateMetadata:**

```typescript
export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const container = await getProjectContainerAsync(customer, projectSlug);
  return {
    title: `${container?.name ?? projectSlug} | Placy`,
    description: container?.welcomeTagline ?? `Utforsk nabolaget rundt ${container?.name}`,
    alternates: {
      canonical: `https://placy.no/for/${customer}/${projectSlug}`,
    },
  };
}
```

Ikke bruk `searchParams` i meta description — alle `?themes=`-varianter skal ha identisk metadata.

---

### Phase 3: Report tema-prioritering

**Lese `?themes=` i Report-side:**

`app/for/[customer]/[project]/report/page.tsx`:
```typescript
const selectedThemes = typeof resolvedSearchParams.themes === "string"
  ? resolvedSearchParams.themes.split(",")
  : undefined; // undefined = alle temaer, normal rekkefølge
```

**Rekkefølge-logikk i `report-data.ts` eller `ReportPage.tsx`:**

```typescript
function prioritizeThemes(
  themes: ReportThemeSection[],
  selectedThemeIds?: string[]
): { primary: ReportThemeSection[]; secondary: ReportThemeSection[] } {
  if (!selectedThemeIds) return { primary: themes, secondary: [] };

  const selected = new Set(selectedThemeIds);
  return {
    primary: themes.filter(t => selected.has(t.id)),
    secondary: themes.filter(t => !selected.has(t.id)),
  };
}
```

**Rendering i `ReportPage.tsx`:**
- `primary` temaer rendres som vanlig (full `ReportThemeSection`)
- Hvis `secondary.length > 0`: vis skillelinje + "Andre kategorier"-overskrift
- `secondary` temaer rendres som **individuelle seksjoner** (ikke én samlet blob) — IntersectionObserver trenger per-tema seksjoner for at sticky map skal fungere
- Legg til `variant?: "primary" | "secondary"` prop på `ReportThemeSection` som undertrykker featured-kort og forenkler header når `variant === "secondary"`
- `ReportFloatingNav`: vis kun `primary` temaer

**Theme ID-validering i `report/page.tsx`:**

```typescript
// Valider theme-IDer mot faktiske temaer i prosjektet
const validThemeIds = reportData.themes.map(t => t.id);
const validatedThemes = selectedThemes?.filter(id => validThemeIds.includes(id));
// Tom liste etter validering → fallback til alle temaer
const effectiveThemes = validatedThemes?.length ? validatedThemes : undefined;
```

**Canonical URL på Report:**

```typescript
// I report/page.tsx generateMetadata:
alternates: {
  canonical: `https://placy.no/for/${customer}/${projectSlug}/report`,
}
```

**Filer som endres:**
- `app/for/[customer]/[project]/report/page.tsx` (les searchParams + canonical)
- `components/variants/report/ReportPage.tsx` (split primary/secondary)
- `components/variants/report/report-data.ts` (evt. ny `prioritizeThemes()`)
- `components/variants/report/ReportFloatingNav.tsx` (filtrer nav-items)

#### Research Insights — Phase 3

**Eksisterende sub-section-splitting (fra `docs/solutions/feature-implementations/report-subcategory-splitting-20260210.md`):**

Report har allerede konseptet med tema-seksjoner som kan splittes i sub-seksjoner. `secondary`-temaer bør rendres som kollapset/kompakt variant — ikke som fulle `ReportThemeSection` med featured-kort. Bruk `displayMode: "compact"` eller lignende flagg.

**Scroll-synkronisering:** `ReportStickyMap` og `ReportFloatingNav` konsumerer begge `themes`-arrayet. Begge må filtreres til kun `primary` for å unngå at bruker kan scrolle til seksjoner som floating-nav ikke viser.

---

### Phase 4: Explorer tema-prioritering

**Lese `?themes=` i Explorer-side:**

`app/for/[customer]/[project]/explore/page.tsx`:
```typescript
const selectedThemes = typeof resolvedSearchParams.themes === "string"
  ? resolvedSearchParams.themes.split(",")
  : undefined;

// Oversett til kategorier via DEFAULT_THEMES
const initialCategories = selectedThemes
  ? DEFAULT_THEMES
      .filter(t => selectedThemes.includes(t.id))
      .flatMap(t => t.categories)
  : undefined;
```

Dette bruker **eksisterende `initialCategories`-prop** på `ExplorerPage` — ingen endring i Explorer-komponentene trengs. Tema-til-kategori-oversettelsen skjer i server-komponenten (page.tsx).

`?themes=` og `?categories=` koeksisterer: `?themes=` oversettes til kategori-IDer, `?categories=` brukes direkte. `?themes=` har presedens hvis begge er til stede.

**Filer som endres:**
- `app/for/[customer]/[project]/explore/page.tsx` (les themes, oversett til categories)

#### Research Insights — Phase 4

**Empty categories fallback (fra `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`):**

Når `?themes=` oversettes til kategori-IDer, kan noen kategorier mangle POIs i det aktuelle prosjektet. ExplorerPage håndterer dette allerede — `disabledCategories` filtrerer mot `project.categories`. Men test at Explorer ikke viser "0 av 0 steder" når alle valgte tema-kategorier er tomme.

---

## Acceptance Criteria

### Funksjonelle krav

- [x] Velkomstskjerm vises på `/for/[customer]/[project]/` med prosjektnavn og tagline
- [x] 5 tema-toggle-kort vises med ikon, farge-dot og navn — alle forhåndsvalgt
- [x] Brukeren kan huke av/på temaer individuelt via toggle-kort
- [x] CTA-knappen er `aria-disabled` når 0 temaer er valgt, med synlig melding "Velg minst ett tema"
- [x] CTA navigerer til `/{defaultProduct}?themes=valgte,tema,ids`
- [x] Report sorterer seksjoner: valgte temaer først, fravalgte under "Andre kategorier"
- [x] Explorer pre-toggler kategorier basert på valgte temaer (fravalgte skjult)
- [x] Direkte URL til Report/Explorer uten `?themes=` fungerer som i dag (alle temaer synlige)
- [x] Legacy-prosjekter uten ProjectContainer beholder eksisterende oppførsel
- [x] Single-product prosjekter viser velkomst med tema-valg (ikke auto-redirect)
- [x] `defaultProduct: "guide"` → velkomst uten tema-velger, bare navn + tagline + CTA
- [x] Staggered animasjon på innlasting (respekterer `prefers-reduced-motion`)

### Ikke-funksjonelle krav

- [x] `<fieldset>` + `<legend>` rundt checkboxer (WCAG 1.3.1)
- [x] `aria-disabled` (ikke native `disabled`) på CTA (WCAG 3.3.1)
- [x] Live region (`role="status"`) for tema-telling (i DOM på mount)
- [x] Synlig `:focus-visible` ring på toggle-kort (≥3:1 kontrast, WCAG 2.4.11)
- [x] Fargedots og ikoner er `aria-hidden="true"` (WCAG 1.4.1)
- [x] CTA sticky bottom på mobil
- [x] `generateMetadata()` bruker `welcomeTagline` som description
- [x] Canonical URL på velkomst, Report og Explorer (uten `?themes=` params)
- [x] CSS-animasjoner bruker namespaced keyframes (`welcome-*`)
- [x] TypeScript kompilerer uten feil
- [x] ESLint passerer
- [x] Eksisterende tester passerer

## Dependencies & Risks

**Dependencies:**
- DB-migrasjon for `welcome_tagline` og `default_product` — må kjøres og verifiseres
- Minst ett prosjekt i Supabase må ha `welcome_tagline` og `default_product` satt for testing

**Risks:**
- **SEO:** Theme-parameteriserte URLer kan indekseres som duplikat-innhold. **Mitigert:** Canonical URL på alle sider peker til base URL uten params.
- **Produktbytte:** Tema-state droppes ved produktbytte via ProductNav. Akseptert for MVP. Kan itereres med query param-forwarding i ProductNav-hrefs senere.
- **Animasjon-kollisjon:** Nye `@keyframes` i globals.css kan kollidere med eksisterende. **Mitigert:** Bruk `welcome-*` prefiks og sjekk eksisterende keyframes.

## References & Research

### Interne referanser
- Brainstorm: `docs/brainstorms/2026-02-27-onboarding-welcome-screen-brainstorm.md`
- Landingsside: `app/for/[customer]/[project]/page.tsx`
- Tema-system: `lib/themes/default-themes.ts`
- Report-temaer: `components/variants/report/report-themes.ts`
- Explorer filtering: `components/variants/explorer/ExplorerPage.tsx:56-88`
- ProjectContainer-type: `lib/types.ts:177-195`
- Data-henting: `lib/data-server.ts:184-245`

### Institusjonell kunnskap (docs/solutions/)
- Explorer UX overhaul: `docs/solutions/feature-implementations/explorer-ux-quality-overhaul-20260206.md`
- Filter UI patterns: `docs/solutions/ux-improvements/explorer-sidebar-compact-redesign-20260207.md`
- Query params for state: `docs/solutions/feature-implementations/trips-sprint2-preview-mode-20260215.md`
- Report subsection ordering: `docs/solutions/feature-implementations/report-subcategory-splitting-20260210.md`
- Empty categories gotcha: `docs/solutions/logic-errors/empty-product-categories-explorer-zero-pois-20260205.md`
- Graceful column fallback: `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`
- CSS animation collision: `docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md`
- Cross-product component reuse: `docs/solutions/best-practices/cross-product-component-reuse-guide-report-20260213.md`

### Tilgjengelighet
- W3C WAI Grouping Controls: fieldset + legend
- WCAG 2.2: 1.3.1, 1.4.1, 1.4.11, 2.4.11, 3.3.1, 3.3.2
- `aria-disabled` over native `disabled` for focusability
- Sara Soueidan: Accessible notifications with ARIA Live Regions
