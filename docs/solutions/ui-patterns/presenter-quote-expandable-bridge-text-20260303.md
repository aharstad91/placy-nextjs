---
title: Presenter Quote Card with Expandable Bridge Text
date: 2026-03-03
category: ui-patterns
tags: [report, theme-intro, progressive-disclosure, animation, presenter]
module: components/variants/report
symptoms:
  - Theme introductions feel flat and impersonal
  - No room for deeper neighborhood descriptions without cluttering the view
---

# Presenter Quote Card with Expandable Bridge Text

## Problem

Theme introduction sections in the Report product displayed 2-3 lines of flat text that felt impersonal ("nakent"). There was no room for deeper neighborhood descriptions without cluttering the initial view, and no sense of a real person presenting the information.

## Solution

### 1. Presenter Quote Card Design

Replaced flat text with a quote-card component (`ThemePresenterQuote.tsx`) that presents the bridge text as a personal message from the project's presenter (e.g., the real estate agent).

**Visual design:**
- Left border accent: `border-l-[3px] border-[#c8bfb3]`
- Warm off-white background: `bg-[#faf9f7]`
- Rounded right side: `rounded-r-xl`
- Profile photo (or MapPin fallback icon) with ring styling
- Name + title/company below the avatar

**Data model additions:**
- `ReportPresenter` interface in `lib/types.ts`: `name`, `title?`, `company?`, `imageUrl?`
- `presenter` field on `ReportConfig`
- `extendedBridgeText` field on `ReportThemeConfig`

### 2. "Fortell meg mer" Expandable Text

Progressive disclosure pattern: short bridge text always visible, extended text behind a button.

**Animation approach — CSS `grid-template-rows`:**
```css
/* Collapsed */
grid-template-rows: 0fr;
/* Expanded */
grid-template-rows: 1fr;
```

This is superior to `max-height` because:
- No need to guess content height
- Smooth animation regardless of content length
- Inner `overflow-hidden` div prevents layout shift

**Simulated loading:**
- 800ms `setTimeout` delay with `Loader2` spinner (animation: spin 0.35s)
- Creates feeling of "on-the-fly generation" even though content is pre-loaded
- Button disappears after expansion (not togglable — content is always worth showing)

### 3. Data Flow

```
products.config.reportConfig.presenter → transformToReportData() → ReportData.presenter
                                          ↓
products.config.reportConfig.themes[].extendedBridgeText → ReportTheme.extendedBridgeText
                                          ↓
ReportPage → ReportThemeSection → ThemePresenterQuote
```

- Presenter is project-level (same person for all themes)
- `extendedBridgeText` is per-theme (different deep-dive per topic)
- Only shown for primary themes (variant !== "secondary")

## Key Decisions

1. **Presenter at project level, not theme level** — real estate agents present all themes, not different people per topic
2. **No toggle/collapse** — once expanded, stays expanded. The content is always worth reading.
3. **Separator line** — `border-t border-[#eae6e1]` between bridge text and extended text for visual hierarchy
4. **Fallback to Placy branding** — if no presenter configured, shows "Placy" / "Lokalkjent guide" with MapPin icon

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Added `ReportPresenter`, `extendedBridgeText`, `presenter` to config types |
| `components/variants/report/report-data.ts` | Pass-through for new fields |
| `components/variants/report/report-themes.ts` | Added `extendedBridgeText` to `ReportThemeDefinition` |
| `components/variants/report/ThemePresenterQuote.tsx` | **New** — the quote card component |
| `components/variants/report/ReportThemeSection.tsx` | Replaced flat text with `ThemePresenterQuote` |
| `components/variants/report/ReportPage.tsx` | Pass `presenter` to primary theme sections |
| `supabase/migrations/045_broset_extended_bridge_text.sql` | Demo data for Brøset |
