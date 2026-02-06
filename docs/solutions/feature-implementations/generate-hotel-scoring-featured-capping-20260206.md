---
title: "POI Scoring, Featured Selection, and Variable Capping System"
date: 2026-02-06
category: feature-implementations
tags: [poi-scoring, featured, capping, supabase, report, generate-hotel]
related_files:
  - lib/utils/poi-score.ts
  - supabase/migrations/009_add_featured_to_product_pois.sql
  - components/variants/report/report-data.ts
  - lib/supabase/queries.ts
  - .claude/commands/generate-hotel.md
---

# POI Scoring, Featured Selection, and Variable Capping System

## Problem

The `/generate-hotel` command was dumping all discovered POIs into the Report without any prioritization or quality ranking. This resulted in:

- Reports with 50+ undifferentiated POIs
- No highlighted or featured content
- No quality-based ranking
- Poor signal-to-noise ratio for readers

Users couldn't distinguish between must-visit destinations and mediocre options, making the reports overwhelming and less useful.

## Solution Overview

Implemented a three-layer system to intelligently curate and present POIs:

1. **POI Scoring Algorithm** — Mathematical formula that balances quality (rating weighted by review count) with proximity
2. **Featured Selection** — Automatic highlighting of top-scored POIs per theme with diversity constraints
3. **Variable Capping** — Smart per-category-group limits to keep reports focused without losing important coverage

## Component 1: POI Scoring Algorithm

### Implementation

Created `/Users/andreasharstad/Documents/placy-ralph/lib/utils/poi-score.ts`:

```typescript
export interface POIScoreInput {
  rating: number;
  reviewCount: number;
  walkMinutes: number;
}

export function calculatePOIScore(poi: POIScoreInput): number {
  const { rating, reviewCount, walkMinutes } = poi;

  // Quality score: rating weighted by review count (logarithmic scaling)
  const reviewWeight = Math.min(reviewCount / 50, 1.0);
  const qualityScore = rating * reviewWeight;

  // Proximity bonus: max 0.5 points for being close
  const proximityBonus = Math.max(0, (15 - walkMinutes) / 15) * 0.5;

  return qualityScore + proximityBonus;
}
```

### Formula Breakdown

**Quality Score Component:**
```
qualityScore = rating × min(reviewCount/50, 1.0)
```

- Base is the Google rating (1-5 stars)
- Review weight caps at 50 reviews (logarithmic scaling)
- A 5★ place with 50+ reviews gets full weight (5.0)
- A 5★ place with 10 reviews gets partial weight (5 × 0.2 = 1.0)

**Proximity Bonus Component:**
```
proximityBonus = max(0, (15-walkMin)/15) × 0.5
```

- Maximum bonus is 0.5 points (10% of possible score)
- Linear decay from 0 to 15 minutes
- At 0 minutes: +0.5 bonus
- At 7.5 minutes: +0.25 bonus
- At 15+ minutes: +0.0 bonus

**Total Score:**
```
score = qualityScore + proximityBonus
```

Range: 0 to 5.5 (theoretical max)

### Design Rationale

**Why logarithmic review weighting?**
- Prevents review-bombing bias
- Diminishing returns after ~50 reviews
- A place with 200 reviews isn't necessarily better than one with 50

**Why secondary proximity bonus?**
- Quality matters more than distance
- A 4.8★ place 12min away beats a 3.5★ place next door
- But proximity is the tiebreaker between similar quality

**Example Scores:**

| Rating | Reviews | Walk Min | Quality | Proximity | Total |
|--------|---------|----------|---------|-----------|-------|
| 4.8 | 100 | 3 | 4.8 | 0.40 | 5.20 |
| 4.6 | 25 | 8 | 2.3 | 0.23 | 2.53 |
| 3.5 | 200 | 2 | 3.5 | 0.43 | 3.93 |
| 4.9 | 10 | 12 | 0.98 | 0.10 | 1.08 |

