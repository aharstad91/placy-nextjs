---
title: "POI Trust Validation Pipeline — Prevention Strategies & Lessons Learned"
type: code-quality
date: 2026-02-08
review_date: 2026-02-08
issues_found: 13
issues_critical: 3
issues_should_fix: 5
issues_nice_to_have: 3
related_files:
  - lib/utils/poi-trust.ts
  - app/api/admin/import/route.ts
  - lib/supabase/mutations.ts
  - lib/types.ts
  - supabase/migrations/014_add_poi_trust_score.sql
---

# POI Trust Validation Pipeline — Prevention Strategies

## Overview

Code review of the POI trust validation system (13 issues found) revealed gaps in:
- **Type safety** (untyped string unions, non-discriminated unions)
- **Security** (SSRF redirect vulnerability, input validation)
- **Concurrency** (inefficient batching, race conditions)
- **Database design** (missing constraints)
- **Code hygiene** (dead code, magic numbers)

This document captures lessons learned and prevention strategies for future work.

## Critical Issues (P1)

### 1. Untyped Trust Flags String Union

**Issue:** trust_flags stored as `string[]` with no enum or type validation. Invalid values could be inserted into DB.

```typescript
// BAD: What was originally written
trust_flags?: string[];  // Can store anything!

// GOOD: What it should be
type TrustFlag =
  | "no_website"
  | "website_ok"
  | "suspicious_domain"
  | "permanently_closed"
  | "suspicious_hours"
  | "has_price_level"
  | "found_on_tripadvisor"
  | "found_on_yelp"
  | "not_found_online"
  | "invalid_website_url"
  | "manual_override";

trustFlags?: TrustFlag[];
```

**Why it happened:** Assumed string array was sufficient. No validation at boundary.

**Prevention Strategy:**

1. **Always use typed unions for finite sets** — If a column should contain a fixed set of values, use TypeScript union types, not string arrays.

2. **Validate at boundaries** — Add Zod schema validation at API routes and mutation functions:
   ```typescript
   const TrustFlagSchema = z.enum([
     "no_website",
     "website_ok",
     "suspicious_domain",
     // ... all valid flags
   ]);

   const UpdateTrustSchema = z.object({
     trustScore: z.number().min(0).max(1),
     trustFlags: z.array(TrustFlagSchema),
   });
   ```

3. **DB constraint support** — Use SQL CHECK or ENUM type:
   ```sql
   ALTER TABLE pois ADD CONSTRAINT valid_trust_flags
   CHECK (trust_flags @> ARRAY[]::text[] AND
          trust_flags <@ ARRAY[
            'no_website', 'website_ok', 'suspicious_domain', ...
          ]::text[]);
   ```

4. **Generate types from DB** — Use Supabase type generation to keep DB schema and TS types in sync.

**Checklist for Similar Features:**
- [ ] Feature has finite set of string values? Use union type.
- [ ] Type used in API route? Add Zod validation.
- [ ] Type persisted to DB? Add CHECK constraint or ENUM.
- [ ] Type widely used? Consider code generation from DB schema.

---

### 2. Redirect TOCTOU Vulnerability (SSRF)

**Issue:** Using `redirect: "follow"` in fetch allows attacker to bypass SSRF check by redirecting after initial check passes.

```typescript
// BAD: Original code
const response = await fetch(url, {
  redirect: "follow",  // Attacker redirects to internal IP!
  timeout: 3000
});

// GOOD: Check each hop
const response = await fetch(url, {
  redirect: "manual",  // Don't auto-follow
  timeout: 3000
});

if (response.status >= 300 && response.status < 400) {
  const redirectUrl = response.headers.get("location");
  if (!redirectUrl) throw new Error("Redirect without location header");

  // Validate redirect destination with same rules
  validateExternalUrl(redirectUrl);

  // Fetch redirect destination with manual again
  return fetch(redirectUrl, { redirect: "manual", timeout: 3000 });
}
```

**Why it happened:** Assumed initial validation was sufficient. TOCTOU (Time-of-Check-Time-of-Use) vulnerability common in security code.

**Prevention Strategy:**

1. **Manual redirect handling** — Always use `redirect: "manual"` for server-side fetches that validate URLs.

2. **Validate each hop** — Don't trust a single pre-check:
   ```typescript
   async function fetchWithValidation(url: string): Promise<Response> {
     validateExternalUrl(url);  // Pre-check
     const response = await fetch(url, { redirect: "manual" });

     if (response.status >= 300 && response.status < 400) {
       const redirectUrl = response.headers.get("location");
       validateExternalUrl(redirectUrl);  // Validate hop
       return fetch(redirectUrl, { redirect: "manual" });
     }
     return response;
   }
   ```

