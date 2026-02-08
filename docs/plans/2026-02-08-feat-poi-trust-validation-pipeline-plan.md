---
title: "feat: POI trust validation pipeline"
type: feat
date: 2026-02-08
brainstorm: docs/brainstorms/2026-02-08-poi-trust-validation-pipeline-brainstorm.md
---

# feat: POI Trust Validation Pipeline

## Oversikt

Tre-lags tillitsvalidering av Google Places-POIs som gir hver POI en `trust_score` (0.0–1.0). Explorer viser kun POIs med `trust_score >= 0.5`. Validering kjøres av Claude Code som del av import-workflow — ingen Anthropic API-nøkkel, bruker Max-abonnement.

**Problemeksempel:** "Château de Sorgenfri" — 5.0 rating, 52 reviews, "Open 24 hours" — ser legitimt ut fra Google-data, men er et studentprosjekt. Nåværende filtre (type, rating, avstand) fanger ikke dette.

## Motivasjon

- Fake/lavkvalitets POIs fra Google Places skader Placy som innsiktskilde
- Nåværende filtre er kun positive (rating, type, avstand) — ingen negative legitimitetssignaler
- Spesielt kritisk i nye byer der teamet mangler lokal kunnskap
- Eksisterende import henter ikke `website`, `business_status` etc. som gir viktige tillitssignaler

## Løsning

### 1. Database — ny migrasjon (`supabase/migrations/014_add_poi_trust_score.sql`)

```sql
-- Trust validation fields
ALTER TABLE pois ADD COLUMN trust_score NUMERIC CHECK (trust_score >= 0.0 AND trust_score <= 1.0);
ALTER TABLE pois ADD COLUMN trust_flags TEXT[] DEFAULT '{}';
ALTER TABLE pois ADD COLUMN trust_score_updated_at TIMESTAMPTZ;

-- Google enrichment fields (Layer 1 data) — with CHECK constraints
ALTER TABLE pois ADD COLUMN google_website TEXT;
ALTER TABLE pois ADD COLUMN google_business_status TEXT
  CHECK (google_business_status IN ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'));
ALTER TABLE pois ADD COLUMN google_price_level INTEGER
  CHECK (google_price_level >= 0 AND google_price_level <= 4);

-- Index for Explorer filtering
CREATE INDEX idx_pois_trust_score ON pois(trust_score) WHERE trust_score IS NOT NULL;

-- Index for Claude Code workflow: find unvalidated POIs efficiently
CREATE INDEX idx_pois_trust_unvalidated ON pois(created_at) WHERE trust_score IS NULL;

-- Backfill: ensure existing rows have empty array (not NULL)
UPDATE pois SET trust_flags = '{}' WHERE trust_flags IS NULL;
```

**Bakoverkompatibilitet:** `trust_score = NULL` → vises i Explorer (eksisterende POIs fortsetter å fungere).

### 2. TypeScript-typer

#### `lib/types.ts` — POI interface

```typescript
// Legg til i POI interface:
trustScore?: number;
trustFlags?: string[];
trustScoreUpdatedAt?: string;
googleWebsite?: string;
googleBusinessStatus?: string;
googlePriceLevel?: number;
```

#### `lib/supabase/mutations.ts` — POIImportData

```typescript
// Legg til i POIImportData:
trust_score?: number | null;
trust_flags?: string[] | null;
trust_score_updated_at?: string | null;
google_website?: string | null;
google_business_status?: string | null;
google_price_level?: number | null;
```

#### `lib/supabase/queries.ts` — transformPOI()

Mapper nye DB-kolonner til POI-typen.

### 3. Layer 1+2: TypeScript-valideringsfunksjoner (`lib/utils/poi-trust.ts`)

**NY FIL** med deterministisk heuristisk scoring:

```typescript
export interface TrustSignals {
  // Layer 1: Google data
  hasWebsite: boolean;
  businessStatus: string | null;     // "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY"
  hasPriceLevel: boolean;
  googleRating: number | null;
  googleReviewCount: number | null;

  // Layer 2: Website verification
  websiteResponds: boolean | null;    // null = not checked
  isSuspiciousDomain: boolean;        // .ntnu.no, .uio.no, etc.
}

export interface TrustResult {
  score: number;                      // 0.0-1.0
  flags: string[];                    // e.g. ["no_website", "perfect_5_low_reviews"]
  needsClaudeReview: boolean;         // true if score is uncertain (0.3-0.7 range)
}

export function calculateHeuristicTrust(signals: TrustSignals): TrustResult;
```

