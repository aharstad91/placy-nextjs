import "server-only";
import { createServerClient } from "@/lib/supabase/client";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import { LocalActivitySchema, type LocalActivity } from "@/lib/knowledge/local-activities";

/** Explicit board selection, shared facts. No queries for boards without opt-in. */
export async function readLocalActivities(ids: readonly string[]): Promise<LocalActivity[]> {
  const byId = new Map<string, LocalActivity>();
  try {
    const db = createServerClient().schema("v2");
    for (const batch of chunkIds([...new Set(ids)])) {
      const { data, error } = await db.from("place_knowledge").select("*").in("id", batch);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const parsed = LocalActivitySchema.safeParse(row);
        if (parsed.success) byId.set(row.id, parsed.data);
        else console.warn(`[knowledge] Invalid or unreviewed activity: ${row.id}`);
      }
    }
  } catch (error) {
    console.error("[knowledge] Could not read local activities:", error);
    return [];
  }
  return [...new Set(ids)].flatMap((id) => {
    const fact = byId.get(id);
    if (!fact) console.warn(`[knowledge] Unavailable activity: ${id}`);
    return fact ? [fact] : [];
  });
}
