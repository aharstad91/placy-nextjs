---
title: "feat: Trust validation trigger + Claude Layer 3 workflow"
type: feat
date: 2026-02-08
brainstorm: docs/brainstorms/2026-02-08-poi-trust-validation-pipeline-brainstorm.md
depends-on: docs/plans/2026-02-08-feat-poi-trust-validation-pipeline-plan.md
---

# feat: Trust Validation Trigger + Claude Layer 3 Workflow

## Oversikt

Komplettering av POI trust pipeline. Layer 1+2 TypeScript-kode og Explorer-filtrering er allerede bygget (PR #21). Det som mangler er:

1. **Google Places enrichment** — hent `website`, `business_status`, `price_level` fra Places Details API
2. **Admin API-endpoint** — trigger Layer 1+2 validering og lagre resultater
3. **Claude Code skill** — Layer 3 websøk-validering for usikre POIs (score 0.3–0.7)
4. **Nye trust flags** — `manual_override` + Layer 3 flags i `VALID_TRUST_FLAGS`

## Motivasjon

Uten trigger-mekanisme ligger all trust-kode ubrukt. Import setter `google_website: null` og `trust_score: null` — Layer 1 er blind og Layer 3 kjører aldri. Denne planen kobler alt sammen til en fungerende end-to-end pipeline.

## Kritisk funn fra SpecFlow

**Google enrichment-gap:** Import-ruten setter `google_website: null`, `google_business_status: null`, `google_price_level: null` for alle Google-POIs. Uten enrichment scorer `buildTrustSignals()` alle POIs som `hasWebsite: false` → base 0.6 - 0.15 = **0.45** → under MIN_TRUST_SCORE → **alle Google-POIs filtreres ut**. Enrichment MUST kjøre FØR heuristikk-scoring.

## Tech Audit Mitigations (YELLOW verdict)

1. **Extract Places API to shared function** — don't call internal API route from server-side code
2. **Single source for trust flags** — `as const` array, derive type + Set
3. **Flag merging, not replacement** — Layer 3 update endpoint merges flags with existing
4. **`manual_override` always protected** — even with `force=true`
5. **Add `hasMore` to response** — for pagination awareness
6. **Call `revalidatePath()`** after trust score writes
7. **Add bearer token auth** to new admin endpoints (ADMIN_API_TOKEN env var)

## Løsning

### Fase 0: Shared Google Places Details Function

#### `lib/google-places/fetch-place-details.ts` — NY FIL

Ekstraher Places Details-logikk fra API-ruten til en delt funksjon. Brukes av både `/api/places/[placeId]` og trust-validate endpoint — unngår intern HTTP-kall overhead.

```typescript
export interface PlaceDetails {
  website?: string;
  businessStatus?: string;  // "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY"
  priceLevel?: number;      // 0-4
  rating?: number;
  userRatingsTotal?: number;
  photos?: { photo_reference: string }[];
  formattedPhoneNumber?: string;
  openingHours?: { weekday_text?: string[] };
}

export async function fetchPlaceDetails(
  placeId: string,
  fields: string[] = ["website", "business_status", "price_level", "rating", "user_ratings_total", "photos", "formatted_phone_number", "opening_hours"]
): Promise<PlaceDetails | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY not configured");
  // ... fetch from Google Places API directly, return mapped PlaceDetails
}
```

**Refaktor:** `app/api/places/[placeId]/route.ts` kaller `fetchPlaceDetails()` i stedet for å ha logikken inline.

### Fase 1: Google Places Enrichment

#### 1a. Utvid Places Details (`app/api/places/[placeId]/route.ts`)

Legg til `business_status` og `price_level` i fields-listen:

```typescript
// Nåværende fields (linje 77-84):
const fields = [
  "rating", "user_ratings_total", "photos",
  "website", "formatted_phone_number", "opening_hours",
  // LEGG TIL:
  "business_status",  // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
  "price_level",      // 0-4
].join(",");

// Legg til i PlaceDetails interface:
interface PlaceDetails {
  // ... eksisterende ...
  businessStatus?: string;
  priceLevel?: number;
}

// Legg til i mapping (linje 105-116):
businessStatus: place.business_status,
priceLevel: place.price_level,
```

**Kostnad:** Disse feltene er inkludert i "Basic" tier — **ingen ekstra kostnad** per kall.

**Refaktor:** Ruten bruker nå `fetchPlaceDetails()` fra `lib/google-places/fetch-place-details.ts`.

#### 1b. Enrichment via shared function i trust-validate endpoint

Endepunktet bruker `fetchPlaceDetails()` direkte (ikke intern HTTP-kall) for POIs med `google_website IS NULL`, med concurrency pool:

```typescript
import { fetchPlaceDetails } from "@/lib/google-places/fetch-place-details";

// Steg 1: Enrich POIs som mangler Google-data (parallell med concurrency=10)
const enrichResults = await enrichPoisInParallel(unvalidatedPois, 10);
// Steg 2: Oppdater DB med enrichment-data
// Steg 3: Re-les POIs med oppdatert data
// Steg 4: Kjør batchValidateTrust()
```

### Fase 2: Admin API-endpoint

#### `app/api/admin/trust-validate/route.ts` — NY FIL

```typescript
// Request
const TrustValidateSchema = z.object({
  projectId: z.string().min(1),
  force: z.boolean().default(false),        // true = re-valider alle, false = kun trust_score IS NULL
  concurrency: z.number().min(1).max(20).default(10),
  skipEnrichment: z.boolean().default(false), // true = hopp over Google enrichment (allerede gjort)
});

// Response
interface TrustValidateResponse {
  success: boolean;
  stats: {
    total: number;           // antall POIs prosessert
    enriched: number;        // antall POIs som fikk Google-data
    validated: number;       // antall som fikk trust score
    trusted: number;         // score >= 0.5
    flagged: number;         // score < 0.5
    needsClaudeReview: number; // score 0.3-0.7
    skipped: number;         // manual_override eller allerede validert
  };
  errors: string[];
}
```

**Pipeline i endepunktet:**

```
1. ADMIN_ENABLED + Bearer token check (ADMIN_API_TOKEN)
2. Zod-validering
3. Hent POIs for prosjektet (via project_pois JOIN)
4. Filtrer: hopp over manual_override ALLTID, hopp over allerede validerte (med mindre force=true)
5. Enrich: kall fetchPlaceDetails() direkte for POIs med google_website=null (concurrency pool, 10 samtidige)
6. Batch-oppdater enrichment-data i DB
7. Re-les POIs med oppdatert data
8. Kjør batchValidateTrust() fra lib/utils/poi-trust.ts
9. Batch-oppdater trust scores i DB (ikke individuelt per POI)
10. Kall revalidatePath() for å oppdatere cached Explorer-data
11. Returner stats med hasMore-flag for paginering
```

**Auth:** Bearer token check mot `ADMIN_API_TOKEN` env var, i tillegg til `ADMIN_ENABLED`.

**Feilhåndtering:** Wrap enrichment og scoring i try/catch per POI, akkumuler feil i `errors[]`, returner partial success.

**Timeout-strategi:** Maks 100 POIs per request. Response inkluderer `hasMore: boolean` slik at caller vet om det er flere å prosessere.

**Cache invalidation:** Etter trust score-oppdateringer, kall `revalidatePath()` for å oppdatere cached Explorer-data.

#### manual_override-håndtering

- [ ] Legg til `"manual_override"` i `VALID_TRUST_FLAGS` i mutations.ts
- [ ] Endpoint hopper over POIs med `manual_override` i trust_flags
- [ ] `manual_override` POIs hoppes ALLTID over — også med `force=true`

### Fase 3: Layer 3 Trust Flags — Single Source of Truth

#### Definer `ALL_TRUST_FLAGS` som `as const` array i `lib/utils/poi-trust.ts`

Én kilde for alle gyldige flags. Både `TrustFlag` type og `VALID_TRUST_FLAGS` Set deriveres herfra:

```typescript
// lib/utils/poi-trust.ts — SINGLE SOURCE OF TRUTH
export const ALL_TRUST_FLAGS = [
  // Layer 1+2 (eksisterende)
  "permanently_closed",
  "suspect_no_website_perfect_rating",
  "no_website",
  "website_ok",
  "suspicious_domain",
  "has_price_level",
  "high_review_count",
  "moderate_review_count",
  // Layer 3 (NYE)
  "found_on_tripadvisor",
  "found_on_yelp",
  "found_on_multiple_sources",
  "not_found_online",
  "claude_review_passed",
  "claude_review_failed",
  // Admin
  "manual_override",
] as const;

export type TrustFlag = typeof ALL_TRUST_FLAGS[number];
```

#### Deriv `VALID_TRUST_FLAGS` i `lib/supabase/mutations.ts`

```typescript
import { ALL_TRUST_FLAGS } from "@/lib/utils/poi-trust";

const VALID_TRUST_FLAGS = new Set<string>(ALL_TRUST_FLAGS);
```

**Fordel:** Ingen risiko for at type og Set drifter ut av synk.

### Fase 4: Claude Code Skill

#### `.claude/commands/validate-poi-trust.md` — NY FIL

Skill-instruksjoner for Claude Code — ikke TypeScript, men en workflow-beskrivelse.

**Input:** `/validate-poi-trust {projectId}`

**Forutsetninger:**
- Dev server kjører (`npm run dev`) på localhost:3000
- `ADMIN_ENABLED=true` i .env.local

**Pipeline:**

```markdown
## Steg 1: Kjør Layer 1+2 via API

POST http://localhost:3000/api/admin/trust-validate
{ "projectId": "{projectId}", "concurrency": 10 }

Vent på respons. Vis stats:
- "Layer 1+2 ferdig: {validated} POIs validert, {needsClaudeReview} trenger Layer 3"

## Steg 2: Hent POIs som trenger Layer 3

Les POIs fra Supabase der trust_score BETWEEN 0.3 AND 0.7
og trust_flags IKKE inneholder 'manual_override'.

## Steg 3: Layer 3 — Websøk per POI

For hver POI:
  1. Hent by fra address-feltet (parse "..., 7011 Trondheim, Norway" → "Trondheim")
     Fallback: bruk prosjektets navn eller koordinater
  2. Websøk: "{poi.name} {city}"
  3. Sjekk resultater:
     - Funnet på TripAdvisor → score 0.85+, flag "found_on_tripadvisor"
     - Funnet på Yelp → score 0.85+, flag "found_on_yelp"
     - Funnet på flere kilder → score 0.9+, flag "found_on_multiple_sources"
     - Funnet kun på Google → behold Layer 1+2 score, flag "claude_review_passed"
     - Ikke funnet noe sted → score 0.2, flag "not_found_online"
  4. Oppdater via API:
     POST http://localhost:3000/api/admin/trust-validate/update
     { "poiId": "...", "trustScore": 0.85, "trustFlags": ["website_ok", "found_on_tripadvisor"] }

  Vis progress: "[3/12] 'Cafe Example' — funnet på TripAdvisor ✅ (0.85)"

## Steg 4: Oppsummering

Vis:
  ✅ Layer 1+2: {N} POIs validert
  ✅ Layer 3: {M} POIs Claude-reviewed
  ✅ Trusted (>=0.5): {T}
  ⚠️  Flagged (<0.5): {F}
  🔒 Manual override: {O} (hoppet over)
```

**Feilhåndtering i skill:**
- Websøk returnerer ingenting → `not_found_online`, score 0.2
- Websøk feiler teknisk → behold Layer 1+2 score, flag `claude_review_failed`
- Ingen adresse på POI → bruk prosjektnavn som city-fallback

**By-parsing fra adresse:**
```
"Olav Tryggvasons gate 25, 7011 Trondheim, Norway"
→ Split på ", " → nest siste segment → strip postnummer → "Trondheim"
```

### Fase 5: Single-POI Update Endpoint (Flag Merging)

#### `app/api/admin/trust-validate/update/route.ts` — NY FIL

Tynn endpoint for Claude Code Layer 3 — oppdaterer enkelt-POI med **flag merging**:

```typescript
const UpdateSchema = z.object({
  poiId: z.string().min(1),
  trustScore: z.number().min(0).max(1),
  trustFlags: z.array(z.string()),  // NYE flags som skal LEGGES TIL (ikke erstatte)
});

// VIKTIG: Flag merging — Layer 3 flags LEGGES TIL eksisterende Layer 1+2 flags
// 1. ADMIN_ENABLED + Bearer token check
// 2. Zod-validering
// 3. Les eksisterende trust_flags fra DB
// 4. Merge: new Set([...existingFlags, ...newFlags])
// 5. Kall updatePOITrustScore() med merged flags
// 6. Kall revalidatePath()
// 7. Returner { success: true } eller { error: "..." }
```

**ALDRI erstatt eksisterende flags.** Layer 3 legger til sine flags (found_on_tripadvisor, etc.) på toppen av Layer 1+2 flags (website_ok, has_price_level, etc.).

## Filer som endres/opprettes

| Fil | Endring |
|-----|---------|
| `lib/google-places/fetch-place-details.ts` | **NY** — shared Google Places Details function |
| `app/api/places/[placeId]/route.ts` | Refaktor: bruk `fetchPlaceDetails()`, legg til `business_status`, `price_level` |
| `app/api/admin/trust-validate/route.ts` | **NY** — batch validation endpoint med bearer auth |
| `app/api/admin/trust-validate/update/route.ts` | **NY** — single POI update med flag merging |
| `lib/utils/poi-trust.ts` | `ALL_TRUST_FLAGS` as const + `TrustFlag` type derivert |
| `lib/supabase/mutations.ts` | `VALID_TRUST_FLAGS` derivert fra `ALL_TRUST_FLAGS` |
| `.claude/commands/validate-poi-trust.md` | **NY** — Claude Code skill for Layer 3 |

## Akseptansekriterier

### Shared Places Function
- [x] `lib/google-places/fetch-place-details.ts` opprettes med `fetchPlaceDetails()`
- [x] `/api/places/[placeId]` refaktorert til å bruke shared function
- [x] `fetchPlaceDetails()` returnerer `website`, `businessStatus`, `priceLevel`

### Google Places Enrichment
- [x] Trust-validate endpoint bruker `fetchPlaceDetails()` direkte (ikke intern HTTP)
- [x] Enrichment kjøres med concurrency pool (10 samtidige)
- [x] Enrichment-data lagres i DB før scoring

### Admin API Endpoint
- [x] `POST /api/admin/trust-validate` aksepterer `{ projectId, force?, concurrency? }`
- [x] Bearer token auth (`ADMIN_API_TOKEN`) i tillegg til `ADMIN_ENABLED`
- [x] Hopper over POIs med `manual_override` ALLTID (også med force=true)
- [x] Kjører Google enrichment → batchValidateTrust() → batch DB update
- [x] Returnerer stats med total, validated, trusted, flagged, needsClaudeReview, hasMore
- [x] Partial failure: akkumulerer feil, returnerer partial success
- [x] Kaller `revalidatePath()` etter trust score-oppdateringer
- [x] Maks 100 POIs per request (hasMore=true når flere gjenstår)

### Single POI Update Endpoint
- [x] `POST /api/admin/trust-validate/update` aksepterer `{ poiId, trustScore, trustFlags }`
- [x] Bearer token auth (`ADMIN_API_TOKEN`)
- [x] Flag MERGING: leser eksisterende flags, merger med nye (aldri erstatter)
- [x] Kaller `revalidatePath()` etter oppdatering
- [x] Brukes av Claude Code Layer 3

### Trust Flags — Single Source of Truth
- [x] `ALL_TRUST_FLAGS` as const array i poi-trust.ts
- [x] `TrustFlag` type derivert fra `ALL_TRUST_FLAGS`
- [x] `VALID_TRUST_FLAGS` i mutations.ts importerer fra poi-trust.ts
- [x] Aldri mulig å ha drift mellom type og Set

### Claude Code Skill
- [x] `/validate-poi-trust {projectId}` kjører komplett pipeline
- [x] Steg 1: Kaller trust-validate API for Layer 1+2
- [x] Steg 2: Leser tilbake POIs med score 0.3-0.7
- [x] Steg 3: Websøk per POI, vurderer legitimitet
- [x] Steg 4: Oppdaterer trust_score via update-endpoint
- [x] Viser progress per POI
- [x] Hopper over manual_override POIs
- [x] Parser by fra adresse-felt

### End-to-end
- [ ] Ny import → /validate-poi-trust → Explorer viser kun trusted POIs
- [ ] POIs med score < 0.5 filtreres ut
- [ ] POIs med score >= 0.5 vises normalt
- [ ] manual_override POIs forblir uendret

## Referanser

- Eksisterende trust-kode: `lib/utils/poi-trust.ts` (PR #21)
- DB mutations: `lib/supabase/mutations.ts:554-603`
- Places API: `app/api/places/[placeId]/route.ts`
- Import API mønster: `app/api/admin/import/route.ts`
- Fetch-photos mønster: `app/api/admin/fetch-photos/route.ts`
- Generate-hotel skill: `.claude/commands/generate-hotel.md`
- Brainstorm: `docs/brainstorms/2026-02-08-poi-trust-validation-pipeline-brainstorm.md`
- Trust pipeline solution: `docs/solutions/feature-implementations/poi-trust-validation-pipeline-20260208.md`
- Auto-fetch photos pattern: `docs/solutions/feature-implementations/auto-fetch-poi-photos-after-import-20260208.md`
- Cache invalidation: `docs/solutions/architecture-patterns/nextjs-revalidate-endpoint-supabase-rest-20260206.md`
