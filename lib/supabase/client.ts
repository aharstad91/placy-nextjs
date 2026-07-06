import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Sjekker at server-side Supabase-config finnes. Board-lesestien går 100% via
 * service-role på serveren (createServerClient), så gaten sjekker service-role-
 * nøkkelen — ikke anon. Anon-klienten er FJERNET: etter migrasjon 077 har anon
 * ingen SELECT på v2, så en anon-klient ville uansett ikke kunne lese board-data.
 * Å ikke ha en anon-klient i kodebasen er defense-in-depth (ingen vei tilbake til
 * anon-lesing ved et uhell).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Server-side client for API routes, Server Components, and server actions.
// Uses the service-role key (which BYPASSES RLS) — required for writes AND for
// all board reads (anon-SELECT på v2 er trukket tilbake, migrasjon 077).
// FAIL-FAST (no anon fallback): with RLS active on v2.* and anon revoked, silently
// falling back would break reads/writes without error. A crash is better than
// silent failure in a prototype (PRD 1 Beslutning 10 / Unit 5 AC5). Always returns
// a client or throws.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "createServerClient(): NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY må " +
        "være satt i server-runtime. Ingen anon-fallback — med RLS aktiv ville fallback " +
        "brutt service-role-skriving/board-lesing STILLE (PRD 1 Beslutning 10)."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, cache: "no-store" }),
    },
  });
}
