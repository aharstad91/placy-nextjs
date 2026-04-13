---
title: "Whitelabel-strategi: Placy-shell + tokens (ikke full custom)"
category: architecture-patterns
tags: [whitelabel, demo-factory, theming, shell, branding, scalability]
module: rapport
created: 2026-04-13
related: [docs/plans/2026-04-13-feat-placy-report-shell-plan.md]
---

# Whitelabel-strategi: Placy-shell + tokens

**Gjelder:** Demo-produksjon, whitelabel-arbeid, hver gang en ny kunde-demo skal lages.

## Problem

Wesselsløkka-demoen ble først bygget som **full whitelabel** — gjenskape kundens nettside med egen CSS (442 linjer), custom header/footer-komponenter, egen wordmark/script-logo. Resultat: profesjonelt, men **hver demo = 4-8 timer branding-arbeid** + Placy-brand forsvinner.

Dette skalerer ikke når mange demoer skal produseres.

## Løsning: Placy eier shellet, kunden bidrar med tokens

### Prinsipp

**Placy har et standardisert shell** (`PlacyReportHeader` + `PlacyReportFooter`). Kunden bidrar med 3 ting:
1. `primaryColor` (hex) — farger shellets header + CTA-knapper
2. `homepageUrl` (URL) — tilbake-link i header + footer
3. `name` (prosjektnavn) — vises sentralt i header

Resten er Placy-kontrollert: layout, typografi, footer-struktur, lovpålagt info.

### Hvorfor dette er riktig

- **Placy-brand bevares** — demoene ser ut som Placy-produkter, ikke kundens nettside. Viktig for salg: "dette er Placy" er salgsverdi.
- **Skalerer til mange demoer** — neste demo tar ≤30 min branding (sette 3 felter i Supabase).
- **Ærlig signalering** — bruker vet at dette er et eksternt verktøy, ikke kundens egen side.
- **Unngår scope-creep** — "powered by Placy" inviterer "kan vi få vår farge på footer også?". Clear separation unngår dette.

## Implementering

Systemet er allerede bygget etter PR #64:

- `ProjectTheme` type (`lib/types.ts`) med semantiske felter
- `hexToHslChannels` + `pickContrastForeground` (`lib/theme-utils.ts`)
- `projects.homepage_url` kolonne (migration 061)
- `PlacyReportHeader` + `PlacyReportFooter` (`components/public/`)
- Inline CSS-variabler i rapport-wrapper (`app/eiendom/[customer]/[project]/rapport/page.tsx`)

### For ny kunde-demo

```sql
UPDATE projects
SET
  theme = COALESCE(theme, '{}'::jsonb) || '{"primaryColor": "#HEX"}'::jsonb,
  homepage_url = 'https://kunde.no/'
WHERE customer_id = '...' AND url_slug = '...';
```

Ferdig. Rapport-ruten henter automatisk, shellet renderer med kundens farge.

## Når bør vi avvike fra mønsteret?

**Nesten aldri.** Hvis kunden eksplisitt ber om full whitelabel og betaler for det (ikke demo): kan vurderes som unntak. Men for demo-pipeline: alltid standardisert shell.

## Avviste alternativer

- **Full whitelabel per kunde** (Wesselsløkka-pattern): skalerer ikke
- **"Powered by Placy"-modell med kundens logo dominant**: inviterer scope-creep
- **Ingen branding i det hele tatt**: gir generisk, ikke-salgbar demo

## Relatert

- `docs/plans/2026-04-13-feat-placy-report-shell-plan.md` — full plan med tech-audit
- Strategisk retning: demo-factory (sandbox) + prod-miljø bygges separat når produkt modnes
