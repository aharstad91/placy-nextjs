import type { Project } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes";
import { getBransjeprofil } from "@/lib/themes";

/**
 * Report-specific theme config extends the shared ThemeDefinition
 * with editorial fields (intro, bridgeText).
 */
export interface ReportThemeDefinition extends ThemeDefinition {
  intro?: string;
  bridgeText?: string;
  categoryDescriptions?: Record<string, string>;
}

/**
 * Get report themes with override priority:
 * 1. project.reportConfig.themes — project-specific override (highest)
 * 2. bransjeprofil.themes — tag-driven
 * 3. DEFAULT_THEMES — global fallback (lowest)
 */
export function getReportThemes(project: Project): ReportThemeDefinition[] {
  // 1. Project-specific override (existing behavior)
  if (project.reportConfig?.themes) {
    return project.reportConfig.themes;
  }
  // 2. Bransjeprofil from tag
  const profil = getBransjeprofil(project.tags);
  return profil.themes.map((theme) => ({ ...theme }));
}