3. **Limit redirect depth** — Allow only 1 redirect, not unlimited:
   ```typescript
   async function fetchWithValidation(
     url: string,
     maxHops: number = 1,
     currentHop: number = 0
   ): Promise<Response> {
     if (currentHop > maxHops) {
       throw new Error("Too many redirects");
     }

     validateExternalUrl(url);
     const response = await fetch(url, { redirect: "manual" });

     if (response.status >= 300 && response.status < 400) {
       const redirectUrl = response.headers.get("location");
       return fetchWithValidation(redirectUrl, maxHops, currentHop + 1);
     }
     return response;
   }
   ```

4. **Security-critical code review** — SSRF, auth, crypto code always needs peer review.

5. **Add integration tests** — Test redirect scenarios:
   ```typescript
   test("blocks redirect to private IP", async () => {
     const mockFetch = jest.fn()
       .mockResolvedValueOnce(
         new Response(null, {
           status: 301,
           headers: { location: "http://127.0.0.1:8080" }
         })
       );

     await expect(fetchWithValidation("https://public.com")).rejects
       .toThrow("private IP");
   });
   ```

**Checklist for Network I/O:**
- [ ] Using `redirect: "follow"`? Change to `redirect: "manual"`.
- [ ] Validating URL before fetch? Also validate redirect destination.
- [ ] Unlimited redirects allowed? Add `maxHops` limit.
- [ ] Security-sensitive fetch? Add integration tests for attack scenarios.

---

### 3. Missing Database Constraints

**Issue:** `trust_score` column has no CHECK constraint. Invalid values (< 0 or > 1) could be stored.

```sql
-- BAD: Original
ALTER TABLE pois ADD COLUMN trust_score NUMERIC;

-- GOOD: With constraint
ALTER TABLE pois ADD COLUMN trust_score NUMERIC
  CHECK (trust_score >= 0.0 AND trust_score <= 1.0);
```

**Why it happened:** Assumed application validation was sufficient. DB constraints are defense in depth.

**Prevention Strategy:**

1. **Constraints as documentation** — CHECK constraints document valid ranges and are enforced at DB layer.

2. **Apply constraints universally** for bounded numeric columns:
   ```sql
   -- Scores (0-1 range)
   ALTER TABLE table_name ADD COLUMN score NUMERIC
     CHECK (score >= 0.0 AND score <= 1.0);

   -- Ratings (0-5 range)
   ALTER TABLE table_name ADD COLUMN rating INTEGER
     CHECK (rating >= 0 AND rating <= 5);

   -- Percentages (0-100)
   ALTER TABLE table_name ADD COLUMN percentage INTEGER
     CHECK (percentage >= 0 AND percentage <= 100);

   -- Price levels (0-4)
   ALTER TABLE table_name ADD COLUMN price_level INTEGER
     CHECK (price_level >= 0 AND price_level <= 4);

   -- Enum-like values
   ALTER TABLE table_name ADD COLUMN status TEXT
     CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING'));
   ```

3. **Test constraint violations** in migration tests:
   ```typescript
   test("trust_score constraint enforced", async () => {
     await expect(
       db.query(
         "INSERT INTO pois (name, trust_score) VALUES ($1, $2)",
         ["test", 1.5]  // Invalid!
       )
     ).rejects.toThrow("constraint");
   });
   ```

4. **Review all numeric columns during code review** — Ask: "Can this be invalid? Should we constrain it?"

**Checklist for Database Migrations:**
- [ ] New numeric column? Add CHECK constraint with valid range.
- [ ] New enum-like column? Add CHECK with allowed values.
- [ ] Column has natural min/max? Document it.
- [ ] Migration includes constraint test? Verify in code review.

---

## Should-Fix Issues (P2)

### 4. Non-Discriminated Union for Result Types

**Issue:** Result type doesn't discriminate between variants. Missing `reason` field could be null.

```typescript
// BAD: Non-discriminated union
interface UrlValidationResult {
  safe: boolean;
  reason?: string;  // Unclear when reason is required
}

// Consumer code loses safety
if (result.safe) {
  // Can still access result.reason here (might be undefined)
  console.log(result.reason);  // Dangerous!
}

// GOOD: Discriminated union
type UrlValidationResult =
  | { safe: true; reason?: never }
  | { safe: false; reason: string };

// Consumer code has type safety
if (result.safe) {
  // Type system guarantees reason is never accessed here
  // result.reason would be a type error!
} else {
  // Type system guarantees reason exists here
  console.log(result.reason);
}
```

