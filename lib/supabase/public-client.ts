import { createClient } from "@supabase/supabase-js";

/** Tag used by revalidateTag() to purge all Supabase Data Cache entries */
export const SUPABASE_CACHE_TAG = "supabase-public";

/** Match ISR revalidation period (24 hours) */
const REVALIDATE_SECONDS = 86400;

/**
 * Supabase client for public (SEO) pages.
 *
 * Uses `next.revalidate` + `next.tags` so the Data Cache:
 *  1. Auto-expires after 24h (matching ISR)
 *  2. Can be force-purged via revalidateTag("supabase-public")
 *
 * Without this, Vercel's Data Cache persists across deployments
 * and revalidatePath alone does not reliably clear it.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          next: { revalidate: REVALIDATE_SECONDS, tags: [SUPABASE_CACHE_TAG] },
        }),
    },
  });
}