**Heuristikk-regler:**

| Signal | Effekt | Vekt |
|--------|--------|------|
| `business_status = "CLOSED_PERMANENTLY"` | `score = 0`, flag `permanently_closed` | Hard fail |
| Ingen nettside + perfekt 5.0 + < 100 reviews | `score -= 0.3`, flag `suspect_no_website_perfect_rating` | Sterk negativ |
| Ingen nettside | `score -= 0.15`, flag `no_website` | Negativ |
| Nettside responderer (200) | `score += 0.1`, flag `website_ok` | Positiv |
| Mistenkelig domene (.ntnu.no, .uio.no) | `score -= 0.3`, flag `suspicious_domain` | Sterk negativ |
| "Open 24 hours" for mat/kafé | `score -= 0.1`, flag `suspicious_hours` | Svak negativ |
| `price_level` satt | `score += 0.05`, flag `has_price_level` | Svak positiv |
| `business_status = "OPERATIONAL"` | `score += 0.05` | Svak positiv |
| `google_review_count >= 50` | `score += 0.1` | Positiv |
| `google_review_count >= 200` | `score += 0.1` (ekstra) | Positiv |

**Basescore:** `0.6` (en Google-POI er "sannsynligvis ekte" som default).

**Score 0.3–0.7 etter Layer 1+2 → `needsClaudeReview = true`** — Claude Code gjør Layer 3 for disse.

#### Mistenkelige domener:

```typescript
const SUSPICIOUS_DOMAINS = [
  ".ntnu.no", ".uio.no", ".uit.no", ".nmbu.no", ".uib.no",  // Norske universiteter
  ".edu", ".ac.uk",                                            // Internasjonale universiteter
  "blogspot.com", "wordpress.com",                             // Blogg-plattformer (svakere signal)
];
```

#### SSRF-beskyttelse:

```typescript
export function validateExternalUrl(rawUrl: string): { safe: boolean; reason?: string };
```

**Regler:**
- Kun `http://` og `https://` protokoll tillatt
- Blokkér private IP-ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, fc00::/7)
- Krev FQDN (ingen bare IP-adresser)
- Maks 1 redirect (sjekk redirect-URL med samme regler)

#### Website-sjekk:

```typescript
export async function checkWebsite(url: string): Promise<{
  responds: boolean;
  isSuspicious: boolean;
  statusCode: number | null;
}>;
```

**SSRF:** Kaller `validateExternalUrl()` før HTTP-forespørsel. Ugyldig URL → `responds: false`, flag `invalid_website_url`.

HTTP HEAD med **3s timeout**. Håndtering:
- 2xx → `responds: true`
- 3xx → følg maks 1 redirect, sjekk endelig URL med `validateExternalUrl()`
- 4xx/5xx → `responds: false`
- Timeout/nettverksfeil → `responds: false`, nøytral (ikke negativ)

#### Concurrent batch-prosessering:

Layer 1+2 validering kjøres **concurrent** med maks 10 samtidige POIs:

```typescript
export async function batchValidateTrust(
  pois: POI[],
  concurrency?: number  // default: 10
): Promise<Map<string, TrustResult>>;
```

Reduserer worst-case fra ~1060s (sekvensiell) til ~62s for 500 POIs.

### 4. Layer 3: Claude Code valideringsworkflow

Claude Code validerer POIs med `needsClaudeReview = true` (og optionally alle). **Ikke TypeScript-kode** — dette er en skill/workflow-instruksjon.

**Steg per POI:**
1. Søk etter `"{navn} {by}"` på nett
2. Sjekk om stedet finnes på TripAdvisor, Yelp, Facebook
3. Vurder: ser dette ut som et ekte, operativt sted?
4. Sett endelig `trust_score` (0.0–1.0)
5. Legg til relevante `trust_flags` (f.eks. `found_on_tripadvisor`, `not_found_online`)

