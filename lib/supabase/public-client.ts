import { createClient } from "@supabase/supabase-js";

/** Match ISR revalidation period (24 hours) */
const REVALIDATE_SECONDS = 86400;

/**
 * Supabase client for public (SEO) pages.
 *
 * Uses `next.revalidate` to align the Data Cache with the ISR period.
 * Without this, Next.js caches fetch responses indefinitely and
 * revalidatePath may not consistently clear the Data Cache on Vercel.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, next: { revalidate: REVALIDATE_SECONDS } }),
    },
  });
}
