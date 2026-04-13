---
title: "JSONB merge vs overwrite i seed-scripts — bevar eksisterende nøkler"
category: database-issues
tags: [jsonb, supabase, seed-scripts, data-loss, theme]
module: scripts
created: 2026-04-13
severity: high
---

# JSONB merge vs overwrite i seed-scripts

**Gjelder:** Alle seed-scripts eller migrations som oppdaterer JSONB-kolonner (`projects.theme`, `products.config`, etc.).

## Problem

**Naive UPDATE på JSONB-kolonne overskriver HELE objektet:**

```sql
-- ❌ FARLIG — destroyer alle eksisterende nøkler
UPDATE projects
SET theme = '{"primaryColor": "#204c4c"}'::jsonb
WHERE id = '...';
```

Hvis `theme` før UPDATE hadde `{backgroundColor, fontFamily, logoUrl, primaryColor}`, blir alt unntatt `primaryColor` borte.

**Konsekvens:** Taus data-tap. Scriptet rapporterer success, men andre workflows (bransjeprofil-seeding, admin-input, tidligere migrations) har bidrag som er slettet.

## Løsning: `||`-operator med COALESCE

```sql
-- ✅ RIKTIG — merger på top-level, bevarer eksisterende nøkler
UPDATE projects
SET theme = COALESCE(theme, '{}'::jsonb) || '{"primaryColor": "#204c4c"}'::jsonb
WHERE id = '...';
```

- `||` merger JSONB på top-level (høyre-side vinner ved konflikt — det er ønsket her)
- `COALESCE` håndterer NULL-theme (default til tom object, så `||` ikke feiler)
- Idempotent — re-kjøring gir samme resultat

## Via Supabase REST API

Supabase REST-API støtter ikke `||`-operator direkte. Løsning: **gjør merge i applikasjonskode**, send hele det merged objektet:

```typescript
// Hent eksisterende state
const { theme } = await fetch(`/rest/v1/projects?id=eq.${id}&select=theme`);

// Merge i kode
const mergedTheme = { ...(theme ?? {}), primaryColor: "#204c4c" };

// PATCH med merged objekt
await fetch(`/rest/v1/projects?id=eq.${id}`, {
  method: "PATCH",
  body: JSON.stringify({ theme: mergedTheme }),
});
```

**Kritisk:** Bruk optimistic concurrency lock (`updated_at`) for å unngå race hvis andre prosesser skriver samtidig.

## Sjekkliste for seed-scripts

- [ ] Hent eksisterende state før skriving
- [ ] Backup til `backups/`-mappen før skriving
- [ ] Bruk `COALESCE(col, '{}'::jsonb) || '{...}'::jsonb` eller spread i kode
- [ ] Optimistic concurrency lock (`WHERE updated_at = $expected`)
- [ ] Post-write verifisering: sjekk at eksisterende nøkler er bevart (ikke bare at nye er satt)
- [ ] Dry-run som default, `--apply` for faktisk skriving

## Eksempel-script som følger mønsteret

`scripts/seed-wesselslokka-shell.ts` — komplett eksempel med alle safeguards.
`scripts/seed-wesselslokka-summary.ts` — tidligere eksempel (samme mønster).

## Relatert

- `docs/solutions/database-issues/schema-mismatch-product-type-column-20260205.md`
- Tech-audit fant dette før skriving til prod — `data-integrity-guardian`-agent bør alltid kjøres på seed-scripts
