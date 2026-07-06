/**
 * Server-only data loading functions
 * Uses fs for dynamic JSON loading - only import in Server Components
 *
 * Cutover 2026-07-06: public-legacy-lesestien er fjernet — Supabase-lesing
 * går KUN via v2 (`lib/supabase/v2-queries.ts`). JSON-stien består som
 * fallback for demo-prosjekter i `data/projects/` og for miljø uten Supabase.
 *
 * WARNING: Do not import this file in client components - it uses Node.js fs module
 */

import type { Project, ProductType } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import { getProductFromSupabaseV2 } from "./supabase/v2-queries";
import * as fs from "fs";
import * as path from "path";

/**
 * Get project from JSON files dynamically
 * This reads from the filesystem at runtime, allowing new projects to be loaded
 * without restarting the server or adding manual imports.
 */
function getProjectFromJSON(customer: string, projectSlug: string): Project | null {
  try {
    const projectPath = path.join(process.cwd(), "data", "projects", customer, `${projectSlug}.json`);

    if (!fs.existsSync(projectPath)) {
      return null;
    }

    const content = fs.readFileSync(projectPath, "utf-8");
    const project = JSON.parse(content) as Project;
    if (!project.productType) {
      project.productType = "explorer";
    }
    return project;
  } catch (error) {
    console.error(`Failed to load project ${customer}/${projectSlug}:`, error);
    return null;
  }
}

/**
 * Derive sibling product slugs using naming convention:
 * - Report: {base-slug} (e.g. "quality-hotel-augustin")
 * - Explorer: {base-slug}-explore
 * - Guide: {base-slug}-guide
 *
 * Returns the base slug stripped of any product suffix.
 */
export function getBaseSlug(slug: string): string {
  if (slug.endsWith("-explore")) return slug.slice(0, -8);
  if (slug.endsWith("-guide")) return slug.slice(0, -6);
  return slug;
}

/**
 * Load legacy flat project data (JSON-only etter cutover — Supabase-flate
 * prosjekter fantes bare i public-skjemaet).
 * SERVER ONLY - do not import in client components
 */
export async function getProjectAsync(
  customer: string,
  projectSlug: string
): Promise<Project | null> {
  return getProjectFromJSON(customer, projectSlug);
}

/**
 * Load a specific product from a project container.
 * SERVER ONLY - do not import in client components
 */
export async function getProductAsync(
  customer: string,
  projectSlug: string,
  productType: ProductType
): Promise<Project | null> {
  if (isSupabaseConfigured()) {
    return getProductFromSupabaseV2(customer, projectSlug, productType);
  }

  // JSON fallback: derive slug from product type
  const baseSlug = getBaseSlug(projectSlug);
  let slug: string;
  switch (productType) {
    case "explorer":
      slug = `${baseSlug}-explore`;
      break;
    case "guide":
      slug = `${baseSlug}-guide`;
      break;
    case "report":
    default:
      slug = baseSlug;
      break;
  }

  return getProjectFromJSON(customer, slug);
}
