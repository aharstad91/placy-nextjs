---
title: "feat: Spørsmålskort — Report-header redesign + WelcomeScreen-oppdatering"
type: feat
date: 2026-03-03
brainstorm: docs/brainstorms/2026-03-03-spoersmaalskort-tema-cta-brainstorm.md
depends_on: docs/plans/2026-03-03-feat-bransjeprofil-theme-system-plan.md
---

# Spørsmålskort — Report-header redesign + WelcomeScreen

## Enhancement Summary

**Deepened on:** 2026-03-03
**Sections enhanced:** 4 (ThemeChip, ReportHero, White-label, i18n)
**Research agents used:** chip-component-patterns, white-label-theming, i18n-theme-questions
**Learnings applied:** report-visual-polish-floating-nav, cross-product-component-reuse, bilingual-i18n-report-translations

### Key Improvements
1. **ARIA accessibility** — Native `<label>/<input>` for select chips (WelcomeScreen pattern), native `<button>` for scroll chips
2. **Smooth scroll offset** — `scroll-margin-top: 7rem` for stacked headers (floating nav + sticky header)
3. **Zero-FOUC theming** — Inline `<style>` i server route component for white-label CSS vars
4. **i18n via static strings** — Theme questions som UI labels i `lib/i18n/strings.ts`, ikke database-translations
5. **Theme color via inline style** — Bruker `style={{ borderColor, backgroundColor }}` for dynamiske farger (som resten av codebasen)

### New Considerations Discovered
- Press feedback med `active:scale-[0.97]` for tactile feel
- Arrow nudge animation på hover (`group-hover:translate-y-0.5 transition-transform`)
- Behov for `prefers-reduced-motion` respekt (fra learnings)
- WCAG contrast validation ved admin-lagring av theme-farger

### Tech Audit (2026-03-03) — Verdict: YELLOW

Alle funn er fikset i planen under. Se `## Tech Audit Findings` nederst for full rapport.

## Oversikt

Redesign Report-headeren fra turisme-orientert til boligkjøper-orientert. Erstatt statistikk-raden og store tema-kort med emosjonell intro + kompakte spørsmåls-chips. Gjenbruk chip-komponenten i WelcomeScreen. Legg grunnlaget for white-label per prosjekt.

**Avhengighet:** Bransjeprofil-systemet (`docs/plans/2026-03-03-feat-bransjeprofil-theme-system-plan.md`) må implementeres først — det gir `question`-feltet på temaer og tag-drevet tema-resolving.

## Nåværende tilstand

**Report-header (`ReportHero.tsx`):**
- "NABOLAGSRAPPORT" label i small caps
- Prosjektnavn som H1
- Lang introtekst med inline statistikk
- Scorecard-stripe: 97 steder / 4.1 rating / 7655 anmeldelser / 20 transport
- Store tema-kort (grid-cols-5): ikon + temanavn + steder + rating
- Klikk → smooth scroll til seksjon (fungerer, beholdes)

**WelcomeScreen (`components/shared/WelcomeScreen.tsx`):**
- Viser tema-checkbox med temanavn + poiCount
- Alle starter som valgt, bruker toggler av
- Emitter `?themes=id1,id2` query param
- Kobles til Report og Explorer via URL

## Endringer

### Fase 0: Spørsmål i i18n + ReportTheme utvidelse

**Forutsetter at bransjeprofil-systemet er implementert.** Hvis ikke, implementer det først.

**`lib/i18n/strings.ts`** — legg til `themeQuestions` map + `getThemeQuestion()` + `interpolate()`:
```typescript
export const themeQuestions: Record<string, Record<Locale, string>> = {
  "barn-oppvekst": { no: "Er det bra for barna?", en: "Is it good for kids?" },
  // ... alle 7 temaer (se Fase 6 for full liste)
};
```

**`components/variants/report/report-data.ts`** — utvid `ReportTheme`:
```typescript
export interface ReportTheme {
  // ... eksisterende felt ...
  color: string;       // NY — fra ThemeDefinition.color
  question?: string;   // NY — resolved via getThemeQuestion(locale, id)
}
```

**`transformToReportData()`** — thread `color` og `question` gjennom:
```typescript
themes.push({
  // ... eksisterende ...
  color: themeDef.color,
  question: getThemeQuestion(locale, themeDef.id),
});
```

