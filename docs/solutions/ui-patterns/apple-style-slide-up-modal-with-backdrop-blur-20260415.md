---
module: UI Components
date: 2026-04-15
problem_type: ui_pattern
component: frontend_stimulus
symptoms:
  - "Modal looks static — appears/disappears without transition"
  - "Backdrop blur doesn't show any blurring effect despite using `supports-backdrop-filter:backdrop-blur-sm`"
  - "Modal feels like a plain dialog, not a polished sheet-style experience"
root_cause: design_implementation
resolution_type: design_pattern
severity: medium
tags: [modal, animation, backdrop-blur, apple-hig, radix-dialog, shadcn, tailwind-supports, css-keyframes, prefers-reduced-motion]
---

# Apple-style Slide-up Modal with Backdrop Blur

## Problem

Placy's map-modal (fra rapport-sider) brukte default shadcn Dialog — sentrert, ingen animasjon, svak backdrop-blur. Vi ville matche Apple's modal-UX fra apple.com/no/macbook-pro (for eksempel "Utforsk M5-chipene"-modalen): glir opp fra bunn, kraftig backdrop-blur, rounded corners, identisk på mobil og desktop.

## Environment
- Next.js 14, TypeScript, Tailwind CSS
- shadcn/ui Dialog (Radix UI primitives)
- Affected files: `components/ui/dialog.tsx`, `components/variants/report/ReportThemeSection.tsx`, `app/globals.css`
- Date: 2026-04-15

## Bonusfunn under implementasjon

Eksisterende `supports-backdrop-filter:backdrop-blur-sm` i `DialogOverlay` hadde ALDRI fungert i produksjon. Tailwind genererte `@supports (backdrop-filter: var(--tw))` som ikke er en gyldig feature query. Ingen backdrop-blur ble noensinne rendret. Dette var invisibly brukket i månedsvis.

## Solution

### Tre koordinerte endringer

**1. Legg til Apple-style keyframes i `app/globals.css`** — med UNIKE navn:

```css
@keyframes map-modal-slide-up {
  from { transform: translateY(100%); opacity: 0.6; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes map-modal-slide-down {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(100%); opacity: 0.6; }
}

.animate-map-modal-in {
  animation: map-modal-slide-up 400ms cubic-bezier(0.32, 0.72, 0, 1) both;
}

.animate-map-modal-out {
  animation: map-modal-slide-down 300ms cubic-bezier(0.32, 0.72, 0, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .animate-map-modal-in,
  .animate-map-modal-out {
    animation: none;
  }
}
```

**2. Fix backdrop-blur i `DialogOverlay` (`components/ui/dialog.tsx`)** — korrekt `@supports`-syntaks:

```tsx
// Før (no-op — backdrop-blur rendret aldri)
"... bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm ..."

// Etter (fungerer korrekt)
"... bg-black/40 supports-[backdrop-filter:blur(1px)]:backdrop-blur-xl supports-[backdrop-filter:blur(1px)]:bg-black/30 data-[state=open]:duration-300 data-[state=closed]:duration-200 ..."
```

**3. Overstyr `DialogContent`-klasser i `ReportThemeSection.tsx`**:

```tsx
<DialogContent
  showCloseButton={false}
  className="flex flex-col !max-w-none p-0 overflow-hidden gap-0 bg-white
    fixed inset-x-0 bottom-0 top-[8vh]
    md:inset-x-[4vw] md:top-[5vh] md:bottom-0
    rounded-2xl
    data-[state=open]:animate-map-modal-in
    data-[state=closed]:animate-map-modal-out"
>
```

## Why This Works

1. **Apple's easing-kurve `cubic-bezier(0.32, 0.72, 0, 1)`** gir en spring-like kurve med rask start og myk, forsinket landing. Dette er Apple's signatur og dokumentert i deres Human Interface Guidelines.

2. **GPU-akselerasjon for 60fps på mobil:** Vi animerer KUN `transform: translateY()` og `opacity` — begge er compositor-only properties. Ingen layout, ingen paint. `backdrop-filter: blur()` er dyrt, men animeres IKKE — kun opacity på overlay.

3. **Radix state-binding:** `data-[state=open|closed]` selectors på DialogContent lar oss animere åpne- og lukke-tilstander separat. Radix venter på `animationend` før unmount, så close-animasjonen spilles av fullt.

4. **Korrekt `@supports`-syntaks:** `supports-[backdrop-filter:blur(1px)]` genererer `@supports (backdrop-filter: blur(1px))` — bredt støttet form. `supports-[backdrop-filter]` (uten verdi) genererer ugyldig `var(--tw)`-query som ikke matcher noen nettlesere.

5. **Unike keyframe-navn (`map-modal-slide-up`, ikke `slide-up`):** CSS kaskaden sier at siste `@keyframes` med samme navn vinner. Vi har allerede `@keyframes slide-up` for CollectionDrawer. Duplikat-navn hadde silently overridet animasjonen vår.

## Prevention

- **Bruk ALLTID unike, namespaced animasjonsnavn.** `component-purpose-action` (`map-modal-slide-up`, `tooltip-fade-in`) — ikke generiske navn. Grep `@keyframes` i globals.css før nye tillegg.
- **`supports-[X]` i Tailwind trenger full feature query:** `supports-[backdrop-filter:blur(1px)]`, ikke `supports-[backdrop-filter]`. Test alltid at generert CSS har riktig `@supports`-rule (inspect computed styles eller se build output).
- **Kun transform + opacity i animasjoner.** Andre properties (width, height, left, top, filter) trigger layout/paint og gir frame-drops.
- **Respekter `prefers-reduced-motion`** — alltid. En `@media` query som setter `animation: none` er alt som trengs.

## Related Issues

- `docs/solutions/ui-bugs/modal-backdrop-half-viewport-css-animation-collision-20260215.md` — samme prior art om duplikate keyframe-navn som override hverandre
- `docs/plans/2026-02-15-refactor-collection-modal-plan.md` — tidligere modal-refactor som introduserte `modal-in`/`modal-backdrop-in`-mønsteret i `Modal.tsx`
