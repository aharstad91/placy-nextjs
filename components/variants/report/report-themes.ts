import type { Project, ReportThemeGrounding } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes";
import { getBransjeprofil, resolveThemeId } from "@/lib/themes";

/**
 * Report-specific theme config extends the shared ThemeDefinition
 * with editorial fields (intro, bridgeText).
 */
export interface ReportThemeDefinition extends ThemeDefinition {
  intro?: string;
  bridgeText?: string;
  upperNarrative?: string;
  leadText?: string;
  categoryDescriptions?: Record<string, string>;
  readMoreQuery?: string;
  /** Build-time Gemini-grounding (fra products.config). Zod-parses i report-data.ts. */
  grounding?: ReportThemeGrounding;
}

/**
 * Get report themes with override priority:
 * 1. project.reportConfig.themes — project-specific override, merged with bransjeprofil defaults
 * 2. bransjeprofil.themes — tag-driven
 * 3. DEFAULT_THEMES — global fallback (lowest)
 *
 * reportConfig themes often only have id + editorial fields (bridgeText, leadText,
 * categories). Missing name/icon/color are filled from the bransjeprofil definition.
 */
export function getReportThemes(project: Project): ReportThemeDefinition[] {
  const profil = getBransjeprofil(project.tags);

  if (project.reportConfig?.themes) {
    // Build lookup from bransjeprofil themes (keyed by canonical ID)
    const profilByID = new Map(profil.themes.map((t) => [t.id, t]));

    return project.reportConfig.themes.map((rcTheme) => {
      const canonicalId = resolveThemeId(rcTheme.id);
      const base = profilByID.get(canonicalId);
      // Merge: bransjeprofil defaults ← reportConfig overrides
      return { ...base, ...rcTheme, id: canonicalId } as ReportThemeDefinition;
    });
  }

  return profil.themes.map((theme) => ({ ...theme }));
}
