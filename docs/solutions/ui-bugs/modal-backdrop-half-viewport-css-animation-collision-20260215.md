---
module: UI Components
date: 2026-02-15
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Modal backdrop only covers left half of viewport (map area), not the Explorer sidebar"
  - "getBoundingClientRect().left returns -732 (half viewport width) for a fixed inset-0 element"
  - "elementFromPoint returns sidebar elements at x>700 instead of backdrop at z-100"
root_cause: config_error
resolution_type: code_fix
severity: high
tags: [css-animation, keyframes, duplicate-names, modal, backdrop, fixed-positioning, transform, translate]
---

# Troubleshooting: Modal Backdrop Only Covers Half the Viewport Due to CSS Animation Name Collision

## Problem
A newly created generic `Modal` component's backdrop only covered the left half of the viewport. The right side (Explorer sidebar) was fully visible and interactive, despite the backdrop having `position: fixed; inset: 0` and `z-index: 100`.

## Environment
- Module: UI Components (Modal)
- Stack: Next.js 14, TypeScript, Tailwind CSS
- Affected Component: `components/ui/Modal.tsx` + `app/globals.css`
- Date: 2026-02-15

## Symptoms
- Modal backdrop visually covers only the map area (left ~60%), not the sidebar (right ~40%)
- `getBoundingClientRect().left` returns `-732` on a 1464px viewport — exactly half the width
- `elementFromPoint` at x=900+ returns sidebar elements instead of backdrop
- Computed CSS shows correct values (`left: 0px`, `width: 1464px`) but visual rendering is shifted
- `transform: matrix(1, 0, 0, 1, -732, 0)` found on the backdrop element

## What Didn't Work

**Attempted Solution 1:** Changed z-index from z-50 to z-[100]
- **Why it failed:** The issue was not z-index stacking — the backdrop physically wasn't covering that area

**Attempted Solution 2:** Changed backdrop from `absolute inset-0` to `fixed inset-0`
- **Why it failed:** Same result — `getBoundingClientRect` still showed left: -732

**Attempted Solution 3:** Added explicit inline styles `style={{ top: 0, left: 0, right: 0, bottom: 0 }}`
- **Why it failed:** The CSS animation was applying a transform AFTER the inline styles resolved

**Attempted Solution 4:** Separated backdrop and centering container as sibling elements in a Fragment (createPortal)
- **Why it failed:** Same result — the animation transform was still being applied to the backdrop

**Attempted Solution 5:** Checked for parent transforms, stacking contexts, html/body transforms
- **Why it failed:** No transforms found on any ancestors — the transform was coming from the animation itself

## Solution

The root cause was a **duplicate `@keyframes fade-in`** definition in `globals.css`. The second definition (for hover tooltips) included `transform: translate(-50%, 0)`, which overrode the first clean definition used by the modal backdrop.

**Code changes:**

```css
/* Before (broken) — globals.css had TWO @keyframes fade-in definitions: */

/* Line 102: Modal version (correct) */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

/* Line 143: Tooltip version (OVERRIDES the above!) */
@keyframes fade-in {
  from { opacity: 0; transform: translate(-50%, 4px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.animate-fade-in {
  animation: fade-in 0.15s ease-out both;
}

/* After (fixed) — renamed modal animation to unique name: */

@keyframes modal-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-modal-backdrop-in {
  animation: modal-backdrop-in 0.2s ease-out;
}

/* Tooltip animation remains unchanged as fade-in */
```

```tsx
// Modal.tsx — use the new unique class name
<div
  className="fixed inset-0 z-[100] bg-black/40 animate-modal-backdrop-in"
  onClick={closeOnBackdrop ? onClose : undefined}
/>
```

## Why This Works

1. **ROOT CAUSE:** In CSS, when two `@keyframes` rules share the same name, the last one wins (CSS cascade). The tooltip's `fade-in` defined `transform: translate(-50%, 0)` in its `to` state, which was applied to every element using `animate-fade-in` — including the modal backdrop.

2. **The translate(-50%) on a 1464px-wide element** shifts it left by 732px, which is exactly `1464 * 0.5 = 732` — matching the `-732` offset observed in `getBoundingClientRect()`.

3. **Why debugging was hard:** The computed CSS (`left: 0px`, `inset: 0px`) showed correct values because the transform is applied AFTER layout. Tools like `getComputedStyle` don't show the animation's running transform in the `left`/`inset` properties — it only shows up in `transform` or `getBoundingClientRect`.

4. **Why `animation-fill-mode: both`** made it worse: The tooltip version used `both` fill mode, meaning the final transform persisted after animation completion, making the shift permanent.

## Prevention

- **Use unique, namespaced animation names per component** — never generic names like `fade-in`, `slide-up`. Prefer `modal-backdrop-in`, `tooltip-fade-in`, `marker-pulse` etc.
- **Search for existing `@keyframes` before adding new ones:** `grep -n "@keyframes" app/globals.css` — duplicate names will silently override
- **Check `getBoundingClientRect` vs computed styles** when debugging position issues — if they disagree, suspect a CSS transform (often from animations)
- **Inspect the `transform` computed property directly** — `getComputedStyle(el).transform` will reveal animation-applied transforms that `left`/`top` won't show
- **Consider consolidating all animation keyframes** in one section of globals.css with a naming convention to prevent collisions

## Related Issues

No related issues documented yet.
