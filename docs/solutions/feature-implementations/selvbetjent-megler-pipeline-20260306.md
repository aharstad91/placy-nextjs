---
title: "Selvbetjent megler-pipeline — adresse til Explorer"
category: feature-implementations
tags: [selvbetjent, megler, pipeline, generation-requests, kart, explorer, supabase, zod, slugify]
module: Generer + Kart
symptom: "Meglere trenger en selvbetjent måte å generere nabolagskart for boliger de skal selge"
root_cause: "Ingen selvbetjeningsflate — alt var manuelt via admin"
---

# Selvbetjent megler-pipeline

## Problem

Eiendomsmeglere (målgruppe: private eiendommer, ikke boligprosjekter) trengte en selvbetjent flyt for å bestille nabolagskart. Tidligere krevde det manuell oppretting via admin.

## Løsning

To-trinns flyt: `/generer` (bestillingsskjema) → `/kart/{slug}` (statusside → Explorer).

### Arkitektur

```
[Megler] → /generer (landing page)
         → POST /api/generation-requests (Zod-validert)
         → generation_requests tabell (Supabase)
         → /kart/{slug} (status-avhengig visning)
              pending  → venteside med statisk Mapbox-kart
              failed   → feilside med "prøv igjen"-lenke
              completed → KartExplorer (forenklet Explorer-fork)
```

### Nøkkelbeslutninger

**1. KartExplorer som fork av ExplorerPage (~444 vs ~712 linjer)**
- Fjernet: collection store, CollectionDrawer, flash-animasjon, GeoWidget
- Erstattet med: `useKartBookmarks` (Zustand + localStorage)
- Lagt til: `showBookmarkHeartOnly` prop på ExplorerPOICard for hjerte-ikon i stedet for "Lagre/Lagret"-knapp
- Begrunnelse: Kart-brukere har ikke collection-ID, trenger enklere lokal lagring

**2. Slug-generering og kollisjonshåndtering**
- Slugify med norske tegn: æ→ae, ø→oe, å→aa FØR NFD-normalisering (`lib/utils/slugify.ts`)
- Kollisjonssuffix: `crypto.randomUUID().slice(0, 6)` (ikke Math.random)
- Duplikatdeteksjon: normalisert adresse (NFC, lowercase, whitespace-collapse) innen 7 dager

**3. NFC vs NFD for adresse-normalisering**
- NFD + strip diacritics fjerner æ/ø/å → gjør norske adresser ugjenkjennelige
- NFC bevarer diakritiske tegn men normaliserer Unicode-representasjon
- Viktig lærdom for alle prosjekter med norsk tekst

**4. ON DELETE SET NULL (ikke CASCADE)**
- Hvis prosjektet slettes, beholdes forespørselen med `project_id = NULL`
- Bevarer historikk og e-postadresser for support

**5. Service role key som eksplisitt sjekk**
- `createServerClient()` bruker service role key hvis tilgjengelig, ellers anon key
- API-ruten sjekker `process.env.SUPABASE_SERVICE_ROLE_KEY` eksplisitt før Supabase-kall
- Gir tydelig 500-feilmelding i stedet for stille RLS-feil

### Sikkerhetsherdinger

| Risiko | Tiltak |
|--------|--------|
| Uautentisert retry-endpoint | `ADMIN_ENABLED` environment guard + UUID regex |
| CASCADE delete mister data | ON DELETE SET NULL |
| Svak slug-random | `crypto.randomUUID()` |
| NFD fjerner norske tegn | NFC normalisering |
| `<img>` for statisk kart | `next/image` med `unoptimized` |
| RLS leser e-post (PII) | Notert for fremtidig innstramming |

### Filer

| Fil | Rolle |
|-----|-------|
| `app/(public)/generer/page.tsx` + `generer-client.tsx` | Landing page med skjema |
| `components/inputs/AddressAutocomplete.tsx` | Gjenbrukbar adresse-autocomplete |
| `app/api/generation-requests/route.ts` | POST med Zod-validering |
| `app/kart/[slug]/page.tsx` | Status-avhengig server component |
| `components/variants/kart/KartExplorer.tsx` | Forenklet Explorer |
| `lib/kart-bookmarks-store.ts` | Zustand + localStorage bokmerker |
| `app/admin/requests/` | Admin-dashboard for forespørsler |
| `supabase/migrations/046_generation_requests.sql` | Tabell + RLS |
| `supabase/migrations/047_generation_requests_fixes.sql` | SET NULL, trigger, index |

### Pipeline slash-command

`.claude/commands/generate-adresse.md` — 12-stegs pipeline for Claude Code:
1. Cleanup stale processing (30 min)
2. Atomic polling (FOR UPDATE SKIP LOCKED)
3. Verify geocoding
4. Determine housing type
5. Create project + Explorer product
6. Google Places discovery
7. Schools (NSR/Udir), barnehager (Barnehagefakta), sports (Overpass/OSM)
8. Update status → completed/failed

## Lærdom

- **Fork > abstraksjon** når to varianter deler 80% kode men har fundamentalt ulik state-håndtering (collection vs localStorage)
- **Eksplisitt service role sjekk** er bedre enn å stole på at `createServerClient` velger riktig nøkkel
- **NFC for norsk tekst** — NFD + strip diacritics er farlig for skandinaviske språk
- **ON DELETE SET NULL** som default for audit-trail-tabeller