**IKKE legg `question` på `ThemeDefinition`** — spørsmålene er i18n-strenger, ikke tema-konfigurasjon. Én kilde til sannhet i `strings.ts`.

### Fase 1: Ny `ThemeChip`-komponent

**Ny fil: `components/shared/ThemeChip.tsx`**

Gjenbrukbar chip-komponent med to varianter.

**Minimal interface (duck typing — fungerer med både `ThemeDefinition` og `ReportTheme`):**
```typescript
interface ThemeChipData {
  id: string;
  name: string;
  icon: string;
  color: string;
  question?: string;   // Pre-resolved av parent (med locale)
  poiCount?: number;
}

interface ThemeChipProps {
  theme: ThemeChipData;
  variant: "scroll" | "select";   // Report: scroll, Welcome: select
  isSelected?: boolean;           // Kun for "select"-variant
  onToggle?: () => void;          // Kun for "select"-variant
  onScrollTo?: () => void;        // Kun for "scroll"-variant
  className?: string;
}
```

**Viktig:** `question` er pre-resolved av parent med korrekt locale. ThemeChip kaller IKKE `useLocale()` internt — dette fordi WelcomeScreen ikke har `LocaleProvider`. Parent-komponenten resolver: `getThemeQuestion(locale, theme.id) ?? theme.name`.

**Visuelt design:**
- Kompakt chip: `px-4 py-3 rounded-xl border`
- Spørsmålet (eller theme.name som fallback) i **bold** som hovedtekst
- Temanavn som liten undertekst (`text-xs text-gray-400`)
- `↓` pil høyre-justert (scroll-variant)
- Checkbox venstre-justert (select-variant)
- Default: `bg-white border-gray-200 text-gray-700`
- Hover: `bg-gray-50 border-gray-300` (subtle)
- Selected (select-variant): tema-farge som border + bakgrunn-tint via **inline `style`** (ikke dynamiske Tailwind-klasser — de fungerer ikke med runtime-verdier)

**Layout-wrapper:** Flex-wrap med gap, ikke grid — lar chips ha naturlig bredde basert på spørsmålslengde.

#### Research Insights — ThemeChip

**ARIA & Accessibility (fra tech audit):**
- Scroll-variant: Bruk native `<button>` — inherent keyboard/screen reader support
- Select-variant: Bruk `<label>` + `<input type="checkbox" className="sr-only">` — følger WelcomeScreen-mønsteret med native form semantics
- WelcomeScreen: Behold `<fieldset>/<legend>` wrapper rundt chip-containeren for ARIA-gruppering
- Begge varianter: Synlig fokus-ring (`focus-within:ring-2 focus-within:ring-offset-2`)

**Interaksjon & Feedback:**
- Press feedback: `active:scale-[0.97] transition-transform duration-100` — tactile feel
- Arrow nudge on hover: Wrap chip i `group`, pilen får `group-hover:translate-y-0.5 transition-transform`
- `prefers-reduced-motion`: Fjern transitions — `motion-reduce:transition-none motion-reduce:transform-none`

**Layout-detaljer:**
- `whitespace-nowrap` på spørsmålstekst — forhindrer ulesbar wrapping
- `min-w-[5rem]` som safety for korte spørsmål
- Gap: `gap-2` (8px) gir god luft uten å bruke for mye plass
- WelcomeScreen: Behold stagger-animasjon via ytre `<div style={{ animationDelay }}>`

**Dynamiske farger — bruk inline `style` (fra tech audit):**
Hele codebasen bruker `style={{ backgroundColor: color }}` for dynamiske farger. **Dynamiske Tailwind arbitrary values (`border-[${theme.color}]`) fungerer IKKE** — Tailwind krever statisk analyserbare klassenavn. Bruk:
```tsx
style={isSelected ? {
  borderColor: theme.color,
  backgroundColor: theme.color + "1a",  // ~10% opacity hex
} : undefined}
```

**Ikon-resolving:** Bruk `getIcon(theme.icon)` fra `@/lib/utils/map-icons` (delt utility), ikke lokal map.