**Prevention Strategy:**

1. **Use discriminated unions for multi-variant types:**
   ```typescript
   // Good pattern for different outcome shapes
   type Result<T> =
     | { success: true; data: T }
     | { success: false; error: Error };

   // Consumer code is type-safe
   const result = doSomething();
   if (result.success) {
     console.log(result.data);  // data guaranteed to exist
   } else {
     console.log(result.error);  // error guaranteed to exist
   }
   ```

2. **Document discriminant field** in JSDoc:
   ```typescript
   /**
    * Result of URL validation.
    *
    * **Discriminant:** `success` field
    * - If `success: true`, access `data` field
    * - If `success: false`, access `error` field
    */
   type Result<T> =
     | { success: true; data: T }
     | { success: false; error: Error };
   ```

3. **Exhaustiveness checking** with TypeScript:
   ```typescript
   function handleResult(result: Result<string>): void {
     if (result.success) {
       console.log(result.data);
     } else {
       // Without else, TypeScript error if other branches exist
       assertNever(result);  // Type-safe!
     }
   }

   function assertNever(x: never): never {
     throw new Error(`Unexpected value: ${x}`);
   }
   ```

4. **Avoid `optional` in discriminated unions** — Fields should be non-optional based on discriminant:
   ```typescript
   // BAD: reason is optional in both variants
   type Result = { success: boolean; reason?: string };

   // GOOD: reason required in error variant
   type Result =
     | { success: true }
     | { success: false; reason: string };
   ```

**Checklist for Result Types:**
- [ ] Result has multiple outcomes? Use discriminated union.
- [ ] Discriminant field clearly marked? Add JSDoc.
- [ ] Consumer code type-safe? Test with exhaustiveness.
- [ ] All fields non-optional per variant? Remove `?` from variant-specific fields.

---

### 5. Inefficient Chunk-Based Concurrency

**Issue:** Promise.all on fixed chunks (e.g., 10 items) leaves idle gaps in concurrency.

```typescript
// BAD: Chunk-based with idle gaps
async function batchValidateTrust(pois: POI[]): Promise<Map<string, TrustResult>> {
  const CHUNK_SIZE = 10;
  const results = new Map();

  for (let i = 0; i < pois.length; i += CHUNK_SIZE) {
    const chunk = pois.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(poi => validateTrust(poi))
    );
    chunkResults.forEach((result, idx) => {
      results.set(chunk[idx].id, result);
    });
  }

  return results;  // If 9 items in last chunk, 1 slot wasted!
}

// GOOD: Concurrency pool
async function batchValidateTrust(
  pois: POI[],
  maxConcurrency: number = 10
): Promise<Map<string, TrustResult>> {
  const results = new Map();
  const queue = [...pois];
  const inFlight = new Set<Promise<void>>();

  for (const poi of pois) {
    const promise = validateTrust(poi).then(result => {
      results.set(poi.id, result);
    });

    inFlight.add(promise);
    if (inFlight.size >= maxConcurrency) {
      await Promise.race(inFlight);
      inFlight.delete(
        Array.from(inFlight)[0]
      );
    }
  }

  await Promise.all(inFlight);
  return results;
}
```

**Prevention Strategy:**

1. **Use p-limit or similar library** for production code:
   ```typescript
   import pLimit from "p-limit";

   async function batchValidateTrust(
     pois: POI[],
     maxConcurrency: number = 10
   ): Promise<Map<string, TrustResult>> {
     const limit = pLimit(maxConcurrency);
     const promises = pois.map(poi =>
       limit(() => validateTrust(poi))
     );

     const results = await Promise.all(promises);
     return new Map(
       pois.map((poi, idx) => [poi.id, results[idx]])
     );
   }
   ```

2. **Document concurrency strategy** in JSDoc:
   ```typescript
   /**
    * Validate multiple POIs concurrently.
    *
    * @param pois - POIs to validate
    * @param maxConcurrency - Max parallel requests (default: 10)
    *
    * Strategy: Uses concurrency pool to avoid overwhelming network.
    * Worst-case: 500 POIs at max concurrency = ~62s (vs 1060s sequential)
    */
   export async function batchValidateTrust(
     pois: POI[],
     maxConcurrency?: number
   ): Promise<Map<string, TrustResult>>;
   ```

3. **Benchmark concurrent vs sequential** in code comments:
   ```typescript
   // Concurrency pool maintains exactly 10 in-flight requests
   // 500 POIs at 10 concurrency with 3s timeout per POI:
   // - Sequential: 500 * 3s = 1500s
   // - Concurrent: ceil(500/10) * 3s ≈ 150s (10x faster)
   const CONCURRENCY = 10;
   ```

