/**
 * Collections («Min samling») — brukerlagrede POI-utvalg fra event-boardet.
 * Lever i `v2.collections` (migrasjon 073, cutover 2026-07-06); skrivestien
 * er `mutations.ts#createCollection` via `app/api/collections`.
 */

import { supabase, isSupabaseConfigured } from "./client";

export async function getCollectionBySlug(
  slug: string
): Promise<{ id: string; slug: string; project_id: string | null; poi_ids: string[]; email: string | null; created_at: string } | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .schema("v2")
    .from("collections")
    .select("id, slug, project_id, poi_ids, email, created_at")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
