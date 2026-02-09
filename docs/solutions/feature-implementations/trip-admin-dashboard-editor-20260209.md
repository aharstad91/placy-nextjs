---
title: "Trip Library Admin Dashboard + Trip Editor"
category: feature-implementations
tags: [admin, trips, supabase, server-actions, nextjs]
module: admin
date: 2026-02-09
---

# Trip Library Admin Dashboard + Trip Editor (WP3A)

## Problem
Placy needed admin tools to create, edit, and manage trips in the Trip Library.

## Solution

### Architecture
- **Server component → client component split** matching existing admin pattern
- **Server actions** for all mutations (no API routes needed)
- **Admin queries** use `createServerClient()` (service_role) — bypass RLS for full access

### Files Created
| File | Purpose |
|------|---------|
| `app/admin/trips/page.tsx` | Dashboard server component — fetches all trips |
| `app/admin/trips/trips-admin-client.tsx` | Dashboard UI — table with client-side filtering |
| `app/admin/trips/[id]/page.tsx` | Editor server component — 9 server actions |
| `app/admin/trips/[id]/trip-editor-client.tsx` | Editor UI — Details + Stops tabs |

### Key Patterns

**Server actions for FormData mutations:**
```typescript
async function createTrip(formData: FormData) {
  "use server";
  const title = getRequiredString(formData, "title");
  // ... parse all fields
  const { data, error } = await supabase.from("trips").insert({...}).select("id").single();
  revalidatePath("/admin/trips");
  redirect(`/admin/trips/${data.id}`);
}
```

**POI search with debounce:**
- Server action returns serializable POI data
- Client uses 300ms debounce + `useRef` for timeout cleanup
- LIKE chars (`%`, `_`, `\`) escaped before query

**Stop reordering without drag-and-drop:**
- Up/down buttons swap `sort_order` values
- Batch update via JSON array in FormData
- JSON.parse validated before use

**Type casting for Supabase enums:**
```typescript
category: category as "food" | "culture" | ... | null,
difficulty: difficulty as "easy" | "moderate" | "challenging" | null,
season: (season || "all-year") as "spring" | ... | "all-year",
```

### Gotchas
1. **ConfirmDialog needs `isOpen` prop** — don't conditionally render the component
2. **`Set` iteration** needs `Array.from()` — use `Array.from(new Set(...))` not `[...new Set()]`
3. **URL slug readonly after creation** — prevent broken URLs by making slug read-only for existing trips
4. **Delete protection** — check `project_trips` count before allowing trip deletion
