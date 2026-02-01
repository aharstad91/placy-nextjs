import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";
import { ProjectsAdminClient } from "./projects-admin-client";
import type { DbCustomer } from "@/lib/supabase/types";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Server Actions
async function createProject(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = crypto.randomUUID();
  const customerId = formData.get("customerId") as string;
  const name = formData.get("name") as string;
  const urlSlug = formData.get("urlSlug") as string;
  const centerLat = parseFloat(formData.get("centerLat") as string);
  const centerLng = parseFloat(formData.get("centerLng") as string);
  const productType = (formData.get("productType") as string) || "explorer";

  if (!customerId || !name || !urlSlug) {
    throw new Error("Kunde, navn og URL-slug er påkrevd");
  }

  if (isNaN(centerLat) || isNaN(centerLng)) {
    throw new Error("Ugyldige koordinater");
  }

  // Check if url_slug is unique for this customer
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("customer_id", customerId)
    .eq("url_slug", urlSlug)
    .single();

  if (existing) {
    throw new Error("URL-slug er allerede i bruk for denne kunden");
  }

  const { error } = await supabase.from("projects").insert({
    id,
    customer_id: customerId,
    name,
    url_slug: urlSlug,
    center_lat: centerLat,
    center_lng: centerLng,
    product_type: productType,
  });

  if (error) {
    throw new Error(`Kunne ikke opprette prosjekt: ${error.message}`);
  }

  revalidatePath("/admin/projects");
}

async function updateProject(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;
  const customerId = formData.get("customerId") as string;
  const name = formData.get("name") as string;
  const urlSlug = formData.get("urlSlug") as string;
  const centerLat = parseFloat(formData.get("centerLat") as string);
  const centerLng = parseFloat(formData.get("centerLng") as string);
  const productType = (formData.get("productType") as string) || "explorer";

  if (!id || !customerId || !name || !urlSlug) {
    throw new Error("Alle felt er påkrevd");
  }

  if (isNaN(centerLat) || isNaN(centerLng)) {
    throw new Error("Ugyldige koordinater");
  }

  // Check if url_slug is unique for this customer (excluding current project)
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("customer_id", customerId)
    .eq("url_slug", urlSlug)
    .neq("id", id)
    .single();

  if (existing) {
    throw new Error("URL-slug er allerede i bruk for denne kunden");
  }

  const { error } = await supabase
    .from("projects")
    .update({
      customer_id: customerId,
      name,
      url_slug: urlSlug,
      center_lat: centerLat,
      center_lng: centerLng,
      product_type: productType,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke oppdatere prosjekt: ${error.message}`);
  }

  revalidatePath("/admin/projects");
}

async function deleteProject(formData: FormData) {
  "use server";

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const id = formData.get("id") as string;

  // Delete related data in order (due to foreign key constraints)

  // 1. Get theme stories for this project
  const { data: themeStories } = await supabase
    .from("theme_stories")
    .select("id")
    .eq("project_id", id);

  if (themeStories && themeStories.length > 0) {
    const themeStoryIds = themeStories.map((ts) => ts.id);

    // 2. Get theme story sections
    const { data: themeSections } = await supabase
      .from("theme_story_sections")
      .select("id")
      .in("theme_story_id", themeStoryIds);

    if (themeSections && themeSections.length > 0) {
      const themeSectionIds = themeSections.map((s) => s.id);
      // 3. Delete theme_section_pois
      await supabase
        .from("theme_section_pois")
        .delete()
        .in("section_id", themeSectionIds);
    }

    // 4. Delete theme_story_sections
    await supabase
      .from("theme_story_sections")
      .delete()
      .in("theme_story_id", themeStoryIds);

    // 5. Delete theme_stories
    await supabase.from("theme_stories").delete().eq("project_id", id);
  }

  // 6. Delete section_pois
  const { data: sections } = await supabase
    .from("story_sections")
    .select("id")
    .eq("project_id", id);

  if (sections && sections.length > 0) {
    const sectionIds = sections.map((s) => s.id);
    await supabase.from("section_pois").delete().in("section_id", sectionIds);
  }

  // 7. Delete story_sections
  await supabase.from("story_sections").delete().eq("project_id", id);

  // 8. Delete project_pois
  await supabase.from("project_pois").delete().eq("project_id", id);

  // 9. Finally delete the project
  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error(`Kunne ikke slette prosjekt: ${error.message}`);
  }

  revalidatePath("/admin/projects");
}

export default async function AdminProjectsPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  const supabase = createServerClient();

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">
            Supabase ikke konfigurert
          </h1>
          <p className="mt-2 text-gray-600">
            Sett NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i .env
          </p>
        </div>
      </div>
    );
  }

  // Fetch projects with customer info
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch customers for dropdown
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  if (projectsError || customersError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600">Database-feil</h1>
          <p className="mt-2 text-gray-600">
            {projectsError?.message || customersError?.message}
          </p>
        </div>
      </div>
    );
  }

  // Create customer map for quick lookups
  const customerMap: Record<string, string> = {};
  for (const customer of customers || []) {
    customerMap[customer.id] = customer.name;
  }

  const projectsWithCustomerName = (projects || []).map((project) => ({
    ...project,
    customerName: project.customer_id
      ? customerMap[project.customer_id] || "Ukjent"
      : "Ingen kunde",
  }));

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Laster...
        </div>
      }
    >
      <ProjectsAdminClient
        projects={projectsWithCustomerName}
        customers={customers || []}
        createProject={createProject}
        updateProject={updateProject}
        deleteProject={deleteProject}
      />
    </Suspense>
  );
}
