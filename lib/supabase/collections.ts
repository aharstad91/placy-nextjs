/**
 * Collections («Min samling») — brukerlagrede POI-utvalg fra event-boardet.
 * Lever i `v2.collections` (migrasjon 073, cutover 2026-07-06); skrivestien
 * er `mutations.ts#createCollection` via `app/api/collections`.
 *
 * SERVER ONLY — bruker service-role-klienten (bypass RLS) for å lese
 * collections. Anon-klienten hadde USING (true)-policy som eksponerte
 * e-poster til alle med den offentlige anon-nøkkelen (PII-lekk verifisert
 * 2026-07-06, lukket i migrasjon 076). `server-only`-vakten gir build-feil
 * hvis en klientkomponent skulle importere denne filen.
 */

import "server-only";
import { createServerClient } from "./client";

export async function getCollectionBySlug(
  slug: string
): Promise<{ id: string; slug: string; project_id: string | null; poi_ids: string[]; email: string | null; created_at: string } | null> {
  let db;
  try {
    db = createServerClient();
  } catch {
    return null;
  }

  const { data, error } = await db
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
