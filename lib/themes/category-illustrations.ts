import { THEME_SCENE_SRC } from "@/components/variants/report/theme-icons";

// Prosjekt-spesifikke illustrasjoner finnes for disse prosjektene som
// `/illustrations/<slug>-<categoryId>.jpg` + `/illustrations/<slug>-hero.jpg`.
// Når et prosjekt mangler egne illustrasjoner, faller vi tilbake til
// generic theme-illustrasjoner i `/illustrations/themes/`.
const PROJECTS_WITH_CUSTOM_ILLUSTRATIONS = new Set([
  "stasjonskvartalet",
]);

/** Returnerer src for kategori-illustrasjon, med prosjekt-spesifikk variant
 *  prioritert hvis tilgjengelig. */
export function getCategoryIllustrationSrc(
  projectSlug: string | undefined,
  categoryId: string,
): string | undefined {
  if (projectSlug && PROJECTS_WITH_CUSTOM_ILLUSTRATIONS.has(projectSlug)) {
    return `/illustrations/${projectSlug}-${categoryId}.jpg`;
  }
  return THEME_SCENE_SRC[categoryId];
}