**Kode-eksempel — scroll-variant:**
```tsx
<button
  onClick={onScrollTo}
  className={cn(
    "group flex items-center gap-2 px-4 py-3 rounded-xl border",
    "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300",
    "transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
    "active:scale-[0.97] motion-reduce:transform-none",
  )}
>
  <div className="text-left">
    <span className="font-semibold text-sm whitespace-nowrap">
      {theme.question ?? theme.name}
    </span>
    <span className="block text-xs text-gray-400">{theme.name}</span>
  </div>
  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:translate-y-0.5 transition-transform motion-reduce:transform-none" />
</button>
```

**Kode-eksempel — select-variant:**
```tsx
<label
  className={cn(
    "group flex items-center gap-2 px-4 py-3 rounded-xl border cursor-pointer",
    "transition-colors duration-150",
    "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500",
    "active:scale-[0.97] motion-reduce:transform-none",
    !isSelected && "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300",
  )}
  style={isSelected ? {
    borderColor: theme.color,
    backgroundColor: theme.color + "1a",
  } : undefined}
>
  <input type="checkbox" className="sr-only" checked={isSelected} onChange={onToggle} />
  <CheckIcon className={cn("w-4 h-4", isSelected ? "opacity-100" : "opacity-0")} />
  <div className="text-left">
    <span className="font-semibold text-sm whitespace-nowrap">
      {theme.question ?? theme.name}
    </span>
    <span className="block text-xs text-gray-400">{theme.name}</span>
  </div>
</label>
```

### Fase 2: Redesign ReportHero

**`components/variants/report/ReportHero.tsx`** — komplett redesign av hero-innholdet.

**Ny props-interface:**
```typescript
interface ReportHeroProps {
  projectName: string;
  themes: ReportTheme[];
  heroIntro?: string;        // Fra reportConfig eller bransjeprofil
  label?: string;            // Beholdes for bakoverkompatibilitet, men vises ikke for bolig
}
```

**Fjernes:**
- `metrics: ReportHeroMetrics` prop — brukes ikke lenger i hero
- Scorecard-stripe (97 steder / 4.1 rating / 7655 anmeldelser / 20 transport)
- `"NABOLAGSRAPPORT"` label (for bolig-profil)
- Gamle store tema-kort

**Ny struktur:**

```tsx
<section className="col-span-12 pt-8 pb-10">
  {/* Locale toggle — beholdes */}
  <ReportLocaleToggle />

  {/* Prosjektnavn */}
  <h1 className="text-4xl md:text-5xl font-semibold text-[#1a1a1a] mb-4">
    {projectName}
  </h1>

  {/* Emosjonell intro */}
  <p className="text-lg md:text-xl text-gray-500 max-w-2xl mb-8">
    {heroIntro ?? defaultIntro(projectName)}
  </p>

  {/* Spørsmåls-chips */}
  <div className="flex flex-wrap gap-2">
    {themes.map(theme => (
      <ThemeChip
        key={theme.id}
        theme={theme}
        variant="scroll"
        onScrollTo={() => scrollToSection(theme.id)}
      />
    ))}
  </div>
</section>
```

**`heroIntro` — beregnes i `transformToReportData()`, IKKE i ReportHero (fra tech audit):**

`defaultIntro()` trenger `project.tags` for å velge riktig bransjeprofil-mal. ReportHero har ikke tags. Flytt logikken til datalaget:

```typescript
// I transformToReportData() i report-data.ts:
const heroIntro = project.reportConfig?.heroIntro
  ?? interpolate(t(locale, getIntroKey(project.tags)), { name: project.name });

// getIntroKey() velger riktig streng basert på bransjeprofil:
function getIntroKey(tags: string[]): StringKey {
  if (tags.includes("eiendom-bolig")) return "heroIntroBolig";
  if (tags.includes("eiendom-naering")) return "heroIntroNaering";
  return "heroIntroFallback";
}
```

ReportHero mottar `heroIntro` som ferdig beregnet streng — ingen forretningslogikk i komponenten.

**Introen kan overstyres** via `reportConfig.heroIntro` (eksisterende felt, allerede støttet).

**`scrollToSection`** — beholdes som i dag:
```typescript
const scrollToSection = (themeId: string) => {
  document.getElementById(themeId)?.scrollIntoView({ behavior: "smooth" });
};
```

#### Research Insights — ReportHero scroll

**Scroll-offset for stacked headers (fra learnings):**
Floating nav og sticky header overlapper scroll-target. Løsning:
```css
/* På hver tema-seksjon som er scroll-target */
.theme-section {
  scroll-margin-top: 7rem; /* Tilsvarer sticky header + floating nav høyde */
}
```
Alternativt via Tailwind: `scroll-mt-[7rem]` på section-elementet med `id={theme.id}`.