**Utfall fra Claude Code:**
- Funnet på TripAdvisor/Yelp → `trust_score = 0.9+`
- Funnet på flere kilder → `trust_score = 0.85+`
- Funnet kun på Google → `trust_score = 0.5-0.7` (avhengig av andre signaler)
- Ikke funnet noe sted → `trust_score = 0.1-0.3`

**Claude Code oppdaterer DB:**
```sql
UPDATE pois SET trust_score = ?, trust_flags = ?, trust_score_updated_at = NOW()
WHERE id = ?;
```

### 5. Import-pipeline endringer

#### `app/api/admin/import/route.ts`

**Endring 1:** Sett `trust_score = 1.0` for Entur/Bysykkel POIs ved import (offentlig infrastruktur, alltid trusted).

```typescript
// I convertToPOIImportData():
trust_score: poi.source === "entur" || poi.source === "bysykkel" ? 1.0 : null,
```

**Endring 2:** Google POIs importeres med `trust_score = null` (uvalidert).

#### `lib/supabase/mutations.ts`

**Endring:** Bevar ALLE 6 trust/enrichment-felter under re-import (samme mønster som editorial fields).

```typescript
// Legg til i PRESERVED_FIELDS:
const TRUST_FIELDS = [
  "trust_score", "trust_flags", "trust_score_updated_at",
  "google_website", "google_business_status", "google_price_level"
];
```

**KRITISK:** Alle 6 felter må legges til i BÅDE SELECT-spørringen (hente eksisterende) OG merge-logikken (bevare eksisterende verdi). Følger eksakt samme mønster som editorial fields i `upsertPOIsWithEditorialPreservation()`.

Re-import overskriver IKKE eksisterende trust_score. Kun Claude Code kan oppdatere den.

**Ny funksjon:** `updatePOITrustScore()` — typed mutation for Claude Code Layer 3:

```typescript
export async function updatePOITrustScore(
  poiId: string,
  trustScore: number,
  trustFlags: string[]
): Promise<void>;
```

### 6. Explorer-filtrering

#### `lib/themes/apply-explorer-caps.ts`

Ny pre-filter som første steg i `applyExplorerCaps()`:

```typescript
// Step 0: Trust filter (before blacklist, scoring, capping)
const trustedPOIs = allPOIs.filter(poi => {
  if (poi.trustScore === undefined || poi.trustScore === null) return true;  // Bakoverkompatibel
  return poi.trustScore >= 0.5;
});
```

**Kun Explorer** — Report og Guide påvirkes ikke (de bruker `getProjectPOIs()` direkte).

### 7. Manuell override

Admin kan godkjenne en flagget POI via Supabase direkte (eller fremtidig admin-UI):

```sql
UPDATE pois SET
  trust_score = 1.0,
  trust_flags = array_append(trust_flags, 'manual_override'),
  trust_score_updated_at = NOW()
WHERE id = 'google-xxxxx';
```

**`manual_override` i trust_flags** → Claude Code hopper over denne ved re-validering.

## Filer som endres

| Fil | Endring |
|-----|---------|
| `supabase/migrations/014_add_poi_trust_score.sql` | **NY** — trust_score, trust_flags, google enrichment columns |
| `lib/utils/poi-trust.ts` | **NY** — Layer 1+2 heuristikker, SSRF-beskyttelse, website-sjekk, batch-validering |
| `lib/types.ts` | Legg til trustScore, trustFlags, google* felter i POI |
| `lib/supabase/types.ts` | Regenerer etter migrasjon |
| `lib/supabase/mutations.ts` | POIImportData + trust field preservation + `updatePOITrustScore()` |
| `lib/supabase/queries.ts` | transformPOI() mapper nye felter |
| `app/api/admin/import/route.ts` | trust_score=1.0 for transport, null for Google |
| `lib/themes/apply-explorer-caps.ts` | Trust pre-filter i applyExplorerCaps() |

**Utenfor scope (fremtidige iterasjoner):**
- Admin-UI for flaggede POIs med "Godkjenn/Avvis"-knapper
- Automatisk re-validering (cron/scheduler)
- trust_score påvirker POI-scoring (multiplikator)
- Report/Guide trust-filtrering
- Collection-view trust-filtrering

## Akseptansekriterier

