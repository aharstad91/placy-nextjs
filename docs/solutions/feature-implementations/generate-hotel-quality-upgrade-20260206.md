---
title: "Generate Hotel Quality Upgrade — First Draft Optimization"
category: feature-implementations
tags: [generate-hotel, poi-scoring, featured, report, explorer, claude-code-skill, editorial, google-photos]
module: generate-hotel
date: 2026-02-06
symptom: "Generated hotel projects needed 45+ min manual QA"
root_cause: "Generic POI dump without scoring, capping, images, or editorial content"
---

# Generate Hotel Quality Upgrade — First Draft Optimization

## Problem

The original `/generate-hotel` Claude Code skill produced basic POI dumps that required extensive manual quality assurance:

**Issues:**
- All POI categories treated equally (no hierarchy or focus)
- No limit on POI count per theme (Reports became overwhelming)
- No featured highlights to guide user attention
- Missing images for key POIs
- No editorial text (heroIntro, bridgeText, editorialHook, localInsight)
- QA time: 45+ minutes per project to manually curate and enhance

**Result:** Generated projects were starting points, not first drafts. Required significant manual work to become production-ready.

## Solution

Upgraded `/generate-hotel` to produce high-quality first drafts through six interconnected patterns:

### 1. Byhotell-profil (City Hotel Profile)

**Purpose:** Standardized configuration for urban hotel projects with focused POI categories and city-specific search radii.

**Implementation:**
```typescript
// 14 Google Places categories mapped to 5 Report themes
const BYHOTELL_CATEGORIES = {
  'Mat & Drikke': ['restaurant', 'cafe', 'bar'],
  'Kultur': ['tourist_attraction', 'museum', 'art_gallery'],
  'Hverdagsbehov': ['supermarket', 'pharmacy', 'gym'],
  'Transport': ['transit_station', 'taxi_stand', 'bicycle_rental'],
  'Trening': ['gym', 'park']
};

// City-specific search radii
const CITY_RADIUS = {
  'Trondheim': 800,  // meters
  'Oslo': 1000,
  'Bergen': 600
};
```

**Report Theme Order:**
1. Mat & Drikke (primary focus — 8 POIs)
2. Kultur (secondary — 3 POIs)
3. Hverdagsbehov (tertiary — 3 POIs)
4. Transport (unlimited — all relevant stations)
5. Trening (minimal — 3 POIs)

**Why:** Matches hotel guest priorities — dining first, culture second, practical needs third. Transport is comprehensive (all options), while fitness is minimal (most hotels have gyms).

### 2. POI Scoring + Featured Highlights

**Purpose:** Rank POIs by quality AND proximity, automatically identify best-in-theme highlights.

**Scoring Formula:**
```typescript
// lib/utils/poi-score.ts
export function calculatePOIScore(poi: POI): number {
  const rating = poi.googleData?.rating || 3.0;
  const reviewCount = poi.googleData?.reviewCount || 0;
  const walkMin = poi.googleData?.walkMin || 15;

  // Quality component: rating weighted by review density
  const qualityScore = rating * Math.min(reviewCount / 50, 1.0);

  // Proximity bonus: closer = better (max 0.5 points)
  const proximityBonus = Math.max(0, (15 - walkMin) / 15) * 0.5;

  return qualityScore + proximityBonus;
}
```

**Example Scores:**
- 4.5★ with 100 reviews, 3 min walk: `4.5 × 1.0 + 0.8 = 5.3` (excellent)
- 4.2★ with 25 reviews, 10 min walk: `4.2 × 0.5 + 0.17 = 2.27` (average)
- 3.8★ with 200 reviews, 1 min walk: `3.8 × 1.0 + 0.93 = 4.73` (good)

**Featured Flag:**
```sql
-- supabase/migrations/009_add_featured_to_product_pois.sql
ALTER TABLE product_pois
ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_product_pois_featured
ON product_pois(featured)
WHERE featured = true;
```

