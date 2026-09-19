import {
  importResearchPackage,
  type ResearchPackageImportResult,
} from "@/lib/pipeline/import-research-package";
import { parseResearchPackage } from "@/lib/pipeline/research-package";
import { revalidateProject } from "@/lib/pipeline/provision";
import { createServerClient } from "@/lib/supabase/client";

export interface ResearchProjectRoute {
  customer: string;
  projectSlug: string;
}

export interface ApplyResearchPackageDeps {
  resolveProjectRoute(projectId: string): Promise<ResearchProjectRoute>;
  importPackage(input: unknown): Promise<ResearchPackageImportResult>;
  revalidate(route: ResearchProjectRoute): Promise<{ revalidated: string[] }>;
}

async function resolveProjectRoute(
  projectId: string,
): Promise<ResearchProjectRoute> {
  const db = createServerClient().schema("v2");
  const { data, error } = await db
    .from("projects")
    .select("customer_id, url_slug")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Prosjektoppslag feilet: ${error.message}`);
  if (!data) throw new Error(`Ukjent prosjekt «${projectId}»`);
  return { customer: data.customer_id, projectSlug: data.url_slug };
}

const DEFAULT_DEPS: ApplyResearchPackageDeps = {
  resolveProjectRoute,
  importPackage: importResearchPackage,
  revalidate: (route) =>
    revalidateProject(route.customer, route.projectSlug, undefined, {
      existed: true,
    }),
};

export interface ApplyResearchPackageResult
  extends ResearchPackageImportResult {
  route: ResearchProjectRoute;
  revalidated: string[];
}

/**
 * Existing and newly provisioned projects share this apply path. Route lookup
 * happens before the transaction; cache invalidation only happens after a
 * successful import receipt.
 */
export async function applyResearchPackage(
  input: unknown,
  deps: ApplyResearchPackageDeps = DEFAULT_DEPS,
): Promise<ApplyResearchPackageResult> {
  const researchPackage = parseResearchPackage(input);
  const route = await deps.resolveProjectRoute(researchPackage.projectId);
  const receipt = await deps.importPackage(researchPackage);
  const { revalidated } =
    receipt.status === "imported"
      ? await deps.revalidate(route)
      : { revalidated: [] };
  return { ...receipt, route, revalidated };
}
