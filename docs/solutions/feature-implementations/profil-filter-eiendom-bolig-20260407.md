---
title: "Profil-filter — Livsfase-basert tema-filtrering for Eiendom-Bolig Explorer"
date: 2026-04-07
category: feature-implementations
tags: [profil-filter, livsfase, onboarding, explorer, eiendom, bolig, bottom-sheet, bransjeprofil]
module: explorer
symptoms: []
---

# Profil-filter — Livsfase-basert tema-filtrering for Eiendom-Bolig Explorer

## Problem

Eiendom-Bolig Explorer viser 200+ POI-er fordelt på 7 temaer. Det er overveldende for boligkjøpere som har ulike prioriteringer basert på livsfase. En barnefamilie bryr seg om skoler, ikke uteliv.

## Solution: Livsfase bottom sheet

En ett-stegs bottom sheet modal over Explorer-kartet (samme mønster som KompassOnboarding for Event). Brukeren velger livsfase → temaer pre-filtreres automatisk.

### Architecture

```
BoligProfilFilter (bottom sheet modal)
        ↓ onSelect callback
  ExplorerPage.tsx (computes disabledCategories)
        ↓ writes to
  disabledCategories (existing useState)
        ↓ flows through
  activeCategories → filteredPOIs → map + list
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/themes/profil-filter-mapping.ts` | Livsfase type, LIVSFASE_OPTIONS config, `getDisabledCategories()` — maps theme IDs to disabled category IDs |
| `components/variants/explorer/BoligProfilFilter.tsx` | Bottom sheet modal component — 4 livsfase cards, backdrop dismiss, selection feedback with 400ms delay |
| `lib/themes/bransjeprofiler.ts` | `profilFilter?: boolean` feature flag on BransjeprofilFeatures, set true on "Eiendom - Bolig" |
| `components/variants/explorer/ExplorerPage.tsx` | Integration — state, handlers, conditional render |

### Design Decisions

1. **No separate Zustand store** — Unlike Kompass (which has multi-step flow, tabs, complex state), profil-filter is one step with one callback. Simple `useState` in ExplorerPage is sufficient.

2. **Writes to existing `disabledCategories`** — No new filtering mechanism. Maps livsfase → theme IDs → category IDs → `disabledCategories` Set. Reuses the existing theme-chip toggling infrastructure.

3. **Feature flag `profilFilter` on bransjeprofil** — Same pattern as `kompass` for Event. Gated in ExplorerPage alongside `showKompass`. Mutually exclusive — a project is either Eiendom or Event, never both.

4. **Suppression rules** — Modal does not show when:
   - `features.profilFilter` is falsy
   - `isCollectionView` is true
   - `initialCategories` is set (deep link overrides)
   - User has already selected/skipped (profilFilterDismissed state)

5. **Parchment palette** — `bg-[#faf9f7]` matches WelcomeScreen, not `bg-white` like KompassOnboarding. Lighter backdrop (`bg-black/25` vs `/30`) so map markers remain visible.

6. **Auto-submit on select** — No "Neste"/"Bekreft" button. Clicking a livsfase card triggers selection feedback (border change, scale) then auto-dismisses after 400ms.

7. **Namespaced keyframes** — Uses `profil-filter-rise` animation name (inline `<style>`) to avoid collision with existing `slide-up` or other global keyframes. Lesson from institutional knowledge.

### Livsfase → Theme Mapping

| Livsfase | Enabled Themes (4/7) |
|----------|---------------------|
| family (Barnefamilie) | barn-oppvekst, hverdagsliv, natur-friluftsliv, transport |
| couple (Par uten barn) | mat-drikke, opplevelser, trening-aktivitet, hverdagsliv |
| single (Aktiv singel) | mat-drikke, trening-aktivitet, opplevelser, transport |
| senior (Pensjonist) | hverdagsliv, natur-friluftsliv, opplevelser, transport |

### Gotchas

- **setTimeout cleanup** — `handleSelect` uses a 400ms timeout for visual feedback before dismiss. Component cleans up via `useRef` + `useEffect` return to prevent firing after unmount.
- **All categories can be disabled** — After profil-filter sets initial themes, user can manually disable remaining active themes via theme-chips, reaching 0 POIs. Existing Explorer code handles this with "0 av X steder synlige" message.
- **`initialCategories` from deep links take precedence** — If URL has `?themes=...`, profil-filter is suppressed entirely. The deep link's intent is specific and should not be overridden by generic profil-filter.
