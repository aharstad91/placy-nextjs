import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { ProjectDetailClient } from "./project-detail-client";
import {
  getRequiredString,
  getOptionalString,
  getOptionalNumber,
  getRequiredNumber,
} from "@/lib/utils/form-data";
import type { DbCustomer, TablesV2 } from "@/lib/supabase/types";

type DbCategory = TablesV2<"categories">;
import { requireAdmin } from "@/lib/admin/require-admin";
import { setReportTier } from "@/lib/admin/set-report-tier";

export const metadata = {
  title: "Prosjekt | Placy Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseStringArray(json: string): string[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
    throw new Error("Expected an array of strings");
  }
  return parsed;
}

// Intermediate type for the project query (before joining project_pois, products, etc.)
interface ProjectBase {
  id: string;
  short_id: string;
  name: string;
  url_slug: string;
  center_lat: number;
  center_lng: number;
  customer_id: string | null;
  venue_type: string | null;
  tags: string[];
  default_product: string | null;
  has_3d_addon: boolean;
  discovery_circles: Array<{ lat: number; lng: number; radiusMeters: number }> | null;
  customers: Pick<DbCustomer, "id" | "name"> | null;
}

// Types for nested query results
export interface ProjectWithRelations {
  id: string;
  short_id: string;
  name: string;
  url_slug: string;
  center_lat: number;
  center_lng: number;
  customer_id: string | null;
  venue_type: string | null;
  tags: string[];
  default_product: string | null;
  has_3d_addon: boolean;
  customers: Pick<DbCustomer, "id" | "name"> | null;
  discovery_circles: Array<{ lat: number; lng: number; radiusMeters: number }> | null;
  project_pois: Array<{
    poi_id: string;
    pois: {
      id: string;
      name: string;
      lat: number;
      lng: number;
      category_id: string | null;
      google_rating: number | null;
      categories: DbCategory | null;
    };
  }>;
  products: Array<ProductWithPois>;
}