**`prefers-reduced-motion` (fra learnings):**
```typescript
const scrollToSection = (themeId: string) => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(themeId)?.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth"
  });
};
```

### Fase 3: Oppdater WelcomeScreen

**`components/shared/WelcomeScreen.tsx`** — erstatt tema-checkboxes med ThemeChip.

**Nåværende tema-rendering (ca. linje 89-120):**
```tsx
{themes.map(theme => (
  <button onClick={toggleTheme} ...>
    <CheckIcon />
    <span>{theme.name}</span>
    <span>{theme.poiCount} steder</span>
  </button>
))}
```

**Erstattes med (fra tech audit — behold fieldset + stagger-animasjon):**
```tsx
<fieldset>
  <legend className="sr-only">{t(locale, "selectThemes")}</legend>
  <div className="flex flex-wrap gap-2">
    {themes
      .filter(t => (t.poiCount ?? 0) > 0)  // Skjul temaer uten POIs
      .map((theme, i) => (
        <div
          key={theme.id}
          className="welcome-animate"
          style={{ animationDelay: `${320 + i * 55}ms` }}
        >
          <ThemeChip
            theme={{
              ...theme,
              question: getThemeQuestion("no", theme.id) ?? theme.name,
            }}
            variant="select"
            isSelected={selectedThemes.has(theme.id)}
            onToggle={() => toggleTheme(theme.id)}
          />
        </div>
      ))}
  </div>
</fieldset>
```

**Viktig:** WelcomeScreen har ingen `LocaleProvider` — bruker alltid "no" for spørsmål. Begge desktop- og mobil-JSX-blokkene må oppdateres (WelcomeScreen har duplisert rendering).

Resten av WelcomeScreen (hero-bilde, tagline, CTA-knapp, `?themes=` logikk) forblir uendret.

### Fase 4: Oppdater ReportFloatingNav

**`components/variants/report/ReportFloatingNav.tsx`** — oppdater pills til å vise spørsmål.

Nåværende floating nav viser temanavn som pills. Oppdater til å vise spørsmålet (kortere versjon) med temanavn som fallback:

```typescript
// I pill-rendering:
const pillLabel = theme.question
  ? theme.question.replace(/\?$/, "")   // Fjern spørsmålstegn for kompakthet
  : theme.name;
```

Beholde: aktiv-indikator, scroll-oppførsel, progress bar.

### Fase 5: White-label grunnlag (prosjektnivå)

**Ny type i `lib/types.ts`:**
```typescript
export interface ProjectTheme {
  primaryColor?: string;      // Aksent-farge (knapper, aktive states)
  backgroundColor?: string;   // Seksjonsbakgrunner
  fontFamily?: "inter" | "dm-sans" | "system";
  logoUrl?: string;           // Logo i header
}
```

**Legg til på `ProjectContainer`:**
```typescript
export interface ProjectContainer {
  // ... eksisterende ...
  theme?: ProjectTheme;
}
```

**Database-migrasjon:** `supabase/migrations/045_project_theme.sql`
```sql
-- Add per-project white-label theme configuration
ALTER TABLE projects ADD COLUMN IF NOT EXISTS theme JSONB DEFAULT NULL;

-- Enforce valid structure: only allow safe, typed values (forhindrer CSS injection)
ALTER TABLE projects ADD CONSTRAINT projects_theme_valid CHECK (
  theme IS NULL OR (
    jsonb_typeof(theme) = 'object'
    AND (theme->>'primaryColor'    IS NULL OR theme->>'primaryColor'    ~ '^#[0-9a-fA-F]{3,8}$')
    AND (theme->>'backgroundColor' IS NULL OR theme->>'backgroundColor' ~ '^#[0-9a-fA-F]{3,8}$')
    AND (theme->>'fontFamily'      IS NULL OR theme->>'fontFamily' IN ('inter', 'dm-sans', 'system'))
    AND (theme->>'logoUrl'         IS NULL OR theme->>'logoUrl' ~ '^https?://')
  )
);
```