### Database
- [ ] Migrasjon `014_add_poi_trust_score.sql` kjører uten feil
- [ ] `trust_score` kolonne med CHECK constraint (0.0–1.0)
- [ ] `trust_flags TEXT[]` med default `'{}'`
- [ ] `trust_score_updated_at TIMESTAMPTZ`
- [ ] `google_website`, `google_business_status`, `google_price_level` kolonner
- [ ] `google_business_status` CHECK constraint (OPERATIONAL/CLOSED_TEMPORARILY/CLOSED_PERMANENTLY)
- [ ] `google_price_level` CHECK constraint (0–4)
- [ ] Index `idx_pois_trust_score` på trust_score
- [ ] Index `idx_pois_trust_unvalidated` på created_at WHERE trust_score IS NULL

### TypeScript-typer
- [ ] POI interface har trustScore, trustFlags, trustScoreUpdatedAt
- [ ] POI interface har googleWebsite, googleBusinessStatus, googlePriceLevel
- [ ] POIImportData har trust_score, trust_flags, google_* felter
- [ ] transformPOI() mapper alle nye felter

### Layer 1+2 validering (`lib/utils/poi-trust.ts`)
- [ ] `calculateHeuristicTrust()` returnerer score + flags + needsClaudeReview
- [ ] Basescore 0.6 for Google POIs
- [ ] `business_status = "CLOSED_PERMANENTLY"` → score = 0
- [ ] Ingen nettside + 5.0 rating + < 100 reviews → sterk negativ
- [ ] Mistenkelig domene (.ntnu.no etc.) → sterk negativ
- [ ] `validateExternalUrl()` blokkerer private IP, kun http/https, FQDN
- [ ] `checkWebsite()` med HTTP HEAD, 3s timeout, SSRF-beskyttelse
- [ ] `batchValidateTrust()` concurrent med maks 10 samtidige
- [ ] Score 0.3–0.7 → needsClaudeReview = true

### Import-pipeline
- [ ] Entur/Bysykkel POIs får trust_score = 1.0 ved import
- [ ] Google POIs importeres med trust_score = null
- [ ] Re-import bevarer eksisterende trust_score (ikke overskriver)
- [ ] Re-import bevarer trust_flags og trust_score_updated_at
- [ ] Re-import bevarer google_website, google_business_status, google_price_level
- [ ] `updatePOITrustScore()` typed mutation for Claude Code Layer 3

### Explorer-filtrering
- [ ] POIs med trust_score < 0.5 vises IKKE i Explorer
- [ ] POIs med trust_score = null VISES (bakoverkompatibel)
- [ ] POIs med trust_score >= 0.5 vises normalt
- [ ] Trust-filter er første steg i applyExplorerCaps()
- [ ] Report og Guide påvirkes IKKE

### Manuell override
- [ ] `manual_override` i trust_flags beskytter mot re-validering
- [ ] Admin kan sette trust_score via SQL/Supabase

### Claude Code Layer 3 (verifiseres manuelt)
- [ ] Claude Code kan lese POIs med trust_score = null fra DB
- [ ] Claude Code gjør websøk per POI
- [ ] Claude Code oppdaterer trust_score + trust_flags i DB
- [ ] POIs med manual_override hoppes over

## Referanser

- Brainstorm: `docs/brainstorms/2026-02-08-poi-trust-validation-pipeline-brainstorm.md`
- Import API: `app/api/admin/import/route.ts`
- POI discovery: `lib/generators/poi-discovery.ts`
- Upsert med editorial preservation: `lib/supabase/mutations.ts:454-525`
- Explorer caps: `lib/themes/apply-explorer-caps.ts:17-78`
- POI scoring: `lib/utils/poi-score.ts:18-24`
- Google Places Details: `app/api/places/[placeId]/route.ts:37-137`
- DB schema: `supabase/migrations/001_initial_schema.sql:22-52`
- Supabase error handling: `docs/solutions/database-issues/supabase-graceful-column-fallback-20260206.md`
- Google Places junk filtering: `docs/solutions/api-integration/google-places-junk-results-filtering-20260208.md`
- Auto-fetch photos pattern: `docs/solutions/feature-implementations/auto-fetch-poi-photos-after-import-20260208.md`