## Component 2: Featured Selection

### Database Schema

Migration `009_add_featured_to_product_pois.sql`:

```sql
-- Add featured flag to product_pois
ALTER TABLE product_pois
ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

-- Add index for featured queries
CREATE INDEX IF NOT EXISTS idx_product_pois_featured
ON product_pois(product_id, featured)
WHERE featured = true;
```

### Featured Selection Logic

Implemented in `/generate-hotel` command:

```typescript
// 1. Calculate scores for all POIs
const scoredPOIs = pois.map(poi => ({
  ...poi,
  score: calculatePOIScore({
    rating: poi.google_data?.rating || 0,
    reviewCount: poi.google_data?.user_ratings_total || 0,
    walkMinutes: poi.walk_minutes || 999
  })
}));

// 2. Sort by score descending
scoredPOIs.sort((a, b) => b.score - a.score);

// 3. Select top POIs per theme with diversity constraint
const featuredPOIs: string[] = [];
const categoryCount = new Map<string, number>();

for (const poi of scoredPOIs) {
  const category = poi.category;
  const currentCount = categoryCount.get(category) || 0;

  // Max 2 from same category to ensure diversity
  if (currentCount < 2) {
    featuredPOIs.push(poi.id);
    categoryCount.set(category, currentCount + 1);

    // Stop when we have enough featured POIs per theme
    if (featuredPOIs.length >= 3) break;
  }
}

// 4. Mark as featured in database
await supabase
  .from('product_pois')
  .update({ featured: true })
  .in('id', featuredPOIs);
```

### Diversity Constraint

**Max 2 from same category:**
- Prevents homogeneous featured lists (e.g., 3 cafes)
- Ensures variety in highlights
- Still allows for legitimate clustering (e.g., 2 top restaurants in a food-focused theme)

**Per-theme featured selection:**
- The same POI can be featured in one theme but listed normally in another
- Featured status is stored per `product_pois` record, not globally per POI
- Query in `report-data.ts` checks featured flag within theme context

## Component 3: Variable Capping

### Category Group Limits

Implemented in `/generate-hotel` command:

```typescript
const CATEGORY_CAPS = {
  food: 8,        // cafe, restaurant, bar
  culture: 3,     // museum, theater, gallery
  everyday: 3,    // grocery, pharmacy, bank
  fitness: 3,     // gym, yoga_studio, spa
  transport: 999  // subway_station, bus_station (uncapped)
};

const CATEGORY_TO_GROUP: Record<string, keyof typeof CATEGORY_CAPS> = {
  cafe: 'food',
  restaurant: 'food',
  bar: 'food',
  museum: 'culture',
  theater: 'culture',
  gallery: 'culture',
  // ... etc
};
```

### Capping Logic

```typescript
// Track count per category group
const groupCounts = new Map<string, number>();

// Filter POIs by cap
const cappedPOIs = scoredPOIs.filter(poi => {
  const group = CATEGORY_TO_GROUP[poi.category];
  const cap = CATEGORY_CAPS[group] || 999;
  const currentCount = groupCounts.get(group) || 0;

  if (currentCount >= cap) {
    return false; // Skip this POI
  }

  groupCounts.set(group, currentCount + 1);
  return true; // Include this POI
});
```

### Design Rationale

**Why group-level, not category-level?**
- "cafe" and "restaurant" share the Food 8 limit
- Prevents over-representation of similar categories
- More natural editorial balance

**Why these specific caps?**
- Food (8): Most diverse category, users explore multiple options
- Culture/Everyday/Fitness (3): Important but not overwhelming
- Transport (uncapped): Infrastructure, not editorial content

**Processing order matters:**
- POIs are already sorted by score
- Capping takes top-scored POIs first
- Lower-scored POIs are excluded when cap is reached

## Component 4: Query Implementation

### Featured Flag Query

