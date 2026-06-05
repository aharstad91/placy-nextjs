import { THEME_SCENE_SRC } from "@/components/variants/report/theme-icons";
import type { ProjectAssetFlags } from "@/lib/types";

// Prosjekt-spesifikke kategori-illustrasjoner finnes som
// `/illustrations/<slug>-<categoryId>.jpg`. Opt-in via Supabase
// `reportConfig.assets.customIllustrations` (erstatter den gamle hardkodede
// slug-Set-en) — et nytt prosjekt skrur på flagget når filene er lastet opp,
// uten kodeendring. Mangler flagget, faller vi tilbake til generic
// theme-illustrasjoner i `/illustrations/themes/`.

/** Returnerer src for kategori-illustrasjon, med prosjekt-spesifikk variant
 *  prioritert når `assets.customIllustrations` er satt. */
export function getCategoryIllustrationSrc(
  projectSlug: string | undefined,
  categoryId: string,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (projectSlug && assets?.customIllustrations) {
    return `/illustrations/${projectSlug}-${categoryId}.jpg`;
  }
  return THEME_SCENE_SRC[categoryId];
}