**Bruk i komponenter:**
```typescript
// CSS custom properties settes øverst i report/explore layout:
const themeVars = project.theme ? {
  "--placy-primary": project.theme.primaryColor,
  "--placy-bg": project.theme.backgroundColor,
  "--placy-font": project.theme.fontFamily === "dm-sans"
    ? "'DM Sans', sans-serif"
    : project.theme.fontFamily === "inter"
    ? "'Inter', sans-serif"
    : "system-ui",
} : {};
```

**Scope:** Denne fasen legger bare grunnlaget (type + migrasjon + CSS vars). Selve styling-bruken kan komme senere — nå er det viktigste at strukturen er på plass.

#### Research Insights — White-label

**Zero-FOUC theming:**
Sett CSS custom properties i **route server component** (`app/for/[customer]/[project]/report/page.tsx`), IKKE i `ReportPage.tsx` (som er `"use client"`):
```tsx
// app/for/[customer]/[project]/report/page.tsx (server component)
export default async function ReportProductPage(...) {
  const project = await getProductAsync(...);
  return (
    <>
      {project.theme && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --placy-primary: ${project.theme.primaryColor ?? '#3b82f6'};
            --placy-bg: ${project.theme.backgroundColor ?? '#ffffff'};
            --placy-font: ${fontFamilyValue};
          }
        `}} />
      )}
      <ReportPage ... />
    </>
  );
}
```
**Viktig:** Verdiene er validert av database CHECK constraint (045_project_theme.sql) — kun hex-farger, kjente font-navn, og http(s) URLer.

**CSS var fallbacks i globals.css:**
```css
:root {
  --placy-primary: #3b82f6;
  --placy-bg: #ffffff;
  --placy-font: system-ui;
}
```
Settes som baseline — prosjekter uten theme bruker disse. Forhindrer tomme CSS-variabler.

**Tailwind CSS variable shorthand:**
```css
/* I komponenter — bruk Tailwind arbitrary values */
bg-[--placy-primary]
text-[--placy-primary]
border-[--placy-primary]
```

**Validering av farger:**
Vurder enkel WCAG-kontrast-sjekk ved admin-lagring — forhindrer hvit tekst på hvit bakgrunn. Kan implementeres som en advarsel, ikke en blokkering.

**Migrasjon kan utsettes:**
Lagre theme i `reportConfig` JSONB (som allerede finnes) i stedet for ny kolonne, for å unngå migrasjon nå. Men ny kolonne er renere og anbefales.

### Fase 6: Oppdater i18n-strenger

**`lib/i18n/strings.ts`** — oppdater/legg til:

```typescript
// Report hero intro (brukes som fallback)
heroIntroBolig: {
  nb: "Lurer du på hvordan det er å bo på {name}? Utforsk nabolaget.",
  en: "Wondering what it's like to live at {name}? Explore the neighborhood.",
},
heroIntroNaering: {
  nb: "Lurer du på hva som finnes rundt {name}? Se hva som er i nærheten.",
  en: "Wondering what's around {name}? See what's nearby.",
},
heroIntroFallback: {
  nb: "Utforsk hva som finnes i nærheten av {name}.",
  en: "Explore what's nearby {name}.",
},
```

#### Research Insights — i18n (oppdatert etter tech audit)

**Statiske strenger i `lib/i18n/strings.ts` — IKKE separat fil:**
Tema-spørsmål er UI labels. De hører hjemme i `lib/i18n/strings.ts` sammen med alle andre strenger — ikke i en ny `theme-strings.ts`. Hold i18n-systemet i én fil.

**IKKE legg `question` på `ThemeDefinition`:** Spørsmålene er i18n-strenger, ikke tema-konfigurasjon. Én kilde til sannhet for oversettelser.

**Legg til i `lib/i18n/strings.ts`:**
```typescript
// Theme questions — keyed by theme ID, bilingual
export const themeQuestions: Record<string, Record<Locale, string>> = {
  "barn-oppvekst": { no: "Er det bra for barna?", en: "Is it good for kids?" },
  "hverdagsliv": { no: "Hva kan jeg ordne i nærheten?", en: "What can I find nearby?" },
  "mat-drikke": { no: "Er det et levende nabolag?", en: "Is it a lively neighborhood?" },
  "opplevelser": { no: "Er det noe å gjøre her?", en: "Is there anything to do here?" },
  "natur-friluftsliv": { no: "Er det grønt i nærheten?", en: "Is there nature nearby?" },
  "trening-aktivitet": { no: "Kan jeg trene i nærheten?", en: "Can I exercise nearby?" },
  "transport": { no: "Hvordan kommer jeg meg rundt?", en: "How do I get around?" },
};

