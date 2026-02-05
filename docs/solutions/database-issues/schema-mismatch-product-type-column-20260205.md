---
title: "500 Error from Non-Existent product_type Column After Migration"
date: 2026-02-05
category: database-issues
module: admin/projects
tags:
  - supabase
  - database-schema
  - migration
  - 500-error
  - project-hierarchy
  - runtime-error
  - typescript
severity: high
status: resolved
symptoms:
  - 500 Internal Server Error on project detail page
  - Blank page when navigating to /admin/projects/[id]
  - Supabase query fails with "column does not exist" error
root_cause: Code querying removed database column after schema migration
affected_files:
  - app/admin/projects/[id]/page.tsx
  - app/admin/projects/[id]/project-detail-client.tsx
related_migrations:
  - 006_project_hierarchy_ddl.sql
---

# 500 Error from Non-Existent product_type Column After Migration

## Problem

After deploying the project hierarchy migration, the project detail page at `/admin/projects/[id]` returned a 500 error / blank page.

**Error observed:**
```
column projects.product_type does not exist
```

## Root Cause

The project hierarchy migration (006) restructured the database:
- Old: `projects` table had a `product_type` column (explorer/report/guide)
- New: Products are stored in a separate `products` table with `product_type`

The migration renamed the old `projects` table to `projects_legacy` and created a new `projects` table WITHOUT the `product_type` column. However, the code still referenced `product_type` in:
1. SELECT queries
2. TypeScript interfaces
3. Server Actions
4. UI form fields

## Solution

Remove all references to `product_type` on the `projects` table.

### 1. Remove from SELECT query

**File:** `app/admin/projects/[id]/page.tsx`

```typescript
// BEFORE (broken)
const { data: project } = await supabase
  .from("projects")
  .select(`
    id, name, url_slug,
    product_type,  // <-- Remove this
    center_lat, center_lng,
    customer_id, customers (id, name)
  `)

// AFTER (fixed)
const { data: project } = await supabase
  .from("projects")
  .select(`
    id, name, url_slug,
    center_lat, center_lng,
    customer_id, customers (id, name)
  `)
```

### 2. Remove from TypeScript interface

```typescript
// BEFORE
export interface ProjectWithRelations {
  id: string;
  name: string;
  product_type: string;  // <-- Remove
  // ...
}

// AFTER
export interface ProjectWithRelations {
  id: string;
  name: string;
  products: Array<ProductWithPois>;  // <-- Products now from separate table
  // ...
}
```

### 3. Remove from Server Action

```typescript
// BEFORE
async function updateProject(formData: FormData) {
  const productType = getRequiredString(formData, "productType");  // Remove

  await supabase.from("projects").update({
    product_type: productType,  // Remove
    // ...
  })
}

// AFTER
async function updateProject(formData: FormData) {
  await supabase.from("projects").update({
    name,
    url_slug: urlSlug,
    center_lat: centerLat,
    center_lng: centerLng,
  })
}
```

### 4. Remove from UI form

**File:** `app/admin/projects/[id]/project-detail-client.tsx`

Remove the entire `productType` state and dropdown:

```typescript
// Remove these lines:
const [productType, setProductType] = useState(project.product_type);
formData.set("productType", productType);

// Remove the select dropdown from the form
```

## Prevention

### 1. Regenerate TypeScript types after migrations

```bash
# Add to package.json scripts
"db:types": "supabase gen types typescript --project-id $PROJECT_ID > lib/database.types.ts"

# Run after any migration
npm run db:types
```

### 2. Add type checking to CI

```yaml
# .github/workflows/ci.yml
- name: Check TypeScript
  run: npx tsc --noEmit
```

### 3. Use type-safe Supabase client

```typescript
import { Database } from '@/lib/database.types'

const supabase = createClient<Database>(url, key)

// Now TypeScript will error if you query non-existent columns
const { data } = await supabase
  .from('projects')
  .select('product_type')  // TypeScript error!
```

### 4. Migration checklist

Before merging any migration PR:
- [ ] Run `npm run db:types` to regenerate types
- [ ] Run `tsc --noEmit` to check for type errors
- [ ] Search codebase for removed column names: `grep -r "product_type" app/ lib/`
- [ ] Update all affected interfaces and queries

## Related Documentation

- [Project Hierarchy Restructure Plan](../../plans/2026-02-05-feat-project-hierarchy-restructure-plan.md)
- [Migration 006: Project Hierarchy DDL](../../../supabase/migrations/006_project_hierarchy_ddl.sql)

## Key Takeaway

When removing database columns, always:
1. Search the entire codebase for references
2. Regenerate TypeScript types from schema
3. Run type checking before deploying
