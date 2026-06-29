import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables not set. Using fallback to JSON files."
  );
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    })
  : null;

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

// Server-side client for API routes, Server Components, and server actions.
// Uses the service-role key (which BYPASSES RLS) — required for writes and for
// admin reads of non-display-ready rows. FAIL-FAST (no anon fallback): with RLS
// active on v2.*, silently falling back to the anon key would break service-role
// writes + admin reads without error. A crash is better than silent failure in a
// prototype (PRD 1 Beslutning 10 / Unit 5 AC5). Always returns a client or throws.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "createServerClient(): NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY må " +
        "være satt i server-runtime. Ingen anon-fallback — med RLS aktiv ville fallback " +
        "brutt service-role-skriving/admin-lesing STILLE (PRD 1 Beslutning 10)."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, cache: "no-store" }),
    },
  });
}
