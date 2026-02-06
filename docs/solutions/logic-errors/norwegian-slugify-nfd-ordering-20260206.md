---
title: "Norwegian Slugify: æ/ø/å Replacements Must Precede NFD Normalization"
date: 2026-02-06
category: logic-errors
module: lib/utils
tags:
  - slugify
  - unicode
  - nfd-normalization
  - norwegian
  - i18n
  - data-integrity
severity: high
status: resolved
symptoms:
  - "æ in place names produces wrong output (e.g. 'Lærdal' → 'lardal' instead of 'laerdal')"
  - "5+ inline slugify implementations with inconsistent Norwegian handling"
  - "Potential duplicate POI IDs when same name slugified differently across code paths"
root_cause: "NFD normalization decomposes æ into base letter 'a' + combining character, discarding the 'e'. Norwegian replacements must happen BEFORE NFD."
affected_files:
  - lib/utils/slugify.ts
  - lib/generators/poi-discovery.ts
  - lib/generators/story-structure.ts
  - app/admin/projects/projects-admin-client.tsx
  - app/api/generate/route.ts
  - app/api/story-writer/route.ts
  - scripts/import-kommune-pois.ts
---

# Norwegian Slugify: æ/ø/å Replacements Must Precede NFD Normalization

## Problem

Multiple inline `slugify` implementations across the codebase used NFD normalization alone to strip diacritics. This silently produced wrong output for Norwegian characters.

**The bug:** Unicode NFD decomposes `æ` (U+00E6) into `a` (U+0061) + combining diaeresis (U+0308). The diacritic-stripping regex then removes the combining character, leaving just `a` — the `e` from the `ae` digraph is lost entirely.

| Input | NFD-only (wrong) | Correct |
|-------|-------------------|---------|
| Lærdal | lardal | laerdal |
| Ørsta | orsta | orsta (same) |
| Ålesund | alesund | alesund (same) |
| Færøyene | faroyene | faeroyene |

`ø` and `å` happen to produce acceptable results with NFD-only, but `æ` does not.

## Root Cause

8+ inline slugify implementations existed across the codebase:
- 5 in `scripts/import-*.ts` — NFD-only, no Norwegian handling
- 1 in `lib/generators/poi-discovery.ts` — NFD-only
- 1 in `lib/generators/story-structure.ts` — NFD-only
- 1 in `app/admin/projects/projects-admin-client.tsx` — had æ/ø/å handling but no NFD
- 1 in `app/api/generate/route.ts` — NFD-only
- 1 in `app/api/story-writer/route.ts` — NFD-only

No single implementation was correct. The admin client had Norwegian replacements but missed NFD for other diacritics (é, ü, etc.). All others had NFD but missed Norwegian.

## Solution

Created a canonical implementation at `lib/utils/slugify.ts`:

```typescript
/**
 * Canonical slugify with explicit Norwegian character handling.
 * CRITICAL: æ/ø/å replacements MUST happen BEFORE NFD normalization,
 * because NFD decomposes æ to "a" + combining char (losing the "e").
 */
export function slugify(text: string, maxLength = 63): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")   // 1. Norwegian FIRST
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")       // 2. Then NFD for everything else (é→e, ü→u)
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}
```

**Order matters:** Norwegian replacements → NFD → strip combining marks → clean.

Consolidated 6 call sites to import from `lib/utils/slugify`:
- `lib/generators/poi-discovery.ts`
- `lib/generators/story-structure.ts`
- `app/admin/projects/projects-admin-client.tsx`
- `app/api/generate/route.ts`
- `app/api/story-writer/route.ts`
- `scripts/import-kommune-pois.ts`

## Known Remaining Debt

5 scripts still have inline NFD-only slugify:
- `scripts/import-atb-stops.ts`
- `scripts/import-kml.ts`
- `scripts/import-bysykkel.ts`
- `scripts/import-taxi-stands.ts`
- `scripts/generate-story.ts`

These should be updated to `import { slugify } from "../lib/utils/slugify"`.

## Prevention

1. **Grep for inline slugify:** `grep -rn "normalize.*NFD" scripts/ lib/ app/` to find remaining inline implementations
2. **Single source of truth:** Always import from `lib/utils/slugify.ts`, never inline
3. **Rule of thumb:** For any language with composite characters (æ, ß, ij), do explicit replacements BEFORE NFD normalization

## References

- Commit: `a3b2053` feat: add /generate-hotel skill with canonical slugify
- Commit: `cf8221c` fix: address code review findings
- Related: `docs/solutions/data-import/import-external-geographic-data-20260125.md`
- Related: `docs/solutions/data-import/data-import-taxi-stands-20260125.md`