4. **Monitor queue depth** in logging:
   ```typescript
   let inFlightCount = 0;
   const promise = validateTrust(poi).then(result => {
     inFlightCount--;
     logger.debug(`POI validated. In-flight: ${inFlightCount}`);
     return result;
   });
   ```

**Checklist for Batch Operations:**
- [ ] Multiple async operations? Consider concurrency limits.
- [ ] Using fixed chunk size? Switch to concurrency pool.
- [ ] Concurrency not tuned? Document the CONCURRENCY constant.
- [ ] Performance not measured? Add before/after benchmark.

---

### 6. Timer Race Condition

**Issue:** `clearTimeout()` not called on error path. Timer persists and fires after function returns.

```typescript
// BAD: Timer race condition
async function checkWebsiteWithTimeout(
  url: string,
  timeoutMs: number
): Promise<boolean> {
  let timer: NodeJS.Timeout | null = null;

  return new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve(false);  // Timeout fired
    }, timeoutMs);

    fetch(url).then(
      response => {
        clearTimeout(timer);  // GOOD on success
        resolve(response.ok);
      },
      error => {
        // ERROR: clearTimeout not called here!
        resolve(false);  // Timer still pending
      }
    );
  });
}

// GOOD: Always cleanup
async function checkWebsiteWithTimeout(
  url: string,
  timeoutMs: number
): Promise<boolean> {
  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      fetch(url).then(r => r.ok),
      new Promise<boolean>((_, reject) =>
        timer = setTimeout(
          () => reject(new Error("Timeout")),
          timeoutMs
        )
      ),
    ]);
  } finally {
    if (timer) clearTimeout(timer);  // Always cleanup
  }
}
```

**Prevention Strategy:**

1. **Use try/finally for timer cleanup:**
   ```typescript
   async function withTimeout<T>(
     promise: Promise<T>,
     timeoutMs: number
   ): Promise<T> {
     let timer: NodeJS.Timeout | null = null;

     try {
       return await Promise.race([
         promise,
         new Promise<T>((_, reject) => {
           timer = setTimeout(
             () => reject(new Error("Timeout")),
             timeoutMs
           );
         }),
       ]);
     } finally {
       if (timer) clearTimeout(timer);  // Always runs
     }
   }
   ```

2. **Use Promise.race with AbortController** (modern pattern):
   ```typescript
   async function checkWebsiteWithTimeout(
     url: string,
     timeoutMs: number
   ): Promise<boolean> {
     const controller = new AbortController();
     const timeoutId = setTimeout(
       () => controller.abort(),
       timeoutMs
     );

     try {
       const response = await fetch(url, {
         signal: controller.signal
       });
       return response.ok;
     } finally {
       clearTimeout(timeoutId);  // Always cleanup
     }
   }
   ```

3. **Document timer ownership** in code:
   ```typescript
   // Timer is created and must be cleaned up in this function
   // On success, error, or timeout, timer MUST be cleared
   // to prevent callbacks firing after function returns
   let timer: NodeJS.Timeout | null = null;
   ```

4. **Test cleanup with jest.useFakeTimers()**:
   ```typescript
   test("timer cleaned up on error", () => {
     jest.useFakeTimers();
     const clearSpy = jest.spyOn(global, "clearTimeout");

     checkWebsiteWithTimeout("https://invalid", 1000)
       .catch(() => {});  // Ignore error

     jest.runAllTimers();

     expect(clearSpy).toHaveBeenCalled();
     jest.useRealTimers();
   });
   ```

**Checklist for Timers and Cleanup:**
- [ ] Code creates a timer (setTimeout, setInterval)? Add try/finally.
- [ ] Promise rejected before timer clears? Test error path.
- [ ] Multiple code paths (success, error, timeout)? Each must cleanup.
- [ ] Tests verify cleanup? Add timer mock test.

---

### 7. Anchored Domain Pattern Matching

**Issue:** Domain patterns like `.blogspot.com` could incorrectly match `myblogspot.com` (missing leading dot in matching).