**Selection Logic:**
```typescript
// Top scorer per theme gets featured flag
const topPOIPerTheme = themes.map(theme => {
  const themePOIs = allPOIs.filter(poi => poi.theme === theme.name);
  const scored = themePOIs.map(poi => ({
    ...poi,
    score: calculatePOIScore(poi)
  }));
  return scored.sort((a, b) => b.score - a.score)[0];
});

// Mark as featured in product_pois table
await supabase
  .from('product_pois')
  .update({ featured: true })
  .in('poi_id', topPOIPerTheme.map(p => p.id));
```

### 3. Variable Capping

**Purpose:** Keep Report focused by limiting POIs per theme based on guest priorities.

**Implementation:**
```typescript
// components/variants/report/report-data.ts
const THEME_CAPS = {
  'Mat & Drikke': 8,    // Primary focus — diverse dining options
  'Kultur': 3,          // Key attractions only
  'Hverdagsbehov': 3,   // Essential services
  'Transport': Infinity, // All transit options (no cap)
  'Trening': 3          // Minimal — hotels usually have gyms
};

function getThemePOIs(allPOIs: POI[], theme: string): POI[] {
  const cap = THEME_CAPS[theme] || 5;
  const themePOIs = allPOIs.filter(poi => poi.theme === theme);

  // Sort by score, take top N
  return themePOIs
    .map(poi => ({ ...poi, score: calculatePOIScore(poi) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}
```

**Why These Caps:**
- **Mat 8:** Diverse options (fine dining, casual, cafe, bar) — most important to guests
- **Kultur 3:** Top attractions only — guests research these themselves
- **Hverdag 3:** Essential services (pharmacy, grocery) — not central to experience
- **Transport ∞:** All options needed for comprehensive transit info
- **Trening 3:** Minimal — most hotels have fitness centers

### 4. Google Photos for Featured POIs Only

**Purpose:** Reduce API costs while ensuring key POIs have visual appeal.

**Implementation:**
```typescript
// .claude/commands/generate-hotel.md (Step 9)
for (const poi of featuredPOIs) {
  if (!poi.googleData?.photoReference) {
    const photo = await googlePlaces.getPlacePhotos(poi.googleData.placeId);
    await supabase
      .from('pois')
      .update({
        googleData: {
          ...poi.googleData,
          photoReference: photo.reference
        }
      })
      .eq('id', poi.id);
  }
}
```

**API Efficiency:**
- 5-10 featured POIs per project
- 1 photo per POI
- Total: 5-10 API calls (vs 50+ for all POIs)

**Image Resolution Chain:**
```tsx
// components/variants/report/ReportHighlightCard.tsx
const imageSrc =
  poi.featuredImage ||  // Manual upload (highest priority)
  (poi.googleData?.photoReference
    ? `/api/places/photo?reference=${encodeURIComponent(poi.googleData.photoReference)}&maxwidth=800`
    : null);  // No fallback — card works without image

// Use native <img> instead of Next.js <Image>
{imageSrc && (
  <img
    src={imageSrc}
    alt={poi.name}
    className="w-full h-48 object-cover"
  />
)}
```

**Why `<img>` not `<Image>`:**
- Local API proxy `/api/places/photo` doesn't support Next.js Image Optimization
- Adds complexity without benefit for our use case
- Native `<img>` is simpler and works perfectly with proxy

**Gotcha:** Always `encodeURIComponent` on photoReference in URL params — Google references contain special characters.

### 5. AI Text Generation

**Purpose:** Add editorial voice to Reports — heroIntro per project, bridgeText per theme, editorialHook/localInsight per POI.

**13-Step Pipeline:**
```markdown
# .claude/commands/generate-hotel.md

## Step 11: Generate Editorial Text
1. heroIntro (project overview)
2. bridgeText per theme (theme intro)
3. editorialHook per POI (what makes it special)
4. localInsight per POI (insider knowledge)

**Editorial Guidelines:**
- Tone: Monocle/Kinfolk (sophisticated, curious, understated)
- Length: heroIntro 2-3 sentences, bridgeText 1 sentence, hooks 1 sentence
- Voice: "Vi elsker...", "Et must for...", "Her finner du..."
- Grounding: Use WebSearch for factual verification
- Exclusions: Skip transport POIs (no editorial needed)
```

