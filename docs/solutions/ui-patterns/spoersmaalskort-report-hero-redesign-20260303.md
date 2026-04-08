---
title: "Spørsmålskort — Report Hero Redesign"
date: 2026-03-03
category: ui-patterns
tags: [report, hero, theme-chip, bransjeprofil, i18n, white-label]
module: components/variants/report, components/shared
symptoms: ["turisme-orientert header for boligkjøpere", "metrics-fokus uten emosjonell kobling"]
---

# Spørsmålskort — Report Hero Redesign

## Problem
Report-headeren var turisme-orientert (metrics-bar, scorecard, store tema-kort med statistikk). For boligkjøpere gir "97 steder / 4.1 rating" lite verdi — de trenger svar på emosjonelle spørsmål som "Er det bra for barna?".

## Løsning

### ThemeChip — delt komponent med to varianter
**`components/shared/ThemeChip.tsx`** — duck-typed `ThemeChipData` interface som fungerer med både `ThemeDefinition` og `ReportTheme`:

- **scroll-variant** (Report hero): `<button>` med spørsmål (bold) + temanavn (undertekst) + ↓ pil. `onScrollTo` → `scrollIntoView`.
- **select-variant** (WelcomeScreen): `<label>/<input type="checkbox">` med check-ikon. Tema-farge via inline `style` (ikke dynamiske Tailwind-klasser).

### Dynamiske farger — ALLTID inline style
```tsx
// Tailwind arbitrary values fungerer IKKE med runtime-verdier:
// ❌ border-[${theme.color}] — krever statisk analyse
// ✅ style={{ borderColor: theme.color, backgroundColor: theme.color + "1a" }}
```

### i18n theme questions — statiske strenger, ikke database
Spørsmål per tema ligger i `lib/i18n/strings.ts` som `themeQuestions` map. Resolver via `getThemeQuestion(locale, themeId)`. Locale-resolving skjer i parent (ReportHero bruker `useLocale()`, WelcomeScreen bruker alltid "no").

### Hero intro — bransjeprofil-templates med interpolation
`getIntroKey(tags)` velger riktig template basert på bransje-tag. `interpolate("{name}", { name })` fyller inn prosjektnavn. Beregnes i `transformToReportData()`, ikke i komponenten.

### White-label CSS — server-side injection
`<style dangerouslySetInnerHTML>` i server route component (ikke client). CSS vars (`--placy-primary`, `--placy-bg`, `--placy-font`) med fallbacks i `globals.css`. Verdier validert av database CHECK constraint (hex-farger, kjente fonts, http URLs).

## Gotchas
1. **WelcomeScreen har ingen LocaleProvider** — bruk alltid "no" for spørsmål der
2. **WelcomeScreen har duplisert JSX** (desktop + mobil) — begge blokker må oppdateres
3. **FloatingNav pills**: Fjern trailing "?" fra spørsmål (`theme.question.replace(/\?$/, "")`) for kompakthet
4. **`prefers-reduced-motion`**: Scroll-behavior sjekkes via `window.matchMedia` før `scrollIntoView`
5. **ThemeChip question fallback**: `theme.question ?? theme.name` — viser temanavn hvis spørsmål mangler

## Filer
- `components/shared/ThemeChip.tsx` — ny delt komponent
- `components/variants/report/ReportHero.tsx` — komplett redesign
- `components/shared/WelcomeScreen.tsx` — bruker ThemeChip select
- `components/variants/report/ReportFloatingNav.tsx` — pills viser spørsmål
- `components/variants/report/report-data.ts` — color, question, heroIntro
- `lib/i18n/strings.ts` — themeQuestions, heroIntro-templates, interpolate()
- `lib/types.ts` — ProjectTheme type
- `supabase/migrations/045_project_theme.sql` — theme JSONB med CHECK
