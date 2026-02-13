import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for public (SEO) pages.
 * Unlike the main client, this does NOT set cache: "no-store",
 * allowing Next.js ISR (revalidate) to work properly.
 *
 * Uses untyped client because areas/category_slugs tables
 * are not yet in the generated Database types.
 * TODO: Regenerate types after running migration 018.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key);
}