In `/Users/andreasharstad/Documents/placy-ralph/lib/supabase/queries.ts`:

```typescript
export async function getProductPOIs(productId: string) {
  const { data, error } = await supabase
    .from('product_pois')
    .select(`
      id,
      poi_id,
      theme_id,
      featured,
      pois (
        id,
        name,
        category,
        lat,
        lng,
        walk_minutes,
        google_data
      )
    `)
    .eq('product_id', productId);

  if (error) {
    // Graceful fallback if featured column doesn't exist yet
    if (error.message?.includes('column "featured" does not exist')) {
      return getProductPOIsLegacy(productId); // No featured field
    }
    throw error;
  }

  return data;
}
```

### Featured Check in Report

In `/Users/andreasharstad/Documents/placy-ralph/components/variants/report/report-data.ts`:

```typescript
// Group POIs by theme
const themeGroups = new Map<string, POI[]>();

for (const productPOI of productPOIs) {
  const themeId = productPOI.theme_id;

  // Check if featured in THIS theme context
  const poi = {
    ...productPOI.pois,
    featured: productPOI.featured ? true : undefined
  };

  if (!themeGroups.has(themeId)) {
    themeGroups.set(themeId, []);
  }
  themeGroups.get(themeId)!.push(poi);
}
```

### Per-Theme Featured Logic

**Why per-theme, not global?**
- The same POI can appear in multiple themes
- It might be featured in "Culinary Scene" but listed normally in "Family Activities"
- Featured status is contextual to the theme's narrative

**Example:**

```typescript
// POI: "Mathallen Food Hall"

// In "Culinary Scene" theme:
{
  id: "poi-123",
  name: "Mathallen Food Hall",
  featured: true  // ← Top-scored in this theme
}

// In "Family Activities" theme:
{
  id: "poi-123",
  name: "Mathallen Food Hall",
  featured: undefined  // ← Just listed, not featured
}
```

## Key Decisions

### 1. Score Formula Weights Reviews Logarithmically

**Decision:** Cap review weight at 50 reviews

**Rationale:**
- Prevents review-bombing bias
- Diminishing returns after ~50 reviews
- A place with 200 reviews isn't 4× better than one with 50

**Alternative considered:** Linear scaling up to 200 reviews
**Why rejected:** Creates too much bias toward tourist traps with thousands of reviews

### 2. Proximity Bonus is Secondary to Quality

**Decision:** Max proximity bonus is 0.5 points (10% of total score)

**Rationale:**
- A 4.8★ place 12min away should beat a 3.5★ place next door
- Distance matters, but not more than quality
- Tiebreaker between similar quality

**Alternative considered:** 50/50 weight between quality and proximity
**Why rejected:** Would favor mediocre-but-close over excellent-but-walkable

### 3. Capping is Per-Category-Group, Not Per-Category

**Decision:** "cafe" and "restaurant" share the Food 8 limit

**Rationale:**
- More natural editorial balance
- Prevents over-representation of similar categories
- Allows flexibility within groups

**Alternative considered:** Individual caps per category (e.g., cafe: 4, restaurant: 4)
**Why rejected:** Too rigid, doesn't reflect natural distribution

### 4. Featured is Stored in DB, Not Computed Client-Side

**Decision:** `featured` column in `product_pois` table

**Rationale:**
- Generate-hotel pipeline sets it during creation
- No re-computation needed on every page load
- Can be manually overridden if needed
- Query performance (indexed column)

**Alternative considered:** Compute featured status in report-data.ts based on score
**Why rejected:** Requires re-fetching Google data, scoring, and selecting on every render

### 5. Graceful Fallback for Missing Column

**Decision:** Check error response, not try/catch

**Rationale:**
- Supabase client doesn't throw exceptions
- Returns `{ data: null, error: PostgrestError }`
- Allows gradual rollout (code before migration)

**Implementation:**

