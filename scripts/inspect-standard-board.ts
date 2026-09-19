import { createServerClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";

function args() {
  const values = process.argv.slice(2);
  const get = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const customer = get("--customer");
  const projectSlug = get("--project");
  if (!customer || !projectSlug) throw new Error("--customer og --project er påkrevd");
  return { customer, projectSlug, includeThemeDetails: values.includes("--include-theme-details") };
}

function objectValue(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

async function countRows(query: PromiseLike<{
  count: number | null;
  error: { message: string } | null;
}>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

async function main() {
  const input = args();
  const db = createServerClient().schema("v2");
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("id,name,customer_id,url_slug")
    .eq("customer_id", input.customer)
    .eq("url_slug", input.projectSlug)
    .maybeSingle();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Prosjektet finnes ikke");

  const { data: product, error: productError } = await db
    .from("products")
    .select("id,config,version,updated_at")
    .eq("project_id", project.id)
    .eq("product_type", "report")
    .maybeSingle();
  if (productError) throw new Error(productError.message);
  if (!product) throw new Error("Rapportproduktet finnes ikke");

  const [productPois, featuredPois, projectPois, categories, packages, claims] = await Promise.all([
    countRows(db.from("product_pois").select("poi_id", { count: "exact", head: true }).eq("product_id", product.id)),
    countRows(db.from("product_pois").select("poi_id", { count: "exact", head: true }).eq("product_id", product.id).eq("featured", true)),
    countRows(db.from("project_pois").select("poi_id", { count: "exact", head: true }).eq("project_id", project.id)),
    countRows(db.from("product_categories").select("category_id", { count: "exact", head: true }).eq("product_id", product.id)),
    countRows(db.from("research_packages").select("package_hash", { count: "exact", head: true }).eq("project_id", project.id)),
    countRows(db.from("research_claims").select("id", { count: "exact", head: true }).eq("project_id", project.id).is("superseded_at", null)),
  ]);
  const { data: binding, error: bindingError } = await db
    .from("voice_projects")
    .select("slug,content_source,enabled,public_tenant_id")
    .eq("project_id", project.id)
    .maybeSingle();
  if (bindingError) throw new Error(bindingError.message);

  const root = objectValue(product.config);
  const reportConfig = objectValue(root.reportConfig);
  const assistant = objectValue(reportConfig.assistant);
  const assistantFeatures = objectValue(assistant.features);
  const assets = objectValue(reportConfig.assets);
  const presentation = objectValue(reportConfig.presentation);
  const themes = Array.isArray(reportConfig.themes) ? reportConfig.themes : [];
  const globalFaq = Array.isArray(reportConfig.globalFaq) ? reportConfig.globalFaq : [];
  const boardFacts = Array.isArray(reportConfig.boardFacts) ? reportConfig.boardFacts : [];

  process.stdout.write(`${JSON.stringify({
    inspectedAt: new Date().toISOString(),
    project: { id: project.id, name: project.name, customer: project.customer_id, slug: project.url_slug },
    product: { id: product.id, version: product.version, updatedAt: product.updated_at },
    inventory: { productPois, featuredPois, projectPois, categories },
    research: { packages, currentClaims: claims },
    content: {
      themes: themes.length,
      themeIds: themes.flatMap((theme) => {
        const value = objectValue(theme);
        return typeof value.id === "string" ? [value.id] : [];
      }),
      ...(input.includeThemeDetails ? {
        themeDetails: themes.map((theme) => {
          const value = objectValue(theme);
          return {
            id: value.id ?? null,
            name: value.name ?? null,
            icon: value.icon ?? null,
            color: value.color ?? null,
            categories: value.categories ?? [],
            hasEditorial: value.editorial !== undefined,
            faqCount: Array.isArray(value.faq) ? value.faq.length : 0,
          };
        }),
      } : {}),
      globalFaq: globalFaq.length,
      boardFacts: boardFacts.length,
      assistantEnabled: assistant.enabled === true,
      assistantFeatures: Object.keys(assistantFeatures).filter((key) => assistantFeatures[key] === true).sort(),
      branded: assets.brand === true,
      initialView: presentation.initialView ?? null,
    },
    publicRoute: binding ?? null,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