**Implementation Example:**
```typescript
// Generate heroIntro
const heroPrompt = `
Write a 2-3 sentence heroIntro for ${projectName} in ${city}.
Tone: Monocle/Kinfolk (sophisticated, curious, understated).
Focus: Location's urban character and proximity to key experiences.
Use WebSearch to verify facts.
`;

const heroIntro = await generateWithWebSearch(heroPrompt);

// Update project
await supabase
  .from('projects')
  .update({
    texts: {
      ...project.texts,
      heroIntro
    }
  })
  .eq('id', projectId);
```

**bridgeText Display:**
```tsx
// components/variants/report/ReportThemeSection.tsx
<section className="theme-section">
  <h2>{theme.name}</h2>
  {theme.bridgeText && (
    <p className="bridge-text">{theme.bridgeText}</p>
  )}
  <div className="pois-grid">
    {theme.pois.map(poi => <POICard key={poi.id} poi={poi} />)}
  </div>
</section>
```

### 6. Automated QA Checks

**Purpose:** Verify quality completeness before handoff — catch missing items, offer auto-fixes.

**4 Verification Categories:**
```typescript
// .claude/commands/generate-hotel.md (Step 13)

// 1. POI Coverage Per Theme
const coverage = themes.map(theme => ({
  theme: theme.name,
  expected: THEME_CAPS[theme.name],
  actual: theme.pois.length,
  status: theme.pois.length >= (THEME_CAPS[theme.name] || 3) ? 'OK' : 'LOW'
}));

// 2. Image Coverage (Featured POIs)
const imageCheck = featuredPOIs.map(poi => ({
  poi: poi.name,
  hasImage: !!(poi.featuredImage || poi.googleData?.photoReference),
  status: poi.featuredImage || poi.googleData?.photoReference ? 'OK' : 'MISSING'
}));

// 3. Editorial Text Coverage
const textCheck = {
  heroIntro: !!project.texts?.heroIntro,
  bridgeTexts: themes.filter(t => t.bridgeText).length,
  editorialHooks: pois.filter(p => p.editorialHook).length,
  localInsights: pois.filter(p => p.localInsight).length
};

// 4. Report Texts (heroIntro + bridgeTexts)
const reportTextCheck = {
  heroIntro: !!project.texts?.heroIntro ? 'OK' : 'MISSING',
  bridgeTexts: themes.map(t => ({
    theme: t.name,
    status: t.bridgeText ? 'OK' : 'MISSING'
  }))
};
```

**Auto-Fix Offers:**
```typescript
// If checks fail, offer to run specific steps
if (imageCheck.some(c => c.status === 'MISSING')) {
  console.log('Some featured POIs missing images. Run Step 9 again?');
}

if (!textCheck.heroIntro) {
  console.log('Missing heroIntro. Run Step 11 (heroIntro generation)?');
}

if (textCheck.bridgeTexts < themes.length) {
  console.log(`Missing ${themes.length - textCheck.bridgeTexts} bridgeTexts. Run Step 11 (bridgeText generation)?`);
}
```

## Per-Theme Featured Flag Check Pattern

**Critical Implementation Detail:**

**Problem:** If you check `hasFeaturedFlags` globally across all POIs, themes without featured flags will skip the featured-first logic even though other themes have featured POIs.

**Wrong Approach:**
```typescript
// DON'T DO THIS — checks globally
const allPOIs = await getAllPOIs(projectId);
const hasFeaturedFlags = allPOIs.some(poi => poi.featured);

themes.forEach(theme => {
  const themePOIs = allPOIs.filter(poi => poi.theme === theme.name);
  if (hasFeaturedFlags) {
    // Will apply to ALL themes, even those without featured flags
    return themePOIs.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }
});
```

**Correct Approach:**
```typescript
// components/variants/report/report-data.ts
export async function getReportData(projectId: string) {
  const allPOIs = await getAllPOIsWithFeatured(projectId);

  const themeData = REPORT_THEMES.map(theme => {
    const themePOIs = allPOIs.filter(poi => poi.theme === theme.name);

    // Check PER THEME if any POI has featured flag
    const hasFeaturedInTheme = themePOIs.some(poi => poi.featured);

    let sortedPOIs;
    if (hasFeaturedInTheme) {
      // Featured-first sort for this theme
      sortedPOIs = themePOIs.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return (b.googleData?.rating || 0) - (a.googleData?.rating || 0);
      });
    } else {
      // Rating-only fallback for this theme
      sortedPOIs = themePOIs.sort((a, b) =>
        (b.googleData?.rating || 0) - (a.googleData?.rating || 0)
      );
    }

    return {
      ...theme,
      pois: sortedPOIs.slice(0, theme.cap || 5)
    };
  });

  return themeData;
}
```