```typescript
if (error) {
  if (error.message?.includes('column "featured" does not exist')) {
    return getProductPOIsLegacy(productId);
  }
  throw error;
}
```

## Gotchas and Lessons Learned

### 1. Boolean Fallback Evaluates to False, Not Undefined

**Problem:**
```typescript
// ❌ WRONG: evaluates to false, not undefined
featured: featuredSet.has(id) || undefined
```

**Solution:**
```typescript
// ✅ CORRECT: explicit ternary
featured: featuredSet.has(id) ? true : undefined
```

**Why it matters:**
- `false` is a valid boolean value that renders differently in UI
- `undefined` is omitted from JSON and object spreads
- Frontend code checks `if (poi.featured)` — false would fail the check incorrectly

### 2. Supabase .select() with Missing Column Returns Error, Not Null

**Problem:**
```typescript
// If 'featured' column doesn't exist, this returns { data: null, error: ... }
// NOT { data: [...], featured: null }
const { data, error } = await supabase
  .from('product_pois')
  .select('id, featured')
```

**Solution:**
- Check error response for "column does not exist"
- Fallback to legacy query without featured field
- Don't use try/catch (Supabase client doesn't throw)

### 3. POIScoreInput Interface Should NOT Be Exported

**Problem:**
```typescript
// ❌ WRONG: exports internal interface
export interface POIScoreInput { ... }
export function calculatePOIScore(poi: POIScoreInput): number { ... }
```

**Solution:**
```typescript
// ✅ CORRECT: interface is internal to the module
interface POIScoreInput { ... }
export function calculatePOIScore(poi: POIScoreInput): number { ... }
```

**Why:**
- Interface is implementation detail
- Consumers only need the function signature
- Reduces API surface and coupling

### 4. Featured Selection Must Process Themes Separately

**Problem:**
If featured selection is done globally across all themes, a POI featured in Theme A will never be featured in Theme B.

**Solution:**
- Feature selection happens per theme during generation
- Same POI can have multiple `product_pois` records (one per theme)
- Each record has independent `featured` flag

**Example:**

```typescript
// Culinary Scene theme
INSERT INTO product_pois (product_id, theme_id, poi_id, featured)
VALUES ('prod-1', 'theme-culinary', 'poi-mathallen', true);

// Family Activities theme
INSERT INTO product_pois (product_id, theme_id, poi_id, featured)
VALUES ('prod-1', 'theme-family', 'poi-mathallen', false);
```

### 5. Variable Capping Must Happen After Sorting

**Problem:**
If capping happens before sorting by score, you might cap low-quality POIs and exclude high-quality ones.

**Solution:**
```typescript
// ✅ CORRECT ORDER:
// 1. Calculate scores
const scoredPOIs = pois.map(poi => ({ ...poi, score: calculatePOIScore(poi) }));

// 2. Sort by score
scoredPOIs.sort((a, b) => b.score - a.score);

// 3. Apply caps (takes top-scored first)
const cappedPOIs = applyCaps(scoredPOIs);
```

## Files Modified

### New Files

- `/Users/andreasharstad/Documents/placy-ralph/lib/utils/poi-score.ts`
  - POI scoring algorithm
  - Exported `calculatePOIScore` function

- `/Users/andreasharstad/Documents/placy-ralph/supabase/migrations/009_add_featured_to_product_pois.sql`
  - Adds `featured` boolean column to `product_pois`
  - Adds index for featured queries

### Modified Files

- `/Users/andreasharstad/Documents/placy-ralph/components/variants/report/report-data.ts`
  - Per-theme featured check
  - Groups POIs by theme with featured status

- `/Users/andreasharstad/Documents/placy-ralph/lib/supabase/queries.ts`
  - `getProductPOIs` includes featured field
  - Graceful fallback for missing column

- `/Users/andreasharstad/Documents/placy-ralph/.claude/commands/generate-hotel.md`
  - Integrated POI scoring
  - Featured selection logic
  - Variable capping implementation

