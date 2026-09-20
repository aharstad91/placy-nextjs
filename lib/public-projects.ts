import "server-only";

import { isPublicProjectSlug } from "@/lib/project-paths";
import { createServerClient } from "@/lib/supabase/client";

export interface PublicProjectRoute {
  slug: string;
  customer: string;
  projectSlug: string;
  projectId: string;
}

export class PublicProjectError extends Error {
  constructor(readonly kind: "not_found" | "unavailable" = "not_found") {
    super("Public project unavailable");
  }
}

type Lookup = (slug: string) => Promise<{
  slug: string;
  customer_id: string;
  project_id: string;
  enabled: boolean;
} | null>;

async function databaseLookup(slug: string) {
  const { data, error } = await createServerClient()
    .schema("v2")
    .from("voice_projects")
    .select("slug,customer_id,project_id,enabled")
    .eq("slug", slug)
    .abortSignal(AbortSignal.timeout(8_000))
    .maybeSingle();
  if (error) throw new PublicProjectError("unavailable");
  return data;
}

/**
 * The root URL registry resolves identity only. Board content is always loaded
 * through the ordinary report-product read path after this check.
 */
export async function resolvePublicProjectRoute(
  slug: string,
  lookup: Lookup = databaseLookup,
): Promise<PublicProjectRoute> {
  if (!isPublicProjectSlug(slug)) throw new PublicProjectError();
  try {
    const binding = await lookup(slug);
    if (!binding?.enabled || binding.slug !== slug) throw new PublicProjectError();
    const projectSlug = binding.project_id.startsWith(`${binding.customer_id}_`)
      ? binding.project_id.slice(binding.customer_id.length + 1)
      : "";
    if (!projectSlug || binding.project_id !== `${binding.customer_id}_${projectSlug}`) {
      throw new PublicProjectError("unavailable");
    }
    return {
      slug,
      customer: binding.customer_id,
      projectSlug,
      projectId: binding.project_id,
    };
  } catch (error) {
    if (error instanceof PublicProjectError) throw error;
    throw new PublicProjectError("unavailable");
  }
}
