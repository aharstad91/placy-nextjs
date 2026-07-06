/**
 * Collections («Min samling») — brukerlagrede POI-utvalg fra event-boardet.
 *
 * OBS: leser `public.collections`, som står på DROP-lista i
 * docs/rebuild/public-drop-plan.md (§2). Event-sporet er parkert; skal
 * «Min samling» overleve public-droppen må tabellen + skrivestien
 * (lib/supabase/mutations.ts#saveCollection / app/api/collections) porteres
 * til v2 først — se drop-planens §4b-inventar.
 */

import { supabase, isSupabaseConfigured } from "./client";

export async function getCollectionBySlug(
  slug: string
): Promise<{ id: string; slug: string; project_id: string; poi_ids: string[]; email: string | null; created_at: string } | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("collections")
    .select("id, slug, project_id, poi_ids, email, created_at")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
