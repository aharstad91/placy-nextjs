---
status: complete
priority: p1
issue_id: "002"
tags: [code-review, data-integrity, storywriter]
dependencies: []
---

# Transaction Support for Story Structure Writes

## Problem Statement

`writeStoryStructure()` utfører flere sekvensielle database-operasjoner uten transaksjons-wrapper. Hvis en operasjon feiler midt i, blir data korrupt og urecoverable.

**Kritisk scenario:**
1. `linkPOIsToProject()` lykkes - gamle linker slettet, nye opprettet
2. `clearProjectStoryStructure()` lykkes - all story-struktur slettet
3. Insert `theme_stories` FEILER (nettverksfeil)
4. **Resultat:** Prosjekt har POI-linker men INGEN story-struktur

## Findings

**Data Integrity Guardian Agent:**
> "Multiple sequential inserts without transaction wrapper. A partial failure could result in inconsistent data with no clear indication."

**Architecture Strategist Agent:**
> "Non-atomic: If insert fails after delete, data is lost. Lock contention: Delete locks rows, preventing reads during regeneration."

**Kodeanalyse (`lib/supabase/mutations.ts:251-326`):**
```typescript
// Steg 1: Link POIs (destruktiv - sletter først)
await linkPOIsToProject(projectId, structure.projectPois);

// Steg 2: Slett eksisterende struktur (destruktiv)
await clearProjectStoryStructure(supabase, projectId);

// Steg 3-7: Insert nye data (kan feile)
if (structure.themeStories.length > 0) {
  const { error } = await supabase.from("theme_stories").insert(...);
  // Ingen rollback ved feil!
}
```

## Proposed Solutions

### Option A: Supabase RPC med Transaction (Recommended)
**Effort:** Medium | **Risk:** Low

Lag en PostgreSQL-funksjon som wrapper alle operasjoner i én transaksjon:

```sql
CREATE OR REPLACE FUNCTION write_story_structure_atomic(
  p_project_id TEXT,
  p_project_pois TEXT[],
  p_theme_stories JSONB,
  -- ... etc
) RETURNS void AS $$
BEGIN
  -- Alt i én transaksjon
  DELETE FROM project_pois WHERE project_id = p_project_id;
  INSERT INTO project_pois...;

  DELETE FROM theme_stories WHERE project_id = p_project_id;
  INSERT INTO theme_stories...;

  -- Hvis noe feiler, ruller alt tilbake automatisk
END;
$$ LANGUAGE plpgsql;
```

**Pros:** Garantert atomisitet, database håndterer rollback
**Cons:** Logikk i database, krever migration

### Option B: Compensating Transaction Pattern
**Effort:** High | **Risk:** Medium

Backup eksisterende data før destruktive operasjoner, restore ved feil:

```typescript
async function writeStoryStructureWithRollback(projectId: string, structure: GeneratedStructure) {
  const backup = await backupProjectStructure(projectId);

  try {
    await linkPOIsToProject(projectId, structure.projectPois);
    await clearProjectStoryStructure(supabase, projectId);
    // ... inserts
  } catch (error) {
    await restoreProjectStructure(projectId, backup);
    throw error;
  }
}
```

**Pros:** Kan implementeres uten database-endringer
**Cons:** Mer kompleks, ikke 100% race-safe

### Option C: Soft Delete + Swap Pattern
**Effort:** Medium | **Risk:** Low

1. Insert nye data med temp-flag
2. Slett gamle data
3. Fjern temp-flag fra nye

**Pros:** Minimerer downtime
**Cons:** Krever schema-endringer

## Recommended Action

<!-- Fylles ut under triage -->

## Technical Details

**Affected files:**
- `lib/supabase/mutations.ts:251-326` - writeStoryStructure
- `lib/supabase/mutations.ts:138-172` - linkPOIsToProject

**Tabeller involvert:**
- `project_pois`
- `theme_stories`
- `theme_story_sections`
- `theme_section_pois`
- `story_sections`
- `section_pois`

## Acceptance Criteria

- [ ] Story-regenerering er atomisk (alt eller ingenting)
- [ ] Ved feil: prosjekt beholder eksisterende struktur
- [ ] Test: Simuler nettverksfeil midt i write → verifiser data intakt
- [ ] Logging av rollback-hendelser

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-25 | Created | Identifisert under plan review |

## Resources

- Supabase RPC: https://supabase.com/docs/reference/javascript/rpc
- PostgreSQL Transactions: https://www.postgresql.org/docs/current/tutorial-transactions.html
