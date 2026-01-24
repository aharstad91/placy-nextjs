---
module: Placy Admin
date: 2026-01-24
problem_type: best_practice
component: frontend_stimulus
symptoms:
  - "Need to build internal admin tool quickly"
  - "CRUD interface with map interaction"
  - "Server-side data with client-side interactivity"
root_cause: missing_workflow_step
resolution_type: workflow_improvement
severity: low
tags: [nextjs, admin, server-actions, supabase, mapbox, crud]
---

# Pattern: Next.js Admin Interface with Server Actions

## Context

Building an internal admin tool in Next.js 14 App Router with Supabase backend. Need CRUD operations, map interaction, and form handling.

## Environment
- Framework: Next.js 14 (App Router)
- Database: Supabase
- Map: Mapbox GL JS via react-map-gl
- Auth: Simple env-based protection (internal tool)
- Date: 2026-01-24

## The Pattern

### File Structure (Minimal)

```
/app/admin/[feature]/
  page.tsx              # Server Component + Server Actions
  [feature]-client.tsx  # Client Component (if needed)

/app/api/[external-api]/
  route.ts              # Only for proxying external APIs
```

**Key insight:** Don't create separate API routes for CRUD. Use Server Actions directly.

### Server Component with Server Actions

```typescript
// app/admin/pois/page.tsx
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/client";

// Auth check at module level
const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Server Actions - defined in same file
async function createItem(formData: FormData) {
  "use server";
  const supabase = createServerClient();
  const name = formData.get("name") as string;
  // ... insert to database
  revalidatePath("/admin/pois");
}

async function deleteItem(formData: FormData) {
  "use server";
  const supabase = createServerClient();
  const id = formData.get("id") as string;
  // ... delete from database
  revalidatePath("/admin/pois");
}

export default async function AdminPage() {
  if (!adminEnabled) redirect("/");

  const supabase = createServerClient();
  const { data } = await supabase.from("table").select("*");

  return <ClientComponent data={data} createItem={createItem} deleteItem={deleteItem} />;
}
```

### Client Component Pattern

```typescript
// app/admin/pois/poi-admin-client.tsx
"use client";

interface Props {
  data: Item[];
  createItem: (formData: FormData) => Promise<void>;
  deleteItem: (formData: FormData) => Promise<void>;
}

export function ClientComponent({ data, createItem, deleteItem }: Props) {
  const [formState, setFormState] = useState({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("name", formState.name);
    await createItem(formData);
    // Form resets, data refreshes via revalidatePath
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### External API Proxy (Only When Needed)

```typescript
// app/api/geocode/route.ts
// Only for external APIs that need server-side token
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${process.env.MAPBOX_TOKEN}`
  );

  return Response.json(await res.json());
}
```

## Why This Works

1. **Server Actions** eliminate need for API routes for CRUD
2. **revalidatePath** automatically refreshes data after mutations
3. **Module-level auth check** is simple and effective for internal tools
4. **Single file** for server logic reduces complexity
5. **Passing actions as props** keeps client components pure

## Anti-Patterns Avoided

| Anti-Pattern | Better Approach |
|--------------|-----------------|
| Separate API route per CRUD operation | Server Actions in page.tsx |
| Layout wrapper just for auth | Auth check in page component |
| Multiple component files for simple UI | Single client component |
| Client-side fetch for mutations | Server Actions |
| Complex auth middleware | Simple env check for internal tools |

## When to Use This Pattern

- Internal admin tools
- CRUD interfaces with 1-2 entity types
- Simple auth requirements (internal team only)
- Need for map/interactive elements

## When NOT to Use

- Public-facing admin (need proper auth)
- Complex multi-step workflows
- Multiple related entity types (consider separate pages)
- Need for real-time updates (consider WebSockets)

## Implementation Example

See the full implementation:
- `app/admin/pois/page.tsx` - Server component with actions
- `app/admin/pois/poi-admin-client.tsx` - Client component
- `app/api/geocode/route.ts` - External API proxy

## Related

- Plan: `docs/plans/2026-01-24-feat-native-poi-admin-interface-plan.md`
- Brainstorm: `docs/brainstorms/2026-01-24-native-poi-registration-brainstorm.md`
