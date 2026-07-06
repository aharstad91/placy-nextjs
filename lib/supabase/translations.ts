/**
 * Translations module for bilingual Report content.
 *
 * Norwegian texts live in POI/product fields (canonical source).
 * English overrides are stored in the translations table.
 *
 * SERVER ONLY — the `server-only` import below makes a client-component
 * import fail at build-time (enforced, not just documented).
 */

import "server-only";
import { supabase, isSupabaseConfigured } from "./client";
import type { Locale } from "@/lib/i18n/strings";

export type { Locale };

/** Flat map: "entity_type:entity_id:field" → translated value */
export type TranslationMap = Record<string, string>;

/**
 * Fetch all translations for a project's entities.
 * Returns a flat map keyed by "entity_type:entity_id:field".
 */
export async function getProjectTranslations(
  locale: Locale,
  poiIds: string[],
  themeIds: string[],
  reportProductId: string
): Promise<TranslationMap> {
  if (!isSupabaseConfigured() || !supabase || locale === "no") {
    return {};
  }

  // Also include product-specific theme keys (productId_themeId) for per-product overrides
  const productThemeIds = themeIds.map((id) => `${reportProductId}_${id}`);
  const allEntityIds = [...poiIds, ...themeIds, ...productThemeIds, reportProductId];
  if (allEntityIds.length === 0) return {};

  // v2-skjemaet (cutover, migrasjon 072): entity_id-ene er v2-poi-/produkt-uuid-er.
  const { data, error } = await supabase
    .schema("v2")
    .from("translations")
    .select("entity_type, entity_id, field, value")
    .eq("locale", locale)
    .in("entity_id", allEntityIds);

  if (error || !data) {
    return {};
  }

  const map: TranslationMap = {};
  for (const row of data) {
    map[`${row.entity_type}:${row.entity_id}:${row.field}`] = row.value;
  }
  return map;
}
