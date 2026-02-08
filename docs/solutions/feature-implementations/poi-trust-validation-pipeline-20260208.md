---
title: "POI Trust Validation Pipeline — Three-Layer Scoring with SSRF Protection"
date: 2026-02-08
category: feature-implementation
tags:
  - poi-trust
  - explorer
  - supabase
  - security
  - ssrf
  - heuristic-scoring
  - typed-unions
  - concurrency
module:
  - lib/utils/poi-trust.ts
  - lib/themes/apply-explorer-caps.ts
  - lib/supabase/mutations.ts
  - app/api/admin/import/route.ts
severity: medium
symptoms:
  - Fake/closed/low-quality POIs appearing in Explorer alongside legitimate businesses
  - No mechanism to validate POI trustworthiness before display
  - Google Places API returns student projects, parked domains, permanently closed venues
---

# POI Trust Validation Pipeline

## Problem

Google Places API returns POIs that include fake businesses, permanently closed venues, student projects (e.g., "Chateau de Sorgenfri" — a .ntnu.no page with 5.0 rating), and other low-quality results. Without validation, these appear alongside legitimate businesses in Explorer, degrading user trust.

## Solution

Three-layer trust validation pipeline that scores POIs 0.0–1.0 and filters untrusted ones from Explorer.

### Architecture

| Layer | What | Cost | Catches |
|-------|------|------|---------|
| Layer 1: Google Data | Heuristic scoring from Places Details | $0.017/POI | Closed venues, no website, suspicious profiles |
| Layer 2: Website Verification | SSRF-hardened HTTP HEAD checks | Free | Student projects, parked domains, dead links |
| Layer 3: Claude Code (future) | Web search, TripAdvisor/Yelp check | Included | Sophisticated fakes, missing digital presence |

### Key Files

| File | Purpose |
|------|---------|
| `lib/utils/poi-trust.ts` | Core: heuristic scoring, SSRF protection, batch validation |
| `lib/themes/apply-explorer-caps.ts` | Explorer integration: trust pre-filter (step 1 of 7) |
| `lib/supabase/mutations.ts` | DB mutations with input validation |
| `app/api/admin/import/route.ts` | Import API: sets initial trust values |
| `supabase/migrations/014_add_trust_score_columns.sql` | Schema: trust columns |
| `supabase/migrations/015_fix_trust_score_constraints.sql` | Schema: constraints, NOT NULL, precision |

### Layer 1: Heuristic Scoring

Pure function `calculateHeuristicTrust()` — no I/O, deterministic from signals.

**Scoring model** (base 0.6):
- Permanently closed: hard 0
- No website + 5.0 rating + <100 reviews: -0.3
- No website alone: -0.15
- Suspicious domain (.ntnu.no, .edu, .blogspot.com): -0.3
- Website responds: +0.1
- Price level set: +0.05
- Operational status: +0.05
- 50+ reviews: +0.1
- 200+ reviews: +0.2

**Typed unions for safety:**
```typescript
export type TrustFlag =
  | "permanently_closed"
  | "suspect_no_website_perfect_rating"
  | "no_website" | "website_ok"
  | "suspicious_domain" | "has_price_level"
  | "high_review_count" | "moderate_review_count";

export type GoogleBusinessStatus = "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
```

### Layer 2: SSRF-Hardened Website Verification

`checkWebsite()` with `redirect: "manual"` to prevent TOCTOU redirect attacks.

**SSRF protection (`validateExternalUrl()`):**
- Protocol: http/https only
- Blocks: localhost, 0.0.0.0, cloud metadata (169.254.169.254)
- Blocks: private IP ranges (127.x, 10.x, 172.16-31.x, 192.168.x)
- Blocks: bare IPs, IPv6 addresses, non-FQDN hostnames
- Returns discriminated union: `{ safe: true } | { safe: false; reason: string }`

**Redirect TOCTOU fix:**
```typescript
const response = await fetch(url, {
  method: "HEAD",
  signal: controller.signal,
  redirect: "manual", // Validate each hop, don't auto-follow
});
// If redirect, re-validate target URL for SSRF
if (response.status >= 300 && response.status < 400 && location) {
  const redirectValidation = validateExternalUrl(location);
  if (!redirectValidation.safe) return { responds: false, isSuspicious };
}
```

### Batch Processing

`batchValidateTrust()` with domain deduplication and concurrency pool:
- Same domain = same result, check once
- Configurable concurrency (default 10) — smoother than chunk-based Promise.all
- `try/finally` for `clearTimeout` to prevent timer leaks