```typescript
// BAD: Unanchored pattern
const SUSPICIOUS_DOMAINS = [
  ".blogspot.com",
  ".wordpress.com",
];

function isSuspiciousDomain(url: string): boolean {
  const domain = new URL(url).hostname;

  // "myblogspot.com".includes(".blogspot.com") == true!
  return SUSPICIOUS_DOMAINS.some(d => domain.includes(d));
}

// GOOD: Anchored pattern with documented semantics
const SUSPICIOUS_DOMAINS = [
  ".blogspot.com",  // Matches: anything.blogspot.com, blogspot.com
  ".wordpress.com",
];

/**
 * Check if domain is suspicious based on known patterns.
 *
 * **Matching semantics:**
 * - Pattern ".example.com" matches "foo.example.com" and "example.com"
 * - Patterns are anchored with leading dot to prevent false positives
 * - Examples:
 *   - ".blogspot.com" matches "myblog.blogspot.com" ✓
 *   - ".blogspot.com" does NOT match "myblogspot.com" ✓
 */
function isSuspiciousDomain(url: string): boolean {
  const domain = new URL(url).hostname;

  // Anchored check: leading dot required
  return SUSPICIOUS_DOMAINS.some(pattern => {
    if (pattern.startsWith(".")) {
      // Pattern ".example.com" matches "x.example.com" or "example.com"
      return domain === pattern.slice(1) ||
             domain.endsWith(pattern);
    } else {
      // Pattern "example.com" matches exact domain only
      return domain === pattern;
    }
  });
}

// TESTS
test("suspicious domain detection", () => {
  expect(isSuspiciousDomain("https://myblog.blogspot.com")).toBe(true);
  expect(isSuspiciousDomain("https://myblogspot.com")).toBe(false);  // Not suspicious
  expect(isSuspiciousDomain("https://blogspot.com")).toBe(true);
  expect(isSuspiciousDomain("https://test.wordpress.com")).toBe(true);
});
```

**Prevention Strategy:**

1. **Document pattern matching semantics** in JSDoc:
   ```typescript
   /**
    * Suspicious domain patterns.
    *
    * **Semantics:**
    * - Patterns starting with "." are domain-suffix matches
    *   Example: ".blogspot.com" matches "x.blogspot.com" AND "blogspot.com"
    * - Patterns without "." are exact matches
    *   Example: "example.com" matches only "example.com"
    *
    * @see {@link isSuspiciousDomain} for matching implementation
    */
   const SUSPICIOUS_DOMAINS = [
     ".blogspot.com",
     ".wordpress.com",
     ".ntnu.no",
     ".uio.no",
   ];
   ```

2. **Test boundary cases:**
   ```typescript
   describe("domain pattern matching", () => {
     test("suffix pattern matches subdomain", () => {
       expect(isSuspiciousDomain("https://test.blogspot.com")).toBe(true);
     });

     test("suffix pattern matches root domain", () => {
       expect(isSuspiciousDomain("https://blogspot.com")).toBe(true);
     });

     test("suffix pattern does not match prefix", () => {
       expect(isSuspiciousDomain("https://myblogspot.com")).toBe(false);
     });

     test("exact pattern matches only exact domain", () => {
       expect(isSuspiciousDomain("https://example.com")).toBe(true);
       expect(isSuspiciousDomain("https://test.example.com")).toBe(false);
     });
   });
   ```

3. **Use established URL parsing libraries** instead of string matching:
   ```typescript
   function isSuspiciousDomain(urlString: string): boolean {
     const url = new URL(urlString);
     const domain = url.hostname;

     // Use psl (Public Suffix List) for correct domain parsing
     const parsed = psl.parse(domain);

     return SUSPICIOUS_DOMAINS.some(pattern => {
       if (pattern.startsWith(".")) {
         const target = pattern.slice(1);
         return domain === target || domain.endsWith("." + target);
       }
       return domain === pattern;
     });
   }
   ```

**Checklist for Pattern Matching:**
- [ ] String patterns for domain/URL matching? Document the semantics.
- [ ] Leading/trailing special chars? Test boundary cases.
- [ ] False positives possible? Add tests for similar strings.
- [ ] Complex URL parsing? Use established library (psl, tldts).

---

### 8. Dead Code

**Issue:** Unused constants left in codebase with comment "might need later".

```typescript
// BAD: Dead code
const CONFIDENCE_THRESHOLD = 0.7;  // Might need later
const RETRY_COUNT = 3;              // Not used anymore
const BACKUP_API_KEY = process.env.BACKUP_KEY;  // Old fallback

export function calculateTrust(signals: TrustSignals): TrustResult {
  // Actually uses hardcoded 0.5 instead of CONFIDENCE_THRESHOLD
  return signals.score >= 0.5 ? ... : ...;
}
```

**Prevention Strategy:**

1. **Delete immediately** — Don't accumulate dead code:
   ```typescript
   // If a constant isn't used, delete it.
   // Git history preserves it if you need to resurrect.
   // Not deleting increases maintenance burden.
   ```

2. **Use TypeScript compiler flag** to catch unused variables:
   ```json
   {
     "compilerOptions": {
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noImplicitReturns": true
     }
   }
   ```

