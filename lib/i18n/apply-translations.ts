/**
 * Apply translations to a Project by overlaying translated texts.
 *
 * When locale is "no", returns project unchanged.
 * When locale is "en", replaces editorial/report texts with English translations
 * where available, falling back to the Norwegian originals.
 */

import type { Project } from "@/lib/types";
import type { TranslationMap } from "@/lib/supabase/translations";
import type { Locale } from "./strings";

export function applyTranslations(
  project: Project,
  locale: Locale,
  translations: TranslationMap
): Project {
  if (locale === "no" || Object.keys(translations).length === 0) {
    return project;
  }

  return {
    ...project,
    pois: project.pois.map((poi) => ({
      ...poi,
      editorialHook:
        translations[`poi:${poi.id}:editorial_hook`] ?? poi.editorialHook,
      localInsight:
        translations[`poi:${poi.id}:local_insight`] ?? poi.localInsight,
    })),
    reportConfig: project.reportConfig
      ? {
          ...project.reportConfig,
          heroIntro:
            translations[`report:${project.id}:hero_intro`] ??
            project.reportConfig.heroIntro,
          closingTitle:
            translations[`report:${project.id}:closing_title`] ??
            project.reportConfig.closingTitle,
          closingText:
            translations[`report:${project.id}:closing_text`] ??
            project.reportConfig.closingText,
          themes: project.reportConfig.themes?.map((theme) => ({
            ...theme,
            bridgeText:
              translations[`theme:${theme.id}:bridge_text`] ??
              theme.bridgeText,
          })),
        }
      : project.reportConfig,
  };
}
