---
topic: Report Typography Upgrade
date: 2026-02-09
status: decided
approach: hierarchy-plus-spacing
---

# Report Typography Upgrade

## What We're Building

Moderat oppgradering av typografi-skalaen i Report-produktet, inspirert av Apple.com sin bruk av hierarki og whitespace. Fokus kun på editorial tekst (hero, seksjonstitler, sitater, brødtekst, stats) — POI-kort forblir kompakte.

## Why This Approach

Nåværende Report-typografi bruker for små tekststørrelser og for lite spacing, noe som gjør innholdet kompakt og kjedelig. Ved å kombinere moderate size-bumps med mer whitespace mellom seksjoner får vi en mer polert, magasinaktig opplevelse uten å miste den eksisterende layoutstrukturen.

### Inspirasjon fra Apple.com/imac:
- Store, fete overskrifter med tydelig hierarki
- Romslig brødtekst (17-21px) med god line-height
- Bold nøkkelord inline i brødtekst (allerede implementert i Report!)
- Generøs whitespace mellom seksjoner

## Key Decisions

### 1. Scope: Kun Report editorial tekst
- ReportHero (label, h1, intro, summary, theme nav-kort)
- ReportThemeSection (h2, quote, stats, intro, bridge)
- IKKE POI-kort (ReportPOIRow, ReportPOICard) — disse forblir kompakte

### 2. Tilnærming: Hierarki + spacing (C)
Kombinerer moderate size-bumps med mer whitespace:

#### Size-endringer:

| Element | Fil | Nå | Nytt |
|---------|-----|-----|------|
| Hero label | ReportHero.tsx:65 | `text-xs` | `text-sm` |
| Hero h1 | ReportHero.tsx:70 | `text-3xl sm:text-4xl md:text-5xl` | `text-4xl sm:text-5xl md:text-6xl` |
| Hero intro | ReportHero.tsx:76 | `text-lg md:text-xl` | `text-xl md:text-2xl` |
| Hero summary | ReportHero.tsx:82 | `text-lg md:text-xl` | `text-xl md:text-2xl` |
| Theme nav name | ReportHero.tsx:138 | `text-sm` | `text-base` |
| Theme nav stats | ReportHero.tsx:143 | `text-xs` | `text-sm` |
| Theme nav icon | ReportHero.tsx:134 | `w-6 h-6` | `w-7 h-7` |
| Section h2 | ReportThemeSection.tsx:91 | `text-xl md:text-2xl` | `text-2xl md:text-3xl` |
| Section icon | ReportThemeSection.tsx:90 | `w-5 h-5` | `w-6 h-6` |
| Section quote | ReportThemeSection.tsx:97 | `text-lg md:text-xl` | `text-xl md:text-2xl` |
| Section stats | ReportThemeSection.tsx:102 | `text-sm` | `text-base` |
| Section intro | ReportThemeSection.tsx:131 | `text-base` | `text-lg` |
| Section bridge | ReportThemeSection.tsx:138 | `text-base` | `text-lg` |

#### Spacing-endringer:

| Element | Fil | Nå | Nytt |
|---------|-----|-----|------|
| Hero top/bottom | ReportHero.tsx:56 | `pt-6 pb-12 md:pt-12 md:pb-16` | `pt-8 pb-14 md:pt-14 md:pb-20` |
| Hero label → h1 | ReportHero.tsx:65 | `mb-4` | `mb-5` |
| Hero h1 → intro | ReportHero.tsx:70 | `mb-6` | `mb-8` |
| Hero → theme nav | ReportHero.tsx:123 | `mt-10` | `mt-12` |
| Hero divider | ReportHero.tsx:162 | `mt-10` | `mt-14` |
| Section padding | ReportThemeSection.tsx:84 | `py-10 md:py-14` | `py-12 md:py-16` |
| Section h2 → quote | ReportThemeSection.tsx:89 | `mb-3` | `mb-4` |
| Section quote → stats | ReportThemeSection.tsx:97 | `mb-4` | `mb-5` |
| Section stats → intro | ReportThemeSection.tsx:102 | `mb-6` | `mb-8` |

### 3. Hva som IKKE endres
- POI-kort (ReportPOIRow, ReportPOICard) — forblir kompakte
- ProductNav header bar — nylig justert
- Fargepalett — beholdes som den er
- Font (Inter) — beholdes

## Open Questions

- Bør theme nav-kort også få litt mer padding (p-4 → p-5)?
- Skal vi vurdere å øke section icon størrelse fra w-5 til w-7 for å matche større h2?

## References

- Apple.com/no/imac — typografi-inspirasjon
- `components/variants/report/ReportHero.tsx` — Hero-komponent
- `components/variants/report/ReportThemeSection.tsx` — Seksjon-komponent
- `components/variants/report/ReportPOICard.tsx` — POI highlight-kort (uendret)