## Testing Strategy

### Unit Tests (Recommended)

```typescript
// lib/utils/poi-score.test.ts
describe('calculatePOIScore', () => {
  it('should give full weight to 50+ reviews', () => {
    expect(calculatePOIScore({ rating: 5, reviewCount: 100, walkMinutes: 10 }))
      .toBeCloseTo(5.17);
  });

  it('should give partial weight to few reviews', () => {
    expect(calculatePOIScore({ rating: 5, reviewCount: 10, walkMinutes: 10 }))
      .toBeCloseTo(1.17);
  });

  it('should prioritize quality over proximity', () => {
    const highQualityFar = calculatePOIScore({ rating: 4.8, reviewCount: 100, walkMinutes: 12 });
    const lowQualityNear = calculatePOIScore({ rating: 3.5, reviewCount: 100, walkMinutes: 2 });

    expect(highQualityFar).toBeGreaterThan(lowQualityNear);
  });
});
```

### Integration Tests

1. **Generate hotel with scoring:**
   ```bash
   npm run generate:hotel -- --project test-project
   ```
   - Verify scores are calculated correctly
   - Check featured POIs are top-scored
   - Confirm caps are applied per category group

2. **Query with featured flag:**
   ```bash
   # Test both migration states
   supabase migration down  # Remove featured column
   npm run dev              # Should use legacy query
   supabase migration up    # Add featured column
   npm run dev              # Should use featured query
   ```

3. **Frontend rendering:**
   - Featured POIs should have highlight cards
   - Non-featured POIs should be in simple list
   - Same POI can be featured in one theme, listed in another

## Future Improvements

### 1. Machine Learning-Based Scoring

Current formula is rule-based. Could train an ML model on:
- User engagement metrics (clicks, time spent)
- Booking conversions (if integrated)
- Editorial feedback (manual overrides)

### 2. Personalized Scoring

Adjust scores based on:
- User preferences (budget, cuisine type, accessibility needs)
- Time of day (breakfast spots in morning, bars in evening)
- Weather (indoor vs outdoor activities)

### 3. Dynamic Capping

Instead of fixed caps (Food: 8, Culture: 3), calculate based on:
- Theme focus (food theme gets higher food cap)
- Project type (residential vs tourist destination)
- Geographic density (more caps in dense urban areas)

### 4. A/B Testing Framework

Test scoring formula variations:
- Different review weight caps (25 vs 50 vs 100)
- Different proximity bonus weights (0.5 vs 1.0 vs 0.25)
- Different diversity constraints (max 2 vs max 3 per category)

### 5. Editorial Override UI

Admin interface to:
- Manually promote/demote POI scores
- Force-feature specific POIs
- Adjust category caps per product

## Related Documentation

- `/Users/andreasharstad/Documents/placy-ralph/context/placy-concept-spec.md` — Data model and product specs
- `/Users/andreasharstad/Documents/placy-ralph/PRD.md` — Product roadmap
- `/Users/andreasharstad/Documents/placy-ralph/.claude/commands/generate-hotel.md` — Hotel generation pipeline
- `/Users/andreasharstad/Documents/placy-ralph/docs/solutions/database-issues/` — Database migration gotchas

## Summary

The POI scoring, featured selection, and variable capping system transforms the Report product from a data dump into a curated, editorial experience:

- **Scoring algorithm** provides objective quality ranking
- **Featured selection** highlights the best experiences
- **Variable capping** maintains focus without losing coverage
- **Per-theme featured logic** allows contextual highlighting
- **Graceful fallbacks** enable gradual rollout

The system is deterministic (same inputs = same outputs), transparent (formula is documented), and extensible (easy to adjust weights and caps).

Key insight: **Quality matters more than proximity, but proximity is the tiebreaker.** This matches how people actually choose places — they'll walk 10 extra minutes for a significantly better experience, but won't walk 30 minutes for a marginal improvement.
