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
