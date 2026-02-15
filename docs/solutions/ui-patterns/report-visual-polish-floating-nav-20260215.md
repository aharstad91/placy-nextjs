---
module: Report
date: 2026-02-15
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "Report hero section flat white background with plain text label"
  - "No visual indication of scroll position in long report"
  - "Abrupt transitions between theme sections"
  - "Map lacks context about which theme is currently active"
  - "No visual separation between sub-sections within a theme"
root_cause: incomplete_setup
resolution_type: code_fix
severity: medium
tags: [report, visual-polish, floating-nav, scroll-reveal, intersection-observer, progress-bar, map-overlay, scorecard]
---

# Feature: Report Page Visual Polish + Navigation

## Problem
The Report page (`/for/[customer]/[project]/report`) was functionally complete with 50/50 split, sticky map, theme sections, and map-list sync — but lacked visual polish and scroll wayfinding. The hero was flat, there was no indication of position in a long report, and transitions between sections were abrupt.

## Environment
- Module: Report (components/variants/report/)
- Stack: Next.js 14, TypeScript, Tailwind CSS
- Affected Components: ReportHero, ReportPage, ReportThemeSection, ReportStickyMap
- Date: 2026-02-15

## Symptoms
- Hero section had plain white background and basic text label — no premium feel
- Scrolling through 5+ theme sections gave no positional awareness
- Sections appeared instantly with no visual transition
- Sticky map showed markers but no label identifying the active theme
- Sub-sections (Restaurant/Bar/Kafé) ran together without visual separation

## Solution

### A1: Hero Premium Treatment (`ReportHero.tsx`)

**Warm gradient background** extending full-width:
```tsx
// Negative margin + padding pattern (already used in ExplorerCTA/footer)
<section className="-mx-16 px-16 bg-gradient-to-b from-[#faf9f7] via-[#faf9f7] to-white">
```

**Elevated label** with horizontal accent line:
```tsx
<p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.25em] text-[#a0937d]">
  <span className="w-8 h-px bg-[#a0937d]" />
  {label}
</p>
```

**Scorecard stripe** — 4-cell metric bar between intro text and theme cards:
```tsx
<div className="bg-white border border-[#eae6e1] rounded-xl p-5 flex items-center divide-x divide-[#eae6e1]">
  <div className="flex-1 text-center px-4">
    <p className="text-2xl md:text-3xl font-semibold">{metrics.totalPOIs}</p>
    <p className="text-xs text-[#6a6a6a] uppercase tracking-wider">Steder</p>
  </div>
  {/* Rating, Reviews, Transport cells... */}
</div>
```

**Theme card hover lift:**
```tsx
className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
```

### A2: Section Fade-in Animations (`globals.css` + `ReportPage.tsx`)

**CSS keyframe** with `prefers-reduced-motion` respect:
```css
@keyframes report-section-reveal {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
.report-section-reveal { opacity: 0; transform: translateY(16px); }
.report-section-reveal.revealed {
  animation: report-section-reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .report-section-reveal { opacity: 1; transform: none; }
}
```

**IntersectionObserver** via callback ref — one-shot, unobserves after reveal:
```tsx
const revealRef = useCallback((el: HTMLElement | null) => {
  if (!el) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add("revealed");
        observer.unobserve(el);
      }
    },
    { threshold: 0.05, rootMargin: "0px 0px -60px 0px" }
  );
  observer.observe(el);
}, []);
```

### B1+B2: Floating Theme Navigation (`ReportFloatingNav.tsx` — NEW)

**Sentinel-based visibility** — `<div ref={sentinelRef}>` placed after hero, IntersectionObserver triggers nav when hero cards scroll out:
```tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setVisible(!entry.isIntersecting),
    { rootMargin: "-56px 0px 0px 0px" } // ProductNav height
  );
  observer.observe(sentinelRef.current);
  return () => observer.disconnect();
}, []);
```

**Theme pills** with active state: `bg-[#1a1a1a] text-white` for active, click scrolls to section.

**RAF-throttled progress bar** per active section:
```tsx
const scrolledPast = -rect.top + 112; // ProductNav + FloatingNav
const pct = Math.min(1, Math.max(0, scrolledPast / sectionHeight));
```

**scroll-mt adjustment** — increased from `scroll-mt-20` to `scroll-mt-[7rem]` to accommodate both ProductNav (56px) and floating nav (~48px).

### B3: Map Context Label (`ReportStickyMap.tsx`)

**Theme label overlay** — top-left pill with icon + name, uses `key={activeSectionKey}` for re-mount animation:
```tsx
<div key={activeSectionKey}
  className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm border animate-fade-in">
  <Icon className="w-3.5 h-3.5 text-[#7a7062]" />
  <span className="text-sm font-medium">{contextLabel}</span>
</div>
```

Shows sub-section when active: "Mat & Drikke / Restauranter".

### A3: Sub-section Dividers (`ReportThemeSection.tsx`)

**Center-dot divider** between sub-sections:
```tsx
{i > 0 && (
  <div className="relative my-6">
    <div className="h-px bg-[#eae6e1]" />
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#d4cfc8]" />
  </div>
)}
```

## Why This Works

1. **Gradient hero** creates a warm, premium first impression without heavy design — the `from-[#faf9f7]` matches existing Placy warm palette
2. **Scorecard** gives instant quantitative overview before diving into themes
3. **Scroll-reveal** adds perceived quality with minimal performance cost (one-shot observers, GPU-composited transforms)
4. **Floating nav** solves the "where am I?" problem in long reports — sentinel pattern avoids measuring scroll position for visibility
5. **Progress bar** gives micro-feedback on reading position within a section
6. **Map label** anchors spatial context — critical when map markers change but the user isn't looking at the section headers
7. **Sub-section dividers** create visual breathing room in dense content

## Prevention

Key patterns to reuse for similar long-form scrollable pages:

- **Sentinel + IntersectionObserver** for showing/hiding sticky elements — more reliable than scroll position thresholds
- **Callback ref pattern** for one-shot reveal animations — cleaner than useEffect + querySelectorAll
- **`scroll-mt-[Xrem]`** must account for ALL stacked fixed/sticky elements (ProductNav + floating nav + buffer)
- **RAF-throttled scroll handlers** for continuous calculations (progress bars) — prevents layout thrashing
- **`key={...}` re-mount trick** for triggering CSS animations on prop changes
- **`prefers-reduced-motion`** — always respect for animations

## Related Issues

No related issues documented yet.

## Files Changed

| File | Change |
|------|--------|
| `components/variants/report/ReportHero.tsx` | Gradient, label accent, scorecard, hover lift |
| `components/variants/report/ReportPage.tsx` | Reveal observer, FloatingNav integration |
| `components/variants/report/ReportFloatingNav.tsx` | **NEW** — Floating nav + progress bar |
| `components/variants/report/ReportThemeSection.tsx` | scroll-mt increased, sub-section dividers |
| `components/variants/report/ReportStickyMap.tsx` | Theme context label overlay |
| `app/globals.css` | report-section-reveal keyframe |