3. **If "might need later", create a GitHub issue** instead:
   ```typescript
   // Instead of leaving dead code, file an issue:
   // "Consider retry logic for POI validation (RETRY_COUNT pattern)"
   // Then delete the dead constant
   ```

4. **Review constants during code review:**
   - Is this used? Where?
   - Is it referenced by tests?
   - Could it be inlined?

**Checklist for Code Cleanup:**
- [ ] Dead code in PR? Request removal.
- [ ] tsconfig.json has noUnusedLocals? Yes.
- [ ] CI fails on unused variables? Yes.
- [ ] "Might need later" comment? File issue instead.

---

## Nice-to-Have Issues (P3)

### 9. Magic Numbers

**Issue:** Threshold `0.5` hardcoded without explanation.

```typescript
// BAD: Magic number
return poi.trustScore >= 0.5;

// GOOD: Named constant
const TRUST_THRESHOLD = 0.5;

/**
 * Threshold for displaying POI in Explorer.
 *
 * - 0.5 = 50% confidence the POI is legitimate
 * - Below 0.5: flagged for admin review, not shown to users
 * - Above 0.5: sufficient confidence to show in Explorer
 *
 * Rationale: Balances false positives (fake POIs shown)
 * vs false negatives (real POIs hidden).
 */
const TRUST_DISPLAY_THRESHOLD = 0.5;

export function shouldShowInExplorer(poi: POI): boolean {
  if (poi.trustScore === undefined || poi.trustScore === null) {
    return true;  // Backward compat: unvalidated POIs shown
  }
  return poi.trustScore >= TRUST_DISPLAY_THRESHOLD;
}
```

**Prevention Strategy:**

1. **Extract meaningful thresholds as constants:**
   ```typescript
   // Base score: default trust for Google POI (before validation)
   const BASE_TRUST_SCORE = 0.6;

   // Display threshold: minimum score to show in Explorer
   const TRUST_DISPLAY_THRESHOLD = 0.5;

   // Review threshold: range where Claude Code review is suggested
   const TRUST_REVIEW_MIN = 0.3;
   const TRUST_REVIEW_MAX = 0.7;

   // Request timeout: prevent hanging on slow websites
   const WEBSITE_CHECK_TIMEOUT_MS = 3000;

   // Max concurrent: balance parallelism vs resource usage
   const MAX_CONCURRENT_VALIDATIONS = 10;
   ```

2. **Document the rationale in JSDoc:**
   ```typescript
   /**
    * Base trust score for newly imported Google POIs.
    *
    * Rationale: Google data is reasonably reliable (not always, but usually),
    * so we start at 0.6 rather than 0.0. Heuristics and web checks adjust.
    *
    * @see calculateHeuristicTrust() for adjustment rules
    */
   const BASE_TRUST_SCORE = 0.6;
   ```

3. **Group related constants:**
   ```typescript
   // Trust scoring constants
   const TRUST_CONSTANTS = {
     baseScore: 0.6,
     displayThreshold: 0.5,
     reviewMin: 0.3,
     reviewMax: 0.7,

     // Score adjustments
     adjustments: {
       noWebsite: -0.15,
       hasWebsite: +0.1,
       suspiciousDomain: -0.3,
       operationalStatus: +0.05,
     },
   } as const;
   ```

4. **Test threshold behavior:**
   ```typescript
   test("trust threshold behavior", () => {
     const poi_below = { trustScore: 0.49 } as POI;
     const poi_at = { trustScore: 0.5 } as POI;
     const poi_above = { trustScore: 0.51 } as POI;

     expect(shouldShowInExplorer(poi_below)).toBe(false);
     expect(shouldShowInExplorer(poi_at)).toBe(true);
     expect(shouldShowInExplorer(poi_above)).toBe(true);
   });
   ```

**Checklist for Constants:**
- [ ] Hardcoded number used more than once? Extract constant.
- [ ] Threshold or boundary value? Name it meaningfully.
- [ ] Constant documented? Add JSDoc with rationale.
- [ ] Tests verify boundary conditions? Add tests.

---

### 10. Missing Input Validation at Boundaries

**Issue:** Database mutation accepted any trust_score/flags without validation.

