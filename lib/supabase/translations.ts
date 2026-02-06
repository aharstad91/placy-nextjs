/**
 * Translations module for bilingual Report content.
 *
 * Norwegian texts live in POI/product fields (canonical source).
 * English overrides are stored in the translations table.
 *
 * SERVER ONLY — do not import in client components.
 */

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

  const allEntityIds = [...poiIds, ...themeIds, reportProductId];
  if (allEntityIds.length === 0) return {};

  // TODO: Remove type casts after regenerating Supabase types to include translations table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("translations")
    .select("entity_type, entity_id, field, value")
    .eq("locale", locale)
    .in("entity_id", allEntityIds);

  if (error || !data) {
    // translations table might not exist yet (migration 010 not applied)
    return {};
  }

  const map: TranslationMap = {};
  for (const row of data as Array<{ entity_type: string; entity_id: string; field: string; value: string }>) {
    map[`${row.entity_type}:${row.entity_id}:${row.field}`] = row.value;
  }
  return map;
}
