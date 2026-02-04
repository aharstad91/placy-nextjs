import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { ProjectDetailClient } from "./project-detail-client";
import {
  getRequiredString,
  getOptionalString,
  getRequiredNumber,
} from "@/lib/utils/form-data";
import type {
  DbCategory,
  DbProjectCategory,
  DbCustomer,
} from "@/lib/supabase/types";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Types for nested query results
export interface ProjectWithRelations {
  id: string;
  name: string;
  url_slug: string;
  product_type: string;
  center_lat: number;
  center_lng: number;
  customer_id: string | null;
  customers: Pick<DbCustomer, "id" | "name"> | null;
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
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!adminEnabled) {
    redirect("/");
  }

  const { id: projectId } = await params;

  const supabase = createServerClient();
  if (!supabase) {
    redirect("/");
  }

  // Fetch project with nested relations
  // Split query to handle case where project_categories table doesn't exist yet
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      url_slug,
      product_type,
      center_lat,
      center_lng,
      customer_id,
      customers (id, name)
    `
    )
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    notFound();
  }

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
  const { data: projectPoisData, error: poisError } = await supabase
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

  // Combine into the expected structure
  const projectWithRelations = {
    ...project,
    project_categories: projectCategories,
    project_pois: projectPoisWithCategory,
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

  // Fetch all POIs for "Add POI" dropdown
  const { data: allPois } = await supabase
    .from("pois")
    .select("id, name, category_id")
    .order("name");

  // Server Actions

  async function updateProject(formData: FormData) {
    "use server";

    const id = getRequiredString(formData, "id");
    const customerId = getOptionalString(formData, "customerId");
    const name = getRequiredString(formData, "name");
    const urlSlug = getRequiredString(formData, "urlSlug");
    const productType = getRequiredString(formData, "productType");
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
        product_type: productType,
        center_lat: centerLat,
        center_lng: centerLng,
      })
      .eq("id", id);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${id}`);
    revalidatePath("/admin/projects");
  }

  async function createProjectCategory(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
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

    revalidatePath(`/admin/projects/${projectId}`);
  }

  async function updateProjectCategory(formData: FormData) {
    "use server";

    const id = getRequiredString(formData, "id");
    const projectId = getRequiredString(formData, "projectId");
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

    revalidatePath(`/admin/projects/${projectId}`);
  }

  async function deleteProjectCategory(formData: FormData) {
    "use server";

    const id = getRequiredString(formData, "id");
    const projectId = getRequiredString(formData, "projectId");

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
    revalidatePath(`/admin/projects/${projectId}`);
  }

  async function updateProjectPoiCategory(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
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
    revalidatePath(`/admin/projects/${projectId}`);
  }

  async function addPoiToProject(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
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

    revalidatePath(`/admin/projects/${projectId}`);
  }

  async function removePoiFromProject(formData: FormData) {
    "use server";

    const projectId = getRequiredString(formData, "projectId");
    const poiId = getRequiredString(formData, "poiId");

    const supabase = createServerClient();
    if (!supabase) throw new Error("Database not configured");

    const { error } = await supabase
      .from("project_pois")
      .delete()
      .eq("project_id", projectId)
      .eq("poi_id", poiId);

    if (error) throw new Error(error.message);
    revalidatePath(`/admin/projects/${projectId}`);
  }

  return (
    <ProjectDetailClient
      project={projectWithRelations as ProjectWithRelations}
      customers={customers || []}
      globalCategories={globalCategories || []}
      allPois={allPois || []}
      updateProject={updateProject}
      createProjectCategory={createProjectCategory}
      updateProjectCategory={updateProjectCategory}
      deleteProjectCategory={deleteProjectCategory}
      updateProjectPoiCategory={updateProjectPoiCategory}
      addPoiToProject={addPoiToProject}
      removePoiFromProject={removePoiFromProject}
    />
  );
}
