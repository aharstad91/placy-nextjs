/**
 * Server-only data loading functions
 * Uses fs for dynamic JSON loading - only import in Server Components
 *
 * WARNING: Do not import this file in client components - it uses Node.js fs module
 */

import type { Project } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import { getProjectFromSupabase } from "./supabase/queries";
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
 * Check if a project slug exists for a customer
 * SERVER ONLY
 */
export async function projectExists(
  customer: string,
  projectSlug: string
): Promise<boolean> {
  const project = await getProjectAsync(customer, projectSlug);
  return project !== null;
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

export interface SiblingProducts {
  explore?: string; // URL path like /customer/slug-explore
  guide?: string;
  report?: string;
}

/**
 * Find sibling product URLs for a given project
 * SERVER ONLY
 */
export async function getSiblingProducts(
  customer: string,
  projectSlug: string,
): Promise<SiblingProducts> {
  const base = getBaseSlug(projectSlug);

  const [hasReport, hasExplore, hasGuide] = await Promise.all([
    projectExists(customer, base),
    projectExists(customer, `${base}-explore`),
    projectExists(customer, `${base}-guide`),
  ]);

  const siblings: SiblingProducts = {};
  if (hasReport) siblings.report = `/${customer}/${base}`;
  if (hasExplore) siblings.explore = `/${customer}/${base}-explore`;
  if (hasGuide) siblings.guide = `/${customer}/${base}-guide`;

  return siblings;
}

/**
 * Load project data asynchronously - prefers Supabase when configured
 * SERVER ONLY - do not import in client components
 */
export async function getProjectAsync(
  customer: string,
  projectSlug: string
): Promise<Project | null> {
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    const project = await getProjectFromSupabase(customer, projectSlug);
    if (project) {
      return project;
    }
    console.warn(
      `Project ${customer}/${projectSlug} not found in Supabase, falling back to JSON`
    );
  }

  // Fall back to JSON (dynamic loading)
  return getProjectFromJSON(customer, projectSlug);
}