```typescript
// BAD: No validation
async function updatePOITrustScore(
  poiId: string,
  trustScore: number,
  trustFlags: string[]
): Promise<void> {
  // Could store invalid values!
  await db.query(
    "UPDATE pois SET trust_score = $1, trust_flags = $2 WHERE id = $3",
    [trustScore, trustFlags, poiId]
  );
}

// GOOD: Validate at boundary
import { z } from "zod";

const UpdateTrustScoreSchema = z.object({
  poiId: z.string().uuid(),
  trustScore: z.number().min(0).max(1),
  trustFlags: z.array(
    z.enum([
      "no_website",
      "website_ok",
      "suspicious_domain",
      "permanently_closed",
      "suspicious_hours",
      "has_price_level",
      "found_on_tripadvisor",
      "found_on_yelp",
      "not_found_online",
      "manual_override",
    ])
  ),
});

type UpdateTrustScoreInput = z.infer<typeof UpdateTrustScoreSchema>;

async function updatePOITrustScore(
  input: UpdateTrustScoreInput
): Promise<void> {
  // Validate first
  const validated = UpdateTrustScoreSchema.parse(input);

  await db.query(
    "UPDATE pois SET trust_score = $1, trust_flags = $2, trust_score_updated_at = NOW() WHERE id = $3",
    [validated.trustScore, validated.trustFlags, validated.poiId]
  );
}

// At API boundary
export async function POST(request: Request) {
  const data = await request.json();

  try {
    await updatePOITrustScore(data);
    return new Response("Updated", { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify(error.errors), { status: 400 });
    }
    throw error;
  }
}
```

**Prevention Strategy:**

1. **Validate at system boundaries:**
   - API routes (before mutation)
   - Direct CLI/script calls (parse args with zod)
   - Admin UI forms (on submit)

2. **Use Zod for runtime validation:**
   ```typescript
   // Define once
   const TrustFlagSchema = z.enum([...]);
   const UpdateTrustSchema = z.object({
     trustScore: z.number().min(0).max(1),
     trustFlags: z.array(TrustFlagSchema),
   });

   // Reuse everywhere
   type UpdateTrust = z.infer<typeof UpdateTrustSchema>;
   ```

3. **Document input validation in JSDoc:**
   ```typescript
   /**
    * Update POI trust score.
    *
    * **Validation:**
    * - trustScore must be between 0.0 and 1.0 (inclusive)
    * - trustFlags must be known flag types (enum)
    * - poiId must be valid UUID
    *
    * Throws: ZodError if validation fails
    */
   export async function updatePOITrustScore(
     input: UpdateTrust
   ): Promise<void>;
   ```

4. **Test invalid inputs:**
   ```typescript
   test("rejects invalid trust score", async () => {
     await expect(
       updatePOITrustScore({
         poiId: "valid-uuid",
         trustScore: 1.5,  // Invalid!
         trustFlags: [],
       })
     ).rejects.toThrow(ZodError);
   });
   ```

**Checklist for Input Validation:**
- [ ] Data from user/API/external source? Validate with Zod.
- [ ] Database mutation? Validate inputs first.
- [ ] CLI script? Validate arguments.
- [ ] Tests for invalid inputs? Add rejection tests.

---

### 11. Nullable vs NOT NULL Array Columns

**Issue:** Inconsistency between `trust_flags TEXT[] | null` and `trust_flags TEXT[]`. Unclear default behavior.

```sql
-- BAD: Nullable array creates three states (NULL, [], ['flag1'])
ALTER TABLE pois ADD COLUMN trust_flags TEXT[];

-- GOOD: NOT NULL with default, only two states ([], ['flag1'])
ALTER TABLE pois ADD COLUMN trust_flags TEXT[] NOT NULL DEFAULT '{}';
```

```typescript
// When nullable, have to check both
if (poi.trustFlags === null || poi.trustFlags.length === 0) {
  // No flags set
}

// When NOT NULL default, simpler
if (poi.trustFlags.length === 0) {
  // No flags set
}
```

**Prevention Strategy:**

1. **Decide nullability upfront** — "Should this column ever be NULL, or should we use an empty default?"
   - **Trust flags:** Never null (always an array, possibly empty) → NOT NULL DEFAULT '{}'
   - **Nullable fields:** Explicitly represent "not set" state → NULL with no default
   - **Temporal data:** Explicitly represent "not yet happened" → NULL

2. **For array columns, prefer NOT NULL with default:**
   ```sql
   -- Good pattern
   ALTER TABLE pois ADD COLUMN trust_flags TEXT[] NOT NULL DEFAULT '{}';
   ALTER TABLE pois ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
   ALTER TABLE pois ADD COLUMN categories TEXT[] NOT NULL DEFAULT '{}';

   -- This pattern avoids three-state logic (null, [], [values])
   ```

