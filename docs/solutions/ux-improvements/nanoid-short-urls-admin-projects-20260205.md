---
title: "Nanoid Short URLs for Admin Project Pages"
date: 2026-02-05
category: ux-improvements
module: admin/projects
tags:
  - nanoid
  - short-url
  - url-structure
  - database-migration
  - supabase
  - admin-ux
  - backward-compatibility
  - routing
severity: low
status: resolved
symptoms:
  - Long unwieldy admin URLs
  - Difficult to share project links
  - Internal database IDs exposed in URLs
root_cause: URL structure used composite database ID (customer_slug_project_slug)
affected_files:
  - app/admin/projects/[id]/page.tsx
  - app/admin/projects/page.tsx
  - app/admin/projects/projects-admin-client.tsx
  - app/admin/projects/[id]/project-detail-client.tsx
  - supabase/migrations/008_add_project_short_id.sql
related_docs:
  - docs/solutions/database-issues/schema-mismatch-product-type-column-20260205.md
  - docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md
  - docs/brainstorms/2026-02-01-url-structure-product-routing-brainstorm.md
---

# Nanoid Short URLs for Admin Project Pages

## Problem

Admin project detail URLs were long and unwieldy:

```
/admin/projects/trondheim-kommune_prisbellonnet-arkitektur
```

This made URLs:
- Difficult to share and bookmark
- Exposed internal database structure (customer + slug concatenation)
- Prone to typos when manually entering

## Solution

Implement 7-character nanoid-based short URLs:

```
/admin/projects/WSLmYH8
```

## Implementation

### 1. Database Migration

**File:** `supabase/migrations/008_add_project_short_id.sql`

```sql
-- Add short_id column
ALTER TABLE projects ADD COLUMN short_id TEXT;

-- Create ID generator function
CREATE OR REPLACE FUNCTION generate_short_id(length INTEGER DEFAULT 7)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Generate for existing projects (with collision retry)
DO $$
DECLARE
  proj RECORD;
  new_short_id TEXT;
  attempts INTEGER;
BEGIN
  FOR proj IN SELECT id FROM projects WHERE short_id IS NULL LOOP
    attempts := 0;
    LOOP
      new_short_id := generate_short_id(7);
      attempts := attempts + 1;
      IF NOT EXISTS (SELECT 1 FROM projects WHERE short_id = new_short_id) THEN
        UPDATE projects SET short_id = new_short_id WHERE id = proj.id;
        EXIT;
      END IF;
      IF attempts > 100 THEN
        RAISE EXCEPTION 'Could not generate unique short_id';
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Add constraints
ALTER TABLE projects ALTER COLUMN short_id SET NOT NULL;
ALTER TABLE projects ADD CONSTRAINT projects_short_id_unique UNIQUE (short_id);
CREATE INDEX idx_projects_short_id ON projects(short_id);
```

### 2. Project Creation with nanoid

**File:** `app/admin/projects/page.tsx`

```typescript
import { nanoid } from "nanoid";

async function createProject(formData: FormData) {
  "use server";

  const shortId = nanoid(7);
  await supabase.from("projects").insert({
    id: containerId,
    short_id: shortId,
    // ... other fields
  });
}
```

### 3. Lookup with Backward Compatibility

**File:** `app/admin/projects/[id]/page.tsx`

```typescript
const { id: shortId } = await params;

// Try short_id first (new format)
const { data: projectByShortId } = await supabase
  .from("projects")
  .select("id, short_id, name, ...")
  .eq("short_id", shortId)
  .single();

if (projectByShortId) {
  project = projectByShortId;
} else {
  // Fall back to full id (backward compatibility)
  const { data: projectById } = await supabase
    .from("projects")
    .select("id, name, ...")
    .eq("id", shortId)
    .single();

  if (projectById) {
    project = { ...projectById, short_id: shortId };
  }
}
```

### 4. Server Actions with shortId for Revalidation

All server actions now accept `shortId` for path revalidation:

```typescript
async function updateProject(formData: FormData) {
  "use server";

  const id = getRequiredString(formData, "id");
  const shortId = getRequiredString(formData, "shortId");

  // ... update logic

  revalidatePath(`/admin/projects/${shortId}`);
}
```

### 5. Client Forms Pass shortId

```typescript
const formData = new FormData();
formData.set("id", project.id);
formData.set("shortId", project.short_id);
// ... other fields
await updateProject(formData);
```

## Key Design Decisions

1. **7-character length**: 62^7 = ~3.5 trillion combinations, sufficient for scale
2. **URL-safe characters**: `A-Za-z0-9` only, no encoding needed
3. **Backward compatibility**: Old URLs continue working via fallback lookup
4. **Dual ID system**: Keep full `id` for foreign keys, use `short_id` for URLs only

## Running the Migration

```bash
source .env.local && supabase db push --password "$DATABASE_PASSWORD"
```

## Verification

```sql
SELECT id, short_id, name FROM projects;
```

## Prevention

For future URL-based lookups:
- Use dedicated URL-safe columns (slug, short_id) instead of primary keys
- Keep internal IDs separate from user-facing identifiers
- Design for shareability from the start
