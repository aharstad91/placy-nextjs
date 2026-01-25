---
title: Dynamic JSON Loading Pattern for Next.js Projects
date: 2026-01-25
problem_type: best_practice
component: data_architecture
severity: medium
tags: [nextjs, json, imports, dynamic-loading, server-components, fs]
related:
  - docs/solutions/best-practices/nextjs-admin-interface-pattern-20260124.md
  - docs/guides/EXTERNAL_DATA_IMPORTS.md
---

# Dynamic JSON Loading Pattern for Next.js Projects

## Problem

New projects generated via Story Generator GUI returned 404 errors because `lib/data.ts` used hardcoded static imports:

```typescript
// The problematic pattern - DON'T DO THIS
import ferjemannsveien10 from "@/data/projects/klp-eiendom/ferjemannsveien-10.json";
import testGenerator from "@/data/projects/klp-eiendom/test-generator.json";

const projects = {
  "klp-eiendom": {
    "ferjemannsveien-10": ferjemannsveien10,
    "test-generator": testGenerator,
  },
};
```

When the GUI created `teknostallen.json`, it wasn't in this registry, causing 404s.

## Symptoms

- New projects generated via GUI return 404
- Server restart doesn't help (file exists but isn't imported)
- Manual code changes required to add each new project

## Root Cause

Static imports are resolved at build/bundle time. Dynamically created files at runtime aren't included in the bundle and can't be accessed through the hardcoded registry pattern.

## Solution

Separate server-only code (with fs access) from client-compatible code.

### Step 1: Create server-only data loading module

**File:** `lib/data-server.ts`

```typescript
/**
 * Server-only data loading functions
 * Uses fs for dynamic JSON loading - only import in Server Components
 */
import type { Project } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import { getProjectFromSupabase } from "./supabase/queries";
import * as fs from "fs";
import * as path from "path";

function getProjectFromJSON(customer: string, projectSlug: string): Project | null {
  try {
    const projectPath = path.join(
      process.cwd(),
      "data",
      "projects",
      customer,
      `${projectSlug}.json`
    );

    if (!fs.existsSync(projectPath)) {
      return null;
    }

    const content = fs.readFileSync(projectPath, "utf-8");
    return JSON.parse(content) as Project;
  } catch (error) {
    console.error(`Failed to load project ${customer}/${projectSlug}:`, error);
    return null;
  }
}

export async function getProjectAsync(
  customer: string,
  projectSlug: string
): Promise<Project | null> {
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    const project = await getProjectFromSupabase(customer, projectSlug);
    if (project) return project;
  }

  // Fall back to JSON
  return getProjectFromJSON(customer, projectSlug);
}
```

### Step 2: Keep client module fs-free

**File:** `lib/data.ts`

```typescript
import type { Project, POI, ThemeStory } from "./types";

// Helper functions only - no fs imports
export function getPOI(project: Project, poiId: string): POI | undefined {
  return project.pois.find((poi) => poi.id === poiId);
}

export function getThemeStory(project: Project, id: string): ThemeStory | undefined {
  return project.story.themeStories.find((ts) => ts.id === id || ts.slug === id);
}

// ... other helper functions
```

### Step 3: Import from correct module in Server Components

**File:** `app/[customer]/[project]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import { getProjectAsync } from "@/lib/data-server"; // Server-only import
import ProjectPageClient from "./ProjectPageClient";

export default async function ProjectPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;
  const projectData = await getProjectAsync(customer, projectSlug);

  if (!projectData) {
    notFound();
  }

  return <ProjectPageClient project={projectData} />;
}
```

## Key Insight

**Separate data loading concerns by environment:**

| Environment | File | Can use fs? | Purpose |
|-------------|------|-------------|---------|
| Server Components | `lib/data-server.ts` | Yes | Dynamic JSON loading |
| Client Components | `lib/data.ts` | No | Helper functions only |

This enables:
- Dynamic project discovery without rebuilds
- No manual imports for new projects
- Type-safe data loading
- Supabase fallback for production

## When to Use Each Pattern

| Use Case | Static Import | Dynamic fs | Database |
|----------|--------------|-----------|----------|
| Demo/example data | Yes | No | No |
| User-generated content | No | Yes | Best |
| Config files | Yes | OK | No |
| Generated projects (CLI/GUI) | No | Yes | Best |
| Small fixed dataset | Yes | OK | No |

## Prevention Checklist

- [ ] All data loading through `getProjectAsync()` in Server Components
- [ ] No static `import` for JSON data files in app code
- [ ] fs paths use `process.cwd()` + `path.join()` (environment-safe)
- [ ] Client components only import from `lib/data.ts`
- [ ] Error handling logs failures clearly
- [ ] New files auto-discovered without code changes

## Red Flags (Anti-patterns)

- "We need to restart the dev server to see new projects"
- "Add this import when you create a new project"
- "Hardcoded paths in the projects registry"
- Using `fs` in files imported by Client Components

## Files Changed

- `lib/data-server.ts` - New: server-only dynamic loading
- `lib/data.ts` - Modified: removed fs imports, kept helpers
- `app/[customer]/[project]/page.tsx` - Modified: import from data-server
