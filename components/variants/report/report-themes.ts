import type { Project } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes";
import { DEFAULT_THEMES } from "@/lib/themes";

/**
 * Report-specific theme config extends the shared ThemeDefinition
 * with editorial fields (intro, bridgeText).
 */
export interface ReportThemeDefinition extends ThemeDefinition {
  intro?: string;
  bridgeText?: string;
}

/**
 * Default report themes — derived from the shared DEFAULT_THEMES.
 * Report may add intro/bridgeText per theme via reportConfig.
 */
export const REPORT_THEMES: ReportThemeDefinition[] = DEFAULT_THEMES.map(
  (theme) => ({ ...theme })
);

export function getReportThemes(project: Project): ReportThemeDefinition[] {
  if (project.reportConfig?.themes) {
    return project.reportConfig.themes;
  }
  return REPORT_THEMES;
}