export function getThemeQuestion(locale: Locale, themeId: string): string | undefined {
  return themeQuestions[themeId]?.[locale];
}

// Interpolation helper for {name} placeholders
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}
```

**Fallback-kjede i parent-komponenter:** `getThemeQuestion(locale, theme.id) ?? theme.name`

**Locale-resolving skjer i PARENT, ikke i ThemeChip:**
- ReportHero: `useLocale()` → resolver spørsmål → pass som `question` prop til ThemeChip
- WelcomeScreen: Ingen `LocaleProvider` → bruker default "no" → pass som `question` prop

Spørsmålene per tema:

| Tema | NO | EN |
|------|----|----|
| Barn & Oppvekst | "Er det bra for barna?" | "Is it good for kids?" |
| Hverdagsliv | "Hva kan jeg ordne i nærheten?" | "What can I find nearby?" |
| Mat & Drikke | "Er det et levende nabolag?" | "Is it a lively neighborhood?" |
| Opplevelser | "Er det noe å gjøre her?" | "Is there anything to do here?" |
| Natur & Friluftsliv | "Er det grønt i nærheten?" | "Is there nature nearby?" |
| Trening & Aktivitet | "Kan jeg trene i nærheten?" | "Can I exercise nearby?" |
| Transport & Mobilitet | "Hvordan kommer jeg meg rundt?" | "How do I get around?" |

## Implementeringsrekkefølge

```
Bransjeprofil-systemet (separat plan, MÅ gjøres først)
  ↓
Fase 0: question-felt på ThemeDefinition + bransjeprofil-data
  ↓
Fase 1: ThemeChip-komponent (ny, ingen breaking changes)
  ↓
Fase 2: Redesign ReportHero (fjern turisme-arv, bruk ThemeChip)
  ↓
Fase 3: Oppdater WelcomeScreen (bruk ThemeChip)
  ↓
Fase 4: Oppdater ReportFloatingNav (spørsmål i pills)
  ↓
Fase 5: White-label grunnlag (type + migrasjon + CSS vars)
  ↓
Fase 6: i18n for spørsmål og intro
  ↓