### Explorer Integration

Trust filter is step 1 of the 7-step Explorer capping pipeline:

```typescript
import { MIN_TRUST_SCORE } from "@/lib/utils/poi-trust";

// Step 1: Trust filter — null = show (backward compatible)
const trusted = pois.filter((poi) => {
  if (poi.trustScore == null) return true;
  return poi.trustScore >= MIN_TRUST_SCORE; // 0.5
});
```

### Database Constraints (Migration 015)

```sql
ALTER TABLE pois ADD CONSTRAINT pois_trust_score_range
  CHECK (trust_score >= 0.0 AND trust_score <= 1.0);
ALTER TABLE pois ADD CONSTRAINT pois_google_business_status_valid
  CHECK (google_business_status IN ('OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'));
ALTER TABLE pois ALTER COLUMN trust_flags SET NOT NULL;
ALTER TABLE pois ALTER COLUMN trust_flags SET DEFAULT '{}';
ALTER TABLE pois ALTER COLUMN trust_score TYPE NUMERIC(3,2);
```

### Input Validation

`updatePOITrustScore()` validates score range 0-1 and flags against `VALID_TRUST_FLAGS` allowlist before DB write.

## Design Decisions

1. **null trustScore = show** — Backward compatible; existing POIs without scores still appear
2. **MIN_TRUST_SCORE = 0.5** — Exported constant, single source of truth
3. **Concurrency pool** — Smoother load vs chunk-based Promise.all
4. **redirect: "manual"** — Prevents TOCTOU where SSRF check passes but redirect targets internal network
5. **Domain deduplication** — Multiple POIs from same domain trigger one HTTP check
6. **Discriminated union for UrlValidation** — Type-safe error handling with reason codes
7. **NOT NULL trust_flags** — Empty array `{}` default, never null — simplifies all consuming code

## Code Review Lessons (13 findings fixed)

### P1 — Critical
- **Type your enums**: Use `TrustFlag` union type, not `string[]`. Prevents invalid flags at compile time.
- **Validate redirect targets**: `redirect: "manual"` + re-validate each hop prevents SSRF via redirect.
- **Add DB constraints at creation time**: CHECK constraints, NOT NULL, precision — don't leave for later.

### P2 — Should Fix
- **Discriminated unions** for result types with different shapes per variant.
- **Concurrency pools** over chunk-based Promise.all for batch network I/O.
- **try/finally for timers**: Always clean up `setTimeout` even on error paths.
- **Anchor domain patterns**: `.blogspot.com` (dot-prefixed) prevents `myblogspot.com` false positive.
- **Remove dead code immediately**: Don't leave "might need later" constants.

### P3 — Nice to Have
- **Extract magic numbers**: Named constants with rationale (`MIN_TRUST_SCORE = 0.5`).
- **Validate at boundaries**: Score range + flag allowlist check in mutation functions.
- **Decide nullability upfront**: Array columns should be NOT NULL with defaults.

## Related Documentation

- [Brainstorm](../../brainstorms/2026-02-08-poi-trust-validation-pipeline-brainstorm.md)
- [Plan](../../plans/2026-02-08-feat-poi-trust-validation-pipeline-plan.md)
- [Explorer UX Quality Overhaul](explorer-ux-quality-overhaul-20260206.md) — The capping pipeline where trust filter integrates
- [Google Places Junk Results Filtering](../api-integration/google-places-junk-results-filtering-20260208.md) — Pre-filters at discovery stage
- [Auto-fetch POI Photos](auto-fetch-poi-photos-after-import-20260208.md) — Another import pipeline enrichment step
- PR #21: https://github.com/aharstad91/placy-nextjs/pull/21

## Prevention Checklist

For future features involving external API validation:

- [ ] Use typed union types for finite string sets (never bare `string[]`)
- [ ] Add SSRF protection for all server-side HTTP requests
- [ ] Use `redirect: "manual"` and validate each redirect hop
- [ ] Add CHECK constraints in the same migration that adds columns
- [ ] Use NOT NULL with defaults for array columns
- [ ] Validate at system boundaries (API routes, mutation functions)
- [ ] Use concurrency pools for batch network I/O
- [ ] Use try/finally for timer and AbortController cleanup
- [ ] Anchor domain patterns with dot prefix for exact segment matching
- [ ] Export threshold constants — never hardcode magic numbers