3. **Document nullability in types:**
   ```typescript
   /**
    * Array of trust validation flags.
    *
    * Always non-null (empty array if no flags set).
    * Never NULL in database.
    */
   trustFlags: TrustFlag[];  // Not optional!

   /**
    * Optional metadata for the POI.
    *
    * Can be null if not provided.
    */
   metadata?: POIMetadata | null;
   ```

4. **Test default behavior:**
   ```typescript
   test("trust_flags defaults to empty array", async () => {
     const poi = await db.query(
       "INSERT INTO pois (name) VALUES ($1) RETURNING trust_flags",
       ["New POI"]
     );
     expect(poi.trustFlags).toEqual([]);  // Empty, not null
   });
   ```

**Checklist for Nullability:**
- [ ] New column: Is null meaningful or should we default?
- [ ] Array column: Use NOT NULL DEFAULT '{}' pattern.
- [ ] Temporal column: Use NULL to mean "not yet".
- [ ] Application code: Handle null vs empty appropriately.

---

## Summary Table: Prevention Patterns

| Issue | Prevention | Check During PR |
|-------|-----------|-----------------|
| **Untyped string unions** | Use TypeScript union types + Zod validation | Type: `string[]`? Suggest `string` union. |
| **SSRF/Redirect TOCTOU** | Manual redirect, validate each hop, test scenarios | Network fetch with `redirect: "follow"`? |
| **Missing DB constraints** | Add CHECK/ENUM for all bounded columns | Numeric column? CHECK constraint present? |
| **Non-discriminated unions** | Use tagged unions (discriminant field) | Result type with `optional` field? |
| **Inefficient batching** | Use concurrency pool (p-limit) | Promise.all on fixed chunks? |
| **Timer race conditions** | try/finally for timer cleanup | setTimeout without finally? |
| **Anchored patterns** | Document matching semantics, test boundaries | String pattern matching? |
| **Dead code** | Delete immediately, file issue instead | Unused constants? Request removal. |
| **Magic numbers** | Extract as named constants with rationale | Hardcoded threshold/limit? Extract. |
| **Missing input validation** | Zod at boundaries (API, CLI, mutations) | Data from outside? Validate with Zod. |
| **Nullable vs default** | Prefer NOT NULL with default for arrays | Array column nullable? Use default. |

---

## Code Review Checklist — POI Trust System and Similar Features

### Security
- [ ] Any network fetches? Using `redirect: "manual"`?
- [ ] Redirects allowed? Validating each hop?
- [ ] SSRF-vulnerable? Testing with malicious URLs?
- [ ] Input validation at boundaries? Zod schema present?
- [ ] SQL injection risks? Parameterized queries used?

### Type Safety
- [ ] String enums? Using union types + Zod?
- [ ] Result types? Discriminated union?
- [ ] Nullable fields? Intentional or oversight?
- [ ] Optional fields? Documenting when they're populated?

### Database Design
- [ ] Numeric columns? CHECK constraints present?
- [ ] Enum-like columns? CHECK constraint or SQL ENUM?
- [ ] Array columns? NOT NULL with default?
- [ ] Temporal data? Using NULL for "not yet"?

### Performance
- [ ] Batch operations? Using concurrency pool?
- [ ] Network I/O? Timeouts configured?
- [ ] Database indexes? For commonly filtered columns?

### Concurrency & Cleanup
- [ ] Timers created? try/finally cleanup present?
- [ ] Promise race? Handling all branches?
- [ ] Cleanup on error? Finally block runs always?

### Code Quality
- [ ] Dead code? Requesting removal?
- [ ] Magic numbers? Named constants with rationale?
- [ ] Constants documented? Why that value?
- [ ] Tests for boundaries? Happy + sad paths?

---

## Related Code Quality Documents

- **SSRF Prevention:** `docs/solutions/code-quality/ssrf-hardening-checklist.md` (if created)
- **Database Migration Patterns:** `docs/solutions/database-issues/` (check existing)
- **Type Safety:** `docs/solutions/code-quality/typescript-type-patterns.md` (if created)
- **Testing Strategies:** `docs/solutions/code-quality/testing-patterns.md` (if created)

---

## Conclusion

The POI trust validation system revealed common patterns in safety-critical code:

1. **Type safety** needs intentional design (unions, not strings)
2. **Security** requires defense-in-depth (validation at multiple layers)
3. **Concurrency** needs structured approaches (pools, not chunks)
4. **Database** needs constraints (not just application validation)
5. **Code hygiene** prevents technical debt (no dead code, named constants)

These lessons apply broadly to any system handling external data, network I/O, or security-sensitive operations.

**For future features:** Reference this guide during planning and code review. Use the checklists as conversation starters: "Are we handling this pattern correctly?"
