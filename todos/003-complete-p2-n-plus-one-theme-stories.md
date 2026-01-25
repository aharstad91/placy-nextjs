---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, performance, queries]
dependencies: []
---

# N+1 Query Pattern in getProjectThemeStories

## Problem Statement

`getProjectThemeStories()` har nested loops som utfører én database-query per theme story og én per section. Med 5 themes à 3 sections = 21 queries. Med 20 themes à 5 sections = 121 queries.

**Performance impact:** 121 queries × 50ms RTT = 6+ sekunder minimum responstid.

## Findings

**Performance Oracle Agent:**
> "Query count: O(T + T*S) where T = theme stories, S = avg sections per story. Network latency compounds: 121 queries * 50ms RTT = 6+ seconds minimum."

**Pattern Recognition Agent:**
> "N+1 query pattern in Theme Story Fetching. Creates O(N*M) database queries."

**Kode (`lib/supabase/queries.ts:314-371`):**
```typescript
for (const ts of themeStories) {
  // Query 1 per theme story
  const { data: sections } = await supabase
    .from("theme_story_sections")
    .select("*")
    .eq("theme_story_id", ts.id);

  for (const section of sections) {
    // Query 1 per section - nested N+1!
    const { data: sectionPois } = await supabase
      .from("theme_section_pois")
      .select("poi_id")
      .eq("section_id", section.id);
  }
}
```

## Proposed Solutions

### Option A: Batch Fetch with IN Clause (Recommended)
**Effort:** Small | **Risk:** Low

```typescript
export async function getProjectThemeStories(projectId: string): Promise<ThemeStory[]> {
  // Query 1: Alle theme stories
  const { data: themeStories } = await supabase
    .from("theme_stories")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  const themeStoryIds = themeStories.map(ts => ts.id);

  // Query 2: Alle sections for alle themes
  const { data: allSections } = await supabase
    .from("theme_story_sections")
    .select("*")
    .in("theme_story_id", themeStoryIds)
    .order("sort_order");

  const sectionIds = allSections.map(s => s.id);

  // Query 3: Alle POI-mappinger for alle sections
  const { data: allSectionPois } = await supabase
    .from("theme_section_pois")
    .select("*")
    .in("section_id", sectionIds)
    .order("sort_order");

  // Build lookup maps
  const sectionsByTheme = groupBy(allSections, 'theme_story_id');
  const poisBySection = groupBy(allSectionPois, 'section_id');

  // Assemble in memory
  return themeStories.map(ts => ({
    ...transformThemeStory(ts),
    sections: (sectionsByTheme[ts.id] || []).map(sec => ({
      ...transformSection(sec),
      pois: (poisBySection[sec.id] || []).map(sp => sp.poi_id)
    }))
  }));
}
```

**Pros:** 3 queries uansett datamengde, enkel implementasjon
**Cons:** Litt mer minne for lookup maps

### Option B: Single Query with JOINs
**Effort:** Medium | **Risk:** Low

Bruk Supabase nested select:
```typescript
const { data } = await supabase
  .from("theme_stories")
  .select(`
    *,
    theme_story_sections (
      *,
      theme_section_pois (poi_id)
    )
  `)
  .eq("project_id", projectId);
```

**Pros:** Single query
**Cons:** Kan bli kompleks med mange nivåer, må teste ytelse

## Recommended Action

<!-- Fylles ut under triage -->

## Technical Details

**Affected files:**
- `lib/supabase/queries.ts:314-371`
- Også samme mønster i `getProjectStorySections()` (linje 376-414)

**Expected improvement:**
- Fra: O(1 + N + N*M) queries
- Til: O(3) queries konstant

## Acceptance Criteria

- [ ] getProjectThemeStories bruker maks 3 database-queries
- [ ] Responstid redusert med 80%+ for prosjekter med mange themes
- [ ] Ingen funksjonell endring i output
- [ ] Samme fix anvendt på getProjectStorySections

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-25 | Created | Identifisert under plan review |

## Resources

- Supabase nested selects: https://supabase.com/docs/reference/javascript/select