Verifiser: Report + WelcomeScreen + FloatingNav for Brøset
```

## Akseptansekriterier

### Report-header
- [ ] "NABOLAGSRAPPORT" label er borte (for bolig-profil)
- [ ] Statistikk-raden (steder/rating/anmeldelser/transport) er borte
- [ ] Gamle store tema-kort er borte
- [ ] Emosjonell introtekst vises ("Lurer du på...")
- [ ] 7 spørsmåls-chips vises i flex-wrap layout
- [ ] Hver chip viser spørsmål (bold) + temanavn (liten undertekst)
- [ ] Chips har ↓ pil som scroll-hint
- [ ] Klikk på chip → smooth scroll til riktig seksjon
- [ ] Hover-effekt: myk bakgrunnsendring
- [ ] Introtekst kan overstyres via reportConfig.heroIntro
- [ ] Fungerer med 5 temaer (Næring) og 7 temaer (Bolig)
- [ ] NO/EN locale toggle fungerer (spørsmål oversettes)

### WelcomeScreen
- [ ] Tema-valg bruker ThemeChip med select-variant
- [ ] Chips viser spørsmål + temanavn (samme design som Report)
- [ ] Checkbox/toggle synlig på select-variant
- [ ] ?themes= query param fungerer som før
- [ ] Visuell gjenkjennelse mellom WelcomeScreen og Report-header

### ReportFloatingNav
- [ ] Pills viser spørsmål (uten spørsmålstegn) i stedet for temanavn
- [ ] Aktiv-indikator og progress bar fungerer som før

### White-label
- [ ] `ProjectTheme` type eksisterer
- [ ] `theme` JSONB-kolonne finnes i projects-tabellen
- [ ] CSS custom properties settes når theme finnes
- [ ] Ingen visuell endring for prosjekter uten theme (Placy-standard)

### Teknisk
- [ ] ThemeChip er én komponent med to varianter (scroll/select)
- [ ] `npm run lint`, `npm test`, `npx tsc --noEmit` passerer
- [ ] `npm run build` passerer
- [ ] Brøset Report viser ny header live

## Risiko

| Risiko | Sannsynlighet | Tiltak |
|--------|---------------|--------|
| Bransjeprofil ikke implementert ennå | **Bekreftet** | Implementer den først (separat plan) |
| ReportHero metrics brukes andre steder | Lav | Sjekk — metrics beregnes i report-data.ts, hero bare viser dem |
| FloatingNav pills blir for lange med spørsmål | Middels | Fjern spørsmålstegn, vurder kortere variants |
| White-label CSS vars kolliderer med eksisterende | Lav | Prefix med `--placy-` |
| Spørsmål fungerer dårlig på engelsk | Lav | Skriv engelske varianter eksplisitt, ikke auto-oversett |
| WelcomeScreen mister funksjonalitet | Lav | Kun visuell endring, all logikk beholdes |

## Filer som endres

| Fil | Type endring |
|-----|-------------|
| `lib/themes/theme-definitions.ts` | Legg til `question` felt |
| `lib/themes/bransjeprofiler.ts` | Legg til spørsmål på alle temaer |
| `components/shared/ThemeChip.tsx` | **NY** — gjenbrukbar chip-komponent |
| `components/variants/report/ReportHero.tsx` | Komplett redesign av hero-innhold |
| `components/variants/report/ReportPage.tsx` | **Fjern** metrics-prop fra ReportHero-kall |
| `components/variants/report/report-data.ts` | Legg til `question` + `color` på `ReportTheme`, thread gjennom `transformToReportData()`, beregn `heroIntro` |
| `components/variants/report/report-themes.ts` | Legg til `question` + `color` i ReportTheme-mapping |
| `components/shared/WelcomeScreen.tsx` | Erstatt tema-checkboxes med ThemeChip (begge desktop/mobil-blokker) |
| `components/variants/report/ReportFloatingNav.tsx` | Oppdater pills til spørsmål |
| `lib/types.ts` | Legg til ProjectTheme type + theme på ProjectContainer |
| `lib/supabase/types.ts` | Legg til `theme` på projects Row/Insert/Update |
| `lib/supabase/queries.ts` | Returner theme fra project queries (extract i getProjectContainerFromSupabase) |
| `lib/i18n/strings.ts` | Nye intro-strenger + themeQuestions + interpolate() + getThemeQuestion() |
| `app/globals.css` | CSS var defaults (--placy-primary, --placy-bg, --placy-font) |
| `app/for/[customer]/[project]/report/page.tsx` | White-label `<style>` injection (server component) |
| `supabase/migrations/045_project_theme.sql` | **NY** — theme JSONB kolonne med CHECK constraint |

## Tech Audit Findings

**Audit date:** 2026-03-03 | **Verdict: YELLOW** — alle funn er fikset i planen over.

### Kritiske funn (fikset)
1. **Dynamiske Tailwind-klasser fungerer ikke** — `border-[${theme.color}]` krever statisk analyse. Fikset: inline `style` prop.
2. **Type mismatch** — ThemeChip tok `ThemeDefinition` men ReportHero sender `ReportTheme[]`. Fikset: minimal `ThemeChipData` interface.
3. **`question` ikke threaded** — `transformToReportData()` strippa `question`. Fikset: `report-data.ts` + `report-themes.ts` lagt til i files-changed.
4. **CSS injection** — `dangerouslySetInnerHTML` med uvaliderte JSONB-verdier. Fikset: CHECK constraint på migrasjon.

### Medium funn (fikset)
5. `<style>` i client component — flyttet til server route component
6. Dual i18n source — konsolidert i `strings.ts`, fjernet `theme-strings.ts`
7. WelcomeScreen a11y — beholdt `<fieldset>/<legend>` + native `<input>`
8. `defaultIntro()` business logic — flyttet til `transformToReportData()`
9. CSS var fallbacks — lagt til i `globals.css`
10. Supabase types — `lib/supabase/types.ts` oppdatert i files-changed

### Lave funn (akseptert)
11. FloatingNav pill-lengde — overvåkes, legger til `shortQuestion` om nødvendig
12. WelcomeScreen poiCount — skjuler chips med poiCount === 0
13. Stagger-animasjon — ytre `<div style={{ animationDelay }}>` wrapper
14. `ReportClosing` turisme-tekst — akseptert som separat oppfølging
