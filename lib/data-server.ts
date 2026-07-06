/**
 * Server-only data loading.
 *
 * Cutover 2026-07-06: v2-skjemaet er ENESTE datakilde. JSON-fallbacken
 * (data/projects/) ble slettet i legacy-oppryddingen samme dag — demo-æraens
 * prosjekter er borte, alt provisjoneres via pipelinen (lib/pipeline/).
 *
 * WARNING: Do not import this file in client components (server-only lesesti).
 */

import type { Project, ProductType } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import { getProductFromSupabaseV2 } from "./supabase/v2-queries";

/**
 * Load a specific product for a project.
 * SERVER ONLY - do not import in client components
 */
export async function getProductAsync(
  customer: string,
  projectSlug: string,
  productType: ProductType
): Promise<Project | null> {
  if (!isSupabaseConfigured()) {
    console.error(
      "getProductAsync: Supabase er ikke konfigurert — ingen datakilde (JSON-fallbacken døde ved cutover 2026-07-06)"
    );
    return null;
  }

  return getProductFromSupabaseV2(customer, projectSlug, productType);
}