**Why This Matters:**
- Themes are independent — Mat & Drikke may have featured flags, but Transport might not
- Per-theme check ensures each theme uses the best available logic
- Graceful degradation: themes without featured flags fall back to rating sort
- Maintains consistency: all themes follow the same pattern (featured-first if available, rating fallback otherwise)

## Key Gotchas

### 1. Supabase Client Error Handling

**Issue:** Supabase JS client doesn't throw exceptions when querying non-existent columns — returns `{ data: [], error: null }`.

**Wrong:**
```typescript
try {
  const { data } = await supabase
    .from('product_pois')
    .select('featured')  // Column doesn't exist yet
    .eq('project_id', projectId);

  // data will be [], no exception thrown
  console.log(data);  // []
} catch (error) {
  // This won't catch the missing column
}
```

**Correct:**
```typescript
const { data, error } = await supabase
  .from('product_pois')
  .select('featured')
  .eq('project_id', projectId);

if (error) {
  console.error('Column may not exist yet:', error);
  // Fallback to rating-based sort
  return fallbackSort(pois);
}

// Safe to use data
return data;
```

**Prevention:** Always check `error` response, even for read operations. Migrations must run before code that depends on new columns.

### 2. Boolean Fallback Logic

**Issue:** `featured: set.has(id) || undefined` evaluates to `false` (not `undefined`) when `set.has(id)` is false, causing Supabase to store `false` instead of omitting the field.

**Wrong:**
```typescript
const featuredSet = new Set(featuredPOIIds);

const poiData = pois.map(poi => ({
  poi_id: poi.id,
  featured: featuredSet.has(poi.id) || undefined  // BAD: false || undefined = false
}));

// Supabase will insert featured: false for all non-featured POIs
```

**Correct:**
```typescript
const featuredSet = new Set(featuredPOIIds);

const poiData = pois.map(poi => ({
  poi_id: poi.id,
  featured: featuredSet.has(poi.id) ? true : undefined  // GOOD: explicit ternary
}));

// Non-featured POIs omit the field, defaulting to false via DB constraint
```

**Better (Migration Handles Default):**
```sql
-- Migration handles the default, so explicit false is fine
ALTER TABLE product_pois
ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false;
```

```typescript
// Now explicit false is OK — migration ensures consistency
const poiData = pois.map(poi => ({
  poi_id: poi.id,
  featured: featuredSet.has(poi.id)  // true or false, both valid
}));
```

**Prevention:** Use explicit ternary for optional boolean fields, OR ensure migration has `NOT NULL DEFAULT false` constraint.

### 3. URL Parameter Encoding

**Issue:** Google `photoReference` contains special characters (`/`, `+`, `=`) that break URL params if not encoded.

**Wrong:**
```typescript
const photoUrl = `/api/places/photo?reference=${poi.googleData.photoReference}`;
// Breaks if photoReference contains /foo/bar+baz=
```

**Correct:**
```typescript
const photoUrl = `/api/places/photo?reference=${encodeURIComponent(poi.googleData.photoReference)}`;
// Safely encodes all special characters
```

**Prevention:** Always `encodeURIComponent` on dynamic URL params, especially external IDs.

### 4. Migration Timing

**Issue:** Deploying code that queries `featured` column before migration runs will fail silently.

**Wrong:**
```typescript
// Deploy code first
const { data } = await supabase
  .from('product_pois')
  .select('featured');  // Column doesn't exist yet

// Then run migration
// Too late — code already failed in production
```

**Correct:**
```bash
# Run migration first
source .env.local && supabase db push --password "$DATABASE_PASSWORD"

# Then deploy code that uses new column
git push origin main
```

**Prevention:** Migrations ALWAYS before code that depends on them. Add migration run to deployment checklist.

