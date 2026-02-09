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
import { getProjectTripsAdmin, getAllTripsAdmin } from "@/lib/supabase/queries";
import type {
  DbCategory,
  DbProjectCategory,
  DbCustomer,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

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
  customers: Pick<DbCustomer, "id" | "name"> | null;
  discovery_circles: Array<{ lat: number; lng: number; radiusMeters: number }> | null;
  project_categories: DbProjectCategory[];
  project_pois: Array<{
    poi_id: string;
    project_category_id: string | null;
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
  product_pois: Array<{ poi_id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!adminEnabled) {
    redirect("/");
  }

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

  // Try to fetch project_categories (may not exist if migration not run)
  let projectCategories: DbProjectCategory[] = [];
  const { data: categories } = await supabase
    .from("project_categories")
    .select("*")
    .eq("project_id", projectId);
  if (categories) {
    projectCategories = categories;
  }

  // Fetch project_pois with nested data
  // Note: project_category_id only exists after migration 005 is applied
  const { data: projectPoisData } = await supabase
    .from("project_pois")
    .select(
      `
      poi_id,
      pois (
        id,
        name,
        lat,
        lng,
        category_id,
        google_rating,
        categories (*)
      )
    `
    )
    .eq("project_id", projectId);

  // Add project_category_id as null for each POI (until migration is applied)
  const projectPoisWithCategory = (projectPoisData || []).map((pp) => ({
    ...pp,
    project_category_id: null,
  }));

  // Fetch products with their selected POIs
  const { data: productsData } = await supabase
    .from("products")
    .select(`
      id,
      product_type,
      story_title,
      product_pois (poi_id)
    `)
    .eq("project_id", projectId)
    .order("product_type");

  // Combine into the expected structure
  const projectWithRelations = {
    ...project,
    project_categories: projectCategories,
    project_pois: projectPoisWithCategory,
    products: (productsData || []) as ProductWithPois[],
  };

  // Fetch all customers for dropdown
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  // Fetch all global categories for dropdown
  const { data: globalCategories } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  // Fetch all POIs for "Add POI" modal (with category for grouping)
  const { data: allPois } = await supabase
    .from("pois")
    .select("id, name, category_id, categories(id, name, color)")
    .order("name");

  // Fetch trips linked to this project (for Trips tab)
  const projectTrips = await getProjectTripsAdmin(projectId);

  // Fetch all trips for "Add trip" search (for Trips tab)
  const allTrips = await getAllTripsAdmin();

  // Get project city for geo-suggestions
  // Find customer city from existing data or project coords
  const projectCity = project.name; // Will be used for geo suggestions

  // Server Actions

  async function updateProject(formData: FormData) {
    "use server";

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
      .from("projects")
      .update({
        customer_id: customerId,
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

  async function createProjectCategory(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const name = getRequiredString(formData, "name");
    const icon = getRequiredString(formData, "icon");
    const color = getRequiredString(formData, "color");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase.from("project_categories").insert({
      project_id: projectId,
      name,
      icon,
      color,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "En kategori med dette navnet finnes allerede i prosjektet."
        );
      }
      throw new Error(error.message);
    }

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function updateProjectCategory(formData: FormData) {
    "use server";

    const id = getRequiredString(formData, "id");
    const shortId = getRequiredString(formData, "shortId");
    const name = getRequiredString(formData, "name");
    const icon = getRequiredString(formData, "icon");
    const color = getRequiredString(formData, "color");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("project_categories")
      .update({ name, icon, color })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "En kategori med dette navnet finnes allerede i prosjektet."
        );
      }
      throw new Error(error.message);
    }

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function deleteProjectCategory(formData: FormData) {
    "use server";

    const id = getRequiredString(formData, "id");
    const shortId = getRequiredString(formData, "shortId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Check if any POIs use this category
    const { count } = await supabase
      .from("project_pois")
      .select("*", { count: "exact", head: true })
      .eq("project_category_id", id);

    if (count && count > 0) {
      throw new Error(`Kan ikke slette. Kategorien brukes av ${count} POI-er.`);
    }

    const { error } = await supabase
      .from("project_categories")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function updateProjectPoiCategory(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const poiId = getRequiredString(formData, "poiId");
    const projectCategoryId = getOptionalString(formData, "projectCategoryId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("project_pois")
      .update({ project_category_id: projectCategoryId })
      .eq("project_id", projectId)
      .eq("poi_id", poiId);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function addPoiToProject(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const poiId = getRequiredString(formData, "poiId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase.from("project_pois").insert({
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
      .from("products")
      .select("id")
      .eq("project_id", projectId);

    if (products && products.length > 0) {
      const rows = products.map((p) => ({ product_id: p.id, poi_id: poiId }));
      await supabase
        .from("product_pois")
        .upsert(rows, { onConflict: "product_id,poi_id", ignoreDuplicates: true });
    }

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function batchAddPoisToProject(formData: FormData) {
    "use server";

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
      .from("project_pois")
      .upsert(rows, { onConflict: "project_id,poi_id", ignoreDuplicates: true });

    if (error) throw new Error(error.message);

    // Auto-add to all products in this project
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .eq("project_id", projectId);

    if (products && products.length > 0) {
      const productPoiRows = products.flatMap((product) =>
        poiIds.map((poiId) => ({ product_id: product.id, poi_id: poiId }))
      );
      await supabase
        .from("product_pois")
        .upsert(productPoiRows, { onConflict: "product_id,poi_id", ignoreDuplicates: true });
    }

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function removePoiFromProject(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const poiId = getRequiredString(formData, "poiId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    // Also remove from all products in this project (cascade cleanup)
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .eq("project_id", projectId);

    if (products && products.length > 0) {
      await supabase
        .from("product_pois")
        .delete()
        .in("product_id", products.map((p) => p.id))
        .eq("poi_id", poiId);
    }

    const { error } = await supabase
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

    const productId = getRequiredString(formData, "productId");
    const poiId = getRequiredString(formData, "poiId");
    const shortId = getRequiredString(formData, "shortId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase.from("product_pois").insert({
      product_id: productId,
      poi_id: poiId,
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
    const rows = poiIds.map((poiId) => ({
      product_id: productId,
      poi_id: poiId,
    }));

    const { error } = await supabase
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

    const productId = getRequiredString(formData, "productId");
    const poiId = getRequiredString(formData, "poiId");
    const shortId = getRequiredString(formData, "shortId");
    const customerSlug = getOptionalString(formData, "customerSlug");
    const projectSlug = getOptionalString(formData, "projectSlug");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
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
      .from("products")
      .select("id")
      .eq("project_id", projectId)
      .eq("product_type", productType)
      .single();

    if (existing) {
      throw new Error(`Et ${productType}-produkt finnes allerede for dette prosjektet.`);
    }

    const newProductId = crypto.randomUUID();
    const { error } = await supabase.from("products").insert({
      id: newProductId,
      project_id: projectId,
      product_type: productType,
    });

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${shortId}`);
    revalidatePath("/admin/projects");
  }

  // --- Trip-related server actions (WP3B) ---

  async function linkTripToProject(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const tripId = getRequiredString(formData, "tripId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase.from("project_trips").insert({
      project_id: projectId,
      trip_id: tripId,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Denne trippen er allerede koblet til prosjektet.");
      }
      throw new Error(error.message);
    }

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function unlinkTripFromProject(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
    const shortId = getRequiredString(formData, "shortId");
    const tripId = getRequiredString(formData, "tripId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("project_trips")
      .delete()
      .eq("project_id", projectId)
      .eq("trip_id", tripId);

    if (error) throw new Error(error.message);

    revalidatePath(`/admin/projects/${shortId}`);
  }

  async function updateProjectTripOverride(formData: FormData) {
    "use server";

    const overrideId = getRequiredString(formData, "overrideId");
    const shortId = getRequiredString(formData, "shortId");
    const startPoiId = getOptionalString(formData, "startPoiId");
    const startName = getOptionalString(formData, "startName");
    const startDescription = getOptionalString(formData, "startDescription");
    const startTransitionText = getOptionalString(formData, "startTransitionText");
    const rewardTitle = getOptionalString(formData, "rewardTitle");
    const rewardDescription = getOptionalString(formData, "rewardDescription");
    const rewardCode = getOptionalString(formData, "rewardCode");
    const rewardValidityDays = getOptionalNumber(formData, "rewardValidityDays");
    const welcomeText = getOptionalString(formData, "welcomeText");
    const enabled = formData.get("enabled") === "true";

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("project_trips")
      .update({
        start_poi_id: startPoiId,
        start_name: startName,
        start_description: startDescription,
        start_transition_text: startTransitionText,
        reward_title: rewardTitle,
        reward_description: rewardDescription,
        reward_code: rewardCode,
        reward_validity_days: rewardValidityDays,
        welcome_text: welcomeText,
        enabled,
      })
      .eq("id", overrideId);

    if (error) throw new Error(error.message);

    revalidatePath(`/admin/projects/${shortId}`);
  }

  return (
    <ProjectDetailClient
      project={projectWithRelations as ProjectWithRelations}
      customers={customers || []}
      globalCategories={globalCategories || []}
      allPois={allPois || []}
      projectTrips={projectTrips}
      allTrips={allTrips}
      updateProject={updateProject}
      createProjectCategory={createProjectCategory}
      updateProjectCategory={updateProjectCategory}
      deleteProjectCategory={deleteProjectCategory}
      addPoiToProject={addPoiToProject}
      batchAddPoisToProject={batchAddPoisToProject}
      removePoiFromProject={removePoiFromProject}
      addPoiToProduct={addPoiToProduct}
      removePoiFromProduct={removePoiFromProduct}
      batchAddPoisToProduct={batchAddPoisToProduct}
      batchRemovePoisFromProduct={batchRemovePoisFromProduct}
      createProduct={createProduct}
      linkTripToProject={linkTripToProject}
      unlinkTripFromProject={unlinkTripFromProject}
      updateProjectTripOverride={updateProjectTripOverride}
    />
  );
}
