import type { Project, ReportThemeGrounding } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes";
import {
  getBransjeprofil,
  resolveThemeId,
  GLOBAL_DISABLED_REPORT_THEMES,
} from "@/lib/themes";

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

  // Bygg sett av canonical-resolved tema-id-er som er deaktivert. Union av:
  //  1. Globale deaktiveringer (gjelder alle prosjekter, også untagged legacy)
  //  2. Per-bransjeprofil-deaktiveringer (kun gjeldende profil)
  // Resolver gjennom alias-mappen så både raw og legacy id-er matcher
  // (f.eks. "kultur-opplevelser" → "opplevelser").
  const disabledIds = new Set(
    [
      ...GLOBAL_DISABLED_REPORT_THEMES,
      ...(profil.features?.disabledThemes ?? []),
    ].map(resolveThemeId),
  );

  let themes: ReportThemeDefinition[];

  if (project.reportConfig?.themes) {
    // Build lookup from bransjeprofil themes (keyed by canonical ID)
    const profilByID = new Map(profil.themes.map((t) => [t.id, t]));

    themes = project.reportConfig.themes.map((rcTheme) => {
      const canonicalId = resolveThemeId(rcTheme.id);
      const base = profilByID.get(canonicalId);
      // Merge: bransjeprofil defaults ← reportConfig overrides
      return { ...base, ...rcTheme, id: canonicalId } as ReportThemeDefinition;
    });
  } else {
    themes = profil.themes.map((theme) => ({ ...theme }));
  }

  // Filtrer ut deaktiverte temaer. Skjer etter merge slik at canonical id-en
  // (post-resolveThemeId) er det vi sjekker mot.
  if (disabledIds.size === 0) return themes;
  return themes.filter((theme) => !disabledIds.has(theme.id));
}