### 5. Per-Theme Featured Check

**Issue:** Checking `hasFeaturedFlags` globally causes themes without featured flags to incorrectly use featured-first logic.

**Wrong:**
```typescript
const hasFeaturedFlags = allPOIs.some(poi => poi.featured);  // Global check

themes.forEach(theme => {
  if (hasFeaturedFlags) {
    // Applies to ALL themes, even those without featured flags
  }
});
```

**Correct:**
```typescript
themes.forEach(theme => {
  const themePOIs = allPOIs.filter(poi => poi.theme === theme.name);
  const hasFeaturedInTheme = themePOIs.some(poi => poi.featured);  // Per-theme check

  if (hasFeaturedInTheme) {
    // Only applies to THIS theme
  }
});
```

**Prevention:** Featured flag checks must be scoped to theme-filtered POI subset, not global POI list.

## Prevention Checklist

**Before Implementing Featured Flags:**
- [ ] Run migration adding `featured` column with `NOT NULL DEFAULT false`
- [ ] Verify migration applied: `supabase migration list`
- [ ] Test Supabase query returns `error: null` for `featured` column
- [ ] Add index on `featured` column for performance
- [ ] Document per-theme check pattern in code comments

**Before Deploying Photo Proxying:**
- [ ] Verify `encodeURIComponent` on all photoReference URLs
- [ ] Test with photoReferences containing `/`, `+`, `=` characters
- [ ] Document fallback chain: featuredImage → photoReference → null
- [ ] Confirm native `<img>` works with local API proxy

**Before Running AI Text Generation:**
- [ ] Configure WebSearch API access
- [ ] Test tone guidelines with sample prompts
- [ ] Verify bridgeText rendering in ReportThemeSection
- [ ] Document exclusion of transport POIs

**Before Handoff:**
- [ ] Run Step 13 QA checks
- [ ] Verify all featured POIs have images
- [ ] Confirm heroIntro + bridgeTexts present
- [ ] Check POI counts match theme caps
- [ ] Document any manual overrides needed

## References

**Files:**
- `.claude/commands/generate-hotel.md` — 13-step pipeline
- `lib/utils/poi-score.ts` — scoring formula
- `components/variants/report/report-data.ts` — variable capping + per-theme featured
- `components/variants/report/ReportHighlightCard.tsx` — image display with fallback chain
- `components/variants/report/ReportThemeSection.tsx` — bridgeText display
- `components/variants/report/report-themes.ts` — theme definitions with expanded categories
- `lib/supabase/queries.ts` — featured query with graceful fallback
- `supabase/migrations/009_add_featured_to_product_pois.sql` — featured column migration

**Related Solutions:**
- `docs/solutions/architecture-patterns/` — Database schema patterns
- `docs/solutions/ui-patterns/` — Image fallback patterns
- `docs/solutions/best-practices/` — API optimization strategies

**Migration Commands:**
```bash
# Run migration
source .env.local && supabase db push --password "$DATABASE_PASSWORD"

# Verify status
source .env.local && supabase migration list --password "$DATABASE_PASSWORD"

# Mark as applied (if needed)
source .env.local && supabase migration repair 009 --status applied --password "$DATABASE_PASSWORD"
```

**Generate Hotel Command:**
```bash
# Run full pipeline
/generate-hotel "Hotel Name" "City Name" "lat,lng"

# Run specific steps (if QA fails)
# Step 9: Fetch photos for featured POIs
# Step 11: Generate editorial text
# Step 13: Run QA checks
```

---

**Impact:**
- QA time: 45+ min → ~5 min per project
- API calls: 50+ → 5-10 (photo fetching only)
- First draft quality: Basic POI dump → Production-ready Report
- Consistency: Manual curation → Automated scoring + capping
- Visual appeal: No images → Featured POIs with photos
- Editorial voice: Generic → Monocle/Kinfolk tone

**Next Steps:**
- Extend scoring formula to consider opening hours (breakfast-friendly restaurants, 24h pharmacies)
- Add seasonal adjustments (outdoor dining in summer, cozy cafes in winter)
- Implement user feedback loop to refine scoring weights
- Expand Byhotell-profil to other hotel types (resort, boutique, budget)