export interface ProductWithPois {
  id: string;
  product_type: string;
  story_title: string | null;
  /** JSONB — bl.a. reportConfig.reportTier (tier-setteren, Unit 3) */
  config: unknown;
  product_pois: Array<{ poi_id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  requireAdmin();

  // URL param is the short_id (7-character nanoid)
  const { id: shortId } = await params;

  const supabase = createServerClient();
  if (!supabase) {
    redirect("/");
  }

  // Fetch project by short_id with nested relations
  // NOTE: short_id column added in migration 008_add_project_short_id.sql
  // Before migration, fall back to looking up by id
  let project: ProjectBase | null = null;
  let projectError: Error | null = null;

  // First try by short_id (new format)
  const { data: projectByShortId, error: shortIdError } = await supabase
    .schema("v2")
    .from("projects")
    .select(
      `
      id,
      short_id,
      name,
      url_slug,
      center_lat,
      center_lng,
      customer_id,
      venue_type,
      tags,
      default_product,
      has_3d_addon,
      discovery_circles,
      customers (id, name)
    `
    )
    .eq("short_id", shortId)
    .single();

  if (projectByShortId) {
    // Cast needed: short_id column exists (migration 008) but Supabase types not regenerated
    project = projectByShortId as unknown as ProjectBase;
  } else {
    // Fall back to lookup by full id (backward compatibility)
    const { data: projectById, error: idError } = await supabase
      .schema("v2")
      .from("projects")
      .select(
        `
        id,
        name,
        url_slug,
        center_lat,
        center_lng,
        customer_id,
        venue_type,
        tags,
        default_product,
        has_3d_addon,
        discovery_circles,
        customers (id, name)
      `
      )
      .eq("id", shortId)
      .single();

    if (projectById) {
      // Add a temporary short_id for backward compatibility
      project = { ...(projectById as unknown as Omit<ProjectBase, "short_id">), short_id: shortId };
    } else {
      projectError = shortIdError || idError;
    }
  }

  if (projectError || !project) {
    notFound();
  }

  // Use the full project.id for subsequent queries
  const projectId = project.id;

  // project_pois + pois + kategorier i splittede queries (v2-typene bærer
  // ikke relasjons-metadata for nested select; v2.project_pois har ingen
  // project_category_id — den modellen er død).
  const { data: projectPoiLinks, error: linksError } = await supabase
    .schema("v2")
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", projectId);
  if (linksError) {
    console.error("Kunne ikke hente project_pois:", linksError.message);
  }

  const linkedPoiIds = (projectPoiLinks || []).map((l) => l.poi_id);
  const { data: linkedPois, error: linkedPoisError } = linkedPoiIds.length
    ? await supabase
        .schema("v2")
        .from("pois")
        .select("id, name, lat, lng, category_id, google_rating")
        .in("id", linkedPoiIds)
    : { data: [], error: null };
  if (linkedPoisError) {
    console.error("Kunne ikke hente POI-er:", linkedPoisError.message);
  }

  const { data: allCategories, error: allCatError } = await supabase
    .schema("v2")
    .from("categories")
    .select("*");
  if (allCatError) {
    console.error("Kunne ikke hente kategorier:", allCatError.message);
  }
  const categoryById = new Map((allCategories || []).map((c) => [c.id, c]));

  const projectPoisWithCategory = (linkedPois || []).map((poi) => ({
    poi_id: poi.id,
    pois: {
      id: poi.id,
      name: poi.name,
      lat: Number(poi.lat),
      lng: Number(poi.lng),
      category_id: poi.category_id,
      google_rating: poi.google_rating === null ? null : Number(poi.google_rating),
      categories: poi.category_id ? (categoryById.get(poi.category_id) ?? null) : null,
    },
  }));

  // Fetch products + product_pois i splittede queries (v2)
  const { data: productRows, error: productsError } = await supabase
    .schema("v2")
    .from("products")
    .select("id, product_type, story_title, config")
    .eq("project_id", projectId)
    .order("product_type");
  if (productsError) {
    console.error("Kunne ikke hente produkter:", productsError.message);
  }

  const productIds = (productRows || []).map((pr) => pr.id);
  const { data: productPoiRows, error: ppError } = productIds.length
    ? await supabase
        .schema("v2")
        .from("product_pois")
        .select("product_id, poi_id")
        .in("product_id", productIds)
    : { data: [], error: null };
  if (ppError) {
    console.error("Kunne ikke hente product_pois:", ppError.message);
  }

  const poisByProduct = new Map<string, Array<{ poi_id: string }>>();
  for (const rowPp of productPoiRows || []) {
    const list = poisByProduct.get(rowPp.product_id) ?? [];
    list.push({ poi_id: rowPp.poi_id });
    poisByProduct.set(rowPp.product_id, list);
  }

  const productsData = (productRows || []).map((pr) => ({
    ...pr,
    product_pois: poisByProduct.get(pr.id) ?? [],
  }));

  // Combine into the expected structure
  const projectWithRelations = {
    ...project,
    project_pois: projectPoisWithCategory,
    products: productsData as ProductWithPois[],
  };

  // Fetch all customers for dropdown
  const { data: customers } = await supabase
    .schema("v2")
    .from("customers")
    .select("id, name")
    .order("name");

  // Global kategorier til dropdown — gjenbruker allCategories-fetchen over
  const globalCategories = [...(allCategories || [])].sort((a, b) =>
    a.name.localeCompare(b.name, "nb")
  );

  // Fetch all POIs for "Add POI" modal — kategori-info komponeres fra
  // categoryById (v2-typene mangler relasjons-metadata for nested select)
  const { data: allPoiRows } = await supabase
    .schema("v2")
    .from("pois")
    .select("id, name, category_id")
    .order("name");

  const allPois = (allPoiRows || []).map((poi) => {
    const cat = poi.category_id ? categoryById.get(poi.category_id) : undefined;
    return {
      id: poi.id,
      name: poi.name,
      category_id: poi.category_id,
      categories: cat ? { id: cat.id, name: cat.name, color: cat.color } : null,
    };
  });

  // Get project city for geo-suggestions
  // Find customer city from existing data or project coords
  const projectCity = project.name; // Will be used for geo suggestions

  // Server Actions

  async function updateProject(formData: FormData) {
    "use server";
    requireAdmin();

    const id = getRequiredString(formData, "id");
    const shortId = getRequiredString(formData, "shortId");
    const customerId = getOptionalString(formData, "customerId");
    const name = getRequiredString(formData, "name");
    const urlSlug = getRequiredString(formData, "urlSlug");
    const centerLat = getRequiredNumber(formData, "centerLat");
    const centerLng = getRequiredNumber(formData, "centerLng");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .schema("v2")
      .from("projects")
      .update({
        customer_id: customerId ?? undefined,
        name,
        url_slug: urlSlug,
        center_lat: centerLat,
        center_lng: centerLng,
      })
      .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    revalidatePath("/admin/projects");
  }

  async function addPoiToProject(formData: FormData) {
    "use server";
    requireAdmin();

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const poiId = getRequiredString(formData, "poiId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase.schema("v2").from("project_pois").insert({
      project_id: projectId,
      poi_id: poiId,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Denne POI-en er allerede i prosjektet.");
      }
      throw new Error(error.message);
    }

    // Auto-add to all products in this project
    const { data: products } = await supabase
      .schema("v2")
      .from("products")
      .select("id")
      .eq("project_id", projectId);

    if (products && products.length > 0) {
      const rows = products.map((p) => ({ product_id: p.id, poi_id: poiId, featured: false }));
      await supabase
        .schema("v2")
        .from("product_pois")
        .upsert(rows, { onConflict: "product_id,poi_id", ignoreDuplicates: true });
    }

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function batchAddPoisToProject(formData: FormData) {
    "use server";
    requireAdmin();

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const poiIdsJson = getRequiredString(formData, "poiIds");
    const poiIds = parseStringArray(poiIdsJson);
    if (poiIds.length === 0) return;

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const rows = poiIds.map((poiId) => ({
      project_id: projectId,
      poi_id: poiId,
    }));

    const { error } = await supabase
      .schema("v2")
      .from("project_pois")
      .upsert(rows, { onConflict: "project_id,poi_id", ignoreDuplicates: true });

    if (error) throw new Error(error.message);

    // Auto-add to all products in this project
    const { data: products } = await supabase
      .schema("v2")
      .from("products")
      .select("id")
      .eq("project_id", projectId);

    if (products && products.length > 0) {
      const productPoiRows = products.flatMap((product) =>
        poiIds.map((poiId) => ({ product_id: product.id, poi_id: poiId, featured: false }))
      );
      await supabase
        .schema("v2")
        .from("product_pois")
        .upsert(productPoiRows, { onConflict: "product_id,poi_id", ignoreDuplicates: true });
    }

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function removePoiFromProject(formData: FormData) {
    "use server";
    requireAdmin();

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const poiId = getRequiredString(formData, "poiId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Also remove from all products in this project (cascade cleanup)
    const { data: products } = await supabase
      .schema("v2")
      .from("products")
      .select("id")
      .eq("project_id", projectId);

    if (products && products.length > 0) {
      await supabase
        .schema("v2")
        .from("product_pois")
        .delete()
        .in("product_id", products.map((p) => p.id))
        .eq("poi_id", poiId);
    }

    const { error } = await supabase
      .schema("v2")
      .from("project_pois")
      .delete()
      .eq("project_id", projectId)
      .eq("poi_id", poiId);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    if (customerSlug && projectSlug) {
      revalidatePath(`/${customerSlug}/${projectSlug}`, "layout");
    }
  }

  async function addPoiToProduct(formData: FormData) {
    "use server";
    requireAdmin();

    const productId = getRequiredString(formData, "productId");
    const poiId = getRequiredString(formData, "poiId");
    const shortId = getRequiredString(formData, "shortId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase.schema("v2").from("product_pois").insert({
      product_id: productId,
      poi_id: poiId,
      featured: false,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Denne POI-en er allerede i produktet.");
      }
      throw new Error(error.message);
    }

    revalidatePath(`/admin/projects/${shortId}`);
    if (customerSlug && projectSlug) {
      revalidatePath(`/${customerSlug}/${projectSlug}`, "layout");
    }
  }

  async function batchAddPoisToProduct(formData: FormData) {
    "use server";
    requireAdmin();

    const productId = getRequiredString(formData, "productId");
    const poiIdsJson = getRequiredString(formData, "poiIds");
    const shortId = getRequiredString(formData, "shortId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const poiIds = parseStringArray(poiIdsJson);
    if (poiIds.length === 0) return;

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Batch insert - Supabase handles duplicates with upsert
    const rows = poiIds.map((poiId) => ({ product_id: productId, poi_id: poiId, featured: false }));

    const { error } = await supabase
      .schema("v2")
      .from("product_pois")
      .upsert(rows, { onConflict: "product_id,poi_id", ignoreDuplicates: true });

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    if (customerSlug && projectSlug) {
      revalidatePath(`/${customerSlug}/${projectSlug}`, "layout");
    }
  }

  async function batchRemovePoisFromProduct(formData: FormData) {
    "use server";
    requireAdmin();

    const productId = getRequiredString(formData, "productId");
    const poiIdsJson = getRequiredString(formData, "poiIds");
    const shortId = getRequiredString(formData, "shortId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const poiIds = parseStringArray(poiIdsJson);
    if (poiIds.length === 0) return;

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Batch delete
    const { error } = await supabase
      .schema("v2")
      .from("product_pois")
      .delete()
      .eq("product_id", productId)
      .in("poi_id", poiIds);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    if (customerSlug && projectSlug) {
      revalidatePath(`/${customerSlug}/${projectSlug}`, "layout");
    }
  }

  async function removePoiFromProduct(formData: FormData) {
    "use server";
    requireAdmin();

    const productId = getRequiredString(formData, "productId");
    const poiId = getRequiredString(formData, "poiId");
    const shortId = getRequiredString(formData, "shortId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .schema("v2")
      .from("product_pois")
      .delete()
      .eq("product_id", productId)
      .eq("poi_id", poiId);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    if (customerSlug && projectSlug) {
      revalidatePath(`/${customerSlug}/${projectSlug}`, "layout");
    }
  }

  async function createProduct(formData: FormData) {
    "use server";
    requireAdmin();

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const productType = getRequiredString(formData, "productType") as
      | "explorer"
      | "report"
      | "guide";

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Check if this product type already exists for the project
    const { data: existing } = await supabase
      .schema("v2")
      .from("products")
      .select("id")
      .eq("project_id", projectId)
      .eq("product_type", productType)
      .single();

    if (existing) {
      throw new Error(`Et ${productType}-produkt finnes allerede for dette prosjektet.`);
    }

    const newProductId = crypto.randomUUID();
    const { error } = await supabase.schema("v2").from("products").insert({
      id: newProductId,
      project_id: projectId,
      product_type: productType,
      config: {},
      version: 1,
    });

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    revalidatePath("/admin/projects");
  }

  async function deleteProduct(formData: FormData) {
    "use server";
    requireAdmin();

    const productId = getRequiredString(formData, "productId");
    const shortId = getRequiredString(formData, "shortId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Delete POI links first, then the product
    await supabase.schema("v2").from("product_pois").delete().eq("product_id", productId);
    await supabase.schema("v2").from("product_categories").delete().eq("product_id", productId);

    const { error } = await supabase.schema("v2").from("products").delete().eq("id", productId);
    if (error) throw new Error(error.message);

    revalidatePath(`/admin/projects/${shortId}`);
    revalidatePath("/admin/projects");
  }

  async function updateDefaultProduct(formData: FormData) {
    "use server";
    requireAdmin();

    const id = getRequiredString(formData, "id");
    const shortId = getRequiredString(formData, "shortId");
    const defaultProduct = getRequiredString(formData, "defaultProduct");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .schema("v2")
      .from("projects")
      .update({ default_product: defaultProduct } as Record<string, unknown>)
      .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function updateProjectTags(formData: FormData) {
    "use server";
    requireAdmin();

    const id = getRequiredString(formData, "id");
    const shortId = getRequiredString(formData, "shortId");
    const tagsJson = getRequiredString(formData, "tags");
    const tags = JSON.parse(tagsJson) as string[];

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .schema("v2")
      .from("projects")
      .update({ tags })
      .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    revalidatePath("/admin/projects");
  }

  async function updateProjectHas3dAddon(formData: FormData) {
    "use server";
    requireAdmin();

    const id = getRequiredString(formData, "id");
    const shortId = getRequiredString(formData, "shortId");
    const enabled = formData.get("enabled") === "true";

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .schema("v2")
      .from("projects")
      .update({ has_3d_addon: enabled } as Record<string, unknown>)
      .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function setProjectReportTier(formData: FormData) {
    "use server";
    requireAdmin();

    const productId = getRequiredString(formData, "productId");
    const shortId = getRequiredString(formData, "shortId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");
    const rawTier = formData.get("reportTier");
    const reportTier =
      rawTier === null || rawTier === "" ? undefined : Number(rawTier);

    try {
      const result = await setReportTier({ productId, reportTier });
      revalidatePath(`/admin/projects/${shortId}`);
      if (customerSlug && projectSlug) {
        revalidatePath(`/eiendom/${customerSlug}/${projectSlug}/rapport-board`);
      }
      return { reportTier: result.reportTier, findings: result.findings };
    } catch (err) {
      return {
        findings: [],
        error: err instanceof Error ? err.message : "Kunne ikke sette nivå",
      };
    }
  }

  return (
    <ProjectDetailClient
      project={projectWithRelations as ProjectWithRelations}
      customers={customers || []}
      globalCategories={globalCategories || []}
      allPois={allPois || []}
      updateProject={updateProject}
      addPoiToProject={addPoiToProject}
      batchAddPoisToProject={batchAddPoisToProject}
      removePoiFromProject={removePoiFromProject}
      addPoiToProduct={addPoiToProduct}
      removePoiFromProduct={removePoiFromProduct}
      batchAddPoisToProduct={batchAddPoisToProduct}
      batchRemovePoisFromProduct={batchRemovePoisFromProduct}
      createProduct={createProduct}
      updateProjectTags={updateProjectTags}
      updateProjectHas3dAddon={updateProjectHas3dAddon}
      setProjectReportTier={setProjectReportTier}
      updateDefaultProduct={updateDefaultProduct}
      deleteProduct={deleteProduct}
    />
  );
}
